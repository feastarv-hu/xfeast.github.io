function loadData() {
	const players = tournamentData.players.map(player => ({
		...player,
		matches: 0,
		wins: 0,
		losses: 0,
		points: 0,
		placementCounts: Array(7).fill(0),
		styleCounts: { FR: 0, PC: 0, LS: 0, EC: 0 },
		stylePoints: { FR: 0, PC: 0, LS: 0, EC: 0 }
	}));
	const normalizeNickname = nickname => String(nickname).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
	const playersByName = new Map(players.map(player => [player.name, player]));
	const playersByTeam = new Map();
	players.forEach(player => {
		const team = normalizeNickname(player.team);
		if (!playersByTeam.has(team)) playersByTeam.set(team, []);
		playersByTeam.get(team).push(player);
	});
	const pointsByPlacement = tournamentData.tournament.placementPoints;
	const placementByPoints = new Map(Object.entries(pointsByPlacement)
		.filter(([placement, points]) => Number(placement) <= 6 && points > 0)
		.map(([placement, points]) => [points, Number(placement)]));
	const editDistance = (left, right) => {
		const row = Array.from({ length: right.length + 1 }, (_, index) => index);
		for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
			let previous = row[0];
			row[0] = leftIndex;
			for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
				const diagonal = row[rightIndex];
				row[rightIndex] = Math.min(row[rightIndex] + 1, row[rightIndex - 1] + 1, previous + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1));
				previous = diagonal;
			}
		}
		return row[right.length];
	};
	const resolvePlayer = result => {
		const candidates = result.team ? playersByTeam.get(normalizeNickname(result.team)) || [] : players;
		const exact = candidates.find(player => player.name === result.player);
		if (exact) return exact;

		const nickname = normalizeNickname(result.player);
		if (!nickname) return null;
		const normalizedMatch = candidates.find(player => normalizeNickname(player.name) === nickname);
		if (normalizedMatch) return normalizedMatch;
		const taggedMatches = candidates.filter(player => {
			const candidate = normalizeNickname(player.name);
			return nickname.length >= 4 && candidate.includes(nickname);
		});
		if (taggedMatches.length === 1) return taggedMatches[0];

		const ranked = candidates.map(player => {
			const candidate = normalizeNickname(player.name);
			const distance = editDistance(nickname, candidate);
			return { player, similarity: 1 - distance / Math.max(nickname.length, candidate.length) };
		}).sort((a, b) => b.similarity - a.similarity);
		if (!ranked.length || ranked[0].similarity < 0.72 || (ranked[1] && ranked[0].similarity - ranked[1].similarity < 0.12)) return null;
		return ranked[0].player;
	};
	const matches = [...tournamentData.matches, ...(tournamentData.weekThreeMatches || [])].map(match => match.races ? {
		...match,
		races: match.races.map(race => ({
			...race,
			results: (race.results || []).map(result => {
				const player = resolvePlayer(result);
				return player ? { ...result, player: player.name, team: player.team } : result;
			})
		}))
	} : match);

	matches.forEach(match => {
		const resultSets = match.races
			? match.races.map(race => race.results || [])
			: [match.results || (match.players || []).map(name => ({ player: name, placement: name === match.winner ? 1 : null }))];
		resultSets.flat().forEach(result => {
			const player = playersByName.get(result.player);
			if (!player) return;

			const placement = result.placement ?? placementByPoints.get(result.points);
			player.matches++;
			if (placement === 1 || (!match.results && !match.races && result.player === match.winner)) {
				player.wins++;
			} else if ((Number.isInteger(placement) && placement >= 2 && placement <= 9) || (!match.results && !match.races)) {
				player.losses++;
			}
			if (Number.isFinite(result.points)) {
				player.points += result.points;
			} else if (Number.isInteger(placement)) {
				player.points += pointsByPlacement[placement] || 0;
			}
			if (Number.isInteger(placement)) {
				if (placement >= 1 && placement <= 6) {
					player.placementCounts[placement - 1]++;
				} else if (placement >= 7 && placement <= 9) {
					player.placementCounts[6]++;
				}
			} else if (result.points === 0) {
				player.placementCounts[6]++;
			}
			const style = String(result.style || "").toUpperCase();
			if (Object.prototype.hasOwnProperty.call(player.styleCounts, style)) {
				player.styleCounts[style]++;
				player.stylePoints[style] += Number.isFinite(result.points)
					? result.points
					: pointsByPlacement[placement] || 0;
			}
		});
	});

	players.sort((a, b) => b.points - a.points || b.wins - a.wins);
	players.forEach((player, index) => {
		player.rank = index + 1;
	});

	const { weekThreeMatches, ...data } = tournamentData;
	return { ...data, matches, players };
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#039;"
} [c]));

