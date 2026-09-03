'use client';

import * as React from 'react';
import { Card, CardRow } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/**
 * `variant="list"` —— **这一支才是逐像素量过的那个形态**。
 *
 * iOS 的表单文本框没有自己的框：没有描边、没有填充、没有玻璃，
 * 就是分组列表里的一行。行高 52、左内缩 16、1pt 分隔线全部由 Card 提供。
 * 官方参考图里的四行状态（占位符 / 聚焦 / 有值 / 有值+清除按钮）在这儿都能试到。
 */
export default function InputList() {
  const [name, setName] = React.useState('Value');
  return (
    // 页边距 16 是实测值：402 的屏减两侧各 16 得到 370 的区块宽。
    // iOS 的分组列表是「白区块压在灰底上」，底色不铺出来就看不出区块边界。
    <div className="w-full max-w-[402px] p-4" style={{ background: 'var(--lg-grouped-bg)' }}>
      <Card className="w-full">
        <CardRow>
          <Input variant="list" placeholder="Placeholder" aria-label="占位符示例" />
        </CardRow>
        <CardRow>
          <Input variant="list" placeholder="" aria-label="空态" />
        </CardRow>
        <CardRow>
          <Input
            variant="list"
            value={name}
            onChange={(e) => setName(e.target.value)}
            clearable
            aria-label="有值 + 清除按钮"
          />
        </CardRow>
        <CardRow>
          <Input variant="list" defaultValue="Value" aria-label="有值" />
        </CardRow>
      </Card>
    </div>
  );
}
