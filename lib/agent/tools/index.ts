import type { Tool } from "../types";
import { findApplications } from "./findApplications";
import { getApplicationDetail } from "./getApplicationDetail";

// The tool registry. The agent is handed THIS array and nothing else — to give
// the agent a new capability, build a tool and add it here. That's the entire
// extension model (and where a future RAG/transcript-search tool, a stats tool,
// etc. will slot in with zero changes to the agent or the UI).
export const TOOLS: Tool[] = [
  findApplications as Tool,
  getApplicationDetail as Tool,
];

// Quick lookup by name, used by the agent loop to dispatch a tool call.
export const TOOL_BY_NAME: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t])
);