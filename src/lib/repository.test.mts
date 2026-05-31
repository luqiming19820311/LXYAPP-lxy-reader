import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { prisma } from "./prisma.ts";
import { createSubscription, setReadLaterState } from "./repository.ts";

const originalFetch = globalThis.fetch;
const testMid = "999999001";
const testFeedUrl = `bilibili://user/video/${testMid}`;

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await prisma.subscription.deleteMany({
    where: {
      feedUrl: testFeedUrl,
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
