import type { AppState } from "@/lib/types";
import { stateToBackup, validateBackup, type BackupFile } from "@/lib/backup";
import { decryptJson, encryptJson } from "@/lib/crypto/vaultCrypto";
import { clearReceipts, getReceipt, putReceipt } from "@/lib/receiptStore";
import { supabase } from "@/lib/supabase/client";
import { getVaultKey } from "@/lib/vaultSession";

function requireSync(): { userIdReady: Promise<string>; key: CryptoKey } {
  if (!supabase) throw new Error("This copy of TaxTrack has no sync settings.");
  const key = getVaultKey();
  if (!key) throw new Error("Unlock the account before syncing.");
  const userIdReady = supabase.auth.getUser().then(({ data, error }) => {
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) throw new Error("Sign in before syncing.");
    return userId;
  });
  return { userIdReady, key };
}

function receiptIds(state: AppState): string[] {
  const ids: string[] = [];
  for (const year of Object.values(state.years)) {
    for (const expense of year.expenses) {
      if (expense.receiptId) ids.push(expense.receiptId);
    }
  }
  return ids;
}

export async function uploadDevice(state: AppState): Promise<void> {
  const { userIdReady, key } = requireSync();
  const userId = await userIdReady;
  const db = supabase!;
  const file = stateToBackup(state, new Date().toISOString());
  const payload = await encryptJson(key, file);
  const { error } = await db.from("encrypted_records").upsert({ user_id: userId, ciphertext: payload.ciphertext, iv: payload.iv });
  if (error) throw error;

  const ids = receiptIds(state);
  for (const id of ids) {
    const image = await getReceipt(id);
    if (!image) continue;
    const encrypted = await encryptJson(key, image);
    const { error: receiptError } = await db.from("encrypted_receipts").upsert({
      id,
      user_id: userId,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
    });
    if (receiptError) throw receiptError;
  }

  const { data: remote, error: listError } = await db.from("encrypted_receipts").select("id").eq("user_id", userId);
  if (listError) throw listError;
  const keep = new Set(ids);
  const stale = (remote ?? []).map((row) => String(row.id)).filter((id) => !keep.has(id));
  if (stale.length > 0) {
    const { error: deleteError } = await db.from("encrypted_receipts").delete().in("id", stale);
    if (deleteError) throw deleteError;
  }
}

export async function pullAccount(shouldContinue: () => boolean): Promise<BackupFile | null> {
  const { userIdReady, key } = requireSync();
  const userId = await userIdReady;
  if (!shouldContinue()) return null;
  const db = supabase!;
  const { data, error } = await db.from("encrypted_records").select("ciphertext, iv").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data?.ciphertext || !data.iv) return null;
  const parsed = await decryptJson<unknown>(key, { ciphertext: data.ciphertext, iv: data.iv });
  const validated = validateBackup(parsed);
  if (!validated.ok) throw new Error(validated.errors[0] ?? "The account copy could not be read.");

  const { data: receipts, error: receiptError } = await db.from("encrypted_receipts").select("id, ciphertext, iv").eq("user_id", userId);
  if (receiptError) throw receiptError;
  const files: { id: string; image: string }[] = [];
  for (const row of receipts ?? []) {
    if (!row.ciphertext || !row.iv) continue;
    const image = await decryptJson<unknown>(key, { ciphertext: row.ciphertext, iv: row.iv });
    if (typeof image === "string") files.push({ id: String(row.id), image });
  }
  if (!shouldContinue()) return null;
  await clearReceipts();
  for (const file of files) await putReceipt(file.id, file.image);
  return validated.data;
}
