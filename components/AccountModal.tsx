"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import {
  accountError,
  fetchVaultProfileKeys,
  finishPasswordReset,
  sendPasswordReset,
  signInAccount,
  signOutAccount,
  signUpAccount,
} from "@/lib/account";
import { unlockVaultWithPassword } from "@/lib/crypto/vaultCrypto";
import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import { downloadDevice, uploadDevice } from "@/lib/syncRecords";
import { clearPasswordRecovery, getVaultKey, passwordRecoveryPending, setVaultKey, subscribeVault } from "@/lib/vaultSession";
import type { AppState } from "@/lib/types";
import type { BackupFile } from "@/lib/backup";
import { buttonClass, Field, inputClass, Modal } from "@/components/ui";

type Mode = "signin" | "signup" | "forgot";

export function AccountModal({
  state,
  onClose,
  onReplace,
}: {
  state: AppState;
  onClose: () => void;
  onReplace: (file: BackupFile) => void;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmUpload, setConfirmUpload] = useState(false);
  const [confirmDownload, setConfirmDownload] = useState(false);

  useEffect(() => {
    setUnlocked(getVaultKey() !== null);
    setResetting(passwordRecoveryPending());
    return subscribeVault(() => {
      setUnlocked(getVaultKey() !== null);
      setResetting(passwordRecoveryPending());
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSessionEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    if (mode !== "forgot" && password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "forgot") {
        await sendPasswordReset(email);
        setNotice("Check your email for the reset link. It opens TaxTrack so you can set a new password with your recovery key.");
        return;
      }
      if (mode === "signup") {
        const result = await signUpAccount(email, password);
        if (result.confirmEmail) {
          setNotice("Check your email and confirm the account, then sign in. TaxTrack shows the recovery key on that first sign-in.");
          setMode("signin");
          return;
        }
        setRecoveryKey(result.recoveryKey);
        setPassword("");
        return;
      }
      const shown = await signInAccount(email, password);
      setPassword("");
      if (shown) setRecoveryKey(shown);
    } catch (caught) {
      setError(accountError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    setError(null);
    if (!supabase || password.length < 8) {
      setError("Enter the password for this account.");
      return;
    }
    setBusy(true);
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = data.user?.id;
      if (!userId) throw new Error("Sign in again.");
      const profile = await fetchVaultProfileKeys(userId);
      if (!profile.passwordWrappedKey || !profile.encryptionSalt) throw new Error("This account has no vault yet. Sign in again from the email screen.");
      setVaultKey(await unlockVaultWithPassword(password, profile.encryptionSalt, profile.passwordWrappedKey));
      setPassword("");
    } catch (caught) {
      setError(accountError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await finishPasswordReset(password, recoveryInput);
      clearPasswordRecovery();
      setPassword("");
      setConfirm("");
      setRecoveryInput("");
      setNotice("Password updated. This device is unlocked.");
    } catch (caught) {
      setError(accountError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    setBusy(true);
    setError(null);
    try {
      await uploadDevice(state);
      setConfirmUpload(false);
      setNotice("Uploaded. The synced copy is encrypted text. TaxTrack cannot read it on the server.");
    } catch (caught) {
      setError(accountError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setError(null);
    try {
      onReplace(await downloadDevice());
      setConfirmDownload(false);
      setNotice("This device now matches the synced copy.");
    } catch (caught) {
      setError(accountError(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!supabaseConfigured) {
    return (
      <Modal title="Account" onClose={onClose}>
        <p className="text-sm leading-6 text-fog">Sync is not set up on this copy of TaxTrack.</p>
      </Modal>
    );
  }

  if (recoveryKey) {
    return (
      <Modal title="Save your recovery key" onClose={savedKey ? onClose : () => undefined}>
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 text-gold" size={18} aria-hidden />
          <p className="text-sm leading-6 text-fog">
            This key is shown once. TaxTrack does not keep a readable copy. You need it if you reset the password. Store it somewhere you can still open.
          </p>
        </div>
        <p className="mt-4 break-all rounded-xl border border-line bg-ink px-3 py-3 font-mono text-sm">{recoveryKey}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass.ghost}
            onClick={() => void navigator.clipboard.writeText(recoveryKey)}
          >
            Copy
          </button>
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 size-4 accent-[var(--mint)]" checked={savedKey} onChange={(event) => setSavedKey(event.target.checked)} />
          <span>I have saved this recovery key.</span>
        </label>
        <button type="button" className={`${buttonClass.primary} mt-4`} disabled={!savedKey} onClick={onClose}>
          Continue
        </button>
      </Modal>
    );
  }

  if (resetting) {
    return (
      <Modal title="New password" onClose={onClose}>
        <p className="text-sm leading-6 text-fog">The reset link signed you in. Enter a new password and the recovery key from when the account was created.</p>
        <div className="mt-4 grid gap-3">
          <Field label="New password">
            <input className={inputClass} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Field label="Confirm password">
            <input className={inputClass} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </Field>
          <Field label="Recovery key">
            <input className={inputClass} autoComplete="off" value={recoveryInput} onChange={(event) => setRecoveryInput(event.target.value)} />
          </Field>
        </div>
        {error ? <p className="mt-3 text-sm text-rose">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-fog">{notice}</p> : null}
        <button type="button" className={`${buttonClass.primary} mt-4`} disabled={busy} onClick={() => void resetPassword()}>
          {busy ? "Saving" : "Save password"}
        </button>
      </Modal>
    );
  }

  if (sessionEmail && !unlocked) {
    return (
      <Modal title="Unlock" onClose={onClose}>
        <p className="text-sm leading-6 text-fog">Signed in as {sessionEmail}. Enter the password to decrypt records on this device. The password is not stored.</p>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void unlock();
          }}
        >
          <Field label="Password">
            <input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {error ? <p className="text-sm text-rose">{error}</p> : null}
          <button type="submit" className={buttonClass.primary} disabled={busy}>
            {busy ? "Unlocking" : "Unlock"}
          </button>
        </form>
        <button type="button" className={`${buttonClass.ghost} mt-3`} onClick={() => void signOutAccount()}>
          Sign out
        </button>
      </Modal>
    );
  }

  if (sessionEmail && unlocked) {
    return (
      <Modal title="Account" onClose={onClose}>
        <p className="text-sm leading-6 text-fog">
          Signed in as {sessionEmail}. Upload sends an encrypted copy of this device. Download replaces this device with that copy.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {confirmUpload ? (
            <button type="button" className={buttonClass.primary} disabled={busy} onClick={() => void upload()}>
              {busy ? "Uploading" : "Replace the synced copy"}
            </button>
          ) : (
            <button type="button" className={buttonClass.primary} onClick={() => setConfirmUpload(true)}>
              Upload this device
            </button>
          )}
          {confirmDownload ? (
            <button type="button" className={buttonClass.danger} disabled={busy} onClick={() => void download()}>
              {busy ? "Downloading" : "Replace this device"}
            </button>
          ) : (
            <button type="button" className={buttonClass.ghost} onClick={() => setConfirmDownload(true)}>
              Download to this device
            </button>
          )}
        </div>
        {error ? <p className="mt-3 text-sm text-rose">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-fog">{notice}</p> : null}
        <button type="button" className={`${buttonClass.ghost} mt-4`} onClick={() => void signOutAccount().then(onClose)}>
          Sign out
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="Account" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Account">
        {(
          [
            ["signin", "Sign in"],
            ["signup", "Create account"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            className={mode === value ? "rounded-lg border border-mint/60 bg-mint/10 px-2 py-2 text-sm font-semibold text-mint" : "rounded-lg border border-line px-2 py-2 text-sm font-semibold text-fog"}
            onClick={() => {
              setMode(value);
              setError(null);
              setNotice(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm leading-6 text-fog">
        An account is required. TaxTrack encrypts your records on this device. The server stores unreadable text.
      </p>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Email">
          <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        {mode === "forgot" ? null : (
          <Field label="Password">
            <input
              className={inputClass}
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
        )}
        {mode === "signup" ? (
          <Field label="Confirm password">
            <input className={inputClass} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </Field>
        ) : null}
        {error ? <p className="text-sm text-rose">{error}</p> : null}
        {notice ? <p className="text-sm text-fog">{notice}</p> : null}
        <button type="submit" className={buttonClass.primary} disabled={busy}>
          {busy ? "Working" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset email" : "Sign in"}
        </button>
      </form>
      {mode === "forgot" ? (
        <button type="button" className="mt-3 text-sm font-semibold text-mint" onClick={() => setMode("signin")}>
          Back to sign in
        </button>
      ) : (
        <button type="button" className="mt-3 text-sm font-semibold text-mint" onClick={() => { setMode("forgot"); setError(null); setNotice(null); }}>
          Forgot password
        </button>
      )}
    </Modal>
  );
}
