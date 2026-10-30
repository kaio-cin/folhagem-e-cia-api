# 🌿 Folhagem & Cia: API da loja de plantas

API REST que substitui a planilha de estoque da **Folhagem & Cia**, uma loja de plantas on-line. Ela cadastra, consulta, edita e remove plantas, registra **vendas sem nunca deixar o estoque negativo**, mesmo com várias compras ao mesmo tempo, e calcula o valor do estoque.

O enunciado está em [`DESAFIO.md`](DESAFIO.md).

**Stack:** Node.js 20 · TypeScript · Express · Prisma · PostgreSQL 16 · Docker

| ✅ Requisitos obrigatórios | ⭐ Bônus | 🧪 Testes |
|---|---|---|
| CRUD completo, filtros, venda e valor total do estoque | Busca por nome, ordenação, plantas esgotadas e seed | **105 testes automatizados** (`yarn test`) |

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Como rodar](#2-como-rodar)
3. [Modelo de dados](#3-modelo-de-dados)
4. [Rotas](#4-rotas)
5. [Erros e status HTTP](#5-erros-e-status-http)
6. [Decisões e bônus](#6-decisões-e-bônus)
7. [Testes automatizados](#7-testes-automatizados)
8. [Estrutura do projeto](#8-estrutura-do-projeto)

---

## 1. Visão geral

### O que a API faz

| Recurso | Rotas |
|---|---|
| Cadastro de plantas (CRUD) | `POST /plantas` · `GET /plantas` · `GET /plantas/:id` · `PATCH /plantas/:id` · `DELETE /plantas/:id` |
| Filtros, busca e ordenação | `GET /plantas?luminosidade=&petFriendly=&nome=&ordem=` |
| Vendas | `POST /plantas/:id/venda` |
| Relatórios | `GET /plantas/estoque/valor-total` · `GET /plantas/esgotadas` |

### Arquitetura

O código é organizado em camadas, seguindo o CRUD de usuários do template. Cada camada tem uma única responsabilidade:

```
Requisição → routes.ts → Controller → Validator (regras de entrada)
                             │
                             └→ Repository → Prisma → PostgreSQL
Resposta  ←──────────── Controller (status HTTP + JSON)
```

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Rotas | `src/routes.ts` | Liga cada URL à função certa do controller |
| Controller | `src/controllers/PlantaController.ts` | Orquestra a requisição: valida, aplica as regras de negócio e escolhe o status HTTP |
| Validator | `src/validators/PlantaValidator.ts` | Valida o corpo, o id da URL e os filtros, e devolve mensagens claras |
| Repository | `src/repositories/PlantaRepository.ts` | **Única camada que acessa o banco** (pelo Prisma) |

### Stack

| Tecnologia | Papel |
|---|---|
| **Node.js 20 + TypeScript** | Linguagem e execução, com checagem de tipos (`yarn typecheck`) |
| **Express** | Servidor HTTP e rotas |
| **Prisma** | Acesso ao banco: schema, migrations e consultas tipadas |
| **PostgreSQL 16** | Banco de dados |
| **Docker / Docker Compose** | Sobem a API e o banco com um comando, iguais em qualquer máquina |

---

## 2. Como rodar

### Pré-requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), **aberto** sempre que for rodar o projeto
- [Node.js 20+](https://nodejs.org) e **Yarn** (`npm install -g yarn`)
- Um cliente HTTP para testar as rotas: [Thunder Client](https://www.thunderclient.com/) (extensão do VS Code), Insomnia ou Postman

### Passo a passo (do zero)
```bash
# 1. Clone o repositório
git clone https://github.com/kaio-cin/folhagem-e-cia-api.git
cd folhagem-e-cia-api

# 2. Crie o .env a partir do modelo
cp .env.example .env            # no PowerShell ou no CMD: copy .env.example .env

# 3. Instale as dependências na sua máquina
yarn

# 4. Suba a API e o banco (com o Docker Desktop aberto)
docker compose up -d --build

# 5. Crie as tabelas no banco a partir das migrations
yarn migration

# 6. (Opcional) Cadastre 12 plantas de exemplo
yarn seed
```

Para conferir, abra `http://localhost:3001` no navegador:
```json
{ "message": "API do treinamento de CRUD do CITi 🚀" }
```
E veja as plantas em `http://localhost:3001/plantas`.

### Comandos do dia a dia

| Comando | O que faz |
|---|---|
| `docker compose up -d` | Sobe a API e o banco |
| `docker compose logs -f server` | Mostra os logs da API (é aqui que os erros aparecem) |
| `docker compose down` | Derruba os containers (os dados do banco continuam salvos) |
| `yarn migration` | Cria e aplica migrations a partir do `schema.prisma` |
| `yarn seed` | Cadastra as 12 plantas de exemplo (só se o banco estiver vazio) |
| `yarn test` | Roda os 105 testes automatizados (⚠️ apaga os dados do banco local: [ver seção 7](#7-testes-automatizados)) |
| `yarn typecheck` | Procura erros de tipo no TypeScript |
| `yarn studio` | Abre o Prisma Studio para ver o banco no navegador |

Para **zerar o banco**: `yarn cross-env DATABASE_HOST=localhost prisma migrate reset` (e, se quiser os exemplos de novo, `yarn seed`).

---

## 3. Modelo de dados

### `Planta`

| Campo | Tipo | Obrigatório no cadastro | Regras | Exemplo |
|---|---|:---:|---|---|
| `id` | inteiro | gerado | Autoincremento | `1` |
| `nome` | texto | ✅ | Nome popular, não vazio. Os espaços em volta são removidos | `"Costela-de-adão"` |
| `especie` | texto | ✅ | Nome científico, não vazio. Os espaços em volta são removidos | `"Monstera deliciosa"` |
| `preco` | inteiro | ✅ | Em **centavos**, de 1 a 2147483647 | `8990` (= R$ 89,90) |
| `estoque` | inteiro | ✅ | Vasos disponíveis, de **0** a 2147483647 (0 = esgotada) | `12` |
| `luminosidade` | enum `Luminosidade` | ✅ | `SOMBRA`, `MEIA_SOMBRA` ou `SOL_PLENO` | `"MEIA_SOMBRA"` |
| `petFriendly` | booleano | ✅ | Segura para cães e gatos? `true` ou `false`, sem aspas | `false` |
| `regaACadaDias` | inteiro | ✅ | De quantos em quantos dias regar, de **1** a 2147483647 | `7` |
| `createdAt` | data e hora (ISO 8601, UTC) | automático | Preenchido na criação | `"2026-10-28T18:30:52.202Z"` |
| `updatedAt` | data e hora (ISO 8601, UTC) | automático | Atualizado a cada edição e a cada venda | `"2026-10-28T18:30:52.643Z"` |

### Enum `Luminosidade`

| Valor | Significado |
|---|---|
| `SOMBRA` | Ambientes sem luz direta |
| `MEIA_SOMBRA` | Luz indireta ou sol fraco por parte do dia |
| `SOL_PLENO` | Sol direto por várias horas |

> **Por que o preço é em centavos?** Números decimais têm erros de arredondamento (`0.1 + 0.2 = 0.30000000000000004`). Com inteiros, as contas com dinheiro são sempre exatas.
>
> **Por que o limite de 2147483647?** É o maior valor de uma coluna `Int` do PostgreSQL. Valores maiores são recusados com `400`, em vez de chegarem ao banco e virarem `500`.

---

## 4. Rotas

**Base URL:** `http://localhost:3001` · Os corpos de requisição e de resposta são **JSON**. No cliente HTTP, envie o corpo em **Body → JSON**, com os números **sem aspas** (`"preco": 8990`).

| Método | Rota | O que faz | Sucesso |
|---|---|---|:---:|
| `POST` | [`/plantas`](#post-plantas) | Cadastra uma planta | `201` |
| `GET` | [`/plantas`](#get-plantas) | Lista as plantas, com filtros, busca e ordenação opcionais | `200` |
| `GET` | [`/plantas/esgotadas`](#get-plantasesgotadas) | Lista as plantas com estoque zero *(bônus)* | `200` |
| `GET` | [`/plantas/estoque/valor-total`](#get-plantasestoquevalor-total) | Valor total do estoque e total de vasos | `200` |
| `GET` | [`/plantas/:id`](#get-plantasid) | Busca uma planta | `200` |
| `PATCH` | [`/plantas/:id`](#patch-plantasid) | Edita só os campos enviados | `200` |
| `DELETE` | [`/plantas/:id`](#delete-plantasid) | Remove uma planta | `204` |
| `POST` | [`/plantas/:id/venda`](#post-plantasidvenda) | Registra uma venda e diminui o estoque | `200` |

> Os exemplos abaixo são respostas **reais** da API, com o banco populado pelo `yarn seed`.

---

### `POST /plantas`
Cadastra uma planta. **Todos os campos são obrigatórios.**

**Requisição:**
```json
{
  "nome": "Orquídea",
  "especie": "Phalaenopsis amabilis",
  "preco": 11990,
  "estoque": 5,
  "luminosidade": "MEIA_SOMBRA",
  "petFriendly": true,
  "regaACadaDias": 7
}
```

**Resposta `201 Created`:**
```json
{
  "id": 13,
  "nome": "Orquídea",
  "especie": "Phalaenopsis amabilis",
  "preco": 11990,
  "estoque": 5,
  "luminosidade": "MEIA_SOMBRA",
  "petFriendly": true,
  "regaACadaDias": 7,
  "createdAt": "2026-10-28T18:30:52.543Z",
  "updatedAt": "2026-10-28T18:30:52.543Z"
}
```

**Resposta `400 Bad Request`.** Todos os problemas são listados de uma vez. Exemplo com o corpo `{ "nome": "Orquídea", "especie": "Phalaenopsis amabilis", "preco": "119,90", "estoque": -1, "luminosidade": "LUZ_DIRETA", "petFriendly": "sim" }`:
```json
{
  "message": "Dados inválidos.",
  "erros": [
    "Campo(s) obrigatório(s) ausente(s): regaACadaDias.",
    "preco deve ser um número inteiro entre 1 e 2147483647, em centavos (ex.: 8990 = R$ 89,90).",
    "estoque deve ser um número inteiro entre 0 e 2147483647.",
    "luminosidade deve ser um destes valores: SOMBRA, MEIA_SOMBRA, SOL_PLENO.",
    "petFriendly deve ser true ou false (sem aspas)."
  ]
}
```

Campos fora do modelo, como `id` ou `createdAt`, também são recusados com `400` (`"Campo(s) não permitido(s): id."`).

---

### `GET /plantas`
Lista as plantas. Sem parâmetros, devolve **todas**, ordenadas por `id`. Os parâmetros são opcionais e podem ser combinados (as condições se somam: E):

| Parâmetro | Valores aceitos | Efeito |
|---|---|---|
| `luminosidade` | `SOMBRA`, `MEIA_SOMBRA`, `SOL_PLENO` | Só plantas com essa luminosidade |
| `petFriendly` | `true`, `false` | Só plantas seguras (`true`) ou não seguras (`false`) para pets |
| `nome` *(bônus)* | Qualquer texto não vazio | Plantas cujo nome **contém** o texto, **sem diferenciar maiúsculas** (`costela` encontra "Costela-de-adão") |
| `ordem` *(bônus)* | `preco`, `nome` | Ordem **crescente** pelo campo. Empates são desfeitos pelo `id` |

**Exemplo:** `GET /plantas?luminosidade=SOL_PLENO&petFriendly=true&ordem=preco`

**Resposta `200 OK`:**
```json
[
  {
    "id": 10,
    "nome": "Alecrim",
    "especie": "Salvia rosmarinus",
    "preco": 1990,
    "estoque": 30,
    "luminosidade": "SOL_PLENO",
    "petFriendly": true,
    "regaACadaDias": 3,
    "createdAt": "2026-10-28T18:30:52.202Z",
    "updatedAt": "2026-10-28T18:30:52.202Z"
  },
  {
    "id": 9,
    "nome": "Echevéria",
    "especie": "Echeveria elegans",
    "preco": 2490,
    "estoque": 25,
    "luminosidade": "SOL_PLENO",
    "petFriendly": true,
    "regaACadaDias": 10,
    "createdAt": "2026-10-28T18:30:52.202Z",
    "updatedAt": "2026-10-28T18:30:52.202Z"
  }
]
```

Se nenhuma planta combinar, a resposta é **`200` com `[]`**, e nunca `404`.

**Resposta `400 Bad Request`** (ex.: `GET /plantas?luminosidade=LUA`):
```json
{
  "message": "Filtros inválidos.",
  "erros": ["luminosidade deve ser um destes valores: SOMBRA, MEIA_SOMBRA, SOL_PLENO."]
}
```

---

### `GET /plantas/esgotadas`
*(Bônus)* Lista as plantas com `estoque` igual a `0`, ordenadas por `id`, no mesmo formato do `GET /plantas`. Com o seed, a resposta traz a **Samambaia** (id 2) e o **Lírio-da-paz** (id 7). Se nenhuma planta estiver esgotada, a resposta é `200` com `[]`.

---

### `GET /plantas/estoque/valor-total`
Soma `preco × estoque` de todas as plantas e o total de vasos.

**Resposta `200 OK`** (com as 12 plantas do seed):
```json
{ "valorTotalEmCentavos": 606280, "totalDeVasos": 142 }
```
`606280` centavos = **R$ 6.062,80**. As plantas esgotadas entram na conta com zero. Com a loja vazia, a resposta é `{ "valorTotalEmCentavos": 0, "totalDeVasos": 0 }`.

---

### `GET /plantas/:id`
Busca uma planta pelo `id`.

**Exemplo:** `GET /plantas/3` → **`200 OK`**
```json
{
  "id": 3,
  "nome": "Calathea",
  "especie": "Goeppertia orbifolia",
  "preco": 7490,
  "estoque": 8,
  "luminosidade": "MEIA_SOMBRA",
  "petFriendly": true,
  "regaACadaDias": 4,
  "createdAt": "2026-10-28T18:30:52.202Z",
  "updatedAt": "2026-10-28T18:30:52.202Z"
}
```

| Caso | Resposta |
|---|---|
| `GET /plantas/999` (não existe) | `404` `{ "message": "Planta não encontrada." }` |
| `GET /plantas/abc` (id inválido) | `400` `{ "message": "O id deve ser um número inteiro positivo." }` |

---

### `PATCH /plantas/:id`
Edita **só os campos enviados**. Os outros não mudam. Os campos enviados passam pelas **mesmas regras** do cadastro.

**Exemplo:** `PATCH /plantas/13`
```json
{ "preco": 12990 }
```

**Resposta `200 OK`.** Só o `preco` e o `updatedAt` mudaram:
```json
{
  "id": 13,
  "nome": "Orquídea",
  "especie": "Phalaenopsis amabilis",
  "preco": 12990,
  "estoque": 5,
  "luminosidade": "MEIA_SOMBRA",
  "petFriendly": true,
  "regaACadaDias": 7,
  "createdAt": "2026-10-28T18:30:52.543Z",
  "updatedAt": "2026-10-28T18:30:52.643Z"
}
```

| Caso | Resposta |
|---|---|
| Corpo vazio `{}` | `400` `{ "message": "Dados inválidos.", "erros": ["Envie ao menos um campo para editar."] }` |
| Campo inexistente, como `{ "preço": 12990 }` (com ç) | `400` `{ "message": "Dados inválidos.", "erros": ["Campo(s) não permitido(s): preço."] }` |
| Valor inválido, como `{ "preco": 0 }` | `400` com a regra violada. **Nada é alterado** |
| Planta inexistente | `404` `{ "message": "Planta não encontrada." }` |

---

### `DELETE /plantas/:id`
Remove uma planta.

| Caso | Resposta |
|---|---|
| Planta existente | **`204 No Content`**, sem corpo |
| Planta inexistente (inclusive ao deletar de novo) | `404` `{ "message": "Planta não encontrada." }` |
| id inválido | `400` `{ "message": "O id deve ser um número inteiro positivo." }` |

---

### `POST /plantas/:id/venda`
Registra uma venda e diminui o estoque. **A venda nunca deixa o estoque negativo, nem com várias compras ao mesmo tempo** ([ver seção 6.1](#61-vendas-simultâneas-do-último-vaso)).

**Exemplo:** `POST /plantas/13/venda`
```json
{ "quantidade": 2 }
```

**Resposta `200 OK`.** A planta é devolvida com o estoque atualizado (5 → 3):
```json
{
  "id": 13,
  "nome": "Orquídea",
  "especie": "Phalaenopsis amabilis",
  "preco": 12990,
  "estoque": 3,
  "luminosidade": "MEIA_SOMBRA",
  "petFriendly": true,
  "regaACadaDias": 7,
  "createdAt": "2026-10-28T18:30:52.543Z",
  "updatedAt": "2026-10-28T18:30:52.703Z"
}
```

| Caso | Resposta (o estoque **não** é alterado) |
|---|---|
| Mais do que há em estoque (`{ "quantidade": 10 }` com 3 vasos) | `400` `{ "message": "Estoque insuficiente: pedido de 10, mas há apenas 3 em estoque." }` |
| Planta esgotada | `400` `{ "message": "Estoque insuficiente: pedido de 1, mas há apenas 0 em estoque." }` |
| Os vasos foram levados por outra compra **no mesmo instante** | `400` `{ "message": "Estoque insuficiente: os vasos acabaram de ser vendidos." }` |
| `quantidade` 0, negativa, decimal, em texto ou acima de 2147483647 | `400` `{ "message": "Dados inválidos.", "erros": ["quantidade deve ser um número inteiro entre 1 e 2147483647."] }` |
| Sem `quantidade`, ou com outros campos | `400` (`"O campo quantidade é obrigatório."` / `"Campo(s) não permitido(s): ..."`) |
| Planta inexistente | `404` `{ "message": "Planta não encontrada." }` |

---

### Rotas de usuários (do template)
O CRUD de usuários que veio com o template continua disponível: `POST /users`, `GET /users`, `GET /users/:id`, `PATCH /users/:id` e `DELETE /users/:id`. Ele **não foi alterado**, porque serviu de modelo para as plantas. A única mudança que ele recebeu foi indireta: o tratamento de JSON malformado ([seção 5](#5-erros-e-status-http)), que vale para a API inteira.

---

## 5. Erros e status HTTP

Toda resposta de erro tem o formato `{ "message": "..." }`. Os erros de validação trazem também a lista **`erros`**, com um item para cada problema.

### Por rota

| Rota | `400` Bad Request | `404` Not Found | `500` |
|---|---|---|:---:|
| `POST /plantas` | Campo ausente, com valor inválido ou não permitido | — | ✔ |
| `GET /plantas` | Filtro com valor inválido, `nome` vazio ou parâmetro desconhecido | — | ✔ |
| `GET /plantas/esgotadas` | — | — | ✔ |
| `GET /plantas/estoque/valor-total` | — | — | ✔ |
| `GET /plantas/:id` | id inválido | A planta não existe | ✔ |
| `PATCH /plantas/:id` | id inválido, corpo vazio, campo não permitido ou valor inválido | A planta não existe | ✔ |
| `DELETE /plantas/:id` | id inválido | A planta não existe | ✔ |
| `POST /plantas/:id/venda` | id inválido, `quantidade` inválida ou **estoque insuficiente** | A planta não existe | ✔ |

- **id inválido** é qualquer coisa que não seja um inteiro de 1 a 2147483647, como `abc`, `0`, `1.5` ou `99999999999`. A validação vem **antes** da busca: um id mal formado dá `400`, e não `404`.
- **`500`** só acontece em erros inesperados do servidor (ex.: banco fora do ar). A resposta traz uma mensagem genérica (`"Erro ao cadastrar planta."`, `"Erro ao registrar venda."`...), e o detalhe fica no log (`docker compose logs server`).

### Erros gerais (qualquer rota)

| Status | Quando | Corpo |
|---|---|---|
| `400` | O corpo não é um JSON válido (vírgula sobrando, chave sem aspas...) | `{ "message": "JSON inválido: confira as aspas, as vírgulas e as chaves do corpo." }` |
| `404` | A rota não existe | `{ "message": "Rota não encontrada" }` |
| `413` | O corpo passa de 100 KB | `{ "message": "O corpo da requisição é grande demais." }` |
| `500` | Erro inesperado | `{ "message": "Erro interno do servidor." }` |

> **Nenhuma resposta de erro expõe detalhes internos** do servidor, como pilhas de erro ou caminhos de arquivos. Sem o tratador de erros em `src/server.ts`, um JSON malformado faria o Express responder com uma **página HTML** mostrando a pilha do erro e os caminhos das pastas do servidor.

---

## 6. Decisões e bônus

### 6.1 Vendas simultâneas do último vaso

> *"E se duas pessoas comprarem o último vaso ao mesmo tempo?"* (enunciado)

**O problema.** O jeito óbvio de vender é **ler o estoque, conferir e depois descontar**. São duas operações separadas no banco. Se duas compras chegam juntas, as duas podem ler "1 vaso" antes de qualquer desconto, e as duas são confirmadas:

```
Estoque: 1
Compra A: lê 1 ✔        Compra B: lê 1 ✔        (as duas passam na conferência)
Compra A: desconta → 0  Compra B: desconta → -1 ← vendeu um vaso que não existe
```

Isso se chama **condição de corrida**, e é exatamente a história da samambaia do enunciado.

**A solução.** O desconto é feito numa **única instrução condicional** no banco:

```ts
// src/repositories/PlantaRepository.ts
const resultado = await prisma.planta.updateMany({
    where: { id: id, estoque: { gte: quantidade } },   // só desconta SE houver vasos suficientes
    data: { estoque: { decrement: quantidade } },
});
return resultado.count === 1;                          // 0 linhas alteradas = estoque insuficiente
```

O SQL equivalente é `UPDATE "Planta" SET estoque = estoque - $q WHERE id = $id AND estoque >= $q`. O PostgreSQL **trava a linha** durante o UPDATE: a segunda compra espera a primeira terminar e **reavalia a condição** com o estoque já descontado. Se nenhuma linha for alterada, a resposta é `400` e nada muda.

A conferência "comum" (`estoque >= quantidade`, antes do desconto) foi mantida. Ela dá a mensagem precisa no caso normal ("há apenas 3 em estoque"), e a condição no `UPDATE` é a **rede de segurança** para as compras simultâneas.

**A prova.** A bateria de testes dispara compras **simultâneas** (`Promise.all`) e repete cada cenário 5 vezes. Comparação com a versão "conferir e depois descontar", escrita de propósito só para o experimento:

| Cenário | Versão "conferir e depois descontar" | Versão entregue (atômica) |
|---|---|---|
| 20 compras ao mesmo tempo, **1 vaso** | Até **20 vendidas**; estoque **-19** | **1 vendida**, 19 recusadas, estoque **0** |
| 50 compras ao mesmo tempo, **10 vasos** | Até **42 vendidas**; estoque **-32** | **10 vendidas**, 40 recusadas, estoque **0** |

**Alternativas consideradas:** uma transação com `SELECT ... FOR UPDATE`, que resolve, mas com mais código; e uma restrição `CHECK (estoque >= 0)` no banco, que o Prisma não declara no schema e exigiria editar a migration à mão. Ela fica como possível segunda linha de defesa.

### 6.2 Outras decisões

| Decisão | Motivo |
|---|---|
| **Validação antes do banco**, com `campo === undefined` (nunca `!campo`) | `!0` e `!false` são verdadeiros: um `if (!estoque)` recusaria uma planta esgotada, e um `if (!petFriendly)` recusaria toda planta não pet-friendly |
| **Uma única função de validação** para o cadastro e a edição (`validarPlanta(corpo, parcial)`) | No cadastro, todos os campos são obrigatórios; na edição, nenhum é. Mas os enviados seguem as mesmas regras |
| **Todos os erros de uma vez** (lista `erros`) | O cliente corrige tudo numa tentativa só |
| **Campos e filtros desconhecidos são recusados** (`400`) | Um `PATCH { "preço": 9990 }` (com ç) seria ignorado em silêncio, com `200` e nada alterado. E um `?petfriendly=true` (minúsculo) devolveria **todas** as plantas, inclusive as tóxicas para pets |
| **`PATCH` com corpo vazio → `400`** | Uma edição sem nenhum campo quase sempre é erro do cliente |
| **Busca da planta antes de editar, remover ou vender** | Sem isso, um id inexistente faria o Prisma lançar um erro, e ele viraria `500` em vez de `404` |
| **Filtro ausente continua `undefined`** (não vira `false`) | No `where` do Prisma, condições `undefined` são ignoradas. Uma única consulta atende todas as combinações de filtros |
| **Filtro válido sem resultado → `200 []`** | Uma lista vazia é a resposta correta. O `404` é para um recurso específico que não existe |
| **Rotas fixas antes de `/plantas/:id`** | Testado: com `/plantas/esgotadas` registrada **depois** de `/:id`, o Express trata "esgotadas" como id e responde `400` |
| **`trim()` em `nome` e `especie`** | `"  Jiboia  "` é salvo como `"Jiboia"` |
| **Tratador de erros global** (`src/server.ts`) | JSON malformado → `400` em JSON (e não uma página HTML que expõe o servidor); corpo grande demais → `413` |

### 6.3 Bônus implementados

| Bônus do enunciado | Implementação |
|---|---|
| 🔎 Busca por nome sem diferenciar maiúsculas | `?nome=` → `contains` + `mode: "insensitive"` do Prisma (`ILIKE` no PostgreSQL). Os caracteres `%` e `_`, que são **curingas** do `ILIKE`, são escapados: sem isso, `?nome=%` traria a loja inteira |
| ↕️ Ordenação | `?ordem=preco` ou `?ordem=nome`, crescente, com desempate pelo `id` para uma ordem estável |
| 🏷️ `GET /plantas/esgotadas` | Plantas com `estoque: 0`, registrada antes de `/plantas/:id` |
| 🌱 Seed | `yarn seed`: 12 plantas reais, com as 3 luminosidades, plantas pet-friendly e não pet-friendly (segundo a lista de plantas tóxicas da ASPCA) e 2 esgotadas. **Não duplica**: se o banco já tiver plantas, não faz nada. É um script próprio, e não o seed automático do Prisma, que rodaria sozinho a cada `migrate reset` |

**Além dos bônus:** a bateria de **105 testes automatizados** ([seção 7](#7-testes-automatizados)) e o tratamento de JSON malformado.

### 6.4 Limitações conhecidas
- A busca por nome **diferencia acentos**: `?nome=adao` não encontra "Costela-de-adão", mas `?nome=adão` encontra. Resolver isso exigiria a extensão `unaccent` do PostgreSQL.
- A ordem alfabética segue a *collation* (regra de comparação de textos) do banco.
- O valor total é calculado com o `number` do JavaScript, que é exato até cerca de 9 × 10¹⁵ centavos (R$ 90 trilhões).
- Na venda, a planta da resposta é buscada logo depois do desconto. Se outra venda acontecer nesse intervalo, o `estoque` mostrado já a inclui. O estoque gravado no banco continua sempre correto.

---

## 7. Testes automatizados

Com a API no ar (`docker compose up -d`), rode:
```bash
yarn test
```

São **105 testes com requisições HTTP reais**, em 7 suítes. A execução leva cerca de 15 segundos:

| Suíte | Testes | O que cobre |
|---|---:|---|
| CRUD | 29 | Todos os casos da tabela de testes do enunciado: `estoque: 0` e `petFriendly: false` válidos; campo faltando, `preco: 0`, `estoque: -1`, `preco: "8990"`, `"LUA"`; id que existe, que não existe e `abc`; edição parcial; deletar, buscar e deletar de novo |
| Filtros | 15 | Cada filtro sozinho e juntos; `petFriendly=false`; sem resultado → `[]`; valores inválidos e filtro desconhecido |
| Venda e concorrência | 17 | Vender o que tem, mais do que tem (o estoque não muda), a planta esgotada, quantidades inválidas e **compras simultâneas** |
| Valor total | 7 | A conta conferida à mão e o acompanhamento de vendas, edições e remoções |
| Bônus | 21 | Busca (inclusive `%` e `_`), ordenação (com empate) e esgotadas |
| JSON malformado | 11 | Corpos inválidos, corpo grande demais, sem Content-Type JSON, e a API continuando de pé |
| Seed | 5 | 12 plantas, não duplica, valor total e esgotadas |

Resultado no momento da entrega: **105/105**, inclusive num **clone novo** do repositório (o passo a passo da seção 2, do zero).

> ⚠️ A bateria **apaga os dados do banco local** antes de cada suíte, para que cada uma comece do mesmo estado. No fim, ficam as 12 plantas do seed.

---

## 8. Estrutura do projeto

```
prisma/
  schema.prisma               # Models Planta e User e os enums Luminosidade e Conta
  migrations/                 # Histórico versionado do banco (create_user_model, create_planta_model)
  seed.ts                     # 12 plantas de exemplo (yarn seed)
src/
  server.ts                   # App Express, rota 404 e tratador de erros (JSON malformado)
  routes.ts                   # Rotas: as fixas antes das que têm :id
  database/index.ts           # Conexão com o banco (Prisma Client)
  controllers/
    PlantaController.ts       # Orquestra cada rota e escolhe o status HTTP
    UserController.ts         # (template)
  validators/
    PlantaValidator.ts        # Validação do corpo, do id, dos filtros e da venda
  repositories/
    PlantaRepository.ts       # Única camada que acessa o banco
    UserRepository.ts         # (template)
testes/
  bateria-completa.mjs        # Os 105 testes automatizados (yarn test)
```

---
