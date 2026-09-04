'use client';

import * as React from 'react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';

export default function CollapsibleDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-[300px]">
      <CollapsibleTrigger>高级选项</CollapsibleTrigger>
      <CollapsibleContent>
        <p className="pt-2 pl-9 text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          这些设置很少需要改动。改错了可以在「重置」里恢复默认值。
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
