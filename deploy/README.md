# Futter-Betrieb auf dem VPS

## Trennung (gehärteter Betrieb)

- Quellcode im Git-Checkout; laufende, root-eigene Code-Kopie unter `/opt/futter`.
- Systemdienst unter eigenem Benutzer/Gruppe `futter`, keine Login-Shell und keine sudo-Rechte.
- Zugangsdaten ausschließlich in `/etc/futter/server.env`, root-eigen und `0600`; das root-Verzeichnis ist `0700`. Systemd liest die Datei vor dem Benutzerwechsel. Der Dienst erhält die nötigen Werte als Prozessumgebung.
- Datenbank `/var/lib/futter/futter.sqlite`, Backups `/var/backups/futter` (root-eigen, für die App nicht zugänglich); Rechte `0700`/`0600` und Prozess-Umask `0077`.
- `FUTTER_DATA_DIR=/var/lib/futter` setzt den Speicherort. Der Server bindet weiterhin ausschließlich an `127.0.0.1:8788`.
- Systemweite `futter.service`: `ProtectHome=yes`, `ProtectSystem=strict`, `NoNewPrivileges=yes`, private Geräte/Temporärdateien, leere Capability-Liste, Ressourcenlimits und ein eigener Mount-Namespace. Schreibzugriff ist auf das Datenverzeichnis begrenzt.
- Keine Benutzer-Unit für die öffentliche App verwenden: Die ursprüngliche Benutzer-Unit bot hier keine wirksame Dateisystem-Sandbox. Nach jeder Änderung die echten Prozess-UIDs, Mount-Namespace und Mount-Optionen prüfen, nicht nur die Unit-Datei.
- Produktion nutzt sichere HTTPS-Cookies. Sessions sind begrenzt und enden bei Server-Neustart; der Plan bleibt erhalten.

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

Die Vorlagen verwenden `/usr/bin/node`. Für andere Hosts Pfad und Node-Version prüfen.

```sh
sudo systemctl status futter.service
sudo systemctl status futter-backup.timer
sudo journalctl -u futter.service --no-pager -n 30
```

Updates zuerst im Checkout bauen und prüfen. Vor der Aktualisierung einen Datenbank-Backup erstellen, dann Dienst stoppen, `dist`, `src`, `server`, `deploy` und Paketdateien in die laufende Kopie übernehmen, dort `npm ci --omit=dev` ausführen und Dienst starten. `/var/lib/futter` und `/etc/futter/server.env` nicht überschreiben. Den Code root-eigen und für `futter` schreibgeschützt halten. Zugang prüfen; im Fehlerfall die vorherige Code-Kopie zurückspielen.

## Backup und Wiederherstellung

`futter-backup.timer` erstellt täglich ab 03:40 Uhr lokaler Serverzeit mit bis zu zehn Minuten Streuung ein SQLite-konsistentes Backup unter `/var/backups/futter`. Jede Kopie wird mit `PRAGMA integrity_check` geprüft. Der Timer holt verpasste Läufe nach. Erstes Backup wurde manuell geprüft. Es gibt zunächst keine automatische Löschung und keine externe Backup-Kopie.

```sh
sudo systemctl start futter-backup.service
```

Zum Wiederherstellen den Dienst stoppen, das gesamte bisherige Datenverzeichnis zur Rückkehrmöglichkeit umbenennen, ein neues privates Datenverzeichnis anlegen und eine geprüfte Backup-Datei als `futter.sqlite` hineinkopieren. Danach Dienst starten und Anmeldung/Plan prüfen. Währenddessen nicht weiter in die alte Datenbank schreiben.

## Auslieferungsprüfung

1. HTTPS-Startseite ohne Anmeldedaten erreichbar, aber `/api/state` liefert 401.
2. Anmeldung über echten HTTPS-Link setzt `Secure`, `HttpOnly`, `SameSite=Strict`.
3. Anmeldung/Plan auf zwei getrennten Browser-Sitzungen prüfen; anschließend abmelden.
4. Fremde Origin und veraltete Revision weiterhin abweisen.
5. Bestehende Tailscale-Serve-Routen mit der Sicherung vergleichen.
6. Nutzer öffnet den Link auf dem eigenen iPhone; ein VPS-Browsertest ersetzt diese Abnahme nicht.

## Rollback der Benutzertrennung

Die bisherige Benutzer-Unit und alte Daten unter `~/.local/share/futter` bleiben deaktiviert erhalten. Sie sind nur eine Rückkehrmöglichkeit, kein aktueller zweiter Datenbestand. Vor Rückkehr den Systemdienst stoppen und die aktuelle SQLite-Datenbank konsistent zurücksichern. Beide Dienste nie gleichzeitig auf Port 8788 starten.

## Bekannte Restpunkte

Die Entwicklungsabhängigkeit `picomatch@4.0.7` hat das ReDoS-Advisory GHSA-fc5q-39xc-vjpf. Zum Härtungszeitpunkt ist keine neuere Version im Registry veröffentlicht. Keine Produktionsabhängigkeit, nicht in `/opt/futter/node_modules`; der überflüssige Entwicklungsserver wurde beendet. Kein erzwungener Vite-Downgrade. Nach Patch-Veröffentlichung gezielt aktualisieren und Build prüfen.

Backups werden von einem getrennten root-eigenen Dienst erstellt und unter `/var/backups/futter` geschützt. Die App kann diese Kopien nicht löschen. Auch dies ersetzt noch kein externes Backup.
