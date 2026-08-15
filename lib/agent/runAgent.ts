import { TOOLS, TOOL_BY_NAME } from "./tools";
import type { ToolContext } from "./types";
import {
  getProvider,
  callProvider,
  type ProviderId,
  type OAIMessage,
  type OAITool,
} from "./providers";

const MAX_STEPS = 6; // safety cap on tool-call loops

const SYSTEM = `You are a helpful assistant inside a job-application tracking app. You answer the user's questions about THEIR OWN applications, interviews, stages, and outcomes.

You have tools that read the user's real data. ALWAYS use the tools to get facts — never guess or invent company names, stages, dates, or outcomes. If the tools return nothing, say so plainly.

Guidelines:
- Be concise and direct. Answer the actual question.
- When listing stages or applications, use the real names/dates the tools return.
- If the user asks about a company they never applied to, say you don't see any application there.
- Never make up data. Grounded answers only.`;

// Tool schemas in OpenAI-compatible format (Groq & Gemini both use this).
const TOOL_PARAMS: Record<string, object> = {
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

function toolDefs(): OAITool[] {
  return TOOLS.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: TOOL_PARAMS[t.name] ?? { type: "object", properties: {} },
    },
  }));
}

export type AgentResult = {
  answer: string;
  toolsUsed: string[];
  provider: string; // which model provider answered (for transparency)
};

/**
 * Run the agent loop on a free provider (Groq or Gemini). The model can CALL
 * TOOLS in a loop to gather the user's real data before answering. Without tools
 * it could only guess; with them it answers grounded in facts.
 *
 * @param providerId "groq" | "gemini" — which free model to use. Falls back to
 *   whichever API key is configured.
 */
export async function runAgent(
  question: string,
  ctx: ToolContext,
  providerId?: ProviderId
): Promise<AgentResult> {
  const provider = getProvider(providerId);
  const tools = toolDefs();
  const messages: OAIMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: question },
  ];
  const toolsUsed: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await callProvider(provider, messages, tools);
    const choice = response.choices?.[0];
    const msg = choice?.message;

    // If the model wants to call tools, run them and feed results back.
    if (msg?.tool_calls && msg.tool_calls.length > 0) {
      // Push the assistant turn (with its tool calls) into the history.
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });

      for (const call of msg.tool_calls) {
        const name = call.function.name;
        toolsUsed.push(name);
        const tool = TOOL_BY_NAME[name];

        let resultData: unknown;
        if (!tool) {
          resultData = { error: `Unknown tool: ${name}` };
        } else {
          let args: unknown = {};
          try {
            args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          } catch {
            args = {};
          }
          const parsed = tool.inputSchema.safeParse(args);
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

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(resultData),
        });
      }
      continue; // let the model see the tool results and continue
    }

    // Otherwise it's a final answer.
    const answer = (msg?.content || "").trim();
    return {
      answer: answer || "I couldn't find an answer to that.",
      toolsUsed,
      provider: provider.label,
    };
  }

  return { answer: "That took too many steps — try asking something more specific.", toolsUsed, provider: provider.label };
}