// Bateria de testes da API Folhagem & Cia: faz requisições HTTP reais a todas as rotas.
// Uso: com a API no ar (docker compose up -d), rode "yarn test" na raiz do projeto.
// ATENÇÃO: os dados do banco local são apagados antes de cada suíte; no fim, ficam as plantas do seed.
import { execSync } from "node:child_process";

const BASE_URL = "http://localhost:3001";

// O fetch reaproveita conexões (keep-alive). Depois de alguns segundos sem requisições, a API encerra a conexão parada,
// mas no Windows o Docker Desktop pode não repassar esse aviso, e o próximo fetch falha com "fetch failed".
// Nesse caso, só um GET é repetido (uma vez): ele não altera dados, então repetir é seguro.
let getsRepetidos = 0;

const fetchSeguro = async (url, opcoes = {}) => {
    try {
        return await fetch(url, opcoes);
    } catch (erro) {
        if ((opcoes.method ?? "GET") !== "GET") {
            throw erro;
        }
        getsRepetidos++;
        console.log(`       (a conexão reaproveitada tinha sido encerrada: GET ${url.replace(BASE_URL, "")} repetido)`);
        return await fetch(url, opcoes);
    }
};

const zerarBanco = () => {
    execSync("yarn -s cross-env DATABASE_HOST=localhost prisma migrate reset --force --skip-generate", { stdio: "ignore" });
};

