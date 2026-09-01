/**
 * 背景探针 —— 「元素级」自适应里真正「元素级」的那一半。
 *
 * `legibility: 'adaptive'` 要回答的问题是：**这块玻璃背后到底有多亮？**
 * 答得出来，材质就只需要抬到刚好够用的不透明度；答不出来，就退回
 * `guaranteed` 的最不利地板。**永远不会因为答不出来而失去 AA 保证。**
 *
 * ── Web 上能做到什么程度 ──────────────────────────────────────────────
 *
 * 没有 API 能读到「合成后的背景像素」。`backdrop-filter` 只能把它画出来，
 * 不能读回。canvas 截屏会被跨源图片污染，而且开销大到不能每帧跑。
 *
 * 所以这里走的是**从 DOM 推**：`elementsFromPoint` 拿到该点的元素栈，
 * 跳过玻璃自己及其子孙，从上往下找第一个不透明背景，再把它上面的
 * 半透明层依次合成回去。
 *
 * 这条路**只对纯色背景可靠**。碰到下列情况一律判定为「测不出」并返回 null：
 *
 *   - `background-image`（渐变、图片都算）
 *   - `<img>` / `<video>` / `<canvas>` / `<svg>` / `<iframe>`
 *   - 祖先上有 `opacity < 1` 或 `filter`（会改变最终合成结果）
 *
 * 判不出来就退回保证模式 —— 这是**故意的保守**：宁可牺牲通透度，
 * 不可牺牲可读性。PROJECT_SPEC §13 是「不可协商」项。
 */

/** 探测失败时返回 null，调用方据此回落到 guaranteed */
export type BackdropSamples = readonly (readonly [number, number, number])[];

const OPAQUE_UNKNOWN_TAGS = new Set(['IMG', 'VIDEO', 'CANVAS', 'SVG', 'IFRAME', 'PICTURE']);

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseRgb(css: string): Rgba | null {
  if (!css || css === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const m = css.match(/[\d.]+/g);
  if (!m || m.length < 3) return null;
  return {
    r: Number(m[0]),
    g: Number(m[1]),
    b: Number(m[2]),
    a: m[3] === undefined ? 1 : Number(m[3]),
  };
}

/**
 * 读一个元素自身的背景贡献。
 * @returns `null` 表示**测不出**（不是「透明」）——调用方必须整体放弃
 */
function backgroundOf(el: Element): Rgba | null {
  if (OPAQUE_UNKNOWN_TAGS.has(el.tagName)) return null;

  const cs = getComputedStyle(el);

  // 渐变与图片都读不出来
  if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
  // 半透明祖先与滤镜会改变最终合成，推不准
  if (cs.opacity !== '' && Number(cs.opacity) < 1) return null;
  if (cs.filter && cs.filter !== 'none') return null;

  return parseRgb(cs.backgroundColor);
}

/** 文档级兜底背景：html → body → 白 */
function documentBackground(): [number, number, number] {
  for (const el of [document.documentElement, document.body]) {
    if (!el) continue;
    const c = parseRgb(getComputedStyle(el).backgroundColor);
    if (c && c.a >= 0.999) return [c.r, c.g, c.b];
  }
  // 浏览器的默认画布色
  return [255, 255, 255];
}

/** 求某一点处、`self` 背后的有效背景色 */
function backdropAtPoint(self: Element, x: number, y: number): [number, number, number] | null {
  const stack = document.elementsFromPoint(x, y);
  if (!stack.length) return null;

  // 去掉玻璃自己和它的子孙 —— 我们要的是它**背后**的东西
  const behind = stack.filter((el) => el !== self && !self.contains(el));

  const layers: Rgba[] = [];
  let opaque: [number, number, number] | null = null;

  for (const el of behind) {
    const c = backgroundOf(el);
    if (c === null) return null; // 测不出 → 整体放弃
    if (c.a <= 0) continue;
    if (c.a >= 0.999) {
      opaque = [c.r, c.g, c.b];
      break;
    }
    layers.push(c);
  }

  let acc: [number, number, number] = opaque ?? documentBackground();
  // 自下而上把半透明层合成回去
  for (let i = layers.length - 1; i >= 0; i--) {
    const c = layers[i]!;
    acc = [
      c.a * c.r + (1 - c.a) * acc[0],
      c.a * c.g + (1 - c.a) * acc[1],
      c.a * c.b + (1 - c.a) * acc[2],
    ];
  }
  return acc;
}

/**
 * 在元素覆盖范围内取若干点，返回背后背景的颜色样本。
 *
 * 取多点是因为**一个元素底下可以同时压着很亮和很暗的东西**
 * （这正是「翻转文字颜色」方案失败的原因，见 legibility.ts 文件头）。
 * 地板必须照顾到最不利的那个样本，所以样本要覆盖整块面积，不能只取中心。
 *
 * @returns 颜色样本数组；**任一采样点测不出就返回 `null`**（全有或全无）
 */
export function probeBackdrop(el: Element): BackdropSamples | null {
  if (typeof document === 'undefined' || !document.elementsFromPoint) return null;

  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;

  // 完全滚出视口时 elementsFromPoint 拿不到东西，别给出错误的乐观结论
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
    return null;
  }

  // 四角内缩 2px（避开自身描边）+ 四边中点 + 中心，共 9 点
  const inset = 2;
  const xs = [r.left + inset, r.left + r.width / 2, r.right - inset];
  const ys = [r.top + inset, r.top + r.height / 2, r.bottom - inset];

  const samples: Array<readonly [number, number, number]> = [];
  for (const y of ys) {
    for (const x of xs) {
      // 采样点落到视口外就跳过，但不因此判失败
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
      const c = backdropAtPoint(el, x, y);
      if (c === null) return null;
      samples.push(c);
    }
  }

  return samples.length ? samples : null;
}
