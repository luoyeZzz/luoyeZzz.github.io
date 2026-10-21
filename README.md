# 洛月 ｜ 把日常写成轻小说

一个纯静态的个人博客。没有构建步骤、没有依赖，双击 `index.html` 就能看。

---

## 页面

| 文件 | 内容 |
|---|---|
| `index.html` | 首页：加载动画、首屏（昼夜两套背景 + 两位看板娘）、最新文章、入口卡、简介、页脚 |
| `posts.html` | 文章列表：标签筛选（全部 / 日々 / 読書 / お知らせ） |
| `about.html` | 关于：身份卡、喜欢的角色、时间线、联系方式 |
| `quotes.html` | 台词收藏：卡片流，数据在 `assets/js/quotes-data.js` |
| `posts/post-first.html` | 正文：开始用这个网站的理由 |
| `posts/post-template.html` | 新文章模板：带 ①~⑩ 注释，复制改名就能写 |

**昼夜双主题**：白天是窗边积雨云 + 逢坂大河，夜里是流星夜空 + 哥伦比娅；
台词、名牌、背光、月亮都会跟着换。默认浅色，右上角切换，选择记在浏览器里。

---

## 目录

```
index.html  posts.html  quotes.html  about.html
posts/                     全部正文页（post-first / post-template）
assets/
  css/style.css            全站样式（两套主题、两套看板娘、顶栏三栏网格、内页排版）
  js/posts.js              文章数据 ← 加文章改这里
  js/quotes-data.js        台词数据（工具生成）
  js/main.js               加载动画 / 主题 / 卡片渲染 / 标签筛选 / 花瓣
  img/
    hero-room.jpg          首屏·白天背景（1920×1080，窗边积雨云）
    hero-night.jpg         首屏·夜晚背景（2400×1805，流星夜空）
    feature-cover.jpg      头条卡片封面
    taiga-photo.jpg        白天看板娘（原图装框，未处理）
    columbina-photo.jpg    夜晚看板娘（2000×3000，缩放到 2K）
    posts/                 工具上传的正文图 / 头像 / 自定义封面
    moon.svg  favicon.svg  月亮标识
    flower.svg  petal.svg  noise.svg  sky.svg  sun.svg  avatar.svg
preview/                   页面截图，可直接删
```

---

## 常用改动

### 看板娘：昼夜各一位

`index.html` 里的结构：

```html
<div class="hero-char-slot">
  <div class="hero-char hero-char--day">   ← 白天：大河
    <div class="char char--c" ...></div>
  </div>
  <div class="hero-char hero-char--night"> ← 夜晚：哥伦比娅
    <div class="char char--d" ...></div>
  </div>
</div>
```

显示规则在 CSS 里：

```css
[data-theme="light"] .hero-char--night{ display: none; }
[data-theme="dark"]  .hero-char--day  { display: none; }
```

换角色时同时改：`aria-label`、对话框文案、名牌文字。

### 换首屏背景（昼夜各一张）

- 白天：替换 `assets/img/hero-room.jpg`
- 夜晚：替换 `assets/img/hero-night.jpg`

位置改 CSS 里的 `center 42%`（白天）/ `center 58%`（夜晚）。

### 自己写一篇文章（不用懂代码）

1. 复制 `post-template.html`，改名成 `post-你的名字.html`
2. 打开它，找到带注释的 ①~⑩ 编号，改文字就行
3. 在 `assets/js/posts.js` 最前面加一条，列表页和首页就会出现

模板里的“积木”，复制粘贴即可：

| 想要的效果 | 写法 |
|---|---|
| 普通段落 | `<p>文字</p>` |
| 首字放大 | 文章**第一段**自动生效，不用写 |
| 小标题（左边粉线） | `<h2>标题</h2>` |
| 漫画对白框 | `<div class="dialogue">「A」<br>「B」</div>` |
| 手写便签 | `<div class="note">注：……</div>` |
| 引用（左边粉线） | `<blockquote>「……」</blockquote>` |
| 整宽图片 + 说明 | `<figure><img src="…" alt=""><figcaption>说明</figcaption></figure>` |
| 拍立得图片 | `<figure class="polaroid"><img src="…" alt=""><figcaption>说明</figcaption></figure>` |
| 标签 | `<a class="tag-chip" href="posts.html">日々</a>` |
| 上一篇 / 下一篇 | 照抄模板底部的 `<nav class="pager">` |

封面用 `.cover-1`（真图）或 `.cover-2/3/4`（渐变色），竖排日文用 `<span class="cover-word" lang="ja">そらの話</span>`。
### 加一篇文章（给数据）

1. 复制 `posts/post-template.html`，改名成 `posts/post-你的名字.html`，改标题、日期、正文
2. 在 `assets/js/posts.js` 数组最前面加一条：

