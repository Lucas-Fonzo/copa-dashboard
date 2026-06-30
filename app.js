import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Use somente a URL pública e a anon key. Nunca coloque a service_role no frontend.
const SUPABASE_URL = "https://tmkzvfxpdyoetdfrysfn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_qmH14lt88_rdosFL8A_w_PnSOzeVU";

const EXTRA_TIME_INTENSITY = 0.95;
const EXTRA_TIME_SHARE_OF_MATCH = 30 / 90;

const TEAM_NAME_MAP = {
  Brazil: "Brasil", Germany: "Alemanha", France: "França", England: "Inglaterra",
  Spain: "Espanha", Netherlands: "Holanda", Croatia: "Croácia", Morocco: "Marrocos",
  Mexico: "México", "United States": "Estados Unidos", USA: "Estados Unidos",
  "South Korea": "Coreia do Sul", "South Africa": "África do Sul",
  "Saudi Arabia": "Arábia Saudita", "New Zealand": "Nova Zelândia",
  "Ivory Coast": "Costa do Marfim", "Côte d'Ivoire": "Costa do Marfim",
  "Cape Verde": "Cabo Verde", Switzerland: "Suíça", Belgium: "Bélgica",
  Australia: "Austrália", Austria: "Áustria", "Czech Republic": "República Tcheca",
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

const KNOCKOUT_MATCHES = {
  73: ["Runner-up Group A", "Runner-up Group B"],
  74: ["Winner Group E", "Best 3rd (Groups A/B/C/D/F)"],
  75: ["Winner Group F", "Runner-up Group C"],
  76: ["Winner Group C", "Runner-up Group F"],
  77: ["Winner Group I", "Best 3rd (Groups C/D/F/G/H)"],
  78: ["Runner-up Group E", "Runner-up Group I"],
  79: ["Winner Group A", "Best 3rd (Groups C/E/F/H/I)"],
  80: ["Winner Group L", "Best 3rd (Groups E/H/I/J/K)"],
  81: ["Winner Group D", "Best 3rd (Groups B/E/F/I/J)"],
  82: ["Winner Group G", "Best 3rd (Groups A/E/H/I/J)"],
  83: ["Runner-up Group K", "Runner-up Group L"],
  84: ["Winner Group H", "Runner-up Group J"],
  85: ["Winner Group B", "Best 3rd (Groups E/F/G/I/J)"],
  86: ["Winner Group J", "Runner-up Group H"],
  87: ["Winner Group K", "Best 3rd (Groups D/E/I/J/L)"],
  88: ["Runner-up Group D", "Runner-up Group G"],
};

const THIRD_PLACE_ASSIGNMENT_OVERRIDES = {
  // Combinação real dos 8 melhores terceiros da fase de grupos.
  // Sem isso, o backtracking encontra uma solução válida matematicamente,
  // mas não necessariamente o encaixe oficial do chaveamento.
  "B/D/E/F/I/J/K/L": {
    "Best 3rd (Groups A/B/C/D/F)": "D",
    "Best 3rd (Groups C/D/F/G/H)": "F",
    "Best 3rd (Groups B/E/F/I/J)": "B",
    "Best 3rd (Groups A/E/H/I/J)": "I",
    "Best 3rd (Groups C/E/F/H/I)": "E",
    "Best 3rd (Groups E/H/I/J/K)": "K",
    "Best 3rd (Groups E/F/G/I/J)": "J",
    "Best 3rd (Groups D/E/I/J/L)": "L",
  },
};

const KNOCKOUT_ADVANCEMENT_OVERRIDES = {
  // Resultado empatado no tempo/prorrogação, decidido nos pênaltis.
  // O schema atual de results guarda apenas gols, então registramos aqui
  // quem avançou para o chaveamento não precisar "adivinhar".
  WC2026_074: { winner: "Paraguay", loser: "Germany", decidedOnPenalties: true },
};

const BRACKET_LAYOUT = {
  left32: [74, 77, 73, 75, 83, 84, 81, 82],
  right32: [76, 78, 79, 80, 86, 88, 85, 87],
  left16: [
    { label: "Oitavas 1", sources: [74, 77] },
    { label: "Oitavas 2", sources: [73, 75] },
    { label: "Oitavas 5", sources: [83, 84] },
    { label: "Oitavas 6", sources: [81, 82] },
  ],
  right16: [
    { label: "Oitavas 3", sources: [76, 78] },
    { label: "Oitavas 4", sources: [79, 80] },
    { label: "Oitavas 7", sources: [86, 88] },
    { label: "Oitavas 8", sources: [85, 87] },
  ],
  leftQuarter: [
    { label: "Quartas 1", sources: [89, 90] },
    { label: "Quartas 2", sources: [93, 94] },
  ],
  rightQuarter: [
    { label: "Quartas 3", sources: [91, 92] },
    { label: "Quartas 4", sources: [95, 96] },
  ],
  leftSemi: { label: "Semifinal 1", sources: [97, 98] },
  rightSemi: { label: "Semifinal 2", sources: [99, 100] },
  centerChampion: 104,
  centerThird: 103,
};

const FUTURE_KNOCKOUT_MATCHES = {
  89: [74, 77],
  90: [73, 75],
  91: [76, 78],
  92: [79, 80],
  93: [83, 84],
  94: [81, 82],
  95: [86, 88],
  96: [85, 87],
  97: [89, 90],
  98: [93, 94],
  99: [91, 92],
  100: [95, 96],
  101: [97, 98],
  102: [99, 100],
  104: [101, 102],
};

const PROJECTABLE_ROUNDS = [
  Object.keys(KNOCKOUT_MATCHES).map(Number).sort((a, b) => a - b),
  [89, 90, 91, 92, 93, 94, 95, 96],
  [97, 98, 99, 100],
  [101, 102],
  [104],
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
  bracketViewport: document.querySelector("#bracket-viewport"),
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
let cachedResults = [];
let cachedScorelineOdds = [];
let cachedBrazilPathPredictions = [];
let brazilCountdownInterval = null;
let brazilCountdownTarget = null;
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

function normalizeLookup(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function displayTeam(name) {
  const rawName = String(name ?? "").trim();
  if (TEAM_NAME_MAP[rawName]) return TEAM_NAME_MAP[rawName];
  const normalizedName = normalizeLookup(rawName);
  const matchedEntry = Object.entries(TEAM_NAME_MAP)
    .find(([source]) => normalizeLookup(source) === normalizedName);
  return matchedEntry?.[1] ?? rawName;
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

function isMatchFinishedByResult(result) {
  return Boolean(result);
}

function isActiveMatch(matchDate, liveMatch, now = new Date(), result = null) {
  if (isMatchFinishedByResult(result)) return false;
  if (isMatchConfirmedLive(liveMatch)) return true;
  if (isMatchConfirmedFinished(liveMatch)) return false;
  return isLiveMatch(matchDate, now);
}

function shouldShowScheduleMatch(matchDate, liveMatch, now = new Date(), result = null) {
  const start = new Date(matchDate).getTime();
  if (!Number.isFinite(start)) return false;
  if (isMatchFinishedByResult(result)) return false;
  if (isMatchConfirmedLive(liveMatch)) return true;
  if (isMatchConfirmedFinished(liveMatch) && start <= now.getTime()) return false;
  return start > now.getTime() || isLiveMatch(matchDate, now);
}

function formatCountdownTime(milliseconds) {
  const safeMs = Math.max(0, milliseconds);
  const totalSeconds = Math.floor(safeMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, "0");

  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

function updateBrazilCountdown() {
  const countdown = document.querySelector(".brazil-countdown[data-countdown-to]");
  if (!countdown) return;

  const target = new Date(countdown.dataset.countdownTo).getTime();
  const remaining = target - Date.now();
  const label = countdown.querySelector(".brazil-countdown-label");
  const value = countdown.querySelector(".brazil-countdown-value");
  if (!label || !value || !Number.isFinite(target)) return;

  if (remaining <= 0) {
    countdown.classList.add("is-started");
    label.textContent = "Jogo come\u00e7ando";
    value.textContent = "agora";
    return;
  }

  countdown.classList.remove("is-started");
  label.textContent = "Come\u00e7a em";
  value.textContent = formatCountdownTime(remaining);
}

function clearBrazilCountdown() {
  if (brazilCountdownInterval) {
    clearInterval(brazilCountdownInterval);
    brazilCountdownInterval = null;
  }
  brazilCountdownTarget = null;
}

function armBrazilCountdown(matchDate, isLive = false) {
  const target = new Date(matchDate).getTime();
  if (isLive || !Number.isFinite(target) || target <= Date.now()) {
    clearBrazilCountdown();
    return;
  }

  if (brazilCountdownTarget === target && brazilCountdownInterval) {
    updateBrazilCountdown();
    return;
  }

  clearBrazilCountdown();
  brazilCountdownTarget = target;
  updateBrazilCountdown();
  brazilCountdownInterval = setInterval(updateBrazilCountdown, 1000);
}

function brazilCountdownMarkup(matchDate, isLive = false) {
  if (isLive) {
    return `
      <div class="brazil-countdown is-live" aria-label="Brasil em campo agora">
        <span class="brazil-countdown-label">Ao vivo</span>
        <strong class="brazil-countdown-value">bola rolando</strong>
      </div>`;
  }

  const target = new Date(matchDate);
  if (!Number.isFinite(target.getTime()) || target.getTime() <= Date.now()) return "";

  return `
    <div class="brazil-countdown" data-countdown-to="${target.toISOString()}" aria-live="polite">
      <span class="brazil-countdown-label">Come\u00e7a em</span>
      <strong class="brazil-countdown-value">${formatCountdownTime(target.getTime() - Date.now())}</strong>
    </div>`;
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
      "match_id,home_team,away_team,predicted_home_goals,predicted_away_goals,home_win_prob,draw_prob,away_win_prob,round,match_date",
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

async function fetchResultsForSchedule() {
  if (!isConfigured()) return [];
  try {
    const response = await supabase
      .from("results")
      .select("match_id,actual_home_goals,actual_away_goals,match_date");
    if (response.error) throw response.error;
    return response.data ?? [];
  } catch (error) {
    console.warn("Resultados indisponíveis para filtrar a agenda.", error);
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
    const [predictions, liveMatches, results] = await Promise.all([
      fetchPredictionsForUpcoming(),
      fetchLiveMatches(),
      fetchResultsForSchedule(),
    ]);
    cachedPredictions = predictions;
    cachedLiveMatches = liveMatches;
    cachedResults = results;
    const liveByMatchId = new Map(liveMatches.map((match) => [match.match_id, match]));
    const resultByMatchId = new Map(results.map((result) => [result.match_id, result]));
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
      return {
        game,
        prediction,
        date,
        liveMatch: liveByMatchId.get(prediction.match_id),
        result: resultByMatchId.get(prediction.match_id),
      };
    }).filter(({ date, liveMatch, result }) => shouldShowScheduleMatch(date, liveMatch, now, result))
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
  const finishedMatchIds = new Set(cachedResults.map((result) => result.match_id));
  return cachedLiveMatches.some((match) => (
    match.status === "live" && !finishedMatchIds.has(match.match_id)
  ))
    || cachedPredictions.some((prediction) => (
      !finishedMatchIds.has(prediction.match_id)
      && isLiveMatch(prediction.match_date, now)
    ));
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
  if (isKnockoutMatch(match)) return advancementProbabilityCell(match);

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

function advancementProbabilities(match) {
  const homeWin90 = Number(match.home_win_prob);
  const draw90 = Number(match.draw_prob);
  const awayWin90 = Number(match.away_win_prob);
  const { homeLambda, awayLambda } = estimatePoissonLambdas(match);
  const extraHomeDistribution = poissonDistribution(
    homeLambda * EXTRA_TIME_SHARE_OF_MATCH * EXTRA_TIME_INTENSITY,
    8,
  );
  const extraAwayDistribution = poissonDistribution(
    awayLambda * EXTRA_TIME_SHARE_OF_MATCH * EXTRA_TIME_INTENSITY,
    8,
  );

  let homeExtraWin = 0;
  let extraDraw = 0;
  let awayExtraWin = 0;
  for (let homeGoals = 0; homeGoals < extraHomeDistribution.length; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals < extraAwayDistribution.length; awayGoals += 1) {
      const probability = extraHomeDistribution[homeGoals] * extraAwayDistribution[awayGoals];
      if (homeGoals > awayGoals) homeExtraWin += probability;
      else if (homeGoals === awayGoals) extraDraw += probability;
      else awayExtraWin += probability;
    }
  }

  const strongerIsHome = homeWin90 >= awayWin90;
  const homePenaltyShare = strongerIsHome ? 0.60 : 0.40;
  const awayPenaltyShare = 1 - homePenaltyShare;
  const homeAdvance = homeWin90 + (draw90 * (homeExtraWin + (extraDraw * homePenaltyShare)));
  const awayAdvance = awayWin90 + (draw90 * (awayExtraWin + (extraDraw * awayPenaltyShare)));
  const total = homeAdvance + awayAdvance;
  if (total <= 0) return { homeAdvance: 0.5, awayAdvance: 0.5 };
  return {
    homeAdvance: homeAdvance / total,
    awayAdvance: awayAdvance / total,
  };
}

function advancementProbabilityCell(match, homeLabel = "Casa", awayLabel = "Fora") {
  const { homeAdvance, awayAdvance } = advancementProbabilities(match);
  const homePct = Math.round(homeAdvance * 100);
  const awayPct = Math.max(0, 100 - homePct);
  return `
    <div class="probability advancement-probability"
         aria-label="${escapeHtml(homeLabel)} avança ${homePct}%, ${escapeHtml(awayLabel)} avança ${awayPct}%">
      <div class="probability-labels">
        <span>${escapeHtml(homeLabel)} avança ${homePct}%</span>
        <span>${escapeHtml(awayLabel)} avança ${awayPct}%</span>
      </div>
      <div class="probability-bar">
        <span class="prob-home" style="width:${clampPercent(homePct)}%"></span>
        <span class="prob-away" style="width:${clampPercent(awayPct)}%"></span>
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
  const matchWinner = slot.match(/^Vencedor (\d+)$/);
  if (matchWinner) return `V${matchWinner[1]}`;
  return "—";
}

function allowedThirdGroups(slot) {
  const match = slot.match(/^Best 3rd \(Groups ([A-L/]+)\)$/);
  return match ? match[1].split("/") : [];
}

function thirdPlaceAssignmentOverride(thirdByGroup) {
  const key = Object.keys(thirdByGroup).sort().join("/");
  const override = THIRD_PLACE_ASSIGNMENT_OVERRIDES[key];
  if (!override) return null;

  return Object.fromEntries(
    Object.entries(override)
      .filter(([, group]) => thirdByGroup[group])
      .map(([slot, group]) => [slot, thirdByGroup[group]]),
  );
}

function flagToken(team) {
  if (!team) return '<span class="flag-token flag-empty" aria-hidden="true"></span>';
  const normalizedTeam = displayTeam(team);
  const colors = FLAG_STYLES[normalizedTeam] ?? ["#0d2637", "#8ee000", "#ffc400"];
  const specialClass = {
    "África do Sul": "flag-south-africa",
    Alemanha: "flag-germany",
    Argélia: "flag-algeria",
    Argentina: "flag-argentina",
    Austrália: "flag-australia",
    Áustria: "flag-austria",
    Bélgica: "flag-belgium",
    "Bósnia e Herzegovina": "flag-bosnia",
    Brasil: "flag-brazil",
    "Cabo Verde": "flag-cape-verde",
    Canadá: "flag-canada",
    Colômbia: "flag-colombia",
    "Costa do Marfim": "flag-ivory-coast",
    Croácia: "flag-croatia",
    Egito: "flag-egypt",
    Equador: "flag-ecuador",
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
    "RD Congo": "flag-rd-congo",
    Senegal: "flag-senegal",
    Suécia: "flag-sweden",
    Suíça: "flag-switzerland",
    Turquia: "flag-turkey",
    Uruguai: "flag-uruguay",
  }[normalizedTeam] ?? "";
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

  const override = thirdPlaceAssignmentOverride(thirdByGroup);
  if (override && Object.keys(override).length === 8) return override;

  const thirdSlots = Object.values(KNOCKOUT_MATCHES)
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

function bracketSlot(slot, team, fallbackLabel = "A definir", state = "", badge = "") {
  const normalizedTeam = team ? displayTeam(team) : null;
  const stateClass = state ? ` is-${state}` : "";
  return `
    <div class="bracket-slot ${normalizedTeam ? "is-filled" : ""}${stateClass}" title="${escapeHtml(slot)}">
      <span class="slot-seed">${escapeHtml(slotShortLabel(slot))}</span>
      ${flagToken(normalizedTeam)}
      <strong>${normalizedTeam ? escapeHtml(normalizedTeam) : escapeHtml(fallbackLabel)}</strong>
      ${badge ? `<span class="slot-result-badge">${escapeHtml(badge)}</span>` : ""}
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

function normalizedMatchId(matchId) {
  const numericId = Number(String(matchId).replace("WC2026_", ""));
  if (!Number.isFinite(numericId)) return String(matchId);
  return `WC2026_${String(numericId).padStart(3, "0")}`;
}

function actualKnockoutOutcomes(predictions, results) {
  const predictionById = new Map(predictions.map((prediction) => [normalizedMatchId(prediction.match_id), prediction]));
  const winners = new Map();
  const losers = new Map();

  for (const result of results) {
    const matchId = normalizedMatchId(result.match_id);
    const numericId = Number(matchId.replace("WC2026_", ""));
    if (!Number.isFinite(numericId) || numericId < 73) continue;

    const prediction = predictionById.get(matchId);
    if (!prediction) continue;

    const homeGoals = Number(result.actual_home_goals);
    const awayGoals = Number(result.actual_away_goals);
    const advancement = KNOCKOUT_ADVANCEMENT_OVERRIDES[matchId];
    if (homeGoals > awayGoals) {
      winners.set(numericId, prediction.home_team);
      losers.set(numericId, prediction.away_team);
    } else if (awayGoals > homeGoals) {
      winners.set(numericId, prediction.away_team);
      losers.set(numericId, prediction.home_team);
    } else if (advancement?.winner && advancement?.loser) {
      winners.set(numericId, advancement.winner);
      losers.set(numericId, advancement.loser);
    }
  }

  return { winners, losers };
}

function sameTeam(left, right) {
  return normalizeLookup(displayTeam(left)) === normalizeLookup(displayTeam(right));
}

function sameTeamSet(leftTeams, rightTeams) {
  const left = leftTeams.map(displayTeam).map(normalizeLookup).sort().join("|");
  const right = rightTeams.map(displayTeam).map(normalizeLookup).sort().join("|");
  return left === right;
}

function projectedWinnerFromPrediction(prediction, expectedTeams) {
  if (!prediction || expectedTeams.length !== 2 || expectedTeams.some((team) => !team)) return null;
  const predictionTeams = [prediction.home_team, prediction.away_team].map(displayTeam);
  if (!sameTeamSet(predictionTeams, expectedTeams)) return null;

  const homeGoals = Number(prediction.predicted_home_goals);
  const awayGoals = Number(prediction.predicted_away_goals);
  const homeAdvanceProb = Number(prediction.home_win_prob);
  const awayAdvanceProb = Number(prediction.away_win_prob);

  if (homeGoals > awayGoals) return displayTeam(prediction.home_team);
  if (awayGoals > homeGoals) return displayTeam(prediction.away_team);
  if (Number.isFinite(homeAdvanceProb) && Number.isFinite(awayAdvanceProb)) {
    return homeAdvanceProb >= awayAdvanceProb
      ? displayTeam(prediction.home_team)
      : displayTeam(prediction.away_team);
  }
  return null;
}

function championshipOddsMap(odds) {
  return new Map((odds ?? []).map((row) => [
    normalizeLookup(displayTeam(row.team)),
    row.eliminated ? Number.NEGATIVE_INFINITY : Number(row.champion_prob ?? 0),
  ]));
}

function projectedWinnerByOdds(teams, oddsByTeam) {
  const candidates = teams.map(displayTeam).filter(Boolean);
  if (candidates.length !== 2) return null;

  const ranked = candidates
    .map((team) => ({
      team,
      score: oddsByTeam.get(normalizeLookup(team)),
    }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score || a.team.localeCompare(b.team, "pt-BR"));

  return ranked[0]?.team ?? null;
}

function projectedKnockoutOutcomes(predictions, confirmedWinners, confirmedLosers, standings, completedGroups, thirdAssignment, odds = []) {
  const projectedWinners = new Map();
  const projectedLosers = new Map();
  const predictionByNumber = new Map();
  const oddsByTeam = championshipOddsMap(odds);

  for (const prediction of predictions) {
    const matchId = normalizedMatchId(prediction.match_id);
    const numericId = Number(matchId.replace("WC2026_", ""));
    if (Number.isFinite(numericId) && numericId >= 73) {
      predictionByNumber.set(numericId, prediction);
    }
  }

  const winnerOf = (matchId) => confirmedWinners.get(matchId) ?? projectedWinners.get(matchId) ?? null;
  const loserOf = (matchId) => confirmedLosers.get(matchId) ?? projectedLosers.get(matchId) ?? null;

  function setProjectedMatch(matchId, teams) {
    if (confirmedWinners.has(matchId)) return;
    const normalizedTeams = teams.map((team) => (team ? displayTeam(team) : null));
    if (normalizedTeams.length !== 2 || normalizedTeams.some((team) => !team)) return;

    const winner = projectedWinnerFromPrediction(predictionByNumber.get(matchId), normalizedTeams)
      ?? projectedWinnerByOdds(normalizedTeams, oddsByTeam);
    if (!winner) return;

    const loser = normalizedTeams.find((team) => !sameTeam(team, winner)) ?? null;
    projectedWinners.set(matchId, winner);
    if (loser) projectedLosers.set(matchId, loser);
  }

  for (const round of PROJECTABLE_ROUNDS) {
    for (const matchId of round) {
      if (KNOCKOUT_MATCHES[matchId]) {
        setProjectedMatch(
          matchId,
          KNOCKOUT_MATCHES[matchId].map((slot) => (
            resolveBracketSlot(slot, standings, completedGroups, thirdAssignment)
          )),
        );
        continue;
      }

      setProjectedMatch(matchId, (FUTURE_KNOCKOUT_MATCHES[matchId] ?? []).map(winnerOf));
    }
  }

  setProjectedMatch(BRACKET_LAYOUT.centerThird, [
    loserOf(101),
    loserOf(102),
  ]);

  return { winners: projectedWinners, losers: projectedLosers };
}

function bracketOutcome(matchId, confirmedWinners, projectedWinners) {
  if (confirmedWinners.has(matchId)) {
    return { team: confirmedWinners.get(matchId), state: "confirmed" };
  }
  if (projectedWinners.has(matchId)) {
    return { team: projectedWinners.get(matchId), state: "projected" };
  }
  return { team: null, state: "" };
}

function futureBracketNode(label, size = "normal", team = null, state = "", span = 1) {
  const normalizedTeam = team ? displayTeam(team) : null;
  const stateClass = state ? ` is-${state}` : "";
  return `
    <article class="bracket-future bracket-future-${size} bracket-span-${span} ${normalizedTeam ? "has-team" : ""}${stateClass}"
             title="${escapeHtml(label)}">
      ${flagToken(normalizedTeam)}
      <strong>${normalizedTeam ? escapeHtml(normalizedTeam) : escapeHtml(label)}</strong>
    </article>`;
}

function futureBracketMatch(label, sources, confirmedWinners, projectedWinners, size = "normal", span = 1) {
  const outcomes = sources.map((source) => ({
    source,
    ...bracketOutcome(source, confirmedWinners, projectedWinners),
  }));
  return `
    <article class="bracket-match bracket-future-match bracket-future-match-${size} bracket-span-${span}
                    ${outcomes.some((outcome) => outcome.team) ? "has-team" : ""}"
             title="${escapeHtml(label)}">
      ${outcomes.map((outcome) => (
        bracketSlot(
          `Vencedor ${outcome.source}`,
          outcome.team,
          `Vencedor ${outcome.source}`,
          outcome.state,
        )
      )).join("")}
    </article>`;
}

function decisionBracketMatch(label, outcomes, size = "normal", span = 4) {
  return `
    <article class="bracket-match bracket-future-match bracket-decision-match bracket-decision-${size} bracket-span-${span}
                    ${outcomes.some((outcome) => outcome.team) ? "has-team" : ""}"
             title="${escapeHtml(label)}">
      <span class="bracket-decision-title">${escapeHtml(label)}</span>
      ${outcomes.map((outcome) => (
        bracketSlot(
          outcome.slot,
          outcome.team,
          outcome.fallback,
          outcome.state,
          outcome.badge ?? "",
        )
      )).join("")}
    </article>`;
}

function fitBracketBoard() {
  if (!elements.bracketViewport || !elements.bracketBoard || elements.bracketSection.hidden) return;
  requestAnimationFrame(() => {
    const viewportWidth = elements.bracketViewport.clientWidth;
    const boardWidth = elements.bracketBoard.scrollWidth;
    const boardHeight = elements.bracketBoard.scrollHeight;
    if (!viewportWidth || !boardWidth || !boardHeight) return;

    const scale = Math.min(1, viewportWidth / boardWidth);
    elements.bracketViewport.style.setProperty("--bracket-scale", String(scale));
    elements.bracketViewport.style.height = `${Math.ceil(boardHeight * scale)}px`;
  });
}

function renderBracket(predictions, results, odds = []) {
  if (!elements.bracketSection || !predictions.length) return;
  const { standings, completedGroups } = buildGroupTables(predictions, results);
  const thirdAssignment = assignThirdPlaces(standings, completedGroups);
  const { winners, losers } = actualKnockoutOutcomes(predictions, results);
  const projectedOutcomes = projectedKnockoutOutcomes(
    predictions,
    winners,
    losers,
    standings,
    completedGroups,
    thirdAssignment,
    odds,
  );
  const projectedWinners = projectedOutcomes.winners;
  const projectedLosers = projectedOutcomes.losers;
  const filledRound32 = Object.values(KNOCKOUT_MATCHES).flat()
    .map((slot) => resolveBracketSlot(slot, standings, completedGroups, thirdAssignment))
    .filter(Boolean).length;

  const finalWinner = winners.get(104) ?? projectedWinners.get(104);
  const thirdPlaceWinner = winners.get(103) ?? projectedWinners.get(103);
  const finalParticipants = [
    { slot: "Finalista 1", fallback: "Finalista 1", ...bracketOutcome(101, winners, projectedWinners) },
    { slot: "Finalista 2", fallback: "Finalista 2", ...bracketOutcome(102, winners, projectedWinners) },
  ].map((participant) => ({
    ...participant,
    badge: participant.team && finalWinner
      ? (sameTeam(participant.team, finalWinner) ? "Campe\u00e3o" : "2\u00ba")
      : "",
  }));
  const thirdPlaceParticipants = [
    { slot: "Semi 1", fallback: "Perdedor semi 1", ...bracketOutcome(101, losers, projectedLosers) },
    { slot: "Semi 2", fallback: "Perdedor semi 2", ...bracketOutcome(102, losers, projectedLosers) },
  ].map((participant) => ({
    ...participant,
    badge: participant.team && thirdPlaceWinner
      ? (sameTeam(participant.team, thirdPlaceWinner) ? "3\u00ba" : "4\u00ba")
      : "",
  }));

  const columns = [
    { title: "Fase de 32", side: "left", items: BRACKET_LAYOUT.left32.map((matchId) => bracketMatch(KNOCKOUT_MATCHES[matchId], standings, completedGroups, thirdAssignment)) },
    { title: "Oitavas", side: "left", items: BRACKET_LAYOUT.left16.map((match) => futureBracketMatch(match.label, match.sources, winners, projectedWinners, "normal", 2)) },
    { title: "Quartas", side: "left", items: BRACKET_LAYOUT.leftQuarter.map((match) => futureBracketMatch(match.label, match.sources, winners, projectedWinners, "normal", 4)) },
    { title: "Semi", side: "left", items: [futureBracketMatch(BRACKET_LAYOUT.leftSemi.label, BRACKET_LAYOUT.leftSemi.sources, winners, projectedWinners, "large", 8)] },
    {
      title: "Campeão",
      side: "center",
      items: [
        futureBracketNode(
          "Campeão",
          "trophy",
          winners.get(BRACKET_LAYOUT.centerChampion) ?? projectedWinners.get(BRACKET_LAYOUT.centerChampion),
          winners.has(BRACKET_LAYOUT.centerChampion) ? "confirmed" : projectedWinners.has(BRACKET_LAYOUT.centerChampion) ? "projected" : "",
          4,
        ),
        futureBracketNode(
          "3º lugar",
          "third",
          winners.get(BRACKET_LAYOUT.centerThird) ?? projectedWinners.get(BRACKET_LAYOUT.centerThird),
          winners.has(BRACKET_LAYOUT.centerThird) ? "confirmed" : projectedWinners.has(BRACKET_LAYOUT.centerThird) ? "projected" : "",
          4,
        ),
      ],
    },
    { title: "Semi", side: "right", items: [futureBracketMatch(BRACKET_LAYOUT.rightSemi.label, BRACKET_LAYOUT.rightSemi.sources, winners, projectedWinners, "large", 8)] },
    { title: "Quartas", side: "right", items: BRACKET_LAYOUT.rightQuarter.map((match) => futureBracketMatch(match.label, match.sources, winners, projectedWinners, "normal", 4)) },
    { title: "Oitavas", side: "right", items: BRACKET_LAYOUT.right16.map((match) => futureBracketMatch(match.label, match.sources, winners, projectedWinners, "normal", 2)) },
    { title: "Fase de 32", side: "right", items: BRACKET_LAYOUT.right32.map((matchId) => bracketMatch(KNOCKOUT_MATCHES[matchId], standings, completedGroups, thirdAssignment)) },
  ];

  const centerColumn = columns.find((column) => column.side === "center");
  if (centerColumn) {
    centerColumn.title = "Decis\u00e3o";
    centerColumn.items = [
      decisionBracketMatch("Final", finalParticipants, "trophy", 4),
      decisionBracketMatch("3\u00ba lugar", thirdPlaceParticipants, "third", 4),
    ];
  }

  elements.bracketStatus.innerHTML = `
    <span>${completedGroups.size}/12 grupos completos</span>
    <span>${filledRound32}/32 vagas preenchidas</span>
    <span>${Object.keys(thirdAssignment).length ? "Melhores terceiros definidos" : "Melhores terceiros aguardando fechamento dos grupos"}</span>
    <span><i class="legend-dot legend-confirmed"></i> confirmado <i class="legend-dot legend-projected"></i> projetado</span>`;
  elements.bracketBoard.innerHTML = columns.map((column) => `
    <div class="bracket-column bracket-${column.side}">
      <h3>${escapeHtml(column.title)}</h3>
      <div class="bracket-column-items">${column.items.join("")}</div>
    </div>
  `).join("");
  elements.bracketSection.hidden = false;
  fitBracketBoard();
}

async function loadBracket() {
  if (!elements.bracketSection || !isConfigured()) return;
  try {
    const [predictionsResponse, resultsResponse, oddsResponse] = await Promise.all([
      supabase
        .from("predictions")
        .select("match_id,home_team,away_team,predicted_home_goals,predicted_away_goals,home_win_prob,away_win_prob,round")
        .order("match_id"),
      supabase.from("results").select("match_id,actual_home_goals,actual_away_goals"),
      supabase.from("championship_odds").select("team,champion_prob,eliminated"),
    ]);
    if (predictionsResponse.error) throw predictionsResponse.error;
    if (resultsResponse.error) throw resultsResponse.error;
    if (oddsResponse.error) console.warn("Odds indisponÃ­veis para projeÃ§Ã£o da chave.", oddsResponse.error);
    renderBracket(predictionsResponse.data ?? [], resultsResponse.data ?? [], oddsResponse.data ?? []);
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
  if (isKnockoutMatch(match)) {
    return advancementProbabilityCell(
      match,
      brazilIsHome ? "Brasil" : opponent,
      brazilIsHome ? opponent : "Brasil",
    );
  }

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

function isKnockoutMatch(match) {
  return !String(match.round ?? "").toLocaleLowerCase("pt-BR").includes("fase de grupos");
}

function addScoreline(scorelineMap, homeGoals, awayGoals, probability) {
  const key = `${homeGoals}-${awayGoals}`;
  const current = scorelineMap.get(key) ?? { homeGoals, awayGoals, probability: 0 };
  current.probability += probability;
  scorelineMap.set(key, current);
}

function mostLikelyBrazilScores(match, brazilIsHome) {
  const { homeLambda, awayLambda } = estimatePoissonLambdas(match);
  const homeDistribution = poissonDistribution(homeLambda, 7);
  const awayDistribution = poissonDistribution(awayLambda, 7);
  const scorelineMap = new Map();
  const shouldApplyExtraTime = isKnockoutMatch(match);
  const extraHomeDistribution = shouldApplyExtraTime
    ? poissonDistribution(homeLambda * EXTRA_TIME_SHARE_OF_MATCH * EXTRA_TIME_INTENSITY, 5)
    : [];
  const extraAwayDistribution = shouldApplyExtraTime
    ? poissonDistribution(awayLambda * EXTRA_TIME_SHARE_OF_MATCH * EXTRA_TIME_INTENSITY, 5)
    : [];

  for (let homeGoals = 0; homeGoals < homeDistribution.length; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals < awayDistribution.length; awayGoals += 1) {
      const probability90 = homeDistribution[homeGoals] * awayDistribution[awayGoals];
      if (shouldApplyExtraTime && homeGoals === awayGoals) {
        for (let extraHomeGoals = 0; extraHomeGoals < extraHomeDistribution.length; extraHomeGoals += 1) {
          for (let extraAwayGoals = 0; extraAwayGoals < extraAwayDistribution.length; extraAwayGoals += 1) {
            addScoreline(
              scorelineMap,
              homeGoals + extraHomeGoals,
              awayGoals + extraAwayGoals,
              probability90 * extraHomeDistribution[extraHomeGoals] * extraAwayDistribution[extraAwayGoals],
            );
          }
        }
      } else {
        addScoreline(scorelineMap, homeGoals, awayGoals, probability90);
      }
    }
  }

  return [...scorelineMap.values()]
    .map((scoreline) => ({
      brazilGoals: brazilIsHome ? scoreline.homeGoals : scoreline.awayGoals,
      opponentGoals: brazilIsHome ? scoreline.awayGoals : scoreline.homeGoals,
      probability: scoreline.probability,
    }))
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

async function fetchPredictionScorelines() {
  if (!isConfigured()) return [];

  try {
    const response = await supabase
      .from("prediction_scorelines")
      .select("match_id,rank,home_goals,away_goals,probability")
      .order("match_id")
      .order("rank");
    if (!response.error) return response.data ?? [];
  } catch (error) {
    console.warn("Placares projetados no Supabase indisponíveis.", error);
  }

  try {
    const response = await fetch("scoreline_odds.json", { cache: "no-store" });
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.warn("scoreline_odds.json indisponível.", error);
    return [];
  }
}

async function fetchBrazilPathPredictions() {
  try {
    const response = await fetch("brazil_path_predictions.json", { cache: "no-store" });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload) ? payload : payload.predictions ?? [];
  } catch (error) {
    console.warn("Cenários do caminho do Brasil indisponíveis.", error);
    return [];
  }
}

function scorelinesForMatch(scorelineOdds, match, brazilIsHome) {
  return scorelineOdds
    .filter((row) => row.match_id === match.match_id)
    .sort((a, b) => Number(a.rank) - Number(b.rank))
    .slice(0, 3)
    .map((row) => ({
      brazilGoals: brazilIsHome ? Number(row.home_goals) : Number(row.away_goals),
      opponentGoals: brazilIsHome ? Number(row.away_goals) : Number(row.home_goals),
      probability: Number(row.probability),
    }));
}

function scorelinesForBrazilPath(match, brazilIsHome) {
  return (match.scorelines ?? [])
    .sort((a, b) => Number(a.rank) - Number(b.rank))
    .slice(0, 3)
    .map((row) => ({
      brazilGoals: brazilIsHome ? Number(row.home_goals) : Number(row.away_goals),
      opponentGoals: brazilIsHome ? Number(row.away_goals) : Number(row.home_goals),
      probability: Number(row.probability),
    }));
}

function projectedBrazilPathGame(pathPredictions, predictions, results) {
  if (!pathPredictions?.length) return null;

  const { winners } = actualKnockoutOutcomes(predictions, results);
  const resultMatchIds = new Set(results.map((result) => normalizedMatchId(result.match_id)));
  const winnerName = (matchId) => {
    const key = Number(normalizedMatchId(matchId).replace("WC2026_", ""));
    const winner = winners.get(key);
    return winner ? displayTeam(winner) : null;
  };

  const groupedByStage = [...pathPredictions]
    .sort((a, b) => Number(a.stage_order) - Number(b.stage_order))
    .reduce((groups, prediction) => {
      const stage = Number(prediction.stage_order);
      if (!groups.has(stage)) groups.set(stage, []);
      groups.get(stage).push(prediction);
      return groups;
    }, new Map());

  for (const candidates of groupedByStage.values()) {
    const officialMatchId = normalizedMatchId(candidates[0]?.official_match_id ?? candidates[0]?.match_id);
    if (resultMatchIds.has(officialMatchId)) continue;

    const previousMatchId = candidates[0]?.brazil_previous_match_id;
    const brazilPreviousWinner = previousMatchId ? winnerName(previousMatchId) : "Brasil";
    if (brazilPreviousWinner !== "Brasil") continue;

    const opponentWinner = winnerName(candidates[0]?.opponent_decider_match_id);
    let selected = null;
    let opponentConfirmed = false;

    if (opponentWinner) {
      selected = candidates.find((candidate) => displayTeam(candidate.opponent) === opponentWinner);
      opponentConfirmed = Boolean(selected);
    }

    if (!selected) {
      selected = candidates.find((candidate) => candidate.projected_opponent) ?? candidates[0];
    }

    if (!selected) continue;
    return {
      ...selected,
      is_path_projection: true,
      opponent_confirmed: opponentConfirmed,
      match_id: selected.official_match_id ?? selected.match_id,
    };
  }

  return null;
}

function renderBrazilSection(
  odds,
  predictions,
  liveMatches = cachedLiveMatches,
  scorelineOdds = cachedScorelineOdds,
  results = cachedResults,
  brazilPathPredictions = cachedBrazilPathPredictions,
) {
  const brazil = odds.find((row) => row.team === "Brasil");
  if (!brazil) {
    clearBrazilCountdown();
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
    clearBrazilCountdown();
    elements.brazilNextGame.hidden = true;
    elements.brazilScorelines.hidden = true;
    positionBrazilSection(false);
  } else {
    const now = new Date();
    const liveByMatchId = new Map(liveMatches.map((match) => [match.match_id, match]));
    const resultByMatchId = new Map(results.map((result) => [result.match_id, result]));
    const brazilGames = predictions
      .filter((prediction) => (
        displayTeam(prediction.home_team) === "Brasil"
        || displayTeam(prediction.away_team) === "Brasil"
      ))
      .map((prediction) => {
        const liveMatch = liveByMatchId.get(prediction.match_id);
        const result = resultByMatchId.get(prediction.match_id);
        return {
          ...prediction,
          liveMatch,
          result,
          is_live: isActiveMatch(prediction.match_date, liveMatch, now, result),
          starts_at: new Date(prediction.match_date),
        };
      })
      .filter((prediction) => shouldShowScheduleMatch(
        prediction.match_date,
        prediction.liveMatch,
        now,
        prediction.result,
      ))
      .sort((a, b) => {
        if (a.is_live !== b.is_live) return a.is_live ? -1 : 1;
        return a.starts_at - b.starts_at;
      });
    let nextGame = brazilGames[0];
    if (!nextGame) {
      nextGame = projectedBrazilPathGame(
        brazilPathPredictions,
        predictions,
        results,
      );
    }
    const isBrazilLive = Boolean(nextGame?.is_live);
    const liveMatch = nextGame?.liveMatch ?? null;
    positionBrazilSection(isBrazilLive);

    elements.brazilNextGame.hidden = false;
    elements.brazilScorelines.hidden = false;
    if (!nextGame) {
      clearBrazilCountdown();
      elements.brazilNextGame.innerHTML = `
        <span class="brazil-game-kicker">Próximo jogo do Brasil</span>
        <strong class="brazil-matchup">Nenhum jogo previsto</strong>`;
      elements.brazilScorelines.innerHTML = `
        <span class="brazil-card-kicker">Placares mais prováveis</span>
        <strong class="scorelines-match">Aguardando previsão</strong>`;
    } else {
      const brazilIsHome = displayTeam(nextGame.home_team) === "Brasil";
      const opponent = displayTeam(brazilIsHome ? nextGame.away_team : nextGame.home_team);
      const isKnockout = isKnockoutMatch(nextGame);
      const pathScorelines = nextGame.is_path_projection
        ? scorelinesForBrazilPath(nextGame, brazilIsHome)
        : [];
      const persistedScorelines = isKnockout && !nextGame.is_path_projection
        ? scorelinesForMatch(scorelineOdds, nextGame, brazilIsHome)
        : [];
      const scorelines = pathScorelines.length
        ? pathScorelines
        : (
          persistedScorelines.length
            ? persistedScorelines
            : mostLikelyBrazilScores(nextGame, brazilIsHome)
        );
      const fallbackBrazilGoals = brazilIsHome ? nextGame.predicted_home_goals : nextGame.predicted_away_goals;
      const fallbackOpponentGoals = brazilIsHome ? nextGame.predicted_away_goals : nextGame.predicted_home_goals;
      const modelScoreline = {
        brazilGoals: Number(fallbackBrazilGoals),
        opponentGoals: Number(fallbackOpponentGoals),
        probability: null,
        label: "Modelo",
      };
      const mainScoreline = scorelines[0] ?? modelScoreline;
      const scorelineMatchesModel = (scoreline) => (
        Number(scoreline.brazilGoals) === modelScoreline.brazilGoals
        && Number(scoreline.opponentGoals) === modelScoreline.opponentGoals
      );
      const modelScorelineProbability = scorelines.find(scorelineMatchesModel)?.probability ?? null;
      const scorelinesForDisplay = isKnockout && !persistedScorelines.length
        && !pathScorelines.length
        ? [
          { ...modelScoreline, probability: modelScorelineProbability },
          ...scorelines.filter((scoreline) => !scorelineMatchesModel(scoreline)),
        ].slice(0, 3)
        : scorelines;
      const brazilGameKicker = isBrazilLive
        ? "Brasil em campo agora"
        : nextGame.is_path_projection && !nextGame.opponent_confirmed
          ? "Provável próximo jogo do Brasil"
          : "Próximo jogo do Brasil";
      const predictionLabel = nextGame.is_path_projection
        ? "Palpite projetado mais provável"
        : isKnockout ? "Palpite final mais provável" : "Palpite principal";

      armBrazilCountdown(nextGame.match_date, isBrazilLive);
      elements.brazilNextGame.innerHTML = `
        <span class="brazil-game-kicker">${brazilGameKicker}</span>
        ${isBrazilLive ? `
          <a class="brazil-live-pill" href="https://www.youtube.com/@CazéTV"
             target="_blank" rel="noopener noreferrer">AGORA</a>
        ` : ""}
        <strong class="brazil-matchup">Brasil <small>×</small> ${escapeHtml(opponent)}</strong>
        <span class="brazil-game-date">${formatBrasilia(nextGame.match_date)} · Brasília</span>
        ${brazilCountdownMarkup(nextGame.match_date, isBrazilLive)}
        <span class="prediction-label brazil-prediction-label">${predictionLabel}</span>
        <strong class="brazil-main-score">${mainScoreline.brazilGoals} <small>×</small> ${mainScoreline.opponentGoals}</strong>
        ${brazilResultProbability(nextGame, brazilIsHome, opponent)}
        ${liveScoreBlock(nextGame, liveMatch)}`;
      elements.brazilScorelines.innerHTML = `
        <span class="brazil-card-kicker">${isKnockout ? "Placares finais mais prováveis" : "Placares mais prováveis"}</span>
        <strong class="scorelines-match">Brasil × ${escapeHtml(opponent)}</strong>
        <div class="scoreline-ranking">
          ${scorelinesForDisplay.map((scoreline, index) => `
            <div class="scoreline-row ${index === 0 ? "is-leading" : ""}">
              <span class="scoreline-position">${index + 1}º</span>
              <strong>${scoreline.brazilGoals} × ${scoreline.opponentGoals}</strong>
              <span>${scoreline.probability === null ? "palpite" : championPercent(scoreline.probability)}</span>
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
  if (entries.every((entry) => entry.eliminated)) return "#ff2d55";
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
    const [odds, predictions, liveMatches, results, scorelineOdds, brazilPathPredictions] = await Promise.all([
      fetchChampionshipOdds(),
      cachedPredictions.length ? Promise.resolve(cachedPredictions) : fetchPredictionsForUpcoming(),
      cachedLiveMatches.length ? Promise.resolve(cachedLiveMatches) : fetchLiveMatches(),
      cachedResults.length ? Promise.resolve(cachedResults) : fetchResultsForSchedule(),
      fetchPredictionScorelines(),
      cachedBrazilPathPredictions.length ? Promise.resolve(cachedBrazilPathPredictions) : fetchBrazilPathPredictions(),
    ]);
    if (!odds.length) return;
    cachedLiveMatches = liveMatches;
    cachedResults = results;
    cachedScorelineOdds = scorelineOdds;
    cachedBrazilPathPredictions = brazilPathPredictions;
    renderBrazilSection(odds, predictions, liveMatches, scorelineOdds, results, brazilPathPredictions);
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
  window.addEventListener("resize", fitBracketBoard);
  await Promise.all([loadDashboard(), loadUpcomingGames(), loadBracket()]);
  await loadChampionshipFeatures();
  setInterval(pollingTick, LIVE_CHECK_INTERVAL_MS);
}

initializeDashboard();
