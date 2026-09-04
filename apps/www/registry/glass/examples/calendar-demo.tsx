'use client';

import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';

/**
 * ⚠️ **这个组件一句玻璃都没有，而且这次有 Apple 自证。**
 *
 * 资源里同一个日历有两个变体：`Style=Inline`（嵌在内容里）是**纯白不透明**，
 * `Style=Compact`（弹出层）才是玻璃。PROJECT_SPEC §2 那条
 * 「内容型组件不堆玻璃」通常只能靠推理，这次资源直接给了证据。
 */
export default function CalendarDemo() {
  const [date, setDate] = React.useState<Date | null>(new Date(2026, 3, 12));
  return (
    <div className="flex flex-col items-center gap-3">
      <Calendar
        selected={date}
        onSelect={setDate}
        today={new Date(2026, 3, 1)}
        month={new Date(2026, 3, 1)}
      />
      <span className="text-[13px] text-[var(--lg-label-secondary)]">
        选中：{date ? date.toLocaleDateString('en-US') : '（无）'}
      </span>
    </div>
  );
}
