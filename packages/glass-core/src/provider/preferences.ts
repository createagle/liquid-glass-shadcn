import { useSyncExternalStore } from 'react';

/**
 * 无障碍偏好订阅。对应 PROJECT_SPEC §5（Provider 职责）与 §13。
 *
 * 一律走 `useSyncExternalStore`，**不要**用 `useEffect + useState` 的经典写法
 * —— 后者在 SSR 场景下首帧会用错误的值渲染再纠正，导致可见的闪烁与 hydration 警告。
 * （PROJECT_SPEC §9 对 ResponsiveOverlay 提了同样的要求，这里是同一套机制。）
 */

type Listener = () => void;

interface QueryStore {
  mql: MediaQueryList;
  listeners: Set<Listener>;
}

const stores = new Map<string, QueryStore>();

function getStore(query: string) {
  let store = stores.get(query);
  if (!store) {
    store = { mql: window.matchMedia(query), listeners: new Set() };
    const notify = () => store!.listeners.forEach((l) => l());
    store.mql.addEventListener('change', notify);
    stores.set(query, store);
  }
  return store;
}

/**
 * `subscribe` / `getSnapshot` 必须**按 query 缓存函数身份**。
 *
 * 之前这两个是工厂函数，每次 render 都返回新的闭包 —— React 认为订阅源变了，
 * 于是**每一次 render 都退订再重订**一遍。行为上没错（store 在模块级），
 * 但四个偏好查询乘以每次 render 的开销纯属白烧，而且会把 DevTools 的
 * effect 记录刷满。做 Sheet 时要开始按视口订阅，这条路径的调用频率会更高，
 * 所以先修掉。
 */
const subscribers = new Map<string, (onChange: Listener) => () => void>();
const snapshots = new Map<string, () => boolean>();

function subscribe(query: string) {
  let fn = subscribers.get(query);
  if (!fn) {
    fn = (onChange: Listener) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const store = getStore(query);
      store.listeners.add(onChange);
      return () => {
        store.listeners.delete(onChange);
      };
    };
    subscribers.set(query, fn);
  }
  return fn;
}

function getSnapshot(query: string) {
  let fn = snapshots.get(query);
  if (!fn) {
    fn = () => {
      if (typeof window === 'undefined' || !window.matchMedia) return false;
      return getStore(query).mql.matches;
    };
    snapshots.set(query, fn);
  }
  return fn;
}

/** SSR 快照：服务端一律返回 false（= 不降级），客户端接管后立即修正。 */
const getServerSnapshot = () => false;

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(subscribe(query), getSnapshot(query), getServerSnapshot);
}

/**
 * 「紧凑视口」判定 —— PROJECT_SPEC §9 的原文规则：
 *
 *   `matchMedia('(max-width: 768px)') || matchMedia('(pointer: coarse)')`
 *
 * 下拉类组件（Select / DropdownMenu / Popover …）据此在移动端改渲染成底部
 * Drawer。**两条都要**：只看宽度会漏掉横屏手机与平板，只看指针会漏掉
 * 触屏笔记本上被缩窄的窗口。
 *
 * ⚠️ SSR 下返回 `false`（= 桌面路径）。这是 `useSyncExternalStore` 的
 * server snapshot 决定的：服务端根本没有视口可测，任何猜测都会在 hydration
 * 时打架。客户端接管后的第一帧就会修正，且因为走的是外部 store，
 * **不会产生 hydration mismatch 警告**，也不会像 `useEffect + useState`
 * 那样先用错误的值画一帧再纠正。
 */
export const COMPACT_QUERIES = ['(max-width: 768px)', '(pointer: coarse)'] as const;

export function useIsCompact(): boolean {
  const narrow = useMediaQuery(COMPACT_QUERIES[0]);
  const coarse = useMediaQuery(COMPACT_QUERIES[1]);
  return narrow || coarse;
}

export interface GlassPreferences {
  /** `prefers-reduced-transparency: reduce` → 全部材质切到 solid 档，移除 backdrop-filter 与折射 */
  reducedTransparency: boolean;
  /** `prefers-reduced-motion: reduce` → 移除形变/融合动画，只保留 ≤120ms 的透明度过渡 */
  reducedMotion: boolean;
  /** `prefers-contrast: more` → 提高描边对比、标签色升到实色、加强分隔线 */
  moreContrast: boolean;
  /** `prefers-color-scheme: dark` —— 仅在主题设为 'system' 时参与决策 */
  prefersDark: boolean;
}

export function useGlassPreferences(): GlassPreferences {
  return {
    reducedTransparency: useMediaQuery('(prefers-reduced-transparency: reduce)'),
    reducedMotion: useMediaQuery('(prefers-reduced-motion: reduce)'),
    moreContrast: useMediaQuery('(prefers-contrast: more)'),
    prefersDark: useMediaQuery('(prefers-color-scheme: dark)'),
  };
}