function pct(w, m) {
	return m ? Math.round(w / m * 100) : 0
}

function schedulePeriodLabel(period) {
	const week = Math.ceil(period / 2);
	return period % 2 === 1 ? `Qualifier Week ${week}` : `Super Week ${week}`;
}

function renderDashboard(d) {
	document.getElementById("playerCount").textContent = d.players.length;
	document.getElementById("teamCount").textContent = new Set(d.players.map(player => player.team).filter(Boolean)).size;
	document.getElementById("matchCount").textContent = d.matches.length;
	document.getElementById("raceCount").textContent = d.matches.reduce((count, match) => count + (match.races?.length || match.results?.length || match.players?.length || 0), 0);
	document.getElementById("standingsPreview").innerHTML = d.players.slice().sort((a, b) => b.points - a.points).slice(0, 5).map((player, index) => `<tr><td>${index + 1}</td><td><b>${esc(player.name)}</b></td><td>${esc(player.team)}</td><td>${player.matches}</td><td>${player.points}</td></tr>`).join("");
	document.getElementById("teamStandingsPreview").innerHTML = buildTeamStandings(d, null, true).slice(0, 5).map(team => `<tr><td>${team.rank}</td><td><b>${esc(team.team)}</b></td><td>${team.wins}</td><td>${team.ties}</td><td>${team.losses}</td><td>${team.points}</td></tr>`).join("");

	const umaModeTabs = document.getElementById("umaModeTabs");
	const umaStandings = document.getElementById("umaStandings");
	let umaMode = "rate";
	const renderUmaStandings = () => {
		const umas = d.umas.slice().sort((left, right) => umaMode === "rate"
			? right.winRate - left.winRate || right.picks - left.picks
			: right.picks - left.picks || right.winRate - left.winRate).slice(0, 5);
		umaStandings.innerHTML = umas.map((uma, index) => `<tr><td>${index + 1}</td><td><b>${esc(uma.name)}</b></td><td>${uma.picks}</td><td>${uma.winRate}%</td></tr>`).join("");
		Array.from(umaModeTabs.querySelectorAll("[role=tab]")).forEach(tab => {
			const selected = tab.dataset.mode === umaMode;
			tab.setAttribute("aria-selected", String(selected));
			tab.tabIndex = selected ? 0 : -1;
		});
	};
	umaModeTabs.innerHTML = `<button class="standings-tab" type="button" role="tab" data-mode="rate" aria-selected="true">Win Rate</button><button class="standings-tab" type="button" role="tab" data-mode="uses" aria-selected="false" tabindex="-1">Most Used</button>`;
	umaModeTabs.querySelectorAll("[role=tab]").forEach(tab => tab.addEventListener("click", () => {
		umaMode = tab.dataset.mode;
		renderUmaStandings();
	}));
	renderUmaStandings();

	const styleModeTabs = document.getElementById("styleModeTabs");
	const styleStandings = document.getElementById("styleStandings");
	const styleOptions = [["FR", "Front Runner"], ["PC", "Pace Chaser"], ["LS", "Late Surger"], ["EC", "End Closer"]];
	let activeStyle = "FR";
	const renderStyleStandings = () => {
		const leaders = d.players.filter(player => player.styleCounts[activeStyle] > 0)
			.sort((left, right) => right.stylePoints[activeStyle] - left.stylePoints[activeStyle] || right.styleCounts[activeStyle] - left.styleCounts[activeStyle])
			.slice(0, 5);
		styleStandings.innerHTML = leaders.map((player, index) => `<tr><td>${index + 1}</td><td><b>${esc(player.name)}</b></td><td>${esc(player.team)}</td><td>${player.styleCounts[activeStyle]}</td><td>${player.stylePoints[activeStyle]}</td></tr>`).join("");
		Array.from(styleModeTabs.querySelectorAll("[role=tab]")).forEach(tab => {
			const selected = tab.dataset.style === activeStyle;
			tab.setAttribute("aria-selected", String(selected));
			tab.tabIndex = selected ? 0 : -1;
		});
	};
	styleModeTabs.innerHTML = styleOptions.map(([style, label], index) => `<button class="standings-tab" type="button" role="tab" data-style="${style}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${label}</button>`).join("");
	styleModeTabs.querySelectorAll("[role=tab]").forEach(tab => tab.addEventListener("click", () => {
		activeStyle = tab.dataset.style;
		renderStyleStandings();
	}));
	renderStyleStandings();
}

