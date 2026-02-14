import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { votes, options, voteAttempts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getClientIp } from "@/lib/fingerprint";
import { checkVoteRateLimit } from "@/lib/rate-limit";

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { id: pollId } = params;
    const body = await request.json();
    const { optionId, visitorId } = body;

    // Validate UUID format for pollId
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!pollId || !uuidRegex.test(pollId)) {
      return new Response(JSON.stringify({ error: "Invalid poll ID format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!optionId || !uuidRegex.test(optionId)) {
      return new Response(
        JSON.stringify({ error: "Invalid option ID format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!visitorId || typeof visitorId !== "string") {
      return new Response(JSON.stringify({ error: "Visitor ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get client IP and user agent
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || null;

    // Anti-abuse mechanism 0: Rate limiting
    // Use both IP and visitor ID for rate limiting (if IP is available)
    const rateLimitIdentifier = ipAddress
      ? `${pollId}:${ipAddress}`
      : `${pollId}:${visitorId}`;
    const rateLimitResult = await checkVoteRateLimit(rateLimitIdentifier);

    if (!rateLimitResult.success) {
      // Track rate limit violation
      await db.insert(voteAttempts).values({
        pollId,
        visitorId,
        ipAddress,
        userAgent,
        attemptReason: "rate_limited",
      });

      return new Response(
        JSON.stringify({
          error: "Too many vote attempts. Please try again later.",
          retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": Math.ceil(
              (rateLimitResult.reset - Date.now()) / 1000,
            ).toString(),
          },
        },
      );
    }

    // Anti-abuse mechanism 1: Check if this visitor has already voted
    const existingVoteByVisitor = await db.query.votes.findFirst({
      where: and(eq(votes.pollId, pollId), eq(votes.visitorId, visitorId)),
    });

    if (existingVoteByVisitor) {
      // Track duplicate visitor attempt
      await db.insert(voteAttempts).values({
        pollId,
        visitorId,
        ipAddress,
        userAgent,
        attemptReason: "duplicate_visitor",
      });

      return new Response(
        JSON.stringify({ error: "You have already voted on this poll" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    // Anti-abuse mechanism 2: Check if this IP has already voted (only if IP is available)
    if (ipAddress) {
      const existingVoteByIp = await db.query.votes.findFirst({
        where: and(eq(votes.pollId, pollId), eq(votes.ipAddress, ipAddress)),
      });

      if (existingVoteByIp) {
        // Track duplicate IP attempt
        await db.insert(voteAttempts).values({
          pollId,
          visitorId,
          ipAddress,
          userAgent,
          attemptReason: "duplicate_ip",
        });

        return new Response(
          JSON.stringify({
            error: "This IP address has already voted on this poll",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
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
      userAgent,
    });

    // Track successful vote attempt
    await db.insert(voteAttempts).values({
      pollId,
      visitorId,
      ipAddress,
      userAgent,
      attemptReason: "success",
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
