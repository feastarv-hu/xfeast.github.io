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

Group matches are organized by week and phase. Each group can contain multiple map races, with nine player results per race:

```js
{
	id: "G1",
	week: 1,
	phase: "Qualifier",
	group: 1,
	races: [{
		map: "Hanshin - 2400M",
		results: [
			{ team: "Team A", player: "Player Alpha", uma: "Narita Taishin", style: "PC", points: 12, bonusPoints: 3 },
			// Add the other eight results for this map.
		]
	}]
}
```

Add three races to represent three maps in the week. `points` is the player's placement score; optional `bonusPoints` contributes only to team totals, not personal points. Week 1 is Qualifier, week 2 is Super Week, and phases alternate by week. Placement scores come from `tournament.placementPoints`.

## GitHub Pages

1. Create a GitHub repository.
2. Upload all files while preserving the folder structure.
3. Go to Settings → Pages.
4. Select "Deploy from a branch".
5. Select your main branch and `/ (root)`.
6. Save.

Your site will be available at:

https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/

## Updating tournament data

Most data can be changed in:

`data/tournament.js`

You can later connect this to a Google Sheet, GitHub Actions workflow, or a database/API if you need live updates.

## Important

Bootstrap and Chart.js are loaded from CDNs. The site therefore needs internet access for the styling and charts to load.
