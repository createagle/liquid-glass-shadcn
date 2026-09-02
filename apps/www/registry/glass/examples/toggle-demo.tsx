'use client';

import { Toggle } from '@/components/ui/toggle';

export default function ToggleDemo() {
  return (
    <div className="flex items-center gap-2">
      <Toggle defaultPressed>B</Toggle>
      <Toggle>I</Toggle>
      <Toggle>U</Toggle>
    </div>
  );
}
