# Immoverwaltung — Benutzerhandbuch

> **Version:** 1.0 | **Stand:** Februar 2026  
> **Zielgruppe:** Hausverwaltungen, Büromitarbeiter, Verwalter  

---

## 📋 Inhaltsverzeichnis

1. [Einstieg](#1-einstieg)
2. [Wo finde ich was?](#2-wo-finde-ich-was)
3. [Immobilien & Mieter verwalten](#3-immobilien--mieter-verwalten)
4. [Verträge & Finanzen](#4-verträge--finanzen)
5. [Bank verbinden](#5-bank-verbinden)
6. [E-Mails & KI](#6-e-mails--ki)
7. [Nebenkosten abrechnen](#7-nebenkosten-abrechnen)
8. [Wartung & Kalender](#8-wartung--kalender)
9. [Vorlagen & Dokumente](#9-vorlagen--dokumente)
10. [Berichte & Rendite](#10-berichte--rendite)
11. [Einstellungen & Benutzerverwaltung](#11-einstellungen--benutzerverwaltung)
12. [Hilfe bei Fehlern](#12-hilfe-bei-fehlern)

---

## 1. Einstieg

### Login

1. Öffnen Sie die Anwendung im Browser (Standard: `http://localhost:8080`)
2. Geben Sie **E-Mail** und **Passwort** ein
3. Klicken Sie auf **„Anmelden"**

> **Erstanmeldung:** Klicken Sie auf „Registrieren", um ein neues Unternehmen + Admin-Konto anzulegen. Sie erhalten automatisch die Rolle **ADMIN**.

### Dashboard — Ihr Startbildschirm

Nach dem Login landen Sie auf dem **Dashboard** (`/`). Hier sehen Sie auf einen Blick:

| KPI-Karte | Beschreibung |
|-----------|-------------|
| 🏠 **Immobilien** | Gesamtzahl Ihrer Objekte + Einheiten |
| 👥 **Mieter** | Aktive Mieter + belegte Einheiten |
| 💰 **Monatl. Einnahmen** | Summe aller Mieteinnahmen + offene Tickets |
| ⚠️ **Leerstand** | Anzahl freier Einheiten + Quote in % |

Darunter finden Sie:
- **Immobilien-Tabelle** — Alle Objekte mit Belegung und Umsatz
- **Schnellaktionen** — 4 Buttons zum direkten Erstellen (Immobilie, Mieter, Vertrag, Ticket)
- **Letzte Aktivitäten** — Feed mit aktuellen Zahlungen, neuen Mietern und Tickets

---

## 2. Wo finde ich was?

Die Seitenleiste (Sidebar) ist Ihr Hauptmenü. Sie ist in **drei Gruppen** unterteilt:

### Übersicht

| Menüpunkt | Pfad | Funktion |
|-----------|------|----------|
| 📊 Dashboard | `/` | Startseite mit KPIs, Tabelle, Schnellaktionen |
| 🏠 Immobilien | `/properties` | Alle Objekte verwalten (Liste/Grid) |
| 👥 Mieter | `/tenants` | Mieterstammdaten + Dokumente |
| 📄 Verträge | `/contracts` | Mietverträge + Erinnerungen + Mahnwesen |
| 💳 Finanzen | `/finances` | Transaktionen, KI-Scan, Rendite, Wiederkehrend |
| 🏦 Bankanbindung | `/bank` | Bankkonten + PSD2 + CSV-Import |

### Verwaltung

| Menüpunkt | Pfad | Funktion |
|-----------|------|----------|
| 🔧 Wartung | `/maintenance` | Tickets + Wartungspläne |
| 📝 Vorlagen | `/vorlagen` | Dokumentvorlagen + PDF-Generierung |
| 📈 Berichte | `/reports` | Charts: Belegung, Umsatz, Kosten |
| 🔔 Benachrichtigungen | `/notifications` | System-Benachrichtigungen |
| 👤 Benutzer | `/users` | *Nur ADMIN:* Mitarbeiter verwalten |

### Kommunikation

| Menüpunkt | Pfad | Funktion |
|-----------|------|----------|
| 📅 Kalender | `/calendar` | Termine, automatische Events aus Verträgen/Tickets |
| ✉️ Postfach | `/postfach` | E-Mail-Inbox mit KI-Analyse |
| 📨 Anfragen | `/anfragen` | Eingehende Anfragen verwalten |

### Footer

| Menüpunkt | Funktion |
|-----------|----------|
| ⚙️ Einstellungen | Profil, Firma, Darstellung, Sicherheit, Postfächer |
| 🚪 Abmelden | Session beenden |

> **Tipp:** Die Sidebar kann eingeklappt werden (nur Icons) über den Trigger-Button oben links.

---

## 3. Immobilien & Mieter verwalten

### Immobilie anlegen

1. Gehen Sie zu **Immobilien** in der Sidebar
2. Klicken Sie auf **„Neue Immobilie"**
3. Füllen Sie aus: **Name**, **Straße**, **PLZ**, **Stadt**
4. Klicken Sie auf **Speichern**

Die Immobilie erscheint in der Liste. Klicken Sie darauf für die **Detailansicht**.

### Detailansicht — 5 Tabs

| Tab | Funktion |
|-----|----------|
| **Einheiten** | Wohnungen/Garagen/Stellplätze anlegen, Mieter zuweisen |
| **Dokumente** | Dateien hochladen (PDF, JPG, PNG — Magic-Bytes-Prüfung) |
| **Nebenkosten** | Ausgaben als umlagefähig markieren, Jahresabrechnung generieren |
| **Zähler** | Strom-/Wasser-/Gas-/Wärmezähler + Ablesungen + Verbrauch |
| **Protokolle** | Übergabeprotokolle (Einzug/Auszug) erstellen |

### Einheit hinzufügen

1. Im Tab **„Einheiten"** → **„Einheit hinzufügen"**
2. Ausfüllen: **Nummer**, **Typ** (Wohnung/Garage/Stellplatz), **Etage**, **Fläche (m²)**, **Monatliche Miete (€)**
3. Speichern

### Mieter zuweisen

1. In der Einheiten-Tabelle: Klicken Sie auf **„Mieter zuweisen"** bei der gewünschten Einheit
2. Wählen Sie einen vorhandenen Mieter aus dem Dropdown
3. Die Einheit wechselt zum Status **„vermietet"**

### Mieter anlegen

1. Gehen Sie zu **Mieter** in der Sidebar
2. Klicken Sie auf **„Neuer Mieter"**
3. Ausfüllen: **Name**, **E-Mail**, **Telefon**, **Einzugsdatum**
4. Speichern

> **Tipp:** Sie können Mieter-Dokumente (Schufa, Ausweis-Kopie) direkt über die Mieter-Detailansicht hochladen.

---

## 4. Verträge & Finanzen

### Vertrag anlegen

1. Gehen Sie zu **Verträge**
2. Klicken Sie auf **„Neuer Vertrag"**
3. Füllen Sie aus:
   - **Vertragstyp:** Wohnraum / Gewerbe / Staffel / Index
   - **Mieter, Immobilie, Einheit** auswählen
   - **Monatliche Miete, Kaution, Beginn, Ende, Kündigungsfrist**
4. Speichern

**Status-Badges:**
- 🟢 Aktiv — Laufender Vertrag
- 🟡 Auslaufend — Ende nähert sich
- 🔴 Gekündigt — Bereits gekündigt
- ⚪ Entwurf — Noch nicht aktiv

### Transaktion erfassen

1. Gehen Sie zu **Finanzen**
2. Im Tab **„Übersicht"** → **„Neue Transaktion"**
3. Füllen Sie aus: **Typ** (Einnahme/Ausgabe), **Datum**, **Beschreibung**, **Betrag**, **Kategorie**, **Immobilie**
4. Speichern

> **KI-Tipp:** Klicken Sie auf **„Beleg scannen"** und laden Sie ein Foto/PDF eines Belegs hoch. Die KI füllt automatisch die Felder aus!

### Wiederkehrende Transaktionen

1. Im Tab **„Wiederkehrend"** → **„Neue wiederkehrende Transaktion"**
2. Intervall wählen: **Monatlich / Vierteljährlich / Halbjährlich / Jährlich**
3. Das System erstellt automatisch Buchungen zum jeweiligen Fälligkeitstermin

### Mahnung senden

1. Gehen Sie zu **Verträge**
2. Bei einem Vertrag mit überfälliger Zahlung: Klicken Sie auf **„Mahnung senden"**
3. Das System erhöht die Mahnstufe (1 → 2 → 3) und sendet bei konfiguriertem SMTP eine E-Mail

---

## 5. Bank verbinden

### Option A: Manuelles Bankkonto

1. Gehen Sie zu **Bankanbindung**
2. Klicken Sie auf **„Konto hinzufügen"**
3. Geben Sie **Kontoname**, **IBAN** und **BIC** ein
4. Speichern

### Option B: PSD2 mit Nordigen (automatisch)

> **Voraussetzung:** Der Administrator muss `NORDIGEN_SECRET_ID` und `NORDIGEN_SECRET_KEY` in der `.env`-Datei des Backends konfigurieren.

1. Im Backend werden verfügbare Banken geladen (`GET /api/banking/institutions?country=DE`)
2. Wählen Sie Ihre Bank → OAuth-Redirect zu Ihrer Bank
3. Nach erfolgreicher Autorisierung wird das Konto automatisch verknüpft
4. Transaktionen werden alle **6 Stunden** automatisch synchronisiert

### CSV-Import (Fallback)

1. Auf der Bankanbindung-Seite → **„CSV importieren"**
2. Wählen Sie eine CSV-Datei aus (Format: deutsche Bank-Exporte)
3. Das System parst die Datei und importiert die Transaktionen

### Automatisches Matching

Das System gleicht Banktransaktionen automatisch mit offenen Mietzahlungen ab:
- **Betrag** muss innerhalb ±0,01 € liegen
- **Mietername** muss in der Überweisungsbeschreibung erkannt werden
- Bei Erfolg wird die Mietzahlung automatisch als **bezahlt** markiert

---

## 6. E-Mails & KI

### E-Mail-Konto verbinden

1. Gehen Sie zu **Einstellungen** → Tab **„Postfächer"**
2. Klicken Sie auf **„Postfach verbinden"**
3. Geben Sie ein:
   - **IMAP-Host** (z.B. `imap.gmail.com`)
   - **IMAP-Port** (z.B. `993`)
   - **SMTP-Host** (z.B. `smtp.gmail.com`)
   - **SMTP-Port** (z.B. `587`)
   - **E-Mail-Adresse**
   - **Passwort** (wird AES-256-GCM verschlüsselt gespeichert)
4. Das System prüft die IMAP-Verbindung und speichert bei Erfolg

> **Gmail-Nutzer:** Verwenden Sie ein [App-Passwort](https://myaccount.google.com/apppasswords), nicht Ihr normales Passwort.

### Postfach nutzen

1. Gehen Sie zu **Postfach** in der Sidebar
2. Links: **E-Mail-Liste** mit Filter-Tabs (Alle / Ungelesen / Anfragen)
3. Rechts: **E-Mail-Vorschau** (HTML-Darstellung)
4. **Antworten:** Klicken Sie auf „Antworten" unter der Vorschau

### KI-Terminvorschlag

Wenn die KI in einer E-Mail einen Termin erkennt (z.B. „Besichtigung am 15.03. um 14 Uhr"), erscheint ein **blauer Banner** mit der Option, den Termin direkt in den **Kalender** zu übernehmen.

### Anfragen-Management

E-Mails, die von der KI als Anfrage erkannt werden (z.B. Mietinteressenten), erscheinen auf der Seite **Anfragen** (`/anfragen`). Dort können Sie den Status ändern:

**Neu** → **In Bearbeitung** → **Akzeptiert** oder **Abgelehnt**

---

## 7. Nebenkosten abrechnen

### Schritt 1: Ausgaben als umlagefähig markieren

1. Gehen Sie zur **Immobilien-Detailansicht** → Tab **„Nebenkosten"**
2. In der Ausgaben-Liste: Setzen Sie den **Haken** bei „Umlagefähig" für jede relevante Ausgabe
3. Optional: Vergeben Sie eine **Kategorie** (z.B. Wasser, Heizung, Müll)

### Schritt 2: Jahresabrechnung generieren

1. Wählen Sie das **Jahr** aus
2. Klicken Sie auf **„Abrechnung generieren"**
3. Das System berechnet die Verteilung automatisch **nach Wohnfläche (m²)**

### Schritt 3: PDF herunterladen

Klicken Sie auf **„PDF herunterladen"** — die Nebenkostenabrechnung wird als PDF-Datei heruntergeladen.

> **Wichtig:** Stellen Sie sicher, dass alle Einheiten eine korrekte **Fläche (m²)** eingetragen haben, da die Verteilung danach berechnet wird.

---

## 8. Wartung & Kalender

### Wartungsticket erstellen

1. Gehen Sie zu **Wartung**
2. Klicken Sie auf **„Neues Ticket"**
3. Füllen Sie aus:
   - **Titel** und **Beschreibung**
   - **Kategorie:** Sanitär / Elektrik / Heizung / Gebäude / Außenanlage / Sonstiges
   - **Priorität:** Niedrig / Mittel / Hoch / Dringend
   - **Immobilie** und optional **Einheit**
   - **Fälligkeitsdatum** — erscheint automatisch im Kalender!
4. Speichern

### Ticket bearbeiten

Klicken Sie auf ein Ticket, um den **Detail-Dialog** zu öffnen. Dort können Sie bearbeiten:
- Status (Offen → In Bearbeitung → Wartend → Erledigt)
- Zugewiesen an
- Kosten
- Notizen

### Wartungsplan (automatisch)

Im Tab **„Wartungsplan"** können Sie wiederkehrende Wartungsaufgaben anlegen (z.B. jährliche Heizungswartung). Das System erstellt bei Fälligkeit automatisch ein Ticket.

### Kalender

Auf der **Kalender-Seite** sehen Sie alle Termine:

| Farbe | Typ | Quelle |
|-------|-----|--------|
| 🔵 Blau | Manuell | Von Ihnen erstellt |
| 🟠 Orange | Vertrag | Erinnerungen + Vertragsende |
| 🔴 Rot | Wartung | Ticket-Fälligkeiten |
| 🟢 Grün | Miete | Fällige Mietzahlungen |
| 🟣 Lila | E-Mail | KI-erkannte Termine |

Ansichten: **Monat**, **Woche**, **Tag** (umschaltbar oben rechts).

---

## 9. Vorlagen & Dokumente

### Dokumentvorlage erstellen

1. Gehen Sie zu **Vorlagen** in der Sidebar
2. Klicken Sie auf **„Neue Vorlage"**
3. Geben Sie ein:
   - **Name** (z.B. „Mietvertrag Standard")
   - **Kategorie**
   - **Inhalt** im Handlebars-Format

### Verfügbare Variablen

Verwenden Sie `{{variablenname}}` im Template-Text:

| Variable | Beschreibung |
|----------|-------------|
| `{{tenantName}}` | Name des Mieters |
| `{{propertyName}}` | Name der Immobilie |
| `{{unitNumber}}` | Einheitsnummer |
| `{{date}}` | Aktuelles Datum |
| `{{amount}}` | Betrag in € |
| `{{landlord}}` | Name des Vermieters |

### PDF generieren

1. In der Vorlagen-Tabelle: Klicken Sie auf **„Ausfüllen & PDF"**
2. Füllen Sie die 6 Variablen-Felder aus
3. Klicken Sie auf **„PDF erstellen"** — die Datei wird heruntergeladen

### Dokumente hochladen

In der Immobilien-Detailansicht (Tab **„Dokumente"**):
1. Klicken Sie auf **„Dokument hochladen"**
2. Wählen Sie eine Datei (PDF, JPG, PNG — max. Dateigröße beachten)
3. Bestätigen Sie die **DSGVO-Einwilligung** (Checkbox)
4. Die Datei wird **AES-256-GCM verschlüsselt** gespeichert

---

## 10. Berichte & Rendite

### Berichte-Seite

Unter **Berichte** finden Sie **4 interaktive Charts**:

| Chart | Beschreibung |
|-------|-------------|
| **Belegung** | Belegungsquote über alle Immobilien |
| **Umsatz** | Monatliche Einnahmen im Zeitverlauf |
| **Umsatz/m²** | Ertrag pro Quadratmeter je Immobilie |
| **Wartungskosten** | Ausgaben für Instandhaltung nach Kategorie |

### Rendite-Dashboard

Unter **Finanzen → Tab „Rendite"**:

1. Stellen Sie sicher, dass **Kaufpreis** und **Eigenkapital** in der Immobilie eingetragen sind (Immobilie bearbeiten → Felder „Kaufpreis" und „Eigenkapital")
2. Das System berechnet automatisch:
   - **Bruttorendite** = Jahresmiete / Kaufpreis × 100
   - **Nettorendite** = (Jahresmiete − Kosten) / Kaufpreis × 100
   - **EK-Rendite** = (Jahresmiete − Kosten) / Eigenkapital × 100

### DATEV Export

Für den Steuerberater:
1. Einstellungen → DATEV-Konfiguration (Admin erforderlich)
2. Beraternummer, Mandantennummer, Kontenrahmen (SKR03/SKR04) eintragen
3. Kategorie → Kontonummer Mappings pflegen
4. Export auslösen → CSV-Datei im DATEV EXTF-Format herunterladen

---

## 11. Einstellungen & Benutzerverwaltung

### Einstellungen (7 Tabs)

| Tab | Funktion |
|-----|----------|
| **Profil** | Name, E-Mail, Telefon ändern |
| **Benachrichtigungen** | E-Mail-Notifikationen konfigurieren |
| **Darstellung** | Theme wechseln (Hell / Dunkel / System) |
| **App-Konfiguration** | Anwendungseinstellungen |
| **Firmendaten** | Firmenname, Adresse, Steuernummer |
| **Sicherheit** | Passwort ändern (mit Bestätigung) |
| **Postfächer** | E-Mail-Accounts verwalten (IMAP/SMTP) |

### Passwort ändern

1. Einstellungen → Tab **„Sicherheit"**
2. **Aktuelles Passwort** eingeben
3. **Neues Passwort** eingeben (min. 8 Zeichen, Groß-/Kleinbuchstabe, Zahl, Sonderzeichen)
4. **Bestätigen** und speichern
5. Sie werden automatisch abgemeldet (alle Geräte)

### Benutzerverwaltung (nur ADMIN)

1. Gehen Sie zu **Benutzer** in der Sidebar
2. Übersicht aller Firmen-Benutzer mit Rollen

**Aktionen:**
- **Neuer Benutzer:** Name, E-Mail, Rolle zuweisen
- **Rollen ändern:** ADMIN / Verwalter / Buchhalter / Nur Lesen
- **Passwort zurücksetzen:** Generiert ein temporäres Passwort (Kopier-Button + E-Mail bei SMTP)
- **Account entsperren:** Hebt eine Sperre nach 10 Fehlversuchen auf
- **Löschen:** Benutzer entfernen (nicht sich selbst, nicht letzter Admin)

**Rollen-Übersicht:**

| Rolle | Lesen | Schreiben | Admin-Funktionen |
|-------|-------|-----------|-----------------|
| ADMIN | ✅ | ✅ | ✅ (Benutzer, DATEV, Firmendaten) |
| VERWALTER | ✅ | ✅ | ❌ |
| BUCHHALTER | ✅ | ✅ (nur Finanzen + Verträge) | ❌ |
| NUR LESEN | ✅ | ❌ | ❌ |

---

---

## 12. Hilfe bei Fehlern (FAQ)

### Häufig gestellte Fragen

**Frage: Wie sicher sind meine Bankdaten?**
Antwort: Wir nutzen den europäischen Marktführer GoCardless (Nordigen). Ihre Zugangsdaten zur Bank werden niemals in unserer Datenbank gespeichert. Wir erhalten lediglich lesenden Zugriff auf die Transaktionen über einen verschlüsselten Token.

**Frage: Kann ich Daten aus meiner alten Software importieren?**
Antwort: Ja. Nutzen Sie den CSV-Import unter „Administration → Datenimport". Dort finden Sie Vorlagen für Immobilien, Mieter und Verträge.
!!SCREENSHOT:01-login!!

**Frage: Funktioniert die Software auch auf dem Tablet?**
Antwort: Ja, die Immoverwaltung ist „Responsive" gestaltet und lässt sich auf Tablets und Smartphones bequem im Browser bedienen.
!!SCREENSHOT:02-dashboard!!

**Frage: Was passiert, wenn ich mein Passwort vergesse?**
Antwort: Wenn Sie Administrator sind, kann ein anderer Administrator Ihr Passwort im Bereich „Benutzer" zurücksetzen. Wenn Sie der einzige Admin sind, muss der System-Administrator das Passwort über die Server-Konsole zurücksetzen.

---

## 13. Technische Details & Support

### Tastenkürzel

| Kürzel | Funktion |
|--------|----------|
| `Esc` | Dialog schließen |
| `Enter` | Formular absenden (in Dialogen) |

!!SCREENSHOT:08-darkmode!!

---

> **💡 Tipp:** Lesezeichen Sie die wichtigsten Seiten (Dashboard, Finanzen, Wartung) für schnellen Zugriff.

> **🔒 Sicherheitshinweis:** Ändern Sie Ihr Passwort regelmäßig und teilen Sie es nicht mit Kollegen. Verwenden Sie die Benutzerverwaltung, um Mitarbeitern eigene Zugänge mit passenden Rollen zu geben.

!!SCREENSHOT:09-logout!!
