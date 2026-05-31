import assert from "node:assert/strict";
import { test } from "node:test";

import { formatOpmlImportMessage } from "./opml-import-message.ts";

test("formatOpmlImportMessage summarizes successful imports", () => {
  assert.equal(
    formatOpmlImportMessage({
      imported: 2,
      updated: 1,
      failed: 0,
      results: [
        {
          title: "Created One",
          feedUrl: "https://example.com/one.xml",
          status: "created",
        },
        {
          title: "Created Two",
          feedUrl: "https://example.com/two.xml",
          status: "created",
        },
        {
          title: "Updated",
          feedUrl: "https://example.com/updated.xml",
          status: "updated",
        },
      ],
    }),
    "导入完成：新增 2 个，更新 1 个，失败 0 个。",
  );
});

test("formatOpmlImportMessage includes failed source titles and reasons", () => {
  assert.equal(
    formatOpmlImportMessage({
      imported: 1,
      updated: 0,
      failed: 2,
      results: [
        {
          title: "Good Feed",
          feedUrl: "https://example.com/good.xml",
          status: "created",
        },
        {
          title: "Broken Feed",
          feedUrl: "not-a-url",
          status: "failed",
          error: "Invalid URL",
        },
        {
          title: "",
          feedUrl: "https://example.com/no-title.xml",
          status: "failed",
        },
      ],
    }),
    "导入完成：新增 1 个，更新 0 个，失败 2 个。失败项：Broken Feed - Invalid URL；https://example.com/no-title.xml - 未知错误。",
  );
});

test("formatOpmlImportMessage limits the failed source list", () => {
  assert.equal(
    formatOpmlImportMessage({
      imported: 0,
      updated: 0,
      failed: 4,
      results: [
        {
          title: "A",
          feedUrl: "https://example.com/a.xml",
          status: "failed",
        },
        {
          title: "B",
          feedUrl: "https://example.com/b.xml",
          status: "failed",
        },
        {
          title: "C",
          feedUrl: "https://example.com/c.xml",
          status: "failed",
        },
        {
          title: "D",
          feedUrl: "https://example.com/d.xml",
          status: "failed",
        },
      ],
    }),
    "导入完成：新增 0 个，更新 0 个，失败 4 个。失败项：A - 未知错误；B - 未知错误；C - 未知错误；另有 1 个失败项。",
  );
});
