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

Futter ist unter **https://169.58.211.254/futter/** erreichbar, ohne Domain und ohne Tailscale auf den Endgeräten.

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

1. HTTPS-Startseite unter `/futter/` ohne Anmeldedaten erreichbar, aber `/futter/api/state` liefert 401.
2. Anmeldung über echten HTTPS-Link setzt `Secure`, `HttpOnly`, `SameSite=Strict`.
3. Anmeldung/Plan auf zwei getrennten Browser-Sitzungen prüfen; anschließend abmelden.
4. Fremde Origin und veraltete Revision weiterhin abweisen.
5. Bestehende Tailscale-Serve-Routen mit der Sicherung vergleichen.
6. Nutzer öffnet den Link auf dem eigenen iPhone; ein VPS-Browsertest ersetzt diese Abnahme nicht.

## Rollback der Benutzertrennung

Die bisherige Benutzer-Unit und alte Daten unter `~/.local/share/futter` bleiben deaktiviert erhalten. Sie sind nur eine Rückkehrmöglichkeit, kein aktueller zweiter Datenbestand. Vor Rückkehr den Systemdienst stoppen und die aktuelle SQLite-Datenbank konsistent zurücksichern. Beide Dienste nie gleichzeitig auf Port 8788 starten.

## Bekannte Restpunkte

Die aktuellen npm-Audits vom 18.11.2026 melden weder im Entwicklungs- noch im Laufzeitbaum bekannte Schwachstellen. Das zuvor gemeldete picomatch-Advisory wird aktuell nicht mehr gemeldet; daraus folgt weder eine von uns vorgenommene Paketkorrektur noch eine allgemeine Sicherheitsgarantie.

Backups werden von einem getrennten root-eigenen Dienst erstellt und unter `/var/backups/futter` geschützt. Die App kann diese Kopien nicht löschen. Auch dies ersetzt noch kein externes Backup.

## Mehrere Apps auf derselben IP

NGINX entfernt für Futter das Präfix `/futter/` vor der Weiterleitung an Port 8788. Assets und API werden relativ geladen; das Manifest ist auf diesen Pfad begrenzt. Produktions-Sitzungscookies gelten nur unter `/futter/`. `/` leitet auf `/futter/` weiter, andere nicht konfigurierte Pfade liefern 404. Weitere Apps erhalten eigene Location-Blöcke und getrennte Dienste; Pfade allein trennen keine Browser-Ursprünge. Nach dem Wechsel App neu laden und erneut anmelden.

## Login-Bremse

Höchstens drei fehlgeschlagene Login-Anfragen pro IP in einem 15-Minuten-Fenster. Danach HTTP 429 mit Retry-After und Wartezeit im UI; erfolgreiche Logins zählen nicht mit. IP-Erkennung über den Loopback-Proxy: NGINX ersetzt X-Forwarded-For durch die tatsächliche Client-IP. Bestehende Sessions bleiben nutzbar; kein globales Haushalt-Lockout. Zähler liegen im RAM und werden beim Dienst-Neustart zurückgesetzt. Der Schutz begrenzt einzelne IPs, nicht verteilte Angriffe über viele IPs.


## Netzwerkabschottung und Proxy-Limits

