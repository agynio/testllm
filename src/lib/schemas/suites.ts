import { z } from "zod";

export const CreateSuiteSchema = z.object({
  name: z.string().min(1, { error: "name is required" }),
  description: z.string().optional(),
  protocol: z.enum(["openai", "anthropic"]).optional(),
});

export const UpdateSuiteSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});
