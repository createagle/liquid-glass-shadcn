import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ComponentPreview } from '@/components/component-preview';
import { InstallTabs } from '@/components/install-tabs';
import { ApiTable, GeometryTable, AppleReference } from '@/components/api-table';
import { CodeBlock } from '@/components/code-block';
import { RichText } from '@/components/rich-text';
import { FidelitySheet, NoFidelity } from '@/components/fidelity-sheet';
import {
  registryItems,
  getRegistryItem,
  getApi,
  getEditorial,
  getFidelity,
  NO_FIDELITY,
} from '@/lib/registry';

/**
 * 组件页模板 —— PROJECT_SPEC §12 的页内结构。
 *
 * 页内结构：Preview/Code · 安装命令 tabs · Examples · **Fidelity 对照** · API Reference。
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
  const fid = getFidelity(slug);
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
            {/*
              ⚠️ 这两段也要走 RichText。它们和 description 一样写着 `**重点**` 与
              `` `代码` ``，直接插进 JSX 会把星号与反引号**原样露出来** ——
              Table 那页的「**明令禁止**」就这样露了一路，直到 Sidebar 这批才发现。
            */}
            <RichText text={editorial.layerB} />
            {editorial.layerI ? (
              <>
                {' · Layer I = '}
                <RichText text={editorial.layerI} />
              </>
            ) : (
              ' · 没有 Layer I'
            )}
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
        hint="左边是 Apple 的 Figma 渲染图，不是真机截图 —— 可比的是几何，不是材质"
      >
        {fid ? <FidelitySheet sheet={fid} /> : <NoFidelity reason={NO_FIDELITY[slug]} />}
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
