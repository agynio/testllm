import { z } from "zod";

const InputMessageContentSchema = z.object({
  role: z.enum(["user", "system", "developer"]),
  content: z.string(),
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
