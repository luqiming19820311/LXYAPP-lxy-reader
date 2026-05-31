import { readLocalSettings, updateLocalSettings } from "./local-settings.ts";

const DEFAULT_SUMMARY_MODEL = "gpt-5";

export type AiSettings = {
  apiKey: string;
  configured: boolean;
  model: string;
};

export type PublicAiSettings = {
  configured: boolean;
  model: string;
};

export async function getAiSettings(): Promise<AiSettings> {
  const stored = await readLocalSettings();
  const apiKey = (
    process.env.OPENAI_API_KEY ||
    stored.openaiApiKey ||
    ""
  ).trim();
  const model = (
    process.env.OPENAI_SUMMARY_MODEL ||
    stored.openaiSummaryModel ||
    DEFAULT_SUMMARY_MODEL
  ).trim();

  return {
    apiKey,
    configured: Boolean(apiKey),
    model: model || DEFAULT_SUMMARY_MODEL,
  };
}

export async function getPublicAiSettings(): Promise<PublicAiSettings> {
  const settings = await getAiSettings();

  return {
    configured: settings.configured,
    model: settings.model,
  };
}

export async function updateAiSettings(input: {
  openaiApiKey?: string;
  clearOpenaiApiKey?: boolean;
  openaiSummaryModel?: string;
}): Promise<PublicAiSettings> {
  const patch: {
    openaiApiKey?: string;
    openaiSummaryModel?: string;
  } = {};

  if (input.clearOpenaiApiKey) {
    patch.openaiApiKey = "";
  } else if (input.openaiApiKey !== undefined) {
    patch.openaiApiKey = input.openaiApiKey.trim();
  }

  if (input.openaiSummaryModel !== undefined) {
    patch.openaiSummaryModel =
      input.openaiSummaryModel.trim() || DEFAULT_SUMMARY_MODEL;
  }

  await updateLocalSettings(patch);

  return getPublicAiSettings();
}
