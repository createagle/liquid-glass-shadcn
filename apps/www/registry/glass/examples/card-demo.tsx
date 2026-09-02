'use client';

import { Card, CardRow } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

export default function CardDemo() {
  return (
    <Card className="w-full max-w-[370px]">
      <CardRow>
        <span className="flex-1">飞行模式</span>
        <Switch aria-label="飞行模式" />
      </CardRow>
      <CardRow>
        <span className="flex-1">无线局域网</span>
        <span className="text-[var(--lg-label-secondary)]">Home-5G</span>
      </CardRow>
      <CardRow interactive>
        <span className="flex-1">蓝牙</span>
        <span className="text-[var(--lg-label-secondary)]">已打开</span>
      </CardRow>
    </Card>
  );
}
