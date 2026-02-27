# ChemIllusion: IUPAC Rain — Discord Activity

A Discord embedded activity that brings chemical-themed ASCII Tetris to any voice channel. Arrange falling Carbon (C) and Oxygen (O) atoms to match IUPAC molecule targets. Compete with friends and climb the leaderboard.

## Project layout

| Repo | Folder | Purpose |
|------|--------|---------|
| [scottmreed/chem-tetris](https://github.com/scottmreed/chem-tetris) | `smilestetris-discord/` | This repo — Discord Activity |
| [scottmreed/smilestetris](https://github.com/scottmreed/smilestetris) | `smilestetris/` | Standalone itch.io web game |

These are **completely separate codebases and repos**. This folder only contains the Discord Activity version.

## Architecture

```
Browser (Discord iframe)          Cloudflare Pages
  React + Vite frontend    →     /        (static SPA)
  Discord Embedded SDK           /api/token  (Pages Function)

Local dev only:
  robo.js server (port 3003) + cloudflared tunnel → app.mechanismsolver.org
```

- **Frontend**: React + Vite + Tailwind, built to `dist/`
- **Token API**: `functions/api/token.js` — Cloudflare Pages Function, exchanges Discord OAuth codes
- **Multiplayer sync**: `@robojs/sync` via WebSocket (works in local dev; state is local-only on Pages free tier)
- **Deployment**: Cloudflare Pages at `app.mechanismsolver.org`, auto-deploys on push to `main`

## Local development

```bash
npm install

# Terminal 1 — start the robo.js dev server
npm run dev

# Terminal 2 — start the Cloudflare tunnel (fixed URL: app.mechanismsolver.org)
npm run tunnel
```

The tunnel points `https://app.mechanismsolver.org` → `localhost:3003`.
Opening the URL directly in a browser uses mock Discord auth (no real login needed).

## Environment variables

Create `.env` from `.env.example`:

```
DISCORD_CLIENT_ID=        # your Discord application ID
DISCORD_CLIENT_SECRET=    # your Discord application secret (never commit this)
VITE_DISCORD_CLIENT_ID=   # same as DISCORD_CLIENT_ID (baked into frontend at build time)
```

Set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` as Cloudflare Pages secrets via:

```bash
wrangler pages secret put DISCORD_CLIENT_ID --project-name=chem-tetris-discord
wrangler pages secret put DISCORD_CLIENT_SECRET --project-name=chem-tetris-discord
```

Set `VITE_DISCORD_CLIENT_ID` as a GitHub Actions secret (used during the build step).

## Deployment (Cloudflare Pages)

Push to `main` — GitHub Actions builds and deploys automatically via `.github/workflows/deploy.yml`.

Required GitHub secrets:
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Pages Edit permission
- `CLOUDFLARE_ACCOUNT_ID` — find this by running `wrangler whoami`
- `VITE_DISCORD_CLIENT_ID` — Discord application ID

## Discord developer portal

- **Activity URL Mappings → Root**: Prefix `/`, Target `app.mechanismsolver.org`
- **OAuth2 Redirects**: `https://app.mechanismsolver.org`
