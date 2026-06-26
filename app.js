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
  "Democratic Republic of the Congo": "RD Congo", "Congo DR": "RD Congo",
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
// Fallback de tempo para quando o placar ao vivo ainda não chegou no Supabase.
// A remoção oficial do card usa live_matches.status = "finished".
const LIVE_WINDOW_MS = 195 * 60 * 1000;
const LIVE_CHECK_INTERVAL_MS = 30 * 1000;
const LIVE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const IDLE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const OFFICIAL_GROUPS = {
  A: ["Mexico", "South Africa", "South Korea", "Czech Republic"],
  B: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Turkey"],
  E: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

const ROUND_OF_32 = [
  ["Winner Group E", "Best 3rd (Groups A/B/C/D/F)"],
  ["Winner Group I", "Best 3rd (Groups C/D/F/G/H)"],
  ["Runner-up Group A", "Runner-up Group B"],
  ["Winner Group F", "Runner-up Group C"],
  ["Runner-up Group K", "Runner-up Group L"],
  ["Winner Group H", "Runner-up Group J"],
  ["Winner Group D", "Best 3rd (Groups B/E/F/I/J)"],
  ["Winner Group G", "Best 3rd (Groups A/E/H/I/J)"],
  ["Winner Group C", "Runner-up Group F"],
  ["Runner-up Group E", "Runner-up Group I"],
  ["Winner Group A", "Best 3rd (Groups C/E/F/H/I)"],
  ["Winner Group L", "Best 3rd (Groups E/H/I/J/K)"],
  ["Winner Group J", "Runner-up Group H"],
  ["Runner-up Group D", "Runner-up Group G"],
  ["Winner Group B", "Best 3rd (Groups E/F/G/I/J)"],
  ["Winner Group K", "Best 3rd (Groups D/E/I/J/L)"],
];

const FLAG_STYLES = {
  "África do Sul": ["#007749", "#ffb81c", "#de3831"],
  Alemanha: ["#000000", "#dd0000", "#ffce00"],
  Argélia: ["#006233", "#ffffff", "#d21034"],
  Argentina: ["#75aadb", "#ffffff", "#f6b40e"],
  Austrália: ["#012169", "#ffffff", "#e4002b"],
  Áustria: ["#ed2939", "#ffffff", "#ed2939"],
  Bélgica: ["#000000", "#fae042", "#ed2939"],
  "Bósnia e Herzegovina": ["#002395", "#fecb00", "#ffffff"],
  Brasil: ["#009b3a", "#ffdf00", "#002776"],
  "Cabo Verde": ["#003893", "#ffffff", "#cf2027"],
  Canadá: ["#ff0000", "#ffffff", "#ff0000"],
  Catar: ["#8a1538", "#ffffff", "#8a1538"],
  Colômbia: ["#fcd116", "#003893", "#ce1126"],
  "Coreia do Sul": ["#ffffff", "#c60c30", "#003478"],
  "Costa do Marfim": ["#f77f00", "#ffffff", "#009e60"],
  Croácia: ["#ff0000", "#ffffff", "#171796"],
  Curaçao: ["#002b7f", "#f9e814", "#ffffff"],
  Egito: ["#ce1126", "#ffffff", "#000000"],
  Equador: ["#ffdd00", "#034ea2", "#ed1c24"],
  Escócia: ["#0065bd", "#ffffff", "#0065bd"],
  Espanha: ["#aa151b", "#f1bf00", "#aa151b"],
  "Estados Unidos": ["#b22234", "#ffffff", "#3c3b6e"],
  França: ["#0055a4", "#ffffff", "#ef4135"],
  Gana: ["#ce1126", "#fcd116", "#006b3f"],
  Haiti: ["#00209f", "#d21034", "#ffffff"],
  Holanda: ["#ae1c28", "#ffffff", "#21468b"],
  Inglaterra: ["#ffffff", "#ce1124", "#ffffff"],
  Irã: ["#239f40", "#ffffff", "#da0000"],
  Iraque: ["#ce1126", "#ffffff", "#000000"],
  Japão: ["#ffffff", "#bc002d", "#ffffff"],
  Jordânia: ["#000000", "#ffffff", "#007a3d"],
  Marrocos: ["#c1272d", "#006233", "#c1272d"],
  México: ["#006847", "#ffffff", "#ce1126"],
  "Nova Zelândia": ["#00247d", "#cc142b", "#ffffff"],
  Noruega: ["#ba0c2f", "#ffffff", "#00205b"],
  Panamá: ["#ffffff", "#d21034", "#005293"],
  Paraguai: ["#d52b1e", "#ffffff", "#0038a8"],
  Portugal: ["#006600", "#ff0000", "#ffcc00"],
  "RD Congo": ["#00a3e0", "#f7d618", "#ce1021"],
  "República Tcheca": ["#ffffff", "#d7141a", "#11457e"],
  Senegal: ["#00853f", "#fdef42", "#e31b23"],
  Suécia: ["#006aa7", "#fecc00", "#006aa7"],
  Suíça: ["#ff0000", "#ffffff", "#ff0000"],
  Tunísia: ["#e70013", "#ffffff", "#e70013"],
  Turquia: ["#e30a17", "#ffffff", "#e30a17"],
  Uruguai: ["#ffffff", "#0038a8", "#fcd116"],
  Uzbequistão: ["#1eb53a", "#0099b5", "#ce1126"],
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const elements = {
  upcomingSection: document.querySelector("#upcoming-section"),
  upcomingGames: document.querySelector("#upcoming-games"),
  brazilSection: document.querySelector("#brazil-section"),
  brazilTitleRank: document.querySelector("#brazil-title-rank"),
  brazilChampionProb: document.querySelector("#brazil-champion-prob"),
  brazilNextGame: document.querySelector("#brazil-next-game"),
  brazilScorelines: document.querySelector("#brazil-scorelines"),
  favoritesSection: document.querySelector("#favorites-section"),
  favoritesGrid: document.querySelector("#favorites-grid"),
  simulationsDetail: document.querySelector("#simulations-detail"),
  probabilityMapSection: document.querySelector("#probability-map-section"),
  probabilityMap: document.querySelector("#probability-map"),
  mapTooltip: document.querySelector("#map-tooltip"),
  bracketSection: document.querySelector("#bracket-section"),
  bracketBoard: document.querySelector("#bracket-board"),
  bracketStatus: document.querySelector("#bracket-status"),
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
let cachedLiveMatches = [];
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

function isMatchConfirmedLive(liveMatch) {
  return liveMatch?.status === "live";
}

function isMatchConfirmedFinished(liveMatch) {
  return liveMatch?.status === "finished";
}

function isActiveMatch(matchDate, liveMatch, now = new Date()) {
  if (isMatchConfirmedLive(liveMatch)) return true;
  if (isMatchConfirmedFinished(liveMatch)) return false;
  return isLiveMatch(matchDate, now);
}

function shouldShowScheduleMatch(matchDate, liveMatch, now = new Date()) {
  const start = new Date(matchDate).getTime();
  if (!Number.isFinite(start)) return false;
  if (isMatchConfirmedLive(liveMatch)) return true;
  if (isMatchConfirmedFinished(liveMatch) && start <= now.getTime()) return false;
  return start > now.getTime() || isLiveMatch(matchDate, now);
}

function countdownBadge(value, liveMatch = null) {
  if (isActiveMatch(value, liveMatch)) {
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

async function fetchLiveMatches() {
  if (!isConfigured()) return [];
  try {
    const response = await supabase
      .from("live_matches")
      .select("match_id,live_home_goals,live_away_goals,status,minute,updated_at")
      .in("status", ["live", "finished"]);
    if (response.error) throw response.error;
    return response.data ?? [];
  } catch (error) {
    // A tabela live_matches é incremental: enquanto o SQL novo não for aplicado,
    // o painel continua funcionando sem a camada de placar ao vivo.
    console.warn("Placares ao vivo indisponíveis.", error);
    return [];
  }
}

function renderUpcomingGames(games) {
  elements.upcomingGames.innerHTML = games.map(({ game, prediction, date, liveMatch }) => `
    <article class="upcoming-card">
      <div class="upcoming-card-top">
        ${countdownBadge(date, liveMatch)}
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
          ${liveScoreBlock(prediction, liveMatch)}
        ` : '<span class="prediction-unavailable">Previsão não disponível</span>'}
      </div>
    </article>
  `).join("");
  elements.upcomingSection.hidden = false;
}

async function loadUpcomingGames() {
  elements.upcomingSection.hidden = true;
  try {
    const [predictions, liveMatches] = await Promise.all([
      fetchPredictionsForUpcoming(),
      fetchLiveMatches(),
    ]);
    cachedPredictions = predictions;
    cachedLiveMatches = liveMatches;
    const liveByMatchId = new Map(liveMatches.map((match) => [match.match_id, match]));
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
      return { game, prediction, date, liveMatch: liveByMatchId.get(prediction.match_id) };
    }).filter(({ date, liveMatch }) => shouldShowScheduleMatch(date, liveMatch, now))
      .sort((a, b) => a.date - b.date)
      .slice(0, 3);

    if (upcoming.length) renderUpcomingGames(upcoming);
    updateLiveIndicator(hasLiveGame(now));
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

function scoreOutcome(homeGoals, awayGoals) {
  const home = Number(homeGoals);
  const away = Number(awayGoals);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

function predictionVsLive(prediction, liveMatch) {
  if (!prediction || !liveMatch || liveMatch.status !== "live") return null;
  const predictedOutcome = scoreOutcome(
    prediction.predicted_home_goals,
    prediction.predicted_away_goals,
  );
  const liveOutcome = scoreOutcome(liveMatch.live_home_goals, liveMatch.live_away_goals);
  if (!predictedOutcome || !liveOutcome) return null;
  return {
    resultCorrect: predictedOutcome === liveOutcome,
    exactScore:
      Number(prediction.predicted_home_goals) === Number(liveMatch.live_home_goals)
      && Number(prediction.predicted_away_goals) === Number(liveMatch.live_away_goals),
  };
}

function liveScoreBlock(prediction, liveMatch) {
  const comparison = predictionVsLive(prediction, liveMatch);
  if (!comparison) return "";
  const minute = liveMatch.minute ? ` · ${escapeHtml(liveMatch.minute)}` : "";
  return `
    <div class="live-score-card">
      <div class="live-score-top">
        <span>Placar ao vivo${minute}</span>
        <strong>${liveMatch.live_home_goals} × ${liveMatch.live_away_goals}</strong>
      </div>
      <div class="live-score-badges">
        <span class="live-badge ${comparison.resultCorrect ? "live-badge-ok" : "live-badge-warn"}">
          ${comparison.resultCorrect ? "Resultado batendo" : "Resultado divergente"}
        </span>
        <span class="live-badge ${comparison.exactScore ? "live-badge-ok" : "live-badge-warn"}">
          ${comparison.exactScore ? "Placar exato agora" : "Placar ainda não"}
        </span>
      </div>
    </div>`;
}

function hasLiveGame(now = new Date()) {
  return cachedLiveMatches.some((match) => match.status === "live")
    || cachedPredictions.some((prediction) => isLiveMatch(prediction.match_date, now));
}

function positionBrazilSection(isBrazilLive) {
  const parent = elements.brazilSection.parentElement;
  if (!parent) return;

  elements.brazilSection.classList.toggle("brazil-live-section", isBrazilLive);
  if (isBrazilLive) {
    parent.insertBefore(elements.brazilSection, elements.upcomingSection);
    return;
  }

  const nextNode = elements.upcomingSection.nextSibling;
  if (nextNode !== elements.brazilSection) {
    parent.insertBefore(elements.brazilSection, nextNode);
  }
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

function slotShortLabel(slot) {
  const winner = slot.match(/^Winner Group ([A-L])$/);
  if (winner) return `1${winner[1]}`;
  const runner = slot.match(/^Runner-up Group ([A-L])$/);
  if (runner) return `2${runner[1]}`;
  const third = slot.match(/^Best 3rd/);
  if (third) return "3º";
  return "—";
}

function allowedThirdGroups(slot) {
  const match = slot.match(/^Best 3rd \(Groups ([A-L/]+)\)$/);
  return match ? match[1].split("/") : [];
}

function flagToken(team) {
  if (!team) return '<span class="flag-token flag-empty" aria-hidden="true"></span>';
  const colors = FLAG_STYLES[team] ?? ["#0d2637", "#8ee000", "#ffc400"];
  const specialClass = {
    "África do Sul": "flag-south-africa",
    Alemanha: "flag-germany",
    Argentina: "flag-argentina",
    Austrália: "flag-australia",
    Bélgica: "flag-belgium",
    Brasil: "flag-brazil",
    Canadá: "flag-canada",
    Colômbia: "flag-colombia",
    "Costa do Marfim": "flag-ivory-coast",
    Croácia: "flag-croatia",
    Egito: "flag-egypt",
    Espanha: "flag-spain",
    "Estados Unidos": "flag-usa",
    França: "flag-france",
    Gana: "flag-ghana",
    Holanda: "flag-netherlands",
    Inglaterra: "flag-england",
    Irã: "flag-iran",
    Japão: "flag-japan",
    Marrocos: "flag-morocco",
    México: "flag-mexico",
    Noruega: "flag-norway",
    Paraguai: "flag-paraguay",
    Portugal: "flag-portugal",
    Senegal: "flag-senegal",
    Suíça: "flag-switzerland",
    Turquia: "flag-turkey",
    Uruguai: "flag-uruguay",
  }[team] ?? "";
  return `
    <span class="flag-token ${specialClass}" aria-hidden="true"
      style="--flag-a:${colors[0]};--flag-b:${colors[1]};--flag-c:${colors[2]}">
    </span>`;
}

function emptyStanding(team) {
  return { team, points: 0, gf: 0, ga: 0, wins: 0, played: 0 };
}

function registerGroupResult(table, home, away, homeGoals, awayGoals) {
  table[home].played += 1;
  table[away].played += 1;
  table[home].gf += homeGoals;
  table[home].ga += awayGoals;
  table[away].gf += awayGoals;
  table[away].ga += homeGoals;
  if (homeGoals > awayGoals) {
    table[home].points += 3;
    table[home].wins += 1;
  } else if (awayGoals > homeGoals) {
    table[away].points += 3;
    table[away].wins += 1;
  } else {
    table[home].points += 1;
    table[away].points += 1;
  }
}

function buildGroupTables(predictions, results) {
  const resultByMatch = new Map(results.map((result) => [result.match_id, result]));
  const groupByTeam = new Map();
  const tables = {};
  const completedGroups = new Set();

  for (const [group, teams] of Object.entries(OFFICIAL_GROUPS)) {
    tables[group] = {};
    for (const team of teams.map(displayTeam)) {
      tables[group][team] = emptyStanding(team);
      groupByTeam.set(team, group);
    }
  }

  for (const prediction of predictions) {
    if (!String(prediction.round ?? "").toLowerCase().includes("fase de grupos")) continue;
    const result = resultByMatch.get(prediction.match_id);
    if (!result) continue;
    const home = displayTeam(prediction.home_team);
    const away = displayTeam(prediction.away_team);
    const group = groupByTeam.get(home) ?? groupByTeam.get(away);
    if (!group || !tables[group]?.[home] || !tables[group]?.[away]) continue;
    registerGroupResult(
      tables[group],
      home,
      away,
      Number(result.actual_home_goals),
      Number(result.actual_away_goals),
    );
  }

  const standings = {};
  for (const [group, table] of Object.entries(tables)) {
    standings[group] = Object.values(table)
      .map((row) => ({ ...row, gd: row.gf - row.ga }))
      .sort((a, b) => (
        b.points - a.points
        || b.gd - a.gd
        || b.gf - a.gf
        || b.wins - a.wins
        || a.team.localeCompare(b.team, "pt-BR")
      ));
    if (standings[group].every((row) => row.played === 3)) completedGroups.add(group);
  }

  return { standings, completedGroups };
}

function assignThirdPlaces(standings, completedGroups) {
  if (completedGroups.size < Object.keys(OFFICIAL_GROUPS).length) return {};

  const thirdByGroup = Object.fromEntries(
    Object.entries(standings)
      .map(([group, rows]) => ({ group, ...rows[2] }))
      .sort((a, b) => (
        b.points - a.points
        || b.gd - a.gd
        || b.gf - a.gf
        || b.wins - a.wins
        || a.team.localeCompare(b.team, "pt-BR")
      ))
      .slice(0, 8)
      .map((row) => [row.group, row.team]),
  );

  const thirdSlots = ROUND_OF_32
    .flat()
    .filter((slot) => slot.startsWith("Best 3rd"))
    .sort((a, b) => (
      allowedThirdGroups(a).filter((group) => thirdByGroup[group]).length
      - allowedThirdGroups(b).filter((group) => thirdByGroup[group]).length
    ));

  function backtrack(index = 0, used = new Set(), assigned = {}) {
    if (index === thirdSlots.length) return { ...assigned };
    const slot = thirdSlots[index];
    for (const group of allowedThirdGroups(slot)) {
      if (!thirdByGroup[group] || used.has(group)) continue;
      used.add(group);
      assigned[slot] = thirdByGroup[group];
      const solved = backtrack(index + 1, used, assigned);
      if (solved) return solved;
      used.delete(group);
      delete assigned[slot];
    }
    return null;
  }

  return backtrack() ?? {};
}

function resolveBracketSlot(slot, standings, completedGroups, thirdAssignment) {
  const winner = slot.match(/^Winner Group ([A-L])$/);
  if (winner) return completedGroups.has(winner[1]) ? standings[winner[1]]?.[0]?.team : null;
  const runner = slot.match(/^Runner-up Group ([A-L])$/);
  if (runner) return completedGroups.has(runner[1]) ? standings[runner[1]]?.[1]?.team : null;
  if (slot.startsWith("Best 3rd")) return thirdAssignment[slot] ?? null;
  return null;
}

function bracketSlot(slot, team) {
  return `
    <div class="bracket-slot ${team ? "is-filled" : ""}" title="${escapeHtml(slot)}">
      <span class="slot-seed">${escapeHtml(slotShortLabel(slot))}</span>
      ${flagToken(team)}
      <strong>${team ? escapeHtml(team) : "A definir"}</strong>
    </div>`;
}

function bracketMatch(match, standings, completedGroups, thirdAssignment) {
  const [homeSlot, awaySlot] = match;
  const home = resolveBracketSlot(homeSlot, standings, completedGroups, thirdAssignment);
  const away = resolveBracketSlot(awaySlot, standings, completedGroups, thirdAssignment);
  return `
    <article class="bracket-match ${(home || away) ? "has-team" : ""}">
      ${bracketSlot(homeSlot, home)}
      ${bracketSlot(awaySlot, away)}
    </article>`;
}

function futureBracketNode(label, size = "normal") {
  return `
    <article class="bracket-future bracket-future-${size}">
      <span class="flag-token flag-empty" aria-hidden="true"></span>
      <strong>${escapeHtml(label)}</strong>
    </article>`;
}

function renderBracket(predictions, results) {
  if (!elements.bracketSection || !predictions.length) return;
  const { standings, completedGroups } = buildGroupTables(predictions, results);
  const thirdAssignment = assignThirdPlaces(standings, completedGroups);
  const filledRound32 = ROUND_OF_32.flat()
    .map((slot) => resolveBracketSlot(slot, standings, completedGroups, thirdAssignment))
    .filter(Boolean).length;

  const columns = [
    { title: "Fase de 32", side: "left", items: ROUND_OF_32.slice(0, 8).map((match) => bracketMatch(match, standings, completedGroups, thirdAssignment)) },
    { title: "Oitavas", side: "left", items: Array.from({ length: 4 }, (_, index) => futureBracketNode(`Vencedor ${73 + index * 2}`)) },
    { title: "Quartas", side: "left", items: Array.from({ length: 2 }, (_, index) => futureBracketNode(`Quartas ${index + 1}`)) },
    { title: "Semi", side: "left", items: [futureBracketNode("Semifinal 1", "large")] },
    {
      title: "Campeão",
      side: "center",
      items: [
        futureBracketNode("Campeão", "trophy"),
        futureBracketNode("3º lugar", "third"),
      ],
    },
    { title: "Semi", side: "right", items: [futureBracketNode("Semifinal 2", "large")] },
    { title: "Quartas", side: "right", items: Array.from({ length: 2 }, (_, index) => futureBracketNode(`Quartas ${index + 3}`)) },
    { title: "Oitavas", side: "right", items: Array.from({ length: 4 }, (_, index) => futureBracketNode(`Vencedor ${81 + index * 2}`)) },
    { title: "Fase de 32", side: "right", items: ROUND_OF_32.slice(8).map((match) => bracketMatch(match, standings, completedGroups, thirdAssignment)) },
  ];

  elements.bracketStatus.innerHTML = `
    <span>${completedGroups.size}/12 grupos completos</span>
    <span>${filledRound32}/32 vagas preenchidas</span>
    <span>${Object.keys(thirdAssignment).length ? "Melhores terceiros definidos" : "Melhores terceiros aguardando fechamento dos grupos"}</span>`;
  elements.bracketBoard.innerHTML = columns.map((column) => `
    <div class="bracket-column bracket-${column.side}">
      <h3>${escapeHtml(column.title)}</h3>
      <div class="bracket-column-items">${column.items.join("")}</div>
    </div>
  `).join("");
  elements.bracketSection.hidden = false;
}

async function loadBracket() {
  if (!elements.bracketSection || !isConfigured()) return;
  try {
    const [predictionsResponse, resultsResponse] = await Promise.all([
      supabase.from("predictions").select("match_id,home_team,away_team,round").order("match_id"),
      supabase.from("results").select("match_id,actual_home_goals,actual_away_goals"),
    ]);
    if (predictionsResponse.error) throw predictionsResponse.error;
    if (resultsResponse.error) throw resultsResponse.error;
    renderBracket(predictionsResponse.data ?? [], resultsResponse.data ?? []);
  } catch (error) {
    console.warn("Chaveamento indisponível.", error);
    elements.bracketSection.hidden = true;
  }
}

function championPercent(value) {
  return `${(Number(value ?? 0) * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function brazilResultProbability(match, brazilIsHome, opponent) {
  const brazilWin = Number(brazilIsHome ? match.home_win_prob : match.away_win_prob);
  const opponentWin = Number(brazilIsHome ? match.away_win_prob : match.home_win_prob);
  const brazilPct = Math.round(brazilWin * 100);
  const opponentPct = Math.round(opponentWin * 100);
  // O empate absorve o ajuste de arredondamento para a barra sempre fechar em 100%.
  const drawPct = Math.max(0, 100 - brazilPct - opponentPct);

  return `
    <div class="probability brazil-result-probability"
         aria-label="Brasil vence ${brazilPct}%, empate ${drawPct}%, ${escapeHtml(opponent)} vence ${opponentPct}%">
      <div class="probability-labels">
        <span>Brasil vence ${brazilPct}%</span>
        <span>Empate ${drawPct}%</span>
        <span>${escapeHtml(opponent)} vence ${opponentPct}%</span>
      </div>
      <div class="probability-bar">
        <span class="prob-home" style="width:${clampPercent(brazilPct)}%"></span>
        <span class="prob-draw" style="width:${clampPercent(drawPct)}%"></span>
        <span class="prob-away" style="width:${clampPercent(opponentPct)}%"></span>
      </div>
    </div>`;
}

function poissonDistribution(lambda, maxGoals = 8) {
  const values = [];
  let total = 0;
  for (let goals = 0; goals <= maxGoals; goals += 1) {
    let factorial = 1;
    for (let index = 2; index <= goals; index += 1) factorial *= index;
    const probability = (Math.exp(-lambda) * (lambda ** goals)) / factorial;
    values.push(probability);
    total += probability;
  }
  return values.map((probability) => probability / total);
}

function outcomeFromLambdas(homeLambda, awayLambda) {
  const homeDistribution = poissonDistribution(homeLambda);
  const awayDistribution = poissonDistribution(awayLambda);
  let home = 0;
  let draw = 0;
  let away = 0;

  for (let homeGoals = 0; homeGoals < homeDistribution.length; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals < awayDistribution.length; awayGoals += 1) {
      const probability = homeDistribution[homeGoals] * awayDistribution[awayGoals];
      if (homeGoals > awayGoals) home += probability;
      else if (homeGoals === awayGoals) draw += probability;
      else away += probability;
    }
  }

  return { home, draw, away };
}

function estimatePoissonLambdas(match) {
  const targetHome = Number(match.home_win_prob);
  const targetDraw = Number(match.draw_prob);
  const targetAway = Number(match.away_win_prob);
  const predictedHome = Number(match.predicted_home_goals ?? 1.4);
  const predictedAway = Number(match.predicted_away_goals ?? 1);
  let best = { homeLambda: Math.max(0.25, predictedHome), awayLambda: Math.max(0.25, predictedAway), loss: Number.POSITIVE_INFINITY };

  for (let homeLambda = 0.2; homeLambda <= 4.05; homeLambda += 0.1) {
    for (let awayLambda = 0.2; awayLambda <= 4.05; awayLambda += 0.1) {
      const outcome = outcomeFromLambdas(homeLambda, awayLambda);
      const probabilityLoss =
        ((outcome.home - targetHome) ** 2)
        + ((outcome.draw - targetDraw) ** 2)
        + ((outcome.away - targetAway) ** 2);
      const scoreLoss = 0.015 * (
        ((homeLambda - predictedHome) ** 2)
        + ((awayLambda - predictedAway) ** 2)
      );
      const loss = probabilityLoss + scoreLoss;
      if (loss < best.loss) best = { homeLambda, awayLambda, loss };
    }
  }

  return best;
}

function mostLikelyBrazilScores(match, brazilIsHome) {
  const { homeLambda, awayLambda } = estimatePoissonLambdas(match);
  const homeDistribution = poissonDistribution(homeLambda, 7);
  const awayDistribution = poissonDistribution(awayLambda, 7);
  const scorelines = [];

  for (let homeGoals = 0; homeGoals < homeDistribution.length; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals < awayDistribution.length; awayGoals += 1) {
      scorelines.push({
        brazilGoals: brazilIsHome ? homeGoals : awayGoals,
        opponentGoals: brazilIsHome ? awayGoals : homeGoals,
        probability: homeDistribution[homeGoals] * awayDistribution[awayGoals],
      });
    }
  }

  return scorelines
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3);
}

async function fetchChampionshipOdds() {
  const response = await supabase
    .from("championship_odds")
    .select("team,champion_prob,eliminated,simulations_run,updated_at")
    .order("champion_prob", { ascending: false });
  if (response.error) throw response.error;
  return response.data ?? [];
}

function renderBrazilSection(odds, predictions, liveMatches = cachedLiveMatches) {
  const brazil = odds.find((row) => row.team === "Brasil");
  if (!brazil) {
    elements.brazilSection.hidden = true;
    return;
  }

  const titleRanking = [...odds]
    .sort((a, b) => Number(b.champion_prob) - Number(a.champion_prob))
    .findIndex((row) => row.team === "Brasil") + 1;

  if (brazil.eliminated) {
    elements.brazilTitleRank.textContent = "—";
  } else {
    elements.brazilTitleRank.innerHTML = `${titleRanking || "—"}<sup>º</sup>`;
  }

  elements.brazilChampionProb.classList.toggle("is-eliminated", Boolean(brazil.eliminated));
  if (brazil.eliminated) {
    elements.brazilChampionProb.textContent = "Eliminado";
  } else {
    elements.brazilChampionProb.innerHTML = `
      <span>${championPercent(brazil.champion_prob)}</span>
      <small>de chance de ser campeão</small>`;
  }

  if (brazil.eliminated) {
    elements.brazilNextGame.hidden = true;
    elements.brazilScorelines.hidden = true;
    positionBrazilSection(false);
  } else {
    const now = new Date();
    const liveByMatchId = new Map(liveMatches.map((match) => [match.match_id, match]));
    const brazilGames = predictions
      .filter((prediction) => (
        displayTeam(prediction.home_team) === "Brasil"
        || displayTeam(prediction.away_team) === "Brasil"
      ))
      .map((prediction) => {
        const liveMatch = liveByMatchId.get(prediction.match_id);
        return {
          ...prediction,
          liveMatch,
          is_live: isActiveMatch(prediction.match_date, liveMatch, now),
          starts_at: new Date(prediction.match_date),
        };
      })
      .filter((prediction) => shouldShowScheduleMatch(
        prediction.match_date,
        prediction.liveMatch,
        now,
      ))
      .sort((a, b) => {
        if (a.is_live !== b.is_live) return a.is_live ? -1 : 1;
        return a.starts_at - b.starts_at;
      });
    const nextGame = brazilGames[0];
    const isBrazilLive = Boolean(nextGame?.is_live);
    const liveMatch = nextGame?.liveMatch ?? null;
    positionBrazilSection(isBrazilLive);

    elements.brazilNextGame.hidden = false;
    elements.brazilScorelines.hidden = false;
    if (!nextGame) {
      elements.brazilNextGame.innerHTML = `
        <span class="brazil-game-kicker">Próximo jogo do Brasil</span>
        <strong class="brazil-matchup">Nenhum jogo previsto</strong>`;
      elements.brazilScorelines.innerHTML = `
        <span class="brazil-card-kicker">Placares mais prováveis</span>
        <strong class="scorelines-match">Aguardando previsão</strong>`;
    } else {
      const brazilIsHome = displayTeam(nextGame.home_team) === "Brasil";
      const opponent = displayTeam(brazilIsHome ? nextGame.away_team : nextGame.home_team);
      const brazilGoals = brazilIsHome ? nextGame.predicted_home_goals : nextGame.predicted_away_goals;
      const opponentGoals = brazilIsHome ? nextGame.predicted_away_goals : nextGame.predicted_home_goals;
      const scorelines = mostLikelyBrazilScores(nextGame, brazilIsHome);
      elements.brazilNextGame.innerHTML = `
        <span class="brazil-game-kicker">${isBrazilLive ? "Brasil em campo agora" : "Próximo jogo do Brasil"}</span>
        ${isBrazilLive ? `
          <a class="brazil-live-pill" href="https://www.youtube.com/@CazéTV"
             target="_blank" rel="noopener noreferrer">AGORA</a>
        ` : ""}
        <strong class="brazil-matchup">Brasil <small>×</small> ${escapeHtml(opponent)}</strong>
        <span class="brazil-game-date">${formatBrasilia(nextGame.match_date)} · Brasília</span>
        <span class="prediction-label brazil-prediction-label">Palpite principal</span>
        <strong class="brazil-main-score">${brazilGoals} <small>×</small> ${opponentGoals}</strong>
        ${brazilResultProbability(nextGame, brazilIsHome, opponent)}
        ${liveScoreBlock(nextGame, liveMatch)}`;
      elements.brazilScorelines.innerHTML = `
        <span class="brazil-card-kicker">Placares mais prováveis</span>
        <strong class="scorelines-match">Brasil × ${escapeHtml(opponent)}</strong>
        <div class="scoreline-ranking">
          ${scorelines.map((scoreline, index) => `
            <div class="scoreline-row ${index === 0 ? "is-leading" : ""}">
              <span class="scoreline-position">${index + 1}º</span>
              <strong>${scoreline.brazilGoals} × ${scoreline.opponentGoals}</strong>
              <span>${championPercent(scoreline.probability)}</span>
            </div>
          `).join("")}
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
      <strong class="favorite-team">${escapeHtml(row.team)}</strong>
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
    const [odds, predictions, liveMatches] = await Promise.all([
      fetchChampionshipOdds(),
      cachedPredictions.length ? Promise.resolve(cachedPredictions) : fetchPredictionsForUpcoming(),
      cachedLiveMatches.length ? Promise.resolve(cachedLiveMatches) : fetchLiveMatches(),
    ]);
    if (!odds.length) return;
    cachedLiveMatches = liveMatches;
    renderBrazilSection(odds, predictions, liveMatches);
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
  const live = hasLiveGame(now);
  updateLiveIndicator(live);

  const current = Date.now();
  const shouldRefreshLive = live && current - lastDashboardRefresh >= LIVE_REFRESH_INTERVAL_MS;
  const shouldRefreshIdle = !live && current - lastIdleRefresh >= IDLE_REFRESH_INTERVAL_MS;
  if (!shouldRefreshLive && !shouldRefreshIdle) return;

  dashboardRefreshInFlight = true;
  try {
    if (shouldRefreshLive) {
      await Promise.all([loadDashboard(true), loadUpcomingGames(), loadChampionshipFeatures(), loadBracket()]);
    } else {
      await loadUpcomingGames();
      await loadChampionshipFeatures();
      await loadBracket();
    }
  } finally {
    dashboardRefreshInFlight = false;
  }
}

async function initializeDashboard() {
  await Promise.all([loadDashboard(), loadUpcomingGames(), loadBracket()]);
  await loadChampionshipFeatures();
  setInterval(pollingTick, LIVE_CHECK_INTERVAL_MS);
}

initializeDashboard();
