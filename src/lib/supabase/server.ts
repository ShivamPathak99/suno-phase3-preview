import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "./config";

/** Creates one request-scoped SSR client for server components and pages. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { supabaseAnonKey, supabaseUrl } = getSupabasePublicConfig();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot always write cookies. middleware.ts owns
          // session refreshes, so rendering remains safe in that situation.
        }
      },
    },
  });
}
