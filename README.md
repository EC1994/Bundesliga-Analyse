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


## Vereinsdaten & Spielerbilder

Das Vereins-Untermenü ist jetzt eingebaut. Die Vereinsseiten laden Spieler dynamisch über `/api/team/:team`.

OpenLigaDB liefert Teams, Spielplan und Tabelle, aber keine vollständigen Spielerprofile/Spielerfotos. citeturn0search0turn0search6
Deshalb ist die Spieler-/Fotoebene als Provider-Adapter vorbereitet. Für einen vollständigen automatischen Kader mit Spielerbildern müssen `SPORTS_API_URL` und `SPORTS_API_KEY` mit einem passenden, lizenzierten Anbieter gesetzt werden. Der API-Key gehört ausschließlich in die Server-Umgebung, niemals ins Frontend oder Repository.

## Multi-Source-Aggregator

The project now contains a source registry and an aggregation layer:
- source trust weights
- normalized headlines
- duplicate/cross-source clustering
- confidence score based on independent sources
- sync logs
- `/api/news`
- `/api/sync`
- hourly background synchronization

Only feeds explicitly configured in `sources.json` are read. Add the publisher's permitted RSS/Atom URL in the `feed` field (or connect an API adapter). The app stores title, short excerpt, URL, timestamp and source metadata—not full articles.

For production, verify each publisher's robots.txt, terms and licensing before enabling a feed. Official/primary sources get higher trust than secondary reports. This avoids treating a rumor as confirmed merely because it appears on one site.

Suggested data hierarchy:
1. Official Bundesliga/DFL and official club announcements
2. Reuters / established sports media
3. Specialized football data providers
4. Transfer/rumor reporting, clearly labeled as rumor

The current official Bundesliga transfer center confirms that the 2026 summer window covers the Bundesliga's 18 clubs. OpenLigaDB provides match/table API data, while API-Football provides player, transfer, injury, lineup and related endpoints. 
