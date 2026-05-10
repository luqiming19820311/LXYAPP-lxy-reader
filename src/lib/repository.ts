import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { fetchNormalizedItems, previewFeed } from "./feed";

export async function listSubscriptions() {
  return prisma.subscription.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { items: true },
      },
    },
  });
}

export async function listItems() {
  return prisma.contentItem.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: {
      subscription: true,
      state: true,
      aiSummary: true,
    },
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
  const preview = await previewFeed(inputUrl);

  const subscription = await prisma.subscription.upsert({
    where: { feedUrl: preview.feedUrl },
    update: {
      title: preview.title,
      status: "active",
      lastError: null,
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
      status: "active",
    },
  });

  await fetchSubscription(subscription.id);

  return prisma.subscription.findUnique({
    where: { id: subscription.id },
    include: { _count: { select: { items: true } } },
  });
}

export async function fetchSubscription(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error("订阅源不存在。");
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: "fetching", lastError: null },
  });

  try {
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
            },
          },
        },
      });
    }

    return prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "active",
        lastError: null,
        lastFetchedAt: new Date(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "抓取失败。";

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "failed",
        lastError: message,
      },
    });

    throw error;
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
    },
  });
}

export function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
