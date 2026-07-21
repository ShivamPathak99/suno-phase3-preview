"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AccountLabel = {
  isDemo: boolean;
  label: string;
};

export function TeacherAccountMenu() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountLabel>({ isDemo: false, label: "Teacher" });

  useEffect(() => {
    let isMounted = true;

    void createSupabaseBrowserClient().auth.getUser().then((result: {
      data: { user: { email?: string | null; is_anonymous?: boolean } | null };
    }) => {
      if (!isMounted || !result.data.user) {
        return;
      }

      const user = result.data.user;

      setAccount({
        isDemo: user.is_anonymous === true,
        label: user.is_anonymous === true ? "Demo classroom" : user.email ?? "Teacher",
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <details className="teacher-account-menu">
      <summary className={account.isDemo ? "demo-account-chip" : "teacher-account-chip"}>
        <span aria-hidden="true" className="account-avatar">{account.isDemo ? "D" : "T"}</span>
        <span>{account.label}</span>
      </summary>
      <div className="teacher-account-popover">
        <p>{account.isDemo ? "Demo classroom" : "Signed in"}</p>
        <a className="quiet-action" href="/why">Why Suno works</a>
        <button className="quiet-action" onClick={() => void signOut()} type="button">
          {account.isDemo ? "Exit demo" : "Sign out"}
        </button>
      </div>
    </details>
  );
}
