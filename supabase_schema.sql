-- Dashboard público de previsões da Copa do Mundo
-- Execute este arquivo completo no Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.predictions (
    id uuid primary key default gen_random_uuid(),
    match_id text not null unique,
    home_team text not null,
    away_team text not null,
    predicted_home_goals integer not null check (predicted_home_goals >= 0),
    predicted_away_goals integer not null check (predicted_away_goals >= 0),
    home_win_prob numeric not null check (home_win_prob between 0 and 1),
    draw_prob numeric not null check (draw_prob between 0 and 1),
    away_win_prob numeric not null check (away_win_prob between 0 and 1),
    round text not null,
    match_date timestamptz not null,
    created_at timestamptz not null default now(),
    constraint predictions_different_teams check (home_team <> away_team),
    constraint predictions_probability_sum check (
        abs((home_win_prob + draw_prob + away_win_prob) - 1) <= 0.001
    )
);

create table if not exists public.results (
    id uuid primary key default gen_random_uuid(),
    match_id text not null unique,
    actual_home_goals integer not null check (actual_home_goals >= 0),
    actual_away_goals integer not null check (actual_away_goals >= 0),
    home_penalties integer check (home_penalties is null or home_penalties >= 0),
    away_penalties integer check (away_penalties is null or away_penalties >= 0),
    advanced_team text,
    decided_on_penalties boolean not null default false,
    match_date timestamptz not null,
    created_at timestamptz not null default now()
);

alter table public.results
    add column if not exists home_penalties integer check (home_penalties is null or home_penalties >= 0),
    add column if not exists away_penalties integer check (away_penalties is null or away_penalties >= 0),
    add column if not exists advanced_team text,
    add column if not exists decided_on_penalties boolean not null default false;

create index if not exists predictions_match_date_idx
    on public.predictions (match_date desc);
create index if not exists predictions_round_idx
    on public.predictions (round);
create index if not exists results_match_date_idx
    on public.results (match_date desc);

drop view if exists public.accuracy_summary;
drop view if exists public.match_summary;

-- security_invoker faz a view respeitar o RLS das tabelas de origem.
create view public.match_summary
with (security_invoker = true)
as
select
    p.id as prediction_id,
    r.id as result_id,
    p.match_id,
    p.home_team,
    p.away_team,
    p.predicted_home_goals,
    p.predicted_away_goals,
    p.home_win_prob,
    p.draw_prob,
    p.away_win_prob,
    p.round,
    p.match_date,
    p.created_at as prediction_created_at,
    r.actual_home_goals,
    r.actual_away_goals,
    r.home_penalties,
    r.away_penalties,
    r.advanced_team,
    r.decided_on_penalties,
    r.match_date as result_match_date,
    r.created_at as result_created_at,
    case
        when lower(p.round) not like '%fase de grupos%'
             and r.advanced_team is not null
             and lower(r.advanced_team) = lower(
                case
                    when p.predicted_home_goals > p.predicted_away_goals then p.home_team
                    when p.predicted_home_goals < p.predicted_away_goals then p.away_team
                    when p.home_win_prob >= p.away_win_prob then p.home_team
                    else p.away_team
                end
             ) then true
        when lower(p.round) not like '%fase de grupos%'
             and r.advanced_team is not null then false
        when p.predicted_home_goals > p.predicted_away_goals
             and r.actual_home_goals > r.actual_away_goals then true
        when p.predicted_home_goals = p.predicted_away_goals
             and r.actual_home_goals = r.actual_away_goals then true
        when p.predicted_home_goals < p.predicted_away_goals
             and r.actual_home_goals < r.actual_away_goals then true
        else false
    end as result_correct,
    (
        p.predicted_home_goals = r.actual_home_goals
        and p.predicted_away_goals = r.actual_away_goals
    ) as exact_score
from public.predictions p
inner join public.results r using (match_id);

create view public.accuracy_summary
with (security_invoker = true)
as
select
    round,
    count(*)::integer as total_matches,
    count(*) filter (where result_correct)::integer as correct_results,
    count(*) filter (where exact_score)::integer as exact_scores,
    round(100.0 * count(*) filter (where result_correct) / nullif(count(*), 0), 2)
        as result_accuracy_pct,
    round(100.0 * count(*) filter (where exact_score) / nullif(count(*), 0), 2)
        as exact_accuracy_pct,
    max(match_date) as latest_match_date
from public.match_summary
group by round

union all

select
    'Geral'::text as round,
    count(*)::integer as total_matches,
    count(*) filter (where result_correct)::integer as correct_results,
    count(*) filter (where exact_score)::integer as exact_scores,
    round(100.0 * count(*) filter (where result_correct) / nullif(count(*), 0), 2)
        as result_accuracy_pct,
    round(100.0 * count(*) filter (where exact_score) / nullif(count(*), 0), 2)
        as exact_accuracy_pct,
    max(match_date) as latest_match_date
from public.match_summary;

alter table public.predictions enable row level security;
alter table public.results enable row level security;

drop policy if exists "Leitura pública de previsões" on public.predictions;
create policy "Leitura pública de previsões"
on public.predictions for select
to anon
using (true);

drop policy if exists "Leitura pública de resultados" on public.results;
create policy "Leitura pública de resultados"
on public.results for select
to anon
using (true);

