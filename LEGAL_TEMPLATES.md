# Rechtliche Checkliste (SaaS Deutschland)

Diese Datei hilft dir, die gesetzlichen Anforderungen für einen professionellen Betrieb in Deutschland zu erfüllen.

> [!CAUTION]
> Dies ist keine Rechtsberatung. Für verbindliche Texte solltest du einen Anwalt oder einen Generator (z. B. e-Recht24) nutzen.

## 1. Impressum (§ 5 DDG)
Jede geschäftsmäßige Webseite benötigt ein Impressum.

**Checkliste:**
- [ ] Vollständiger Name / Firmenname
- [ ] Rechtsform (GbR, GmbH, etc.)
- [ ] Vertretungsberechtigte Personen
- [ ] Ladungsfähige Anschrift (kein Postfach)
- [ ] E-Mail-Adresse + Telefonnummer
- [ ] Registergericht + Registernummer (falls vorhanden)
- [ ] Umsatzsteuer-ID (falls vorhanden)

## 2. Datenschutzerklärung (DSGVO)
Du verarbeitest personenbezogene Daten (Mieter, Bankdaten).

**Inhalte für deine App:**
- **Hosting**: Hetzner Online GmbH (Datenstandort Deutschland).
- **Session-Cookies**: Technisch notwendig für Login (keine Einwilligungspflicht).
- **Bankdaten (PSD2)**: Erwähnung der GoCardless/Nordigen Schnittstelle.
- **E-Mail-Postfächer**: Information über die Verarbeitung von E-Mails via IMAP/SMTP.
- **KI-Scan**: Nutzung von Anthropic (Claude) zur Belegverarbeitung (Auftragsverarbeitung prüfen).

## 3. AVV (Auftragsverarbeitungsvertrag)
Wenn du die Software an andere Hausverwaltungen verkaufst, bist du deren "Auftragsverarbeiter" (Art. 28 DSGVO).

- [ ] Du musst deinen Kunden einen AVV zur Verfügung stellen.
- [ ] Der AVV regelt, wie du deren Daten schützt (siehe `VERARBEITUNGSVERZEICHNIS.md`).

## 4. Double-Opt-In
Falls du in Zukunft Newsletter- oder Marketing-Mails verschickst, musst du das Double-Opt-In-Verfahren nutzen. (Aktuell bei System-Mails wie Mahnungen nicht zwingend erforderlich, aber empfohlen).
