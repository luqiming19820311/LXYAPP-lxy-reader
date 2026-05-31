import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.ts";
import {
  BILIBILI_RISK_CONTROL_MESSAGE,
  fetchNormalizedItems,
  isBilibiliRiskControlError,
  previewFeed,
  resolveFeedInput,
} from "./feed.ts";

type OpmlImportInput = {
  title: string;
  feedUrl: string;
  siteUrl?: string | null;
};

type FetchResultSummary = {
  status: "success" | "failed";
  fetchedCount?: number;
  newCount?: number;
  error?: string;
};

export function getFriendlyErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : `${error}`;

  if (message.includes("Status code 403")) {
    return "RSSHub 返回 403，公共实例可能被 Cloudflare 或目标站点拦截。";
  }

  if (
    isBilibiliRiskControlError(error)
  ) {
    return BILIBILI_RISK_CONTROL_MESSAGE;
  }

  if (message.includes("Status code 404")) {
    return "订阅地址返回 404，请检查 feed URL 是否有效。";
  }

  if (message.includes("Invalid URL")) {
    return "订阅地址格式无效，请输入完整 URL 或 rsshub:// 链接。";
  }

  if (
    message.includes("ENOTFOUND") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT") ||
    message.includes("fetch failed")
  ) {
    return "网络连接失败，请检查网络、代理或 RSSHub Base URL。";
  }

  if (message.includes("Non-whitespace before first tag")) {
    return "feed 解析失败，目标返回的不是有效 RSS/Atom 内容。";
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "订阅源已存在，已复用现有记录。";
    }

    if (error.code.startsWith("P20")) {
      return "数据库写入失败，请稍后重试。";
    }
  }

  return message || "操作失败。";
}

export async function listSubscriptions() {
  return prisma.subscription.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      folder: true,
      _count: {
        select: { items: true },
      },
    },
  });
}

export async function listItems(input?: { folderId?: string }) {
  return prisma.contentItem.findMany({
    where: input?.folderId
      ? {
          subscription: {
            folderId: input.folderId,
          },
        }
      : undefined,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: {
      subscription: true,
      state: true,
      aiSummary: true,
    },
  });
}

