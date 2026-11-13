import type { z } from "zod";
import { CairnError } from "./errors";

/** MCP の tools/call の返り値のうち、配車さんが読む部分 */
export type ToolCallResult = {
  content?: unknown;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function firstText(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  for (const part of content) {
    if (
      part &&
      typeof part === "object" &&
      (part as { type?: unknown }).type === "text" &&
      typeof (part as { text?: unknown }).text === "string"
    ) {
      return (part as { text: string }).text;
    }
  }
  return undefined;
}

/**
 * ツールの返り値を検証して取り出す。
 * structuredContent があればそれを、無ければ最初の text を JSON として読む。
 * 形が合わなければ CairnError(invalid_response) を投げる（空の値で代替しない）。
 */
export function parseToolResult<S extends z.ZodType>(
  toolName: string,
  result: ToolCallResult,
  schema: S,
): z.infer<S> {
  if (result.isError) {
    const text = firstText(result.content) ?? "(詳細なし)";
    throw new CairnError("unavailable", `Cairn の ${toolName} がエラーを返しました: ${text}`);
  }

  let raw: unknown = result.structuredContent;
  if (raw === undefined) {
    const text = firstText(result.content);
    if (text === undefined) {
      throw new CairnError("invalid_response", `Cairn の ${toolName} の応答に本文がありません`);
    }
    try {
      raw = JSON.parse(text);
    } catch (cause) {
      throw new CairnError("invalid_response", `Cairn の ${toolName} の応答が JSON ではありません`, {
        cause,
      });
    }
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new CairnError(
      "invalid_response",
      `Cairn の ${toolName} の応答の形が想定と違います: ${parsed.error.message}`,
      { cause: parsed.error },
    );
  }
  return parsed.data;
}
