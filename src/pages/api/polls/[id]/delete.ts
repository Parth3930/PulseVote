import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { polls } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: "Poll ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get creatorId from request body
    const body = await request.json();
    const { creatorId } = body;

    if (!creatorId) {
      return new Response(JSON.stringify({ error: "Creator ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // First, check if the poll exists and get its creator
    const pollCheck = await db
      .select({ creatorId: polls.creatorId })
      .from(polls)
      .where(eq(polls.id, id))
      .limit(1);

    if (pollCheck.length === 0) {
      return new Response(JSON.stringify({ error: "Poll not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const poll = pollCheck[0];

    // Check if the user is the creator
    if (poll.creatorId !== creatorId) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to delete this poll" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Delete the poll (cascade will handle votes and options)
    await db.delete(polls).where(and(eq(polls.id, id), eq(polls.creatorId, creatorId)));

    return new Response(JSON.stringify({ message: "Poll deleted successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error deleting poll:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
