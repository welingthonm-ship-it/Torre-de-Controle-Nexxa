// Rotas do dia: relatório PDF de fechamento (resumo, situação das rotas, alertas, ocorrências e pendências por rota).
(() => {
const n0 = (v) => { const x = +v; return isFinite(x) ? x : 0; };
const pct = (v) => (v === null || v === undefined || v === '' ? '—' : (+v).toFixed(1).replace('.', ',') + '%');
const int = (v) => TC.fmt(n0(v), 'int');
const hm = (dt) => { const s = TC.fdt(dt); return s.length > 10 ? s.slice(0, 5) + ' ' + s.slice(11) : s; };
const SIT = {atr: 'Atrasada', hoje: 'Para hoje', fut: 'Dias à frente'};

TC.relFimDoc = () => {
  const R = TC.rtRange && TC.rtRange(); if (!R) return null;
  const dentro = (d) => d >= R.de && d <= R.ate;
  const gR = dash.data('resumo_dia'), gRt = dash.data('rotas_dia'), gE = dash.data('entregas_cliente'), gO = dash.data('ocorrencias_dia');
  if ([gR, gRt, gE].some((g) => g.status !== 'ok')) return null;
  const dias = gR.data.filter((r) => dentro(r.data)).sort((a, b) => (a.data < b.data ? -1 : 1));
  const rotas = gRt.data.filter((r) => dentro(r.data));
  const pend = gE.data.filter((r) => dentro(r.data) && !TC.isEnt(r) && r.situacao !== 'Devolução total');
  const periodo = R.umDia ? TC.dlabel(R.de) : TC.fdt(R.de) + ' a ' + TC.fdt(R.ate);
  const tot = dias.reduce((a, r) => { ['rotas', 'entregas', 'concluidas', 'pendentes', 'ocorrencias'].forEach((k) => { a[k] += n0(r[k]); }); return a; }, {rotas: 0, entregas: 0, concluidas: 0, pendentes: 0, ocorrencias: 0});
  const media = (k) => { const v = dias.filter((r) => r[k] !== null && r[k] !== '' && n0(r.entregas)); const w = v.reduce((s, r) => s + n0(r.entregas), 0); return w ? v.reduce((s, r) => s + n0(r[k]) * n0(r.entregas), 0) / w : null; };
  const blocos = [{t: 'p', s: 'Fechamento de ' + periodo + '. Gerado em ' + new Date().toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}) + ', com os dados da última atualização do portal.'}];

  // 1. Resumo
  blocos.push({t: 'h1', s: '1. Resumo ' + (R.umDia ? 'do dia' : 'do período')});
  blocos.push({t: 'table', cols: [{h: 'Rotas', w: 16}, {h: 'Entregas', w: 18}, {h: 'Concluídas', w: 20}, {h: '% concluídas', w: 20}, {h: 'Pendentes', w: 18}, {h: 'Ocorrências', w: 20}], rows: [[
    int(tot.rotas), int(tot.entregas), int(tot.concluidas), tot.entregas ? pct(tot.concluidas / tot.entregas * 100) : '—', int(tot.pendentes), int(tot.ocorrencias)]]});
  blocos.push({t: 'table', cols: [{h: 'SLA janela', w: 30}, {h: 'On Time', w: 30}, {h: 'OTIF', w: 30}, {h: '% ocorrências', w: 30}], rows: [[
    pct(media('sla_janela_pct')), pct(media('on_time_pct')), pct(media('otif_pct')), tot.entregas ? pct(tot.ocorrencias / tot.entregas * 100) : '—']]});
  if (dias.length > 1) {
    blocos.push({t: 'h2', s: 'Resumo dia a dia'});
    blocos.push({t: 'table', cols: [{h: 'Data', w: 16}, {h: 'Rotas', w: 11}, {h: 'Entregas', w: 13}, {h: 'Concl.', w: 12}, {h: '% concl.', w: 13}, {h: 'Pend.', w: 11}, {h: 'Ocorr.', w: 11}, {h: 'SLA', w: 12}, {h: 'On Time', w: 13}, {h: 'OTIF', w: 12}],
      rows: dias.map((r) => [TC.fdt(r.data).slice(0, 5), int(r.rotas), int(r.entregas), int(r.concluidas), pct(r.pct_concluidas), int(r.pendentes), int(r.ocorrencias), pct(r.sla_janela_pct), pct(r.on_time_pct), pct(r.otif_pct)])});
  }

  // 2. Situação das rotas
  const st = {}; rotas.forEach((r) => { st[r.status_rota] = (st[r.status_rota] || 0) + 1; });
  blocos.push({t: 'h1', s: '2. Situação das rotas'});
  blocos.push({t: 'table', cols: [{h: 'Em execução', w: 25}, {h: 'Stand-by (não expedidas)', w: 35}, {h: 'Concluídas', w: 25}, {h: 'Baldeio', w: 20}], rows: [[int(st.EmExecucao), int(st.StandBy), int(st.Concluida), int(st.Baldeio)]]});

  // 3. Alertas
  const als = Array.from(TC.al.values()).filter((a) => a && dentro(a.data)).sort((a, b) => (a.data + a.rota < b.data + b.rota ? -1 : 1));
  const rotaInfo = new Map(rotas.map((r) => [r.data + '|' + r.rota, r]));
  blocos.push({t: 'h1', s: '3. Alertas registrados (' + als.length + ')'});
  if (als.length) blocos.push({t: 'table', cols: [{h: 'Data', w: 11}, {h: 'Rota', w: 15}, {h: 'Transportadora', w: 24}, {h: 'Alerta', w: 34}, {h: 'Observação', w: 34}, {h: 'Registrado', w: 16}],
    rows: als.map((a) => [TC.fdt(a.data).slice(0, 5), a.rota, (rotaInfo.get(a.data + '|' + a.rota) || {}).transportadora || '—', TC.alTipos[a.tipo] || 'Alerta', a.obs || '—',
      a.em ? new Date(a.em).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '—'])});
  else blocos.push({t: 'p', s: 'Nenhum alerta registrado no período.'});

  // 4. Ocorrências
  const oc = {}; (gO.status === 'ok' ? gO.data : []).filter((r) => dentro(r.data)).forEach((r) => { oc[r.ocorrencia] = (oc[r.ocorrencia] || 0) + n0(r.qtd); });
  blocos.push({t: 'h1', s: '4. Ocorrências'});
  const ock = Object.keys(oc).sort((a, b) => oc[b] - oc[a]);
  if (ock.length) blocos.push({t: 'table', cols: [{h: 'Tipo de ocorrência', w: 70}, {h: 'Entregas', w: 30}], rows: ock.map((k) => [k, int(oc[k])])});
  else blocos.push({t: 'p', s: 'Nenhuma ocorrência registrada no período.'});

  // 5. Pendências por rota
  const grupos = new Map();
  pend.forEach((r) => { const k = r.data + '|' + r.rota; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(r); });
  const G = Array.from(grupos.entries()).map(([k, it]) => ({k, it: it.sort((a, b) => n0(a.seq_planejada) - n0(b.seq_planejada)), al: TC.alDe(it[0].data, it[0].rota), atr: it.filter((r) => TC.pdCls(r) === 'atr').length}))
    .sort((a, b) => (!!b.al - !!a.al) || (b.atr - a.atr) || (b.it.length - a.it.length));
  blocos.push({t: 'h1', s: '5. Pendências por rota (' + pend.length + ' entregas em ' + G.length + ' rotas)'});
  if (!G.length) blocos.push({t: 'p', s: 'Nenhuma entrega pendente no período.'});
  G.forEach((g) => {
    const r0 = g.it[0];
    blocos.push({t: 'h2', s: 'Rota ' + r0.rota + ' · ' + TC.fdt(r0.data).slice(0, 5) + ' · ' + (r0.transportadora || '—')});
    blocos.push({t: 'p', s: [r0.motorista ? 'Motorista ' + r0.motorista : '', r0.placa ? 'placa ' + r0.placa : '', TC.stLabel[r0.status_rota] || r0.status_rota, g.it.length + (g.it.length === 1 ? ' pendente' : ' pendentes') + (g.atr ? ' (' + g.atr + ' atrasada' + (g.atr > 1 ? 's' : '') + ')' : '')].filter(Boolean).join(' · ')});
    if (g.al) blocos.push({t: 'box', bold: true, s: 'Alerta: ' + (TC.alTipos[g.al.tipo] || 'Alerta') + (g.al.obs ? ' · ' + g.al.obs : '')});
    blocos.push({t: 'table', cols: [{h: 'Seq.', w: 7}, {h: 'Cliente', w: 36}, {h: 'Cidade/UF', w: 20}, {h: 'Janela', w: 14}, {h: 'Prazo', w: 11}, {h: 'Previsão', w: 22}, {h: 'Situação', w: 16}],
      rows: g.it.map((r) => { const p = TC.prevAtual(r); return [String(r.seq_planejada || '—'), (r.codigo ? r.codigo + ' · ' : '') + (r.cliente || ''), (r.cidade || '') + (r.uf ? '/' + r.uf : ''), r.janela || '—', TC.fdt(TC.alvoData(r)).slice(0, 5),
        !p || !p.dt ? '—' : hm(p.dt) + (p.tipo === 'reprog' ? ' (reprog.)' : p.standby ? ' (no CD)' : ''), SIT[TC.pdCls(r)] || '—']; })});
  });
  return {titulo: 'Fechamento do dia · Rotas e pendências', sub: periodo, rodape: 'W ARRAES - Gerência Transporte · CNPJ 70.070.143/0001-55', blocos, de: R.de, ate: R.ate};
};

const msg = (k) => document.querySelectorAll('.rt-fim-msg').forEach((e) => { e.hidden = !e.classList.contains(k); });
document.querySelectorAll('#rt-fim-pdf').forEach((b) => { b.onclick = async () => {
  const doc = TC.relFimDoc();
  if (!doc) { msg('rt-fim-vazio'); return; }
  msg('rt-fim-gerando'); b.disabled = true;
  try {
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
    if (!dl) throw new Error('sem downloads');
    const f = (d) => d.split('-').reverse().join('-');
    await dl.save({filename: 'Fechamento ' + (doc.de === doc.ate ? f(doc.de) : f(doc.de) + ' a ' + f(doc.ate)) + '.pdf', data: await TC.pdfRegras(doc)});
    msg('rt-fim-ok');
  } catch (e) { msg(e && e.code === 'declined' ? '' : 'rt-fim-erro'); }
  b.disabled = false;
}; });
})();
