import { prisma } from "./prisma";
import { getItem } from "./repository";

const SUMMARY_PROMPT_VERSION = "manual-summary-v1";
const DEFAULT_SUMMARY_MODEL = "gpt-5";
const MAX_CONTEXT_LENGTH = 12000;

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

export function getAiConfig() {
  return {
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_SUMMARY_MODEL || DEFAULT_SUMMARY_MODEL,
  };
}

export async function generateSummaryForItem(itemId: string) {
  const item = await getItem(itemId);

  if (!item) {
    throw new Error("内容不存在。");
  }

  const config = getAiConfig();

  if (!config.configured) {
    throw new Error("未配置 OPENAI_API_KEY，无法生成摘要。");
  }

  const sourceText = buildSourceText({
    title: item.title,
    source: item.subscription.title,
    url: item.contentUrl,
    summary: item.summary,
    contentHtml: item.contentHtml,
  });

  if (!sourceText.trim()) {
    throw new Error("当前内容没有足够文本可用于摘要。");
  }

  const summaryText = await requestOpenAISummary(sourceText, config.model);

  return prisma.aiSummary.upsert({
    where: { itemId },
    update: {
      summaryText,
      model: config.model,
      promptVersion: SUMMARY_PROMPT_VERSION,
    },
    create: {
      itemId,
      summaryText,
      model: config.model,
      promptVersion: SUMMARY_PROMPT_VERSION,
    },
  });
}

function buildSourceText({
  title,
  source,
  url,
  summary,
  contentHtml,
}: {
  title: string;
  source: string;
  url: string;
  summary: string | null;
  contentHtml: string | null;
}) {
  const body = [summary, stripHtml(contentHtml)]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return [
    `Title: ${title}`,
    `Source: ${source}`,
    `URL: ${url}`,
    "",
    body || title,
  ]
    .join("\n")
    .slice(0, MAX_CONTEXT_LENGTH);
}

function stripHtml(value: string | null) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "";
}

async function requestOpenAISummary(input: string, model: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions:
        "You summarize RSS reader items for one person. Write in Chinese. Be concise, concrete, and useful. Return 3 bullet points and one short takeaway.",
      input,
      max_output_tokens: 500,
    }),
  });

  const json = (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(json.error?.message || "AI 摘要生成失败。");
  }

  const text = extractResponseText(json);

  if (!text) {
    throw new Error("AI 没有返回可用摘要。");
  }

  return text;
}

function extractResponseText(response: OpenAIResponse) {
  if (response.output_text?.trim()) {
    return response.output_text.trim();
  }

  return (
    response.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text || "")
      .join("\n")
      .trim() || ""
  );
}
