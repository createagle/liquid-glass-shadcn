'use client';

import * as React from 'react';
import { Slider } from '@/components/ui/slider';

export default function SliderDemo() {
  const [value, setValue] = React.useState([62]);
  return (
    <div className="flex w-full max-w-[250px] flex-col gap-3">
      <Slider value={value} onValueChange={setValue} max={100} step={1} aria-label="音量" />
      <span className="text-center text-[13px] text-[var(--lg-label-secondary)]">{value[0]}%</span>
    </div>
  );
}
