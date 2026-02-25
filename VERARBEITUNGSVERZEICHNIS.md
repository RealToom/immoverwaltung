# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

> **Verantwortlicher:** [Firmenname einsetzen]
> **Datenschutzbeauftragter:** [DSB einsetzen, sofern bestellt]
> **Letzte Aktualisierung:** 2026-02-25

---

## 1. Mieterverwaltung

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Verwaltung von Mietverhältnissen, Kommunikation mit Mietern |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) |
| **Betroffene Personen** | Mieter, Mietinteressenten |
| **Personenbezogene Daten** | Name, E-Mail, Telefon, Einzugsdatum |
| **Empfänger** | Keine externen Empfänger |
| **Drittlandtransfer** | Keiner |
| **Löschfrist** | 3 Jahre nach Ende des Mietverhältnisses (§ 195 BGB Verjährungsfrist) |
| **Technische Maßnahmen** | JWT-Authentifizierung, rollenbasierte Zugriffskontrolle (RBAC), Company-Isolation (tenantGuard) |

---

## 2. Dokumente (Immobilien & Mieter)

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Speicherung vertraglicher und prüfungsrelevanter Dokumente (Mietverträge, Schufa-Auskünfte, Nebenkostenabrechnungen) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b (Vertrag), lit. c (rechtliche Pflicht), lit. f (berechtigtes Interesse) |
| **Betroffene Personen** | Mieter, Eigentümer, Dienstleister |
| **Personenbezogene Daten** | Dokumente mit potenziell sensiblen Inhalten (Bonitätsauskünfte, Identitätsnachweise, Verträge) |
| **Empfänger** | Keine externen Empfänger (lokale Speicherung) |
| **Drittlandtransfer** | Keiner |
| **Löschfrist** | Konfigurierbar pro Dokument (6 Monate bis 10 Jahre), automatische Löschung nach `retentionUntil` |
| **Technische Maßnahmen** | AES-256-GCM Verschlüsselung at-rest (ENCRYPTION_KEY), UUID-basierte Dateinamen, MIME-Type-Whitelist, 10 MB Größenlimit, Audit-Logging (Upload/Download/Preview/Delete), DSGVO-Einwilligungs-Checkbox |

---

## 3. Benutzerkonten (Verwaltungspersonal)

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Authentifizierung und Autorisierung von Verwaltungsmitarbeitern |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO (Arbeitsvertrag/Dienstvertrag) |
| **Betroffene Personen** | Mitarbeiter, Verwalter, Administratoren |
| **Personenbezogene Daten** | Name, E-Mail, Passwort (bcrypt-gehasht), Rolle, Benachrichtigungspräferenzen |
| **Empfänger** | Keine externen Empfänger |
| **Drittlandtransfer** | Keiner |
| **Löschfrist** | Bei Austritt des Mitarbeiters, spätestens nach 6 Monaten |
| **Technische Maßnahmen** | bcrypt mit Salt, JWT mit Refresh-Token, Rate-Limiting (Login), Account-Lockout nach 5 Fehlversuchen, httpOnly Cookies |

---

## 4. Finanztransaktionen

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Erfassung und Auswertung von Einnahmen/Ausgaben je Immobilie |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. c DSGVO (§ 147 AO Aufbewahrungspflicht) |
| **Betroffene Personen** | Mieter (indirekt), Dienstleister (indirekt) |
| **Personenbezogene Daten** | Transaktionsbeschreibung (kann Mieternamen enthalten), Beträge, Kategorien |
| **Empfänger** | Keine externen Empfänger |
| **Drittlandtransfer** | Keiner |
| **Löschfrist** | 10 Jahre (§ 147 Abs. 3 AO, § 257 Abs. 4 HGB) |
| **Technische Maßnahmen** | Company-Isolation, rollenbasierter Zugriff |

---

## 5. Wartungs-Tickets

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Verwaltung von Reparatur- und Wartungsanfragen |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b (Vertragserfüllung Instandhaltungspflicht) |
| **Betroffene Personen** | Mieter (Melder), Handwerker (Zugewiesene) |
| **Personenbezogene Daten** | Ticketbeschreibungen (können Mieternamen enthalten), Priorität, Status |
| **Empfänger** | Keine externen Empfänger |
| **Drittlandtransfer** | Keiner |
| **Löschfrist** | 3 Jahre nach Abschluss (Gewährleistungsfrist) |
| **Technische Maßnahmen** | Company-Isolation, rollenbasierter Zugriff |

---

