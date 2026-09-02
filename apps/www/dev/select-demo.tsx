/**
 * Select 渲染验证台（不是文档站 —— 文档站是 Phase 6）。
 *
 * `?only=default`  基础下拉（5 项，首字母刻意有重复，供 typeahead 测试）
 * `?only=groups`   带分组标题、分隔线、禁用项
 * `?only=long`     20 项 —— 面板要滚动，用来验证滚动时挖洞跟不跟得上
 * `?open=1`        一进来就是打开的
 * `?value=size`    预置选中值（不传则是未选中，触发器显示 placeholder）
 * `?responsive=0`  逃生口，强制桌面行为
 * `?disabled=1`    禁用
 * `?side=…` `?align=…`
 */
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@glass/core';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectLabel,
  SelectGroup,
} from '../registry/glass/ui/select';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const startOpen = params.get('open') === '1';
const responsive = params.get('responsive') !== '0';
const disabled = params.get('disabled') === '1';
const only = params.get('only') ?? 'default';
const value = params.get('value') ?? undefined;
const side = (params.get('side') ?? 'bottom') as 'top' | 'right' | 'bottom' | 'left';
const align = (params.get('align') ?? 'start') as 'start' | 'center' | 'end';

/**
 * 首字母刻意安排过，供 typeahead 用例使用：
 *   `t`       → Tags（唯一以 t 开头）
 *   `s` `s`   → Size → Shared By（同字母循环）
 *   `s` `h`   → Shared By（多字前缀）
 */
const OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'date', label: 'Date Modified' },
  { value: 'size', label: 'Size' },
  { value: 'shared', label: 'Shared By' },
  { value: 'tags', label: 'Tags' },
];

const LONG = Array.from({ length: 20 }, (_, i) => ({
  value: `opt-${i}`,
  label: `选项 ${String(i + 1).padStart(2, '0')}`,
}));

function Scene({ children }: { children: React.ReactNode }) {
  return (
    <Select
      defaultOpen={startOpen}
      responsive={responsive}
      disabled={disabled}
      {...(value !== undefined ? { defaultValue: value } : {})}
    >
      <SelectTrigger aria-label="排序方式">
        <SelectValue placeholder="选择排序方式" />
      </SelectTrigger>
      <SelectContent title="排序方式" side={side} align={align}>
        {children}
      </SelectContent>
    </Select>
  );
}

function DefaultScene() {
  return (
    <Scene>
      {OPTIONS.map((o) => (
        <SelectItem key={o.value} value={o.value}>
          {o.label}
        </SelectItem>
      ))}
    </Scene>
  );
}

function GroupsScene() {
  return (
    <Scene>
      <SelectGroup>
        <SelectLabel>文件属性</SelectLabel>
        <SelectItem value="name">Name</SelectItem>
        <SelectItem value="size">Size</SelectItem>
      </SelectGroup>
      <SelectSeparator />
      <SelectGroup>
        <SelectLabel>时间</SelectLabel>
        <SelectItem value="date">Date Modified</SelectItem>
        <SelectItem value="created" disabled>
          Date Created
        </SelectItem>
      </SelectGroup>
    </Scene>
  );
}

function LongScene() {
  return (
    <Scene>
      {LONG.map((o) => (
        <SelectItem key={o.value} value={o.value}>
          {o.label}
        </SelectItem>
      ))}
    </Scene>
  );
}

function Demo() {
  if (only === 'groups') return <GroupsScene />;
  if (only === 'long') return <LongScene />;
  return <DefaultScene />;
}

createRoot(document.getElementById('root')!).render(
  <GlassProvider defaultTheme={theme} defaultTint={tint} tier={tier}>
    <Demo />
  </GlassProvider>,
);

queueMicrotask(() => {
  (window as unknown as { __ready?: boolean }).__ready = true;
});
