# Futter-Betrieb auf dem VPS

## Trennung

- Quellcode im Git-Checkout; laufende Kopie unter `~/.local/share/futter/app`.
- Zugangsdaten ausschließlich in `~/.config/futter/server.env`, Modus `0600`, Verzeichnis `0700`.
- Datenbank unter `~/.local/share/futter/app/data/futter.sqlite`; Prozess-Umask `0077`.
- `futter.service` bindet nur an `127.0.0.1:8788`. Benutzer-Lingering erlaubt Betrieb unabhängig von einer SSH-Sitzung.
- Produktion nutzt sichere HTTPS-Cookies. Die Sitzungsspeicherung ist auf 100 Einträge begrenzt und bereinigt abgelaufene Sessions stündlich. Neustarts erfordern erneute Anmeldung, nicht erneute Planung.

## HTTPS ohne Tailscale-App auf den iPhones

Die vorhandene Tailscale-Installation kann mit **Funnel** ausschließlich den zusätzlichen HTTPS-Port **10000** veröffentlichen. Der Port 443 mit OpenClaw und die anderen bestehenden Serve-Routen dürfen nicht veröffentlicht oder zurückgesetzt werden.

Vor einer Änderung `tailscale serve status --json` geschützt sichern. Vor Freigabe muss der authentifizierte Server lokal laufen. Die erste Aktivierung von Funnel erfordert die Freigabe des Tailscale-Administrators über den vom CLI ausgegebenen Setup-Link.

```sh
tailscale funnel --bg --https=10000 --yes http://127.0.0.1:8788
tailscale serve status --json
tailscale funnel status
```

Danach prüfen: nur der neue Host:Port steht in `AllowFunnel`; die bestehenden TCP/Web-Einträge sind unverändert. Keine Verwendung von `serve reset` oder `funnel reset`, da sie andere Apps beeinträchtigen können.

Einzelne Futter-Freigabe deaktivieren:

```sh
tailscale funnel --https=10000 off
```

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
5. Bestehende Serve-Routen mit der Sicherung vergleichen.
6. Nutzer öffnet den Link auf dem eigenen iPhone; ein VPS-Browsertest ersetzt diese Abnahme nicht.
