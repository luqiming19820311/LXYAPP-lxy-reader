# LXY Reader Project Context

版本: V7.1
更新日期: 2026-06-21
主工作区: `/Users/luqiming/Downloads/work/codex/LXYAPP/lxy-reader`
远程仓库: `https://github.com/luqiming19820311/LXYAPP-lxy-reader.git`
当前分支: `main`
本地开发服务: `http://localhost:3000/`

## V7.1 摘要

V7.1 是一次基础 bug 修复版本，重点解决两个用户可见问题:

1. Twitter/X 内容已经能获取最新信息，但没有被收录到左侧 `Articles` 视图。
2. 点击未读条目后，小绿点没有消失，并弹出 `Failed to execute 'json' on 'Response': Unexpected end of JSON input`。

本版已完成:

- Articles 视图现在包含 Twitter `Update/status` 类型内容。
- Articles 顶部未读数量同步统计 Twitter 更新。
- item 状态接口修复动态路由参数读取问题。
- item 状态接口失败时返回 JSON 错误，不再让前端解析空响应。
- 前端状态变更请求改为安全解析响应，避免直接暴露底层 `Response.json()` 报错。
- 已重启本地 Next dev server，避免 SQLite 旧文件句柄导致 `attempt to write a readonly database`。

已验证:

```bash
npm run lint
npm run test -- src/lib/feed.test.mts src/lib/repository.test.mts
```

验证结果:

- lint 通过。
- 31 个 feed/repository 测试全部通过。
- `POST /api/items/:id/read` 返回 200 JSON。
- 浏览器实测未读条目点击后，详情按钮从 `Mark Read` 变为 `Mark Unread`，页面没有 alert 错误。
- 当前 dev server 打开的 `prisma/dev.db` inode 与当前数据库文件一致，避免旧句柄 readonly 问题。

## 快速恢复

```bash
cd /Users/luqiming/Downloads/work/codex/LXYAPP/lxy-reader
git status --short --branch
npm install
npm run dev
```

如果 3000 被占用:

```bash
npm run dev -- --port 3001
```

常用验证:

```bash
npm run lint
npm run test -- src/lib/feed.test.mts src/lib/repository.test.mts
```

如果曾经在 dev server 运行时恢复或替换 `prisma/dev.db`，必须重启 `npm run dev`。否则 Next/Prisma 可能持有旧 SQLite 文件句柄，写入接口会报 `attempt to write a readonly database`。

## 当前项目定位

LXY Reader 是一个本地优先的 AI RSS Reader，用于订阅、刷新、阅读和管理多平台内容源。主界面是三栏阅读器:

- 左侧: navigation、folders、sources、settings。
- 中间: 当前视图和当前来源下的内容列表。
- 右侧: 内容详情、原文、复制链接、收藏、稍后读、已读/未读、AI 摘要。

当前支持的主要内容源:

- 普通 RSS/Atom。
- RSSHub URL。
- `rsshub://` shorthand。
- Bilibili 用户视频。
- YouTube channel/user。
- Weibo。
- Twitter/X 用户时间线。

## 整体架构思路

### 前端

- 框架: Next.js App Router + React。
- 主界面集中在 `src/app/page.tsx`。
- `FeedItem` 是前端统一展示模型。
- 视图过滤逻辑集中在 `filterItemsByView`。
- 搜索过滤逻辑集中在 `filterItemsBySearch`。
- item 状态变更走 `mutateItemState`，先做乐观更新，再用 API 返回状态确认。
- Twitter 内容有专属详情展示，不依赖官方 embed/widget。

### API 层

- API routes 位于 `src/app/api/**`。
- item 状态接口位于 `src/app/api/items/[id]/**`。
- V7.1 新增 `src/app/api/items/[id]/state-route.ts`，统一处理 item 状态接口:
  - 兼容 `params.id` 与 Next 生成的 `params.nxtPid`。
  - 统一返回 `{ state }`。
  - 异常统一返回 `{ error }` JSON。

### 数据与业务层

- 业务读写集中在 `src/lib/repository.ts`。
- 抓取、解析、标准化集中在 `src/lib/feed.ts`。
- 数据库使用 Prisma + SQLite。
- Prisma schema 位于 `prisma/schema.prisma`。
- 本地数据库文件为 `prisma/dev.db`。

### 内容标准化

所有平台最终标准化为 `ContentItem`:

- `title`
- `author`
- `contentUrl`
- `publishedAt`
- `summary`
- `contentHtml`
- `thumbnailUrl`
- `mediaType`
- `platform`
- `embedUrl`
- `rawPayload`

Twitter/X 当前仍复用现有 status 模型:

- `platform: "twitter"`
- `mediaType: "status"`
- 前端显示类型: `Update`
- 数据库 schema 不新增字段。

## 关键决策

