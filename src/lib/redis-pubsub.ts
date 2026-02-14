import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

/**
 * Initialize Redis client for pub/sub
 */
export function getRedisClient(): Redis | null {
  if (redis) {
    return redis;
  }

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redis;
  }

  return null;
}

/**
 * Publish vote update to Redis channel
 * @param pollId - Poll ID
 * @param voteData - Vote update data
 */
export async function publishVoteUpdate(
  pollId: string,
  voteData: {
    totalVotes: number;
    voteCounts: Array<{ optionId: string; count: number }>;
  }
): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    return; // Redis not configured, skip pub/sub
  }

  try {
    const channel = `poll:${pollId}:votes`;
    await client.publish(channel, JSON.stringify(voteData));
  } catch (error) {
    console.error("Error publishing vote update:", error);
    // Don't throw - pub/sub failure shouldn't break voting
  }
}

/**
 * Subscribe to vote updates for a poll
 * @param pollId - Poll ID
 * @param callback - Callback function for updates
 * @returns Unsubscribe function
 */
export async function subscribeToVoteUpdates(
  pollId: string,
  callback: (data: {
    totalVotes: number;
    voteCounts: Array<{ optionId: string; count: number }>;
  }) => void
): Promise<() => void> {
  const client = getRedisClient();
  if (!client) {
    return () => {}; // Redis not configured, return no-op unsubscribe
  }

  const channel = `poll:${pollId}:votes`;

  try {
    // Create a subscription
    const subscription = await client.subscribe(channel, (message) => {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        console.error("Error parsing vote update message:", error);
      }
    });

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
    };
  } catch (error) {
    console.error("Error subscribing to vote updates:", error);
    return () => {}; // Return no-op if subscription fails
  }
}
