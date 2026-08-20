# Bundesliga Hub – iPhone Edition

**News is the start page.** Transfers and injuries are integrated into the News feed and filterable.

Bottom navigation:
News · Live · Transfers · Tabelle · Vereine

Each club page is designed for:
- expected starting XI
- squad
- player photos
- player positions/numbers
- club logo
- player profiles
- community with 👍/👎

Run:
npm install
npm start
Open http://localhost:3000.

For iPhone, deploy the Node service to a host (for example Render) and open the resulting HTTPS URL in Safari. Add it via **Teilen → Zum Home-Bildschirm**, so it behaves like a PWA-style web app.

Set SPORTS_API_KEY on the server for live, squad, player, transfer, injury and lineup data. Never commit the key.

## News-Datenquellen

The aggregator is configured for permitted RSS/Atom feeds. kicker explicitly provides RSS feeds for Bundesliga news/team feeds, and Sportschau documents Bundesliga RSS feeds. The app stores headlines, short excerpts, source, timestamp and original article URL; it does not copy full articles.

If a publisher changes a feed URL or restricts automated use, update `FEEDS` in `server.js` rather than scraping the website.
