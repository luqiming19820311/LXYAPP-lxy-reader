"use client";

import {
  Bookmark,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CirclePlay,
  Copy,
  Database,
  Download,
  ExternalLink,
  EyeOff,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  Layers3,
  Moon,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  RefreshCcw,
  Rss,
  Save,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Sun,
  Upload,
  UserCircle,
  Video,
  X,
} from "lucide-react";
import type { ReactNode, SyntheticEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type View = "all" | "videos" | "articles" | "favorites" | "settings";
type ItemType = "Video" | "Article" | "Update";

type FeedItem = {
  id: string;
  subscriptionId: string;
  source: string;
  sourceInitial: string;
  sourceColor: string;
  type: ItemType;
  title: string;
  excerpt: string;
  bodyText: string;
  platform: string;
  time: string;
  read: boolean;
  favorite: boolean;
  thumbnail?: string;
  contentUrl: string;
  embedUrl?: string;
  aiSummary?: string;
  duration?: string;
  reactions?: number;
  comments?: number;
};

type SourceItem = {
  id: string;
  name: string;
  initial: string;
  unread: number;
  status: "online" | "failed" | "idle" | "inactive";
  color: string;
  folderId: string | null;
};

type SourceFolder = {
  id: string;
  name: string;
  subscriptionCount: number;
  unreadCount: number;
  subscriptionIds: string[];
};

type ApiItem = {
  id: string;
  title: string;
  summary: string | null;
  contentHtml: string | null;
  contentUrl: string;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  mediaType: string;
  platform: string;
  embedUrl: string | null;
  subscription: {
    id: string;
    title: string;
    status: string;
  };
  state: {
    isRead: boolean;
    isFavorite: boolean;
  } | null;
  aiSummary: {
    summaryText: string;
  } | null;
};

type ApiSubscription = {
  id: string;
  title: string;
  sourceType: string;
  inputUrl: string;
  feedUrl: string;
  siteUrl: string | null;
  status: string;
  folderId: string | null;
  lastError: string | null;
  lastFetchedAt: string | null;
  createdAt: string;
  _count?: {
    items: number;
  };
};

type SourceFolderActionResponse = {
  folder?: SourceFolder;
  folders?: SourceFolder[];
  ok?: boolean;
  error?: string;
};

type PreviewResult = {
  title: string;
  platform: string;
  feedUrl: string;
  items: Array<{
    title: string;
    link: string;
    publishedAt: string | null;
  }>;
};

type AiConfig = {
  configured: boolean;
  model: string;
};

type ItemStateResponse = {
  state?: {
    isRead: boolean;
    isFavorite: boolean;
  };
  error?: string;
};

type SummaryResponse = {
  summary?: {
    summaryText: string;
    model: string;
    promptVersion: string;
    createdAt: string;
  };
  error?: string;
};

type SubscriptionActionResponse = {
  subscription?: ApiSubscription;
  alreadyExisted?: boolean;
  ok?: boolean;
  error?: string;
};

type OpmlImportResult = {
  imported: number;
  updated: number;
  failed: number;
  results: Array<{
    title: string;
    feedUrl: string;
    status: "created" | "updated" | "failed";
    error?: string;
  }>;
  error?: string;
};

type RefreshResult = {
  subscriptionId: string;
  title: string;
  status: "success" | "failed";
  fetchedCount: number;
  newCount: number;
  error?: string;
};

type SubscriptionFetchResponse = {
  subscription?: ApiSubscription;
  result?: RefreshResult;
  error?: string;
};

type RefreshReport = {
  scope: string;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  results: RefreshResult[];
};

type ItemPatch = Partial<Pick<FeedItem, "read" | "favorite" | "aiSummary">>;
type VideoPlayerStatus = "idle" | "loading" | "playing" | "blocked";
type NavUnreadCounts = Record<"all" | "videos" | "articles" | "favorites", number>;

const navigation = [
  { id: "all" as const, label: "All Feeds", icon: Layers3 },
  { id: "videos" as const, label: "Videos", icon: CirclePlay },
  { id: "articles" as const, label: "Articles", icon: FileText },
  { id: "favorites" as const, label: "Favorites", icon: Star },
];

function toFeedItem(item: ApiItem): FeedItem {
  const type =
    item.mediaType === "video"
      ? "Video"
      : item.mediaType === "status"
        ? "Update"
        : "Article";

  return {
    id: item.id,
    subscriptionId: item.subscription.id,
    source: item.subscription.title,
    sourceInitial: item.subscription.title.slice(0, 1).toUpperCase(),
    sourceColor: getSourceColor(item.platform),
    type,
    title: item.title,
    excerpt: item.summary || stripHtml(item.contentHtml) || "No preview available.",
    bodyText:
      stripHtml(item.contentHtml) ||
      item.summary ||
      "No detailed text is available for this item yet.",
    platform: item.platform,
    time: formatRelativeTime(item.publishedAt),
    read: item.state?.isRead ?? false,
    favorite: item.state?.isFavorite ?? false,
    thumbnail: item.thumbnailUrl || undefined,
    contentUrl: item.contentUrl,
    embedUrl: item.embedUrl || undefined,
    aiSummary: item.aiSummary?.summaryText,
    reactions: type === "Update" ? 12 : undefined,
    comments: type === "Update" ? 4 : undefined,
  };
}

function toSourceItem(
  subscription: ApiSubscription,
  items: FeedItem[],
): SourceItem {
  const subscriptionItems = items.filter(
    (item) => item.subscriptionId === subscription.id,
  );

  return {
    id: subscription.id,
    name: subscription.title,
    initial: subscription.title.slice(0, 1).toUpperCase(),
    unread: subscriptionItems.filter((item) => !item.read).length,
    status:
      subscription.status === "inactive"
        ? "inactive"
        : subscription.status === "failed"
        ? "failed"
        : subscription.status === "active"
          ? "online"
          : "idle",
    color: getSourceColor(subscription.sourceType),
    folderId: subscription.folderId,
  };
}

function getSourceColor(source: string) {
  if (source === "youtube") {
    return "bg-rose-100 text-rose-600";
  }

  if (source === "bilibili") {
    return "bg-blue-100 text-blue-600";
  }

  if (source === "weibo") {
    return "bg-orange-100 text-orange-600";
  }

  return "bg-slate-100 text-slate-600";
}

function stripHtml(value: string | null) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "";
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const publishedAt = new Date(value).getTime();
  const diffMs = Date.now() - publishedAt;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    return "Just now";
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "Yesterday" : `${diffDays}d ago`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCompactCount(value: number) {
  return value > 99 ? "99+" : `${value}`;
}

function filterItemsByView(items: FeedItem[], view: View) {
  if (view === "videos") {
    return items.filter((item) => item.type === "Video");
  }

  if (view === "articles") {
    return items.filter((item) => item.type === "Article");
  }

  if (view === "favorites") {
    return items.filter((item) => item.favorite);
  }

  return items;
}

function filterItemsBySearch(items: FeedItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) =>
    [item.title, item.excerpt, item.source, item.type]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery),
  );
}

function getVisibleItems(
  items: FeedItem[],
  view: View,
  query: string,
  sourceId: string,
  folderSourceIds: string[] = [],
) {
  const sourceItems = sourceId
    ? items.filter((item) => item.subscriptionId === sourceId)
    : folderSourceIds.length
      ? items.filter((item) => folderSourceIds.includes(item.subscriptionId))
    : items;

  return filterItemsBySearch(filterItemsByView(sourceItems, view), query);
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "请求超时，请稍后再试。";
  }

  return error instanceof Error ? error.message : fallback;
}

function copyTextFallback(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("copy failed");
  }
}

function getPlayableEmbedUrl(item: FeedItem) {
  if (item.embedUrl) {
    return item.embedUrl;
  }

  if (item.platform === "youtube") {
    const videoId = getYouTubeVideoId(item.contentUrl);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
  }

  if (item.platform === "bilibili") {
    const bvid = item.contentUrl.match(/BV[a-zA-Z0-9]+/)?.[0];
    return bvid ? buildBilibiliEmbedUrl(bvid) : "";
  }

  return "";
}

function buildBilibiliEmbedUrl(bvid: string) {
  const url = new URL("https://player.bilibili.com/player.html");
  url.searchParams.set("bvid", bvid);
  url.searchParams.set("page", "1");
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("high_quality", "1");
  url.searchParams.set("danmaku", "0");
  return url.toString();
}

function getAutoplayEmbedUrl(embedUrl: string) {
  try {
    const url = new URL(embedUrl);
    const isYouTube = url.hostname.includes("youtube");
    const isBilibili = url.hostname.includes("bilibili");

    if (isBilibili) {
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("high_quality", "1");
      url.searchParams.set("danmaku", "0");
      return url.toString();
    }

    url.searchParams.set("autoplay", "1");
    url.searchParams.set("mute", "0");
    url.searchParams.set("playsinline", "1");
    url.searchParams.set("rel", "0");
    url.searchParams.set("enablejsapi", "1");

    if (typeof window !== "undefined" && isYouTube) {
      url.searchParams.set("origin", window.location.origin);
      url.searchParams.set("widget_referrer", window.location.href);
    }

    return url.toString();
  } catch {
    return embedUrl;
  }
}

function getYouTubeVideoId(value: string) {
  try {
    const url = new URL(value);

    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }

    const watchId = url.searchParams.get("v");

    if (watchId) {
      return watchId;
    }

    const [firstSegment, secondSegment] = url.pathname
      .split("/")
      .filter(Boolean);

    if (["embed", "shorts", "live"].includes(firstSegment)) {
      return secondSegment || "";
    }

    return "";
  } catch {
    return "";
  }
}

function parseYouTubePlayerMessage(value: string) {
  try {
    return JSON.parse(value) as {
      event?: string;
      id?: string;
      info?: number | { playerState?: number };
    };
  } catch {
    return null;
  }
}