function buildTeamStandings(d, week = null, overallGroupA = false) {
	const normalizeTeam = team => String(team).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
	const canonicalTeam = team => d.players.find(player => normalizeTeam(player.team) === normalizeTeam(team))?.team || team;
	const teamStats = new Map();

	d.matches.filter(match => overallGroupA
		? match.phase === "Super Week" && ["A1", "A2", "A3"].includes(String(match.group))
		: week === null || match.week === week).forEach(match => {
		(match.races || []).forEach(race => {
			const mapScores = new Map();
			(race.results || []).forEach(result => {
				const team = canonicalTeam(result.team || "Unassigned");
				const points = Number.isFinite(result.points)
					? result.points
					: d.tournament.placementPoints[result.placement] || 0;
				mapScores.set(team, (mapScores.get(team) || 0) + points + (Number(result.bonusPoints) || 0));
			});

			const teams = Array.from(new Set([...(match.teams || []).map(canonicalTeam), ...mapScores.keys()]));
			const highestScore = Math.max(...teams.map(team => mapScores.get(team) || 0));
			const tiedTeams = teams.filter(team => (mapScores.get(team) || 0) === highestScore).length;
			teams.forEach(team => {
				if (!teamStats.has(team)) teamStats.set(team, { team, matches: 0, wins: 0, ties: 0, losses: 0, points: 0 });
				const stats = teamStats.get(team);
				const score = mapScores.get(team) || 0;
				stats.matches++;
				stats.points += score;
				if (score < highestScore) stats.losses++;
				else if (tiedTeams > 1) stats.ties++;
				else stats.wins++;
			});
		});
	});

	const teams = Array.from(teamStats.values()).sort((left, right) =>
		right.wins - left.wins || right.ties - left.ties || left.losses - right.losses || right.points - left.points || left.team.localeCompare(right.team));
	teams.forEach((team, index) => {
		team.rank = index + 1;
	});
	return teams;
}

