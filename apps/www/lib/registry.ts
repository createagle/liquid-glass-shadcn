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
  progress: {
    layerB: '轨道',
    layerI: null,
    examples: ['progress-demo', 'progress-indeterminate'],
  },
  badge: {
    layerB: '内容层（不堆玻璃）',
    layerI: null,
    examples: ['badge-variants', 'badge-in-list'],
  },
  separator: {
    layerB: '内容层（不堆玻璃）',
    layerI: null,
    examples: ['separator-demo', 'separator-two-colors'],
  },
  skeleton: {
    layerB: '内容层（不堆玻璃）',
    layerI: null,
    examples: ['skeleton-demo', 'skeleton-card'],
  },
  avatar: {
    layerB: '内容层（不堆玻璃）',
    layerI: null,
    examples: ['avatar-demo', 'avatar-sizes'],
  },
  tooltip: {
    layerB: '气泡面板',
    layerI: null,
    examples: ['tooltip-demo', 'tooltip-sides'],
  },
  toast: {
    layerB: '通知面板',
    layerI: null,
    examples: ['toast-demo', 'toast-stack'],
  },
  'input-group': {
    layerB: '整组一块玻璃（输入框自己不画框）',
    layerI: null,
    examples: ['input-group-demo', 'input-group-password'],
  },
  /*
   * ⚠️ 这两行的分层与 PROJECT_SPEC §2 速查表**不一致**，而且是有依据的：
   * 速查表写的是「B + I(瞬时)」，那是在没有 macOS 参考时推的。
   * macOS 27 资源里 36 个变体一个都没有玻璃 ——
   * 见 component-inventory.md「修订三」与 apple-metrics.md §10.3。
   */
  checkbox: {
    layerB: '内容层（Apple 自己就没给它玻璃，见 §10.3）',
    layerI: null,
    examples: ['checkbox-demo', 'checkbox-in-card'],
  },
  'radio-group': {
    layerB: '内容层（同 Checkbox）',
    layerI: null,
    examples: ['radio-group-demo', 'radio-group-keyboard'],
  },
  /* ── P2 第一批：四个结构件，全部内容层 ────────────────────────────── */
  collapsible: {
    layerB: '内容层（Disclosure Button 本身也没有材质）',
    layerI: null,
    examples: ['collapsible-demo', 'collapsible-sizes'],
  },
  accordion: {
    layerB: '内容层（区块底是 macOS Group Box，不是玻璃）',
    layerI: null,
    examples: ['accordion-demo', 'accordion-in-card'],
  },
  'scroll-area': {
    layerB: '内容层；**边缘效果那一层**才有模糊，且它属于 @createagle/glass-core',
    layerI: null,
    examples: ['scroll-area-demo', 'scroll-area-edges'],
  },
  table: {
    layerB: '内容层 —— PROJECT_SPEC §2 **明令禁止**在这里堆玻璃',
    layerI: null,
    examples: ['table-demo', 'table-density'],
  },
  /* ── P2 第二批：两个玻璃 + 两个无依据 ──────────────────────────────── */
  pagination: {
    layerB: '容器（Ultrathin 玻璃，实测）',
    layerI: null,
    examples: ['pagination-demo', 'pagination-overflow'],
  },
  breadcrumb: {
    layerB: '内容层（Apple 两份资源里都没有这个组件）',
    layerI: null,
    examples: ['breadcrumb-demo', 'breadcrumb-ellipsis'],
  },
  'context-menu': {
    layerB: '面板（与 DropdownMenu 同一块）',
    layerI: '高亮项',
    examples: ['context-menu-demo', 'context-menu-no-scrim'],
  },
  resizable: {
    layerB: '内容层 —— 分隔条**不上玻璃**（1px 宽，模糊看不出来）',
    layerI: null,
    examples: ['resizable-demo', 'resizable-vertical'],
  },
  /* ── P2 第三批：导航层 ──────────────────────────────────────────────── */
  sidebar: {
    layerB: '容器（**全库唯一一块 `scale="large"` 的玻璃** —— HIG 点名「更不透明」，实测 0.92）',
    layerI: null,
    examples: ['sidebar-demo', 'sidebar-collapsed'],
  },
  menubar: {
    layerB: '面板（与 DropdownMenu 同一块）—— ❗**条本身没有材质**，实测推翻了清单的「B + I」',
    layerI: null,
    examples: ['menubar-demo', 'menubar-surface'],
  },
  'navigation-menu': {
    layerB: '视口面板（Apple 平台上没有这个控件，几何全部借来）',
    layerI: null,
    examples: ['navigation-menu-demo', 'navigation-menu-controlled'],
  },
  /* ── P2 第四批：日期与可输入下拉 ────────────────────────────────────── */
  calendar: {
    layerB: '内容层 —— ✅ **这次有 Apple 自证**：资源里 `Style=Inline` 就是纯白不透明的',
    layerI: null,
    examples: ['calendar-demo', 'calendar-states'],
  },
  'date-picker': {
    layerB: '弹层面板（`Style=Compact`，圆角 **13** 实测）；触发器是内容层填充，不是玻璃',
    layerI: null,
    examples: ['date-picker-demo', 'date-picker-inline'],
  },
  combobox: {
    layerB: '弹出列表；文本域是内容层（结构取自 macOS，**尺度不取**）',
    layerI: null,
    examples: ['combobox-demo', 'combobox-filter'],
  },
  /* ── P2 收尾批 ──────────────────────────────────────────────────────── */
  'data-table': {
    layerB: '内容层 —— 与 `<Table>` 同，**一句玻璃都没有**；本组件也**没有新几何**',
    layerI: null,
    examples: ['data-table-demo', 'data-table-selection'],
  },
  command: {
    layerB: '面板（Spotlight 是系统级的，Apple 资源里**结构上不可能有**）',
    layerI: null,
    examples: ['command-demo', 'command-shortcut'],
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
  progress:
    '**资源里没有 Progress 的参考图。** 那三条水平轨道是 Slider —— 每条都带 knob，' +
    '是可拖的滑杆，不是进度条；UIProgressView 一个样例都没有。' +
    '本组件的轨道几何与两个颜色是**从 Slider 借来的**：对 Slider 是 [实测]，' +
    '对 Progress 只能算 [推定 · 借自实测]。要比对照图，去看 Slider 那一张 ——' +
    '但要记住那是另一个组件的图。',
  badge:
    '**Badge 不是 Apple 控件**，资源里没有组件页也没有可量的样例。' +
    '不过这一条的**分层理由**被本库自己的实测改写过：原来写的是「小尺寸玻璃看不出效果」，' +
    '而 `scripts/small-glass.mjs` 量出来 44×20 的玻璃压在 6px 条纹上 meanΔ 有 19.5/255，' +
    '压在平滑渐变上才 2.8 —— **小不等于看不见，真正的变量是背景的频率**。' +
    '结论（内容层）没变，理由换了。那张表比任何对照图都有用。',
  separator:
    '**厚度与颜色都已经在 Card 的对照图里比过了。** 分组列表行之间那条 1pt、#e6e6e6 ' +
    '是从同一张参考图上量的（apple-metrics §8.2 / §8.3）。' +
    '本组件用的是**通用**分隔线（--lg-separator，社区通行值，[待核实]），' +
    '而那个值本来就没有参考图可比 —— 两者的差别有一个专门的示例并排放着看。',
  skeleton:
    '**Apple 没有骨架屏这个东西。** iOS 的加载态是转菊花或者直接显示占位内容，' +
    'HIG 里找不到 skeleton / shimmer 的说法，设计资源里当然也没有。' +
    '没有图就是没有图 —— 本组件的几何与动效全部是 [推定]，不拿别的东西充数。',
  avatar:
    '**Apple 没有 Avatar 控件。** 通讯录、信息、FaceTime 里的圆形头像是各家 App 自己画的，' +
    'HIG 里没有对应的组件规范，设计资源里也没有可量的样例。几何全部 [推定]。',
  tooltip:
    '**有实测数据了，但仍然没有并排对照图。** 2026-09-03 在 macOS 27 设计资源里' +
    '找到了完整的 Tooltip 组件（节点 0:2793），内边距（上 3 / 右 6 / 下 2 / 左 6）、' +
    '字号 11 / 行高 13 都已按实测改，记录见 apple-metrics.md §10.5。' +
    '不做对照图是因为**本库刻意没有采用实测的圆角 0**（浮层一致性 + 半透明直角会锯齿），' +
    '并排摆出来只会让人以为哪一边画错了 —— 差异写成文字比画成图诚实。',
  checkbox:
    '**几何是实测的，但没有可并排的成品图。** macOS 27 资源里的 36 个变体都是' +
    '组件画布上的孤立控件，没有「装在真实界面里」的截图，' +
    '而本库的示例一定是坐在卡片或表单里的 —— 并排摆出来比的是背景，不是控件。' +
    '真正值得记的一条已经写进组件头部：**Apple 自己的复选框没有玻璃**，' +
    '36 个变体里一个模糊 / 折射 / 色散都没有。',
  'radio-group':
    '同 Checkbox —— 共用同一份实测数据与同一个理由。' +
    '另外，资源里的 Radio 画了 Selection=Mixed 变体而**本库不实现**，' +
    '对照图反而会把这处刻意的不还原说成缺陷。',
  collapsible:
    '**触发器的几何是实测的，人字形不是。** 资源里那个 chevron 是 SF Symbols 的' +
    '私有区码位（网页上多数系统渲染成豆腐块），只能自己画一个 SVG ——' +
    '并排摆出来，比的其实是「我画的 chevron 像不像 Apple 的字体」，' +
    '而那恰恰是这个组件里**唯一没有依据**的一处。尺寸与配色的回归由行为测试钉住。',
  accordion:
    '**Apple 没有一个叫 Accordion 的控件**，所以没有成品可以并排。' +
    '资源里只有两个零件（Disclosure Button + Group Box），它们各自的实测值' +
    '已经写进尺寸表；而「怎么把零件拼成手风琴」是本库定的，没有参照物。',
  'scroll-area':
    '**滚动条量得到，滚动边缘效果量不到。** 前者的几何全部实测（滑块 6、槽 12、内缩 3）；' +
    '后者是个**随滚动位置连续变化**的效果，静态资源里根本不存在这种东西 ——' +
    '它的强度曲线、带子高度、模糊半径全是 [推定]，记在 @createagle/glass-core 的 scroll-edge.tsx。' +
    '并排一张静态图只会把「连续」这件事拍没了。',
  pagination:
    '**几何全部实测，但没有并排图。** 资源里的 Page Control 是组件画布上的三个变体'
    + '（402×44 的孤立控件），而本库的示例必然坐在真实内容之上 ——'
    + '并排比的是背景，不是控件。真正值得记的两条已经写进尺寸表：'
    + '容器是 Ultrathin 玻璃，两个点色正好落在既有 token 上。',
  breadcrumb:
    '**Apple 两份资源里都没有这个组件。** iOS 27 搜不到任何 path 节点，'
    + 'macOS 27 连 Path Controls 页都没有 —— 没有参照物，对照图无从谈起。'
    + '这个组件的每一个数字都是 [推定]，与 Skeleton / Toast 同一档。',
  'context-menu':
    '**面板与 DropdownMenu 是同一块**，要看面板的对照图请去那一页。'
    + '属于它自己的只有背景压暗层（#000000 @ 0.23，实测），'
    + '而那是一层纯色 —— 画成并排图没有信息量。'
    + '⚠️ 资源里的 Quick Actions 那一排本批没实现，值已记在 apple-metrics §12.2。',
  resizable:
    '**分隔条没有任何规格可比。** macOS 资源里那张 Split View 是对话框布局稿，'
    + '两栏直接挨着，中间没有分隔条元素。命中宽 / 线宽 / 把手全是 [推定]，'
    + '并排一张图只会把这些推定值伪装成有依据的。',
  table:
    '**几何实测，但没有可并排的成品图。** 资源里的 Table Rows 是组件画布上的' +
    '孤立行（600×20 一条条铺开），不是装在真实窗口里的表格；' +
    '而本库的示例必然带表头、caption 和真实数据 —— 并排比的是排版，不是控件。' +
    '真正该记住的一条已经写进组件头部：**这里一句玻璃都没有，是 SPEC 明令的。**',
  toast:
    '**Apple 那边没有对应物。** 清单写的「接近系统通知横幅」要当真：' +
    '系统横幅是**系统级**的，App 画不出来，设计资源里当然也不会有它的样例。' +
    '内边距 14 借自 Alert 实测、最大宽 370 借自 Grouped List 实测 ——' +
    '要比对照图请去看那两个组件的，但要记住那是别人的图。' +
    '而且本组件把通知区放在**底部**（iOS 的系统横幅在顶部），这是刻意的选择，不是还原。',
  sidebar:
    '**材质实测，几何实测，但没有可并排的成品图。** 资源里的侧栏是组件画布上的' +
    '一列孤立行（320 宽，背后什么都没有），而侧栏这个组件的全部看点恰恰是' +
    '**它压在什么上面** —— 一块 0.92 不透明的玻璃摆在空白画布上，' +
    '和摆在纯白页面上长得一模一样。真正该记住的两条已经写进尺寸表与组件头部：' +
    '覆盖层 0.92（控件层只有 0.10），以及**模糊反而更小**（80 < 100）。',
  menubar:
    '**没有可并排的东西 —— 条本身是透明的。** 实测四个变体的 fills / effects / strokes ' +
    '全是空的，菜单栏直接压在壁纸上。有材质的只有展开中的那一项和弹出的面板，' +
    '而面板与 DropdownMenu 是同一块，要看对照图请去那一页。',
  'navigation-menu':
    '**Apple 两份资源里都没有这个组件。** 与 Breadcrumb 同一档：没有参照物，' +
    '对照图无从谈起。这里每一个数字都是 [推定]，且逐条写明借自哪个有实测的邻居 ——' +
    '触发器借 iPadOS 菜单栏项（§13.3），面板借菜单面板（§7.7）。' +
    '**借来的实测值仍然是推定**，不因为出处可靠就升格。',
  calendar:
    '**几何全实测，但没有可并排的成品图。** 资源里的 `Style=Inline` 是画布上的' +
    '一块孤立面板（370×377，背后什么都没有），而本库的示例必然坐在文档站的排版里 ——' +
    '并排比的是周围，不是控件。真正该记住的两条已经写进尺寸表与组件头部：' +
    '**同一个日历，嵌进内容是纯白的、浮成弹层才是玻璃**；以及**选中态是黑底白字，不是主题蓝**。',
  'date-picker':
    '**面板的对照留给 Calendar 那一页。** 属于它自己的只有触发器 ——' +
    '两枚 34 高的胶囊，底色正好落在既有 token 上，画成并排图没有信息量。' +
    '⚠️ 时间那一枚点开的滚轮**本批没有量**，也就没有可比的东西。',
  combobox:
    '**参考是 macOS 的，尺度又刻意不跟 —— 并排图会误导。** ' +
    '把 24 高的 NSComboBox 和本库 44 高的控件摆在一起，看起来像做错了，' +
    '而那恰恰是刻意的（iOS 基准 + 44pt 触控下限）。' +
    '可比的部分是**结构与三档按钮底色**，已经写进尺寸表，并逐条标了「实测 / 推定」。',
  'data-table':
    '**没有对照图，因为没有新东西可对。** 外观全部来自已经实测过的 `<Table>` ——' +
    '要看并排请去那一页。本组件的增量是**行为**（排序状态机、行选择、分页），' +
    '而行为拍不成静态图。这一条本身就是结论：**量过了，发现没有新的可量。**',
  command:
    '**Apple 的资源里结构上不可能有它。** Command 对应的是 Spotlight，' +
    '那是**系统级**界面，App 画不出来 —— 与 Toast 的「系统通知横幅」同一类。' +
    '唯一有实测依据的是搜索框（macOS `Search Field`），而那是个 24 高的鼠标语境控件，' +
    '与本库 44 高的实现并排只会显得像做错了。可比的部分是结构与配色，已写进尺寸表。',
  'input-group':
    '**资源里唯一带附件的输入框样例是清除按钮**（18×18、右内缩 17），' +
    '已经在 Input 那一页的尺寸表里了。「输入框 + 前后附件」这个形态本身没有参考图，' +
    '高度与内边距沿用 Input 的 field 变体 —— 而那一支本来就是 [推定]。',
};
