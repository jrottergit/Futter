# Sicherheitsstand nach Härtung · 17.11.2026

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

- Entwicklungsabhängigkeit `picomatch@4.0.7`: GHSA-fc5q-39xc-vjpf (ReDoS), im Entwicklungsbaum über Vite, nicht im Produktionsbaum. Zum Prüfzeitpunkt ist auch die neueste Registry-Version 4.0.7 betroffen. Keine erzwungene Vite-Rückstufung; nach verfügbarer kompatibler Korrektur gezielt aktualisieren.
- Backups sind weiterhin lokal auf demselben VPS, nicht extern repliziert.
- Ein gemeinsames Haushaltspasswort, keine getrennten Benutzerkonten oder MFA. Das ist der bestätigte erste Produktumfang.
- Der echte iPhone-Safari-Test bleibt von den automatisierten Chromium-Prüfungen getrennt.