function renderStandings(d) {
	const individualColumns = [
		{ key: "rank", label: "#", value: player => player.rank, render: player => player.rank },
		{ key: "player", label: "Player", value: player => player.name, render: player => `<b>${esc(player.name)}</b>` },
		{ key: "team", label: "Team", value: player => player.team, render: player => esc(player.team) },
		{ key: "matches", label: "Matches", value: player => player.matches, render: player => player.matches },
		...["1st", "2nd", "3rd", "4th", "5th", "6th", "7th+"].map((label, index) => ({ key: `place${index}`, label, value: player => player.placementCounts[index], render: player => player.placementCounts[index] })),
		{ key: "average", label: "Avg Score", value: player => player.matches ? player.points / player.matches : 0, render: player => player.matches ? (player.points / player.matches).toFixed(2) : "0.00" },
		{ key: "points", label: "Points", value: player => player.points, render: player => `<b>${player.points}</b>` },
		{ key: "status", label: "Status", value: player => player.status, render: player => `<span class="badge ${player.status === "Active" ? "text-bg-success" : "text-bg-secondary"}">${esc(player.status)}</span>` }
	];
	const teamColumns = [
		{ key: "rank", label: "#", value: team => team.rank, render: team => team.rank },
		{ key: "team", label: "Team", value: team => team.team, render: team => `<b>${esc(team.team)}</b>` },
		{ key: "matches", label: "Matches", value: team => team.matches, render: team => team.matches },
		{ key: "wins", label: "W", value: team => team.wins, render: team => team.wins },
		{ key: "ties", label: "T", value: team => team.ties, render: team => team.ties },
		{ key: "losses", label: "L", value: team => team.losses, render: team => team.losses },
		{ key: "points", label: "Points", value: team => team.points, render: team => `<b>${team.points}</b>` }
	];
	const periodCount = d.tournament.weeks || 12;
	const weeks = Array.from({ length: periodCount }, (_, index) => index + 1);
	const periods = [
		{ label: "Overall Individual", view: "individual" },
		{ label: "Overall Team", view: "team" },
		...[ ["FR", "Front Runner"], ["PC", "Pace Chaser"], ["LS", "Late Surger"], ["EC", "End Closer"] ].map(([style, label]) => ({ label, view: "style", style })),
		...weeks.map(week => ({ label: schedulePeriodLabel(week), view: "week", week }))
	];
	const tabsContainer = document.getElementById("standingsTabs");
	tabsContainer.innerHTML = periods.map((period, index) => `<button class="standings-tab" id="standings-tab-${index}" type="button" role="tab" aria-controls="standingsTable" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-view="${period.view}" data-week="${period.week ?? ""}" data-style="${period.style ?? ""}">${period.label}</button>`).join("");
	const periodButtons = Array.from(tabsContainer.querySelectorAll(".standings-tab"));
	const tableHeader = document.getElementById("standingsHeader");
	let activeView = "individual";
	let activeWeek = null;
	let activeStyle = null;
	let activeTeams = [];
	let sortKey = "points";
	let sortDirection = -1;
	const renderRows = () => {
		const styleColumns = [
			{ key: "rank", label: "#", value: player => player.rank, render: player => player.rank },
			{ key: "player", label: "Player", value: player => player.name, render: player => `<b>${esc(player.name)}</b>` },
			{ key: "team", label: "Team", value: player => player.team, render: player => esc(player.team) },
			{ key: "uses", label: "Style Uses", value: player => player.styleCounts[activeStyle], render: player => player.styleCounts[activeStyle] },
			{ key: "average", label: "Avg Style Score", value: player => player.styleCounts[activeStyle] ? player.stylePoints[activeStyle] / player.styleCounts[activeStyle] : 0, render: player => player.styleCounts[activeStyle] ? (player.stylePoints[activeStyle] / player.styleCounts[activeStyle]).toFixed(2) : "0.00" },
			{ key: "points", label: "Style Points", value: player => player.stylePoints[activeStyle], render: player => `<b>${player.stylePoints[activeStyle]}</b>` }
		];
		const columns = activeView === "individual" ? individualColumns : activeView === "style" ? styleColumns : teamColumns;
		const rows = activeView === "individual" ? d.players : activeView === "style"
			? d.players.filter(player => player.styleCounts[activeStyle] > 0)
				.slice().sort((left, right) => right.stylePoints[activeStyle] - left.stylePoints[activeStyle] || right.styleCounts[activeStyle] - left.styleCounts[activeStyle])
				.map((player, index) => ({ ...player, rank: index + 1 }))
			: activeTeams;
		tableHeader.innerHTML = columns.map(column => `<th scope="col"><button class="table-sort" data-sort-key="${column.key}" type="button">${column.label}<span class="sort-indicator" aria-hidden="true"></span></button></th>`).join("");
		const sortedRows = rows.slice().sort((left, right) => {
			const leftValue = columns.find(column => column.key === sortKey)?.value(left) ?? 0;
			const rightValue = columns.find(column => column.key === sortKey)?.value(right) ?? 0;
			const comparison = typeof leftValue === "number"
				? leftValue - rightValue
				: String(leftValue).localeCompare(String(rightValue));
			return comparison * sortDirection || left.rank - right.rank;
		});
		document.getElementById("standingsTable").innerHTML = (activeView === "week" || activeView === "style") && sortedRows.length === 0
			? `<tr><td colspan="${columns.length}" class="text-secondary">${activeView === "week" ? `No team results recorded for ${schedulePeriodLabel(activeWeek)} yet.` : `No ${esc(activeStyle)} results recorded yet.`}</td></tr>`
			: sortedRows.map(row => `<tr>${columns.map(column => `<td>${column.render(row)}</td>`).join("")}</tr>`).join("");
		const sortButtons = Array.from(tableHeader.querySelectorAll(".table-sort"));
		sortButtons.forEach(button => {
			const active = button.dataset.sortKey === sortKey;
			button.closest("th").setAttribute("aria-sort", active ? (sortDirection === 1 ? "ascending" : "descending") : "none");
			button.querySelector(".sort-indicator").textContent = active ? (sortDirection === 1 ? "↑" : "↓") : "";
			button.addEventListener("click", () => {
				if (sortKey === button.dataset.sortKey) sortDirection *= -1;
				else {
					sortKey = button.dataset.sortKey;
					sortDirection = 1;
				}
				renderRows();
			});
		});
	};
	periodButtons.forEach(button => button.addEventListener("click", () => {
		activeView = button.dataset.view;
		activeWeek = activeView === "week" ? Number(button.dataset.week) : null;
		activeStyle = activeView === "style" ? button.dataset.style : null;
		activeTeams = activeView === "team"
			? buildTeamStandings(d, null, true)
			: activeView === "week" ? buildTeamStandings(d, activeWeek) : [];
		periodButtons.forEach(tab => {
			const selected = tab === button;
			tab.setAttribute("aria-selected", String(selected));
			tab.tabIndex = selected ? 0 : -1;
		});
		sortKey = activeView === "individual" ? "points" : activeView === "style" ? "points" : "rank";
		sortDirection = activeView === "individual" || activeView === "style" ? -1 : 1;
		renderRows();
	}));
	tabsContainer.addEventListener("keydown", event => {
		if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
		event.preventDefault();
		const currentIndex = periodButtons.indexOf(document.activeElement);
		const nextIndex = event.key === "Home" ? 0
			: event.key === "End" ? periodButtons.length - 1
			: (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + periodButtons.length) % periodButtons.length;
		periodButtons[nextIndex].focus();
		periodButtons[nextIndex].click();
	});
	periodButtons[0].setAttribute("aria-selected", "true");
	renderRows();
}

