'use client';

import * as React from 'react';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { Input } from '@/components/ui/input';

/**
 * 框由 group 画，输入框自己不画 —— 所以里面的 Input 必须传 `variant="list"`。
 * 忘了传的话 dev 模式会警告：两层玻璃叠在一起，材质翻倍、圆角对不齐。
 *
 * 装饰性附件（￥）渲染成 `aria-hidden` 的 span，不进无障碍树；
 * 可点的附件才是真的 button，而且命中区撑到 44×44（HIG）。
 */
export default function InputGroupDemo() {
  const [amount, setAmount] = React.useState('');
  return (
    <div className="flex w-full max-w-[370px] flex-col gap-3">
      <InputGroup>
        <InputGroupAddon>￥</InputGroupAddon>
        <Input
          variant="list"
          inputMode="decimal"
          placeholder="0.00"
          aria-label="金额"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <InputGroupAddon>CNY</InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupAddon>🔍</InputGroupAddon>
        <Input variant="list" placeholder="搜索" aria-label="搜索" />
      </InputGroup>
    </div>
  );
}
