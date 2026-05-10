"use client";

import {
  Bookmark,
  Bot,
  Check,
  ChevronDown,
  CirclePlay,
  Database,
  ExternalLink,
  EyeOff,
  FileText,
  Filter,
  Layers3,
  Moon,
  MoreVertical,
  Plus,
  RefreshCcw,
  Rss,
  Save,
  Search,
  Settings,
  Sparkles,
  Star,
  Sun,
  UserCircle,
  Video,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type View = "all" | "videos" | "articles" | "favorites" | "settings";
type ItemType = "Video" | "Article" | "Update";

type FeedItem = {
  id: string;
  source: string;
  sourceInitial: string;
  sourceColor: string;
  type: ItemType;
  title: string;
  excerpt: string;
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
  status: "online" | "failed" | "idle";
  color: string;
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
  status: string;
  _count?: {
    items: number;
  };
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
    source: item.subscription.title,
    sourceInitial: item.subscription.title.slice(0, 1).toUpperCase(),
    sourceColor: getSourceColor(item.platform),
    type,
    title: item.title,
    excerpt: item.summary || stripHtml(item.contentHtml) || "No preview available.",
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
    (item) => item.source === subscription.title,
  );

  return {
    id: subscription.id,
    name: subscription.title,
    initial: subscription.title.slice(0, 1).toUpperCase(),
    unread: subscriptionItems.filter((item) => !item.read).length,
    status:
      subscription.status === "failed"
        ? "failed"
        : subscription.status === "active"
          ? "online"
          : "idle",
    color: getSourceColor(subscription.sourceType),
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

export default function Home() {
  const [activeView, setActiveView] = useState<View>("all");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [subscriptionInput, setSubscriptionInput] = useState(
    "rsshub://youtube/user/%40xiao_lin_shuo",
  );

  async function loadData() {
    const [itemsResponse, subscriptionsResponse] = await Promise.all([
      fetch("/api/items"),
      fetch("/api/subscriptions"),
    ]);
    const itemsJson = (await itemsResponse.json()) as { items: ApiItem[] };
    const subscriptionsJson = (await subscriptionsResponse.json()) as {
      subscriptions: ApiSubscription[];
    };
    const nextItems = itemsJson.items.map(toFeedItem);

    setItems(nextItems);
    setSources(
      subscriptionsJson.subscriptions.map((subscription) =>
        toSourceItem(subscription, nextItems),
      ),
    );
    setSelectedId((current) => current || nextItems[0]?.id || "");
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const filteredItems = useMemo(() => {
    if (activeView === "videos") {
      return items.filter((item) => item.type === "Video");
    }

    if (activeView === "articles") {
      return items.filter((item) => item.type === "Article");
    }

    if (activeView === "favorites") {
      return items.filter((item) => item.favorite);
    }

    return items;
  }, [activeView, items]);

  const selectedItem =
    items.find((item) => item.id === selectedId) ?? filteredItems[0];

  const isEmptyState = activeView === "all" && items.length === 0;
  const unreadCount = items.filter((item) => !item.read).length;

  async function handlePreview() {
    setIsPreviewing(true);
    setPreviewError("");

    try {
      const response = await fetch("/api/subscriptions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputUrl: subscriptionInput }),
      });
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
      setPreviewError(error instanceof Error ? error.message : "预览失败。");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleConfirmSubscription() {
    setIsConfirming(true);
    setPreviewError("");

    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputUrl: subscriptionInput }),
      });
      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error || "订阅失败。");
      }

      await loadData();
      setShowAddModal(false);
      setActiveView("all");
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "订阅失败。");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <main className="flex h-screen min-w-0 overflow-hidden bg-[#fbfafb] text-[#1f2630]">
      <Sidebar
        activeView={activeView}
        sources={sources}
        unreadCount={unreadCount}
        onChangeView={(view) => {
          setActiveView(view);
          const nextItem = view === "settings" ? selectedId : filteredItems[0]?.id;
          if (nextItem) {
            setSelectedId(nextItem);
          }
        }}
        onAddSubscription={() => setShowAddModal(true)}
      />

      {activeView === "settings" ? (
        <SettingsView />
      ) : isEmptyState ? (
        <EmptyState onAddSubscription={() => setShowAddModal(true)} />
      ) : (
        <>
          <Timeline
            activeView={activeView}
            items={filteredItems}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {selectedItem ? <DetailPanel item={selectedItem} /> : null}
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
    </main>
  );
}

