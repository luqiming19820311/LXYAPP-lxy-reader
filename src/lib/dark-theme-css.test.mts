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
