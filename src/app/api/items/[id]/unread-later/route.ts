import { NextResponse } from "next/server";
import { setReadLaterState } from "@/lib/repository";

type ItemRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  context: ItemRouteContext,
) {
  const { id } = await context.params;
  const state = await setReadLaterState(id, false);
  return NextResponse.json({ state });
}
