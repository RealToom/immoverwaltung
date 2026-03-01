import { useState, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Users,
  Mail,
  Landmark,
  BarChart3,
  Shield,
  Plus,
  Pencil,
  Trash2,
  Send,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminSmtp,
  useSaveSmtp,
  useTestSmtp,
  type SmtpInput,
} from "@/hooks/api/useAdminSmtp";
import {
  useCustomRoles,
  useCreateCustomRole,
  useUpdateCustomRole,
  useDeleteCustomRole,
  useSetUserCustomRole,
  type CustomRoleWithCount,
} from "@/hooks/api/useCustomRoles";
import { useUsers } from "@/hooks/api/useUsers";
import { PAGE_KEYS } from "@/lib/permissions";
import { useAuth } from "@/contexts/AuthContext";

// ─── Page label mapping ──────────────────────────────────────
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

// ─── SMTP Tab ────────────────────────────────────────────────
function SmtpTab() {
  const { toast } = useToast();
  const { data: smtp, isLoading } = useAdminSmtp();
  const saveSmtp = useSaveSmtp();
  const testSmtp = useTestSmtp();

  const [form, setForm] = useState<SmtpInput>({
    host: "",
    port: 587,
    secure: false,
    user: "",
    password: "",
    fromAddress: "",
    fromName: "",
  });
  const [showPass, setShowPass] = useState(false);

  // Pre-fill form when SMTP data loads
  useEffect(() => {
    if (smtp) {
      setForm({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        user: smtp.user,
        password: "",
        fromAddress: smtp.fromAddress,
        fromName: smtp.fromName,
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
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>SMTP-Konfiguration</CardTitle>
          <CardDescription>
            Konfigurieren Sie den E-Mail-Server für System-E-Mails
            (Passwort-Reset, Mahnungen etc.). Wenn kein SMTP konfiguriert ist,
            wird der Server-Standard verwendet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>SMTP-Host</Label>
              <Input
                placeholder="smtp.example.com"
                value={form.host}
                onChange={(e) =>
                  setForm((f) => ({ ...f, host: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Port</Label>
              <Input
                type="number"
                value={form.port}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    port: parseInt(e.target.value) || 587,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.secure}
              onCheckedChange={(v) => setForm((f) => ({ ...f, secure: v }))}
            />
            <Label>TLS/SSL (Port 465)</Label>
          </div>

          <div className="space-y-1">
            <Label>Benutzername</Label>
            <Input
              value={form.user}
              onChange={(e) =>
                setForm((f) => ({ ...f, user: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <Label>Passwort {smtp && "(leer lassen = unverändert)"}</Label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                placeholder={smtp ? "••••••••" : "Passwort eingeben"}
                value={form.password ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPass ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Absender-Name</Label>
            <Input
              placeholder="Mustermann Hausverwaltung"
              value={form.fromName}
              onChange={(e) =>
                setForm((f) => ({ ...f, fromName: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <Label>Absender-E-Mail</Label>
            <Input
              type="email"
              placeholder="noreply@example.com"
              value={form.fromAddress}
              onChange={(e) =>
                setForm((f) => ({ ...f, fromAddress: e.target.value }))
              }
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saveSmtp.isPending}>
              {saveSmtp.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Speichern
            </Button>
            {smtp && (
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testSmtp.isPending}
              >
                {testSmtp.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Test-Mail senden
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Roles Dialog ────────────────────────────────────────────
function RoleDialog({
  role,
  onClose,
}: {
  role: CustomRoleWithCount | null; // null = new
  onClose: () => void;
}) {
  const { toast } = useToast();
  const createRole = useCreateCustomRole();
  const updateRole = useUpdateCustomRole();

  const [name, setName] = useState(role?.name ?? "");
  const [pages, setPages] = useState<string[]>(role?.pages ?? []);

  function togglePage(key: string) {
    setPages((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
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
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Rollenname</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Hausmeister"
            />
          </div>
          <div className="space-y-2">
            <Label>Zugriff auf folgende Seiten</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
              {PAGE_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`page-${key}`}
                    checked={pages.includes(key)}
                    onCheckedChange={() => togglePage(key)}
                  />
                  <label
                    htmlFor={`page-${key}`}
                    className="text-sm cursor-pointer"
                  >
                    {PAGE_LABELS[key] ?? key}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mitarbeiter Tab ─────────────────────────────────────────
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
      toast({
        title: "Rolle hat zugewiesene Benutzer",
        variant: "destructive",
      });
      return;
    }
    try {
      await deleteRole.mutateAsync(role.id);
      toast({ title: "Rolle gelöscht" });
    } catch {
      toast({ title: "Fehler beim Löschen", variant: "destructive" });
    }
  }

  function openNewRoleDialog() {
    setEditRole(null);
    setShowRoleDialog(true);
  }

  function openEditRoleDialog(role: CustomRoleWithCount) {
    setEditRole(role);
    setShowRoleDialog(true);
  }

  function closeRoleDialog() {
    setShowRoleDialog(false);
    setEditRole(null);
  }

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
          <p className="text-sm text-muted-foreground">
            Noch keine benutzerdefinierten Rollen angelegt.
          </p>
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
                      {role.pages.length === 0
                        ? "Kein Zugriff"
                        : `${role.pages.length} von ${PAGE_KEYS.length} Seiten`}
                    </TableCell>
                    <TableCell>{role._count.users}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditRoleDialog(role)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRole(role)}
                          disabled={role._count.users > 0}
                        >
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
                  <TableCell className="text-muted-foreground text-sm">
                    {u.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={
                        u.customRoleId ? String(u.customRoleId) : "none"
                      }
                      onValueChange={(val) =>
                        setUserCustomRole.mutate({
                          userId: u.id,
                          customRoleId:
                            val === "none" ? null : parseInt(val),
                        })
                      }
                    >
                      <SelectTrigger className="w-44 h-8">
                        <SelectValue placeholder="Keine" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Keine</SelectItem>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            {r.name}
                          </SelectItem>
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

      {showRoleDialog && (
        <RoleDialog role={editRole} onClose={closeRoleDialog} />
      )}
    </div>
  );
}

// ─── Firma Tab ───────────────────────────────────────────────
function FirmaTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Firmendaten</CardTitle>
        <CardDescription>
          Name, Adresse, Steuernummer, Website, Währung, Sprache und
          Datumsformat können unter{" "}
          <strong>Einstellungen → Allgemein</strong> bearbeitet werden.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

// ─── Bank Tab ────────────────────────────────────────────────
function BankTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bankanbindung</CardTitle>
        <CardDescription>
          Die Bankanbindung ist unter <strong>Bankanbindung</strong> in der
          Sidebar erreichbar.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

// ─── DATEV Tab ───────────────────────────────────────────────
function DatevTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>DATEV-Einstellungen</CardTitle>
        <CardDescription>
          DATEV-Einstellungen (Beraternummer, Mandantennummer,
          Konten-Mapping) sind unter{" "}
          <strong>Finanzen → DATEV</strong> erreichbar.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function Administration() {
  const { user } = useAuth();
  const [tab, setTab] = useState("mitarbeiter");

  if (user?.role !== "ADMIN") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">
          Kein Zugriff. Dieser Bereich ist Administratoren vorbehalten.
        </p>
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

      <main className="flex-1 p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="mitarbeiter">
              <Users className="mr-2 h-4 w-4" /> Mitarbeiter
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="mr-2 h-4 w-4" /> E-Mail
            </TabsTrigger>
            <TabsTrigger value="firma">
              <Building2 className="mr-2 h-4 w-4" /> Firma
            </TabsTrigger>
            <TabsTrigger value="bank">
              <Landmark className="mr-2 h-4 w-4" /> Bankanbindung
            </TabsTrigger>
            <TabsTrigger value="datev">
              <BarChart3 className="mr-2 h-4 w-4" /> DATEV
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mitarbeiter">
            <MitarbeiterTab />
          </TabsContent>
          <TabsContent value="email">
            <SmtpTab />
          </TabsContent>
          <TabsContent value="firma">
            <FirmaTab />
          </TabsContent>
          <TabsContent value="bank">
            <BankTab />
          </TabsContent>
          <TabsContent value="datev">
            <DatevTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
