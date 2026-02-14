import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { votes, polls } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { subscribeToVoteUpdates, getRedisClient } from "@/lib/redis-pubsub";

export const GET: APIRoute = async ({ params, request }) => {
  const { id: pollId } = params;

  if (!pollId) {
    return new Response("Poll ID is required", { status: 400 });
  }

  // Verify poll exists
  const poll = await db.query.polls.findFirst({
    where: eq(polls.id, pollId),
  });

  if (!poll) {
    return new Response("Poll not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const redisAvailable = getRedisClient() !== null;

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message with current vote counts
      try {
        const initialVoteCounts = await db
          .select({
            optionId: votes.optionId,
            count: count(),
          })
          .from(votes)
          .where(eq(votes.pollId, pollId))
          .groupBy(votes.optionId);

        const totalVotes = initialVoteCounts.reduce(
          (sum: number, vote) => sum + Number(vote.count),
          0,
        );

        const initialData = {
          type: "connected",
          pollId,
          voteCounts: initialVoteCounts.map((v) => ({
            optionId: String(v.optionId),
            count: Number(v.count),
          })),
          totalVotes,
          realtime: redisAvailable,
        };

        const data = `data: ${JSON.stringify(initialData)}\n\n`;
        controller.enqueue(encoder.encode(data));
      } catch (error) {
        console.error("Error getting initial vote counts:", error);
      }

      // If Redis is available, use pub/sub for instant updates
      if (redisAvailable) {
        let unsubscribe = () => {};

        try {
          // Subscribe to Redis channel for this poll
          unsubscribe = await subscribeToVoteUpdates(
            pollId,
            async (voteData) => {
              try {
                const updateData = {
                  type: "update",
                  pollId,
                  voteCounts: voteData.voteCounts,
                  totalVotes: voteData.totalVotes,
                };

                const data = `data: ${JSON.stringify(updateData)}\n\n`;
                controller.enqueue(encoder.encode(data));
              } catch (error) {
                console.error("Error sending SSE update:", error);
              }
            },
          );

          // Send message that realtime is active
          const realtimeData = `data: ${JSON.stringify({
            type: "realtime_active",
            pollId,
          })}\n\n`;
          controller.enqueue(encoder.encode(realtimeData));
        } catch (error) {
          console.error("Error setting up Redis subscription:", error);
          // Fallback to polling if Redis fails
        }

        // Cleanup on client disconnect
        request.signal.addEventListener("abort", () => {
          unsubscribe();
          try {
            controller.close();
          } catch (e) {
            // Already closed
          }
        });
      } else {
        // Fallback to polling if Redis is not configured
        let lastVoteState = new Map<string, number>();
        let intervalId: NodeJS.Timeout | null = null;
        let controllerClosed = false;

        intervalId = setInterval(async () => {
          if (controllerClosed) {
            if (intervalId) clearInterval(intervalId);
            return;
          }

          try {
            // Get current vote counts
            const voteCounts = await db
              .select({
                optionId: votes.optionId,
                count: count(),
              })
              .from(votes)
              .where(eq(votes.pollId, pollId))
              .groupBy(votes.optionId);

            const totalVotes = voteCounts.reduce(
              (sum: number, vote) => sum + Number(vote.count),
              0,
            );

            // Check if any vote counts have changed
            let hasChanged = false;
            const currentVoteState = new Map<string, number>();

            for (const vote of voteCounts) {
              const optionId = String(vote.optionId);
              const count = Number(vote.count);
              currentVoteState.set(optionId, count);

              const previousCount = lastVoteState.get(optionId) || 0;
              if (count !== previousCount) {
                hasChanged = true;
              }
            }

            if (currentVoteState.size !== lastVoteState.size) {
              hasChanged = true;
            }

            // Only send update if votes have changed
            if (hasChanged) {
              const updateData = {
                type: "update",
                pollId,
                voteCounts: voteCounts.map((v) => ({
                  optionId: String(v.optionId),
                  count: Number(v.count),
                })),
                totalVotes,
              };

              const data = `data: ${JSON.stringify(updateData)}\n\n`;
              try {
                controller.enqueue(encoder.encode(data));
                lastVoteState = currentVoteState;
              } catch (error) {
                if (intervalId) clearInterval(intervalId);
              }
            }
          } catch (error) {
            console.error("Error in polling stream:", error);
            if (intervalId) clearInterval(intervalId);
            if (!controllerClosed) {
              try {
                controller.close();
                controllerClosed = true;
              } catch (e) {
                // Already closed
              }
            }
          }
        }, 2000);

        // Send message that polling is active
        const pollingData = `data: ${JSON.stringify({
          type: "polling_active",
          pollId,
        })}\n\n`;
        controller.enqueue(encoder.encode(pollingData));

        // Cleanup on client disconnect
        request.signal.addEventListener("abort", () => {
          if (intervalId) clearInterval(intervalId);
          if (!controllerClosed) {
            try {
              controller.close();
              controllerClosed = true;
            } catch (e) {
              // Already closed
            }
          }
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};
