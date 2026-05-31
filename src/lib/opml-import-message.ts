export type OpmlImportMessageResult = {
  imported: number;
  updated: number;
  failed: number;
  results: Array<{
    title: string;
    feedUrl: string;
    status: "created" | "updated" | "failed";
    error?: string;
  }>;
};

const MAX_FAILED_ITEMS = 3;

export function formatOpmlImportMessage(result: OpmlImportMessageResult) {
  const summary = `导入完成：新增 ${result.imported} 个，更新 ${result.updated} 个，失败 ${result.failed} 个。`;

  if (result.failed === 0) {
    return summary;
  }

  const failedResults = result.results.filter(
    (item) => item.status === "failed",
  );
  const failedItems = failedResults
    .slice(0, MAX_FAILED_ITEMS)
    .map((item) => {
      const label = item.title.trim() || item.feedUrl;
      return `${label} - ${item.error || "未知错误"}`;
    });
  const remainingCount = failedResults.length - failedItems.length;
  const remainingMessage =
    remainingCount > 0 ? `；另有 ${remainingCount} 个失败项` : "";

  return `${summary}失败项：${failedItems.join("；")}${remainingMessage}。`;
}
