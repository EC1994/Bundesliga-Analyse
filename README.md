# Bundesliga Hub ⚽

Modern Bundesliga portal with automatic match/tables synchronization and a persistent community backend.

## Features

- Bundesliga 2026/27 teams
- Match schedule and results via OpenLigaDB
- Automatic table refresh
- Browser refresh of live data every 60 seconds
- News / transfer / injury / lineup UI prepared for additional licensed data providers
- Persistent comments
- 👍 / 👎 voting with server-side counters
- Reply threads
- Responsive mobile/desktop UI

## Run locally

Requirements: Node.js 20+

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Deploy

This is a **Node.js server application**. GitHub stores the source code; it does not run the Node server itself.

A simple deployment path is Render, Railway, Fly.io, or another Node.js host. Use:

- Build: `npm install`
- Start: `npm start`

Set `PORT` automatically if the host provides it.

### Persistent database

The app uses SQLite for the community data. On hosts with ephemeral filesystems, attach persistent storage or replace SQLite with a managed PostgreSQL database before production.

## Automatic data

OpenLigaDB is used for Bundesliga match/table data. Transfers, injuries, news and lineups should be connected only through a suitable/licensed provider. API secrets belong in environment variables, never in GitHub source files.

## GitHub

Create a repository and upload the contents of this folder. Do **not** upload `node_modules`, `.env`, or the SQLite database.

