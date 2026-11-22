// Entregas pendentes: relatório PDF com alertas, separado por rota, com a previsão atual de cada entrega.
(() => {
const W = window;
const P = TC.pd;
TC.pdRel = W.__nxPdRel = W.__nxPdRel || {cls: '', transp: '', alerta: 'todas', tipo: ''};
const RL = TC.pdRel;
const msg = (k) => document.querySelectorAll('#pd-rel .pd-rel-msg').forEach((e) => { e.hidden = !e.classList.contains(k); });

// Pendentes conforme a tela (período, atraso, prazo, busca) + filtros do relatório.
TC.pdRelRows = () => {
  const keep = {cls: P.cls, transp: P.transp};
  P.cls = RL.cls; P.transp = RL.transp;
  let rows; try { rows = TC.pdRows(); } finally { P.cls = keep.cls; P.transp = keep.transp; }
  if (!rows) return null;
  return rows.filter((x) => (RL.alerta === 'com' ? !!x.al : RL.alerta === 'sem' ? !x.al : true) && (!RL.tipo || (x.al && x.al.tipo === RL.tipo)));
};
TC.pdRelRotas = (rows) => {
  const m = new Map();
  rows.forEach((x) => { const k = x.r.data + '|' + x.r.rota; if (!m.has(k)) m.set(k, {k, data: x.r.data, rota: x.r.rota, al: x.al, itens: []}); m.get(k).itens.push(x); });
  const L = Array.from(m.values());
  L.forEach((g) => { g.itens.sort((a, b) => (+a.r.seq_planejada || 0) - (+b.r.seq_planejada || 0)); g.atrasadas = g.itens.filter((x) => x.min > 0).length; g.maxMin = Math.max(...g.itens.map((x) => x.min)); });
  return L.sort((a, b) => (!!b.al - !!a.al) || (b.atrasadas > 0) - (a.atrasadas > 0) || b.maxMin - a.maxMin || a.rota.localeCompare(b.rota));
};
const hm = (dt) => { const s = TC.fdt(dt); return s.length > 10 ? s.slice(0, 5) + ' ' + s.slice(11, 16) : s; };
const prevDe = (r) => {
  const p = TC.prevAtual ? TC.prevAtual(r) : null;
  if (!p || !p.dt) return '—';
  const base = hm(p.dt);
  const ex = p.tipo === 'reprog' ? ' (reprogramada)' : p.tipo === 'patio' ? ' (ainda no CD)' : p.tipo === 'planejada' ? ' (roteirizador)' : '';
  return base + ex + (p.foraJanela ? ' · após a janela' : '');
};
const sitDe = (x) => (x.min > 0 ? 'Atrasada ' + TC.pdFmt(x.min) : TC.pdCls(x.r) === 'fut' ? 'Programada' : 'No prazo');
const filtrosTxt = () => {
  const R = TC.pdRange(), f = [];
  if (R) f.push('rotas de ' + TC.fdt(R.de) + ' a ' + TC.fdt(R.ate));
  f.push({'': 'todas as pendentes', hoje: 'para hoje', atr: 'atrasadas', fut: 'dias à frente'}[RL.cls || ''] || '');
  f.push(RL.transp ? 'transportadora ' + RL.transp : 'todas as transportadoras');
  if (RL.alerta === 'com') f.push('só rotas com alerta'); else if (RL.alerta === 'sem') f.push('só rotas sem alerta');
  if (RL.tipo) f.push('alerta: ' + (TC.alTipos[RL.tipo] || RL.tipo));
  const sel = (id) => { const e = document.getElementById(id); return e && e.value ? e.options[e.selectedIndex].text : ''; };
  if (P.atraso) f.push(sel('pd-atraso').toLowerCase());
  if (P.dn) f.push('prazo ' + sel('pd-dn'));
  if (P.busca) f.push('busca "' + P.busca + '"');
  return f.filter(Boolean).join(' · ');
};
TC.pdRelDoc = () => {
  const rows = TC.pdRelRows(); if (!rows || !rows.length) return null;
  const rotas = TC.pdRelRotas(rows), agora = new Date();
  const atr = rows.filter((x) => x.min > 0).length, comAl = rotas.filter((g) => g.al).length;
  const blocos = [
    {t: 'p', s: 'Filtros: ' + filtrosTxt() + '.'},
    {t: 'table', cols: [{h: 'Pendentes', w: 20}, {h: 'Rotas', w: 20}, {h: 'Atrasadas', w: 20}, {h: 'Rotas com alerta', w: 22}, {h: 'Para hoje', w: 20}, {h: 'Dias à frente', w: 22}], rows: [[
      TC.fmt(rows.length, 'int'), TC.fmt(rotas.length, 'int'), TC.fmt(atr, 'int'), TC.fmt(comAl, 'int'),
      TC.fmt(rows.filter((x) => TC.pdCls(x.r) === 'hoje').length, 'int'), TC.fmt(rows.filter((x) => TC.pdCls(x.r) === 'fut').length, 'int')]]},
    {t: 'p', s: 'Previsão atual: chegada estimada agora, a partir da última parada atendida da rota ou da saída real do veículo (início da rota + 30 min) mais o percurso planejado, somando o atraso acumulado até o momento.'}
  ];
  rotas.forEach((g) => {
    const r0 = g.itens[0].r;
    blocos.push({t: 'h1', s: 'Rota ' + g.rota + ' · ' + TC.fdt(g.data)});
    blocos.push({t: 'p', s: [r0.transportadora, r0.motorista ? 'motorista ' + r0.motorista : '', r0.placa ? 'placa ' + r0.placa : '', TC.stLabel && TC.stLabel[r0.status_rota] ? TC.stLabel[r0.status_rota] : r0.status_rota, g.itens.length + (g.itens.length === 1 ? ' entrega pendente' : ' entregas pendentes') + (g.atrasadas ? ' (' + g.atrasadas + ' atrasada' + (g.atrasadas > 1 ? 's' : '') + ')' : '')].filter(Boolean).join(' · ')});
    if (g.al) {
      const quando = g.al.em ? new Date(g.al.em).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '';
      blocos.push({t: 'box', bold: true, s: 'Alerta: ' + (TC.alTipos[g.al.tipo] || 'Alerta') + (g.al.obs ? ' · ' + g.al.obs : '') + (quando ? ' (registrado em ' + quando + ')' : '')});
    }
    blocos.push({t: 'table', cols: [{h: 'Seq.', w: 7}, {h: 'Cliente', w: 34}, {h: 'Cidade/UF', w: 20}, {h: 'Janela', w: 14}, {h: 'Prazo', w: 13}, {h: 'Previsão atual', w: 22}, {h: 'Situação', w: 20}],
      rows: g.itens.map((x) => [String(x.r.seq_planejada || '—'), (x.r.codigo ? x.r.codigo + ' · ' : '') + (x.r.cliente || ''), (x.r.cidade || '') + (x.r.uf ? '/' + x.r.uf : ''), x.r.janela || '—', TC.fdt(TC.alvoData(x.r)).slice(0, 5), prevDe(x.r), sitDe(x)])});
  });
  const stamp = agora.toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'});
  return {titulo: 'Entregas pendentes · alertas e previsão', sub: 'Gerado em ' + stamp, rodape: 'W ARRAES - Gerência Transporte', blocos, n: rows.length, rotas: rotas.length};
};

dash.draw('pdRelTransp', (sel) => {
  const g = dash.data('entregas_cliente');
  const ts = g.status === 'ok' ? Array.from(new Set(g.data.filter((r) => !TC.isEnt(r) && !TC.zerada(r)).map((r) => r.transportadora).filter(Boolean))).sort() : [];
  sel.replaceChildren(new Option('Todas', ''), ...ts.map((t) => new Option(t, t)));
  sel.value = RL.transp && ts.includes(RL.transp) ? RL.transp : '';
});
dash.draw('pdRelTipo', (sel) => {
  sel.replaceChildren(new Option('Todos os tipos', ''), ...Object.keys(TC.alTipos || {}).map((k) => new Option(TC.alTipos[k], k)));
  sel.value = RL.tipo || '';
});
dash.draw('pdRelN', (el) => {
  const rows = TC.pdRelRows();
  if (!rows) { el.textContent = '—'; return; }
  const n = new Set(rows.map((x) => x.r.data + '|' + x.r.rota)).size;
  el.textContent = TC.fmt(rows.length, 'int') + (rows.length === 1 ? ' entrega' : ' entregas') + ' em ' + TC.fmt(n, 'int') + (n === 1 ? ' rota' : ' rotas');
});
const sync = () => {
  const set = (id, v) => document.querySelectorAll(id).forEach((e) => { e.value = v; });
  set('#pd-rel-cls', RL.cls); set('#pd-rel-alerta', RL.alerta);
  dash.draw('pdRelTransp'); dash.draw('pdRelTipo'); dash.draw('pdRelN');
};
document.querySelectorAll('#pd-rel-abrir').forEach((b) => { b.onclick = () => {
  RL.cls = P.cls || ''; RL.transp = P.transp || '';
  document.querySelectorAll('#pd-rel').forEach((e) => { e.hidden = !e.hidden; });
  msg(''); sync();
}; });
document.querySelectorAll('#pd-rel-fechar').forEach((b) => { b.onclick = () => document.querySelectorAll('#pd-rel').forEach((e) => { e.hidden = true; }); });
const on = (id, k) => document.querySelectorAll(id).forEach((s) => { s.onchange = () => { RL[k] = s.value; if (k === 'tipo' && s.value) { RL.alerta = 'com'; sync(); } dash.draw('pdRelN'); }; });
on('#pd-rel-cls', 'cls'); on('#pd-rel-alerta', 'alerta'); on('#pd-rel-transp-sel', 'transp'); on('#pd-rel-tipo-sel', 'tipo');
document.querySelectorAll('#pd-rel-baixar').forEach((b) => { b.onclick = async () => {
  const doc = TC.pdRelDoc();
  if (!doc) { msg('pd-rel-vazio'); return; }
  msg('pd-rel-gerando'); b.disabled = true;
  try {
    const dl = W.claude && W.claude.use ? await W.claude.use('downloads').catch(() => null) : null;
    if (!dl) throw new Error('sem downloads');
    const blob = await TC.pdfRegras(doc);
    const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
    await dl.save({filename: 'Entregas pendentes ' + p2(d.getDate()) + '-' + p2(d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + p2(d.getHours()) + 'h' + p2(d.getMinutes()) + '.pdf', data: blob});
    msg('pd-rel-ok');
  } catch (e) { msg(e && e.code === 'declined' ? '' : 'pd-rel-erro'); }
  b.disabled = false;
}; });
const re = TC.pdRedraw; TC.pdRedraw = () => { re(); dash.draw('pdRelN'); };
})();
