import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { votes, polls } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

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

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let controllerClosed = false;
  let intervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      const data = `data: ${JSON.stringify({ type: "connected", pollId })}\n\n`;
      controller.enqueue(encoder.encode(data));

      // Poll for updates every 2 seconds
      let lastVoteState = new Map<string, number>();

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
            (sum, v) => sum + Number(v.count),
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

          // Also check if total count changed (new options might have votes)
          if (currentVoteState.size !== lastVoteState.size) {
            hasChanged = true;
          }

          // Only send update if votes have changed
          if (hasChanged) {
            const updateData = {
              type: "update",
              pollId,
              voteCounts,
              totalVotes,
            };

            const data = `data: ${JSON.stringify(updateData)}\n\n`;
            try {
              controller.enqueue(encoder.encode(data));
              lastVoteState = currentVoteState;
            } catch (error) {
              // Controller already closed
              if (intervalId) clearInterval(intervalId);
            }
          }
        } catch (error) {
          console.error("Error in SSE stream:", error);
          if (intervalId) clearInterval(intervalId);
          if (!controllerClosed) {
            try {
              controller.close();
              controllerClosed = true;
            } catch (e) {
              // Already closed, ignore
            }
          }
        }
      }, 2000);

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        if (intervalId) clearInterval(intervalId);
        if (!controllerClosed) {
          try {
            controller.close();
            controllerClosed = true;
          } catch (e) {
            // Already closed, ignore
          }
        }
      });
    },

    cancel() {
      controllerClosed = true;
      if (intervalId) clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
};
