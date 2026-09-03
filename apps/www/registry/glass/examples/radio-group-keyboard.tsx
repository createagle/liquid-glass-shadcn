'use client';

import * as React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

/**
 * 单选组的键盘行为与复选框**不一样**，这一格就是给人试的：
 *
 *   Tab      整组只占**一个**停靠点（进到当前选中的那一项）
 *   ↑ ↓ ← →  在组内移动，且**移动即选中**
 *   Space    选中当前项
 *
 * 这套行为由 Radix 实现，不是本库写的 —— 本库负责的是它的皮。
 * 前后各放一个按钮，是为了让 Tab 只跳一次这件事看得见。
 */
export default function RadioGroupKeyboard() {
  const [value, setValue] = React.useState('m');
  return (
    <div className="flex flex-col items-start gap-4">
      <button type="button" className="text-[13px] text-[var(--lg-label-secondary)]">
        ↑ 上一个可聚焦元素
      </button>

      <RadioGroup value={value} onValueChange={setValue} aria-label="尺码">
        <RadioGroupItem value="s">S</RadioGroupItem>
        <RadioGroupItem value="m">M</RadioGroupItem>
        <RadioGroupItem value="l">L</RadioGroupItem>
      </RadioGroup>

      <button type="button" className="text-[13px] text-[var(--lg-label-secondary)]">
        ↓ 下一个可聚焦元素
      </button>

      <p className="text-[13px] text-[var(--lg-label-secondary)]">
        当前：<code>{value}</code>
      </p>
    </div>
  );
}
