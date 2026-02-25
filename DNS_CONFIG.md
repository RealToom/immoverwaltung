# DNS & E-Mail Konfiguration

Um Mahnungen und Benachrichtigungen zuverlässig zu versenden, muss deine Domain korrekt konfiguriert sein.

## 1. Basis-Records (Webseite)
Diese Records verbinden deine Domain mit dem Server.

| Typ | Host | Wert | Ziel |
| :--- | :--- | :--- | :--- |
| **A** | @ | DEINE-SERVER-IP | Hauptdomain |
| **A** | www | DEINE-SERVER-IP | Subdomain |
| **AAAA** | @ | DEINE-IPV6 | (Falls vorhanden) |

## 2. E-Mail Zustellbarkeit (Anti-Spam)
Ohne diese Einträge landen System-Mails (z. B. Mahnungen) oft im Spam-Ordner deiner Mieter.

### SPF (Sender Policy Framework)
Legt fest, welche Server Mails für deine Domain senden dürfen.
- **Typ**: `TXT`
- **Host**: `@`
- **Wert**: `v=spf1 mx ip4:DEINE-SERVER-IP -all`

### DKIM (DomainKeys Identified Mail)
Signiert E-Mails kryptografisch.
- Wird meist von deinem E-Mail-Provider (z. B. Gmail, Outlook, MailerSend) bereitgestellt.
- Kopiere den bereitgestellten `TXT`-Record in deine DNS-Settings.

### DMARC
Erklärung, was bei fehlerhaftem SPF/DKIM passieren soll.
- **Typ**: `TXT`
- **Host**: `_dmarc`
- **Wert**: `v=DMARC1; p=quarantine; adkim=r; aspf=r`

## 3. MX Records
Nur nötig, wenn du E-Mails auf dieser Domain *empfangen* willst (z. B. für das integrierte Postfach).
- Setze die MX-Records deines Providers (z. B. `10 mail.dein-provider.de`).
