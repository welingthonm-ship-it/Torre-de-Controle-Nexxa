// Histórico: desempenho da aderência ao app (baixa no app a até 500 m do cliente), por dia e por transportadora.
(() => {
const W0 = window;
TC.haTr = W0.__nxHaTr || '';
const pct = (s, a) => (a ? s / a * 100 : null);
const fp = (v) => (v === null ? '—' : v.toFixed(1).replace('.', ',') + '%');
const cor = (v) => (v === null ? '' : v >= 90 ? 'nx-ha-ok' : v >= 70 ? 'nx-ha-med' : 'nx-ha-ruim');
// Soma app_sim/app_aval por dia (todas ou uma transportadora).
TC.haSerie = (tr) => {
  const g = dash.data('transportadoras_dia'); if (g.status !== 'ok') return null;
  const m = new Map();
  g.data.forEach((r) => { if (tr && r.transportadora !== tr) return; const o = m.get(r.data) || {data: r.data, s: 0, a: 0}; o.s += +r.app_sim || 0; o.a += +r.app_aval || 0; m.set(r.data, o); });
  return Array.from(m.values()).sort((a, b) => (a.data < b.data ? -1 : 1)).map((o) => ({data: o.data, s: o.s, a: o.a, v: pct(o.s, o.a)}));
};
dash.draw('haTr', (sel) => {
  const g = dash.data('transportadoras_dia');
  const ts = g.status === 'ok' ? Array.from(new Set(g.data.map((r) => r.transportadora).filter(Boolean))).sort() : [];
  sel.replaceChildren(new Option('Todas as transportadoras', ''), ...ts.map((t) => new Option(t, t)));
  if (TC.haTr && !ts.includes(TC.haTr)) TC.haTr = '';
  sel.value = TC.haTr;
  sel.onchange = () => { TC.haTr = W0.__nxHaTr = sel.value; document.querySelectorAll('.nx-ha-sel').forEach((e) => { e.hidden = !TC.haTr; }); dash.draw('haChart'); dash.draw('haSelNome'); };
});
dash.draw('haSelNome', (e) => { e.textContent = TC.haTr || ''; });
dash.draw('haChart', (el) => {
  const g = dash.data('transportadoras_dia');
  if (g.status !== 'ok') return tcFail(el, g);
  const geral = TC.haSerie(''), sel = TC.haTr ? TC.haSerie(TC.haTr) : null;
  const rows = geral.filter((r) => r.v !== null);
  el.replaceChildren();
  if (!rows.length) { const p = document.createElement('p'); p.className = 'tc-empty'; p.textContent = 'Sem entregas avaliadas para aderência ao app.'; el.append(p); return; }
  const day = TC.dayOf();
  const W = Math.max(260, el.clientWidth), H = 250, m = {t: 10, r: 8, b: 26, l: 34};
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Aderência diária ao app');
  const y = d3.scaleLinear([0, 100], [H - m.b, m.t]);
  const ya = svg.append('g').attr('class', 'tc-axis').call(d3.axisLeft(y).ticks(5).tickSize(0).tickFormat((d) => d + '%'));
  let lw = 0; ya.selectAll('text').each(function () { lw = Math.max(lw, this.getComputedTextLength()); });
  m.l = lw + 10; ya.attr('transform', `translate(${m.l - 4},0)`); ya.select('.domain').remove();
  svg.insert('g', ':first-child').selectAll('line').data(y.ticks(5)).join('line')
    .attr('x1', m.l).attr('x2', W - m.r).attr('y1', (d) => y(d)).attr('y2', (d) => y(d)).style('stroke', 'var(--cds-chart-grid)');
  const x = d3.scalePoint(rows.map((r) => r.data), [m.l + 6, W - m.r - 6]);
  if (day && x(day) !== undefined) svg.append('line').attr('x1', x(day)).attr('x2', x(day)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-reference)').style('stroke-dasharray', '3 3');
  const linha = (serie, c, w) => {
    const s = serie.filter((r) => x(r.data) !== undefined);
    svg.append('path').datum(s).attr('d', d3.line().defined((r) => r.v !== null).x((r) => x(r.data)).y((r) => y(r.v))).style('fill', 'none').style('stroke', c).style('stroke-width', w);
    svg.append('g').selectAll('circle').data(s.filter((r) => r.v !== null)).join('circle').attr('cx', (r) => x(r.data)).attr('cy', (r) => y(r.v)).attr('r', (r) => (r.data === day ? 4 : 2.5)).style('fill', c);
  };
  linha(geral, TC.pal[0], 2.5);
  if (sel) linha(sel, '#DC6803', 2);
  tcXAxis(svg, x, rows, H, m, W);
  const tip = TC.tip(el), stp = x.step();
  const selM = new Map((sel || []).map((r) => [r.data, r]));
  svg.append('g').selectAll('rect').data(rows).join('rect')
    .attr('x', (r) => x(r.data) - stp / 2).attr('width', stp).attr('y', m.t).attr('height', H - m.t - m.b).style('fill', 'transparent').style('cursor', 'pointer')
    .on('mousemove', (ev, r) => {
      const L = [TC.dlabel(r.data), 'Geral: ' + fp(r.v) + ' (' + r.s + ' de ' + r.a + ')'];
      const q = selM.get(r.data); if (sel) L.push(TC.haTr + ': ' + (q ? fp(q.v) + ' (' + q.s + ' de ' + q.a + ')' : '—'));
      TC.showTip(tip, el, L, x(r.data) * el.clientWidth / W, m.t + 60);
    })
    .on('mouseleave', () => { tip.hidden = true; })
    .on('click', (ev, r) => TC.select(r.data));
});
// Quadro por transportadora: período inteiro, últimos 7 dias e variação contra a semana anterior.
dash.draw('haTab', (box) => {
  const g = dash.data('transportadoras_dia');
  if (g.status !== 'ok') { box.replaceChildren(); return; }
  const dias = Array.from(new Set(g.data.map((r) => r.data))).sort();
  const ult = dias.slice(-7), ant = dias.slice(-14, -7);
  const table = document.createElement('table'); table.className = 'tc-table nx-ha-tab';
  const hr = document.createElement('tr');
  ['Transportadora', 'Período'].concat(ult.map((d) => TC.short(d)), ['vs. 7 dias antes']).forEach((t, i) => { const th = document.createElement('th'); th.textContent = t; if (i) th.className = 'n'; hr.append(th); });
  const thead = document.createElement('thead'); thead.append(hr); const tb = document.createElement('tbody'); table.append(thead, tb);
  const ts = Array.from(new Set(g.data.map((r) => r.transportadora))).sort();
  const soma = (tr, ds) => { let s = 0, a = 0; g.data.forEach((r) => { if ((!tr || r.transportadora === tr) && (!ds || ds.includes(r.data))) { s += +r.app_sim || 0; a += +r.app_aval || 0; } }); return {s, a, v: pct(s, a)}; };
  const linha = (tr, nome) => {
    const tr0 = document.createElement('tr'); if (!tr) tr0.className = 'nx-ha-total';
    const td = (t, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; c.textContent = t; tr0.append(c); return c; };
    td(nome);
    const p = soma(tr, null); td(fp(p.v), 'n ' + cor(p.v)).title = p.s + ' de ' + p.a + ' entregas';
    ult.forEach((d) => { const q = soma(tr, [d]); td(fp(q.v), 'n ' + cor(q.v)).title = q.s + ' de ' + q.a; });
    const a7 = soma(tr, ult), b7 = soma(tr, ant);
    let dv = a7.v !== null && b7.v !== null ? Math.round((a7.v - b7.v) * 10) / 10 : null; if (dv === 0) dv = 0;
    td(dv === null ? '—' : (dv > 0 ? '▲ ' : dv < 0 ? '▼ ' : '') + Math.abs(dv).toFixed(1).replace('.', ',') + ' p.p.', 'n ' + (dv === null ? '' : dv >= 0 ? 'nx-ha-up' : 'nx-ha-down'));
    return {tr: tr0, v: a7.v};
  };
  const L = ts.map((t) => linha(t, t || 'Sem transportadora')).sort((a, b) => (a.v === null) - (b.v === null) || (a.v || 0) - (b.v || 0));
  tb.append(...L.map((x) => x.tr), linha('', 'Total').tr);
  box.replaceChildren(table);
});
})();
