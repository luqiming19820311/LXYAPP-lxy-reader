# LXY Reader Project Context

更新日期: 2026-06-06  
版本标记: V6.0 已提交并推送  
主工作区: `/Users/luqiming/Downloads/work/codex/LXYAPP/lxy-reader`  
外层项目目录: `/Users/luqiming/Downloads/work/codex/LXYAPP`  
本地预览: `http://localhost:3000/` 或 `http://localhost:3001/`  
应用仓库: `https://github.com/luqiming19820311/LXYAPP-lxy-reader`  
外层仓库: `https://github.com/luqiming19820311/LXYAPP`

## 快速恢复

```bash
cd /Users/luqiming/Downloads/work/codex/LXYAPP/lxy-reader
git status --short --branch
npm run dev -- --port 3000
```

如果端口被占用，可切换到 `3001`。新增 API route、Prisma schema、全局 CSS 或前端交互没有生效时，优先重启 dev server。

## 关键决策

1. LXY 是本地优先的电脑端 AI RSS 信息聚合阅读器，v0.1 先以浏览器 Web 应用跑通个人使用闭环。
2. 核心闭环是: 添加订阅源 -> 抓取内容 -> 标准化入库 -> 时间线展示 -> 详情阅读/播放 -> 已读/收藏/稍后读 -> 手动 AI 摘要。
3. 技术栈固定为 Next.js 16 App Router、React 19、Tailwind CSS 4、TypeScript、Prisma 6、SQLite、`rss-parser`、`lucide-react`。
4. 数据本地化保存在 SQLite `prisma/dev.db`。该文件目前被 Git 跟踪，会随运行、刷新、导入和阅读状态变化而改变。
5. Prisma 继续固定在 6.x。当前环境中 `prisma db push` / `prisma migrate dev` 可能出现 schema engine 空错误，因此 `prisma/init.sql` 是初始化 schema 的重要备份。
6. YouTube 订阅入口保持不变: 频道 URL、handle 和 `rsshub://youtube/user/...` 最终仍保存为官方 RSS `https://www.youtube.com/feeds/videos.xml?channel_id=...`。
7. YouTube 为解决官方 RSS 只给十几条的问题，正式刷新时先读官方 RSS，再用频道公开视频页和 continuation 补抓历史视频；不引入 YouTube API Key，不切换 RSSHub。
8. Bilibili 继续优先使用本地 adapter，不依赖公共 RSSHub；遇到 Web WBI 风控时 fallback 到 APP archive 接口。
9. Bilibili 和 YouTube 都以“订阅入口不变，只增加可保存条目数”为原则，避免改动用户已有订阅和 UI 行为。
10. RSSHub 仍支持普通 HTTP URL 和 `rsshub://` 输入，Base URL、access code、Bilibili Cookie 可在 Settings 中配置。
11. 本机敏感配置统一通过 `src/lib/local-settings.ts` 写入 `.lxy-settings.json`；API 只返回 configured/missing，不返回 Key、Cookie、access code 明文。
12. AI 摘要为手动触发，不做自动批量摘要；默认模型为 `gpt-5`，调用 OpenAI Responses API。
13. UI 保持阅读器工具形态: 左侧紧凑图标导航，中间时间线，右侧详情/播放/摘要，Settings 为垂直卡片布局。
14. 主题偏好为浏览器本地设置，支持 Light、Dark、Follow the system，存储 key 为 `lxy-theme-preference`。
15. 左侧 Sidebar 宽度可拖拽，默认 `260px`，范围 `212px-360px`，存储 key 为 `lxy-sidebar-width`。
16. Dark 模式采用全局 utility override 修正浅色设计系统残留，同时为 sidebar 来源行、文件夹行、图标按钮提供专用 class。
17. 视频封面统一用真实 `<img>` 渲染并设置 `referrerPolicy="no-referrer"`；Bilibili 使用抓取到的封面，YouTube 缺失封面时从 videoId fallback 到 `https://i.ytimg.com/vi/<id>/hqdefault.jpg`。

## 整体架构思路

### 应用结构

