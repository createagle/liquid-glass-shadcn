import registry from '@/registry.json';
import api from '@/__registry__/api.json';

/**
 * 组件页的数据源。
 *
 * **标题、描述、依赖、安装说明一律从 `registry.json` 读** —— 那是分发给用户的
 * 同一份文件。文档站再抄一遍必然会漂：改了 registry 忘了改文档，用户看到的
 * 说明和他装到的东西就对不上了。
 *
 * API 表、尺寸常量、APPLE REFERENCE 则来自 `__registry__/api.json`，
 * 由 `scripts/generate-api.mjs` 从 **TS 类型与源码注释**生成（PROJECT_SPEC §12）。
 */

export interface RegistryItem {
  name: string;
  type: string;
  title: string;
  description: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: { path: string; type: string }[];
  docs?: string;
}

export const registryItems = (registry.items as RegistryItem[]).filter(
  (i) => i.type === 'registry:ui',
);

export function getRegistryItem(slug: string): RegistryItem | undefined {
  return registryItems.find((i) => i.name === slug);
}

/* ── 生成的 API 数据 ─────────────────────────────────────────────────── */

export interface ApiProp {
  name: string;
  type: string;
  required: boolean;
  default: string | null;
  doc: string;
}
export interface ApiPropGroup {
  interface: string;
  props: ApiProp[];
  heritage: { kind: string; text: string; summary: string }[];
}
export interface ApiConstant {
  name: string;
  exported: boolean;
  doc: string;
  entries: { key: string; value: string; doc: string }[];
}
export interface ApiComponent {
  name: string;
  file: string;
  appleReference: string[] | null;
  propGroups: ApiPropGroup[];
  constants: ApiConstant[];
}

const apiComponents = api.components as unknown as Record<string, ApiComponent>;

export function getApi(slug: string): ApiComponent | undefined {
  return apiComponents[slug];
}

/** 可信度标注的统计 —— Docs 页会把它当作一个「站点自检」展示出来 */
export const apiStats = api.stats as { labelled: number; unlabelled: number; missing: string[] };

/* ── 编辑性内容 ──────────────────────────────────────────────────────── */

/**
 * 这一份是**人写的**，不是生成的：分层归属、示例清单、对照图。
 * 分层来自 PROJECT_SPEC §2 的速查表，逐条抄过来（不是我判断的）。
 */
export interface ComponentEditorial {
  /** PROJECT_SPEC §2 速查表里这一行的 Layer B / Layer I 归属 */
  layerB: string;
  layerI: string | null;
  /** examples/ 下的示例名，按显示顺序 */
  examples: string[];
}

export const EDITORIAL: Record<string, ComponentEditorial> = {
  tabs: { layerB: '底座', layerI: '选中指示器', examples: ['tabs-demo'] },
  slider: { layerB: '轨道', layerI: 'knob', examples: ['slider-demo'] },
  switch: { layerB: '轨道', layerI: 'knob', examples: ['switch-demo'] },
  button: { layerB: '静止：底座', layerI: '按下：升级为 Layer I', examples: ['button-variants'] },
  toggle: { layerB: '未选中：底座', layerI: '选中：Layer I', examples: ['toggle-demo'] },
  dialog: { layerB: '面板', layerI: null, examples: ['dialog-demo'] },
  card: { layerB: '内容层（不堆玻璃）', layerI: null, examples: ['card-demo'] },
  sheet: { layerB: '面板', layerI: 'grabber 抓手', examples: ['sheet-demo'] },
  popover: { layerB: '弹层面板', layerI: '（属于菜单项，见 DropdownMenu）', examples: ['popover-demo'] },
  'dropdown-menu': { layerB: '弹层面板', layerI: '高亮项', examples: ['dropdown-menu-demo'] },
  select: { layerB: '弹层面板', layerI: '高亮项', examples: ['select-demo'] },
  'responsive-overlay': {
    layerB: '取决于落到哪条路径',
    layerI: null,
    examples: ['responsive-overlay-demo'],
  },
};

export function getEditorial(slug: string): ComponentEditorial | undefined {
  return EDITORIAL[slug];
}
