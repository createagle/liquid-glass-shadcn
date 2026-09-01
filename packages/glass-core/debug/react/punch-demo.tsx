/**
 * 挖洞原语的渲染验证台。
 *
 * 这不是 Tabs 组件 —— 只验证 `<GlassSurface punch>` 这一个能力：
 * 洞内的背景是否真的比洞外清晰，且底座的材质底色是否连续。
 * 判据与 `debug/holepunch-probe.html` 一致（沿水平线的像素标准差）。
 */
import { createRoot } from 'react-dom/client';
import { GlassProvider, GlassSurface, concentricRadius } from '../../src/index.js';

/** iOS 27 实测：底座 244×62、按钮组 236×54、四周内缩 4pt（apple-metrics.md §7.2） */
const BASE_W = 244;
const BASE_H = 62;
const INSET = 4;
const TAB_W = 120;
const TAB_H = BASE_H - INSET * 2;
const BASE_R = BASE_H / 2;

function Demo({ punched, selected }: { punched: boolean; selected: 0 | 1 }) {
  const punch = {
    x: INSET + selected * (TAB_W - 6),
    y: INSET,
    width: TAB_W,
    height: TAB_H,
    radius: TAB_H / 2,
  };
  return (
    <GlassSurface
      layer="base"
      radius={BASE_R}
      punch={punched ? punch : null}
      style={{ width: BASE_W, height: BASE_H, position: 'relative' }}
    >
      <GlassSurface
        layer="indicator"
        radius={concentricRadius(BASE_R, INSET)}
        style={{
          position: 'absolute',
          left: punch.x,
          top: punch.y,
          width: TAB_W,
          height: TAB_H,
        }}
      />
    </GlassSurface>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <GlassProvider defaultTheme="light" defaultTint={0} tier="a">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div data-case="off" style={{ position: 'relative' }}>
        <Demo punched={false} selected={0} />
      </div>
      <div data-case="on" style={{ position: 'relative' }}>
        <Demo punched selected={0} />
      </div>
    </div>
  </GlassProvider>,
);

// 供探测脚本判定渲染完成
queueMicrotask(() => {
  (window as unknown as { __ready?: boolean }).__ready = true;
});
