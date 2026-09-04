/**
 * 文档站 —— PROJECT_SPEC §12 / Phase 6 任务卡的验收。
 *
 * 跑法：`pnpm test:docs`（会先 `next build` 再 `next start`，测的是**生产构建**）。
 *
 * 这一份盯的是四件在别处测不到的事：
 *   1. **顶栏三个全局控件真的影响全站**（任务卡的验收原文）
 *   2. **首屏不闪** —— 而且是按「第一次绘制之前」来判，不是加载完了再看
 *   3. **Code 那一半与磁盘上的示例文件逐字相同** —— 这是 Preview/Code 模式的全部意义
 *   4. **API 表确实是生成的**，且每个尺寸常量都带可信度标注
 */

import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = (page: Page) => page.locator('html');

/* ── 全局控件（任务卡验收：「顶栏三个全局控件生效并影响全站」）────────── */

test.describe('顶栏三个全局控件', () => {
  test('明暗切换改的是 <html> 上的主题属性，且落盘', async ({ page }) => {
    await page.goto('/');
    const before = await html(page).getAttribute('data-glass-theme');
    await page.getByRole('switch', { name: '切换暗色模式' }).click();
    await expect(html(page)).not.toHaveAttribute('data-glass-theme', before!);
    // 刷新之后仍然是切过去的那个 —— 说明写进了 localStorage
    const after = await html(page).getAttribute('data-glass-theme');
    await page.reload();
    await expect(html(page)).toHaveAttribute('data-glass-theme', after!);
  });

  test('材质滑杆改 --lg-tint，且底座的 alpha 真的跟着变', async ({ page }) => {
    await page.goto('/');
    const alphaOf = () =>
      page.evaluate(() => {
        const el = document.querySelector('.lg-surface[data-layer="base"]') as HTMLElement;
        return getComputedStyle(el).backgroundColor;
      });
    const slider = page.getByRole('slider', { name: '材质档位' });
    await slider.focus();
    // 只查变量会漏掉「变量改了但绘制没跟上」那一类坑（semantic.css 里为此重写过一整套）
    const dim = await alphaOf();
    for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    expect(await alphaOf()).not.toBe(dim);
    const tint = await html(page).getAttribute('data-glass-tint');
    expect(Number(tint)).toBeGreaterThan(0);
  });

  test('Tier 强制切换改 data-glass-tier，且 C 档下折射真的没了', async ({ page }) => {
    await page.goto('/docs/components/select');
    await page.getByRole('tab', { name: 'C', exact: true }).click();
    await expect(html(page)).toHaveAttribute('data-glass-tier', 'c');
    const filter = await page.evaluate(() => {
      const el = document.querySelector('.lg-surface[data-layer="base"]') as HTMLElement;
      return getComputedStyle(el).backdropFilter;
    });
    // Tier C 是实色路径 —— 不允许有任何 backdrop-filter
    expect(filter).toBe('none');
    await page.getByRole('tab', { name: '自动' }).click();
    await expect(html(page)).not.toHaveAttribute('data-glass-tier', 'c');
  });
});

/* ── 首屏不闪 ────────────────────────────────────────────────────────── */

