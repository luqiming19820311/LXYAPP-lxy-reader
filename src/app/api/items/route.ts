import { NextResponse } from "next/server";
import { listItems } from "@/lib/repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId") || undefined;
  const items = await listItems({ folderId });
  return NextResponse.json({ items });
}
