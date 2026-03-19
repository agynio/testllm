import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { prisma } from "@/lib/prisma";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },

  callbacks: {
    async signIn({ profile }) {
      if (!profile?.sub) return false;

      await prisma.user.upsert({
        where: { oidcSubject: profile.sub },
        create: {
          oidcSubject: profile.sub,
          email: (profile.email as string) ?? "",
          name: (profile.name as string) ?? "",
        },
        update: {
          email: (profile.email as string) ?? "",
          name: (profile.name as string) ?? "",
        },
      });

      return true;
    },

    async jwt({ token, profile }) {
      if (profile?.sub) {
        const user = await prisma.user.findUniqueOrThrow({
          where: { oidcSubject: profile.sub },
          select: { id: true },
        });
        token.userId = user.id;
        token.oidcSubject = profile.sub;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
