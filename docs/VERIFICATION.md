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

## Erweiterungen: Tageswechsel, manuelle Artikel, Zutaten und Snacks

- 13/13 Kern-/API-Tests erfolgreich; Produktionsbuild erfolgreich.
- Legacy-Migration v1/v2 nach v3, Datum einschließlich Sommer-/Winterzeit, Entfernen vergangener Gerichte, serverseitige Bereinigung, Ablehnung veralteter Schreibstände und Zutatenvalidierung geprüft.
- Isolierter Zwei-Geräte-Browserlauf: manuelle Artikel hinzufügen, Kategorie ändern, abhaken, löschen und Text sicher darstellen; Tageswechsel Freitag→Samstag sowie Samstag→Sonntag bei unverändertem Werktagsfenster geprüft.
- Separater Browserlauf: vier neue Gerichte, Asia-Rezept mit zwei Zutaten, keine Kochanleitung, Zutaten ändern/ergänzen/entfernen, gemeinsame Persistenz und aktualisierte Einkaufsmengen, Snack-Auswahl und Kategorien geprüft. Frei editierte HTML-artige Zutatennamen werden als Text dargestellt, nicht als HTML ausgeführt.
- Mobile Breiten 320/390 px ohne horizontalen Überlauf geprüft.
- Vor jeder Live-Migration konsistente Datenbank- und Code-Sicherungen erstellt. Migrierter Inhalt entspricht exakt dem vorab berechneten Zielzustand; SQLite-Integrität erfolgreich geprüft.
- Live-HTTPS-Browserprüfung nach Veröffentlichung: Anmeldung, fünf Tage, manuelles Formular und Kategorien, alle sechs Snack-Optionen, zwölf Rezeptkarten und Zutateneditor, anschließend Abmelden. Keine Schreibtests an echten Haushaltsdaten.

## Path hosting (/futter/)

- Build and all 13 core/API tests passed.
- `FUTTER_CHROMIUM=<installed chromium> node test/subpath-browser.mjs`: isolated browser writes and rendering under `/futter/`, at 320/390/1024px.
- Live HTTPS verified login/logout, secure HttpOnly cookie path `/futter/`, protected API, manifest scope, assets, root redirect and 404 for unconfigured paths. No live household writes. Existing service, database and TLS renewal unchanged.

## Login rate limit

14/14 tests passed. Three failed logins block further logins (including the correct password) with HTTP 429 and Retry-After <=900 seconds; successful logins do not consume the limit. Forged forwarding headers do not bypass the direct-app limiter. Live prefixed HTTPS login/logout and advertised rate policy q=3/w=900 verified without failed live attempts or household writes.

## Additional service/network hardening (18.11.2026)

- Isolated stricter systemd runtime: SQLite, asynchronous scrypt and local HTTP passed; newly created Unix sockets denied.
- Isolated NGINX login/API bursts: normal requests pass; case/trailing-slash login variants share the limit; rejected requests return JSON 429 + Retry-After + no-store.
- Live HTTPS login/logout and authenticated views passed without household writes after installing the new service and firewall rules.
- UID 999 connections to local other-app/gateway ports, public HTTP, IPv6 loopback and metadata IP failed, each with an increment of the dedicated nft reject counter. IPv6 may time out rather than returning immediate errno; the counter confirmed the relevant rule.
- Other nft tables and the original UFW policy preserved. Repeated egress-unit reload retained exactly one owned ruleset. Active app UID 999, CapEff=0, NoNewPrivs=1, Seccomp=2, read-only root and hidden home verified. Boot ordering requires the egress unit; no full reboot was performed.

- Two targeted Ubuntu security updates installed without removals or host reboot: needrestart 3.6-7ubuntu4.6 and libgstreamer1.0-0 1.24.2-1ubuntu0.2. PackageKit restarted only after confirming no active transactions. apt-get check / dpkg --audit clean; no reboot marker. Snap has no pending refresh; Homebrew reports no outdated packages against its existing local catalog.
