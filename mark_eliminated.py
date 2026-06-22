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
    for team in missing:
        print(f"[AVISO] {team}: não encontrado em championship_odds.")
    if not matched:
        raise SystemExit("Nenhuma seleção foi atualizada.")


if __name__ == "__main__":
    main()
