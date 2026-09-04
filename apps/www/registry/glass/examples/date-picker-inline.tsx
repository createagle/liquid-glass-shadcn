'use client';

import * as React from 'react';
import { DatePickerInline } from '@/components/ui/date-picker';

/**
 * Inline 形态 —— 对应资源的 `Style=Inline`：**纯白不透明**，左右内边距 16。
 *
 * 与 `<DatePicker>`（Compact，玻璃，内边距 12）并排看，
 * 就是 PROJECT_SPEC §2「材质属于控件层，内容层不堆玻璃」那条规则的实物。
 */
export default function DatePickerInlineExample() {
  return (
    <DatePickerInline
      defaultSelected={new Date(2026, 3, 12)}
      today={new Date(2026, 3, 1)}
      month={new Date(2026, 3, 1)}
      className="rounded-[13px]"
    />
  );
}
