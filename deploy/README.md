# Futter-Betrieb auf dem VPS

## Trennung

- Quellcode im Git-Checkout; laufende Kopie unter `~/.local/share/futter/app`.
- Zugangsdaten ausschließlich in `~/.config/futter/server.env`, Modus `0600`, Verzeichnis `0700`.
- Datenbank unter `~/.local/share/futter/app/data/futter.sqlite`; Prozess-Umask `0077`.
- `futter.service` bindet nur an `127.0.0.1:8788`. Benutzer-Lingering erlaubt Betrieb unabhängig von einer SSH-Sitzung.
- Produktion nutzt sichere HTTPS-Cookies. Die Sitzungsspeicherung ist auf 100 Einträge begrenzt und bereinigt abgelaufene Sessions stündlich. Neustarts erfordern erneute Anmeldung, nicht erneute Planung.

## HTTPS direkt über die öffentliche IP

Futter ist unter **https://169.58.211.254** erreichbar, ohne Domain und ohne Tailscale auf den Endgeräten.

- NGINX bindet ausschließlich an `169.58.211.254:80` und `169.58.211.254:443`. Bestehende Tailscale-Listener bleiben unverändert.
- HTTP leitet auf HTTPS um, ausgenommen `/.well-known/acme-challenge/` für Zertifikatsvalidierung.
- Die UFW-Regeln erlauben nur TCP 80/443 auf `eth0` mit Ziel `169.58.211.254`. SSH-Regeln sind unverändert.
- NGINX leitet nur an den lokalen Futter-Port 8788 weiter und überschreibt die Forwarded-Header. OpenClaw und andere Apps werden nicht öffentlich weitergeleitet.
- IP-Zertifikat von Let's Encrypt (Profil `shortlived`, rund sechs Tage Gültigkeit), Certbot 5.10 in eigener root-verwalteter Umgebung unter `/opt/futter-certbot`.
- Zertifikat und privater Schlüssel liegen ausschließlich unter `/etc/letsencrypt/live/futter-ip/` und niemals im Git.
- `futter-cert-renew.timer` prüft zweimal täglich mit zeitlicher Streuung. Bei Erneuerung prüft der root-eigene Hook `/usr/local/sbin/futter-reload-nginx` die Konfiguration und lädt NGINX neu.
- Ursprüngliche NGINX- und UFW-Konfiguration wurden unter `/var/backups/futter-setup/` gesichert. Die Tailscale-Funnel-Variante wurde nicht aktiviert.

Vorlagen: `nginx-http.conf`, `nginx-https.conf`, `futter-cert-renew.service`, `futter-cert-renew.timer`, `reload-nginx.sh`.

```sh
sudo nginx -t
sudo systemctl status nginx futter-cert-renew.timer
sudo /opt/futter-certbot/bin/certbot certificates --cert-name futter-ip
sudo /opt/futter-certbot/bin/certbot renew --cert-name futter-ip --dry-run --run-deploy-hooks --no-random-sleep-on-renew
```

Ein Wechsel von einem NGINX-Wildcard-Listener auf eine bestimmte lokale IP benötigt gegebenenfalls einen Neustart statt nur Reload, da der alte Listener die neue Bindung blockiert. Nach jeder Listener-Änderung `ss -ltn` und die wirklichen HTTP-Antworten prüfen; ein erfolgreicher `nginx -t` allein beweist keine übernommene Konfiguration.

## Relevante Let’s-Encrypt-Dokumentation

- https://letsencrypt.org/2026/03/11/shorter-certs-certbot/
- IP-Zertifikate werden über `certonly --webroot --required-profile shortlived --ip-address IP` bezogen; NGINX liest die Dateien explizit. Vor erster Produktion wurde der Ablauf gegen Staging geprüft.

## Systemd und Updates

Die Vorlagen verwenden die auf diesem VPS vorhandene Node-Installation. Für andere Hosts `ExecStart` anpassen.

```sh
systemctl --user status futter.service
systemctl --user status futter-backup.timer
journalctl --user -u futter.service --no-pager -n 30
```

Updates zuerst im Checkout bauen und prüfen. Vor der Aktualisierung einen Datenbank-Backup erstellen, dann Dienst stoppen, `dist`, `src`, `server`, `deploy` und Paketdateien in die laufende Kopie übernehmen, dort `npm ci --omit=dev` ausführen und Dienst starten. `data` und `server.env` nicht überschreiben. Zugang prüfen; im Fehlerfall die vorherige Code-Kopie zurückspielen.

## Backup und Wiederherstellung

`futter-backup.timer` erstellt täglich ab 03:40 Uhr lokaler Serverzeit mit bis zu zehn Minuten Streuung ein SQLite-konsistentes Backup unter `~/.local/share/futter/backups`. Jede Kopie wird mit `PRAGMA integrity_check` geprüft. Der Timer holt verpasste Läufe nach. Erstes Backup wurde manuell geprüft. Es gibt zunächst keine automatische Löschung und keine externe Backup-Kopie.

```sh
systemctl --user start futter-backup.service
```

Zum Wiederherstellen den Dienst stoppen, das gesamte bisherige Datenverzeichnis zur Rückkehrmöglichkeit umbenennen, ein neues privates Datenverzeichnis anlegen und eine geprüfte Backup-Datei als `futter.sqlite` hineinkopieren. Danach Dienst starten und Anmeldung/Plan prüfen. Währenddessen nicht weiter in die alte Datenbank schreiben.

## Auslieferungsprüfung

1. HTTPS-Startseite ohne Anmeldedaten erreichbar, aber `/api/state` liefert 401.
2. Anmeldung über echten HTTPS-Link setzt `Secure`, `HttpOnly`, `SameSite=Strict`.
3. Anmeldung/Plan auf zwei getrennten Browser-Sitzungen prüfen; anschließend abmelden.
4. Fremde Origin und veraltete Revision weiterhin abweisen.
5. Bestehende Tailscale-Serve-Routen mit der Sicherung vergleichen.
6. Nutzer öffnet den Link auf dem eigenen iPhone; ein VPS-Browsertest ersetzt diese Abnahme nicht.
