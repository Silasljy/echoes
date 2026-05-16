---
name: build-handoff
description: 'Use when transferring this project’s build, deploy, and maintenance workflow to a new agent or a new project. Covers pnpm monorepo structure, ECS + nginx deployment, Vercel proxy behavior, data persistence, cleanup, and migration notes.'
argument-hint: 'handoff summary or target project name'
user-invocable: true
---

# Build Handoff

## When to Use
- A new agent needs to continue work from this project and should borrow the build/deploy pattern.
- You need a concise, accurate handoff of how this repo is built, deployed, and cleaned up.
- You want to reuse the same architecture in a new project: pnpm monorepo, React/Vite frontend, Express API, ECS + nginx hosting, and Vercel as a proxy/preview path.

## What This Project Uses
- Monorepo managed by `pnpm` with workspaces: `apps/web`, `apps/api`, `packages/shared`.
- Frontend: React + Vite + TypeScript.
- Backend: Express + TypeScript.
- Persistence: local JSON journal storage in `apps/api/data/journal.json`.
- Runtime deployment: ECS Ubuntu server, `pm2` for API process management, `nginx` for HTTPS and reverse proxy.
- External LLM: DeepSeek API via backend service wrapper.
- Optional preview/edge route: Vercel `vercel.json` rewrites `/api/*` and `/health` to the ECS origin.

## Core Files to Inspect First
- `apps/web/src/services/api.ts`
- `apps/web/vercel.json`
- `apps/api/src/app.ts`
- `apps/api/src/store/journalStore.ts`
- `deploy/nginx/gyx.luxe.conf`
- `README.md`

## Progressive Loading
- Read `references/build.md` for install, build, and frontend/backend entry points.
- Read `references/deploy.md` for ECS, `pm2`, nginx, TLS, and Vercel proxy behavior.
- Read `references/cleanup.md` for shutdown, DNS, secrets, and migration steps.

## Handoff Checklist
- [ ] Confirm the source repo is clean and the target branch is correct.
- [ ] Verify the build command succeeds.
- [ ] Verify nginx serves HTTPS and proxies `/api` correctly.
- [ ] Verify any server-local state is either migrated, archived, or intentionally discarded.
- [ ] Verify DNS points to the intended target or is removed for retirement.
- [ ] Remove or rotate secrets that should not survive the handoff.

## Reference Outcome
Use this skill as the compact playbook for how the previous project was structured and deployed, so the next agent can reuse the pattern instead of rediscovering it from scratch.
