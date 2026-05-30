import { NextResponse } from "next/server";
import {
  getPublicFeedSettings,
  updateFeedSettings,
} from "@/lib/feed-settings";

export async function GET() {
  const settings = await getPublicFeedSettings();

  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      rsshubBaseUrl?: string;
      rsshubAccessCode?: string;
      clearRsshubAccessCode?: boolean;
      bilibiliCookie?: string;
      clearBilibiliCookie?: boolean;
    };
    const settings = await updateFeedSettings(body);

    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存抓取设置失败。";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
