/**
 * 线上站点的冒烟检查 —— 对**已经部署好的** GitHub Pages 跑，不是对本地产物。
 *
 * ── 为什么本地那些检查不够 ────────────────────────────────────────────
 *
 * 构建期已经有两道闸：`check-export-links.mjs` 扫产物里的绝对路径，
 * `registry-lint.mjs` 逐字核对 registry 产物。它们看的都是**磁盘上的文件**。
 *
 * 但「文件是对的」和「站点是活的」之间还隔着托管层，而托管层有自己的坑：
 *
 *   1. GitHub Pages 默认过一遍 Jekyll，**Jekyll 会丢掉所有 `_` 开头的目录**。
 *      Next 的资源全在 `_next/` 下 —— 少一个 `.nojekyll`，
 *      HTML 照样 200、页面照样返回，只是**没有样式也没有脚本**。
 *      构建产物里那个文件是好的，本地测试也全绿。
 *   2. registry 产物取不到。§0.80 里那 8 个组件就是「入库了但没发布」，
 *      在本地一切正常，只有真的去取才发现不存在。
 *
 * 所以这里只测**本地测不出来的那部分**，不重复构建期已经查过的东西。
 *
 * 用法：node scripts/smoke-pages.mjs https://createagle.github.io/liquid-glass-shadcn
 */

const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!base) {
  console.error('用法：node scripts/smoke-pages.mjs <站点地址>');
  process.exit(2);
}

let failed = 0;
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  failed += 1;
};

/**
 * Pages 刚部署完可能有几秒不可用，重试几次再判死。
 *
 * ⚠️ **连不上（DNS 挂了、域名不存在）不能 throw。**
 * 第一版是 `throw last`，结果探针一跑就炸：把安装页改成
 * `https://liquid-glass-ui.dev/…`（那个域名真的不存在）之后，
 * 脚本抛了个栈就没了 —— 退出码确实非零，但**没有任何一条说明是哪儿坏了**，
 * 而且后面的检查一条都没跑。
 *
 * 而「域名不存在」恰恰是这个脚本最该说清楚的一种失败：
 * 安装页此前登的就是那个地址。所以连不上要返回一个 response 形状的东西，
 * 让调用方走正常的 fail() 路径。
 */
async function get(url, { tries = 5, delay = 3000 } = {}) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.status !== 404 || i === tries - 1) return res;
      last = res;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  if (last instanceof Error) {
    return {
      ok: false,
      status: 0,
      networkError: last.message,
      headers: new Headers(),
      text: async () => '',
      json: async () => null,
    };
  }
  return last;
}

/** 状态码 0 表示压根没连上 —— 那时候光打印 "0" 没有任何信息量 */
const why = (res) => (res.status === 0 ? `连不上（${res.networkError}）` : `${res.status}`);

/* ── 1. 页面活着，而且渲染出了东西 ─────────────────────────────────── */
const PAGES = [
  ['/', 'Liquid Glass UI'],
  ['/docs/', '安装'],
  ['/docs/installation/', 'components.json'],
  ['/docs/materials/', 'Materials'],
  ['/docs/components/button/', 'Button'],
  ['/docs/components/sidebar/', 'Sidebar'],
  ['/view/tabs-demo/', '<div'],
];

for (const [path, marker] of PAGES) {
  const res = await get(base + path);
  if (!res.ok) {
    fail(`${path} 返回 ${why(res)}`);
    continue;
  }
  const html = await res.text();
  if (!html.includes(marker)) {
    fail(`${path} 取到了，但正文里找不到 ${JSON.stringify(marker)} —— 页面是空的？`);
  }
}

/* ── 2. `_next/` 资源真的能取 ──────────────────────────────────────────
   这是 .nojekyll 那一条**唯一**能被发现的地方：少了它，HTML 全是 200，
   只是没样式没脚本 —— 光看状态码看不出来。 */
{
  const home = await get(base + '/');
  const html = await home.text();
  const assets = [...html.matchAll(/(?:href|src)="([^"]*\/_next\/[^"]+)"/g)].map((m) => m[1]);
  const css = assets.find((a) => a.endsWith('.css'));
  const js = assets.find((a) => a.endsWith('.js'));
  if (!css && !js) {
    fail('首页 HTML 里一个 _next/ 资源都没引 —— 构建方式变了？这条检查已经失效');
  }
  for (const asset of [css, js].filter(Boolean)) {
    const url = asset.startsWith('http') ? asset : new URL(asset, base).href;
    const res = await get(url);
    if (!res.ok) {
      fail(`_next 资源 ${asset} 返回 ${why(res)} —— .nojekyll 是不是丢了？`);
    } else if (/text\/html/.test(res.headers.get('content-type') ?? '')) {
      fail(`_next 资源 ${asset} 返回的是 HTML（多半是 404 页面）`);
    }
  }
}

/* ── 3. registry 的每一个 item 都真的取得到 ────────────────────────────
   §0.80：8 个组件「入库了但没发布」，本地一切正常，只有真去取才知道。 */
{
  const res = await get(`${base}/r/registry.json`);
  if (!res.ok) {
    fail(`/r/registry.json 返回 ${why(res)}`);
  } else {
    const index = await res.json();
    const items = index.items ?? [];
    if (items.length === 0) fail('/r/registry.json 里一个 item 都没有');
    let checked = 0;
    for (const item of items) {
      const one = await get(`${base}/r/${item.name}.json`);
      if (!one.ok) {
        fail(`/r/${item.name}.json 返回 ${why(one)} —— 索引里有，取不到`);
        continue;
      }
      const body = await one.json();
      const files = body.files ?? [];
      // theme item 没有 files（它是 cssVars），其余都必须带上源码
      if (item.name !== 'theme' && files.length === 0) {
        fail(`/r/${item.name}.json 里没有 files —— 装下来会是个空壳`);
      }
      for (const f of files) {
        if (!f.content) fail(`/r/${item.name}.json 的 ${f.path} 没有 content`);
      }
      checked += 1;
    }
    console.log(`  registry：索引 ${items.length} 个 item，逐个取到 ${checked} 个`);
  }
}

/* ── 4. 安装页登的 registry 地址，必须真的能取 ─────────────────────────
   这一条是**踩过才加的**：安装页此前登的是 https://liquid-glass-ui.dev/…，
   那个域名根本不存在，而文档站本身照样全绿 ——
   在「照着做」的文档里写一个取不到的地址，比写「还没有」更糟。

   刻意**不**断言它等于 base：站点将来换地址（自定义域名、换仓库）时
   这条不该跟着改。它要守的是「登出去的地址是活的」，不是「是某个字面值」。 */
{
  const res = await get(base + '/docs/installation/');
  const html = await res.text();
  const m = html.match(/https?:\/\/[^ "&<>]+\/r\/\{name\}\.json/);
  if (!m) {
    fail('安装页里找不到形如 …/r/{name}.json 的 registry 地址 —— 那一步的说明变了？');
  } else {
    const probe = m[0].replace('{name}', 'button');
    const one = await get(probe);
    if (!one.ok) {
      fail(`安装页登的 registry 地址取不到：${probe} 返回 ${why(one)}`);
    } else {
      const body = await one.json().catch(() => null);
      if (!body?.files?.length) fail(`${probe} 取到了，但不是一个像样的 registry item`);
      else console.log(`  安装页登的地址活着：${m[0]}`);
    }
  }
}

if (failed) {
  console.error(`\n✗ 线上冒烟检查未通过：${failed} 处（${base}）`);
  process.exit(1);
}
console.log(`✓ 线上冒烟检查通过（${base}）`);
