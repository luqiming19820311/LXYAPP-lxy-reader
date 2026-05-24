type OpmlSubscription = {
  title: string;
  feedUrl: string;
  siteUrl?: string | null;
};

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: "\"",
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function decodeXml(value: string) {
  return value.replaceAll(/&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (match, entity) => {
    const normalizedEntity = entity.toLowerCase();

    if (normalizedEntity.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(normalizedEntity.slice(2), 16));
    }

    if (normalizedEntity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(normalizedEntity.slice(1), 10));
    }

    return XML_ENTITIES[normalizedEntity] ?? match;
  });
}

function getAttribute(attrs: string, name: string) {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const match = attrs.match(pattern);

  if (!match) {
    return "";
  }

  return decodeXml(match[2] ?? match[3] ?? "");
}

export function buildSubscriptionsOpml(subscriptions: OpmlSubscription[]) {
  const outlines = subscriptions
    .map((subscription) => {
      const title = escapeXml(subscription.title);
      const feedUrl = escapeXml(subscription.feedUrl);
      const siteUrl = subscription.siteUrl ? ` htmlUrl="${escapeXml(subscription.siteUrl)}"` : "";

      return `    <outline text="${title}" title="${title}" type="rss" xmlUrl="${feedUrl}"${siteUrl}/>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>LXY subscriptions</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>
`;
}

export function parseSubscriptionsOpml(opml: string) {
  const subscriptions = new Map<string, OpmlSubscription>();
  const outlinePattern = /<outline\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = outlinePattern.exec(opml))) {
    const attrs = match[1] ?? "";
    const feedUrl = getAttribute(attrs, "xmlUrl").trim();

    if (!feedUrl) {
      continue;
    }

    const title =
      getAttribute(attrs, "title").trim() ||
      getAttribute(attrs, "text").trim() ||
      feedUrl;
    const siteUrl = getAttribute(attrs, "htmlUrl").trim() || null;

    subscriptions.set(feedUrl, {
      title,
      feedUrl,
      siteUrl,
    });
  }

  return Array.from(subscriptions.values());
}