function renderPlayers(d) {
	const teams = new Map();
	d.players.forEach(player => {
		const team = player.team || "Unassigned";
		if (!teams.has(team)) teams.set(team, []);
		teams.get(team).push(player);
	});
	document.getElementById("teamList").innerHTML = Array.from(teams, ([team, players]) => `
		<details class="team-group">
			<summary class="team-summary">
				<span class="team-name">${esc(team)}</span>
				<span class="team-count">${players.length} ${players.length === 1 ? "PLAYER" : "PLAYERS"}</span>
				<i class="bi bi-chevron-down team-chevron" aria-hidden="true"></i>
			</summary>
			<div class="row g-3 team-players">${players.map(p => `<div class="col-md-6 col-xl-4"><div class="player-card"><div class="d-flex justify-content-between"><div><div class="player-name">${esc(p.name)}</div><div class="text-secondary">${esc(p.team)}</div></div><div class="rank">#${p.rank}</div></div><hr><div class="player-results-grid">${p.placementCounts.map((count, index) => `<div class="player-result"><b>${count}</b><small>${index < 6 ? ["1ST", "2ND", "3RD", "4TH", "5TH", "6TH"][index] + " PLACE" : "7TH+"}</small></div>`).join("")}<div class="player-result"><b>${p.matches}</b><small>PLAYED</small></div></div></div></div>`).join("")}</div>
		</details>`).join("");
	const teamGroups = Array.from(document.querySelectorAll("#teamList .team-group"));
	const showAllMembers = document.getElementById("showAllMembers");
	const syncShowAllMembers = () => {
		showAllMembers.checked = teamGroups.length > 0 && teamGroups.every(group => group.open);
	};
	showAllMembers.addEventListener("change", () => {
		teamGroups.forEach(group => {
			group.open = showAllMembers.checked;
		});
	});
	teamGroups.forEach(group => group.addEventListener("toggle", syncShowAllMembers));
}

function renderMatches(d) {
	const weekCount = d.tournament.weeks || 12;
	const matchesPerTeam = d.tournament.matchesPerTeamPerWeek || 3;
	const inWeek = match => Number.isInteger(match.week) && match.week >= 1 && match.week <= weekCount;
	const pointsForResult = result => Number.isFinite(result.points)
		? result.points
		: d.tournament.placementPoints[result.placement] || 0;
	const normalizeTeam = team => String(team).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
	const canonicalTeam = team => d.players.find(player => normalizeTeam(player.team) === normalizeTeam(team))?.team || team;
	const scoreTeams = races => {
		const scores = new Map();
		races.forEach(race => (race.results || []).forEach(result => {
			const team = canonicalTeam(result.team || "Unassigned");
			const score = pointsForResult(result) + (Number(result.bonusPoints) || 0);
			scores.set(team, (scores.get(team) || 0) + score);
		}));
		return scores;
	};
	const matchMarkup = match => {
		if (match.races) {
			const teams = (match.teams || Array.from(scoreTeams(match.races).keys())).map(canonicalTeam);
			const teamStats = new Map(teams.map(team => [team, { wins: 0, ties: 0, losses: 0, points: 0 }]));
			match.races.forEach(race => {
				const raceScores = scoreTeams([race]);
				const highestScore = Math.max(...teams.map(team => raceScores.get(team) || 0));
				const winningTeams = teams.filter(team => (raceScores.get(team) || 0) === highestScore);
				teams.forEach(team => {
					const stats = teamStats.get(team);
					const score = raceScores.get(team) || 0;
					stats.points += score;
					if (winningTeams.length > 1 && score === highestScore) stats.ties++;
					else if (score === highestScore) stats.wins++;
					else stats.losses++;
				});
			});
			const compareTeams = (left, right) => right.wins - left.wins || right.ties - left.ties || left.losses - right.losses || right.points - left.points;
		const rankedTeams = Array.from(teamStats, ([team, stats]) => ({ team, ...stats })).sort(compareTeams);
			const leaders = new Set(rankedTeams.filter(team => compareTeams(team, rankedTeams[0]) === 0).map(team => team.team));
			const totalMarkup = Array.from(teamStats, ([team, stats]) => `<span class="team-total${leaders.has(team) ? " team-total-leader" : ""}"><span class="team-total-info"><b>${esc(team)}</b><small>${stats.wins}W · ${stats.ties}T · ${stats.losses}L</small></span><span class="team-total-score"><strong>${stats.points} pts</strong>${leaders.has(team) ? `<small class="team-leader-badge">GROUP LEADER</small>` : ""}</span></span>`).join("");
			const raceMarkup = match.races.map(race => {
				const raceTotals = scoreTeams([race]);
				const highestScore = Math.max(...raceTotals.values());
				const winningTeams = Array.from(raceTotals.values()).filter(points => points === highestScore).length;
				const raceTotalMarkup = Array.from(raceTotals, ([team, points]) => {
					const outcome = points < highestScore ? "LOSS" : winningTeams > 1 ? "TIE" : "WIN";
					return `<span class="map-team-total map-team-${outcome.toLowerCase()}"><b>${esc(team)}</b><span>${points} pts · ${outcome}</span></span>`;
				}).join("");
				const rows = (race.results || []).map(result => `<tr><td>${esc(result.team)}</td><td>${esc(result.player)}</td><td>${esc(result.uma)}</td><td>${esc(result.style)}</td><td>${pointsForResult(result)}</td><td>${Number(result.bonusPoints) || 0}</td></tr>`).join("");
				return `<details class="map-result"><summary><span class="map-result-name">${esc(race.map)}</span><span class="map-team-totals">${raceTotalMarkup}</span><span class="map-expand-indicator" aria-hidden="true"><i class="bi bi-chevron-down"></i></span></summary><div class="table-responsive"><table class="table table-dark table-sm map-results-table"><thead><tr><th>Team</th><th>Nickname</th><th>Uma</th><th>Style</th><th>Place pts</th><th>BP</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
			}).join("");
			return `<article class="match-entry group-match"><div class="match-entry-heading"><b>Group ${esc(match.group)}</b><span>${match.races.length} MAPS</span></div><div class="match-entry-round">Team points · placement points plus BP</div><div class="team-total-list">${totalMarkup}</div>${raceMarkup}</article>`;
		}
		const resultList = match.results?.length
			? `<ol class="match-results">${match.results.slice().sort((a, b) => a.placement - b.placement).map(result => `<li><b>${result.placement}.</b> ${esc(result.player)} <span>${esc(result.uma || "Uma not recorded")}</span><strong>${d.tournament.placementPoints[result.placement] || 0} pts</strong></li>`).join("")}</ol>`
			: `<div class="legacy-match-results">Legacy result: ${(match.players || []).map(esc).join(" · ")}${match.winner ? ` · Winner: ${esc(match.winner)}` : ""}${match.uma ? ` · Uma: ${esc(match.uma)}` : ""}</div>`;
		return `<article class="match-entry"><div class="match-entry-heading"><b>Match ${esc(match.id)}</b><span>${esc(match.date || "Date pending")}</span></div><div class="match-entry-round">${esc(match.round || "Round pending")}</div>${resultList}</article>`;
	};
	const weeks = Array.from({ length: weekCount }, (_, index) => index + 1).map(period => {
		const matches = d.matches.filter(match => match.week === period);
		const content = matches.length ? matches.map(matchMarkup).join("") : `<p class="match-empty">No matches added for this period yet.</p>`;
		return `<details class="week-group"><summary class="week-summary"><span>${schedulePeriodLabel(period).toUpperCase()}</span><span class="week-cadence">${matchesPerTeam} MATCHES / TEAM</span><i class="bi bi-chevron-down team-chevron" aria-hidden="true"></i></summary><div class="week-content">${content}</div></details>`;
	}).join("");
	const unscheduled = d.matches.filter(match => !inWeek(match));
	const unscheduledSection = unscheduled.length
		? `<details class="week-group unscheduled-group"><summary class="week-summary"><span>UNSCHEDULED</span><span class="week-cadence">${unscheduled.length} ${unscheduled.length === 1 ? "MATCH" : "MATCHES"}</span><i class="bi bi-chevron-down team-chevron" aria-hidden="true"></i></summary><div class="week-phases">${unscheduled.map(matchMarkup).join("")}</div></details>`
		: "";
	document.getElementById("matchScheduleSummary").textContent = `${Math.ceil(weekCount / 2)} weeks · Qualifier Week and Super Week alternate · ${matchesPerTeam} matches per team per period`;
	document.getElementById("matchWeeks").innerHTML = weeks + unscheduledSection;
}

