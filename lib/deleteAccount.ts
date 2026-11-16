import { supabase } from "@/lib/supabase/client";
import { clearReceipts } from "@/lib/receiptStore";
import { ACCOUNT_KEY, PENDING_KEY, STORAGE_KEY } from "@/lib/storage";
import { stopAccountSync } from "@/hooks/useTaxStore";
import { signOutAccount } from "@/lib/account";

export const DELETE_ACCOUNT_PHRASE = "DELETE MY TAXTRACK";

function missingFunction(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("delete_own_account") || lower.includes("could not find the function") || lower.includes("schema cache");
}

/** Removes the sign-in, the encrypted account records, and the copy on this device. */
export async function deleteAccountAndData(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error("This copy of TaxTrack has no account settings.");
  const { error: passwordError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (passwordError) throw new Error("That password is not right. Nothing was deleted.");

  stopAccountSync();
  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    if (missingFunction(error.message)) {
      throw new Error("Account deletion is not switched on yet. Run supabase/delete_own_account.sql once in the Supabase SQL editor, then try again.");
    }
    throw new Error("The account could not be deleted. Nothing else was changed.");
  }

  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(ACCOUNT_KEY);
  window.localStorage.removeItem(PENDING_KEY);
  window.localStorage.removeItem("daybook.v1");
  window.localStorage.removeItem("taxtrack.v1.corrupt");
  await clearReceipts();
  await signOutAccount();
}
