"""Simula a Copa 2026 com as probabilidades já salvas no Supabase.

O script não importa nem altera o notebook do modelo. Os grupos são inferidos
pelos confrontos da fase de grupos, o que permite trabalhar com previsões
parciais durante a competição.
"""

from __future__ import annotations

import argparse
import math
import os
import random
import time
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable

from dotenv import load_dotenv
from supabase import Client, create_client


DEFAULT_SIMULATIONS = 10_000
GROUP_MARKER = "fase de grupos"
EXTRA_TIME_INTENSITY = 0.95
EXTRA_TIME_SHARE_OF_MATCH = 30 / 90
MIN_90_MINUTE_GOAL_EXPECTATION = 0.20
PENALTY_STRONGER_PROBABILITY = 0.60

TEAM_DISPLAY = {
    "Algeria": "Argélia", "Argentina": "Argentina", "Australia": "Austrália",
    "Austria": "Áustria", "Belgium": "Bélgica",
    "Bosnia and Herzegovina": "Bósnia e Herzegovina", "Brazil": "Brasil",
    "Canada": "Canadá", "Cape Verde": "Cabo Verde", "Colombia": "Colômbia",
    "Croatia": "Croácia", "Curaçao": "Curaçao",
    "Czech Republic": "República Tcheca", "DR Congo": "RD Congo",
    "Ecuador": "Equador", "Egypt": "Egito", "England": "Inglaterra",
    "France": "França", "Germany": "Alemanha", "Ghana": "Gana",
    "Haiti": "Haiti", "Iran": "Irã", "Iraq": "Iraque",
    "Ivory Coast": "Costa do Marfim", "Japan": "Japão", "Jordan": "Jordânia",
    "Mexico": "México", "Morocco": "Marrocos", "Netherlands": "Holanda",
    "New Zealand": "Nova Zelândia", "Norway": "Noruega", "Panama": "Panamá",
    "Paraguay": "Paraguai", "Portugal": "Portugal", "Qatar": "Catar",
    "Saudi Arabia": "Arábia Saudita", "Scotland": "Escócia",
    "Senegal": "Senegal", "South Africa": "África do Sul",
    "South Korea": "Coreia do Sul", "Spain": "Espanha", "Sweden": "Suécia",
    "Switzerland": "Suíça", "Tunisia": "Tunísia", "Turkey": "Turquia",
    "United States": "Estados Unidos", "Uruguay": "Uruguai",
    "Uzbekistan": "Uzbequistão",
}

OFFICIAL_GROUPS = [
    ["Mexico", "South Africa", "South Korea", "Czech Republic"],
    ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
    ["Brazil", "Morocco", "Haiti", "Scotland"],
    ["United States", "Paraguay", "Australia", "Turkey"],
    ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
    ["Netherlands", "Japan", "Sweden", "Tunisia"],
    ["Belgium", "Egypt", "Iran", "New Zealand"],
    ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
    ["France", "Senegal", "Iraq", "Norway"],
    ["Argentina", "Algeria", "Austria", "Jordan"],
    ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
    ["England", "Croatia", "Ghana", "Panama"],
]


@dataclass
class Standing:
    points: int = 0
    goals_for: int = 0
    goals_against: int = 0
    wins: int = 0
    played: int = 0

    @property
    def goal_difference(self) -> int:
        return self.goals_for - self.goals_against


def supabase_client() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not service_key:
        raise RuntimeError("Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no arquivo .env.")
    return create_client(url, service_key)


def is_group_prediction(prediction: dict[str, Any]) -> bool:
    return GROUP_MARKER in str(prediction.get("round", "")).casefold()


def infer_groups(predictions: Iterable[dict[str, Any]]) -> list[list[str]]:
    """Infere grupos como componentes conexos da rede de confrontos."""
    graph: dict[str, set[str]] = defaultdict(set)
    for prediction in predictions:
        if not is_group_prediction(prediction):
            continue
        home = str(prediction["home_team"])
        away = str(prediction["away_team"])
        graph[home].add(away)
        graph[away].add(home)

    observed_teams = set(graph)
    official_teams = {team for group in OFFICIAL_GROUPS for team in group}
    if observed_teams and observed_teams <= official_teams:
        return [group[:] for group in OFFICIAL_GROUPS]

    groups: list[list[str]] = []
    unseen = set(graph)
    while unseen:
        start = min(unseen)
        stack = [start]
        component: set[str] = set()
        while stack:
            team = stack.pop()
            if team in component:
                continue
            component.add(team)
            stack.extend(graph[team] - component)
        unseen -= component
        groups.append(sorted(component))

    return sorted(groups, key=lambda group: group[0])


