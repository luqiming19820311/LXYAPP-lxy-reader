import { NextResponse } from "next/server";
import { createSubscription, listSubscriptions } from "@/lib/repository";

export async function GET() {
  const subscriptions = await listSubscriptions();
  return NextResponse.json({ subscriptions });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { inputUrl?: string };

    if (!body.inputUrl) {
      return NextResponse.json(
        { error: "请输入订阅链接。" },
        { status: 400 },
      );
    }

    const subscription = await createSubscription(body.inputUrl);
    return NextResponse.json({ subscription });
  } catch (error) {
    const message = error instanceof Error ? error.message : "订阅失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
