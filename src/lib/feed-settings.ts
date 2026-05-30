import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type FeedSettings = {
  rsshubBaseUrl: string;
  rsshubAccessCode: string;
  bilibiliCookie: string;
};

export type PublicFeedSettings = {
  rsshubBaseUrl: string;
  rsshubAccessCodeConfigured: boolean;
  bilibiliCookieConfigured: boolean;
};

const SETTINGS_FILE = join(process.cwd(), ".lxy-settings.json");
const DEFAULT_RSSHUB_BASE_URL = "https://rsshub.app";

export async function getFeedSettings(): Promise<FeedSettings> {
  const stored = await readStoredSettings();

  return {
    rsshubBaseUrl: normalizeBaseUrl(
      process.env.RSSHUB_BASE_URL || stored.rsshubBaseUrl || DEFAULT_RSSHUB_BASE_URL,
    ),
    rsshubAccessCode: process.env.RSSHUB_ACCESS_CODE || stored.rsshubAccessCode || "",
    bilibiliCookie: process.env.BILIBILI_COOKIE || stored.bilibiliCookie || "",
  };
}

export async function getPublicFeedSettings(): Promise<PublicFeedSettings> {
  const settings = await getFeedSettings();

  return {
    rsshubBaseUrl: settings.rsshubBaseUrl,
    rsshubAccessCodeConfigured: Boolean(settings.rsshubAccessCode.trim()),
    bilibiliCookieConfigured: Boolean(settings.bilibiliCookie.trim()),
  };
}

export async function updateFeedSettings(input: {
  rsshubBaseUrl?: string;
  rsshubAccessCode?: string;
  clearRsshubAccessCode?: boolean;
  bilibiliCookie?: string;
  clearBilibiliCookie?: boolean;
}) {
  const current = await getFeedSettings();
  const rsshubBaseUrl =
    input.rsshubBaseUrl === undefined
      ? current.rsshubBaseUrl
      : normalizeBaseUrl(input.rsshubBaseUrl);
  const bilibiliCookie = input.clearBilibiliCookie
    ? ""
    : input.bilibiliCookie === undefined
      ? current.bilibiliCookie
      : input.bilibiliCookie.trim();
  const rsshubAccessCode = input.clearRsshubAccessCode
    ? ""
    : input.rsshubAccessCode === undefined
      ? current.rsshubAccessCode
      : input.rsshubAccessCode.trim();

  await writeFile(
    SETTINGS_FILE,
    JSON.stringify({ rsshubBaseUrl, rsshubAccessCode, bilibiliCookie }, null, 2),
    "utf8",
  );

  return getPublicFeedSettings();
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return DEFAULT_RSSHUB_BASE_URL;
  }

  const url = new URL(trimmed);

  return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, "")}${url.search}`;
}

async function readStoredSettings(): Promise<Partial<FeedSettings>> {
  try {
    return JSON.parse(await readFile(SETTINGS_FILE, "utf8")) as Partial<FeedSettings>;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code?: string }).code;

      if (code === "ENOENT") {
        return {};
      }
    }

    throw error;
  }
}
