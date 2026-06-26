"""Sincroniza resultados finalizados da Copa 2026 com o Supabase.

Uso:
    python sync_results.py
    python sync_results.py --watch --interval 300
"""

from __future__ import annotations

import argparse
import os
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client, create_client


PRIMARY_API = "https://worldcup26.ir/get/games"
FALLBACK_API = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"
REQUEST_TIMEOUT = 30

# O valor de cada item é o nome canônico usado antes da remoção de acentos.
TEAM_NAME_MAP = {
    "Brazil": "Brasil",
    "Germany": "Alemanha",
    "France": "França",
    "England": "Inglaterra",
    "Spain": "Espanha",
    "Portugal": "Portugal",
    "Argentina": "Argentina",
    "Netherlands": "Holanda",
    "Croatia": "Croácia",
    "Morocco": "Marrocos",
    "Mexico": "México",
    "United States": "Estados Unidos",
    "USA": "Estados Unidos",
    "South Korea": "Coreia do Sul",
    "South Africa": "África do Sul",
    "Saudi Arabia": "Arábia Saudita",
    "New Zealand": "Nova Zelândia",
    "Ivory Coast": "Costa do Marfim",
    "Côte d'Ivoire": "Costa do Marfim",
    "Cape Verde": "Cabo Verde",
    "Cabo Verde": "Cabo Verde",
    "Curaçao": "Curaçao",
    "Switzerland": "Suíça",
    "Belgium": "Bélgica",
    "Austria": "Áustria",
    "Czech Republic": "República Tcheca",
    "Bosnia and Herzegovina": "Bósnia e Herzegovina",
    "DR Congo": "RD Congo",
    "Democratic Republic of the Congo": "RD Congo",
    "Congo DR": "RD Congo",
    "Türkiye": "Turquia",
    "Turkey": "Turquia",
    "Japan": "Japão",
    "Egypt": "Egito",
    "Scotland": "Escócia",
    "Sweden": "Suécia",
    "Tunisia": "Tunísia",
    "Algeria": "Argélia",
    "Colombia": "Colômbia",
    "Paraguay": "Paraguai",
    "Uruguay": "Uruguai",
    "Norway": "Noruega",
    "Ghana": "Gana",
}


@dataclass(frozen=True)
class FinishedGame:
    home_team: str
    away_team: str
    home_goals: int
    away_goals: int
    match_date: datetime | None = None


def canonical_team(name: str | None) -> str:
    """Normaliza idioma, acentos, caixa e pontuação sem falhar em nomes desconhecidos."""
    raw = " ".join(str(name or "").strip().split())
    mapped = TEAM_NAME_MAP.get(raw, raw)
    ascii_name = unicodedata.normalize("NFKD", mapped).encode("ascii", "ignore").decode()
    return "".join(character for character in ascii_name.lower() if character.isalnum())


def parse_primary(payload: dict[str, Any]) -> list[FinishedGame]:
    """Converte o formato de worldcup26.ir em uma lista interna estável."""
    games: list[FinishedGame] = []
    for item in payload.get("games", []):
        finished = str(item.get("finished", "")).upper() == "TRUE"
        if not finished:
            continue
        home = item.get("home_team_name_en") or item.get("home_team_label")
        away = item.get("away_team_name_en") or item.get("away_team_label")
        try:
            home_goals = int(item["home_score"])
            away_goals = int(item["away_score"])
        except (KeyError, TypeError, ValueError):
            print(f"[AVISO] Jogo finalizado com placar inválido na API principal: {item!r}")
            continue
        if not home or not away:
            print(f"[AVISO] Jogo finalizado sem nomes de times na API principal: {item!r}")
            continue
        match_date = None
        try:
            match_date = datetime.strptime(item["local_date"], "%m/%d/%Y %H:%M")
        except (KeyError, TypeError, ValueError):
            pass
        games.append(FinishedGame(str(home), str(away), home_goals, away_goals, match_date))
    return games


def parse_fallback(payload: dict[str, Any]) -> list[FinishedGame]:
    """Converte o formato openfootball, aceitando apenas placares finais completos."""
    games: list[FinishedGame] = []
    for item in payload.get("matches", []):
        score = item.get("score") or {}
        full_time = score.get("ft")
        if not isinstance(full_time, list) or len(full_time) != 2:
            continue
        if full_time[0] is None or full_time[1] is None:
            continue
        home = item.get("team1")
        away = item.get("team2")
        if not home or not away:
            continue
        try:
            match_date = datetime.fromisoformat(str(item.get("date")))
            games.append(
                FinishedGame(
                    str(home),
                    str(away),
                    int(full_time[0]),
                    int(full_time[1]),
                    match_date,
                )
            )
        except (TypeError, ValueError):
            print(f"[AVISO] Jogo inválido no fallback: {item!r}")
    return games


