# Sicherheitsstand nach Härtung · 18.11.2026

## Umgesetzt

- Eigener Linux-Dienstbenutzer `futter` ohne Login-Shell oder sudo; root-eigener Programmcode unter `/opt/futter`.
- Systemdienst statt Benutzer-Dienst. Eigenen Mount-Namespace und schreibgeschütztes Root-Dateisystem am laufenden Prozess geprüft; `/home` ist verborgen. `NoNewPrivileges`, Seccomp, leere Capabilities und Ressourcenlimits sind aktiv.
- Speicher `/var/lib/futter`, private Zugangskonfiguration `/etc/futter/server.env`; bisherige Datenbank konsistent migriert und Inhalte einschließlich Revision verglichen. Alte Daten werden zur Rückkehrmöglichkeit erhalten, aber nicht mehr aktiv verwendet.
- Root-eigene, SQLite-konsistente Backups unter `/var/backups/futter`. Der App-Benutzer kann diesen Sicherungsbereich nicht erreichen. Automatischer Backup-Lauf nach Migration erfolgreich.
- Asynchrone Passwortprüfung mit maximal zwei parallelen Hash-Berechnungen; bestehendes Limit je IP erhalten.
- Die Produktionsinstallation enthält nur Laufzeitabhängigkeiten. Der überflüssige lokale Vite-Entwicklungsserver wurde beendet.

## Prüfergebnisse

- Acht von acht Kern-/API-Tests einschließlich begrenzter paralleler Passwortprüfungen erfolgreich.
- Isolierter Zwei-Sitzungen-Browsertest: gemeinsamer Plan und Einkaufsstatus erfolgreich.
- Live-HTTPS-Prüfung in zwei getrennten Browser-Kontexten: Login, Secure-/HttpOnly-/SameSite-Cookies, fünf Datumskarten, Rezeptsuche, Einkaufsansicht, authentifizierte Ablehnung fremder Schreibursprünge und Logout erfolgreich. Keine Schreibtests auf echten Haushaltsdaten.
- Neuer Backup-Dienst erfolgreich; App-Zugriff auf Code-Schreiben, Julians Zugangsdaten und geschützte Backups abgewiesen.
- Systemd bewertet den Dienst nun mit 3,6 statt 9,0. Das bewertet nur die Prozesshärtung und ist keine Gesamtbewertung der App-Sicherheit.

## Offene Punkte

- Aktuelle npm-Audits melden keine bekannten Schwachstellen. Das zuvor beobachtete picomatch-Advisory wird aktuell nicht mehr gemeldet; keine allgemeine Sicherheitsgarantie.
- Backups sind weiterhin lokal auf demselben VPS, nicht extern repliziert.
- Ein gemeinsames Haushaltspasswort, keine getrennten Benutzerkonten oder MFA. Das ist der bestätigte erste Produktumfang.
- Der echte iPhone-Safari-Test bleibt von den automatisierten Chromium-Prüfungen getrennt.

## Ergänzende Härtung vom 18.11.2026

- Eigene nft-Tabelle sperrt neue IP-Verbindungen unter dem App-Benutzer; Antworten an den NGINX-Proxy bleiben erlaubt. Lokale Dienste, IPv6 und Metadaten-IP als blockiert verifiziert. Anwendung startet nur nach aktivierter Egress-Regel.
- Neue AF_UNIX-Sockets gesperrt, ProtectProc und weitere geeignete systemd-Schutzoptionen aktiviert. Tatsächliche Sandbox und laufende Anmeldung nach Änderung geprüft.
- Vorgelagerte NGINX-Limits für alle Futter-Anfragen, API und Login, zusätzlich Verbindungsgrenzen und kurze Timeouts. Isolierte Bursttests bestanden; keine Testsperren echter Logins erzeugt.
- Gemeinsame Browser-Origin bei mehreren Slash-Apps bleibt eine bewusste Einschränkung, keine Sicherheitsisolation. Vor weiteren Apps Vertrauensgrenzen klären.
- Öffentliches SSH mit Passwort bleibt bis bestätigtem Schlüsselzugang unverändert. Externes Backupziel steht noch aus. Keine OpenClaw-Updates oder unbestellten Domain-/Zugangsumstellungen vorgenommen.