- `deploy/futter-egress.nft` nach `/etc/futter/egress.nft` installieren (root, 0600); vor Anwendung `id -u futter` mit der fest eingetragenen UID 999 vergleichen. Bei anderen Hosts UID ausdrücklich anpassen.
- `deploy/futter-egress.service` nach `/etc/systemd/system/futter-egress.service` übernehmen. `futter.service` verlangt diesen Dienst und startet erst nach erfolgreichem Laden der Regeln. Die aktivierte Futter-Unit zieht die Egress-Unit auch beim Boot hoch; kein eigener Enable-Schritt nötig.
- Die nft-Datei aktualisiert atomar ausschließlich die eigene Tabelle `inet futter_egress`. Antworten auf eingehende, etablierte Verbindungen dürfen passieren; alle von UID 999 selbst initiierten IP-Verbindungen werden verworfen/abgewiesen. IPv4 und IPv6 sind erfasst. Das schützt auch lokale Dienste und Metadaten-Endpunkte, nicht jedoch vor dem Abfluss eigener App-Daten über normale HTTP-Antworten im Fall einer kompromittierten App.
- Niemals `flush ruleset` verwenden oder die unveränderte globale `nftables.service` aktivieren: Ihre Standardkonfiguration würde UFW-/Tailscale-Regeln entfernen. Ein Stop der Egress-Unit entfernt absichtlich keine Regeln. Änderungen mit `nft -c -f /etc/futter/egress.nft` prüfen, dann `systemctl reload futter-egress.service`.
- Futter darf nur neue AF_INET-/AF_INET6-Sockets anlegen. Neue Unix-Sockets sind gesperrt, bestehende systemd-Log-FDs bleiben nutzbar. ProtectProc=invisible und zusätzliche Kernel-/Clock-/Hostname-/ABI-Härtungen sind aktiv. Asynchrones scrypt und SQLite unter diesen Einschränkungen getestet.
- `deploy/nginx-limits.conf` als `/etc/nginx/conf.d/futter-limits.conf` in den http-Kontext installieren, zusammen mit der aktualisierten HTTPS-Site. Nach `nginx -t` NGINX neu laden.
- Grenzwerte für `/futter/`: 20 Requests/s je IP (Burst 40); API zusätzlich 5/s (Burst 15); Login zusätzlich 6/min (Burst 5). Login-Regel gilt auch für Groß-/Kleinschreibung und abschließenden Slash. Proxy-Loginlimit zählt anders als die App auch erfolgreiche Anmeldungen mit. Die App behält drei Fehlversuche je IP / 15 Minuten.
- Gleichzeitig höchstens 20 aktive Requests/Verbindungen je IP und 80 insgesamt für Futter. Header-/Body-Timeout 10s, Send-/Keepalive-Timeout 15s. Edge-Limits liefern JSON-429, no-store und Retry-After=10; keine Haushaltsdaten im Fehlertext.
- Prüfskript: `python3 test/nginx-limits.py` (lokales NGINX erforderlich). Verwendet ausschließlich einen isolierten Dummy-Backendprozess und eine separate NGINX-Instanz, keine echten Haushaltsdaten und keine echten Login-Sperren.

### Funktionsprüfung und Rückkehr

Nach Installation NGINX-Login/Logout und normalen Planabruf über HTTPS prüfen, dann fehlgeschlagene Verbindungen unter UID `futter` zu lokalen und externen IP-Zielen mit einem erhöhten Reject-Zähler in der eigenen nft-Tabelle belegen. Ein Timeout allein reicht nicht als Nachweis. Effektive Mounts, UID und Capabilities des echten Dienstes prüfen. Es wurde kein Host-Reboot für diese Änderung durchgeführt; Boot-Abhängigkeit ist konfiguriert und verifiziert.

Vor Änderungen Unit, Site, UFW-Status und nft-Regeln root-geschützt sichern. Im Fehlerfall Futter stoppen, vorherige App-Unit und Site wiederherstellen, den neuen NGINX-Limits-Include nur zusammen mit der referenzfreien alten Site entfernen, daemon-reload ausführen und nginx -t prüfen. Die eigene Egress-Unit stoppen und ausschließlich `inet futter_egress` entfernen, wenn diese Einschränkung ebenfalls zurückgenommen werden soll. Danach NGINX laden und Futter starten; nie fremde Firewall-Tabellen zurücksetzen.

### Mehrere Apps und verbleibende Entscheidungen

Pfad-Trennung ist nur Routing, keine Browser-Isolation. Ein Fehler in einer zweiten App derselben Origin könnte Futter im angemeldeten Browser mitbenutzen. Für eine echte Vertrauensgrenze separate Hostnamen mit hostgebundenen Cookies oder andere IPs verwenden; Ports allein isolieren Cookies nicht. Keine zweite App wurde für diese Härtung veröffentlicht.

SSH-Passwortanmeldung bleibt bis zur Bestätigung eines funktionierenden Schlüsselzugangs unverändert. Externe, verschlüsselte Backups brauchen ein benanntes Ziel; lokale geschützte Sicherungen bleiben aktiv. Keine neue Domain, kein externes Backupziel und kein neues Passwort wurden ohne Vorgabe angelegt.
