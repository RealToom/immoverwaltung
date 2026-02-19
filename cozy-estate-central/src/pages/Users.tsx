import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users, Plus, MoreHorizontal, Pencil, Trash2, KeyRound, LockOpen, Loader2, ShieldCheck, Copy,
} from "lucide-react";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useResetUserPassword, useUnlockUser, type UserItem } from "@/hooks/api/useUsers";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/mappings";

const ROLES = ["ADMIN", "VERWALTER", "BUCHHALTER", "READONLY"] as const;

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  VERWALTER: "Verwalter",
  BUCHHALTER: "Buchhalter",
  READONLY: "Nur-Lesen",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-destructive/10 text-destructive border-0",
  VERWALTER: "bg-primary/10 text-primary border-0",
  BUCHHALTER: "bg-warning/15 text-warning border-0",
  READONLY: "bg-muted text-muted-foreground border-0",
};

const EMPTY_FORM = { name: "", email: "", password: "", role: "VERWALTER", phone: "" };

const UsersPage = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "ADMIN";

  const { data: usersRes, isLoading } = useUsers();
  const users = usersRes?.data ?? [];

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const resetPassword = useResetUserPassword();
  const unlockUser = useUnlockUser();

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "", phone: "" });

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Temp password dialog
  const [tempPasswordOpen, setTempPasswordOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [tempPasswordUser, setTempPasswordUser] = useState("");

  const openEdit = (u: UserItem) => {
    setEditUser(u);
    setEditForm({ name: u.name, role: u.role, phone: u.phone });
    setEditOpen(true);
  };

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
      toast({ title: "Pflichtfelder fehlen", description: "Name, E-Mail und Passwort sind erforderlich.", variant: "destructive" });
      return;
    }
    try {
      await createUser.mutateAsync({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
        phone: createForm.phone.trim() || undefined,
      });
      toast({ title: "Benutzer erstellt", description: `${createForm.name} wurde angelegt.` });
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    try {
      await updateUser.mutateAsync({
        id: editUser.id,
        data: {
          name: editForm.name.trim(),
          role: editForm.role,
          phone: editForm.phone.trim(),
        },
      });
      toast({ title: "Gespeichert", description: "Benutzer wurde aktualisiert." });
      setEditOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteUser.mutateAsync(deleteId);
      toast({ title: "Gelöscht", description: "Benutzer wurde entfernt." });
      setDeleteId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast({ title: "Fehler", description: msg, variant: "destructive" });
      setDeleteId(null);
    }
  };

  const handleResetPassword = async (u: UserItem) => {
    try {
      const res = await resetPassword.mutateAsync(u.id);
      setTempPassword(res.data.temporaryPassword);
      setTempPasswordUser(u.name);
      setTempPasswordOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    }
  };

  const handleUnlock = async (u: UserItem) => {
    try {
      await unlockUser.mutateAsync(u.id);
      toast({ title: "Entsperrt", description: `${u.name} wurde entsperrt.` });
    } catch {
      toast({ title: "Fehler", description: "Entsperren fehlgeschlagen.", variant: "destructive" });
    }
  };

  const copyTempPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    toast({ title: "Kopiert", description: "Temporäres Passwort in Zwischenablage." });
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">Benutzerverwaltung</h1>
          <p className="text-xs text-muted-foreground">Benutzer und Rollen verwalten</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Neuer Benutzer
          </Button>
        )}
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {ROLES.map((role) => {
            const count = users.filter((u) => u.role === role).length;
            return (
              <Card key={role} className="border border-border/60 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
                  <p className="text-2xl font-heading font-bold mt-1">{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* User Table */}
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <h3 className="text-sm font-semibold text-foreground">
                Alle Benutzer ({users.length})
              </h3>
              {users.filter((u) => u.isLocked).length > 0 && (
                <Badge className="bg-destructive/10 text-destructive border-0 text-xs">
                  {users.filter((u) => u.isLocked).length} gesperrt
                </Badge>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">Keine Benutzer gefunden.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/60">
                    <TableHead className="pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">E-Mail</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rolle</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Erstellt</TableHead>
                    {isAdmin && (
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">Aktionen</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className="hover:bg-muted/50 border-border/40">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{u.name}</p>
                            {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge className={ROLE_COLORS[u.role] ?? "bg-muted border-0"}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.id === currentUser?.id ? (
                          <Badge className="bg-primary/10 text-primary border-0 text-xs">Ich</Badge>
                        ) : u.isLocked ? (
                          <Badge className="bg-destructive/10 text-destructive border-0 text-xs">Gesperrt</Badge>
                        ) : (
                          <Badge className="bg-success/15 text-success border-0 text-xs">Aktiv</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(u.createdAt)}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right pr-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(u)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResetPassword(u)}>
                                <KeyRound className="h-4 w-4 mr-2" />
                                Passwort zurücksetzen
                              </DropdownMenuItem>
                              {u.isLocked && (
                                <DropdownMenuItem onClick={() => handleUnlock(u)}>
                                  <LockOpen className="h-4 w-4 mr-2" />
                                  Entsperren
                                </DropdownMenuItem>
                              )}
                              {u.id !== currentUser?.id && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeleteId(u.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Löschen
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Roles Legend */}
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Rollenübersicht</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-destructive" />
                  <p className="text-sm font-medium">Administrator</p>
                </div>
                <p className="text-xs text-muted-foreground">Vollzugriff inkl. Benutzerverwaltung</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Verwalter</p>
                </div>
                <p className="text-xs text-muted-foreground">Alle Objekte, Mieter und Verträge</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-warning" />
                  <p className="text-sm font-medium">Buchhalter</p>
                </div>
                <p className="text-xs text-muted-foreground">Finanzen und Verträge schreiben</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Nur-Lesen</p>
                </div>
                <p className="text-xs text-muted-foreground">Nur lesender Zugriff</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Benutzer anlegen</DialogTitle>
            <DialogDescription>
              Der Benutzer kann sich sofort mit den angegebenen Daten einloggen.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                placeholder="Max Mustermann"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-email">E-Mail *</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="max@firma.de"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-password">Passwort *</Label>
              <Input
                id="create-password"
                type="password"
                placeholder="Min. 8 Zeichen, Groß-/Kleinbuchstaben + Zahl"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="create-role">Rolle</Label>
                <Select value={createForm.role} onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger id="create-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-phone">Telefon</Label>
                <Input
                  id="create-phone"
                  placeholder="+49 ..."
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={createUser.isPending} className="gap-1.5">
              {createUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Benutzer anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>E-Mail</Label>
              <Input value={editUser?.email ?? ""} disabled className="opacity-60" />
              <p className="text-xs text-muted-foreground">E-Mail kann nicht geändert werden.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-role">Rolle</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Telefon</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Abbrechen</Button>
            <Button onClick={handleUpdate} disabled={updateUser.isPending} className="gap-1.5">
              {updateUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Dieser Benutzer wird unwiderruflich gelöscht und verliert den Zugang zum System.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Abbrechen</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteUser.isPending}
              className="gap-1.5"
            >
              {deleteUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp Password Dialog */}
      <Dialog open={tempPasswordOpen} onOpenChange={setTempPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporäres Passwort</DialogTitle>
            <DialogDescription>
              Das Passwort für <strong>{tempPasswordUser}</strong> wurde zurückgesetzt.
              Teilen Sie dieses Passwort sicher mit dem Benutzer — es wird nur einmalig angezeigt.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <code className="flex-1 text-lg font-mono font-bold tracking-widest">{tempPassword}</code>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={copyTempPassword}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Der Benutzer sollte das Passwort nach dem ersten Login ändern.
          </p>
          <DialogFooter>
            <Button onClick={() => setTempPasswordOpen(false)}>Verstanden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
