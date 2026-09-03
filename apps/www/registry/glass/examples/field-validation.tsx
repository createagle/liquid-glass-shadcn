'use client';

import * as React from 'react';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * 校验态。
 *
 * 两件事值得看：
 *  1. `FieldError` 带 `role="alert"` —— 点提交时焦点还在按钮上，
 *     光靠 aria-describedby 是**听不见**的，必须让错误自己发声。
 *  2. 没有错误时 `aria-describedby` 里不会出现错误那个 id ——
 *     它是子节点挂载时登记的，不是无条件拼接。悬空的引用多数屏幕阅读器
 *     会静默跳过，测试里完全看不出来。
 */
export default function FieldValidation() {
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const invalid = submitted && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  return (
    <form
      className="flex w-full max-w-[370px] flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
    >
      <Field invalid={invalid}>
        <Label>电子邮件</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          clearable
        />
        <FieldDescription>我们只用它发登录链接。</FieldDescription>
        <FieldError>{invalid ? '请填写一个有效的电子邮件地址。' : null}</FieldError>
      </Field>
      <Button type="submit" variant="prominent" className="self-start">
        提交
      </Button>
    </form>
  );
}
