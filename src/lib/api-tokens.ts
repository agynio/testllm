import { createHash, randomBytes } from "crypto";

const PERSONAL_PREFIX = "tlp_";
const ORG_PREFIX = "tlo_";
const PREFIX_DISPLAY_LENGTH = 8;

type TokenType = "personal" | "org";

interface GeneratedToken {
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
}

export function generateToken(type: TokenType): GeneratedToken {
  const prefix = type === "personal" ? PERSONAL_PREFIX : ORG_PREFIX;
  const rawToken = prefix + randomBytes(16).toString("hex");

  return {
    rawToken,
    tokenHash: hashTokenRaw(rawToken),
    tokenPrefix: rawToken.slice(0, PREFIX_DISPLAY_LENGTH),
  };
}

export function hashTokenRaw(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
