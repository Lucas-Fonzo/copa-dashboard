"""Envia resultados de results.json para o Supabase."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


REQUIRED_FIELDS = {
    "match_id",
    "actual_home_goals",
    "actual_away_goals",
    "match_date",
}


def load_records(path: Path) -> list[dict[str, Any]]:
    """Carrega e valida os resultados antes de qualquer envio."""
    with path.open(encoding="utf-8") as file:
        records = json.load(file)

    if not isinstance(records, list):
        raise ValueError("O JSON deve conter uma lista de resultados.")

    seen: set[str] = set()
    for index, record in enumerate(records, start=1):
        if not isinstance(record, dict):
            raise ValueError(f"Registro {index}: esperado um objeto JSON.")
        missing = REQUIRED_FIELDS - record.keys()
        if missing:
            raise ValueError(f"Registro {index}: campos ausentes: {sorted(missing)}")

        match_id = str(record["match_id"]).strip()
        if not match_id or match_id in seen:
            raise ValueError(f"Registro {index}: match_id vazio ou duplicado: {match_id!r}")
        seen.add(match_id)

        for field in ("actual_home_goals", "actual_away_goals"):
            if not isinstance(record[field], int) or record[field] < 0:
                raise ValueError(f"Registro {index}: {field} deve ser inteiro não negativo.")
        for field in ("home_penalties", "away_penalties"):
            if field in record and record[field] is not None:
                if not isinstance(record[field], int) or record[field] < 0:
                    raise ValueError(f"Registro {index}: {field} deve ser inteiro nao negativo ou null.")
        if "advanced_team" in record and record["advanced_team"] is not None:
            if not str(record["advanced_team"]).strip():
                raise ValueError(f"Registro {index}: advanced_team nao pode ser vazio.")
        if "decided_on_penalties" in record and not isinstance(record["decided_on_penalties"], bool):
            raise ValueError(f"Registro {index}: decided_on_penalties deve ser booleano.")
        datetime.fromisoformat(str(record["match_date"]).replace("Z", "+00:00"))

    return records


def supabase_client() -> Client:
    """Cria o cliente administrativo usando somente variáveis do .env."""
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not service_key:
        raise RuntimeError("Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no arquivo .env.")
    return create_client(url, service_key)


def upload(client: Client, records: list[dict[str, Any]]) -> None:
    """Faz upsert e informa quais IDs eram novos ou já existentes."""
    if not records:
        print("Nenhum resultado encontrado; nada foi enviado.")
        return

    match_ids = [record["match_id"] for record in records]
    response = (
        client.table("results")
        .select("match_id")
        .in_("match_id", match_ids)
        .execute()
    )
    existing = {row["match_id"] for row in (response.data or [])}

    client.table("results").upsert(
        records,
        on_conflict="match_id",
    ).execute()

    for match_id in match_ids:
        action = "atualizado" if match_id in existing else "inserido"
        print(f"[OK] {match_id}: {action}")
    print(f"Concluído: {len(records)} resultado(s) processado(s).")


def main() -> None:
    default_path = Path(__file__).with_name("results.json")
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_path
    upload(supabase_client(), load_records(input_path))


if __name__ == "__main__":
    main()
