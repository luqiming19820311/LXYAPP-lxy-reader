import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { prisma } from "./prisma.ts";
import { createSubscription, setReadLaterState } from "./repository.ts";
import { __resetTwitterEmbeddedTimelineCacheForTests } from "./feed.ts";

const originalFetch = globalThis.fetch;
const originalRsshubBaseUrl = process.env.RSSHUB_BASE_URL;
const testMid = "999999001";
const testFeedUrl = `bilibili://user/video/${testMid}`;
const testTwitterUsername = "lxy-reader-test-dotey";
const testTwitterInputUrl = `rsshub://twitter/user/${testTwitterUsername}`;
const testTwitterFeedUrl = `https://rsshub.app/twitter/user/${testTwitterUsername}?format=json`;
const testConfiguredTwitterFeedUrl =
  `http://rsshub.local:1200/twitter/user/${testTwitterUsername}?format=json`;
const testTwitterEmbeddedTimelineUrl =
  `https://syndication.twitter.com/srv/timeline-profile/screen-name/${testTwitterUsername}?dnt=true&lang=en`;

afterEach(async () => {
  globalThis.fetch = originalFetch;
  __resetTwitterEmbeddedTimelineCacheForTests();
  if (originalRsshubBaseUrl === undefined) {
    delete process.env.RSSHUB_BASE_URL;
  } else {
    process.env.RSSHUB_BASE_URL = originalRsshubBaseUrl;
  }
  await prisma.subscription.deleteMany({
    where: {
      OR: [
        { feedUrl: testFeedUrl },
        { feedUrl: testTwitterFeedUrl },
        { feedUrl: testConfiguredTwitterFeedUrl },
        { inputUrl: testTwitterInputUrl },
      ],
    },
  });
});

