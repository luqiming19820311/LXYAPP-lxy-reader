import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const subscriptions = [
  {
    id: "sub_xiao_lin_shuo",
    title: "Xiao Lin Shuo",
    sourceType: "youtube",
    inputUrl: "rsshub://youtube/user/%40xiao_lin_shuo",
    feedUrl: "https://rsshub.app/youtube/user/%40xiao_lin_shuo",
    siteUrl: "https://www.youtube.com/@xiao_lin_shuo",
    domainKey: "youtube.com",
    rsshubRoute: "/youtube/user/%40xiao_lin_shuo",
    status: "active",
  },
  {
    id: "sub_creator_a",
    title: "Creator A",
    sourceType: "bilibili",
    inputUrl: "rsshub://bilibili/user/video/520819684",
    feedUrl: "https://rsshub.app/bilibili/user/video/520819684",
    siteUrl: "https://space.bilibili.com/520819684",
    domainKey: "bilibili.com",
    rsshubRoute: "/bilibili/user/video/520819684",
    status: "active",
  },
  {
    id: "sub_user_b",
    title: "User B",
    sourceType: "weibo",
    inputUrl: "rsshub://weibo/user/2135129011",
    feedUrl: "https://rsshub.app/weibo/user/2135129011",
    siteUrl: "https://weibo.com/u/2135129011",
    domainKey: "weibo.com",
    rsshubRoute: "/weibo/user/2135129011",
    status: "active",
  },
  {
    id: "sub_tech_blog",
    title: "Tech Blog",
    sourceType: "rss",
    inputUrl: "https://example.com/feed.xml",
    feedUrl: "https://example.com/feed.xml",
    siteUrl: "https://example.com",
    domainKey: "example.com",
    status: "active",
  },
];

const items = [
  {
    id: "item_quantum",
    subscriptionId: "sub_xiao_lin_shuo",
    externalId: "seed_quantum",
    title: "The Hidden Mechanics of Quantum Computing Explained Simple",
    author: "Xiao Lin Shuo",
    contentUrl: "https://www.youtube.com/watch?v=seed_quantum",
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    summary:
      "A deep dive into how quantum bits actually work and what it means for the future of computing.",
    contentHtml:
      "A deep dive into how quantum bits actually work and what it means for the future of computing.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=640&q=80",
    mediaType: "video",
    platform: "youtube",
    embedUrl: "https://www.youtube.com/embed/seed_quantum",
  },
  {
    id: "item_desk",
    subscriptionId: "sub_creator_a",
    externalId: "seed_desk",
    title: "My Desk Setup 2024: Productivity Focused",
    author: "Creator A",
    contentUrl: "https://www.bilibili.com/video/BV1seeddesk",
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    summary:
      "Touring the new minimal desk setup designed for maximum focus and fewer distractions.",
    contentHtml:
      "Touring the new minimal desk setup designed for maximum focus and fewer distractions.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=640&q=80",
    mediaType: "video",
    platform: "bilibili",
    embedUrl: "https://player.bilibili.com/player.html?bvid=BV1seeddesk",
  },
  {
    id: "item_weibo",
    subscriptionId: "sub_user_b",
    externalId: "seed_weibo",
    title: 'Just finished reading "Thinking, Fast and Slow" again.',
    author: "User B",
    contentUrl: "https://weibo.com/2135129011/seed",
    publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    summary:
      "It is amazing how much of our decision-making process is automated and often flawed.",
    contentHtml:
      "It is amazing how much of our decision-making process is automated and often flawed.",
    mediaType: "status",
    platform: "weibo",
  },
  {
    id: "item_css",
    subscriptionId: "sub_tech_blog",
    externalId: "seed_css",
    title: "Tailwind CSS vs Vanilla CSS: A 2024 Perspective",
    author: "Tech Blog",
    contentUrl: "https://example.com/tailwind-vs-vanilla-css",
    publishedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    summary:
      "Evaluating the pros and cons of utility-first CSS frameworks in large scale enterprise applications.",
    contentHtml:
      "Evaluating the pros and cons of utility-first CSS frameworks in large scale enterprise applications.",
    mediaType: "article",
    platform: "rss",
  },
];

async function main() {
  await prisma.aiSummary.deleteMany();
  await prisma.userItemState.deleteMany();
  await prisma.contentItem.deleteMany();
  await prisma.subscription.deleteMany();

  for (const subscription of subscriptions) {
    await prisma.subscription.create({ data: subscription });
  }

  for (const item of items) {
    await prisma.contentItem.create({ data: item });
  }

  await prisma.userItemState.createMany({
    data: [
      { itemId: "item_quantum", isRead: false, isFavorite: true },
      { itemId: "item_desk", isRead: true, isFavorite: false, readAt: new Date() },
      { itemId: "item_weibo", isRead: false, isFavorite: false },
      { itemId: "item_css", isRead: true, isFavorite: false, readAt: new Date() },
    ],
  });

  await prisma.aiSummary.create({
    data: {
      itemId: "item_quantum",
      model: "mock",
      promptVersion: "seed-v1",
      summaryText:
        "This video breaks down the fundamental differences between classical bits and quantum qubits. It explains superposition and entanglement using accessible analogies, avoiding heavy mathematics. The creator argues that practical quantum computers are years away, but their arrival may disrupt current encryption standards.",
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
