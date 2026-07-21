"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

/** Browser auth client; the anon key is safe to expose and RLS scopes its data. */
export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { supabaseAnonKey, supabaseUrl } = getSupabasePublicConfig();
  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