test('暗色首屏不闪 —— 内联脚本在 <head> 里，且真的生效', async ({ page, request }) => {
  /**
   * 拆成两个确定性的断言，合起来就是「不会闪」：
   *
   *   1. 那段内联脚本出现在 `<head>` 里、在 `<body>` 之前。
   *      它是**同步**脚本，浏览器不可能在执行它之前绘制 body 里的内容 ——
   *      这一半是文档结构的静态性质，不依赖任何时序。
   *   2. 存了 `lg:theme=dark` 之后，页面确实是暗色的（属性 + class 都对）。
   *
   * ⚠️ 试过更"直接"的写法：在第一个 rAF 里、或在 body 被插入时读属性。
   *    两种都**偶发失败** —— 前者 rAF 可能在文档还没解析到 <head> 时就烧掉一帧，
   *    后者 addInitScript 跑得比 documentElement 还早，观察器根本装不上。
   *    那些是测试的时序假设不成立，不是产品的问题；换成上面这对断言。
   */
  const html = await (await request.get('/')).text();
  const scriptAt = html.indexOf('lg:theme');
  const headEnd = html.indexOf('</head>');
  const bodyAt = html.indexOf('<body');
  expect(scriptAt, '页面里应当有那段防闪烁脚本').toBeGreaterThan(0);
  expect(scriptAt, '脚本必须在 </head> 之前').toBeLessThan(headEnd);
  expect(headEnd, '<head> 必须在 <body> 之前结束').toBeLessThan(bodyAt);

  await page.addInitScript(() => {
    try {
      localStorage.setItem('lg:theme', 'dark');
    } catch {
      /* 隐私模式：忽略 */
    }
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-glass-theme', 'dark');
  await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
});

/* ── Preview / Code ──────────────────────────────────────────────────── */

test('Code 那一半与磁盘上的示例文件逐字相同', async ({ page }) => {
  /**
   * Preview/Code 模式唯一的意义就是「你看到的和你复制走的是同一份」。
   * 手写一份说明文档、渲染另一份代码，是这个模式最常见的退化方式。
   */
  await page.goto('/docs/components/button');
  // 组件页上不止一个 ComponentPreview（「预览」区 + 「示例」区），限定到第一个
  const preview = page.locator('#preview');
  await preview.getByRole('tab', { name: '代码' }).click();
  const shown = (await preview.locator('pre code').first().innerText()).trim();
  const onDisk = readFileSync(
    resolve('apps/www/registry/glass/examples/button-variants.tsx'),
    'utf8',
  ).trim();
  expect(shown).toBe(onDisk);
});

test('Preview 里渲染的是真组件，不是截图', async ({ page }) => {
  await page.goto('/docs/components/button');
  // 限定在「预览」小节里的活动面板 —— 页面上还有安装命令那一组 Tabs，
  // 它的代码块里也有一个复制按钮（本库的 Button）
  const buttons = page.locator(
    '#preview [data-slot="tabs-content"][data-state="active"] [data-slot="button"]',
  );
  await expect(buttons).toHaveCount(5);
  // 真组件才会有材质层
  await expect(buttons.first().locator('.lg-surface')).toHaveCount(1);
});

/* ── API 表是生成的 ─────────────────────────────────────────────────── */

test.describe('API Reference', () => {
  test('props 表来自 TS 类型（含默认值与继承说明）', async ({ page }) => {
    await page.goto('/docs/components/button');
    const api = page.locator('#api');
    await expect(api).toContainText('GlassButtonProps');
    await expect(api).toContainText('variant');
    // 默认值是从组件函数的解构参数里读的，不是手写的
    await expect(api).toContainText("'glass'");
    // 继承不摊平，写成一行人话
    await expect(api).toContainText('继承 <button> 的原生属性');
  });

  test('尺寸常量表**每一行**都带可信度标注', async ({ page }) => {
    /**
     * 这是本库的核心纪律：数字必须能说出出处（PROJECT_SPEC §15）。
     * 生成脚本会统计「没有标注的常量」，这里把它钉成 0。
     */
    await page.goto('/docs/components/select');
    const rows = page.locator('#geometry tbody tr');
    const n = await rows.count();
    expect(n).toBeGreaterThan(10);
    for (let i = 0; i < n; i++) {
      const badges = rows.nth(i).locator('span', { hasText: /^(官方|实测|推定|待核实)$/ });
      await expect(badges.first(), `第 ${i + 1} 行缺可信度标注`).toBeVisible();
    }
  });

  test('APPLE REFERENCE 是从源码文件头搬过来的', async ({ page }) => {
    await page.goto('/docs/components/select');
    await expect(page.locator('#apple-reference')).toContainText('APPLE REFERENCE');
    await expect(page.locator('#apple-reference')).toContainText('SwiftUI `Picker`');
  });
});

/* ── 站点结构 ────────────────────────────────────────────────────────── */

test('每个 registry 组件都有文档页入口', async ({ page }) => {
  /**
   * 侧栏是从 registry.json 生成的，所以这条真正防的是反过来的漏洞：
   * 组件发了、页面 404。逐个点开太慢，这里只验清单一致 + 抽查一页能开。
   */
  const registry = JSON.parse(readFileSync(resolve('apps/www/registry.json'), 'utf8')) as {
    items: { name: string; type: string; title: string }[];
  };
  const ui = registry.items.filter((i) => i.type === 'registry:ui');
  await page.goto('/docs');
  for (const item of ui) {
    await expect(
      page.getByRole('link', { name: item.title, exact: true }),
      `侧栏缺少 ${item.name}`,
    ).toHaveCount(1);
  }
});

test('/view/[name] 没有站点装饰 —— 截图与 iframe 用的就是它', async ({ page }) => {
  await page.goto('/view/select-demo');
  await expect(page.locator('[data-slot="select-trigger"]')).toHaveCount(1);
  await expect(page.locator('header')).toHaveCount(0);
  await expect(page.locator('nav')).toHaveCount(0);
});


/* ── Fidelity（PROJECT_SPEC §12 里标着「本库独有」的那一节）───────────── */

test.describe('Fidelity 对照', () => {
  test('有对照图的组件：图 + 差异说明都在，且说明与 fidelity.html 同源', async ({ page }) => {
    await page.goto('/docs/components/tabs');
    const fid = page.locator('#fidelity');
    await expect(fid.locator('img')).toHaveCount(1);
    await expect(fid.locator('img')).toHaveAttribute('src', /compare-tabs-cols\.png$/);
    // 差异说明是从 dev/fidelity.html 的 .note 抽出来的，不是页面另写的
    const html = readFileSync(resolve('apps/www/dev/fidelity.html'), 'utf8');
    expect(html, '这句话应当来自 fidelity.html').toContain('Search 独立胶囊');
    await expect(fid).toContainText('Search 独立胶囊');
    await expect(fid).toContainText('至今没做');
  });

  test('页面上必须先声明「左边不是真机截图」', async ({ page }) => {
    /**
     * 这不是免责声明，是这一整节该怎么读的前提：
     * Figma 静态稿画不出折射与色散，所以材质本来就不可比。
     * 少了这句话，读者会把「右边有色散、左边没有」当成还原度问题。
     */
    await page.goto('/docs/components/switch');
    await expect(page.locator('#fidelity')).toContainText('不是真机截图');
  });

  test('没有对照图的组件：说清楚为什么，不是「暂无」', async ({ page }) => {
    for (const [slug, phrase] of [
      ['toggle', '没有属于 Toggle 自己的 Apple 参考图'],
      ['popover', '轮廓拟合不收敛'],
      ['select', '参考图里没有任何带选中态的菜单'],
      ['responsive-overlay', '行为原语'],
    ] as const) {
      await page.goto('/docs/components/' + slug);
      await expect(page.locator('#fidelity'), slug).toContainText(phrase);
      await expect(page.locator('#fidelity'), slug + ' 不该出现敷衍文案').not.toContainText('暂无');
    }
  });
});

/* ── Examples ────────────────────────────────────────────────────────── */

test('每个组件都不止一个示例（§14 的 Examples 那一条）', async ({ page }) => {
  const registry = JSON.parse(readFileSync(resolve('apps/www/registry.json'), 'utf8')) as {
    items: { name: string; type: string }[];
  };
  const ui = registry.items.filter((i) => i.type === 'registry:ui');
  for (const item of ui) {
    await page.goto('/docs/components/' + item.name);
    await expect(page.locator('#preview'), item.name).toHaveCount(1);
    await expect(
      page.locator('#examples [data-slot="tabs"]'),
      item.name + ' 缺第二个示例',
    ).not.toHaveCount(0);
  }
});

/* ── ⌘K ──────────────────────────────────────────────────────────────── */

test.describe('⌘K 命令面板', () => {
  test('Ctrl/⌘+K 打开，输入能过滤，↵ 跳转', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    const input = page.getByRole('combobox', { name: '搜索组件与文档' });
    await expect(input).toBeFocused();
    await input.fill('select');
    const options = page.getByRole('option');
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText('Select');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/docs\/components\/select$/);
  });

  test('面板是本库的 Dialog + Card 搭的（§12：搜索面板也要吃自己的狗粮）', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-command-palette]')).toHaveCount(1);
    // 面板本体是 Dialog 的 elevated 材质
    await expect(
      page.locator('[data-slot="dialog-content"] .lg-surface[data-layer="elevated"]'),
    ).toHaveCount(1);
    // 高亮项是 Layer I —— 与菜单项同一层材质
    await expect(
      page.locator('[role="option"] .lg-surface[data-layer="indicator"]').first(),
    ).toHaveCount(1);
  });

  test('Esc 关闭', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-command-palette]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-command-palette]')).toHaveCount(0);
  });

  test('如实说明搜索能力的边界', async ({ page }) => {
    // 「像全文搜索」是这类面板最容易造成的误解，面板底部必须写清楚
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-command-palette]')).toContainText('不是全文搜索');
  });
});


