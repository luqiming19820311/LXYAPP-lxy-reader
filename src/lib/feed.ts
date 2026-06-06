import { createHash } from "node:crypto";
import Parser from "rss-parser";
import { getFeedSettings } from "./feed-settings.ts";

export type FeedPlatform = "youtube" | "bilibili" | "weibo" | "rss";
export type FeedMediaType = "video" | "article" | "status";

export type PreviewItem = {
  title: string;
  link: string;
  publishedAt: string | null;
};

export type FeedPreview = {
  title: string;
  platform: FeedPlatform;
  sourceType: string;
  inputUrl: string;
  feedUrl: string;
  siteUrl: string | null;
  domainKey: string;
  rsshubRoute: string | null;
  items: PreviewItem[];
  warning?: string;
};

export type NormalizedItem = {
  externalId: string;
  title: string;
  author: string | null;
  contentUrl: string;
  publishedAt: Date | null;
  summary: string | null;
  contentHtml: string | null;
  thumbnailUrl: string | null;
  mediaType: FeedMediaType;
  platform: FeedPlatform;
  embedUrl: string | null;
  rawPayload: string;
};

type ResolvedFeedInput = {
  inputUrl: string;
  feedUrl: string;
  rsshubRoute: string | null;
  platform: FeedPlatform;
  domainKey: string;
  siteUrl: string | null;
};

const parser = new Parser({
  customFields: {
    item: [
      ["media:thumbnail", "mediaThumbnail"],
      ["media:content", "mediaContent"],
      ["itunes:image", "itunesImage"],
    ],
  },
});

export const BILIBILI_RISK_CONTROL_MESSAGE =
  "Bilibili 返回风控拦截，当前匿名接口暂时无法抓取。请稍后重试，或配置可用的 RSSHub Base URL。";

type ParsedItem = Parser.Item & {
  author?: string;
  creator?: string;
  "content:encoded"?: string;
  mediaThumbnail?: { $?: { url?: string } } | Array<{ $?: { url?: string } }>;
  mediaContent?: { $?: { url?: string } } | Array<{ $?: { url?: string } }>;
  itunesImage?: { $?: { href?: string } };
};

type ParsedFeed = {
  title?: string;
  link?: string;
  items: ParsedItem[];
};

type RsshubJsonItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  date?: string;
  author?: string;
  creator?: string;
  description?: string;
  content?: string;
  content_html?: string;
  "content:encoded"?: string;
  enclosure?: {
    url?: string;
    type?: string;
  };
};

type RsshubJsonFeed = {
  title?: string;
  link?: string;
  items?: RsshubJsonItem[];
};

type BilibiliArchiveVideo = {
  bvid?: string;
  aid?: number;
  title?: string;
  description?: string;
  pic?: string;
  created?: number;
};

type BilibiliArchivePayload = {
  code?: number;
  message?: string;
  data?: {
    info?: {
      name?: string;
    };
    page?: {
      count?: number;
    };
    list?: {
      vlist?: BilibiliArchiveVideo[];
    };
  };
};

type BilibiliWbiPayload = {
  code?: number;
  message?: string;
  data?: {
    wbi_img?: {
      img_url?: string;
      sub_url?: string;
    };
  };
};

type BilibiliAppArchiveVideo = {
  bvid?: string;
  param?: string;
  title?: string;
  subtitle?: string;
  tname?: string;
  cover?: string;
  ctime?: number;
  author?: string;
};

type BilibiliAppArchivePayload = {
  code?: number;
  message?: string;
  data?: {
    count?: number;
    item?: BilibiliAppArchiveVideo[] | null;
  };
};

type BilibiliArchiveFeed = {
  mid: string;
  title: string;
  siteUrl: string;
  videos: BilibiliArchiveVideo[];
};

type YouTubePageVideo = {
  videoId: string;
  title: string;
  author: string | null;
  publishedText: string | null;
  thumbnailUrl: string | null;
};

const BILIBILI_APP_KEY = "1d8b6e7d45233436";
const BILIBILI_APP_SECRET = "560c52ccd288fed045859ed18bffd973";
const BILIBILI_APP_BUILD = "7420300";
const BILIBILI_APP_USER_AGENT =
  "Mozilla/5.0 BiliDroid/7.42.0 os/android model/Pixel mobi_app/android build/7420300";
const BILIBILI_ARCHIVE_PAGE_SIZE = 50;
const BILIBILI_ARCHIVE_MAX_PAGES = 200;
const YOUTUBE_TARGET_SUPPLEMENTAL_VIDEO_COUNT = 120;
const YOUTUBE_CONTINUATION_MAX_PAGES = 200;
const YOUTUBE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

const BILIBILI_WBI_MIXIN_KEY_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
];

