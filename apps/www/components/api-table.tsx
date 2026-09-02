/**
 * API Reference —— **全部来自 `scripts/generate-api.mjs`**（PROJECT_SPEC §12
 * 明确要求「从 TS 类型自动生成，不要手写」）。
 *
 * 三张表：
 *   1. props    —— 接口自己声明的成员 + JSDoc + 从解构参数读到的默认值
 *   2. 尺寸常量 —— `*GEOMETRY` 这类 `as const` 对象，**连同可信度标注**
 *   3. 继承说明 —— 继承来的部分不摊平，写成一行人话（理由见生成脚本的文件头）
 *
 * 这是服务端组件：数据是构建期产物，没有任何交互，不进客户端包。
 */

import { GlassSurface } from '@glass/core';
import { RichText } from '@/components/rich-text';
import type { ApiComponent } from '@/lib/registry';

/** 可信度标注 —— 本库的核心纪律：数字必须能说出出处（PROJECT_SPEC §15） */
const CREDIBILITY: { key: string; label: string; tone: string }[] = [
  { key: '[官方]', label: '官方', tone: 'var(--lg-on-glass-green)' },
  { key: '[实测]', label: '实测', tone: 'var(--lg-on-glass-blue)' },
  { key: '[推定]', label: '推定', tone: 'var(--lg-on-glass-orange)' },
  { key: '[待核实]', label: '待核实', tone: 'var(--lg-on-glass-red)' },
];

function CredibilityBadges({ doc }: { doc: string }) {
  const hits = CREDIBILITY.filter((c) => doc.includes(c.key));
  if (!hits.length) return null;
  return (
    <span className="ml-2 inline-flex gap-1 align-middle">
      {hits.map((h) => (
        <span
          key={h.key}
          className="rounded-full px-2 py-0.5 text-[11px] leading-none font-medium"
          style={{ color: h.tone, background: 'var(--lg-fill-quaternary)' }}
        >
          {h.label}
        </span>
      ))}
    </span>
  );
}

/**
 * 可信度方括号已经用徽章表示了，正文里去掉避免重复。
 *
 * ⚠️ 连同它外面可能包着的 `**` / 反引号一起去 —— 源码里写的是
 * `` **`[推定]`** `` 这种形式，只摘掉方括号会在页面上留下一串裸星号。
 */
const CREDIBILITY_RE = /\*{0,2}`?\[(?:官方|实测|推定|待核实)\]`?\*{0,2}/g;

function stripCredibility(doc: string) {
  return doc.replace(CREDIBILITY_RE, '').replace(/\s{2,}/g, ' ').trim();
}

function Th({ children, w }: { children: React.ReactNode; w?: string }) {
  return (
    <th
      className="border-b border-[var(--lg-separator)] px-3 py-2 text-left text-[13px] font-medium text-[var(--lg-label-secondary)]"
      style={w ? { width: w } : undefined}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`border-b border-[var(--lg-separator)] px-3 py-2.5 align-top ${className ?? ''}`}>
      {children}
    </td>
  );
}

export function ApiTable({ api }: { api: ApiComponent }) {
  return (
    <div className="flex flex-col gap-8">
      {api.propGroups.map((group) => (
        <section key={group.interface} className="flex flex-col gap-3">
          <h3 className="font-mono text-[15px] font-semibold">{group.interface}</h3>

          {group.heritage.length ? (
            <ul className="flex flex-col gap-1 text-[13px] text-[var(--lg-label-secondary)]">
              {group.heritage.map((h) => (
                <li key={h.text}>
                  ↳ {h.summary}
                  <span className="ml-2 font-mono text-[var(--lg-label-tertiary)]">{h.text}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {group.props.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[14px]">
                <thead>
                  <tr>
                    <Th w="22%">Prop</Th>
                    <Th w="30%">类型</Th>
                    <Th w="14%">默认值</Th>
                    <Th>说明</Th>
                  </tr>
                </thead>
                <tbody>
                  {group.props.map((p) => (
                    <tr key={p.name}>
                      <Td className="font-mono text-[13px]">
                        {p.name}
                        {p.required ? (
                          <span
                            className="ml-1 text-[11px]"
                            style={{ color: 'var(--lg-on-glass-red)' }}
                            title="必填"
                          >
                            *
                          </span>
                        ) : null}
                      </Td>
                      <Td className="font-mono text-[12px] break-words text-[var(--lg-label-secondary)]">
                        {p.type}
                      </Td>
                      <Td className="font-mono text-[12px] text-[var(--lg-label-secondary)]">
                        {p.default ?? '—'}
                      </Td>
                      <Td className="text-[13px] whitespace-pre-line text-[var(--lg-label-secondary)]">
                        {p.doc ? <RichText text={p.doc} /> : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-[var(--lg-label-tertiary)]">
              这个接口没有自己声明的成员 —— 属性全部来自上面列出的继承。
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * 尺寸常量表。**这一张是本库区别于普通 UI 库的地方** ——
 * 每一个数字旁边都标着它是官方值、实测值还是推定值，而且标注直接来自源码注释，
 * 不是文档里另外维护的一份说明。
 */
export function GeometryTable({ api }: { api: ApiComponent }) {
  if (!api.constants.length) return null;
  return (
    <div className="flex flex-col gap-6">
      {api.constants.map((konst) => (
        <section key={konst.name} className="flex flex-col gap-3">
          <h3 className="font-mono text-[15px] font-semibold">
            {konst.name}
            {konst.exported ? (
              <span className="ml-2 text-[12px] font-normal text-[var(--lg-label-tertiary)]">
                （已导出，可直接 import）
              </span>
            ) : null}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[14px]">
              <thead>
                <tr>
                  <Th w="24%">键</Th>
                  <Th w="16%">值</Th>
                  <Th>依据</Th>
                </tr>
              </thead>
              <tbody>
                {konst.entries.map((e) => (
                  <tr key={e.key}>
                    <Td className="font-mono text-[13px]">{e.key}</Td>
                    <Td className="font-mono text-[13px]">{e.value}</Td>
                    <Td className="text-[13px] whitespace-pre-line text-[var(--lg-label-secondary)]">
                      <CredibilityBadges doc={e.doc} />
                      <RichText className="ml-1" text={stripCredibility(e.doc) || '—'} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

/** 组件源码文件头那段 `// APPLE REFERENCE:` 注释，原样搬过来 */
export function AppleReference({ lines }: { lines: string[] | null }) {
  if (!lines?.length) return null;
  return (
    <GlassSurface layer="base" radius={18} continuous className="overflow-hidden">
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7] whitespace-pre-wrap text-[var(--lg-label-secondary)]">
        {lines.join('\n')}
      </pre>
    </GlassSurface>
  );
}