/* ── Materials / Optics（任务卡点名的两页分水岭）──────────────────────── */

test.describe('Materials / Optics', () => {
  test('两页都在，且在侧栏与 ⌘K 里都能找到', async ({ page }) => {
    await page.goto('/docs');
    for (const label of ['Materials', 'Optics']) {
      await expect(page.getByRole('link', { name: label, exact: true })).toHaveCount(1);
    }
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: '搜索组件与文档' }).fill('optics');
    await expect(page.getByRole('option')).toContainText(['Optics']);
  });

  test('Materials：演示是活的 —— 分层对照 / 挖洞开关 / α 滑杆', async ({ page }) => {
    await page.goto('/docs/materials');
    // 分层对照：同一块背景上两种材质
    const layers = page.locator('#two-layers .lg-surface[data-layer]');
    await expect(layers.filter({ has: page.locator('xpath=.') })).not.toHaveCount(0);
    await expect(page.locator('#two-layers .lg-surface[data-layer="base"]').first()).toHaveCount(1);
    await expect(
      page.locator('#two-layers .lg-surface[data-layer="indicator"]').first(),
    ).toHaveCount(1);
    /**
     * 挖洞开关：关掉之后底座上不该再有洞。
     * ⚠️ 必须限定到演示自己的舞台 —— 这一节里还有 Tabs（背景切换）与 Switch（开关），
     * 它们各自也会挖洞，只按 [data-punched] 找会一次找到三个。
     */
    const punchLayer = page.locator('[data-lab="punch-stage"] .lg-surface[data-punched="true"]');
    await expect(punchLayer).toHaveCount(1);
    await page.locator('#punch').getByRole('switch', { name: '挖洞' }).click();
    await expect(punchLayer).toHaveCount(0);
  });

  test('Materials：α 滑杆拉到 0 时明确报「不过 AA」', async ({ page }) => {
    /**
     * 这一页的核心论断是「α 归零 = 保证消失」。
     * 演示如果算不出这个结论，整节就白写了。
     */
    await page.goto('/docs/materials');
    // 原生 range 上 fill() 不触发 React 的 onChange，得自己派发 input 事件
    const setAlpha = (v: string) =>
      page.locator('#alpha input[type=range]').evaluate((el, value) => {
        const input = el as HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )!.set!;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, v);
    await setAlpha('0');
    await expect(page.locator('#alpha')).toContainText('不过 AA');
    await setAlpha('1');
    await expect(page.locator('#alpha')).toContainText('过 WCAG AA');
  });

  test('Optics：三档同屏渲染，而且**真的不一样**', async ({ page }) => {
    /**
     * 第一版这三格长得一模一样 —— 祖先加了 data-glass-tier，
     * 但 Tier A 的折射是 JS 注入的内联样式，优先级高于任何 CSS。
     * 这条断言钉住三档的 backdrop-filter 互不相同。
     */
    await page.goto('/docs/optics');
    const read = (t: string) =>
      page.evaluate(
        (tier) =>
          getComputedStyle(
            document.querySelector(
              '#tiers div[data-glass-tier="' + tier + '"] .lg-surface[data-layer="indicator"]',
            )!,
          ).backdropFilter,
        t,
      );
    // 折射滤镜是量完尺寸之后异步创建的，等它就绪再断言
    await expect.poll(() => read('a'), { timeout: 5000 }).toContain('url(');
    const [a, b, c] = [await read('a'), await read('b'), await read('c')];
    expect(a, 'Tier A 必须是真折射').toContain('url(');
    expect(b, 'Tier B 是微模糊，不是折射').toContain('blur(1px)');
    expect(b).not.toContain('url(');
    expect(c, 'Tier C 完全没有 backdrop-filter').toBe('none');
  });

  test('Tier B 的 backdrop-filter 没有被压缩器吃掉', async ({ page }) => {
    /**
     * 回归测试，钉的是一个**真的上线过**的缺陷：
     *
     * optics.css 原先把 「backdrop-filter」 写在 「-webkit-backdrop-filter」 **前面**。
     * Lightning CSS（Next 的 CSS 管线）看得懂两者是同一个属性，遇到手写的一对
     * 只保留后面那条 —— 打包产物里于是只剩 「-webkit-」 版本，
     * 而 Chromium 不把它当标准属性的别名，Tier B 的指示器规则**根本没生效**。
     *
     * 验证台用的是未压缩的 CSS，所以视觉快照一直是对的；
     * 只有走真实构建管线才会现形。这正是「本机看不出来、装到别人工程里才炸」那一类。
     */
    await page.goto('/docs/optics');
    const decls = await page.evaluate(() => {
      const out: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue; // 跨域样式表读不到，跳过
        }
        for (const rule of Array.from(rules)) {
          // CSSOM 会不会给属性值加引号取决于浏览器，统一去掉再比
          const text = ((rule as CSSStyleRule).selectorText ?? '').replace(/["']/g, '');
          if (text.includes('[data-glass-tier=b] .lg-surface[data-layer=indicator]')) {
            out.push((rule as CSSStyleRule).style.getPropertyValue('backdrop-filter'));
          }
        }
      }
      return out;
    });
    expect(decls.length, '应当能找到 Tier B 的指示器规则').toBeGreaterThan(0);
    expect(decls.some((d) => d.includes('blur(1px)')), '标准属性必须还在').toBe(true);
  });

  test('Optics 必须写清楚「光学至今没有真机基准」', async ({ page }) => {
    // 一个讲光学的页面如果不写这件事，就是在拿推定值冒充实测值
    await page.goto('/docs/optics');
    await expect(page.locator('#no-baseline')).toContainText('没有真机基准');
    await expect(page.locator('#no-baseline')).toContainText('全是 [推定]');
  });
});


