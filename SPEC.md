# Especificação do Produto — Ferramenta Interna de Teste de Usabilidade (estilo Maze)

> **Para quem vai ler isto:** este é o documento de handoff para o Claude Code construir a
> ferramenta. Ele descreve o produto, a stack, o modelo de dados e — o mais importante —
> divide a construção em **marcos incrementais (M0…M7)**. Construa **um marco de cada vez**,
> na ordem. Ao terminar cada marco, pare, deixe a fatia funcionando ponta a ponta e
> testável antes de avançar para o próximo.

---

## 1. Visão geral

Estamos construindo uma ferramenta **interna** de teste de usabilidade não-moderado,
inspirada no Maze (maze.co). A ideia central: uma pessoa do time (o **criador**) monta um
teste com um protótipo navegável e uma ou mais **tarefas**; pessoas externas (os
**testadores**) recebem um link anônimo, leem a tarefa em um painel e clicam pelo protótipo;
a ferramenta registra cada clique e mostra ao criador **o que os testadores fizeram**
(taxa de sucesso, cliques, misclicks, heatmap por tela e o caminho percorrido).

O protótipo pode vir de **duas fontes**, à escolha do criador:
1. **Upload de imagens (PNG/JPG)** onde o próprio criador **desenha as áreas clicáveis
   (hotspots)** e liga cada uma a uma tela de destino. *(Este é o diferencial — o Maze não
   tem isso; nele os hotspots só vêm do Figma.)*
2. **Importação de um protótipo do Figma**, onde as telas (frames) e as conexões clicáveis
   são importadas automaticamente.

### Conceitos e vocabulário (use estes nomes no código)
- **Study** — um teste completo. Contém blocos ordenados.
- **Block** — um item ordenado dentro do study. No v1 há dois tipos: **Mission** (tarefa com
  protótipo) e, em marcos posteriores, **Question** (pergunta).
- **Prototype** — o conjunto navegável de telas. **Um protótipo por study** (simplificação
  inicial, igual ao Maze).
- **Screen** — uma tela do protótipo (uma imagem).
- **Hotspot** — uma área clicável dentro de uma tela, que leva a uma tela de destino.
- **Mission** — a tarefa: um título, uma descrição (cenário), uma tela inicial e um
  **critério de sucesso**.
- **Session** — uma sessão de um testador anônimo (uma "resposta").
- **Event** — um evento registrado durante a sessão (um clique com coordenadas, etc.).

---

## 2. Stack tecnológica e arquitetura (recomendada)

Tudo num único repositório, full-stack, fácil de hospedar em nuvem gerenciada.

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Front e back no mesmo projeto; deploy trivial |
| Banco de dados | **PostgreSQL gerenciado** (Neon ou Supabase) | Relacional, gerenciado, free tier generoso |
| ORM | **Prisma** | Schema declarativo, migrations simples |
| Autenticação | **Auth.js (NextAuth)** com e-mail + senha | Login simples de criadores; testador não loga |
| Armazenamento de imagens | **Bucket de objetos** (Vercel Blob ou Supabase Storage) | Imagens de tela não vão no banco |
| UI | **Tailwind CSS + shadcn/ui** | Componentes prontos, visual limpo |
| Camada gráfica (hotspots/heatmap) | **Canvas HTML5 ou SVG sobreposto à imagem** | Desenhar áreas e renderizar densidade de cliques |
| Importação Figma (M5) | **Figma REST API + OAuth** | Frames → telas, conexões → hotspots |
| Deploy | **Vercel** (app) + **Neon/Supabase** (banco + storage) | Nuvem gerenciada, CI automático via Git |

### Princípios de arquitetura
- **Coordenadas sempre normalizadas (0–1)**, nunca em pixels absolutos. Uma tela pode ser
  exibida em tamanhos diferentes (desktop/mobile, zoom); guardar tudo como fração da
  largura/altura faz hotspots e heatmaps funcionarem em qualquer resolução. Converta para
  pixels só na hora de desenhar.
