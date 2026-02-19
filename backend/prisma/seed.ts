import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split(".");
  return new Date(Number(year), Number(month) - 1, Number(day));
}

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.rentPayment.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.maintenanceTicket.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.document.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  // ─── Company ───────────────────────────────────────────────
  const company = await prisma.company.create({
    data: {
      name: "Mustermann Hausverwaltung GmbH",
      slug: "mustermann-hausverwaltung",
      address: "Hauptstr. 1, 10115 Berlin",
      taxNumber: "DE123456789",
      website: "https://mustermann-hv.de",
    },
  });
  console.log(`Company: ${company.name} (ID: ${company.id})`);

  // ─── Admin User ────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Admin123!", 10);
  const admin = await prisma.user.create({
    data: {
      email: "admin@immoverwalt.de",
      passwordHash,
      name: "Max Mustermann",
      role: "ADMIN",
      phone: "+49 30 1234567",
      companyId: company.id,
    },
  });
  console.log(`Admin: ${admin.email} (ID: ${admin.id})`);

  // ─── Additional Users (various roles for RBAC testing) ───
  const verwalter = await prisma.user.create({
    data: {
      email: "verwalter@immoverwalt.de",
      passwordHash,
      name: "Sabine Verwalter",
      role: "VERWALTER",
      phone: "+49 30 2345678",
      companyId: company.id,
    },
  });
  console.log(`Verwalter: ${verwalter.email} (ID: ${verwalter.id})`);

  const buchhalter = await prisma.user.create({
    data: {
      email: "buchhalter@immoverwalt.de",
      passwordHash,
      name: "Frank Buchhalter",
      role: "BUCHHALTER",
      phone: "+49 30 3456789",
      companyId: company.id,
    },
  });
  console.log(`Buchhalter: ${buchhalter.email} (ID: ${buchhalter.id})`);

  const readonly = await prisma.user.create({
    data: {
      email: "leser@immoverwalt.de",
      passwordHash,
      name: "Lisa Leser",
      role: "READONLY",
      phone: "+49 30 4567890",
      companyId: company.id,
    },
  });
  console.log(`Readonly: ${readonly.email} (ID: ${readonly.id})`);

  // ─── Properties ────────────────────────────────────────────
  const properties = await Promise.all([
    prisma.property.create({ data: { name: "Residenz Am Park", street: "Parkstraße 12", zip: "10115", city: "Berlin", status: "AKTIV", companyId: company.id } }),
    prisma.property.create({ data: { name: "Sonnenhof Apartments", street: "Sonnenallee 45", zip: "12045", city: "Berlin", status: "AKTIV", companyId: company.id } }),
    prisma.property.create({ data: { name: "Lindenhaus", street: "Lindenstr. 8", zip: "80331", city: "München", status: "AKTIV", companyId: company.id } }),
    prisma.property.create({ data: { name: "Gewerbepark Ost", street: "Industriestr. 22", zip: "60329", city: "Frankfurt", status: "WARTUNG", companyId: company.id } }),
    prisma.property.create({ data: { name: "Villa Rheinblick", street: "Rheinufer 3", zip: "50667", city: "Köln", status: "AKTIV", companyId: company.id } }),
  ]);
  console.log(`Properties: ${properties.length} created`);

  // ─── Tenants ───────────────────────────────────────────────
  const tenantsData = [
    { name: "Martin Schmidt", email: "m.schmidt@email.de", phone: "+49 170 1234567", moveIn: parseDate("01.03.2022") },
    { name: "Anna Fischer", email: "a.fischer@email.de", phone: "+49 171 2345678", moveIn: parseDate("15.06.2021") },
    { name: "Klaus Weber", email: "k.weber@email.de", phone: "+49 172 3456789", moveIn: parseDate("01.01.2023") },
    { name: "Julia Becker", email: "j.becker@email.de", phone: "+49 173 4567890", moveIn: parseDate("01.09.2020") },
    { name: "Lars Hoffmann", email: "l.hoffmann@email.de", phone: "+49 174 5678901", moveIn: parseDate("15.04.2023") },
    { name: "Petra Schulz", email: "p.schulz@email.de", phone: "+49 175 6789012", moveIn: parseDate("01.07.2022") },
    { name: "Sabine Klein", email: "s.klein@email.de", phone: "+49 176 1111111", moveIn: parseDate("01.02.2023") },
    { name: "Thomas Wolf", email: "t.wolf@email.de", phone: "+49 177 2222222", moveIn: parseDate("15.05.2022") },
    { name: "Rita Braun", email: "r.braun@email.de", phone: "+49 178 3333333", moveIn: parseDate("01.10.2021") },
    { name: "Karl Wagner", email: "k.wagner@email.de", phone: "+49 179 4444444", moveIn: parseDate("01.12.2024") },
    { name: "Eva Neumann", email: "e.neumann@email.de", phone: "+49 170 5555555", moveIn: parseDate("01.04.2022") },
    { name: "Hans Schwarz", email: "h.schwarz@email.de", phone: "+49 171 6666666", moveIn: parseDate("01.08.2023") },
    { name: "TechCo GmbH", email: "info@techco.de", phone: "+49 30 7777777", moveIn: parseDate("01.01.2021") },
    { name: "Design Studio", email: "hello@designstudio.de", phone: "+49 30 8888888", moveIn: parseDate("01.06.2022") },
    { name: "Thomas Müller", email: "t.mueller@email.de", phone: "+49 172 9999999", moveIn: parseDate("01.03.2021") },
    { name: "Frank Richter", email: "f.richter@email.de", phone: "+49 173 0000000", moveIn: parseDate("15.09.2022") },
    { name: "Claudia Lang", email: "c.lang@email.de", phone: "+49 174 1111111", moveIn: parseDate("01.11.2023") },
  ];

  const tenants = await Promise.all(
    tenantsData.map((t) =>
      prisma.tenant.create({ data: { ...t, companyId: company.id } })
    )
  );
  console.log(`Tenants: ${tenants.length} created`);

  // Tenant lookup by name for linking
  const tenantByName = Object.fromEntries(tenants.map((t) => [t.name, t]));

  // ─── Units ─────────────────────────────────────────────────
  // Property 1: Residenz Am Park
  const p1 = properties[0];
  const units1 = await Promise.all([
    prisma.unit.create({ data: { number: "1A", floor: 0, area: 65, rent: 1250, status: "VERMIETET", propertyId: p1.id, tenantId: tenantByName["Martin Schmidt"].id } }),
    prisma.unit.create({ data: { number: "1B", floor: 0, area: 78, rent: 1480, status: "VERMIETET", propertyId: p1.id, tenantId: tenantByName["Anna Fischer"].id } }),
    prisma.unit.create({ data: { number: "2A", floor: 1, area: 65, rent: 1300, status: "VERMIETET", propertyId: p1.id, tenantId: tenantByName["Klaus Weber"].id } }),
    prisma.unit.create({ data: { number: "2B", floor: 1, area: 78, rent: 1520, status: "FREI", propertyId: p1.id } }),
    prisma.unit.create({ data: { number: "3A", floor: 2, area: 92, rent: 1750, status: "VERMIETET", propertyId: p1.id, tenantId: tenantByName["Julia Becker"].id } }),
    prisma.unit.create({ data: { number: "3B", floor: 2, area: 55, rent: 1080, status: "WARTUNG", propertyId: p1.id } }),
    prisma.unit.create({ data: { number: "4A", floor: 3, area: 110, rent: 2100, status: "VERMIETET", propertyId: p1.id, tenantId: tenantByName["Lars Hoffmann"].id } }),
    prisma.unit.create({ data: { number: "4B", floor: 3, area: 85, rent: 1620, status: "VERMIETET", propertyId: p1.id, tenantId: tenantByName["Petra Schulz"].id } }),
  ]);

  // Property 2: Sonnenhof Apartments
  const p2 = properties[1];
  const units2 = await Promise.all([
    prisma.unit.create({ data: { number: "EG-1", floor: 0, area: 48, rent: 890, status: "VERMIETET", propertyId: p2.id, tenantId: tenantByName["Sabine Klein"].id } }),
    prisma.unit.create({ data: { number: "EG-2", floor: 0, area: 52, rent: 950, status: "VERMIETET", propertyId: p2.id, tenantId: tenantByName["Thomas Wolf"].id } }),
    prisma.unit.create({ data: { number: "1-OG-1", floor: 1, area: 62, rent: 1150, status: "VERMIETET", propertyId: p2.id, tenantId: tenantByName["Rita Braun"].id } }),
    prisma.unit.create({ data: { number: "1-OG-2", floor: 1, area: 70, rent: 1280, status: "VERMIETET", propertyId: p2.id, tenantId: tenantByName["Karl Wagner"].id } }),
  ]);

  // Property 3: Lindenhaus
  const p3 = properties[2];
  const units3 = await Promise.all([
    prisma.unit.create({ data: { number: "W1", floor: 0, area: 75, rent: 1400, status: "VERMIETET", propertyId: p3.id, tenantId: tenantByName["Eva Neumann"].id } }),
    prisma.unit.create({ data: { number: "W2", floor: 0, area: 68, rent: 1280, status: "FREI", propertyId: p3.id } }),
    prisma.unit.create({ data: { number: "W3", floor: 1, area: 82, rent: 1550, status: "VERMIETET", propertyId: p3.id, tenantId: tenantByName["Hans Schwarz"].id } }),
    prisma.unit.create({ data: { number: "W4", floor: 1, area: 60, rent: 1120, status: "FREI", propertyId: p3.id } }),
  ]);

  // Property 4: Gewerbepark Ost
  const p4 = properties[3];
  const units4 = await Promise.all([
    prisma.unit.create({ data: { number: "G1", floor: 0, area: 120, rent: 2200, status: "VERMIETET", propertyId: p4.id, tenantId: tenantByName["TechCo GmbH"].id } }),
    prisma.unit.create({ data: { number: "G2", floor: 0, area: 95, rent: 1800, status: "WARTUNG", propertyId: p4.id } }),
    prisma.unit.create({ data: { number: "G3", floor: 1, area: 140, rent: 2600, status: "VERMIETET", propertyId: p4.id, tenantId: tenantByName["Design Studio"].id } }),
    prisma.unit.create({ data: { number: "G4", floor: 1, area: 85, rent: 1600, status: "FREI", propertyId: p4.id } }),
  ]);

  // Property 5: Villa Rheinblick
  const p5 = properties[4];
  const units5 = await Promise.all([
    prisma.unit.create({ data: { number: "A1", floor: 0, area: 95, rent: 2100, status: "VERMIETET", propertyId: p5.id, tenantId: tenantByName["Thomas Müller"].id } }),
    prisma.unit.create({ data: { number: "A2", floor: 0, area: 88, rent: 1950, status: "VERMIETET", propertyId: p5.id, tenantId: tenantByName["Frank Richter"].id } }),
    prisma.unit.create({ data: { number: "B1", floor: 1, area: 105, rent: 2350, status: "VERMIETET", propertyId: p5.id, tenantId: tenantByName["Claudia Lang"].id } }),
    prisma.unit.create({ data: { number: "B2", floor: 1, area: 72, rent: 1600, status: "FREI", propertyId: p5.id } }),
  ]);

  // ─── Parking Units (Garagen & Stellplätze) ────────────────
  const parking1 = await Promise.all([
    prisma.unit.create({ data: { number: "TG-1", floor: -1, area: 15, rent: 85, type: "STELLPLATZ", status: "VERMIETET", propertyId: p1.id, tenantId: tenantByName["Martin Schmidt"].id } }),
    prisma.unit.create({ data: { number: "TG-2", floor: -1, area: 15, rent: 85, type: "STELLPLATZ", status: "VERMIETET", propertyId: p1.id, tenantId: tenantByName["Julia Becker"].id } }),
    prisma.unit.create({ data: { number: "TG-3", floor: -1, area: 15, rent: 85, type: "STELLPLATZ", status: "FREI", propertyId: p1.id } }),
    prisma.unit.create({ data: { number: "G1", floor: 0, area: 18, rent: 120, type: "GARAGE", status: "VERMIETET", propertyId: p1.id, tenantId: tenantByName["Lars Hoffmann"].id } }),
  ]);

  const parking2 = await Promise.all([
    prisma.unit.create({ data: { number: "SP-1", floor: 0, area: 12, rent: 50, type: "STELLPLATZ", status: "VERMIETET", propertyId: p2.id, tenantId: tenantByName["Sabine Klein"].id } }),
    prisma.unit.create({ data: { number: "SP-2", floor: 0, area: 12, rent: 50, type: "STELLPLATZ", status: "FREI", propertyId: p2.id } }),
  ]);

  const parking4 = await Promise.all([
    prisma.unit.create({ data: { number: "TG-A", floor: -1, area: 30, rent: 150, type: "GARAGE", status: "VERMIETET", propertyId: p4.id, tenantId: tenantByName["TechCo GmbH"].id } }),
    prisma.unit.create({ data: { number: "TG-B", floor: -1, area: 30, rent: 150, type: "GARAGE", status: "FREI", propertyId: p4.id } }),
  ]);

  const allUnits = [...units1, ...units2, ...units3, ...units4, ...units5, ...parking1, ...parking2, ...parking4];
  console.log(`Units: ${allUnits.length} created (incl. ${parking1.length + parking2.length + parking4.length} parking)`);

  // Unit lookup by property+number for contracts
  const unitLookup = (propertyIdx: number, unitNumber: string) => {
    const allPropUnits = [units1, units2, units3, units4, units5];
    return allPropUnits[propertyIdx].find((u) => u.number === unitNumber)!;
  };

  // ─── Contracts ─────────────────────────────────────────────
  const contractsData = [
    { tenantName: "Martin Schmidt", propIdx: 0, unit: "1A", type: "WOHNRAUM" as const, startDate: "01.03.2022", endDate: null, noticePeriod: 3, monthlyRent: 1250, deposit: 3750, status: "AKTIV" as const, nextReminder: null, reminderType: null, notes: undefined },
    { tenantName: "Anna Fischer", propIdx: 0, unit: "1B", type: "WOHNRAUM" as const, startDate: "15.06.2021", endDate: "14.06.2026", noticePeriod: 3, monthlyRent: 1480, deposit: 4440, status: "AUSLAUFEND" as const, nextReminder: "15.03.2026", reminderType: "KUENDIGUNGSFRIST" as const, notes: "Mieter hat Interesse an Verlaengerung signalisiert" },
    { tenantName: "Klaus Weber", propIdx: 0, unit: "2A", type: "INDEX" as const, startDate: "01.01.2023", endDate: null, noticePeriod: 3, monthlyRent: 1300, deposit: 3900, status: "AKTIV" as const, nextReminder: "01.01.2027", reminderType: "MIETANPASSUNG" as const, notes: undefined },
    { tenantName: "Julia Becker", propIdx: 0, unit: "3A", type: "WOHNRAUM" as const, startDate: "01.09.2020", endDate: "31.08.2026", noticePeriod: 3, monthlyRent: 1750, deposit: 5250, status: "AKTIV" as const, nextReminder: "31.05.2026", reminderType: "KUENDIGUNGSFRIST" as const, notes: undefined },
    { tenantName: "Lars Hoffmann", propIdx: 0, unit: "4A", type: "STAFFEL" as const, startDate: "15.04.2023", endDate: "14.04.2028", noticePeriod: 3, monthlyRent: 2100, deposit: 6300, status: "AKTIV" as const, nextReminder: "15.04.2026", reminderType: "MIETANPASSUNG" as const, notes: "Staffelerhoehung: +3% jaehrlich" },
    { tenantName: "Petra Schulz", propIdx: 0, unit: "4B", type: "WOHNRAUM" as const, startDate: "01.07.2022", endDate: null, noticePeriod: 3, monthlyRent: 1620, deposit: 4860, status: "AKTIV" as const, nextReminder: null, reminderType: null, notes: undefined },
    { tenantName: "Sabine Klein", propIdx: 1, unit: "EG-1", type: "WOHNRAUM" as const, startDate: "01.02.2023", endDate: null, noticePeriod: 3, monthlyRent: 890, deposit: 2670, status: "AKTIV" as const, nextReminder: null, reminderType: null, notes: undefined },
    { tenantName: "Thomas Wolf", propIdx: 1, unit: "EG-2", type: "WOHNRAUM" as const, startDate: "15.05.2022", endDate: "14.05.2026", noticePeriod: 3, monthlyRent: 950, deposit: 2850, status: "GEKUENDIGT" as const, nextReminder: "14.05.2026", reminderType: "KAUTIONSRUECKZAHLUNG" as const, notes: "Kuendigung eingegangen am 10.01.2026" },
    { tenantName: "Rita Braun", propIdx: 1, unit: "1-OG-1", type: "WOHNRAUM" as const, startDate: "01.10.2021", endDate: null, noticePeriod: 3, monthlyRent: 1150, deposit: 3450, status: "AKTIV" as const, nextReminder: null, reminderType: null, notes: undefined },
    { tenantName: "Karl Wagner", propIdx: 1, unit: "1-OG-2", type: "WOHNRAUM" as const, startDate: "01.12.2024", endDate: "30.11.2026", noticePeriod: 3, monthlyRent: 1280, deposit: 3840, status: "AKTIV" as const, nextReminder: "31.08.2026", reminderType: "KUENDIGUNGSFRIST" as const, notes: undefined },
    { tenantName: "Eva Neumann", propIdx: 2, unit: "W1", type: "INDEX" as const, startDate: "01.04.2022", endDate: null, noticePeriod: 3, monthlyRent: 1400, deposit: 4200, status: "AKTIV" as const, nextReminder: "01.04.2026", reminderType: "MIETANPASSUNG" as const, notes: undefined },
    { tenantName: "Hans Schwarz", propIdx: 2, unit: "W3", type: "WOHNRAUM" as const, startDate: "01.08.2023", endDate: null, noticePeriod: 3, monthlyRent: 1550, deposit: 4650, status: "AKTIV" as const, nextReminder: null, reminderType: null, notes: undefined },
    { tenantName: "TechCo GmbH", propIdx: 3, unit: "G1", type: "GEWERBE" as const, startDate: "01.01.2021", endDate: "31.12.2026", noticePeriod: 6, monthlyRent: 2200, deposit: 13200, status: "AKTIV" as const, nextReminder: "30.06.2026", reminderType: "VERTRAGSVERLAENGERUNG" as const, notes: "Option auf 5 Jahre Verlaengerung" },
    { tenantName: "Design Studio", propIdx: 3, unit: "G3", type: "GEWERBE" as const, startDate: "01.06.2022", endDate: "31.05.2027", noticePeriod: 6, monthlyRent: 2600, deposit: 15600, status: "AKTIV" as const, nextReminder: "30.11.2026", reminderType: "KUENDIGUNGSFRIST" as const, notes: undefined },
    { tenantName: "Thomas Müller", propIdx: 4, unit: "A1", type: "WOHNRAUM" as const, startDate: "01.03.2021", endDate: null, noticePeriod: 3, monthlyRent: 2100, deposit: 6300, status: "AKTIV" as const, nextReminder: null, reminderType: null, notes: undefined },
    { tenantName: "Frank Richter", propIdx: 4, unit: "A2", type: "STAFFEL" as const, startDate: "15.09.2022", endDate: "14.09.2027", noticePeriod: 3, monthlyRent: 1950, deposit: 5850, status: "AKTIV" as const, nextReminder: "15.09.2026", reminderType: "MIETANPASSUNG" as const, notes: "Staffelerhoehung: +2,5% jaehrlich" },
    { tenantName: "Claudia Lang", propIdx: 4, unit: "B1", type: "WOHNRAUM" as const, startDate: "01.11.2023", endDate: "31.10.2026", noticePeriod: 3, monthlyRent: 2350, deposit: 7050, status: "AUSLAUFEND" as const, nextReminder: "31.07.2026", reminderType: "KUENDIGUNGSFRIST" as const, notes: undefined },
  ];

  const contracts = await Promise.all(
    contractsData.map((c) => {
      const tenant = tenantByName[c.tenantName];
      const property = properties[c.propIdx];
      const unit = unitLookup(c.propIdx, c.unit);
      return prisma.contract.create({
        data: {
          type: c.type,
          startDate: parseDate(c.startDate),
          endDate: c.endDate ? parseDate(c.endDate) : null,
          noticePeriod: c.noticePeriod,
          monthlyRent: c.monthlyRent,
          deposit: c.deposit,
          status: c.status,
          nextReminder: c.nextReminder ? parseDate(c.nextReminder) : null,
          reminderType: c.reminderType,
          notes: c.notes ?? null,
          tenantId: tenant.id,
          propertyId: property.id,
          unitId: unit.id,
          companyId: company.id,
        },
      });
    })
  );
  console.log(`Contracts: ${contracts.length} created`);

  // ─── Rent Payments (Mietzahlungen) ─────────────────────────
  // Generate 8 months of rent payments for active/auslaufend contracts
  const activeContracts = contracts.filter((c, i) =>
    ["AKTIV", "AUSLAUFEND"].includes(contractsData[i].status)
  );

  let rentPaymentCount = 0;
  for (let i = 0; i < activeContracts.length; i++) {
    const contract = activeContracts[i];
    const contractData = contractsData[contracts.indexOf(contract)];

    for (let monthOffset = 7; monthOffset >= 0; monthOffset--) {
      // Generate months from 7 months ago to current month
      const now = new Date();
      const month = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      const dueDate = new Date(month.getFullYear(), month.getMonth(), 3); // Due on 3rd

      // Deterministic "random" based on contract index + month
      const seed = (contract.id * 31 + monthOffset * 7) % 100;
      const isCurrent = monthOffset === 0;

      let status: "PUENKTLICH" | "VERSPAETET" | "AUSSTEHEND";
      let amountPaid: number;
      let paidDate: Date | null;

      if (isCurrent) {
        // Current month: ~60% paid, ~40% pending
        if (seed < 60) {
          status = "PUENKTLICH";
          amountPaid = contractData.monthlyRent;
          paidDate = new Date(month.getFullYear(), month.getMonth(), 1 + (seed % 3));
        } else {
          status = "AUSSTEHEND";
          amountPaid = 0;
          paidDate = null;
        }
      } else {
        // Past months: ~92% on time, ~5% late, ~3% outstanding
        if (seed < 92) {
          status = "PUENKTLICH";
          amountPaid = contractData.monthlyRent;
          paidDate = new Date(month.getFullYear(), month.getMonth(), 1 + (seed % 3));
        } else if (seed < 97) {
          status = "VERSPAETET";
          amountPaid = contractData.monthlyRent;
          paidDate = new Date(month.getFullYear(), month.getMonth(), 10 + (seed % 15));
        } else {
          status = "AUSSTEHEND";
          amountPaid = 0;
          paidDate = null;
        }
      }

      await prisma.rentPayment.create({
        data: {
          month,
          amountDue: contractData.monthlyRent,
          amountPaid,
          status,
          dueDate,
          paidDate,
          contractId: contract.id,
          companyId: company.id,
        },
      });
      rentPaymentCount++;
    }
  }
  console.log(`Rent payments: ${rentPaymentCount} created`);

  // ─── Maintenance Tickets ───────────────────────────────────
  const propertyByName = Object.fromEntries(properties.map((p) => [p.name, p]));

  const ticketsData = [
    { title: "Wasserrohrbruch Keller", description: "Wasserrohr im Kellergeschoss undicht, Wasserschaden droht", propertyName: "Residenz Am Park", unitLabel: "Keller", reportedBy: "Martin Schmidt", category: "SANITAER" as const, priority: "DRINGEND" as const, status: "IN_BEARBEITUNG" as const, createdDate: "05.02.2026", dueDate: "07.02.2026", assignedTo: "Sanitaer Meier GmbH", cost: 2800, notes: "Notdienst beauftragt" },
    { title: "Heizung faellt aus", description: "Heizung in Wohnung 2A seit 2 Tagen ohne Funktion", propertyName: "Residenz Am Park", unitLabel: "2A", reportedBy: "Klaus Weber", category: "HEIZUNG" as const, priority: "HOCH" as const, status: "OFFEN" as const, createdDate: "08.02.2026", dueDate: "10.02.2026", assignedTo: null, cost: null, notes: undefined },
    { title: "Fenster undicht", description: "Zugluft durch undichtes Fenster im Wohnzimmer", propertyName: "Sonnenhof Apartments", unitLabel: "EG-1", reportedBy: "Sabine Klein", category: "GEBAEUDE" as const, priority: "MITTEL" as const, status: "OFFEN" as const, createdDate: "01.02.2026", dueDate: "15.02.2026", assignedTo: null, cost: null, notes: undefined },
    { title: "Steckdose defekt", description: "Steckdose in der Kueche funktioniert nicht mehr, Sicherung fliegt raus", propertyName: "Lindenhaus", unitLabel: "W1", reportedBy: "Eva Neumann", category: "ELEKTRIK" as const, priority: "HOCH" as const, status: "WARTEND" as const, createdDate: "03.02.2026", dueDate: "12.02.2026", assignedTo: "Elektro Schulze", cost: 350, notes: "Ersatzteil bestellt, Lieferung 11.02." },
    { title: "Aufzug Wartung faellig", description: "Jaehrliche TUEV-Wartung des Aufzugs steht an", propertyName: "Residenz Am Park", unitLabel: "Allgemein", reportedBy: "Hausverwaltung", category: "GEBAEUDE" as const, priority: "MITTEL" as const, status: "OFFEN" as const, createdDate: "15.01.2026", dueDate: "28.02.2026", assignedTo: "Aufzugtechnik Berlin", cost: 1200, notes: undefined },
    { title: "Rauchmelder Batteriewechsel", description: "Batterien in allen Rauchmeldern im 3. OG muessen gewechselt werden", propertyName: "Residenz Am Park", unitLabel: "3A/3B", reportedBy: "Hausverwaltung", category: "SONSTIGES" as const, priority: "NIEDRIG" as const, status: "OFFEN" as const, createdDate: "20.01.2026", dueDate: "31.03.2026", assignedTo: null, cost: 80, notes: undefined },
    { title: "Parkplatzbeleuchtung defekt", description: "3 Laternen auf dem Parkplatz sind ausgefallen", propertyName: "Gewerbepark Ost", unitLabel: "Aussen", reportedBy: "TechCo GmbH", category: "AUSSENANLAGE" as const, priority: "MITTEL" as const, status: "IN_BEARBEITUNG" as const, createdDate: "28.01.2026", dueDate: "14.02.2026", assignedTo: "Elektro Schulze", cost: 900, notes: undefined },
    { title: "Dachrinne verstopft", description: "Dachrinne an der Westseite verstopft, Wasser laeuft an Fassade", propertyName: "Villa Rheinblick", unitLabel: "Aussen", reportedBy: "Thomas Mueller", category: "GEBAEUDE" as const, priority: "HOCH" as const, status: "OFFEN" as const, createdDate: "06.02.2026", dueDate: "11.02.2026", assignedTo: null, cost: null, notes: undefined },
    { title: "Tuerschloss klemmt", description: "Haustuerschloss schwergaengig, Schluessel laesst sich kaum drehen", propertyName: "Sonnenhof Apartments", unitLabel: "1-OG-1", reportedBy: "Rita Braun", category: "GEBAEUDE" as const, priority: "NIEDRIG" as const, status: "ERLEDIGT" as const, createdDate: "10.01.2026", dueDate: "20.01.2026", assignedTo: "Schluesseldienst Meier", cost: 180, notes: "Schloss ausgetauscht am 18.01." },
    { title: "Schimmel im Bad", description: "Schimmelbefall an der Decke im Badezimmer", propertyName: "Lindenhaus", unitLabel: "W3", reportedBy: "Hans Schwarz", category: "SANITAER" as const, priority: "HOCH" as const, status: "IN_BEARBEITUNG" as const, createdDate: "25.01.2026", dueDate: "10.02.2026", assignedTo: "Sanierung Plus GmbH", cost: 1500, notes: "Ursachenanalyse laeuft" },
    { title: "Garagentor defekt", description: "Elektrisches Garagentor oeffnet nicht mehr", propertyName: "Gewerbepark Ost", unitLabel: "Tiefgarage", reportedBy: "Design Studio", category: "GEBAEUDE" as const, priority: "DRINGEND" as const, status: "ERLEDIGT" as const, createdDate: "02.02.2026", dueDate: "03.02.2026", assignedTo: "Tortechnik Schmidt", cost: 650, notes: "Motor ausgetauscht am 03.02." },
    { title: "Gartenanlage Winterschnitt", description: "Hecken und Baeume muessen zurueckgeschnitten werden", propertyName: "Villa Rheinblick", unitLabel: "Garten", reportedBy: "Hausverwaltung", category: "AUSSENANLAGE" as const, priority: "NIEDRIG" as const, status: "WARTEND" as const, createdDate: "05.01.2026", dueDate: "15.03.2026", assignedTo: "Gartenbau Koeln", cost: 450, notes: "Termin vereinbart fuer KW 10" },
  ];

  const tickets = await Promise.all(
    ticketsData.map((t) =>
      prisma.maintenanceTicket.create({
        data: {
          title: t.title,
          description: t.description,
          category: t.category,
          priority: t.priority,
          status: t.status,
          unitLabel: t.unitLabel,
          reportedBy: t.reportedBy,
          assignedTo: t.assignedTo,
          dueDate: t.dueDate ? parseDate(t.dueDate) : null,
          cost: t.cost,
          notes: t.notes ?? null,
          propertyId: propertyByName[t.propertyName].id,
          unitId: null,
          companyId: company.id,
          createdAt: parseDate(t.createdDate),
        },
      })
    )
  );
  console.log(`Maintenance tickets: ${tickets.length} created`);

  // ─── Documents ─────────────────────────────────────────────
  const docsData = [
    {
      propertyIdx: 0, docs: [
        { name: "Grundbuchauszug", fileType: "PDF", fileSize: "2,4 MB", date: "12.01.2024" },
        { name: "Energieausweis", fileType: "PDF", fileSize: "1,8 MB", date: "05.03.2023" },
        { name: "Versicherungspolice", fileType: "PDF", fileSize: "3,1 MB", date: "20.11.2024" },
        { name: "Nebenkostenabrechnung 2024", fileType: "XLSX", fileSize: "856 KB", date: "15.01.2025" },
      ]
    },
    {
      propertyIdx: 1, docs: [
        { name: "Grundbuchauszug", fileType: "PDF", fileSize: "2,1 MB", date: "08.06.2023" },
        { name: "Energieausweis", fileType: "PDF", fileSize: "1,5 MB", date: "14.02.2023" },
      ]
    },
    {
      propertyIdx: 2, docs: [
        { name: "Grundbuchauszug", fileType: "PDF", fileSize: "1,9 MB", date: "22.09.2023" },
        { name: "Sanierungsprotokoll", fileType: "PDF", fileSize: "4,2 MB", date: "10.07.2024" },
      ]
    },
    {
      propertyIdx: 3, docs: [
        { name: "Grundbuchauszug", fileType: "PDF", fileSize: "2,7 MB", date: "03.04.2022" },
        { name: "Gewerbemietvertrag Vorlage", fileType: "DOCX", fileSize: "520 KB", date: "18.08.2024" },
      ]
    },
    {
      propertyIdx: 4, docs: [
        { name: "Grundbuchauszug", fileType: "PDF", fileSize: "2,3 MB", date: "11.12.2023" },
        { name: "Denkmalschutz-Bescheid", fileType: "PDF", fileSize: "1,1 MB", date: "01.05.2021" },
      ]
    },
  ];

  let docCount = 0;
  for (const group of docsData) {
    for (const doc of group.docs) {
      await prisma.document.create({
        data: {
          name: doc.name,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          propertyId: properties[group.propertyIdx].id,
          companyId: company.id,
          createdAt: parseDate(doc.date),
        },
      });
      docCount++;
    }
  }
  console.log(`Documents: ${docCount} created`);

  // ─── Transactions (Finanzdaten) ────────────────────────────
  const txData = [
    { date: "01.02.2026", description: "Mietzahlungen Februar", type: "EINNAHME" as const, amount: 107500, category: "Miete", propertyIdx: null },
    { date: "05.02.2026", description: "Sanitaer Meier GmbH - Wasserrohrbruch", type: "AUSGABE" as const, amount: 2800, category: "Instandhaltung", propertyIdx: 0 },
    { date: "03.02.2026", description: "Versicherungspraemie Q1", type: "AUSGABE" as const, amount: 4200, category: "Versicherung", propertyIdx: null },
    { date: "01.02.2026", description: "Verwaltungskosten Februar", type: "AUSGABE" as const, amount: 6800, category: "Verwaltung", propertyIdx: null },
    { date: "28.01.2026", description: "Elektro Schulze - Parkplatzbeleuchtung", type: "AUSGABE" as const, amount: 900, category: "Instandhaltung", propertyIdx: 3 },
    { date: "01.01.2026", description: "Mietzahlungen Januar", type: "EINNAHME" as const, amount: 105200, category: "Miete", propertyIdx: null },
    { date: "15.01.2026", description: "Grundsteuer Q1", type: "AUSGABE" as const, amount: 3900, category: "Steuern", propertyIdx: null },
    { date: "10.01.2026", description: "Schluesseldienst Meier", type: "AUSGABE" as const, amount: 180, category: "Instandhaltung", propertyIdx: 1 },
    { date: "01.12.2025", description: "Mietzahlungen Dezember", type: "EINNAHME" as const, amount: 104800, category: "Miete", propertyIdx: null },
    { date: "20.12.2025", description: "Winterdienst Dezember", type: "AUSGABE" as const, amount: 1200, category: "Sonstiges", propertyIdx: null },
  ];

  const transactions = await Promise.all(
    txData.map((tx) =>
      prisma.transaction.create({
        data: {
          date: parseDate(tx.date),
          description: tx.description,
          type: tx.type,
          amount: tx.type === "AUSGABE" ? -tx.amount : tx.amount,
          category: tx.category,
          propertyId: tx.propertyIdx !== null ? properties[tx.propertyIdx].id : null,
          companyId: company.id,
        },
      })
    )
  );
  console.log(`Transactions: ${transactions.length} created`);

  console.log("\nSeed completed successfully!");
  console.log("Login: admin@immoverwalt.de / Admin123!");

  // ─── Bank Accounts ─────────────────────────────────────────
  console.log("Seeding bank accounts...");
  const bank1 = await prisma.bankAccount.create({
    data: {
      companyId: company.id,
      name: "Sparkasse Hausverwaltung",
      iban: "DE89 3704 0044 0532 0130 00",
      bic: "COBADEFFXXX",
      balance: 45230.67,
      status: "connected",
      lastSync: new Date("2026-02-15T23:00:00"),
    },
  });

  const bank2 = await prisma.bankAccount.create({
    data: {
      companyId: company.id,
      name: "Volksbank Mietkonto",
      iban: "DE27 1007 0024 0066 4440 00",
      bic: "DEUTDEDBBER",
      balance: 12890.33,
      status: "connected",
      lastSync: new Date("2026-02-15T22:30:00"),
    },
  });

  // ─── Transactions with Bank Link ───────────────────────────
  console.log("Seeding bank transactions...");
  await prisma.transaction.createMany({
    data: [
      {
        date: new Date("2026-02-15"),
        description: "Miete Wohnung 3A - M. Schmidt",
        amount: 850.00,
        type: "EINNAHME",
        companyId: company.id,
        bankAccountId: bank1.id,
        category: "Miete",
      },
      {
        date: new Date("2026-02-14"),
        description: "Miete Wohnung 1B - K. Müller",
        amount: 720.00,
        type: "EINNAHME",
        companyId: company.id,
        bankAccountId: bank1.id,
        category: "Miete",
      },
      {
        date: new Date("2026-02-14"),
        description: "Handwerker Sanitär - Reparatur EG",
        amount: -345.50,
        type: "AUSGABE",
        companyId: company.id,
        bankAccountId: bank2.id,
        category: "Instandhaltung",
      },
      {
        date: new Date("2026-02-13"),
        description: "Miete Gewerbe 2OG - TechStart GmbH",
        amount: 1450.00,
        type: "EINNAHME",
        companyId: company.id,
        bankAccountId: bank1.id,
        category: "Miete",
      },
      {
        date: new Date("2026-02-13"),
        description: "Versicherung Gebäude Musterstr.",
        amount: -289.00,
        type: "AUSGABE",
        companyId: company.id,
        bankAccountId: bank2.id,
        category: "Versicherung",
      },
      {
        date: new Date("2026-02-12"),
        description: "Nebenkosten-Abrechnung Gas",
        amount: -567.80,
        type: "AUSGABE",
        companyId: company.id,
        bankAccountId: bank2.id,
        category: "Nebenkosten",
      },
    ],
  });

  console.log("Seeding completed.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
