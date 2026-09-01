/**
 * Fidelity 对照台 —— Apple 参考图 vs 本库组件，同一比例并排。
 *
 * ⚠️ 左边是 **Apple Design Resources 的 Figma 渲染图，不是 iOS 真机截图**。
 *    它是一张静态设计稿：Liquid Glass 的折射、色散、镜面高光在 Figma 里
 *    本来就画不出来，所以左右在「材质」上必然不同，那不是本库的还原度差异。
 *    真正可比的是**几何**：尺寸、内缩、行程、圆角、位置关系。
 *
 * 两张参考图都是 1× 导出（1px = 1pt），所以右边按同样的 pt 数渲染即可 1:1 对齐。
 */
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@glass/core';
import { Slider } from '../registry/glass/ui/slider';
import { Switch } from '../registry/glass/ui/switch';

/** iOS 列表行：白底、行高 52pt、左右 16pt 边距 */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 370,
        height: 52,
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function SwitchScene() {
  return (
    <Row>
      <span style={{ flex: 1, font: '17px -apple-system, "Segoe UI", sans-serif', color: '#000' }}>
        Switch is on
      </span>
      <Switch defaultChecked aria-label="Switch is on" />
    </Row>
  );
}

function SliderScene() {
  return (
    <div style={{ background: '#fff', width: 371 }}>
      {[0, 45, 95].map((v, i) => (
        <div key={v} style={{ borderTop: i === 0 ? 'none' : '1px solid #e5e5ea' }}>
          <Row>
            <div style={{ width: 250, margin: '0 auto' }}>
              <Slider defaultValue={[v]} aria-label={`示例滑杆 ${v}`} />
            </div>
          </Row>
        </div>
      ))}
    </div>
  );
}

for (const [id, node] of [
  ['switch-scene', <SwitchScene key="s" />],
  ['slider-scene', <SliderScene key="l" />],
] as const) {
  const el = document.getElementById(id);
  if (el) {
    createRoot(el).render(
      // 对照图按 Tier A、默认档位渲染 —— 那是本库的主路径
      <GlassProvider defaultTheme="light" defaultTint={0.34} tier="a">
        {node}
      </GlassProvider>,
    );
  }
}

queueMicrotask(() => {
  (window as unknown as { __ready?: boolean }).__ready = true;
});
