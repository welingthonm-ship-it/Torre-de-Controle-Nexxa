// Rankings (transportadoras, motoristas e clientes): cálculo por dia, filtros, tabela e subtotal.
(() => {
dash.calc('motoristas_dia', {
inputs: ['entregas_cliente'],
title: 'Nível de serviço por motorista e dia',
description: 'Entregas, viagens, concluídas, ocorrências e entregas avaliadas e no padrão de SLA janela, On Time e OTIF, por motorista, transportadora e data de rota.',
fn: (entregas_cliente) => {
const grupos = new Map();
entregas_cliente.forEach((r) => {
const k = r.data + '|' + (r.motorista || 'Não informado') + '|' + (r.transportadora || 'Sem transportadora');
if (!grupos.has(k)) grupos.set(k, []);
grupos.get(k).push(r);
});
const conta = (rows, col) => { let sim = 0, aval = 0; rows.forEach((r) => { if (r[col] === 'SIM') { sim++; aval++; } else if (r[col] === 'NÃO') aval++; }); return [sim, aval]; };
return Array.from(grupos.entries()).map(([k, rows]) => {
const p = k.split('|');
const sla = conta(rows, 'sla_janela'), ot = conta(rows, 'on_time'), of = conta(rows, 'otif'), ap = conta(rows, 'app_no_raio');
return {
data: p[0], motorista: p[1], transportadora: p.slice(2).join('|'), viagens: new Set(rows.map((r) => r.rota)).size, entregas: rows.length,
concluidas: rows.filter((r) => r.entregue === 'SIM').length, ocorrencias: rows.filter((r) => r.ocorrencia).length,
oc_falta: rows.filter((r) => r.ocorrencia === 'Falta').length, oc_devolucao: rows.filter((r) => r.ocorrencia === 'Devolução Total').length, oc_avaria: rows.filter((r) => r.ocorrencia === 'Avaria').length, oc_qualidade: rows.filter((r) => r.ocorrencia === 'Qualidade').length,
sla_sim: sla[0], sla_aval: sla[1], ontime_sim: ot[0], ontime_aval: ot[1], otif_sim: of[0], otif_aval: of[1], app_sim: ap[0], app_aval: ap[1]
};
});
}
});
dash.calc('clientes_rk_dia', {
inputs: ['entregas_cliente'],
title: 'Nível de serviço por cliente e dia',
description: 'Entregas, rotas, concluídas, ocorrências, espera e entregas avaliadas e no padrão de SLA janela, On Time e OTIF, por cliente (código), transportadora e data de rota.',
fn: (entregas_cliente) => {
const grupos = new Map();
entregas_cliente.forEach((r) => {
const k = r.data + '|' + (r.codigo || r.cliente || 'Não informado') + '|' + (r.transportadora || 'Sem transportadora');
if (!grupos.has(k)) grupos.set(k, []);
grupos.get(k).push(r);
});
const conta = (rows, col) => { let sim = 0, aval = 0; rows.forEach((r) => { if (r[col] === 'SIM') { sim++; aval++; } else if (r[col] === 'NÃO') aval++; }); return [sim, aval]; };
return Array.from(grupos.values()).map((rows) => {
const r0 = rows[0], sla = conta(rows, 'sla_janela'), ot = conta(rows, 'on_time'), of = conta(rows, 'otif'), ap = conta(rows, 'app_no_raio');
const esp = rows.map((r) => +r.min_espera).filter((v) => isFinite(v) && v >= 0);
return {
data: r0.data, codigo: r0.codigo || r0.cliente || 'Não informado', cliente: r0.cliente || '', grupo: r0.grupo || '', cidade: (r0.cidade || '') + (r0.uf ? '/' + r0.uf : ''), transportadora: r0.transportadora || 'Sem transportadora',
viagens: new Set(rows.map((r) => r.rota)).size, entregas: rows.length,
concluidas: rows.filter((r) => r.entregue === 'SIM').length, ocorrencias: rows.filter((r) => r.ocorrencia).length,
oc_falta: rows.filter((r) => r.ocorrencia === 'Falta').length, oc_devolucao: rows.filter((r) => r.ocorrencia === 'Devolução Total').length, oc_avaria: rows.filter((r) => r.ocorrencia === 'Avaria').length, oc_qualidade: rows.filter((r) => r.ocorrencia === 'Qualidade').length,
sla_sim: sla[0], sla_aval: sla[1], ontime_sim: ot[0], ontime_aval: ot[1], otif_sim: of[0], otif_aval: of[1], app_sim: ap[0], app_aval: ap[1],
esp_soma: esp.reduce((a, b) => a + b, 0), esp_n: esp.length
};
});
}
});
TC.RK = {
transportadoras_dia: {key: (r) => r.transportadora, nome: (t) => t.transportadora, cols: [], per: {de: null, ate: null}, ord: 'sla', min: 10, quick: '7'},
motoristas_dia: {key: (r) => r.motorista + '|' + r.transportadora, nome: (t) => t.motorista + ' · ' + t.transportadora, cols: ['transportadora'], per: {de: null, ate: null}, ord: 'sla', min: 10, quick: '7', transp: ''},
clientes_rk_dia: {key: (r) => r.codigo, nome: (t) => (t.codigo ? t.codigo + ' · ' : '') + t.cliente, cols: ['grupo', 'cidade'], per: {de: null, ate: null}, ord: 'sla', min: 1, quick: '7', transp: ''}
};
TC.rkOf = (el) => { const sec = el.closest('[data-rk]'); return sec ? sec.dataset.rk : null; };
TC.rkDias = () => { const g = dash.data('resumo_dia'); return g.status === 'ok' ? g.data.map((r) => r.data).sort() : []; };
TC.rkRange = (id) => {
const d = TC.rkDias(); if (!d.length) return null;
const lo = d[0], hi = d[d.length - 1], st = TC.RK[id];
let de = st.per.de, ate = st.per.ate;
if (!de || !ate) { ate = hi; const t = new Date(hi + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - 6); de = t.toISOString().slice(0, 10); }
if (de < lo) de = lo; if (ate > hi) ate = hi; if (de > ate) { const t = de; de = ate; ate = t; }
return {de, ate, lo, hi};
};
TC.rkPct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : null);
TC.rkRows = (id) => {
const g = dash.data(id), R = TC.rkRange(id), st = TC.RK[id];
if (g.status !== 'ok' || !R || !Array.isArray(g.data)) return null;
const m = new Map();
g.data.forEach((r) => {
if (r.data < R.de || r.data > R.ate) return;
if (st.transp && r.transportadora !== st.transp) return;
if (st.q && ![r.codigo, r.cliente, r.grupo, r.cidade].join(' ').toLowerCase().includes(st.q)) return;
const k = st.key(r);
const t = m.get(k) || {transportadora: r.transportadora, motorista: r.motorista, codigo: r.codigo, cliente: r.cliente, grupo: r.grupo, cidade: r.cidade, esp_soma: 0, esp_n: 0, entregas: 0, viagens: 0, concluidas: 0, ocorrencias: 0, oc_falta: 0, oc_devolucao: 0, oc_avaria: 0, oc_qualidade: 0, sla_sim: 0, sla_aval: 0, ontime_sim: 0, ontime_aval: 0, otif_sim: 0, otif_aval: 0, app_sim: 0, app_aval: 0};
['entregas', 'viagens', 'concluidas', 'ocorrencias', 'oc_falta', 'oc_devolucao', 'oc_avaria', 'oc_qualidade', 'sla_sim', 'sla_aval', 'ontime_sim', 'ontime_aval', 'otif_sim', 'otif_aval', 'app_sim', 'app_aval', 'esp_soma', 'esp_n'].forEach((f) => { t[f] += +r[f] || 0; });
if (t.transportadora !== r.transportadora && !st.transp) t.transportadora = 'Várias';
m.set(k, t);
});
return Array.from(m.values()).map((t) => Object.assign(t, {
conc: TC.rkPct(t.concluidas, t.entregas), sla: TC.rkPct(t.sla_sim, t.sla_aval), ontime: TC.rkPct(t.ontime_sim, t.ontime_aval),
otif: TC.rkPct(t.otif_sim, t.otif_aval), oc: TC.rkPct(t.ocorrencias, t.entregas), ocq: t.ocorrencias, ent: t.entregas, app: TC.rkPct(t.app_sim, t.app_aval), esp: t.esp_n ? Math.round(t.esp_soma / t.esp_n) : null
}));
};
TC.rkSort = (rows, k) => rows.slice().sort((a, b) => {
const va = a[k], vb = b[k];
if (va === null && vb === null) return b.entregas - a.entregas;
if (va === null) return 1; if (vb === null) return -1;
return (k === 'oc' ? va - vb : vb - va) || (b.entregas - a.entregas);
});
TC.rkRedraw = () => ['perIn', 'rkTxt', 'rkTop', 'rk', 'rkApp'].forEach((n) => dash.draw(n));
TC.rkChips = () => document.querySelectorAll('[data-rk] .nx-chip[data-per]').forEach((c) => { const id = TC.rkOf(c); c.classList.toggle('is-on', !!id && c.dataset.per === TC.RK[id].quick); });
document.querySelectorAll('[data-rk] .nx-chip[data-per]').forEach((c) => c.addEventListener('click', () => {
const id = TC.rkOf(c), d = TC.rkDias(); if (!id || !d.length) return;
const st = TC.RK[id]; st.quick = c.dataset.per;
if (c.dataset.per === 'all') st.per = {de: d[0], ate: d[d.length - 1]};
else { const n = +c.dataset.per, hi = d[d.length - 1]; const t = new Date(hi + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - (n - 1)); st.per = {de: t.toISOString().slice(0, 10), ate: hi}; }
TC.rkChips(); TC.rkRedraw();
}));
TC.rkChips();
document.querySelectorAll('[data-rk] .rk-ord').forEach((s) => s.addEventListener('change', () => { const id = TC.rkOf(s); if (id) { TC.RK[id].ord = s.value; TC.rkRedraw(); } }));
document.querySelectorAll('[data-rk] .rk-transp').forEach((s) => s.addEventListener('change', () => { const id = TC.rkOf(s); if (id) { TC.RK[id].transp = s.value; TC.rkRedraw(); } }));
dash.draw('rkTransp', (sel) => {
const id = TC.rkOf(sel), g = id ? dash.data(id) : null, st = id && TC.RK[id];
const lista = g && g.status === 'ok' && Array.isArray(g.data) ? Array.from(new Set(g.data.map((r) => r.transportadora).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')) : [];
const op = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; return o; };
sel.replaceChildren(op('', 'Todas'), ...lista.map((t) => op(t, t)));
if (st && st.transp && !lista.includes(st.transp)) st.transp = '';
sel.value = st ? st.transp : '';
});
document.querySelectorAll('[data-rk] .rk-busca').forEach((s) => s.addEventListener('input', () => { const id = TC.rkOf(s); if (id) { TC.RK[id].q = s.value.trim().toLowerCase(); TC.rkRedraw(); } }));
document.querySelectorAll('[data-rk] .rk-min').forEach((s) => s.addEventListener('change', () => { const id = TC.rkOf(s); if (id) { TC.RK[id].min = +s.value || 1; TC.rkRedraw(); } }));
dash.draw('perIn', (inp) => {
const id = TC.rkOf(inp); if (!id) return;
const R = TC.rkRange(id); if (!R) return;
inp.min = R.lo; inp.max = R.hi;
if (document.activeElement !== inp) inp.value = R[inp.dataset.k];
inp.onchange = () => {
if (!(inp.value && inp.validity.valid)) return;
const cur = TC.rkRange(id), st = TC.RK[id]; st.per = {de: cur.de, ate: cur.ate}; st.per[inp.dataset.k] = inp.value; st.quick = ''; TC.rkChips(); TC.rkRedraw();
};
inp.onblur = () => { const r = TC.rkRange(id); if (r) inp.value = r[inp.dataset.k]; };
});
dash.draw('rkTxt', (el) => {
const id = TC.rkOf(el); const R = id && TC.rkRange(id), rows = id && TC.rkRows(id);
if (!R || !rows) { el.textContent = '—'; return; }
const k = el.dataset.k;
el.textContent = k === 'de' || k === 'ate' ? TC.fdt(R[k]) : k === 'n' ? TC.fmt(id === 'motoristas_dia' ? new Set(rows.map((r) => r.motorista)).size : rows.length, 'int') : TC.fmt(d3.sum(rows, (r) => r.entregas), 'int');
});
dash.draw('rkTop', (el) => {
const id = TC.rkOf(el); const rows = id && TC.rkRows(id);
if (!rows) { el.textContent = '—'; return; }
const k = el.dataset.k, st = TC.RK[id], ok = rows.filter((r) => r.entregas >= st.min && r[k] !== null && r.motorista !== 'Não informado');
const top = ok.length ? TC.rkSort(ok, k)[0] : null;
const qtd = (n) => TC.fmt(n, 'int') + (+n === 1 ? ' ocorrência' : ' ocorrências');
el.textContent = !top ? '—' : el.dataset.p === 'nome' ? st.nome(top) : el.dataset.p === 'qtd' ? qtd(top.ocorrencias) : el.dataset.p === 'pct' ? TC.fmt(top.oc, 'pct') : k === 'ocq' ? TC.fmt(top.ocq, 'int') : TC.fmt(top[k], 'pct');
});
dash.draw('rk', (tb) => {
const id = TC.rkOf(tb); const rows = id && TC.rkRows(id);
const vazio = tb.closest('[data-rk]').querySelector('.rk-vazio');
if (!rows) { tb.replaceChildren(); return; }
const st = TC.RK[id];
const list = TC.rkSort(rows.filter((r) => r.entregas >= st.min), st.ord);
if (vazio) vazio.hidden = list.length > 0;
const bar = (v, cor) => {
const w = document.createElement('span'); w.className = 'tc-prog';
const i = document.createElement('i'); const b = document.createElement('b'); b.style.width = (v || 0) + '%'; b.style.background = cor; i.append(b);
const l = document.createElement('span'); l.textContent = TC.fmt(v, 'pct'); w.append(i, l); return w;
};
const sub = (() => {
if (!list.length) return null;
const t = {}; ['entregas', 'viagens', 'concluidas', 'ocorrencias', 'oc_falta', 'oc_devolucao', 'oc_avaria', 'oc_qualidade', 'sla_sim', 'sla_aval', 'ontime_sim', 'ontime_aval', 'otif_sim', 'otif_aval', 'app_sim', 'app_aval'].forEach((f) => { t[f] = d3.sum(list, (r) => +r[f] || 0); });
Object.assign(t, {conc: TC.rkPct(t.concluidas, t.entregas), sla: TC.rkPct(t.sla_sim, t.sla_aval), ontime: TC.rkPct(t.ontime_sim, t.ontime_aval), otif: TC.rkPct(t.otif_sim, t.otif_aval), oc: TC.rkPct(t.ocorrencias, t.entregas), app: TC.rkPct(t.app_sim, t.app_aval)});
const tr = document.createElement('tr'); tr.className = 'nx-rk-sub';
const td = (txt, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; if (txt !== null) c.textContent = txt; tr.append(c); return c; };
td('', 'n');
if (id === 'motoristas_dia') { td('Subtotal · ' + TC.fmt(new Set(list.map((r) => r.motorista)).size, 'int') + ' motoristas', 'nx-sub-l'); td(st.transp || 'Todas as transportadoras'); }
else if (id === 'clientes_rk_dia') { td('Total · ' + TC.fmt(list.length, 'int') + ' clientes', 'nx-sub-l'); td(st.transp || 'Todas as transportadoras'); td(''); }
else td('Total · ' + TC.fmt(list.length, 'int') + ' transportadoras', 'nx-sub-l');
td(TC.fmt(t.entregas, 'int'), 'n'); td(TC.fmt(t.viagens, 'int'), 'n'); td(TC.fmt(t.conc, 'pct'), 'n');
td(null).append(bar(t.app, '#7A5AF8')); td(null).append(bar(t.sla, TC.pal[0])); td(TC.fmt(t.oc, 'pct'), 'n');
td(null).append(bar(t.ontime, TC.pal[2])); td(null).append(bar(t.otif, TC.pal[3]));
const oq = td(TC.fmt(t.ocorrencias, 'int'), 'n nx-ocq'); if (t.ocorrencias > 0) oq.classList.add('has');
['oc_falta', 'oc_devolucao', 'oc_avaria', 'oc_qualidade'].forEach((f) => { const c = td(t[f] ? TC.fmt(t[f], 'int') : '–', 'n nx-octp'); if (t[f]) c.classList.add('has'); });
if (id === 'clientes_rk_dia') { const es = d3.sum(list, (r) => +r.esp_n || 0); td(es ? TC.fmin(Math.round(d3.sum(list, (r) => +r.esp_soma || 0) / es)) : '—', 'n'); }
return tr;
})();
tb.replaceChildren(...(sub ? [sub] : []), ...list.map((r, ix) => {
const tr = document.createElement('tr'); if (ix < 3) tr.className = 'is-top';
const td = (txt, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; if (txt !== null) c.textContent = txt; tr.append(c); return c; };
const pos = td(null, 'n nx-pos'); const pb = document.createElement('b'); if (ix < 3) pb.className = 'p' + (ix + 1); pb.textContent = ix + 1; pos.append(pb);
td(id === 'motoristas_dia' ? r.motorista : id === 'clientes_rk_dia' ? (r.codigo ? r.codigo + ' · ' : '') + (r.cliente || '') : r.transportadora);
st.cols.forEach((c) => td(r[c]));
td(TC.fmt(r.entregas, 'int'), 'n'); td(TC.fmt(r.viagens, 'int'), 'n'); td(TC.fmt(r.conc, 'pct'), 'n');
td(null).append(bar(r.app, '#7A5AF8')); td(null).append(bar(r.sla, TC.pal[0])); td(TC.fmt(r.oc, 'pct'), 'n');
td(null).append(bar(r.ontime, TC.pal[2])); td(null).append(bar(r.otif, TC.pal[3]));
const oq = td(TC.fmt(r.ocorrencias, 'int'), 'n nx-ocq'); if (+r.ocorrencias > 0) oq.classList.add('has');
['oc_falta', 'oc_devolucao', 'oc_avaria', 'oc_qualidade'].forEach((f) => { const c = td(+r[f] ? TC.fmt(r[f], 'int') : '–', 'n nx-octp'); if (+r[f]) c.classList.add('has'); });
if (id === 'clientes_rk_dia') td(r.esp === null ? '—' : TC.fmin(r.esp), 'n');
return tr;
}));
});

})();
