'use client';

import * as React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

/**
 * ⚠️ 组本身必须有名字。这里用 `aria-label` ——
 * 没有名字时屏幕阅读器只会读出「单选组」，读不出这组在问什么。
 */
export default function RadioGroupDemo() {
  const [value, setValue] = React.useState('standard');
  return (
    <RadioGroup value={value} onValueChange={setValue} aria-label="配送方式">
      <RadioGroupItem value="standard">标准配送（3–5 天）</RadioGroupItem>
      <RadioGroupItem value="express">次日达</RadioGroupItem>
      <RadioGroupItem value="pickup">到店自提</RadioGroupItem>
      <RadioGroupItem value="freight" disabled>
        大件物流（本地区不支持）
      </RadioGroupItem>
    </RadioGroup>
  );
}
