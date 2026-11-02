# 洛月 ｜ 把日常写成轻小说

一个 **Markdown 驱动** 的静态个人博客：内容写在 `content/`，一条命令生成整站，
URL 是目录式的 `/posts/first/`，没有 `.html` 尾巴。零运行时依赖，只需 Node。

---

## 现在长这样

| 地址 | 页面 |
|---|---|
| `/` | 首页：加载动画、昼夜双主题首屏、两位看板娘、最新文章、入口卡 |
| `/posts/` | 文章列表：搜索 + 分类筛选 |
| `/posts/<slug>/` | 文章正文：阅读进度、目录（小标题 ≥3 时）、上下篇 |
| `/archive/` | 归档：按年份列出全部文章 |
| `/quotes/` | 台词收藏 |
| `/about/` | 关于：身份卡、喜欢的角色、时间线、联系方式 |
| `/404` | 找不到页面 |

右上角昼夜切换；右下角音乐播放器；点击有粒子特效（都能在配置里关）。

---

## 目录

```
content/                   ← 你写的东西都在这里
  site.json                全站配置（文案、看板娘、页脚、开关、歌单）
  about.json               关于页数据
  quotes.json              台词
  posts/
    first.md               一篇文章 = 一个 markdown 文件
    maintenance.md

assets/
  css/style.css            全站样式（昼夜两套变量 + 组件）
  js/main.js               前台交互（主题 / 搜索 / 目录 / 特效 / 音乐）
  img/                     图片

tools/                     本地写作台（不上传）
  build.js                 生成器：content → 静态页
  server.js                本地服务 + 编辑接口
  editor.html              写作台界面
  start.bat                双击启动
  setup.bat                新电脑初始化
  git-ssh-setup.bat        重新配置 SSH 推送
  使用手册.md               面向你的操作手册

index.html  posts/  archive/  quotes/  about/  assets/     ← 生成物，直接提交
404.html  sitemap.xml  robots.txt                          ← 生成物
```

`tools/` 被 `.gitignore` 排除，只在你电脑上；`content/` 和生成物跟着仓库走。

---

## 日常：打开写作台

双击 `tools/start.bat`，浏览器会打开 `http://127.0.0.1:4173/admin/`。

写作台有五个标签：

- **文章**：左边列表，右边编辑。标题、日期、分类、封面日文、配色、置顶、摘要、封面图、链接短名、正文（Markdown，带工具条和实时预览）。
- **站点**：站名、首屏文案、两位看板娘、页脚、功能开关、歌单、首页快捷入口、首页摘录——全部字段化，改完点保存。
- **关于**：名字、简介、档案、喜欢的角色、时间线、联系方式（可增删行）。
- **台词**：增删改。
- **发布**：看改动、写提交说明、提交 / 推送 / 拉取。

保存任意一项都会自动重新构建整站，刷新站点即可看到。

---

## 直接写 Markdown

一篇文章就是 `content/posts/<slug>.md`：

```markdown
---
title: 标题
date: 2026-11-02
tag: 杂记
word: ことば        # 封面上竖排的日文
tone: 2            # 封面配色 1 星空图 / 2 淡蓝 / 3 青绿 / 4 淡紫
pinned: false      # true = 置顶（首页头条、列表置顶、归档显示标记）
excerpt: 列表页的一句话
cover: /assets/img/posts/xxx.jpg   # 可选，会盖过配色
---

正文第一段。首字会自动放大（以引号开头的段落自动跳过）。

## 小标题

> 引用

:::dialogue
「第一句」
「第二句」
:::

:::note
便签：补充说明。
:::

![图片说明](/assets/img/posts/xxx.jpg)
```

| 想要 | 写法 |
|---|---|
| 小标题 | `## 标题` |
| 对白框 | `:::dialogue` … `:::` |
| 便签 | `:::note` … `:::` |
| 引用 | `> 一句话` |
| 整宽图片 | `![说明](地址)` 单独一行 |
| 拍立得 | `:::polaroid` 里放图片 |
| 列表 / 分割线 / 代码块 | `- 项` / `---` / 三个反引号 |
| 加粗 / 斜体 / 链接 | `**粗**` `*斜*` `[文字](地址)` |

---

## 站点配置

全部在 `content/site.json`（写作台「站点」标签是它的表单版）：

- `brand` / `title` / `description` / `url` / `since`
- `nav`：导航项（默认 首页 / 文章 / 归档 / 台词 / 关于）
- `hero`：首屏小字、大标题两行、副标题两行、按钮、便签、面包屑小字
- `characters.day|night`：看板娘名字、假名、称号、台词、立绘
- `footer`：页脚两行、右下角日文、版权后缀、「手写 HTML / CSS」那句
- `features`：`loader` / `petals` / `clickEffect` / `music` / `search` 开关
- `music`：歌单标题 + 网易云歌曲 id 列表
- `shortcuts`：首页三个入口卡
- `teaser`：首页底部那段摘录

---

## 构建

```bash
node tools/build.js
```

输出：`index.html`、`posts/<slug>/index.html`、`archive/`、`quotes/`、`about/`、
`404.html`、`sitemap.xml`、`robots.txt`。写作台保存时会自动跑这一步。

想本地预览又不想开写作台：

```bash
node tools/server.js     # 然后访问 http://127.0.0.1:4173/
```

> 因为 URL 是目录式的，**不能再用双击 html 的方式看站**（`file://` 不会把 `/about/` 映射到 `about/index.html`）。必须走上面的本地服务。

---

## 部署

和以前一样：`git add -A && git commit && git push`，GitHub Pages 从 `main` 根目录发布。

写清楚目录式 URL 的原因：`/posts/first/index.html` 在 GitHub Pages 上天然是 `/posts/first/`，
不需要任何重写规则；`sitemap.xml` 里也已经是干净地址。

首次部署在 Blog 仓库 **Settings → Pages** 里选 `Deploy from a branch` → `main` / `(root)`。

---

## 技术说明（改之前先看）

1. **生成器零依赖**：`tools/build.js` 自己解析 front matter、自己渲染 markdown，不装任何包。
2. **URL 是目录**：每个页面输出成 `xxx/index.html`，全站链接用绝对路径 `/posts/...`，
   所以部署在根域名下（`用户名.github.io`）才正确；放子目录要把 `site.json` 的 `base` 填成 `/子目录`。
3. **首字下沉**：`.prose > p:first-of-type::first-letter`；以引号/括号开头的段落，构建时会加 `.no-drop` 跳过。
4. **顶栏三栏网格**：`grid-template-columns: 1fr auto 1fr`，导航锁在正中，各页面不跳动；≤860px 收进抽屉。
5. **滚动条槽常驻**：`html{overflow-y:scroll}`，进站动画锁滚动时整页不会横向抖。
6. **遮罩内联**：立绘的 `mask-image` 以 base64 写在 CSS 里，`file://` 下外部遮罩会被拦。

---

## 版权

页面里的看板娘与背景图来自 Pixiv，版权归原作者；《龙与虎》《无职转生》《原神》角色版权归
原作者与出版社。个人非商用博客的常见用法，商用请替换为授权素材。
