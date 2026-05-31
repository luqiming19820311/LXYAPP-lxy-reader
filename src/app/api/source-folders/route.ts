import { NextResponse } from "next/server";
import {
  createSourceFolder,
  listSourceFolders,
} from "@/lib/repository";

export async function GET() {
  const folders = await listSourceFolders();
  return NextResponse.json({ folders });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string };
    const folder = await createSourceFolder(body.name || "");
    return NextResponse.json({ folder });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建文件夹失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
