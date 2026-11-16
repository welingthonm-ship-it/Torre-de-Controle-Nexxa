(() => {
const W = window;
TC.pd = W.__nxPd = W.__nxPd || {de: null, ate: null, quick: 'all', atraso: '', transp: '', busca: '', dn: '', cls: ''};
const P = TC.pd;
TC.pdPrazo = (r) => {
const prev = r.chegada_prevista || '';
const base = TC.alvoData(r).split('-').map(Number);
const fim = String(r.janela || '').split('–')[1];
let d;
if (/^\d\d:\d\d$/.test(fim || '')) { const [h, m] = fim.split(':').map(Number); d = new Date(base[0], base[1] - 1, base[2], h, m); }
else if (prev) { const [h, m] = prev.slice(11, 16).split(':').map(Number); d = new Date(base[0], base[1] - 1, base[2], h, m); }
else d = new Date(base[0], base[1] - 1, base[2], 23, 59);
return d.getTime();
};
TC.pdAtraso = (r) => Math.round((Date.now() - TC.pdPrazo(r)) / 60000);
TC.pdFmt = (min) => {
if (min <= 0) { const f = -min; return f < 60 ? 'No prazo · vence em ' + f + ' min' : f < 1440 ? 'No prazo · vence em ' + Math.round(f / 60) + ' h' : f < 2880 ? 'No prazo · vence amanhã' : 'No prazo · vence em ' + Math.ceil(f / 1440) + ' dias'; }
if (min < 60) return min + ' min';
if (min < 1440) return Math.floor(min / 60) + ' h' + (min % 60 ? ' ' + (min % 60) + ' min' : '');
const dd = Math.floor(min / 1440); return dd + (dd === 1 ? ' dia' : ' dias') + ' ' + Math.floor((min % 1440) / 60) + ' h';
};
TC.pdSaida = (r) => {
const p = r.saida_prevista; if (!p) return null;
const t = (x) => { const [d, h] = String(x).split(' '); const a = d.split('-').map(Number), b = (h || '00:00').split(':').map(Number); return new Date(a[0], a[1] - 1, a[2], b[0], b[1]).getTime(); };
const real = r.saida_cd ? t(TC.saidaReal(r.saida_cd)) : Date.now();
return Math.round((real - t(p)) / 60000);
};
TC.pdNorm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
TC.pdDias = () => { const g = dash.data('resumo_dia'); return g.status === 'ok' ? g.data.map((r) => r.data).sort() : []; };
TC.pdRange = () => {
const d = TC.pdDias(); if (!d.length) return null;
let de = P.de || d[0], ate = P.ate || d[d.length - 1];
if (de > ate) { const t = de; de = ate; ate = t; }
return {de, ate, lo: d[0], hi: d[d.length - 1]};
};
TC.pdRows = () => {
const g = dash.data('entregas_cliente'), R = TC.pdRange();
if (g.status !== 'ok' || !R) return null;
const q = TC.pdNorm(P.busca);
return g.data.filter((r) => !TC.isEnt(r) && (TC.soHoje ? TC.prevHoje(r) : (r.data >= R.de && r.data <= R.ate)) && (!P.transp || r.transportadora === P.transp)
&& (!q || TC.pdNorm(r.cliente + ' ' + r.rota + ' ' + r.cidade + ' ' + r.codigo + ' ' + (r.motorista || '') + ' ' + (r.placa || '')).includes(q)))
.map((r) => ({r, min: TC.pdAtraso(r), al: TC.alDe ? TC.alDe(r.data, r.rota) : null}))
.filter((x) => !P.atraso || (P.atraso === 'atrasadas' ? x.min > 0 : P.atraso === 'prazo' ? x.min <= 0 : x.min > (+P.atraso) * 1440))
.filter((x) => !P.dn || TC.dnOk(x.r, P.dn))
.filter((x) => !P.cls || TC.pdCls(x.r) === P.cls)
.sort((a, b) => b.min - a.min);
};
TC.pdRedraw = () => ['pdIn', 'pdN', 'pdList', 'pdTransp'].forEach((n) => dash.draw(n));
TC.pdChips = () => document.querySelectorAll('.nx-chip[data-pd-per]').forEach((c) => c.classList.toggle('is-on', c.dataset.pdPer === P.quick));
document.querySelectorAll('.nx-chip[data-pd-per]').forEach((c) => { c.onclick = () => {
const d = TC.pdDias(); if (!d.length) return;
P.quick = c.dataset.pdPer; const hi = d[d.length - 1];
if (P.quick === 'all') { P.de = null; P.ate = null; }
else if (P.quick === 'hoje') { P.de = hi; P.ate = hi; }
else { const t = new Date(hi + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - 6); P.de = t.toISOString().slice(0, 10); P.ate = hi; }
TC.pdChips(); TC.pdRedraw();
}; });
TC.pdChips();
TC.pdClsChips = () => document.querySelectorAll('.nx-chip[data-pd-cls]').forEach((c) => c.classList.toggle('is-on', c.dataset.pdCls === (P.cls || '')));
document.querySelectorAll('.nx-chip[data-pd-cls]').forEach((c) => { c.onclick = () => { P.cls = c.dataset.pdCls; TC.pdClsChips(); dash.draw('pdN'); dash.draw('pdList'); }; });
TC.pdClsChips();
document.querySelectorAll('#pd-atraso').forEach((s) => { s.value = P.atraso; s.onchange = () => { P.atraso = s.value; TC.pdRedraw(); }; });
document.querySelectorAll('#pd-dn').forEach((s) => { s.value = P.dn || ''; s.onchange = () => { P.dn = s.value; TC.pdRedraw(); }; });
document.querySelectorAll('#pd-busca').forEach((i) => { i.value = P.busca; i.oninput = () => { P.busca = i.value; clearTimeout(W.__nxPdT); W.__nxPdT = setTimeout(() => { dash.draw('pdN'); dash.draw('pdList'); }, 250); }; });
if (W.__nxPdTick) clearInterval(W.__nxPdTick);
W.__nxPdTick = setInterval(() => { const t = document.getElementById('pendentes'); if (t && !t.hidden) { dash.draw('pdN'); dash.draw('pdList'); } }, 300000);
})();
dash.draw('pdIn', (inp) => {
const R = TC.pdRange(); if (!R) return;
inp.min = R.lo; inp.max = R.hi;
if (document.activeElement !== inp) inp.value = R[inp.dataset.k];
inp.onchange = () => { if (!(inp.value && inp.validity.valid)) return; const cur = TC.pdRange(); TC.pd.de = cur.de; TC.pd.ate = cur.ate; TC.pd[inp.dataset.k] = inp.value; TC.pd.quick = ''; TC.pdChips(); TC.pdRedraw(); };
inp.onblur = () => { const r = TC.pdRange(); if (r) inp.value = r[inp.dataset.k]; };
});
dash.draw('pdTransp', (sel) => {
const g = dash.data('entregas_cliente');
const ts = g.status === 'ok' ? Array.from(new Set(g.data.filter((r) => !TC.isEnt(r)).map((r) => r.transportadora).filter(Boolean))).sort() : [];
sel.replaceChildren(new Option('Todas', ''), ...ts.map((t) => new Option(t, t)));
sel.value = TC.pd.transp && ts.includes(TC.pd.transp) ? TC.pd.transp : '';
sel.onchange = () => { TC.pd.transp = sel.value; dash.draw('pdN'); dash.draw('pdList'); };
});
dash.draw('pdN', (el) => {
const rows = TC.pdRows();
if (!rows) { el.textContent = '—'; return; }
const k = el.dataset.k;
const n = k === 'total' ? rows.length : k === 'atrasadas' ? rows.filter((x) => x.min > 0).length : k === 'dia' ? rows.filter((x) => x.min > 1440).length : k === 'fut' ? rows.filter((x) => TC.pdCls(x.r) === 'fut').length : k === 'hoje' ? rows.filter((x) => TC.pdCls(x.r) === 'hoje').length : rows.filter((x) => x.al).length;
el.textContent = TC.fmt(n, 'int');
});
dash.draw('pdList', (tb) => {
const rows = TC.pdRows();
const vazio = document.getElementById('pd-vazio'), lim = document.getElementById('pd-limite');
if (!rows) { tb.replaceChildren(); return; }
if (vazio) vazio.hidden = rows.length > 0;
if (lim) lim.hidden = rows.length <= 500;
tb.replaceChildren(...rows.slice(0, 500).map(({r, min, al}) => {
const tr = document.createElement('tr');
tr.dataset.key = encodeURIComponent(r.id);
if (al) tr.classList.add('nx-al-row');
const td = (txt, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; if (txt !== null) c.textContent = txt; tr.append(c); return c; };
td(null).append(TC.psPill(TC.pdCls(r), null, true));
const a = td(null); const b = document.createElement('span');
b.className = 'nx-at ' + (min <= 0 ? 'nx-at-ok' : min <= 1440 ? 'nx-at-1' : min <= 4320 ? 'nx-at-2' : 'nx-at-3');
b.textContent = TC.pdFmt(min); a.append(b);
td(TC.fdt(r.data)); td(null).append(TC.dnBadge(r)); td(r.rota); td(r.seq_planejada, 'n'); td(r.codigo, 'nx-cod'); td(r.cliente); td(r.cidade); td(r.uf); td(r.transportadora); td(r.motorista || '—');
const st = td(null); const sb = document.createElement('span'); sb.className = 'tc-badge ' + (TC.stClass[r.status_rota] || 'tc-b-oth'); sb.textContent = TC.stLabel[r.status_rota] || r.status_rota; st.append(sb);
td(TC.fdt(r.saida_prevista)); td(r.saida_cd ? TC.fdt(TC.saidaReal(r.saida_cd)) : 'Ainda no CD');
{ const c = td(null), sd = TC.pdSaida(r), bb = document.createElement('span');
if (sd === null) { c.textContent = '—'; }
else { bb.className = 'nx-at ' + (sd <= 15 ? 'nx-at-ok' : sd <= 120 ? 'nx-at-1' : 'nx-at-2'); bb.textContent = sd <= 0 ? 'No horário' : sd <= 15 ? '+' + sd + ' min' : '+' + TC.pdFmt(sd); c.append(bb); } }
td(TC.fdt(r.chegada_prevista)); td(r.janela || '—');
const ac = td(al ? null : '—'); if (al) ac.append(TC.alBadge(al));
return tr;
}));
});
