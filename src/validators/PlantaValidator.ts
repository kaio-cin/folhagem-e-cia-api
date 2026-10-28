import { Luminosidade } from "@prisma/client";

// Maior valor que cabe numa coluna Int do PostgreSQL (inteiro de 32 bits)
const MAIOR_INT = 2147483647;

const CAMPOS_DA_PLANTA = [
    "nome",
    "especie",
    "preco",
    "estoque",
    "luminosidade",
    "petFriendly",
    "regaACadaDias",
];

const FILTROS_PERMITIDOS = ["luminosidade", "petFriendly", "nome", "ordem"];

const ORDENS = ["preco", "nome"] as const;

const LUMINOSIDADES = Object.values(Luminosidade);

const ehTextoPreenchido = (valor: unknown) => {
    return typeof valor === "string" && valor.trim() !== "";
};

const ehInteiroEntre = (valor: unknown, minimo: number) => {
    return typeof valor === "number" && Number.isInteger(valor) && valor >= minimo && valor <= MAIOR_INT;
};

const ehLuminosidade = (valor: unknown) => {
    return LUMINOSIDADES.some((luminosidade) => luminosidade === valor);
};

export const validarId = (texto: string) => {
    if (!/^\d+$/.test(texto)) {
        return null;
    }

    const id = Number(texto);

    return id >= 1 && id <= MAIOR_INT ? id : null;
};

export const validarPlanta = (corpo: unknown, parcial: boolean) => {
    if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
        return ["O corpo da requisição deve ser um objeto JSON."];
    }

    const dados = corpo as Record<string, unknown>;

    if (parcial && Object.keys(dados).length === 0) {
        return ["Envie ao menos um campo para editar."];
    }

    const erros: string[] = [];
    const ausentes: string[] = [];

    const naoPermitidos = Object.keys(dados).filter((campo) => !CAMPOS_DA_PLANTA.includes(campo));

    if (naoPermitidos.length > 0) {
        erros.push(`Campo(s) não permitido(s): ${naoPermitidos.join(", ")}.`);
    }

    // No cadastro, campo ausente é erro; na edição, campo ausente apenas não é alterado
    const foiEnviado = (campo: string) => {
        if (dados[campo] !== undefined) {
            return true;
        }

        if (!parcial) {
            ausentes.push(campo);
        }

        return false;
    };

    if (foiEnviado("nome") && !ehTextoPreenchido(dados.nome)) {
        erros.push("nome deve ser um texto não vazio.");
    }

    if (foiEnviado("especie") && !ehTextoPreenchido(dados.especie)) {
        erros.push("especie deve ser um texto não vazio.");
    }

    if (foiEnviado("preco") && !ehInteiroEntre(dados.preco, 1)) {
        erros.push(`preco deve ser um número inteiro entre 1 e ${MAIOR_INT}, em centavos (ex.: 8990 = R$ 89,90).`);
    }

    if (foiEnviado("estoque") && !ehInteiroEntre(dados.estoque, 0)) {
        erros.push(`estoque deve ser um número inteiro entre 0 e ${MAIOR_INT}.`);
    }

    if (foiEnviado("luminosidade") && !ehLuminosidade(dados.luminosidade)) {
        erros.push(`luminosidade deve ser um destes valores: ${LUMINOSIDADES.join(", ")}.`);
    }

    if (foiEnviado("petFriendly") && typeof dados.petFriendly !== "boolean") {
        erros.push("petFriendly deve ser true ou false (sem aspas).");
    }

    if (foiEnviado("regaACadaDias") && !ehInteiroEntre(dados.regaACadaDias, 1)) {
        erros.push(`regaACadaDias deve ser um número inteiro entre 1 e ${MAIOR_INT}.`);
    }

    if (ausentes.length > 0) {
        erros.unshift(`Campo(s) obrigatório(s) ausente(s): ${ausentes.join(", ")}.`);
    }

    return erros;
};

export const validarFiltros = (query: Record<string, unknown>) => {
    const erros: string[] = [];
    const filtros: {
        luminosidade?: Luminosidade;
        petFriendly?: boolean;
        nome?: string;
        ordem?: (typeof ORDENS)[number];
    } = {};

    const naoPermitidos = Object.keys(query).filter((filtro) => !FILTROS_PERMITIDOS.includes(filtro));

    if (naoPermitidos.length > 0) {
        erros.push(`Filtro(s) não permitido(s): ${naoPermitidos.join(", ")}. Use: ${FILTROS_PERMITIDOS.join(", ")}.`);
    }

    // Filtro não enviado fica undefined, e o Prisma ignora condições undefined no where
    if (query.luminosidade !== undefined) {
        const luminosidade = LUMINOSIDADES.find((valor) => valor === query.luminosidade);

        if (luminosidade === undefined) {
            erros.push(`luminosidade deve ser um destes valores: ${LUMINOSIDADES.join(", ")}.`);
        } else {
            filtros.luminosidade = luminosidade;
        }
    }

    // Na URL tudo chega como texto: "true" e "false" viram booleanos, qualquer outro valor é inválido
    if (query.petFriendly !== undefined) {
        if (query.petFriendly === "true") {
            filtros.petFriendly = true;
        } else if (query.petFriendly === "false") {
            filtros.petFriendly = false;
        } else {
            erros.push("petFriendly deve ser true ou false.");
        }
    }

    if (query.nome !== undefined) {
        if (typeof query.nome === "string" && query.nome.trim() !== "") {
            filtros.nome = query.nome.trim();
        } else {
            erros.push("nome deve ser um texto não vazio.");
        }
    }

    if (query.ordem !== undefined) {
        const ordem = ORDENS.find((valor) => valor === query.ordem);

        if (ordem === undefined) {
            erros.push(`ordem deve ser um destes valores: ${ORDENS.join(", ")}.`);
        } else {
            filtros.ordem = ordem;
        }
    }

    return { erros, filtros };
};

export const validarVenda = (corpo: unknown) => {
    if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
        return ["O corpo da requisição deve ser um objeto JSON."];
    }

    const dados = corpo as Record<string, unknown>;
    const erros: string[] = [];

    const naoPermitidos = Object.keys(dados).filter((campo) => campo !== "quantidade");

    if (naoPermitidos.length > 0) {
        erros.push(`Campo(s) não permitido(s): ${naoPermitidos.join(", ")}. Envie apenas quantidade.`);
    }

    if (dados.quantidade === undefined) {
        erros.push("O campo quantidade é obrigatório.");
    } else if (!ehInteiroEntre(dados.quantidade, 1)) {
        erros.push(`quantidade deve ser um número inteiro entre 1 e ${MAIOR_INT}.`);
    }

    return erros;
};
