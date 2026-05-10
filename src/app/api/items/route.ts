import { NextResponse } from "next/server";
import { listItems } from "@/lib/repository";

export async function GET() {
  const items = await listItems();
  return NextResponse.json({ items });
}
