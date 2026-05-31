import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getEffectiveTheme,
  isThemePreference,
  normalizeThemePreference,
} from "./theme-preference.ts";

test("normalizeThemePreference accepts supported values", () => {
  assert.equal(normalizeThemePreference("light"), "light");
  assert.equal(normalizeThemePreference("dark"), "dark");
  assert.equal(normalizeThemePreference("system"), "system");
});

test("normalizeThemePreference falls back to system for invalid values", () => {
  assert.equal(normalizeThemePreference(""), "system");
  assert.equal(normalizeThemePreference("auto"), "system");
  assert.equal(normalizeThemePreference(null), "system");
});

test("getEffectiveTheme resolves system preference from media state", () => {
  assert.equal(getEffectiveTheme("system", true), "dark");
  assert.equal(getEffectiveTheme("system", false), "light");
  assert.equal(getEffectiveTheme("light", true), "light");
  assert.equal(getEffectiveTheme("dark", false), "dark");
});

test("isThemePreference narrows supported values", () => {
  assert.equal(isThemePreference("light"), true);
  assert.equal(isThemePreference("dark"), true);
  assert.equal(isThemePreference("system"), true);
  assert.equal(isThemePreference("sepia"), false);
});