function Sidebar({
  activeView,
  sources,
  unreadCount,
  onChangeView,
  onAddSubscription,
}: {
  activeView: View;
  sources: SourceItem[];
  unreadCount: number;
  onChangeView: (view: View) => void;
  onAddSubscription: () => void;
}) {
  return (
    <aside className="flex w-[252px] shrink-0 flex-col border-r border-[#d4d8de] bg-[#f7f5f6]">
      <div className="flex h-[102px] items-center gap-3 border-b border-[#d4d8de] px-7">
        <div className="flex h-11 w-11 items-center justify-center rounded bg-[#48576a] text-xl font-semibold text-white">
          L
        </div>
        <div>
          <h1 className="text-[22px] font-bold leading-6 text-[#263241]">LXY</h1>
          <p className="mt-1 text-[15px] font-semibold text-[#565d66]">
            AI RSS Reader
          </p>
        </div>
      </div>

      <div className="px-5 pt-6">
        <button
          type="button"
          onClick={onAddSubscription}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-sm bg-[#4b5b70] text-[15px] font-semibold text-white transition hover:bg-[#3f4d60]"
        >
          <Plus size={18} />
          Add Subscription
        </button>
      </div>

      <nav className="mt-5 space-y-1 px-0">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`flex h-12 w-full items-center gap-4 border-l-[3px] px-7 text-left text-[15px] font-semibold transition ${
                isActive
                  ? "border-[#3f5268] bg-[#eceaed] text-[#334154]"
                  : "border-transparent text-[#525960] hover:bg-[#efedf0]"
              }`}
            >
              <Icon size={20} strokeWidth={2.2} />
              <span className="flex-1">{item.label}</span>
              {item.id === "all" && unreadCount ? (
                <span className="rounded-full bg-[#3f5268] px-2.5 py-1 text-xs font-bold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </button>
          );
        })}

        <button
          type="button"
          className="flex h-12 w-full items-center gap-4 border-l-[3px] border-transparent px-7 text-left text-[15px] font-semibold text-[#525960] transition hover:bg-[#efedf0]"
        >
          <Bookmark size={20} strokeWidth={2.2} />
          Read Later
        </button>

        <button
          type="button"
          onClick={() => onChangeView("settings")}
          className={`flex h-12 w-full items-center gap-4 border-l-[3px] px-7 text-left text-[15px] font-semibold transition ${
            activeView === "settings"
              ? "border-[#3f5268] bg-[#eceaed] text-[#334154]"
              : "border-transparent text-[#525960] hover:bg-[#efedf0]"
          }`}
        >
          <Settings size={20} strokeWidth={2.2} />
          Settings
        </button>
      </nav>

      <div className="mt-7 px-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[#5c6168]">
          Sources
        </h2>
        <div className="mt-4 space-y-4">
          {sources.map((source) => (
            <div key={source.name} className="flex items-center gap-3">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${source.color}`}
              >
                {source.initial}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#4d535b]">
                {source.name}
              </span>
              {source.status === "online" ? (
                <span className="h-2 w-2 rounded-full bg-[#17bf7d]" />
              ) : null}
              {source.unread ? (
                <span className="rounded bg-[#e1e0e2] px-2 py-0.5 text-xs font-bold text-[#6a6870]">
                  {source.unread}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-[#d4d8de] p-6">
        <button
          type="button"
          className="flex h-10 items-center gap-4 text-[15px] font-semibold text-[#525960]"
        >
          <RefreshCcw size={20} />
          Refresh
        </button>
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

function Timeline({
  activeView,
  items,
  selectedId,
  onSelect,
}: {
  activeView: View;
  items: FeedItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const title =
    activeView === "videos"
      ? "Videos"
      : activeView === "articles"
        ? "Articles"
        : activeView === "favorites"
          ? "Favorites"
          : "All Feeds";

  return (
    <section className="flex w-[380px] shrink-0 flex-col border-r border-[#d4d8de] bg-[#fbfafb]">
      <header className="flex h-[72px] items-center justify-between border-b border-[#d4d8de] px-6">
        <h2 className="text-[22px] font-bold text-[#263241]">{title}</h2>
        <div className="flex items-center gap-4 text-[#303843]">
          <button type="button" aria-label="Filter timeline">
            <Filter size={21} />
          </button>
          <button type="button" aria-label="More timeline actions">
            <MoreVertical size={21} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex w-full gap-4 border-b border-[#d4d8de] px-5 py-5 text-left transition ${
              selectedId === item.id
                ? "bg-white shadow-[inset_2px_0_0_#34495f]"
                : "bg-[#fbfafb] hover:bg-white"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[14px] font-bold text-[#45505c]">
                {!item.read ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-[#34495f]" />
                ) : null}
                <span>{item.source}</span>
                <span className="rounded bg-[#e3e2e4] px-2 py-0.5 text-xs text-[#555a62]">
                  {item.type}
                </span>
                <span className="ml-auto text-[13px] text-[#555a62]">
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

            {item.thumbnail ? (
              <div
                className="relative mt-7 h-[88px] w-[90px] shrink-0 overflow-hidden rounded-sm bg-[#d8d6d4] bg-cover bg-center"
                style={{ backgroundImage: `url(${item.thumbnail})` }}
                aria-hidden="true"
              >
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

function DetailPanel({ item }: { item: FeedItem }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#fbfafb]">
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#d4d8de] px-9">
        <div className="flex items-center gap-3 text-[15px] font-bold text-[#202934]">
          <span>{item.source}</span>
          <span className="h-1 w-1 rounded-full bg-[#bec3ca]" />
          <span className="text-[#59616b]">{item.time}</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="flex h-9 items-center gap-2 border border-[#c9ced6] bg-[#f6f4f5] px-4 text-[15px] font-semibold text-[#2f3540] transition hover:bg-white"
          >
            <ExternalLink size={18} />
            Open Original
          </button>
          <button
            type="button"
            aria-label="Favorite"
            className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#eef0f3] text-[#34495f]"
          >
            <Star size={22} />
          </button>
          <button
            type="button"
            className="flex h-9 items-center gap-2 border border-[#c9ced6] bg-[#f6f4f5] px-4 text-[15px] font-semibold text-[#2f3540] transition hover:bg-white"
          >
            <Check size={18} />
            Mark Read
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-9 py-10">
        <article className="mx-auto max-w-[920px]">
          <h2 className="max-w-[820px] break-words text-[28px] font-bold leading-[1.2] text-[#1d232c]">
            {item.title}
          </h2>

          {item.type === "Video" ? (
            <div className="relative mt-9 aspect-video overflow-hidden rounded-md border border-[#cfd4dc] bg-[#d7d2cb]">
              {item.thumbnail ? (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${item.thumbnail})` }}
                  aria-hidden="true"
                />
              ) : null}
              <button
                type="button"
                aria-label="Play video"
                className="absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-white/95 text-[#34495f] shadow-lg"
              >
                <Video size={30} fill="currentColor" />
              </button>
            </div>
          ) : (
            <div className="mt-9 rounded-md border border-[#cfd4dc] bg-white p-7 text-[18px] leading-8 text-[#4b535d]">
              {item.excerpt}
            </div>
          )}

          <section className="mt-9 rounded-md border border-[#cfd4dc] bg-white p-7">
            <div className="flex items-center gap-3">
              <Sparkles size={25} className="text-[#34495f]" />
              <h3 className="text-[24px] font-bold text-[#2f3b4a]">
                AI Summary
              </h3>
            </div>
            <p className="mt-6 max-w-[780px] text-[18px] font-medium leading-8 text-[#5d636b]">
              This video breaks down the fundamental differences between
              classical bits and quantum qubits. It explains superposition and
              entanglement using accessible analogies, avoiding heavy
              mathematics. The creator argues that practical quantum computers
              are years away, but their arrival may disrupt current encryption
              standards.
            </p>

            <div className="mt-8 grid grid-cols-[1fr_300px] gap-9">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-[0.08em] text-[#242b34]">
                  Key Points
                </h4>
                <ul className="mt-4 space-y-4 text-[17px] font-medium leading-6 text-[#606771]">
                  <li className="flex gap-3">
                    <Check className="mt-0.5 shrink-0 text-[#34495f]" size={20} />
                    Qubits exist in multiple states simultaneously.
                  </li>
                  <li className="flex gap-3">
                    <Check className="mt-0.5 shrink-0 text-[#34495f]" size={20} />
                    Entanglement connects particles regardless of distance.
                  </li>
                  <li className="flex gap-3">
                    <Check className="mt-0.5 shrink-0 text-[#34495f]" size={20} />
                    Shor&apos;s algorithm threatens RSA encryption.
                  </li>
                </ul>
              </div>
              <div className="rounded border border-[#cfd4dc] bg-[#fbfafb] p-5">
                <h4 className="text-sm font-bold uppercase tracking-[0.08em] text-[#242b34]">
                  Why Watch?
                </h4>
                <p className="mt-4 text-[17px] font-medium leading-7 text-[#606771]">
                  Excellent for non-technical professionals who need to
                  understand the strategic implications without getting buried
                  in physics equations.
                </p>
              </div>
            </div>
          </section>
        </article>
      </div>
    </section>
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

function SettingsView() {
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
                    accessory={<span className="text-sm font-bold">Get Key</span>}
                  >
                    <div className="flex h-12 items-center border border-[#cbd0d8] bg-white px-4">
                      <input
                        value="••••••••••••••••••••••"
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
                      Configure later
                      <ChevronDown size={19} />
                    </button>
                  </Field>
                </div>
              </section>
            </div>

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