export async function resolveFeedInput(inputUrl: string): Promise<ResolvedFeedInput> {
  const trimmed = inputUrl.trim();
  const { rsshubBaseUrl } = await getFeedSettings();

  if (!trimmed) {
    throw new Error("请输入 RSS、Atom、RSSHub URL 或 rsshub:// 链接。");
  }

  if (trimmed.startsWith("rsshub://")) {
    const route = `/${trimmed.slice("rsshub://".length).replace(/^\/+/, "")}`;

    const bilibiliMid = getBilibiliMidFromRoute(route);

    if (bilibiliMid) {
      if (isConfiguredRsshubBaseUrl(rsshubBaseUrl)) {
        return {
          inputUrl: trimmed,
          feedUrl: await buildRsshubFeedUrl(route),
          rsshubRoute: route,
          ...inferSource(route),
        };
      }

      return resolveBilibiliUserVideoInput(trimmed, bilibiliMid, route);
    }

    if (route.startsWith("/youtube/user/")) {
      const handle = decodeURIComponent(route.replace("/youtube/user/", ""));
      const channel = await resolveYouTubeChannel(handle);

      return {
        inputUrl: trimmed,
        feedUrl: buildYouTubeFeedUrl(channel.channelId),
        rsshubRoute: route,
        platform: "youtube" as const,
        domainKey: "youtube.com",
        siteUrl: channel.siteUrl,
      };
    }

    return {
      inputUrl: trimmed,
      feedUrl: await buildRsshubFeedUrl(route),
      rsshubRoute: route,
      ...inferSource(route),
    };
  }

  const customBilibiliMid = getBilibiliMidFromAdapterUrl(trimmed);

  if (customBilibiliMid) {
    return resolveBilibiliUserVideoInput(trimmed, customBilibiliMid, null);
  }

  const url = new URL(trimmed);
  const youtubeChannelId = getYouTubeChannelIdFromFeedUrl(trimmed);

  if (youtubeChannelId) {
    return {
      inputUrl: trimmed,
      feedUrl: trimmed,
      rsshubRoute: null,
      platform: "youtube" as const,
      domainKey: "youtube.com",
      siteUrl: `https://www.youtube.com/channel/${youtubeChannelId}`,
    };
  }

  const bilibiliSpaceMid = getBilibiliMidFromSpaceUrl(url);

  if (bilibiliSpaceMid) {
    return resolveBilibiliUserVideoInput(trimmed, bilibiliSpaceMid, null);
  }

  if (isYouTubeUrl(url)) {
    const channel = await resolveYouTubeChannel(trimmed);

    return {
      inputUrl: trimmed,
      feedUrl: buildYouTubeFeedUrl(channel.channelId),
      rsshubRoute: null,
      platform: "youtube" as const,
      domainKey: "youtube.com",
      siteUrl: channel.siteUrl,
    };
  }

  if (url.hostname.includes("rsshub")) {
    return {
      inputUrl: trimmed,
      feedUrl: trimmed,
      rsshubRoute: url.pathname,
      ...inferSource(url.pathname),
    };
  }

  return {
    inputUrl: trimmed,
    feedUrl: trimmed,
    rsshubRoute: null,
    ...inferSource(trimmed),
  };
}

export async function previewFeed(inputUrl: string): Promise<FeedPreview> {
  const resolved = await resolveFeedInput(inputUrl);

  if (resolved.platform === "bilibili" && isBilibiliAdapterUrl(resolved.feedUrl)) {
    const feed = await fetchBilibiliArchiveFeed(resolved.feedUrl, {
      maxPages: 1,
    }).catch((error) => {
      if (isBilibiliRiskControlError(error)) {
        return null;
      }

      throw error;
    });

    if (!feed) {
      const rsshubFeed = await parseConfiguredRsshubFeed(resolved).catch(() => null);

      if (rsshubFeed) {
        return buildParsedFeedPreview(resolved, rsshubFeed);
      }

      return buildBilibiliFallbackPreview(resolved);
    }

    return {
      title: feed.title,
      platform: resolved.platform,
      sourceType: "bilibili",
      inputUrl: resolved.inputUrl,
      feedUrl: resolved.feedUrl,
      siteUrl: feed.siteUrl,
      domainKey: resolved.domainKey,
      rsshubRoute: resolved.rsshubRoute,
      items: feed.videos.slice(0, 3).map((video) => ({
        title: video.title || "Untitled",
        link: buildBilibiliVideoUrl(video),
        publishedAt: video.created
          ? new Date(video.created * 1000).toISOString()
          : null,
      })),
    };
  }

  const feed = await parseFeedUrl(resolved.feedUrl);

  return buildParsedFeedPreview(resolved, feed);
}

export function isBilibiliRiskControlError(error: unknown) {
  const message = error instanceof Error ? error.message : `${error}`;

  return (
    message.includes("Bilibili API 返回 412") ||
    message.includes("错误码 -352") ||
    message.includes("错误码 -412") ||
    message.includes("风控校验失败") ||
    message.includes("request was banned")
  );
}

