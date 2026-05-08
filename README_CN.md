# EdgeForm

边缘原生微站引擎 — 一份 JSON，七套主题，零成本。

完全运行在 Cloudflare 免费套餐上：Pages + D1 + KV。

## EdgeForm 是什么？

EdgeForm 将一份 JSON 配置转化为一个完整的、支持多主题和多语言的微站，部署在全球边缘节点上。

- **表单** — 调查问卷、等候名单、联系表单，支持多步骤
- **落地页** — 全屏翻页滚动、产品发布页、定价页
- **个人链接页** — 个人主页、开发者名片
- **轻量站点** — 作品集、小型企业官网

### 核心特性

- **7 套内置主题** — Glass、Terminal、Brutal、Minimal、Retro、Light、Soft
- **13 种区块类型** — Hero、Features、Form、Text、Image、Pricing、Links、Countdown、FAQ、Testimonials、Logos、Video、Footer
- **实时主题切换** — 访客可体验所有主题，URL `?theme=xxx` 可分享
- **自定义品牌** — 主色调选择器、Logo 上传、每个区块独立背景
- **区块级布局控制** — 可配置页面宽度（narrow/normal/wide/full）和间距
- **全屏翻页导航** — 流畅的页面过渡，支持 6 种入场动画
- **零成本** — 完全运行在 Cloudflare 免费套餐（支持 10 万 PV/月）
- **多站点支持** — 单次部署可托管无限子站点（`/s/{id}`）
- **访客语言切换** — 运行时翻译，胶囊式语言选择器，URL `?lang=xx` 可分享
- **AI 翻译** — 12 种翻译引擎（Google、Microsoft、MS Edge 免费、MyMemory、DeepLX、OpenAI、Claude、DeepSeek、GLM、OpenAI 兼容、Coze、Workers AI），56 种目标语言（含 zh-CN/zh-TW/zh-HK）
- **Webhook 通知** — 表单提交或等候名单注册后 POST 到 Slack/Zapier 等
- **图片上传** — 在管理后台直接上传图片，存储在 Cloudflare KV 中
- **管理后台** — 深色/浅色模式、多语言（EN/中文/日本語/ES）、可视化 + JSON 双编辑器
- **一键部署** — 单条 `wrangler deploy` 命令，无需单独部署 Workers

## 项目结构

```
edgeform/
├── apps/web/                  # Astro SSR → Cloudflare（一体化部署）
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.astro    # 站点渲染器
│   │   │   ├── admin.astro    # 管理后台（深色/浅色，多语言）
│   │   │   └── api/           # 服务端 API 接口
│   │   │       ├── health.ts
│   │   │       ├── submit.ts       # POST — 多字段表单提交
│   │   │       ├── waitlist/
│   │   │       │   ├── index.ts    # POST — 提交邮箱
│   │   │       │   └── count.ts    # GET — 公开计数
│   │   │       ├── img/
│   │   │       │   └── [id].ts     # GET — 提供上传的图片
│   │   │       └── admin/
│   │   │           ├── login.ts    # POST — 验证密码
│   │   │           ├── config.ts   # GET/PUT/DELETE — 站点配置
│   │   │           ├── stats.ts    # GET — 仪表盘统计
│   │   │           ├── waitlist.ts # GET — 分页列表
│   │   │           ├── submissions.ts # GET — 表单提交记录
│   │   │           ├── export.ts   # GET — CSV 下载
│   │   │           ├── templates.ts # GET — 模板配置
│   │   │           ├── translate.ts # POST — AI 翻译
│   │   │           └── upload.ts   # POST — 图片上传
│   │   ├── components/
│   │   │   └── renderer/
│   │   │       └── SiteEngine.astro  # 核心渲染引擎
│   │   ├── themes/            # 主题注册表（可插拔）
│   │   │   ├── registry.ts
│   │   │   ├── types.ts
│   │   │   ├── shared-renderers.ts  # 共享区块 HTML 生成器
│   │   │   ├── shared-blocks.css    # 共享区块 CSS
│   │   │   ├── glass/         # 毛玻璃，暖橙色调
│   │   │   ├── terminal/      # 黑底绿字黑客风
│   │   │   ├── brutal/        # 反设计，大胆色彩
│   │   │   ├── minimal/       # 瑞士设计，极简
│   │   │   ├── retro/         # CRT 荧光绿
│   │   │   ├── light/         # SaaS 风格，蓝色调
│   │   │   └── soft/          # Notion 风格，温暖衬线
│   │   ├── lib/
│   │   │   ├── i18n-extract.ts  # 翻译文本提取
│   │   │   ├── icons.ts         # 统一 Lucide SVG 图标集
│   │   │   └── translate.ts     # 多引擎翻译
│   │   └── layouts/
│   │       └── Base.astro     # 基础布局（含 SEO）
│   ├── migrations/
│   │   ├── 0001_init.sql      # D1 数据库 Schema（forms、submissions、waitlist）
│   │   ├── 0002_add_site_id.sql      # 多站点字段
│   │   └── 0003_migrate_waitlist.sql # 合并 waitlist 到 submissions
│   ├── wrangler.toml          # Cloudflare 配置（D1/KV 绑定）
│   └── public/
├── packages/shared/           # 共享 TypeScript 类型
│   └── src/types.ts
└── docs/
```