- **A rota do testador é pública e sem estado de login.** Toda sessão é anônima e
  identificada por um token aleatório.
- **Métricas agregadas são calculadas a partir dos eventos**, não gravadas como verdade
  primária. Os eventos brutos (cliques) são a fonte; as agregações são derivadas (podem ser
  cacheadas depois, mas comece calculando sob demanda).

---

## 3. Modelo de dados (schema Prisma — ponto de partida)

> Implemente isto no M0/M1 e evolua. Campos podem crescer; os relacionamentos abaixo são a
> espinha dorsal.

```
User            id, email, passwordHash, name, createdAt
Study           id, ownerId(User), title, status(draft|live|closed), createdAt, updatedAt
Prototype       id, studyId, source(image|figma), figmaFileKey?, createdAt
Screen          id, prototypeId, name, order, imageUrl, width, height
Hotspot         id, screenId, shape(rect|polygon), coords(json, normalizado 0–1),
                targetScreenId(Screen)
Block           id, studyId, type(mission|question), order
Mission         id, blockId, task, description?, startScreenId(Screen),
                successType(screen|path)
MissionGoal     id, missionId, goalScreenId(Screen)          // quando successType = screen
MissionPath     id, missionId, label                          // quando successType = path
PathStep        id, missionPathId, screenId(Screen), order    // sequência esperada de telas
Session         id, studyId, token, startedAt, finishedAt?, userAgent, deviceType
MissionResult   id, sessionId, missionId, outcome(direct|indirect|unfinished|given_up),
                durationMs, misclickCount, clickCount
Event           id, sessionId, missionId, screenId, type(click|navigate|misclick|give_up|end),
                xNorm, yNorm, hotspotId?, targetScreenId?, timestampMs
```

**Regras importantes do modelo (replicar do Maze):**
- Um `MissionPath` precisa de **pelo menos 2 telas** (PathStep).
- A **última tela de um caminho não pode se repetir** dentro do mesmo bloco — a missão
  termina no instante em que a tela final é alcançada, então um loop de volta a ela
  encerraria cedo demais.
- A missão **goal-based termina automaticamente** quando a tela-alvo é alcançada.

---

## 4. Os três fluxos do produto (detalhe funcional)

### 4.1 Experiência do CRIADOR (quem monta o teste)
1. **Login** (e-mail + senha). Vê a lista dos seus studies.
2. **Criar study** → dá um título.
3. **Adicionar protótipo**, escolhendo a fonte:
   - **Imagem:** faz upload de uma ou mais imagens (PNG/JPG). Cada imagem vira uma `Screen`.
     Em um **editor de hotspots**, desenha retângulos (e, depois, polígonos) sobre a imagem e
     liga cada hotspot a uma tela de destino. As coordenadas são salvas normalizadas.
   - **Figma (M5):** conecta a conta Figma (OAuth), cola o link de compartilhamento do
     protótipo (precisa estar "qualquer pessoa com o link pode ver"), e a ferramenta importa
     frames como telas e conexões como hotspots.
4. **Criar uma Mission:** escreve a **Task** (título curto, ex.: "Adicione um item à lista"),
   uma **Description** opcional (o cenário, sem instruções do tipo "clique no botão X"),
   escolhe a **tela inicial** e define o **critério de sucesso**:
   - **Tela-alvo:** escolhe a tela que conta como sucesso (rota livre até ela).
   - **Caminho exato:** clica pelos hotspots para gravar a sequência esperada (pode haver
     mais de um caminho válido).
5. **Preview** (roda o teste inteiro sem gravar) e **Publicar** (status `live`).
6. **Copiar link** anônimo para enviar aos testadores.

