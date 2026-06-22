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
  Ghana: "Gana",
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
        <span class="countdown-badge">${countdownLabel(date)}</span>
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
    }).filter(({ date }) => date instanceof Date && !Number.isNaN(date) && date > now)
      .sort((a, b) => a.date - b.date)
      .slice(0, 3);

    if (upcoming.length) renderUpcomingGames(upcoming);
  } catch (error) {
    // A agenda é complementar e não interrompe as demais métricas do dashboard.
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
