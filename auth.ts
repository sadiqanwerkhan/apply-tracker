import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { encryptNullable } from "@/lib/crypto";

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
    //
    // SECURITY: tokens are encrypted at rest (AES-256-GCM) via lib/crypto.
    // The adapter's own initial write stores them in plaintext; this handler
    // immediately overwrites that row with the encrypted values, so a token is
    // only ever plaintext in the database for the instant between the two
    // writes in the same request. Everything that reads a token decrypts it.
    async signIn({ user, account }) {
      if (!account || account.provider !== "google" || !user?.id) return;
      try {
        await prisma.account.updateMany({
          where: { userId: user.id, provider: "google" },
          data: {
            access_token: encryptNullable(account.access_token),
            // only overwrite the refresh token when Google actually sent one
            ...(account.refresh_token
              ? { refresh_token: encryptNullable(account.refresh_token) }
              : {}),
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