/**
 * Phase 7 收尾（Checkbox / Radio Group）的渲染验证台。
 *
 * ⚠️ 这一台的重点与前几台**正好相反**：前面几台是查「玻璃对不对」，
 * 这一台要查的是「**玻璃有没有跑进来**」——
 * macOS 27 实测里这两个控件一点玻璃都没有（apple-metrics.md §10.3），
 * 所以「子树里 .lg-surface 计数为 0」本身就是一条要断言的事实。
 *
 * 默认背景是那张高频条纹 —— 一旦哪天有人给它加了折射，条纹会立刻把它抖出来。
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@createagle/glass-core';
import { Checkbox } from '../registry/glass/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../registry/glass/ui/radio-group';
import { Card, CardRow } from '../registry/glass/ui/card';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const only = params.get('only');
/*
 * ⚠️ 高对比**没有** Provider 属性可传 —— 它来自 `prefers-contrast` 媒体查询，
 * 由 Provider 自己写到 <html data-glass-contrast>。
 * 测试里要用 `browser.newContext({ contrast: 'more' })`，不是 URL 参数。
 * 这条注释留着，免得下次又有人来找 defaultContrast。
 */

/** 三态 × 三档交互，全部铺开 —— 视觉回归拍的就是这一格 */
function CheckboxRow() {
  return (
    <div data-testid="row-checkbox" className="flex flex-col gap-3">
      <Checkbox data-testid="cb-unchecked">未选</Checkbox>
      <Checkbox data-testid="cb-checked" defaultChecked>
        已选
      </Checkbox>
      <Checkbox data-testid="cb-mixed" checked="indeterminate">
        半选
      </Checkbox>
      <Checkbox data-testid="cb-disabled" disabled>
        禁用 · 未选
      </Checkbox>
      <Checkbox data-testid="cb-disabled-checked" disabled defaultChecked>
        禁用 · 已选
      </Checkbox>
      {/* 没有标签 —— 必须自己给名字，否则无障碍名是空的 */}
      <Checkbox data-testid="cb-bare" aria-label="没有可见标签的复选框" />
      {/* 放大一档，检查所有几何都是按比例算的 */}
      <Checkbox data-testid="cb-large" size={24} defaultChecked>
        24px
      </Checkbox>
    </div>
  );
}

function RadioRow() {
  const [v, setV] = React.useState('b');
  return (
    <div data-testid="row-radio" className="flex flex-col gap-4">
      <RadioGroup value={v} onValueChange={setV} aria-label="尺码" data-testid="rg">
        <RadioGroupItem value="a" data-testid="rg-a">
          小
        </RadioGroupItem>
        <RadioGroupItem value="b" data-testid="rg-b">
          中
        </RadioGroupItem>
        <RadioGroupItem value="c" data-testid="rg-c">
          大
        </RadioGroupItem>
        <RadioGroupItem value="d" data-testid="rg-d" disabled>
          禁用
        </RadioGroupItem>
      </RadioGroup>
      <RadioGroup defaultValue="x" aria-label="放大一档" data-testid="rg-large">
        <RadioGroupItem value="x" size={24}>
          24px
        </RadioGroupItem>
      </RadioGroup>

      {/*
       * 无标签的一组 —— 走的是「不包 <label>」那条分支。
       * 除了覆盖这条分支，它还是键盘行为的对照组：
       * 若带标签的组方向键不选中而这一组选中，问题就出在 <label> 上。
       */}
      <RadioGroup defaultValue="p" aria-label="无标签对照组" data-testid="rg-bare">
        <RadioGroupItem value="p" data-testid="rg-bare-p" aria-label="第一项" />
        <RadioGroupItem value="q" data-testid="rg-bare-q" aria-label="第二项" />
      </RadioGroup>
    </div>
  );
}

/**
 * 复选框 + 分组卡片：**整棵子树的 .lg-surface 计数应当是 0**。
 *
 * 两件事叠在一起 —— Checkbox 是内容层，`Card` 默认的 grouped 变体
 * 也是不透明区块底（实测 alpha=255），两边都不该有玻璃。
 * 哪天有人给其中任何一个加了 GlassSurface，这一格的计数就不再是 0。
 */
function InCardRow() {
  const [on, setOn] = React.useState([true, false, true]);
  return (
    <div data-testid="row-in-card">
      <Card className="w-[260px]">
        {['邮件通知', '推送通知', '短信通知'].map((label, i) => (
          <CardRow key={label}>
            <Checkbox
              checked={on[i] ?? false}
              onCheckedChange={(val) =>
                setOn((prev) => prev.map((p, j) => (i === j ? val === true : p)))
              }
            >
              {label}
            </Checkbox>
          </CardRow>
        ))}
      </Card>
    </div>
  );
}

function Demo() {
  if (only === 'checkbox') return <CheckboxRow />;
  if (only === 'radio') return <RadioRow />;
  if (only === 'in-card') return <InCardRow />;
  return (
    <div className="flex flex-col gap-8">
      <CheckboxRow />
      <RadioRow />
      <InCardRow />
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