function mockPreviewSuccessAndFetchAppFallback() {
  let archiveRequestCount = 0;

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "https://api.bilibili.com/x/web-interface/nav") {
      return new Response(
        JSON.stringify({
          code: -101,
          message: "账号未登录",
          data: {
            wbi_img: {
              img_url: `https://i0.hdslb.com/bfs/wbi/${"a".repeat(32)}.png`,
              sub_url: `https://i0.hdslb.com/bfs/wbi/${"b".repeat(32)}.png`,
            },
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const apiUrl = new URL(url);

    if (apiUrl.hostname === "api.bilibili.com") {
      assert.equal(apiUrl.pathname, "/x/space/wbi/arc/search");
      assert.equal(apiUrl.searchParams.get("mid"), testMid);
      archiveRequestCount += 1;

      if (archiveRequestCount === 1) {
        return new Response(
          JSON.stringify({
            code: 0,
            data: {
              info: {
                name: "测试 Bilibili 来源",
              },
              list: {
                vlist: [
                  {
                    bvid: "BV1test12345",
                    title: "预览可见的视频",
                    description: "预览阶段能读取到内容",
                    pic: "//i0.hdslb.com/bfs/archive/test.jpg",
                    created: 1763980800,
                  },
                ],
              },
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      return new Response(
        JSON.stringify({
          code: -352,
          message: "风控校验失败",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    assert.equal(apiUrl.hostname, "app.bilibili.com");
    assert.equal(apiUrl.pathname, "/x/v2/space/archive");
    assert.equal(apiUrl.searchParams.get("vmid"), testMid);

    return new Response(
      JSON.stringify({
        code: 0,
        data: {
          count: 1,
          item: [
            {
              bvid: "BV1app12345",
              param: "24681012",
              title: "APP fallback 保存的视频",
              subtitle: "APP fallback 内容",
              cover: "http://i0.hdslb.com/bfs/archive/app-test.jpg",
              ctime: 1763980800,
              author: "测试 Bilibili 来源",
            },
          ],
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };
}

function mockPreviewRiskBlock() {
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "https://api.bilibili.com/x/web-interface/nav") {
      return new Response(
        JSON.stringify({
          code: -101,
          message: "账号未登录",
          data: {
            wbi_img: {
              img_url: `https://i0.hdslb.com/bfs/wbi/${"a".repeat(32)}.png`,
              sub_url: `https://i0.hdslb.com/bfs/wbi/${"b".repeat(32)}.png`,
            },
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        code: -352,
        message: "风控校验失败",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };
}

function buildTwitterEmbeddedTimelineHtml() {
  return `<!DOCTYPE html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        timeline: {
          entries: [
            {
              entry_id: "tweet-1996285439867556304",
              content: {
                tweet: {
                  conversation_id_str: "1996285439867556304",
                  created_at: "Wed Dec 03 18:28:32 +0000 2025",
                  full_text: "A thread for my nana banana pro prompts 🧵 https://t.co/riAcKUtR6T",
                  text: "A thread for my nana banana pro prompts 🧵 https://t.co/riAcKUtR6T",
                  user: {
                    name: "宝玉",
                    screen_name: "dotey",
                  },
                  entities: {
                    media: [
                      {
                        media_url_https: "https://pbs.twimg.com/media/G7Q7BCiWAAA-4sc.jpg",
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    },
  })}</script></body></html>`;
}

function buildTwitterWebMainHtml() {
  return '<!DOCTYPE html><html><head><link rel="preload" href="https://abs.twimg.com/responsive-web/client-web/main.testhash.js" as="script"></head></html>';
}

function buildTwitterWebMainScript() {
  return 'queryId:"user-query",operationName:"UserByScreenName";queryId:"tweets-query",operationName:"UserTweets";';
}

function buildTwitterGraphqlUserPayload() {
  return {
    data: {
      user: {
        result: {
          __typename: "User",
          rest_id: "3178231",
          core: {
            name: "宝玉",
            screen_name: "dotey",
          },
          legacy: {
            name: "宝玉",
            screen_name: "dotey",
          },
        },
      },
    },
  };
}

function buildTwitterGraphqlTweetsPayload() {
  return {
    data: {
      user: {
        result: {
          timeline_v2: {
            timeline: {
              instructions: [
                {
                  entries: [
                    {
                      entryId: "tweet-1996285439867556304",
                      content: {
                        itemContent: {
                          tweet_results: {
                            result: {
                              __typename: "Tweet",
                              rest_id: "1996285439867556304",
                              core: {
                                user_results: {
                                  result: {
                                    __typename: "User",
                                    core: {
                                      name: "宝玉",
                                      screen_name: "dotey",
                                    },
                                    legacy: {
                                      name: "宝玉",
                                      screen_name: "dotey",
                                    },
                                  },
                                },
                              },
                              legacy: {
                                created_at: "Wed Dec 03 18:28:32 +0000 2025",
                                full_text:
                                  "A thread for my nana banana pro prompts 🧵 https://t.co/riAcKUtR6T",
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    },
  };
}

test("createSubscription saves items through the Bilibili app fallback when the initial fetch is risk-blocked", async () => {
  mockPreviewSuccessAndFetchAppFallback();

  const result = await createSubscription(`rsshub://bilibili/user/video/${testMid}`);

  assert.equal(result.subscription?.feedUrl, testFeedUrl);
  assert.equal(result.subscription?.status, "active");
  assert.equal(result.subscription?.lastError, null);
  assert.equal(result.alreadyExisted, false);
  assert.equal(result.initialFetchFailed, false);
  assert.equal(result.initialFetchResult?.fetchedCount, 1);

  const savedItem = await prisma.contentItem.findFirst({
    where: {
      subscriptionId: result.subscription?.id,
      externalId: "BV1app12345",
    },
  });

  assert.equal(savedItem?.title, "APP fallback 保存的视频");
});

test("createSubscription rejects a Bilibili subscription when preview cannot fetch real content", async () => {
  mockPreviewRiskBlock();

  await assert.rejects(
    () => createSubscription(`rsshub://bilibili/user/video/${testMid}`),
    {
      message:
        "Bilibili 返回风控拦截，当前匿名接口暂时无法抓取。请稍后重试，或配置可用的 RSSHub Base URL。",
    },
  );

  const saved = await prisma.subscription.findUnique({
    where: { feedUrl: testFeedUrl },
  });

  assert.equal(saved, null);
});

test("createSubscription stores Twitter items through default RSSHub X embedded fallback", async () => {
  process.env.RSSHUB_BASE_URL = "https://rsshub.app?format=json";

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === testTwitterFeedUrl) {
      return new Response("not found", { status: 404 });
    }

    assert.equal(url, testTwitterEmbeddedTimelineUrl);

    return new Response(buildTwitterEmbeddedTimelineHtml(), {
      status: 200,
      headers: {
        "Content-Type": "text/html",
      },
    });
  };

  const result = await createSubscription(testTwitterInputUrl);

  assert.equal(result.subscription?.inputUrl, testTwitterInputUrl);
  assert.equal(result.subscription?.feedUrl, testTwitterFeedUrl);
  assert.equal(result.subscription?.sourceType, "twitter");
  assert.equal(result.subscription?.status, "active");
  assert.equal(result.initialFetchFailed, false);
  assert.equal(result.initialFetchResult?.fetchedCount, 1);

  const saved = await prisma.subscription.findFirst({
    where: { inputUrl: testTwitterInputUrl },
  });
  const savedItem = await prisma.contentItem.findFirst({
    where: {
      subscriptionId: saved?.id,
      externalId: "twitter:1996285439867556304",
    },
  });

  assert.equal(saved?.title, "Twitter @宝玉");
  assert.equal(savedItem?.platform, "twitter");
  assert.equal(savedItem?.mediaType, "status");
  assert.equal(
    savedItem?.thumbnailUrl,
    "https://pbs.twimg.com/media/G7Q7BCiWAAA-4sc.jpg",
  );
});

test("createSubscription stores Twitter items through a configured RSSHub feed", async () => {
  process.env.RSSHUB_BASE_URL = "http://rsshub.local:1200?format=json";

  globalThis.fetch = async (input) => {
    assert.equal(String(input), testConfiguredTwitterFeedUrl);

    return new Response(
      JSON.stringify({
        title: "Twitter @宝玉",
        link: "https://twitter.com/dotey",
        items: [
          {
            title: "最新 Twitter 更新",
            link: "https://x.com/dotey/status/3001",
            pubDate: "2026-06-06T08:00:00.000Z",
            author: "宝玉",
            content_html:
              '<p>最新 Twitter 更新</p><img src="https://pbs.twimg.com/media/latest.jpg">',
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  const result = await createSubscription(testTwitterInputUrl);

  assert.equal(result.subscription?.inputUrl, testTwitterInputUrl);
  assert.equal(result.subscription?.feedUrl, testConfiguredTwitterFeedUrl);
  assert.equal(result.subscription?.sourceType, "twitter");
  assert.equal(result.subscription?.status, "active");
  assert.equal(result.initialFetchFailed, false);
  assert.equal(result.initialFetchResult?.fetchedCount, 1);

  const saved = await prisma.subscription.findUnique({
    where: { feedUrl: testConfiguredTwitterFeedUrl },
  });

  assert.equal(saved?.title, "Twitter @宝玉");
  const savedItem = await prisma.contentItem.findFirst({
    where: {
      subscriptionId: saved?.id,
      externalId: "https://x.com/dotey/status/3001",
    },
  });

  assert.equal(savedItem?.title, "最新 Twitter 更新");
  assert.equal(savedItem?.platform, "twitter");
  assert.equal(savedItem?.mediaType, "status");
  assert.equal(savedItem?.contentHtml?.includes("latest.jpg"), true);
});

test("createSubscription stores Twitter items through the X Web GraphQL fallback", async () => {
  process.env.RSSHUB_BASE_URL = "http://rsshub.local:1200?format=json";
  let tweetsRequestCount = 0;

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === testConfiguredTwitterFeedUrl) {
      return new Response("not found", { status: 404 });
    }

    if (
      url ===
      testTwitterEmbeddedTimelineUrl
    ) {
      return new Response("rate limited", { status: 429 });
    }

    if (url === "https://x.com") {
      return new Response(buildTwitterWebMainHtml(), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url === "https://abs.twimg.com/responsive-web/client-web/main.testhash.js") {
      return new Response(buildTwitterWebMainScript(), {
        status: 200,
        headers: { "Content-Type": "application/javascript" },
      });
    }

    if (url === "https://api.x.com/1.1/guest/activate.json") {
      return new Response(JSON.stringify({ guest_token: "guest-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.startsWith("https://x.com/i/api/graphql/user-query/UserByScreenName")) {
      return new Response(JSON.stringify(buildTwitterGraphqlUserPayload()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.startsWith("https://x.com/i/api/graphql/tweets-query/UserTweets")) {
      tweetsRequestCount += 1;

      return new Response(JSON.stringify(buildTwitterGraphqlTweetsPayload()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await createSubscription(testTwitterInputUrl);

  assert.equal(result.subscription?.sourceType, "twitter");
  assert.equal(result.subscription?.status, "active");
  assert.equal(result.initialFetchFailed, false);
  assert.equal(result.initialFetchResult?.fetchedCount, 1);
  assert.equal(tweetsRequestCount, 1);

  const saved = await prisma.subscription.findUnique({
    where: { feedUrl: testConfiguredTwitterFeedUrl },
  });
  const savedItem = await prisma.contentItem.findFirst({
    where: {
      subscriptionId: saved?.id,
      externalId: "twitter:1996285439867556304",
    },
  });

  assert.equal(saved?.title, "Twitter @宝玉");
  assert.equal(savedItem?.platform, "twitter");
  assert.equal(savedItem?.mediaType, "status");
});

test("setReadLaterState toggles an item in the Read Later list", async () => {
  const subscription = await prisma.subscription.create({
    data: {
      title: "Read Later 测试源",
      sourceType: "rss",
      inputUrl: "https://example.com/read-later.xml",
      feedUrl: "https://example.com/read-later.xml",
      domainKey: "example.com",
      status: "active",
    },
  });
  const item = await prisma.contentItem.create({
    data: {
      subscriptionId: subscription.id,
      externalId: "read-later-item",
      title: "稍后阅读测试内容",
      contentUrl: "https://example.com/read-later-item",
      mediaType: "article",
      platform: "rss",
    },
  });

  const enabledState = await setReadLaterState(item.id, true);

  assert.equal(enabledState.isReadLater, true);
  assert.ok(enabledState.readLaterAt);

  const disabledState = await setReadLaterState(item.id, false);

  assert.equal(disabledState.isReadLater, false);
  assert.equal(disabledState.readLaterAt, null);

  await prisma.subscription.delete({
    where: { id: subscription.id },
  });
});