1. Twitter/X 抓取能力继续沿用 V7.0 的多级 fallback，不在 V7.1 改动抓取逻辑。
2. Twitter `status` 在阅读体验上属于文章/更新类内容，应进入 `Articles` 视图。
3. Articles 未读数必须和视图过滤规则一致，避免左侧徽标与实际列表不一致。
4. item 状态 API 不能假设 Next 动态参数永远叫 `id`。当前 Next 生成的 manifest 会把参数键写成 `nxtPid`。
5. item 状态 API 应始终返回 JSON，避免前端对空 body 调 `response.json()`。
6. 前端仍保留乐观更新，但服务端失败时必须恢复旧状态并显示可读错误。
7. `prisma/dev.db` 是运行态文件。验证、点击、刷新都会改动它，提交时应避免把测试数据变化带进去。
8. 如果恢复了 `prisma/dev.db`，需要重启 dev server，避免 Prisma 持有旧 inode。
9. 本版只修复指定 bug，不做无关 UI 重构和数据模型变更。

## 已完成部分

### V7.0: Twitter 获取与最新内容

- 支持 `rsshub://twitter/user/<username>`。
- 支持 Twitter RSSHub 成功路径。
- 支持默认 RSSHub 失败或返回旧数据后的 fallback。
- 支持 X Web GraphQL、embedded timeline、Nitter RSS fallback。
- 修复 `Twitter @宝玉` 只能显示 195d/197d/198d ago 的问题。
- 当 X 匿名时间线只返回 pinned/highlights 时，不再误判为最新时间线。
- Twitter 图片、视频、作者、互动数进入标准化 item 和详情页。

### V7.1: Articles 收录 Twitter

- `src/app/page.tsx` 新增 `isArticleViewItem`。
- Articles 视图从只接受 `Article` 改为接受 `Article` 或 `Update`。
- Articles 未读数量同步使用同一规则。
- 修复 Twitter 在 All Feeds 可见但 Articles 不可见的问题。

### V7.1: 阅读小绿点消失

- 新增 `src/app/api/items/[id]/state-route.ts`。
- 统一修复以下接口的动态参数读取:
  - `read`
  - `unread`
  - `favorite`
  - `unfavorite`
  - `read-later`
  - `unread-later`
- 前端新增 `readJsonResponse`，避免空响应导致 `Unexpected end of JSON input`。
- 浏览器实测点击未读条目后状态可成功写入，小绿点消失。

## 重要文件修改记录

### `src/app/page.tsx`

- Articles 过滤包含 Twitter `Update`。
- Articles 未读数包含 Twitter `Update`。
- item 状态请求改为安全 JSON 解析。
- 保留原有乐观更新和失败回滚逻辑。

### `src/app/api/items/[id]/state-route.ts`

- 新增 item 状态接口共用 helper。
- 兼容 `params.id` 和 `params.nxtPid`。
- 统一 JSON 响应结构。

### `src/app/api/items/[id]/read/route.ts`

- 改为使用 `handleItemStateMutation`。
- 修复点击阅读无法写入的问题。

### `src/app/api/items/[id]/unread/route.ts`

- 改为使用 `handleItemStateMutation`。
- 修复标记未读接口同类问题。

### `src/app/api/items/[id]/favorite/route.ts`

- 改为使用 `handleItemStateMutation`。
- 同步修复收藏状态接口的动态参数问题。

### `src/app/api/items/[id]/unfavorite/route.ts`

- 改为使用 `handleItemStateMutation`。
- 同步修复取消收藏状态接口。

### `src/app/api/items/[id]/read-later/route.ts`

- 改为使用 `handleItemStateMutation`。
- 同步修复稍后读状态接口。

### `src/app/api/items/[id]/unread-later/route.ts`

- 改为使用 `handleItemStateMutation`。
- 同步修复取消稍后读状态接口。

### `project-context.md`

- 从 V7.0 更新为 V7.1。
- 补充本轮 bug 根因、验证结果、架构说明和后续待办。

## 待办事项

### 高优先级

1. 用户人工验证 V7.1:
   - Twitter/X 内容能出现在 Articles。
   - 点击未读条目后小绿点消失。
   - 不再出现 `Unexpected end of JSON input`。
2. 决定 `prisma/dev.db` 是否继续纳入版本管理。当前它是运行态数据库，容易在验证时变脏。
3. 观察 Twitter Nitter fallback 稳定性，如果公共实例失效，改成可配置项。

### 中优先级

1. 给 item 状态接口补 API 层测试，覆盖 `id`/`nxtPid` 两种 params。
2. 给 Articles 视图补前端过滤测试，确保 `Update` 不再被漏掉。
3. 拆分 `src/app/page.tsx`，降低主页面复杂度。
4. Settings 中补 RSSHub/Twitter 配置说明。
5. 保持 YouTube、Bilibili、Weibo、普通 RSS 的回归测试。

### 后续版本

1. 后台自动刷新任务。
2. 失败重试队列。
3. 多端同步。
4. AI 摘要批量处理。
5. 阅读状态、收藏、稍后读的批量操作。

## 下一次会话建议起点

1. 先读取本文件。
2. 执行 `git status --short --branch`。
3. 如果要验证 UI，先确认 dev server 是否打开了当前 `prisma/dev.db`。
4. 优先从用户人工检测反馈继续，不要先做无关重构。
