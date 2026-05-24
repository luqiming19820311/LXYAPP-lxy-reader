import { NextResponse } from "next/server";
import { fetchSubscription } from "@/lib/repository";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/subscriptions/[id]/fetch">,
) {
  try {
    const { id } = await context.params;
    const { subscription, result } = await fetchSubscription(id);
    return NextResponse.json({ subscription, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "抓取失败。";
    const cause = error instanceof Error ? error.cause : null;

    if (cause && typeof cause === "object") {
      return NextResponse.json({ error: message, ...cause }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