/* ── 首页 Hero（任务卡第 5 项）────────────────────────────────────────── */

/** 把手机切到某个 tab。 */
async function heroTab(page: import('@playwright/test').Page, label: string) {
  await page.locator('[data-hero-phone] [role=tab]', { hasText: label }).click();
  await expect(page.locator('[data-hero-phone] h3')).toHaveText(label);
}

test.describe('首页 Hero', () => {
  test('三个 tab 都是活的，切换后内容真的换了', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-hero-phone]')).toHaveCount(1);
    await expect(page.locator('[data-hero-phone] h3')).toHaveText('资料库');

    await heroTab(page, '设置');
    await expect(page.locator('[data-hero-phone] [role=switch]')).toHaveCount(2);

    await heroTab(page, '相册');
    await expect(page.locator('[data-hero-photos] > div')).toHaveCount(27);

    await heroTab(page, '资料库');
    await expect(page.locator('[data-hero-grid] > div')).toHaveCount(8);
  });

  test('分段控件真的在过滤，不是换个高亮', async ({ page }) => {
    await page.goto('/');
    const grid = page.locator('[data-hero-grid] > div');
    await expect(grid).toHaveCount(8);
    // 「专辑」5 条、「艺人」3 条 —— 数字来自 hero-phone.tsx 的 ITEMS
    await page.locator('[data-hero-phone] [role=tab]', { hasText: '专辑' }).click();
    await expect(grid).toHaveCount(5);
    await page.locator('[data-hero-phone] [role=tab]', { hasText: '艺人' }).click();
    await expect(grid).toHaveCount(3);
  });

  test('亮度滑杆真的把屏幕压暗；大字体开关真的改字号', async ({ page }) => {
    await page.goto('/');
    await heroTab(page, '设置');

    const dim = page.locator('[data-hero-dim]');
    const before = await dim.evaluate((e) => +getComputedStyle(e).opacity);
    // Radix 的 role=slider 在 Thumb 上，键盘能直接操作 —— 比拖动稳定
    const slider = page.getByRole('slider', { name: '亮度' });
    await slider.focus();
    for (let i = 0; i < 10; i++) await slider.press('ArrowLeft');
    const after = await dim.evaluate((e) => +getComputedStyle(e).opacity);
    expect(after, '亮度调低 → 遮罩变浓').toBeGreaterThan(before);

    const fontOf = () =>
      page.locator('[data-hero-phone]').evaluate((e) => getComputedStyle(e).fontSize);
    expect(await fontOf()).toBe('17px');
    await page.getByRole('switch', { name: '大字体' }).click();
    expect(await fontOf()).toBe('19px');
  });

  test('滚动边缘效果：内容滚到栏底下才出现，滚到底就退场', async ({ page }) => {
    /**
     * PROJECT_SPEC §13 里唯一一条**此前完全没实现**的要求。
     * 方向按 Apple —— 模糊并压暗**背后的内容**、栏自身不变，
     * 而不是 SPEC 字面写的「栏底自动增加不透明度」。
     */
    await page.goto('/');
    const top = page.locator('[data-hero-phone] [data-glass-scroll-edge=top]');
    const bottom = page.locator('[data-hero-phone] [data-glass-scroll-edge=bottom]');
    const progress = (l: typeof top) => l.evaluate((e) => +getComputedStyle(e).opacity);

    // 起始：没有任何内容钻到顶栏底下，顶部那条必须彻底不存在
    expect(await progress(top)).toBe(0);
    expect(await progress(bottom), '底下还有内容 → 底部那条在').toBeGreaterThan(0);

    const scroller = page.locator('[data-hero-scroll]');
    await scroller.evaluate((e) => {
      e.scrollTop = 40;
    });
    await expect.poll(() => progress(top)).toBe(1);

    await scroller.evaluate((e) => {
      e.scrollTop = e.scrollHeight;
    });
    await expect.poll(() => progress(bottom), { message: '滚到底 → 底部那条退场' }).toBe(0);
  });

  test('内容真的能滚到悬浮 Tab Bar 底下', async ({ page }) => {
    // 玻璃的正题就是这个 —— 栏底下没有东西流过，材质就没有存在的理由
    await page.goto('/');
    // ⚠️ 手机里有**两个** tablist（Tab Bar 和分段），而分段在 DOM 里排在前面。
    //    按 role 取第一个会取到分段 —— 必须用内容认人。
    const bar = (await page
      .locator('[data-hero-phone] [role=tablist]')
      .filter({ hasText: '相册' })
      .boundingBox())!;
    const scroller = (await page.locator('[data-hero-scroll]').boundingBox())!;
    expect(bar.y + bar.height, 'Tab Bar 落在滚动容器的范围之内').toBeLessThan(
      scroller.y + scroller.height,
    );
    const scrollable = await page
      .locator('[data-hero-scroll]')
      .evaluate((e) => e.scrollHeight - e.clientHeight);
    expect(scrollable, '内容必须比一屏长').toBeGreaterThan(100);
  });

  test('§5.2 的同屏折射预算没被顶穿', async ({ page }) => {
    /**
     * 红线是 8 个活跃折射实例（该数字本身是 [推定]）。超限的实例会被静默拒绝、
     * 退回 Tier B，并打上 data-refraction="off"。
     *
     * 首页实测：「设置」那一屏正好是 **8**，一点余量没有 ——
     * 顶栏 3 + 页面下方 ComponentPreview 的 Preview/Code 1 + 手机 4。
     * 所以这条断言是有意义的：首页再多一个强玻璃控件，它就会红。
     */
    await page.goto('/');
    for (const label of ['资料库', '设置', '相册']) {
      await heroTab(page, label);
      await expect(
        page.locator('[data-refraction=off]'),
        label + ' 这一屏有实例被挤下 Tier A',
      ).toHaveCount(0);
    }
  });
});

