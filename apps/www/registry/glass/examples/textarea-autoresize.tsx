'use client';

import * as React from 'react';
import { Textarea } from '@/components/ui/textarea';

/**
 * `autoResize` —— 随内容长高，不出滚动条。
 *
 * 删字时也要缩回去：实现里每次输入先把 height 归零再读 scrollHeight，
 * 少了归零那一步元素就只会长不会缩。
 */
export default function TextareaAutoResize() {
  const [text, setText] = React.useState(
    ['往里打几行字，', '框会跟着长高，', '删掉又会缩回去。'].join('\n'),
  );
  const lines = text.split('\n').length;
  return (
    <div className="flex w-full max-w-[370px] flex-col gap-2">
      <Textarea
        autoResize
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="自动长高"
      />
      <span className="text-[13px] text-[var(--lg-label-secondary)]">
        {lines} 行 · {text.length} 字
      </span>
    </div>
  );
}
