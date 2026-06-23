import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Use somente a URL pública e a anon key. Nunca coloque a service_role no frontend.
const SUPABASE_URL = "https://tmkzvfxpdyoetdfrysfn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_qmH14lt88_rdosFL8A_w_PnSOzeVU";

const TEAM_NAME_MAP = {
  Brazil: "Brasil", Germany: "Alemanha", France: "França", England: "Inglaterra",
  Spain: "Espanha", Netherlands: "Holanda", Croatia: "Croácia", Morocco: "Marrocos",
  Mexico: "México", "United States": "Estados Unidos", USA: "Estados Unidos",
  "South Korea": "Coreia do Sul", "South Africa": "África do Sul",
  "Saudi Arabia": "Arábia Saudita", "New Zealand": "Nova Zelândia",
  "Ivory Coast": "Costa do Marfim", "Côte d'Ivoire": "Costa do Marfim",
  "Cape Verde": "Cabo Verde", Switzerland: "Suíça", Belgium: "Bélgica",
  Austria: "Áustria", "Czech Republic": "República Tcheca",
  "Bosnia and Herzegovina": "Bósnia e Herzegovina", "DR Congo": "RD Congo",
  Türkiye: "Turquia", Turkey: "Turquia", Japan: "Japão", Egypt: "Egito",
  Scotland: "Escócia", Sweden: "Suécia", Tunisia: "Tunísia", Algeria: "Argélia",
  Colombia: "Colômbia", Paraguay: "Paraguai", Uruguay: "Uruguai", Norway: "Noruega",
  Ghana: "Gana", Canada: "Canadá", Ecuador: "Equador", Iran: "Irã", Iraq: "Iraque",
  Jordan: "Jordânia", Uzbekistan: "Uzbequistão", Panama: "Panamá", Qatar: "Catar",
};

const TEAM_TO_ISO = {
  "África do Sul": "ZAF", Alemanha: "DEU", Argélia: "DZA", Argentina: "ARG",
  Austrália: "AUS", Áustria: "AUT", Bélgica: "BEL",
  "Bósnia e Herzegovina": "BIH", Brasil: "BRA", "Cabo Verde": "CPV",
  Canadá: "CAN", Catar: "QAT", Colômbia: "COL", "Coreia do Sul": "KOR",
  "Costa do Marfim": "CIV", Croácia: "HRV", Curaçao: "CUW", Egito: "EGY",
  "Arábia Saudita": "SAU",
  Equador: "ECU", Escócia: "GBR", Espanha: "ESP", "Estados Unidos": "USA",
  França: "FRA", Gana: "GHA", Haiti: "HTI", Holanda: "NLD",
  Inglaterra: "GBR", Irã: "IRN", Iraque: "IRQ", Japão: "JPN",
  Jordânia: "JOR", Marrocos: "MAR", México: "MEX", "Nova Zelândia": "NZL",
  Noruega: "NOR", Panamá: "PAN", Paraguai: "PRY", Portugal: "PRT",
  "RD Congo": "COD", "República Tcheca": "CZE", Senegal: "SEN",
  Suécia: "SWE", Suíça: "CHE", Tunísia: "TUN", Turquia: "TUR",
  Uruguai: "URY", Uzbequistão: "UZB",
};

const ISO3_TO_ISO2 = {
  ZAF: "ZA", DEU: "DE", DZA: "DZ", ARG: "AR", AUS: "AU", AUT: "AT",
  BEL: "BE", BIH: "BA", BRA: "BR", CPV: "CV", CAN: "CA", QAT: "QA",
  SAU: "SA",
  COL: "CO", KOR: "KR", CIV: "CI", HRV: "HR", CUW: "CW", EGY: "EG",
  ECU: "EC", GBR: "GB", ESP: "ES", USA: "US", FRA: "FR", GHA: "GH",
  HTI: "HT", NLD: "NL", IRN: "IR", IRQ: "IQ", JPN: "JP", JOR: "JO",
  MAR: "MA", MEX: "MX", NZL: "NZ", NOR: "NO", PAN: "PA", PRY: "PY",
  PRT: "PT", COD: "CD", CZE: "CZ", SEN: "SN", SWE: "SE", CHE: "CH",
  TUN: "TN", TUR: "TR", URY: "UY", UZB: "UZ",
};

