import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          // identity + Gmail read access, in one consent
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline", // so we get a refresh token
          prompt: "consent",
        },
      },
    }),
  ],
  events: {
    // The Prisma adapter does NOT overwrite an existing Account's tokens on a
    // repeat sign-in — so a "reconnect" would run the consent flow but never
    // persist the fresh token. This forces the new access/refresh token onto
    // the Account row every time the user authenticates, which is what makes
    // the Reconnect Gmail flow actually work.
    async signIn({ user, account }) {
      if (!account || account.provider !== "google" || !user?.id) return;
      try {
        await prisma.account.updateMany({
          where: { userId: user.id, provider: "google" },
          data: {
            access_token: account.access_token,
            refresh_token: account.refresh_token ?? undefined,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          },
        });
      } catch (err) {
        console.error("Failed to persist refreshed Google token:", err);
      }
    },
  },
});