export async function fetchNormalizedItems(feedUrl: string) {
  const resolved = await resolveFeedInput(feedUrl);

  if (resolved.platform === "bilibili" && isBilibiliAdapterUrl(resolved.feedUrl)) {
    let riskControlError: unknown = null;
    const feed = await fetchBilibiliArchiveFeed(resolved.feedUrl).catch(
      async (error) => {
        if (isBilibiliRiskControlError(error)) {
          riskControlError = error;
          return null;
        }

        throw error;
      },
    );

    if (feed) {
      return feed.videos.map((video) => normalizeBilibiliArchiveVideo(video, feed));
    }

    const rsshubFeed = await parseConfiguredRsshubFeed(resolved).catch(() => {
      throw riskControlError;
    });

    return rsshubFeed.items.map((item) =>
      normalizeItem(item as ParsedItem, resolved.platform, getMediaType(resolved.platform)),
    );
  }

  const feed = await parseFeedUrl(resolved.feedUrl);
  const platform = resolved.platform;
  const mediaType = getMediaType(platform);
  const normalizedItems = feed.items.map((item) =>
    normalizeItem(item as ParsedItem, platform, mediaType),
  );

  if (platform === "youtube") {
    const channelId = getYouTubeChannelIdFromFeedUrl(resolved.feedUrl);

    if (channelId) {
      const pageVideos = await fetchYouTubeChannelVideos(channelId).catch(() => []);
      return mergeYouTubeItems(
        normalizedItems,
        pageVideos.map(normalizeYouTubePageVideo),
      );
    }
  }

  return normalizedItems;
}

export function normalizeItem(
  item: ParsedItem,
  platform: FeedPlatform,
  mediaType: FeedMediaType,
): NormalizedItem {
  const contentUrl = item.link || item.guid || "";
  const publishedAt = parseDate(item.isoDate || item.pubDate);
  const thumbnailUrl =
    extractThumbnail(item) || buildFallbackThumbnailUrl(platform, contentUrl);

  return {
    externalId: item.guid || contentUrl || `${item.title}-${item.pubDate}`,
    title: item.title || "Untitled",
    author: item.creator || item.author || null,
    contentUrl,
    publishedAt,
    summary: item.contentSnippet || item.summary || null,
    contentHtml: item["content:encoded"] || item.content || null,
    thumbnailUrl,
    mediaType,
    platform,
    embedUrl: buildEmbedUrl(platform, contentUrl),
    rawPayload: JSON.stringify(item),
  };
}

function inferSource(routeOrUrl: string): {
  platform: FeedPlatform;
  domainKey: string;
  siteUrl: string | null;
} {
  if (routeOrUrl.includes("/youtube/") || routeOrUrl.includes("youtube.com")) {
    return {
      platform: "youtube",
      domainKey: "youtube.com",
      siteUrl: "https://www.youtube.com",
    };
  }

  if (routeOrUrl.includes("/bilibili/") || routeOrUrl.includes("bilibili.com")) {
    return {
      platform: "bilibili",
      domainKey: "bilibili.com",
      siteUrl: "https://www.bilibili.com",
    };
  }

  if (routeOrUrl.includes("/weibo/") || routeOrUrl.includes("weibo.com")) {
    return {
      platform: "weibo",
      domainKey: "weibo.com",
      siteUrl: "https://weibo.com",
    };
  }

  try {
    const url = new URL(routeOrUrl);
    return {
      platform: "rss",
      domainKey: url.hostname.replace(/^www\./, ""),
      siteUrl: `${url.protocol}//${url.hostname}`,
    };
  } catch {
    return {
      platform: "rss",
      domainKey: "rss",
      siteUrl: null,
    };
  }
}

function resolveBilibiliUserVideoInput(
  inputUrl: string,
  mid: string,
  rsshubRoute: string | null,
): ResolvedFeedInput {
  return {
    inputUrl,
    feedUrl: `bilibili://user/video/${mid}`,
    rsshubRoute: rsshubRoute ?? `/bilibili/user/video/${mid}`,
    platform: "bilibili",
    domainKey: "bilibili.com",
    siteUrl: `https://space.bilibili.com/${mid}`,
  };
}

function getBilibiliMidFromRoute(route: string) {
  return route.match(/^\/bilibili\/user\/video\/(\d+)$/)?.[1] ?? null;
}

function getBilibiliMidFromAdapterUrl(inputUrl: string) {
  return inputUrl.match(/^bilibili:\/\/user\/video\/(\d+)$/)?.[1] ?? null;
}

function getBilibiliMidFromSpaceUrl(url: URL) {
  if (!url.hostname.endsWith("bilibili.com")) {
    return null;
  }

  if (url.hostname !== "space.bilibili.com") {
    return null;
  }

  return url.pathname.split("/").filter(Boolean)[0]?.match(/^\d+$/)?.[0] ?? null;
}

function isBilibiliAdapterUrl(feedUrl: string) {
  return Boolean(getBilibiliMidFromAdapterUrl(feedUrl));
}

function buildBilibiliFallbackPreview(resolved: ResolvedFeedInput): FeedPreview {
  const mid = getBilibiliMidFromAdapterUrl(resolved.feedUrl) || "unknown";

  return {
    title: `Bilibili UP ${mid}`,
    platform: "bilibili",
    sourceType: "bilibili",
    inputUrl: resolved.inputUrl,
    feedUrl: resolved.feedUrl,
    siteUrl: resolved.siteUrl,
    domainKey: resolved.domainKey,
    rsshubRoute: resolved.rsshubRoute,
    items: [],
    warning: BILIBILI_RISK_CONTROL_MESSAGE,
  };
}

