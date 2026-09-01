/**
 * Slider / Switch 渲染验证台（不是文档站 —— 文档站是 Phase 6）。
 *
 * 用途：让 Playwright 能真实渲染组件，做几何判定、降级分支判定、
 * 以及 PROJECT_SPEC §14 里那些「必须看得见才算数」的验收项。
 */
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@glass/core';
import { Slider } from '../registry/glass/ui/slider';
import { Switch } from '../registry/glass/ui/switch';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
/** 只渲染其中一个，视觉快照才不会被另一个的尺寸变化牵连 */
const only = params.get('only');
/** 几何缩放测试用：不传就用组件默认（= iOS 27 实测值） */
const knob = params.get('knob') ? Number(params.get('knob')) : undefined;
const size = params.get('size') ? Number(params.get('size')) : undefined;

function Demo() {
  return (
    <div className="flex flex-col gap-7">
      {only !== 'switch' ? (
        <div style={{ width: 250 }} data-testid="slider-box">
          <Slider
            defaultValue={[40]}
            aria-label="示例滑杆"
            {...(knob !== undefined ? { knobSize: knob } : {})}
          />
        </div>
      ) : null}

      {only !== 'slider' ? (
        <div className="flex items-center gap-4">
          <Switch aria-label="示例开关" {...(size !== undefined ? { size } : {})} />
          <Switch aria-label="默认开启的开关" defaultChecked />
          <Switch aria-label="禁用的开关" disabled />
        </div>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <GlassProvider defaultTheme={theme} defaultTint={tint} tier={tier}>
    <Demo />
  </GlassProvider>,
);

queueMicrotask(() => {
  (window as unknown as { __ready?: boolean }).__ready = true;
});
