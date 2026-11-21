// Rotas do dia: período (datas das rotas) e filtro rápido por status.
(() => {
const W = window;
TC.rtPer = W.__nxRtPer = W.__nxRtPer || {q: 'dia', de: null, ate: null};
const P = TC.rtPer;
const dias = () => { const g = dash.data('rotas_dia'); return g.status === 'ok' ? Array.from(new Set(g.data.map((r) => r.data))).sort() : []; };
const menos = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - n); return t.toISOString().slice(0, 10); };
// Período em uso: "Dia monitorado" acompanha o seletor de dia; os outros são datas fixas.
TC.rtRange = () => {
  const d = dias(); if (!d.length) return null;
  const lo = d[0], hi = d[d.length - 1];
  let de, ate;
  if (P.q === 'dia') { const x = TC.dayOf(); de = ate = x || hi; }
  else if (P.q === '7') { ate = hi; de = menos(hi, 6); }
  else if (P.q === 'mes') { ate = hi; de = hi.slice(0, 8) + '01'; }
  else if (P.q === 'all') { de = lo; ate = hi; }
  else { de = P.de || hi; ate = P.ate || hi; }
  if (de > ate) { const t = de; de = ate; ate = t; }
  return {de, ate, lo, hi, umDia: de === ate};
};
TC.rtNoPer = (r) => { const R = TC.rtRange(); return !!R && r.data >= R.de && r.data <= R.ate; };
TC.rtRedraw = () => ['rtIn', 'rtStN', 'rtClsN', 'rotas', 'rtPerTxt'].forEach((n) => dash.draw(n));
const chipsPer = () => document.querySelectorAll('.nx-chip[data-rt-q]').forEach((c) => c.classList.toggle('is-on', c.dataset.rtQ === P.q));
document.querySelectorAll('.nx-chip[data-rt-q]').forEach((c) => { c.onclick = () => { P.q = c.dataset.rtQ; P.de = P.ate = null; chipsPer(); TC.rtRedraw(); }; });
chipsPer();
const chipsSt = () => document.querySelectorAll('.nx-chip[data-rt-st]').forEach((c) => c.classList.toggle('is-on', c.dataset.rtSt === (TC.status || '')));
document.querySelectorAll('.nx-chip[data-rt-st]').forEach((c) => { c.onclick = () => { TC.status = c.dataset.rtSt; chipsSt(); TC.rtRedraw(); }; });
chipsSt();
dash.draw('rtIn', (inp) => {
  const R = TC.rtRange(); if (!R) return;
  inp.min = R.lo; inp.max = R.hi;
  if (document.activeElement !== inp) inp.value = R[inp.dataset.k];
  inp.onchange = () => {
    if (!(inp.value && inp.validity.valid)) return;
    const cur = TC.rtRange(); P.de = cur.de; P.ate = cur.ate; P[inp.dataset.k] = inp.value; P.q = '';
    chipsPer(); TC.rtRedraw();
  };
  inp.onblur = () => { const r = TC.rtRange(); if (r) inp.value = r[inp.dataset.k]; };
});
dash.draw('rtPerTxt', (el) => {
  const R = TC.rtRange(); if (!R) { el.textContent = '—'; return; }
  el.textContent = R.umDia ? TC.dlabel(R.de) : TC.short(R.de) + ' a ' + TC.short(R.ate) + '/' + R.ate.slice(0, 4);
});
// Quantidade de rotas por status no período (respeita o filtro de pendentes escolhido)
dash.draw('rtStN', (el) => {
  const g = dash.data('rotas_dia'); if (g.status !== 'ok' || !TC.rtRange()) { el.textContent = '—'; return; }
  const cl = TC.rtCls || '', psm = cl ? (TC.psPor(function rotaKey(x) { return x.data + '|' + x.rota; }) || new Map()) : null;
  const k = el.dataset.k || '';
  const n = g.data.filter((r) => TC.rtNoPer(r) && (!k || r.status_rota === k) && (!cl || ((psm.get(r.data + '|' + r.rota) || {})[cl] || 0) > 0)).length;
  el.textContent = '(' + TC.fmt(n, 'int') + ')';
});
})();
