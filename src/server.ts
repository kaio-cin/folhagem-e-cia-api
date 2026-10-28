import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import routes from "./routes";

const app = express();

app.use(express.json());
app.use(routes);

// Qualquer rota que não existe cai aqui
app.use((req, res) => {
  res.status(404).json({ message: "Rota não encontrada" });
});

// Erros que acontecem antes dos controllers, como um JSON malformado no corpo.
// Sem este tratamento, o Express responderia com uma página HTML mostrando detalhes internos do servidor.
// O Express só reconhece um tratador de erros se ele tiver os 4 parâmetros, mesmo que o next não seja usado.
app.use((error: { type?: string }, req: Request, res: Response, next: NextFunction) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "JSON inválido: confira as aspas, as vírgulas e as chaves do corpo." });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "O corpo da requisição é grande demais." });
  }

  console.error(error);
  return res.status(500).json({ message: "Erro interno do servidor." });
});

const port = process.env.SERVER_PORT || 3001;

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
