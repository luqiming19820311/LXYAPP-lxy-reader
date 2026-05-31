import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import {
  getAiSettings,
  getPublicAiSettings,
  updateAiSettings,
} from "./ai-settings.ts";

const originalCwd = process.cwd();
const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const originalOpenAiSummaryModel = process.env.OPENAI_SUMMARY_MODEL;
let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "lxy-ai-settings-"));
  process.chdir(tempDir);
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_SUMMARY_MODEL;
});

afterEach(async () => {
  process.chdir(originalCwd);
  if (originalOpenAiApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiApiKey;
  }
  if (originalOpenAiSummaryModel === undefined) {
    delete process.env.OPENAI_SUMMARY_MODEL;
  } else {
    process.env.OPENAI_SUMMARY_MODEL = originalOpenAiSummaryModel;
  }
  await rm(tempDir, { force: true, recursive: true });
});

test("getPublicAiSettings reports missing key with the default model", async () => {
  const settings = await getPublicAiSettings();

  assert.deepEqual(settings, {
    configured: false,
    model: "gpt-5",
  });
});

test("updateAiSettings stores OpenAI key and model without exposing the key publicly", async () => {
  const settings = await updateAiSettings({
    openaiApiKey: " sk-test-local ",
    openaiSummaryModel: " gpt-5-mini ",
  });

  assert.deepEqual(settings, {
    configured: true,
    model: "gpt-5-mini",
  });
  assert.deepEqual(await getAiSettings(), {
    apiKey: "sk-test-local",
    configured: true,
    model: "gpt-5-mini",
  });

  const stored = JSON.parse(await readFile(".lxy-settings.json", "utf8")) as {
    openaiApiKey?: string;
    openaiSummaryModel?: string;
  };

  assert.equal(stored.openaiApiKey, "sk-test-local");
  assert.equal(stored.openaiSummaryModel, "gpt-5-mini");
});

test("updateAiSettings clears the saved OpenAI key while preserving the model", async () => {
  await updateAiSettings({
    openaiApiKey: "sk-test-local",
    openaiSummaryModel: "gpt-5-mini",
  });

  const settings = await updateAiSettings({
    clearOpenaiApiKey: true,
  });

  assert.deepEqual(settings, {
    configured: false,
    model: "gpt-5-mini",
  });
});

test("environment variables override saved OpenAI settings", async () => {
  await updateAiSettings({
    openaiApiKey: "sk-test-local",
    openaiSummaryModel: "gpt-5-mini",
  });
  process.env.OPENAI_API_KEY = "sk-env";
  process.env.OPENAI_SUMMARY_MODEL = "gpt-5";

  assert.deepEqual(await getAiSettings(), {
    apiKey: "sk-env",
    configured: true,
    model: "gpt-5",
  });
});
