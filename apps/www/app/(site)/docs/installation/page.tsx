import { CodeBlock } from '@/components/code-block';
import { registryItems } from '@/lib/registry';

export const metadata = { title: '安装' };

/**
 * 安装页。
 *
 * 命令与 `.github/workflows/registry-smoke.yml` 里跑的**是同一套** ——
 * 那个 workflow 每次 push 都在一个干净的 Next 工程里真的执行一遍。
 * 也就是说这一页的步骤是有 CI 兜底的，不是照着记忆写的。
 */
export default function InstallationPage() {
  return (
    <article className="flex max-w-[76ch] flex-col gap-10 pb-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-[34px] leading-tight font-semibold tracking-tight">安装</h1>
        <p className="text-[17px] leading-relaxed text-[var(--lg-label-secondary)]">
          光学引擎走 npm，组件源码走 shadcn registry。下面四步与 CI
          的安装冒烟测试完全一致 —— 那个 job 每次 push 都会在一个全新的 Next
          工程里真跑一遍。
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">1. 装光学引擎</h2>
        <p className="text-[15px] text-[var(--lg-label-secondary)]">
          滤镜工厂、能力分级、Provider、token 都在这个包里。它{' '}
          <strong className="font-medium">不进 registry</strong> —— 引擎需要能独立升级。
        </p>
        <CodeBlock lang="bash" code={'pnpm add @createagle/glass-core'} />
        <p className="text-[13px] text-[var(--lg-label-tertiary)]">
          🔴 <strong className="font-medium">这个包目前还没发布到 npm。</strong>
          CI 里用的是本地打包 + 一个 npm shim 顶上去的，真实用户现在装不了 ——
          这是本项目长期挂着的第一件事，不在这一页里假装它已经能用。
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">2. 引入 token</h2>
        <p className="text-[15px] text-[var(--lg-label-secondary)]">
          三层 token（原始值 / 材质与角色 / shadcn 兼容层）加三档渲染路径，
          一个入口全带上。
        </p>
        <CodeBlock lang="css" code={"@import 'tailwindcss';\n@import '@createagle/glass-core/theme.css';"} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">3. 注册 @glass 命名空间</h2>
        <p className="text-[15px] text-[var(--lg-label-secondary)]">
          在工程根目录的 <code className="font-mono">components.json</code> 里加一条 registry。
        </p>
        <CodeBlock
          lang="json"
          code={`{
  "registries": {
    "@glass": "https://createagle.github.io/liquid-glass-shadcn/r/{name}.json"
  }
}`}
        />
        <p className="text-[13px] text-[var(--lg-label-tertiary)]">
          这个地址是{' '}
          <strong className="font-medium">真的，现在就能取</strong> —— registry
          产物随文档站一起部署在 GitHub Pages 上，
          <code className="font-mono">/r/registry.json</code> 里是全部 45 个 item。
          <br />
          🔴 但{' '}
          <strong className="font-medium">
            端到端的安装现在还走不通
          </strong>
          ：每个组件都把 <code className="font-mono">@createagle/glass-core</code> 写在{' '}
          <code className="font-mono">dependencies</code> 里，而那个包还没发到 npm，
          <code className="font-mono">shadcn add</code> 会在装依赖这一步失败。
          registry 本身可以取、可以读、可以照着抄，但别指望一条命令装完。
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">4. 挂 Provider</h2>
        <p className="text-[15px] text-[var(--lg-label-secondary)]">
          Provider 负责主题、材质档位、tier 检测与三种无障碍偏好的订阅。
          <strong className="font-medium">别忘了 head 里那段内联脚本</strong> ——
          少了它首屏会闪一下暗色/材质。
        </p>
        <CodeBlock lang="bash" code={'npx shadcn@latest add @glass/glass-providers'} />
        <CodeBlock
          lang="tsx"
          code={`import { glassSsrScript } from '@createagle/glass-core';
import { GlassProviders } from '@/components/glass-providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: glassSsrScript() }} />
      </head>
      <body>
        <GlassProviders>{children}</GlassProviders>
      </body>
    </html>
  );
}`}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">5. 装组件</h2>
        <CodeBlock
          lang="bash"
          code={`npx shadcn@latest add ${registryItems.map((i) => `@glass/${i.name}`).join(' ')}`}
        />
        <p className="text-[15px] text-[var(--lg-label-secondary)]">
          源码会落到你的 <code className="font-mono">components/ui/</code> 下，随便改。
          <code className="font-mono">registryDependencies</code> 会自动把{' '}
          <code className="font-mono">utils</code> 与 theme 一起带进来。
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">一处与 shadcn 生态的差别</h2>
        <p className="text-[15px] leading-relaxed text-[var(--lg-label-secondary)]">
          <strong className="font-medium">本库全库禁用 </strong>
          <code className="font-mono">asChild</code>。原因：当目标工程的 style 以{' '}
          <code className="font-mono">base-</code> 开头时（<code className="font-mono">shadcn init -d</code>{' '}
          现在的默认值），CLI 会把 <code className="font-mono">{'<X asChild><Y/></X>'}</code> 改写成 Base UI 的{' '}
          <code className="font-mono">render</code> prop，而本库组件用的是{' '}
          <code className="font-mono">@radix-ui/react-*</code>，装进去直接类型报错。
          本机 typecheck 查的是改写**前**的源码，永远发现不了 —— 这是冒烟测试真撞出来的。
          要自定义外观就传 <code className="font-mono">className</code>。
        </p>
      </section>
    </article>
  );
}
