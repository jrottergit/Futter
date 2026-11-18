# Futter

Abendessen für zwei, ohne langes Überlegen: die nächsten fünf Werktage planen, ein Gericht wählen und die automatisch zusammengeführte Einkaufsliste abhaken.

## Erste Version

- Fünf Werktage ab heute (Zeitzone Europa/Berlin), freie Tage erlaubt.
- Zwölf schnelle Rezepte, überwiegend veggie, mit editierbaren Zutaten für zwei Personen; ohne Kochanleitungen.
- Rezeptsuche und Veggie-/Vegan-Filter.
- Einkaufsliste nach Warengruppe mit Mengenaddition und gespeichertem Abhakstatus. Mehrbedarf setzt das entsprechende Häkchen zurück.
- Mobile Oberfläche mit Dialogen und einer unteren Navigation.
- Gemeinsamer Haushalt: Anmeldung mit einem Haushaltspasswort, Session-Cookies, serverseitige SQLite-Speicherung und Aktualisierung auf dem zweiten Gerät innerhalb von etwa zehn Sekunden.
- Revisionsprüfung verhindert stilles Überschreiben bei gleichzeitigen Änderungen. Eine abgelehnte Auswahl muss mit dem aktuellen Stand erneut vorgenommen werden.

## Lokal ausprobieren

Node.js ab 22.13 erforderlich (SQLite-Unterstützung).

```sh
npm ci
npm run dev
```

Ohne API startet eine **lokale Vorschau**. Ihr Zustand liegt ausschließlich im Browser, ist nicht geteilt und wird nicht automatisch auf den Server übertragen.

### Gemeinsamen Haushalt lokal starten

`.env.example` nach `.env` kopieren. Ein eigenes Passwort mit mindestens 16 Zeichen und einen zufälligen Session-Schlüssel mit mindestens 32 Zeichen eintragen. Die Datei ist von Git ausgeschlossen. Ein Schlüssel lässt sich mit `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` erzeugen. Das gleiche Haushaltspasswort gilt für beide Personen.

```sh
npm run build
npm start
```

Die vollständige App läuft dann auf `http://127.0.0.1:8788`. Für Oberflächenentwicklung kann Vite parallel laufen; `/api` wird an Port 8788 weitergeleitet.

## Privater Online-Zugang

Der VPS-Dienst und tägliche Backups sind eingerichtet. Futter ist ohne Tailscale unter **https://169.58.211.254/futter/** per gültigem HTTPS-IP-Zertifikat erreichbar. Betriebsanleitung: [deploy/README.md](deploy/README.md).

Für Zugriff über einen Web-Link muss ein HTTPS-Reverse-Proxy vor dem Node-Server stehen. Produktion mit `NODE_ENV=production` starten: Cookies werden dann nur über HTTPS gesendet. Der Server bindet ausschließlich an Loopback; als Proxy wird nur Loopback vertraut. Der Proxy muss den ursprünglichen Host und `X-Forwarded-Proto: https` korrekt übermitteln und eingehende Forwarded-Header überschreiben.

- Sitzungen liegen für diesen einzelnen Haushalt im Arbeitsspeicher. Nach Server-Neustart ist eine erneute Anmeldung nötig; der Plan bleibt in SQLite erhalten.
- SQLite-Dateien unter `data/` (lokal) bzw. `/var/lib/futter` (VPS) und Zugangskonfiguration dürfen nicht öffentlich ausgeliefert oder ins Git aufgenommen werden. Für den produktiven Betrieb sind persistentes Datenverzeichnis und SQLite-konsistente Backups einzurichten.
- Anmeldeversuche sind begrenzt; Schreibzugriffe prüfen den Ursprung. Keine öffentliche Registrierung.
- Offline wird kein gemeinsamer Schreibzugriff vorgetäuscht: fehlgeschlagene Änderungen werden gemeldet und müssen wiederholt werden. Es gibt noch keinen Service Worker für einen Offline-Kaltstart.
- Manifest und SVG-Icon sind vorhanden. Vollständige iOS-Home-Screen-Icons und Abnahme auf einem echten iPhone stehen aus.

## Prüfungen

```sh
npm test
npm run build
# Einmalig für Browserprüfungen:
npx playwright install chromium
# Gegen laufendes npm run dev (frischer Vorschau-Speicher):
npm run test:browser
# Startet eine eigene isolierte API und zwei Browser-Sitzungen:
npm run test:shared
```

Optional: `FUTTER_CHROMIUM` setzt den Pfad eines vorhandenen Chromium-Browsers. `FUTTER_TEST_URL` ändert die Zieladresse des Vorschautests.

Produktentscheidungen und Ablauf: [docs/PRODUCT_PLAN.md](docs/PRODUCT_PLAN.md).

Der produktive Systemdienst läuft unter einem eigenen eingeschränkten Benutzer, mit root-eigenem Code und geschütztem Home-Verzeichnis. Passwortprüfungen laufen asynchron und mit begrenzter Parallelität.

Aktueller Sicherheitsstand und verbleibende Punkte: [docs/SECURITY.md](docs/SECURITY.md).

## Tageswechsel, eigene Artikel und Rezeptzutaten

- Berliner Datum: vergangene Planeinträge werden beim Start, auf API-Zugriff und spätestens beim minütlichen Serverlauf entfernt. Die Oberfläche aktualisiert sich regelmäßig sowie beim Zurückkehren in den Tab.
- Zutaten für vergangene Gerichte verschwinden aus der abgeleiteten Einkaufsliste, soweit sie nicht weiterhin gebraucht werden. Der Rezeptkatalog wird nicht gelöscht.
- Manuelle Artikel: freie Texte und Kategorien, nachträgliches Umkategorisieren, Abhaken und Löschen. Offene Artikel bleiben erhalten; am Vortag oder früher gekaufte Artikel werden entfernt (auch am Wochenende).
- Zutaten pro Rezept können geändert, ergänzt und entfernt werden. Mengenänderungen aktualisieren die Einkaufsliste. Bestehende Häkchen für geänderte Mengen werden nicht blind übernommen.
- Einkaufsliste: „🚨 SNAAACKS!“ mit Keksen, Schokobons, Chips, Nüssen, Schoki und Salat. Noch offene gleiche Snack-Einträge werden nicht doppelt ergänzt.
- Neu im Katalog: Griechischer Salat, Linsensalat, Hummus-Pilz-Schinken Baguette, Asia-Rote Linsen. Für Asia-Rote Linsen sind genau eine Tüte Asiagemüse mit Kokos und eine Packung rote Linsen hinterlegt.
- Gespeicherte Formate v1/v2 werden kontrolliert nach v3 übernommen. Veraltete Schreibzugriffe werden mit 409 abgewiesen, damit ältere Browser keine neuen Felder überschreiben. Nach dem Update die Seite neu laden.

Zusätzliche isolierte Browserprüfungen: `npm run test:calendar` und `npm run test:recipes`. Diese starten eigene Datenbanken und verändern keine Haushaltsdaten.
