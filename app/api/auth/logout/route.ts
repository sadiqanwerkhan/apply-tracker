import { NextRequest, NextResponse } from "next/server";
 
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete("gmail_tokens");
  return res;
}