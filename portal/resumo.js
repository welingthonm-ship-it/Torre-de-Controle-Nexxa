(() => {
const W = window;
TC.rsF = W.__nxRsF = W.__nxRsF || {c: 'ultimo', e: 'all', cDe: null, cAte: null, eDe: null, eAte: null};
const F = TC.rsF;
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addD = (s, n) => { const a = s.split('-').map(Number), d = new Date(a[0], a[1] - 1, a[2] + n); return iso(d); };
const nDias = (a, b) => { const x = a.split('-').map(Number), y = b.split('-').map(Number); return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 864e5) + 1; };
TC.rsAddD = addD;
TC.rsLim = () => {
const g = dash.data('entregas_cliente'); if (g.status !== 'ok' || !g.data.length) return null;
if (TC.rsLimC && TC.rsLimC.src === g.data) return TC.rsLimC.v;
let c0 = null, c1 = null, e0 = null, e1 = null;
g.data.forEach((r) => { const d = r.data, e = TC.dnPrev(r); if (d) { if (!c0 || d < c0) c0 = d; if (!c1 || d > c1) c1 = d; } if (e) { if (!e0 || e < e0) e0 = e; if (!e1 || e > e1) e1 = e; } });
TC.rsLimC = {src: g.data, v: {c0, c1, e0, e1}};
return TC.rsLimC.v;
};
TC.rsRange = () => {
const L = TC.rsLim(); if (!L) return null;
let cDe, cAte, eDe = null, eAte = null;
if (F.c === 'ultimo') { cDe = cAte = L.c1; }
else if (F.c === '7') { cAte = L.c1; cDe = addD(L.c1, -6); }
else if (F.c === 'mes') { cAte = L.c1; cDe = L.c1.slice(0, 8) + '01'; }
else if (F.c === 'all') { cDe = L.c0; cAte = L.c1; }
else { cDe = F.cDe || L.c0; cAte = F.cAte || L.c1; }
if (cDe > cAte) { const t = cDe; cDe = cAte; cAte = t; }
const h = TC.hojeISO();
if (F.e === 'hoje') { eDe = eAte = h; }
else if (F.e === 'amanha') { eDe = eAte = addD(h, 1); }
else if (F.e === 'prox') { eDe = addD(h, 1); eAte = null; }
else if (F.e === 'custom') { eDe = F.eDe || null; eAte = F.eAte || null; if (eDe && eAte && eDe > eAte) { const t = eDe; eDe = eAte; eAte = t; } }
return {cDe, cAte, eDe, eAte, L};
};
TC.rsVeic = (rows, byRota, now) => {
const keys = new Set(rows.map((r) => r.data + '|' + r.rota));
const multi = new Set(rows.map((r) => r.data)).size > 1;
const v = {v_total: 0, v_em_rota: 0, v_aguardando_cliente: 0, v_descarregando: 0, v_aguardando_saida: 0, v_standby: 0, v_baldeio: 0, v_concluidas: 0, v_patio: 0, lista: {patio: [], em_rota: [], aguardando_cliente: [], descarregando: [], concluidas: []}};
const grupos = [];
keys.forEach((k) => {
const rs = byRota.get(k) || []; if (!rs.length) return; grupos.push(rs);
const st = rs[0].status_rota, pend = rs.filter((r) => !TC.isEnt(r));
let et;
if (st === 'Concluida') et = 'concluidas';
else if (st === 'StandBy') et = 'standby';
else if (st === 'Baldeio') et = 'baldeio';
else if (pend.some((r) => r.inicio_atend && !r.fim_atend)) et = 'descarregando';
else if (pend.some((r) => r.chegada_real && !r.inicio_atend)) et = 'aguardando_cliente';
else if (!rs.some((r) => r.saida_cd)) et = 'aguardando_saida';
else et = 'em_rota';
v.v_total++; v['v_' + et]++;
const nome = rs[0].rota + (multi ? ' (' + rs[0].data.slice(8, 10) + '/' + rs[0].data.slice(5, 7) + ')' : '');
if (et === 'standby' || et === 'aguardando_saida') { v.v_patio++; v.lista.patio.push(nome); }
if (v.lista[et]) v.lista[et].push(nome);
});
v.tempos = TC.vtCompute(grupos, now);
return v;
};
TC.rsAgg = (rows) => {
const pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : null);
const rate = (col) => { let y = 0, n = 0; rows.forEach((r) => { if (r[col] === 'SIM') y++; else if (r[col] === 'NÃO') n++; }); return pct(y, y + n); };
const conc = rows.filter((r) => TC.isEnt(r)).length, p = rows.filter((r) => !TC.isEnt(r)), oc = rows.filter((r) => r.ocorrencia).length;
return {
entregas: rows.length, rotas: new Set(rows.map((r) => r.data + '|' + r.rota)).size, peso_entregue_kg: Math.round(rows.reduce((a, r) => a + (+r.peso_kg || 0), 0)),
concluidas: conc, pct_concluidas: pct(conc, rows.length), pendentes: p.length,
pend_execucao: p.filter((r) => r.status_rota === 'EmExecucao').length, pend_standby: p.filter((r) => r.status_rota === 'StandBy').length, pend_baldeio: p.filter((r) => r.status_rota === 'Baldeio').length,
ocorrencias: oc, pct_ocorrencia: pct(oc, rows.length), sla_janela_pct: rate('sla_janela'), on_time_pct: rate('on_time'), otif_pct: rate('otif')
};
};
TC.rsCalc = () => {
const g = dash.data('entregas_cliente'), R = TC.rsRange();
if (g.status !== 'ok' || !R) return null;
const now = Math.floor(Date.now() / 60000);
const key = JSON.stringify([R.cDe, R.cAte, R.eDe, R.eAte, now, F.cli || '']);
if (TC.rsC && TC.rsC.src === g.data && TC.rsC.key === key) return TC.rsC.v;
const byRota = new Map();
g.data.forEach((r) => { const k = r.data + '|' + r.rota; let a = byRota.get(k); if (!a) { a = []; byRota.set(k, a); } a.push(r); });
const okCli = (r) => !F.cli || (F.cli.t === 'rede' ? r.grupo === F.cli.v : r.codigo === F.cli.v);
const filtra = (cDe, cAte, eDe, eAte) => g.data.filter((r) => r.data >= cDe && r.data <= cAte && (!eDe || TC.dnPrev(r) >= eDe) && (!eAte || TC.dnPrev(r) <= eAte) && okCli(r));
const rows = filtra(R.cDe, R.cAte, R.eDe, R.eAte);
const agg = TC.rsAgg(rows);
const all = R.cDe === R.L.c0 && R.cAte === R.L.c1;
if (!all) {
const n = nDias(R.cDe, R.cAte);
const prev = TC.rsAgg(filtra(addD(R.cDe, -n), addD(R.cAte, -n), R.eDe ? addD(R.eDe, -n) : null, R.eAte ? addD(R.eAte, -n) : null));
const dif = (a, b) => (a === null || b === null || !prev.entregas) ? null : Math.round((a - b) * 10) / 10;
agg.d_pct_concluidas = dif(agg.pct_concluidas, prev.pct_concluidas); agg.d_sla_janela = dif(agg.sla_janela_pct, prev.sla_janela_pct);
agg.d_on_time = dif(agg.on_time_pct, prev.on_time_pct); agg.d_otif = dif(agg.otif_pct, prev.otif_pct);
}
Object.assign(agg, TC.rsVeic(rows, byRota, now));
const v = {R, rows, agg};
TC.rsC = {src: g.data, key, v};
return v;
};
TC.rsDraws = ['rs', 'rsCli', 'rsIn', 'rsMeter', 'rsPs', 'rsRoad', 'rsTxt', 'rsVRotas', 'rsVTempo'];
TC.rsRedraw = () => TC.rsDraws.forEach((n) => dash.draw(n));
TC.rsChips = () => {
document.querySelectorAll('.nx-chip[data-rs-c]').forEach((c) => c.classList.toggle('is-on', c.dataset.rsC === F.c));
document.querySelectorAll('.nx-chip[data-rs-e]').forEach((c) => c.classList.toggle('is-on', c.dataset.rsE === F.e));
};
document.querySelectorAll('.nx-chip[data-rs-c]').forEach((c) => { c.onclick = () => { F.c = c.dataset.rsC; TC.rsChips(); TC.rsRedraw(); }; });
document.querySelectorAll('.nx-chip[data-rs-e]').forEach((c) => { c.onclick = () => { F.e = c.dataset.rsE; TC.rsChips(); TC.rsRedraw(); }; });
TC.rsChips();
if (W.__nxRsTick) clearInterval(W.__nxRsTick);
W.__nxRsTick = setInterval(() => { const t = document.getElementById('monitoramento'); if (t && !t.hidden) TC.rsRedraw(); }, 120000);
})();
dash.draw('rsIn', (inp) => {
const c = TC.rsCalc(); if (!c) return;
const R = c.R, k = inp.dataset.k, isC = k[0] === 'c';
inp.min = isC ? R.L.c0 : R.L.e0; inp.max = isC ? R.L.c1 : R.L.e1;
if (document.activeElement !== inp) inp.value = R[k] || '';
inp.onchange = () => {
const F = TC.rsF, cur = TC.rsRange();
if (isC) { if (!(inp.value && inp.validity.valid)) return; F.cDe = cur.cDe; F.cAte = cur.cAte; F[k] = inp.value; F.c = 'custom'; }
else { if (inp.value && !inp.validity.valid) return; F.eDe = cur.eDe; F.eAte = cur.eAte; F[k] = inp.value || null; F.e = (F.eDe || F.eAte) ? 'custom' : 'all'; }
TC.rsChips(); TC.rsRedraw();
};
});
dash.draw('rsTxt', (el) => {
const c = TC.rsCalc(); if (!c) { el.textContent = '—'; return; }
const R = c.R, f = (d) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
const carg = R.cDe === R.cAte ? 'Cargas de ' + TC.dlabel(R.cDe) : 'Cargas de ' + f(R.cDe) + ' a ' + f(R.cAte);
const ent = !R.eDe && !R.eAte ? '' : R.eDe === R.eAte ? ', entregas previstas para ' + f(R.eDe) : R.eDe && R.eAte ? ', entregas previstas de ' + f(R.eDe) + ' a ' + f(R.eAte) : R.eDe ? ', entregas previstas a partir de ' + f(R.eDe) : ', entregas previstas até ' + f(R.eAte);
el.textContent = carg + ent;
});
dash.draw('rs', (el) => {
const c = TC.rsCalc(); if (!c) { el.textContent = '—'; return; }
const v = c.agg[el.dataset.field];
el.textContent = TC.fmt(v === undefined ? null : v, el.dataset.fmt);
if (el.dataset.good) { const n = TC.num(v); el.classList.toggle('tc-good', n !== null && n > 0); el.classList.toggle('tc-bad', n !== null && n < 0); }
});
dash.draw('rsMeter', (el) => {
const c = TC.rsCalc(); const v = c ? TC.num(c.agg[el.dataset.field]) : null;
el.replaceChildren(); const b = document.createElement('b'); b.style.width = (v === null ? 0 : Math.max(0, Math.min(100, v))) + '%'; el.append(b);
});
dash.draw('rsRoad', (el) => {
const c = TC.rsCalc(); const p = c ? Math.max(0, Math.min(100, TC.num(c.agg.pct_concluidas) || 0)) : 0;
el.replaceChildren();
const fill = document.createElement('div'); fill.className = 'nx-road-fill'; fill.style.width = p + '%';
const ns = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 64 44'); svg.setAttribute('class', 'nx-road-truck'); svg.setAttribute('aria-hidden', 'true');
const add = (tag, at) => { const e = document.createElementNS(ns, tag); Object.entries(at).forEach(([a, v]) => e.setAttribute(a, v)); svg.append(e); };
add('rect', {x: 3, y: 6, width: 36, height: 24, rx: 3, fill: 'currentColor'});
add('path', {d: 'M41 13h11.5l8.5 9.5V30H41z', fill: 'currentColor'});
add('path', {d: 'M45 16h6.5l5 6H45z', fill: '#26302B'});
add('circle', {cx: 15, cy: 33, r: 5.5, fill: 'currentColor', stroke: '#26302B', 'stroke-width': 2.5});
add('circle', {cx: 50, cy: 33, r: 5.5, fill: 'currentColor', stroke: '#26302B', 'stroke-width': 2.5});
svg.style.left = 'calc(' + p + '% - ' + (p / 100 * 42) + 'px)';
el.append(fill, svg);
});
dash.draw('rsPs', (box) => { const c = TC.rsCalc(); if (!c) { box.replaceChildren(); return; } TC.psRow(box, TC.psConta(c.rows)); });
dash.draw('rsVRotas', (el) => {
const c = TC.rsCalc(); if (!c) { el.textContent = '—'; return; }
const l = (c.agg.lista[el.dataset.k] || []).slice().sort();
el.textContent = l.length ? 'Rotas: ' + l.join(', ') : 'Nenhuma rota nesta etapa';
});
dash.draw('rsVTempo', (el) => { const c = TC.rsCalc(); if (!c) { el.textContent = '—'; return; } TC.vtShow(el, c.agg.tempos, 'no filtro'); });
dash.draw('rsCli', (tb) => {
const c = TC.rsCalc(), vazio = document.getElementById('clidia-vazio');
if (!c) { tb.replaceChildren(); return; }
const minus = ['de', 'da', 'do', 'das', 'dos', 'e'];
const titulo = (t) => t.toLowerCase().split(/\s+/).filter(Boolean).map((w, i) => (i > 0 && minus.includes(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const chave = (t) => t.toUpperCase().replace(/\s+/g, '');
const nomes = new Map(), grupos = new Map();
c.rows.forEach((r) => { const g = (r.grupo || '').trim(); const k = g ? chave(g) : ''; if (g) { const m = nomes.get(k) || new Map(); m.set(g, (m.get(g) || 0) + 1); nomes.set(k, m); } let a = grupos.get(k); if (!a) { a = []; grupos.set(k, a); } a.push(r); });
const lin = Array.from(grupos.entries()).map(([k, rows]) => {
const nome = k ? titulo(Array.from(nomes.get(k).entries()).sort((a, b) => b[1] - a[1])[0][0]) : 'Sem cliente informado';
return Object.assign({grupo: nome, ps: TC.psConta(rows)}, TC.rsAgg(rows));
}).sort((a, b) => (b.entregas - a.entregas) || (a.grupo < b.grupo ? -1 : 1));
if (vazio) vazio.hidden = lin.length > 0;
tb.replaceChildren(...lin.map((r) => {
const tr = document.createElement('tr'); tr.dataset.key = encodeURIComponent(r.grupo);
const td = (txt, cls) => { const x = document.createElement('td'); if (cls) x.className = cls; x.textContent = txt; tr.append(x); return x; };
td(r.grupo); td(TC.fmt(r.entregas, 'int'), 'n'); td(TC.fmt(r.concluidas, 'int'), 'n'); td(TC.fmt(r.pendentes, 'int'), 'n');
['hoje', 'atr', 'fut'].forEach((k) => TC.psCell(td('', 'n'), r.ps[k], k));
const pc = td(''); const wrap = document.createElement('span'); wrap.className = 'tc-prog';
const bar = document.createElement('i'); const fill = document.createElement('b');
const p = TC.num(r.pct_concluidas) || 0; fill.style.width = p + '%';
fill.style.background = p >= 100 ? 'var(--color-ok)' : p >= 50 ? TC.pal[0] : 'var(--color-warn)';
bar.append(fill); const lbl = document.createElement('span'); lbl.textContent = TC.fmt(r.pct_concluidas, 'pct');
wrap.append(bar, lbl); pc.append(wrap);
td(TC.fmt(r.ocorrencias, 'int'), 'n'); td(TC.fmt(r.sla_janela_pct, 'pct'), 'n'); td(TC.fmt(r.on_time_pct, 'pct'), 'n');
return tr;
}));
});

dash.draw('rsRoads', (box) => {
const g = dash.data('entregas_cliente'); box.replaceChildren(); if (g.status !== 'ok') return;
const h = TC.hojeISO(), add = (iso, n) => { const a = iso.split('-').map(Number), d = new Date(a[0], a[1] - 1, a[2] + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dias = [-3, -2, -1, 0].map((n) => add(h, n)), amanha = add(h, 1);
const grp = {}; dias.forEach((d) => { grp[d] = [0, 0]; }); grp.fut = [0, 0];
g.data.forEach((r) => { const p = TC.dnPrev(r); const k = grp[p] ? p : p >= amanha ? 'fut' : null; if (!k) return; grp[k][0]++; if (TC.isEnt(r)) grp[k][1]++; });
const sem = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const ns = 'http://www.w3.org/2000/svg';
const truck = (p) => {
const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 64 44'); svg.setAttribute('class', 'nx-road-truck'); svg.setAttribute('aria-hidden', 'true');
const a = (tag, at) => { const e = document.createElementNS(ns, tag); Object.entries(at).forEach(([k, v]) => e.setAttribute(k, v)); svg.append(e); };
a('rect', {x: 3, y: 6, width: 36, height: 24, rx: 3, fill: 'currentColor'}); a('path', {d: 'M41 13h11.5l8.5 9.5V30H41z', fill: 'currentColor'}); a('path', {d: 'M45 16h6.5l5 6H45z', fill: '#26302B'});
a('circle', {cx: 15, cy: 33, r: 5.5, fill: 'currentColor', stroke: '#26302B', 'stroke-width': 2.5}); a('circle', {cx: 50, cy: 33, r: 5.5, fill: 'currentColor', stroke: '#26302B', 'stroke-width': 2.5});
svg.style.left = 'calc(' + p + '% - ' + (p / 100) + ' * var(--nx-tw, 42px))'; return svg;
};
const linha = (k, titulo, sub) => {
const [tot, ok] = grp[k], p = tot ? Math.round(ok / tot * 1000) / 10 : 0;
const row = document.createElement('div'); row.className = 'nx-roadrow' + (k === h ? ' is-hoje' : ''); row.dataset.key = k;
const l = document.createElement('div'); l.className = 'nx-rd-l'; const b = document.createElement('b'); b.textContent = titulo; l.append(b, sub);
const tr = document.createElement('div'); tr.className = 'nx-road-track';
const fill = document.createElement('div'); fill.className = 'nx-road-fill'; fill.style.width = p + '%'; tr.append(fill, truck(p));
tr.title = TC.fmt(ok, 'int') + ' de ' + TC.fmt(tot, 'int') + ' entregas concluídas';
const r = document.createElement('div'); r.className = 'nx-rd-r'; const rb = document.createElement('b'); rb.textContent = tot ? TC.fmt(p, 'pct') : '—'; r.append(rb, document.createElement('br'), TC.fmt(ok, 'int') + ' de ' + TC.fmt(tot, 'int') + ' concluídas');
row.append(l, tr, r); box.append(row);
};
dias.forEach((d, i) => { const a = d.split('-').map(Number), wd = new Date(a[0], a[1] - 1, a[2]).getDay(); linha(d, i === 3 ? 'Hoje' : i === 2 ? 'Ontem' : sem[wd].charAt(0).toUpperCase() + sem[wd].slice(1), d.slice(8, 10) + '/' + d.slice(5, 7)); });
linha('fut', 'Próximos dias', 'a partir de ' + amanha.slice(8, 10) + '/' + amanha.slice(5, 7));
});
if (window.__nxRoadsTick) clearInterval(window.__nxRoadsTick);
window.__nxRoadsTick = setInterval(() => dash.draw('rsRoads'), 300000);

(() => {
const W = window;
if (W.__nxUpdUnsub) { try { W.__nxUpdUnsub(); } catch (e) { /* segue */ } }
const db = W.claude && W.claude.use ? W.claude.use('db').catch(() => null) : Promise.resolve(null);
db.then((d) => { if (!d) return; W.__nxUpdUnsub = d.doc('datasets/entregas_cliente').onSnapshot((snap) => { const x = snap.exists ? snap.data() : null; TC.ultAtual = x && x.updated && x.updated.at ? x.updated.at : null; dash.draw('tvAtualizado'); }, () => {}); });
})();
dash.draw('tvAtualizado', (el) => {
if (!TC.ultAtual) { el.textContent = '—'; return; }
const d = new Date(TC.ultAtual); if (isNaN(d)) { el.textContent = '—'; return; }
el.textContent = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() + ' às ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
});
