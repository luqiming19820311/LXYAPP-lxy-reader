import { NextResponse } from "next/server";
import { getAiConfig } from "@/lib/summary";
import { updateAiSettings } from "@/lib/ai-settings";

export async function GET() {
  return NextResponse.json(await getAiConfig());
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      openaiApiKey?: string;
      clearOpenaiApiKey?: boolean;
      openaiSummaryModel?: string;
    };
    const settings = await updateAiSettings(body);

    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存 AI 设置失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
