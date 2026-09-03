/**
 * 「玻璃从多大开始才看得出来」的实验台。
 *
 * 只渲染**一块** Layer I 玻璃，尺寸由 `?w=` / `?h=` 给定，
 * 压在 6px 黑白条纹上（全库光学诊断统一的高频最坏情况）。
 *
 * `?refraction=off` 关掉 JS 注入的 SVG 折射，把这块玻璃交还给 CSS 分支 ——
 * 于是同一尺寸下开/关两张图的差，就是**折射本身**贡献的像素量。
 * 其余一切（材质底色、描边、高光、模糊）两边完全相同。
 *
 * 由 scripts/small-glass.mjs 驱动，扫一遍尺寸。
 */
import { createRoot } from 'react-dom/client';
import { GlassProvider, GlassSurface } from '@glass/core';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tint = Number(params.get('tint') ?? '0.34');
const w = Number(params.get('w') ?? '44');
const h = Number(params.get('h') ?? '20');
const refraction = params.get('refraction') !== 'off';

function Demo() {
  return (
    <div
      data-testid="stage"
      style={{
        // 舞台比玻璃大一圈，让边缘的折射也进得了取景框
        width: w + 24,
        height: h + 24,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <GlassSurface
        layer="indicator"
        radius={Math.min(w, h) / 2}
        refraction={refraction}
        style={{ width: w, height: h }}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <GlassProvider defaultTheme={theme} defaultTint={tint} tier="a">
    <Demo />
  </GlassProvider>,
);

queueMicrotask(() => {
  (window as unknown as { __ready?: boolean }).__ready = true;
});
