import assert from "node:assert/strict";
import { test } from "node:test";

import { getPreviewEmptyMessage } from "./preview-display.ts";

test("getPreviewEmptyMessage does not ask for Bilibili access setup when preview is ready but empty", () => {
  const message = getPreviewEmptyMessage({
    platform: "bilibili",
    warning: undefined,
    itemsLength: 0,
  });

  assert.equal(message, "当前来源没有返回可预览的视频内容，仍可确认订阅。");
});

test("getPreviewEmptyMessage asks for Bilibili access setup only when preview has a warning", () => {
  const message = getPreviewEmptyMessage({
    platform: "bilibili",
    warning: "Bilibili 返回风控拦截，当前匿名接口暂时无法抓取。",
    itemsLength: 0,
  });

  assert.equal(message, "暂时无法预览最新内容，请先配置 Bilibili 访问方式。");
});

test("getPreviewEmptyMessage returns null when preview has items", () => {
  const message = getPreviewEmptyMessage({
    platform: "bilibili",
    warning: undefined,
    itemsLength: 1,
  });

  assert.equal(message, null);
});
