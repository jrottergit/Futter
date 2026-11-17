# Futter project rules

- This project is `jrottergit/Futter`; do not edit the separate `mealprep` app.
- Production code: `/opt/futter` (root-owned). Service: system-wide `futter.service`, user `futter`. Never run the public app as the assistant/admin user or as its user service.
- Persistent data: `/var/lib/futter`; protected environment: `/etc/futter/server.env`. Preserve both on updates. Never commit credentials, household data, or database files.
- Keep deployment templates synchronized with the real service. Verify actual UID, mount namespace, read-only root and hidden home after sandbox changes; configured options alone are not proof.
- Public ingress is NGINX on the public IPv4 only. Preserve other apps, SSH and Tailscale routes.
- Avoid synchronous expensive password work on requests. Preserve rate limiting, bounded concurrency, CSRF/origin checks, and revision checks.
- Use targeted tests. Live acceptance must not overwrite real meal plans; use isolated databases for write tests.

- Product copy: this is a private utility for a couple, not a marketing site. Use concise functional labels. No slogans, promotional hero sections, decorative taglines or redundant explanatory copy.
