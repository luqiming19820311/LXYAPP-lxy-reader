import { NextResponse } from "next/server";
import {
  deleteSubscription,
  updateSubscription,
} from "@/lib/repository";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      title?: string;
      status?: string;
    };
    const subscription = await updateSubscription(id, body);
    return NextResponse.json({ subscription });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新订阅源失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await deleteSubscription(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除订阅源失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
