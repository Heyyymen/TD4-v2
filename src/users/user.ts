import bodyParser from "body-parser";
import express from "express";
import { REGISTRY_PORT, BASE_ONION_ROUTER_PORT, BASE_USER_PORT } from "../config";
import { createRandomSymmetricKey, exportSymKey, symEncrypt, exportPubKey, rsaEncrypt } from "../crypto";
import { GetNodeRegistryBody, Node } from "../registry/registry";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  // Variables pour stocker les messages
  let lastReceivedMessage: string | null = null;
  let lastSentMessage: string | null = null;
  let lastCircuit: number[] = [];

  // Implémentation de la route /status
  _user.get("/status", (req, res) => {
    res.send("live");
  });

  // Routes GET pour récupérer les derniers messages
  _user.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage || null });
  });

  _user.get("/getLastSentMessage", (req, res) => {
    res.json({ result: lastSentMessage || null });
  });

  _user.get("/getLastCircuit", (req, res) => {
    res.json({ result: lastCircuit });
  });

  // Route POST pour recevoir les messages
  _user.post("/message", (req, res) => {
    const { message } = req.body;
    lastReceivedMessage = message;
    res.send("success");
  });

  _user.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId } = req.body;
    
    // Get node registry
    const nodes: Node[] = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`)
      .then((res) => res.json())
      .then((json: any) => (json as GetNodeRegistryBody).nodes);
  
    // Create random circuit of 3 distinct nodes 
    const circuit: number[] = [];
    const usedIndexes = new Set<number>();
    while (circuit.length < 3) {
      const index = Math.floor(Math.random() * nodes.length);
      if (!usedIndexes.has(index)) {
        usedIndexes.add(index);
        circuit.push(nodes[index].nodeId);
      }
    }
    lastCircuit = circuit;

    // Create layers of encryption
    let finalMessage = message;
    let currentPort = BASE_USER_PORT + destinationUserId;
    
    // Create layers in reverse order - from exit node to entry node
    for (let i = circuit.length - 1; i >= 0; i--) {
      // Format destination with leading zeros
      const destination = currentPort.toString().padStart(10, '0');
      
      // Create and encode symmetric key
      const symKey = await createRandomSymmetricKey();
      const strSymKey = await exportSymKey(symKey);
      
      // Encrypt message+destination with symmetric key
      const combinedMessage = destination + finalMessage;
      const encryptedData = await symEncrypt(symKey, combinedMessage);
      
      // Get node's public key and encrypt symmetric key
      const node = nodes.find(n => n.nodeId === circuit[i])!;
      const encryptedKey = await rsaEncrypt(strSymKey, node.pubKey);
      
      // Combine encrypted key + encrypted message
      // RSA encrypted key is always 344 chars
      finalMessage = encryptedKey + encryptedData;
      
      // Set next destination port
      currentPort = BASE_ONION_ROUTER_PORT + circuit[i];
    }

    // Send to entry node
    await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + circuit[0]}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: finalMessage })
    });

    lastSentMessage = message;
    res.send("success");
  });

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(
      `User ${userId} is listening on port ${BASE_USER_PORT + userId}`
    );
  });

  return server;
}
