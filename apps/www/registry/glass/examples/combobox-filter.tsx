'use client';

import * as React from 'react';
import { Combobox } from '@/components/ui/combobox';

/**
 * 打字过滤。
 *
 * ⚠️ 默认的过滤是**大小写不敏感的子串匹配**，没有拼音、没有模糊、没有权重排序 ——
 * 那些是 `Command` 的活，而 `Command` 本批没做。别指望它。
 * 要别的规则就传 `filter`。
 */
export default function ComboboxFilter() {
  const options = [
    { value: 'zh', label: '中文（简体）' },
    { value: 'zh-tw', label: '中文（繁體）' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
  ];
  return (
    <div className="flex flex-col items-start gap-3" style={{ width: 260 }}>
      <Combobox
        options={options}
        defaultValue="zh"
        aria-label="语言"
        // 同时匹配 label 与 value —— 打 "en" 也能找到 English
        filter={(o, q) =>
          o.label.toLowerCase().includes(q.toLowerCase()) ||
          o.value.toLowerCase().includes(q.toLowerCase())
        }
      />
      <span className="text-[13px] text-[var(--lg-label-secondary)]">
        焦点在输入框上不动，靠 aria-activedescendant 指高亮项 —— 那是 combobox 与 listbox 的分野。
      </span>
    </div>
  );
}
