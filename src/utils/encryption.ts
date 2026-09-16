import CryptoJS from "crypto-js";

// A fixed key for local storage obfuscation. 
// In a real-world scenario, you would derive this from a user password.
const LOCAL_STORAGE_SECRET = "mcp-chat-ext-local-secret-key-2024";

export function encryptData(data: string): string {
  if (!data) return data;
  return CryptoJS.AES.encrypt(data, LOCAL_STORAGE_SECRET).toString();
}

export function decryptData(cipherText: string): string {
  if (!cipherText) return cipherText;
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, LOCAL_STORAGE_SECRET);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || cipherText; // Fallback to raw if decryption fails (e.g., legacy unencrypted data)
  } catch (e) {
    console.error("Failed to decrypt data", e);
    return cipherText;
  }
}
