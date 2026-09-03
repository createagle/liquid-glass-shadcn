import registry from '@/registry.json';
import api from '@/__registry__/api.json';
import fidelity from '@/__registry__/fidelity.json';

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
  tabs: { layerB: '底座', layerI: '选中指示器', examples: ['tabs-demo', 'tabs-tabbar'] },
  slider: { layerB: '轨道', layerI: 'knob', examples: ['slider-demo', 'slider-range'] },
  switch: { layerB: '轨道', layerI: 'knob', examples: ['switch-demo', 'switch-in-list'] },
  button: {
    layerB: '静止：底座',
    layerI: '按下：升级为 Layer I',
    examples: ['button-variants', 'button-sizes'],
  },
  toggle: {
    layerB: '未选中：底座',
    layerI: '选中：Layer I',
    examples: ['toggle-demo', 'toggle-sizes'],
  },
  dialog: { layerB: '面板', layerI: null, examples: ['dialog-demo', 'dialog-single'] },
  card: {
    layerB: '内容层（不堆玻璃）',
    layerI: null,
    examples: ['card-demo', 'card-variants'],
  },
  sheet: { layerB: '面板', layerI: 'grabber 抓手', examples: ['sheet-demo', 'sheet-detents'] },
  popover: {
    layerB: '弹层面板',
    layerI: '（属于菜单项，见 DropdownMenu）',
    examples: ['popover-demo', 'popover-sides'],
  },
  'dropdown-menu': {
    layerB: '弹层面板',
    layerI: '高亮项',
    examples: ['dropdown-menu-demo', 'dropdown-menu-desktop'],
  },
  select: { layerB: '弹层面板', layerI: '高亮项', examples: ['select-demo', 'select-groups'] },
  'responsive-overlay': {
    layerB: '取决于落到哪条路径',
    layerI: null,
    examples: ['responsive-overlay-demo', 'responsive-overlay-escape'],
  },
  input: {
    layerB: 'field：磨砂胶囊 / list：不画框',
    layerI: null,
    examples: ['input-list', 'input-field'],
  },
  textarea: {
    layerB: '弱 B（field）/ 不画框（list）',
    layerI: null,
    examples: ['textarea-field', 'textarea-autoresize'],
  },
  label: {
    layerB: '内容层（不堆玻璃）',
    layerI: null,
    examples: ['label-demo', 'label-required'],
  },
  field: {
    layerB: '内容层（不堆玻璃）',
    layerI: null,
    examples: ['field-demo', 'field-validation'],
  },
};

export function getEditorial(slug: string): ComponentEditorial | undefined {
  return EDITORIAL[slug];
}

/* ── Fidelity 对照 ───────────────────────────────────────────────────── */

export interface FidelitySheet {
  slug: string;
  /** 只有两栏的那一版 —— 说明文字由页面单独渲染，避免同一段并排两遍 */
  image: string;
  /** 整张（含说明）。给「另存 / 贴到别处」用 */
  fullImage: string;
  title: string;
  captions: string[];
  /** 差异说明。来自 dev/fidelity.html 里那段 `.note`，不是文档站另写的 */
  notes: string[];
}

const fidelitySheets = fidelity as unknown as Record<string, FidelitySheet>;

export function getFidelity(slug: string): FidelitySheet | undefined {
  return fidelitySheets[slug];
}

/**
 * **没有对照图的组件，必须说清楚为什么。**
 *
 * 这一份是人写的，而且刻意不给默认文案 —— 缺一条就是页面上一句
 * 「（还没写原因）」，比一句敷衍的「暂无对照图」诚实。
 */
export const NO_FIDELITY: Record<string, string> = {
  toggle:
    '**没有属于 Toggle 自己的 Apple 参考图。** 在 iOS 27 设计资源里找过 —— Edit Menu 是 Cut/Copy/Paste，' +
    '不是格式化开关；文件里也没有单独的 Toggle 组件页。所以它的几何**全部继承自 Button**' +
    '（那边是两处独立节点实测出来的），选中态的材质沿用 Tabs 指示器。' +
    '每个数字都有来源，只是来源是本库的另外两个组件 —— 去看 Button 与 Tabs 的对照图。',
  popover:
    '**Popover 的圆角是唯一一个量不出来的几何。** 它是半透明玻璃压在中灰背景上，' +
    '外面有落影、里面还有一道亮描边，边缘不是干净的两色台阶 —— 轮廓拟合不收敛' +
    '（圆弧 RMSE 1.5–2.2px，自由超椭圆里半径与指数强烈互换）。' +
    '既然连几何都对不齐，并排图只会给人「已经比过了」的错觉，所以不做。' +
    '面板本身的材质与 DropdownMenu 同源，去看那一张。',
  select:
    '**参考图里没有任何带选中态的菜单。** Select 的弹层与 DropdownMenu 是同一块材质、' +
    '同一套几何（250 / 10 / 16 / 40 / 21），已经在 DropdownMenu 那张里比过了；' +
    '再做一张只是同一张图换个标题。**对勾画在哪一列是推定的**，' +
    '本来也没有参考图可比 —— 见「尺寸常量与可信度」表里那两个橙色徽章。',
  'responsive-overlay':
    '**这是一个行为原语，不是一个有外观的组件。** 它按视口决定渲染成 Popover 还是 Sheet，' +
    '外观完全由那两个组件提供 —— 对照图应该去看它们各自那一张。',
  input:
    '**参考图有，但并排比不了。** 官方资源里那四行 Text Field 已经逐像素量过了' +
    '（scripts/measure-textfield.mjs），而量出来的结论是「iOS 的表单文本框没有自己的框」——' +
    '所以 `variant="list"` 那一支能比的只有一条 1pt 分隔线和文字的左内缩，' +
    '而 `variant="field"`（默认那个玻璃胶囊）**在参考图里根本不存在**，' +
    '并排放会让人以为右边那个也是照着左边做的。数值对照在下面的「尺寸常量与可信度」表里，' +
    '每一条标着是实测还是推定。',
  textarea:
    '**官方资源里没有多行输入。** 那几块 Grouped List 全是单行 Text Field，' +
    '翻遍了也没找到 UITextView 的样例。与 Input 共享的部分（字号 17、占位符处理）' +
    '沿用那边的实测值，多行特有的部分（最小高度、行高、竖向内边距）**全是推定**。' +
    '没有图就是没有图，不拿单行的那张图充数。',
  label:
    '**Label 不是一个 Apple 控件**，component-inventory 里就标着「无 Apple 控件对应，属排版」。' +
    '唯一有依据的数字是字号 17（Grouped List 行标签实测），而那个数字在 Card 的对照图里已经比过了。',
  field:
    '**这是一个接线组件，没有自己的外观。** 它产出的是 id / aria-describedby / aria-invalid，' +
    '不是像素。而且 iOS 把说明文字放在 **Section footer** 里、行内并不带说明 ——' +
    '连「四段式表单行」这个形态本身都没有 Apple 参考。' +
    '值得看的不是对照图，是下面 API 表里那几条 aria 的接法。',
};