function buildParsedFeedPreview(
  resolved: ResolvedFeedInput,
  feed: ParsedFeed,
): FeedPreview {
  return {
    title: feed.title || fallbackTitle(resolved.platform),
    platform: resolved.platform,
    sourceType: resolved.platform === "rss" ? "rss" : resolved.platform,
    inputUrl: resolved.inputUrl,
    feedUrl: resolved.feedUrl,
    siteUrl: feed.link || resolved.siteUrl,
    domainKey: resolved.domainKey,
    rsshubRoute: resolved.rsshubRoute,
    items: feed.items.slice(0, 3).map((item) => ({
      title: item.title || "Untitled",
      link: item.link || "",
      publishedAt: item.isoDate || item.pubDate || null,
    })),
  };
}

async function parseConfiguredRsshubFeed(resolved: ResolvedFeedInput) {
  if (!resolved.rsshubRoute) {
    throw new Error("缺少 RSSHub 路由。");
  }

  const { rsshubBaseUrl } = await getFeedSettings();

  if (!isConfiguredRsshubBaseUrl(rsshubBaseUrl)) {
    throw new Error("默认 RSSHub 公共实例不可作为 Bilibili fallback。");
  }

  return parseFeedUrl(await buildRsshubFeedUrl(resolved.rsshubRoute));
}

function isConfiguredRsshubBaseUrl(rsshubBaseUrl: string) {
  return !rsshubBaseUrl.match(/^https:\/\/rsshub\.app\/?$/);
}

async function buildRsshubFeedUrl(route: string) {
  const { rsshubBaseUrl, rsshubAccessCode } = await getFeedSettings();
  const url = new URL(rsshubBaseUrl);
  const prefix = url.pathname.replace(/\/$/, "");

  url.pathname = `${prefix}${route}`;
  if (rsshubAccessCode && !url.searchParams.has("code")) {
    url.searchParams.set("code", rsshubAccessCode);
  }

  return url.toString();
}

