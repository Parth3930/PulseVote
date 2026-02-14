import type { APIRoute } from "astro";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { votes } from "@/lib/db/schema";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: "Poll ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Get visitor ID from query params
    const url = new URL(request.url);
    const visitorId = url.searchParams.get("visitorId");

    if (!visitorId) {
      return new Response(JSON.stringify({ error: "Visitor ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if this visitor has voted on this poll
    const result = await db
      .select({
        optionId: votes.optionId,
      })
      .from(votes)
      .where(and(eq(votes.pollId, id), eq(votes.visitorId, visitorId)))
      .limit(1);

    const hasVoted = result.length > 0;
    const optionId = hasVoted ? result[0].optionId : null;

    return new Response(
      JSON.stringify({
        hasVoted,
        optionId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error checking vote status:", error);
    return new Response(
      JSON.stringify({ error: "Failed to check vote status" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
