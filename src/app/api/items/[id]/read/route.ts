import { NextResponse } from "next/server";
import { setReadState } from "@/lib/repository";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/items/[id]/read">,
) {
  const { id } = await context.params;
  const state = await setReadState(id, true);
  return NextResponse.json({ state });
}
