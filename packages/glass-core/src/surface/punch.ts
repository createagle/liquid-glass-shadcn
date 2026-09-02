/**
 * 底座挖洞 —— 让嵌套的指示器看到**未被底座模糊过**的背景。
 *
 * ── 要解决的问题（optics-web.md §3.8）────────────────────────────────
 *
 * `backdrop-filter` 作用于元素背后**已绘制的全部内容**，其中包含父级底座
 * 模糊后的结果。所以嵌在底座里的指示器永远看到「已经被底座模糊过」的背景，
 * 不可能比底座更清晰 —— 而 PROJECT_SPEC §2 要求的恰恰是
 * 「指示器区域看到的背景比底座更清晰」。
 *
 * 纯声明式的 CSS 解决不了：只要底座画在指示器后面，它就属于指示器的 backdrop。
 *
 * ── 做法与选型依据（`debug/holepunch-probe.html` 实测）──────────────
 *
 * 把底座的模糊放到一个独立子层上，再在指示器所在位置把这个子层挖穿。
 * 四种写法实测（判据：沿水平线的像素标准差，条纹越清晰方差越大）：
 *
 *   A 不挖洞（对照）        洞外 σ=0.5   洞内 σ=0.5    全模糊
 *   B mask 直接挖在玻璃上   洞外 σ=0.5   洞内 σ=127.5  洞内清晰，**但底色也被一起挖掉**
 *   C 模糊放子层 + mask     洞外 σ=0.8   洞内 σ=89.0   洞内清晰，底色保留 ✅
 *   D 模糊放子层 + clip-path 同 C，且支持**圆角**洞 ✅✅
 *
 * 选 D：指示器是胶囊形，`linear-gradient` 只能挖直角洞。
 * `clip-path: path(evenodd, …)` 用「外框 + 内框」两个子路径，
 * evenodd 填充规则让内框成为洞。
 */

export interface GlassPunch {
  /** 洞相对底座左上角的位置（px） */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 洞的圆角。胶囊传 height/2。 */
  radius: number;
}

/**
 * 生成挖洞用的 `clip-path: path()` 值。
 *
 * @param width  底座自身宽度（px）—— path() 只接受绝对数值，不能用百分比
 * @param height 底座自身高度（px）
 */
export function punchClipPath(width: number, height: number, p: GlassPunch): string {
  // 半径不能超过洞的一半，否则路径自交
  const r = Math.max(0, Math.min(p.radius, p.width / 2, p.height / 2));
  const x = p.x;
  const y = p.y;
  const w = p.width;
  const h = p.height;

  // 直角洞时省掉四段圆弧，路径更短
  const inner =
    r === 0
      ? `M${x} ${y} H${x + w} V${y + h} H${x} Z`
      : [
          `M${x + r} ${y}`,
          `h${w - 2 * r}`,
          `a${r} ${r} 0 0 1 ${r} ${r}`,
          `v${h - 2 * r}`,
          `a${r} ${r} 0 0 1 ${-r} ${r}`,
          `h${-(w - 2 * r)}`,
          `a${r} ${r} 0 0 1 ${-r} ${-r}`,
          `v${-(h - 2 * r)}`,
          `a${r} ${r} 0 0 1 ${r} ${-r}`,
          'z',
        ].join(' ');

  // 外框走满整个底座；evenodd 让内框成为洞
  return `path(evenodd, "M0 0 H${width} V${height} H0 Z ${inner}")`;
}

/** 洞是否有效（尺寸为 0 或负数时不该挖） */
export function isPunchValid(p: GlassPunch | null | undefined): p is GlassPunch {
  return !!p && p.width > 0 && p.height > 0;
}

/**
 * 量出「目标元素相对底座」的洞。
 *
 * 看着只是两次 `getBoundingClientRect()` 相减，**但那样写是错的**，两个坑都踩过：
 *
 * 1. **必须相对底座本体，不是它的内容框。**
 *    弹层面板普遍有内边距（菜单是 10/16），如果拿「装内容的那个 div」当基准，
 *    洞会整体偏移一个内边距。DropdownMenu 就是这么错的 —— 218 宽的项，
 *    洞落在 x=0…218，项实际在 x=16…234，**整整差了 16**。
 *    偏了之后洞仍然与项有 ~90% 重叠，条纹清晰度照样翻倍，
 *    所以「有没有色散」的实测是对的，「洞在不在位置上」却一直没人验。
 *
 * 2. **`getBoundingClientRect()` 量到的是变换后的盒子，而 clip-path 的坐标系
 *    是未变换的布局坐标。** 浮层入场时整块面板在做 scale 动画（0.94 → 1），
 *    在那一帧量，洞会小 5% 且位置也跟着缩。Select 打开时 Radix 会立刻高亮
 *    当前选中项 —— 正好撞在动画中间，这才把这个坑暴露出来。
 *
 *    解法：用 `offsetWidth` 反解出当前缩放（它不受 transform 影响），
 *    把量到的值除回去。
 *
 * @param surface 底座元素（`.lg-surface` 本体）
 * @param target  要挖穿的目标元素
 */
export function measurePunch(
  surface: HTMLElement,
  target: HTMLElement,
  radius: number,
): GlassPunch | null {
  const s = surface.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  // offsetWidth 是布局尺寸，不受 transform 影响 —— 两者的比值就是当前缩放
  const scale = surface.offsetWidth > 0 ? s.width / surface.offsetWidth : 1;
  if (!(scale > 0)) return null;
  return {
    x: (t.left - s.left) / scale,
    y: (t.top - s.top) / scale,
    width: t.width / scale,
    height: t.height / scale,
    radius,
  };
}
