import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Use somente a URL pública e a anon key. Nunca coloque a service_role no frontend.
const SUPABASE_URL = "https://tmkzvfxpdyoetdfrysfn.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_j_qmH14lt88_rdosFL8A_w_PnSOzeVU";

const PRIMARY_GAMES_API = "https://worldcup26.ir/get/games";
const FALLBACK_GAMES_API = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

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
  Ghana: "Gana",
};

const COUNTRY_CODES = {
  brasil: "BR", alemanha: "DE", franca: "FR", inglaterra: "GB", espanha: "ES",
  portugal: "PT", argentina: "AR", holanda: "NL", croacia: "HR", marrocos: "MA",
  mexico: "MX", estadosunidos: "US", coreiadosul: "KR", africadosul: "ZA",
  arabiasaudita: "SA", novazelandia: "NZ", costadomarfim: "CI", caboverde: "CV",
  curacao: "CW", suica: "CH", belgica: "BE", austria: "AT", republicatcheca: "CZ",
  bosniaeherzegovina: "BA", rdcongo: "CD", turquia: "TR", japao: "JP", egito: "EG",
  escocia: "GB", suecia: "SE", tunisia: "TN", argelia: "DZ", colombia: "CO",
  paraguai: "PY", uruguai: "UY", noruega: "NO", gana: "GH", canada: "CA",
  qatar: "QA", haiti: "HT", australia: "AU", equador: "EC", ira: "IR",
  iraque: "IQ", jordania: "JO", uzbequistao: "UZ", panama: "PA",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const elements = {
  upcomingSection: document.querySelector("#upcoming-section"),
  upcomingGames: document.querySelector("#upcoming-games"),
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

elements.retry.addEventListener("click", loadDashboard);

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

function canonicalTeam(name) {
  const compact = String(name ?? "").trim().replace(/\s+/g, " ");
  const translated = TEAM_NAME_MAP[compact] ?? compact;
  return translated.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

function displayTeam(name) {
  return TEAM_NAME_MAP[String(name ?? "").trim()] ?? String(name ?? "");
}

function flagEmoji(name) {
  const code = COUNTRY_CODES[canonicalTeam(name)];
  if (!code) return "⚽";
  return [...code].map((character) => String.fromCodePoint(127397 + character.charCodeAt())).join("");
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

function parseFallbackDate(match) {
  const time = String(match.time ?? "");
  const parsed = time.match(/(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})/i);
  if (!match.date || !parsed) return null;
  const offset = Number(parsed[3]);
  const sign = offset >= 0 ? "+" : "-";
  const offsetHours = String(Math.abs(offset)).padStart(2, "0");
  return new Date(`${match.date}T${parsed[1].padStart(2, "0")}:${parsed[2]}:00${sign}${offsetHours}:00`);
}

function parsePrimaryDate(localDate) {
  const parsed = String(localDate ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!parsed) return null;
  // A API não informa o fuso do estádio. UTC-6 é usado apenas se não houver
  // previsão no Supabase nem horário enriquecido pelo fallback.
  return new Date(`${parsed[3]}-${parsed[1]}-${parsed[2]}T${parsed[4]}:${parsed[5]}:00-06:00`);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} respondeu ${response.status}`);
  return response.json();
}

function normalizeFallbackGames(payload) {
  return (payload?.matches ?? []).map((match, index) => ({
    id: String(index + 1),
    homeTeam: match.team1,
    awayTeam: match.team2,
    date: parseFallbackDate(match),
    finished: Array.isArray(match.score?.ft)
      && match.score.ft.length === 2
      && match.score.ft.every((value) => value !== null),
  })).filter((game) => game.homeTeam && game.awayTeam);
}

function normalizePrimaryGames(payload, fallbackPayload) {
  const fallbackById = new Map(
    normalizeFallbackGames(fallbackPayload).map((game) => [game.id, game]),
  );
  return (payload?.games ?? []).map((game) => {
    const fallback = fallbackById.get(String(game.id));
    return {
      id: String(game.id),
      homeTeam: game.home_team_name_en ?? game.home_team_label,
      awayTeam: game.away_team_name_en ?? game.away_team_label,
      date: fallback?.date ?? parsePrimaryDate(game.local_date),
      finished: String(game.finished).toUpperCase() === "TRUE",
    };
  }).filter((game) => game.homeTeam && game.awayTeam);
}

async function fetchSchedule() {
  const fallbackPromise = fetchJson(FALLBACK_GAMES_API).catch(() => null);
  try {
    const [primary, fallback] = await Promise.all([
      fetchJson(PRIMARY_GAMES_API),
      fallbackPromise,
    ]);
    const games = normalizePrimaryGames(primary, fallback);
    if (!games.length) throw new Error("Agenda principal vazia");
    return games;
  } catch (primaryError) {
    console.warn("Agenda principal indisponível; usando fallback.", primaryError);
    const fallback = await fallbackPromise;
    const games = normalizeFallbackGames(fallback);
    if (!games.length) throw new Error("Fallback de agenda indisponível");
    return games;
  }
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

function matchPrediction(game, predictions) {
  const pair = `${canonicalTeam(game.homeTeam)}:${canonicalTeam(game.awayTeam)}`;
  const candidates = predictions.filter((prediction) => (
    `${canonicalTeam(prediction.home_team)}:${canonicalTeam(prediction.away_team)}` === pair
  ));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => (
    Math.abs(new Date(a.match_date) - game.date) - Math.abs(new Date(b.match_date) - game.date)
  ))[0];
}

function renderUpcomingGames(games) {
  elements.upcomingGames.innerHTML = games.map(({ game, prediction, date }) => `
    <article class="upcoming-card">
      <div class="upcoming-card-top">
        <span class="countdown-badge">${countdownLabel(date)}</span>
        <span class="upcoming-time">${formatBrasilia(date)} · Brasília</span>
      </div>
      <div class="upcoming-teams">
        <span class="upcoming-team"><span class="team-flag">${flagEmoji(game.homeTeam)}</span>${escapeHtml(displayTeam(game.homeTeam))}</span>
        <span class="upcoming-versus">VERSUS</span>
        <span class="upcoming-team"><span class="team-flag">${flagEmoji(game.awayTeam)}</span>${escapeHtml(displayTeam(game.awayTeam))}</span>
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
    const [schedule, predictions] = await Promise.all([
      fetchSchedule(),
      fetchPredictionsForUpcoming(),
    ]);
    const now = new Date();
    const upcoming = schedule.map((game) => {
      const prediction = matchPrediction(game, predictions);
      const date = prediction?.match_date ? new Date(prediction.match_date) : game.date;
      return { game, prediction, date };
    }).filter(({ game, date }) => !game.finished && date instanceof Date && !Number.isNaN(date) && date > now)
      .sort((a, b) => a.date - b.date)
      .slice(0, 3);
    if (upcoming.length) renderUpcomingGames(upcoming);
  } catch (error) {
    // A agenda é complementar; falhas das duas APIs não interrompem o dashboard.
    console.warn("Próximos jogos indisponíveis.", error);
    elements.upcomingSection.hidden = true;
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

async function loadDashboard() {
  showState("loading");

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
  } catch (error) {
    console.error(error);
    elements.errorMessage.textContent = error.message || "Erro inesperado ao consultar o Supabase.";
    showState("error");
  }
}

loadUpcomingGames();
loadDashboard();
