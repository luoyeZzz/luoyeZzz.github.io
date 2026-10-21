/*
 * 文章数据
 * 新增一篇：数组最前面加一条，再复制 posts/first.html 改名
 *   word = 封面上竖排的日文（一两个词就够）
 *   tone = 封面配色 1~4
 *   read = 阅读时长（分钟）
 */
window.POSTS = [
  {
    slug: "sky",
    file: "posts/post-sky.html",
    no: "01",
    title: "第一次把天空写进小说里",
    word: "そらの話",
    date: "2026.10.18",
    tag: "日々",
    tone: 1,
    read: 1,
    excerpt: "那天傍晚的云是粉紫色的。我骑车经过天桥，忽然觉得应该把它记下来——于是就有了这个网站的第一篇。"
  },
  {
    slug: "konbini",
    file: "posts/post-konbini.html",
    no: "02",
    title: "关于清晨六点的便利店",
    word: "あさ六時",
    date: "2026.10.11",
    tag: "日々",
    tone: 2,
    read: 1,
    excerpt: "关东煮的汤在冒热气，收银台前的店员打了个很轻的哈欠。那一刻我居然觉得，世界还挺温柔的。"
  },
  {
    slug: "quotes",
    file: "posts/post-quotes.html",
    no: "03",
    title: "轻小说里让我心动的三句台词",
    word: "すきな言葉",
    date: "2026.09.29",
    tag: "読書",
    tone: 3,
    read: 1,
    excerpt: "有些句子不是为了推动剧情，只是为了让某个人被记住。抄下来的时候，手会停下来很久。"
  },
  {
    slug: "first",
    file: "posts/post-first.html",
    no: "04",
    title: "开始用这个网站的理由",
    word: "はじめた理由",
    date: "2026.09.12",
    tag: "お知らせ",
    tone: 4,
    read: 5,
    excerpt: "「想做个自己的网站」这句话我说了两年，一直没动。今天终于动了，理由其实很幼稚。"
  }
];
