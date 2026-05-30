import { NextResponse } from "next/server";
import { setFavoriteState } from "@/lib/repository";

type ItemRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  context: ItemRouteContext,
) {
  const { id } = await context.params;
  const state = await setFavoriteState(id, false);
  return NextResponse.json({ state });
}
