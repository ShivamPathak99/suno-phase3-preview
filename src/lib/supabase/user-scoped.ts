import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "./server";

export type UserScopedSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("An authenticated session is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export type UserScopedSupabase = {
  supabase: UserScopedSupabaseClient;
  user: User;
};

/**
 * F1.2/F1.3: browser requests use the caller's JWT, so database RLS is the
 * runtime tenancy boundary. The service role is deliberately not available
 * through this helper.
 */
export async function requireUserScopedSupabase(): Promise<UserScopedSupabase> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthenticationRequiredError();
  }

  return { supabase, user };
}

export function isAuthenticationRequiredError(error: unknown) {
  return error instanceof AuthenticationRequiredError;
}