def validate_groups(groups: list[list[str]]) -> None:
    if not groups:
        raise ValueError("Nenhum confronto de fase de grupos foi encontrado.")
    oversized = [group for group in groups if len(group) > 4]
    if oversized:
        raise ValueError(f"Não foi possível inferir grupos válidos: {oversized}")
    incomplete = [group for group in groups if len(group) < 4]
    if incomplete:
        print(
            "[AVISO] Há grupos incompletos nas previsões parciais; "
            "a classificação usará somente os times conectados."
        )


def probability_triplet(prediction: dict[str, Any]) -> tuple[float, float, float]:
    values = (
        float(prediction["home_win_prob"]),
        float(prediction["draw_prob"]),
        float(prediction["away_win_prob"]),
    )
    total = sum(values)
    if total <= 0:
        return 1 / 3, 1 / 3, 1 / 3
    return tuple(value / total for value in values)  # type: ignore[return-value]


def poisson_sample(lam: float, rng: random.Random) -> int:
    """Sorteia gols por Poisson sem depender de numpy no GitHub Actions."""
    if lam <= 0:
        return 0
    limit = math.exp(-lam)
    value = 0
    probability = 1.0
    while probability > limit:
        value += 1
        probability *= rng.random()
    return value - 1


def expected_goals_for_extra_time(
    prediction: dict[str, Any], reversed_pair: bool
) -> tuple[float, float]:
    """Aproxima os lambdas da prorrogação a partir do palpite de 90 minutos.

    A prorrogação usa 30/90 do volume esperado e um fator de intensidade de 0.95:
    Copa do Mundo, mata-mata, perna pesada mas coração quente.
    """
    home_goals_90 = max(
        float(prediction.get("predicted_home_goals") or 0),
        MIN_90_MINUTE_GOAL_EXPECTATION,
    )
    away_goals_90 = max(
        float(prediction.get("predicted_away_goals") or 0),
        MIN_90_MINUTE_GOAL_EXPECTATION,
    )
    if reversed_pair:
        home_goals_90, away_goals_90 = away_goals_90, home_goals_90
    return (
        home_goals_90 * EXTRA_TIME_SHARE_OF_MATCH * EXTRA_TIME_INTENSITY,
        away_goals_90 * EXTRA_TIME_SHARE_OF_MATCH * EXTRA_TIME_INTENSITY,
    )


def penalty_winner(
    home: str,
    away: str,
    stronger: str | None,
    rng: random.Random,
) -> str:
    """Decide pênaltis: 60% para o lado mais forte quando houver sinal claro."""
    weaker_probability = 1 - PENALTY_STRONGER_PROBABILITY
    if stronger == home:
        return rng.choices(
            [home, away],
            weights=[PENALTY_STRONGER_PROBABILITY, weaker_probability],
            k=1,
        )[0]
    if stronger == away:
        return rng.choices(
            [home, away],
            weights=[weaker_probability, PENALTY_STRONGER_PROBABILITY],
            k=1,
        )[0]
    return rng.choice([home, away])


def approximate_score(outcome: str, rng: random.Random) -> tuple[int, int]:
    """Gera um placar simples apenas para pontos, gols e saldo do grupo."""
    if outcome == "draw":
        goals = rng.choices([0, 1, 2, 3], weights=[18, 45, 29, 8], k=1)[0]
        return goals, goals
    loser = rng.choices([0, 1, 2], weights=[58, 34, 8], k=1)[0]
    margin = rng.choices([1, 2, 3], weights=[66, 27, 7], k=1)[0]
    return (loser + margin, loser) if outcome == "home" else (loser, loser + margin)


def sample_group_game(
    prediction: dict[str, Any], rng: random.Random
) -> tuple[int, int]:
    home, draw, away = probability_triplet(prediction)
    outcome = rng.choices(["home", "draw", "away"], weights=[home, draw, away], k=1)[0]
    return approximate_score(outcome, rng)


def register_group_result(
    table: dict[str, Standing], home: str, away: str, home_goals: int, away_goals: int
) -> None:
    home_row, away_row = table[home], table[away]
    home_row.played += 1
    away_row.played += 1
    home_row.goals_for += home_goals
    home_row.goals_against += away_goals
    away_row.goals_for += away_goals
    away_row.goals_against += home_goals
    if home_goals > away_goals:
        home_row.points += 3
        home_row.wins += 1
    elif away_goals > home_goals:
        away_row.points += 3
        away_row.wins += 1
    else:
        home_row.points += 1
        away_row.points += 1


