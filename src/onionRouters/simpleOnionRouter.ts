import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import { webcrypto } from "crypto";
import { generateRsaKeyPair, exportPubKey, exportPrvKey, rsaDecrypt, symDecrypt } from "../crypto";

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;

  let privateKey: webcrypto.CryptoKey;
  let publicKey: webcrypto.CryptoKey;

  const initKeys = async () => {
    const keys = await generateRsaKeyPair();
    privateKey = keys.privateKey;
    publicKey = keys.publicKey;

    await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nodeId,
        pubKey: await exportPubKey(publicKey)
      })
    });
  };

  await initKeys();

  onionRouter.get("/status", (req, res) => {
    res.send("live");
  });

  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({
      result: lastReceivedEncryptedMessage || null
    });
  });

  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({
      result: lastReceivedDecryptedMessage || null
    });
  });

  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.json({
      result: lastMessageDestination || null
    });
  });

  onionRouter.get("/getPrivateKey", async (req, res) => {
    res.json({ result: await exportPrvKey(privateKey) });
  });

  onionRouter.post("/message", async (req, res) => {
    const { message } = req.body;
    lastReceivedEncryptedMessage = message;

    try {
      const encryptedKey = message.slice(0, 344);
      const ciphertext = message.slice(344);

      console.log('Encrypted Key:', encryptedKey);
      console.log('Ciphertext:', ciphertext);

      const symKey = await rsaDecrypt(encryptedKey, privateKey);
      console.log('Decrypted Symmetric Key:', symKey);

      const decryptedMessage = await symDecrypt(symKey, ciphertext);
      console.log('Decrypted Message:', decryptedMessage);

      lastReceivedDecryptedMessage = decryptedMessage;

      const destination = parseInt(decryptedMessage.slice(0, 10));
      const nextMessage = decryptedMessage.slice(10);
      lastMessageDestination = destination;

      console.log('Destination:', destination);
      console.log('Next Message:', nextMessage);

      await fetch(`http://localhost:${destination}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: nextMessage
        })
      });

      res.send("success");
    } catch (error) {
      console.error('Error processing message:', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  });

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(
      `Onion router ${nodeId} is listening on port ${BASE_ONION_ROUTER_PORT + nodeId}`
    );
  });

  return server;
}
