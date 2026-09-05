/**
 * Fidelity 对照 —— PROJECT_SPEC §12 里标着「本库独有」的那一节。
 *
 * 图与差异说明**来自同一处**：`dev/fidelity.html`。
 * 对照图是从那个页面渲染出来的（`scripts/fidelity-sheets.mjs`），
 * 说明是从同一个 `.note` 抽出来的（`scripts/generate-fidelity.mjs`）。
 * 文档站不另写一份 —— 改了图忘了改文档，读者看到的差异说明就是错的。
 *
 * ⚠️ 页面上必须先说清楚一件事：**左边不是 iOS 真机截图**，
 * 是 Apple Design Resources 的 Figma 渲染图。静态设计稿画不出折射与色散，
 * 所以「材质」那一栏本来就不可比 —— 可比的是**几何**。
 * 这不是免责声明，是这一整节该怎么读的前提。
 */

import { GlassSurface } from '@glass/core';
import { RichText } from '@/components/rich-text';
import { withBase } from '@/lib/base-path';
import type { FidelitySheet as Sheet } from '@/lib/registry';

export function FidelitySheet({ sheet }: { sheet: Sheet }) {
  return (
    <div className="flex flex-col gap-4">
      <GlassSurface layer="base" radius={18} continuous className="overflow-hidden p-3">
        {/*
          用原生 <img> 而不是 next/image：这些图是**逐像素对照**用的，
          任何自动缩放 / 重编码都会把「差 3px」这种结论抹掉。
          尺寸已知且固定，也不需要懒加载的布局保护。
        */}
        {/*
          ⚠️ 这两张图的路径是 `/fidelity/…` 这种站内绝对路径，**不经过 <Link>**，
          Next 的 basePath 不会管它们 —— 部署到 GitHub Pages 上会全变成 404。
          本地 basePath 为空，怎么看都是对的。所以过一遍 withBase()。
          （这一处正是 scripts/check-export-links.mjs 第一次跑就抓到的。）
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBase(sheet.image)}
          alt={sheet.title}
          className="block h-auto w-full rounded-[10px]"
          loading="lazy"
        />
      </GlassSurface>

      <div className="flex flex-col gap-2 border-l-[3px] border-[var(--lg-separator)] pl-4">
        {sheet.notes.map((line, i) => (
          <p key={i} className="text-[14px] leading-relaxed text-[var(--lg-label-secondary)]">
            <RichText text={line} />
          </p>
        ))}
      </div>

      <p className="text-[13px] text-[var(--lg-label-tertiary)]">
        对照图由 <code className="font-mono">scripts/fidelity-sheets.mjs</code> 渲染，
        右栏是<strong className="font-medium">真实组件</strong>而不是照着尺寸另画的 ——
        组件改了，图会跟着变。{' '}
        <a href={withBase(sheet.fullImage)} className="underline underline-offset-2" download>
          下载整张（含说明）
        </a>
      </p>
    </div>
  );
}

/** 没有对照图时：说清楚为什么，而不是「暂无」 */
export function NoFidelity({ reason }: { reason: string | undefined }) {
  return (
    <p className="max-w-[72ch] text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
      {reason ? (
        <RichText text={reason} />
      ) : (
        // 缺原因就直说缺 —— 比一句敷衍的「暂无对照图」诚实
        <>🔴 这个组件没有对照图，而且**还没写清楚为什么**。缺口记在 lib/registry.ts 的 NO_FIDELITY 里。</>
      )}
    </p>
  );
}