def request_json(url: str) -> dict[str, Any]:
    response = requests.get(
        url,
        timeout=REQUEST_TIMEOUT,
        headers={"User-Agent": "copa-dashboard/1.0"},
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError(f"Resposta inesperada de {url}")
    return payload


def fetch_finished_games() -> tuple[list[FinishedGame], str]:
    """Usa a API principal e troca para o GitHub quando necessário."""
    try:
        games = parse_primary(request_json(PRIMARY_API))
        if not games:
            raise ValueError("A API principal não retornou jogos finalizados.")
        return games, "worldcup26.ir"
    except (requests.RequestException, ValueError) as error:
        print(f"[AVISO] API principal indisponível ({error}). Tentando fallback…")
        games = parse_fallback(request_json(FALLBACK_API))
        return games, "openfootball/worldcup.json"


def supabase_client() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not service_key:
        raise RuntimeError("Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no arquivo .env.")
    return create_client(url, service_key)


def prediction_pair(prediction: dict[str, Any]) -> tuple[str, str]:
    return canonical_team(prediction.get("home_team")), canonical_team(prediction.get("away_team"))


def choose_prediction(
    game: FinishedGame,
    candidates: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Desempata confrontos repetidos pela data mais próxima, quando disponível."""
    if not candidates:
        return None
    if len(candidates) == 1 or game.match_date is None:
        return candidates[0]

    def distance(prediction: dict[str, Any]) -> float:
        try:
            prediction_date = datetime.fromisoformat(
                str(prediction["match_date"]).replace("Z", "+00:00")
            ).replace(tzinfo=None)
            return abs((prediction_date.date() - game.match_date.date()).days)
        except (KeyError, TypeError, ValueError):
            return float("inf")

    return min(candidates, key=distance)


def run_once(client: Client) -> None:
    games, source = fetch_finished_games()
    print(f"[INFO] {len(games)} jogo(s) finalizado(s) recebido(s) de {source}.")

    predictions_response = (
        client.table("predictions")
        .select("match_id,home_team,away_team,match_date")
        .execute()
    )
    results_response = client.table("results").select("match_id").execute()
    predictions = predictions_response.data or []
    existing_results = {row["match_id"] for row in (results_response.data or [])}

    predictions_by_pair: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for prediction in predictions:
        predictions_by_pair.setdefault(prediction_pair(prediction), []).append(prediction)

    pending: list[dict[str, Any]] = []
    used_match_ids: set[str] = set()
    for game in games:
        pair = canonical_team(game.home_team), canonical_team(game.away_team)
        available = [
            prediction
            for prediction in predictions_by_pair.get(pair, [])
            if prediction["match_id"] not in used_match_ids
        ]
        prediction = choose_prediction(game, available)
        label = f"{game.home_team} {game.home_goals}×{game.away_goals} {game.away_team}"

        if prediction is None:
            print(f"[SEM PREVISÃO] {label}")
            continue

        match_id = prediction["match_id"]
        used_match_ids.add(match_id)
        if match_id in existing_results:
            print(f"[JÁ EXISTE] {match_id}: {label}")
            continue

        pending.append(
            {
                "match_id": match_id,
                "actual_home_goals": game.home_goals,
                "actual_away_goals": game.away_goals,
                # A previsão contém o horário oficial completo e com fuso.
                "match_date": prediction["match_date"],
            }
        )
        print(f"[NOVO] {match_id}: {label}")

    if pending:
        client.table("results").upsert(pending, on_conflict="match_id").execute()
    print(f"[FIM] {len(pending)} resultado(s) inserido(s).")


def positive_interval(value: str) -> int:
    interval = int(value)
    if interval <= 0:
        raise argparse.ArgumentTypeError("O intervalo deve ser maior que zero.")
    return interval


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--watch", action="store_true", help="Executa continuamente.")
    parser.add_argument(
        "--interval",
        type=positive_interval,
        default=300,
        help="Segundos entre sincronizações no modo watch (padrão: 300).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    client = supabase_client()
    if not args.watch:
        run_once(client)
        return

    print(f"[INFO] Modo contínuo ativo; intervalo de {args.interval}s. Ctrl+C para encerrar.")
    try:
        while True:
            try:
                run_once(client)
            except (requests.RequestException, RuntimeError, ValueError) as error:
                print(f"[ERRO] Sincronização falhou: {error}")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n[INFO] Sincronização encerrada pelo usuário.")


if __name__ == "__main__":
    main()
