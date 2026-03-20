import { z } from "zod";

export const CreateOrgSchema = z.object({
  name: z.string().min(1, { error: "name is required" }),
  slug: z
    .string()
    .min(1, { error: "slug is required" })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      error: "slug must be lowercase alphanumeric with hyphens",
    }),
});

export const UpdateOrgSchema = CreateOrgSchema.partial();
