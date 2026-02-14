import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { polls, options } from "@/lib/db/schema";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { question, options: optionTexts, creatorId } = body;

    // Validation
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // creatorId is now required (not optional)
    if (!creatorId || typeof creatorId !== "string") {
      return new Response(
        JSON.stringify({
          error:
            "Creator ID is required. Please refresh the page and try again.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (question.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Question cannot be empty" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (question.length > 500) {
      return new Response(
        JSON.stringify({ error: "Question must be 500 characters or less" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!Array.isArray(optionTexts) || optionTexts.length < 2) {
      return new Response(
        JSON.stringify({ error: "At least 2 options are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (optionTexts.length > 10) {
      return new Response(
        JSON.stringify({ error: "Maximum 10 options allowed" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate each option
    const validOptions = optionTexts.filter(
      (opt: unknown) => typeof opt === "string" && opt.trim().length > 0,
    );

    if (validOptions.length < 2) {
      return new Response(
        JSON.stringify({ error: "At least 2 valid options are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Check for duplicate options
    const uniqueOptions = new Set(
      validOptions.map((o: string) => o.trim().toLowerCase()),
    );
    if (uniqueOptions.size !== validOptions.length) {
      return new Response(
        JSON.stringify({ error: "Duplicate options are not allowed" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate option lengths
    for (const option of validOptions) {
      if (option.length > 200) {
        return new Response(
          JSON.stringify({
            error: "Each option must be 200 characters or less",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // Create poll
    const [newPoll] = await db
      .insert(polls)
      .values({
        question: question.trim(),
        creatorId: creatorId.trim(),
      })
      .returning();

    // Create options
    const optionValues = validOptions.map((text: string, index: number) => ({
      pollId: newPoll.id,
      text: text.trim(),
      order: String(index),
    }));

    await db.insert(options).values(optionValues);

    // Return the created poll with shareable URL
    // Use PUBLIC_SITE_URL from environment if available (for Vercel deployment)
    // Otherwise fall back to request URL (for local development)
    let shareUrl: string;
    const publicSiteUrl = import.meta.env.PUBLIC_SITE_URL;

    if (publicSiteUrl && publicSiteUrl.trim().length > 0) {
      // Use environment variable for production
      const baseUrl = publicSiteUrl.trim();
      shareUrl = `${baseUrl}/poll/${newPoll.id}`;
    } else {
      // Fall back to request URL
      const url = new URL(request.url);
      shareUrl = `${url.protocol}//${url.host}/poll/${newPoll.id}`;
    }

    return new Response(
      JSON.stringify({
        pollId: newPoll.id,
        shareUrl,
        question: newPoll.question,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error creating poll:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
