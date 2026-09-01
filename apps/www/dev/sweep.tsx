/** 折射参数扫描 —— 定位 Tier A 伪影由哪个参数驱动 */
import { createRoot } from 'react-dom/client';
import { GlassProvider, GlassSurface } from '@glass/core';

const params = new URLSearchParams(location.search);
const vary = params.get('vary') ?? 'distortionScale';
const VALUES: Record<string, number[]> = {
  distortionScale: [-40, -80, -120, -180, -260],
  blueOffset: [0, 10, 20, 38, 60],
  postBlur: [0, 0.3, 1, 2, 4],
  opacity: [0.93, 0.97, 1],
  borderWidth: [0.08, 0.14, 0.18, 0.3, 0.5],
  greenOffset: [0, 5, 9, 18],
};
const vals = VALUES[vary] ?? VALUES['distortionScale'] ?? [];

createRoot(document.getElementById('root')!).render(
  <GlassProvider defaultTheme="light" defaultTint={0.34} tier="a">
    <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
      {vals.map(v=>(
        <div key={v} style={{textAlign:'center'}}>
          <GlassSurface layer="indicator" radius={27}
            overrides={{ [vary]: v } as never}
            style={{width:85,height:54}} />
          <div style={{font:'11px monospace',color:'#fff',marginTop:4,textShadow:'0 0 3px #000'}}>
            {vary}={v}
          </div>
        </div>
      ))}
    </div>
  </GlassProvider>,
);
queueMicrotask(()=>{ (window as unknown as {__ready?:boolean}).__ready = true; });