def rank_group(teams: list[str], table: dict[str, Standing], rng: random.Random) -> list[str]:
    random_tiebreak = {team: rng.random() for team in teams}
    return sorted(
        teams,
        key=lambda team: (
            table[team].points,
            table[team].goal_difference,
            table[team].goals_for,
            table[team].wins,
            random_tiebreak[team],
        ),
        reverse=True,
    )


def prediction_for_pair(
    home: str,
    away: str,
    knockout_predictions: dict[tuple[str, str], dict[str, Any]],
) -> tuple[dict[str, Any] | None, bool]:
    direct = knockout_predictions.get((home, away))
    if direct:
        return direct, False
    reverse = knockout_predictions.get((away, home))
    return (reverse, True) if reverse else (None, False)


def knockout_winner(
    home: str,
    away: str,
    wins: Counter[str],
    knockout_predictions: dict[tuple[str, str], dict[str, Any]],
    rng: random.Random,
) -> str:
    prediction, reversed_pair = prediction_for_pair(home, away, knockout_predictions)
    if prediction:
        home_prob, draw_prob, away_prob = probability_triplet(prediction)
        if reversed_pair:
            home_prob, away_prob = away_prob, home_prob
        stronger = home if home_prob > away_prob else away if away_prob > home_prob else None
        outcome = rng.choices(
            ["home", "draw", "away"],
            weights=[home_prob, draw_prob, away_prob],
            k=1,
        )[0]
        if outcome == "draw":
            extra_home_lambda, extra_away_lambda = expected_goals_for_extra_time(
                prediction,
                reversed_pair,
            )
            extra_home_goals = poisson_sample(extra_home_lambda, rng)
            extra_away_goals = poisson_sample(extra_away_lambda, rng)
            if extra_home_goals > extra_away_goals:
                return home
            if extra_away_goals > extra_home_goals:
                return away
            return penalty_winner(home, away, stronger, rng)
        return home if outcome == "home" else away

    if wins[home] == wins[away]:
        return rng.choice([home, away])
    stronger = home if wins[home] > wins[away] else away
    weaker = away if stronger == home else home
    return rng.choices(
        [stronger, weaker],
        weights=[PENALTY_STRONGER_PROBABILITY, 1 - PENALTY_STRONGER_PROBABILITY],
        k=1,
    )[0]


def build_round_of_32(
    winners: list[tuple[str, int]],
    runners_and_thirds: list[tuple[str, int]],
    rng: random.Random,
) -> list[str]:
    """Cria 16 confrontos aproximados evitando reencontros do mesmo grupo."""
    opponents = runners_and_thirds[:]
    rng.shuffle(opponents)
    pairings: list[tuple[str, str]] = []

    for winner, group_id in winners:
        if not opponents:
            break
        valid = [item for item in opponents if item[1] != group_id]
        opponent = rng.choice(valid or opponents)
        opponents.remove(opponent)
        pairings.append((winner, opponent[0]))

    rng.shuffle(opponents)
    while len(opponents) >= 2:
        first = opponents.pop()
        valid_indexes = [i for i, item in enumerate(opponents) if item[1] != first[1]]
        index = rng.choice(valid_indexes) if valid_indexes else len(opponents) - 1
        second = opponents.pop(index)
        pairings.append((first[0], second[0]))

    rng.shuffle(pairings)
    return [team for pairing in pairings for team in pairing]


def simulate_once(
    group_predictions: list[dict[str, Any]],
    results_by_id: dict[str, dict[str, Any]],
    groups: list[list[str]],
    knockout_predictions: dict[tuple[str, str], dict[str, Any]],
    rng: random.Random,
) -> str:
    table = {team: Standing() for group in groups for team in group}
    wins: Counter[str] = Counter()

    for prediction in group_predictions:
        home = str(prediction["home_team"])
        away = str(prediction["away_team"])
        if home not in table or away not in table:
            continue
        result = results_by_id.get(str(prediction["match_id"]))
        if result:
            home_goals = int(result["actual_home_goals"])
            away_goals = int(result["actual_away_goals"])
        else:
            home_goals, away_goals = sample_group_game(prediction, rng)
        register_group_result(table, home, away, home_goals, away_goals)
        if home_goals > away_goals:
            wins[home] += 1
        elif away_goals > home_goals:
            wins[away] += 1

    ranked_groups = [rank_group(group, table, rng) for group in groups]
    winners = [(ranking[0], group_id) for group_id, ranking in enumerate(ranked_groups) if ranking]
    runners = [(ranking[1], group_id) for group_id, ranking in enumerate(ranked_groups) if len(ranking) > 1]
    thirds = [(ranking[2], group_id) for group_id, ranking in enumerate(ranked_groups) if len(ranking) > 2]
    thirds.sort(
        key=lambda item: (
            table[item[0]].points,
            table[item[0]].goal_difference,
            table[item[0]].goals_for,
            rng.random(),
        ),
        reverse=True,
    )
    bracket = build_round_of_32(winners, runners + thirds[:8], rng)
    if len(bracket) < 2:
        raise ValueError("Não há classificados suficientes para montar o mata-mata.")

    while len(bracket) > 1:
        next_round: list[str] = []
        if len(bracket) % 2:
            next_round.append(bracket.pop())
        for index in range(0, len(bracket), 2):
            home, away = bracket[index], bracket[index + 1]
            winner = knockout_winner(home, away, wins, knockout_predictions, rng)
            wins[winner] += 1
            next_round.append(winner)
        bracket = next_round
    return bracket[0]


