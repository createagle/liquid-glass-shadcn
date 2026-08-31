# shadcn registry 分发

> Phase 0 研究笔记。抓取 / 实测日期 **2026-08-31**。
> CLI 实测版本 **shadcn 4.19.0**。

## 0. 两条必须先记下的实测结论

### 0.1 `pnpm dlx shadcn@latest` 在本机崩溃 `[实测]`

PROJECT_SPEC §11.2 规定的命令是 `pnpm dlx shadcn@latest build`。**它跑不起来**：

```
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './v3' is not defined by
"exports" in .../@modelcontextprotocol/sdk/1.30.0/.../zod/package.json
imported from .../@modelcontextprotocol/sdk/dist/esm/server/zod-compat.js
```

`pnpm dlx` 的扁平化解析给 `@modelcontextprotocol/sdk`（shadcn 的 MCP 子命令依赖）
装了不兼容的 zod 版本。

**`npx --yes shadcn@latest` 完全正常**（同一台机器、同一个 Node 24.16.0）。

→ **修订 PROJECT_SPEC §11.2**：文档与 CI 一律用
```bash
npx --yes shadcn@latest build
```
或把 `shadcn` 作为 devDependency 装进 `apps/www` 后用 `pnpm exec shadcn build`
（后者最稳，能锁版本，推荐）。**不要用 `pnpm dlx`。**

### 0.2 CLI 自带 registry 校验命令 `[实测]`

PROJECT_SPEC §11.2 要求「CI 必须包含 registry.json schema 校验」，
但没说用什么工具。CLI 里已经有了：

```bash
npx shadcn@latest registry validate [registry]
```

→ CI 直接用它，不需要自己写 JSON Schema 校验脚本。

## 1. CLI 命令全貌 `[实测]`

```
shadcn 4.19.0

init|create      initialize your project and install dependencies
apply            apply a preset to an existing project
add              add a component to your project
docs             get docs, api references and usage examples for components
view             view items from the registry
search|list      search items from registries
migrate          run a migration
eject            inline shadcn/tailwind.css and remove the shadcn dependency
info             get information about your project
build            build components for a shadcn registry
mcp              MCP server and configuration commands
preset           manage presets
registry         manage registries  (add | validate)
```

### `build` 的实测签名

```
Usage: shadcn build [options] [registry]

Arguments:
  registry             path to registry.json file (default: "./registry.json")

Options:
  -o, --output <path>  destination directory for json files (default: "./public/r")
  -c, --cwd <cwd>      the working directory
```

→ 默认输入 `./registry.json`、默认输出 `./public/r`，
与 PROJECT_SPEC §4 的仓库结构（`apps/www/registry.json` → `apps/www/public/r/`）天然吻合，
只要在 `apps/www` 目录下执行即可，不需要传参。

## 2. `registry.json`

`$schema`: `https://ui.shadcn.com/schema/registry.json`
— <https://ui.shadcn.com/docs/registry/registry-json>

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `$schema` | string | 是 | schema URL |
| `name` | string | 根文件必填 | 注册表标识，用于 data 属性与元数据 |
| `homepage` | string | 根文件必填 | 注册表主页 |
| `include` | array | 否 | 指向其他 `registry.json` 的路径，用于拆分组合 |
| `items` | array | 否 | registry item 数组，默认空数组 |

**规则：**

- 根 `registry.json` 必须至少有 `items` 或 `include` 其一。
- `include` 必须指向**明确的 `registry.json` 文件**，不支持只写目录。
- **item 的 `name` 必须在所有被解析的注册表中全局唯一。**
- 被 `include` 的子文件可以省略 `name` 与 `homepage`。
- 用 `include` 时，> "file paths are relative to the `registry.json` file that declares the item."
  ← **这条很容易踩坑**：子 registry 里的 `files[].path` 是相对于**该子文件**，不是相对于根。

`build` 会> "resolve the included registries and write a flattened registry to your output directory."

## 3. `registry-item.json`

`$schema`: `https://ui.shadcn.com/schema/registry-item.json`
— <https://ui.shadcn.com/docs/registry/registry-item-json>

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | 唯一标识 |
| `title` | 是 | 人类可读短标题 |
| `description` | 是 | 用途说明 |
| `type` | 是 | 见下表 |
| `files` | 是 | `{ path, type, target? }` 数组 |
| `author` | 否 | |
| `dependencies` | 否 | npm 包，支持 `pkg@version` |
| `devDependencies` | 否 | |
| `registryDependencies` | 否 | 裸名 / 命名空间 / GitHub / URL / 文件路径 |
| `cssVars` | 否 | `{ theme, light, dark }` |
| `css` | 否 | `@layer` / `@keyframes` / `@utility` / `@plugin` |
| `envVars` | 否 | 写入 `.env.local` / `.env` |
| `font` | 否 | 仅 `registry:font` 需要 |
| `docs` | 否 | 自定义安装提示文案 |
| `categories` | 否 | |
| `meta` | 否 | 任意键值 |
| `tailwind` | 否 | **已废弃**，Tailwind v4 用 `cssVars.theme` |

### `type` 的全部合法值

| type | 用途 | target |
|---|---|---|
| `registry:base` | 整套设计系统 | — |
| `registry:block` | 多文件复杂组件 | — |
| `registry:component` | 简单组件 | — |
| `registry:font` | 字体定义 | — |
| `registry:lib` | 工具库 | — |
| `registry:hook` | React hook | — |
| `registry:ui` | UI 组件 / 单文件原语 | — |
| `registry:page` | 页面 / 路由 | **必填 `target`** |
| `registry:file` | 杂项文件 | **必填 `target`** |
| `registry:style` | 注册表样式（如 new-york） | — |
| `registry:theme` | 主题定义 | — |
| `registry:item` | 通用项 | — |