1. `src/app/page.tsx` 是主界面与交互入口，包含 Home、Sidebar、Timeline、DetailPanel、SettingsView、SourceFolderModal、AddSubscriptionModal 等。
2. `src/app/api/**/route.ts` 提供 App Router API，包括订阅源、内容项状态、AI 摘要、文件夹、OPML 和设置。
3. `src/lib/repository.ts` 负责数据库读写、订阅创建、刷新、状态更新和友好错误包装。
4. `src/lib/feed.ts` 负责输入解析、平台抓取、分页补抓、标准化内容和视频 embed/thumbnail 生成。
5. `src/lib/summary.ts` 负责 OpenAI Responses API 摘要调用与 `AiSummary` 入库。
6. `src/lib/local-settings.ts` 和 `src/lib/feed-settings.ts` 负责本机敏感配置读取、保存和脱敏返回。
7. `prisma/schema.prisma` 和 `prisma/init.sql` 定义 SQLite schema。

### 数据流

1. 用户添加订阅时先调用 preview，展示少量预览项。
2. 确认添加后创建 `Subscription`，再触发正式 fetch。
3. fetch 调用 `fetchNormalizedItems(feedUrl)`，按平台抓取并标准化为 `NormalizedItem`。
4. `repository.ts` 通过 `contentItem.upsert(subscriptionId, externalId)` 入库，避免重复。
5. 前端加载 `/api/items`、`/api/subscriptions`、`/api/source-folders` 后在客户端做视图筛选和搜索。
6. 用户状态写入 `UserItemState`，AI 摘要写入 `AiSummary`。

### 平台策略

1. 普通 RSS/Atom/RSSHub: 直接通过 `rss-parser` 或 RSSHub JSON 解析。
2. YouTube:
   - 保存官方 RSS feedUrl。
   - RSS 负责最新条目和稳定基础数据。
   - 频道公开视频页负责补充历史条目。
   - 支持新版 `lockupViewModel` 和旧版 `videoRenderer`。
   - continuation token 会逐个试探，跳过返回空内容的 token，直到累计补充视频达到约 120 条、无可用 continuation 或达到 200 页保护上限。
3. Bilibili:
   - 保存 `bilibili://user/video/:mid` 本地 adapter URL。
   - Web WBI archive API 使用 `pn`/`ps=50` 多页读取。
   - 风控时 APP archive fallback 同样多页读取。
   - 最大页数保护为 200 页。

## 已完成部分

### Feed 与订阅核心

1. 订阅源 CRUD: `/api/subscriptions`、`/api/subscriptions/[id]`。
2. 订阅预览与确认添加: `/api/subscriptions/preview`。
3. 单来源、文件夹、全部来源刷新: `/api/subscriptions/[id]/fetch`。
4. 内容标准化入库，并按发布时间、创建时间排序。
5. 友好错误提示覆盖 RSS/RSSHub/网络/Bilibili/Prisma 常见失败。
6. OPML 导入导出: `/api/subscriptions/opml`。
7. SourceFolder 分组模型与 API 已实现，删除文件夹会把订阅移回未分类。

### YouTube 收录

1. 支持频道页、handle、RSSHub YouTube user 路由转官方 RSS。
2. 支持 Shorts/embed/live/watch URL 的 videoId 解析。
3. 支持 `yt:video:<id>` feed id 解析。
4. 官方 RSS 返回项优先保留，保证最新条目的标题、发布时间、作者等稳定字段不被页面补抓覆盖。
5. 频道公开视频页补抓支持 `videoRenderer` 和新版 `lockupViewModel`。
6. continuation 支持多候选 token 试探，能跳过空 token，补抓 100+ 条视频。
7. 缩略图 fallback 从 videoId 生成 `i.ytimg.com` 封面。
8. YouTube iframe 播放参数包含 autoplay、playsinline、rel、enablejsapi、origin、widget_referrer。
9. 监听 postMessage 播放状态，区分 loading/playing/blocked。

### Bilibili 收录

1. 支持 `rsshub://bilibili/user/video/:mid` 转本地 `bilibili://user/video/:mid`。
2. 支持 Bilibili 空间 URL 解析 mid。
3. Web WBI archive API 多页抓取，`ps=50`，最多 200 页。
4. 风控错误 `-352`、`-412`、`request was banned` 时 fallback 到 APP archive。
5. APP archive fallback 同样多页抓取，`ps=50`，最多 200 页。
6. 标准化 bvid、aid、标题、描述、封面、发布时间、作者、embedUrl。
7. Bilibili 封面显示使用 `<img referrerPolicy="no-referrer">`，避免 CSS background-image 场景下封面不显示。

