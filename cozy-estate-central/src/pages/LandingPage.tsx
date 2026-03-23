import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Building2, Users, CreditCard, FileText, Zap, BarChart3,
  CheckCircle2, Shield, Star
} from "lucide-react";

const features = [
  {
    icon: Building2,
    title: "Immobilien & Einheiten",
    description: "Verwalten Sie alle Objekte, Wohnungen, Garagen und Stellplätze an einem Ort.",
  },
  {
    icon: Users,
    title: "Mieter & Verträge",
    description: "Mieterübersicht, Mietverträge, automatisches Mahnwesen in 3 Stufen.",
  },
  {
    icon: CreditCard,
    title: "Finanzen & DATEV-Export",
    description: "Einnahmen, Ausgaben, Nebenkostenabrechnung und DATEV Buchungsstapel-Export.",
  },
  {
    icon: Zap,
    title: "KI-Belegscan",
    description: "Fotos von Belegen hochladen — Betrag, Datum und Kategorie werden automatisch erkannt.",
  },
  {
    icon: BarChart3,
    title: "Rendite-Dashboard",
    description: "Brutto- und Nettorendite pro Immobilie auf einen Blick. Wissen was Ihr Portfolio bringt.",
  },
  {
    icon: FileText,
    title: "Dokumente & Vorlagen",
    description: "Mietverträge und Schreiben als Vorlagen anlegen und mit einem Klick befüllen.",
  },
];

const proFeatures = [
  "Unbegrenzte Immobilien",
  "Alle Kernfunktionen",
  "DATEV-Export",
  "KI-Belegscan",
  "E-Mail Support",
];

const businessFeatures = [
  "Alles aus Pro",
  "PSD2-Bankanbindung",
  "Mehrere Postfächer (IMAP)",
  "Audit-Log",
  "Energie-Tracking",
  "Prioritäts-Support",
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">ImmoHub</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Anmelden
            </Button>
            <Button size="sm" onClick={() => navigate("/register")}>
              Kostenlos testen
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-3 py-1 rounded-full mb-6">
          <Star className="h-3.5 w-3.5" />
          14 Tage kostenlos — keine Kreditkarte erforderlich
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Immobilienverwaltung,<br />
          <span className="text-primary">die einfach funktioniert</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Mieter, Verträge, Finanzen, DATEV-Export — alles in einer Anwendung.
          Für kleine und mittlere Hausverwaltungen gemacht.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" onClick={() => navigate("/register")} className="text-base px-8">
            Jetzt kostenlos starten
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/login")} className="text-base px-8">
            Anmelden
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
          Alles was eine Hausverwaltung braucht
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-lg p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Einfache Preise</h2>
        <p className="text-center text-muted-foreground mb-12">
          Starten Sie kostenlos. Upgraden wenn Sie bereit sind.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Trial */}
          <div className="bg-card border border-border rounded-lg p-6 flex flex-col">
            <div className="mb-4">
              <p className="text-sm font-medium text-muted-foreground">Trial</p>
              <p className="text-4xl font-bold mt-1">0 €</p>
              <p className="text-sm text-muted-foreground mt-1">14 Tage</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                Alle Funktionen testen
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                Keine Kreditkarte
              </li>
            </ul>
            <Button variant="outline" className="w-full" onClick={() => navigate("/register")}>
              Kostenlos starten
            </Button>
          </div>

          {/* Pro */}
          <div className="bg-primary text-primary-foreground rounded-lg p-6 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-foreground text-primary text-xs font-bold px-3 py-1 rounded-full">
              Beliebt
            </div>
            <div className="mb-4">
              <p className="text-sm font-medium opacity-80">Pro</p>
              <p className="text-4xl font-bold mt-1">49 €</p>
              <p className="text-sm opacity-80 mt-1">pro Monat</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="secondary" className="w-full" onClick={() => navigate("/register")}>
              Jetzt starten
            </Button>
          </div>

          {/* Business */}
          <div className="bg-card border border-border rounded-lg p-6 flex flex-col">
            <div className="mb-4">
              <p className="text-sm font-medium text-muted-foreground">Business</p>
              <p className="text-4xl font-bold mt-1">99 €</p>
              <p className="text-sm text-muted-foreground mt-1">pro Monat</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {businessFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" onClick={() => navigate("/register")}>
              Jetzt starten
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-primary text-primary-foreground rounded-2xl p-10 text-center">
          <Shield className="h-10 w-10 mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Bereit loszulegen?
          </h2>
          <p className="text-lg opacity-80 mb-8">
            14 Tage kostenlos. Keine Kreditkarte. Jederzeit kündbar.
          </p>
          <Button size="lg" variant="secondary" onClick={() => navigate("/register")} className="text-base px-8">
            Kostenlos testen
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">© 2026 ImmoHub. Alle Rechte vorbehalten.</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="/impressum" className="hover:text-foreground">Impressum</a>
            <a href="/datenschutz" className="hover:text-foreground">Datenschutz</a>
            <a href="mailto:support@immohub.de" className="hover:text-foreground">Kontakt</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
