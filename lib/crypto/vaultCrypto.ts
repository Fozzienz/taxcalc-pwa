import { base64ToBytes, bytesToBase64 } from "@/lib/crypto/encoding";

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function view(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

export function generateSaltBase64(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
}

export async function deriveVaultKey(secret: string, saltBase64: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: view(base64ToBytes(saltBase64)), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function generateRandomVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: view(iv) }, key, view(new TextEncoder().encode(JSON.stringify(value))));
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

export async function decryptJson<T>(key: CryptoKey, payload: EncryptedPayload): Promise<T> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: view(base64ToBytes(payload.iv)) },
    key,
    view(base64ToBytes(payload.ciphertext)),
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

async function encryptRaw(key: CryptoKey, data: Uint8Array): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: view(iv) }, key, view(data));
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

async function decryptRaw(key: CryptoKey, payload: EncryptedPayload): Promise<Uint8Array> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: view(base64ToBytes(payload.iv)) },
    key,
    view(base64ToBytes(payload.ciphertext)),
  );
  return new Uint8Array(decrypted);
}

export function generateRecoveryKey(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `TAXTRACK-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 24)}`;
}

export function normalizeRecoveryKey(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

async function wrapVaultKey(vaultKey: CryptoKey, secret: string, saltBase64: string): Promise<string> {
  const wrappingKey = await deriveVaultKey(secret, saltBase64);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", vaultKey));
  return JSON.stringify(await encryptRaw(wrappingKey, raw));
}

async function unwrapVaultKey(wrappedJson: string, secret: string, saltBase64: string): Promise<CryptoKey> {
  const wrappingKey = await deriveVaultKey(secret, saltBase64);
  const raw = await decryptRaw(wrappingKey, JSON.parse(wrappedJson) as EncryptedPayload);
  return crypto.subtle.importKey("raw", view(raw), { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export interface VaultKeyBundle {
  encryptionSalt: string;
  recoverySalt: string;
  passwordWrappedKey: string;
  recoveryWrappedKey: string;
  recoveryKey: string;
  vaultKey: CryptoKey;
}

export async function createUserVaultBundle(password: string): Promise<VaultKeyBundle> {
  const encryptionSalt = generateSaltBase64();
  const recoverySalt = generateSaltBase64();
  const vaultKey = await generateRandomVaultKey();
  const recoveryKey = generateRecoveryKey();
  return {
    encryptionSalt,
    recoverySalt,
    passwordWrappedKey: await wrapVaultKey(vaultKey, password, encryptionSalt),
    recoveryWrappedKey: await wrapVaultKey(vaultKey, normalizeRecoveryKey(recoveryKey), recoverySalt),
    recoveryKey,
    vaultKey,
  };
}

export async function unlockVaultWithPassword(password: string, encryptionSalt: string, passwordWrappedKey: string): Promise<CryptoKey> {
  return unwrapVaultKey(passwordWrappedKey, password, encryptionSalt);
}

export async function unlockVaultWithRecoveryKey(recoveryKey: string, recoverySalt: string, recoveryWrappedKey: string): Promise<CryptoKey> {
  return unwrapVaultKey(recoveryWrappedKey, normalizeRecoveryKey(recoveryKey), recoverySalt);
}

export async function rewrapVaultForNewPassword(vaultKey: CryptoKey, newPassword: string, encryptionSalt: string): Promise<string> {
  return wrapVaultKey(vaultKey, newPassword, encryptionSalt);
}