/* ── 组合起来才暴露的两个库级缺陷（都是 Hero 挖出来的）──────────────── */

test('同一页多组 Tabs：指示器必须各归各的', async ({ page }) => {
  /**
   * 回归测试。motion 的 layoutId 是**全树共享**的命名空间，
   * 而 Tabs 原先写死 layoutId="lg-tabs-indicator" —— 于是一页上只要有两组 Tabs，
   * 它们的指示器就被当成同一个元素。首页一上 Hero 就现形：
   * 四组 Tabs（顶栏 tier 切换 / Preview·Code / Tab Bar / 分段）的指示器
   * 报出来是**同一个 rect**。
   *
   * 视觉回归为什么没抓到：它逐个示例单独渲染（/view/[name] 一屏一个组件），
   * 永远不会有第二组 Tabs 在场。又一次「隔离渲染看不见组合问题」。
   */
  await page.goto('/');
  // page.evaluate 不会像 locator 那样自动等 —— 指示器是水合之后才由 motion 挂上的
  await expect(
    page.locator('[data-slot=tabs-list] .lg-surface[data-layer=indicator]').first(),
  ).toBeVisible();
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('[data-slot=tabs-list]')].map((list) => {
      const ind = list.querySelector('.lg-surface[data-layer=indicator]');
      if (!ind) return null;
      const l = list.getBoundingClientRect();
      const i = ind.getBoundingClientRect();
      return {
        inside: i.left >= l.left - 1 && i.right <= l.right + 1 && i.top >= l.top - 1,
        key: Math.round(i.x) + 'x' + Math.round(i.y),
      };
    }),
  );
  const found = boxes.filter((b): b is NonNullable<typeof b> => b !== null);
  expect(found.length, '首页上应当有多组 Tabs 同时在场').toBeGreaterThan(2);
  for (const b of found) expect(b.inside, '指示器跑到自己的 TabsList 外面去了').toBe(true);
  expect(new Set(found.map((b) => b.key)).size, '多个指示器塌在同一个坐标上').toBe(found.length);
});

