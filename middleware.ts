import NextAuth from "next-auth";
import authConfig from "./src/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    return Response.json(
      {
        error: {
          message: "Unauthorized",
          type: "auth_error",
          code: "unauthorized",
        },
      },
      { status: 401 }
    );
  }
});

export const config = {
  matcher: ["/api/((?!auth/).*)"],
};
