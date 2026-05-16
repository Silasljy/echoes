# Build Notes

## Install
Run from the workspace root:

```bash
pnpm install
```

## Build

```bash
pnpm run build
```

## Local Development

```bash
pnpm -F api dev
pnpm -F web dev
```

## Key Build Assumptions
- `apps/web/src/services/api.ts` uses `http://localhost:4000` locally and `/api` in production.
- The frontend is built with Vite and outputs `apps/web/dist`.
- The backend is built with TypeScript and runs separately from the frontend.
- Shared types live in `packages/shared` and are compiled as part of the workspace build.
