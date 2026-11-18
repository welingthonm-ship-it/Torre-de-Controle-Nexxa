/*
 * Torre de Controle Nexxa — runtime próprio para rodar o portal fora do Claude (Vercel ou qualquer hospedagem estática).
 *
 * Implementa as mesmas funções que o código do portal (pasta /portal) usa:
 *   dash.draw / dash.data / dash.calc / dash.refresh / dash.setLink
 *   claude.use('db' | 'assets' | 'downloads' | 'user')
 *
 * Nesta etapa os dados ficam no próprio navegador (IndexedDB): quem enviar a planilha na aba
 * "Atualizar dados" vê o portal completo naquele navegador. A troca por um banco compartilhado
 * (Supabase) é feita depois, só neste arquivo, sem mexer no código das abas.
 */
(() => {
  'use strict';
  const CFG = Object.assign({
    dados: '/dados/',                 // onde procurar os CSVs iniciais (opcional; sem eles o portal começa vazio)
    datasets: ['resumo_dia', 'rotas_dia', 'ocorrencias_dia', 'pendentes', 'entregas_cliente', 'clientes'],
    editor: true                      // sem login externo ainda: quem abre o site edita
  }, window.NX_CONFIG || {});

  /* ---------- armazenamento local (IndexedDB) ---------- */
  const idb = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((ok, fail) => {
      if (!window.indexedDB) { ok(null); return; }
      const rq = indexedDB.open('nexxa-torre', 1);
      rq.onupgradeneeded = () => { const d = rq.result; d.createObjectStore('docs'); d.createObjectStore('blobs'); };
      rq.onsuccess = () => ok(rq.result);
      rq.onerror = () => ok(null);
    }));
    const tx = async (store, mode, fn) => {
      const d = await open(); if (!d) return undefined;
      return new Promise((ok, fail) => {
        const t = d.transaction(store, mode), s = t.objectStore(store); let out;
        Promise.resolve(fn(s)).then((r) => { out = r; });
        t.oncomplete = () => ok(out); t.onerror = () => fail(t.error); t.onabort = () => fail(t.error);
      });
    };
    const req = (r) => new Promise((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
    return {
      all: (store) => tx(store, 'readonly', async (s) => {
        const [keys, vals] = await Promise.all([req(s.getAllKeys()), req(s.getAll())]);
        const m = new Map(); keys.forEach((k, i) => m.set(k, vals[i])); return m;
      }),
      get: (store, k) => tx(store, 'readonly', (s) => req(s.get(k))),
      put: (store, k, v) => tx(store, 'readwrite', (s) => req(s.put(v, k))),
      del: (store, k) => tx(store, 'readwrite', (s) => req(s.delete(k)))
    };
  })();

  /* ---------- banco de documentos (mesma forma do db do Claude) ---------- */
  const DOCS = new Map();
  const subs = new Set();
  const docsReady = idb.all('docs').then((m) => { if (m) m.forEach((v, k) => DOCS.set(k, v)); }).catch(() => {});
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const segs = (p) => String(p).split('/').filter(Boolean);
  const snapDoc = (path) => { const v = DOCS.get(path); return {id: segs(path).pop(), exists: v !== undefined, data: () => clone(v)}; };
  const snapCol = (path) => {
    const n = segs(path).length + 1, pre = segs(path).join('/') + '/';
    const docs = Array.from(DOCS.keys()).filter((k) => k.startsWith(pre) && segs(k).length === n).sort().map(snapDoc);
    return {docs, size: docs.length, empty: !docs.length, forEach: (f) => docs.forEach(f)};
  };
  const notify = (path) => subs.forEach((s) => { if (s.match(path)) { try { s.cb(); } catch (e) { console.error(e); } } });
  const write = async (path, val) => {
    if (val === undefined) DOCS.delete(path); else DOCS.set(path, clone(val));
    try { if (val === undefined) await idb.del('docs', path); else await idb.put('docs', path, clone(val)); } catch (e) { console.warn('[nexxa] não salvou no navegador', e); }
    notify(path);
  };
  const merge = (a, b) => {
    const out = Object.assign({}, a || {});
    Object.keys(b || {}).forEach((k) => {
      const v = b[k];
      if (v && typeof v === 'object' && v.__delete__ === true) delete out[k];
      else out[k] = v;
    });
    return out;
  };
  const docRef = (path) => ({
    id: segs(path).pop(), path,
    get: async () => { await docsReady; return snapDoc(path); },
    set: async (v) => { await docsReady; await write(path, v); },
    update: async (v) => { await docsReady; await write(path, merge(DOCS.get(path), v)); },
    delete: async () => { await docsReady; await write(path, undefined); },
    onSnapshot: (cb, err) => {
      const s = {match: (p) => p === path, cb: () => cb(snapDoc(path))};
      subs.add(s); docsReady.then(() => { if (subs.has(s)) s.cb(); });
      return () => subs.delete(s);
    }
  });
  const colRef = (path) => ({
    path,
    doc: (id) => docRef(segs(path).concat(id || Math.random().toString(36).slice(2)).join('/')),
    add: async (v) => { const r = docRef(segs(path).concat(Date.now().toString(36) + Math.random().toString(36).slice(2, 7)).join('/')); await r.set(v); return r; },
    get: async () => { await docsReady; return snapCol(path); },
    onSnapshot: (cb, err) => {
      const pre = segs(path).join('/') + '/', n = segs(path).length + 1;
      const s = {match: (p) => p.startsWith(pre) && segs(p).length === n, cb: () => cb(snapCol(path))};
      subs.add(s); docsReady.then(() => { if (subs.has(s)) s.cb(); });
      return () => subs.delete(s);
    }
  });
  const db = {doc: (p) => docRef(segs(p).join('/')), collection: (p) => colRef(segs(p).join('/'))};

  /* ---------- arquivos (assets) ---------- */
  const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');
  const assets = {
    upload: async (blob) => {
      const id = hex(); await idb.put('blobs', id, blob);
      return {id, url: '/_blob/' + id, sizeBytes: blob.size, contentType: blob.type};
    },
    delete: async (id) => { await idb.del('blobs', String(id).replace(/^\/?_blob\//, '')); },
    list: async () => ({assets: [], usage: {}})
  };
  const blobText = async (url) => {
    const id = String(url).replace(/^\/?_blob\//, '');
    const b = await idb.get('blobs', id);
    if (!b) throw new Error('arquivo ' + id + ' não está neste navegador');
    return typeof b === 'string' ? b : b.text();
  };

  /* ---------- downloads e usuário ---------- */
  const downloads = {
    save: async ({filename, data}) => {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename || 'arquivo';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      return {status: 'saved'};
    }
  };
  const user = {
    id: async () => 'local', me: async () => ({id: 'local', name: 'Este navegador'}),
    isOwner: () => CFG.editor, canEdit: () => CFG.editor, can: () => CFG.editor,
    profiles: async (ids) => Object.fromEntries((ids || []).map((i) => [i, {id: i, name: i === 'local' ? 'Este navegador' : ''}])),
    search: async () => []
  };
  const CAPS = {db, assets, downloads, user};
  window.claude = {use: (name) => Promise.resolve(CAPS[name] || null)};

  /* ---------- CSV ---------- */
  const parseCSV = (t) => {
    const rows = []; let f = '', row = [], q = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(f); f = ''; }
      else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (ch !== '\r') f += ch;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    const head = (rows.shift() || []).map((h) => h.trim().replace(/^﻿/, ''));
    // Igual ao portal no Claude: cada célula é texto sem espaços nas pontas; vazia vira null.
    return rows.filter((r) => !(r.length === 1 && !r[0].trim())).map((r) => {
      const o = {}; head.forEach((h, j) => { const v = (r[j] == null ? '' : r[j]).trim(); o[h] = v === '' ? null : v; }); return o;
    });
  };

  /* ---------- dados ---------- */
  const DATA = new Map();   // id -> {status, data, error, v}
  const CALC = new Map();   // id -> {inputs, fn, memo}
  let ver = 0;
  const state = (id) => DATA.get(id) || {status: 'loading', data: null};
  const loadSource = async (id) => {
    const cur = DATA.get(id);
    DATA.set(id, {status: 'loading', data: cur && cur.data, refreshing: !!cur});
    try {
      await docsReady;
      const doc = DOCS.get('datasets/' + id), url = doc && doc.source && doc.source.url;
      let txt = null;
      if (url && /_blob\//.test(url)) txt = await blobText(url);
      else {
        const r = await fetch(CFG.dados + id + '.csv', {cache: 'no-cache'}).catch(() => null);
        if (r && r.ok && !/text\/html/.test(r.headers.get('content-type') || '')) txt = await r.text();
      }
      DATA.set(id, {status: 'ok', data: txt ? parseCSV(txt) : [], vazio: !txt, v: ++ver});
    } catch (e) {
      console.warn('[nexxa] dados', id, e);
      DATA.set(id, {status: 'ok', data: [], vazio: true, erro: String(e && e.message || e), v: ++ver});
    }
    agenda();
  };
  const calcState = (id) => {
    const c = CALC.get(id);
    const ins = c.inputs.map((i) => dash.data(i));
    if (ins.some((g) => g.status !== 'ok')) return {status: 'loading', data: null};
    const key = ins.map((g) => g.v).join('|');
    if (c.memo && c.memo.key === key) return c.memo.res;
    let res;
    try { const out = c.fn(...ins.map((g) => g.data)); res = {status: 'ok', data: Array.isArray(out) ? out : (out && out.data) || [], v: ++ver}; }
    catch (e) { console.error('[nexxa] cálculo', id, e); res = {status: 'error', data: null, error: String(e && e.message || e)}; }
    c.memo = {key, res};
    return res;
  };

  /* ---------- desenhos ---------- */
  const DRAWS = new Map();  // name -> {fn} | {mount, update, unmount, made: WeakMap}
  let started = false, pend = 0;
  const visivel = (el) => !el.closest('[hidden]');
  const aninhado = (el) => { const p = el.parentElement && el.parentElement.closest('[data-draw]'); return !!p; };
  const roda = (name) => {
    const d = DRAWS.get(name); if (!d) return;
    document.querySelectorAll('[data-draw="' + (window.CSS && CSS.escape ? CSS.escape(name) : name) + '"]').forEach((el) => {
      if (!visivel(el) || aninhado(el)) return;
      try {
        if (d.fn) d.fn(el);
        else {
          let made = d.made.get(el);
          if (!d.made.has(el)) { el.replaceChildren(); made = d.mount ? d.mount(el) : undefined; d.made.set(el, made); }
          if (d.update) d.update(el, made);
        }
      } catch (e) { console.error('[nexxa] desenho', name, e); }
    });
  };
  const rodaTudo = () => { pend = 0; if (!started) return; DRAWS.forEach((_, n) => roda(n)); };
  const agenda = () => { if (!pend) pend = requestAnimationFrame(rodaTudo); };

  const dash = {
    draw: (name, fn) => {
      if (fn === undefined) { if (started) roda(name); return; }
      DRAWS.set(name, typeof fn === 'function' ? {fn} : Object.assign({made: new WeakMap()}, fn));
      if (started) roda(name);
    },
    data: (id) => {
      if (CALC.has(id)) return calcState(id);
      if (!DATA.has(id)) { DATA.set(id, {status: 'loading', data: null}); loadSource(id); }
      return state(id);
    },
    calc: (id, def) => { CALC.set(id, {inputs: def.inputs || [], fn: def.fn, memo: null}); agenda(); },
    refresh: (id) => { if (CALC.has(id)) { CALC.get(id).memo = null; agenda(); } else loadSource(id); },
    setLink: (id) => { try { history.replaceState(null, '', '#' + id); } catch (e) { /* ok */ } },
    onData: (fn) => { /* não usado pelo portal */ },
    colors: ['#1F7A3A', '#2E86AB', '#E8A317', '#C0392B', '#7A5AF8', '#16A085', '#8E6C4A', '#5D6D7E'],
    _start: () => {
      started = true;
      CFG.datasets.forEach((id) => dash.data(id));
      // dataset trocado (ex.: nova planilha publicada na aba Atualizar dados) -> recarrega
      CFG.datasets.forEach((id) => {
        let ult = null;
        docRef('datasets/' + id).onSnapshot((s) => {
          const u = s.exists && s.data().source ? s.data().source.url : null;
          if (ult !== null && u !== ult) loadSource(id);
          ult = u || '';
        });
      });
      new MutationObserver((ms) => { if (ms.some((m) => m.attributeName === 'hidden')) agenda(); })
        .observe(document.body, {subtree: true, attributes: true, attributeFilter: ['hidden']});
      let w = innerWidth; addEventListener('resize', () => { if (innerWidth !== w) { w = innerWidth; agenda(); } });
      rodaTudo();
    },
    _config: CFG
  };
  window.dash = dash;
})();
