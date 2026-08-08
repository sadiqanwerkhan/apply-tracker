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
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  events: {
    // Encrypt the stored Google tokens at rest. This whole block is wrapped so
    // that NOTHING here — including token encryption — can ever break sign-in.
    // If encryption or the DB write fails, we log it and let the user in anyway;
    // the token just stays un-updated for that session.
    async signIn({ user, account }) {
      if (!account || account.provider !== "google" || !user?.id) return;
      try {
        let accessEnc: string | null = null;
        let refreshEnc: string | null | undefined = undefined;
        try {
          accessEnc = encryptNullable(account.access_token);
          if (account.refresh_token) refreshEnc = encryptNullable(account.refresh_token);
        } catch (encErr) {
          // TOKEN_ENC_KEY missing/invalid — do not block login over it.
          console.error("Token encryption skipped:", encErr);
          return;
        }
        await prisma.account.updateMany({
          where: { userId: user.id, provider: "google" },
          data: {
            access_token: accessEnc,
            ...(refreshEnc !== undefined ? { refresh_token: refreshEnc } : {}),
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          },
        });
      } catch (err) {
        console.error("Failed to persist Google token (non-fatal):", err);
      }
    },
  },
});