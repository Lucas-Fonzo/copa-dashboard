"""Retreina Elo + Poisson após a segunda rodada e atualiza a Rodada 3.

O notebook principal continua intocado. Este script operacional reutiliza a
mesma lógica de Elo + Poisson, busca os resultados reais no Supabase, incorpora
os 48 jogos das duas primeiras rodadas ao histórico e recalcula apenas as
previsões dos 24 jogos restantes da fase de grupos.
"""

from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import kagglehub
import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf
from dotenv import load_dotenv
from scipy.stats import poisson
from supabase import Client, create_client


ROOT = Path(__file__).resolve().parents[1]
DASHBOARD_DIR = Path(__file__).resolve().parent
PREDICTIONS_PATH = DASHBOARD_DIR / "predictions.json"
RESULTS_PATH = DASHBOARD_DIR / "results.json"
GROUP_FIXTURES_PATH = ROOT / "data" / "group_fixtures.csv"

SEED = 42
ROUND_1 = "Fase de Grupos - Rodada 1"
ROUND_2 = "Fase de Grupos - Rodada 2"
ROUND_3 = "Fase de Grupos - Rodada 3"
TRAINING_CUTOFF = pd.Timestamp("2026-06-24 03:00:00")

NAME_MAP = {
    "Cabo Verde": "Cape Verde",
    "Côte d'Ivoire": "Ivory Coast",
    "USA": "United States",
    "UEFA Playoff A": "Bosnia and Herzegovina",
    "UEFA Playoff B": "Sweden",
    "UEFA Playoff C": "Turkey",
    "UEFA Playoff D": "Czech Republic",
    "FIFA Playoff 1": "DR Congo",
    "FIFA Playoff 2": "Iraq",
    "Democratic Republic of the Congo": "DR Congo",
    "Congo DR": "DR Congo",
}


def norm(team: str) -> str:
    """Padroniza nomes provisórios e variações das APIs."""
    return NAME_MAP.get(team, team)


def supabase_client() -> Client:
    load_dotenv(DASHBOARD_DIR / ".env")
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not service_key:
        raise RuntimeError("Defina SUPABASE_URL e SUPABASE_SERVICE_KEY em copa-dashboard/.env.")
    return create_client(url, service_key)


def load_supabase_data(client: Client) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    predictions = (
        client.table("predictions")
        .select("match_id,home_team,away_team,predicted_home_goals,predicted_away_goals,home_win_prob,draw_prob,away_win_prob,round,match_date")
        .order("match_date")
        .execute()
        .data
        or []
    )
    results = (
        client.table("results")
        .select("match_id,actual_home_goals,actual_away_goals,match_date")
        .order("match_date")
        .execute()
        .data
        or []
    )
    return predictions, results