-- A service_role ignora RLS por padrão. As policies explícitas documentam a intenção.
drop policy if exists "Service role gerencia previsões" on public.predictions;
create policy "Service role gerencia previsões"
on public.predictions for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role gerencia resultados" on public.results;
create policy "Service role gerencia resultados"
on public.results for all
to service_role
using (true)
with check (true);

grant select on public.predictions, public.results to anon;
grant select on public.match_summary, public.accuracy_summary to anon;
grant all on public.predictions, public.results to service_role;

-- Placar quase ao vivo usado durante a janela dos jogos.
create table if not exists public.live_matches (
    id uuid primary key default gen_random_uuid(),
    match_id text not null unique references public.predictions(match_id) on delete cascade,
    live_home_goals integer check (live_home_goals >= 0),
    live_away_goals integer check (live_away_goals >= 0),
    status text not null default 'scheduled',
    minute text,
    source text,
    updated_at timestamptz not null default now()
);

create index if not exists live_matches_status_idx
    on public.live_matches (status, updated_at desc);

alter table public.live_matches enable row level security;

drop policy if exists "Leitura pública de placares ao vivo"
    on public.live_matches;
create policy "Leitura pública de placares ao vivo"
on public.live_matches for select
to anon
using (true);

drop policy if exists "Service role gerencia placares ao vivo"
    on public.live_matches;
create policy "Service role gerencia placares ao vivo"
on public.live_matches for all
to service_role
using (true)
with check (true);

grant select on public.live_matches to anon;
grant all on public.live_matches to service_role;

-- Top placares finais projetados para jogos de mata-mata.
-- Mantemos isso separado de predictions porque home_win_prob/away_win_prob no
-- mata-mata representam chance de avançar, não distribuição direta de gols.
create table if not exists public.prediction_scorelines (
    id uuid primary key default gen_random_uuid(),
    match_id text not null references public.predictions(match_id) on delete cascade,
    rank integer not null check (rank > 0),
    home_goals integer not null check (home_goals >= 0),
    away_goals integer not null check (away_goals >= 0),
    probability numeric not null check (probability between 0 and 1),
    created_at timestamptz not null default now(),
    unique (match_id, rank)
);

create index if not exists prediction_scorelines_match_idx
    on public.prediction_scorelines (match_id, rank);

alter table public.prediction_scorelines enable row level security;

drop policy if exists "Leitura pública dos placares projetados"
    on public.prediction_scorelines;
create policy "Leitura pública dos placares projetados"
on public.prediction_scorelines for select
to anon
using (true);

drop policy if exists "Service role gerencia placares projetados"
    on public.prediction_scorelines;
create policy "Service role gerencia placares projetados"
on public.prediction_scorelines for all
to service_role
using (true)
with check (true);

grant select on public.prediction_scorelines to anon;
grant all on public.prediction_scorelines to service_role;

-- Probabilidades de título calculadas pelo simulador Monte Carlo independente.
create table if not exists public.championship_odds (
    id uuid primary key default gen_random_uuid(),
    team text not null unique,
    champion_prob numeric not null check (champion_prob between 0 and 1),
    eliminated boolean not null default false,
    simulations_run integer not null check (simulations_run > 0),
    updated_at timestamptz not null default now()
);

create index if not exists championship_odds_probability_idx
    on public.championship_odds (champion_prob desc);

alter table public.championship_odds enable row level security;

drop policy if exists "Leitura pública das probabilidades de título"
    on public.championship_odds;
create policy "Leitura pública das probabilidades de título"
on public.championship_odds for select
to anon
using (true);

drop policy if exists "Service role gerencia probabilidades de título"
    on public.championship_odds;
create policy "Service role gerencia probabilidades de título"
on public.championship_odds for all
to service_role
using (true)
with check (true);

grant select on public.championship_odds to anon;
grant all on public.championship_odds to service_role;

-- Contador simples de acessos do dashboard.
-- O visitante não escreve diretamente na tabela: ele chama a função
-- increment_site_visit, que incrementa e devolve o total atualizado.
create table if not exists public.site_visits (
    key text primary key,
    total_count bigint not null default 0 check (total_count >= 0),
    updated_at timestamptz not null default now()
);

insert into public.site_visits (key, total_count)
values ('dashboard', 0)
on conflict (key) do nothing;

alter table public.site_visits enable row level security;

drop policy if exists "Leitura pública do contador de acessos"
    on public.site_visits;
create policy "Leitura pública do contador de acessos"
on public.site_visits for select
to anon
using (true);

drop policy if exists "Service role gerencia contador de acessos"
    on public.site_visits;
create policy "Service role gerencia contador de acessos"
on public.site_visits for all
to service_role
using (true)
with check (true);

create or replace function public.increment_site_visit(counter_key text default 'dashboard')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
    new_total bigint;
begin
    insert into public.site_visits as visits (key, total_count, updated_at)
    values (counter_key, 1, now())
    on conflict (key) do update
        set total_count = visits.total_count + 1,
            updated_at = now()
    returning total_count into new_total;

    return new_total;
end;
$$;

grant select on public.site_visits to anon;
grant all on public.site_visits to service_role;
grant execute on function public.increment_site_visit(text) to anon, authenticated, service_role;
