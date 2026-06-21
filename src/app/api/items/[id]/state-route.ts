import { NextResponse } from "next/server";

type ItemRouteParams = {
  id?: string;
  nxtPid?: string;
};

export type ItemRouteContext = {
  params: Promise<ItemRouteParams> | ItemRouteParams;
};

export async function handleItemStateMutation(
  context: ItemRouteContext,
  mutate: (itemId: string) => Promise<unknown>,
) {
  try {
    const itemId = await getItemRouteId(context);
    const state = await mutate(itemId);

    return NextResponse.json({ state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败。";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function getItemRouteId(context: ItemRouteContext) {
  const params = await context.params;
  const itemId = params.id ?? params.nxtPid;

  if (!itemId) {
    throw new Error("条目 ID 无效。");
  }

  return itemId;
}
