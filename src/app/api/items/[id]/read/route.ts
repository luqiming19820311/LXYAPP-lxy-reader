import { NextResponse } from "next/server";
import { setReadState } from "@/lib/repository";

type ItemRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  context: ItemRouteContext,
) {
  const { id } = await context.params;
  const state = await setReadState(id, true);
  return NextResponse.json({ state });
}
