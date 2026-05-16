# Cleanup Notes

## Server-Local State
- `apps/api/data/journal.json` is server-local and should be treated as disposable unless the next project needs it.
- Do not commit `.env`, certificate files, or private keys.

## Shutdown Workflow
1. Stop and save `pm2` processes.
2. Stop and disable nginx if the site is being retired.
3. Move or remove server-only files: repo clone, journal data, `.env`, certificates, and nginx site config.
4. Remove DNS records or point them to the next target.
5. Remove Vercel domain bindings and GitHub secrets if they are no longer needed.

## Migration Guidance
- Keep the server if it may be reused for the next project.
- Prefer archiving over deleting when you are unsure.
- If the next project needs durability, migrate the journal layer to SQLite or another database early.

## Security Follow-Up
- Rotate or remove secrets that should not survive the handoff.
- Remove public access paths that are no longer needed.
- Confirm billing/automation tasks are disabled before closing the project.
