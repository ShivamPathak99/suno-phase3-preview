import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

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

/**
 * Applies the F1.2 session cap after validating the Supabase session. API
 * tenancy moves to user-scoped database clients in P3-T5; this guard only
 * establishes an authenticated caller and blocks unauthenticated HTTP traffic
 * from reaching an OpenAI call.
 */
export async function guardOpenAiRoute() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "Signed out — sign back in before continuing." },
        { status: 401 },
      );
    }

    const decision = openAiSessionRateLimiter.consume(user.id);

    if (!decision.allowed) {
      return NextResponse.json(
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
      );
    }

    return null;
  } catch (error) {
    console.error("OpenAI route session check failed.", error);
    return NextResponse.json(
      { error: "Signed out — sign back in before continuing." },
      { status: 401 },
    );
  }
}
