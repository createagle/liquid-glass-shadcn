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
import { Button } from '../registry/glass/ui/button';
import { Card, CardRow } from '../registry/glass/ui/card';

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

/**
 * iPhone 底部工具栏，节点 12740:24071（402×84）。
 * 里面正好并排放着两种按钮：左边玻璃、右边实心强调色。
 *
 * 位置全部来自节点元数据，不是目测：
 *   leading  x=28  y=4  79×48
 *   trailing x=206 y=4  168×48
 */
function ButtonScene() {
  return (
    <div style={{ width: 402, height: 84, background: '#fff', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 28, top: 4 }}>
        <Button variant="glass">Button</Button>
      </div>
      <div style={{ position: 'absolute', left: 206, top: 4 }}>
        {/* 参考图里这个按钮没有可见标签，就是一块实心胶囊 */}
        <Button variant="prominent" style={{ width: 168 }} aria-label="强调按钮" />
      </div>
    </div>
  );
}

/**
 * 分组列表区块，节点 12740:33923（370×104，两行开关）。
 *
 * 这一张和其他三张不同：**左右两边的"场景"是同一个东西**。
 * 前三张里的白底行是对照台自己画的（`Row`），只是给被测组件一个 iOS 的落脚点；
 * 这里那块白底**就是被测组件本身**，所以圆角、行高、分隔线、内缩全部可比。
 */
function CardScene() {
  return (
    <div style={{ width: 370, background: 'var(--lg-grouped-bg)' }}>
      <Card>
        <CardRow>
          <span style={{ flex: 1 }}>Switch is on</span>
          <Switch defaultChecked aria-label="Switch is on" />
        </CardRow>
        <CardRow>
          <span style={{ flex: 1 }}>Switch is off</span>
          <Switch aria-label="Switch is off" />
        </CardRow>
      </Card>
    </div>
  );
}

for (const [id, node] of [
  ['switch-scene', <SwitchScene key="s" />],
  ['slider-scene', <SliderScene key="l" />],
  ['button-scene', <ButtonScene key="b" />],
  ['card-scene', <CardScene key="c" />],
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
