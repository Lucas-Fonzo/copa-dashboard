"""Gera previsões de mata-mata assim que os confrontos ficam definidos.

O script usa os resultados já disponíveis, resolve os slots do chaveamento e
calcula os confrontos definidos com a versão mais recente do Elo + Poisson.

Uso local:
    python sync_defined_knockout_predictions.py

Para também enviar ao Supabase:
    python sync_defined_knockout_predictions.py --upload
"""

from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from scipy.stats import poisson
from supabase import Client, create_client

import retrain_after_second_round as model


ROOT = Path(__file__).resolve().parents[1]
DASHBOARD_DIR = Path(__file__).resolve().parent
PREDICTIONS_PATH = DASHBOARD_DIR / "predictions.json"
RESULTS_PATH = DASHBOARD_DIR / "results.json"
SCORELINE_ODDS_PATH = DASHBOARD_DIR / "scoreline_odds.json"
GROUP_FIXTURES_PATH = ROOT / "data" / "group_fixtures.csv"
KNOCKOUT_SLOTS_PATH = ROOT / "data" / "knockout_slots.csv"

EXTRA_TIME_INTENSITY = 0.95
EXTRA_TIME_SHARE_OF_MATCH = 30 / 90
PENALTY_STRONGER_PROBABILITY = 0.60
MAX_GOALS_90 = 10
MAX_GOALS_EXTRA = 6

ROUND_LABELS = {
    "Round of 32": "Mata-mata - Fase de 32",
    "Round of 16": "Mata-mata - Oitavas",
    "Quarter-final": "Mata-mata - Quartas",
    "Semi-final": "Mata-mata - Semifinal",
    "Third-place playoff": "Mata-mata - 3º lugar",
    "Final": "Mata-mata - Final",
}


@dataclass
class KnockoutPrediction:
    match_id: str
    home_team: str
    away_team: str
    predicted_home_goals: int
    predicted_away_goals: int
    home_win_prob: float
    draw_prob: float
    away_win_prob: float
    round: str
    match_date: str
    winner: str
    loser: str
    scorelines: list[dict[str, Any]]

    def as_record(self) -> dict[str, Any]:
        return {
            "match_id": self.match_id,
            "home_team": self.home_team,
            "away_team": self.away_team,
            "predicted_home_goals": self.predicted_home_goals,
            "predicted_away_goals": self.predicted_away_goals,
            "home_win_prob": round(self.home_win_prob, 6),
            "draw_prob": round(self.draw_prob, 6),
            "away_win_prob": round(self.away_win_prob, 6),
            "round": self.round,
            "match_date": self.match_date,
        }

    def scoreline_records(self) -> list[dict[str, Any]]:
        return [
            {
                "match_id": self.match_id,
                "rank": index + 1,
                "home_goals": int(scoreline["home_goals"]),
                "away_goals": int(scoreline["away_goals"]),
                "probability": round(float(scoreline["probability"]), 8),
            }
            for index, scoreline in enumerate(self.scorelines[:5])
        ]


def supabase_client() -> Client:
    load_dotenv(DASHBOARD_DIR / ".env")
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not service_key:
        raise RuntimeError("Defina SUPABASE_URL e SUPABASE_SERVICE_KEY em copa-dashboard/.env.")
    return create_client(url, service_key)


def match_num(match_id: Any) -> int:
    text = str(match_id)
    if text.startswith("WC2026_"):
        return int(text.split("_")[-1])
    return int(float(text))


def match_key(number: int) -> str:
    return f"WC2026_{number:03d}"


def load_local_data() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    predictions = json.loads(PREDICTIONS_PATH.read_text(encoding="utf-8"))
    results = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
    return predictions, results


def load_supabase_data(client: Client) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    predictions = (
        client.table("predictions")
        .select(
            "match_id,home_team,away_team,predicted_home_goals,predicted_away_goals,"
            "home_win_prob,draw_prob,away_win_prob,round,match_date"
        )
        .execute()
        .data
        or []
    )
    results = (
        client.table("results")
        .select("match_id,actual_home_goals,actual_away_goals,match_date")
        .execute()
        .data
        or []
    )
    return predictions, results