## 6. Verträge

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Verwaltung von Miet-, Gewerbe- und Stellplatzverträgen |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b (Vertragserfüllung), lit. c (steuerliche Aufbewahrung) |
| **Betroffene Personen** | Mieter |
| **Personenbezogene Daten** | Vertragstyp, Mietbetrag, Laufzeiten, Kaution |
| **Empfänger** | Keine externen Empfänger |
| **Drittlandtransfer** | Keiner |
| **Löschfrist** | 10 Jahre nach Vertragsende (§ 147 AO) |
| **Technische Maßnahmen** | Company-Isolation, rollenbasierter Zugriff |

---

## 7. E-Mail-Benachrichtigungen

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Systeminterne Benachrichtigungen per E-Mail (Vertrag läuft aus, Ticket-Update, etc.) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. f (berechtigtes Interesse an effizienter Verwaltung) |
| **Betroffene Personen** | Verwaltungsmitarbeiter |
| **Personenbezogene Daten** | E-Mail-Adresse des Empfängers, Betreff, Nachrichteninhalt (kann Mieternamen enthalten) |
| **Empfänger** | SMTP-Provider (konfigurierbar) |
| **Drittlandtransfer** | Abhängig vom SMTP-Provider |
| **Löschfrist** | Keine persistente Speicherung (nur Versand) |
| **Technische Maßnahmen** | TLS-Verschlüsselung (SMTP), konfigurierbare Benachrichtigungspräferenzen |

---

## 8. Audit-Logs

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Nachweisbarkeit von Dokumentenzugriffen (DSGVO Art. 5 Abs. 2) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. c (Nachweispflicht) |
| **Betroffene Personen** | Verwaltungsmitarbeiter |
| **Personenbezogene Daten** | User-ID, IP-Adresse, Zeitstempel, Aktion, Dokumenten-ID |
| **Empfänger** | Keine (Server-Logs) |
| **Drittlandtransfer** | Keiner |
| **Löschfrist** | 1 Jahr (rollierende Log-Dateien empfohlen) |
| **Technische Maßnahmen** | Strukturiertes JSON-Logging, nur serverseitig |

---

## 9. Bankanbindung (PSD2 / Banking)

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Automatischer Abgleich von Mieteingängen via PSD2-Schnittstelle (Nordigen/GoCardless) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b (Vertragserfüllung), lit. c (GoB / AO Buchführung) |
| **Betroffene Personen** | Mieter (Zahlungssender), Verwaltungsmitarbeiter (Kontoinhaber) |
| **Personenbezogene Daten** | IBAN (maskiert), Name des Absenders, Betrag, Verwendungszweck |
| **Empfänger** | GoCardless/Nordigen (Schnittstellen-Provider) |
| **Drittlandtransfer** | Keiner (Provider innerhalb EU/EWR) |
| **Löschfrist** | 10 Jahre (§ 147 AO) |
| **Technische Maßnahmen** | Übertragung via TLS, Maskierung der IBAN in Logs/API (`maskIban()`), Nordigen-Zugriffstokens nur In-Memory, Mandantentrennung auf Datenbankebene |

---

## Technisch-Organisatorische Maßnahmen (TOMs) — Zusammenfassung

| Maßnahme | Implementierung |
|----------|----------------|
| **Zutrittskontrolle** | Serverbasiert (Hosting-Provider verantwortlich) |
| **Zugangskontrolle** | JWT + bcrypt, Account-Lockout, Rate-Limiting |
| **Zugriffskontrolle** | RBAC (ADMIN, VERWALTER, MITARBEITER), Company-Isolation |
| **Trennungskontrolle** | Mandantentrennung via `companyId` in allen Entitäten |
| **Pseudonymisierung** | UUID-Dateinamen für hochgeladene Dokumente |
| **Verschlüsselung** | AES-256-GCM für Dokumente at-rest, TLS für Transit |
| **Integrität** | Authenticated Encryption (GCM AuthTag), Input-Validierung (Zod) |
| **Verfügbarkeit** | Docker-Deployment, PostgreSQL |
| **Belastbarkeit** | Rate-Limiting, Dateigrössen-Limits |
| **Wiederherstellbarkeit** | PostgreSQL Backups (Provider-abhängig) |
| **Löschkonzept** | Automatische Löschung nach Aufbewahrungsfrist, Cascade-Deletes |
| **Auditierung** | Strukturierte Audit-Logs für Dokumentenzugriffe |

---

> **Hinweis:** Dieses Verzeichnis muss regelmäßig aktualisiert werden, insbesondere bei Einführung neuer Verarbeitungstätigkeiten oder Änderung der technischen Infrastruktur. Mindestens jährliche Überprüfung empfohlen.
