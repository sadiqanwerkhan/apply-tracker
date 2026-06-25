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
});