test('工具类能覆盖 .lg-surface 的定位 —— 级联层没写反', async ({ page }) => {
  /**
   * 回归测试。.lg-surface 原先是**无层**规则，而 Tailwind 的工具类在
   * @layer utilities 里 —— 级联层的规则是「无层胜过任何有层」，
   * 于是 className="absolute" 在任何一块玻璃上都**静默失效**，
   * 连带 rounded-* / text-* 一样，没有报错、看起来就像类名写错了。
   *
   * Hero 把 Tab Bar 定到屏幕底部时踩到：class 列表里明明有 absolute，
   * computed 出来还是 relative，栏跑到屏幕顶上去。
   */
  await page.goto('/');
  const bar = page.locator('[data-hero-phone] .lg-surface').filter({ hasText: '相册' }).first();
  await expect(bar).toHaveCSS('position', 'absolute');
});

/* ── 控制台 ──────────────────────────────────────────────────────────── */

/**
 * 允许通过的噪音。**每一条都要写清楚为什么它不是 bug。**
 */
const ALLOW: { re: RegExp; why: string }[] = [
  {
    re: /Encountered a script tag while rendering React component/,
    why:
      '首屏防闪烁的内联脚本。它必须在 <head> 里同步执行（要赶在 <body> 被解析出来之前），' +
      '而 Next 不喜欢 React 树里出现 <script>。换 next/script 试过：警告照旧，' +
      '注入位置反而掉到 body 开头。见 app/layout.tsx 的注释。',
  },
];