### 数据模型与状态

1. `Subscription`: 订阅源元数据、状态、抓取错误、可选 `folderId`。
2. `SourceFolder`: 来源分组，保存分组名称与订阅关系。
3. `ContentItem`: 标准化内容、媒体元数据、平台、embedUrl、raw payload。
4. `UserItemState`: 已读、收藏、稍后读及对应时间。
5. `AiSummary`: 每条内容的 AI 摘要、模型、promptVersion。
6. 前端使用乐观更新和 `stateOverridesRef`，避免已读/收藏/稍后读状态短暂回弹。

### UI 与交互

1. 三栏主界面: 左侧导航与来源、中间时间线、右侧详情。
2. 左侧导航:
   - All Feeds、Videos、Articles、Favorites、Read Later。
   - 图标导航带 hover label。
   - Settings 和 Refresh 在底部。
   - Sources 区域独立滚动。
   - Sidebar 可拖拽宽度，刷新后保留。
   - Dark 模式下 sidebar 图标 hover 改为外框，不再出现浅色实心块。
   - Dark 模式下文件夹/来源 hover 使用深色块和亮文字，selected hover 使用更深色块。
3. 来源筛选:
   - 可按单来源筛选。
   - 可按 SourceFolder 筛选。
   - Settings 中点击来源或文件夹会跳回内容列表。
4. 时间线:
   - 支持搜索标题、摘要、来源、类型。
   - 支持 All/Videos/Articles/Favorites/Read Later 过滤。
   - 无结果和加载错误有独立状态。
   - 视频条目左侧缩略图显示真实封面，图片加载失败时回退到平台占位。
5. 详情页:
   - Open Original、Copy Link、Favorite、Read Later、Mark Read/Unread 图标按钮。
   - 详情页操作按钮 hover tooltip 已改为显示在按钮下方。
   - Dark 模式下详情操作按钮使用深色底、亮边框和亮图标，避免低对比度。
   - YouTube/Bilibili iframe 播放。
   - 详情视频大封面显示真实缩略图，点击播放后切换 iframe，Show Cover 后回到封面。
   - 缺失封面或封面加载失败时显示平台化占位。
   - Content Context 展示正文上下文。
   - AI Summary 手动生成/重新生成。
6. Settings:
   - General、AI Configuration、OPML、Sources 卡片。
   - 主题偏好可切换并持久化。
   - AI Key/模型可保存和清除。
   - 订阅源可重命名、启用/停用、删除。

### V6.0 验证结果

1. 已执行通过:
   - `npm run lint`
   - `npm run test -- src/lib/feed.test.mts src/lib/repository.test.mts`
   - `npm run test -- src/lib/dark-theme-css.test.mts`
2. 新增/覆盖测试:
   - Bilibili Web WBI 多页读取。
   - Bilibili APP fallback 多页读取。
   - YouTube 官方 RSS + 频道页补抓合并。
   - YouTube `lockupViewModel` 100+ 补抓。
   - YouTube 多 continuation token 中跳过空 token。
   - YouTube 页面补抓失败时回退 RSS。
   - Dark 模式 sidebar 图标 hover 外框。
3. 真实联网验证:
   - 尝试过真实 YouTube 联网只读验证，但工具权限自动审核超时，未完成。
   - 本地 mock 已覆盖 100+ 条补抓路径。

## 待办事项

### 高优先级

1. 手动刷新真实 YouTube 订阅，确认侧边栏条目数从十几条增加到 100+。
2. 手动刷新真实 Bilibili 订阅，确认条目数从 20 左右增加到多页结果。
3. 如外层仓库使用 submodule，确认是否需要同步外层仓库指针。
4. 测试真实 OpenAI 摘要调用:
   - 保存真实 OpenAI API Key。
   - 对真实内容生成摘要。
   - 刷新后确认 `AiSummary` 保留。
   - 确认错误提示足够友好。
