import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  __resetTwitterEmbeddedTimelineCacheForTests,
  fetchNormalizedItems,
  previewFeed,
  resolveFeedInput,
} from "./feed.ts";

const originalFetch = globalThis.fetch;
const originalRsshubBaseUrl = process.env.RSSHUB_BASE_URL;
const originalRsshubAccessCode = process.env.RSSHUB_ACCESS_CODE;

afterEach(() => {
  globalThis.fetch = originalFetch;
  __resetTwitterEmbeddedTimelineCacheForTests();
  if (originalRsshubBaseUrl === undefined) {
    delete process.env.RSSHUB_BASE_URL;
  } else {
    process.env.RSSHUB_BASE_URL = originalRsshubBaseUrl;
  }
  if (originalRsshubAccessCode === undefined) {
    delete process.env.RSSHUB_ACCESS_CODE;
  } else {
    process.env.RSSHUB_ACCESS_CODE = originalRsshubAccessCode;
  }
});

function mockBilibiliArchiveSearch() {
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

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
    assert.equal(apiUrl.origin, "https://api.bilibili.com");
    assert.equal(apiUrl.pathname, "/x/space/wbi/arc/search");
    assert.equal(apiUrl.searchParams.get("mid"), "520819684");
    assert.equal(apiUrl.searchParams.get("pn"), "1");
    assert.equal(apiUrl.searchParams.get("ps"), "50");
    assert.equal(apiUrl.searchParams.get("order"), "pubdate");
    assert.match(apiUrl.searchParams.get("wts") || "", /^\d+$/);
    assert.match(apiUrl.searchParams.get("w_rid") || "", /^[a-f0-9]{32}$/);

    return new Response(
      JSON.stringify({
        code: 0,
        data: {
          info: {
            name: "测试 UP 主",
          },
          page: {
            count: 2,
          },
          list: {
            vlist: [
              {
                bvid: "BV1abc123456",
                title: "第一条 B 站视频",
                description: "视频简介",
                pic: "//i0.hdslb.com/bfs/archive/cover.jpg",
                created: 1763980800,
              },
              {
                bvid: "BV1def123456",
                title: "第二条 B 站视频",
                description: "",
                pic: "https://i0.hdslb.com/bfs/archive/cover-2.jpg",
                created: 1763894400,
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
  };

  return requestedUrls;
}

function buildTwitterEmbeddedTimelineHtml() {
  return `<!DOCTYPE html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        timeline: {
          entries: [
            {
              type: "tweet",
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
  return 'queryId:"user-query",operationName:"UserByScreenName";queryId:"tweets-query",operationName:"UserTweets";queryId:"highlights-query",operationName:"UserHighlightsTweets";';
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
            description:
              "Prompt Engineer, dedicated to learning and disseminating knowledge about AI.",
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
                                entities: {
                                  media: [
                                    {
                                      media_url_https:
                                        "https://pbs.twimg.com/media/G7Q7BCiWAAA-4sc.jpg",
                                    },
                                  ],
                                },
                                quoted_status_result: {
                                  result: {
                                    __typename: "Tweet",
                                    rest_id: "1999999999999999999",
                                    core: {
                                      user_results: {
                                        result: {
                                          __typename: "User",
                                          core: {
                                            name: "Elon Musk",
                                            screen_name: "elonmusk",
                                          },
                                          legacy: {
                                            name: "Elon Musk",
                                            screen_name: "elonmusk",
                                          },
                                        },
                                      },
                                    },
                                    legacy: {
                                      created_at: "Thu Dec 04 18:28:32 +0000 2025",
                                      full_text: "Nested quote should not be imported",
                                    },
                                  },
                                },
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

function buildTwitterGraphqlFreshTweetsPayload() {
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
                      entryId: "tweet-2067000000000000001",
                      content: {
                        itemContent: {
                          tweet_results: {
                            result: {
                              __typename: "Tweet",
                              rest_id: "2067000000000000001",
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
                                created_at: "Tue Jun 16 08:00:00 +0000 2026",
                                full_text: "Fresh X GraphQL update",
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

function buildTwitterGraphqlHighlightsPayload() {
  return {
    data: {
      user: {
        result: {
          timeline: {
            timeline: {
              instructions: [
                {
                  entries: [
                    {
                      entryId: "tweet-2066410744149922235",
                      content: {
                        clientEventInfo: {
                          component: "highlights",
                        },
                        itemContent: {
                          tweet_results: {
                            result: {
                              __typename: "Tweet",
                              rest_id: "2066410744149922235",
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
                                created_at: "Mon Jun 15 06:41:28 +0000 2026",
                                full_text:
                                  "AMD has launched a local AI development platform that's about the same size as the Mac mini",
                                extended_entities: {
                                  media: [
                                    {
                                      type: "video",
                                      media_url_https:
                                        "https://pbs.twimg.com/ext_tw_video_thumb/latest/pu/img/video.jpg",
                                      video_info: {
                                        variants: [
                                          {
                                            bitrate: 832000,
                                            content_type: "video/mp4",
                                            url: "https://video.twimg.com/ext_tw_video/latest/vid/640x360/video.mp4",
                                          },
                                        ],
                                      },
                                    },
                                  ],
                                },
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

function buildTwitterNitterSearchRssFeed() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
  <channel>
    <title>Search results for "from:dotey -filter:replies -filter:retweets"</title>
    <link>https://nitter.perennialte.ch/search</link>
    <description>Twitter feed for: Search "from:dotey -filter:replies -filter:retweets".</description>
    <item>
      <title>baoyu-design skill 可以在本地生成动画视频，导出 mp4 格式，就像附件视频这个。</title>
      <dc:creator>@dotey</dc:creator>
      <description><![CDATA[<p>baoyu-design skill 可以在本地生成动画视频，导出 mp4 格式，就像附件视频这个。</p><img src="http://nitter.perennialte.ch/pic/media%2Ffresh.jpg" />]]></description>
      <pubDate>Wed, 17 Jun 2026 00:21:40 GMT</pubDate>
      <guid isPermaLink="false">2067039941960327204</guid>
      <link>http://nitter.perennialte.ch/dotey/status/2067039941960327204#m</link>
    </item>
  </channel>
</rss>`;
}

function mockTwitterGraphqlFallback(requestedUrls: string[] = []) {
  return async (input: string | URL | Request) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url === "http://rsshub.local:1200/twitter/user/dotey?format=json") {
      return new Response("not found", { status: 404 });
    }

    if (
      url ===
      "https://syndication.twitter.com/srv/timeline-profile/screen-name/dotey?dnt=true&lang=en"
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
      return new Response(JSON.stringify(buildTwitterGraphqlTweetsPayload()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };
}

test("resolveFeedInput maps Bilibili RSSHub user video routes to the local adapter", async () => {
  const resolved = await resolveFeedInput(
    "rsshub://bilibili/user/video/520819684",
  );

  assert.deepEqual(resolved, {
    inputUrl: "rsshub://bilibili/user/video/520819684",
    feedUrl: "bilibili://user/video/520819684",
    rsshubRoute: "/bilibili/user/video/520819684",
    platform: "bilibili",
    domainKey: "bilibili.com",
    siteUrl: "https://space.bilibili.com/520819684",
  });
});

test("resolveFeedInput preserves configured RSSHub query params for Bilibili routes", async () => {
  process.env.RSSHUB_BASE_URL = "http://rsshub.local:1200?format=json";
  process.env.RSSHUB_ACCESS_CODE = "custom-access-code";

  const resolved = await resolveFeedInput(
    "rsshub://bilibili/user/video/60245738",
  );

  assert.equal(
    resolved.feedUrl,
    "http://rsshub.local:1200/bilibili/user/video/60245738?format=json&code=custom-access-code",
  );
  assert.equal(resolved.platform, "bilibili");
  assert.equal(resolved.rsshubRoute, "/bilibili/user/video/60245738");
});

test("resolveFeedInput maps Twitter RSSHub user routes to twitter feeds", async () => {
  process.env.RSSHUB_BASE_URL = "http://rsshub.local:1200?format=json";

  const resolved = await resolveFeedInput("rsshub://twitter/user/dotey");

  assert.deepEqual(resolved, {
    inputUrl: "rsshub://twitter/user/dotey",
    feedUrl: "http://rsshub.local:1200/twitter/user/dotey?format=json",
    rsshubRoute: "/twitter/user/dotey",
    platform: "twitter",
    domainKey: "twitter.com",
    siteUrl: "https://twitter.com",
  });
});

test("previewFeed reads configured RSSHub JSON feeds for Bilibili routes", async () => {
  process.env.RSSHUB_BASE_URL =
    "http://rsshub.local:1200?format=json&code=custom-access-code";
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    assert.equal(
      url,
      "http://rsshub.local:1200/bilibili/user/video/60245738?format=json&code=custom-access-code",
    );

    return new Response(
      JSON.stringify({
        title: "小Lin说 的 bilibili 空间",
        link: "https://space.bilibili.com/60245738",
        items: [
          {
            title: "十五五 规划里，藏了什么重点？",
            link: "https://www.bilibili.com/video/BV1test60245",
            pubDate: "2026-05-26T10:00:00.000Z",
            description: "视频简介",
            enclosure: {
              url: "https://i0.hdslb.com/bfs/archive/cover.jpg",
            },
          },
        ],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };

  const preview = await previewFeed("rsshub://bilibili/user/video/60245738");

  assert.equal(preview.title, "小Lin说 的 bilibili 空间");
  assert.equal(preview.platform, "bilibili");
  assert.equal(preview.feedUrl, requestedUrls[0]);
  assert.deepEqual(preview.items, [
    {
      title: "十五五 规划里，藏了什么重点？",
      link: "https://www.bilibili.com/video/BV1test60245",
      publishedAt: "2026-05-26T10:00:00.000Z",
    },
  ]);
});

test("previewFeed reads Twitter RSSHub JSON feeds", async () => {
  process.env.RSSHUB_BASE_URL = "http://rsshub.local:1200?format=json";
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    assert.equal(url, "http://rsshub.local:1200/twitter/user/dotey?format=json");

    return new Response(
      JSON.stringify({
        title: "dotey 的 Twitter",
        link: "https://twitter.com/dotey",
        items: [
          {
            title: "第一条 Twitter 更新",
            link: "https://twitter.com/dotey/status/1234567890",
            pubDate: "2026-06-01T08:00:00.000Z",
            description: "Twitter 更新正文",
          },
        ],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };

  const preview = await previewFeed("rsshub://twitter/user/dotey");

  assert.equal(preview.title, "dotey 的 Twitter");
  assert.equal(preview.platform, "twitter");
  assert.equal(preview.sourceType, "twitter");
  assert.equal(preview.feedUrl, requestedUrls[0]);
  assert.equal(preview.siteUrl, "https://twitter.com/dotey");
  assert.deepEqual(preview.items, [
    {
      title: "第一条 Twitter 更新",
      link: "https://twitter.com/dotey/status/1234567890",
      publishedAt: "2026-06-01T08:00:00.000Z",
    },
  ]);
});

test("previewFeed reads X embedded timeline when RSSHub cannot preview Twitter", async () => {
  process.env.RSSHUB_BASE_URL = "http://rsshub.local:1200?format=json";
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url === "http://rsshub.local:1200/twitter/user/dotey?format=json") {
      return new Response("not found", { status: 404 });
    }

    if (url === "https://x.com" || url === "https://api.x.com/1.1/guest/activate.json") {
      return new Response("unavailable", { status: 503 });
    }

    assert.equal(url, "https://syndication.twitter.com/srv/timeline-profile/screen-name/dotey?dnt=true&lang=en");

    return new Response(buildTwitterEmbeddedTimelineHtml(), {
      status: 200,
      headers: {
        "Content-Type": "text/html",
      },
    });
  };

  const preview = await previewFeed("rsshub://twitter/user/dotey");

  assert.equal(requestedUrls[0], "http://rsshub.local:1200/twitter/user/dotey?format=json");
  assert.ok(requestedUrls.includes("https://x.com"));
  assert.ok(
    requestedUrls.includes(
      "https://syndication.twitter.com/srv/timeline-profile/screen-name/dotey?dnt=true&lang=en",
    ),
  );
  assert.equal(preview.title, "Twitter @宝玉");
  assert.equal(preview.platform, "twitter");
  assert.equal(preview.sourceType, "twitter");
  assert.equal(preview.siteUrl, "https://twitter.com/dotey");
  assert.deepEqual(preview.items, [
    {
      title: "A thread for my nana banana pro prompts 🧵 https://t.co/riAcKUtR6T",
      link: "https://x.com/dotey/status/1996285439867556304",
      publishedAt: "2025-12-03T18:28:32.000Z",
    },
  ]);
});

test("previewFeed falls back to X embedded timeline for default Twitter RSSHub", async () => {
  process.env.RSSHUB_BASE_URL = "https://rsshub.app?format=json";
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url === "https://rsshub.app/twitter/user/dotey?format=json") {
      return new Response("not found", { status: 404 });
    }

    if (url === "https://x.com" || url === "https://api.x.com/1.1/guest/activate.json") {
      return new Response("unavailable", { status: 503 });
    }

    assert.equal(url, "https://syndication.twitter.com/srv/timeline-profile/screen-name/dotey?dnt=true&lang=en");

    return new Response(buildTwitterEmbeddedTimelineHtml(), {
      status: 200,
      headers: {
        "Content-Type": "text/html",
      },
    });
  };

  const preview = await previewFeed("rsshub://twitter/user/dotey");

  assert.equal(requestedUrls[0], "https://rsshub.app/twitter/user/dotey?format=json");
  assert.ok(requestedUrls.includes("https://x.com"));
  assert.ok(
    requestedUrls.includes(
      "https://syndication.twitter.com/srv/timeline-profile/screen-name/dotey?dnt=true&lang=en",
    ),
  );
  assert.equal(preview.title, "Twitter @宝玉");
  assert.equal(preview.platform, "twitter");
  assert.equal(preview.items.length, 1);
});

test("previewFeed uses cached X embedded timeline items when Twitter is rate-limited", async () => {
  process.env.RSSHUB_BASE_URL = "http://rsshub.local:1200?format=json";
  let embeddedRequestCount = 0;

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "http://rsshub.local:1200/twitter/user/dotey?format=json") {
      return new Response("not found", { status: 404 });
    }

    if (url === "https://x.com" || url === "https://api.x.com/1.1/guest/activate.json") {
      return new Response("unavailable", { status: 503 });
    }

    assert.equal(url, "https://syndication.twitter.com/srv/timeline-profile/screen-name/dotey?dnt=true&lang=en");
    embeddedRequestCount += 1;

    if (embeddedRequestCount === 1) {
      return new Response(buildTwitterEmbeddedTimelineHtml(), {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      });
    }

    return new Response("rate limited", { status: 429 });
  };

  const firstPreview = await previewFeed("rsshub://twitter/user/dotey");
  assert.equal(firstPreview.items.length, 1);

  const cachedPreview = await previewFeed("rsshub://twitter/user/dotey");

  assert.equal(embeddedRequestCount, 1);
  assert.equal(cachedPreview.title, "Twitter @宝玉");
  assert.deepEqual(cachedPreview.items, firstPreview.items);
});

test("previewFeed rejects Twitter preview when RSSHub and X embedded timeline both fail", async () => {
  process.env.RSSHUB_BASE_URL = "http://rsshub.local:1200?format=json";

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "http://rsshub.local:1200/twitter/user/dotey?format=json") {
      return new Response("not found", { status: 404 });
    }

    if (
      url ===
      "https://syndication.twitter.com/srv/timeline-profile/screen-name/dotey?dnt=true&lang=en"
    ) {
      return new Response("unavailable", { status: 500 });
    }

    if (url === "https://api.x.com/1.1/guest/activate.json") {
      return new Response("rate limited", { status: 429 });
    }

    return new Response("unavailable", { status: 503 });
  };

  await assert.rejects(
    () => previewFeed("rsshub://twitter/user/dotey"),
    {
      message: "Twitter embedded timeline 返回 500。",
    },
  );
});

test("previewFeed reads X Web GraphQL when embedded timeline is rate-limited", async () => {
  process.env.RSSHUB_BASE_URL = "http://rsshub.local:1200?format=json";
  const requestedUrls: string[] = [];
  globalThis.fetch = mockTwitterGraphqlFallback(requestedUrls);

  const preview = await previewFeed("rsshub://twitter/user/dotey");

  assert.equal(preview.title, "Twitter @宝玉");
  assert.equal(preview.platform, "twitter");
  assert.equal(preview.sourceType, "twitter");
  assert.equal(preview.siteUrl, "https://twitter.com/dotey");
  assert.deepEqual(preview.items, [
    {
      title: "A thread for my nana banana pro prompts 🧵 https://t.co/riAcKUtR6T",
      link: "https://x.com/dotey/status/1996285439867556304",
      publishedAt: "2025-12-03T18:28:32.000Z",
    },
  ]);
  assert.ok(
    requestedUrls.some((url) =>
      url.startsWith("https://x.com/i/api/graphql/tweets-query/UserTweets"),
    ),
  );
});

test("fetchNormalizedItems stores Twitter RSSHub items as status updates", async () => {
  process.env.RSSHUB_BASE_URL = "http://rsshub.local:1200?format=json";

  globalThis.fetch = async (input) => {
    assert.equal(String(input), "http://rsshub.local:1200/twitter/user/dotey?format=json");

    return new Response(
      JSON.stringify({
        title: "dotey 的 Twitter",
        link: "https://twitter.com/dotey",
        items: [
          {
            title: "Twitter 标准化更新",
            link: "https://twitter.com/dotey/status/2345678901",
            pubDate: "2026-06-02T09:30:00.000Z",
            author: "dotey",
            description: "Twitter 标准化正文",
            content_html:
              '<p>Twitter 标准化正文</p><img src="https://pbs.twimg.com/media/rsshub.jpg"><video poster="https://pbs.twimg.com/media/poster.jpg"><source src="https://video.twimg.com/ext_tw_video/test.mp4" type="video/mp4"></video>',
          },
        ],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };

  const items = await fetchNormalizedItems("rsshub://twitter/user/dotey");

  assert.equal(items.length, 1);
  assert.equal(items[0].platform, "twitter");
  assert.equal(items[0].mediaType, "status");
  assert.equal(items[0].embedUrl, null);
  assert.equal(items[0].contentUrl, "https://twitter.com/dotey/status/2345678901");
  assert.equal(items[0].author, "dotey");
  assert.equal(
    items[0].contentHtml?.includes("https://pbs.twimg.com/media/rsshub.jpg"),
    true,
  );
  assert.equal(
    items[0].contentHtml?.includes("https://video.twimg.com/ext_tw_video/test.mp4"),
    true,
  );
});

test("fetchNormalizedItems falls back to X embedded timeline for Twitter content", async () => {
  process.env.RSSHUB_BASE_URL = "http://rsshub.local:1200?format=json";

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "http://rsshub.local:1200/twitter/user/dotey?format=json") {
      return new Response("not found", { status: 404 });
    }

    assert.equal(
      url,
      "https://syndication.twitter.com/srv/timeline-profile/screen-name/dotey?dnt=true&lang=en",
    );

    return new Response(buildTwitterEmbeddedTimelineHtml(), {
      status: 200,
      headers: {
        "Content-Type": "text/html",
      },
    });
  };

  const items = await fetchNormalizedItems("rsshub://twitter/user/dotey");

  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "twitter:1996285439867556304");
  assert.equal(items[0].platform, "twitter");
  assert.equal(items[0].mediaType, "status");
  assert.equal(items[0].embedUrl, null);
  assert.equal(items[0].author, "宝玉");
  assert.equal(
    items[0].contentUrl,
    "https://x.com/dotey/status/1996285439867556304",
  );
  assert.equal(
    items[0].thumbnailUrl,
    "https://pbs.twimg.com/media/G7Q7BCiWAAA-4sc.jpg",
  );
  assert.equal(items[0].publishedAt?.toISOString(), "2025-12-03T18:28:32.000Z");
});

test("fetchNormalizedItems falls back to X Web GraphQL when embedded timeline is rate-limited", async () => {
  process.env.RSSHUB_BASE_URL = "http://rsshub.local:1200?format=json";
  globalThis.fetch = mockTwitterGraphqlFallback();

  const items = await fetchNormalizedItems("rsshub://twitter/user/dotey");

  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "twitter:1996285439867556304");
  assert.equal(items[0].platform, "twitter");
  assert.equal(items[0].mediaType, "status");
  assert.equal(items[0].embedUrl, null);
  assert.equal(items[0].author, "宝玉");
  assert.equal(
    items[0].contentUrl,
    "https://x.com/dotey/status/1996285439867556304",
  );
  assert.equal(
    items.some((item) => item.contentUrl === "https://x.com/elonmusk/status/1999999999999999999"),
    false,
  );
  assert.equal(
    items[0].contentHtml?.includes("data-lxy-twitter-media"),
    true,
  );
});

test("fetchNormalizedItems prefers X Web GraphQL over stale default Twitter RSSHub items", async () => {
  process.env.RSSHUB_BASE_URL = "https://rsshub.app?format=json";
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url === "https://rsshub.app/twitter/user/dotey?format=json") {
      return new Response(
        JSON.stringify({
          title: "Twitter @宝玉",
          link: "https://twitter.com/dotey",
          items: [
            {
              title: "Stale RSSHub update",
              link: "https://x.com/dotey/status/1996285439867556304",
              pubDate: "2025-12-03T18:28:32.000Z",
              author: "宝玉",
              content_html: "<p>Stale RSSHub update</p>",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
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
      return new Response(JSON.stringify(buildTwitterGraphqlFreshTweetsPayload()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const items = await fetchNormalizedItems("rsshub://twitter/user/dotey");

  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "twitter:2067000000000000001");
  assert.equal(items[0].title, "Fresh X GraphQL update");
  assert.equal(items[0].publishedAt?.toISOString(), "2026-06-16T08:00:00.000Z");
  assert.equal(
    items.some((item) =>
      item.contentUrl === "https://x.com/dotey/status/1996285439867556304"
    ),
    false,
  );
  assert.ok(
    requestedUrls.some((url) =>
      url.startsWith("https://x.com/i/api/graphql/tweets-query/UserTweets"),
    ),
  );
});

test("fetchNormalizedItems reads latest Twitter posts from Nitter when X only exposes highlights", async () => {
  process.env.RSSHUB_BASE_URL = "https://rsshub.app?format=json";
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url === "https://rsshub.app/twitter/user/dotey?format=json") {
      return new Response(
        JSON.stringify({
          title: "Twitter @宝玉",
          link: "https://twitter.com/dotey",
          items: [
            {
              title: "Stale RSSHub update",
              link: "https://x.com/dotey/status/1996285439867556304",
              pubDate: "2025-12-03T18:28:32.000Z",
              author: "宝玉",
              content_html: "<p>Stale RSSHub update</p>",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
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
      return new Response(JSON.stringify(buildTwitterGraphqlHighlightsPayload()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.startsWith("https://nitter.perennialte.ch/search/rss?")) {
      const nitterUrl = new URL(url);

      assert.equal(nitterUrl.searchParams.get("f"), "tweets");
      assert.equal(
        nitterUrl.searchParams.get("q"),
        "from:dotey -filter:replies -filter:retweets",
      );

      return new Response(buildTwitterNitterSearchRssFeed(), {
        status: 200,
        headers: { "Content-Type": "application/rss+xml" },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const items = await fetchNormalizedItems("rsshub://twitter/user/dotey");

  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "twitter:2067039941960327204");
  assert.equal(
    items[0].title,
    "baoyu-design skill 可以在本地生成动画视频，导出 mp4 格式，就像附件视频这个。",
  );
  assert.equal(items[0].publishedAt?.toISOString(), "2026-06-17T00:21:40.000Z");
  assert.equal(
    items[0].contentUrl,
    "https://x.com/dotey/status/2067039941960327204",
  );
  assert.equal(
    items[0].thumbnailUrl,
    "https://nitter.perennialte.ch/pic/media%2Ffresh.jpg",
  );
  assert.equal(
    items.some((item) =>
      item.contentUrl === "https://x.com/dotey/status/1996285439867556304"
    ),
    false,
  );
  assert.ok(
    requestedUrls.some((url) => url.startsWith("https://nitter.perennialte.ch/search/rss?")),
  );
  assert.equal(
    requestedUrls.some((url) =>
      url.startsWith("https://x.com/i/api/graphql/highlights-query/UserHighlightsTweets"),
    ),
    false,
  );
});

test("fetchNormalizedItems uses X Web highlights when default timeline only exposes profile highlights", async () => {
  process.env.RSSHUB_BASE_URL = "http://rsshub.local:1200?format=json";
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url === "http://rsshub.local:1200/twitter/user/dotey?format=json") {
      return new Response("not found", { status: 404 });
    }

    if (
      url ===
      "https://syndication.twitter.com/srv/timeline-profile/screen-name/dotey?dnt=true&lang=en"
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
      return new Response(JSON.stringify(buildTwitterGraphqlHighlightsPayload()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      url.startsWith(
        "https://x.com/i/api/graphql/highlights-query/UserHighlightsTweets",
      )
    ) {
      return new Response(JSON.stringify(buildTwitterGraphqlHighlightsPayload()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const items = await fetchNormalizedItems("rsshub://twitter/user/dotey");

  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "twitter:2066410744149922235");
  assert.equal(items[0].publishedAt?.toISOString(), "2026-06-15T06:41:28.000Z");
  assert.equal(items[0].thumbnailUrl, "https://pbs.twimg.com/ext_tw_video_thumb/latest/pu/img/video.jpg");
  assert.equal(
    decodeURIComponent(items[0].contentHtml || "").includes(
      "https://video.twimg.com/ext_tw_video/latest/vid/640x360/video.mp4",
    ),
    true,
  );
  assert.ok(
    requestedUrls.some((url) =>
      url.startsWith("https://x.com/i/api/graphql/highlights-query/UserHighlightsTweets"),
    ),
  );
});

test("previewFeed returns Bilibili preview data without RSSHub", async () => {
  const requestedUrls = mockBilibiliArchiveSearch();

  const preview = await previewFeed("https://space.bilibili.com/520819684");

  assert.equal(preview.title, "测试 UP 主");
  assert.equal(preview.platform, "bilibili");
  assert.equal(preview.sourceType, "bilibili");
  assert.equal(preview.feedUrl, "bilibili://user/video/520819684");
  assert.equal(preview.siteUrl, "https://space.bilibili.com/520819684");
  assert.equal(preview.items.length, 2);
  assert.deepEqual(preview.items[0], {
    title: "第一条 B 站视频",
    link: "https://www.bilibili.com/video/BV1abc123456",
    publishedAt: "2025-11-24T10:40:00.000Z",
  });
  assert.deepEqual(
    requestedUrls.map((url) => new URL(url).pathname),
    ["/x/web-interface/nav", "/x/space/wbi/arc/search"],
  );
});

test("previewFeed falls back to the Bilibili app archive when web archive is risk-blocked", async () => {
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

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

    if (url.startsWith("https://app.bilibili.com/x/v2/space/archive?")) {
      const appUrl = new URL(url);

      assert.equal(appUrl.searchParams.get("vmid"), "520819684");
      assert.equal(appUrl.searchParams.get("mobi_app"), "android");
      assert.match(appUrl.searchParams.get("sign") || "", /^[a-f0-9]{32}$/);

      return new Response(
        JSON.stringify({
          code: 0,
          data: {
            count: 1,
            item: [
              {
                bvid: "BV1app123456",
                param: "1133557799",
                title: "APP 接口返回的视频",
                cover: "http://i1.hdslb.com/bfs/archive/app-cover.jpg",
                ctime: 1763980800,
                author: "APP 测试 UP",
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
    }

    return new Response(
      JSON.stringify({
        code: -352,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };

  const preview = await previewFeed("rsshub://bilibili/user/video/520819684");

  assert.equal(preview.title, "APP 测试 UP");
  assert.equal(preview.platform, "bilibili");
  assert.equal(preview.feedUrl, "bilibili://user/video/520819684");
  assert.equal(preview.siteUrl, "https://space.bilibili.com/520819684");
  assert.equal(preview.warning, undefined);
  assert.deepEqual(preview.items, [
    {
      title: "APP 接口返回的视频",
      link: "https://www.bilibili.com/video/BV1app123456",
      publishedAt: "2025-11-24T10:40:00.000Z",
    },
  ]);
  assert.deepEqual(
    requestedUrls.map((url) => new URL(url).hostname),
    ["api.bilibili.com", "api.bilibili.com", "app.bilibili.com"],
  );
});

test("fetchNormalizedItems converts Bilibili archives to playable video items", async () => {
  mockBilibiliArchiveSearch();

  const items = await fetchNormalizedItems("bilibili://user/video/520819684");

  assert.equal(items.length, 2);
  assert.equal(items[0].externalId, "BV1abc123456");
  assert.equal(items[0].title, "第一条 B 站视频");
  assert.equal(items[0].author, "测试 UP 主");
  assert.equal(items[0].contentUrl, "https://www.bilibili.com/video/BV1abc123456");
  assert.equal(items[0].summary, "视频简介");
  assert.equal(items[0].thumbnailUrl, "https://i0.hdslb.com/bfs/archive/cover.jpg");
  assert.equal(items[0].mediaType, "video");
  assert.equal(items[0].platform, "bilibili");
  assert.equal(
    items[0].embedUrl,
    "https://player.bilibili.com/player.html?bvid=BV1abc123456",
  );
  assert.equal(items[0].publishedAt?.toISOString(), "2025-11-24T10:40:00.000Z");
});

test("fetchNormalizedItems reads every Bilibili web archive page", async () => {
  const requestedPages: string[] = [];

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
    assert.equal(apiUrl.pathname, "/x/space/wbi/arc/search");
    assert.equal(apiUrl.searchParams.get("mid"), "520819684");
    assert.equal(apiUrl.searchParams.get("ps"), "50");
    requestedPages.push(apiUrl.searchParams.get("pn") || "");

    const page = Number(apiUrl.searchParams.get("pn"));

    return new Response(
      JSON.stringify({
        code: 0,
        data: {
          info: {
            name: "多页测试 UP",
          },
          page: {
            count: 3,
          },
          list: {
            vlist:
              page === 1
                ? [
                    {
                      bvid: "BV1page00001",
                      title: "第一页第一条",
                      description: "第一页简介",
                      pic: "//i0.hdslb.com/bfs/archive/page-1.jpg",
                      created: 1763980800,
                    },
                    {
                      bvid: "BV1page00002",
                      title: "第一页第二条",
                      description: "",
                      pic: "//i0.hdslb.com/bfs/archive/page-2.jpg",
                      created: 1763894400,
                    },
                  ]
                : [
                    {
                      bvid: "BV1page00003",
                      title: "第二页第一条",
                      description: "第二页简介",
                      pic: "//i0.hdslb.com/bfs/archive/page-3.jpg",
                      created: 1763808000,
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
  };

  const items = await fetchNormalizedItems("bilibili://user/video/520819684");

  assert.deepEqual(requestedPages, ["1", "2"]);
  assert.equal(items.length, 3);
  assert.equal(items[2].externalId, "BV1page00003");
  assert.equal(items[2].author, "多页测试 UP");
  assert.equal(items[2].thumbnailUrl, "https://i0.hdslb.com/bfs/archive/page-3.jpg");
  assert.equal(
    items[2].embedUrl,
    "https://player.bilibili.com/player.html?bvid=BV1page00003",
  );
});

test("fetchNormalizedItems reads every Bilibili app fallback page", async () => {
  const requestedPages: string[] = [];

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
    assert.equal(apiUrl.searchParams.get("vmid"), "520819684");
    assert.equal(apiUrl.searchParams.get("ps"), "50");
    assert.match(apiUrl.searchParams.get("sign") || "", /^[a-f0-9]{32}$/);
    requestedPages.push(apiUrl.searchParams.get("pn") || "");

    const page = Number(apiUrl.searchParams.get("pn"));

    return new Response(
      JSON.stringify({
        code: 0,
        data: {
          count: 3,
          item:
            page === 1
              ? [
                  {
                    bvid: "BV1app000001",
                    param: "1000001",
                    title: "APP 第一页第一条",
                    subtitle: "APP 第一页简介",
                    cover: "http://i0.hdslb.com/bfs/archive/app-1.jpg",
                    ctime: 1763980800,
                    author: "APP 多页 UP",
                  },
                  {
                    bvid: "BV1app000002",
                    param: "1000002",
                    title: "APP 第一页第二条",
                    cover: "http://i0.hdslb.com/bfs/archive/app-2.jpg",
                    ctime: 1763894400,
                    author: "APP 多页 UP",
                  },
                ]
              : [
                  {
                    bvid: "BV1app000003",
                    param: "1000003",
                    title: "APP 第二页第一条",
                    subtitle: "APP 第二页简介",
                    cover: "http://i0.hdslb.com/bfs/archive/app-3.jpg",
                    ctime: 1763808000,
                    author: "APP 多页 UP",
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

  const items = await fetchNormalizedItems("bilibili://user/video/520819684");

  assert.deepEqual(requestedPages, ["1", "2"]);
  assert.equal(items.length, 3);
  assert.equal(items[0].author, "APP 多页 UP");
  assert.equal(items[2].externalId, "BV1app000003");
  assert.equal(items[2].summary, "APP 第二页简介");
  assert.equal(
    items[2].embedUrl,
    "https://player.bilibili.com/player.html?bvid=BV1app000003",
  );
});

test("fetchNormalizedItems builds YouTube thumbnails from video ids when feeds omit media thumbnails", async () => {
  globalThis.fetch = async (input) => {
    assert.equal(
      String(input),
      "http://rsshub.local/youtube/channel/test-channel?format=json",
    );

    return new Response(
      JSON.stringify({
        title: "YouTube Test Feed",
        link: "https://www.youtube.com/channel/test-channel",
        items: [
          {
            title: "YouTube item without thumbnail",
            link: "https://www.youtube.com/watch?v=abc123XYZ_0",
            pubDate: "2026-05-31T05:31:04.000Z",
            author: "Test Channel",
          },
        ],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };

  const items = await fetchNormalizedItems(
    "http://rsshub.local/youtube/channel/test-channel?format=json",
  );

  assert.equal(items.length, 1);
  assert.equal(
    items[0].thumbnailUrl,
    "https://i.ytimg.com/vi/abc123XYZ_0/hqdefault.jpg",
  );
  assert.equal(items[0].mediaType, "video");
  assert.equal(
    items[0].embedUrl,
    "https://www.youtube.com/embed/abc123XYZ_0",
  );
});

function buildYouTubeLockupVideo(input: {
  videoId: string;
  title: string;
  publishedText?: string;
  thumbnailUrl?: string;
}) {
  return {
    lockupViewModel: {
      contentId: input.videoId,
      contentImage: {
        thumbnailViewModel: {
          image: {
            sources: [
              {
                url:
                  input.thumbnailUrl ||
                  `https://i.ytimg.com/vi/${input.videoId}/hqdefault.jpg`,
                width: 336,
                height: 188,
              },
            ],
          },
        },
      },
      metadata: {
        lockupMetadataViewModel: {
          title: {
            content: input.title,
          },
          metadata: {
            contentMetadataViewModel: {
              metadataRows: [
                {
                  metadataParts: [
                    {
                      text: {
                        content: "10 views",
                      },
                    },
                    {
                      text: {
                        content: input.publishedText || "1 day ago",
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      rendererContext: {
        commandContext: {
          onTap: {
            innertubeCommand: {
              watchEndpoint: {
                videoId: input.videoId,
              },
            },
          },
        },
      },
    },
  };
}

function buildYouTubeContinuation(token: string) {
  return {
    continuationCommand: {
      token,
    },
  };
}

test("fetchNormalizedItems supplements YouTube official RSS items from channel pages", async () => {
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    if (
      url ===
      "https://www.youtube.com/feeds/videos.xml?channel_id=UCtestChannel&format=json"
    ) {
      return new Response(
        JSON.stringify({
          title: "YouTube Official Feed",
          link: "https://www.youtube.com/channel/UCtestChannel",
          items: [
            {
              title: "RSS keeps the newest title",
              link: "https://www.youtube.com/watch?v=rssVideo001",
              pubDate: "2026-05-31T05:31:04.000Z",
              author: "RSS Channel",
            },
            {
              title: "RSS only item",
              link: "https://www.youtube.com/watch?v=rssVideo002",
              pubDate: "2026-05-30T05:31:04.000Z",
              author: "RSS Channel",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (url === "https://www.youtube.com/channel/UCtestChannel/videos") {
      const initialData = {
        contents: [
          {
            videoRenderer: {
              videoId: "rssVideo001",
              title: {
                runs: [{ text: "Duplicate page title should not replace RSS" }],
              },
              ownerText: {
                runs: [{ text: "Page Channel" }],
              },
              publishedTimeText: {
                simpleText: "1 day ago",
              },
              thumbnail: {
                thumbnails: [
                  {
                    url: "https://i.ytimg.com/vi/rssVideo001/hqdefault.jpg",
                  },
                ],
              },
            },
          },
          {
            videoRenderer: {
              videoId: "pageVideo001",
              title: {
                simpleText: "Page-only video",
              },
              shortBylineText: {
                runs: [{ text: "Page Channel" }],
              },
              publishedTimeText: {
                simpleText: "2 days ago",
              },
              thumbnail: {
                thumbnails: [
                  {
                    url: "//i.ytimg.com/vi/pageVideo001/hqdefault.jpg",
                  },
                ],
              },
            },
          },
          {
            continuationCommand: {
              token: "continuation-token-1",
            },
          },
        ],
      };

      return new Response(
        `<script>var ytInitialData = ${JSON.stringify(initialData)};</script><script>ytcfg.set({"INNERTUBE_API_KEY":"test-api-key","INNERTUBE_CLIENT_VERSION":"test-client-version"});</script>`,
        {
          status: 200,
          headers: {
            "Content-Type": "text/html",
          },
        },
      );
    }

    if (url === "https://www.youtube.com/youtubei/v1/browse?key=test-api-key") {
      return new Response(
        JSON.stringify({
          onResponseReceivedActions: [
            {
              appendContinuationItemsAction: {
                continuationItems: [
                  {
                    videoRenderer: {
                      videoId: "continuationVideo001",
                      title: {
                        simpleText: "Continuation video",
                      },
                      ownerText: {
                        runs: [{ text: "Continuation Channel" }],
                      },
                      publishedTimeText: {
                        simpleText: "3 days ago",
                      },
                      thumbnail: {
                        thumbnails: [
                          {
                            url: "https://i.ytimg.com/vi/continuationVideo001/hqdefault.jpg",
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const items = await fetchNormalizedItems(
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCtestChannel&format=json",
  );

  assert.deepEqual(requestedUrls, [
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCtestChannel&format=json",
    "https://www.youtube.com/channel/UCtestChannel/videos",
    "https://www.youtube.com/youtubei/v1/browse?key=test-api-key",
  ]);
  assert.equal(items.length, 4);
  assert.equal(items[0].title, "RSS keeps the newest title");
  assert.equal(items[2].externalId, "yt:video:pageVideo001");
  assert.equal(items[2].thumbnailUrl, "https://i.ytimg.com/vi/pageVideo001/hqdefault.jpg");
  assert.equal(items[2].summary, "2 days ago");
  assert.equal(items[3].externalId, "yt:video:continuationVideo001");
  assert.equal(
    items[3].embedUrl,
    "https://www.youtube.com/embed/continuationVideo001",
  );
});

test("fetchNormalizedItems supplements YouTube official RSS with 100+ lockup videos", async () => {
  const requestedTokens: string[] = [];

  function buildLockupPage(startIndex: number, nextPage: number | null) {
    const contents = Array.from({ length: 16 }, (_, index) =>
      buildYouTubeLockupVideo({
        videoId:
          startIndex === 0 && index === 0
            ? "rssVideo001"
            : `pageVideo${String(startIndex + index).padStart(3, "0")}`,
        title:
          startIndex === 0 && index === 0
            ? "Duplicate page title should not replace RSS"
            : `Page video ${startIndex + index}`,
        publishedText: `${startIndex + index + 1} days ago`,
        thumbnailUrl: `//i.ytimg.com/vi/pageVideo${String(
          startIndex + index,
        ).padStart(3, "0")}/hqdefault.jpg`,
      }),
    );

    if (nextPage !== null) {
      contents.push(buildYouTubeContinuation(`empty-token-${nextPage}`));
      contents.push(buildYouTubeContinuation(`valid-token-${nextPage}`));
    }

    return { contents };
  }

  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (
      url ===
      "https://www.youtube.com/feeds/videos.xml?channel_id=UCmanyVideos&format=json"
    ) {
      return new Response(
        JSON.stringify({
          title: "YouTube Official Feed",
          link: "https://www.youtube.com/channel/UCmanyVideos",
          items: [
            {
              title: "RSS keeps duplicate title",
              link: "https://www.youtube.com/watch?v=rssVideo001",
              pubDate: "2026-05-31T05:31:04.000Z",
              author: "RSS Channel",
            },
            {
              title: "RSS only item",
              link: "https://www.youtube.com/watch?v=rssVideo002",
              pubDate: "2026-05-30T05:31:04.000Z",
              author: "RSS Channel",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (url === "https://www.youtube.com/channel/UCmanyVideos/videos") {
      const initialData = buildLockupPage(0, 1);

      return new Response(
        `<script>var ytInitialData = ${JSON.stringify(initialData)};</script><script>ytcfg.set({"INNERTUBE_API_KEY":"test-api-key","INNERTUBE_CLIENT_VERSION":"test-client-version"});</script>`,
        {
          status: 200,
          headers: {
            "Content-Type": "text/html",
          },
        },
      );
    }

    if (url === "https://www.youtube.com/youtubei/v1/browse?key=test-api-key") {
      const body = JSON.parse(String(init?.body || "{}")) as {
        continuation?: string;
      };
      const token = body.continuation || "";
      requestedTokens.push(token);

      if (token.startsWith("empty-token-")) {
        return new Response(
          JSON.stringify({
            contents: [],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      const page = Number(token.replace("valid-token-", ""));
      const nextPage = page < 7 ? page + 1 : null;

      return new Response(JSON.stringify(buildLockupPage(page * 16, nextPage)), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const items = await fetchNormalizedItems(
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCmanyVideos&format=json",
  );

  assert.equal(items.length, 129);
  assert.equal(items[0].title, "RSS keeps duplicate title");
  assert.equal(items[2].externalId, "yt:video:pageVideo001");
  assert.equal(items.at(-1)?.externalId, "yt:video:pageVideo127");
  assert.equal(
    items.at(-1)?.thumbnailUrl,
    "https://i.ytimg.com/vi/pageVideo127/hqdefault.jpg",
  );
  assert.ok(requestedTokens.includes("empty-token-1"));
  assert.ok(requestedTokens.includes("valid-token-7"));
});

test("fetchNormalizedItems keeps YouTube RSS items when page supplement fails", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (
      url ===
      "https://www.youtube.com/feeds/videos.xml?channel_id=UCfallback&format=json"
    ) {
      return new Response(
        JSON.stringify({
          title: "YouTube Official Feed",
          link: "https://www.youtube.com/channel/UCfallback",
          items: [
            {
              title: "RSS fallback item",
              link: "https://www.youtube.com/watch?v=fallback001",
              pubDate: "2026-05-31T05:31:04.000Z",
              author: "RSS Channel",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (url === "https://www.youtube.com/channel/UCfallback/videos") {
      return new Response("blocked", { status: 403 });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const items = await fetchNormalizedItems(
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCfallback&format=json",
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "RSS fallback item");
  assert.equal(items[0].externalId, "https://www.youtube.com/watch?v=fallback001");
});
