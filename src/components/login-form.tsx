"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSigningIn(true);

    try {
      const { error: signInError } = await createSupabaseBrowserClient().auth.signInWithPassword({
        email: email.trim(),
        password: new FormData(event.currentTarget).get("password") as string,
      });

      if (signInError) {
        setError("We couldn't sign you in. Check your email and password, then try again.");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("We couldn't sign you in. Check your email and password, then try again.");
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <form className="login-form" onSubmit={(event) => void signIn(event)}>
      <label>
        <span>Email</span>
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label>
        <span>Password</span>
        <input autoComplete="current-password" name="password" required type="password" />
      </label>
      {error ? <p className="login-error" role="alert">{error}</p> : null}
      <button className="primary-action login-submit" disabled={isSigningIn} type="submit">
        {isSigningIn ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
