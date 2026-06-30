"""Gera previsões condicionais para o Caminho do Hexa.

Esses cenários alimentam o dashboard quando o Brasil já avançou, mas o próximo
adversário ainda depende de outro confronto. O site escolhe automaticamente:

- o adversário confirmado, quando houver resultado do jogo decisivo;
- o adversário projetado, enquanto esse resultado ainda não existir.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

import sync_defined_knockout_predictions as knockout


OUTPUT_PATH = Path(__file__).with_name("brazil_path_predictions.json")

BRAZIL_PATH_SCENARIOS = [
    {
        "stage": "Oitavas",
        "stage_order": 1,
        "match_id": 91,
        "brazil_previous_match_id": 76,
        "opponent_decider_match_id": 78,
        "projected_opponent": "Ivory Coast",
        "opponents": ["Ivory Coast", "Norway"],
    },
    {
        "stage": "Quartas",
        "stage_order": 2,
        "match_id": 99,
        "brazil_previous_match_id": 91,
        "opponent_decider_match_id": 92,
        "projected_opponent": "England",
        "opponents": ["Mexico", "England"],
    },
    {
        "stage": "Semi",
        "stage_order": 3,
        "match_id": 102,
        "brazil_previous_match_id": 99,
        "opponent_decider_match_id": 100,
        "projected_opponent": "Argentina",
        "opponents": ["Argentina", "Egypt", "Algeria", "Colombia"],
    },
]


def load_match_dates() -> dict[int, tuple[str, str]]:
    slots = pd.read_csv(knockout.KNOCKOUT_SLOTS_PATH)
    return {
        int(row.match_id): (str(row.round), str(row.date_utc))
        for row in slots.itertuples(index=False)
    }


def prediction_payload(
    scenario: dict[str, Any],
    opponent: str,
    ratings: dict[str, float],
    trained_models: tuple[Any, Any],
    match_dates: dict[int, tuple[str, str]],
) -> dict[str, Any]:
    match_id = int(scenario["match_id"])
    round_name, date_utc = match_dates[match_id]
    prediction = knockout.predict_match(
        match_id,
        round_name,
        date_utc,
        "Brazil",
        opponent,
        ratings,
        trained_models,
    )
    record = prediction.as_record()
    return {
        **record,
        "scenario_id": f"{record['match_id']}_{opponent.lower().replace(' ', '_')}",
        "official_match_id": record["match_id"],
        "stage": scenario["stage"],
        "stage_order": scenario["stage_order"],
        "brazil_previous_match_id": knockout.match_key(int(scenario["brazil_previous_match_id"])),
        "opponent_decider_match_id": knockout.match_key(int(scenario["opponent_decider_match_id"])),
        "opponent": opponent,
        "projected_opponent": opponent == scenario["projected_opponent"],
        "scorelines": [
            {
                "rank": row["rank"],
                "home_goals": row["home_goals"],
                "away_goals": row["away_goals"],
                "probability": row["probability"],
            }
            for row in prediction.scoreline_records()
        ],
    }


def generate(source: str) -> dict[str, Any]:
    client = knockout.supabase_client() if source == "supabase" else None
    predictions, results = (
        knockout.load_supabase_data(client)
        if client
        else knockout.load_local_data()
    )
    ratings, home_model, away_model = knockout.build_latest_model(predictions, results)
    trained_models = (home_model, away_model)
    match_dates = load_match_dates()

    payload = [
        prediction_payload(scenario, opponent, ratings, trained_models, match_dates)
        for scenario in BRAZIL_PATH_SCENARIOS
        for opponent in scenario["opponents"]
    ]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "predictions": payload,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=["local", "supabase"], default="supabase")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data = generate(args.source)
    OUTPUT_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"[OK] {len(data['predictions'])} cenário(s) do Brasil salvos em {OUTPUT_PATH.name}.")


if __name__ == "__main__":
    main()
