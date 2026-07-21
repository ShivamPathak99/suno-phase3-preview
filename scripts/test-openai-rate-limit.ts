import assert from "node:assert/strict";

import {
  openAiSessionRateLimitConfig,
  SessionRateLimiter,
} from "../src/lib/auth/openai-rate-limit";

let now = 1_000_000;
const limiter = new SessionRateLimiter(openAiSessionRateLimitConfig, () => now);
const sessionId = "anonymous-demo-session";

for (let request = 0; request < openAiSessionRateLimitConfig.maxRequests; request += 1) {
  const decision = limiter.consume(sessionId);
  assert.equal(decision.allowed, true, `request ${request + 1} should be within the cap`);
  assert.equal(
    decision.remaining,
    openAiSessionRateLimitConfig.maxRequests - request - 1,
    "remaining count should descend deterministically",
  );
}

const blocked = limiter.consume(sessionId);
assert.equal(blocked.allowed, false);
assert.equal(blocked.remaining, 0);
assert.equal(blocked.retryAfterSeconds, openAiSessionRateLimitConfig.windowMs / 1000);

assert.equal(limiter.consume("second-session").allowed, true, "sessions must not share a cap");

now += openAiSessionRateLimitConfig.windowMs;
assert.equal(limiter.consume(sessionId).allowed, true, "the cap must reset after one full window");

console.log("P3-T4 rate-limit test passed: per-session OpenAI cap and window reset are deterministic.");
