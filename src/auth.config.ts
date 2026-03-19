import type { NextAuthConfig } from "next-auth";

export default {
  providers: [
    {
      id: "oidc",
      name: "OIDC Provider",
      type: "oidc",
      issuer: process.env.OIDC_ISSUER!,
      clientId: process.env.OIDC_CLIENT_ID!,
      clientSecret: process.env.OIDC_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    },
  ],
} satisfies NextAuthConfig;
