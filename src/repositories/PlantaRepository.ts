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
};

export const findAllPlantas = async (filtros: FiltrosPlanta = {}) => {
    return await prisma.planta.findMany({
        where: {
            luminosidade: filtros.luminosidade,
            petFriendly: filtros.petFriendly,
        },
        orderBy: { id: "asc" },
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
