// Rotas do dia: relatório PDF de fechamento (resumo, situação das rotas, alertas, ocorrências e pendências por rota).
(() => {
const n0 = (v) => { const x = +v; return isFinite(x) ? x : 0; };
const pct = (v) => (v === null || v === undefined || v === '' ? '—' : (+v).toFixed(1).replace('.', ',') + '%');
const int = (v) => TC.fmt(n0(v), 'int');
const hm = (dt) => { const s = TC.fdt(dt); return s.length > 10 ? s.slice(0, 5) + ' ' + s.slice(11) : s; };

const CURTO = {sinistro: 'Sinistro (carga roubada)', socorro: 'Carro quebrado – socorro', quebrado_prox: 'Quebrado – segue amanhã', reprogramado: 'Reprogramado p/ amanhã', atraso_saida: 'Saída com atraso', baixa_manual: 'Baixa manual', outro: 'Outra divergência'};
const alNome = (t) => CURTO[t] || (TC.alTipos && TC.alTipos[t]) || 'Alerta';

// Relatório de fechamento enxuto: indicadores, pontos de atenção, alertas e pendências por rota (uma linha por rota).
TC.relFimDoc = () => {
  const R = TC.rtRange && TC.rtRange(); if (!R) return null;
  const dentro = (d) => d >= R.de && d <= R.ate;
  const gR = dash.data('resumo_dia'), gRt = dash.data('rotas_dia'), gE = dash.data('entregas_cliente'), gO = dash.data('ocorrencias_dia');
  if ([gR, gRt, gE].some((g) => g.status !== 'ok')) return null;
  const dias = gR.data.filter((r) => dentro(r.data)).sort((a, b) => (a.data < b.data ? -1 : 1));
  const rotas = gRt.data.filter((r) => dentro(r.data));
  const pend = gE.data.filter((r) => dentro(r.data) && !TC.isEnt(r) && r.situacao !== 'Devolução total');
  const periodo = R.umDia ? TC.dlabel(R.de) : TC.fdt(R.de) + ' a ' + TC.fdt(R.ate);
  const tot = dias.reduce((a, r) => { ['rotas', 'entregas', 'concluidas', 'ocorrencias'].forEach((k) => { a[k] += n0(r[k]); }); return a; }, {rotas: 0, entregas: 0, concluidas: 0, ocorrencias: 0});
  const media = (k) => { const v = dias.filter((r) => r[k] !== null && r[k] !== '' && n0(r.entregas)); const w = v.reduce((s, r) => s + n0(r.entregas), 0); return w ? v.reduce((s, r) => s + n0(r[k]) * n0(r.entregas), 0) / w : null; };
  const st = {}; rotas.forEach((r) => { st[r.status_rota] = (st[r.status_rota] || 0) + 1; });
  const cls = {atr: 0, hoje: 0, fut: 0}; pend.forEach((r) => { const c = TC.pdCls(r); if (c in cls) cls[c]++; });

  // pendências agrupadas por rota
  const porRota = new Map();
  pend.forEach((r) => { const k = r.data + '|' + r.rota; if (!porRota.has(k)) porRota.set(k, []); porRota.get(k).push(r); });
  const rotaInfo = new Map(rotas.map((r) => [r.data + '|' + r.rota, r]));
  const csMap = new Map(((TC.csDados && TC.csDados().lista) || []).map((x) => [x.a.data + '|' + x.a.rota, x]));
  const G = Array.from(porRota.entries()).map(([k, it]) => {
    const r0 = it[0], al = TC.alDe(r0.data, r0.rota), atr = it.filter((r) => TC.pdCls(r) === 'atr').length;
    const prevs = it.map((r) => TC.prevAtual(r)).filter((p) => p && p.dt).sort((a, b) => (a.dt < b.dt ? -1 : 1));
    const p0 = prevs[0];
    return {k, r0, it, al, atr, prev: p0 ? hm(p0.dt) + (p0.tipo === 'reprog' ? ' (reprog.)' : p0.standby ? ' (no CD)' : '') : '—'};
  }).sort((a, b) => (!!b.al - !!a.al) || (b.atr - a.atr) || (b.it.length - a.it.length));
  const als = Array.from(TC.al.values()).filter((a) => a && dentro(a.data) && a.tipo !== 'baixa_manual').sort((a, b) => String(a.em || '').localeCompare(String(b.em || '')));
  const baixas = Array.from(TC.al.values()).filter((a) => a && dentro(a.data) && a.tipo === 'baixa_manual').length;
  const semInfo = als.reduce((s, a) => s + ((csMap.get(a.data + '|' + a.rota) || {}).informar || 0), 0);

  const B = [];
  B.push({t: 'p', s: 'Fechamento de ' + periodo + ' · gerado em ' + new Date().toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) + ' com a última atualização do portal.'});
  B.push({t: 'table', cols: [{h: 'Rotas', w: 12}, {h: 'Entregas', w: 14}, {h: 'Concluídas', w: 18}, {h: 'Pendentes', w: 14}, {h: 'SLA janela', w: 14}, {h: 'On Time', w: 13}, {h: 'OTIF', w: 12}, {h: 'Ocorrências', w: 17}], rows: [[
    int(tot.rotas), int(tot.entregas), int(tot.concluidas) + (tot.entregas ? ' (' + pct(tot.concluidas / tot.entregas * 100) + ')' : ''), int(pend.length),
    pct(media('sla_janela_pct')), pct(media('on_time_pct')), pct(media('otif_pct')), int(tot.ocorrencias) + (tot.entregas ? ' (' + pct(tot.ocorrencias / tot.entregas * 100) + ')' : '')]]});

  // Pontos de atenção
  const at = [];
  if (st.StandBy) at.push(int(st.StandBy) + (st.StandBy === 1 ? ' rota não expedida' : ' rotas não expedidas') + ' (stand-by, em separação/carregamento).');
  if (cls.atr) at.push(int(cls.atr) + (cls.atr === 1 ? ' entrega atrasada' : ' entregas atrasadas') + ' em ' + G.filter((g) => g.atr).length + ' rotas.');
  if (als.length) at.push(als.length + (als.length === 1 ? ' rota com alerta' : ' rotas com alerta') + (semInfo ? ': ' + int(semInfo) + (semInfo === 1 ? ' cliente ainda não informado' : ' clientes ainda não informados') + ' pelo Customer Service.' : ', todos os clientes já informados.'));
  if (baixas) at.push(baixas + (baixas === 1 ? ' rota com baixa manual' : ' rotas com baixa manual') + ' (falha no app do motorista).');
  B.push({t: 'h1', s: 'Pontos de atenção'});
  if (at.length) at.forEach((x) => B.push({t: 'li', s: x}));
  else B.push({t: 'p', s: 'Nenhum ponto de atenção: todas as rotas expedidas, sem atrasos e sem alertas.'});
  B.push({t: 'p', s: 'Rotas: ' + int(st.EmExecucao) + ' em execução · ' + int(st.StandBy) + ' em stand-by · ' + int(st.Concluida) + ' concluídas · ' + int(st.Baldeio) + ' em baldeio. Pendentes: ' + int(cls.atr) + ' atrasadas · ' + int(cls.hoje) + ' para hoje · ' + int(cls.fut) + ' para os próximos dias.'});
  const oc = {}; (gO.status === 'ok' ? gO.data : []).filter((r) => dentro(r.data)).forEach((r) => { oc[r.ocorrencia] = (oc[r.ocorrencia] || 0) + n0(r.qtd); });
  const ock = Object.keys(oc).sort((a, b) => oc[b] - oc[a]);
  if (ock.length) B.push({t: 'p', s: 'Ocorrências: ' + ock.map((k) => k + ' ' + int(oc[k])).join(' · ') + '.'});

  // Alertas
  B.push({t: 'h1', s: 'Alertas registrados (' + als.length + ')'});
  if (als.length) B.push({t: 'table', cols: [{h: 'Rota', w: 15}, {h: 'Transportadora', w: 22}, {h: 'Alerta', w: 26}, {h: 'Observação', w: 37}, {h: 'Pendentes', w: 13}, {h: 'Informados', w: 14}],
    rows: als.map((a) => { const k = a.data + '|' + a.rota, cs = csMap.get(k), n = (porRota.get(k) || []).length;
      return [a.rota + (R.umDia ? '' : ' (' + TC.fdt(a.data).slice(0, 5) + ')'), (rotaInfo.get(k) || {}).transportadora || '—', alNome(a.tipo), a.obs || '—', int(n), cs ? int(cs.informados) + ' de ' + int(cs.peds.length) : '—']; })});
  else B.push({t: 'p', s: 'Nenhum alerta registrado.'});

  // Pendências por rota
  B.push({t: 'h1', s: 'Pendências por rota (' + int(pend.length) + ' entregas em ' + G.length + ' rotas)'});
  if (G.length) B.push({t: 'table', cols: [{h: 'Rota', w: 14}, {h: 'Transportadora', w: 22}, {h: 'Motorista', w: 22}, {h: 'Status', w: 14}, {h: 'Pend.', w: 9}, {h: 'Atras.', w: 9}, {h: 'Alerta', w: 22}, {h: 'Próx. previsão', w: 18}],
    rows: G.map((g) => [g.r0.rota + (R.umDia ? '' : ' (' + TC.fdt(g.r0.data).slice(0, 5) + ')'), g.r0.transportadora || '—', g.r0.motorista || '—', TC.stLabel[g.r0.status_rota] || g.r0.status_rota || '—', int(g.it.length), g.atr ? int(g.atr) : '—', g.al ? alNome(g.al.tipo) : '—', g.prev])});
  else B.push({t: 'p', s: 'Nenhuma entrega pendente.'});
  B.push({t: 'p', s: 'Para a lista de entregas de cada rota, use o relatório PDF de 1.3 Entregas pendentes.'});

  if (dias.length > 1) {
    B.push({t: 'h1', s: 'Dia a dia'});
    B.push({t: 'table', cols: [{h: 'Data', w: 14}, {h: 'Rotas', w: 11}, {h: 'Entregas', w: 13}, {h: '% concl.', w: 13}, {h: 'Pend.', w: 11}, {h: 'Ocorr.', w: 11}, {h: 'SLA', w: 12}, {h: 'On Time', w: 13}, {h: 'OTIF', w: 12}],
      rows: dias.map((r) => [TC.fdt(r.data).slice(0, 5), int(r.rotas), int(r.entregas), pct(r.pct_concluidas), int(r.pendentes), int(r.ocorrencias), pct(r.sla_janela_pct), pct(r.on_time_pct), pct(r.otif_pct)])});
  }
  return {titulo: 'Fechamento do dia', sub: periodo, rodape: 'W ARRAES - Gerência Transporte', blocos: B, de: R.de, ate: R.ate};
};

const msg = (k) => document.querySelectorAll('.rt-fim-msg').forEach((e) => { e.hidden = !e.classList.contains(k); });
document.querySelectorAll('#rt-fim-pdf, .rt-fim-btn').forEach((b) => { b.onclick = async () => {
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
