import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("dark theme CSS overrides sidebar light surface colors", async () => {
  const css = await readFile("src/app/globals.css", "utf8");

  for (const color of [
    "f7f5f6",
    "f7f8f9",
    "f8f9fa",
    "f3f5f7",
    "e1e0e2",
  ]) {
    assert.match(
      css,
      new RegExp(`:root\\[data-theme="dark"\\][^{}]*\\.bg-\\\\\\[\\\\#${color}\\\\\\]`, "s"),
      `missing dark override for bg-[#${color}]`,
    );
  }
});

test("dark theme CSS overrides dark text colors used in reader content", async () => {
  const css = await readFile("src/app/globals.css", "utf8");

  for (const color of [
    "1d232c",
    "202934",
    "222831",
    "242b34",
    "2b3038",
    "2f3540",
    "2f3b4a",
    "3b4552",
    "45505c",
    "4b535d",
    "4d535b",
    "4d5662",
    "555a62",
    "575e68",
    "59616b",
    "5d636b",
    "606771",
    "616974",
    "646b75",
    "6a6870",
    "6a7078",
    "747b84",
  ]) {
    assert.match(
      css,
      new RegExp(`:root\\[data-theme="dark"\\][^{}]*\\.text-\\\\\\[\\\\#${color}\\\\\\]`, "s"),
      `missing dark override for text-[#${color}]`,
    );
  }
});

test("dark theme CSS keeps selected sidebar rows readable", async () => {
  const css = await readFile("src/app/globals.css", "utf8");
  const page = await readFile("src/app/page.tsx", "utf8");

  for (const className of [
    "lxy-sidebar-folder-row",
    "lxy-sidebar-source-row",
    "lxy-sidebar-selected-row",
    "lxy-sidebar-row-text",
    "lxy-sidebar-row-icon",
    "lxy-sidebar-folder-text",
    "lxy-sidebar-folder-icon",
    "lxy-sidebar-source-text",
    "lxy-sidebar-count-badge",
  ]) {
    assert.match(page, new RegExp(className), `missing ${className} in sidebar`);
    assert.match(
      css,
      new RegExp(`:root\\[data-theme="dark"\\][^{}]*\\.${className}`, "s"),
      `missing dark override for ${className}`,
    );
  }

  assert.doesNotMatch(
    page,
    /lxy-sidebar-selected-row[^"]*bg-white[^"]*shadow-sm/,
    "selected sidebar rows should not mix dark override hooks with light utilities",
  );
  assert.doesNotMatch(
    page,
    /lxy-sidebar-folder-row[^"]*hover:bg-\[#efedf0\]/,
    "folder rows should use dedicated hover CSS instead of a light hover utility",
  );
  assert.doesNotMatch(
    page,
    /lxy-sidebar-source-row[^"]*hover:bg-\[#efedf0\]/,
    "source rows should use dedicated hover CSS instead of a light hover utility",
  );
  assert.match(css, /background-color: #111827 !important;/);
  assert.match(css, /color: #f8fafc !important;/);
  assert.match(css, /\.lxy-sidebar-folder-text\s*{\s*color: #f1f5f9 !important;/);
  assert.match(css, /\.lxy-sidebar-folder-icon\s*{\s*color: #dfe7f2 !important;/);
  assert.match(css, /\.lxy-sidebar-source-text\s*{\s*color: #f1f5f9 !important;/);
  assert.match(css, /\.lxy-sidebar-folder-row:hover,/);
  assert.match(css, /\.lxy-sidebar-source-row:hover,/);
  assert.match(css, /background-color: #243044 !important;/);
  assert.match(css, /border-color: #516174 !important;/);
  assert.match(css, /\.lxy-sidebar-folder-row:hover \.lxy-sidebar-folder-text,/);
  assert.match(css, /\.lxy-sidebar-source-row:hover \.lxy-sidebar-source-text,/);
  assert.match(css, /\.lxy-sidebar-selected-row:hover,/);
  assert.match(css, /background-color: #172234 !important;/);
  assert.match(css, /border-color: #c6d3e4 !important;/);
});

test("dark theme sidebar icon buttons use outline hover states", async () => {
  const css = await readFile("src/app/globals.css", "utf8");
  const page = await readFile("src/app/page.tsx", "utf8");

  assert.match(page, /lxy-sidebar-icon-button/, "missing sidebar icon button hook");
  assert.match(
    page,
    /lxy-sidebar-icon-button-active/,
    "missing sidebar icon active hook",
  );
  assert.doesNotMatch(
    page,
    /lxy-sidebar-icon-button[^"]*hover:bg-\[#efedf0\]/,
    "sidebar icon buttons should not depend on a light hover utility",
  );
  assert.match(
    css,
    /\.lxy-sidebar-icon-button:not\(\.lxy-sidebar-icon-button-active\):not\(:disabled\):hover/,
  );
  assert.match(
    css,
    /:root\[data-theme="dark"\] \.lxy-sidebar-icon-button:not\(\.lxy-sidebar-icon-button-active\):not\(:disabled\):hover/,
  );
  assert.match(css, /background-color: transparent !important;/);
  assert.match(css, /border-color: #8fa3bd !important;/);
  assert.match(css, /color: #f8fafc !important;/);
});
