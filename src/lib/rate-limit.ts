import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set",
  );
}

const redis = new Redis({ url, token });

export const coachRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 h"),
  analytics: false,
  prefix: "rl:coach",
});

export const foodScanRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 d"),
  analytics: false,
  prefix: "rl:food-scan",
});

export const fantasmaRateLimit = new Ratelimit({
  redis,
  // Generous safety window. The SAM-70 3-message trial / Pro gate lives
  // in /api/fantasma and this counter is consumed only after model success.
  limiter: Ratelimit.slidingWindow(120, "1 d"),
  analytics: false,
  prefix: "rl:fantasma",
});
