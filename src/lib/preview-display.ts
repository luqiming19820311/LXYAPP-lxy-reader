export function getPreviewEmptyMessage(preview: {
  platform: string;
  warning?: string;
  itemsLength: number;
}) {
  if (preview.itemsLength > 0) {
    return null;
  }

  if (preview.warning) {
    return "暂时无法预览最新内容，请先配置 Bilibili 访问方式。";
  }

  if (preview.platform === "bilibili") {
    return "当前来源没有返回可预览的视频内容，仍可确认订阅。";
  }

  return "当前来源没有返回可预览的最新内容。";
}