async function parseFeedUrl(feedUrl: string): Promise<ParsedFeed> {
  const url = new URL(feedUrl);

  if (url.searchParams.get("format") !== "json") {
    return parser.parseURL(feedUrl) as Promise<ParsedFeed>;
  }

  const response = await fetch(feedUrl, {
    headers: {
      Accept: "application/json, application/rss+xml;q=0.9, application/xml;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`RSSHub 返回 ${response.status}。`);
  }

  const contentType = response.headers.get("Content-Type") || "";
  const body = await response.text();

  if (!contentType.includes("json") && body.trimStart().startsWith("<")) {
    return parser.parseString(body) as Promise<ParsedFeed>;
  }

  const json = JSON.parse(body) as RsshubJsonFeed;

  return {
    title: json.title,
    link: json.link,
    items: (json.items ?? []).map((item) => {
      const parsedItem: ParsedItem = {
        title: item.title,
        link: item.link,
        pubDate: item.pubDate || item.isoDate || item.date,
        isoDate: item.isoDate,
        author: item.author,
        creator: item.creator,
        content: item.content || item.description,
        contentSnippet: item.description,
        "content:encoded": item["content:encoded"] || item.content_html,
      };

      if (item.enclosure?.url) {
        parsedItem.enclosure = {
          url: item.enclosure.url,
          type: item.enclosure.type,
        };
      }

      return parsedItem;
    }),
  };
}

async function fetchBilibiliArchiveFeed(
  feedUrl: string,
  input?: { maxPages?: number },
): Promise<BilibiliArchiveFeed> {
  const mid = getBilibiliMidFromAdapterUrl(feedUrl);

  if (!mid) {
    throw new Error("Bilibili 用户视频订阅地址无效。");
  }

  const { bilibiliCookie } = await getFeedSettings();
  const wbiKeys = await fetchBilibiliWbiKeys(bilibiliCookie);
  const videos: BilibiliArchiveVideo[] = [];
  let title: string | null = null;
  let totalCount: number | null = null;

  const maxPages = input?.maxPages ?? BILIBILI_ARCHIVE_MAX_PAGES;

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetch(
      buildBilibiliArchiveApiUrl(mid, wbiKeys, {
        page,
        pageSize: BILIBILI_ARCHIVE_PAGE_SIZE,
      }),
      {
        headers: cleanHeaders({
          Accept: "application/json",
          Cookie: bilibiliCookie,
          Referer: `https://space.bilibili.com/${mid}`,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        }),
      },
    );

    if (!response.ok) {
      const error = new Error(`Bilibili API 返回 ${response.status}。`);

      if (isBilibiliRiskControlError(error)) {
        return fetchBilibiliAppArchiveFeed(mid, { maxPages });
      }

      throw error;
    }

    const payload = (await response.json()) as BilibiliArchivePayload;

    if (payload.code !== 0) {
      const error = new Error(
        payload.message || `Bilibili API 返回错误码 ${payload.code}。`,
      );

      if (isBilibiliRiskControlError(error)) {
        return fetchBilibiliAppArchiveFeed(mid, { maxPages });
      }

      throw error;
    }

    title = title || payload.data?.info?.name || null;
    totalCount = payload.data?.page?.count ?? totalCount;

    const pageVideos = payload.data?.list?.vlist ?? [];

    if (pageVideos.length === 0) {
      break;
    }

    videos.push(...pageVideos);

    if (totalCount !== null && videos.length >= totalCount) {
      break;
    }

    if (totalCount === null && pageVideos.length < BILIBILI_ARCHIVE_PAGE_SIZE) {
      break;
    }
  }

  return {
    mid,
    title: title || `Bilibili UP ${mid}`,
    siteUrl: `https://space.bilibili.com/${mid}`,
    videos,
  };
}

async function fetchBilibiliAppArchiveFeed(
  mid: string,
  input?: { maxPages?: number },
): Promise<BilibiliArchiveFeed> {
  const videos: BilibiliArchiveVideo[] = [];
  let title: string | null = null;
  let totalCount: number | null = null;

  const maxPages = input?.maxPages ?? BILIBILI_ARCHIVE_MAX_PAGES;

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetch(
      buildBilibiliAppArchiveApiUrl(mid, {
        page,
        pageSize: BILIBILI_ARCHIVE_PAGE_SIZE,
      }),
      {
        headers: {
          Accept: "application/json",
          "User-Agent": BILIBILI_APP_USER_AGENT,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Bilibili APP API 返回 ${response.status}。`);
    }

    const payload = (await response.json()) as BilibiliAppArchivePayload;

    if (payload.code !== 0) {
      throw new Error(
        payload.message || `Bilibili APP API 返回错误码 ${payload.code}。`,
      );
    }

    totalCount = payload.data?.count ?? totalCount;

    const pageVideos = payload.data?.item ?? [];

    if (pageVideos.length === 0) {
      break;
    }

    title = title || pageVideos.find((video) => video.author)?.author || null;
    videos.push(
      ...pageVideos.map((video) => ({
        bvid: video.bvid,
        aid: video.param ? Number(video.param) : undefined,
        title: video.title,
        description: video.subtitle || video.tname || "",
        pic: video.cover,
        created: video.ctime,
      })),
    );

    if (totalCount !== null && videos.length >= totalCount) {
      break;
    }

    if (totalCount === null && pageVideos.length < BILIBILI_ARCHIVE_PAGE_SIZE) {
      break;
    }
  }

  return {
    mid,
    title: title || `Bilibili UP ${mid}`,
    siteUrl: `https://space.bilibili.com/${mid}`,
    videos,
  };
}

function buildBilibiliAppArchiveApiUrl(
  mid: string,
  input: { page: number; pageSize: number },
) {
  const signedParams = signBilibiliAppParams({
    appkey: BILIBILI_APP_KEY,
    build: BILIBILI_APP_BUILD,
    mobi_app: "android",
    platform: "android",
    ts: Math.round(Date.now() / 1000).toString(),
    vmid: mid,
    pn: String(input.page),
    ps: String(input.pageSize),
  });

  return `https://app.bilibili.com/x/v2/space/archive?${signedParams}`;
}

function signBilibiliAppParams(params: Record<string, string>) {
  const query = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");
  const sign = createHash("md5")
    .update(`${query}${BILIBILI_APP_SECRET}`)
    .digest("hex");

  return `${query}&sign=${sign}`;
}

function buildBilibiliArchiveApiUrl(
  mid: string,
  wbiKeys: string,
  input: { page: number; pageSize: number },
) {
  const signedParams = signBilibiliWbiParams(
    {
      mid,
      ps: String(input.pageSize),
      tid: "0",
      pn: String(input.page),
      keyword: "",
      order: "pubdate",
      platform: "web",
      web_location: "1550101",
    },
    wbiKeys,
  );

  return `https://api.bilibili.com/x/space/wbi/arc/search?${signedParams}`;
}

async function fetchBilibiliWbiKeys(bilibiliCookie: string) {
  const response = await fetch("https://api.bilibili.com/x/web-interface/nav", {
    headers: cleanHeaders({
      Accept: "application/json",
      Cookie: bilibiliCookie,
      Referer: "https://www.bilibili.com",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
    }),
  });

  if (!response.ok) {
    throw new Error(`Bilibili WBI key 请求返回 ${response.status}。`);
  }

  const payload = (await response.json()) as BilibiliWbiPayload;

  const imgKey = getBilibiliWbiKeyFromUrl(payload.data?.wbi_img?.img_url);
  const subKey = getBilibiliWbiKeyFromUrl(payload.data?.wbi_img?.sub_url);

  if (!imgKey || !subKey) {
    if (payload.code !== 0) {
      throw new Error(payload.message || `Bilibili WBI key 返回错误码 ${payload.code}。`);
    }

    throw new Error("Bilibili WBI key 缺失。");
  }

  return getBilibiliMixinKey(`${imgKey}${subKey}`);
}

function cleanHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => value.trim()),
  );
}

function getBilibiliWbiKeyFromUrl(url?: string) {
  if (!url) {
    return null;
  }

  return url.split("/").pop()?.split(".")[0] || null;
}

function getBilibiliMixinKey(sourceKey: string) {
  return BILIBILI_WBI_MIXIN_KEY_TABLE.map((index) => sourceKey[index] || "")
    .join("")
    .slice(0, 32);
}