### 4.2 Experiência do TESTADOR (quem faz o teste) — link anônimo, sem login
1. Abre o link → cria-se uma `Session` anônima (token).
2. Tela de **intro da tarefa**: mostra Task + Description e um botão **"Começar"**.
3. **Layout dividido:** a tela do protótipo é exibida em destaque, com um **painel de
   instruções**. No desktop, o painel aparece num canto, é **arrastável** e **recolhe** quando
   o testador começa a interagir; no mobile, fica numa barra inferior com botão
   "Mostrar/ocultar instruções".
4. O testador **clica apenas nos hotspots reais**. Hover em hotspot vira cursor de mãozinha.
   Clique em hotspot navega para a tela de destino; **clique fora de qualquer hotspot é um
   misclick** — é registrado, mas **não navega**.
5. **Encerramento:**
   - *Goal-based:* a missão **termina automaticamente** ao chegar na tela de sucesso.
   - Um botão **"Desistir/Encerrar tarefa"** aparece **só depois do primeiro clique** (evita
     desistência sem tentar).
6. Ao terminar uma missão, segue para a próxima ou para a tela de agradecimento.

### 4.3 Resultados (o que o criador vê) — escopo completo do v1
Por missão:
- **Taxa de sucesso** (% que completou) e classificação de cada sessão em **Direct** (chegou
  pelo caminho esperado), **Indirect** (chegou por rota inesperada) ou **Unfinished**
  (abandonou ou terminou na tela errada).
- **Misclick rate** = (misclicks / total de cliques) × 100.
- **Duração média** e **tempo por tela**.
- **Heatmap por tela** com 3 modos de visualização: **Heatmap** (densidade), **Clicks**
  (posições exatas) e **Image** (tela limpa).
- **Caminho percorrido** — começar com uma lista de caminhos agrupados por desfecho
  (Direct/Indirect/Unfinished) com contagem de participantes e tempo médio; o diagrama tipo
  Sankey pode vir depois.
- **Sessões individuais** — lista de cada testador com desfecho, duração e miniatura das
  primeiras telas do caminho.

---

## 5. Marcos de construção (CONSTRUA NESTA ORDEM)

> Cada marco deve terminar **funcionando ponta a ponta** e testável. Não comece o próximo
> antes de validar o atual.

### M0 — Fundação do projeto
- Inicializar Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.
- Configurar Prisma + Postgres gerenciado; rodar a primeira migration com o schema do §3.
- Configurar Auth.js (e-mail + senha) com cadastro/login de criadores.
- Configurar o bucket de imagens.
- Subir um deploy "hello world" na Vercel ligado ao Git.
- **Pronto quando:** dá para cadastrar/logar um criador e o app está no ar.

### M1 — Criador monta um teste com imagens + hotspots (sem Figma ainda)
- CRUD de Study (criar, listar, renomear, excluir).
- Upload de imagens → criação de Screens (com ordem).
- **Editor de hotspots:** desenhar retângulos sobre a imagem e ligar cada um a uma tela de
  destino. Coordenadas normalizadas.
- Criar uma Mission: Task, Description, tela inicial e critério **tela-alvo**.
- Preview navegável do protótipo dentro do app (sem gravar dados).
- **Pronto quando:** um criador monta um protótipo só com imagens e navega no preview.

### M2 — Runtime do testador (link anônimo)
- Publicar study (`live`) e gerar link anônimo.
- Rota pública do testador: cria Session, mostra intro da tarefa, layout dividido com painel
  de instruções arrastável/recolhível.
- Registrar **Events**: cada clique com coordenadas normalizadas, classificado como hotspot
  (navega) ou misclick (não navega); navegação entre telas; encerramento.
- Auto-encerramento ao chegar na tela-alvo; botão "Desistir" após o 1º clique.
- **Pronto quando:** um testador anônimo completa a tarefa e os eventos ficam gravados.

