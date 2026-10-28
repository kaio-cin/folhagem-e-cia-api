import { Luminosidade, Prisma } from "@prisma/client";
import prisma from "@database";

export const createPlanta = async (data: Prisma.PlantaCreateInput) => {
    return await prisma.planta.create({
        data: data,
    });
};

type FiltrosPlanta = {
    luminosidade?: Luminosidade;
    petFriendly?: boolean;
    nome?: string;
    ordem?: "preco" | "nome";
};

// Na busca do PostgreSQL, % e _ são curingas: com a barra antes, eles são procurados como texto comum
const escaparCuringas = (texto: string) => texto.replace(/[\\%_]/g, "\\$&");

export const findAllPlantas = async (filtros: FiltrosPlanta = {}) => {
    const ordenacao: Prisma.PlantaOrderByWithRelationInput[] = [];

    if (filtros.ordem === "preco") {
        ordenacao.push({ preco: "asc" });
    }

    if (filtros.ordem === "nome") {
        ordenacao.push({ nome: "asc" });
    }

    // O id é a ordem padrão e desempata plantas com o mesmo preço ou nome
    ordenacao.push({ id: "asc" });

    return await prisma.planta.findMany({
        where: {
            luminosidade: filtros.luminosidade,
            petFriendly: filtros.petFriendly,
            nome: filtros.nome === undefined ? undefined : { contains: escaparCuringas(filtros.nome), mode: "insensitive" },
        },
        orderBy: ordenacao,
    });
};

export const findPlantaById = async (id: number) => {
    return await prisma.planta.findUnique({
        where: { id: id },
    });
};

export const updatePlanta = async (id: number, data: Prisma.PlantaUpdateInput) => {
    return await prisma.planta.update({
        where: { id: id },
        data: data,
    });
};

export const deletePlanta = async (id: number) => {
    return await prisma.planta.delete({
        where: { id: id },
    });
};

// Desconta o estoque numa única operação no banco, só se houver vasos suficientes.
// Assim, duas vendas simultâneas do último vaso não conseguem passar as duas.
export const sellPlanta = async (id: number, quantidade: number) => {
    const resultado = await prisma.planta.updateMany({
        where: { id: id, estoque: { gte: quantidade } },
        data: { estoque: { decrement: quantidade } },
    });

    return resultado.count === 1;
};

export const findPrecoEEstoque = async () => {
    return await prisma.planta.findMany({
        select: { preco: true, estoque: true },
    });
};

export const findPlantasEsgotadas = async () => {
    return await prisma.planta.findMany({
        where: { estoque: 0 },
        orderBy: { id: "asc" },
    });
};
