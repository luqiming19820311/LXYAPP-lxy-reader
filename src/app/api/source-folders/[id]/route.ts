import { NextResponse } from "next/server";
import {
  deleteSourceFolder,
  updateSourceFolder,
} from "@/lib/repository";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { name?: string };
    const folder = await updateSourceFolder(id, body);
    return NextResponse.json({ folder });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新文件夹失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await deleteSourceFolder(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除文件夹失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
