document.write(`<nav class="navbar navbar-expand-lg navbar-dark sticky-top glass-nav"><div class="container"><a class="navbar-brand fw-bold" href="../index.html"><i class="bi bi-trophy-fill me-2"></i>UMA ANALYTICS</a><button class="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#nav"><span class="navbar-toggler-icon"></span></button><div id="nav" class="collapse navbar-collapse"><ul class="navbar-nav ms-auto"><li class="nav-item"><a class="nav-link" href="../index.html">Tournaments</a></li><li class="nav-item"><a class="nav-link" href="dashboard.html">Dashboard</a></li><li class="nav-item"><a class="nav-link" href="standings.html">Standings</a></li><li class="nav-item"><a class="nav-link" href="players.html">Players</a></li><li class="nav-item"><a class="nav-link" href="matches.html">Matches</a></li></ul></div></div></nav>`);

(() => {
	const highlightActiveLink = () => {
		const currentPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
		if (!currentPage) return;
		document.querySelectorAll(".glass-nav .nav-link").forEach(link => {
			const targetPage = (link.getAttribute("href") || "").split("/").pop().toLowerCase();
			link.classList.toggle("active", targetPage === currentPage);
		});
	};
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", highlightActiveLink);
	} else {
		highlightActiveLink();
	}
})();