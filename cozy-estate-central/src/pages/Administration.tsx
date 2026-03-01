import { useState, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Users, Mail, Landmark, BarChart3, Shield, Plus, Pencil, Trash2,
  Send, Eye, EyeOff, Loader2, Save, Globe, RefreshCcw, Upload, Link2,
  CheckCircle2, AlertCircle, CreditCard, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminSmtp, useSaveSmtp, useTestSmtp, type SmtpInput,
} from "@/hooks/api/useAdminSmtp";
import {
  useCustomRoles, useCreateCustomRole, useUpdateCustomRole, useDeleteCustomRole,
  useSetUserCustomRole, type CustomRoleWithCount,
} from "@/hooks/api/useCustomRoles";
import { useUsers } from "@/hooks/api/useUsers";
import { PAGE_KEYS } from "@/lib/permissions";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCompanySettings, useUpdateCompanySettings,
} from "@/hooks/api/useSettings";
import {
  useBankAccounts, useCreateBankAccount, useSyncBankAccount, useImportTransactions,
  type CsvTransaction,
} from "@/hooks/api/useBankAccounts";
import {
  useEmailAccounts, useCreateEmailAccount, useDeleteEmailAccount, useSyncEmailAccount,
} from "@/hooks/api/useEmailAccounts";
import { useDatevSettings, useUpdateDatevSettings } from "@/hooks/api/useDatevSettings";
import { formatDate } from "@/lib/mappings";

// ─── Constants ───────────────────────────────────────────────
const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  properties: "Immobilien",
  tenants: "Mieter",
  contracts: "Verträge",
  finances: "Finanzen",
  maintenance: "Wartung",
  calendar: "Kalender",
  postfach: "Postfach",
  anfragen: "Anfragen",
  vorlagen: "Vorlagen",
  berichte: "Berichte",
  notifications: "Benachrichtigungen",
  import: "Datenimport",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  VERWALTER: "Verwalter",
  BUCHHALTER: "Buchhalter",
  READONLY: "Nur Lesen",
};

const ALL_ROLES = ["ADMIN", "VERWALTER", "BUCHHALTER", "READONLY"] as const;

