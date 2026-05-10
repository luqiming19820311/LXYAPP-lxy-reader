import { NextResponse } from "next/server";
import { fetchSubscription } from "@/lib/repository";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/subscriptions/[id]/fetch">,
) {
  try {
    const { id } = await context.params;
    const subscription = await fetchSubscription(id);
    return NextResponse.json({ subscription });
  } catch (error) {
    const message = error instanceof Error ? error.message : "抓取失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
