/**
 * 表单一批的渲染验证台：Input / Textarea / Label / Field。
 *
 * `?only=reference` 渲染的是**照着 iOS 27 参考图的构图** ——
 * 370 宽的分组区块、四行文本框（占位符 / 空 / 有值+清除 / 有值）、页面底色 #f2f2f7。
 * 与 screenshots/ios27-list-screen.png 并排才比得了，所以尺寸必须写死一致。
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@glass/core';
import { Card, CardRow } from '../registry/glass/ui/card';
import { Input } from '../registry/glass/ui/input';
import { Textarea } from '../registry/glass/ui/textarea';
import { Label } from '../registry/glass/ui/label';
import { Field, FieldDescription, FieldError } from '../registry/glass/ui/field';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const only = params.get('only');

/** 参考图的构图。四行的状态与 ios27-list-screen.png 逐行对应。 */
function ReferenceList() {
  const [third, setThird] = React.useState('Value');
  return (
    <div data-testid="row-reference" style={{ width: 370 }}>
      <Card>
        <CardRow>
          <Input variant="list" placeholder="Placeholder" aria-label="placeholder" />
        </CardRow>
        <CardRow>
          <Input variant="list" aria-label="empty" />
        </CardRow>
        <CardRow>
          <Input
            variant="list"
            value={third}
            onChange={(e) => setThird(e.target.value)}
            clearable
            aria-label="value-with-clear"
          />
        </CardRow>
        <CardRow>
          <Input variant="list" defaultValue="Value" aria-label="value" />
        </CardRow>
      </Card>
    </div>
  );
}

/** 独立成框的那一支 —— 无 Apple 参考，几何全是推定值 */
function FieldVariants() {
  return (
    <div data-testid="row-field" className="flex flex-col gap-3" style={{ width: 370 }}>
      <Input placeholder="Placeholder" aria-label="field-placeholder" />
      <Input defaultValue="Value" clearable aria-label="field-clearable" />
      <Input placeholder="Disabled" disabled aria-label="field-disabled" />
      <Input placeholder="Invalid" aria-invalid aria-label="field-invalid" />
    </div>
  );
}

function TextareaVariants() {
  const [text, setText] = React.useState('one');
  return (
    <div data-testid="row-textarea" className="flex flex-col gap-3" style={{ width: 370 }}>
      <Textarea placeholder="Placeholder" aria-label="textarea-placeholder" />
      <Textarea
        autoResize
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="textarea-autoresize"
      />
      <div data-testid="textarea-list" style={{ width: 370 }}>
        <Card>
          <CardRow>
            <Textarea variant="list" placeholder="Notes" aria-label="textarea-list" />
          </CardRow>
        </Card>
      </div>
    </div>
  );
}

/** Field 的接线：id / htmlFor / aria-describedby / aria-invalid */
function FieldWiring() {
  const [invalid, setInvalid] = React.useState(false);
  return (
    <div data-testid="row-wiring" className="flex flex-col gap-3" style={{ width: 370 }}>
      <Field invalid={invalid}>
        <Label>电子邮件</Label>
        <Input placeholder="you@example.com" />
        <FieldDescription>我们只用它发登录链接。</FieldDescription>
        <FieldError>{invalid ? '请填写一个有效的电子邮件地址。' : null}</FieldError>
      </Field>
      <button type="button" data-testid="toggle-invalid" onClick={() => setInvalid((v) => !v)}>
        toggle invalid
      </button>

      {/* 只有说明、没有错误 —— describedby 里不该出现悬空的 error id */}
      <Field>
        <Label>昵称</Label>
        <Input aria-label="nickname" />
        <FieldDescription>随时可以改。</FieldDescription>
      </Field>

      {/* 光秃秃的 Field：既没说明也没错误，describedby 应当完全不存在 */}
      <Field>
        <Label>裸字段</Label>
        <Input aria-label="bare" />
      </Field>
    </div>
  );
}

function Demo() {
  if (only === 'reference') return <ReferenceList />;
  if (only === 'field') return <FieldVariants />;
  if (only === 'textarea') return <TextareaVariants />;
  if (only === 'wiring') return <FieldWiring />;
  return (
    <div className="flex flex-col gap-6">
      <ReferenceList />
      <FieldVariants />
      <TextareaVariants />
      <FieldWiring />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <GlassProvider defaultTheme={theme} defaultTint={tint} tier={tier}>
    <Demo />
  </GlassProvider>,
);

queueMicrotask(() => {
  (window as unknown as { __ready?: boolean }).__ready = true;
});
