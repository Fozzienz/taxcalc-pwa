import { supabase } from "@/lib/supabase/client";
import {
  createUserVaultBundle,
  rewrapVaultForNewPassword,
  unlockVaultWithPassword,
  unlockVaultWithRecoveryKey,
} from "@/lib/crypto/vaultCrypto";
import { setRecoveryHold, setVaultKey } from "@/lib/vaultSession";

export interface VaultProfileKeys {
  encryptionSalt: string | null;
  recoverySalt: string | null;
  passwordWrappedKey: string | null;
  recoveryWrappedKey: string | null;
}

function client() {
  if (!supabase) throw new Error("This copy of TaxTrack has no sync settings.");
  return supabase;
}

export function accountError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  const lower = message.toLowerCase();
  if (lower.includes("invalid login")) return "That email or password is not right. If you just created an account, open the confirmation email first.";
  if (lower.includes("reauthentication") || lower.includes("nonce")) return "Sign out, sign in again, then change the password. A session older than a day has to be fresh.";
  if (lower.includes("different from the old")) return "Choose a password that is different from the current one.";
  if (lower.includes("already registered") || lower.includes("already been registered")) return "That email already has an account. Sign in instead.";
  if (error instanceof DOMException && error.name === "OperationError") return "That password or recovery key does not open this account.";
  return message;
}

export async function fetchVaultProfileKeys(userId: string): Promise<VaultProfileKeys> {
  const { data, error } = await client().from("profiles").select("encryption_salt, recovery_salt, password_wrapped_key, recovery_wrapped_key").eq("id", userId).maybeSingle();
  if (error) throw error;
  return {
    encryptionSalt: data?.encryption_salt ?? null,
    recoverySalt: data?.recovery_salt ?? null,
    passwordWrappedKey: data?.password_wrapped_key ?? null,
    recoveryWrappedKey: data?.recovery_wrapped_key ?? null,
  };
}

async function saveVaultProfileKeys(
  userId: string,
  keys: { encryptionSalt: string; recoverySalt: string; passwordWrappedKey: string; recoveryWrappedKey: string },
) {
  const patch = {
    encryption_salt: keys.encryptionSalt,
    recovery_salt: keys.recoverySalt,
    password_wrapped_key: keys.passwordWrappedKey,
    recovery_wrapped_key: keys.recoveryWrappedKey,
  };
  const { data, error } = await client().from("profiles").update(patch).eq("id", userId).select("id").maybeSingle();
  if (error) throw error;
  if (data) return;
  const { error: insertError } = await client().from("profiles").insert({ id: userId, ...patch });
  if (insertError) throw insertError;
}

/** Creates the vault on the first sign-in. Returns the recovery key only that once. */
export async function openVault(userId: string, password: string): Promise<string | null> {
  const profile = await fetchVaultProfileKeys(userId);
  if (profile.passwordWrappedKey && profile.encryptionSalt) {
    setVaultKey(await unlockVaultWithPassword(password, profile.encryptionSalt, profile.passwordWrappedKey));
    return null;
  }
  const bundle = await createUserVaultBundle(password);
  await saveVaultProfileKeys(userId, bundle);
  setRecoveryHold(true);
  setVaultKey(bundle.vaultKey);
  return bundle.recoveryKey;
}

export async function signInAccount(email: string, password: string): Promise<string | null> {
  const { data, error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error("Sign-in did not return an account.");
  return openVault(userId, password);
}

export async function signUpAccount(email: string, password: string): Promise<{ recoveryKey: string | null; confirmEmail: boolean }> {
  const { data, error } = await client().auth.signUp({ email: email.trim(), password });
  if (error) throw error;
  if (!data.session || !data.user) return { recoveryKey: null, confirmEmail: true };
  return { recoveryKey: await openVault(data.user.id, password), confirmEmail: false };
}

/** Changes the sign-in password and re-wraps the vault. The recovery key stays the same. */
export async function changePassword(currentPassword: string, newPassword: string) {
  if (newPassword.length < 8) throw new Error("Use at least 8 characters.");
  if (currentPassword === newPassword) throw new Error("Choose a password that is different from the current one.");
  const { data, error } = await client().auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error("Sign in before changing the password.");
  const profile = await fetchVaultProfileKeys(userId);
  if (!profile.passwordWrappedKey || !profile.encryptionSalt) {
    throw new Error("This account has no vault yet. Sign in again from the email screen.");
  }
  let vaultKey: CryptoKey;
  try {
    vaultKey = await unlockVaultWithPassword(currentPassword, profile.encryptionSalt, profile.passwordWrappedKey);
  } catch (unwrapError) {
    if (unwrapError instanceof DOMException && unwrapError.name === "OperationError") {
      throw new Error("That current password does not open this account.");
    }
    throw unwrapError;
  }
  const passwordWrappedKey = await rewrapVaultForNewPassword(vaultKey, newPassword, profile.encryptionSalt);
  const { error: updateError } = await client().auth.updateUser({
    password: newPassword,
    current_password: currentPassword,
  });
  if (updateError) throw updateError;
  const { error: saveError } = await client().from("profiles").update({ password_wrapped_key: passwordWrappedKey }).eq("id", userId);
  if (saveError) {
    const { error: revertError } = await client().auth.updateUser({ password: currentPassword });
    if (revertError) {
      throw new Error("The sign-in password changed, but the records were not re-wrapped. Use Forgot password and the recovery key to finish.");
    }
    throw saveError;
  }
  setVaultKey(vaultKey);
}

export async function sendPasswordReset(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
  if (error) throw error;
}

export async function finishPasswordReset(newPassword: string, recoveryKey: string) {
  const { data, error } = await client().auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error("Open the reset link from your email, then set the new password.");
  const profile = await fetchVaultProfileKeys(userId);
  if (!profile.recoveryWrappedKey || !profile.recoverySalt || !profile.encryptionSalt) {
    throw new Error("This account has no recovery key yet. Sign in with the original password.");
  }
  const vaultKey = await unlockVaultWithRecoveryKey(recoveryKey, profile.recoverySalt, profile.recoveryWrappedKey);
  const passwordWrappedKey = await rewrapVaultForNewPassword(vaultKey, newPassword, profile.encryptionSalt);
  const { error: updateError } = await client().auth.updateUser({ password: newPassword });
  if (updateError) throw updateError;
  const { error: saveError } = await client().from("profiles").update({ password_wrapped_key: passwordWrappedKey }).eq("id", userId);
  if (saveError) throw saveError;
  setVaultKey(vaultKey);
}

export async function signOutAccount() {
  setRecoveryHold(false);
  setVaultKey(null);
  if (!supabase) return;
  await supabase.auth.signOut();
}
