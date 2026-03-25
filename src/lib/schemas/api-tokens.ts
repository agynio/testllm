import { z } from "zod";

export const CreatePersonalTokenSchema = z.object({
  name: z.string().min(1, { error: "name is required" }),
  expires_at: z.string().datetime({ offset: true }).optional(),
});

export const CreateOrgTokenSchema = z.object({
  name: z.string().min(1, { error: "name is required" }),
  role: z.enum(["admin", "member"]),
  expires_at: z.string().datetime({ offset: true }).optional(),
});
