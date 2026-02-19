import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MapPin, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProperties } from "@/hooks/api/useProperties";
import { mapPropertyStatus, formatCurrency } from "@/lib/mappings";

export function PropertyTable() {
  const navigate = useNavigate();
  const { data: response, isLoading } = useProperties();
  const properties = response?.data ?? [];

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-lg font-semibold">
            Immobilien-Übersicht
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {properties.length} Objekte
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/60">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Objekt</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Einheiten</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Belegung</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mieteinnahmen</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => {
                const status = mapPropertyStatus(property.status);
                const occupancyRate = property.totalUnits > 0
                  ? Math.round((property.occupiedUnits / property.totalUnits) * 100)
                  : 0;
                return (
                  <TableRow
                    key={property.id}
                    className="cursor-pointer hover:bg-muted/50 border-border/40"
                    onClick={() => navigate(`/properties/${property.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{property.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{property.address}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground font-medium">{property.totalUnits}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-success transition-all"
                            style={{ width: `${occupancyRate}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {occupancyRate}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{formatCurrency(property.monthlyRevenue)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={status === "aktiv" ? "default" : "secondary"}
                        className={
                          status === "aktiv"
                            ? "bg-success/15 text-success border-0 hover:bg-success/20"
                            : "bg-warning/15 text-warning border-0 hover:bg-warning/20"
                        }
                      >
                        {status === "aktiv" ? "Aktiv" : "Wartung"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