## 区块类型

| 区块 | 说明 | 主要选项 |
|------|------|----------|
| **Hero** | 标题、副标题、CTA 按钮 | 背景（渐变/图片/粒子）、动画 |
| **Features** | 特性卡片网格 | 列数（2-4）、布局（网格/列表） |
| **Form** | 多字段、多步骤表单 | 10 种字段类型、验证、表单 ID |
| **Text** | 富文本段落 | 大小（sm/md/lg）、对齐 |
| **Image** | 图片与说明文字 | 上传或 URL、适应模式、圆角 |
| **Pricing** | 定价卡片 | 套餐与特性列表、高亮标记、CTA |
| **Links** | 链接列表（Bio 风格） | 头像、图标、描述、样式变体 |
| **Countdown** | 实时倒计时 | 自定义标签、到期消息 |
| **FAQ** | 手风琴式问答 | 点击展开/折叠 |
| **Testimonials** | 客户评价 | 头像、作者、公司、职位 |
| **Logos** | 品牌墙 | 灰度→悬停彩色、可选链接 |
| **Video** | 嵌入视频 | YouTube、Bilibili、MP4、自动播放 |
| **Footer** | 页脚与链接 | 社交链接、自定义文本 |

所有区块支持：动画（6 种）、页面宽度覆盖、间距控制、独立背景。

## 前置条件