for (const path of [
  '/',
  '/docs',
  '/docs/installation',
  '/docs/materials',
  '/docs/optics',
  '/docs/components/select',
  /*
   * P2 第三批的三页都进来了 —— 这一批**每个组件都有一处上游会闹的地方**：
   *   Sidebar         Radix Dialog 少了 Title 会在控制台报警
   *   Menubar         Radix Menubar 的 roving focus 在 SSR 首帧容易 warn
   *   NavigationMenu  Viewport 的高度动画 + 自管 open，最容易出 hydration 警告
   * STATUS 里那条「没有任何测试看过控制台」的教训，这一批不再重复。
   */
  '/docs/components/sidebar',
  '/docs/components/menubar',
  '/docs/components/navigation-menu',
  /*
   * P2 第四批的三页。Calendar 的键盘网格与 Combobox 的 aria-activedescendant
   * 都是**本库自己写的**（没有 Radix 兜底），首帧最容易出 React 的
   * controlled/uncontrolled 与 hydration 告警。
   */
  '/docs/components/calendar',
  '/docs/components/date-picker',
  '/docs/components/combobox',
]) {
  test(`控制台无 error / warning：${path}`, async ({ page }) => {
    const noise: string[] = [];
    page.on('console', (m) => {
      if (m.type() !== 'error' && m.type() !== 'warning') return;
      if (ALLOW.some((a) => a.re.test(m.text()))) return;
      noise.push(`[${m.type()}] ${m.text()}`);
    });
    page.on('pageerror', (e) => noise.push(`[pageerror] ${e.message}`));
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    expect([...new Set(noise.map((s) => s.slice(0, 160)))]).toEqual([]);
  });
}
