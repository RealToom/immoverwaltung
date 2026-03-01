import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Users,
  Home,
  FileText,
  LogOut,
  Plus,
  KeyRound,
  Trash2,
  Loader2,
  HardDrive,
  MemoryStick,
  Clock,
  DatabaseBackup,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSuperAdminAuth } from "@/contexts/SuperAdminContext";
import {
  useSuperAdminStats,
  useSuperAdminCompanies,
  useCreateCompany,
  useResetCompanyPassword,
  useDeleteCompany,
  type SuperAdminCompany,
} from "@/hooks/api/useSuperAdmin";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatLastBackup(iso: string | null | undefined): string {
  if (!iso) return "Kein Backup";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const color = pct > 85 ? "bg-destructive" : pct > 65 ? "bg-yellow-500" : "bg-primary";
  return (
    <div className="mt-1 space-y-0.5">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {formatBytes(used)} / {formatBytes(total)} ({pct}%)
      </p>
    </div>
  );
}

export default function SuperAdmin() {
  const { token, logout } = useSuperAdminAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const statsQuery = useSuperAdminStats(token);
  const companiesQuery = useSuperAdminCompanies(token);
  const createCompany = useCreateCompany(token);
  const resetPassword = useResetCompanyPassword(token);
  const deleteCompany = useDeleteCompany(token);

  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState<SuperAdminCompany | null>(null);
  const [showDelete, setShowDelete] = useState<SuperAdminCompany | null>(null);

  const [createForm, setCreateForm] = useState({
    companyName: "",
    adminEmail: "",
    adminPassword: "",
    adminName: "",
  });
  const [resetForm, setResetForm] = useState({ email: "", newPassword: "" });

  const handleLogout = () => {
    logout();
    navigate("/superadmin/login");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCompany.mutateAsync(createForm);
      toast({ title: "Firma angelegt", description: `${createForm.companyName} wurde erstellt.` });
      setShowCreate(false);
      setCreateForm({ companyName: "", adminEmail: "", adminPassword: "", adminName: "" });
    } catch (err) {
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReset) return;
    try {
      await resetPassword.mutateAsync({ companyId: showReset.id, ...resetForm });
      toast({ title: "Passwort zurückgesetzt" });
      setShowReset(null);
      setResetForm({ email: "", newPassword: "" });
    } catch (err) {
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!showDelete) return;
    try {
      await deleteCompany.mutateAsync(showDelete.id);
      toast({ title: "Firma gelöscht", description: `${showDelete.name} wurde entfernt.` });
      setShowDelete(null);
    } catch (err) {
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  };

  const db = statsQuery.data?.data?.db;
  const server = statsQuery.data?.data?.server;
  const companies = (companiesQuery.data?.data ?? []) as SuperAdminCompany[];

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="bg-card border-b border-border/60 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Superadmin</h1>
          <p className="text-xs text-muted-foreground">Kundenverwaltung</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
          <LogOut className="h-4 w-4" /> Abmelden
        </Button>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* DB Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Firmen", value: db?.companies, icon: Building2 },
            { label: "Benutzer", value: db?.users, icon: Users },
            { label: "Immobilien", value: db?.properties, icon: Home },
            { label: "Mieter", value: db?.tenants, icon: Users },
            { label: "Verträge", value: db?.contracts, icon: FileText },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="border border-border/60">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-2xl font-semibold">{value ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Server Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MemoryStick className="h-4 w-4 text-muted-foreground" /> RAM
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {server ? (
                <UsageBar used={server.memory.used} total={server.memory.total} />
              ) : (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" /> Festplatte
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {server ? (
                <UsageBar used={server.disk.used} total={server.disk.total} />
              ) : (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DatabaseBackup className="h-4 w-4 text-muted-foreground" /> Letztes Backup
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm font-semibold">
                {server ? formatLastBackup(server.lastBackup) : "—"}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" /> Uptime
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm font-semibold">
                {server ? formatUptime(server.uptime) : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Companies Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold">Alle Firmen</h2>
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Neue Firma
            </Button>
          </div>
          <div className="rounded-md border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Firmenname</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Immobilien</TableHead>
                  <TableHead>Mieter</TableHead>
                  <TableHead>Verträge</TableHead>
                  <TableHead>Angelegt</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companiesQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )}
                {!companiesQuery.isLoading && companies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Keine Firmen vorhanden
                    </TableCell>
                  </TableRow>
                )}
                {companies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-muted-foreground text-xs">{c.id}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c._count.users}</TableCell>
                    <TableCell>{c._count.properties}</TableCell>
                    <TableCell>{c._count.tenants}</TableCell>
                    <TableCell>{c._count.contracts}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString("de-DE")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Passwort zurücksetzen"
                          onClick={() => {
                            setShowReset(c);
                            setResetForm({ email: "", newPassword: "" });
                          }}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Firma löschen"
                          onClick={() => setShowDelete(c)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>

      {/* Create Company Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Firma anlegen</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <Label>Firmenname</Label>
              <Input
                value={createForm.companyName}
                onChange={(e) => setCreateForm((f) => ({ ...f, companyName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Admin-E-Mail</Label>
              <Input
                type="email"
                value={createForm.adminEmail}
                onChange={(e) => setCreateForm((f) => ({ ...f, adminEmail: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Admin-Passwort</Label>
              <Input
                value={createForm.adminPassword}
                onChange={(e) => setCreateForm((f) => ({ ...f, adminPassword: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Admin-Name (optional)</Label>
              <Input
                value={createForm.adminName}
                onChange={(e) => setCreateForm((f) => ({ ...f, adminName: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={createCompany.isPending}>
                {createCompany.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Anlegen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!showReset} onOpenChange={() => setShowReset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passwort zurücksetzen — {showReset?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReset} className="space-y-3">
            <div className="space-y-1">
              <Label>User-E-Mail</Label>
              <Input
                type="email"
                value={resetForm.email}
                onChange={(e) => setResetForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Neues Passwort</Label>
              <Input
                value={resetForm.newPassword}
                onChange={(e) => setResetForm((f) => ({ ...f, newPassword: e.target.value }))}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowReset(null)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={resetPassword.isPending}>
                {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Zurücksetzen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Firma löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{showDelete?.name}</strong> und alle zugehörigen Daten werden
            unwiderruflich gelöscht.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteCompany.isPending}>
              {deleteCompany.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
