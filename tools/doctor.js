'use strict';
/**
 * 洛月 · 环境体检
 *
 *   node tools/doctor.js          在终端里检查
 *   node tools/doctor.js --json   输出 JSON（给写作台用）
 *   node tools/doctor.js --open   缺什么就顺手打开对应的安装页
 *
 * 写作台的「环境」标签调的是同一套检查。
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const { exec } = require('child_process');
const deps = require('./deps');

const ROOT = path.resolve(__dirname, '..');

function portFree(port) {
  return new Promise(function (resolve) {
    const s = net.createServer();
    s.once('error', function () { resolve(false); });
    s.once('listening', function () { s.close(function () { resolve(true); }); });
    s.listen(port, '127.0.0.1');
  });
}

async function check() {
  const items = [];
  const add = function (o) { items.push(o); };

  /* Node */
  const node = deps.nodeInfo();
  add({
    key: 'node', label: 'Node.js', ok: node.ok, level: 'required',
    detail: node.version + (node.bin ? ' · ' + node.bin : ''),
    fix: { text: '下载 Node.js（LTS）', url: 'https://nodejs.org/zh-cn' }
  });

  /* Git */
  const git = deps.findGit(ROOT);
  add({
    key: 'git', label: 'Git', ok: git.ok, level: 'required',
    detail: git.ok ? git.version + ' · ' + git.bin + '（来自 ' + git.source + '）' : '没找到，推送功能不可用',
    fix: { text: '下载 Git for Windows', url: 'https://git-scm.com/download/win' }
  });

  /* 内容文件 */
  const need = [
    ['content/site.json', '站点配置'],
    ['content/about.json', '关于页数据'],
    ['content/posts', '文章目录'],
    ['tools/build.js', '生成器'],
    ['tools/editor.html', '写作台界面']
  ];
  const missing = need.filter(function (n) { return !fs.existsSync(path.join(ROOT, n[0])); });
  add({
    key: 'content', label: '站点文件', ok: missing.length === 0, level: 'required',
    detail: missing.length ? '缺少：' + missing.map(function (m) { return m[1]; }).join('、') : '齐全',
    fix: { text: '从 GitHub 重新克隆仓库', url: 'https://github.com/luoyeZzz/luoyeZzz.github.io' }
  });

  /* 写权限 */
  let writable = true;
  try {
    const probe = path.join(ROOT, '.doctor-tmp');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
  } catch (e) { writable = false; }
  add({
    key: 'write', label: '文件夹写入权限', ok: writable, level: 'required',
    detail: writable ? '可以写入' : '无法写入，生成器会失败',
    fix: { text: '把项目放到自己有权限的目录', url: '' }
  });

  /* git 仓库与远端 */
  const gitDir = fs.existsSync(path.join(ROOT, '.git'));
  let remote = '';
  if (gitDir && git.ok) {
    try {
      remote = require('child_process').execFileSync(git.bin, ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch (e) {}
  }
  add({
    key: 'repo', label: 'git 仓库', ok: gitDir, level: 'optional',
    detail: gitDir ? '仓库就绪' : '没有 .git，推送会失败（写作台里可以初始化）',
    fix: { text: '在 GitHub 新建同名仓库', url: 'https://github.com/new' }
  });
  add({
    key: 'remote', label: '远端地址', ok: !!remote, level: 'optional',
    detail: remote || '还没设置 origin',
    fix: { text: '填写仓库地址（写作台 → 发布）', url: '' }
  });

  /* 端口 */
  const free = await portFree(4173);
  add({
    key: 'port', label: '端口 4173', ok: true, level: 'info',
    detail: free ? '空闲' : '已有工具在运行（双击 start.bat 会直接打开）',
    fix: { text: '', url: '' }
  });

  /* SSH（可选，用于免令牌推送） */
  const sshDir = path.join(process.env.USERPROFILE || process.env.HOME || '', '.ssh');
  const hasSsh = fs.existsSync(sshDir) && fs.readdirSync(sshDir).some(function (f) { return /^id_/.test(f) && !/\.pub$/.test(f); });
  add({
    key: 'ssh', label: 'SSH 密钥', ok: hasSsh, level: 'info',
    detail: hasSsh ? '已生成（推送可免令牌）' : '没有也行，用 HTTPS + 令牌推送',
    fix: { text: '配 SSH（或直接跳过）', url: 'https://github.com/settings/keys' }
  });

  const hardFails = items.filter(function (i) { return i.level === 'required' && !i.ok; });
  return { ok: hardFails.length === 0, items: items, node: node, git: git };
}

/* ---------------- CLI ---------------- */

function openURL(url) {
  if (!url) return;
  const cmd = process.platform === 'win32'
    ? 'start "" "' + url + '"'
    : process.platform === 'darwin' ? 'open "' + url + '"' : 'xdg-open "' + url + '"';
  exec(cmd, function () {});
}

async function main() {
  const args = process.argv.slice(2);
  const res = await check();

  if (args.includes('--json')) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  const mark = function (i) {
    if (i.level === 'info') return '·';
    return i.ok ? '✓' : '✗';
  };
  console.log('');
  console.log('  洛月 · 环境体检');
  console.log('  ' + '-'.repeat(46));
  res.items.forEach(function (i) {
    console.log('  ' + mark(i) + ' ' + i.label.padEnd(14, ' ') + i.detail);
  });
  console.log('  ' + '-'.repeat(46));

  const fails = res.items.filter(function (i) { return i.level === 'required' && !i.ok; });
  if (!fails.length) {
    console.log('  一切正常，可以开始写了。');
    console.log('');
    return;
  }

  console.log('  有 ' + fails.length + ' 项必须补上：');
  fails.forEach(function (i) {
    console.log('    - ' + i.label + '：' + (i.fix && i.fix.text || ''));
    if (i.fix && i.fix.url) console.log('      ' + i.fix.url);
  });
  console.log('');

  if (args.includes('--open')) {
    const first = fails.find(function (i) { return i.fix && i.fix.url; });
    if (first) openURL(first.fix.url);
  }
}

module.exports = { check };

if (require.main === module) main();
