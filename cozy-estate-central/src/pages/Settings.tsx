import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  Settings,
  User,
  Bell,
  Moon,
  Sun,
  Monitor,
  Mail,
  Phone,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  Save,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Copy,
  RefreshCw,
  Check,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "@/hooks/api/useSettings";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingStatus, useCreateCheckout, useCreatePortalSession } from "@/hooks/api/useBilling";
import { useRegenerateBackupCodes } from "@/hooks/api/useTwoFactor";
import { useCalendarToken, useRegenerateCalendarToken } from "@/hooks/api/useCalendarEvents";
import { differenceInDays, parseISO, format } from "date-fns";
import { de } from "date-fns/locale";

type Theme = "light" | "dark" | "system";

function RegenerateBackupCodesSection() {
  const regenerate = useRegenerateBackupCodes();
  const [code, setCode] = useState("");
  const [newCodes, setNewCodes] = useState<string[]>([]);

  async function handleRegenerate() {
    if (code.length !== 6) { toast({ title: "Bitte aktuellen OTP-Code eingeben", variant: "destructive" }); return; }
    try {
      const result = await regenerate.mutateAsync(code);
      setNewCodes(result.backupCodes);
      setCode("");
      toast({ title: "Backup-Codes neu generiert" });
    } catch {
      toast({ title: "Ungültiger Code", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Aktueller OTP-Code (6-stellig)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          className="w-48 font-mono"
        />
        <Button onClick={handleRegenerate} disabled={regenerate.isPending} variant="outline">
          {regenerate.isPending ? "Generiere..." : "Backup-Codes neu generieren"}
        </Button>
      </div>
      {newCodes.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">⚠️ Neue Backup-Codes — jetzt sichern!</p>
          <div className="grid grid-cols-2 gap-2">
            {newCodes.map((c) => (
              <code key={c} className="rounded bg-muted px-2 py-1 text-sm font-mono text-center">{c}</code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarSyncSection() {
  const { data: tokenData, isLoading } = useCalendarToken();
  const regenerate = useRegenerateCalendarToken();
  const [copied, setCopied] = useState(false);

  const token = tokenData?.data?.calendarToken ?? "";
  const feedUrl = token ? `${window.location.origin}/api/calendar/ical-feed/${token}` : "";

  const handleCopy = () => {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRegenerate = async () => {
    await regenerate.mutateAsync();
    toast({ title: "Kalender-Link erneuert", description: "Der alte Link ist ab sofort ungültig." });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Kalender-Synchronisation
        </CardTitle>
        <CardDescription>
          Abonnieren Sie Ihren persönlichen Kalender-Feed in Google Calendar, Apple Calendar oder Outlook.
          Der Link enthält alle Termine, Mieterinnerungen und Wartungsaufgaben Ihrer Firma.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Wird geladen…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Ihr persönlicher iCal-Feed-Link</Label>
              <div className="flex gap-2">
                <Input value={feedUrl} readOnly className="font-mono text-xs bg-muted/50" />
                <Button variant="outline" size="icon" onClick={handleCopy} title="Link kopieren">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Fügen Sie diesen Link in Ihre Kalender-App ein (z. B. „Kalender abonnieren"). Der Feed wird automatisch aktualisiert.
              </p>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Link erneuern</p>
                  <p className="text-xs text-muted-foreground">
                    Der alte Link wird sofort ungültig. Alle bestehenden Kalender-Abonnements müssen neu eingerichtet werden.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={regenerate.isPending}
                  className="shrink-0"
                >
                  {regenerate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Erneuern
                </Button>
              </div>
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">So abonnieren Sie den Kalender:</p>
              <p><span className="font-medium">Google Calendar:</span> Andere Kalender → Per URL → Link einfügen</p>
              <p><span className="font-medium">Apple Calendar:</span> Ablage → Neues Kalenderabonnement → Link einfügen</p>
              <p><span className="font-medium">Outlook:</span> Kalender hinzufügen → Aus dem Internet → Link einfügen</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AbonnementTab() {
  const location = useLocation();
  const hasSuccessParam = new URLSearchParams(location.search).get("success") === "1";
  const [isPolling, setIsPolling] = useState(hasSuccessParam);

  // Stop polling after 10 seconds max
  useEffect(() => {
    if (!isPolling) return;
    const timer = setTimeout(() => setIsPolling(false), 10_000);
    return () => clearTimeout(timer);
  }, [isPolling]);

  const { data, isLoading: billingLoading } = useBillingStatus({ refetchInterval: isPolling ? 2000 : false });
  const checkout = useCreateCheckout();
  const portal = useCreatePortalSession();

  // Stop polling once ACTIVE
  useEffect(() => {
    if (data?.data.subscriptionStatus === "ACTIVE") setIsPolling(false);
  }, [data]);

  if (billingLoading) return <div className="py-8 text-center text-muted-foreground">Wird geladen…</div>;

  const billing = data?.data;
  if (!billing) return null;

  const { subscriptionStatus, planType, trialEndsAt, currentPeriodEnd } = billing;

  function statusBadge() {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      TRIAL:    { label: "Trial",      variant: "secondary" },
      ACTIVE:   { label: "Aktiv",      variant: "default" },
      PAST_DUE: { label: "Überfällig", variant: "destructive" },
      CANCELED: { label: "Gekündigt",  variant: "destructive" },
      MANUAL:   { label: "Testzugang", variant: "outline" },
    };
    const s = map[subscriptionStatus] ?? { label: subscriptionStatus, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  }

  async function handleCheckout(plan: "PRO" | "BUSINESS") {
    const res = await checkout.mutateAsync(plan);
    window.location.href = res.data.url;
  }

  async function handlePortal() {
    const res = await portal.mutateAsync();
    window.location.href = res.data.url;
  }

  const planLabel = planType === "PRO" ? "Pro (49 €/Monat)" : planType === "BUSINESS" ? "Business (99 €/Monat)" : "Trial";

  return (
    <div className="space-y-6 max-w-xl">
      {hasSuccessParam && isPolling && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Zahlung bestätigt — Abo wird aktiviert…</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Aktueller Plan</h3>
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium">{planLabel}</span>
          {statusBadge()}
        </div>
      </div>

      {subscriptionStatus === "TRIAL" && trialEndsAt && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {differenceInDays(parseISO(trialEndsAt), new Date())} Tage verbleibend
            (bis {format(parseISO(trialEndsAt), "dd.MM.yyyy", { locale: de })})
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => handleCheckout("PRO")} disabled={checkout.isPending}>Pro abonnieren — 49 €/Monat</Button>
            <Button variant="outline" onClick={() => handleCheckout("BUSINESS")} disabled={checkout.isPending}>Business — 99 €/Monat</Button>
          </div>
        </div>
      )}

      {subscriptionStatus === "ACTIVE" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Nächste Zahlung: {currentPeriodEnd ? format(parseISO(currentPeriodEnd), "dd.MM.yyyy", { locale: de }) : "—"}
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={handlePortal} disabled={portal.isPending}>Abo verwalten</Button>
            <Button variant="ghost" onClick={() => handleCheckout("BUSINESS")} disabled={checkout.isPending}>Plan wechseln</Button>
          </div>
        </div>
      )}

      {subscriptionStatus === "PAST_DUE" && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Ihre letzte Zahlung ist fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsdaten.</AlertDescription>
          </Alert>
          <Button onClick={handlePortal} disabled={portal.isPending}>Jetzt bezahlen</Button>
        </div>
      )}

      {subscriptionStatus === "CANCELED" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Ihr Abonnement wurde gekündigt.</p>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => handleCheckout("PRO")} disabled={checkout.isPending}>Pro abonnieren — 49 €/Monat</Button>
            <Button variant="outline" onClick={() => handleCheckout("BUSINESS")} disabled={checkout.isPending}>Business — 99 €/Monat</Button>
          </div>
        </div>
      )}

      {subscriptionStatus === "MANUAL" && (
        <p className="text-sm text-muted-foreground">
          Testzugang (durch Administrator vergeben).
          {currentPeriodEnd ? ` Gültig bis: ${format(parseISO(currentPeriodEnd), "dd.MM.yyyy", { locale: de })}` : ""}
        </p>
      )}
    </div>
  );
}

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

  // ─── App Config (localStorage only) ─────────────────────
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem("autoSave") !== "false");
  const [eveningDuration, setEveningDuration] = useState<number>(() => {
    const saved = localStorage.getItem("eveningEventDurationMin");
    return saved ? parseInt(saved, 10) : 60;
  });

  useEffect(() => {
    localStorage.setItem("autoSave", String(autoSave));
  }, [autoSave]);

  const profile = profileData?.data;

  // ─── Password Change ─────────────────────────────────────
  const { logout, user } = useAuth();
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
      await api("/auth/me/password", {
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
            <TabsTrigger value="kalender" className="gap-1.5"><Calendar className="h-4 w-4" /> Kalender</TabsTrigger>
            <TabsTrigger value="abo">Abonnement</TabsTrigger>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">App-Einstellungen</CardTitle>
                <CardDescription>Persönliche Einstellungen für diese Anwendung</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium text-foreground">Automatisch speichern</div>
                    <div className="text-xs text-muted-foreground">Änderungen automatisch speichern</div>
                  </div>
                  <Switch checked={autoSave} onCheckedChange={setAutoSave} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kalender</CardTitle>
                <CardDescription>Standard-Dauer für Abendtermine (ab 20:00 Uhr)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Input
                    type="number" min={15} max={480} step={15}
                    value={eveningDuration}
                    onChange={(e) => setEveningDuration(Math.max(15, Number(e.target.value)))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">Minuten</span>
                  <Button size="sm" variant="outline" onClick={() => {
                    localStorage.setItem("eveningEventDurationMin", String(eveningDuration));
                    toast({ title: "Gespeichert", description: `Abendtermin Standard-Dauer: ${eveningDuration} Min.` });
                  }}>
                    Speichern
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Neue Termine ab 20:00 Uhr werden automatisch auf diese Dauer gesetzt. Ohne Einstellung: 60 Minuten.
                </p>
              </CardContent>
            </Card>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Zwei-Faktor-Authentifizierung
                </CardTitle>
                <CardDescription>
                  2FA ist für Ihren Account aktiv. Sie können Backup-Codes neu generieren, falls Sie keinen Zugriff mehr auf Ihre Authenticator-App haben.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RegenerateBackupCodesSection />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Kalender Tab */}
          <TabsContent value="kalender" className="space-y-6">
            <CalendarSyncSection />
          </TabsContent>

          {/* Abonnement Tab */}
          <TabsContent value="abo">
            <AbonnementTab />
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
};

export default SettingsPage;
