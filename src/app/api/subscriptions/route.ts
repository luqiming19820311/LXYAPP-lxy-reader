import { NextResponse } from "next/server";
import {
  createSubscription,
  getFriendlyErrorMessage,
  listSubscriptions,
} from "@/lib/repository";

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

    const result = await createSubscription(body.inputUrl);
    return NextResponse.json(result);
  } catch (error) {
    const message = getFriendlyErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
