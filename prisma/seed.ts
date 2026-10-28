import { Luminosidade, Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const plantas: Prisma.PlantaCreateManyInput[] = [
    { nome: "Costela-de-adão", especie: "Monstera deliciosa", preco: 8990, estoque: 12, luminosidade: Luminosidade.MEIA_SOMBRA, petFriendly: false, regaACadaDias: 7 },
    { nome: "Samambaia", especie: "Nephrolepis exaltata", preco: 4590, estoque: 0, luminosidade: Luminosidade.SOMBRA, petFriendly: true, regaACadaDias: 2 },
    { nome: "Calathea", especie: "Goeppertia orbifolia", preco: 7490, estoque: 8, luminosidade: Luminosidade.MEIA_SOMBRA, petFriendly: true, regaACadaDias: 4 },
    { nome: "Jiboia", especie: "Epipremnum aureum", preco: 3990, estoque: 20, luminosidade: Luminosidade.MEIA_SOMBRA, petFriendly: false, regaACadaDias: 3 },
    { nome: "Espada-de-são-jorge", especie: "Dracaena trifasciata", preco: 5990, estoque: 15, luminosidade: Luminosidade.SOL_PLENO, petFriendly: false, regaACadaDias: 15 },
    { nome: "Zamioculca", especie: "Zamioculcas zamiifolia", preco: 6990, estoque: 6, luminosidade: Luminosidade.SOMBRA, petFriendly: false, regaACadaDias: 15 },
    { nome: "Lírio-da-paz", especie: "Spathiphyllum wallisii", preco: 5490, estoque: 0, luminosidade: Luminosidade.SOMBRA, petFriendly: false, regaACadaDias: 4 },
    { nome: "Peperômia", especie: "Peperomia obtusifolia", preco: 3490, estoque: 10, luminosidade: Luminosidade.MEIA_SOMBRA, petFriendly: true, regaACadaDias: 7 },
    { nome: "Echevéria", especie: "Echeveria elegans", preco: 2490, estoque: 25, luminosidade: Luminosidade.SOL_PLENO, petFriendly: true, regaACadaDias: 10 },
    { nome: "Alecrim", especie: "Salvia rosmarinus", preco: 1990, estoque: 30, luminosidade: Luminosidade.SOL_PLENO, petFriendly: true, regaACadaDias: 3 },
    { nome: "Maranta", especie: "Maranta leuconeura", preco: 4290, estoque: 9, luminosidade: Luminosidade.MEIA_SOMBRA, petFriendly: true, regaACadaDias: 3 },
    { nome: "Comigo-ninguém-pode", especie: "Dieffenbachia seguine", preco: 4490, estoque: 7, luminosidade: Luminosidade.MEIA_SOMBRA, petFriendly: false, regaACadaDias: 5 },
];

const main = async () => {
    const existentes = await prisma.planta.count();

    // Não mistura os exemplos com plantas que já estão no banco
    if (existentes > 0) {
        console.log(`O banco já tem ${existentes} planta(s): o seed não foi executado. Zere o banco antes, se quiser os exemplos.`);
        return;
    }

    const resultado = await prisma.planta.createMany({ data: plantas });

    console.log(`🌱 ${resultado.count} plantas de exemplo cadastradas.`);
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
