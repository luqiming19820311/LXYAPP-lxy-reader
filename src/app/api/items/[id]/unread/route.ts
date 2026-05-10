import { NextResponse } from "next/server";
import { setReadState } from "@/lib/repository";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/items/[id]/unread">,
) {
  const { id } = await context.params;
  const state = await setReadState(id, false);
  return NextResponse.json({ state });
}
