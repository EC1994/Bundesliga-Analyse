# Bundesliga Hub – korrigierte Version

## Wichtig: Nicht `public/index.html` doppelt anklicken
Die Website besteht aus Frontend **und** Node.js-Backend. Wenn `index.html` direkt geöffnet wird (`file://...`), funktionieren `/api/...` nicht. Genau das war der Hauptgrund, warum die vorherige Version scheinbar nicht funktioniert hat.

## Windows
Node.js 20+ installieren und danach im Projektordner `start.bat` doppelklicken.

Oder im Terminal:
```bash
npm install
npm start
```
Dann im Browser öffnen:
`http://localhost:3000`

## GitHub
GitHub speichert den Code. GitHub Pages kann dieses Node.js-Backend nicht ausführen. Für eine echte automatische Website das Repository auf einen Node-Host deployen, z.B. Render. Eine `render.yaml` ist enthalten.

Auf Render:
- Build: `npm install`
- Start: `npm start`
- `SPORTS_API_KEY` als Secret setzen
- für SQLite den persistenten Datenträger aus `render.yaml` verwenden

## Daten
Ohne `SPORTS_API_KEY`:
- Spielplan: OpenLigaDB
- Tabelle: OpenLigaDB
- Vereine: eingebaut
- Community: SQLite

Mit `SPORTS_API_KEY`:
- Live-Spielstände
- Kader
- Spielerbilder
- Spielerprofile
- Transfers
- Verletzungen
- weitere Sportdaten

API-Football dokumentiert Fixtures, Live-Scores, Teams, Standings, Lineups, Players, Transfers und Injuries. OpenLigaDB stellt öffentliche Bundesliga-Spiel- und Tabellendaten bereit.

## API-Key niemals in GitHub speichern
Nur als Environment Variable auf dem Server setzen.
