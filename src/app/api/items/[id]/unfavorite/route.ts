import { NextResponse } from "next/server";
import { setFavoriteState } from "@/lib/repository";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/items/[id]/unfavorite">,
) {
  const { id } = await context.params;
  const state = await setFavoriteState(id, false);
  return NextResponse.json({ state });
}