const WORLD_GEOJSON_URL = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";
const LIVE_WINDOW_MS = 105 * 60 * 1000;
const LIVE_CHECK_INTERVAL_MS = 30 * 1000;
const LIVE_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const IDLE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const elements = {
  upcomingSection: document.querySelector("#upcoming-section"),
  upcomingGames: document.querySelector("#upcoming-games"),
  brazilSection: document.querySelector("#brazil-section"),
  brazilChampionProb: document.querySelector("#brazil-champion-prob"),
  brazilChampionCaption: document.querySelector("#brazil-champion-caption"),
  brazilNextGame: document.querySelector("#brazil-next-game"),
  favoritesSection: document.querySelector("#favorites-section"),
  favoritesGrid: document.querySelector("#favorites-grid"),
  simulationsDetail: document.querySelector("#simulations-detail"),
  probabilityMapSection: document.querySelector("#probability-map-section"),
  probabilityMap: document.querySelector("#probability-map"),
  mapTooltip: document.querySelector("#map-tooltip"),
  liveUpdateIndicator: document.querySelector("#live-update-indicator"),
  loading: document.querySelector("#loading"),
  error: document.querySelector("#error-state"),
  errorMessage: document.querySelector("#error-message"),
  empty: document.querySelector("#empty-state"),
  dashboard: document.querySelector("#dashboard"),
  retry: document.querySelector("#retry-button"),
  lastUpdate: document.querySelector("#last-update"),
  resultAccuracy: document.querySelector("#result-accuracy"),
  resultCount: document.querySelector("#result-count"),
  exactAccuracy: document.querySelector("#exact-accuracy"),
  exactCount: document.querySelector("#exact-count"),
  totalMatches: document.querySelector("#total-matches"),
  bestRoundValue: document.querySelector("#best-round-value"),
  bestRoundDetail: document.querySelector("#best-round-detail"),
  roundRanking: document.querySelector("#round-ranking"),
  matchesBody: document.querySelector("#matches-body"),
};

let cachedPredictions = [];
let dashboardRefreshInFlight = false;
let lastDashboardRefresh = 0;
let lastIdleRefresh = 0;

elements.retry.addEventListener("click", () => loadDashboard());

function isConfigured() {
  return !SUPABASE_URL.includes("SEU-PROJETO") && !SUPABASE_ANON_KEY.includes("SUA-ANON-KEY");
}