function signBilibiliWbiParams(
  params: Record<string, string>,
  mixinKey: string,
) {
  const signedParams: Record<string, string> = {
    ...params,
    wts: Math.round(Date.now() / 1000).toString(),
  };
  const query = Object.keys(signedParams)
    .sort()
    .map((key) => {
      const value = signedParams[key].replace(/[!'()*]/g, "");
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join("&");
  const wRid = createHash("md5")
    .update(`${query}${mixinKey}`)
    .digest("hex");

  return `${query}&w_rid=${wRid}`;
}

function normalizeBilibiliArchiveVideo(
  video: BilibiliArchiveVideo,
  feed: BilibiliArchiveFeed,
): NormalizedItem {
  const contentUrl = buildBilibiliVideoUrl(video);

  return {
    externalId: video.bvid || String(video.aid || contentUrl),
    title: video.title || "Untitled",
    author: feed.title,
    contentUrl,
    publishedAt: video.created ? new Date(video.created * 1000) : null,
    summary: video.description || null,
    contentHtml: video.description || null,
    thumbnailUrl: normalizeBilibiliImageUrl(video.pic),
    mediaType: "video",
    platform: "bilibili",
    embedUrl: buildEmbedUrl("bilibili", contentUrl),
    rawPayload: JSON.stringify(video),
  };
}

function buildBilibiliVideoUrl(video: BilibiliArchiveVideo) {
  if (video.bvid) {
    return `https://www.bilibili.com/video/${video.bvid}`;
  }

  if (video.aid) {
    return `https://www.bilibili.com/video/av${video.aid}`;
  }

  return "https://www.bilibili.com";
}

function normalizeBilibiliImageUrl(pic?: string) {
  if (!pic) {
    return null;
  }

  if (pic.startsWith("//")) {
    return `https:${pic}`;
  }

  return pic;
}

async function fetchYouTubeChannelVideos(channelId: string) {
  const pageUrl = `https://www.youtube.com/channel/${channelId}/videos`;
  const response = await fetch(pageUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": YOUTUBE_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube 频道视频页访问失败: ${response.status}`);
  }

  const html = await response.text();
  const apiKey = extractYouTubeConfigValue(html, "INNERTUBE_API_KEY");
  const clientVersion =
    extractYouTubeConfigValue(html, "INNERTUBE_CLIENT_VERSION") ||
    "2.20240601.00.00";
  const initialData = extractJsonObjectAfterMarker(html, "var ytInitialData =");

  if (!initialData) {
    throw new Error("无法解析 YouTube 视频页数据。");
  }

  let videos = collectYouTubeVideos(initialData);
  const seenTokens = new Set<string>();
  let continuations = collectYouTubeContinuations(initialData);

  if (!apiKey) {
    return videos;
  }

  for (
    let page = 1;
    continuations.length > 0 &&
    videos.length < YOUTUBE_TARGET_SUPPLEMENTAL_VIDEO_COUNT &&
    page <= YOUTUBE_CONTINUATION_MAX_PAGES;
    page += 1
  ) {
    const nextPage = await fetchNextYouTubeVideoPage(
      apiKey,
      clientVersion,
      continuations,
      seenTokens,
      new Set(videos.map((video) => video.videoId)),
    );

    if (!nextPage) {
      break;
    }

    videos = dedupeYouTubePageVideos([...videos, ...nextPage.videos]);
    continuations = nextPage.continuations;
  }

  return dedupeYouTubePageVideos(videos);
}

async function fetchNextYouTubeVideoPage(
  apiKey: string,
  clientVersion: string,
  continuations: string[],
  seenTokens: Set<string>,
  seenVideoIds: Set<string>,
) {
  for (const continuation of continuations) {
    if (seenTokens.has(continuation)) {
      continue;
    }

    seenTokens.add(continuation);

    const payload = await fetchYouTubeContinuation(
      apiKey,
      clientVersion,
      continuation,
    );
    const videos = collectYouTubeVideos(payload);
    const hasNewVideo = videos.some((video) => !seenVideoIds.has(video.videoId));

    if (hasNewVideo) {
      return {
        videos,
        continuations: collectYouTubeContinuations(payload),
      };
    }
  }

  return null;
}

async function fetchYouTubeContinuation(
  apiKey: string,
  clientVersion: string,
  continuation: string,
) {
  const response = await fetch(
    `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": YOUTUBE_USER_AGENT,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion,
          },
        },
        continuation,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`YouTube continuation 请求失败: ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

function normalizeYouTubePageVideo(video: YouTubePageVideo): NormalizedItem {
  const contentUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

  return {
    externalId: `yt:video:${video.videoId}`,
    title: video.title,
    author: video.author,
    contentUrl,
    publishedAt: null,
    summary: video.publishedText,
    contentHtml: null,
    thumbnailUrl:
      normalizeYouTubeThumbnailUrl(video.thumbnailUrl) ||
      buildFallbackThumbnailUrl("youtube", contentUrl),
    mediaType: "video",
    platform: "youtube",
    embedUrl: buildEmbedUrl("youtube", contentUrl),
    rawPayload: JSON.stringify(video),
  };
}

function mergeYouTubeItems(
  rssItems: NormalizedItem[],
  pageItems: NormalizedItem[],
) {
  const merged = new Map<string, NormalizedItem>();

  for (const item of rssItems) {
    merged.set(getYouTubeItemMergeKey(item), item);
  }

  for (const item of pageItems) {
    const key = getYouTubeItemMergeKey(item);

    if (!merged.has(key)) {
      merged.set(key, item);
    }
  }

  return [...merged.values()];
}

function getYouTubeItemMergeKey(item: NormalizedItem) {
  const videoId =
    getYouTubeVideoId(item.externalId) ||
    getYouTubeVideoId(item.contentUrl) ||
    (item.embedUrl ? getYouTubeVideoId(item.embedUrl) : null);

  return videoId || item.externalId || item.contentUrl;
}

function collectYouTubeVideos(value: unknown): YouTubePageVideo[] {
  const videos: YouTubePageVideo[] = [];

  visitJson(value, (node, key) => {
    if (!isRecord(node)) {
      return;
    }

    if (key === "videoRenderer") {
      const video = getYouTubeRendererVideo(node);

      if (video) {
        videos.push(video);
      }
    } else if (key === "lockupViewModel") {
      const video = getYouTubeLockupVideo(node);

      if (video) {
        videos.push(video);
      }
    }
  });

  return dedupeYouTubePageVideos(videos);
}

function getYouTubeRendererVideo(
  node: Record<string, unknown>,
): YouTubePageVideo | null {
  const videoId = typeof node.videoId === "string" ? node.videoId : "";
  const title = getYouTubeText(node.title);

  if (!videoId || !title) {
    return null;
  }

  return {
    videoId,
    title,
    author:
      getYouTubeText(node.ownerText) ||
      getYouTubeText(node.shortBylineText) ||
      null,
    publishedText: getYouTubeText(node.publishedTimeText) || null,
    thumbnailUrl: getYouTubeThumbnail(node.thumbnail),
  };
}

function getYouTubeLockupVideo(
  node: Record<string, unknown>,
): YouTubePageVideo | null {
  const videoId =
    getStringField(node.contentId) || findYouTubeVideoIdInValue(node);
  const title = getLockupTitle(node);

  if (!videoId || !title) {
    return null;
  }

  return {
    videoId,
    title,
    author: null,
    publishedText: getLockupPublishedText(node),
    thumbnailUrl: getLockupThumbnail(node),
  };
}

function collectYouTubeContinuations(value: unknown): string[] {
  const tokens: string[] = [];

  visitJson(value, (node, key) => {
    if (key !== "continuationCommand" || !isRecord(node)) {
      return;
    }

    if (typeof node.token === "string" && node.token) {
      tokens.push(node.token);
    }
  });

  return [...new Set(tokens)];
}

function dedupeYouTubePageVideos(videos: YouTubePageVideo[]) {
  const deduped = new Map<string, YouTubePageVideo>();

  for (const video of videos) {
    if (!deduped.has(video.videoId)) {
      deduped.set(video.videoId, video);
    }
  }

  return [...deduped.values()];
}

function extractYouTubeConfigValue(html: string, key: string) {
  const pattern = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`);
  const match = html.match(pattern);

  return match?.[1] ? decodeJsonString(match[1]) : null;
}

function extractJsonObjectAfterMarker(html: string, marker: string) {
  const markerIndex = html.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const startIndex = html.indexOf("{", markerIndex);

  if (startIndex === -1) {
    return null;
  }

  const endIndex = findJsonObjectEnd(html, startIndex);

  if (endIndex === -1) {
    return null;
  }

  return JSON.parse(html.slice(startIndex, endIndex + 1)) as unknown;
}

function findJsonObjectEnd(source: string, startIndex: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }

      continue;
    }

    if (character === "\"") {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function visitJson(
  value: unknown,
  visitor: (node: unknown, key: string | null) => void,
  key: string | null = null,
) {
  visitor(value, key);

  if (Array.isArray(value)) {
    for (const item of value) {
      visitJson(item, visitor, null);
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [childKey, childValue] of Object.entries(value)) {
    visitJson(childValue, visitor, childKey);
  }
}

function getYouTubeText(value: unknown): string {
  if (!isRecord(value)) {
    return "";
  }

  if (typeof value.content === "string") {
    return value.content;
  }

  if (typeof value.simpleText === "string") {
    return value.simpleText;
  }

  if (Array.isArray(value.runs)) {
    return value.runs
      .map((run) => (isRecord(run) && typeof run.text === "string" ? run.text : ""))
      .join("")
      .trim();
  }

  return "";
}

function getYouTubeThumbnail(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.thumbnails)) {
    return null;
  }

  const thumbnails = value.thumbnails.filter(
    (thumbnail): thumbnail is { url: string } =>
      isRecord(thumbnail) && typeof thumbnail.url === "string",
  );

  return thumbnails.at(-1)?.url || null;
}

function getLockupTitle(node: Record<string, unknown>) {
  const metadata = getRecordField(node.metadata);
  const lockupMetadata = getRecordField(metadata?.lockupMetadataViewModel);
  const title = getYouTubeText(lockupMetadata?.title);

  return title || getYouTubeText(node.title);
}

function getLockupPublishedText(node: Record<string, unknown>) {
  const metadata = getRecordField(node.metadata);
  const lockupMetadata = getRecordField(metadata?.lockupMetadataViewModel);
  const metadataContainer = getRecordField(lockupMetadata?.metadata);
  const contentMetadata = getRecordField(
    metadataContainer?.contentMetadataViewModel,
  );
  const rows = Array.isArray(contentMetadata?.metadataRows)
    ? contentMetadata.metadataRows
    : [];
  const partsText = rows.flatMap((row) => {
    const rowRecord = getRecordField(row);
    const parts = Array.isArray(rowRecord?.metadataParts)
      ? rowRecord.metadataParts
      : [];

    return parts
      .map((part) => getYouTubeText(getRecordField(part)?.text))
      .filter(Boolean);
  });

  return (
    partsText.find((text) =>
      /ago|streamed|premiered|前|小时前|分钟前|天前|周前|月前|年前/i.test(text),
    ) ||
    partsText.at(-1) ||
    null
  );
}

function getLockupThumbnail(node: Record<string, unknown>) {
  const contentImage = getRecordField(node.contentImage);
  const thumbnailViewModel = getRecordField(contentImage?.thumbnailViewModel);
  const image = getRecordField(thumbnailViewModel?.image);
  const sources = Array.isArray(image?.sources) ? image.sources : [];
  const source = sources
    .filter(
      (candidate): candidate is { url: string; width?: number } =>
        isRecord(candidate) && typeof candidate.url === "string",
    )
    .sort((left, right) => (right.width ?? 0) - (left.width ?? 0))[0];

  return source?.url || null;
}

function findYouTubeVideoIdInValue(value: unknown) {
  let videoId: string | null = null;

  visitJson(value, (node, key) => {
    if (videoId || key !== "watchEndpoint" || !isRecord(node)) {
      return;
    }

    videoId = getStringField(node.videoId);
  });

  return videoId;
}

function normalizeYouTubeThumbnailUrl(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  return value;
}

function decodeJsonString(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

function getRecordField(value: unknown) {
  return isRecord(value) ? value : null;
}

function getStringField(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function getMediaType(platform: FeedPlatform): FeedMediaType {
  if (platform === "youtube" || platform === "bilibili") {
    return "video";
  }

  if (platform === "weibo") {
    return "status";
  }

  return "article";
}

function fallbackTitle(platform: FeedPlatform) {
  if (platform === "youtube") {
    return "YouTube Feed";
  }

  if (platform === "bilibili") {
    return "Bilibili Feed";
  }

  if (platform === "weibo") {
    return "Weibo Feed";
  }

  return "RSS Feed";
}

function parseDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractThumbnail(item: ParsedItem) {
  const mediaThumbnail = Array.isArray(item.mediaThumbnail)
    ? item.mediaThumbnail[0]
    : item.mediaThumbnail;
  const mediaContent = Array.isArray(item.mediaContent)
    ? item.mediaContent[0]
    : item.mediaContent;

  return (
    mediaThumbnail?.$?.url ||
    mediaContent?.$?.url ||
    item.itunesImage?.$?.href ||
    null
  );
}

function buildFallbackThumbnailUrl(platform: FeedPlatform, contentUrl: string) {
  if (platform !== "youtube") {
    return null;
  }

  const videoId = getYouTubeVideoId(contentUrl);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
}

function buildEmbedUrl(platform: FeedPlatform, contentUrl: string) {
  if (platform === "youtube") {
    const videoId = getYouTubeVideoId(contentUrl);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  }

  if (platform === "bilibili") {
    const bvid = contentUrl.match(/BV[a-zA-Z0-9]+/)?.[0];
    return bvid ? `https://player.bilibili.com/player.html?bvid=${bvid}` : null;
  }

  return null;
}

function getYouTubeVideoId(url: string) {
  const feedId = url.match(/^yt:video:([^?#/]+)$/)?.[1];

  if (feedId) {
    return feedId;
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.split("/").filter(Boolean)[0] || null;
    }

    const watchId = parsed.searchParams.get("v");

    if (watchId) {
      return watchId;
    }

    const [firstSegment, secondSegment] = parsed.pathname
      .split("/")
      .filter(Boolean);

    if (["embed", "shorts", "live"].includes(firstSegment)) {
      return secondSegment || null;
    }

    return null;
  } catch {
    return null;
  }
}

function isYouTubeUrl(url: URL) {
  return (
    url.hostname === "youtube.com" ||
    url.hostname === "www.youtube.com" ||
    url.hostname === "m.youtube.com" ||
    url.hostname === "youtu.be"
  );
}

function getYouTubeChannelIdFromFeedUrl(feedUrl: string) {
  try {
    const url = new URL(feedUrl);

    if (
      !url.hostname.endsWith("youtube.com") ||
      url.pathname !== "/feeds/videos.xml"
    ) {
      return null;
    }

    return url.searchParams.get("channel_id");
  } catch {
    return null;
  }
}

async function resolveYouTubeChannel(input: string) {
  if (input.startsWith("UC")) {
    return {
      channelId: input,
      siteUrl: `https://www.youtube.com/channel/${input}`,
    };
  }

  let pageUrl = input;

  if (input.startsWith("@")) {
    pageUrl = `https://www.youtube.com/${input}`;
  }

  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube 频道页访问失败: ${response.status}`);
  }

  const html = await response.text();
  const channelPath = html.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/)?.[1];
  const browseId = html.match(/"browseId":"(UC[a-zA-Z0-9_-]+)"/)?.[1];
  const channelId =
    channelPath ||
    browseId ||
    html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/)?.[1];

  if (!channelId) {
    throw new Error("无法从 YouTube 页面解析频道 ID。");
  }

  return {
    channelId,
    siteUrl: `https://www.youtube.com/channel/${channelId}`,
  };
}

function buildYouTubeFeedUrl(channelId: string) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}
