import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Returns the logged-in user record, or null if not signed in. */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}