/* 桌面快捷方式：按目标路径识别，不看名字
   CLI：
     node tools/shortcut-check.js --check    只检查
     node tools/shortcut-check.js --create   直接创建
     node tools/shortcut-check.js --never    以后不再提示
     node tools/shortcut-check.js --reset    恢复提示
*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const START_BAT = path.join(ROOT, 'tools', 'start.bat');
const CONFIG = path.join(__dirname, 'config.json');
const ICON_SRC = path.join(ROOT, 'assets', 'img', 'moon.ico');
/* 图标放到没有空格/中文的路径，资源管理器对含空格路径的图标偶尔不认 */
function iconFile() {
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const dir = path.join(base, 'Luoyue');
  try {
    fs.mkdirSync(dir, { recursive: true });
    const dst = path.join(dir, 'icon.ico');
    fs.copyFileSync(ICON_SRC, dst);
    return dst;
  } catch (e) {
    return ICON_SRC;
  }
}
const LNK_NAME = '洛月写作台.lnk';

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')) || {}; } catch (e) { return {}; }
}
function writeConfig(patch) {
  const cfg = readConfig();
  Object.assign(cfg, patch);
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n');
  return cfg;
}
function norm(p) {
  try { return path.resolve(String(p || '')).toLowerCase(); } catch (e) { return ''; }
}

/* 用 PowerShell 读桌面所有 .lnk 的目标（编码成 UTF-16 避免中文路径问题） */
function psRun(script) {
  const full = "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;" + script;
  const buf = Buffer.from(full, 'utf16le');
  const b64 = buf.toString('base64');
  return execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', b64], {
    encoding: 'utf8', timeout: 20000, windowsHide: true
  });
}

function realDesktop() {
  try {
    const out = psRun("$ProgressPreference='SilentlyContinue';[Environment]::GetFolderPath('Desktop')").trim();
    if (out && fs.existsSync(out)) return out;
  } catch (e) {}
  return path.join(os.homedir(), 'Desktop');
}

function desktopDirs() {
  return [realDesktop()].filter(fs.existsSync);
}

function listShortcuts() {
  const script = [
    "$ErrorActionPreference='SilentlyContinue'",
    "$ProgressPreference='SilentlyContinue'",
    "$dirs=@([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'))|?{$_ -and (Test-Path $_)}",
    "$ws=New-Object -ComObject WScript.Shell",
    "$out=@()",
    "foreach($d in $dirs){Get-ChildItem -LiteralPath $d -Filter *.lnk -ErrorAction SilentlyContinue|%{try{",
    "$s=$ws.CreateShortcut($_.FullName);",
    "$out+=[pscustomobject]@{path=$_.FullName;target=$s.TargetPath;args=$s.Arguments;workdir=$s.WorkingDirectory}}catch{}}}",
    "$out|ConvertTo-Json -Compress -Depth 3"
  ].join(';');
  let raw = '';
  try { raw = psRun(script).trim(); } catch (e) { raw = ''; }
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [data];
  } catch (e) { return []; }
}

function matches(entry) {
  if (!entry) return false;
  const target = norm(entry.target);
  const args = String(entry.args || '').toLowerCase();
  const workdir = norm(entry.workdir);
  const bat = norm(START_BAT);
  if (target === bat) return true;
  if (target.endsWith('start.bat') && workdir === norm(ROOT)) return true;
  if (args.indexOf(bat) > -1) return true;
  if (args.indexOf('start.bat') > -1 && workdir === norm(ROOT)) return true;
  return false;
}

function find() {
  const list = listShortcuts();
  const hit = list.filter(matches)[0];
  return hit ? hit : null;
}

function create() {
  const dir = realDesktop();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const lnk = path.join(dir, LNK_NAME);
  const q = function (s) { return String(s).replace(/'/g, "''"); };
  const script = [
    "$ProgressPreference='SilentlyContinue'",
    "$ws=New-Object -ComObject WScript.Shell",
    "$s=$ws.CreateShortcut('" + q(lnk) + "')",
    "$s.TargetPath='" + q(START_BAT) + "'",
    "$s.WorkingDirectory='" + q(ROOT) + "'",
    "$s.IconLocation='" + q(iconFile()) + "'",
    "$s.Description='Luoyue Writer'",
    "$s.Save()",
    "Write-Output 'ok'"
  ].filter(Boolean).join(';');
  try { psRun(script); } catch (e) {}
  const ok = fs.existsSync(lnk);
  const hit = find();
  return { path: ok ? lnk : '', exists: ok || !!hit, found: hit ? hit.path : '' };
}

function status() {
  const cfg = readConfig();
  const hit = find();
  return {
    exists: !!hit,
    path: hit ? hit.path : '',
    target: hit ? hit.target : '',
    suppressed: cfg.shortcutPrompt === false,
    startBat: START_BAT,
    icon: fs.existsSync(ICON_SRC) ? '/assets/img/moon.ico' : ''
  };
}

function suppress() {
  writeConfig({ shortcutPrompt: false });
  return status();
}
function reset() {
  writeConfig({ shortcutPrompt: true });
  return status();
}

module.exports = { status, create, suppress, reset, find, listShortcuts };

if (require.main === module) {
  const arg = process.argv[2] || '--check';
  if (arg === '--create') console.log(JSON.stringify(create()));
  else if (arg === '--never') console.log(JSON.stringify(suppress()));
  else if (arg === '--reset') console.log(JSON.stringify(reset()));
  else if (arg === '--list') console.log(JSON.stringify(listShortcuts(), null, 2));
  else console.log(JSON.stringify(status(), null, 2));
}
