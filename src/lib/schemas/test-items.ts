import { z } from "zod";
import { ContentBlockSchema } from "@/lib/messages/schemas";

const InputMessageContentSchema = z.object({
  role: z.enum(["user", "system", "developer"]),
  content: z.string(),
  any_role: z.boolean().optional(),
  any_content: z.boolean().optional(),
  repeat: z.boolean().optional(),
});

const OutputMessageContentSchema = z.object({
  role: z.literal("assistant"),
  content: z.string(),
});

const FunctionCallContentSchema = z.object({
  call_id: z.string(),
  name: z.string(),
  arguments: z.string(),
});

const FunctionCallOutputContentSchema = z.object({
  call_id: z.string(),
  output: z.string(),
});

const MessageItemSchema = z.object({
  type: z.literal("message"),
  content: z.union([InputMessageContentSchema, OutputMessageContentSchema]),
});

const FunctionCallItemSchema = z.object({
  type: z.literal("function_call"),
  content: FunctionCallContentSchema,
});

const FunctionCallOutputItemSchema = z.object({
  type: z.literal("function_call_output"),
  content: FunctionCallOutputContentSchema,
});

const TestItemSchema = z.union([
  MessageItemSchema,
  FunctionCallItemSchema,
  FunctionCallOutputItemSchema,
]);

const AnthropicSystemContentSchema = z.union([
  z
    .object({ text: z.string(), any_content: z.boolean().optional() })
    .passthrough(),
  z
    .object({ blocks: z.array(ContentBlockSchema), any_content: z.boolean().optional() })
    .passthrough(),
]);

const AnthropicMessageContentSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([z.string(), z.array(ContentBlockSchema)]),
  any_content: z.boolean().optional(),
});

const AnthropicSystemItemSchema = z.object({
  type: z.literal("anthropic_system"),
  content: AnthropicSystemContentSchema,
});

const AnthropicMessageItemSchema = z.object({
  type: z.literal("anthropic_message"),
  content: AnthropicMessageContentSchema,
});

const AnthropicTestItemSchema = z.union([
  AnthropicSystemItemSchema,
  AnthropicMessageItemSchema,
]);

export const CreateTestSchema = z.object({
  name: z.string().min(1, { error: "name is required" }),
  description: z.string().optional(),
  items: z.array(TestItemSchema).min(1, { error: "items must not be empty" }),
});

export const UpdateTestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  items: z.array(TestItemSchema).min(1).optional(),
});

export const CreateAnthropicTestSchema = z.object({
  name: z.string().min(1, { error: "name is required" }),
  description: z.string().optional(),
  items: z
    .array(AnthropicTestItemSchema)
    .min(1, { error: "items must not be empty" }),
});

export const UpdateAnthropicTestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  items: z.array(AnthropicTestItemSchema).min(1).optional(),
});
