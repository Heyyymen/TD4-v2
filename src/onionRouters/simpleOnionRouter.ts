import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT } from "../config";

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  // Variables pour stocker les messages et la destination
  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;

  // Implémentation de la route /status
  onionRouter.get("/status", (req, res) => {
    res.send("live");
  });

  // Route pour récupérer le dernier message crypté
  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({
      result: lastReceivedEncryptedMessage || null
    });
  });

  // Route pour récupérer le dernier message décrypté
  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({
      result: lastReceivedDecryptedMessage || null
    });
  });

  // Route pour récupérer la dernière destination
  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.json({
      result: lastMessageDestination || null
    });
  });

  // Fonction pour simuler la réception d'un message
  // Vous pouvez l'adapter pour simuler la réception de messages réels
  onionRouter.post("/receiveMessage", (req, res) => {
    const { encryptedMessage, decryptedMessage, destination } = req.body;

    // Mettre à jour les variables avec les nouvelles données
    lastReceivedEncryptedMessage = encryptedMessage;
    lastReceivedDecryptedMessage = decryptedMessage;
    lastMessageDestination = destination;

    res.send("Message reçu et mis à jour");
  });

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(
      `Onion router ${nodeId} is listening on port ${BASE_ONION_ROUTER_PORT + nodeId}`
    );
  });

  return server;
}