> PROJECT_SPEC §11.1 列的 5 种（ui / lib / hook / theme / block）都在合法值里，
> 分配方式没问题。补充：**`registry:base` 可以承载「整套设计系统」**，
> 值得考虑用它做一个 `@glass/base` 一键安装项（token + lib + hook 全上）。

### `target` 占位符

| 占位符 | 解析为 |
|---|---|
| `@components/` | `aliases.components` |
| `@ui/` | `aliases.ui` |
| `@lib/` | `aliases.lib` |
| `@hooks/` | `aliases.hooks` |

- 未知占位符（如 `@utils/`）按**字面路径**处理。
- 嵌在中间的占位符（如 `components/@ui/button.tsx`）也按字面处理。
- `~` 表示项目根。

### `cssVars` / `css` 示例（本项目的关键字段）

```json
{
  "cssVars": {
    "theme": { "font-heading": "Poppins, sans-serif" },
    "light": { "brand": "oklch(0.205 0.015 18)", "radius": "0.5rem" },
    "dark":  { "brand": "20 14.3% 4.1%" }
  },
  "css": {
    "@layer base": { "body": { "font-size": "var(--text-base)" } },
    "@keyframes wiggle": {
      "0%, 100%": { "transform": "rotate(-3deg)" },
      "50%": { "transform": "rotate(3deg)" }
    },
    "@utility text-magic": { "font-size": "var(--text-base)" }
  }
}
```

> **对本项目**：三层 token 里凡是组件真正用到的，都要通过 `cssVars` 带过去；
> gooey 融合等动画的 `@keyframes` 通过 `css` 带过去。
> PROJECT_SPEC §11.1 说「不能要求用户手动复制 CSS」—— 这两个字段就是实现手段。

## 4. 源码目录约定

官方约定：registry 源码放 `registry/[STYLE]/[NAME]`，
> "[STYLE] can be anything you want as long as it's nested under the `registry` directory."

硬性要求：
> "**Imports should always use the `@/registry` path.**"

→ 我们的 `apps/www/registry/glass/ui/button.tsx` 里，
引用工具函数必须写 `@/registry/glass/lib/utils`，**不能写相对路径**。
这条如果违反，`add` 到用户项目后 import 会解析不到 —— 是最常见的 registry 事故。

## 5. 分发与安装

### 5.1 静态托管

`build` 产物落在 `public/r/*.json`，Next.js 直接静态服务，
访问 `https://<域名>/r/<name>.json`。

### 5.2 动态路由（可选）

```typescript
// app/r/registry.json/route.ts
import { loadRegistry } from "shadcn/registry"
export async function GET() {
  const registry = await loadRegistry()
  return Response.json(registry)
}
```
（另有 `loadRegistryItem()`）

### 5.3 命名空间安装（PROJECT_SPEC 主推的方式）

用户在 `components.json` 里配：

```json
{
  "registries": {
    "@glass": "https://<域名>/r/{name}.json"
  }
}
```

然后：

```bash
npx shadcn@latest add @glass/button
```

- `{name}` 占位符**必填**，会被替换成资源名。
- 可选占位符 `{style}` 取当前 style 配置。
- 支持一次装多个：`add @glass/button @glass/slider`
- 支持带认证的高级写法：
  ```json
  {
    "registries": {
      "@private": {
        "url": "https://api.company.com/registry/{name}.json",
        "headers": { "Authorization": "Bearer ${REGISTRY_TOKEN}" },
        "params": { "version": "latest" }
      }
    }
  }
  ```
  `${VAR}` 从环境变量展开（`.env.local`）。本项目是公开注册表，用不到，但文档站可以提一句。

— <https://ui.shadcn.com/docs/registry/namespace>

### 5.4 直链安装

```bash
npx shadcn@latest add https://<域名>/r/button.json
```

### 5.5 调试用命令 `[实测可用]`

```bash
npx shadcn@latest list http://localhost:3000/r/registry.json
npx shadcn@latest search http://localhost:3000/r/registry.json --query button
npx shadcn@latest view http://localhost:3000/r/button.json
```

## 6. 给 Phase 5 的 CI 清单

PROJECT_SPEC §11.2 要求「schema 校验 + 真实安装冒烟测试」。落地为：

1. `npx shadcn@latest registry validate apps/www/registry.json` —— schema 校验（CLI 自带）
2. `cd apps/www && npx shadcn@latest build` —— 构建
3. 起本地静态服务，`npx shadcn@latest list http://localhost:3000/r/registry.json` —— 产物可读
4. 在临时干净 Next.js 工程里 `add` 每个 item 并 `next build` —— 冒烟
5. 两种安装方式都要覆盖：直链 + 命名空间

> ⚠️ CI 里**不要用 `pnpm dlx`**（见 §0.1）。

## 7. 未核实

- [ ] `https://ui.shadcn.com/docs/registry/api-reference` 未读
- [ ] `https://ui.shadcn.com/docs/changelog/2026-05-registry-include` 未读
      （`include` 的字段说明已从 registry-json 页拿到，但 changelog 里可能有额外约束）
- [ ] `https://github.com/shadcn-ui/registry-template` 模板仓库未读
- [ ] `registry:base` 与 `preset` 子命令的关系未查 —— 可能影响「一键安装整套主题」的做法
- [ ] 未实测：`cssVars` 在真实 `add` 时是否会正确合并进用户已有的 `globals.css`
      （**这是本项目最关键的一条，Phase 5 必须实测**）
