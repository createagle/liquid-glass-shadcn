'use client';

import * as React from 'react';
import { Slider } from '@/components/ui/slider';

/**
 * 双 knob（区间）。
 *
 * ⚠️ 一个无障碍限制：`aria-label` 会同时挂到**每一个** knob 上，
 * 于是两个 knob 读出来是同一个名字。Radix 本身也没有区分它们的入口，
 * 本库不做猜测 —— 需要区分就自己控制、并给容器加说明文字。
 */
export default function SliderRange() {
  const [range, setRange] = React.useState([25, 75]);
  return (
    <div className="flex w-full max-w-[250px] flex-col gap-3">
      <Slider value={range} onValueChange={setRange} max={100} step={1} aria-label="价格区间" />
      <span className="text-center text-[13px] text-[var(--lg-label-secondary)]">
        ¥{range[0]} – ¥{range[1]}
      </span>
    </div>
  );
}
