'use client';

import * as React from 'react';
import { Combobox } from '@/components/ui/combobox';

/**
 * ⚠️ iOS 没有可输入的下拉框 —— 参考只能是 **macOS NSComboBox**
 * （与 Checkbox / Radio 同一种情况）。
 *
 * 取的是**结构与状态**（文本域 + 尾部按钮 + 三档按钮底色 0.08 / 0.16 / 0.04），
 * **不取尺度**：macOS 那份是 24 高、13 号字，本库基准是 iOS 的 44 / 17。
 */
export default function ComboboxDemo() {
  const [value, setValue] = React.useState<string | null>('sf');
  const options = [
    { value: 'sf', label: 'San Francisco' },
    { value: 'cupertino', label: 'Cupertino' },
    { value: 'seattle', label: 'Seattle' },
    { value: 'austin', label: 'Austin' },
    { value: 'nyc', label: 'New York', disabled: true },
  ];
  return (
    <div className="flex flex-col items-start gap-3" style={{ width: 260 }}>
      <Combobox
        options={options}
        value={value}
        onValueChange={setValue}
        aria-label="城市"
        placeholder="输入或选择城市"
      />
      <span className="text-[13px] text-[var(--lg-label-secondary)]">
        当前：{options.find((o) => o.value === value)?.label ?? '（无）'}
      </span>
    </div>
  );
}
