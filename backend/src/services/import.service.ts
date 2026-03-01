// backend/src/services/import.service.ts
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import type { z } from "zod";
import type {
  importPropertyRowsSchema,
  importTenantRowsSchema,
  importContractRowsSchema,
} from "../schemas/import.schema.js";

type PropertyRows = z.infer<typeof importPropertyRowsSchema>;
type TenantRows = z.infer<typeof importTenantRowsSchema>;
type ContractRows = z.infer<typeof importContractRowsSchema>;

export async function importProperties(companyId: number, rows: PropertyRows) {
  // Gruppiere Zeilen nach Immobilien-Name
  const propertyMap = new Map<string, typeof rows>();
  for (const row of rows) {
    const existing = propertyMap.get(row.Immobilie_Name) ?? [];
    existing.push(row);
    propertyMap.set(row.Immobilie_Name, existing);
  }

  let propertiesCreated = 0;
  let unitsCreated = 0;

  await prisma.$transaction(async (tx) => {
    for (const [name, unitRows] of propertyMap) {
      const first = unitRows[0];
      const property = await tx.property.create({
        data: {
          name,
          street: first.Strasse,
          zip: first.PLZ,
          city: first.Stadt,
          status: "AKTIV",
          companyId,
        },
      });
      propertiesCreated++;

      for (const row of unitRows) {
        await tx.unit.create({
          data: {
            number: row.Einheit_Nummer,
            floor: row.Einheit_Etage,
            area: row.Flaeche_m2,
            rent: row.Kaltmiete_EUR,
            type: row.Einheit_Typ,
            status: "FREI",
            propertyId: property.id,
          },
        });
        unitsCreated++;
      }
    }
  });

  return { properties: propertiesCreated, units: unitsCreated };
}

export async function importTenants(companyId: number, rows: TenantRows) {
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      await tx.tenant.create({
        data: {
          name: row.Name,
          email: row.Email,
          phone: row.Telefon,
          moveIn: row.Einzugsdatum,
          companyId,
        },
      });
    }
  });

  return { tenants: rows.length };
}

export async function importContracts(companyId: number, rows: ContractRows) {
  // Referenzen vorab auflösen (alle Properties + Units + Tenants der Company laden)
  const [properties, tenants] = await Promise.all([
    prisma.property.findMany({
      where: { companyId },
      include: { units: { select: { id: true, number: true } } },
    }),
    prisma.tenant.findMany({ where: { companyId }, select: { id: true, name: true } }),
  ]);

  const propertyByName = new Map(properties.map((p) => [p.name.toLowerCase(), p]));
  const tenantByName = new Map(tenants.map((t) => [t.name.toLowerCase(), t]));

  // Validiere Referenzen vor der Transaktion
  const refErrors: { row: number; message: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const property = propertyByName.get(row.Immobilie_Name.toLowerCase());
    if (!property) {
      refErrors.push({ row: i + 1, message: `Immobilie nicht gefunden: "${row.Immobilie_Name}"` });
      continue;
    }
    const unit = property.units.find(
      (u) => u.number.toLowerCase() === row.Einheit_Nummer.toLowerCase()
    );
    if (!unit) {
      refErrors.push({
        row: i + 1,
        message: `Einheit "${row.Einheit_Nummer}" nicht gefunden in "${row.Immobilie_Name}"`,
      });
    }
    const tenant = tenantByName.get(row.Mieter_Name.toLowerCase());
    if (!tenant) {
      refErrors.push({ row: i + 1, message: `Mieter nicht gefunden: "${row.Mieter_Name}"` });
    }
  }

  if (refErrors.length > 0) {
    throw new AppError(400, "Referenzfehler beim Import", { errors: refErrors });
  }

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const property = propertyByName.get(row.Immobilie_Name.toLowerCase())!;
      const unit = property.units.find(
        (u) => u.number.toLowerCase() === row.Einheit_Nummer.toLowerCase()
      )!;
      const tenant = tenantByName.get(row.Mieter_Name.toLowerCase())!;

      await tx.contract.create({
        data: {
          type: row.Typ,
          startDate: row.Mietbeginn,
          endDate: row.Mietende,
          noticePeriod: 3,
          monthlyRent: row.Kaltmiete_EUR,
          deposit: row.Kaution_EUR,
          status: row.Status as "AKTIV" | "ENTWURF" | "GEKUENDIGT",
          tenantId: tenant.id,
          propertyId: property.id,
          unitId: unit.id,
          companyId,
        },
      });
    }
  });

  return { contracts: rows.length };
}
