import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSubscriptionsOpml, parseSubscriptionsOpml } from "./opml.ts";

test("parseSubscriptionsOpml parses standard xmlUrl outlines and decodes entities", () => {
  const subscriptions = parseSubscriptionsOpml(`<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Tech &amp; Finance" type="rss" xmlUrl="https://example.com/feed.xml?x=1&amp;y=2" htmlUrl="https://example.com"/>
  </body>
</opml>`);

  assert.deepEqual(subscriptions, [
    {
      title: "Tech & Finance",
      feedUrl: "https://example.com/feed.xml?x=1&y=2",
      siteUrl: "https://example.com",
    },
  ]);
});

test("parseSubscriptionsOpml accepts feedUrl from non-standard OPML exports", () => {
  const subscriptions = parseSubscriptionsOpml(`<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Alt Reader" type="rss" feedUrl="https://reader.example/rss"/>
  </body>
</opml>`);

  assert.deepEqual(subscriptions, [
    {
      title: "Alt Reader",
      feedUrl: "https://reader.example/rss",
      siteUrl: null,
    },
  ]);
});

test("parseSubscriptionsOpml treats url as feed URL only for feed-like outlines", () => {
  const subscriptions = parseSubscriptionsOpml(`<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Plain bookmark" type="link" url="https://example.com/page"/>
    <outline text="Atom Feed" type="atom" url="https://example.com/atom.xml"/>
    <outline text="Untyped Feed" url="https://example.com/rss.xml"/>
  </body>
</opml>`);

  assert.deepEqual(subscriptions, [
    {
      title: "Atom Feed",
      feedUrl: "https://example.com/atom.xml",
      siteUrl: null,
    },
    {
      title: "Untyped Feed",
      feedUrl: "https://example.com/rss.xml",
      siteUrl: null,
    },
  ]);
});

test("buildSubscriptionsOpml round-trips subscriptions through parser", () => {
  const opml = buildSubscriptionsOpml([
    {
      title: "A&B",
      feedUrl: "https://example.com/rss.xml?x=1&y=2",
      siteUrl: "https://example.com/a?x=1&y=2",
    },
  ]);

  assert.deepEqual(parseSubscriptionsOpml(opml), [
    {
      title: "A&B",
      feedUrl: "https://example.com/rss.xml?x=1&y=2",
      siteUrl: "https://example.com/a?x=1&y=2",
    },
  ]);
});
