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
    match_date timestamptz not null,
    created_at timestamptz not null default now()
);

create index if not exists predictions_match_date_idx
    on public.predictions (match_date desc);
create index if not exists predictions_round_idx
    on public.predictions (round);
create index if not exists results_match_date_idx
    on public.results (match_date desc);

-- security_invoker faz a view respeitar o RLS das tabelas de origem.
create or replace view public.match_summary
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
    r.match_date as result_match_date,
    r.created_at as result_created_at,
    case
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

create or replace view public.accuracy_summary
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

