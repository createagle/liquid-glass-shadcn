'use client';

import * as React from 'react';
import { DatePicker } from '@/components/ui/date-picker';

/**
 * Compact 形态 —— 弹层是**玻璃**，圆角 **13**（实测）。
 *
 * 比菜单的 34、Popover 的 38 小得多；复核过 Compact 变体的
 * `Fill + Shadow` 与 `Glass Effect` 两层，都写着 13。
 *
 * ⚠️ 触发器打开时**只有文字变蓝**，底色不变 —— 也是实测。
 */
export default function DatePickerDemo() {
  const [date, setDate] = React.useState<Date | null>(new Date(2026, 3, 12));
  return (
    <div className="flex flex-col items-center gap-3">
      <DatePicker
        value={date}
        onValueChange={setDate}
        today={new Date(2026, 3, 1)}
        label="选择日期"
        time="9:41 AM"
      />
      <span className="text-[13px] text-[var(--lg-label-secondary)]">
        右边那一枚是<strong className="font-medium">只读</strong>的 —— 时间滚轮是另一个控件，本批没有量。
      </span>
    </div>
  );
}
