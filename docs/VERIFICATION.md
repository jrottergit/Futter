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
