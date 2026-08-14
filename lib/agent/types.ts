import type { z } from "zod";

// ── The uniform Tool interface ───────────────────────────────────────────────
// Every capability the agent has is a Tool with the same shape. The agent is
// handed an ARRAY of these and doesn't care what's inside any of them — a tool's
// run() might query Postgres today, call a vector DB (RAG) tomorrow, or hit an
// external API later. That uniformity is what makes "the user can ask anything"
// achievable: you add capabilities by adding tools, never by rewriting the agent.
//
// This is exactly the tool-use pattern the agent orchestration world (and the
// SAP JD) is built on.

export type ToolContext = {
  userId: string; // every tool is automatically scoped to the current user
};

// A tool declares: a name, a description the MODEL reads to decide when to use
// it, a zod schema for its inputs, and a run() that returns plain JSON-able data.
export type Tool<TInput = unknown> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  run: (input: TInput, ctx: ToolContext) => Promise<unknown>;
};

// Helper so each tool file can export a strongly-typed tool with inference.
export function defineTool<TInput>(t: Tool<TInput>): Tool<TInput> {
  return t;
}