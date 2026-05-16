# Deployment Notes

## Runtime Layout
- ECS Ubuntu server hosts the application.
- `pm2` runs the API process on port `4000`.
- `nginx` serves static frontend files and proxies `/api` and `/health` to `127.0.0.1:4000`.

## Important Files
- `deploy/nginx/gyx.luxe.conf`
- `apps/web/vercel.json`
- `apps/api/src/app.ts`

## Production Flow
1. Build the workspace with `pnpm run build`.
2. Copy `apps/web/dist` to the nginx web root.
3. Keep the API running under `pm2`.
4. Reload nginx after config or asset changes.

## Proxy Rules
- Keep production fetches on relative `/api` paths.
- Use nginx as the TLS terminator.
- Keep `trust proxy` enabled in Express so client IP and rate limits work behind nginx.

## Vercel Proxy Behavior
- Vercel is optional and acts as a preview/edge path.
- `apps/web/vercel.json` rewrites `/api/*` and `/health` to the ECS origin.
- If the domain moves away from Vercel, the ECS/nginx path remains the source of truth.
