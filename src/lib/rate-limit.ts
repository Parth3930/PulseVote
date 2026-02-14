import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Redis client (fallback to in-memory if not configured)
let redis: Redis | null = null;
let ratelimit: Ratelimit | null = null;

try {
  // Only initialize if environment variables are provided
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    ratelimit = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
      analytics: true,
      prefix: "quickpoll:ratelimit",
    });
  }
} catch (error) {
  console.warn("Failed to initialize Upstash Redis, rate limiting disabled:", error);
}

/**
 * Check if a request should be rate limited based on identifier
 * @param identifier - Unique identifier (IP address, visitor ID, etc.)
 * @returns Object with { success: boolean, limit: number, remaining: number, reset: number }
 */
export async function checkRateLimit(identifier: string) {
  // If rate limiting is not configured, allow all requests
  if (!ratelimit) {
    return {
      success: true,
      limit: 10,
      remaining: 10,
      reset: Date.now() + 60000,
    };
  }

  try {
    const result = await ratelimit.limit(identifier);
    return result;
  } catch (error) {
    console.error("Rate limit check failed, allowing request:", error);
    // Fail open - allow request if rate limiting fails
    return {
      success: true,
      limit: 10,
      remaining: 10,
      reset: Date.now() + 60000,
    };
  }
}

/**
 * Check if a specific action (like voting) should be rate limited
 * More restrictive than general rate limiting
 * @param identifier - Unique identifier
 * @returns Object with { success: boolean, limit: number, remaining: number, reset: number }
 */
export async function checkVoteRateLimit(identifier: string) {
  // If rate limiting is not configured, allow all requests
  if (!ratelimit) {
    return {
      success: true,
      limit: 3,
      remaining: 3,
      reset: Date.now() + 60000,
    };
  }

  try {
    // Create a separate limiter for votes with stricter limits
    const voteLimiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(3, "10 m"), // 3 votes per 10 minutes
      analytics: true,
      prefix: "quickpoll:votes",
    });

    const result = await voteLimiter.limit(identifier);
    return result;
  } catch (error) {
    console.error("Vote rate limit check failed, allowing request:", error);
    // Fail open - allow request if rate limiting fails
    return {
      success: true,
      limit: 3,
      remaining: 3,
      reset: Date.now() + 600000,
    };
  }
}

export { redis, ratelimit };
