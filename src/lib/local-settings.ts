import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type LocalSettings = {
  rsshubBaseUrl?: string;
  rsshubAccessCode?: string;
  bilibiliCookie?: string;
  openaiApiKey?: string;
  openaiSummaryModel?: string;
};

function getSettingsFilePath() {
  return join(process.cwd(), ".lxy-settings.json");
}

export async function readLocalSettings(): Promise<Partial<LocalSettings>> {
  try {
    return JSON.parse(await readFile(getSettingsFilePath(), "utf8")) as Partial<LocalSettings>;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code?: string }).code;

      if (code === "ENOENT") {
        return {};
      }
    }

    throw error;
  }
}

export async function updateLocalSettings(
  patch: Partial<LocalSettings>,
): Promise<LocalSettings> {
  const current = await readLocalSettings();
  const next = {
    ...current,
    ...patch,
  };

  await writeFile(
    getSettingsFilePath(),
    `${JSON.stringify(next, null, 2)}\n`,
    "utf8",
  );

  return next;
}
