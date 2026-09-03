'use client';

import * as React from 'react';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { Input } from '@/components/ui/input';

/**
 * 可点附件：显示 / 隐藏密码。
 *
 * ⚠️ `aria-pressed` 是必须的 —— 这个按钮有两个状态，
 * 光换个图标屏幕阅读器读不出来现在是显示还是隐藏。
 */
export default function InputGroupPassword() {
  const [shown, setShown] = React.useState(false);
  return (
    <div className="w-full max-w-[370px]">
      <InputGroup>
        <Input
          variant="list"
          type={shown ? 'text' : 'password'}
          defaultValue="liquid-glass"
          aria-label="密码"
        />
        <InputGroupAddon
          interactive
          aria-pressed={shown}
          aria-label={shown ? '隐藏密码' : '显示密码'}
          onClick={() => setShown((v) => !v)}
        >
          {shown ? '🙈' : '👁'}
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
