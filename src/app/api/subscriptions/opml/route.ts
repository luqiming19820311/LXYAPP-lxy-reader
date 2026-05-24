import { NextResponse } from "next/server";
import {
  getFriendlyErrorMessage,
  importOpmlSubscriptions,
  listSubscriptions,
} from "@/lib/repository";
import { buildSubscriptionsOpml, parseSubscriptionsOpml } from "@/lib/opml";

export async function GET() {
  const subscriptions = await listSubscriptions();
  const opml = buildSubscriptionsOpml(
    subscriptions.map((subscription) => ({
      title: subscription.title,
      feedUrl: subscription.feedUrl,
      siteUrl: subscription.siteUrl,
    })),
  );

  return new Response(opml, {
    headers: {
      "Content-Disposition": 'attachment; filename="lxy-subscriptions.opml"',
      "Content-Type": "text/x-opml; charset=utf-8",
    },
  });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let opml = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (file instanceof File) {
        opml = await file.text();
      } else {
        opml = `${formData.get("opml") || ""}`;
      }
    } else {
      const body = (await request.json()) as { opml?: string };
      opml = body.opml || "";
    }

    if (!opml.trim()) {
      return NextResponse.json(
        { error: "请选择 OPML 文件或粘贴 OPML 内容。" },
        { status: 400 },
      );
    }

    const subscriptions = parseSubscriptionsOpml(opml);

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: "未在 OPML 中找到可导入的 RSS 订阅。" },
        { status: 400 },
      );
    }

    const result = await importOpmlSubscriptions(subscriptions);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: getFriendlyErrorMessage(error) },
      { status: 400 },
    );
  }
}
