'use client';

import * as React from 'react';
import { Card, CardRow } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

/**
 * Switch 真正的落脚点是分组列表行 —— iOS 里几乎从不单独出现。
 * 行高 52、左右内缩 16 都由 Card 提供，Switch 只管自己那 64×28。
 */
export default function SwitchInList() {
  const [wifi, setWifi] = React.useState(true);
  const [airdrop, setAirdrop] = React.useState(false);
  return (
    <Card className="w-full max-w-[370px]">
      <CardRow>
        <span className="flex-1">无线局域网</span>
        <Switch checked={wifi} onCheckedChange={setWifi} aria-label="无线局域网" />
      </CardRow>
      <CardRow>
        <span className="flex-1">隔空投送</span>
        <Switch checked={airdrop} onCheckedChange={setAirdrop} aria-label="隔空投送" />
      </CardRow>
    </Card>
  );
}