def run_simulations(
    predictions: list[dict[str, Any]],
    results: list[dict[str, Any]],
    simulations: int,
    seed: int | None = None,
) -> tuple[Counter[str], list[list[str]]]:
    group_predictions = [prediction for prediction in predictions if is_group_prediction(prediction)]
    results_by_id = {str(result["match_id"]): result for result in results}
    knockout_predictions = {
        (str(prediction["home_team"]), str(prediction["away_team"])): prediction
        for prediction in predictions
        if not is_group_prediction(prediction)
    }
    groups = infer_groups(group_predictions)
    validate_groups(groups)
    rng = random.Random(seed)
    champions: Counter[str] = Counter()
    for _ in range(simulations):
        champions[simulate_once(group_predictions, results_by_id, groups, knockout_predictions, rng)] += 1
    return champions, groups


def load_predictions(client: Client) -> list[dict[str, Any]]:
    response = client.table("predictions").select(
        "match_id,home_team,away_team,predicted_home_goals,predicted_away_goals,"
        "home_win_prob,draw_prob,away_win_prob,round,match_date"
    ).execute()
    predictions = response.data or []
    if not predictions:
        raise RuntimeError("A tabela predictions está vazia.")
    return predictions


def load_results(client: Client) -> list[dict[str, Any]]:
    response = client.table("results").select(
        "match_id,actual_home_goals,actual_away_goals,match_date"
    ).execute()
    return response.data or []


def load_eliminated(client: Client) -> set[str]:
    response = client.table("championship_odds").select("team").eq("eliminated", True).execute()
    return {str(row["team"]) for row in (response.data or [])}


def build_payload(
    champions: Counter[str],
    teams: set[str],
    eliminated: set[str],
    simulations: int,
) -> list[dict[str, Any]]:
    active_total = sum(
        count for team, count in champions.items() if TEAM_DISPLAY.get(team, team) not in eliminated
    )
    updated_at = datetime.now(timezone.utc).isoformat()
    payload = []
    for team in sorted(teams):
        display_name = TEAM_DISPLAY.get(team, team)
        is_eliminated = display_name in eliminated
        probability = 0.0 if is_eliminated or active_total == 0 else champions[team] / active_total
        payload.append(
            {
                "team": display_name,
                "champion_prob": round(probability, 8),
                "eliminated": is_eliminated,
                "simulations_run": simulations,
                "updated_at": updated_at,
            }
        )
    return payload


def positive_integer(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("O número de simulações deve ser positivo.")
    return parsed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--simulations", type=positive_integer, default=DEFAULT_SIMULATIONS)
    parser.add_argument("--seed", type=int, default=None, help="Seed opcional para reprodução.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    started = time.perf_counter()
    client = supabase_client()
    predictions = load_predictions(client)
    results = load_results(client)
    champions, groups = run_simulations(predictions, results, args.simulations, args.seed)
    teams = {team for group in groups for team in group}
    eliminated = load_eliminated(client)
    payload = build_payload(champions, teams, eliminated, args.simulations)
    client.table("championship_odds").upsert(payload, on_conflict="team").execute()

    top_five = sorted(payload, key=lambda row: row["champion_prob"], reverse=True)[:5]
    elapsed = time.perf_counter() - started
    print(f"[OK] {args.simulations:,} simulações concluídas em {elapsed:.2f}s.")
    print(f"[OK] {len(teams)} times incluídos em {len(groups)} grupos inferidos.")
    print(f"[OK] {len(results)} resultado(s) real(is) fixado(s) antes de simular o restante.")
    print("Top 5:")
    for position, row in enumerate(top_five, start=1):
        print(f"  {position}. {row['team']}: {row['champion_prob'] * 100:.2f}%")


if __name__ == "__main__":
    main()
