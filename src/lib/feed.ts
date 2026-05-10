import Parser from "rss-parser";

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

const parser = new Parser({
  customFields: {
    item: [
      ["media:thumbnail", "mediaThumbnail"],
      ["media:content", "mediaContent"],
      ["itunes:image", "itunesImage"],
    ],
  },
});

type ParsedItem = Parser.Item & {
  author?: string;
  creator?: string;
  "content:encoded"?: string;
  mediaThumbnail?: { $?: { url?: string } } | Array<{ $?: { url?: string } }>;
  mediaContent?: { $?: { url?: string } } | Array<{ $?: { url?: string } }>;
  itunesImage?: { $?: { href?: string } };
};

export async function resolveFeedInput(inputUrl: string) {
  const trimmed = inputUrl.trim();
  const rsshubBaseUrl =
    process.env.RSSHUB_BASE_URL?.replace(/\/$/, "") ?? "https://rsshub.app";

  if (!trimmed) {
    throw new Error("请输入 RSS、Atom、RSSHub URL 或 rsshub:// 链接。");
  }

  if (trimmed.startsWith("rsshub://")) {
    const route = `/${trimmed.slice("rsshub://".length).replace(/^\/+/, "")}`;

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
      feedUrl: `${rsshubBaseUrl}${route}`,
      rsshubRoute: route,
      ...inferSource(route),
    };
  }

  const url = new URL(trimmed);

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
  const feed = await parser.parseURL(resolved.feedUrl);

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

export async function fetchNormalizedItems(feedUrl: string) {
  const resolved = await resolveFeedInput(feedUrl);
  const feed = await parser.parseURL(resolved.feedUrl);
  const platform = resolved.platform;
  const mediaType = getMediaType(platform);

  return feed.items.map((item) =>
    normalizeItem(item as ParsedItem, platform, mediaType),
  );
}

export function normalizeItem(
  item: ParsedItem,
  platform: FeedPlatform,
  mediaType: FeedMediaType,
): NormalizedItem {
  const contentUrl = item.link || item.guid || "";
  const publishedAt = parseDate(item.isoDate || item.pubDate);
  const thumbnailUrl = extractThumbnail(item);

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
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "");
    }

    return parsed.searchParams.get("v");
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
