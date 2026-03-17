import { useState } from "react";
import { ClipboardList, Loader2, RotateCcw } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuditLogs, type AuditLogFilters } from "@/hooks/api/useAuditLogs";

const KNOWN_ACTIONS = [
  "DOCUMENT_UPLOAD",
  "DOCUMENT_DOWNLOAD",
  "DOCUMENT_PREVIEW",
  "DOCUMENT_DELETE",
  "PASSWORD_CHANGE",
];

const EMPTY_FILTERS: AuditLogFilters = { page: 1, limit: 50 };

export default function AuditLog() {
  const [filters, setFilters] = useState<AuditLogFilters>(EMPTY_FILTERS);
  const { data, isLoading } = useAuditLogs(filters);

  const logs = data?.data ?? [];
  const meta = data?.meta;

  const setPage = (page: number) => setFilters((f) => ({ ...f, page }));

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  };

  const formatDetails = (details: Record<string, unknown>) => {
    const str = JSON.stringify(details);
    return str.length > 80 ? str.slice(0, 77) + "…" : str;
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">Audit-Log</h1>
          <p className="text-xs text-muted-foreground">Sicherheitsrelevante Aktionen der letzten 90 Tage</p>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-4 overflow-auto">
        {/* Filter-Bar */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="grid gap-1.5">
            <Label className="text-xs">Aktion</Label>
            <Select
              value={filters.action ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, page: 1, action: v === "all" ? undefined : v }))
              }
            >
              <SelectTrigger className="w-48"><SelectValue placeholder="Alle Aktionen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Aktionen</SelectItem>
                {KNOWN_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Von</Label>
            <Input
              type="date"
              className="w-36"
              value={filters.from ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, page: 1, from: e.target.value || undefined }))}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Bis</Label>
            <Input
              type="date"
              className="w-36"
              value={filters.to ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, page: 1, to: e.target.value || undefined }))}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Zurücksetzen
          </Button>
        </div>

        {/* Tabelle */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              {meta ? `${meta.total} Einträge` : "Einträge"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zeitpunkt</TableHead>
                    <TableHead>Aktion</TableHead>
                    <TableHead>Benutzer-ID</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Keine Einträge gefunden.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.userId ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">
                          {log.ip ?? "—"}
                        </TableCell>
                        <TableCell
                          className="text-xs text-muted-foreground font-mono max-w-xs truncate"
                          title={JSON.stringify(log.details)}
                        >
                          {formatDetails(log.details)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Seite {meta.page} von {meta.totalPages}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => setPage(meta.page - 1)}
              >
                Zurück
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage(meta.page + 1)}
              >
                Weiter
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
