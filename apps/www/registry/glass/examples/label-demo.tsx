'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/**
 * Label 是内容层，**不套任何材质**。它的价值不在样式，在接线 ——
 * 点标签能聚焦到控件。这里没有写 htmlFor，是 Field 自动接上的。
 */
export default function LabelDemo() {
  return (
    <div className="flex w-full max-w-[370px] flex-col gap-2">
      <Label htmlFor="label-demo-email">电子邮件</Label>
      <Input id="label-demo-email" type="email" placeholder="you@example.com" />
    </div>
  );
}