- [Node.js](https://nodejs.org/) >= 22
- [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费套餐即可）
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

```bash
npm install -g wrangler
```

## 本地开发

### 1. 克隆并安装依赖

```bash
git clone <repo-url> edgeform
cd edgeform
npm install
```

### 2. 配置本地密钥

```bash
cd apps/web
cat > .dev.vars << 'EOF'
ADMIN_PASSWORD=your-secret-password
TURNSTILE_SECRET=
EOF
```

### 3. 创建本地 D1 数据库

```bash
npx wrangler d1 execute edgeform-db --local --file=migrations/0001_init.sql
npx wrangler d1 execute edgeform-db --local --file=migrations/0002_add_site_id.sql
npx wrangler d1 execute edgeform-db --local --file=migrations/0003_migrate_waitlist.sql
```

### 4. 启动开发服务器

```bash
npx astro dev --port 4321
```

- 落地页：http://localhost:4321
- 管理后台：http://localhost:4321/admin
- API 接口：http://localhost:4321/api/*

所有功能在单进程中运行，无需单独启动 Workers 服务。

## 部署到 Cloudflare

在 `apps/web/` 目录下一条命令搞定：

```bash
cd apps/web
npm run deploy
```

脚本自动完成：
1. 登录 Cloudflare（如未登录）
2. 创建 D1 数据库和 KV 命名空间（如不存在）
3. 执行数据库迁移
4. 构建项目
5. 部署到 Cloudflare Workers
6. 提示设置 `ADMIN_PASSWORD`

部署完成后，站点地址为 `https://edgeform.<your-subdomain>.workers.dev`。

## 管理后台

访问部署站点的 `/admin` 路径（本地开发为 http://localhost:4321/admin）。

### 功能

- **深色/浅色模式** — 顶部切换按钮，自动保存偏好
- **多语言界面** — EN、中文、日本語、ES — 顶部下拉切换
- **可视化编辑器** — 拖拽排序页面/区块，每种区块类型的丰富表单
- **JSON 编辑器** — 直接编辑 JSON，带验证
- **模板选择器** — 6 套内置模板作为起点
- **主题选择器** — 可视化卡片预览 7 套主题
- **品牌设置** — 主色调选择器（带预览）、Logo 上传
- **Webhook 配置** — URL + 密钥，表单/等候名单通知
- **图片上传** — 直接上传图片，存储在 KV 中通过 CDN 提供
- **等候名单** — 分页表格，CSV 导出
- **提交记录** — 按表单筛选，动态列，延迟追踪
- **翻译管理** — 翻译引擎配置，语言管理，翻译表格

## API 接口

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/health` | 否 | 健康检查 |
| `POST` | `/api/waitlist` | 否 | 提交邮箱到等候名单 |
| `GET` | `/api/waitlist/count` | 否 | 获取等候名单总数 |
| `POST` | `/api/submit` | 否 | 提交多字段表单 |
| `GET` | `/api/img/:id` | 否 | 提供上传的图片 |
| `POST` | `/api/admin/login` | 是 | 验证管理员密码 |
| `POST` | `/api/admin/password` | 是 | 修改管理员密码 |
| `GET` | `/api/admin/config?list=1` | 是 | 列出所有站点 |
| `GET` | `/api/admin/config?siteId=` | 是 | 读取站点配置（缺省读取主站） |
| `PUT` | `/api/admin/config` | 是 | 保存站点配置（body：`{ config, siteId }`） |
| `DELETE` | `/api/admin/config?siteId=` | 是 | 删除子站点（或重置主站） |
| `GET` | `/api/admin/stats?siteId=` | 是 | 仪表盘统计数据 |
| `GET` | `/api/admin/waitlist` | 是 | 等候名单列表 |
| `GET` | `/api/admin/submissions?siteId=` | 是 | 表单提交记录 |
| `GET` | `/api/admin/export?siteId=` | 是 | CSV 导出（等候名单/提交记录） |
| `GET` | `/api/admin/templates` | 是 | 列出/加载模板 |
| `POST` | `/api/admin/translate` | 是 | 批量翻译（body 含 `siteId`） |
| `POST` | `/api/admin/upload` | 是 | 上传图片（最大 2MB） |

鉴权方式：`Authorization: Bearer <ADMIN_PASSWORD>` 请求头，或 `?token=<ADMIN_PASSWORD>` 查询参数。

## Schema 示例

```json
{
  "id": "my-site",
  "title": "My Site",
  "theme": { "name": "glass", "primaryColor": "#f97316", "logoUrl": "/api/img/abc.png" },
  "themeSwitcher": {
    "enabled": true,
    "themes": ["glass", "minimal", "light"],
    "defaultTheme": "glass",
    "position": "top-right"
  },
  "navigation": "fullpage",
  "webhook": { "url": "https://hooks.slack.com/...", "secret": "my-secret" },
  "pages": [
    {
      "id": "hero",
      "blocks": [
        {
          "type": "hero",
          "title": "Hello World",
          "subtitle": "Built with EdgeForm",
          "cta": { "label": "Get Started", "action": "next" },
          "animation": { "type": "fade-up" }
        }
      ]
    },
    {
      "id": "faq",
      "blocks": [
        {
          "type": "faq",
          "heading": "常见问题",
          "items": [
            { "question": "真的免费吗？", "answer": "是的，运行在 Cloudflare 免费套餐上。" }
          ]
        }
      ]
    }
  ]
}
```

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 运行时 | Astro SSR + Cloudflare Workers | 一体化：静态页面 + 服务端 API |
| 数据库 | Cloudflare D1 (SQLite) | 提交数据 + 等候名单存储 |
| 配置 | Cloudflare KV | 站点配置 + 图片存储 |
| 安全 | Cloudflare Turnstile | 机器人防护 |
| 翻译 | 12 种引擎 | Google、Microsoft、MS Edge（免费）、MyMemory、DeepLX、OpenAI、Claude、DeepSeek、GLM、OpenAI 兼容、Coze、Workers AI |

## 许可证

MIT
