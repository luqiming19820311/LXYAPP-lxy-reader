import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";

test("Settings page hides network configuration UI while retaining feed settings functionality", async () => {
  const pageSource = await readFile("src/app/page.tsx", "utf8");

  for (const visibleText of [
    "Network",
    "RSSHub Base URL",
    "Bilibili Cookie",
    "Save Feed Settings",
    "Clear Cookie",
    "Background Refresh Interval",
  ]) {
    assert.equal(
      pageSource.includes(visibleText),
      false,
      `Settings UI should not expose "${visibleText}"`,
    );
  }

  await access("src/lib/feed-settings.ts");
  await access("src/app/api/settings/feed/route.ts");
});
