PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "inputUrl" TEXT NOT NULL,
  "feedUrl" TEXT NOT NULL,
  "siteUrl" TEXT,
  "domainKey" TEXT NOT NULL,
  "rsshubRoute" TEXT,
  "faviconUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "lastError" TEXT,
  "lastFetchedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_inputUrl_key"
  ON "Subscription"("inputUrl");

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_feedUrl_key"
  ON "Subscription"("feedUrl");

CREATE TABLE IF NOT EXISTS "ContentItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "subscriptionId" TEXT NOT NULL,
  "externalId" TEXT,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "contentUrl" TEXT NOT NULL,
  "publishedAt" DATETIME,
  "summary" TEXT,
  "contentHtml" TEXT,
  "thumbnailUrl" TEXT,
  "mediaType" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "embedUrl" TEXT,
  "rawPayload" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentItem_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId")
    REFERENCES "Subscription" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContentItem_subscriptionId_externalId_key"
  ON "ContentItem"("subscriptionId", "externalId");

CREATE INDEX IF NOT EXISTS "ContentItem_subscriptionId_idx"
  ON "ContentItem"("subscriptionId");

CREATE INDEX IF NOT EXISTS "ContentItem_platform_idx"
  ON "ContentItem"("platform");

CREATE INDEX IF NOT EXISTS "ContentItem_mediaType_idx"
  ON "ContentItem"("mediaType");

CREATE INDEX IF NOT EXISTS "ContentItem_publishedAt_idx"
  ON "ContentItem"("publishedAt");

CREATE TABLE IF NOT EXISTS "UserItemState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "itemId" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "isFavorite" BOOLEAN NOT NULL DEFAULT false,
  "isReadLater" BOOLEAN NOT NULL DEFAULT false,
  "readAt" DATETIME,
  "favoritedAt" DATETIME,
  "readLaterAt" DATETIME,
  CONSTRAINT "UserItemState_itemId_fkey"
    FOREIGN KEY ("itemId")
    REFERENCES "ContentItem" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserItemState_itemId_key"
  ON "UserItemState"("itemId");

CREATE TABLE IF NOT EXISTS "AiSummary" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "itemId" TEXT NOT NULL,
  "summaryText" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiSummary_itemId_fkey"
    FOREIGN KEY ("itemId")
    REFERENCES "ContentItem" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiSummary_itemId_key"
  ON "AiSummary"("itemId");
