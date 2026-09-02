/**
 * 验证台的静态服务。
 *
 * 根 `dev` 脚本原先是 `pnpm --filter www dev`，但 **apps/www 没有 dev 脚本** ——
 * 文档站是 Phase 6，还没开始建，所以那条命令从写下起就跑不起来
 * （ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT）。
 *
 * 现在能看的东西是 `apps/www/dev/` 下的几个验证台：静态 HTML + esbuild 产物。
 * 它们引用了 `../../../packages/glass-core/src/tokens/theme.css`，
 * **服务根必须是仓库根**，不能是 apps/www。
 *
 * Phase 6 真正建起文档站之后，`dev` 应当改回指向 Next.js，本文件届时可以删掉。
 *
 * 用法：node scripts/serve-dev.mjs [port]
 */

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, normalize, resolve, extname } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const HARNESS_DIR = join(ROOT, 'apps', 'www', 'dev');
const PORT = Number(process.argv[2] ?? 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

/**
 * 各验证台的说明与顺序。**列表顺序就是页面顺序** ——
 * 组件验证台在前、一次性的调参页在后；按文件名排会把它们混在一起。
 */
const HARNESSES = [
  ['tabs-demo.html', 'Tabs / Segmented —— Layer B 底座 + Layer I 指示器 + 挖洞'],
  ['controls-demo.html', 'Slider / Switch —— knob 的折射与开关的挖洞'],
  ['button-demo.html', 'Button —— 四个变体；按住能看到升级为 Layer I'],
  ['dialog-demo.html', 'Dialog / Alert —— 面板层（没有 Layer I）；?open=1 直接打开'],
  ['card-demo.html', 'Card —— 分组列表区块；内容层，没有玻璃。?bg=grouped 是它真正的场景'],
  ['sheet-demo.html', 'Sheet / Drawer —— 档位、抓手、甩动关闭、背后页面层叠后退。?open=1 直接打开'],
  ['overlay-demo.html', 'Popover / ResponsiveOverlay —— 窄到 768 以下会自动换成底部 Drawer'],
  ['select-demo.html', 'Select —— 下拉选择；选中项有对勾，高亮项是 Layer I。?only=long 看滚动'],
  ['fidelity.html', 'Fidelity 对照 —— Apple 参考图 vs 本库组件，1:1 并排'],
  ['sweep.html', '（调试）折射参数扫描'],
  ['ab.html', '（调试）A/B 对照'],
];

const QUERY_HELP = [
  ['theme', 'light | dark'],
  ['tier', 'a | b | c —— 三条渲染路径'],
  ['tint', '0 – 1 —— 材质档位，连续插值'],
  ['bg', 'stripes —— 换成 6px 黑白条纹（高频最坏情况，很多问题只在这上面现形）'],
  ['only', '各验证台不同，见源码；用来把快照隔离到单个组件'],
];

async function indexPage() {
  const present = new Set((await readdir(HARNESS_DIR)).filter((f) => f.endsWith('.html')));
  // 已登记的按 HARNESSES 的顺序排；将来新增而还没登记的，追加在末尾
  const known = HARNESSES.filter(([f]) => present.has(f));
  const extra = [...present]
    .filter((f) => !HARNESSES.some(([k]) => k === f))
    .sort()
    .map((f) => [f, '']);

  const rows = [...known, ...extra]
    .map(([f, note]) => `<li><a href="/apps/www/dev/${f}">${f}</a><span>${note}</span></li>`)
    .join('\n');

  const params = QUERY_HELP.map(([k, v]) => `<tr><td><code>${k}</code></td><td>${v}</td></tr>`).join(
    '\n',
  );

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>Liquid Glass UI · 验证台</title>
<style>
  body{margin:0;padding:40px;background:#f2f2f7;color:#1c1c1e;
       font:15px/1.6 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
  main{max-width:720px;margin:0 auto}
  h1{font-size:20px;margin:0 0 4px}
  p.sub{margin:0 0 28px;color:#8e8e93;font-size:13px}
  ul{list-style:none;padding:0;margin:0 0 32px}
  li{display:flex;gap:16px;align-items:baseline;padding:10px 14px;background:#fff;
     border-radius:10px;margin-bottom:8px}
  li a{font-weight:600;color:#0071eb;text-decoration:none;min-width:190px}
  li a:hover{text-decoration:underline}
  li span{color:#8e8e93;font-size:13px}
  table{border-collapse:collapse;font-size:13px;background:#fff;border-radius:10px;overflow:hidden}
  td{padding:8px 14px;border-bottom:1px solid #e5e5ea;vertical-align:top}
  tr:last-child td{border-bottom:0}
  td:first-child{white-space:nowrap;color:#3c3c43}
  code{font:12px ui-monospace,Menlo,Consolas,monospace;background:#f2f2f7;padding:1px 5px;border-radius:4px}
  .warn{margin-top:28px;font-size:13px;color:#3c3c43;border-left:3px solid #c7c7cc;padding-left:12px}
</style></head>
<body><main>
  <h1>Liquid Glass UI · 验证台</h1>
  <p class="sub">这不是文档站（文档站是 Phase 6）。这里是给 Playwright 和肉眼做像素判定用的页面。</p>
  <ul>${rows}</ul>
  <h1 style="font-size:15px">通用查询参数</h1>
  <p class="sub">拼在 URL 后面，例如 <code>button-demo.html?theme=dark&amp;tier=b&amp;bg=stripes</code></p>
  <table>${params}</table>
  <div class="warn">
    页面里的 <code>.js</code> 是 esbuild 产物，<strong>不入库</strong>。改了组件源码要重新跑
    <code>pnpm --filter www dev:build</code>（<code>pnpm dev</code> 会先跑一遍）。
  </div>
</main></body></html>`;
}

createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (err) {
    // 处理器里抛异常会让整个进程退出，dev server 就这么被一个笔误带走过一次。
    // 兜住它，报 500，服务继续活着。
    console.error('[serve-dev] 请求处理出错：', err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': MIME['.html'] });
    res.end(`<pre>500\n${String(err && err.stack ? err.stack : err)}</pre>`);
  }
}).listen(PORT, () => {
  console.log(`验证台已启动 → http://localhost:${PORT}/`);
});

async function handle(req, res) {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    res.end(await indexPage());
    return;
  }

  // 归一化并禁止跳出仓库根
  const rel = normalize(pathname).replace(/^([/\\])+/, '');
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': MIME['.html'] }).end(
      `<p>404 —— <a href="/">回到验证台列表</a></p>`,
    );
  }
}
