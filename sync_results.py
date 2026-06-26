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
from datetime import datetime, timezone
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

OFFICIAL_GROUPS = {
    "A": ["Mexico", "South Africa", "South Korea", "Czech Republic"],
    "B": ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
    "C": ["Brazil", "Morocco", "Haiti", "Scotland"],
    "D": ["United States", "Paraguay", "Australia", "Turkey"],
    "E": ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
    "F": ["Netherlands", "Japan", "Sweden", "Tunisia"],
    "G": ["Belgium", "Egypt", "Iran", "New Zealand"],
    "H": ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
    "I": ["France", "Senegal", "Iraq", "Norway"],
    "J": ["Argentina", "Algeria", "Austria", "Jordan"],
    "K": ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
    "L": ["England", "Croatia", "Ghana", "Panama"],
}


@dataclass(frozen=True)
class FinishedGame:
    home_team: str
    away_team: str
    home_goals: int
    away_goals: int
    match_date: datetime | None = None


@dataclass(frozen=True)
class ApiGame:
    home_team: str
    away_team: str
    home_goals: int | None
    away_goals: int | None
    finished: bool
    status: str
    minute: str | None = None
    match_date: datetime | None = None


def canonical_team(name: str | None) -> str:
    """Normaliza idioma, acentos, caixa e pontuação sem falhar em nomes desconhecidos."""
    raw = " ".join(str(name or "").strip().split())
    mapped = TEAM_NAME_MAP.get(raw, raw)
    ascii_name = unicodedata.normalize("NFKD", mapped).encode("ascii", "ignore").decode()
    return "".join(character for character in ascii_name.lower() if character.isalnum())


def parse_primary_games(payload: dict[str, Any]) -> list[ApiGame]:
    """Converte o formato de worldcup26.ir em uma lista interna estável."""
    games: list[ApiGame] = []
    for item in payload.get("games", []):
        finished = str(item.get("finished", "")).upper() == "TRUE"
        home = item.get("home_team_name_en") or item.get("home_team_label")
        away = item.get("away_team_name_en") or item.get("away_team_label")
        if not home or not away:
            print(f"[AVISO] Jogo sem nomes de times na API principal: {item!r}")
            continue

        home_goals: int | None = None
        away_goals: int | None = None
        try:
            if item.get("home_score") is not None:
                home_goals = int(item["home_score"])
            if item.get("away_score") is not None:
                away_goals = int(item["away_score"])
        except (TypeError, ValueError):
            if finished:
                print(f"[AVISO] Jogo finalizado com placar inválido na API principal: {item!r}")
                continue

        match_date = None
        try:
            match_date = datetime.strptime(item["local_date"], "%m/%d/%Y %H:%M")
        except (KeyError, TypeError, ValueError):
            pass

        raw_time = str(item.get("time_elapsed") or "").strip()
        if finished:
            status = "finished"
        elif raw_time.lower() in {"live", "halftime", "half-time"} or raw_time.replace("'", "").isdigit():
            status = "live"
        elif raw_time:
            status = "scheduled"
        else:
            status = "scheduled"

        games.append(
            ApiGame(
                str(home),
                str(away),
                home_goals,
                away_goals,
                finished,
                status,
                raw_time or None,
                match_date,
            )
        )
    return games


def parse_primary(payload: dict[str, Any]) -> list[FinishedGame]:
    """Converte o formato de worldcup26.ir em jogos finalizados."""
    finished_games = []
    for game in parse_primary_games(payload):
        if not game.finished:
            continue
        if game.home_goals is None or game.away_goals is None:
            continue
        finished_games.append(
            FinishedGame(
                game.home_team,
                game.away_team,
                game.home_goals,
                game.away_goals,
                game.match_date,
            )
        )
    return finished_games


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


def finished_from_api_games(games: list[ApiGame]) -> list[FinishedGame]:
    return [
        FinishedGame(
            game.home_team,
            game.away_team,
            game.home_goals,
            game.away_goals,
            game.match_date,
        )
        for game in games
        if game.finished and game.home_goals is not None and game.away_goals is not None
    ]


def supabase_client() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not service_key:
        raise RuntimeError("Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no arquivo .env.")
    return create_client(url, service_key)


def prediction_pair(prediction: dict[str, Any]) -> tuple[str, str]:
    return canonical_team(prediction.get("home_team")), canonical_team(prediction.get("away_team"))


def display_team(team: str) -> str:
    return TEAM_DISPLAY.get(team, team)


def is_group_round(prediction: dict[str, Any]) -> bool:
    return "fase de grupos" in str(prediction.get("round", "")).casefold()


def group_for_team(team: str) -> str | None:
    canonical = canonical_team(team)
    for group, teams in OFFICIAL_GROUPS.items():
        if any(canonical_team(candidate) == canonical for candidate in teams):
            return group
    return None