### M3 — Resultados quantitativos completos
- Tela de resultados por missão: taxa de sucesso, misclick rate, duração média.
- **Heatmap por tela** com os 3 modos (Heatmap / Clicks / Image).
- Lista de **caminhos** agrupados por desfecho + lista de **sessões individuais**.
- **Pronto quando:** o criador vê tudo o que os testadores fizeram, por tela e por sessão.

### M4 — Critério de sucesso por "caminho exato"
- No editor da Mission, permitir gravar caminho(s) esperado(s) clicando pelos hotspots
  (com as regras do §3: mínimo 2 telas; última tela não se repete).
- Na análise, classificar sessões em **Direct / Indirect / Unfinished** comparando o caminho
  real com o esperado.
- **Pronto quando:** missões com caminho exato classificam corretamente os desfechos.

### M5 — Importação de protótipo do Figma
- OAuth com o Figma (acesso somente leitura).
- Colar link do protótipo → importar frames como Screens e conexões como Hotspots.
- Botão "Atualizar protótipo" que repõe telas/hotspots preservando as missões quando possível.
- **Pronto quando:** um criador importa do Figma e o runtime/resultados funcionam igual ao de
  imagens.

### M6 — Blocos de pergunta e múltiplas missões
- Tipo de bloco **Question**: Pergunta aberta, Múltipla escolha, Escala de opinião, Sim/Não.
- Ordenar vários blocos no study (missões + perguntas).
- Resultados das perguntas (gráficos simples; texto aberto listado).
- **Pronto quando:** um study combina tarefas e perguntas numa sequência.

### M7 — Refinos (escolher conforme necessidade)
- Diagrama de caminho tipo Sankey.
- "Usability Score" 0–100 (fórmulas do Maze como ponto de partida — ver Anexo A).
- Lógica condicional/branching entre blocos.
- Hotspots em polígono (além de retângulo).
- Telas de boas-vindas/agradecimento customizáveis; export CSV.

---

## 6. Decisões já tomadas (não reabrir sem necessidade)
- **Testador:** sempre anônimo, sem login.
- **Criador:** login obrigatório, contas individuais.
- **Fontes de protótipo:** imagem (M1) **e** Figma (M5), à escolha do criador.
- **Critério de sucesso:** tela-alvo (M1) **e** caminho exato (M4).
- **Resultados v1:** taxa de sucesso, cliques, misclicks, heatmap por tela e caminho.
- **Um protótipo por study** no início.
- **Sem randomização de blocos** no v1 (o Maze também não tem).
- **Hospedagem:** nuvem gerenciada (Vercel + Neon/Supabase).

---

## Anexo A — Fórmulas do "Usability Score" do Maze (referência para o M7)
Escala 0–100. Faixas: Alto 80–100, Médio 50–80, Baixo 0–50.
- **Por tela (SCUS)** — só para sucesso por caminho exato:
  `MAX(0, 100 − (taxa_abandono% × 1) − (misclick% × 0,5) − penalidade_duração)`
  onde a penalidade de duração é: 0–5s nada; 5–25s perde 1 ponto a cada 2s; ≥25s perde 10.
- **Por missão (MIUS):** `(sucesso_direto%) × 1 + (sucesso_indireto%) × 0,5 − média das penalidades de tela`.
- **Por study (MAUS):** média dos MIUS de todas as missões.

> Estas fórmulas são uma heurística do Maze; use como ponto de partida e ajuste os pesos
> depois de ver dados reais.

---

## Anexo B — Como usar este documento com o Claude Code
1. Crie um repositório Git vazio e adicione este arquivo (ex.: como `SPEC.md`).
2. Abra o Claude Code na pasta do repositório.
3. Peça algo como: *"Leia o SPEC.md. Vamos construir o Milestone M0 inteiro. Me mostre o
   plano antes de começar a codar."*
4. Ao terminar e validar cada marco, faça commit e só então peça o próximo: *"M0 está
   funcionando. Vamos para o M1."*
5. Mantenha o SPEC.md no repositório; ele é a fonte de verdade do escopo.