// ─── SMTP Section ─────────────────────────────────────────────
function SmtpSection() {
  const { toast } = useToast();
  const { data: smtp, isLoading } = useAdminSmtp();
  const saveSmtp = useSaveSmtp();
  const testSmtp = useTestSmtp();

  const [form, setForm] = useState<SmtpInput>({
    host: "", port: 587, secure: false, user: "", password: "", fromAddress: "", fromName: "",
  });
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (smtp) {
      setForm({
        host: smtp.host, port: smtp.port, secure: smtp.secure,
        user: smtp.user, password: "", fromAddress: smtp.fromAddress, fromName: smtp.fromName,
      });
    }
  }, [smtp]);

  async function handleSave() {
    try {
      await saveSmtp.mutateAsync(form);
      toast({ title: "SMTP gespeichert" });
    } catch {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  }

  async function handleTest() {
    try {
      const res = await testSmtp.mutateAsync();
      toast({ title: res.data.message });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler";
      toast({ title: `Test fehlgeschlagen: ${msg}`, variant: "destructive" });
    }
  }

  if (isLoading)
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>SMTP-Konfiguration</CardTitle>
        <CardDescription>
          Konfigurieren Sie den E-Mail-Server für System-E-Mails (Passwort-Reset, Mahnungen etc.).
          Wenn kein SMTP konfiguriert ist, wird der Server-Standard verwendet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>SMTP-Host</Label>
            <Input placeholder="smtp.example.com" value={form.host}
              onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Port</Label>
            <Input type="number" value={form.port}
              onChange={(e) => setForm((f) => ({ ...f, port: parseInt(e.target.value) || 587 }))} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.secure} onCheckedChange={(v) => setForm((f) => ({ ...f, secure: v }))} />
          <Label>TLS/SSL (Port 465)</Label>
        </div>
        <div className="space-y-1">
          <Label>Benutzername</Label>
          <Input value={form.user} onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>Passwort {smtp && "(leer lassen = unverändert)"}</Label>
          <div className="relative">
            <Input type={showPass ? "text" : "password"}
              placeholder={smtp ? "••••••••" : "Passwort eingeben"}
              value={form.password ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="pr-10" />
            <button type="button" onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Absender-Name</Label>
          <Input placeholder="Mustermann Hausverwaltung" value={form.fromName}
            onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>Absender-E-Mail</Label>
          <Input type="email" placeholder="noreply@example.com" value={form.fromAddress}
            onChange={(e) => setForm((f) => ({ ...f, fromAddress: e.target.value }))} />
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saveSmtp.isPending}>
            {saveSmtp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
          {smtp && (
            <Button variant="outline" onClick={handleTest} disabled={testSmtp.isPending}>
              {testSmtp.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Test-Mail senden
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Email Tab ────────────────────────────────────────────────
function EmailTab() {
  const { toast } = useToast();
  const { data: emailAccounts } = useEmailAccounts();
  const createEmailAccount = useCreateEmailAccount();
  const deleteEmailAccount = useDeleteEmailAccount();
  const syncEmailAccount = useSyncEmailAccount();

  const [mailForm, setMailForm] = useState({
    label: "", email: "", imapHost: "", imapPort: 993, imapTls: true,
    imapUser: "", password: "", smtpHost: "", smtpPort: 587, smtpTls: true,
    skipConnectionTest: false,
    allowedRoles: ["ADMIN", "VERWALTER", "BUCHHALTER", "READONLY"] as string[],
  });

  const handleConnectMailbox = async () => {
    try {
      await createEmailAccount.mutateAsync({ ...mailForm });
      const msg = mailForm.skipConnectionTest
        ? `${mailForm.email} wurde gespeichert (ohne Verbindungstest).`
        : `${mailForm.email} wurde erfolgreich verbunden.`;
      toast({ title: "Postfach gespeichert", description: msg });
      setMailForm({
        label: "", email: "", imapHost: "", imapPort: 993, imapTls: true,
        imapUser: "", password: "", smtpHost: "", smtpPort: 587, smtpTls: true,
        skipConnectionTest: false, allowedRoles: ["ADMIN", "VERWALTER", "BUCHHALTER", "READONLY"],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verbindung fehlgeschlagen";
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-10">
      {/* System SMTP */}
      <div>
        <h3 className="text-base font-semibold mb-4">System-E-Mail (SMTP)</h3>
        <SmtpSection />
      </div>

      {/* IMAP Postfächer */}
      <div>
        <h3 className="text-base font-semibold mb-4">Postfächer (IMAP/SMTP)</h3>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">Verbundene Postfächer</CardTitle>
            <CardDescription>IMAP/SMTP-Konten für den integrierten Posteingang</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailAccounts?.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">Noch keine Postfächer verbunden.</p>
            )}
            {emailAccounts?.data?.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium">{acc.label}</p>
                  <p className="text-sm text-muted-foreground">{acc.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Letzter Sync: {acc.lastSync ? formatDate(acc.lastSync) : "Noch nie"}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(acc.allowedRoles ?? []).map((r) => (
                      <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {ROLE_LABELS[r] ?? r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" title="Jetzt synchronisieren"
                    onClick={() => syncEmailAccount.mutate(acc.id)}
                    disabled={syncEmailAccount.isPending}>
                    <RefreshCw className={`h-4 w-4 ${syncEmailAccount.isPending ? "animate-spin" : ""}`} />
                  </Button>
                  <Button size="sm" variant="destructive"
                    onClick={() => deleteEmailAccount.mutate(acc.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Separator />
            <p className="font-medium text-sm">Postfach verbinden</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bezeichnung</Label>
                <Input placeholder="z.B. Büro-Postfach" value={mailForm.label}
                  onChange={(e) => setMailForm((f) => ({ ...f, label: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>E-Mail-Adresse</Label>
                <Input type="email" placeholder="mail@beispiel.de" value={mailForm.email}
                  onChange={(e) => setMailForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>IMAP-Server</Label>
                <Input placeholder="imap.beispiel.de" value={mailForm.imapHost}
                  onChange={(e) => setMailForm((f) => ({ ...f, imapHost: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>IMAP-Port</Label>
                <Input type="number" value={mailForm.imapPort}
                  onChange={(e) => setMailForm((f) => ({ ...f, imapPort: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>IMAP-Benutzername</Label>
                <Input placeholder="Benutzername / E-Mail" value={mailForm.imapUser}
                  onChange={(e) => setMailForm((f) => ({ ...f, imapUser: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Passwort</Label>
                <Input type="password" placeholder="App-Passwort" value={mailForm.password}
                  onChange={(e) => setMailForm((f) => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>SMTP-Server</Label>
                <Input placeholder="smtp.beispiel.de" value={mailForm.smtpHost}
                  onChange={(e) => setMailForm((f) => ({ ...f, smtpHost: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>SMTP-Port</Label>
                <Input type="number" value={mailForm.smtpPort}
                  onChange={(e) => setMailForm((f) => ({ ...f, smtpPort: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={mailForm.imapTls}
                  onCheckedChange={(v) => setMailForm((f) => ({ ...f, imapTls: v }))} />
                <Label>IMAP SSL/TLS</Label>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={mailForm.smtpTls}
                  onCheckedChange={(v) => setMailForm((f) => ({ ...f, smtpTls: v }))} />
                <Label>SMTP SSL/TLS</Label>
              </div>
              <div className="flex items-center gap-2 pt-2 col-span-2">
                <Switch checked={mailForm.skipConnectionTest}
                  onCheckedChange={(v) => setMailForm((f) => ({ ...f, skipConnectionTest: v }))} />
                <div>
                  <Label>Verbindungstest überspringen</Label>
                  <p className="text-xs text-muted-foreground">Postfach ohne IMAP-Test speichern (z.B. bei lokalem Test-Setup)</p>
                </div>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Zugriff für Rollen</Label>
                <div className="flex flex-wrap gap-3">
                  {ALL_ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox"
                        checked={mailForm.allowedRoles.includes(role)}
                        onChange={(e) => setMailForm((f) => ({
                          ...f,
                          allowedRoles: e.target.checked
                            ? [...f.allowedRoles, role]
                            : f.allowedRoles.filter((r) => r !== role),
                        }))}
                        className="rounded" />
                      {ROLE_LABELS[role]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleConnectMailbox} disabled={
                createEmailAccount.isPending || !mailForm.label || !mailForm.email ||
                !mailForm.imapHost || !mailForm.imapUser || !mailForm.password || !mailForm.smtpHost
              }>
                {createEmailAccount.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  : <Mail className="h-4 w-4 mr-1" />}
                {mailForm.skipConnectionTest ? "Speichern (ohne Test)" : "Verbinden & Testen"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Roles Dialog ─────────────────────────────────────────────
function RoleDialog({ role, onClose }: { role: CustomRoleWithCount | null; onClose: () => void }) {
  const { toast } = useToast();
  const createRole = useCreateCustomRole();
  const updateRole = useUpdateCustomRole();

  const [name, setName] = useState(role?.name ?? "");
  const [pages, setPages] = useState<string[]>(role?.pages ?? []);

  function togglePage(key: string) {
    setPages((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast({ title: "Name ist erforderlich", variant: "destructive" });
      return;
    }
    try {
      if (role) {
        await updateRole.mutateAsync({ id: role.id, name, pages });
      } else {
        await createRole.mutateAsync({ name, pages });
      }
      toast({ title: role ? "Rolle aktualisiert" : "Rolle erstellt" });
      onClose();
    } catch {
      toast({ title: "Fehler", variant: "destructive" });
    }
  }

  const isPending = createRole.isPending || updateRole.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{role ? "Rolle bearbeiten" : "Neue Rolle"}</DialogTitle>
          <DialogDescription className="sr-only">
            Rollenname und Seitenzugriff konfigurieren
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Rollenname</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Hausmeister" />
          </div>
          <div className="space-y-2">
            <Label>Zugriff auf folgende Seiten</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
              {PAGE_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox id={`page-${key}`} checked={pages.includes(key)} onCheckedChange={() => togglePage(key)} />
                  <label htmlFor={`page-${key}`} className="text-sm cursor-pointer">{PAGE_LABELS[key] ?? key}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mitarbeiter Tab ──────────────────────────────────────────
function MitarbeiterTab() {
  const { toast } = useToast();
  const { data: roles = [] } = useCustomRoles();
  const { data: usersData } = useUsers();
  const deleteRole = useDeleteCustomRole();
  const setUserCustomRole = useSetUserCustomRole();

  const [editRole, setEditRole] = useState<CustomRoleWithCount | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);

  const users = usersData?.data ?? [];

  async function handleDeleteRole(role: CustomRoleWithCount) {
    if (role._count.users > 0) {
      toast({ title: "Rolle hat zugewiesene Benutzer", variant: "destructive" });
      return;
    }
    try {
      await deleteRole.mutateAsync(role.id);
      toast({ title: "Rolle gelöscht" });
    } catch {
      toast({ title: "Fehler beim Löschen", variant: "destructive" });
    }
  }

  function openNewRoleDialog() { setEditRole(null); setShowRoleDialog(true); }
  function openEditRoleDialog(role: CustomRoleWithCount) { setEditRole(role); setShowRoleDialog(true); }
  function closeRoleDialog() { setShowRoleDialog(false); setEditRole(null); }

  return (
    <div className="space-y-8">
      {/* Roles section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Benutzerdefinierte Rollen</h3>
          <Button size="sm" onClick={openNewRoleDialog}>
            <Plus className="mr-2 h-4 w-4" /> Neue Rolle
          </Button>
        </div>
        {roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine benutzerdefinierten Rollen angelegt.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Seiten</TableHead>
                  <TableHead>Benutzer</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {role.pages.length === 0 ? "Kein Zugriff" : `${role.pages.length} von ${PAGE_KEYS.length} Seiten`}
                    </TableCell>
                    <TableCell>{role._count.users}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditRoleDialog(role)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRole(role)} disabled={role._count.users > 0}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Users section */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold">Mitarbeiter</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>System-Rolle</TableHead>
                <TableHead>Benutzerdefinierte Rolle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                  <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                  <TableCell>
                    <Select
                      value={u.customRoleId ? String(u.customRoleId) : "none"}
                      onValueChange={(val) =>
                        setUserCustomRole.mutate(
                          { userId: u.id, customRoleId: val === "none" ? null : parseInt(val) },
                          { onError: () => toast({ title: "Rollenzuweisung fehlgeschlagen", variant: "destructive" }) }
                        )
                      }
                    >
                      <SelectTrigger className="w-44 h-8">
                        <SelectValue placeholder="Keine" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Keine</SelectItem>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {showRoleDialog && <RoleDialog role={editRole} onClose={closeRoleDialog} />}
    </div>
  );
}

// ─── Firma Tab ────────────────────────────────────────────────
function FirmaTab() {
  const { toast } = useToast();
  const { data: companyData, isLoading } = useCompanySettings();
  const updateCompany = useUpdateCompanySettings();

  const [companyForm, setCompanyForm] = useState({ name: "", taxNumber: "", address: "", website: "" });
  const [appConfig, setAppConfig] = useState({ currency: "EUR", language: "de", dateFormat: "DD.MM.YYYY", itemsPerPage: 25 });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (companyData?.data && !initialized) {
      setCompanyForm({
        name: companyData.data.name,
        taxNumber: companyData.data.taxNumber,
        address: companyData.data.address,
        website: companyData.data.website,
      });
      setAppConfig({
        currency: companyData.data.currency,
        language: companyData.data.language,
        dateFormat: companyData.data.dateFormat,
        itemsPerPage: companyData.data.itemsPerPage,
      });
      setInitialized(true);
    }
  }, [companyData, initialized]);

  if (isLoading)
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Unternehmensdaten</CardTitle>
          <CardDescription>Firmendaten für Dokumente und Berichte</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Firmenname</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={companyForm.name}
                  onChange={(e) => setCompanyForm((c) => ({ ...c, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Steuernummer</Label>
              <Input value={companyForm.taxNumber}
                onChange={(e) => setCompanyForm((c) => ({ ...c, taxNumber: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input value={companyForm.address}
                onChange={(e) => setCompanyForm((c) => ({ ...c, address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Webseite</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={companyForm.website}
                  onChange={(e) => setCompanyForm((c) => ({ ...c, website: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => updateCompany.mutate(companyForm, {
              onSuccess: () => toast({ title: "Gespeichert", description: "Unternehmensdaten wurden aktualisiert." }),
              onError: () => toast({ title: "Fehler", variant: "destructive" }),
            })} disabled={updateCompany.isPending}>
              {updateCompany.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {" "}Speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anwendungskonfiguration</CardTitle>
          <CardDescription>Währung, Sprache und Datumsformat für die gesamte Firma</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Währung</Label>
              <Select value={appConfig.currency} onValueChange={(v) => setAppConfig((c) => ({ ...c, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">Euro (EUR)</SelectItem>
                  <SelectItem value="CHF">Schweizer Franken (CHF)</SelectItem>
                  <SelectItem value="USD">US-Dollar (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sprache</Label>
              <Select value={appConfig.language} onValueChange={(v) => setAppConfig((c) => ({ ...c, language: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">Englisch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Datumsformat</Label>
              <Select value={appConfig.dateFormat} onValueChange={(v) => setAppConfig((c) => ({ ...c, dateFormat: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD.MM.YYYY">TT.MM.JJJJ</SelectItem>
                  <SelectItem value="YYYY-MM-DD">JJJJ-MM-TT</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/TT/JJJJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Einträge pro Seite</Label>
              <Select value={String(appConfig.itemsPerPage)} onValueChange={(v) => setAppConfig((c) => ({ ...c, itemsPerPage: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => updateCompany.mutate(appConfig, {
              onSuccess: () => toast({ title: "Gespeichert", description: "App-Konfiguration wurde aktualisiert." }),
              onError: () => toast({ title: "Fehler", variant: "destructive" }),
            })} disabled={updateCompany.isPending}>
              {updateCompany.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {" "}Speichern
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Bank Tab ─────────────────────────────────────────────────
function BankTab() {
  const { toast } = useToast();
  const { data: banks = [], isLoading } = useBankAccounts();
  const createBank = useCreateBankAccount();
  const syncBank = useSyncBankAccount();
  const importStats = useImportTransactions();

  const [connectOpen, setConnectOpen] = useState(false);
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);
  const [newBank, setNewBank] = useState({ name: "", iban: "", bic: "" });
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const totalBalance = banks.reduce((s, b) => s + b.balance, 0);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);

  const formatDateTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const handleConnect = () => {
    if (!newBank.name.trim() || !newBank.iban.trim()) {
      toast({ title: "Fehler", description: "Name und IBAN sind Pflichtfelder.", variant: "destructive" });
      return;
    }
    createBank.mutate(newBank, {
      onSuccess: () => {
        setNewBank({ name: "", iban: "", bic: "" });
        setConnectOpen(false);
        toast({ title: "Verbunden", description: "Bankkonto wurde erfolgreich angelegt." });
      },
      onError: () => toast({ title: "Fehler", description: "Bankkonto konnte nicht angelegt werden.", variant: "destructive" }),
    });
  };

  const handleSync = (bankId: number) => {
    syncBank.mutate(bankId, {
      onSuccess: () => toast({ title: "Synchronisiert", description: "Kontodaten wurden aktualisiert." }),
    });
  };

  const handleCsvUpload = () => {
    if (!csvFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const transactions: CsvTransaction[] = [];
      const startIndex = lines[0].toLowerCase().includes("datum") || lines[0].toLowerCase().includes("date") ? 1 : 0;
      for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split(/[;,]/).map((s) => s.trim().replace(/^"|"$/g, ""));
        if (cols.length < 3) continue;
        const dateStr = cols[0];
        let date = new Date(dateStr);
        if (isNaN(date.getTime()) && dateStr.includes(".")) {
          const parts = dateStr.split(".");
          date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
        const description = cols[1];
        const amount = parseFloat(cols[2].replace(",", "."));
        const iban = cols[3] || "";
        if (!isNaN(amount) && !isNaN(date.getTime())) {
          transactions.push({ date: date.toISOString(), description, amount, iban });
        }
      }
      importStats.mutate(transactions, {
        onSuccess: (res) => {
          setCsvUploadOpen(false);
          setCsvFile(null);
          toast({ title: "Importiert", description: `${res.data.imported} Transaktionen erfolgreich importiert.` });
        },
        onError: () => toast({ title: "Fehler", description: "Import fehlgeschlagen.", variant: "destructive" }),
      });
    };
    reader.readAsText(csvFile);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setCsvUploadOpen(true)} className="gap-1.5">
          <Upload className="h-4 w-4" /> CSV Import
        </Button>
        <Button size="sm" onClick={() => setConnectOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Bank verbinden
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Landmark className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Verbundene Konten</p>
              <p className="text-xl font-heading font-bold">{banks.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
              <CreditCard className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gesamtsaldo</p>
              <p className="text-xl font-heading font-bold text-success">{formatCurrency(totalBalance)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
              <Link2 className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-xl font-heading font-bold">
                {banks.length === 0 ? "Keine Konten" : banks.every((b) => b.status === "connected") ? "Alle verbunden" : "Fehler"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bank Accounts */}
      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : banks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Noch keine Bankkonten verbunden. Klicken Sie auf „Bank verbinden", um ein Konto hinzuzufügen.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banks.map((bank) => (
            <Card key={bank.id} className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-heading font-semibold">{bank.name}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">{bank.iban}</p>
                    </div>
                  </div>
                  <Badge className={bank.status === "connected" ? "bg-success/15 text-success border-0" : "bg-destructive/15 text-destructive border-0"}>
                    {bank.status === "connected"
                      ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Verbunden</>
                      : <><AlertCircle className="h-3 w-3 mr-1" /> Fehler</>}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-xs text-muted-foreground">Kontostand</span>
                  <span className="text-lg font-heading font-bold">{formatCurrency(bank.balance)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Letzte Sync: {formatDateTime(bank.lastSync)}</span>
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs"
                    onClick={() => handleSync(bank.id)} disabled={syncBank.isPending}>
                    {syncBank.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                    Sync
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Connect Bank Dialog */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bankverbindung hinzufügen</DialogTitle>
            <DialogDescription>Geben Sie die Kontodaten ein, um ein Bankkonto zu verbinden.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Kontoname *</Label>
              <Input value={newBank.name} onChange={(e) => setNewBank((b) => ({ ...b, name: e.target.value }))} placeholder="z.B. Sparkasse Hausverwaltung" />
            </div>
            <div className="grid gap-2">
              <Label>IBAN *</Label>
              <Input value={newBank.iban} onChange={(e) => setNewBank((b) => ({ ...b, iban: e.target.value }))} placeholder="DE89 3704 0044 ..." />
            </div>
            <div className="grid gap-2">
              <Label>BIC</Label>
              <Input value={newBank.bic} onChange={(e) => setNewBank((b) => ({ ...b, bic: e.target.value }))} placeholder="COBADEFFXXX" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectOpen(false)}>Abbrechen</Button>
            <Button onClick={handleConnect} disabled={createBank.isPending} className="gap-1.5">
              {createBank.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Link2 className="h-4 w-4" /> Verbinden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Upload Dialog */}
      <Dialog open={csvUploadOpen} onOpenChange={setCsvUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaktionen importieren</DialogTitle>
            <DialogDescription>Laden Sie eine CSV-Datei mit Banktransaktionen hoch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>CSV-Datei</Label>
              <Input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
              <p className="text-xs text-muted-foreground">Format: Datum, Beschreibung, Betrag, IBAN</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCsvUploadOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCsvUpload} disabled={!csvFile || importStats.isPending} className="gap-1.5">
              {importStats.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── DATEV Tab ────────────────────────────────────────────────
function DatevTab() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useDatevSettings();
  const updateSettings = useUpdateDatevSettings();

  const [form, setForm] = useState({
    beraternummer: "",
    mandantennummer: "",
    kontenrahmen: "SKR03" as "SKR03" | "SKR04",
    fiscalYearStart: 1,
    defaultBankAccount: "",
    defaultIncomeAccount: "",
    defaultExpenseAccount: "",
  });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      setForm({
        beraternummer: settings.beraternummer ? String(settings.beraternummer) : "",
        mandantennummer: settings.mandantennummer ? String(settings.mandantennummer) : "",
        kontenrahmen: settings.kontenrahmen ?? "SKR03",
        fiscalYearStart: settings.fiscalYearStart ?? 1,
        defaultBankAccount: settings.defaultBankAccount ?? "",
        defaultIncomeAccount: settings.defaultIncomeAccount ?? "",
        defaultExpenseAccount: settings.defaultExpenseAccount ?? "",
      });
      setInitialized(true);
    }
  }, [settings, initialized]);

  async function handleSave() {
    try {
      await updateSettings.mutateAsync({
        beraternummer: form.beraternummer ? parseInt(form.beraternummer) : null,
        mandantennummer: form.mandantennummer ? parseInt(form.mandantennummer) : null,
        kontenrahmen: form.kontenrahmen,
        fiscalYearStart: form.fiscalYearStart,
        ...(form.defaultBankAccount ? { defaultBankAccount: form.defaultBankAccount } : { defaultBankAccount: null }),
        ...(form.defaultIncomeAccount ? { defaultIncomeAccount: form.defaultIncomeAccount } : { defaultIncomeAccount: null }),
        ...(form.defaultExpenseAccount ? { defaultExpenseAccount: form.defaultExpenseAccount } : { defaultExpenseAccount: null }),
      });
      toast({ title: "DATEV-Einstellungen gespeichert" });
    } catch {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  }

  if (isLoading)
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>DATEV-Einstellungen</CardTitle>
          <CardDescription>
            Konfigurieren Sie die DATEV-Verbindung für den Buchungsstapel-Export.
            Beraternummer und Mandantennummer sind für den Export erforderlich.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Beraternummer</Label>
              <Input type="number" placeholder="1001–9999999"
                value={form.beraternummer}
                onChange={(e) => setForm((f) => ({ ...f, beraternummer: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Mandantennummer</Label>
              <Input type="number" placeholder="1–99999"
                value={form.mandantennummer}
                onChange={(e) => setForm((f) => ({ ...f, mandantennummer: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Kontenrahmen</Label>
              <Select value={form.kontenrahmen} onValueChange={(v: "SKR03" | "SKR04") => setForm((f) => ({ ...f, kontenrahmen: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SKR03">SKR03</SelectItem>
                  <SelectItem value="SKR04">SKR04</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Geschäftsjahr beginnt</Label>
              <Select value={String(form.fiscalYearStart)} onValueChange={(v) => setForm((f) => ({ ...f, fiscalYearStart: parseInt(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-1">
            <Label>Standard-Bankkonto (4-stellig)</Label>
            <Input placeholder="z.B. 1200" maxLength={4}
              value={form.defaultBankAccount}
              onChange={(e) => setForm((f) => ({ ...f, defaultBankAccount: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
          </div>
          <div className="space-y-1">
            <Label>Standard-Erlöskonto (4-stellig)</Label>
            <Input placeholder="z.B. 8400" maxLength={4}
              value={form.defaultIncomeAccount}
              onChange={(e) => setForm((f) => ({ ...f, defaultIncomeAccount: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
          </div>
          <div className="space-y-1">
            <Label>Standard-Aufwandskonto (4-stellig)</Label>
            <Input placeholder="z.B. 4900" maxLength={4}
              value={form.defaultExpenseAccount}
              onChange={(e) => setForm((f) => ({ ...f, defaultExpenseAccount: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={updateSettings.isPending}>
              {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function Administration() {
  const { user } = useAuth();
  const [tab, setTab] = useState("mitarbeiter");

  if (user?.role !== "ADMIN") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Kein Zugriff. Dieser Bereich ist Administratoren vorbehalten.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Shield className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Administration</h1>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="mitarbeiter"><Users className="mr-2 h-4 w-4" /> Mitarbeiter</TabsTrigger>
            <TabsTrigger value="email"><Mail className="mr-2 h-4 w-4" /> E-Mail</TabsTrigger>
            <TabsTrigger value="firma"><Building2 className="mr-2 h-4 w-4" /> Firma</TabsTrigger>
            <TabsTrigger value="bank"><Landmark className="mr-2 h-4 w-4" /> Bankanbindung</TabsTrigger>
            <TabsTrigger value="datev"><BarChart3 className="mr-2 h-4 w-4" /> DATEV</TabsTrigger>
          </TabsList>

          <TabsContent value="mitarbeiter"><MitarbeiterTab /></TabsContent>
          <TabsContent value="email"><EmailTab /></TabsContent>
          <TabsContent value="firma"><FirmaTab /></TabsContent>
          <TabsContent value="bank"><BankTab /></TabsContent>
          <TabsContent value="datev"><DatevTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
