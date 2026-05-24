import { NextResponse } from "next/server";
import { previewFeed } from "@/lib/feed";
import { getFriendlyErrorMessage } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { inputUrl?: string };

    if (!body.inputUrl) {
      return NextResponse.json(
        { error: "请输入订阅链接。" },
        { status: 400 },
      );
    }

    const preview = await previewFeed(body.inputUrl);
    return NextResponse.json({ preview });
  } catch (error) {
    const message = getFriendlyErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
