/*
 * 文章数据
 * 新增一篇：数组最前面加一条（越靠前越新），再复制 posts/post-template.html 改名
 *   word = 封面上竖排的日文（一两个词就够）
 *   tone = 封面配色 1~4
 *   read = 阅读时长（分钟）
 */
window.POSTS = [
        {
    slug: "post-05",
    file: "posts/post-05.html",
    no: "05",
    title: "艰难的维护",
    word: "本当に難しい",
    date: "2026.10.22",
    tag: "杂记",
    tone: 4,
    read: 1,
    cover: "",
    excerpt: "维护网站实在艰难"
  },
  {
    slug: "first",
    file: "posts/post-first.html",
    no: "04",
    title: "开始用这个网站的理由",
    word: "はじめた理由",
    date: "2026.10.21",
    tag: "公告",
    tone: 1,
    read: 1,
    cover: "",
    excerpt: "「想做个自己的网站」这句话我说了几年 以前一直套用别人的模板 今天终于用dsh实现了我自己的想法"
  }
];