def save_local_predictions(predictions: list[dict[str, Any]]) -> None:
    predictions = sorted(predictions, key=lambda row: match_num(row["match_id"]))
    PREDICTIONS_PATH.write_text(
        json.dumps(predictions, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def save_local_scoreline_odds(generated: list[KnockoutPrediction]) -> None:
    current = []
    if SCORELINE_ODDS_PATH.exists():
        current = json.loads(SCORELINE_ODDS_PATH.read_text(encoding="utf-8"))
    by_match = {str(row["match_id"]): [] for row in current}
    for row in current:
        by_match.setdefault(str(row["match_id"]), []).append(row)
    for prediction in generated:
        by_match[prediction.match_id] = prediction.scoreline_records()
    rows = [
        row
        for match_id in sorted(by_match, key=match_num)
        for row in sorted(by_match[match_id], key=lambda item: int(item["rank"]))
    ]
    SCORELINE_ODDS_PATH.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def load_group_fixtures() -> pd.DataFrame:
    fixtures = pd.read_csv(GROUP_FIXTURES_PATH)
    fixtures["home_team"] = fixtures["home_team"].map(model.norm)
    fixtures["away_team"] = fixtures["away_team"].map(model.norm)
    fixtures["match_key"] = fixtures["match_id"].map(lambda value: match_key(int(value)))
    return fixtures


def load_knockout_slots() -> pd.DataFrame:
    slots = pd.read_csv(KNOCKOUT_SLOTS_PATH)
    slots["match_key"] = slots["match_id"].map(lambda value: match_key(int(value)))
    return slots


def apply_result(table: dict[str, dict[str, int]], home: str, away: str, home_goals: int, away_goals: int) -> None:
    for team in (home, away):
        table.setdefault(team, {"points": 0, "gf": 0, "ga": 0, "gd": 0, "wins": 0, "played": 0})
    table[home]["played"] += 1
    table[away]["played"] += 1
    table[home]["gf"] += home_goals
    table[home]["ga"] += away_goals
    table[away]["gf"] += away_goals
    table[away]["ga"] += home_goals
    table[home]["gd"] = table[home]["gf"] - table[home]["ga"]
    table[away]["gd"] = table[away]["gf"] - table[away]["ga"]
    if home_goals > away_goals:
        table[home]["points"] += 3
        table[home]["wins"] += 1
    elif away_goals > home_goals:
        table[away]["points"] += 3
        table[away]["wins"] += 1
    else:
        table[home]["points"] += 1
        table[away]["points"] += 1


def rank_table(table: dict[str, dict[str, int]]) -> list[tuple[str, dict[str, int]]]:
    return sorted(
        table.items(),
        key=lambda item: (
            -item[1]["points"],
            -item[1]["gd"],
            -item[1]["gf"],
            -item[1]["wins"],
            item[0],
        ),
    )


def completed_group_rankings(
    fixtures: pd.DataFrame,
    results: list[dict[str, Any]],
) -> tuple[dict[str, list[tuple[str, dict[str, int]]]], set[str]]:
    result_by_id = {str(row["match_id"]): row for row in results}
    rankings: dict[str, list[tuple[str, dict[str, int]]]] = {}
    complete_groups: set[str] = set()

    for group, part in fixtures.groupby("group"):
        table = {
            team: {"points": 0, "gf": 0, "ga": 0, "gd": 0, "wins": 0, "played": 0}
            for team in sorted(set(part["home_team"]).union(part["away_team"]))
        }
        observed = 0
        for fixture in part.itertuples(index=False):
            result = result_by_id.get(fixture.match_key)
            if not result:
                continue
            observed += 1
            apply_result(
                table,
                fixture.home_team,
                fixture.away_team,
                int(result["actual_home_goals"]),
                int(result["actual_away_goals"]),
            )
        if observed == 6:
            complete_groups.add(str(group))
            rankings[str(group)] = rank_table(table)
    return rankings, complete_groups


def allowed_third_groups(slot: str) -> list[str]:
    marker = "Best 3rd (Groups "
    if not slot.startswith(marker) or not slot.endswith(")"):
        return []
    return slot.removeprefix(marker).removesuffix(")").split("/")


def assign_third_places(third_by_group: dict[str, str]) -> dict[str, str]:
    slots = load_knockout_slots()
    third_slots = sorted(
        [
            str(slot)
            for slot in pd.concat([slots["slot_home"], slots["slot_away"]]).tolist()
            if str(slot).startswith("Best 3rd")
        ],
        key=lambda slot: sum(1 for group in allowed_third_groups(slot) if group in third_by_group),
    )

    def backtrack(index: int, used: set[str], assigned: dict[str, str]) -> dict[str, str] | None:
        if index == len(third_slots):
            return dict(assigned)
        slot = third_slots[index]
        for group in allowed_third_groups(slot):
            if group not in third_by_group or group in used:
                continue
            used.add(group)
            assigned[slot] = third_by_group[group]
            solved = backtrack(index + 1, used, assigned)
            if solved:
                return solved
            used.remove(group)
            assigned.pop(slot, None)
        return None

    return backtrack(0, set(), {}) or {}


def third_place_assignment(
    rankings: dict[str, list[tuple[str, dict[str, int]]]],
    complete_groups: set[str],
) -> dict[str, str]:
    # A ordem de melhores terceiros só fica realmente fechada quando os 12 grupos
    # estão completos. Antes disso, evitamos projetar vaga como se fosse fato.
    if len(complete_groups) < 12:
        return {}

    third_rows = []
    for group, ranking in rankings.items():
        if len(ranking) >= 3:
            team, stats = ranking[2]
            third_rows.append((group, team, stats))
    third_rows.sort(
        key=lambda item: (
            -item[2]["points"],
            -item[2]["gd"],
            -item[2]["gf"],
            -item[2]["wins"],
            item[0],
        )
    )
    return assign_third_places({group: team for group, team, _ in third_rows[:8]})


def resolve_group_slot(
    slot: str,
    rankings: dict[str, list[tuple[str, dict[str, int]]]],
    complete_groups: set[str],
    third_assignment: dict[str, str],
) -> str | None:
    if slot.startswith("Winner Group "):
        group = slot.removeprefix("Winner Group ").strip()
        return rankings[group][0][0] if group in complete_groups else None
    if slot.startswith("Runner-up Group "):
        group = slot.removeprefix("Runner-up Group ").strip()
        return rankings[group][1][0] if group in complete_groups else None
    if slot.startswith("Best 3rd"):
        return third_assignment.get(slot)
    return None


def build_latest_model(
    predictions: list[dict[str, Any]],
    results: list[dict[str, Any]],
):
    result_by_id = {str(row["match_id"]): row for row in results}
    observed_predictions = [
        row for row in predictions
        if str(row["match_id"]) in result_by_id
    ]
    if not observed_predictions:
        raise RuntimeError("Nenhum resultado observado encontrado para retreinar o modelo.")
    historical_results = model.load_historical_results(observed_predictions, result_by_id)
    latest_observed = max(pd.Timestamp(row["match_date"]).tz_convert(None) for row in result_by_id.values())
    cutoff = max(pd.Timestamp.now(tz=timezone.utc).tz_convert(None), latest_observed + pd.Timedelta(minutes=1))
    return model.train(historical_results, cutoff)


def final_knockout_distribution(
    home: str,
    away: str,
    ratings: dict[str, float],
    trained_models,
) -> tuple[int, int, float, float, str, str, list[dict[str, Any]]]:
    home_lambda, away_lambda = model.lambdas(home, away, ratings, trained_models)
    goals_90 = np.arange(MAX_GOALS_90 + 1)
    matrix_90 = np.outer(poisson.pmf(goals_90, home_lambda), poisson.pmf(goals_90, away_lambda))
    matrix_90 = matrix_90 / matrix_90.sum()

    extra_home_lambda = max(home_lambda * EXTRA_TIME_SHARE_OF_MATCH * EXTRA_TIME_INTENSITY, 0.05)
    extra_away_lambda = max(away_lambda * EXTRA_TIME_SHARE_OF_MATCH * EXTRA_TIME_INTENSITY, 0.05)
    goals_extra = np.arange(MAX_GOALS_EXTRA + 1)
    extra_home = poisson.pmf(goals_extra, extra_home_lambda)
    extra_away = poisson.pmf(goals_extra, extra_away_lambda)
    extra_home = extra_home / extra_home.sum()
    extra_away = extra_away / extra_away.sum()

    score_prob: dict[tuple[int, int], float] = {}
    home_advance = 0.0
    away_advance = 0.0
    home_penalty_share = PENALTY_STRONGER_PROBABILITY if ratings[home] >= ratings[away] else 1 - PENALTY_STRONGER_PROBABILITY

    for home_goals in goals_90:
        for away_goals in goals_90:
            probability_90 = float(matrix_90[home_goals, away_goals])
            if probability_90 <= 0:
                continue
            if home_goals > away_goals:
                score_prob[(int(home_goals), int(away_goals))] = score_prob.get((int(home_goals), int(away_goals)), 0) + probability_90
                home_advance += probability_90
                continue
            if away_goals > home_goals:
                score_prob[(int(home_goals), int(away_goals))] = score_prob.get((int(home_goals), int(away_goals)), 0) + probability_90
                away_advance += probability_90
                continue

            for extra_home_goals, extra_home_prob in enumerate(extra_home):
                for extra_away_goals, extra_away_prob in enumerate(extra_away):
                    probability = probability_90 * float(extra_home_prob) * float(extra_away_prob)
                    final_home = int(home_goals + extra_home_goals)
                    final_away = int(away_goals + extra_away_goals)
                    score_prob[(final_home, final_away)] = score_prob.get((final_home, final_away), 0) + probability
                    if final_home > final_away:
                        home_advance += probability
                    elif final_away > final_home:
                        away_advance += probability
                    else:
                        home_advance += probability * home_penalty_share
                        away_advance += probability * (1 - home_penalty_share)

    total_advance = home_advance + away_advance
    home_advance = home_advance / total_advance
    away_advance = away_advance / total_advance

    non_draw_scores = {
        score: probability
        for score, probability in score_prob.items()
        if score[0] != score[1]
    }
    if non_draw_scores:
        predicted_home_goals, predicted_away_goals = max(non_draw_scores.items(), key=lambda item: item[1])[0]
    else:
        predicted_home_goals, predicted_away_goals = (1, 0) if home_advance >= away_advance else (0, 1)

    winner = home if home_advance >= away_advance else away
    loser = away if winner == home else home
    top_scorelines = [
        {
            "home_goals": score[0],
            "away_goals": score[1],
            "probability": probability,
        }
        for score, probability in sorted(
            score_prob.items(),
            key=lambda item: item[1],
            reverse=True,
        )
        if score[0] != score[1]
    ][:5]
    return (
        int(predicted_home_goals),
        int(predicted_away_goals),
        round(home_advance, 8),
        round(away_advance, 8),
        winner,
        loser,
        top_scorelines,
    )


def predict_match(
    match_id: int,
    round_name: str,
    match_date: str,
    home: str,
    away: str,
    ratings: dict[str, float],
    trained_models,
) -> KnockoutPrediction:
    home_goals, away_goals, home_adv, away_adv, winner, loser, scorelines = final_knockout_distribution(
        home,
        away,
        ratings,
        trained_models,
    )
    return KnockoutPrediction(
        match_id=match_key(match_id),
        home_team=home,
        away_team=away,
        predicted_home_goals=home_goals,
        predicted_away_goals=away_goals,
        home_win_prob=home_adv,
        draw_prob=0.0,
        away_win_prob=away_adv,
        round=ROUND_LABELS.get(round_name, f"Mata-mata - {round_name}"),
        match_date=match_date,
        winner=winner,
        loser=loser,
        scorelines=scorelines,
    )


def actual_knockout_outcomes(
    predictions: list[dict[str, Any]],
    results: list[dict[str, Any]],
) -> tuple[dict[int, str], dict[int, str]]:
    """Resolve vencedores/perdedores somente a partir de resultados reais.

    Importante: previsões projetadas não alimentam a próxima fase. Um slot como
    `Winner Match 74` só fica disponível quando `results` já contém o placar de
    `WC2026_074`.
    """
    prediction_by_id = {str(row["match_id"]): row for row in predictions}
    result_by_id = {str(row["match_id"]): row for row in results}
    winners: dict[int, str] = {}
    losers: dict[int, str] = {}

    for match_id, result in result_by_id.items():
        try:
            number = match_num(match_id)
        except ValueError:
            continue
        if number < 73:
            continue
        prediction = prediction_by_id.get(match_id)
        if not prediction:
            continue
        home = str(prediction["home_team"])
        away = str(prediction["away_team"])
        home_goals = int(result["actual_home_goals"])
        away_goals = int(result["actual_away_goals"])
        if home_goals > away_goals:
            winners[number] = home
            losers[number] = away
        elif away_goals > home_goals:
            winners[number] = away
            losers[number] = home
        else:
            # O schema atual não guarda vencedor dos pênaltis. Se o placar vier
            # empatado, é mais seguro não avançar ninguém automaticamente.
            print(
                f"[MATA-MATA][AVISO] {match_id} tem empate em results; "
                "não dá para inferir vencedor sem pênaltis."
            )
    return winners, losers


def generate_defined_knockout_predictions(
    predictions: list[dict[str, Any]],
    results: list[dict[str, Any]],
    overwrite: bool = True,
) -> list[KnockoutPrediction]:
    fixtures = load_group_fixtures()
    slots = load_knockout_slots()
    rankings, complete_groups = completed_group_rankings(fixtures, results)
    third_assignment = third_place_assignment(rankings, complete_groups)
    existing_ids = {str(row["match_id"]) for row in predictions}
    ratings, home_model, away_model = build_latest_model(predictions, results)
    trained_models = (home_model, away_model)

    winners, losers = actual_knockout_outcomes(predictions, results)
    generated: list[KnockoutPrediction] = []

    for slot in slots.sort_values("match_id").itertuples(index=False):
        number = int(slot.match_id)
        key = match_key(number)
        if key in existing_ids and not overwrite:
            continue

        home: str | None
        away: str | None
        slot_home = str(slot.slot_home)
        slot_away = str(slot.slot_away)
        if slot_home.startswith("Winner Match "):
            home = winners.get(int(slot_home.removeprefix("Winner Match ")))
        elif slot_home.startswith("Loser Match "):
            home = losers.get(int(slot_home.removeprefix("Loser Match ")))
        else:
            home = resolve_group_slot(slot_home, rankings, complete_groups, third_assignment)

        if slot_away.startswith("Winner Match "):
            away = winners.get(int(slot_away.removeprefix("Winner Match ")))
        elif slot_away.startswith("Loser Match "):
            away = losers.get(int(slot_away.removeprefix("Loser Match ")))
        else:
            away = resolve_group_slot(slot_away, rankings, complete_groups, third_assignment)

        if not home or not away:
            continue

        prediction = predict_match(
            number,
            str(slot.round),
            str(slot.date_utc),
            home,
            away,
            ratings,
            trained_models,
        )
        if key not in existing_ids or overwrite:
            generated.append(prediction)

    return generated


def merge_predictions(
    current: list[dict[str, Any]],
    generated: list[KnockoutPrediction],
) -> list[dict[str, Any]]:
    by_id = {str(row["match_id"]): row for row in current}
    for prediction in generated:
        by_id[prediction.match_id] = prediction.as_record()
    return sorted(by_id.values(), key=lambda row: match_num(row["match_id"]))


def sync_defined_knockout_predictions(
    client: Client | None = None,
    source: str = "local",
    upload: bool = False,
    overwrite: bool = True,
    update_local: bool = True,
) -> list[KnockoutPrediction]:
    if source == "supabase":
        if client is None:
            client = supabase_client()
        predictions, results = load_supabase_data(client)
    else:
        predictions, results = load_local_data()

    generated = generate_defined_knockout_predictions(predictions, results, overwrite=overwrite)
    if not generated:
        print("[MATA-MATA] Nenhum novo confronto definido para calcular.")
        return []

    if update_local:
        save_local_predictions(merge_predictions(predictions, generated))
        save_local_scoreline_odds(generated)

    records = [prediction.as_record() for prediction in generated]
    if upload:
        if client is None:
            client = supabase_client()
        client.table("predictions").upsert(records, on_conflict="match_id").execute()
        scoreline_records = [
            row
            for prediction in generated
            for row in prediction.scoreline_records()
        ]
        try:
            client.table("prediction_scorelines").upsert(
                scoreline_records,
                on_conflict="match_id,rank",
            ).execute()
        except Exception as error:
            print(
                "[MATA-MATA][AVISO] prediction_scorelines não foi atualizada. "
                "Rode o trecho novo do supabase_schema.sql se quiser persistir "
                f"os placares finais no Supabase. Detalhe: {error}"
            )

    print(f"[MATA-MATA] {len(generated)} previsão(ões) calculada(s).")
    for prediction in generated:
        print(
            "[MATA-MATA]",
            prediction.match_id,
            f"{prediction.home_team} {prediction.predicted_home_goals} x "
            f"{prediction.predicted_away_goals} {prediction.away_team}",
            f"({prediction.home_win_prob * 100:.1f}% x {prediction.away_win_prob * 100:.1f}% avanço)",
        )
    return generated


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        choices=["local", "supabase"],
        default="local",
        help="Fonte das previsões/resultados para resolver o chaveamento.",
    )
    parser.add_argument("--upload", action="store_true", help="Envia previsões calculadas ao Supabase.")
    parser.add_argument(
        "--keep-existing",
        action="store_true",
        help="Não recalcula jogos de mata-mata que já existem em predictions.",
    )
    parser.add_argument(
        "--no-local-update",
        action="store_true",
        help="Não atualiza o predictions.json local.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    client = supabase_client() if args.upload or args.source == "supabase" else None
    sync_defined_knockout_predictions(
        client=client,
        source=args.source,
        upload=args.upload,
        overwrite=not args.keep_existing,
        update_local=not args.no_local_update,
    )


if __name__ == "__main__":
    main()
