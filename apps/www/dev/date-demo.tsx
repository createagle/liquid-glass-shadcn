/**
 * P2 第四批（Calendar / DatePicker / Combobox）的渲染验证台。
 *
 * ⚠️ **所有日期都写死。** `today` 默认是 `new Date()` ——
 *    不钉死的话，视觉快照会在过日期的那一晚自己红掉，
 *    而且看起来像是随机失败（STATUS 里「产物陈旧会伪装成 flaky」的同族）。
 *
 * 这一批的看点：
 *   Calendar     ✅ 一句玻璃都没有，**而且资源自证**（Inline 变体就是纯白的）
 *   DatePicker   弹层是玻璃，圆角 **13**（实测，比菜单 34 / Popover 38 小得多）
 *   Combobox     结构取自 macOS，**尺度不取**
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@glass/core';
import { Calendar } from '../registry/glass/ui/calendar';
import { DatePicker, DatePickerInline } from '../registry/glass/ui/date-picker';
import { Combobox } from '../registry/glass/ui/combobox';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const only = params.get('only');

/** 2026-04-01。整批的「今天」，写死。 */
const TODAY = new Date(2026, 3, 1);
/** 2026-04-12。整批的「选中」，写死 —— 它不是今天，所以是黑底白字那一档。 */
const SELECTED = new Date(2026, 3, 12);

function CalendarRow() {
  const [date, setDate] = React.useState<Date | null>(SELECTED);
  return (
    <div data-testid="row-calendar" className="bg-[var(--lg-card-fill)]">
      {/*
        ⚠️ **刻意不传 `month`** —— 传了它就是受控的，月份按钮点了没反应
        （第一版就是这么写的，两条键盘/翻页测试直接超时）。
        不传时 Calendar 自己按 `selected` 落到 2026-04，同样是确定的。
      */}
      <Calendar selected={date} onSelect={setDate} today={TODAY} data-testid="cal" />
    </div>
  );
}

function CalendarStatesRow() {
  return (
    <div data-testid="row-calendar-states" className="bg-[var(--lg-card-fill)]">
      {/*
        ⚠️ 这一行的选中日**刻意不是 SELECTED（4/12）** —— 那天是周日，
        而这里把周末设成了不可选。选中 + 禁用叠在一起，格子会被 opacity 0.3
        压成灰的，「选中态是黑底白字」那条就看不出来了（第一版录出来就是灰的）。
        4/15 是周三。
      */}
      <Calendar
        defaultSelected={new Date(2026, 3, 15)}
        today={TODAY}
        disabled={(d) => d.getDay() === 0 || d.getDay() === 6}
        data-testid="cal-states"
      />
    </div>
  );
}

function DatePickerRow() {
  const [date, setDate] = React.useState<Date | null>(SELECTED);
  return (
    <div data-testid="row-date-picker" className="flex flex-col items-start gap-4">
      <DatePicker
        value={date}
        onValueChange={setDate}
        today={TODAY}
        label="选择日期"
        time="9:41 AM"
        data-testid="dp"
      />
      <DatePickerInline defaultSelected={SELECTED} today={TODAY} data-testid="dp-inline" />
    </div>
  );
}

const OPTIONS = [
  { value: 'sf', label: 'San Francisco' },
  { value: 'cupertino', label: 'Cupertino' },
  { value: 'seattle', label: 'Seattle' },
  { value: 'austin', label: 'Austin' },
  { value: 'nyc', label: 'New York', disabled: true },
];

function ComboboxRow() {
  const [value, setValue] = React.useState<string | null>('sf');
  return (
    <div data-testid="row-combobox" className="flex flex-col items-start gap-4" style={{ width: 280 }}>
      <Combobox
        options={OPTIONS}
        value={value}
        onValueChange={setValue}
        aria-label="城市"
        placeholder="输入或选择城市"
        data-testid="cb"
      />
      <Combobox options={OPTIONS} defaultValue="sf" aria-label="禁用示例" disabled data-testid="cb-disabled" />
    </div>
  );
}

const ROWS: Record<string, React.ReactNode> = {
  calendar: <CalendarRow />,
  'calendar-states': <CalendarStatesRow />,
  'date-picker': <DatePickerRow />,
  combobox: <ComboboxRow />,
};

function Demo() {
  const rows = only ? [only] : Object.keys(ROWS);
  return (
    <div className="flex flex-col gap-8">
      {rows.map((k) => (
        <React.Fragment key={k}>{ROWS[k]}</React.Fragment>
      ))}
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
