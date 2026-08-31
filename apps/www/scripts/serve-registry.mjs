/**
 * 最小静态服务，把 build 产物 public/r/ 暴露出去，供本地冒烟测试用。
 *
 * 生产环境不需要它 —— Next.js 会直接静态服务 public/。
 * 这个脚本只是为了在没有起文档站的情况下也能跑 `shadcn add http://…`。
 *
 * 用法：node scripts/serve-registry.mjs [port]
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', 'public');
const PORT = Number(process.argv[2] ?? 4180);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  // 归一化并禁止跳出 public/
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': file.endsWith('.json') ? 'application/json' : 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => {
  console.log(`registry 服务已启动 → http://localhost:${PORT}/r/registry.json`);
});