def sync_local_results_json(results: list[dict[str, Any]]) -> None:
    """Mantém o results.json local alinhado com o Supabase."""
    clean = [
        {
            "match_id": row["match_id"],
            "actual_home_goals": int(row["actual_home_goals"]),
            "actual_away_goals": int(row["actual_away_goals"]),
            "match_date": row["match_date"],
        }
        for row in sorted(results, key=lambda item: item["match_id"])
    ]
    RESULTS_PATH.write_text(
        json.dumps(clean, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def validate_second_round_complete(
    predictions: list[dict[str, Any]],
    results: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    result_by_id = {row["match_id"]: row for row in results}
    observed = [
        row for row in predictions
        if row["round"] in {ROUND_1, ROUND_2} and row["match_id"] in result_by_id
    ]
    missing = [
        row["match_id"] for row in predictions
        if row["round"] in {ROUND_1, ROUND_2} and row["match_id"] not in result_by_id
    ]
    if len(observed) != 48 or missing:
        raise RuntimeError(
            "Retreino pós-2ª rodada exige 48 resultados. "
            f"Encontrados {len(observed)}; faltando: {missing}"
        )
    return observed, result_by_id


def expected(home_rating: float, away_rating: float) -> float:
    return 1 / (1 + 10 ** ((away_rating - home_rating) / 400))


def weight(tournament: str) -> float:
    tournament = tournament.lower()
    if tournament == "fifa world cup":
        return 2.0
    if tournament in {"uefa euro", "copa américa"}:
        return 1.7
    if "qualification" in tournament:
        return 1.3
    if "nations league" in tournament:
        return 1.2
    return 0.7 if "friendly" in tournament else 1.0


def build_elo(data: pd.DataFrame, base: float = 1500, k0: float = 20) -> tuple[dict[str, float], pd.DataFrame]:
    data = data.sort_values("date")
    ref = data["date"].max()
    ratings: dict[str, float] = {}
    rows: list[dict[str, float | int]] = []

    for row in data.itertuples(index=False):
        ratings.setdefault(row.home_team, base)
        ratings.setdefault(row.away_team, base)
        home_rating = ratings[row.home_team]
        away_rating = ratings[row.away_team]
        home_advantage = 0 if row.neutral else 60
        actual = 1 if row.home_score > row.away_score else 0.5 if row.home_score == row.away_score else 0
        margin = abs(row.home_score - row.away_score)
        multiplier = 1 if margin <= 1 else 1.2 if margin == 2 else 1.4 if margin == 3 else 1.6
        recency = math.exp(-((ref - row.date).days / 365.25) / 8)
        k = k0 * weight(row.tournament) * multiplier * recency

        rows.append({
            "home_score": int(row.home_score),
            "away_score": int(row.away_score),
            "elo_diff": home_rating + home_advantage - away_rating,
        })
        delta = k * (actual - expected(home_rating + home_advantage, away_rating))
        ratings[row.home_team] += delta
        ratings[row.away_team] -= delta

    return ratings, pd.DataFrame(rows)


def load_historical_results(observed_predictions: list[dict[str, Any]], result_by_id: dict[str, dict[str, Any]]) -> pd.DataFrame:
    dataset_path = Path(kagglehub.dataset_download("martj42/international-football-results-from-1872-to-2017"))
    results = pd.read_csv(dataset_path / "results.csv")
    results["date"] = pd.to_datetime(results["date"])
    results = results.dropna(subset=["home_score", "away_score"]).copy()
    results[["home_score", "away_score"]] = results[["home_score", "away_score"]].astype(int)

    # Remove partidas de 2026 do dataset externo para evitar dupla contagem caso
    # ele já tenha sido atualizado pela comunidade.
    mask_2026_world_cup = (
        (results["tournament"] == "FIFA World Cup")
        & (results["date"] >= pd.Timestamp("2026-06-11"))
    )
    results = results.loc[~mask_2026_world_cup].copy()

    observed_rows = []
    for prediction in observed_predictions:
        result = result_by_id[prediction["match_id"]]
        match_date = pd.Timestamp(result["match_date"]).tz_convert(None)
        observed_rows.append({
            "date": match_date,
            "home_team": norm(prediction["home_team"]),
            "away_team": norm(prediction["away_team"]),
            "home_score": int(result["actual_home_goals"]),
            "away_score": int(result["actual_away_goals"]),
            "tournament": "FIFA World Cup",
            # Os jogos da Copa são tratados como campo neutro para evitar dar
            # vantagem artificial ao time listado como "home" no calendário.
            "neutral": True,
        })

    observed_frame = pd.DataFrame(observed_rows)
    return pd.concat([results, observed_frame], ignore_index=True, sort=False)


def train(results: pd.DataFrame, cutoff: pd.Timestamp):
    training = results[(results["date"] >= pd.Timestamp("2000-01-01")) & (results["date"] < cutoff)].copy()
    ratings, rows = build_elo(training)
    home_model = smf.glm("home_score ~ elo_diff", rows, family=sm.families.Poisson()).fit()
    away_model = smf.glm("away_score ~ elo_diff", rows, family=sm.families.Poisson()).fit()
    return ratings, home_model, away_model


def rating(team: str, ratings: dict[str, float]) -> float:
    key = norm(team)
    if key not in ratings:
        raise KeyError(f"Sem Elo para {team!r} (normalizado: {key!r})")
    return ratings[key]


def lambdas(home: str, away: str, ratings: dict[str, float], models) -> tuple[float, float]:
    home_model, away_model = models
    frame = pd.DataFrame({"elo_diff": [rating(home, ratings) - rating(away, ratings)]})
    return (
        float(np.clip(home_model.predict(frame).iloc[0], 0.1, 5)),
        float(np.clip(away_model.predict(frame).iloc[0], 0.1, 5)),
    )


def mode_score(home: str, away: str, ratings: dict[str, float], models) -> tuple[int, int]:
    home_lambda, away_lambda = lambdas(home, away, ratings, models)
    goals = np.arange(9)
    matrix = np.outer(poisson.pmf(goals, home_lambda), poisson.pmf(goals, away_lambda))
    home_goals, away_goals = np.unravel_index(np.argmax(matrix), matrix.shape)
    return int(home_goals), int(away_goals)


def outcome_probabilities(home: str, away: str, ratings: dict[str, float], models) -> tuple[float, float, float]:
    home_lambda, away_lambda = lambdas(home, away, ratings, models)
    goals = np.arange(10)
    matrix = np.outer(poisson.pmf(goals, home_lambda), poisson.pmf(goals, away_lambda))
    matrix = matrix / matrix.sum()
    home_win = float(np.tril(matrix, -1).sum())
    draw = float(np.trace(matrix))
    away_win = float(np.triu(matrix, 1).sum())
    total = home_win + draw + away_win
    return home_win / total, draw / total, away_win / total


def round_label(match_id: int) -> str:
    if match_id <= 24:
        return ROUND_1
    if match_id <= 48:
        return ROUND_2
    return ROUND_3


def generate_round3_predictions(ratings: dict[str, float], models) -> list[dict[str, Any]]:
    fixtures = pd.read_csv(GROUP_FIXTURES_PATH)
    fixtures["home_team"] = fixtures["home_team"].map(norm)
    fixtures["away_team"] = fixtures["away_team"].map(norm)
    round3 = fixtures[fixtures["match_id"] > 48].sort_values("match_id")
    if len(round3) != 24:
        raise RuntimeError(f"Esperados 24 jogos da terceira rodada, encontrados {len(round3)}.")

    records = []
    for fixture in round3.itertuples(index=False):
        home_goals, away_goals = mode_score(fixture.home_team, fixture.away_team, ratings, models)
        home_prob, draw_prob, away_prob = outcome_probabilities(fixture.home_team, fixture.away_team, ratings, models)
        records.append({
            "match_id": f"WC2026_{int(fixture.match_id):03d}",
            "home_team": fixture.home_team,
            "away_team": fixture.away_team,
            "predicted_home_goals": home_goals,
            "predicted_away_goals": away_goals,
            "home_win_prob": round(home_prob, 6),
            "draw_prob": round(draw_prob, 6),
            "away_win_prob": round(away_prob, 6),
            "round": round_label(int(fixture.match_id)),
            "match_date": fixture.date_utc,
        })
    return records


def update_predictions_json(round3_records: list[dict[str, Any]]) -> None:
    current = json.loads(PREDICTIONS_PATH.read_text(encoding="utf-8"))
    by_id = {row["match_id"]: row for row in current}
    for record in round3_records:
        by_id[record["match_id"]] = record

    updated = sorted(by_id.values(), key=lambda row: row["match_id"])
    if len(updated) < 72:
        raise RuntimeError(f"predictions.json deveria ter pelo menos 72 registros; ficou com {len(updated)}.")
    PREDICTIONS_PATH.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    client = supabase_client()
    predictions, results = load_supabase_data(client)
    observed_predictions, result_by_id = validate_second_round_complete(predictions, results)
    sync_local_results_json(results)

    historical_results = load_historical_results(observed_predictions, result_by_id)
    ratings, home_model, away_model = train(historical_results, TRAINING_CUTOFF)
    round3_records = generate_round3_predictions(ratings, (home_model, away_model))
    update_predictions_json(round3_records)

    brazil = next(row for row in round3_records if row["home_team"] == "Brazil" or row["away_team"] == "Brazil")
    print("[OK] Retreino pós-2ª rodada concluído.")
    print(f"[OK] results.json sincronizado com {len(results)} resultado(s).")
    print(f"[OK] predictions.json atualizado com {len(round3_records)} previsão(ões) da Rodada 3.")
    print(
        "[BRASIL]",
        brazil["home_team"], brazil["predicted_home_goals"],
        "x", brazil["predicted_away_goals"], brazil["away_team"],
    )


if __name__ == "__main__":
    main()
