import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "./src/auth.config";

const { auth } = NextAuth(authConfig);

const VALID_PREFIXES = ["tlp_", "tlo_"] as const;
const PREFIX_TO_TYPE: Record<string, "personal" | "org"> = {
  tlp_: "personal",
  tlo_: "org",
};
const INTERNAL_HEADERS = ["x-token-hash", "x-token-type"] as const;

function extractBearerToken(
  request: Request
): { raw: string; type: "personal" | "org" } | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const raw = header.slice(7);
  if (raw.length === 0) return null;

  for (const prefix of VALID_PREFIXES) {
    if (raw.startsWith(prefix)) {
      return { raw, type: PREFIX_TO_TYPE[prefix] };
    }
  }
  return null;
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function stripInternalHeaders(source: Headers): Headers {
  const cleaned = new Headers(source);
  for (const header of INTERNAL_HEADERS) {
    cleaned.delete(header);
  }
  return cleaned;
}

export default auth(async (req) => {
  if (req.auth) {
    return NextResponse.next({
      request: { headers: stripInternalHeaders(req.headers) },
    });
  }

  const bearer = extractBearerToken(req);
  if (bearer) {
    const tokenHash = await sha256Hex(bearer.raw);
    const headers = stripInternalHeaders(req.headers);
    headers.set("x-token-hash", tokenHash);
    headers.set("x-token-type", bearer.type);

    return NextResponse.next({
      request: { headers },
    });
  }

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
});

export const config = {
  matcher: ["/api/((?!auth/).*)"],
};
