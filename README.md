# Radar da Copa — dashboard público

Dashboard estático para acompanhar as previsões do modelo da Copa do Mundo, comparar os
placares previstos com os resultados reais e publicar as métricas pelo GitHub Pages.

O frontend usa HTML, CSS e JavaScript puro. Os dados são lidos diretamente do Supabase com
a chave pública `anon`; as escritas são feitas apenas pelos scripts Python com a
`service_role` guardada localmente.

## Estrutura

```text
copa-dashboard/
├── index.html
├── style.css
├── app.js
├── supabase_schema.sql
├── upload_predictions.py
├── upload_results.py
├── sync_results.py
├── retrain_after_second_round.py
├── simulate_champion.py
├── mark_eliminated.py
├── predictions.json
├── results.json
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

## 1. Configurar o Supabase

1. Abra o projeto no [Supabase](https://supabase.com/dashboard).
2. Entre em **SQL Editor**, crie uma nova consulta e execute todo o conteúdo de
   `supabase_schema.sql`.
3. Em **Project Settings → API**, copie:
   - a URL do projeto;
   - a chave pública `anon`;
   - a chave secreta `service_role`.
4. Copie `.env.example` para `.env` e preencha somente a URL e a `service_role`:

   ```env
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_SERVICE_KEY=sua-service-role-key
   ```

5. No início de `app.js`, preencha a URL e a chave **anon**:

   ```js
   const SUPABASE_URL = "https://seu-projeto.supabase.co";
   const SUPABASE_ANON_KEY = "sua-anon-key";
   ```

> Nunca coloque a `service_role` no `app.js`, no GitHub ou em qualquer arquivo público.

O SQL cria as tabelas, índices, views e policies de Row Level Security. A view
`match_summary` só apresenta partidas que possuem previsão e resultado. A view
`accuracy_summary` entrega as métricas por rodada e a linha consolidada `Geral`.

## 2. Preparar o Python

Na pasta do projeto:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

No macOS ou Linux, ative o ambiente com `source .venv/bin/activate`.

## 3. Enviar previsões

Edite `predictions.json` com a saída do notebook. Cada `match_id` precisa ser estável e
único, pois ele conecta previsão e resultado.

```powershell
python upload_predictions.py
```

Também é possível indicar outro arquivo:

```powershell
python upload_predictions.py caminho\para\previsoes.json
```

O script valida campos, placares, datas e probabilidades. Em seguida consulta os IDs já
existentes, faz `upsert` por `match_id` e informa no console quais registros foram inseridos
ou atualizados.

## 4. Enviar resultados

Depois dos jogos, preencha `results.json` usando exatamente os mesmos `match_id`:

```powershell
python upload_results.py
```

O comando também aceita um caminho alternativo. Como a view usa `inner join`, uma partida só
aparece publicamente depois que sua previsão e seu resultado estiverem registrados.

## 5. Testar localmente

Por usar módulos JavaScript, abra o frontend por um servidor HTTP local:

```powershell
python -m http.server 8000
```

Acesse `http://localhost:8000`. Abrir `index.html` diretamente como `file://` pode bloquear
o carregamento do módulo remoto em alguns navegadores.

## 6. Publicar no GitHub Pages

1. Versione esta pasta em um repositório GitHub. Confirme que `.env` não aparece no commit.
2. Em **Settings → Pages**, selecione **Deploy from a branch**.
3. Escolha a branch (`main`) e a pasta que contém `index.html`.
4. Salve e aguarde a URL pública disponibilizada pelo GitHub.

Se esta pasta continuar dentro de um repositório maior, você pode usar GitHub Actions ou
uma branch `gh-pages` para publicar apenas `copa-dashboard/`.

## Rotina após cada rodada

1. Execute o notebook antes dos jogos e exporte as novas previsões para `predictions.json`.
2. Rode `python upload_predictions.py`.
3. Depois dos jogos, atualize `results.json`.
4. Rode `python upload_results.py`.
5. Recarregue o dashboard. Não é necessário republicar o site quando apenas os dados mudam.

### Retreino pós-2ª rodada

Quando os 48 jogos das duas primeiras rodadas estiverem no Supabase, use o script
operacional abaixo para recalcular a terceira rodada com Elo + Poisson:

```powershell
python sync_results.py
python retrain_after_second_round.py
python upload_predictions.py
python simulate_champion.py
```

O `retrain_after_second_round.py`:

- valida se existem 48 resultados das rodadas 1 e 2;
- sincroniza o `results.json` local com o Supabase;
- baixa o histórico internacional pelo `kagglehub`;
- anexa os resultados observados da Copa 2026;
- retreina Elo + Poisson;
- sobrescreve somente as 24 previsões da Rodada 3 em `predictions.json`.

Se faltar algum resultado, o script interrompe com a lista de `match_id` pendentes para
evitar publicar uma previsão marcada como pós-2ª rodada sem todos os jogos observados.

## Sincronização automática de resultados

O script `sync_results.py` consulta primeiro a API pública `worldcup26.ir`. Se ela estiver
indisponível ou não retornar jogos finalizados, usa como fallback o calendário mantido pelo
projeto `openfootball/worldcup.json`.

Para executar uma sincronização e encerrar:

```powershell
python sync_results.py
```

O script normaliza nomes em português e inglês, procura a previsão pelo par casa/visitante e:

