"use client";

import { useEffect, useState } from "react";
import { DELETE_ACCOUNT_PHRASE, deleteAccountAndData } from "@/lib/deleteAccount";
import { supabase } from "@/lib/supabase/client";
import { buttonClass, Field, inputClass, Modal } from "@/components/ui";

export function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const ready = phrase.trim() === DELETE_ACCOUNT_PHRASE && password.length > 0 && !working;

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function remove() {
    if (!email || !ready) return;
    setWorking(true);
    setError(null);
    try {
      await deleteAccountAndData(email, password);
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The account could not be deleted.");
      setWorking(false);
    }
  }

  return (
    <Modal title="Delete account and data" onClose={working ? () => undefined : onClose}>
      <p className="text-sm leading-6 text-fog">
        This removes the sign-in, the encrypted records stored with the account, the receipt files, and the copy on this device. TaxTrack cannot bring any of it back.
      </p>
      <p className="mt-3 rounded-lg border border-rose/40 bg-rose/10 px-3 py-2 text-sm text-rose">
        A JSON backup is the only copy that would remain, if you already saved one. Signing up again starts empty.
      </p>
      {email ? <p className="mt-3 text-sm text-fog">Account: <span className="text-paper">{email}</span></p> : null}
      <div className="mt-4 space-y-3">
        <Field label="Type DELETE MY TAXTRACK" hint="Capitals, with the spaces.">
          <input
            className={`${inputClass} font-mono`}
            value={phrase}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setPhrase(event.target.value)}
          />
        </Field>
        <Field label="Password" required>
          <input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
      </div>
      {error ? <p className="mt-3 text-sm text-rose">{error}</p> : null}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={buttonClass.ghost} disabled={working} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={buttonClass.danger} disabled={!ready} onClick={() => void remove()}>
          {working ? "Deleting…" : "Delete account and data"}
        </button>
      </div>
    </Modal>
  );
}
