# Uma Musume Tournament Analytics

A static tournament analytics website designed for GitHub Pages.

## Features

- Bootstrap 5.3 responsive UI
- Dashboard
- Standings
- Player cards
- Match history
- Three-player double-elimination bracket example
- Chart.js analytics
- JSON-based tournament data
- No backend required

## Open locally

This version does **not** require localhost.

You can simply double-click `index.html` and open it directly in your browser.

Tournament data is stored in `data/tournament.js`, so the browser does not need to fetch a JSON file.

## Updating tournament data

Most data can be changed in:

`data/tournament.js`

You can later connect this to a Google Sheet, GitHub Actions workflow, or a database/API if you need live updates.

## Important

Bootstrap and Chart.js are loaded from CDNs. The site therefore needs internet access for the styling and charts to load.
