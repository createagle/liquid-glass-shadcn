'use client';

import * as React from 'react';
import { Switch } from '@/components/ui/switch';

export default function SwitchDemo() {
  const [on, setOn] = React.useState(true);
  return (
    <label className="flex items-center gap-4 text-[17px]">
      <span>低电量模式</span>
      <Switch checked={on} onCheckedChange={setOn} />
    </label>
  );
}