function showState(state) {
  elements.loading.hidden = state !== "loading";
  elements.error.hidden = state !== "error";
  elements.empty.hidden = state !== "empty";
  elements.dashboard.hidden = state !== "dashboard";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function percent(value) {
  const number = Number(value ?? 0);
  return `${number.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function formatDate(value, includeTime = false) {
  if (!value) return "—";
  const options = includeTime
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" };
  return new Intl.DateTimeFormat("pt-BR", options).format(new Date(value));
}

function displayTeam(name) {
  return TEAM_NAME_MAP[String(name ?? "").trim()] ?? String(name ?? "");
}

function formatBrasilia(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function brasiliaDateKey(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function countdownLabel(value) {
  const today = brasiliaDateKey(new Date());
  const gameDay = brasiliaDateKey(value);
  const utcDay = (key) => Date.parse(`${key}T00:00:00Z`);
  const days = Math.round((utcDay(gameDay) - utcDay(today)) / 86_400_000);
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return `Em ${days} dias`;
}

function isLiveMatch(matchDate, now = new Date()) {
  const start = new Date(matchDate).getTime();
  const current = now.getTime();
  return Number.isFinite(start) && start <= current && current <= start + LIVE_WINDOW_MS;
}

function countdownBadge(value) {
  if (isLiveMatch(value)) {
    return `
      <a class="countdown-badge countdown-live" href="https://www.youtube.com/@CazéTV"
         target="_blank" rel="noopener noreferrer" aria-label="Assistir agora na CazéTV">
        AGORA
      </a>`;
  }
  return `<span class="countdown-badge">${countdownLabel(value)}</span>`;
}

async function fetchPredictionsForUpcoming() {
  if (!isConfigured()) return [];
  try {
    const response = await supabase.from("predictions").select(
      "match_id,home_team,away_team,predicted_home_goals,predicted_away_goals,home_win_prob,draw_prob,away_win_prob,match_date",
    );
    if (response.error) throw response.error;
    return response.data ?? [];
  } catch (error) {
    console.warn("Previsões indisponíveis para os próximos jogos.", error);
    return [];
  }
}

function renderUpcomingGames(games) {
  elements.upcomingGames.innerHTML = games.map(({ game, prediction, date }) => `
    <article class="upcoming-card">
      <div class="upcoming-card-top">
        ${countdownBadge(date)}
        <span class="upcoming-time">${formatBrasilia(date)} · Brasília</span>
      </div>
      <div class="upcoming-teams">
        <span class="upcoming-team upcoming-home">${escapeHtml(displayTeam(game.homeTeam))}</span>
        <span class="upcoming-versus">VERSUS</span>
        <span class="upcoming-team upcoming-away">${escapeHtml(displayTeam(game.awayTeam))}</span>
      </div>
      <div class="upcoming-prediction">
        <span class="prediction-label">Palpite do modelo</span>
        ${prediction ? `
          <strong class="prediction-score">${prediction.predicted_home_goals} × ${prediction.predicted_away_goals}</strong>
          ${probabilityCell(prediction)}
        ` : '<span class="prediction-unavailable">Previsão não disponível</span>'}
      </div>
    </article>
  `).join("");
  elements.upcomingSection.hidden = false;
}

async function loadUpcomingGames() {
  elements.upcomingSection.hidden = true;
  try {
    const predictions = await fetchPredictionsForUpcoming();
    cachedPredictions = predictions;
    const now = new Date();

    // Países, horário, placar e probabilidades vêm do mesmo registro. Isso evita
    // que IDs inconsistentes de APIs externas misturem partidas diferentes.
    const upcoming = predictions.map((prediction) => {
      const date = new Date(prediction.match_date);
      const game = {
        id: prediction.match_id,
        homeTeam: prediction.home_team,
        awayTeam: prediction.away_team,
        date,
        finished: false,
      };
      return { game, prediction, date };
    }).filter(({ date }) => (
      date instanceof Date
      && !Number.isNaN(date)
      && date.getTime() + LIVE_WINDOW_MS >= now.getTime()
    ))
      .sort((a, b) => a.date - b.date)
      .slice(0, 3);

    if (upcoming.length) renderUpcomingGames(upcoming);
    updateLiveIndicator(predictions.some((prediction) => isLiveMatch(prediction.match_date, now)));
    lastIdleRefresh = Date.now();
  } catch (error) {
    // A agenda é complementar e não interrompe as demais métricas do dashboard.
    console.warn("Próximos jogos indisponíveis.", error);
    elements.upcomingSection.hidden = true;
  }
}

function updateLiveIndicator(isLive) {
  elements.liveUpdateIndicator.hidden = !isLive;
}

function probabilityCell(match) {
  const home = Number(match.home_win_prob) * 100;
  const draw = Number(match.draw_prob) * 100;
  const away = Number(match.away_win_prob) * 100;
  return `
    <div class="probability" aria-label="Casa ${home.toFixed(0)}%, empate ${draw.toFixed(0)}%, fora ${away.toFixed(0)}%">
      <div class="probability-labels"><span>C ${home.toFixed(0)}%</span><span>E ${draw.toFixed(0)}%</span><span>F ${away.toFixed(0)}%</span></div>
      <div class="probability-bar">
        <span class="prob-home" style="width:${home}%"></span>
        <span class="prob-draw" style="width:${draw}%"></span>
        <span class="prob-away" style="width:${away}%"></span>
      </div>
    </div>`;
}

function championPercent(value) {
  return `${(Number(value ?? 0) * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function teamFlag(team) {
  const iso2 = ISO3_TO_ISO2[TEAM_TO_ISO[team]];
  if (!iso2) return "";
  return [...iso2]
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt()))
    .join("");
}

async function fetchChampionshipOdds() {
  const response = await supabase
    .from("championship_odds")
    .select("team,champion_prob,eliminated,simulations_run,updated_at")
    .order("champion_prob", { ascending: false });
  if (response.error) throw response.error;
  return response.data ?? [];
}

function renderBrazilSection(odds, predictions) {
  const brazil = odds.find((row) => row.team === "Brasil");
  if (!brazil) {
    elements.brazilSection.hidden = true;
    return;
  }

  elements.brazilChampionProb.classList.toggle("is-eliminated", Boolean(brazil.eliminated));
  elements.brazilChampionProb.textContent = brazil.eliminated
    ? "Eliminado"
    : championPercent(brazil.champion_prob);
  elements.brazilChampionCaption.textContent = brazil.eliminated
    ? "fora da disputa pelo título"
    : "de chance de ser campeão";

  if (brazil.eliminated) {
    elements.brazilNextGame.hidden = true;
  } else {
    const now = new Date();
    const nextGame = predictions
      .filter((prediction) => (
        displayTeam(prediction.home_team) === "Brasil"
        || displayTeam(prediction.away_team) === "Brasil"
      ))
      .filter((prediction) => new Date(prediction.match_date) > now)
      .sort((a, b) => new Date(a.match_date) - new Date(b.match_date))[0];

    elements.brazilNextGame.hidden = false;
    if (!nextGame) {
      elements.brazilNextGame.innerHTML = `
        <span class="brazil-game-kicker">Próximo jogo do Brasil</span>
        <strong class="brazil-opponent">Nenhum jogo previsto</strong>`;
    } else {
      const brazilIsHome = displayTeam(nextGame.home_team) === "Brasil";
      const opponent = displayTeam(brazilIsHome ? nextGame.away_team : nextGame.home_team);
      elements.brazilNextGame.innerHTML = `
        <span class="brazil-game-kicker">Próximo jogo do Brasil</span>
        <strong class="brazil-opponent">contra ${escapeHtml(opponent)}</strong>
        <span class="brazil-game-date">${formatBrasilia(nextGame.match_date)} · Brasília</span>
        <div class="brazil-game-prediction">
          <div>
            <span class="prediction-label">${escapeHtml(displayTeam(nextGame.home_team))} × ${escapeHtml(displayTeam(nextGame.away_team))}</span>
            <strong class="prediction-score">${nextGame.predicted_home_goals} × ${nextGame.predicted_away_goals}</strong>
          </div>
          ${probabilityCell(nextGame)}
        </div>`;
    }
  }
  elements.brazilSection.hidden = false;
}

function renderFavorites(odds) {
  const favorites = odds.slice(0, 5);
  if (!favorites.length) {
    elements.favoritesSection.hidden = true;
    return;
  }
  elements.favoritesGrid.innerHTML = favorites.map((row, index) => `
    <article class="favorite-card ${row.eliminated ? "is-eliminated" : ""}">
      <span class="favorite-position">${index + 1}º</span>
      <strong class="favorite-team">
        <span class="favorite-flag" aria-hidden="true">${teamFlag(row.team)}</span>${escapeHtml(row.team)}
      </strong>
      <div class="favorite-probability"><span>chance de título</span><strong>${championPercent(row.champion_prob)}</strong></div>
      <div class="favorite-bar"><span style="width:${Math.max(0, Math.min(100, Number(row.champion_prob) * 100))}%"></span></div>
      ${row.eliminated ? '<span class="eliminated-badge">ELIMINADO</span>' : ""}
    </article>
  `).join("");
  const simulations = Math.max(...favorites.map((row) => Number(row.simulations_run) || 0));
  elements.simulationsDetail.textContent = `${simulations.toLocaleString("pt-BR")} simulações realizadas.`;
  elements.favoritesSection.hidden = false;
}

function mapColor(entries) {
  if (!entries?.length) return "#1a1a2e";
  if (entries.every((entry) => entry.eliminated)) return "#444444";
  const probability = Math.max(
    ...entries.filter((entry) => !entry.eliminated).map((entry) => Number(entry.champion_prob)),
  );
  if (probability > 0.15) return "#00ff88";
  if (probability >= 0.05) return "#00cc66";
  if (probability >= 0.01) return "#007744";
  return "#003322";
}

async function renderProbabilityMap(odds) {
  if (!window.d3) {
    elements.probabilityMapSection.hidden = true;
    return;
  }
  try {
    const response = await fetch(WORLD_GEOJSON_URL);
    if (!response.ok) throw new Error(`GeoJSON respondeu ${response.status}`);
    const geojson = await response.json();
    const oddsByIso = new Map();
    for (const row of odds) {
      const iso = TEAM_TO_ISO[row.team];
      if (!iso) continue;
      if (!oddsByIso.has(iso)) oddsByIso.set(iso, []);
      oddsByIso.get(iso).push(row);
    }

    const d3 = window.d3;
    const svg = d3.select(elements.probabilityMap);
    svg.selectAll("*").remove();
    svg.attr("viewBox", "0 0 960 500").attr("preserveAspectRatio", "xMidYMid meet");
    const projection = d3.geoNaturalEarth1().fitSize([940, 480], geojson);
    const path = d3.geoPath(projection);

    svg.append("g")
      .attr("transform", "translate(10,10)")
      .selectAll("path")
      .data(geojson.features)
      .join("path")
      .attr("class", (feature) => {
        const iso = feature.id ?? feature.properties?.iso_a3;
        return `map-country ${oddsByIso.has(iso) ? "is-participant" : ""}`;
      })
      .attr("d", path)
      .attr("fill", (feature) => {
        const iso = feature.id ?? feature.properties?.iso_a3;
        return mapColor(oddsByIso.get(iso));
      })
      .on("mousemove", (event, feature) => {
        const iso = feature.id ?? feature.properties?.iso_a3;
        const entries = oddsByIso.get(iso);
        if (!entries?.length) return;
        elements.mapTooltip.innerHTML = entries.map((entry) => `
          <strong>${escapeHtml(entry.team)}</strong>
          <span>${entry.eliminated ? "Eliminado" : `${championPercent(entry.champion_prob)} de chance`}</span>
        `).join("");
        elements.mapTooltip.style.left = `${event.clientX + 14}px`;
        elements.mapTooltip.style.top = `${event.clientY + 14}px`;
        elements.mapTooltip.hidden = false;
      })
      .on("mouseleave", () => {
        elements.mapTooltip.hidden = true;
      });

    elements.probabilityMapSection.hidden = false;
  } catch (error) {
    console.warn("Mapa de probabilidades indisponível.", error);
    elements.probabilityMapSection.hidden = true;
  }
}

async function loadChampionshipFeatures() {
  try {
    const [odds, predictions] = await Promise.all([
      fetchChampionshipOdds(),
      cachedPredictions.length ? Promise.resolve(cachedPredictions) : fetchPredictionsForUpcoming(),
    ]);
    if (!odds.length) return;
    renderBrazilSection(odds, predictions);
    renderFavorites(odds);
    await renderProbabilityMap(odds);
  } catch (error) {
    // As seções são complementares e somem silenciosamente enquanto não houver dados.
    console.warn("Probabilidades de título indisponíveis.", error);
    elements.brazilSection.hidden = true;
    elements.favoritesSection.hidden = true;
    elements.probabilityMapSection.hidden = true;
  }
}

function accuracyBadge(correct, label) {
  const className = correct ? "badge-success" : "badge-error";
  const symbol = correct ? "✓" : "✕";
  return `<span class="badge ${className}">${symbol} ${label}</span>`;
}

function renderSummary(overall, rounds, matches) {
  elements.resultAccuracy.textContent = percent(overall.result_accuracy_pct);
  elements.resultCount.textContent = `${overall.correct_results} de ${overall.total_matches} jogos`;
  elements.exactAccuracy.textContent = percent(overall.exact_accuracy_pct);
  elements.exactCount.textContent = `${overall.exact_scores} de ${overall.total_matches} jogos`;
  elements.totalMatches.textContent = String(overall.total_matches);

  const bestRound = [...rounds].sort(
    (a, b) => Number(b.result_accuracy_pct) - Number(a.result_accuracy_pct),
  )[0];
  elements.bestRoundValue.textContent = bestRound?.round ?? "—";
  elements.bestRoundDetail.textContent = bestRound
    ? `${percent(bestRound.result_accuracy_pct)} de acerto`
    : "Nenhuma rodada concluída";

  const newest = [...matches].sort(
    (a, b) => new Date(b.result_created_at) - new Date(a.result_created_at),
  )[0];
  elements.lastUpdate.textContent = formatDate(newest?.result_created_at, true);
}

function renderRounds(rounds) {
  const sorted = [...rounds].sort(
    (a, b) => new Date(b.latest_match_date) - new Date(a.latest_match_date),
  );
  elements.roundRanking.innerHTML = sorted.map((round) => `
    <article class="round-card">
      <div class="round-top">
        <h3 class="round-name">${escapeHtml(round.round)}</h3>
        <span class="round-date">${formatDate(round.latest_match_date)}</span>
      </div>
      <div class="round-stats">
        <div class="round-stat"><strong>${percent(round.result_accuracy_pct)}</strong><span>resultado</span></div>
        <div class="round-stat"><strong>${percent(round.exact_accuracy_pct)}</strong><span>placar exato</span></div>
      </div>
      <p class="metric-detail">${round.total_matches} jogo(s) analisado(s)</p>
    </article>
  `).join("");
}

function renderMatches(matches) {
  elements.matchesBody.innerHTML = matches.map((match) => `
    <tr>
      <td class="match-teams">
        <strong>${escapeHtml(match.home_team)} × ${escapeHtml(match.away_team)}</strong>
        <span class="match-date">${formatDate(match.match_date, true)}</span>
      </td>
      <td><span class="score">${match.predicted_home_goals} × ${match.predicted_away_goals}</span></td>
      <td>${probabilityCell(match)}</td>
      <td><span class="score">${match.actual_home_goals} × ${match.actual_away_goals}</span></td>
      <td>${accuracyBadge(match.result_correct, match.result_correct ? "Correto" : "Errado")}</td>
      <td>${accuracyBadge(match.exact_score, match.exact_score ? "Exato" : "Não exato")}</td>
      <td><span class="round-pill">${escapeHtml(match.round)}</span></td>
    </tr>
  `).join("");
}

async function loadDashboard(silent = false) {
  if (!silent) showState("loading");

  if (!isConfigured()) {
    elements.errorMessage.textContent = "Configure SUPABASE_URL e SUPABASE_ANON_KEY no início do app.js.";
    showState("error");
    return;
  }

  try {
    const [matchesResponse, accuracyResponse] = await Promise.all([
      supabase.from("match_summary").select("*").order("match_date", { ascending: false }),
      supabase.from("accuracy_summary").select("*"),
    ]);

    if (matchesResponse.error) throw matchesResponse.error;
    if (accuracyResponse.error) throw accuracyResponse.error;

    const matches = matchesResponse.data ?? [];
    const summaries = accuracyResponse.data ?? [];
    if (!matches.length) {
      elements.lastUpdate.textContent = "Sem resultados";
      showState("empty");
      return;
    }

    const overall = summaries.find((item) => item.round === "Geral");
    const rounds = summaries.filter((item) => item.round !== "Geral");
    if (!overall) throw new Error("A view accuracy_summary não retornou a linha Geral.");

    renderSummary(overall, rounds, matches);
    renderRounds(rounds);
    renderMatches(matches);
    showState("dashboard");
    lastDashboardRefresh = Date.now();
  } catch (error) {
    console.error(error);
    if (silent) return;
    elements.errorMessage.textContent = error.message || "Erro inesperado ao consultar o Supabase.";
    showState("error");
  }
}

async function pollingTick() {
  if (dashboardRefreshInFlight) return;
  const now = new Date();
  const live = cachedPredictions.some((prediction) => isLiveMatch(prediction.match_date, now));
  updateLiveIndicator(live);

  const current = Date.now();
  const shouldRefreshLive = live && current - lastDashboardRefresh >= LIVE_REFRESH_INTERVAL_MS;
  const shouldRefreshIdle = !live && current - lastIdleRefresh >= IDLE_REFRESH_INTERVAL_MS;
  if (!shouldRefreshLive && !shouldRefreshIdle) return;

  dashboardRefreshInFlight = true;
  try {
    if (shouldRefreshLive) {
      await Promise.all([loadDashboard(true), loadUpcomingGames()]);
    } else {
      await loadUpcomingGames();
      await loadChampionshipFeatures();
    }
  } finally {
    dashboardRefreshInFlight = false;
  }
}

async function initializeDashboard() {
  await Promise.all([loadDashboard(), loadUpcomingGames()]);
  await loadChampionshipFeatures();
  setInterval(pollingTick, LIVE_CHECK_INTERVAL_MS);
}

initializeDashboard();
