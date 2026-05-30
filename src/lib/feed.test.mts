import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  fetchNormalizedItems,
  previewFeed,
  resolveFeedInput,
} from "./feed.ts";

const originalFetch = globalThis.fetch;
const originalRsshubBaseUrl = process.env.RSSHUB_BASE_URL;
const originalRsshubAccessCode = process.env.RSSHUB_ACCESS_CODE;

afterEach(() => {
  globalThis.fetch = originalFetch;
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
    assert.equal(apiUrl.searchParams.get("ps"), "20");
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