function postYouTubeCommand(playerId: string, command: string) {
  const iframe = document.getElementById(playerId) as HTMLIFrameElement | null;

  iframe?.contentWindow?.postMessage(
    JSON.stringify({
      event: "command",
      func: command,
      args: [],
      id: playerId,
    }),
    "https://www.youtube.com",
  );
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("all");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<ApiSubscription[]>([]);
  const [sourceFolders, setSourceFolders] = useState<SourceFolder[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [refreshReport, setRefreshReport] = useState<RefreshReport | null>(null);
  const [copiedItemId, setCopiedItemId] = useState("");
  const [summaryErrors, setSummaryErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [busyItemIds, setBusyItemIds] = useState<Set<string>>(new Set());
  const [summarizingItemIds, setSummarizingItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    configured: false,
    model: "gpt-5",
  });
  const [subscriptionInput, setSubscriptionInput] = useState(
    "rsshub://youtube/user/%40xiao_lin_shuo",
  );
  const stateOverridesRef = useRef<Record<string, ItemPatch>>({});

  async function loadData() {
    try {
      const [
        itemsResponse,
        subscriptionsResponse,
        foldersResponse,
        aiConfigResponse,
      ] =
        await Promise.all([
          fetchWithTimeout("/api/items", {}, 10000),
          fetchWithTimeout("/api/subscriptions", {}, 10000),
          fetchWithTimeout("/api/source-folders", {}, 10000),
          fetchWithTimeout("/api/ai/config", {}, 10000),
        ]);

      if (!itemsResponse.ok || !subscriptionsResponse.ok || !foldersResponse.ok) {
        throw new Error("数据加载失败，请重试。");
      }

      const itemsJson = (await itemsResponse.json()) as { items: ApiItem[] };
      const subscriptionsJson = (await subscriptionsResponse.json()) as {
        subscriptions: ApiSubscription[];
      };
      const foldersJson = (await foldersResponse.json()) as {
        folders: SourceFolder[];
      };
      const nextAiConfig = aiConfigResponse.ok
        ? ((await aiConfigResponse.json()) as AiConfig)
        : null;
      const nextItems = itemsJson.items.map((item) => ({
        ...toFeedItem(item),
        ...stateOverridesRef.current[item.id],
      }));

      setItems(nextItems);
      setSubscriptions(subscriptionsJson.subscriptions);
      setSourceFolders(foldersJson.folders);
      if (nextAiConfig) {
        setAiConfig(nextAiConfig);
      }
      setLoadError("");
      setSelectedId((current) =>
        nextItems.some((item) => item.id === current)
          ? current
          : nextItems[0]?.id || "",
      );
    } catch (error) {
      setLoadError(getRequestErrorMessage(error, "数据加载失败，请重试。"));
    } finally {
      setIsLoadingData(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const sources = useMemo(
    () =>
      subscriptions.map((subscription) => toSourceItem(subscription, items)),
    [items, subscriptions],
  );
  const selectedFolder = sourceFolders.find(
    (folder) => folder.id === selectedFolderId,
  );
  const selectedFolderSourceIds = useMemo(
    () => selectedFolder?.subscriptionIds ?? [],
    [selectedFolder?.subscriptionIds],
  );

  const filteredItems = useMemo(
    () =>
      getVisibleItems(
        items,
        activeView,
        searchQuery,
        selectedSourceId,
        selectedFolderSourceIds,
      ),
    [activeView, items, searchQuery, selectedFolderSourceIds, selectedSourceId],
  );

  const selectedSource = sources.find((source) => source.id === selectedSourceId);

  const selectedItem =
    filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0];

  const isEmptyState = activeView === "all" && items.length === 0;
  const unreadCount = items.filter((item) => !item.read).length;
  const navUnreadCounts: NavUnreadCounts = {
    all: unreadCount,
    videos: items.filter((item) => item.type === "Video" && !item.read).length,
    articles: items.filter((item) => item.type === "Article" && !item.read).length,
    favorites: items.filter((item) => item.favorite && !item.read).length,
  };

  function patchItem(id: string, patch: ItemPatch) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function selectNextVisibleItem(
    nextItems: FeedItem[],
    view: View,
    sourceId: string,
    folderSourceIds: string[] = [],
    removedId?: string,
  ) {
    const nextVisibleItems = getVisibleItems(
      nextItems,
      view,
      searchQuery,
      sourceId,
      folderSourceIds,
    );
    const hasCurrentSelection = nextVisibleItems.some(
      (item) => item.id === selectedId && item.id !== removedId,
    );

    if (!hasCurrentSelection) {
      setSelectedId(nextVisibleItems[0]?.id || "");
    }
  }

  async function mutateItemState(
    id: string,
    endpoint: "read" | "unread" | "favorite" | "unfavorite",
    patch: ItemPatch,
  ) {
    const previous = items.find((item) => item.id === id);

    if (!previous) {
      return;
    }

    setActionError("");
    setBusyItemIds((current) => new Set(current).add(id));
    stateOverridesRef.current[id] = {
      ...stateOverridesRef.current[id],
      ...patch,
    };
    patchItem(id, patch);

    try {
      const response = await fetchWithTimeout(
        `/api/items/${id}/${endpoint}`,
        {
          method: "POST",
        },
        10000,
      );
      const json = (await response.json()) as ItemStateResponse;

      if (!response.ok) {
        throw new Error(json.error || "操作失败。");
      }

      if (json.state) {
        const confirmedPatch = {
          read: json.state.isRead,
          favorite: json.state.isFavorite,
        };

        stateOverridesRef.current[id] = {
          ...stateOverridesRef.current[id],
          ...confirmedPatch,
        };

        setItems((current) => {
          const next = current.map((item) =>
            item.id === id ? { ...item, ...confirmedPatch } : item,
          );

          if (activeView === "favorites" && endpoint === "unfavorite") {
            queueMicrotask(() =>
              selectNextVisibleItem(
                next,
                activeView,
                selectedSourceId,
                selectedFolderSourceIds,
                id,
              ),
            );
          }

          return next;
        });
      }
    } catch (error) {
      stateOverridesRef.current[id] = {
        read: previous.read,
        favorite: previous.favorite,
      };
      patchItem(id, {
        read: previous.read,
        favorite: previous.favorite,
      });
      setActionError(getRequestErrorMessage(error, "操作失败。"));
    } finally {
      setBusyItemIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleSelectItem(id: string) {
    setSelectedId(id);
    const item = items.find((candidate) => candidate.id === id);

    if (item && !item.read) {
      await mutateItemState(id, "read", { read: true });
    }
  }

  async function handleToggleRead(item: FeedItem) {
    await mutateItemState(item.id, item.read ? "unread" : "read", {
      read: !item.read,
    });
  }

  async function handleToggleFavorite(item: FeedItem) {
    await mutateItemState(
      item.id,
      item.favorite ? "unfavorite" : "favorite",
      { favorite: !item.favorite },
    );
  }

  function handleOpenOriginal(item: FeedItem) {
    window.location.assign(item.contentUrl);
  }

  async function handleCopyLink(item: FeedItem) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.contentUrl);
      } else {
        copyTextFallback(item.contentUrl);
      }
      setCopiedItemId(item.id);
      window.setTimeout(() => {
        setCopiedItemId((current) => (current === item.id ? "" : current));
      }, 1800);
    } catch {
      try {
        copyTextFallback(item.contentUrl);
        setCopiedItemId(item.id);
        window.setTimeout(() => {
          setCopiedItemId((current) => (current === item.id ? "" : current));
        }, 1800);
      } catch {
        setActionError("复制链接失败，请手动打开原文复制。");
      }
    }
  }

  async function handleGenerateSummary(item: FeedItem) {
    setSummaryErrors((current) => ({ ...current, [item.id]: "" }));
    setSummarizingItemIds((current) => new Set(current).add(item.id));

    try {
      const response = await fetchWithTimeout(
        `/api/items/${item.id}/summary`,
        {
          method: "POST",
        },
        45000,
      );
      const json = (await response.json()) as SummaryResponse;

      if (!response.ok || !json.summary) {
        throw new Error(json.error || "摘要生成失败。");
      }

      const patch = { aiSummary: json.summary.summaryText };

      stateOverridesRef.current[item.id] = {
        ...stateOverridesRef.current[item.id],
        ...patch,
      };
      patchItem(item.id, patch);
    } catch (error) {
      setSummaryErrors((current) => ({
        ...current,
        [item.id]: getRequestErrorMessage(error, "摘要生成失败。"),
      }));
    } finally {
      setSummarizingItemIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function handleRefreshFeeds() {
    const candidateSubscriptions = selectedSourceId
      ? subscriptions.filter((subscription) => subscription.id === selectedSourceId)
      : selectedFolderId
        ? subscriptions.filter(
            (subscription) => subscription.folderId === selectedFolderId,
          )
      : subscriptions;
    const targetSubscriptions = candidateSubscriptions.filter(
      (subscription) => subscription.status !== "inactive",
    );

    if (targetSubscriptions.length === 0) {
      if (candidateSubscriptions.length > 0) {
        setActionError("该订阅源已停用，启用后才能刷新。");
        setRefreshReport({
          scope: candidateSubscriptions[0]?.title || "Selected source",
          total: candidateSubscriptions.length,
          success: 0,
          failed: 0,
          skipped: candidateSubscriptions.length,
          results: candidateSubscriptions.map((subscription) => ({
            subscriptionId: subscription.id,
            title: subscription.title,
            status: "failed",
            fetchedCount: 0,
            newCount: 0,
            error: "订阅源已停用。",
          })),
        });
      }
      return;
    }

    setIsRefreshing(true);
    setActionError("");
    setRefreshReport(null);

    try {
      const settledResults = await Promise.allSettled(
        targetSubscriptions.map(async (subscription) => {
          const response = await fetchWithTimeout(
            `/api/subscriptions/${subscription.id}/fetch`,
            {
              method: "POST",
            },
            12000,
          );
          const json = (await response.json()) as SubscriptionFetchResponse;

          if (json.result) {
            return json.result;
          }

          return {
            subscriptionId: subscription.id,
            title: subscription.title,
            status: response.ok ? "success" : "failed",
            fetchedCount: 0,
            newCount: 0,
            error: json.error || "刷新失败。",
          } satisfies RefreshResult;
        }),
      );
      const results = settledResults.map((result, index): RefreshResult => {
        if (result.status === "fulfilled") {
          return result.value;
        }

        const subscription = targetSubscriptions[index];
        return {
          subscriptionId: subscription.id,
          title: subscription.title,
          status: "failed",
          fetchedCount: 0,
          newCount: 0,
          error: getRequestErrorMessage(result.reason, "刷新失败。"),
        };
      });
      const failed = results.filter((result) => result.status === "failed").length;
      const success = results.length - failed;
      const report = {
        scope: selectedSourceId
          ? targetSubscriptions[0]?.title || "Selected source"
          : selectedFolder?.name || "All feeds",
        total: candidateSubscriptions.length,
        success,
        failed,
        skipped: candidateSubscriptions.length - targetSubscriptions.length,
        results,
      };

      await loadData();
      setRefreshReport(report);

      if (failed) {
        const failedSource = selectedSourceId
          ? targetSubscriptions[0]?.title
          : "";
        setActionError(
          failedSource
            ? `来源「${failedSource}」刷新失败，可稍后再试。`
            : `${failed} 个订阅源刷新失败，可稍后再试。`,
        );
      }
    } catch (error) {
      setActionError(getRequestErrorMessage(error, "刷新失败，请稍后再试。"));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handlePreview() {
    setIsPreviewing(true);
    setPreviewError("");

    try {
      const response = await fetchWithTimeout(
        "/api/subscriptions/preview",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputUrl: subscriptionInput }),
        },
        15000,
      );
      const json = (await response.json()) as {
        preview?: PreviewResult;
        error?: string;
      };

      if (!response.ok || !json.preview) {
        throw new Error(json.error || "无法预览该订阅源。");
      }

      setPreview(json.preview);
    } catch (error) {
      setPreview(null);
      setPreviewError(getRequestErrorMessage(error, "预览失败。"));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleConfirmSubscription() {
    setIsConfirming(true);
    setPreviewError("");

    try {
      const response = await fetchWithTimeout(
        "/api/subscriptions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputUrl: subscriptionInput }),
        },
        20000,
      );
      const json = (await response.json()) as SubscriptionActionResponse;

      if (!response.ok) {
        throw new Error(json.error || "订阅失败。");
      }

      await loadData();
      setShowAddModal(false);
      setActiveView("all");
      setSelectedSourceId("");
      setSelectedFolderId("");
      setActionError(
        json.alreadyExisted
          ? "订阅源已存在，已更新并刷新内容。"
          : "订阅源已添加并完成首次抓取。",
      );
    } catch (error) {
      setPreviewError(getRequestErrorMessage(error, "订阅失败。"));
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleUpdateSubscription(
    subscriptionId: string,
    patch: Pick<Partial<ApiSubscription>, "title" | "status" | "folderId">,
  ) {
    setActionError("");

    try {
      const response = await fetchWithTimeout(
        `/api/subscriptions/${subscriptionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
        10000,
      );
      const json = (await response.json()) as SubscriptionActionResponse;

      if (!response.ok || !json.subscription) {
        throw new Error(json.error || "更新订阅源失败。");
      }

      await loadData();
      setActionError("订阅源设置已更新。");
    } catch (error) {
      setActionError(getRequestErrorMessage(error, "更新订阅源失败。"));
    }
  }

  async function handleCreateSourceFolder(name: string) {
    setActionError("");

    try {
      const response = await fetchWithTimeout(
        "/api/source-folders",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
        10000,
      );
      const json = (await response.json()) as SourceFolderActionResponse;

      if (!response.ok || !json.folder) {
        throw new Error(json.error || "创建文件夹失败。");
      }

      await loadData();
      setActionError("文件夹已创建。");
      return json.folder.id;
    } catch (error) {
      setActionError(getRequestErrorMessage(error, "创建文件夹失败。"));
      return "";
    }
  }

  async function handleRenameSourceFolder(folderId: string, name: string) {
    setActionError("");

    try {
      const response = await fetchWithTimeout(
        `/api/source-folders/${folderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
        10000,
      );
      const json = (await response.json()) as SourceFolderActionResponse;

      if (!response.ok || !json.folder) {
        throw new Error(json.error || "重命名文件夹失败。");
      }

      await loadData();
      setActionError("文件夹已重命名。");
    } catch (error) {
      setActionError(getRequestErrorMessage(error, "重命名文件夹失败。"));
    }
  }

  async function handleDeleteSourceFolder(folderId: string) {
    setActionError("");

    try {
      const response = await fetchWithTimeout(
        `/api/source-folders/${folderId}`,
        { method: "DELETE" },
        10000,
      );
      const json = (await response.json()) as SourceFolderActionResponse;

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "删除文件夹失败。");
      }

      if (selectedFolderId === folderId) {
        setSelectedFolderId("");
        setSelectedSourceId("");
      }
      await loadData();
      setActionError("文件夹已删除，订阅源已移至 Uncategorized。");
    } catch (error) {
      setActionError(getRequestErrorMessage(error, "删除文件夹失败。"));
    }
  }

  async function handleAssignSubscriptionFolder(
    subscriptionId: string,
    folderId: string | null,
  ) {
    await handleUpdateSubscription(subscriptionId, { folderId });
  }

  async function handleDeleteSubscription(subscriptionId: string) {
    setActionError("");

    try {
      const response = await fetchWithTimeout(
        `/api/subscriptions/${subscriptionId}`,
        {
          method: "DELETE",
        },
        10000,
      );
      const json = (await response.json()) as SubscriptionActionResponse;

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "删除订阅源失败。");
      }

      delete stateOverridesRef.current[subscriptionId];
      if (selectedSourceId === subscriptionId) {
        setSelectedSourceId("");
      }
      setSelectedId("");
      await loadData();
      setActionError("订阅源已删除。");
    } catch (error) {
      setActionError(getRequestErrorMessage(error, "删除订阅源失败。"));
    }
  }

  return (
    <main className="flex h-screen min-w-0 overflow-hidden bg-[#fbfafb] text-[#1f2630]">
      <Sidebar
        activeView={activeView}
        sources={sources}
        folders={sourceFolders}
        selectedSourceId={selectedSourceId}
        selectedFolderId={selectedFolderId}
        navUnreadCounts={navUnreadCounts}
        onChangeView={(view) => {
          const nextSourceId = view === "all" ? "" : selectedSourceId;
          const nextFolderId = view === "all" ? "" : selectedFolderId;
          const nextFolderSourceIds =
            sourceFolders.find((folder) => folder.id === nextFolderId)
              ?.subscriptionIds ?? [];

          setActiveView(view);
          setSelectedSourceId(nextSourceId);
          setSelectedFolderId(nextFolderId);

          const nextItem =
            view === "settings"
              ? selectedId
              : getVisibleItems(
                  items,
                  view,
                  searchQuery,
                  nextSourceId,
                  nextFolderSourceIds,
                )[0]?.id;
          if (nextItem) {
            setSelectedId(nextItem);
          } else if (view !== "settings") {
            setSelectedId("");
          }
        }}
        onSelectFolder={(folderId) => {
          const folderSourceIds =
            sourceFolders.find((folder) => folder.id === folderId)
              ?.subscriptionIds ?? [];

          setSelectedFolderId(folderId);
          setSelectedSourceId("");
          const nextItem = getVisibleItems(
            items,
            activeView,
            searchQuery,
            "",
            folderSourceIds,
          )[0]?.id;
          setSelectedId(nextItem || "");
        }}
        onSelectSource={(sourceId) => {
          setSelectedSourceId(sourceId);
          setSelectedFolderId("");
          const nextItem = getVisibleItems(
            items,
            activeView,
            searchQuery,
            sourceId,
          )[0]?.id;
          setSelectedId(nextItem || "");
        }}
        onClearSource={() => {
          setSelectedSourceId("");
          setSelectedFolderId("");
          const nextItem = getVisibleItems(
            items,
            activeView,
            searchQuery,
            "",
          )[0]?.id;
          setSelectedId(nextItem || "");
        }}
        onAddSubscription={() => setShowAddModal(true)}
        onManageFolders={() => setShowFolderModal(true)}
        onRefreshFeeds={handleRefreshFeeds}
        isRefreshing={isRefreshing}
      />

      {actionError ? (
        <GlobalNotice message={actionError} onDismiss={() => setActionError("")} />
      ) : null}

      {refreshReport ? (
        <RefreshResultPanel
          report={refreshReport}
          onDismiss={() => setRefreshReport(null)}
        />
      ) : null}

      {activeView === "settings" ? (
        <SettingsView
          aiConfig={aiConfig}
          subscriptions={subscriptions}
          onUpdateSubscription={handleUpdateSubscription}
          onDeleteSubscription={handleDeleteSubscription}
          onImportComplete={loadData}
        />
      ) : loadError ? (
        <DataErrorState error={loadError} onRetry={() => void loadData()} />
      ) : isLoadingData && items.length === 0 ? (
        <LoadingState />
      ) : isEmptyState ? (
        <EmptyState onAddSubscription={() => setShowAddModal(true)} />
      ) : (
        <>
          <Timeline
            activeView={activeView}
            items={filteredItems}
            selectedId={selectedId}
            sources={sources}
            selectedSourceId={selectedSourceId}
            selectedSourceName={selectedSource?.name}
            folders={sourceFolders}
            selectedFolderId={selectedFolderId}
            selectedFolderName={selectedFolder?.name}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClearSearch={() => setSearchQuery("")}
            onSelectSource={(sourceId) => {
              setSelectedSourceId(sourceId);
              setSelectedFolderId("");
              const nextItem = getVisibleItems(
                items,
                activeView,
                searchQuery,
                sourceId,
              )[0]?.id;
              setSelectedId(nextItem || "");
            }}
            onSelectFolder={(folderId) => {
              const folderSourceIds =
                sourceFolders.find((folder) => folder.id === folderId)
                  ?.subscriptionIds ?? [];

              setSelectedFolderId(folderId);
              setSelectedSourceId("");
              const nextItem = getVisibleItems(
                items,
                activeView,
                searchQuery,
                "",
                folderSourceIds,
              )[0]?.id;
              setSelectedId(nextItem || "");
            }}
            onSelect={(id) => void handleSelectItem(id)}
          />
          {selectedItem ? (
            <DetailPanel
              item={selectedItem}
              actionError={actionError}
              aiConfig={aiConfig}
              isBusy={busyItemIds.has(selectedItem.id)}
              isSummarizing={summarizingItemIds.has(selectedItem.id)}
              isCopied={copiedItemId === selectedItem.id}
              summaryError={summaryErrors[selectedItem.id] || ""}
              onToggleRead={() => void handleToggleRead(selectedItem)}
              onToggleFavorite={() => void handleToggleFavorite(selectedItem)}
              onOpenOriginal={() => handleOpenOriginal(selectedItem)}
              onCopyLink={() => void handleCopyLink(selectedItem)}
              onGenerateSummary={() => void handleGenerateSummary(selectedItem)}
            />
          ) : null}
        </>
      )}

      {showAddModal ? (
        <AddSubscriptionModal
          input={subscriptionInput}
          preview={preview}
          previewError={previewError}
          isPreviewing={isPreviewing}
          isConfirming={isConfirming}
          onInputChange={setSubscriptionInput}
          onPreview={handlePreview}
          onClose={() => setShowAddModal(false)}
          onConfirm={handleConfirmSubscription}
        />
      ) : null}

      {showFolderModal ? (
        <SourceFolderModal
          folders={sourceFolders}
          subscriptions={subscriptions}
          onClose={() => setShowFolderModal(false)}
          onCreateFolder={handleCreateSourceFolder}
          onRenameFolder={handleRenameSourceFolder}
          onDeleteFolder={handleDeleteSourceFolder}
          onAssignSubscription={handleAssignSubscriptionFolder}
        />
      ) : null}
    </main>
  );
}

function GlobalNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed right-5 top-5 z-40 flex max-w-[420px] items-start gap-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 shadow-lg">
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss message"
        className="text-amber-900/70 transition hover:text-amber-950"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function RefreshResultPanel({
  report,
  onDismiss,
}: {
  report: RefreshReport;
  onDismiss: () => void;
}) {
  const totalNew = report.results.reduce((sum, result) => sum + result.newCount, 0);

  return (
    <aside className="fixed right-5 top-20 z-40 w-[420px] max-w-[calc(100vw-40px)] overflow-hidden rounded-md border border-[#cbd0d8] bg-white shadow-xl">
      <header className="flex items-start justify-between gap-4 border-b border-[#d8dce3] bg-[#f7f8f9] px-5 py-4">
        <div>
          <h3 className="text-[17px] font-bold text-[#263241]">
            Refresh Results
          </h3>
          <p className="mt-1 text-sm font-semibold text-[#69717d]">
            {report.scope}: {totalNew} new, {report.failed} failed
            {report.skipped ? `, ${report.skipped} skipped` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss refresh results"
          className="text-[#606873] transition hover:text-[#1f2630]"
        >
          <X size={18} />
        </button>
      </header>

      <div className="max-h-[360px] overflow-y-auto px-5 py-3">
        {report.results.map((result) => (
          <div
            key={result.subscriptionId}
            className="flex gap-3 border-b border-[#edf0f3] py-3 last:border-b-0"
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                result.status === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {result.status === "success" ? <Check size={15} /> : <X size={15} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-[15px] font-bold text-[#303843]">
                  {result.title}
                </p>
                <span className="shrink-0 text-xs font-bold text-[#647080]">
                  +{result.newCount}/{result.fetchedCount}
                </span>
              </div>
              {result.error ? (
                <p className="mt-2 text-sm font-semibold leading-5 text-red-700">
                  {result.error}
                </p>
              ) : (
                <p className="mt-2 text-sm font-semibold leading-5 text-[#647080]">
                  {result.fetchedCount} items checked.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function LoadingState() {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#fbfafb]">
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center text-center">
          <RefreshCcw size={34} className="animate-spin text-[#34495f]" />
          <p className="mt-5 text-[18px] font-bold text-[#3b4552]">
            Loading feeds...
          </p>
        </div>
      </div>
    </section>
  );
}

function DataErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#fbfafb]">
      <div className="flex flex-1 items-center justify-center px-8">
        <div className="max-w-[420px] text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded border border-red-200 bg-red-50 text-red-700">
            <X size={30} />
          </div>
          <h2 className="mt-6 text-[26px] font-bold text-[#263241]">
            Could not load feeds
          </h2>
          <p className="mt-4 text-[16px] font-semibold leading-7 text-[#616974]">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-7 inline-flex h-11 items-center gap-2 bg-[#4b5b70] px-6 text-[15px] font-semibold text-white transition hover:bg-[#3f4d60]"
          >
            <RefreshCcw size={17} />
            Retry
          </button>
        </div>
      </div>
    </section>
  );
}

function Sidebar({
  activeView,
  sources,
  folders,
  selectedSourceId,
  selectedFolderId,
  navUnreadCounts,
  onChangeView,
  onSelectFolder,
  onSelectSource,
  onClearSource,
  onAddSubscription,
  onManageFolders,
  onRefreshFeeds,
  isRefreshing,
}: {
  activeView: View;
  sources: SourceItem[];
  folders: SourceFolder[];
  selectedSourceId: string;
  selectedFolderId: string;
  navUnreadCounts: NavUnreadCounts;
  onChangeView: (view: View) => void;
  onSelectFolder: (folderId: string) => void;
  onSelectSource: (sourceId: string) => void;
  onClearSource: () => void;
  onAddSubscription: () => void;
  onManageFolders: () => void;
  onRefreshFeeds: () => void;
  isRefreshing: boolean;
}) {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set(["uncategorized"]),
  );
  const folderGroups = folders.map((folder) => ({
    ...folder,
    sources: sources.filter((source) => source.folderId === folder.id),
  }));
  const uncategorizedSources = sources.filter((source) => !source.folderId);
  const refreshLabel = isRefreshing
    ? "Refreshing"
    : selectedSourceId
      ? "Refresh Source"
      : selectedFolderId
        ? "Refresh Folder"
        : "Refresh";

  function setFolderExpanded(folderId: string, expanded: boolean) {
    setExpandedFolderIds((current) => {
      const next = new Set(current);

      if (expanded) {
        next.add(folderId);
      } else {
        next.delete(folderId);
      }

      return next;
    });
  }

  function toggleFolder(folderId: string) {
    setFolderExpanded(folderId, !expandedFolderIds.has(folderId));
  }

  return (
    <aside className="flex h-screen w-[212px] shrink-0 flex-col overflow-hidden border-r border-[#d4d8de] bg-[#f7f5f6] max-md:hidden">
      <div className="flex h-[102px] shrink-0 items-center justify-between gap-3 border-b border-[#d4d8de] px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[#48576a] text-xl font-semibold text-white">
            L
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold leading-6 text-[#263241]">LXY</h1>
            <p className="mt-1 truncate text-[15px] font-semibold text-[#565d66]">
              AI RSS Reader
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddSubscription}
          title="Add Subscription"
          aria-label="Add Subscription"
          className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-[#d4d8de] bg-[#eceaed] text-[#46566b] transition hover:border-[#aeb6c2] hover:bg-white hover:text-[#263241]"
        >
          <Plus size={22} strokeWidth={2.2} />
          <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 -translate-x-1/2 whitespace-nowrap rounded-sm bg-[#263241] px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
            Add Subscription
          </span>
        </button>
      </div>

      <nav className="grid shrink-0 grid-cols-5 gap-2 border-b border-[#d4d8de] px-4 py-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const count = navUnreadCounts[item.id];

          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onChangeView(item.id)}
              title={item.label}
              aria-label={item.label}
              className={`group relative flex h-9 w-8 items-center justify-center rounded-sm transition ${
                isActive
                  ? "bg-[#3f5268] text-white shadow-sm"
                  : "text-[#525960] hover:bg-[#efedf0] hover:text-[#263241]"
              }`}
            >
              <Icon size={20} strokeWidth={2.2} />
              {count ? (
                <span
                  className={`absolute -right-1 -top-1 min-w-4 rounded-full px-1 text-center text-[10px] font-bold leading-4 ${
                    isActive
                      ? "bg-white text-[#3f5268]"
                      : "bg-[#3f5268] text-white"
                  }`}
                >
                  {formatCompactCount(count)}
                </span>
              ) : null}
              <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 -translate-x-1/2 whitespace-nowrap rounded-sm bg-[#263241] px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                {item.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          title="Read Later"
          aria-label="Read Later"
          className="group relative flex h-9 w-8 items-center justify-center rounded-sm text-[#525960] transition hover:bg-[#efedf0] hover:text-[#263241]"
        >
          <Bookmark size={20} strokeWidth={2.2} />
          <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 -translate-x-1/2 whitespace-nowrap rounded-sm bg-[#263241] px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
            Read Later
          </span>
        </button>
      </nav>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[#5c6168]">
            Sources
          </h2>
          <div className="flex items-center gap-2">
            {selectedSourceId || selectedFolderId ? (
              <button
                type="button"
                onClick={onClearSource}
                className="text-xs font-bold text-[#34495f] transition hover:text-[#1f2630]"
              >
                All
              </button>
            ) : null}
            <button
              type="button"
              onClick={onManageFolders}
              title="Manage source folders"
              aria-label="Manage source folders"
              className="flex h-7 w-7 items-center justify-center rounded-sm border border-[#d3d7de] bg-white text-[#34495f] transition hover:border-[#aeb6c2] hover:bg-[#eef1f4]"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {folderGroups.map((folder) => {
            const isExpanded = expandedFolderIds.has(folder.id);
            const isSelected = selectedFolderId === folder.id;

            return (
              <div key={folder.id}>
                <div
                  className={`flex min-h-9 w-full items-center gap-2 rounded-sm border px-2 py-2 text-left transition ${
                    isSelected
                      ? "border-[#c9ced6] bg-white shadow-sm"
                      : "border-transparent hover:bg-[#efedf0]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      toggleFolder(folder.id);
                    }}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${folder.name}`}
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-[#4b5b70]"
                  >
                    {isExpanded ? (
                      <ChevronDown size={17} />
                    ) : (
                      <ChevronRight size={17} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFolderExpanded(folder.id, true);
                      onSelectFolder(folder.id);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {isExpanded ? (
                      <FolderOpen size={17} className="shrink-0 text-[#4b5b70]" />
                    ) : (
                      <Folder size={17} className="shrink-0 text-[#4b5b70]" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-[#3f4650]">
                      {folder.name}
                    </span>
                    {folder.unreadCount ? (
                      <span className="rounded bg-[#d9dde3] px-2 py-0.5 text-xs font-bold text-[#5e6671]">
                        {folder.unreadCount}
                      </span>
                    ) : null}
                  </button>
                </div>
                {isExpanded ? (
                  <div className="mt-1 space-y-1 border-l border-[#d8dce3] pl-5">
                    {folder.sources.map((source) => (
                      <SourceButton
                        key={source.id}
                        source={source}
                        isSelected={selectedSourceId === source.id}
                        onSelect={() => onSelectSource(source.id)}
                        nested
                      />
                    ))}
                    {folder.sources.length === 0 ? (
                      <p className="px-2 py-2 text-xs font-bold text-[#8a9098]">
                        No sources
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {uncategorizedSources.length ? (
            <div>
              <div className="px-2 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#7b828c]">
                Uncategorized
              </div>
              <div className="mt-1 space-y-1">
                {uncategorizedSources.map((source) => (
                  <SourceButton
                    key={source.id}
                    source={source}
                    isSelected={selectedSourceId === source.id}
                    onSelect={() => onSelectSource(source.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-[#d4d8de] bg-[#f7f5f6] p-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRefreshFeeds}
            disabled={isRefreshing || sources.length === 0}
            title={refreshLabel}
            aria-label={refreshLabel}
            className="group relative flex h-10 w-10 items-center justify-center rounded-sm text-[#525960] transition hover:bg-[#efedf0] hover:text-[#263241] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCcw
              size={20}
              className={isRefreshing ? "animate-spin" : ""}
            />
            <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-sm bg-[#263241] px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
              {refreshLabel}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChangeView("settings")}
            title="Settings"
            aria-label="Settings"
            className={`group relative flex h-10 w-10 items-center justify-center rounded-sm transition ${
              activeView === "settings"
                ? "bg-[#3f5268] text-white shadow-sm"
                : "text-[#525960] hover:bg-[#efedf0] hover:text-[#263241]"
            }`}
          >
            <Settings size={20} strokeWidth={2.2} />
            <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-sm bg-[#263241] px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
              Settings
            </span>
          </button>
        </div>
        <button
          type="button"
          className="mt-4 flex h-10 items-center gap-4 text-[15px] font-semibold text-[#525960]"
        >
          <UserCircle size={21} />
          Profile
        </button>
      </div>
    </aside>
  );
}

function SourceButton({
  source,
  isSelected,
  onSelect,
  nested = false,
}: {
  source: SourceItem;
  isSelected: boolean;
  onSelect: () => void;
  nested?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-9 w-full items-center gap-3 rounded-sm border py-2 text-left transition ${
        isSelected
          ? "border-[#c9ced6] bg-white shadow-sm"
          : "border-transparent hover:bg-[#efedf0]"
      } ${nested ? "px-1.5" : "px-2"}`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${source.color}`}
      >
        {source.initial}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#4d535b]">
        {source.name}
      </span>
      <SourceStatusDot status={source.status} />
      {source.unread ? (
        <span className="rounded bg-[#e1e0e2] px-2 py-0.5 text-xs font-bold text-[#6a6870]">
          {source.unread}
        </span>
      ) : null}
    </button>
  );
}

function SourceStatusDot({ status }: { status: SourceItem["status"] }) {
  const label =
    status === "online"
      ? "Source online"
      : status === "failed"
        ? "Source failed"
        : status === "inactive"
          ? "Source inactive"
          : "Source idle";

  if (status === "failed") {
    return (
      <span
        aria-label={label}
        title={label}
        className="flex h-4 w-4 items-center justify-center rounded-full bg-[#d64b4b] text-[10px] font-black leading-none text-white"
      >
        !
      </span>
    );
  }

  return (
    <span
      aria-label={label}
      title={label}
      className={`h-2 w-2 rounded-full ${
        status === "online"
          ? "bg-[#17bf7d]"
          : status === "inactive"
            ? "bg-[#7a828d]"
            : "bg-[#b7bdc6]"
      }`}
    />
  );
}

function Timeline({
  activeView,
  items,
  selectedId,
  sources,
  selectedSourceId,
  selectedSourceName,
  folders,
  selectedFolderId,
  selectedFolderName,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onSelectSource,
  onSelectFolder,
  onSelect,
}: {
  activeView: View;
  items: FeedItem[];
  selectedId: string;
  sources: SourceItem[];
  selectedSourceId: string;
  selectedSourceName?: string;
  folders: SourceFolder[];
  selectedFolderId: string;
  selectedFolderName?: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onSelectSource: (sourceId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onSelect: (id: string) => void;
}) {
  const viewTitle =
    activeView === "videos"
      ? "Videos"
      : activeView === "articles"
        ? "Articles"
        : activeView === "favorites"
          ? "Favorites"
          : "All Feeds";
  const title = selectedSourceName || selectedFolderName || viewTitle;

  return (
    <section className="flex w-[312px] shrink-0 flex-col border-r border-[#d4d8de] bg-[#fbfafb] max-md:w-[45vw]">
      <header className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 border-b border-[#d4d8de] px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-[22px] font-bold text-[#263241]">
            {title}
          </h2>
          {selectedSourceName || selectedFolderName ? (
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[#69717d]">
              {viewTitle}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-[#303843]">
          <SourceSelect
            sources={sources}
            folders={folders}
            selectedSourceId={selectedSourceId}
            selectedFolderId={selectedFolderId}
            onSelectSource={onSelectSource}
            onSelectFolder={onSelectFolder}
          />
          <SearchBox
            value={searchQuery}
            onChange={onSearchChange}
            onClear={onClearSearch}
          />
          <button type="button" aria-label="Filter timeline">
            <Filter size={21} />
          </button>
          <button type="button" aria-label="More timeline actions">
            <MoreVertical size={21} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <SearchEmptyState
            searchQuery={searchQuery}
            selectedSourceName={selectedSourceName || selectedFolderName}
            onClear={onClearSearch}
          />
        ) : items.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex w-full gap-3 border-b border-[#d4d8de] px-4 py-5 text-left transition max-md:px-3 ${
              selectedId === item.id
                ? "bg-white shadow-[inset_2px_0_0_#34495f]"
                : "bg-[#fbfafb] hover:bg-white"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[14px] font-bold text-[#45505c]">
                {!item.read ? (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#34495f]" />
                ) : null}
                <span className="min-w-0 truncate">{item.source}</span>
                <span className="shrink-0 rounded bg-[#e3e2e4] px-2 py-0.5 text-xs text-[#555a62]">
                  {item.type}
                </span>
                <span className="ml-auto shrink-0 text-[13px] text-[#555a62]">
                  {item.time}
                </span>
              </div>
              <h3 className="mt-3 line-clamp-2 text-[17px] font-bold leading-6 text-[#222831]">
                {item.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-[15px] font-medium leading-5 text-[#5d636b]">
                {item.excerpt}
              </p>
              {item.type === "Update" ? (
                <div className="mt-4 flex gap-5 text-sm font-semibold text-[#4d5662]">
                  <span className="flex items-center gap-1">
                    <Star size={16} /> {item.reactions}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bookmark size={16} /> {item.comments}
                  </span>
                </div>
              ) : null}
            </div>

            {item.thumbnail || item.type === "Video" ? (
              <div
                className="relative mt-7 flex h-[78px] w-[78px] shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[#d8d6d4] bg-cover bg-center text-[#34495f]"
                style={
                  item.thumbnail
                    ? { backgroundImage: `url(${item.thumbnail})` }
                    : undefined
                }
                aria-label={item.thumbnail ? undefined : "Video without cover"}
              >
                {!item.thumbnail ? (
                  <PlatformPlaceholder item={item} compact />
                ) : null}
                {item.duration ? (
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-white">
                    {item.duration}
                  </span>
                ) : null}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function SourceSelect({
  sources,
  folders,
  selectedSourceId,
  selectedFolderId,
  onSelectSource,
  onSelectFolder,
}: {
  sources: SourceItem[];
  folders: SourceFolder[];
  selectedSourceId: string;
  selectedFolderId: string;
  onSelectSource: (sourceId: string) => void;
  onSelectFolder: (folderId: string) => void;
}) {
  const selectedValue = selectedSourceId
    ? `source:${selectedSourceId}`
    : selectedFolderId
      ? `folder:${selectedFolderId}`
      : "";

  return (
    <label className="hidden h-9 items-center gap-2 border border-[#cbd0d8] bg-white px-2 text-[#6a7078] max-md:flex">
      <Rss size={16} />
      <select
        value={selectedValue}
        onChange={(event) => {
          const value = event.target.value;

          if (value.startsWith("folder:")) {
            onSelectFolder(value.replace("folder:", ""));
            return;
          }

          onSelectSource(value.replace("source:", ""));
        }}
        aria-label="Filter by source"
        className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#303843] outline-none"
      >
        <option value="">All Sources</option>
        {folders.map((folder) => (
          <option key={folder.id} value={`folder:${folder.id}`}>
            {folder.name}
          </option>
        ))}
        {sources.map((source) => (
          <option key={source.id} value={`source:${source.id}`}>
            {source.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SearchBox({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <label className="flex h-9 w-[150px] items-center gap-2 border border-[#cbd0d8] bg-white px-3 text-[#6a7078] max-md:w-[128px]">
      <Search size={17} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search"
        className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-[#263241] outline-none placeholder:text-[#747b84]"
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="text-[#606873] transition hover:text-[#1f2630]"
        >
          <X size={15} />
        </button>
      ) : null}
    </label>
  );
}

function SearchEmptyState({
  searchQuery,
  selectedSourceName,
  onClear,
}: {
  searchQuery: string;
  selectedSourceName?: string;
  onClear: () => void;
}) {
  const hasSearch = searchQuery.trim().length > 0;
  const hasSource = Boolean(selectedSourceName);

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded border border-[#cfd4dc] bg-white text-[#34495f]">
        <Search size={26} />
      </div>
      <h3 className="mt-5 text-[20px] font-bold text-[#263241]">
        {hasSearch
          ? "No matching items"
          : hasSource
            ? "No items from this source"
            : "No items in this view"}
      </h3>
      <p className="mt-3 text-[15px] font-semibold leading-6 text-[#646b75]">
        {hasSearch
          ? `Nothing matched "${searchQuery.trim()}".`
          : hasSource
            ? `Try another view or refresh ${selectedSourceName}.`
            : "Try another view or add a subscription."}
      </p>
      {hasSearch ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 h-10 border border-[#cbd0d8] bg-white px-5 text-[14px] font-bold text-[#303843] transition hover:bg-[#f4f5f6]"
        >
          Clear Search
        </button>
      ) : null}
    </div>
  );
}

function IconTooltipButton({
  label,
  children,
  onClick,
  disabled = false,
  variant = "ghost",
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "ghost" | "primary" | "active";
  className?: string;
}) {
  const variantClass =
    variant === "primary"
      ? "bg-[#34495f] text-white hover:bg-[#2b3c50]"
      : variant === "active"
        ? "bg-[#34495f] text-white shadow-sm"
        : "border border-[#c9ced6] bg-[#f6f4f5] text-[#2f3540] hover:bg-white";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${className}`}
    >
      {children}
      <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-sm bg-[#263241] px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

function DetailPanel({
  item,
  actionError,
  aiConfig,
  isBusy,
  isSummarizing,
  isCopied,
  summaryError,
  onToggleRead,
  onToggleFavorite,
  onOpenOriginal,
  onCopyLink,
  onGenerateSummary,
}: {
  item: FeedItem;
  actionError: string;
  aiConfig: AiConfig;
  isBusy: boolean;
  isSummarizing: boolean;
  isCopied: boolean;
  summaryError: string;
  onToggleRead: () => void;
  onToggleFavorite: () => void;
  onOpenOriginal: () => void;
  onCopyLink: () => void;
  onGenerateSummary: () => void;
}) {
  const copyLabel = isCopied ? "Copied" : "Copy Link";
  const favoriteLabel = item.favorite ? "Remove favorite" : "Favorite";
  const readLabel = item.read ? "Mark Unread" : "Mark Read";
  const summaryLabel = item.aiSummary
    ? isSummarizing
      ? "Regenerating"
      : "Regenerate"
    : isSummarizing
      ? "Generating"
      : "Generate Summary";

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#fbfafb]">
      <header className="flex min-h-[72px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#d4d8de] px-5 py-3">
        <div className="flex min-w-0 items-center gap-3 text-[15px] font-bold text-[#202934]">
          <span className="min-w-0 truncate">{item.source}</span>
          <span className="h-1 w-1 shrink-0 rounded-full bg-[#bec3ca]" />
          <span className="shrink-0 text-[#59616b]">{item.time}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <IconTooltipButton label="Open Original" onClick={onOpenOriginal}>
            <ExternalLink size={18} />
          </IconTooltipButton>
          <IconTooltipButton label={copyLabel} onClick={onCopyLink}>
            {isCopied ? <Check size={18} /> : <Copy size={18} />}
          </IconTooltipButton>
          <IconTooltipButton
            label={favoriteLabel}
            onClick={onToggleFavorite}
            disabled={isBusy}
            variant={item.favorite ? "active" : "ghost"}
          >
            <Star size={22} fill={item.favorite ? "currentColor" : "none"} />
          </IconTooltipButton>
          <IconTooltipButton
            label={readLabel}
            onClick={onToggleRead}
            disabled={isBusy}
          >
            <Check size={18} />
          </IconTooltipButton>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8">
        <article className="mx-auto max-w-[920px]">
          <h2 className="max-w-[820px] break-words text-[24px] font-bold leading-[1.25] text-[#1d232c]">
            {item.title}
          </h2>

          {item.type === "Video" ? (
            <VideoPlayer
              key={item.id}
              item={item}
              onOpenOriginal={onOpenOriginal}
            />
          ) : (
            <ContentBlock item={item} />
          )}

          {item.type === "Video" ? <ContentBlock item={item} /> : null}

          {actionError ? (
            <div className="mt-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {actionError}
            </div>
          ) : null}

          <section className="mt-9 rounded-md border border-[#cfd4dc] bg-white p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sparkles size={25} className="text-[#34495f]" />
                <h3 className="text-[24px] font-bold text-[#2f3b4a]">
                  AI Summary
                </h3>
              </div>
              <IconTooltipButton
                label={summaryLabel}
                onClick={onGenerateSummary}
                disabled={isSummarizing || !aiConfig.configured}
                variant="primary"
              >
                {isSummarizing ? (
                  <RefreshCcw size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
              </IconTooltipButton>
            </div>

            {!aiConfig.configured ? (
              <div className="mt-5 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                OPENAI_API_KEY is not configured for the server.
              </div>
            ) : null}

            {summaryError ? (
              <div className="mt-5 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {summaryError}
              </div>
            ) : null}

            <p className="mt-6 max-w-[780px] text-[18px] font-medium leading-8 text-[#5d636b]">
              {item.aiSummary ||
                "No AI summary yet. Generate it manually when this item is worth a closer read."}
            </p>

            {item.aiSummary ? (
              <div className="mt-8 rounded border border-[#cfd4dc] bg-[#fbfafb] p-5">
                <h4 className="text-sm font-bold uppercase tracking-[0.08em] text-[#242b34]">
                  Source Context
                </h4>
                <p className="mt-4 text-[17px] font-medium leading-7 text-[#606771]">
                  {item.excerpt}
                </p>
              </div>
            ) : null}
          </section>
        </article>
      </div>
    </section>
  );
}

function ContentBlock({ item }: { item: FeedItem }) {
  const body = item.bodyText || item.excerpt;

  return (
    <section className="mt-7 rounded-md border border-[#cfd4dc] bg-white p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FileText size={22} className="text-[#34495f]" />
          <h3 className="text-[20px] font-bold text-[#2f3b4a]">
            Content Context
          </h3>
        </div>
        <span className="rounded bg-[#eef0f3] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#59616b]">
          {item.platform}
        </span>
      </div>
      <p className="mt-5 whitespace-pre-wrap text-[17px] font-medium leading-8 text-[#4b535d]">
        {body}
      </p>
      {body !== item.excerpt ? (
        <div className="mt-6 border-t border-[#e1e4e8] pt-5">
          <h4 className="text-sm font-bold uppercase tracking-[0.08em] text-[#69717d]">
            Feed Summary
          </h4>
          <p className="mt-3 text-[15px] font-semibold leading-6 text-[#606873]">
            {item.excerpt}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function VideoPlayer({
  item,
  onOpenOriginal,
}: {
  item: FeedItem;
  onOpenOriginal: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<VideoPlayerStatus>("idle");
  const hasCover = Boolean(item.thumbnail);
  const playableEmbedUrl = getPlayableEmbedUrl(item);
  const playerId = `yt-player-${item.id}`;

  useEffect(() => {
    if (!isPlaying || !playableEmbedUrl.includes("youtube")) {
      return;
    }

    function handleMessage(event: MessageEvent) {
      if (!String(event.origin).includes("youtube")) {
        return;
      }

      const data =
        typeof event.data === "string"
          ? parseYouTubePlayerMessage(event.data)
          : event.data;

      if (!data || (data.id && data.id !== playerId)) {
        return;
      }

      if (data.event === "onReady") {
        postYouTubeCommand(playerId, "playVideo");
      }

      if (data.event === "onStateChange" && data.info === 1) {
        setPlayerStatus("playing");
      }

      if (data.event === "onError") {
        setPlayerStatus("blocked");
      }
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [isPlaying, playableEmbedUrl, playerId]);

  useEffect(() => {
    if (!isPlaying || !playableEmbedUrl) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPlayerStatus((current) =>
        current === "loading" ? "playing" : current,
      );
    }, playableEmbedUrl.includes("youtube") ? 2500 : 1500);

    return () => window.clearTimeout(timeoutId);
  }, [isPlaying, playableEmbedUrl]);

  function startEmbeddedPlayback() {
    setPlayerStatus("loading");
    setIsPlaying(true);
  }

  function stopEmbeddedPlayback() {
    setPlayerStatus("idle");
    setIsPlaying(false);
  }

  function notifyYouTubePlayerReady(event: SyntheticEvent<HTMLIFrameElement>) {
    const contentWindow = event.currentTarget.contentWindow;

    if (!event.currentTarget.src.includes("youtube")) {
      setPlayerStatus("playing");
      return;
    }

    if (!contentWindow) {
      return;
    }

    contentWindow.postMessage(
      JSON.stringify({ event: "listening", id: playerId }),
      "https://www.youtube.com",
    );
    postYouTubeCommand(playerId, "playVideo");
  }

  if (isPlaying && playableEmbedUrl) {
    return (
      <>
        <div className="relative mt-9 aspect-video overflow-hidden rounded-md border border-[#cfd4dc] bg-[#111827]">
          <iframe
            id={playerId}
            src={getAutoplayEmbedUrl(playableEmbedUrl)}
            title={item.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={notifyYouTubePlayerReady}
            allowFullScreen
          />
          <button
            type="button"
            onClick={stopEmbeddedPlayback}
            title="Show Cover"
            aria-label="Show Cover"
            className="group absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-sm bg-white/95 text-[#263241] shadow transition hover:bg-white"
          >
            <EyeOff size={18} />
            <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-sm bg-[#263241] px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
              Show Cover
            </span>
          </button>
          {playerStatus === "blocked" ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#282828] px-5 pt-12 text-[#eeeeee] xl:px-8 xl:pt-14">
              <div className="flex max-w-[760px] flex-col items-center gap-2 text-center xl:flex-row xl:gap-8 xl:text-left">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[5px] border-[#c7c7c7] text-[32px] font-black leading-none text-[#c7c7c7] xl:h-24 xl:w-24 xl:border-[10px] xl:text-[64px]">
                  !
                </div>
                <div>
                  <p className="text-[18px] font-bold leading-tight xl:text-[28px]">
                    视频无法播放
                  </p>
                  <p className="mt-1 text-[13px] font-medium leading-5 text-[#eeeeee] xl:mt-5 xl:text-[22px] xl:leading-9">
                    视频所有者已禁止在其他网站上播放此视频
                    <br />
                    <button
                      type="button"
                      onClick={onOpenOriginal}
                      className="underline underline-offset-4"
                    >
                      在 YouTube 上观看
                    </button>
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <VideoActions
          canEmbed={Boolean(playableEmbedUrl)}
          status={playerStatus}
          externalPlayLabel="Open Video"
          onPlay={startEmbeddedPlayback}
          onOpenOriginal={onOpenOriginal}
        />
      </>
    );
  }

  return (
    <>
      <div className="relative mt-9 aspect-video overflow-hidden rounded-md border border-[#cfd4dc] bg-[#d7d2cb]">
        {hasCover ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${item.thumbnail})` }}
            aria-hidden="true"
          />
        ) : (
          <div className="relative h-full w-full bg-[#ece9e6] text-[#34495f]">
            <PlatformPlaceholder item={item} cover />
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (playableEmbedUrl) {
              startEmbeddedPlayback();
            } else {
              onOpenOriginal();
            }
          }}
          aria-label={playableEmbedUrl ? "Play embedded video" : "Open video"}
          className="absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-white/95 text-[#34495f] shadow-lg transition hover:scale-105"
        >
          <Video size={30} fill="currentColor" />
        </button>
      </div>
      <VideoActions
        canEmbed={Boolean(playableEmbedUrl)}
        status={playerStatus}
        externalPlayLabel="Open Video"
        onPlay={startEmbeddedPlayback}
        onOpenOriginal={onOpenOriginal}
      />
      {!playableEmbedUrl ? (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          This video cannot be embedded from its feed link. Open the video page
          to watch it.
        </p>
      ) : null}
    </>
  );
}

function VideoActions({
  canEmbed,
  status,
  externalPlayLabel,
  onPlay,
  onOpenOriginal,
}: {
  canEmbed: boolean;
  status: VideoPlayerStatus;
  externalPlayLabel: string;
  onPlay: () => void;
  onOpenOriginal: () => void;
}) {
  const embedLabel =
    status === "loading"
      ? "Loading"
      : status === "playing"
        ? "Playing"
        : status === "blocked"
          ? "Cannot Embed"
          : "Play Embedded";

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {canEmbed ? (
        <IconTooltipButton
          label={embedLabel}
          onClick={onPlay}
          disabled={status === "loading" || status === "playing"}
          variant="primary"
        >
          <Video size={16} fill="currentColor" />
        </IconTooltipButton>
      ) : (
        <IconTooltipButton
          label={externalPlayLabel}
          onClick={onOpenOriginal}
          variant="primary"
        >
          <Video size={16} fill="currentColor" />
        </IconTooltipButton>
      )}
      <IconTooltipButton label="Open Video Page" onClick={onOpenOriginal}>
        <ExternalLink size={16} />
      </IconTooltipButton>
    </div>
  );
}

function PlatformPlaceholder({
  item,
  compact = false,
  cover = false,
}: {
  item: FeedItem;
  compact?: boolean;
  cover?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#eef0f3] text-[18px] font-black text-[#34495f]">
        {item.sourceInitial}
      </div>
    );
  }

  if (cover) {
    return (
      <div className="h-full w-full bg-[linear-gradient(135deg,#eef0f3,#d9dde4)]">
        <div className="absolute left-6 top-6 rounded border border-[#c4cbd5] bg-white/75 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#647080] shadow-sm">
          {item.platform}
        </div>
        <div className="absolute bottom-6 left-6 right-6">
          <p className="truncate text-[24px] font-bold text-[#263241]">
            {item.source}
          </p>
          <p className="mt-2 line-clamp-2 max-w-[540px] text-[16px] font-semibold leading-6 text-[#5e6874]">
            {item.title}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[linear-gradient(135deg,#eef0f3,#d9dde4)] px-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-md border border-[#c4cbd5] bg-white/80 text-[#34495f] shadow-sm">
        {item.type === "Video" ? <Video size={31} /> : <FileText size={31} />}
      </div>
      <p className="mt-5 text-sm font-bold uppercase tracking-[0.12em] text-[#647080]">
        {item.platform}
      </p>
      <p className="mt-2 max-w-[420px] truncate text-[22px] font-bold text-[#263241]">
        {item.source}
      </p>
    </div>
  );
}

function EmptyState({ onAddSubscription }: { onAddSubscription: () => void }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#fbfafb]">
      <header className="flex h-[72px] items-center justify-between border-b border-[#d4d8de] px-6">
        <h2 className="text-[22px] font-bold text-[#263241]">All Feeds</h2>
        <TopActions />
      </header>
      <div className="flex flex-1 items-center justify-center">
        <div className="mb-20 flex max-w-[380px] flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-[#cfd4dc] bg-[#f0eff1] text-[#34495f] shadow-sm">
            <FileText size={38} />
          </div>
          <h2 className="mt-8 text-[28px] font-bold text-[#1d232c]">
            No subscriptions yet.
          </h2>
          <p className="mt-5 text-[17px] font-medium leading-7 text-[#575e68]">
            Start by adding your favorite creators from YouTube, Bilibili,
            Weibo, or RSS.
          </p>
          <button
            type="button"
            onClick={onAddSubscription}
            className="mt-9 flex h-12 items-center gap-3 bg-[#4b5b70] px-9 text-[15px] font-semibold text-white transition hover:bg-[#3f4d60]"
          >
            <Plus size={18} />
            Add First Subscription
          </button>
        </div>
      </div>
    </section>
  );
}

function SettingsView({
  aiConfig,
  subscriptions,
  onUpdateSubscription,
  onDeleteSubscription,
  onImportComplete,
}: {
  aiConfig: AiConfig;
  subscriptions: ApiSubscription[];
  onUpdateSubscription: (
    subscriptionId: string,
    patch: Pick<Partial<ApiSubscription>, "title" | "status" | "folderId">,
  ) => void;
  onDeleteSubscription: (subscriptionId: string) => void;
  onImportComplete: () => Promise<void>;
}) {
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState(
    subscriptions[0]?.id || "",
  );
  const [draftTitles, setDraftTitles] = useState<Record<string, string>>({});
  const [isImportingOpml, setIsImportingOpml] = useState(false);
  const [opmlMessage, setOpmlMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const effectiveSelectedSubscriptionId = subscriptions.some(
    (subscription) => subscription.id === selectedSubscriptionId,
  )
    ? selectedSubscriptionId
    : subscriptions[0]?.id || "";
  const selectedSubscription =
    subscriptions.find(
      (subscription) => subscription.id === effectiveSelectedSubscriptionId,
    ) ||
    subscriptions[0];
  const draftTitle = selectedSubscription
    ? (draftTitles[selectedSubscription.id] ?? selectedSubscription.title)
    : "";

  async function handleExportOpml() {
    setOpmlMessage("");

    try {
      const response = await fetchWithTimeout(
        "/api/subscriptions/opml",
        {},
        10000,
      );

      if (!response.ok) {
        throw new Error("OPML 导出失败。");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "lxy-subscriptions.opml";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setOpmlMessage("OPML 已导出。");
    } catch (error) {
      setOpmlMessage(getRequestErrorMessage(error, "OPML 导出失败。"));
    }
  }

  async function handleImportOpml(file: File | null) {
    if (!file) {
      return;
    }

    setIsImportingOpml(true);
    setOpmlMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetchWithTimeout(
        "/api/subscriptions/opml",
        {
          method: "POST",
          body: formData,
        },
        15000,
      );
      const json = (await response.json()) as OpmlImportResult;

      if (!response.ok) {
        throw new Error(json.error || "OPML 导入失败。");
      }

      await onImportComplete();
      setOpmlMessage(
        `导入完成：新增 ${json.imported} 个，更新 ${json.updated} 个，失败 ${json.failed} 个。`,
      );
    } catch (error) {
      setOpmlMessage(getRequestErrorMessage(error, "OPML 导入失败。"));
    } finally {
      setIsImportingOpml(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#fbfafb]">
      <header className="flex h-[72px] items-center justify-end border-b border-[#d4d8de] px-10">
        <TopActions />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-12 py-10">
        <div className="mx-auto max-w-[1070px]">
          <h2 className="text-[30px] font-bold text-[#2a3543]">Settings</h2>
          <p className="mt-3 text-[18px] font-medium text-[#585f69]">
            Manage your application preferences, network configuration, and AI
            integrations.
          </p>

          <div className="mt-7 border-t border-[#cbd0d8] pt-9">
            <section className="rounded-md border border-[#cbd0d8] bg-white p-7">
              <div className="flex items-center gap-3 text-[#2d3847]">
                <Settings size={21} />
                <h3 className="text-[24px] font-bold">General</h3>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-14">
                <Field label="Theme Preference">
                  <div className="inline-flex h-12 overflow-hidden border border-[#cbd0d8] bg-[#f3f1f3]">
                    <button
                      type="button"
                      className="flex w-32 items-center justify-center gap-2 border-r border-[#cbd0d8] bg-white text-[16px] font-semibold text-[#344052]"
                    >
                      <Sun size={18} />
                      Light
                    </button>
                    <button
                      type="button"
                      className="flex w-32 items-center justify-center gap-2 text-[16px] font-semibold text-[#4e545d]"
                    >
                      <Moon size={18} />
                      Dark
                    </button>
                  </div>
                </Field>

                <Field label="Data Storage Location">
                  <div className="flex h-12 items-center justify-between border border-[#cbd0d8] bg-[#f3f1f3] px-4 text-[17px] font-medium text-[#4d535c]">
                    Local SQLite
                    <Database size={19} />
                  </div>
                  <p className="mt-4 text-sm font-bold text-[#647080]">
                    All feed data is stored securely on your local device.
                  </p>
                </Field>
              </div>
            </section>

            <div className="mt-7 grid grid-cols-2 gap-7">
              <section className="rounded-md border border-[#cbd0d8] bg-white p-7">
                <div className="flex items-center gap-3 text-[#2d3847]">
                  <Rss size={21} />
                  <h3 className="text-[24px] font-bold">Network</h3>
                </div>
                <div className="mt-8 space-y-6">
                  <Field label="RSSHub Base URL">
                    <input
                      value="https://rsshub.app"
                      readOnly
                      className="h-12 w-full border border-[#cbd0d8] bg-white px-4 text-[17px] font-medium text-[#2d333b] outline-none"
                    />
                  </Field>
                  <Field label="Background Refresh Interval">
                    <button
                      type="button"
                      className="flex h-12 w-full items-center justify-between border border-[#cbd0d8] bg-white px-4 text-left text-[17px] font-medium text-[#2d333b]"
                    >
                      Every 1 Hour
                      <ChevronDown size={19} />
                    </button>
                  </Field>
                </div>
              </section>

              <section className="rounded-md border border-[#cbd0d8] bg-white p-7">
                <div className="flex items-center gap-3 text-[#2d3847]">
                  <Bot size={21} />
                  <h3 className="text-[24px] font-bold">AI Configuration</h3>
                </div>
                <div className="mt-8 space-y-6">
                  <Field
                    label="AI API Key"
                    accessory={
                      <span
                        className={`text-sm font-bold ${
                          aiConfig.configured
                            ? "text-[#147a55]"
                            : "text-[#a15f13]"
                        }`}
                      >
                        {aiConfig.configured ? "Configured" : "Missing"}
                      </span>
                    }
                  >
                    <div className="flex h-12 items-center border border-[#cbd0d8] bg-white px-4">
                      <input
                        value={
                          aiConfig.configured
                            ? "••••••••••••••••••••••"
                            : "OPENAI_API_KEY"
                        }
                        readOnly
                        className="min-w-0 flex-1 text-[17px] font-medium text-[#2d333b] outline-none"
                      />
                      <EyeOff size={20} />
                    </div>
                  </Field>
                  <Field label="Default AI Model">
                    <button
                      type="button"
                      className="flex h-12 w-full items-center justify-between border border-[#cbd0d8] bg-white px-4 text-left text-[17px] font-medium text-[#2d333b]"
                    >
                      {aiConfig.model}
                      <ChevronDown size={19} />
                    </button>
                  </Field>
                </div>
              </section>
            </div>

            <section className="mt-7 rounded-md border border-[#cbd0d8] bg-white p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3 text-[#2d3847]">
                  <FileText size={21} />
                  <h3 className="text-[24px] font-bold">OPML</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleExportOpml()}
                    className="flex h-11 items-center gap-2 border border-[#cbd0d8] bg-white px-4 text-[14px] font-semibold text-[#303843] transition hover:bg-[#f4f5f6]"
                  >
                    <Download size={16} />
                    Export OPML
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImportingOpml}
                    className="flex h-11 items-center gap-2 bg-[#4b5b70] px-4 text-[14px] font-semibold text-white transition hover:bg-[#3f4d60] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Upload size={16} />
                    {isImportingOpml ? "Importing" : "Import OPML"}
                  </button>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".opml,.xml,text/xml,text/x-opml"
                className="hidden"
                onChange={(event) =>
                  void handleImportOpml(event.currentTarget.files?.[0] || null)
                }
              />
              {opmlMessage ? (
                <p className="mt-5 border border-[#d7dbe2] bg-[#fbfafb] px-4 py-3 text-[14px] font-semibold text-[#4b5563]">
                  {opmlMessage}
                </p>
              ) : null}
            </section>

            <section className="mt-7 rounded-md border border-[#cbd0d8] bg-white p-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-[#2d3847]">
                  <Rss size={21} />
                  <h3 className="text-[24px] font-bold">Sources</h3>
                </div>
                <span className="text-sm font-bold text-[#647080]">
                  {subscriptions.length} sources
                </span>
              </div>

              {selectedSubscription ? (
                <div className="mt-8 grid grid-cols-[300px_1fr] gap-7 max-lg:grid-cols-1">
                  <div className="max-h-[420px] overflow-y-auto border border-[#d7dbe2]">
                    {subscriptions.map((subscription) => {
                      const isSelected = subscription.id === selectedSubscription.id;
                      const isInactive = subscription.status === "inactive";

                      return (
                        <button
                          type="button"
                          key={subscription.id}
                          onClick={() => setSelectedSubscriptionId(subscription.id)}
                          className={`flex w-full items-start gap-3 border-b border-[#e0e3e8] px-4 py-4 text-left transition last:border-b-0 ${
                            isSelected ? "bg-[#f3f5f7]" : "bg-white hover:bg-[#f8f9fa]"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getSourceColor(
                              subscription.sourceType,
                            )}`}
                          >
                            {subscription.title.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-bold text-[#2d333b]">
                              {subscription.title}
                            </span>
                            <span className="mt-1 block text-xs font-bold uppercase tracking-[0.08em] text-[#69717d]">
                              {isInactive ? "Inactive" : subscription.status}
                            </span>
                          </span>
                          <SourceStatusDot
                            status={
                              isInactive
                                ? "inactive"
                                : subscription.status === "failed"
                                  ? "failed"
                                  : subscription.status === "active"
                                    ? "online"
                                    : "idle"
                            }
                          />
                        </button>
                      );
                    })}
                  </div>

                  <div className="min-w-0 border border-[#d7dbe2] bg-[#fbfafb] p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="truncate text-[22px] font-bold text-[#263241]">
                          {selectedSubscription.title}
                        </h4>
                        <p className="mt-2 text-sm font-bold uppercase tracking-[0.08em] text-[#69717d]">
                          {selectedSubscription.sourceType}
                        </p>
                      </div>
                      <span
                        className={`rounded px-3 py-2 text-sm font-bold ${
                          selectedSubscription.status === "inactive"
                            ? "bg-slate-100 text-slate-600"
                            : selectedSubscription.status === "failed"
                              ? "bg-red-50 text-red-700"
                              : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {selectedSubscription.status === "inactive"
                          ? "Inactive"
                          : selectedSubscription.status === "failed"
                            ? "Failed"
                            : "Active"}
                      </span>
                    </div>

                    <div className="mt-7 grid grid-cols-2 gap-5 max-lg:grid-cols-1">
                      <Field label="Display Name">
                        <div className="flex gap-3">
                          <input
                            value={draftTitle}
                            onChange={(event) =>
                              setDraftTitles((current) => ({
                                ...current,
                                [selectedSubscription.id]: event.target.value,
                              }))
                            }
                            className="h-12 min-w-0 flex-1 border border-[#cbd0d8] bg-white px-4 text-[16px] font-medium text-[#2d333b] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateSubscription(selectedSubscription.id, {
                                title: draftTitle,
                              })
                            }
                            disabled={draftTitle.trim() === selectedSubscription.title}
                            className="flex h-12 items-center gap-2 bg-[#4b5b70] px-4 text-[14px] font-semibold text-white transition hover:bg-[#3f4d60] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Pencil size={16} />
                            Rename
                          </button>
                        </div>
                      </Field>

                      <Field label="Last Fetch">
                        <div className="flex h-12 items-center border border-[#cbd0d8] bg-white px-4 text-[16px] font-medium text-[#2d333b]">
                          {formatDateTime(selectedSubscription.lastFetchedAt)}
                        </div>
                      </Field>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-5 max-lg:grid-cols-1">
                      <DetailValue
                        label="Original URL"
                        value={selectedSubscription.inputUrl}
                      />
                      <DetailValue label="Feed URL" value={selectedSubscription.feedUrl} />
                      <DetailValue
                        label="Site URL"
                        value={selectedSubscription.siteUrl || "Not available"}
                      />
                      <DetailValue
                        label="Items"
                        value={`${selectedSubscription._count?.items ?? 0}`}
                      />
                    </div>

                    {selectedSubscription.lastError ? (
                      <div className="mt-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                        {selectedSubscription.lastError}
                      </div>
                    ) : null}

                    <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-[#d4d8de] pt-5">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSubscription(selectedSubscription.id, {
                            status:
                              selectedSubscription.status === "inactive"
                                ? "active"
                                : "inactive",
                          })
                        }
                        className="flex h-10 items-center gap-2 border border-[#cbd0d8] bg-white px-4 text-[14px] font-semibold text-[#303843] transition hover:bg-[#f4f5f6]"
                      >
                        <Power size={16} />
                        {selectedSubscription.status === "inactive"
                          ? "Enable"
                          : "Disable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete source "${selectedSubscription.title}"?`,
                            )
                          ) {
                            onDeleteSubscription(selectedSubscription.id);
                          }
                        }}
                        className="flex h-10 items-center gap-2 border border-red-200 bg-red-50 px-4 text-[14px] font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-8 border border-dashed border-[#cbd0d8] bg-[#fbfafb] px-6 py-10 text-center text-[16px] font-semibold text-[#646b75]">
                  No sources yet.
                </div>
              )}
            </section>

            <div className="mt-12 flex justify-end border-t border-[#cbd0d8] pt-7">
              <button
                type="button"
                className="flex h-12 items-center gap-3 bg-[#4b5b70] px-9 text-[15px] font-semibold text-white transition hover:bg-[#3f4d60]"
              >
                <Save size={18} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  accessory,
  children,
}: {
  label: string;
  accessory?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-3 flex items-center justify-between text-[15px] font-bold text-[#555b64]">
        {label}
        {accessory}
      </span>
      {children}
    </label>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#69717d]">
        {label}
      </p>
      <p className="mt-2 break-words border border-[#d7dbe2] bg-white px-4 py-3 text-[14px] font-semibold leading-6 text-[#303843]">
        {value}
      </p>
    </div>
  );
}

function TopActions() {
  return (
    <div className="flex items-center gap-8 text-[#303843]">
      <div className="flex h-10 w-[285px] items-center gap-3 border border-[#cbd0d8] bg-white px-4 text-[#6a7078]">
        <Search size={19} />
        <span className="text-[17px] font-medium">Search...</span>
      </div>
      <button type="button" aria-label="Refresh feeds">
        <RefreshCcw size={22} />
      </button>
      <button type="button" aria-label="Filter feeds">
        <Filter size={22} />
      </button>
      <button type="button" aria-label="More actions">
        <MoreVertical size={22} />
      </button>
    </div>
  );
}

function SourceFolderModal({
  folders,
  subscriptions,
  onClose,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onAssignSubscription,
}: {
  folders: SourceFolder[];
  subscriptions: ApiSubscription[];
  onClose: () => void;
  onCreateFolder: (name: string) => Promise<string>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onAssignSubscription: (
    subscriptionId: string,
    folderId: string | null,
  ) => Promise<void>;
}) {
  const [selectedFolderId, setSelectedFolderId] = useState(
    folders[0]?.id || "uncategorized",
  );
  const [newFolderName, setNewFolderName] = useState("");
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId);
  const [renameDraft, setRenameDraft] = useState(selectedFolder?.name || "");
  const isUncategorizedSelected = selectedFolderId === "uncategorized";

  function getDefaultFolderName() {
    const baseName = "New Folder";
    const existingNames = new Set(folders.map((folder) => folder.name));

    if (!existingNames.has(baseName)) {
      return baseName;
    }

    for (let index = 2; index < 100; index += 1) {
      const candidate = `${baseName} ${index}`;

      if (!existingNames.has(candidate)) {
        return candidate;
      }
    }

    return `${baseName} ${folders.length + 1}`;
  }

  async function handleCreate() {
    const folderName = newFolderName.trim() || getDefaultFolderName();
    const folderId = await onCreateFolder(folderName);

    if (folderId) {
      setSelectedFolderId(folderId);
      setRenameDraft(folderName);
      setNewFolderName("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/35 px-4">
      <section className="w-[780px] max-w-full overflow-hidden rounded-md border border-[#cbd0d8] bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#d8dce3] bg-[#f7f8f9] px-6 py-5">
          <div>
            <h2 className="text-[23px] font-bold text-[#263241]">
              Source Folders
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#69717d]">
              Create folders and assign each source to one category.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close source folders"
            className="text-[#606873] transition hover:text-[#1f2630]"
          >
            <X size={20} />
          </button>
        </header>

        <div className="grid max-h-[70vh] grid-cols-[250px_1fr] overflow-hidden max-md:grid-cols-1">
          <aside className="border-r border-[#d8dce3] bg-[#fbfafb] p-5 max-md:border-b max-md:border-r-0">
            <div className="flex gap-2">
              <input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleCreate();
                  }
                }}
                placeholder="New folder"
                className="h-10 min-w-0 flex-1 border border-[#cbd0d8] bg-white px-3 text-sm font-semibold text-[#263241] outline-none"
              />
              <button
                type="button"
                onClick={() => void handleCreate()}
                aria-label="Create folder"
                title="Create folder"
                className="flex h-10 w-10 items-center justify-center bg-[#4b5b70] text-white transition hover:bg-[#3f4d60]"
              >
                <Plus size={17} />
              </button>
            </div>

            <div className="mt-5 space-y-1">
              {folders.map((folder) => (
                <button
                  type="button"
                  key={folder.id}
                  onClick={() => {
                    setSelectedFolderId(folder.id);
                    setRenameDraft(folder.name);
                  }}
                  className={`flex h-10 w-full items-center gap-2 rounded-sm px-3 text-left text-sm font-bold transition ${
                    selectedFolderId === folder.id
                      ? "bg-[#eceff3] text-[#263241]"
                      : "text-[#555d68] hover:bg-[#f0f2f5]"
                  }`}
                >
                  <Folder size={16} />
                  <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                  <span className="text-xs text-[#77808b]">
                    {folder.subscriptionCount}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setSelectedFolderId("uncategorized");
                  setRenameDraft("");
                }}
                className={`flex h-10 w-full items-center gap-2 rounded-sm px-3 text-left text-sm font-bold transition ${
                  isUncategorizedSelected
                    ? "bg-[#eceff3] text-[#263241]"
                    : "text-[#555d68] hover:bg-[#f0f2f5]"
                }`}
              >
                <FolderOpen size={16} />
                <span className="min-w-0 flex-1 truncate">Uncategorized</span>
              </button>
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto p-6">
            {selectedFolder ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3">
                  <input
                    value={renameDraft}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    className="h-11 min-w-0 flex-1 border border-[#cbd0d8] bg-white px-4 text-[16px] font-bold text-[#263241] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void onRenameFolder(selectedFolder.id, renameDraft)
                    }
                    disabled={renameDraft.trim() === selectedFolder.name}
                    className="flex h-11 items-center gap-2 bg-[#4b5b70] px-4 text-sm font-semibold text-white transition hover:bg-[#3f4d60] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Pencil size={15} />
                    Rename
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete folder "${selectedFolder.name}"?`)) {
                      void onDeleteFolder(selectedFolder.id);
                    }
                  }}
                  className="flex h-11 items-center gap-2 border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            ) : (
              <div className="text-[16px] font-bold text-[#263241]">
                Uncategorized
              </div>
            )}

            <div className="mt-5 border border-[#d7dbe2]">
              {subscriptions.map((subscription) => {
                const isAssigned = selectedFolder
                  ? subscription.folderId === selectedFolder.id
                  : !subscription.folderId;

                return (
                  <label
                    key={subscription.id}
                    className="flex cursor-pointer items-center gap-3 border-b border-[#e5e8ed] bg-white px-4 py-3 last:border-b-0 hover:bg-[#f8f9fa]"
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        const nextFolderId = checked
                          ? selectedFolder?.id ?? null
                          : null;

                        void onAssignSubscription(subscription.id, nextFolderId);
                      }}
                      className="h-4 w-4 accent-[#4b5b70]"
                    />
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getSourceColor(
                        subscription.sourceType,
                      )}`}
                    >
                      {subscription.title.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[#2d333b]">
                        {subscription.title}
                      </span>
                      <span className="mt-0.5 block text-xs font-bold text-[#79818b]">
                        {folders.find((folder) => folder.id === subscription.folderId)
                          ?.name || "Uncategorized"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function AddSubscriptionModal({
  input,
  preview,
  previewError,
  isPreviewing,
  isConfirming,
  onInputChange,
  onPreview,
  onClose,
  onConfirm,
}: {
  input: string;
  preview: PreviewResult | null;
  previewError: string;
  isPreviewing: boolean;
  isConfirming: boolean;
  onInputChange: (value: string) => void;
  onPreview: () => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f2937]/18 backdrop-blur-[3px]">
      <section className="w-[540px] overflow-hidden rounded-lg border border-[#cbd0d8] bg-[#fbfafb] shadow-2xl">
        <header className="flex h-[72px] items-center justify-between border-b border-[#cbd0d8] px-7">
          <h2 className="text-[22px] font-bold text-[#1d232c]">
            Add Subscription
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add subscription modal"
            className="text-[#303843]"
          >
            <X size={27} />
          </button>
        </header>

        <div className="space-y-6 px-7 py-6">
          <input
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            className="h-14 w-full rounded border border-[#cbd0d8] bg-white px-4 text-[16px] font-medium text-[#222831] outline-none transition focus:border-[#4b5b70]"
          />

          <p className="text-[13px] font-bold text-[#4d535b]">
            Examples:{" "}
            <span className="text-[#334154]">
              rsshub://youtube/user/%40xiao_lin_shuo,
              rsshub://weibo/user/2135129011
            </span>
          </p>

          <button
            type="button"
            onClick={onPreview}
            disabled={isPreviewing}
            className="flex h-12 w-full items-center justify-center gap-3 rounded border border-[#cbd0d8] bg-white text-[15px] font-semibold text-[#242b34] transition hover:bg-[#f4f5f6]"
          >
            {isPreviewing ? (
              <RefreshCcw size={19} className="animate-spin" />
            ) : (
              <Search size={19} />
            )}
            {isPreviewing ? "Previewing..." : "Preview Feed"}
          </button>

          {previewError ? (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {previewError}
            </div>
          ) : null}

          {preview ? (
            <div className="overflow-hidden rounded border border-[#cbd0d8] bg-white">
              <div className="flex items-center gap-4 bg-[#f4f3f4] p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded border border-[#cbd0d8] bg-[#f8f8f8] text-[#34495f]">
                  {preview.platform === "weibo" ? (
                    <Rss size={26} />
                  ) : (
                    <Video size={26} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[22px] font-bold text-[#1d232c]">
                    {preview.title}
                  </h3>
                  <p className="mt-1 truncate text-[13px] font-bold text-[#626973]">
                    {preview.platform}
                    <span className="mx-2 text-[#a8adb4]">•</span>
                    {preview.feedUrl}
                  </p>
                </div>
                <span className="flex items-center gap-2 rounded bg-[#e9e9e9] px-3 py-2 text-sm font-bold text-[#3f454d]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#19bf7d]" />
                  Ready
                </span>
              </div>

              <div className="border-t border-[#cbd0d8] p-5">
                <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-[#4f5660]">
                  Latest Content
                </h4>
                <ul className="mt-4 space-y-4 text-[16px] font-medium text-[#2b3038]">
                  {preview.items.map((item) => (
                    <li key={item.link || item.title} className="flex items-center gap-4">
                      <CirclePlay size={18} className="text-[#34495f]" />
                      {item.title}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="flex h-[80px] justify-end gap-4 border-t border-[#cbd0d8] bg-[#f7f5f6] px-7 py-5">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded border border-[#cbd0d8] bg-white px-7 text-[14px] font-semibold text-[#303843] transition hover:bg-[#f4f5f6]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="h-10 rounded bg-[#4b5b70] px-7 text-[14px] font-semibold text-white transition hover:bg-[#3f4d60] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConfirming ? "Subscribing..." : "Confirm Subscription"}
          </button>
        </footer>
      </section>
    </div>
  );
}
