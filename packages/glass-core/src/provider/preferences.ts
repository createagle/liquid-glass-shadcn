import { useSyncExternalStore } from 'react';

/**
 * 无障碍偏好订阅。对应 PROJECT_SPEC §5（Provider 职责）与 §13。
 *
 * 一律走 `useSyncExternalStore`，**不要**用 `useEffect + useState` 的经典写法
 * —— 后者在 SSR 场景下首帧会用错误的值渲染再纠正，导致可见的闪烁与 hydration 警告。
 * （PROJECT_SPEC §9 对 ResponsiveOverlay 提了同样的要求，这里是同一套机制。）
 */

type Listener = () => void;

const stores = new Map<string, { mql: MediaQueryList; listeners: Set<Listener> }>();

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

function subscribe(query: string) {
  return (onChange: Listener) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const store = getStore(query);
    store.listeners.add(onChange);
    return () => {
      store.listeners.delete(onChange);
    };
  };
}

function getSnapshot(query: string) {
  return () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return getStore(query).mql.matches;
  };
}

/** SSR 快照：服务端一律返回 false（= 不降级），客户端接管后立即修正。 */
const getServerSnapshot = () => false;

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(subscribe(query), getSnapshot(query), getServerSnapshot);
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
