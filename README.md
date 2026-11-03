# 洛月 ｜ 把日常写成轻小说

Markdown 驱动的静态博客：内容在 `content/`，一条命令生成整站，URL 是目录式的
（`/posts/first/`），部署在 GitHub Pages。零运行时依赖，只需要 Node。

---

## 页面

| 地址 | 内容 |
|---|---|
| `/` | 首页：悬浮玻璃导航、昼夜首屏、最近文章、六个入口、摘录 |
| `/posts/` | 文章列表：搜索 + 分类筛选 |
| `/posts/<slug>/` | 正文：右侧信息栏（发布/分类/阅读/目录/进度）、上下篇 |
| `/archive/` | 归档：左右交错的时间线，卡片带封面 |
| `/moments/` | 说说：短句 + 可选图片 |
| `/gallery/` | 相册列表；`/gallery/<album>/` 是相册详情（瀑布流） |
| `/quotes/` | 台词收藏 |
| `/friends/` | 友链：头像 + 昵称 + 简介卡片，空列表有自定义文案 |
| `/about/` | 关于：身份卡、喜欢的角色、联系方式 |
| `/404.html` | 找不到页面 |

右下角：音乐播放器（播放/暂停、上一首/下一首、音量、可折叠歌单）和回到顶部。
左上角头像进入「关于」页。右上角切换昼夜（☀/☾）。

---

## 目录

```
content/
  site.json        全站配置：导航、文案、看板娘、页脚、开关、音乐
  about.json       关于页
  quotes.json      台词
  moments.json     说说
  gallery.json     相册
  friends.json     友链
  posts/*.md       文章（front matter + markdown）

assets/
  css/style.css    全站样式（柔光玻璃、圆角体系、明暗双主题）
  js/main.js       前台脚本（主题/搜索/目录/音乐/回顶/点击特效）
  img/             图片

tools/             本地写作台（随仓库走，clone 下来就能用）
  build.js         生成器：content → 静态页
  server.js        本地服务 + 编辑接口
  doctor.js        环境体检
  deps.js          依赖发现（config → PATH → 注册表 → 标准目录）
  editor.html      写作台界面
  start.bat / setup.bat / git-ssh-setup.bat
  config.json      本机配置（不上传）
  使用手册.md       操作手册（不上传）

index.html  posts/  archive/  moments/  gallery/  quotes/  friends/  about/ 404.html
sitemap.xml  robots.txt
```

---

## 写作台

双击 `tools/start.bat`，打开 `http://127.0.0.1:4173/admin/`。

十个标签：**文章 / 站点 / 关于 / 说说 / 相册 / 友链 / 台词 / 音乐 / 环境 / 发布**。
保存任何一项都会自动重建整站。

- **文章**：Markdown 编辑 + 实时预览、封面图上传、置顶、链接短名、配色；日期时间用自绘日历（可选到秒，「现在」一键填）
- **站点**：站名、首屏、看板娘、页脚、开关、各页导语
- **说说 / 相册**：日期时间同样用自绘日历（到秒），新建时默认填当前时间；说说支持上传/链接配图，相册支持多图与说明
- **音乐**：粘贴网易云歌曲链接自动解析歌名；播放/暂停、上下首、进度条、点喇叭弹出音量；可开关进站自动播放
- **环境**：一键体检 Node / Git / 文件 / 权限 / 远端，缺东西给安装链接
- **发布**：提交 / 推送 / 拉取 + 日志

---

## 写文章

`content/posts/<slug>.md`：

```markdown
---
title: 标题
date: 2026-11-02
tag: 杂记
word: ことば        # 封面竖排日文
tone: 2            # 封面配色 1 星空 / 2 淡蓝 / 3 青绿 / 4 淡紫
pinned: false      # 置顶
excerpt: 列表页的一句话
cover: /assets/img/posts/xxx.jpg   # 可选
---

正文第一段（以引号开头时不会首字下沉）。

## 小标题

:::dialogue
「第一句」
「第二句」
:::

:::note
便签。
:::

![说明](/assets/img/posts/xxx.jpg)
```

其他可用的块：`> 引用`、`- 列表`、`---` 分割线、三个反引号代码块。

---

## 构建与部署

```bash
node tools/build.js        # 生成整站
node tools/server.js       # 本地预览 http://127.0.0.1:4173
```

推送到 `main` 后由 GitHub Pages 发布。`sitemap.xml` 里都是干净地址。

> 目录式 URL 要求经过服务访问，**不能双击 html 打开**。

---

## 换电脑 / 依赖检查

工具代码现在跟着仓库走，换台电脑重新 clone 也能用：

1. 装 **Node.js（LTS）**：https://nodejs.org
2. 双击 `toolssetup.bat`：检查 Node → 跑依赖体检（缺什么自动打开下载页）→ 建桌面快捷方式 → 启动
3. 需要推送到 GitHub 再装 Git；不想配 SSH 就填 HTTPS 地址 + 访问令牌

随时体检：

```bash
node tools/doctor.js          # 终端里逐项报告
node tools/doctor.js --open   # 缺依赖时顺手打开安装页
```

写作台的「环境」标签是同一套检查，缺什么直接给按钮。

**不写死任何安装路径**，Git 的查找顺序：

1. `tools/config.json` 里的 `gitPath`
2. 环境变量 `GIT_BIN`
3. 系统 PATH（Windows 用 `where`，其它用 `which`）
4. Windows 注册表 `GitForWindowsInstallPath`
5. 标准安装目录（Program Files / LOCALAPPDATA / /usr/bin …）
6. 最后才试 `D:Git` 这类常见位置

每个候选都会真的执行一次 `--version`，能跑才算数。

---

## 技术说明

1. 生成器零依赖：自己解析 front matter、渲染 markdown、拼页面。
2. 目录式输出：`posts/<slug>/index.html` → `/posts/<slug>/`。
3. 字体全站无衬线（MiSans / 微软雅黑 / 苹方），标题 600 字重。
4. 柔光玻璃：`.glass-grad` 渐变 + `backdrop-filter` + 内侧高光，明暗各一套。
5. 昼夜主题：`data-theme` 挂在 `<html>` 上，首屏前内联脚本先定主题，避免闪烁。
6. 正文永远白底：玻璃只用在导航、卡片、侧栏这些「需要区分层次」的地方。

---

## 版权

看板娘与背景图来自 Pixiv，版权归原作者；《龙与虎》《无职转生》《原神》角色版权归
原作者与出版社。个人非商用博客的常见用法，商用请替换为授权素材。