function renderBracket(d) {
	const rounds = ["Upper Round 1", "Upper Round 2", "Upper Final", "Grand Final"];
	document.getElementById("bracket").innerHTML = rounds.map((r, i) => `<div class="bracket-round"><h6>${r}</h6>${d.bracket.filter(x=>x.round===r).map(m=>`<div class="bracket-match"><small>Match ${m.id}</small>${m.players.map((p,j)=>`<div class="${p===m.winner?'winner':''}">${esc(p)} ${j===0&&p===m.winner?'✓':''}</div>`).join("")}</div>`).join("")}</div>`).join("")
}

function chartOptions() {
	return {
		responsive: true,
		plugins: {
			legend: {
				labels: {
					color: "#cbd5e1"
				}
			}
		},
		scales: {
			x: {
				ticks: {
					color: "#94a3b8"
				},
				grid: {
					color: "#1e293b"
				}
			},
			y: {
				ticks: {
					color: "#94a3b8"
				},
				grid: {
					color: "#1e293b"
				}
			}
		}
	}
}

function renderAnalytics(d) {
	const labels = d.players.map(p => p.name);
	new Chart(document.getElementById("playerWinChart"), {
		type: "bar",
		data: {
			labels,
			datasets: [{
				label: "Win Rate %",
				data: d.players.map(p => pct(p.wins, p.matches))
			}]
		},
		options: chartOptions()
	});
	new Chart(document.getElementById("pickChart"), {
		type: "doughnut",
		data: {
			labels: d.umas.map(x => x.name),
			datasets: [{
				data: d.umas.map(x => x.picks)
			}]
		},
		options: chartOptions()
	});
	new Chart(document.getElementById("finishChart"), {
		type: "bar",
		data: {
			labels: ["1st", "2nd", "3rd"],
			datasets: [{
				label: "Finishes",
				data: d.finishes
			}]
		},
		options: chartOptions()
	});
	new Chart(document.getElementById("surfaceChart"), {
		type: "line",
		data: {
			labels: ["Turf", "Dirt"],
			datasets: [{
				label: "Win Rate %",
				data: d.surfaceWinRate
			}]
		},
		options: chartOptions()
	});
}