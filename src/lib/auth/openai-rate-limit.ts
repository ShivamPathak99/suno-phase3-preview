import { NextResponse } from "next/server";

import {
  isAuthenticationRequiredError,
  requireUserScopedSupabase,
  type UserScopedSupabaseClient,
} from "@/lib/supabase/user-scoped";

/**
 * F1.2: an open demo sandbox gets a soft per-session cap on the three
 * OpenAI-backed routes. Keeping it here makes the cost-control decision
 * visible and keeps request handlers free of inline threshold values.
 */
export const openAiSessionRateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 60 * 1000,
} as const;

export type SessionRateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type Clock = () => number;

/** In-memory is intentional: F1.2 specifies a soft rather than billing-grade cap. */
export class SessionRateLimiter {
  private readonly requestsBySession = new Map<string, number[]>();

  constructor(
    private readonly config = openAiSessionRateLimitConfig,
    private readonly now: Clock = Date.now,
  ) {}

  consume(sessionId: string): SessionRateLimitDecision {
    const now = this.now();
    const windowStart = now - this.config.windowMs;
    const activeRequests = (this.requestsBySession.get(sessionId) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );
    const oldestRequest = activeRequests[0];

    if (activeRequests.length >= this.config.maxRequests && oldestRequest !== undefined) {
      this.requestsBySession.set(sessionId, activeRequests);

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((oldestRequest + this.config.windowMs - now) / 1000)),
      };
    }

    activeRequests.push(now);
    this.requestsBySession.set(sessionId, activeRequests);

    return {
      allowed: true,
      remaining: this.config.maxRequests - activeRequests.length,
      retryAfterSeconds: 0,
    };
  }
}

const openAiSessionRateLimiter = new SessionRateLimiter();

export type OpenAiRouteGuard =
  | { response: NextResponse; supabase: null }
  | { response: null; supabase: UserScopedSupabaseClient };

/**
 * Applies the F1.2 session cap and returns the same RLS-scoped client that
 * the route must use for persistence. P3-T5 removes the service key from
 * normal user traffic entirely.
 */
export async function guardOpenAiRoute(): Promise<OpenAiRouteGuard> {
  try {
    const { supabase, user } = await requireUserScopedSupabase();
    const decision = openAiSessionRateLimiter.consume(user.id);

    if (!decision.allowed) {
      return {
        response: NextResponse.json(
          {
            error: "This session has reached its hourly demo limit. Please try again shortly.",
            retryAfterSeconds: decision.retryAfterSeconds,
          },
          {
            headers: {
              "Retry-After": String(decision.retryAfterSeconds),
            },
            status: 429,
          },
        ),
        supabase: null,
      };
    }

    return { response: null, supabase };
  } catch (error) {
    if (!isAuthenticationRequiredError(error)) {
      console.error("OpenAI route session check failed.", error);
    }

    return {
      response: NextResponse.json(
        { error: "Signed out — sign back in before continuing." },
        { status: 401 },
      ),
      supabase: null,
    };
  }
}