def rank_group(
    group: str,
    predictions: list[dict[str, Any]],
    results_by_id: dict[str, dict[str, Any]],
) -> list[dict[str, Any]] | None:
    teams = OFFICIAL_GROUPS[group]
    canonical_group = {canonical_team(team) for team in teams}
    table = {
        team: {"team": team, "points": 0, "gf": 0, "ga": 0, "wins": 0}
        for team in teams
    }
    played = 0

    for prediction in predictions:
        if not is_group_round(prediction):
            continue
        home = str(prediction["home_team"])
        away = str(prediction["away_team"])
        if canonical_team(home) not in canonical_group or canonical_team(away) not in canonical_group:
            continue
        result = results_by_id.get(str(prediction["match_id"]))
        if not result:
            continue

        home_goals = int(result["actual_home_goals"])
        away_goals = int(result["actual_away_goals"])
        home_key = next(team for team in teams if canonical_team(team) == canonical_team(home))
        away_key = next(team for team in teams if canonical_team(team) == canonical_team(away))
        table[home_key]["gf"] += home_goals
        table[home_key]["ga"] += away_goals
        table[away_key]["gf"] += away_goals
        table[away_key]["ga"] += home_goals
        if home_goals > away_goals:
            table[home_key]["points"] += 3
            table[home_key]["wins"] += 1
        elif away_goals > home_goals:
            table[away_key]["points"] += 3
            table[away_key]["wins"] += 1
        else:
            table[home_key]["points"] += 1
            table[away_key]["points"] += 1
        played += 1

    if played < 6:
        return None

    return sorted(
        table.values(),
        key=lambda row: (
            row["points"],
            row["gf"] - row["ga"],
            row["gf"],
            row["wins"],
            row["team"],
        ),
        reverse=True,
    )


def infer_eliminated_teams(
    predictions: list[dict[str, Any]],
    results: list[dict[str, Any]],
) -> set[str]:
    """Marca automaticamente seleções eliminadas por grupos completos e mata-mata."""
    results_by_id = {str(row["match_id"]): row for row in results}
    eliminated: set[str] = set()
    completed_rankings: dict[str, list[dict[str, Any]]] = {}

    for group in OFFICIAL_GROUPS:
        ranking = rank_group(group, predictions, results_by_id)
        if not ranking:
            continue
        completed_rankings[group] = ranking
        # O quarto colocado de grupo fechado está eliminado imediatamente.
        eliminated.add(display_team(str(ranking[3]["team"])))

    # Quando todos os grupos fecharem, os 4 piores terceiros também estão eliminados.
    if len(completed_rankings) == len(OFFICIAL_GROUPS):
        thirds = [
            {**ranking[2], "group": group}
            for group, ranking in completed_rankings.items()
        ]
        best_thirds = sorted(
            thirds,
            key=lambda row: (
                row["points"],
                row["gf"] - row["ga"],
                row["gf"],
                row["wins"],
                row["team"],
            ),
            reverse=True,
        )[:8]
        qualified_third_keys = {canonical_team(str(row["team"])) for row in best_thirds}
        for row in thirds:
            if canonical_team(str(row["team"])) not in qualified_third_keys:
                eliminated.add(display_team(str(row["team"])))

    # Em mata-mata, o perdedor de jogos decididos no tempo normal/prorrogação é eliminado.
    for prediction in predictions:
        if is_group_round(prediction):
            continue
        result = results_by_id.get(str(prediction["match_id"]))
        if not result:
            continue
        home_goals = int(result["actual_home_goals"])
        away_goals = int(result["actual_away_goals"])
        if home_goals > away_goals:
            eliminated.add(display_team(str(prediction["away_team"])))
        elif away_goals > home_goals:
            eliminated.add(display_team(str(prediction["home_team"])))

    return eliminated