export async function listSourceFolders() {
  const folders = await prisma.sourceFolder.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      subscriptions: {
        include: {
          items: {
            select: {
              state: {
                select: {
                  isRead: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    subscriptionCount: folder.subscriptions.length,
    unreadCount: folder.subscriptions.reduce(
      (count, subscription) =>
        count +
        subscription.items.filter((item) => item.state?.isRead !== true).length,
      0,
    ),
    subscriptionIds: folder.subscriptions.map((subscription) => subscription.id),
  }));
}

export async function createSourceFolder(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("文件夹名称不能为空。");
  }

  return prisma.sourceFolder.create({
    data: { name: trimmedName },
  });
}

export async function updateSourceFolder(folderId: string, input: { name?: string }) {
  const data: Prisma.SourceFolderUpdateInput = {};

  if (typeof input.name === "string") {
    const name = input.name.trim();

    if (!name) {
      throw new Error("文件夹名称不能为空。");
    }

    data.name = name;
  }

  if (Object.keys(data).length === 0) {
    throw new Error("没有可更新的字段。");
  }

  return prisma.sourceFolder.update({
    where: { id: folderId },
    data,
  });
}

export async function deleteSourceFolder(folderId: string) {
  await prisma.subscription.updateMany({
    where: { folderId },
    data: { folderId: null },
  });

  return prisma.sourceFolder.delete({
    where: { id: folderId },
  });
}

export async function getItem(id: string) {
  return prisma.contentItem.findUnique({
    where: { id },
    include: {
      subscription: true,
      state: true,
      aiSummary: true,
    },
  });
}

export async function createSubscription(inputUrl: string) {
  const preview = await previewFeed(inputUrl).catch(async (error) => {
    const message = getFriendlyErrorMessage(error);
    const resolved = await resolveFeedInput(inputUrl);

    if (
      resolved.platform !== "bilibili" ||
      !message.includes("Bilibili 返回风控拦截")
    ) {
      throw error;
    }

    const mid = resolved.feedUrl.split("/").filter(Boolean).pop() || "unknown";

    return {
      title: `Bilibili UP ${mid}`,
      platform: resolved.platform,
      sourceType: "bilibili",
      inputUrl: resolved.inputUrl,
      feedUrl: resolved.feedUrl,
      siteUrl: resolved.siteUrl,
      domainKey: resolved.domainKey,
      rsshubRoute: resolved.rsshubRoute,
      items: [],
      warning: message,
    };
  });
  const initialError = preview.warning ?? null;

  if (initialError) {
    throw new Error(initialError);
  }

  const existingSubscription = await prisma.subscription.findUnique({
    where: { feedUrl: preview.feedUrl },
  });

  const subscription = await prisma.subscription.upsert({
    where: { feedUrl: preview.feedUrl },
    update: {
      title: preview.title,
      status: initialError ? "failed" : "active",
      lastError: initialError,
      siteUrl: preview.siteUrl,
    },
    create: {
      title: preview.title,
      sourceType: preview.sourceType,
      inputUrl: preview.inputUrl,
      feedUrl: preview.feedUrl,
      siteUrl: preview.siteUrl,
      domainKey: preview.domainKey,
      rsshubRoute: preview.rsshubRoute,
      status: initialError ? "failed" : "active",
      lastError: initialError,
    },
  });

  let initialFetchResult: FetchResultSummary | null = initialError
    ? { status: "failed" }
    : null;

  if (!initialError) {
    try {
      const fetchResult = await fetchSubscription(subscription.id);
      initialFetchResult = fetchResult.result;
    } catch (error) {
      const cause = error instanceof Error ? error.cause : null;

      if (cause && typeof cause === "object" && "result" in cause) {
        initialFetchResult = cause.result as FetchResultSummary;
      } else {
        throw error;
      }
    }
  }

  const refreshedSubscription = await prisma.subscription.findUnique({
    where: { id: subscription.id },
    include: { _count: { select: { items: true } } },
  });

  return {
    subscription: refreshedSubscription,
    alreadyExisted: Boolean(existingSubscription),
    initialFetchFailed: initialFetchResult?.status === "failed",
    initialFetchResult,
  };
}

export async function updateSubscription(
  subscriptionId: string,
  input: {
    title?: string;
    status?: string;
    folderId?: string | null;
  },
) {
  const data: Prisma.SubscriptionUpdateInput = {};

  if (typeof input.title === "string") {
    const title = input.title.trim();

    if (!title) {
      throw new Error("来源名称不能为空。");
    }

    data.title = title;
  }

  if (typeof input.status === "string") {
    if (!["active", "inactive"].includes(input.status)) {
      throw new Error("订阅源状态无效。");
    }

    data.status = input.status;
    if (input.status === "inactive") {
      data.lastError = null;
    }
  }

  if ("folderId" in input) {
    if (input.folderId) {
      const folder = await prisma.sourceFolder.findUnique({
        where: { id: input.folderId },
        select: { id: true },
      });

      if (!folder) {
        throw new Error("文件夹不存在。");
      }

      data.folder = { connect: { id: input.folderId } };
    } else {
      data.folder = { disconnect: true };
    }
  }

  if (Object.keys(data).length === 0) {
    throw new Error("没有可更新的字段。");
  }

  return prisma.subscription.update({
    where: { id: subscriptionId },
    data,
    include: {
      folder: true,
      _count: { select: { items: true } },
    },
  });
}

export async function deleteSubscription(subscriptionId: string) {
  return prisma.subscription.delete({
    where: { id: subscriptionId },
  });
}

export async function importOpmlSubscriptions(inputs: OpmlImportInput[]) {
  const results = [];

  for (const input of inputs) {
    const title = input.title.trim() || input.feedUrl;
    const feedUrl = input.feedUrl.trim();

    if (!feedUrl) {
      continue;
    }

    try {
      const existingSubscription = await prisma.subscription.findUnique({
        where: { feedUrl },
      });
      const parsedUrl = new URL(feedUrl);
      const subscription = await prisma.subscription.upsert({
        where: { feedUrl },
        update: {
          title,
          siteUrl: input.siteUrl || undefined,
          status: existingSubscription?.status === "inactive" ? "inactive" : "active",
          lastError: null,
        },
        create: {
          title,
          sourceType: getSourceTypeFromUrl(feedUrl),
          inputUrl: feedUrl,
          feedUrl,
          siteUrl: input.siteUrl || null,
          domainKey: parsedUrl.hostname.replace(/^www\./, ""),
          status: "active",
        },
      });

      results.push({
        title: subscription.title,
        feedUrl: subscription.feedUrl,
        status: existingSubscription ? ("updated" as const) : ("created" as const),
      });
    } catch (error) {
      results.push({
        title,
        feedUrl,
        status: "failed" as const,
        error: getFriendlyErrorMessage(error),
      });
    }
  }

  return {
    imported: results.filter((result) => result.status === "created").length,
    updated: results.filter((result) => result.status === "updated").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}

function getSourceTypeFromUrl(feedUrl: string) {
  if (feedUrl.includes("youtube.com") || feedUrl.includes("youtu.be")) {
    return "youtube";
  }

  if (feedUrl.includes("bilibili.com")) {
    return "bilibili";
  }

  if (feedUrl.includes("weibo.com")) {
    return "weibo";
  }

  if (feedUrl.includes("rsshub")) {
    return "rsshub";
  }

  return "rss";
}

export async function fetchSubscription(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error("订阅源不存在。");
  }

  if (subscription.status === "inactive") {
    throw new Error("订阅源已停用。");
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: "fetching", lastError: null },
  });

  try {
    const beforeCount = await prisma.contentItem.count({
      where: { subscriptionId },
    });
    const normalizedItems = await fetchNormalizedItems(subscription.feedUrl);

    for (const item of normalizedItems) {
      await prisma.contentItem.upsert({
        where: {
          subscriptionId_externalId: {
            subscriptionId,
            externalId: item.externalId,
          },
        },
        update: {
          title: item.title,
          author: item.author,
          contentUrl: item.contentUrl,
          publishedAt: item.publishedAt,
          summary: item.summary,
          contentHtml: item.contentHtml,
          thumbnailUrl: item.thumbnailUrl,
          mediaType: item.mediaType,
          platform: item.platform,
          embedUrl: item.embedUrl,
          rawPayload: item.rawPayload,
        },
        create: {
          subscriptionId,
          externalId: item.externalId,
          title: item.title,
          author: item.author,
          contentUrl: item.contentUrl || subscription.siteUrl || subscription.feedUrl,
          publishedAt: item.publishedAt,
          summary: item.summary,
          contentHtml: item.contentHtml,
          thumbnailUrl: item.thumbnailUrl,
          mediaType: item.mediaType,
          platform: item.platform,
          embedUrl: item.embedUrl,
          rawPayload: item.rawPayload,
          state: {
            create: {
              isRead: false,
              isFavorite: false,
              isReadLater: false,
            },
          },
        },
      });
    }

    const afterCount = await prisma.contentItem.count({
      where: { subscriptionId },
    });
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "active",
        lastError: null,
        lastFetchedAt: new Date(),
      },
      include: { _count: { select: { items: true } } },
    });

    return {
      subscription: updatedSubscription,
      result: {
        subscriptionId,
        title: updatedSubscription.title,
        status: "success" as const,
        fetchedCount: normalizedItems.length,
        newCount: Math.max(afterCount - beforeCount, 0),
      },
    };
  } catch (error) {
    const message = getFriendlyErrorMessage(error);

    const failedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "failed",
        lastError: message,
      },
      include: { _count: { select: { items: true } } },
    });

    const wrappedError = new Error(message);
    wrappedError.cause = {
      subscription: failedSubscription,
      result: {
        subscriptionId,
        title: failedSubscription.title,
        status: "failed" as const,
        fetchedCount: 0,
        newCount: 0,
        error: message,
      },
    };
    throw wrappedError;
  }
}

export async function setReadState(itemId: string, isRead: boolean) {
  return prisma.userItemState.upsert({
    where: { itemId },
    update: {
      isRead,
      readAt: isRead ? new Date() : null,
    },
    create: {
      itemId,
      isRead,
      readAt: isRead ? new Date() : null,
      isFavorite: false,
      isReadLater: false,
    },
  });
}

export async function setFavoriteState(itemId: string, isFavorite: boolean) {
  return prisma.userItemState.upsert({
    where: { itemId },
    update: {
      isFavorite,
      favoritedAt: isFavorite ? new Date() : null,
    },
    create: {
      itemId,
      isRead: false,
      isFavorite,
      favoritedAt: isFavorite ? new Date() : null,
      isReadLater: false,
    },
  });
}

export async function setReadLaterState(itemId: string, isReadLater: boolean) {
  return prisma.userItemState.upsert({
    where: { itemId },
    update: {
      isReadLater,
      readLaterAt: isReadLater ? new Date() : null,
    },
    create: {
      itemId,
      isRead: false,
      isFavorite: false,
      isReadLater,
      readLaterAt: isReadLater ? new Date() : null,
    },
  });
}

export function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
