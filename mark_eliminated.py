"""Marca uma ou mais seleções como eliminadas nas probabilidades do campeonato."""

from __future__ import annotations

import argparse
import os
import unicodedata
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import Client, create_client


def canonical(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return "".join(character for character in ascii_value.casefold() if character.isalnum())


def supabase_client() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not service_key:
        raise RuntimeError("Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no arquivo .env.")
    return create_client(url, service_key)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("teams", nargs="+", help="Nomes das seleções eliminadas.")
    return parser.parse_args()


def normalize_championship_odds(client: Client) -> None:
    """Redistribui proporcionalmente as chances entre as seleções ainda vivas."""
    response = (
        client.table("championship_odds")
        .select("team,champion_prob,eliminated,simulations_run")
        .execute()
    )
    rows = response.data or []
    active = [row for row in rows if not row.get("eliminated")]
    active_total = sum(float(row.get("champion_prob") or 0) for row in active)
    if not active or active_total <= 0:
        print("[AVISO] Sem seleções ativas com probabilidade positiva para redistribuir.")
        return

    updated_at = datetime.now(timezone.utc).isoformat()
    payload = []
    remaining = 1.0
    for index, row in enumerate(active):
        if index == len(active) - 1:
            probability = max(0.0, remaining)
        else:
            probability = round(float(row.get("champion_prob") or 0) / active_total, 8)
            remaining -= probability
        payload.append({
            "team": row["team"],
            "champion_prob": probability,
            "eliminated": False,
            "simulations_run": int(row.get("simulations_run") or 1),
            "updated_at": updated_at,
        })

    for row in rows:
        if row.get("eliminated"):
            payload.append({
                "team": row["team"],
                "champion_prob": 0,
                "eliminated": True,
                "simulations_run": int(row.get("simulations_run") or 1),
                "updated_at": updated_at,
            })

    client.table("championship_odds").upsert(payload, on_conflict="team").execute()
    print("[OK] Probabilidades redistribuídas entre as seleções ainda vivas.")


def main() -> None:
    args = parse_args()
    client = supabase_client()
    response = client.table("championship_odds").select("team").execute()
    existing = {canonical(str(row["team"])): str(row["team"]) for row in (response.data or [])}
    requested = {canonical(team): team for team in args.teams}
    matched = [existing[key] for key in requested if key in existing]
    missing = [original for key, original in requested.items() if key not in existing]

    if matched:
        client.table("championship_odds").update(
            {
                "eliminated": True,
                "champion_prob": 0,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).in_("team", matched).execute()
        for team in matched:
            print(f"[OK] {team}: marcado como eliminado.")
        normalize_championship_odds(client)
    for team in missing:
        print(f"[AVISO] {team}: não encontrado em championship_odds.")
    if not matched:
        raise SystemExit("Nenhuma seleção foi atualizada.")


if __name__ == "__main__":
    main()
