"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function DemoLoginButton({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  async function startDemo() {
    setError(null);
    setIsStarting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { error: signInError } = session
        ? { error: null }
        : await supabase.auth.signInAnonymously();

      if (signInError) {
        setError("The demo classroom is unavailable right now. Please try again.");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("The demo classroom is unavailable right now. Please try again.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div>
      <button className="login-demo-action" disabled={isStarting} onClick={() => void startDemo()} type="button">
        <span>{isStarting ? "Opening the demo classroom…" : "Explore the demo classroom"}</span>
        <small>No account needed — a full sample class resets nightly.</small>
      </button>
      {error ? <p className="login-error" role="alert">{error}</p> : null}
    </div>
  );
}