const suite_crud = async () => {
    const BASE = BASE_URL;

    let acertos = 0;
    let total = 0;

    const requisitar = async (metodo, rota, corpo) => {
        const resposta = await fetchSeguro(BASE + rota, {
            method: metodo,
            headers: corpo === undefined ? {} : { "Content-Type": "application/json" },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        const texto = await resposta.text();
        let json = null;
        try {
            json = texto ? JSON.parse(texto) : null;
        } catch {
            json = null;
        }
        return { status: resposta.status, json, texto };
    };

    const teste = async (descricao, metodo, rota, corpo, statusEsperado, conferir) => {
        total++;
        const r = await requisitar(metodo, rota, corpo);
        let problema = r.status !== statusEsperado ? `status ${r.status}, esperado ${statusEsperado}` : null;
        if (!problema && conferir) {
            problema = conferir(r.json, r) || null;
        }
        if (!problema) acertos++;
        const numero = String(total).padStart(2, "0");
        console.log(`${problema ? "❌" : "✅"} ${numero}. ${metodo} ${rota} → ${r.status} | ${descricao}`);
        if (problema) {
            console.log(`       PROBLEMA: ${problema} | resposta: ${r.texto.slice(0, 300)}`);
        } else if (r.status >= 400 && r.json) {
            const detalhes = r.json.erros ? ` ${JSON.stringify(r.json.erros)}` : "";
            console.log(`       "${r.json.message}"${detalhes}`);
        }
        return r;
    };

    const costela = {
        nome: "Costela-de-adão",
        especie: "Monstera deliciosa",
        preco: 8990,
        estoque: 12,
        luminosidade: "MEIA_SOMBRA",
        petFriendly: false,
        regaACadaDias: 7,
    };

    const samambaia = {
        nome: "Samambaia",
        especie: "Nephrolepis exaltata",
        preco: 4590,
        estoque: 0,
        luminosidade: "SOMBRA",
        petFriendly: true,
        regaACadaDias: 2,
    };

    const jiboia = {
        nome: "  Jiboia  ",
        especie: "Epipremnum aureum",
        preco: 3990,
        estoque: 20,
        luminosidade: "MEIA_SOMBRA",
        petFriendly: false,
        regaACadaDias: 3,
    };

    const { especie, ...costelaSemEspecie } = costela;

    console.log("=== Cadastro (POST /plantas) ===");
    await teste("lista começa vazia (banco zerado)", "GET", "/plantas", undefined, 200, (j) =>
        Array.isArray(j) && j.length === 0 ? null : "o banco não está vazio: rode o migrate reset antes do teste");
    const r1 = await teste("planta válida com petFriendly false", "POST", "/plantas", costela, 201, (j) =>
        j.id && j.petFriendly === false && j.preco === 8990 && j.createdAt ? null : "corpo da resposta incompleto");
    const r2 = await teste("planta válida com estoque 0", "POST", "/plantas", samambaia, 201, (j) =>
        j.estoque === 0 ? null : "estoque deveria ser 0");
    const r3 = await teste("espaços em volta do nome são removidos", "POST", "/plantas", jiboia, 201, (j) =>
        j.nome === "Jiboia" ? null : `nome salvo como "${j.nome}"`);
    await teste("sem o campo especie", "POST", "/plantas", costelaSemEspecie, 400);
    await teste("preco 0", "POST", "/plantas", { ...costela, preco: 0 }, 400);
    await teste("estoque -1", "POST", "/plantas", { ...costela, estoque: -1 }, 400);
    await teste("preco \"8990\" (texto)", "POST", "/plantas", { ...costela, preco: "8990" }, 400);
    await teste("luminosidade \"LUA\"", "POST", "/plantas", { ...costela, luminosidade: "LUA" }, 400);
    await teste("id enviado no corpo", "POST", "/plantas", { ...costela, id: 99 }, 400);

    const id1 = r1.json.id;
    const id2 = r2.json.id;
    const id3 = r3.json.id;

    console.log("\n=== Leitura (GET) ===");
    await teste("lista as 3 plantas em ordem de id", "GET", "/plantas", undefined, 200, (j) =>
        j.length === 3 && j[0].id === id1 && j[1].id === id2 && j[2].id === id3 ? null : "lista ou ordem inesperada");
    await teste("busca um id que existe", "GET", `/plantas/${id1}`, undefined, 200, (j) =>
        j.nome === "Costela-de-adão" ? null : "planta errada");
    await teste("busca um id que não existe", "GET", "/plantas/999999", undefined, 404);
    await teste("busca o id abc", "GET", "/plantas/abc", undefined, 400);
    await teste("busca o id 0", "GET", "/plantas/0", undefined, 400);
    await teste("busca um id acima do limite do Int", "GET", "/plantas/99999999999", undefined, 400);

    console.log("\n=== Edição (PATCH /plantas/:id) ===");
    const antes = (await requisitar("GET", `/plantas/${id1}`)).json;
    await teste("edita só o preço (o resto não muda)", "PATCH", `/plantas/${id1}`, { preco: 9990 }, 200, (j) => {
        if (j.preco !== 9990) return "preço não mudou";
        const campos = ["nome", "especie", "estoque", "luminosidade", "petFriendly", "regaACadaDias", "createdAt"];
        const mudou = campos.filter((c) => j[c] !== antes[c]);
        if (mudou.length > 0) return `campos que mudaram sem ser enviados: ${mudou.join(", ")}`;
        return j.updatedAt !== antes.updatedAt ? null : "updatedAt deveria mudar";
    });
    await teste("edita com valor inválido (preco 0)", "PATCH", `/plantas/${id1}`, { preco: 0 }, 400);
    await teste("a planta não mudou depois do PATCH inválido", "GET", `/plantas/${id1}`, undefined, 200, (j) =>
        j.preco === 9990 ? null : `preço virou ${j.preco}`);
    await teste("edita um id que não existe", "PATCH", "/plantas/999999", { preco: 9990 }, 404);
    await teste("edita com corpo vazio {}", "PATCH", `/plantas/${id1}`, {}, 400);
    await teste("edita com campo digitado errado (preço)", "PATCH", `/plantas/${id1}`, { "preço": 100 }, 400);
    await teste("edita o id abc", "PATCH", "/plantas/abc", { preco: 9990 }, 400);
    await teste("zera o estoque pela edição", "PATCH", `/plantas/${id3}`, { estoque: 0 }, 200, (j) =>
        j.estoque === 0 ? null : "estoque deveria ser 0");

    console.log("\n=== Remoção (DELETE /plantas/:id) ===");
    await teste("deleta uma planta", "DELETE", `/plantas/${id2}`, undefined, 204, (j, r) =>
        r.texto === "" ? null : "204 não deveria ter corpo");
    await teste("busca a planta deletada", "GET", `/plantas/${id2}`, undefined, 404);
    await teste("deleta de novo", "DELETE", `/plantas/${id2}`, undefined, 404);
    await teste("deleta o id abc", "DELETE", "/plantas/abc", undefined, 400);
    await teste("sobraram 2 plantas", "GET", "/plantas", undefined, 200, (j) =>
        j.length === 2 ? null : `sobraram ${j.length}`);

    console.log(`\nResultado da suíte: ${acertos}/${total}`);
        return { acertos, total };
};

const suite_filtros = async () => {
    const BASE = BASE_URL;

    let acertos = 0;
    let total = 0;

    const requisitar = async (metodo, rota, corpo) => {
        const resposta = await fetchSeguro(BASE + rota, {
            method: metodo,
            headers: corpo === undefined ? {} : { "Content-Type": "application/json" },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        const texto = await resposta.text();
        let json = null;
        try {
            json = texto ? JSON.parse(texto) : null;
        } catch {
            json = null;
        }
        return { status: resposta.status, json, texto };
    };

    const nomes = (lista) => lista.map((planta) => planta.nome).join(", ") || "(nenhuma)";

    const teste = async (descricao, rota, statusEsperado, nomesEsperados) => {
        total++;
        const r = await requisitar("GET", rota);
        let problema = r.status !== statusEsperado ? `status ${r.status}, esperado ${statusEsperado}` : null;
        if (!problema && nomesEsperados) {
            const obtidos = nomes(r.json);
            const esperados = nomesEsperados.join(", ") || "(nenhuma)";
            if (obtidos !== esperados) problema = `veio [${obtidos}], esperado [${esperados}]`;
        }
        if (!problema) acertos++;
        const numero = String(total).padStart(2, "0");
        console.log(`${problema ? "❌" : "✅"} ${numero}. GET ${rota} → ${r.status} | ${descricao}`);
        if (problema) {
            console.log(`       PROBLEMA: ${problema} | resposta: ${r.texto.slice(0, 300)}`);
        } else if (r.status === 200) {
            console.log(`       ${nomes(r.json)}`);
        } else if (r.json) {
            console.log(`       "${r.json.message}" ${JSON.stringify(r.json.erros || [])}`);
        }
    };

    const plantas = [
        { nome: "Costela-de-adão", especie: "Monstera deliciosa", preco: 8990, estoque: 12, luminosidade: "MEIA_SOMBRA", petFriendly: false, regaACadaDias: 7 },
        { nome: "Samambaia", especie: "Nephrolepis exaltata", preco: 4590, estoque: 0, luminosidade: "SOMBRA", petFriendly: true, regaACadaDias: 2 },
        { nome: "Calathea", especie: "Goeppertia orbifolia", preco: 7490, estoque: 8, luminosidade: "MEIA_SOMBRA", petFriendly: true, regaACadaDias: 4 },
        { nome: "Espada-de-são-jorge", especie: "Dracaena trifasciata", preco: 5990, estoque: 15, luminosidade: "SOL_PLENO", petFriendly: false, regaACadaDias: 15 },
    ];

    const inicial = await requisitar("GET", "/plantas");
    if (!Array.isArray(inicial.json) || inicial.json.length > 0) {
        console.log("❌ O banco não está vazio: rode o migrate reset e tente de novo.");
        throw new Error("A suíte não pôde continuar (veja a mensagem acima).");
    }

    for (const planta of plantas) {
        const r = await requisitar("POST", "/plantas", planta);
        if (r.status !== 201) {
            console.log(`❌ Não consegui cadastrar ${planta.nome}: ${r.status} ${r.texto}`);
            throw new Error("A suíte não pôde continuar (veja a mensagem acima).");
        }
    }
    console.log("Cadastradas: Costela-de-adão (MEIA_SOMBRA, não pet), Samambaia (SOMBRA, pet),");
    console.log("             Calathea (MEIA_SOMBRA, pet), Espada-de-são-jorge (SOL_PLENO, não pet)\n");

    console.log("=== Filtros válidos ===");
    await teste("sem filtro: todas", "/plantas", 200, ["Costela-de-adão", "Samambaia", "Calathea", "Espada-de-são-jorge"]);
    await teste("só luminosidade", "/plantas?luminosidade=MEIA_SOMBRA", 200, ["Costela-de-adão", "Calathea"]);
    await teste("só petFriendly=true", "/plantas?petFriendly=true", 200, ["Samambaia", "Calathea"]);
    await teste("só petFriendly=false (false não é 'sem filtro')", "/plantas?petFriendly=false", 200, ["Costela-de-adão", "Espada-de-são-jorge"]);
    await teste("os dois juntos", "/plantas?luminosidade=MEIA_SOMBRA&petFriendly=true", 200, ["Calathea"]);
    await teste("os dois juntos, outra ordem", "/plantas?petFriendly=false&luminosidade=SOL_PLENO", 200, ["Espada-de-são-jorge"]);
    await teste("filtro válido sem resultado → [] (não 404)", "/plantas?luminosidade=SOL_PLENO&petFriendly=true", 200, []);

    console.log("\n=== Filtros inválidos ===");
    await teste("luminosidade LUA", "/plantas?luminosidade=LUA", 400);
    await teste("luminosidade em minúsculas", "/plantas?luminosidade=sombra", 400);
    await teste("luminosidade vazia", "/plantas?luminosidade=", 400);
    await teste("petFriendly=sim", "/plantas?petFriendly=sim", 400);
    await teste("petFriendly=1", "/plantas?petFriendly=1", 400);
    await teste("petFriendly repetido", "/plantas?petFriendly=true&petFriendly=false", 400);
    await teste("filtro com nome errado (petfriendly minúsculo)", "/plantas?petfriendly=true", 400);
    await teste("dois filtros inválidos ao mesmo tempo", "/plantas?luminosidade=LUA&petFriendly=talvez", 400);

    console.log(`\nResultado da suíte: ${acertos}/${total}`);
        return { acertos, total };
};

const suite_venda = async () => {
    const BASE = BASE_URL;

    let acertos = 0;
    let total = 0;

    const requisitar = async (metodo, rota, corpo) => {
        const resposta = await fetchSeguro(BASE + rota, {
            method: metodo,
            headers: corpo === undefined ? {} : { "Content-Type": "application/json" },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        const texto = await resposta.text();
        let json = null;
        try {
            json = texto ? JSON.parse(texto) : null;
        } catch {
            json = null;
        }
        return { status: resposta.status, json, texto };
    };

    const registrar = (correto, linha, detalhe) => {
        total++;
        if (correto) acertos++;
        console.log(`${correto ? "✅" : "❌"} ${String(total).padStart(2, "0")}. ${linha}`);
        if (detalhe) console.log(`       ${detalhe}`);
    };

    const estoqueAtual = async (id) => (await requisitar("GET", `/plantas/${id}`)).json.estoque;

    const venda = async (descricao, id, corpo, statusEsperado, estoqueEsperado) => {
        const antes = await estoqueAtual(id).catch(() => null);
        const r = await requisitar("POST", `/plantas/${id}/venda`, corpo);
        const depois = await estoqueAtual(id).catch(() => null);
        let problema = r.status !== statusEsperado ? `status ${r.status}, esperado ${statusEsperado}` : null;
        if (!problema && estoqueEsperado !== undefined && depois !== estoqueEsperado) {
            problema = `estoque ficou ${depois}, esperado ${estoqueEsperado}`;
        }
        const mensagem = r.json && r.json.message ? `"${r.json.message}"${r.json.erros ? " " + JSON.stringify(r.json.erros) : ""}` : "";
        const estoques = typeof antes === "number" ? ` | estoque ${antes} → ${depois}` : "";
        registrar(!problema, `POST /plantas/${id}/venda ${JSON.stringify(corpo)} → ${r.status}${estoques} | ${descricao}`, problema ? `PROBLEMA: ${problema} | ${r.texto.slice(0, 200)}` : mensagem);
    };

    const cadastrar = async (nome, estoque) => {
        const r = await requisitar("POST", "/plantas", {
            nome, especie: "Nephrolepis exaltata", preco: 4590, estoque,
            luminosidade: "SOMBRA", petFriendly: true, regaACadaDias: 2,
        });
        if (r.status !== 201) {
            console.log(`❌ Não consegui cadastrar ${nome}: ${r.status} ${r.texto}`);
            throw new Error("A suíte não pôde continuar (veja a mensagem acima).");
        }
        return r.json.id;
    };

    const inicial = await requisitar("GET", "/plantas");
    if (!Array.isArray(inicial.json) || inicial.json.length > 0) {
        console.log("❌ O banco não está vazio: rode o migrate reset e tente de novo.");
        throw new Error("A suíte não pôde continuar (veja a mensagem acima).");
    }

    console.log("=== Parte 1: regras da venda ===");
    const id = await cadastrar("Samambaia", 5);
    console.log(`(cadastrada a Samambaia, id ${id}, com 5 vasos)`);
    await venda("venda normal", id, { quantidade: 2 }, 200, 3);
    await venda("mais do que tem: o estoque não muda", id, { quantidade: 5 }, 400, 3);
    await venda("exatamente o que tem: zera o estoque", id, { quantidade: 3 }, 200, 0);
    await venda("planta esgotada", id, { quantidade: 1 }, 400, 0);
    await venda("quantidade 0", id, { quantidade: 0 }, 400, 0);
    await venda("quantidade negativa", id, { quantidade: -1 }, 400, 0);
    await venda("quantidade decimal", id, { quantidade: 1.5 }, 400, 0);
    await venda("quantidade como texto", id, { quantidade: "2" }, 400, 0);
    await venda("sem quantidade", id, {}, 400, 0);
    await venda("campo extra", id, { quantidade: 1, desconto: 10 }, 400, 0);
    await venda("quantidade acima do limite do Int", id, { quantidade: 3000000000 }, 400, 0);
    await venda("planta que não existe", 999999, { quantidade: 1 }, 404);
    await venda("id abc", "abc", { quantidade: 1 }, 400);
    await venda("id inexistente com quantidade inválida → 400 (valida antes de buscar)", 999999, { quantidade: 0 }, 400);

    const r200 = await requisitar("POST", `/plantas/${await cadastrar("Calathea", 4)}/venda`, { quantidade: 1 });
    registrar(r200.status === 200 && r200.json.estoque === 3 && r200.json.nome === "Calathea",
        `a resposta 200 traz a planta atualizada → estoque ${r200.json?.estoque}`);

    const RODADAS = 5;

    const concorrencia = async (titulo, estoqueInicial, pedidos) => {
        let rodadasComProblema = 0;
        let piorRodada = null;
        for (let rodada = 1; rodada <= RODADAS; rodada++) {
            const idPlanta = await cadastrar(`${titulo} #${rodada}`, estoqueInicial);
            const respostas = await Promise.all(
                Array.from({ length: pedidos }, () => requisitar("POST", `/plantas/${idPlanta}/venda`, { quantidade: 1 })),
            );
            const vendidas = respostas.filter((r) => r.status === 200).length;
            const recusadas = respostas.filter((r) => r.status === 400).length;
            const final = await estoqueAtual(idPlanta);
            if (vendidas !== estoqueInicial || final !== 0 || vendidas + recusadas !== pedidos) {
                rodadasComProblema++;
                if (!piorRodada || vendidas > piorRodada.vendidas) piorRodada = { vendidas, recusadas, final };
            }
        }
        const linha = `${pedidos} compras SIMULTÂNEAS de 1 vaso, com ${estoqueInicial} vaso(s) em estoque (${RODADAS} rodadas)`;
        const detalhe = rodadasComProblema === 0
            ? `em todas as rodadas: ${estoqueInicial} vendida(s), ${pedidos - estoqueInicial} recusada(s), estoque final 0`
            : `VENDA DE VASOS QUE NÃO EXISTEM em ${rodadasComProblema}/${RODADAS} rodadas. Pior: ${piorRodada.vendidas} vendidas de ${estoqueInicial} vaso(s), estoque final ${piorRodada.final}`;
        registrar(rodadasComProblema === 0, linha, detalhe);
    };

    console.log("\n=== Parte 2: vendas simultâneas (o último vaso) ===");
    await concorrencia("Samambaia (último vaso)", 1, 20);
    await concorrencia("Jiboia (10 vasos)", 10, 50);

    console.log(`\nResultado da suíte: ${acertos}/${total}`);
        return { acertos, total };
};

const suite_valorTotal = async () => {
    const BASE = BASE_URL;

    let acertos = 0;
    let total = 0;

    const requisitar = async (metodo, rota, corpo) => {
        const resposta = await fetchSeguro(BASE + rota, {
            method: metodo,
            headers: corpo === undefined ? {} : { "Content-Type": "application/json" },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        const texto = await resposta.text();
        let json = null;
        try {
            json = texto ? JSON.parse(texto) : null;
        } catch {
            json = null;
        }
        return { status: resposta.status, json, texto };
    };

    const brl = (centavos) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const conferir = async (descricao, valorEsperado, vasosEsperados) => {
        total++;
        const r = await requisitar("GET", "/plantas/estoque/valor-total");
        const chaves = r.json ? Object.keys(r.json).sort().join(",") : "";
        let problema = null;
        if (r.status !== 200) problema = `status ${r.status}, esperado 200`;
        else if (chaves !== "totalDeVasos,valorTotalEmCentavos") problema = `chaves inesperadas: ${chaves}`;
        else if (r.json.valorTotalEmCentavos !== valorEsperado) problema = `valor ${r.json.valorTotalEmCentavos}, esperado ${valorEsperado}`;
        else if (r.json.totalDeVasos !== vasosEsperados) problema = `vasos ${r.json.totalDeVasos}, esperado ${vasosEsperados}`;
        if (!problema) acertos++;
        console.log(`${problema ? "❌" : "✅"} ${String(total).padStart(2, "0")}. ${descricao}`);
        console.log(`       ${problema ? "PROBLEMA: " + problema + " | " + r.texto : r.texto + `  (${brl(r.json.valorTotalEmCentavos)})`}`);
    };

    const inicial = await requisitar("GET", "/plantas");
    if (!Array.isArray(inicial.json) || inicial.json.length > 0) {
        console.log("❌ O banco não está vazio: rode o migrate reset e tente de novo.");
        throw new Error("A suíte não pôde continuar (veja a mensagem acima).");
    }

    await conferir("loja vazia: tudo zerado", 0, 0);

    const plantas = [
        { nome: "Costela-de-adão", especie: "Monstera deliciosa", preco: 8990, estoque: 12, luminosidade: "MEIA_SOMBRA", petFriendly: false, regaACadaDias: 7 },
        { nome: "Samambaia", especie: "Nephrolepis exaltata", preco: 4590, estoque: 0, luminosidade: "SOMBRA", petFriendly: true, regaACadaDias: 2 },
        { nome: "Calathea", especie: "Goeppertia orbifolia", preco: 7490, estoque: 8, luminosidade: "MEIA_SOMBRA", petFriendly: true, regaACadaDias: 4 },
        { nome: "Jiboia", especie: "Epipremnum aureum", preco: 3990, estoque: 20, luminosidade: "MEIA_SOMBRA", petFriendly: false, regaACadaDias: 3 },
    ];
    const ids = {};
    for (const planta of plantas) {
        const r = await requisitar("POST", "/plantas", planta);
        ids[planta.nome] = r.json.id;
    }

    console.log("\nConta feita à mão:");
    console.log("  Costela-de-adão  8990 × 12 = 107880");
    console.log("  Samambaia        4590 ×  0 =      0   (esgotada: entra na conta com zero)");
    console.log("  Calathea         7490 ×  8 =  59920");
    console.log("  Jiboia           3990 × 20 =  79800");
    console.log("                  vasos: 40   total: 247600 centavos = R$ 2.476,00\n");

    await conferir("4 plantas cadastradas", 247600, 40);

    await requisitar("POST", `/plantas/${ids["Costela-de-adão"]}/venda`, { quantidade: 2 });
    await conferir("depois de vender 2 Costelas (−2 × 8990 = −17980; −2 vasos)", 229620, 38);

    await requisitar("PATCH", `/plantas/${ids["Jiboia"]}`, { preco: 4990 });
    await conferir("depois de a Jiboia subir de 3990 para 4990 (+20 × 1000 = +20000)", 249620, 38);

    await requisitar("DELETE", `/plantas/${ids["Calathea"]}`);
    await conferir("depois de remover a Calathea (−59920; −8 vasos)", 189700, 30);

    total++;
    const lista = (await requisitar("GET", "/plantas")).json;
    const somaDaLista = lista.reduce((s, p) => s + p.preco * p.estoque, 0);
    const r = await requisitar("GET", "/plantas/estoque/valor-total");
    const bate = r.json.valorTotalEmCentavos === somaDaLista;
    if (bate) acertos++;
    console.log(`${bate ? "✅" : "❌"} ${String(total).padStart(2, "0")}. o total bate com a soma recalculada a partir de GET /plantas (${somaDaLista})`);

    total++;
    const rotaId = await requisitar("GET", "/plantas/estoque");
    const ok = rotaId.status === 400;
    if (ok) acertos++;
    console.log(`${ok ? "✅" : "❌"} ${String(total).padStart(2, "0")}. GET /plantas/estoque cai na rota /:id e responde 400 → ${rotaId.status} ${rotaId.texto}`);

    console.log(`\nResultado da suíte: ${acertos}/${total}`);
        return { acertos, total };
};

const suite_bonus = async () => {
    const BASE = BASE_URL;

    let acertos = 0;
    let total = 0;

    const requisitar = async (metodo, rota, corpo) => {
        const resposta = await fetchSeguro(BASE + rota, {
            method: metodo,
            headers: corpo === undefined ? {} : { "Content-Type": "application/json" },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        const texto = await resposta.text();
        let json = null;
        try {
            json = texto ? JSON.parse(texto) : null;
        } catch {
            json = null;
        }
        return { status: resposta.status, json, texto };
    };

    const nomes = (lista) => lista.map((planta) => planta.nome).join(", ") || "(nenhuma)";

    const teste = async (descricao, rota, statusEsperado, nomesEsperados) => {
        total++;
        const r = await requisitar("GET", rota);
        let problema = r.status !== statusEsperado ? `status ${r.status}, esperado ${statusEsperado}` : null;
        if (!problema && nomesEsperados) {
            const obtidos = nomes(r.json);
            const esperados = nomesEsperados.join(", ") || "(nenhuma)";
            if (obtidos !== esperados) problema = `veio [${obtidos}], esperado [${esperados}]`;
        }
        if (!problema) acertos++;
        console.log(`${problema ? "❌" : "✅"} ${String(total).padStart(2, "0")}. GET ${rota} → ${r.status} | ${descricao}`);
        if (problema) {
            console.log(`       PROBLEMA: ${problema} | resposta: ${r.texto.slice(0, 300)}`);
        } else if (r.status === 200) {
            console.log(`       ${nomes(r.json)}`);
        } else if (r.json) {
            console.log(`       "${r.json.message}" ${JSON.stringify(r.json.erros || [])}`);
        }
    };

    const base = { luminosidade: "MEIA_SOMBRA", petFriendly: true, regaACadaDias: 3 };
    const plantas = [
        { ...base, nome: "Costela-de-adão", especie: "Monstera deliciosa", preco: 8990, estoque: 12, petFriendly: false },
        { ...base, nome: "Calathea", especie: "Goeppertia orbifolia", preco: 7490, estoque: 2 },
        { ...base, nome: "Jiboia", especie: "Epipremnum aureum", preco: 3990, estoque: 20, petFriendly: false },
        { ...base, nome: "Samambaia", especie: "Nephrolepis exaltata", preco: 4590, estoque: 0, luminosidade: "SOMBRA" },
        { ...base, nome: "Kit 100% suculentas", especie: "Echeveria spp.", preco: 2490, estoque: 0, luminosidade: "SOL_PLENO" },
        { ...base, nome: "Cacto_mini", especie: "Mammillaria elongata", preco: 1990, estoque: 5, luminosidade: "SOL_PLENO" },
        { ...base, nome: "Peperômia", especie: "Peperomia obtusifolia", preco: 3990, estoque: 10 },
    ];

    const inicial = await requisitar("GET", "/plantas");
    if (!Array.isArray(inicial.json) || inicial.json.length > 0) {
        console.log("❌ O banco não está vazio: rode o migrate reset e tente de novo.");
        throw new Error("A suíte não pôde continuar (veja a mensagem acima).");
    }
    const ids = {};
    for (const planta of plantas) {
        const r = await requisitar("POST", "/plantas", planta);
        if (r.status !== 201) {
            console.log(`❌ Não consegui cadastrar ${planta.nome}: ${r.status} ${r.texto}`);
            throw new Error("A suíte não pôde continuar (veja a mensagem acima).");
        }
        ids[planta.nome] = r.json.id;
    }
    console.log(`Cadastradas ${plantas.length} plantas (em ordem de id): ${plantas.map((p) => p.nome).join(", ")}\n`);

    console.log("=== Bônus 1: busca por nome (?nome=) ===");
    await teste("parte do nome, minúsculas", "/plantas?nome=costela", 200, ["Costela-de-adão"]);
    await teste("parte do nome, MAIÚSCULAS", "/plantas?nome=COSTELA", 200, ["Costela-de-adão"]);
    await teste("trecho do meio do nome", "/plantas?nome=lat", 200, ["Calathea"]);
    await teste("espaços em volta são ignorados", "/plantas?nome=%20%20jiboia%20%20", 200, ["Jiboia"]);
    await teste("% é procurado como texto (não como curinga)", "/plantas?nome=%25", 200, ["Kit 100% suculentas"]);
    await teste("_ é procurado como texto (não como curinga)", "/plantas?nome=_", 200, ["Cacto_mini"]);
    await teste("nome que não existe → [] (não 404)", "/plantas?nome=orquidea", 200, []);
    await teste("busca combinada com filtro", "/plantas?nome=a&petFriendly=false", 200, ["Costela-de-adão", "Jiboia"]);
    await teste("nome vazio", "/plantas?nome=", 400);
    await teste("nome só com espaços", "/plantas?nome=%20%20", 400);

    console.log("\n=== Bônus 2: ordenação (?ordem=) ===");
    await teste("sem ordem: por id", "/plantas", 200, plantas.map((p) => p.nome));
    await teste("por preço (empate desfeito pelo id)", "/plantas?ordem=preco", 200,
        ["Cacto_mini", "Kit 100% suculentas", "Jiboia", "Peperômia", "Samambaia", "Calathea", "Costela-de-adão"]);
    await teste("por nome", "/plantas?ordem=nome", 200,
        ["Cacto_mini", "Calathea", "Costela-de-adão", "Jiboia", "Kit 100% suculentas", "Peperômia", "Samambaia"]);
    await teste("ordem + filtros juntos", "/plantas?luminosidade=MEIA_SOMBRA&petFriendly=true&ordem=preco", 200, ["Peperômia", "Calathea"]);
    await teste("ordem inválida", "/plantas?ordem=estoque", 400);
    await teste("ordem em maiúsculas", "/plantas?ordem=PRECO", 400);
    await teste("parâmetro desconhecido lista os 4 permitidos", "/plantas?busca=costela", 400);

    console.log("\n=== Bônus 3: GET /plantas/esgotadas ===");
    await teste("lista só as de estoque 0 (e não é tratada como id)", "/plantas/esgotadas", 200, ["Samambaia", "Kit 100% suculentas"]);
    await requisitar("POST", `/plantas/${ids["Calathea"]}/venda`, { quantidade: 2 });
    await teste("depois de vender os 2 últimos vasos de Calathea", "/plantas/esgotadas", 200, ["Calathea", "Samambaia", "Kit 100% suculentas"]);
    await requisitar("PATCH", `/plantas/${ids["Samambaia"]}`, { estoque: 5 });
    await teste("depois de repor o estoque da Samambaia", "/plantas/esgotadas", 200, ["Calathea", "Kit 100% suculentas"]);
    await requisitar("DELETE", `/plantas/${ids["Calathea"]}`);
    await requisitar("DELETE", `/plantas/${ids["Kit 100% suculentas"]}`);
    await teste("nenhuma esgotada → [] (não 404)", "/plantas/esgotadas", 200, []);

    console.log(`\nResultado da suíte: ${acertos}/${total}`);
        return { acertos, total };
};

const suite_json = async () => {
    const BASE = BASE_URL;

    let acertos = 0;
    let total = 0;

    const enviarTexto = async (metodo, rota, texto, tipo = "application/json") => {
        const resposta = await fetchSeguro(BASE + rota, { method: metodo, headers: { "Content-Type": tipo }, body: texto });
        const corpo = await resposta.text();
        return { status: resposta.status, tipo: resposta.headers.get("content-type") || "", corpo };
    };

    const teste = async (descricao, metodo, rota, texto, statusEsperado, tipo) => {
        total++;
        const r = await enviarTexto(metodo, rota, texto, tipo);
        let problema = null;
        if (r.status !== statusEsperado) problema = `status ${r.status}, esperado ${statusEsperado}`;
        else if (!r.tipo.includes("application/json")) problema = `resposta em ${r.tipo}, não em JSON`;
        else if (/node_modules|SyntaxError|<html/i.test(r.corpo)) problema = "a resposta expõe detalhes internos";
        if (!problema) acertos++;
        const amostra = texto.length > 40 ? `${texto.slice(0, 25)}... (${texto.length} caracteres)` : texto;
        console.log(`${problema ? "❌" : "✅"} ${String(total).padStart(2, "0")}. ${metodo} ${rota} ${amostra} → ${r.status} | ${descricao}`);
        console.log(`       ${problema ? "PROBLEMA: " + problema + " | " : ""}${r.corpo.slice(0, 200)}`);
    };

    const inicial = await fetchSeguro(BASE + "/plantas").then((r) => r.json());
    if (!Array.isArray(inicial) || inicial.length > 0) {
        console.log("❌ O banco não está vazio: rode o migrate reset e tente de novo.");
        throw new Error("A suíte não pôde continuar (veja a mensagem acima).");
    }
    const valida = JSON.stringify({ nome: "Jiboia", especie: "Epipremnum aureum", preco: 3990, estoque: 20, luminosidade: "MEIA_SOMBRA", petFriendly: false, regaACadaDias: 3 });
    await enviarTexto("POST", "/plantas", valida);

    console.log("=== JSON malformado e erros fora dos controllers ===");
    await teste("vírgula sobrando", "POST", "/plantas", '{"nome":"Ana",}', 400);
    await teste("chave sem aspas", "POST", "/plantas", '{nome: "Ana"}', 400);
    await teste("chave não fechada", "POST", "/plantas", '{"nome": "Ana"', 400);
    await teste("texto solto em vez de objeto", "POST", "/plantas", '"só um texto"', 400);
    await teste("PATCH com JSON malformado", "PATCH", "/plantas/1", '{"preco": 100,}', 400);
    await teste("venda com JSON malformado", "POST", "/plantas/1/venda", '{"quantidade": }', 400);
    await teste("o CRUD de usuários também ganha a proteção", "POST", "/users", '{"nome":"Ana",}', 400);
    await teste("corpo grande demais (mais de 100 KB)", "POST", "/plantas", `{"nome":"${"a".repeat(200000)}"}`, 413);
    await teste("corpo sem Content-Type JSON é ignorado → campos ausentes", "POST", "/plantas", valida, 400, "text/plain");
    await teste("a API continua funcionando: cadastro válido", "POST", "/plantas", valida, 201);
    total++; { const r = await fetchSeguro(BASE + "/rota-que-nao-existe"); const c = await r.text(); const ok = r.status === 404 && (r.headers.get("content-type") || "").includes("json"); if (ok) acertos++; console.log(`${ok ? "✅" : "❌"} ${String(total).padStart(2, "0")}. GET /rota-que-nao-existe → ${r.status} | rota inexistente continua 404 em JSON`); console.log(`       ${c}`); }

    console.log(`\nResultado da suíte: ${acertos}/${total}`);
        return { acertos, total };
};

const suite_seed = async () => {
    let acertos = 0;
    let total = 0;
    const registrar = (correto, linha, detalhe) => {
        total++;
        if (correto) acertos++;
        console.log(`${correto ? "✅" : "❌"} ${String(total).padStart(2, "0")}. ${linha}`);
        if (detalhe) console.log(`       ${detalhe}`);
    };
    const primeira = execSync("yarn -s seed").toString();
    registrar(primeira.includes("12 plantas de exemplo cadastradas"), "yarn seed com o banco vazio cadastra 12 plantas", primeira.trim().split("\n").pop());
    const segunda = execSync("yarn -s seed").toString();
    registrar(segunda.includes("o seed não foi executado"), "yarn seed de novo não duplica nada", segunda.trim().split("\n").pop());
    const plantas = await fetchSeguro(`${BASE_URL}/plantas`).then((r) => r.json());
    registrar(plantas.length === 12, `GET /plantas → ${plantas.length} plantas`);
    const valor = await fetchSeguro(`${BASE_URL}/plantas/estoque/valor-total`).then((r) => r.json());
    registrar(valor.valorTotalEmCentavos === 606280 && valor.totalDeVasos === 142, "valor total confere com a conta à mão (606280 centavos, 142 vasos)", JSON.stringify(valor));
    const esgotadas = await fetchSeguro(`${BASE_URL}/plantas/esgotadas`).then((r) => r.json());
    const nomes = esgotadas.map((p) => p.nome).join(", ");
    registrar(nomes === "Samambaia, Lírio-da-paz", "esgotadas do seed: Samambaia e Lírio-da-paz", nomes);
    console.log(`\nResultado da suíte: ${acertos}/${total}`);
    return { acertos, total };
};

const suites = [
    ["CRUD (Etapa 4)", suite_crud],
    ["Filtros (Etapa 5)", suite_filtros],
    ["Venda e concorrência (Etapa 6)", suite_venda],
    ["Valor total (Etapa 7)", suite_valorTotal],
    ["Bônus: busca, ordenação e esgotadas (Etapa 8)", suite_bonus],
    ["JSON malformado (Etapa 9)", suite_json],
    ["Seed (Etapa 8)", suite_seed],
];

try {
    await fetchSeguro(`${BASE_URL}/`);
} catch {
    console.log("❌ A API não respondeu em http://localhost:3001. Suba o Docker (docker compose up -d) e tente de novo.");
    process.exit(1);
}

const resumo = [];
for (const [titulo, suite] of suites) {
    zerarBanco();
    console.log(`\n################ ${titulo} ################`);
    try {
        const { acertos, total } = await suite();
        resumo.push([titulo, acertos, total]);
    } catch (erro) {
        const causa = erro.cause ? ` (causa: ${erro.cause.code ?? erro.cause.message})` : "";
        console.log(`❌ ${erro.message}${causa}`);
        resumo.push([titulo, 0, 1]);
    }
}

console.log("\n================= RESUMO =================");
for (const [titulo, acertos, total] of resumo) {
    console.log(`${acertos === total ? "✅" : "❌"} ${titulo}: ${acertos}/${total}`);
}
const acertosGerais = resumo.reduce((soma, [, acertos]) => soma + acertos, 0);
const totalGeral = resumo.reduce((soma, [, , total]) => soma + total, 0);
console.log(`\nTOTAL: ${acertosGerais}/${totalGeral} testes corretos`);
console.log(`GETs repetidos por conexão encerrada: ${getsRepetidos}`);
console.log("(O banco ficou com as 12 plantas do seed, prontas para explorar.)");

// Código de saída 1 avisa ao terminal (ou a uma ferramenta de CI) que algum teste falhou
if (acertosGerais !== totalGeral) {
    process.exitCode = 1;
}
