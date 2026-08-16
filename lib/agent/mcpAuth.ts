import { userIdForToken } from "./mcpToken";

// Resolve an incoming MCP request's Authorization header to a user id, by looking
// up the token's hash in the database. Returns null if the token is missing or
// unknown. This is the DB-backed (multi-user, scalable) replacement for the old
// single-token env approach — every user has their own token.
export async function resolveMcpUser(authHeader: string | null): Promise<string | null> {
  return userIdForToken(authHeader);
}