- insere resultados novos;
- atualiza a tabela `live_matches` com placares quase ao vivo quando a API informar jogo em andamento;
- informa os resultados que já estavam no banco;
- avisa sobre jogos finalizados sem previsão correspondente;
- nunca interrompe toda a sincronização apenas por encontrar um nome desconhecido.

Durante dias de jogo, use o modo contínuo. O intervalo padrão é de cinco minutos:

```powershell
python sync_results.py --watch
```

Para escolher outro intervalo, em segundos:

```powershell
python sync_results.py --watch --interval 120
```

Interrompa com `Ctrl+C`. As mesmas variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` do
arquivo `.env` são reutilizadas.

## Seção de próximos jogos

A seção **Próximos jogos** é automática e não exige configuração adicional. O navegador
consulta a agenda pública, tenta o fallback quando necessário e mostra os três próximos jogos
no horário de Brasília. Quando encontra uma previsão correspondente no Supabase, também exibe
o placar previsto e as probabilidades. Sem previsão, o card permanece visível com a mensagem
“Previsão não disponível”. Se as duas APIs falharem ou o torneio terminar, a seção é ocultada.

## Configuração do GitHub Actions

O projeto inclui dois workflows:

- `.github/workflows/sync-results.yml`: execução automática a cada 10 minutos, das 10h até 2h
  no horário de Brasília;
- `.github/workflows/sync-manual.yml`: execução sob demanda pelo botão **Run workflow**.

### Ativação

1. Faça commit dos arquivos do projeto e envie-os para um repositório no GitHub:

   ```powershell
   git add .
   git commit -m "Configura sincronização automática de resultados"
   git push
   ```

2. No repositório, abra **Settings → Secrets and variables → Actions**.
3. Clique em **New repository secret** e adicione:
   - `SUPABASE_URL`: a URL do projeto, por exemplo `https://xxxx.supabase.co`;
   - `SUPABASE_SERVICE_KEY`: a chave **service role** do Supabase, nunca a anon key.
4. Depois do push, o workflow automático começa a rodar nos horários configurados.
5. Para acompanhar logs e execuções, abra a aba **Actions** do repositório.

### Horários

O GitHub Actions interpreta cron em UTC. Os dois agendamentos cobrem a janela desejada:

```yaml
- cron: '*/10 13-23 * * *'  # 10h–20h em Brasília
- cron: '*/10 0-5 * * *'    # 21h–2h em Brasília
```

Agendamentos do GitHub podem começar com alguns minutos de atraso. O sincronizador é
idempotente: resultados já existentes são apenas registrados no log e não são duplicados.

Falhas temporárias de rede ou indisponibilidade das APIs também ficam visíveis no histórico,
mas o passo usa `continue-on-error` para evitar alertas desnecessários de workflow com falha.

### Execução manual

Na aba **Actions**, escolha **Sincronizar resultados manualmente**, clique em **Run workflow**
e confirme a branch. Os mesmos secrets são usados automaticamente.

## Definição das métricas

- **Resultado correto:** a previsão acertou vitória da casa, empate ou vitória do visitante,
  independentemente do placar.
- **Placar exato:** os gols previstos para os dois lados são idênticos ao resultado real.

## Segurança

- `.env` está ignorado pelo Git.
- O navegador recebe somente a anon key.
- A service key fica nos scripts locais e não deve ser compartilhada.
- O RLS permite leitura pública e reserva as alterações para a `service_role`.

## Probabilidades de campeão

Depois de aplicar novamente `supabase_schema.sql` no SQL Editor, execute:

```powershell
python simulate_champion.py
```

O comando lê as previsões do Supabase, infere os grupos pelos confrontos disponíveis,
executa 10.000 simulações Monte Carlo e atualiza `championship_odds`. Ele funciona com
previsões parciais: partidas ausentes não entram na tabela simulada. Como a tabela
`predictions` não contém o chaveamento oficial do mata-mata, a primeira rodada eliminatória
é aproximada evitando, quando possível, reencontros do mesmo grupo.

Para uma execução menor de diagnóstico ou uma simulação reproduzível:

```powershell
python simulate_champion.py --simulations 1000 --seed 42
```

Após uma eliminação confirmada, marque uma ou mais seleções usando o nome exibido no dashboard:

```powershell
python mark_eliminated.py "Brasil" "Argentina"
```

Uma nova execução do simulador preserva as marcações de eliminação existentes e mantém a
probabilidade dessas seleções em zero.

## Seções de probabilidades no dashboard

Quando `championship_odds` possuir dados, o frontend mostra automaticamente:

- a chance de título e o próximo jogo do Brasil;
- os cinco favoritos ao título;
- o mapa mundial de probabilidades carregado com D3.js.

Se a tabela ainda estiver vazia, ou se D3/GeoJSON estiverem indisponíveis, as respectivas
seções são ocultadas sem interromper o restante do dashboard.

## Atualização ao vivo

Partidas com `live_matches.status = 'live'` recebem a tag **AGORA**, com link para a CazéTV, e
continuam visíveis mesmo se houver acréscimos, prorrogação ou pênaltis. O card só sai do ar
quando o sincronizador grava `live_matches.status = 'finished'`. Como rede de segurança, caso o
placar ao vivo ainda não tenha chegado ao Supabase, o navegador usa uma janela de 195 minutos a
partir do horário previsto. O workflow do GitHub Actions sincroniza resultados e placares quase
ao vivo a cada 10 minutos; o navegador verifica o estado a cada 30 segundos e, durante jogos ao
vivo, recarrega os dados do Supabase a cada 10 minutos.
