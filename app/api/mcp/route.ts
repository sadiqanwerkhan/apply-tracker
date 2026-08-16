import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextRequest } from "next/server";
import { resolveMcpUser } from "@/lib/agent/mcpAuth";
import { TOOL_BY_NAME } from "@/lib/agent/tools";
import { findApplicationsShape, getApplicationDetailShape } from "@/lib/agent/schemas";

export const maxDuration = 60;

// ── MCP server ───────────────────────────────────────────────────────────────
// Exposes the SAME agent tools (lib/agent/tools) over the Model Context Protocol,
// so external MCP clients (e.g. Claude Desktop) can call them. The tool LOGIC is
// not duplicated — we look each tool up in TOOL_BY_NAME and call its run(). Add a
// tool to lib/agent/tools and it can be surfaced here by registering its shape.
//
// Stateless mode: we build a fresh server + transport per request (no session).
// This is the simplest correct pattern for a serverless route handler.

function buildServer(userId: string): McpServer {
  const server = new McpServer(
    { name: "apply-tracker", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Helper: run one of our existing tools, scoped to this user, and shape the
  // result as an MCP tool result (a text block containing the JSON).
  async function runOurTool(name: string, input: unknown) {
    const tool = TOOL_BY_NAME[name];
    if (!tool) return { content: [{ type: "text" as const, text: `Unknown tool: ${name}` }], isError: true };
    const parsed = tool.inputSchema.safeParse(input);
    if (!parsed.success) {
      return { content: [{ type: "text" as const, text: "Invalid input" }], isError: true };
    }
    const result = await tool.run(parsed.data, { userId });
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }

  server.registerTool(
    "find_applications",
    {
      description: TOOL_BY_NAME["find_applications"].description,
      inputSchema: findApplicationsShape,
    },
    async (args) => runOurTool("find_applications", args)
  );

  server.registerTool(
    "get_application_detail",
    {
      description: TOOL_BY_NAME["get_application_detail"].description,
      inputSchema: getApplicationDetailShape,
    },
    async (args) => runOurTool("get_application_detail", args)
  );

  return server;
}

async function handle(req: NextRequest): Promise<Response> {
  // Authenticate: map the bearer token to a user id. Reject if it doesn't resolve.
  const userId = await resolveMcpUser(req.headers.get("authorization"));
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const server = buildServer(userId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;