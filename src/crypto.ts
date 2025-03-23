import { webcrypto } from "crypto";

// #############
// ### Utils ###
// #############

// Function to convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

// Function to convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  var buff = Buffer.from(base64, "base64");
  return buff.buffer.slice(buff.byteOffset, buff.byteOffset + buff.byteLength);
}

// ################
// ### RSA keys ###
// ################

// Generates a pair of private / public RSA keys
type GenerateRsaKeyPair = {
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
};
export async function generateRsaKeyPair(): Promise<GenerateRsaKeyPair> {
  const keyPair = await webcrypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey
  };
}

// Export public key to base64 string
export async function exportPubKey(key: webcrypto.CryptoKey): Promise<string> {
  const exported = await webcrypto.subtle.exportKey("spki", key);
  return arrayBufferToBase64(exported);
}

// Export private key to base64 string 
export async function exportPrvKey(key: webcrypto.CryptoKey | null): Promise<string | null> {
  if (!key) return null;
  const exported = await webcrypto.subtle.exportKey("pkcs8", key);
  return arrayBufferToBase64(exported);
}

// Import public key from base64 string
export async function importPubKey(strKey: string): Promise<webcrypto.CryptoKey> {
  const keyData = base64ToArrayBuffer(strKey);
  return await webcrypto.subtle.importKey(
    "spki",
    keyData,
    {
      name: "RSA-OAEP",
      hash: "SHA-256"
    },
    true,
    ["encrypt"]
  );
}

// Import private key from base64 string
export async function importPrvKey(strKey: string): Promise<webcrypto.CryptoKey> {
  const keyData = base64ToArrayBuffer(strKey);
  return await webcrypto.subtle.importKey(
    "pkcs8",
    keyData,
    {
      name: "RSA-OAEP", 
      hash: "SHA-256"
    },
    true,
    ["decrypt"]
  );
}

// Encrypt a message using an RSA public key
export async function rsaEncrypt(b64Data: string, strPublicKey: string): Promise<string> {
  const data = base64ToArrayBuffer(b64Data);
  const pubKey = await importPubKey(strPublicKey);
  const encrypted = await webcrypto.subtle.encrypt(
    {
      name: "RSA-OAEP"
    },
    pubKey,
    data
  );
  return arrayBufferToBase64(encrypted);
}

// Decrypts a message using an RSA private key
export async function rsaDecrypt(data: string, privateKey: webcrypto.CryptoKey): Promise<string> {
  const encrypted = base64ToArrayBuffer(data);
  const decrypted = await webcrypto.subtle.decrypt(
    {
      name: "RSA-OAEP"
    },
    privateKey,
    encrypted
  );
  return arrayBufferToBase64(decrypted);
}

// ######################
// ### Symmetric keys ###
// ######################

// Generates a random symmetric key
export async function createRandomSymmetricKey(): Promise<webcrypto.CryptoKey> {
  return await webcrypto.subtle.generateKey(
    {
      name: "AES-CBC",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Export symmetric key to base64 string
export async function exportSymKey(key: webcrypto.CryptoKey): Promise<string> {
  const exported = await webcrypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(exported);
}

// Import symmetric key from base64 string
export async function importSymKey(strKey: string): Promise<webcrypto.CryptoKey> {
  const keyData = base64ToArrayBuffer(strKey);
  return await webcrypto.subtle.importKey(
    "raw",
    keyData,
    {
      name: "AES-CBC",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Encrypt with AES-CBC
export async function symEncrypt(key: webcrypto.CryptoKey, data: string): Promise<string> {
  const iv = webcrypto.getRandomValues(new Uint8Array(16));
  const encoded = new TextEncoder().encode(data);
  
  const encrypted = await webcrypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv
    },
    key,
    encoded
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return arrayBufferToBase64(combined);
}

// Decrypt with AES-CBC
export async function symDecrypt(strKey: string, encryptedData: string): Promise<string> {
  const key = await importSymKey(strKey);
  const data = base64ToArrayBuffer(encryptedData);
  
  const iv = data.slice(0, 16);
  const encrypted = data.slice(16);

  const decrypted = await webcrypto.subtle.decrypt(
    {
      name: "AES-CBC",
      iv
    },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}
