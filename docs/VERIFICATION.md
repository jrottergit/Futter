# Prüfung der ersten Version · 16.11.2026

- `npm test`: 6 von 6 Tests erfolgreich. Werktage/Jahreswechsel/Berlin-Zeitzone, Mengenaggregation, Wiederholungen, Einkaufsstatus bei Mehrbedarf, Rezeptdaten, ungültige Zustände, Anmeldung, CSRF-Abweisung, Revisionenkonflikte und Abmelden.
- `npm run build`: erfolgreich.
- `test/browser.mjs`: erfolgreich in vorhandenem Headless Chromium. Auswahl zweier Gerichte, 300 g Feta aus zwei Rezepten, Abhaken und Persistenz nach Neuladen, Rezeptsuche, Kochanleitung und Dialog. Kein horizontaler Überlauf bei 320, 390, 768 und 1280 px.
- `test/shared-browser.mjs`: erfolgreich mit zwei getrennten Browser-Kontexten gegen isolierte API. Anmeldung, gemeinsamer Plan, geteilter Abhakstatus und Entzug des API-Zugangs nach Abmelden.
- Mobile Bildschirmaufnahme visuell geprüft: [Vorschau](mobile-preview.png).

Die Tests verwenden isolierte Testdaten, keine echten Haushaltsdaten. Kein echter iPhone-Safari-Test und keine Abnahme eines öffentlich erreichbaren privaten HTTPS-Zugangs. Der lokale Portalversuch bot nur Loopback-Zugriff und gilt nicht als Auslieferung an den Nutzer.
