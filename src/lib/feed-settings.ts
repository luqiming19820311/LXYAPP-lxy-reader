import { readLocalSettings, updateLocalSettings } from "./local-settings.ts";

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

const DEFAULT_RSSHUB_BASE_URL = "https://rsshub.app";

export async function getFeedSettings(): Promise<FeedSettings> {
  const stored = await readLocalSettings();

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

  await updateLocalSettings({ rsshubBaseUrl, rsshubAccessCode, bilibiliCookie });

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
