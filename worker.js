// videoprompt Worker — 静态资产 + /models/ R2 路由（借鉴 soundtool 模式）
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/models/')) {
      let key = url.pathname.slice('/models/'.length);
      // WebLLM 会把模型 URL 规范化为 /resolve/main/ —— 剥离它映射回真实键
      key = key.replace(/\/resolve\/main\//, '/');
      // 版本化路径重映射（v1 前缀 → 真实键，绕过边缘旧缓存）
      key = key.replace(/^florence2-large-v1\//, 'florence2-large/');
      key = key.replace(/^florence2-v1\//, 'florence2/');
      const rangeHdr = request.headers.get('Range');
      const manifestKey = key + '.manifest';
      const manifest = await env.MODELS.get(manifestKey);
      let headers = new Headers();
      headers.set('Access-Control-Allow-Origin', '*');
      // 按扩展名给正确 MIME（transformers.js 校验 config.json/tokenizer 的 content-type）
      const ext = key.split('.').pop();
      headers.set('Content-Type', ext === 'json' ? 'application/json'
        : ext === 'wasm' ? 'application/wasm'
        : ext === 'mjs' || ext === 'js' ? 'text/javascript'
        : 'application/octet-stream');
      // 小文件/配置短缓存（可更新），权重文件长缓存（版本化路径保证内容不变）
      headers.set('Cache-Control', (ext === 'json' || ext === 'wasm' || ext === 'mjs')
        ? 'public, max-age=86400'
        : 'public, max-age=31536000, immutable');
      if (rangeHdr && /^bytes=\d+-\d*$/.test(rangeHdr.trim())) {
        const m = rangeHdr.trim().match(/^bytes=(\d+)-(\d*)$/);
        const start = parseInt(m[1], 10);
        let end = m[2] ? parseInt(m[2], 10) : null;
        if (manifest) {
          const info = JSON.parse(await manifest.text());
          const sizes = info.sizes, keys = info.parts;
          let total = 0;
          for (let si = 0; si < sizes.length; si++) total += sizes[si];
          if (end === null) end = total - 1;
          end = Math.min(end, total - 1);
          if (start > end) {
            return new Response('Range Not Satisfiable', { status: 416, headers: { 'Content-Range': 'bytes */' + total } });
          }
          const segs = [];
          let off = 0;
          for (let pi = 0; pi < keys.length; pi++) {
            const ps = sizes[pi];
            const s0 = Math.max(start, off), s1 = Math.min(end, off + ps - 1);
            if (s0 <= s1) segs.push({ key: keys[pi], rel0: s0 - off, rel1: s1 - off });
            off += ps;
          }
          const parts = await Promise.all(segs.map(async function(sg) {
            const o = await env.MODELS.get(sg.key, { range: { offset: sg.rel0, length: sg.rel1 - sg.rel0 + 1 } });
            return await o.arrayBuffer();
          }));
          const len = end - start + 1;
          const out = new Uint8Array(len);
          let p = 0;
          for (let ai = 0; ai < parts.length; ai++) {
            out.set(new Uint8Array(parts[ai]), p);
            p += parts[ai].byteLength;
          }
          headers.set('Content-Length', String(len));
          headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + total);
          headers.set('Accept-Ranges', 'bytes');
          return new Response(out, { status: 206, headers: headers });
        }
        const obj = await env.MODELS.get(key);
        if (!obj) return new Response('Not Found', { status: 404 });
        const total2 = obj.size;
        if (end === null) end = total2 - 1;
        end = Math.min(end, total2 - 1);
        if (start > end) {
          return new Response('Range Not Satisfiable', { status: 416, headers: { 'Content-Range': 'bytes */' + total2 } });
        }
        const o2 = await env.MODELS.get(key, { range: { offset: start, length: end - start + 1 } });
        const ab2 = await o2.arrayBuffer();
        headers.set('Content-Length', String(ab2.byteLength));
        headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + total2);
        headers.set('Accept-Ranges', 'bytes');
        return new Response(ab2, { status: 206, headers: headers });
      }
      if (manifest) {
        // 分片对象: 按清单流式拼接
        try {
          const info = JSON.parse(await manifest.text());
          const parts = info.parts.slice();
          const h2 = new Headers();
          h2.set('Content-Type', 'application/octet-stream');
          h2.set('Cache-Control', 'public, max-age=31536000, immutable');
          h2.set('Access-Control-Allow-Origin', '*');
          if (info.sizes && info.sizes.length === parts.length) {
            let total = 0;
            for (let i = 0; i < info.sizes.length; i++) total += info.sizes[i];
            h2.set('Content-Length', String(total));
          }
          const readable = new ReadableStream({
            async pull(controller) {
              if (parts.length === 0) { controller.close(); return; }
              const obj = await env.MODELS.get(parts.shift());
              if (!obj) { controller.error(new Error('missing part')); return; }
              const reader = obj.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
              if (parts.length === 0) controller.close();
            }
          });
          return new Response(readable, { headers: h2 });
        } catch (e) {
          return new Response('manifest error: ' + String(e && e.message || e), { status: 500 });
        }
      }
      const obj = await env.MODELS.get(key);
      if (!obj) return new Response('not found', { status: 404 });
      obj.writeHttpMetadata(headers);
      headers.set('etag', obj.httpEtag);
      // 覆盖 R2 对象可能自带的元数据：MIME/缓存按扩展名重新强制
      headers.set('Content-Type', ext === 'json' ? 'application/json'
        : ext === 'wasm' ? 'application/wasm'
        : ext === 'mjs' || ext === 'js' ? 'text/javascript'
        : 'application/octet-stream');
      headers.set('Cache-Control', (ext === 'json' || ext === 'wasm' || ext === 'mjs')
        ? 'public, max-age=86400'
        : 'public, max-age=31536000, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Content-Length', obj.size);
      return new Response(obj.body, { headers });
    }
    // AI 引擎幻觉链接兜底：GA4 实测 chatgpt.com 曾推荐 /ru/provider-moonshot（站点无此页，
    // 404 丢访客）。/provider-moonshot → 对应语言的文字反推生成器（Moonshot/Kimi 属文字 AI）
    const pmPath = new URL(request.url).pathname;
    const pmMatch = /^\/([a-z]{2}(-[A-Z]{2})?\/)?provider-moonshot\/?$/.exec(pmPath);
    if (pmMatch) {
      const langPrefix = pmMatch[1] || '';
      return Response.redirect(new URL(`/${langPrefix}ai-generator/text-to-prompt/`, request.url), 301);
    }
    // /builder 是旧版站点的提示词生成器路径（豆包等 AI 引擎索引里还挂着老链接），
    // 站点重构后等价页是 AI hub —— 301 过去保住这路访客
    const bMatch = /^\/([a-z]{2}(-[A-Z]{2})?\/)?builder\/?$/.exec(new URL(request.url).pathname);
    if (bMatch) {
      const bPrefix = bMatch[1] || '';
      return Response.redirect(new URL(`/${bPrefix}ai-generator/`, request.url), 301);
    }
    // 其他路径交给 Assets（run_worker_first 时从这里返回 asset）
    const resp = await env.ASSETS.fetch(request);
    // 未匹配路径兜底：显式取 404.html（run_worker_first 下路由器不自动出 404 页）
    if (resp.status === 404) {
      const nf = await env.ASSETS.fetch(new URL('/404.html', request.url));
      if (nf.ok) {
        const h = new Headers(nf.headers);
        h.set('Content-Type', 'text/html; charset=utf-8');
        h.set('Cache-Control', 'no-store');
        return new Response(nf.body, { status: 404, headers: h });
      }
    }
    // 给 HTML 响应补 charset（GEO 加固），不影响 JS/CSS/图片等二进制 MIME
    const ct = resp.headers.get('Content-Type') || '';
    if (ct.includes('text/html')) {
      const headers = new Headers(resp.headers);
      if (!ct.includes('charset')) {
        headers.set('Content-Type', ct + '; charset=utf-8');
      }
      // HTML 一律 no-store：页面 JS 迭代频繁，避免浏览器 bfcache/HTTP 缓存复活旧版本
      headers.set('Cache-Control', 'no-store');
      return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
    }
    return resp;
  }
}
