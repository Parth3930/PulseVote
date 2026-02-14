import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { polls, options, votes } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: "Poll ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get poll with options
    const pollData = await db.query.polls.findFirst({
      where: eq(polls.id, id),
      with: {
        options: {
          orderBy: (options, { asc }) => [asc(options.order)],
        },
      },
    });

    if (!pollData) {
      return new Response(JSON.stringify({ error: "Poll not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get vote counts for each option
    const voteCounts = await db
      .select({
        optionId: votes.optionId,
        count: count(),
      })
      .from(votes)
      .where(eq(votes.pollId, id))
      .groupBy(votes.optionId);

    // Create a map for easy lookup
    const voteMap = new Map(voteCounts.map((v) => [v.optionId, v.count]));

    // Add vote counts to options
    const optionsWithCounts = pollData.options.map((option) => ({
      ...option,
      voteCount: voteMap.get(option.id) || 0,
    }));

    // Calculate total votes
    const totalVotes = pollData.options.reduce(
      (sum, option) => sum + (voteMap.get(option.id) || 0),
      0,
    );

    return new Response(
      JSON.stringify({
        id: pollData.id,
        question: pollData.question,
        creatorId: (pollData as any).creatorId || null,
        createdAt: pollData.createdAt,
        options: optionsWithCounts,
        totalVotes,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error fetching poll:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
