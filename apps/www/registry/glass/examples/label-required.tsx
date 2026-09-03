'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/**
 * 必填标记。
 *
 * ⚠️ 星号是**装饰**，必须 aria-hidden，并且真正的必填语义由控件的
 * `required` 属性承担 —— 只画一个红星、控件上不写 required，
 * 屏幕阅读器读不出「这项必填」。
 */
export default function LabelRequired() {
  return (
    <div className="flex w-full max-w-[370px] flex-col gap-2">
      <Label htmlFor="label-required-name">
        姓名
        <span aria-hidden="true" className="text-[var(--lg-destructive-fill)]">
          *
        </span>
      </Label>
      <Input id="label-required-name" required placeholder="必填" />
    </div>
  );
}