```js
{
  slug: "new",
  file: "posts/post-new.html",
  no: "05",
  title: "标题",
  word: "そらの話",     // 封面竖排日文
  date: "2026.11.01",
  tag: "日々",
  tone: 1,             // 1~4 封面配色
  read: 5,             // 阅读时长
  excerpt: "摘要……"
}
```

列表页和首页会自动出现这一篇。

### 改名字 / 文案

- 站名：`洛月`、`LUOYUE`、假名 `らくげつ`；作者署名 `洛叶`
- 台词：白天搜 `別に`，夜晚搜 `夜明け`
- 首屏小字：搜 `らくげつ`

---

## 写作工具（图形界面）

不用再手改 HTML。双击桌面上的「**洛月写作工具**」，或运行 `tools/start.bat`，浏览器会自动打开编辑器。

### 写一篇

1. 左边点「＋ 段落 / 小标题 / 对白框 / 便签 / 引用 / 图片 / 拍立得」拼正文
2. 右边填标题、日期、分类、阅读时长、封面配色、竖排日文、摘要
3. 点「保存文章」→ 自动生成 `post-05.html`，并写进 `posts.js`
4. 点「预览」直接看效果；右上角可切**昼夜模式**

### 发布到 GitHub（第一次需要）

1. 装好 Git（本机已装在 `D:\Git`，工具会自动找）
2. GitHub 建仓库，比如 `gaoshou333.github.io`
3. 在 GitHub → Settings → Developer settings → Personal access tokens 生成一个带 `repo` 权限的令牌
4. 工具右下角填「仓库地址」和「令牌」，点**初始化仓库**
5. 以后每次：写完 → 点**提交并推送**

令牌只存在你浏览器里，推送时临时使用，不写进 `.git/config`。

### 分类、封面、退出

- **分类**：一排选项片，点一下就选中；「＋ 新分类」自己加，自定义分类带 ×，点掉只从列表移除
- **封面配色**：1 是内置那张粉色星空插画；2/3/4 是渐变。想用自己的图，点 **上传封面**，会覆盖配色
- **图片**：正文里的「＋ 上传图片」会存到 `assets/img/posts/`
- **退出**：右上角「退出」会停掉服务，命令行窗口关闭；页面倒计时 3 秒后尝试自动关闭（浏览器可能禁止关闭非脚本打开的标签页，届时会跳空白页）
### 关于页（第三个标签）

点顶部的 **关于页**：

- **头像**：上传图片，自动存到 `assets/img/posts/`
- **名字 / 副标题**：页面标题和卡片上的昵称
- **档案**：身份、喜欢、在做…… 可加减行
- **介绍标题 / 段落**：正文开头那两段
- **喜欢的角色**：角色名 + 出处，可加减
- **时间线**：日期 + 一句话，可加减
- **联系方式**：名称 + 链接

点「保存关于页」会重写 `about.html`，数据存在 `tools/about.json`，下次打开自动回填。
### 界面说明

- **发布**在右上角按钮里（弹窗），不在侧栏
- **文章信息**侧栏只在「写作」标签显示；「文章管理」「关于页」是全宽
- 删光文章时，首页「今日的独白」和文章列表都会显示空状态；首页顶部的「文章数」跟着 `posts.js` 自动变
### 联系方式图标

「关于页」里每条联系方式左边有个图标按钮，点开是图标选择器（GitHub / B站 / 微信 / QQ / 微博 / 抖音 / 快手 / 小红书 / 知乎 / 贴吧 / 邮箱 / 通用链接 / X / Telegram / Discord / YouTube / Steam / Pixiv / 音乐 / Instagram / 不要图标）。

选完保存，关于页和首页的联系方式会一起换图标。图标库在 `tools/icons.json`，想加新图标往里加一条就行（key + label + svg）。
### 注意

- 工具只用于本地写作，别把 `tools/` 当成网站页面
- 文章页是生成的静态文件，保存后想改文字，直接改 HTML 或用编辑器重写一篇
- 推送失败时看右下角的黑色日志，里面是 git 的原始报错
## 部署到 GitHub Pages

1. 新建仓库 `gaoshou333.github.io`（与用户名同名才是根域名）
2. 把本目录所有文件推到 `main` 分支根目录
3. Settings → Pages → Source 选 `Deploy from a branch` → `main` / `(root)`
4. 访问 `https://gaoshou333.github.io`
5. 以后买域名：根目录放 `CNAME` 文件写域名，再去域名商加解析

全站相对路径，放子目录也能跑。

---

### 台词收藏

- 页面：`quotes.html`，导航第三项
- 数据：`assets/js/quotes-data.js`（由工具生成）
- 编辑：写作工具 →「台词」标签，可增删改、预览
- 首页入口卡片已从「照片墙」换成「台词收藏」
## 最近新增