def sync_eliminated_teams(client: Client, eliminated: set[str]) -> None:
    if not eliminated:
        print("[ELIMINADOS] Nenhuma seleção nova inferida.")
        return

    response = client.table("championship_odds").select("team,eliminated").execute()
    existing = {
        canonical_team(str(row["team"])): {
            "team": str(row["team"]),
            "eliminated": bool(row.get("eliminated")),
        }
        for row in (response.data or [])
    }
    matched = []
    for team in sorted(eliminated):
        row = existing.get(canonical_team(team))
        if row and not row["eliminated"]:
            matched.append(row["team"])

    if not matched:
        print("[ELIMINADOS] Nenhuma atualização necessária.")
        return

    client.table("championship_odds").update(
        {
            "eliminated": True,
            "champion_prob": 0,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).in_("team", matched).execute()
    print(f"[ELIMINADOS] {len(matched)} seleção(ões) marcada(s): {', '.join(matched)}")


def choose_prediction(
    game: FinishedGame | ApiGame,
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


def choose_prediction_for_game(
    game: FinishedGame | ApiGame,
    predictions_by_pair: dict[tuple[str, str], list[dict[str, Any]]],
    used_match_ids: set[str],
) -> tuple[dict[str, Any] | None, bool]:
    """Casa jogo da API com previsão mesmo quando casa/fora vêm invertidos."""
    home_key = canonical_team(game.home_team)
    away_key = canonical_team(game.away_team)
    for pair, reversed_pair in [((home_key, away_key), False), ((away_key, home_key), True)]:
        available = [
            prediction
            for prediction in predictions_by_pair.get(pair, [])
            if prediction["match_id"] not in used_match_ids
        ]
        prediction = choose_prediction(game, available)
        if prediction is not None:
            return prediction, reversed_pair
    return None, False


def orient_score_to_prediction(
    game: FinishedGame | ApiGame,
    reversed_pair: bool,
) -> tuple[int | None, int | None]:
    """Retorna placar na ordem home/away da previsão salva no Supabase."""
    if reversed_pair:
        return game.away_goals, game.home_goals
    return game.home_goals, game.away_goals


def sync_live_matches(
    client: Client,
    games: list[ApiGame],
    predictions_by_pair: dict[tuple[str, str], list[dict[str, Any]]],
    source: str,
) -> None:
    """Atualiza placares quase ao vivo e marca jogos encerrados como finished."""
    if not games:
        return

    records: list[dict[str, Any]] = []
    used_match_ids: set[str] = set()
    for game in games:
        if game.status not in {"live", "finished"}:
            continue
        prediction, reversed_pair = choose_prediction_for_game(game, predictions_by_pair, used_match_ids)
        if prediction is None:
            continue

        used_match_ids.add(prediction["match_id"])
        home_goals, away_goals = orient_score_to_prediction(game, reversed_pair)
        records.append({
            "match_id": prediction["match_id"],
            "live_home_goals": home_goals,
            "live_away_goals": away_goals,
            "status": game.status,
            "minute": game.minute,
            "source": source,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

    if not records:
        print("[LIVE] Nenhum placar ao vivo para atualizar.")
        return

    try:
        client.table("live_matches").upsert(records, on_conflict="match_id").execute()
        live_count = sum(1 for record in records if record["status"] == "live")
        finished_count = sum(1 for record in records if record["status"] == "finished")
        print(f"[LIVE] {live_count} ao vivo e {finished_count} finalizado(s) atualizados em live_matches.")
    except Exception as error:  # noqa: BLE001 - evita quebrar o Action antes do SQL novo ser aplicado.
        print(f"[LIVE][AVISO] Não foi possível atualizar live_matches: {error}")


def run_once(client: Client) -> None:
    api_games: list[ApiGame] = []
    try:
        api_games = parse_primary_games(request_json(PRIMARY_API))
        games = finished_from_api_games(api_games)
        source = "worldcup26.ir"
    except (requests.RequestException, ValueError) as error:
        print(f"[AVISO] API principal indisponível ({error}). Tentando fallback…")
        games = parse_fallback(request_json(FALLBACK_API))
        source = "openfootball/worldcup.json"

    print(f"[INFO] {len(games)} jogo(s) finalizado(s) recebido(s) de {source}.")

    predictions_response = (
        client.table("predictions")
        .select("match_id,home_team,away_team,round,match_date")
        .execute()
    )
    results_response = (
        client.table("results")
        .select("match_id,actual_home_goals,actual_away_goals,match_date")
        .execute()
    )
    predictions = predictions_response.data or []
    synced_results = results_response.data or []
    existing_results = {row["match_id"] for row in synced_results}

    predictions_by_pair: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for prediction in predictions:
        predictions_by_pair.setdefault(prediction_pair(prediction), []).append(prediction)

    if api_games:
        sync_live_matches(client, api_games, predictions_by_pair, source)

    pending: list[dict[str, Any]] = []
    used_match_ids: set[str] = set()
    for game in games:
        prediction, reversed_pair = choose_prediction_for_game(game, predictions_by_pair, used_match_ids)
        label = f"{game.home_team} {game.home_goals}×{game.away_goals} {game.away_team}"

        if prediction is None:
            print(f"[SEM PREVISÃO] {label}")
            continue

        match_id = prediction["match_id"]
        used_match_ids.add(match_id)
        home_goals, away_goals = orient_score_to_prediction(game, reversed_pair)
        if match_id in existing_results:
            print(f"[JÁ EXISTE] {match_id}: {label}")
            continue

        pending.append(
            {
                "match_id": match_id,
                "actual_home_goals": home_goals,
                "actual_away_goals": away_goals,
                # A previsão contém o horário oficial completo e com fuso.
                "match_date": prediction["match_date"],
            }
        )
        print(f"[NOVO] {match_id}: {label}")

    if pending:
        client.table("results").upsert(pending, on_conflict="match_id").execute()
        synced_results.extend(pending)
    sync_eliminated_teams(client, infer_eliminated_teams(predictions, synced_results))
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
