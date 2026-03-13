# Server Security & Hardening

Diese Anleitung hilft dir, den Ubuntu-Server gegen Angriffe abzusichern.

## 1. SSH-Key-Authentifizierung
Nutze niemals nur Passwörter für SSH.

1. **Key erstellen** (auf deinem lokalen PC): `ssh-keygen -t ed25519`.
2. **Key auf Server kopieren**: `ssh-copy-id root@DEINE-IP`.
3. **Passwort-Login deaktivieren**:
   ```bash
   nano /etc/ssh/sshd_config
   # Ändere: PasswordAuthentication no
   # Ändere: PermitRootLogin prohibit-password
   systemctl restart ssh
   ```

## 2. Firewall (UFW)
Falls du nicht die Hetzner-Firewall nutzt, verwende die interne:

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## 3. Fail2Ban
Schützt vor Brute-Force-Angriffen auf SSH.

```bash
apt install fail2ban -y
systemctl enable fail2ban
systemctl start fail2ban
```

## 4. Automatische Sicherheits-Updates
Installiert kritische Patches automatisch.

```bash
apt install unattended-upgrades -y
dpkg-reconfigure -plow unattended-upgrades # Wähle "Ja"
```

## 5. SSH-Port ändern (Dringend empfohlen)
Ändert man den Standard-Port 22 auf z. B. 2222, reduziert das Hintergrundrauschen (automatisierte Bots, die massenhaft Port 22 scannen) in den Logs massiv.

1. `/etc/ssh/sshd_config` öffnen und `Port 22` auf `Port 2222` ändern.
2. In der UFW Firewall freigeben: `ufw allow 2222/tcp`
3. Alten Port schließen: `ufw delete allow 22/tcp`
4. SSH-Service neu starten: `systemctl restart ssh`

## 6. Audit & Monitoring
Prüfe gelegentlich die Logs von Fail2Ban, um zu sehen, welche IPs gebannt wurden:
```bash
fail2ban-client status sshd
```
Für den Produktivbetrieb empfiehlt es sich zudem, die Server-Logs (Syslog / auth.log) an einen externen, manipulationssicheren Speicherort (z.B. über Promtail/Loki oder Datadog) zu senden.