| 功能 | 位置 | 说明 |
|---|---|---|
| 长文章排版 | 文章页 | 小标题 ≥3 个时自动生成目录；顶部阅读进度条；右下角回顶部 |
| 阅读时长自动 | 文章页 / 列表 | 按正文 400 字/分钟估算，编辑器留空即自动 |
| 台词收藏 | 导航「台词」/ 工具「台词」标签 | 收藏喜欢的句子，可增删改 |
| 站内搜索 | 文章列表页 | 搜标题、摘要、分类；支持 `posts.html?q=关键词` 分享 |
| 首页文案 | 工具「首页文案」标签 | 大标题两行、副标题两行、页脚两行 |
| sitemap / robots | 工具「发布」弹窗 | 填「站点地址」后自动生成 `sitemap.xml` 与 `robots.txt`，每次保存文章自动更新 |
## 推送方式

本地写作工具的推送配置属于**机器相关**信息，不放在公开 README 里，
说明见本地文件 `tools/SSH-SETUP.md`（该目录不随站点发布）。
## 换电脑 / 重装系统怎么办

双击 `tools/git-ssh-setup.bat`，它会：

1. 没有密钥就生成一个
2. 写好 `~/.ssh/config`
3. 把仓库地址从 HTTPS 换成 SSH
4. 把**公钥打印出来**，复制到 https://github.com/settings/keys

然后用工具推送即可。忘了也不怕——跑这个脚本就恢复。

**也可以备份** `C:\Users\你\.ssh` 整个文件夹，换电脑后放回去，连 GitHub 都不用重新加公钥。

### 会影响网速吗

不会。推送用的配置只影响 git 本身，不做全局代理、不改系统网络设置，
平时上网、下载、看视频都不受影响。
## 换电脑 / 重装系统

**把整个 `luoyueWeb` 文件夹复制走就行。** 项目里没有任何绝对路径：

- 页面之间全是相对路径（`posts/xxx.html`、`../assets/...`）
- 工具用 `__dirname` 定位自己，跟放在哪个盘无关
- `start.bat` 用 `%~dp0`，双击就能找到自己
- `about.json` 里的头像、文章封面都是相对路径

新电脑上需要三件事：

1. **装 Node.js**（LTS 版，https://nodejs.org）——工具靠它跑
2. 双击 `tools/setup.bat`：检查环境、重建桌面快捷方式、启动工具
3. 想推送到 GitHub 的话再装 Git（https://git-scm.com），工具会自动找到

> 只是看网站的话，连 Node 都不用：直接双击 `index.html` 就能看。

### 可选：Git 装在奇怪的地方

`tools/config.json` 已经存在，如果 Git 不在 PATH、也不在常见目录，把路径填进 `gitPath`：

```json
{ "gitPath": "E:\\Tools\\Git\\cmd\\git.exe" }
```

工具会优先用它。

### 可以删的

`preview/` 是开发时的截图，删掉不影响网站（能省 20 多 MB）。
## 技术上踩过的坑（改之前先看）

1. **遮罩必须内联**：抠图靠 CSS `mask-image`，但 `file://` 下浏览器会拦外部遮罩图，立绘会直接消失。遮罩都以 base64 写在 CSS 里。
2. **遮罩元素不能加 `drop-shadow`**：滤镜按矩形包围盒计算，立绘周围会多出一个方块光晕。
3. **小字号不要用衬线**：Windows 缺中文衬线，会回退宋体，20px 以下带点阵化，出现锯齿。所有小字统一走 `--ui`（微软雅黑）。
4. **旋转的文字会糊**：气泡倾斜后文字要重采样，字号小就发虚。这是已知取舍，暂时保留倾斜。
5. **顶栏是三栏网格**：`.topbar-inner` 用 `grid-template-columns: 1fr auto 1fr`，导航锁在正中。首页没有「返回」键、其他页有，右侧图标数量也不一样，用弹性布局（`space-between`）会让四个导航按钮在不同页面左右跳 7~10px，别改回去。窄屏（≤860）导航变抽屉，才临时切回 flex。
6. **滚动条槽常驻**：`html{overflow-y:scroll}`。进站动画会给 body 加 `overflow:hidden`，如果不常驻滚动条，动画结束那一刻整页会横向抖 7px——顶栏、首屏一起跳。

---

## 版权说明

- 白天看板娘（逢坂大河）：Pixiv 画师作品，经搬运站获取（编号 123182833），原图 1334×1761，未压缩
- 夜晚看板娘（哥伦比娅）：Pixiv 画师作品（编号 149353730），原图 3000×4500，缩放到 2000×3000
- 备用立绘（洛琪希）：Pixiv 画师 **持剑的于桑**（UID 91987423），编号 119694278 / 150566778
- 首屏背景：Pixiv 风景插画（编号 62916918 / 137583023）
- 头条封面：Pixiv 插画（编号 149406245）
- 《龙与虎》《无职转生》《原神》及其角色版权归原作者与出版社所有

个人非商用博客的常见用法，严格说仍是二次使用，商用务必替换为授权素材。