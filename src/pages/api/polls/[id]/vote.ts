import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { votes, options } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getClientIp } from "@/lib/fingerprint";

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { id: pollId } = params;
    const body = await request.json();
    const { optionId, visitorId } = body;

    if (!pollId) {
      return new Response(JSON.stringify({ error: "Poll ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!optionId) {
      return new Response(JSON.stringify({ error: "Option ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!visitorId || typeof visitorId !== "string") {
      return new Response(JSON.stringify({ error: "Visitor ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get client IP
    const ipAddress = getClientIp(request);

    // Anti-abuse mechanism 1: Check if this visitor has already voted
    const existingVoteByVisitor = await db.query.votes.findFirst({
      where: and(eq(votes.pollId, pollId), eq(votes.visitorId, visitorId)),
    });

    if (existingVoteByVisitor) {
      return new Response(
        JSON.stringify({ error: "You have already voted on this poll" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    // Anti-abuse mechanism 2: Check if this IP has already voted
    const existingVoteByIp = await db.query.votes.findFirst({
      where: and(eq(votes.pollId, pollId), eq(votes.ipAddress, ipAddress)),
    });

    if (existingVoteByIp) {
      return new Response(
        JSON.stringify({
          error: "This IP address has already voted on this poll",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    // Verify the option belongs to this poll
    const option = await db.query.options.findFirst({
      where: eq(options.id, optionId),
    });

    if (!option || option.pollId !== pollId) {
      return new Response(JSON.stringify({ error: "Invalid option" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Record the vote
    await db.insert(votes).values({
      pollId,
      optionId,
      visitorId,
      ipAddress,
    });

    return new Response(
      JSON.stringify({ message: "Vote recorded successfully" }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error recording vote:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
