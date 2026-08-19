# Bundesliga Hub – final GitHub version

A responsive Bundesliga portal with menu-based sections, club pages, player profiles, automatic live data, persistent community and a multi-source news layer.

## Main sections
- Home
- Live
- News
- Transfers
- Verletzungen
- Aufstellungen
- Tabelle
- Vereine
- Spieler

## Data architecture
- OpenLigaDB fallback for Bundesliga matches/table
- API-Football adapter for live scores, teams, squads, players, transfers, injuries and lineups when `SPORTS_API_KEY` is configured
- RSS/Atom aggregation for explicitly configured permitted feeds
- SQLite for comments, votes, replies and cached normalized data
- no API secrets in the frontend

API-Football documents live fixtures, lineups, players, transfers and injuries; its live fixture data is intended for frequent polling. It also returns player photos and team data. See the provider documentation before production use.

## Run
Node.js 20+
```bash
npm install
npm start
```
Open http://localhost:3000

## GitHub
Upload the repository contents. Never commit `.env` or the SQLite database.

## Production
Use a persistent database/volume and HTTPS. Set `SPORTS_API_KEY` on the hosting platform. For news, configure only feeds whose terms/licensing permit automated retrieval. The app stores headlines, short excerpts, source URLs and metadata rather than copying full articles.
