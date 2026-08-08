import { handlers } from "@/auth";

// TEMPORARY: wrap the NextAuth handlers so the REAL error is printed to Vercel
// runtime logs instead of the generic "Configuration" page. Revert to the
// two-line version once the cause is found.
const { GET: rawGET, POST: rawPOST } = handlers;

export async function GET(req: Request) {
  try {
    return await rawGET(req);
  } catch (err) {
    console.error("AUTH_GET_ERROR:", err instanceof Error ? err.stack : err);
    throw err;
  }
}

export async function POST(req: Request) {
  try {
    return await rawPOST(req);
  } catch (err) {
    console.error("AUTH_POST_ERROR:", err instanceof Error ? err.stack : err);
    throw err;
  }
}
