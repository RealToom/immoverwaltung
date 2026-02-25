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

## 5. SSH-Port ändern (optional)
Ändert man den Standard-Port 22 auf z. B. 2222, reduziert das Hintergrundrauschen (automatisierte Bots) in den Logs massiv.
In `/etc/ssh/sshd_config` den `Port` ändern und in der Firewall freigeben.
