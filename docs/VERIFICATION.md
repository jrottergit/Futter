# Prüfung der ersten Version · 16.11.2026

- `npm test`: 6 von 6 Tests erfolgreich. Werktage/Jahreswechsel/Berlin-Zeitzone, Mengenaggregation, Wiederholungen, Einkaufsstatus bei Mehrbedarf, Rezeptdaten, ungültige Zustände, Anmeldung, CSRF-Abweisung, Revisionenkonflikte und Abmelden.
- `npm run build`: erfolgreich.
- `test/browser.mjs`: erfolgreich in vorhandenem Headless Chromium. Auswahl zweier Gerichte, 300 g Feta aus zwei Rezepten, Abhaken und Persistenz nach Neuladen, Rezeptsuche, Kochanleitung und Dialog. Kein horizontaler Überlauf bei 320, 390, 768 und 1280 px.
- `test/shared-browser.mjs`: erfolgreich mit zwei getrennten Browser-Kontexten gegen isolierte API. Anmeldung, gemeinsamer Plan, geteilter Abhakstatus und Entzug des API-Zugangs nach Abmelden.
- Mobile Bildschirmaufnahme visuell geprüft: [Vorschau](mobile-preview.png).

Die Tests verwenden isolierte Testdaten, keine echten Haushaltsdaten. Kein echter iPhone-Safari-Test und keine Abnahme eines öffentlich erreichbaren privaten HTTPS-Zugangs. Der lokale Portalversuch bot nur Loopback-Zugriff und gilt nicht als Auslieferung an den Nutzer.

## VPS-Einrichtung

- Isolierte Betriebskopie, privates Environment, automatischer Dienststart und täglicher Backup-Timer eingerichtet.
- 7/7 Unit-/API-Tests einschließlich Produktionseinstellung für sichere HTTPS-Cookies erfolgreich.
- Installierter Produktionsdienst: Anmeldung, geschützter Zugriff, Cookie-Attribute und Abmelden über lokale simulierte HTTPS-Proxy-Header geprüft.
- Erstes SQLite-Backup konsistent erstellt und Integrität geprüft.
- Bestehende Tailscale-Konfiguration nach Einrichtung identisch zur vorherigen Sicherung.
- Öffentliche Funnel-Freigabe noch nicht erfolgt: Tailnet benötigt Aktivierung durch den Administrator. Kein externer Erreichbarkeitsnachweis und noch kein ausgelieferter iPhone-Web-Link.

## Direkter HTTPS-IP-Zugang

- Live-Adresse: https://169.58.211.254, ohne Domain/Tailscale am Endgerät.
- Öffentliche IP als lokale VPS-Adresse bestätigt. NGINX bindet nur diese IPv4-Adresse; die bestehenden Tailscale-Routen sind weiterhin identisch zur Sicherung.
- Let's-Encrypt-Validierung zuerst gegen Staging, danach produktives IP-Zertifikat mit SAN `IP Address:169.58.211.254`. HTTP-01-Validierung durch die Zertifizierungsstelle erfolgreich.
- Produktionszertifikat bei Einrichtung gültig bis 23.11.2026. Erneuerungs-Probelauf mit `--dry-run --run-deploy-hooks --no-random-sleep-on-renew` erfolgreich; Konfigurationsprüfung und Reload ebenfalls erfolgreich.
- Root-Systemd-Timer prüft zweimal täglich. Regulärer Erneuerungsdienst manuell ausgeführt: `Result=success`, `ExecMainStatus=0`.
- Browserprüfung über die HTTPS-IP ohne deaktivierte Zertifikatsprüfung: Anmeldung in zwei getrennten Sitzungen, Secure-/HttpOnly-/SameSite-Cookies, Gerichteauswahl, 300 g Feta aus zwei Rezepten, geteilter Abhakstatus, Persistenz nach Neuladen, mobile Breite und Abmelden erfolgreich. Testplan anschließend revisionsgeprüft wieder geleert.
- Abschließendes HTTPS-GET: 200, TLS-Prüfergebnis 0; geschützte API ohne Anmeldung: 401.
- Echter iPhone-Safari-Test und Bestätigung vom Nutzergerät stehen weiterhin aus. Der VPS-Browsertest allein beweist nicht die Auslieferung an dieses Endgerät.
