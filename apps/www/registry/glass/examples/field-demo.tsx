'use client';

import { Field, FieldDescription } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/**
 * Field 把三样东西自动接对：控件的 id、Label 的 htmlFor、
 * 以及控件的 aria-describedby 指向说明文字。
 *
 * 这里一个 id 都没手写。
 */
export default function FieldDemo() {
  return (
    <div className="w-full max-w-[370px]">
      <Field>
        <Label>显示名称</Label>
        <Input placeholder="出现在你的个人页上" />
        <FieldDescription>2–32 个字符，之后可以随时改。</FieldDescription>
      </Field>
    </div>
  );
}
