/** 折射参数 A/B：当前默认 vs 候选 */
import { createRoot } from 'react-dom/client';
import { GlassProvider, GlassSurface } from '@glass/core';

const W = 85, H = 54;
const CASES: Array<[string, Record<string, number>]> = [
  ['当前默认', {}],
  ['A 位移随尺寸缩放', { distortionScale: -0.7 * H }],
  ['B A + 色散减半', { distortionScale: -0.7 * H, greenOffset: 9, blueOffset: 19 }],
  ['C B + 色散再减', { distortionScale: -0.7 * H, greenOffset: 5, blueOffset: 12 }],
  ['D C + 中心全归零', { distortionScale: -0.7 * H, greenOffset: 5, blueOffset: 12, opacity: 1 }],
];

createRoot(document.getElementById('root')!).render(
  <GlassProvider defaultTheme="light" defaultTint={0.34} tier="a">
    <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
      {CASES.map(([label, o])=>(
        <div key={label} style={{textAlign:'center'}}>
          <GlassSurface layer="indicator" radius={H/2}
            overrides={o as never} style={{width:W,height:H}} />
          <div style={{font:'11px monospace',color:'#fff',marginTop:5,textShadow:'0 0 3px #000'}}>{label}</div>
        </div>
      ))}
    </div>
  </GlassProvider>,
);
queueMicrotask(()=>{ (window as unknown as {__ready?:boolean}).__ready = true; });
