import { Request, Response } from "express";
import * as PlantaRepository from "@repositories/PlantaRepository";
import { validarId, validarPlanta } from "../validators/PlantaValidator";

const ID_INVALIDO = "O id deve ser um número inteiro positivo.";
const PLANTA_NAO_ENCONTRADA = "Planta não encontrada.";

export const createPlanta = async (req: Request, res: Response) => {
  try {
    const erros = validarPlanta(req.body, false);

    // 400 Bad Request: algum campo faltou ou veio com valor inválido
    if (erros.length > 0) {
      return res.status(400).json({ message: "Dados inválidos.", erros: erros });
    }

    const { nome, especie, preco, estoque, luminosidade, petFriendly, regaACadaDias } = req.body;

    const planta = await PlantaRepository.createPlanta({
      nome: nome.trim(),
      especie: especie.trim(),
      preco: preco,
      estoque: estoque,
      luminosidade: luminosidade,
      petFriendly: petFriendly,
      regaACadaDias: regaACadaDias,
    });

    return res.status(201).json(planta);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao cadastrar planta." });
  }
};

export const readAllPlantas = async (req: Request, res: Response) => {
  try {
    const plantas = await PlantaRepository.findAllPlantas();

    return res.status(200).json(plantas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao buscar plantas." });
  }
};

export const readPlantaById = async (req: Request, res: Response) => {
  try {
    const id = validarId(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: ID_INVALIDO });
    }

    const planta = await PlantaRepository.findPlantaById(id);

    if (!planta) {
      return res.status(404).json({ message: PLANTA_NAO_ENCONTRADA });
    }

    return res.status(200).json(planta);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao buscar planta." });
  }
};

export const updatePlanta = async (req: Request, res: Response) => {
  try {
    const id = validarId(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: ID_INVALIDO });
    }

    const erros = validarPlanta(req.body, true);

    if (erros.length > 0) {
      return res.status(400).json({ message: "Dados inválidos.", erros: erros });
    }

    // Antes de editar, garantimos que a planta existe (senão o Prisma lançaria um erro que viraria 500)
    const planta = await PlantaRepository.findPlantaById(id);

    if (!planta) {
      return res.status(404).json({ message: PLANTA_NAO_ENCONTRADA });
    }

    const { nome, especie, preco, estoque, luminosidade, petFriendly, regaACadaDias } = req.body;

    // PATCH = atualização parcial: campos não enviados (undefined) não são alterados
    const plantaAtualizada = await PlantaRepository.updatePlanta(id, {
      nome: nome?.trim(),
      especie: especie?.trim(),
      preco: preco,
      estoque: estoque,
      luminosidade: luminosidade,
      petFriendly: petFriendly,
      regaACadaDias: regaACadaDias,
    });

    return res.status(200).json(plantaAtualizada);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao atualizar planta." });
  }
};

export const deletePlanta = async (req: Request, res: Response) => {
  try {
    const id = validarId(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: ID_INVALIDO });
    }

    const planta = await PlantaRepository.findPlantaById(id);

    if (!planta) {
      return res.status(404).json({ message: PLANTA_NAO_ENCONTRADA });
    }

    await PlantaRepository.deletePlanta(id);

    // 204 No Content: deu certo e não há nada para devolver
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao remover planta." });
  }
};