5. 决定 `prisma/dev.db` 长期策略:
   - 继续纳入 Git，保留真实样本和本地状态。
   - 或改为只提交 schema/seed，减少运行状态噪音。

### 中优先级

1. SourceFolder 相关自动化测试:
   - 文件夹 CRUD。
   - 文件夹筛选 item list。
   - 删除文件夹后订阅回到未分类。
2. Theme 测试:
   - localStorage 偏好保存。
   - system 模式跟随系统。
   - dark mode 覆盖所有卡片、弹窗、时间线、按钮。
3. OPML 导入增强:
   - 导入后可选择是否自动刷新。
   - 更完整处理重复、缺失 xmlUrl、异常 outline。
4. Settings 抓取配置增强:
   - RSSHub access code 独立清除按钮。
   - Bilibili Cookie 使用说明和状态反馈。
5. 全文搜索:
   - 当前为前端过滤。
   - 后续可考虑 SQLite FTS。

### 后续版本

1. Electron/Tauri 桌面包装。
2. Profile 页面真实实现。
3. 多端同步。
4. 自动摘要和批量摘要。
5. 视频播放源发现和缓存。
6. 订阅源 favicon 抓取。
7. 更细的失败重试与后台刷新策略。
8. YouTube 公开页面结构变化时，持续维护 `lockupViewModel` / `videoRenderer` 解析兼容。

## 重要文件修改记录

### `project-context.md`

- 本文件，作为新会话恢复上下文的主要入口。
- V6.0 更新:
  - 记录 YouTube 和 Bilibili 多条目收录策略。
  - 记录 Dark 模式图标 hover 和详情 tooltip 微调。
  - 记录 V6.0 验证结果、待办事项和整体架构。

### `src/lib/feed.ts`

- Feed 输入解析、RSSHub URL 构造、YouTube/Bilibili/RSS 抓取与标准化。
- V6.0 重点:
  - Bilibili Web WBI archive 多页读取。
  - Bilibili APP archive fallback 多页读取。
  - YouTube 官方 RSS 读取后补抓频道公开视频页。
  - YouTube 支持 `videoRenderer` 和新版 `lockupViewModel`。
  - YouTube continuation 多 token 试探，目标补抓约 120 条。
  - YouTube 补抓失败时保持 RSS fallback，不让刷新失败。

### `src/lib/feed.test.mts`

- V6.0 新增测试:
  - Bilibili Web WBI 多页读取。
  - Bilibili APP fallback 多页读取。
  - YouTube 官方 RSS + 页面补抓。
  - YouTube 100+ `lockupViewModel` 补抓。
  - YouTube 空 continuation token 跳过。
  - YouTube 页面失败回退 RSS。

### `src/app/page.tsx`

- 主 UI 和交互文件。
- V6.0 重点:
  - Sidebar 顶部/底部图标按钮新增 `lxy-sidebar-icon-button` 和 `lxy-sidebar-icon-button-active`。
  - 详情页 `IconTooltipButton` 的 tooltip 从按钮上方改为按钮下方。
  - 保留所有按钮点击、tooltip 文案、ARIA、图标和状态逻辑。

### `src/app/globals.css`

- Tailwind 引入和全局样式。
- V6.0 重点:
  - Dark 模式下 `.lxy-sidebar-icon-button` hover/focus 改为透明底 + 外框。
  - Light 模式保留原浅色 hover。
  - 保留已有 sidebar folder/source/selected row dark override。

### `src/lib/dark-theme-css.test.mts`

- V6.0 新增测试:
  - Sidebar 图标按钮保留专用样式钩子。
  - Dark 模式 hover/focus 使用外框。
  - 图标按钮不再依赖浅色 hover utility 作为 dark hover 主反馈。

### `prisma/dev.db`

- 本地 SQLite 数据库。
- V6.0 期间刷新、测试和本地运行会改变该文件；当前仍被 Git 跟踪。

## Git 提醒

1. 当前应用仓库远程: `origin https://github.com/luqiming19820311/LXYAPP-lxy-reader.git`
2. 当前分支: `main`
3. V6.0 提交备注建议: `V6.0: fix platform ingestion and core UI bugs`
