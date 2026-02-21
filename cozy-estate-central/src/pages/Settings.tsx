import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Settings,
  User,
  Bell,
  Moon,
  Sun,
  Monitor,
  Building2,
  Globe,
  Save,
  Mail,
  Phone,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Inbox,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  useProfile,
  useUpdateProfile,
  useNotificationPrefs,
  useUpdateNotificationPrefs,
  useCompanySettings,
  useUpdateCompanySettings,
} from "@/hooks/api/useSettings";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useEmailAccounts, useCreateEmailAccount, useDeleteEmailAccount, useSyncEmailAccount } from "@/hooks/api/useEmailAccounts";
import { formatDate } from "@/lib/mappings";

type Theme = "light" | "dark" | "system";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrator",
  VERWALTER: "Verwalter",
  BUCHHALTER: "Buchhalter",
  READONLY: "Nur Lesen",
};

const digestLabels: Record<string, string> = {
  TAEGLICH: "Täglich",
  WOECHENTLICH: "Wöchentlich",
  MONATLICH: "Monatlich",
};

const SettingsPage = () => {
  // ─── Profile ────────────────────────────────────────────
  const { data: profileData, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", bio: "" });
  const [profileInitialized, setProfileInitialized] = useState(false);

  useEffect(() => {
    if (profileData?.data && !profileInitialized) {
      setProfileForm({
        name: profileData.data.name,
        phone: profileData.data.phone,
        bio: profileData.data.bio,
      });
      setProfileInitialized(true);
    }
  }, [profileData, profileInitialized]);

  const handleSaveProfile = () => {
    updateProfile.mutate(profileForm, {
      onSuccess: () => toast({ title: "Gespeichert", description: "Profildaten wurden erfolgreich aktualisiert." }),
      onError: () => toast({ title: "Fehler", description: "Profildaten konnten nicht gespeichert werden.", variant: "destructive" }),
    });
  };

  // ─── Notifications ──────────────────────────────────────
  const { data: notifData, isLoading: notifLoading } = useNotificationPrefs();
  const updateNotifPrefs = useUpdateNotificationPrefs();
  const [notifForm, setNotifForm] = useState({
    emailVertrag: true,
    emailWartung: true,
    emailFinanzen: false,
    pushVertrag: true,
    pushWartung: true,
    pushFinanzen: false,
    reminderDays: 30,
    digestFrequency: "WOECHENTLICH",
  });
  const [notifInitialized, setNotifInitialized] = useState(false);

  useEffect(() => {
    if (notifData?.data && !notifInitialized) {
      setNotifForm(notifData.data);
      setNotifInitialized(true);
    }
  }, [notifData, notifInitialized]);

  const handleSaveNotifications = () => {
    updateNotifPrefs.mutate(notifForm, {
      onSuccess: () => toast({ title: "Gespeichert", description: "Benachrichtigungseinstellungen wurden aktualisiert." }),
      onError: () => toast({ title: "Fehler", description: "Einstellungen konnten nicht gespeichert werden.", variant: "destructive" }),
    });
  };

  // ─── Theme (next-themes) ────────────────────────────────
  const { theme, setTheme } = useTheme();

  // ─── App Config (Company settings) ──────────────────────
  const { data: companyData, isLoading: companyLoading } = useCompanySettings();
  const updateCompany = useUpdateCompanySettings();
  const [appConfig, setAppConfig] = useState({
    currency: "EUR",
    language: "de",
    dateFormat: "DD.MM.YYYY",
    itemsPerPage: 25,
  });
  const [companyForm, setCompanyForm] = useState({
    name: "",
    taxNumber: "",
    address: "",
    website: "",
  });
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem("autoSave") !== "false");
  const [companyInitialized, setCompanyInitialized] = useState(false);

  useEffect(() => {
    if (companyData?.data && !companyInitialized) {
      setAppConfig({
        currency: companyData.data.currency,
        language: companyData.data.language,
        dateFormat: companyData.data.dateFormat,
        itemsPerPage: companyData.data.itemsPerPage,
      });
      setCompanyForm({
        name: companyData.data.name,
        taxNumber: companyData.data.taxNumber,
        address: companyData.data.address,
        website: companyData.data.website,
      });
      setCompanyInitialized(true);
    }
  }, [companyData, companyInitialized]);

  useEffect(() => {
    localStorage.setItem("autoSave", String(autoSave));
  }, [autoSave]);

  const handleSaveAppConfig = () => {
    updateCompany.mutate(appConfig, {
      onSuccess: () => toast({ title: "Gespeichert", description: "App-Konfiguration wurde aktualisiert." }),
      onError: () => toast({ title: "Fehler", description: "Konfiguration konnte nicht gespeichert werden.", variant: "destructive" }),
    });
  };

  const handleSaveCompanyData = () => {
    updateCompany.mutate(companyForm, {
      onSuccess: () => toast({ title: "Gespeichert", description: "Unternehmensdaten wurden aktualisiert." }),
      onError: () => toast({ title: "Fehler", description: "Unternehmensdaten konnten nicht gespeichert werden.", variant: "destructive" }),
    });
  };

  const profile = profileData?.data;

  // ─── Email Accounts ──────────────────────────────────────
  const { data: emailAccounts } = useEmailAccounts();
  const createEmailAccount = useCreateEmailAccount();
  const deleteEmailAccount = useDeleteEmailAccount();
  const syncEmailAccount = useSyncEmailAccount();
  const [mailForm, setMailForm] = useState({
    label: "", email: "", imapHost: "", imapPort: 993, imapTls: true,
    imapUser: "", password: "", smtpHost: "", smtpPort: 587, smtpTls: true,
  });

  const handleConnectMailbox = async () => {
    try {
      await createEmailAccount.mutateAsync({ ...mailForm });
      toast({ title: "Postfach verbunden", description: `${mailForm.email} wurde erfolgreich verbunden.` });
      setMailForm({ label: "", email: "", imapHost: "", imapPort: 993, imapTls: true, imapUser: "", password: "", smtpHost: "", smtpPort: 587, smtpTls: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verbindung fehlgeschlagen";
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    }
  };

  // ─── Password Change ─────────────────────────────────────
  const { logout } = useAuth();
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleChangePassword = async () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast({ title: "Fehler", description: "Die neuen Passwörter stimmen nicht überein.", variant: "destructive" });
      return;
    }
    setPwLoading(true);
    try {
      await api("/api/auth/me/password", {
        method: "PATCH",
        body: { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword },
      });
      toast({ title: "Passwort geändert", description: "Sie werden zur Anmeldung weitergeleitet." });
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => logout(), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Passwort konnte nicht geändert werden.";
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h1 className="font-heading text-lg font-semibold text-foreground">Einstellungen</h1>
          <p className="text-xs text-muted-foreground">Profil, Benachrichtigungen & Konfiguration</p>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        <Tabs defaultValue="profil" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="profil" className="gap-1.5"><User className="h-4 w-4" /> Profil</TabsTrigger>
            <TabsTrigger value="benachrichtigungen" className="gap-1.5"><Bell className="h-4 w-4" /> Benachrichtigungen</TabsTrigger>
            <TabsTrigger value="darstellung" className="gap-1.5"><Moon className="h-4 w-4" /> Darstellung</TabsTrigger>
            <TabsTrigger value="app" className="gap-1.5"><Settings className="h-4 w-4" /> App</TabsTrigger>
            <TabsTrigger value="sicherheit" className="gap-1.5"><Shield className="h-4 w-4" /> Sicherheit</TabsTrigger>
            <TabsTrigger value="postfaecher" className="gap-1.5"><Inbox className="h-4 w-4" /> Postfächer</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profil" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Benutzerprofil</CardTitle>
                <CardDescription>Ihre persönlichen Informationen und Kontaktdaten</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profileLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : profile ? (
                  <>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold font-heading">
                        {profile.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <div className="font-heading font-semibold text-foreground">{profile.name}</div>
                        <div className="text-sm text-muted-foreground">{roleLabels[profile.role] ?? profile.role} · {profile.company.name}</div>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Unternehmen</Label>
                        <Input value={profile.company.name} disabled className="bg-muted/50" />
                      </div>
                      <div className="space-y-2">
                        <Label>E-Mail</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9 bg-muted/50" value={profile.email} disabled />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Telefon</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Rolle</Label>
                        <Input value={roleLabels[profile.role] ?? profile.role} disabled className="bg-muted/50" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Über mich</Label>
                      <Textarea value={profileForm.bio} onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))} rows={3} />
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
                        {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Speichern
                      </Button>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="benachrichtigungen" className="space-y-6">
            {notifLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">E-Mail-Benachrichtigungen</CardTitle>
                    <CardDescription>Wählen Sie, welche E-Mails Sie erhalten möchten</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { key: "emailVertrag" as const, label: "Vertragsfristen & Erinnerungen", desc: "Auslaufende Verträge, Kündigungsfristen, Mietanpassungen" },
                      { key: "emailWartung" as const, label: "Wartung & Tickets", desc: "Neue Tickets, Statusänderungen, fällige Aufgaben" },
                      { key: "emailFinanzen" as const, label: "Finanzberichte", desc: "Monatliche Zusammenfassungen, offene Zahlungen" },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-sm font-medium text-foreground">{item.label}</div>
                          <div className="text-xs text-muted-foreground">{item.desc}</div>
                        </div>
                        <Switch checked={notifForm[item.key]} onCheckedChange={(v) => setNotifForm((n) => ({ ...n, [item.key]: v }))} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Push-Benachrichtigungen</CardTitle>
                    <CardDescription>In-App-Benachrichtigungen in Echtzeit</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { key: "pushVertrag" as const, label: "Vertragsfristen", desc: "Sofortige Benachrichtigung bei kritischen Fristen" },
                      { key: "pushWartung" as const, label: "Dringende Tickets", desc: "Benachrichtigung bei dringenden Wartungsanfragen" },
                      { key: "pushFinanzen" as const, label: "Zahlungseingänge", desc: "Benachrichtigung bei eingehenden Zahlungen" },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-sm font-medium text-foreground">{item.label}</div>
                          <div className="text-xs text-muted-foreground">{item.desc}</div>
                        </div>
                        <Switch checked={notifForm[item.key]} onCheckedChange={(v) => setNotifForm((n) => ({ ...n, [item.key]: v }))} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Erinnerungseinstellungen</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Vorlaufzeit für Erinnerungen</Label>
                        <Select value={String(notifForm.reminderDays)} onValueChange={(v) => setNotifForm((n) => ({ ...n, reminderDays: Number(v) }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 Tage vorher</SelectItem>
                            <SelectItem value="7">7 Tage vorher</SelectItem>
                            <SelectItem value="14">14 Tage vorher</SelectItem>
                            <SelectItem value="30">30 Tage vorher</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Zusammenfassung</Label>
                        <Select value={notifForm.digestFrequency} onValueChange={(v) => setNotifForm((n) => ({ ...n, digestFrequency: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(digestLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button onClick={handleSaveNotifications} disabled={updateNotifPrefs.isPending}>
                        {updateNotifPrefs.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Speichern
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="darstellung" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Erscheinungsbild</CardTitle>
                <CardDescription>Wählen Sie Ihr bevorzugtes Farbschema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {([
                    { value: "light" as const, label: "Hell", icon: Sun, desc: "Helles Farbschema" },
                    { value: "dark" as const, label: "Dunkel", icon: Moon, desc: "Dunkles Farbschema" },
                    { value: "system" as const, label: "System", icon: Monitor, desc: "Automatisch erkennen" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      className={`flex flex-col items-center gap-2 rounded-lg border-2 p-6 transition-colors ${theme === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                        }`}
                    >
                      <opt.icon className={`h-8 w-8 ${theme === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${theme === opt.value ? "text-foreground" : "text-muted-foreground"}`}>
                        {opt.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* App Config Tab */}
          <TabsContent value="app" className="space-y-6">
            {companyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Anwendungskonfiguration</CardTitle>
                    <CardDescription>Allgemeine Einstellungen für die Anwendung</CardDescription>
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
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <div className="text-sm font-medium text-foreground">Automatisch speichern</div>
                        <div className="text-xs text-muted-foreground">Änderungen automatisch speichern</div>
                      </div>
                      <Switch checked={autoSave} onCheckedChange={setAutoSave} />
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button onClick={handleSaveAppConfig} disabled={updateCompany.isPending}>
                        {updateCompany.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Speichern
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Unternehmensdaten</CardTitle>
                    <CardDescription>Firmendaten für Dokumente und Berichte</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Firmenname</Label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" value={companyForm.name} onChange={(e) => setCompanyForm((c) => ({ ...c, name: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Steuernummer</Label>
                        <Input value={companyForm.taxNumber} onChange={(e) => setCompanyForm((c) => ({ ...c, taxNumber: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Adresse</Label>
                        <Input value={companyForm.address} onChange={(e) => setCompanyForm((c) => ({ ...c, address: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Webseite</Label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" value={companyForm.website} onChange={(e) => setCompanyForm((c) => ({ ...c, website: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button onClick={handleSaveCompanyData} disabled={updateCompany.isPending}>
                        {updateCompany.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Speichern
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
          {/* Sicherheit Tab */}
          <TabsContent value="sicherheit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Passwort ändern</CardTitle>
                <CardDescription>
                  Nach der Änderung werden alle aktiven Sitzungen beendet. Sie müssen sich erneut anmelden.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label>Aktuelles Passwort</Label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? "text" : "password"}
                      value={pwForm.currentPassword}
                      onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowCurrent((v) => !v)}
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Neues Passwort</Label>
                  <div className="relative">
                    <Input
                      type={showNew ? "text" : "password"}
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowNew((v) => !v)}
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Mind. 8 Zeichen, 1 Groß-/Kleinbuchstabe, 1 Ziffer</p>
                </div>
                <div className="space-y-2">
                  <Label>Neues Passwort bestätigen</Label>
                  <Input
                    type="password"
                    value={pwForm.confirmPassword}
                    onChange={(e) => setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  />
                  {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                    <p className="text-xs text-destructive">Passwörter stimmen nicht überein</p>
                  )}
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleChangePassword}
                    disabled={
                      pwLoading ||
                      !pwForm.currentPassword ||
                      !pwForm.newPassword ||
                      pwForm.newPassword !== pwForm.confirmPassword
                    }
                  >
                    {pwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    Passwort ändern
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Postfächer Tab */}
          <TabsContent value="postfaecher" className="space-y-6">
            <Card>
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
                    <div>
                      <p className="font-medium">{acc.label}</p>
                      <p className="text-sm text-muted-foreground">{acc.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Letzter Sync: {acc.lastSync ? formatDate(acc.lastSync) : "Noch nie"}
                      </p>
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
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={handleConnectMailbox} disabled={
                    createEmailAccount.isPending || !mailForm.label || !mailForm.email ||
                    !mailForm.imapHost || !mailForm.imapUser || !mailForm.password || !mailForm.smtpHost
                  }>
                    {createEmailAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
                    Verbinden &amp; Testen
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
};

export default SettingsPage;
