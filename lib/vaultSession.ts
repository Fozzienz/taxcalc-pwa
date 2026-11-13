let vaultKey: CryptoKey | null = null;
let passwordRecovery = false;
let recoveryHold = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getVaultKey(): CryptoKey | null {
  return vaultKey;
}

export function setVaultKey(key: CryptoKey | null) {
  vaultKey = key;
  emit();
}

export function subscribeVault(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markPasswordRecovery() {
  passwordRecovery = true;
  emit();
}

export function passwordRecoveryPending(): boolean {
  return passwordRecovery;
}

export function clearPasswordRecovery() {
  passwordRecovery = false;
  emit();
}

export function setRecoveryHold(hold: boolean) {
  recoveryHold = hold;
  emit();
}

export function recoveryHoldActive(): boolean {
  return recoveryHold;
}
