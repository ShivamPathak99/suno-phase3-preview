"use client";

import { type FormEvent, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ReauthenticateDialogProps = {
  onAuthenticated: () => void;
};

/** F1-E2 modal: authentication changes without navigating away from a recording. */
export function ReauthenticateDialog({ onAuthenticated }: ReauthenticateDialogProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  async function completeAuthentication(operation: () => Promise<{ error: { message: string } | null }>) {
    setError(null);
    setIsWorking(true);

    try {
      const { error: authenticationError } = await operation();

      if (authenticationError) {
        setError("We couldn't sign you in. Check the details and try again.");
        return;
      }

      onAuthenticated();
    } catch {
      setError("We couldn't sign you in. Check the details and try again.");
    } finally {
      setIsWorking(false);
    }
  }

  function signInTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get("password") as string;

    void completeAuthentication(() =>
      createSupabaseBrowserClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      }),
    );
  }

  return (
    <div aria-labelledby="reauthenticate-title" aria-modal="true" className="reauthenticate-backdrop" role="dialog">
      <section className="reauthenticate-dialog">
        <p className="reauthenticate-kicker">Recording kept safe</p>
        <h2 id="reauthenticate-title">Signed out</h2>
        <p>Sign back in, and Suno will continue with the recording already captured.</p>
        <form className="reauthenticate-form" onSubmit={signInTeacher}>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              disabled={isWorking}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>Password</span>
            <input autoComplete="current-password" disabled={isWorking} name="password" required type="password" />
          </label>
          <button className="primary-action" disabled={isWorking} type="submit">
            {isWorking ? "Signing in…" : "Sign in and continue"}
          </button>
        </form>
        <div className="reauthenticate-divider" role="presentation" />
        <button
          className="secondary-action reauthenticate-demo"
          disabled={isWorking}
          onClick={() => void completeAuthentication(() => createSupabaseBrowserClient().auth.signInAnonymously())}
          type="button"
        >
          Continue in demo classroom
        </button>
        {error ? <p className="reauthenticate-error" role="alert">{error}</p> : null}
      </section>
    </div>
  );
}
