import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, TOOL_BY_NAME } from "./tools";
import type { ToolContext } from "./types";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_STEPS = 6; // safety cap on tool-call loops

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  return client;
}

const SYSTEM = `You are a helpful assistant inside a job-application tracking app. You answer the user's questions about THEIR OWN applications, interviews, stages, and outcomes.

You have tools that read the user's real data. ALWAYS use the tools to get facts — never guess or invent company names, stages, dates, or outcomes. If the tools return nothing, say so plainly.

Guidelines:
- Be concise and direct. Answer the actual question.
- When listing stages or applications, use the real names/dates the tools return.
- If the user asks about a company they never applied to, say you don't see any application there.
- Never make up data. Grounded answers only.`;

// The Anthropic tool schemas. We write these as plain JSON (rather than pulling
// in a zod->json-schema converter) to keep dependencies lean — the tools are
// simple. Descriptions come from the tool definitions so they stay in sync.
const JSON_SCHEMAS: Record<string, Anthropic.Tool.InputSchema> = {
  find_applications: {
    type: "object",
    properties: {
      company: { type: "string", description: "Partial company name to filter by, case-insensitive. Omit to list all applications." },
    },
  },
  get_application_detail: {
    type: "object",
    properties: {
      applicationId: { type: "string", description: "The application id from find_applications (preferred)." },
      company: { type: "string", description: "Company name, if you don't have an id." },
    },
  },
};

function toolDefs(): Anthropic.Tool[] {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: JSON_SCHEMAS[t.name] ?? { type: "object", properties: {} },
  }));
}

export type AgentResult = {
  answer: string;
  toolsUsed: string[]; // which tools the agent called (nice for transparency/debug)
};

/**
 * Run the agent loop: send the question + tools to the model, and whenever the
 * model asks to call a tool, run it, feed the result back, and continue — until
 * the model produces a final text answer (or we hit MAX_STEPS).
 *
 * This is the essence of an "agent": a model that can CALL TOOLS in a loop to
 * gather what it needs before answering. Without tools it can only guess; with
 * them it reads real data and answers grounded in facts.
 */
export async function runAgent(question: string, ctx: ToolContext): Promise<AgentResult> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
  const toolsUsed: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      tools: toolDefs(),
      messages,
    });

    // If the model wants to use tools, run them and loop.
    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        toolsUsed.push(block.name);
        const tool = TOOL_BY_NAME[block.name];

        let resultData: unknown;
        if (!tool) {
          resultData = { error: `Unknown tool: ${block.name}` };
        } else {
          // Validate the model's input against the tool's schema before running.
          const parsed = tool.inputSchema.safeParse(block.input);
          if (!parsed.success) {
            resultData = { error: "Invalid tool input", detail: parsed.error.flatten() };
          } else {
            try {
              resultData = await tool.run(parsed.data, ctx);
            } catch (err) {
              resultData = { error: "Tool failed", detail: String(err) };
            }
          }
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(resultData),
        });
      }

      messages.push({ role: "user", content: toolResults });
      continue; // let the model see the results and decide next step
    }

    // Otherwise the model gave a final answer.
    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return { answer: answer || "I couldn't find an answer to that.", toolsUsed };
  }

  return { answer: "That took too many steps — try asking something more specific.", toolsUsed };
}