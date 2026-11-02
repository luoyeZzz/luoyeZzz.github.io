'use strict';
/**
 * 依赖发现（尽量不靠穷举）
 *
 * 查找顺序：
 *   1. tools/config.json 里手动指定的路径
 *   2. 环境变量（GIT_BIN / GIT_PATH）
 *   3. 系统 PATH（Windows: where，其它: which）
 *   4. Windows 注册表 Git for Windows 的 InstallPath
 *   5. 标准安装目录（Program Files / LOCALAPPDATA）
 *   6. 真正的穷举兜底（D:\Git 之类），只作为最后手段
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 6000,
      windowsHide: true
    }).trim();
  } catch (e) {
    return '';
  }
}

function works(bin, versionArgs) {
  if (!bin) return '';
  if (!fs.existsSync(bin) && !/^[a-zA-Z]:\\|^\//.test(bin)) {
    // 不是绝对路径，交给 PATH 去解析
  } else if (!fs.existsSync(bin)) {
    return '';
  }
  const out = run(bin, versionArgs || ['--version']);
  return out;
}

function fromWhich(name) {
  if (process.platform === 'win32') {
    const out = run('where', [name]);
    const first = out.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean)[0];
    return first || '';
  }
  const out = run('which', [name]);
  return out.split(/\r?\n/)[0] || '';
}

function fromRegistry(keyName) {
  if (process.platform !== 'win32') return '';
  const keys = [
    'HKLM\\SOFTWARE\\GitForWindows',
    'HKCU\\SOFTWARE\\GitForWindows',
    'HKLM\\SOFTWARE\\WOW6432Node\\GitForWindows'
  ];
  for (const k of keys) {
    const out = run('reg', ['query', k, '/v', 'InstallPath']);
    const m = out.match(/InstallPath\s+REG_[A-Z_]+\s+(.+)/);
    if (m) {
      const p = path.join(m[1].trim(), 'cmd', 'git.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  return '';
}

function fromStandardDirs() {
  const dirs = [];
  if (process.env.ProgramFiles) dirs.push(path.join(process.env.ProgramFiles, 'Git', 'cmd', 'git.exe'));
  if (process.env['ProgramFiles(x86)']) dirs.push(path.join(process.env['ProgramFiles(x86)'], 'Git', 'cmd', 'git.exe'));
  if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'cmd', 'git.exe'));
  dirs.push('/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git');
  for (const p of dirs) {
    if (p && fs.existsSync(p)) return p;
  }
  return '';
}

function fromLastResort() {
  const dirs = [
    'D:\\Git\\cmd\\git.exe',
    'D:\\Git\\bin\\git.exe',
    'D:\\Git\\mingw64\\bin\\git.exe',
    'C:\\Git\\cmd\\git.exe'
  ];
  for (const p of dirs) {
    if (fs.existsSync(p)) return p;
  }
  return '';
}

function loadConfig(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'tools', 'config.json'), 'utf8'));
  } catch (e) {
    return {};
  }
}

function findGit(root) {
  const cfg = loadConfig(root || path.resolve(__dirname, '..'));
  const tries = [];

  if (cfg.gitPath) {
    tries.push({ source: 'config.json', bin: cfg.gitPath });
  }
  if (process.env.GIT_BIN) tries.push({ source: '环境变量 GIT_BIN', bin: process.env.GIT_BIN });

  const which = fromWhich('git');
  if (which) tries.push({ source: '系统 PATH', bin: which });

  const reg = fromRegistry();
  if (reg) tries.push({ source: 'Windows 注册表', bin: reg });

  const std = fromStandardDirs();
  if (std) tries.push({ source: '标准安装目录', bin: std });

  const last = fromLastResort();
  if (last) tries.push({ source: '常见目录', bin: last });

  // 去重后逐个验证，返回第一个真的能跑的
  const seen = new Set();
  for (const t of tries) {
    if (!t.bin || seen.has(t.bin)) continue;
    seen.add(t.bin);
    const ver = works(t.bin, ['--version']);
    if (ver) return { ok: true, bin: t.bin, version: ver, source: t.source };
  }
  return { ok: false, bin: '', version: '', source: '' };
}

function nodeInfo() {
  const major = Number(process.versions.node.split('.')[0]);
  return {
    ok: major >= 18,
    bin: process.execPath,
    version: 'v' + process.versions.node,
    detail: major >= 18 ? '' : '需要 Node.js 18 或更高'
  };
}

module.exports = { findGit, nodeInfo, fromWhich, works };
