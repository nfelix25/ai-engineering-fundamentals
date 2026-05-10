import type {
  AssistantModelMessage,
  AssistantContent,
  ModelMessage,
  ToolContent,
  ToolModelMessage,
  UserModelMessage,
} from "ai";
import { TestCase } from "./types";

export interface SeedData {
  userPrompt: string;
  assistantConfirmation: string;
  elements: unknown[];
}

export interface GoldenTestCase extends TestCase {
  seed?: SeedData;
  expectedKeywords?: string[];
  preservedIds?: string[];
}

function generateUserModelMessage(content: string): UserModelMessage {
  return {
    role: "user",
    content,
  };
}

function generateToolModelMessage(content: ToolContent): ToolModelMessage {
  return {
    role: "tool",
    content,
  };
}

function generateAssistantModelMessage(
  content: AssistantContent,
): AssistantModelMessage {
  return {
    role: "assistant",
    content,
  };
}

export function buildMessages(tc: GoldenTestCase): ModelMessage[] {
  if (!tc.seed) {
    return [generateUserModelMessage(tc.input)];
  }

  const callId = `seed_${tc.id}`;

  return [
    generateUserModelMessage(tc.seed.userPrompt),
    generateAssistantModelMessage([
      {
        type: "tool-call",
        toolCallId: callId,
        toolName: "generateDiagram",
        input: { elements: tc.seed.elements },
      },
    ]),
    generateToolModelMessage([
      {
        type: "tool-result",
        toolCallId: callId,
        toolName: "generateDiagram",
        output: {
          type: "json",
          value: { elements: tc.seed.elements as never },
        },
      },
    ]),
    generateAssistantModelMessage(tc.seed.assistantConfirmation),
    generateUserModelMessage(tc.input),
  ];
}
