import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ComponentPreview } from '@/components/component-preview';
import { InstallTabs } from '@/components/install-tabs';
import { ApiTable, GeometryTable, AppleReference } from '@/components/api-table';
import { CodeBlock } from '@/components/code-block';
import { RichText } from '@/components/rich-text';
import { registryItems, getRegistryItem, getApi, getEditorial } from '@/lib/registry';

/**
 * 组件页模板 —— PROJECT_SPEC §12 的页内结构。
 *
 * 本批交付：Preview/Code · 安装命令 tabs · Examples · API Reference。
 * **Fidelity 标签页还没有**（任务卡里排第 4 位，下一批），页面上如实标了缺口，
 * 不做成「即将上线」的空壳。
 *
 * 页面上几乎没有手写内容：
 *   标题 / 描述 / 依赖 / 安装  ← registry.json（发给用户的同一份）
 *   props / 尺寸常量 / APPLE REFERENCE ← 源码的 TS 类型与注释
 *   Preview 与 Code           ← 同一个示例文件
 * 手写的只有分层归属那一行（抄自 PROJECT_SPEC §2 速查表）。
 */

export function generateStaticParams() {
  return registryItems.map((i) => ({ slug: i.name }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = getRegistryItem(slug);
  if (!item) return {};
  return { title: item.title, description: item.description };
}

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-28 flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-[22px] font-semibold">{title}</h2>
        {hint ? <span className="text-[13px] text-[var(--lg-label-tertiary)]">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** 浮层类组件的预览区要更高，否则面板展开会被裁掉 */
const TALL = new Set(['dialog', 'sheet', 'popover', 'dropdown-menu', 'select', 'responsive-overlay']);

export default async function ComponentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getRegistryItem(slug);
  if (!item) notFound();

  const api = getApi(slug);
  const editorial = getEditorial(slug);
  const examples = editorial?.examples ?? [];

  return (
    <article className="flex flex-col gap-12 pb-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-[34px] leading-tight font-semibold tracking-tight">{item.title}</h1>
        <p className="max-w-[68ch] text-[17px] leading-relaxed text-[var(--lg-label-secondary)]">
          <RichText text={item.description} />
        </p>
        {editorial ? (
          <p className="text-[14px] text-[var(--lg-label-tertiary)]">
            <strong className="font-medium">分层（PROJECT_SPEC §2）</strong>：Layer B ={' '}
            {editorial.layerB}
            {editorial.layerI ? ` · Layer I = ${editorial.layerI}` : ' · 没有 Layer I'}
          </p>
        ) : null}
      </header>

      {examples.length ? (
        <Section id="preview" title="预览" hint="切到「代码」看到的就是这段预览的源码本身">
          <ComponentPreview name={examples[0]!} minHeight={TALL.has(slug) ? 320 : 220} />
        </Section>
      ) : null}

      <Section id="installation" title="安装">
        <InstallTabs item={item} />
      </Section>

      {item.docs ? (
        <Section id="notes" title="使用说明" hint="来自 registry item 的 docs 字段">
          <CodeBlock lang="text" code={item.docs} collapseAfter={14} />
        </Section>
      ) : null}

      {examples.length > 1 ? (
        <Section id="examples" title="示例">
          <div className="flex flex-col gap-8">
            {examples.slice(1).map((name) => (
              <ComponentPreview key={name} name={name} minHeight={TALL.has(slug) ? 320 : 220} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        id="fidelity"
        title="Fidelity 对照"
        hint="Apple 参考图 vs 本库组件"
      >
        {/*
          诚实标注：对照图已经生成在 public/fidelity 下，但把它做成一个
          带差异说明的标签页是任务卡里排第 4 位的事，本批没做。
          这里不放「即将上线」的空壳，直接说缺口在哪。
        */}
        <p className="text-[15px] text-[var(--lg-label-secondary)]">
          🔴 <strong className="font-medium">本批未交付。</strong>
          对照图已由 <code className="font-mono">scripts/fidelity-sheets.mjs</code> 生成在{' '}
          <code className="font-mono">public/fidelity/</code> 下，但「并排对照 + 逐条差异说明」
          这一页还没做（Phase 6 任务卡里排第 4 位）。
        </p>
      </Section>

      {api ? (
        <>
          <Section id="api" title="API Reference" hint="从 TS 类型自动生成，不是手写的">
            <ApiTable api={api} />
          </Section>

          {api.constants.length ? (
            <Section
              id="geometry"
              title="尺寸常量与可信度"
              hint="每个数字旁边标着它是官方值、实测值还是推定值"
            >
              <GeometryTable api={api} />
            </Section>
          ) : null}

          {api.appleReference ? (
            <Section id="apple-reference" title="APPLE REFERENCE" hint={`来自 ${api.file} 的文件头`}>
              <AppleReference lines={api.appleReference} />
            </Section>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
