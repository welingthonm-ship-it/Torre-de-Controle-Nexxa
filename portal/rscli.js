// Resumo do dia por cliente: filtro de rede/cliente e relatório PDF (resumo + rotas do dia + entregas + alertas) só desse cliente.
(() => {
const W = window, F = TC.rsF;
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const msg = (k) => document.querySelectorAll('.rs-cli-msg').forEach((e) => { e.hidden = !e.classList.contains(k); });
// opções: redes e clientes (código · nome)
TC.rsCliOpc = () => {
  const g = dash.data('entregas_cliente'); if (g.status !== 'ok') return null;
  if (TC.__rsCliO && TC.__rsCliO.src === g.data) return TC.__rsCliO.v;
  const redes = new Map(), cli = new Map();
  g.data.forEach((r) => { if (r.grupo) redes.set(r.grupo, (redes.get(r.grupo) || 0) + 1); if (r.codigo && !cli.has(r.codigo)) cli.set(r.codigo, r.cliente || ''); });
  const v = [];
  Array.from(redes.keys()).sort().forEach((n) => v.push({t: 'rede', v: n, txt: 'Rede: ' + n}));
  Array.from(cli.entries()).sort((a, b) => a[1].localeCompare(b[1])).forEach(([c, n]) => v.push({t: 'cli', v: c, txt: (c + ' · ' + n).trim()}));
  TC.__rsCliO = {src: g.data, v};
  return v;
};
dash.draw('rsCliDl', (dl) => { const v = TC.rsCliOpc() || []; dl.replaceChildren(...v.map((o) => { const op = document.createElement('option'); op.value = o.txt; return op; })); });
const nomeSel = () => (F.cli ? (F.cli.t === 'rede' ? 'Rede ' + F.cli.v : F.cli.txt) : '');
const aplica = (txt) => {
  const t = String(txt || '').trim();
  if (!t) F.cli = null;
  else {
    const v = TC.rsCliOpc() || [], low = t.toLowerCase();
    const o = v.find((x) => x.txt.trim().toLowerCase() === low) || v.find((x) => x.t === 'rede' && x.v.toLowerCase() === low) || v.find((x) => x.t === 'cli' && x.v.toLowerCase() === low);
    if (!o) return;   // ainda digitando
    F.cli = {t: o.t, v: o.v, txt: o.txt};
  }
  document.querySelectorAll('#rs-cli-limpar').forEach((b) => { b.hidden = !F.cli; });
  msg('');
  TC.rsRedraw(); dash.draw('rsCliLogo');
};
document.querySelectorAll('#rs-cli').forEach((i) => {
  i.value = F.cli ? F.cli.txt : '';
  i.addEventListener('change', () => aplica(i.value));
  i.addEventListener('input', () => { if (!i.value.trim() && F.cli) aplica(''); else if ((TC.rsCliOpc() || []).some((x) => x.txt === i.value)) aplica(i.value); });
});
document.querySelectorAll('#rs-cli-limpar').forEach((b) => { b.hidden = !F.cli; b.onclick = () => { document.querySelectorAll('#rs-cli').forEach((i) => { i.value = ''; }); aplica(''); }; });

const n0 = (v) => { const x = +v; return isFinite(x) ? x : 0; };
const pct = (s, a) => (a ? (s / a * 100).toFixed(1).replace('.', ',') + '%' : '—');
const hm = (dt) => { const s = TC.fdt(dt); return s.length > 10 ? s.slice(0, 5) + ' ' + s.slice(11, 16) : s; };
const conta = (rows, col) => { let s = 0, a = 0; rows.forEach((r) => { if (r[col] === 'SIM') { s++; a++; } else if (r[col] === 'NÃO') a++; }); return [s, a]; };
// ---- logo do cliente: usa os logos já cadastrados por rede (Atualizar dados › Logos dos clientes) ----
const redeDe = (c) => { if (!c) return ''; if (c.t === 'rede') return c.v; const g = dash.data('entregas_cliente'); const r = g.status === 'ok' ? g.data.find((x) => x.codigo === c.v && x.grupo) : null; return r ? r.grupo : (c.txt || ''); };
TC.rsCliLogoImg = (c) => (TC.logoDe ? TC.logoDe(redeDe(c)) : null);
dash.draw('rsCliLogo', (box) => {
  box.replaceChildren(); if (!F.cli) return;
  const rede = redeDe(F.cli), img = TC.rsCliLogoImg(F.cli), k = TC.logoChave ? TC.logoChave(rede) : '';
  if (img) { const i = el('img', 'nx-rs-logo'); i.src = img; i.alt = 'Logo ' + rede; box.append(i); }
  if (!TC.alPode || !k) { if (!img) box.append(el('span', 'tc-sub', 'Sem logo cadastrado')); return; }
  const inp = el('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp,image/svg+xml'; inp.hidden = true;
  const bt = el('button', 'nx-chip', img ? 'Trocar logo' : '🖼 Enviar logo da rede'); bt.type = 'button'; bt.onclick = () => inp.click();
  inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { const im = await TC.logoReduz(f); const d = await TC.logoDb(); await d.doc('logos/' + k).set({grupo: rede, img: im, em: new Date().toISOString()}); if (TC.log) TC.log('Logo do cliente enviado', {detalhe: 'Rede ' + rede}); } catch (er) { box.append(el('span', 'nx-al-err', ' Não foi possível salvar o logo.')); } };
  box.append(bt, inp);
});

TC.rsCliDoc = () => {
  if (!F.cli) return null;
  const R = TC.rsRange(), g = dash.data('entregas_cliente'); if (!R || g.status !== 'ok') return null;
  const ok = (r) => (F.cli.t === 'rede' ? r.grupo === F.cli.v : r.codigo === F.cli.v);
  const rows = g.data.filter((r) => r.data >= R.cDe && r.data <= R.cAte && (!R.eDe || TC.dnPrev(r) >= R.eDe) && (!R.eAte || TC.dnPrev(r) <= R.eAte) && ok(r));
  if (!rows.length) return null;
  const rede = F.cli.t === 'rede';
  const periodo = R.cDe === R.cAte ? TC.dlabel(R.cDe) : TC.fdt(R.cDe) + ' a ' + TC.fdt(R.cAte);
  const conc = rows.filter((r) => TC.isEnt(r)), pend = rows.filter((r) => !TC.isEnt(r) && r.situacao !== 'Devolução total');
  const sla = conta(rows, 'sla_janela'), ot = conta(rows, 'on_time'), of = conta(rows, 'otif'), ap = conta(rows, 'app_no_raio');
  const oc = rows.filter((r) => r.ocorrencia), ocT = {}; oc.forEach((r) => { ocT[r.ocorrencia] = (ocT[r.ocorrencia] || 0) + 1; });
  const atr = pend.filter((r) => TC.pdCls(r) === 'atr');
  const B = [];
  B.push({t: 'p', s: (rede ? 'Rede ' + F.cli.v + ' · ' + new Set(rows.map((r) => r.codigo)).size + ' loja(s)' : F.cli.txt + (rows[0].cidade ? ' · ' + rows[0].cidade + (rows[0].uf ? '/' + rows[0].uf : '') : '')) + ' · cargas de ' + periodo + ' · gerado em ' + new Date().toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) + '.'});
  B.push({t: 'table', cols: [{h: 'Entregas', w: 12}, {h: 'Concluídas', w: 16}, {h: 'Pendentes', w: 13}, {h: 'SLA janela', w: 13}, {h: 'On Time', w: 12}, {h: 'OTIF', w: 11}, {h: 'Ocorrências', w: 15}, {h: 'App', w: 11}], rows: [[
    TC.fmt(rows.length, 'int'), TC.fmt(conc.length, 'int') + ' (' + pct(conc.length, rows.length) + ')', TC.fmt(pend.length, 'int'), pct(sla[0], sla[1]), pct(ot[0], ot[1]), pct(of[0], of[1]), TC.fmt(oc.length, 'int') + ' (' + pct(oc.length, rows.length) + ')', pct(ap[0], ap[1])]]});
  // pontos de atenção
  const at = [];
  if (atr.length) at.push(atr.length + (atr.length === 1 ? ' entrega atrasada' : ' entregas atrasadas') + ' ainda pendente(s).');
  if (pend.length - atr.length > 0) at.push((pend.length - atr.length) + ' entrega(s) pendente(s) no prazo ou para os próximos dias.');
  if (sla[1] - sla[0] > 0) at.push((sla[1] - sla[0]) + ' entrega(s) fora da janela (SLA NÃO).');
  if (oc.length) at.push('Ocorrências: ' + Object.keys(ocT).sort((a, b) => ocT[b] - ocT[a]).map((k) => k + ' ' + ocT[k]).join(' · ') + '.');
  const als = new Map(); rows.forEach((r) => { const a = TC.alDaEntrega(r); if (a && a.tipo !== 'baixa_manual') { const k = r.data + '|' + r.rota + '|' + a.tipo + '|' + (a.em || ''); if (!als.has(k)) als.set(k, {a, r, n: 0}); als.get(k).n++; } });
  if (als.size) at.push(als.size + (als.size === 1 ? ' alerta registrado' : ' alertas registrados') + ' nas entregas deste cliente.');
  B.push({t: 'h1', s: 'Pontos de atenção'});
  if (at.length) at.forEach((x) => B.push({t: 'li', s: x})); else B.push({t: 'p', s: 'Nenhum ponto de atenção: tudo entregue, dentro da janela e sem ocorrências.'});
  // rotas do dia que atenderam o cliente
  const porRota = new Map(); rows.forEach((r) => { const k = r.data + '|' + r.rota; if (!porRota.has(k)) porRota.set(k, []); porRota.get(k).push(r); });
  const RT = Array.from(porRota.values()).sort((a, b) => (a[0].data < b[0].data ? -1 : a[0].data > b[0].data ? 1 : String(a[0].rota).localeCompare(String(b[0].rota))));
  B.push({t: 'h1', s: 'Rotas do dia que atenderam o cliente (' + RT.length + ')'});
  B.push({t: 'table', cols: [{h: 'Data', w: 10}, {h: 'Rota', w: 12}, {h: 'Transportadora', w: 22}, {h: 'Motorista', w: 22}, {h: 'Status', w: 13}, {h: 'Entr.', w: 8}, {h: 'Concl.', w: 9}, {h: 'Pend.', w: 8}, {h: 'SLA', w: 10}],
    rows: RT.slice(0, TC.__rsCliFull ? Infinity : 150).map((L) => { const r0 = L[0], s2 = conta(L, 'sla_janela'); return [TC.fdt(r0.data).slice(0, 5), r0.rota, r0.transportadora || '—', r0.motorista || '—', TC.stLabel[r0.status_rota] || r0.status_rota || '—', String(L.length), String(L.filter((r) => TC.isEnt(r)).length), String(L.filter((r) => !TC.isEnt(r)).length), pct(s2[0], s2[1])]; })});
  if (RT.length > 150 && !TC.__rsCliFull) B.push({t: 'p', s: 'Mostrando as 150 primeiras rotas. Reduza o período para ver todas.'});
  // alertas
  if (als.size) {
    B.push({t: 'h1', s: 'Alertas registrados'});
    B.push({t: 'table', cols: [{h: 'Data', w: 10}, {h: 'Rota', w: 12}, {h: 'Alerta', w: 30}, {h: 'Observação', w: 38}, {h: 'Entregas', w: 10}],
      rows: Array.from(als.values()).map((x) => [TC.fdt(x.r.data).slice(0, 5), x.r.rota, TC.alTipos[x.a.tipo] || x.a.tipo, x.a.obs || '—', String(x.n)])});
  }
  // resumo por loja: expedição, saída do CD, cidade e entrega realizada ou prevista
  const sit = (r) => (TC.isEnt(r) ? (r.ocorrencia ? 'Entregue c/ ocorrência' : 'Entregue') : r.situacao === 'Devolução total' ? 'Devolução total' : TC.pdCls(r) === 'atr' ? 'Atrasada' : 'Pendente');
  const rotaAll = new Map(); g.data.forEach((r) => { const k = r.data + '|' + r.rota; if (porRota.has(k)) { if (!rotaAll.has(k)) rotaAll.set(k, []); rotaAll.get(k).push(r); } });
  const exped = (r) => {
    const rs = rotaAll.get(r.data + '|' + r.rota) || [r];
    const s0 = rs.map((x) => x.saida_cd).filter(Boolean).sort()[0] || '';
    const saida = s0 ? hm(TC.saidaReal(s0)) : '—';
    const st = r.status_rota;
    const txt = s0 ? (st === 'Concluida' ? 'Expedida · rota concluída' : 'Expedida · em rota') : st === 'StandBy' ? 'Não expedida (stand-by)' : st === 'Baldeio' ? 'Baldeio' : 'Aguardando saída';
    return {txt, saida};
  };
  const entrega = (r) => { if (r.chegada_real && TC.isEnt(r)) return 'Entregue ' + hm(r.chegada_real); if (r.chegada_real) return 'Chegou ' + hm(r.chegada_real); const p = TC.prevAtual(r); return p && p.dt ? 'Previsão ' + hm(p.dt) + (p.standby ? ' (no CD)' : '') : '—'; };
  const lim = 300, E = rows.slice().sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : String(a.cliente || '').localeCompare(String(b.cliente || '')) || String(a.rota).localeCompare(String(b.rota))));
  B.push({t: 'h1', s: 'Resumo por loja (' + new Set(rows.map((r) => r.codigo)).size + (rede ? ' lojas' : ' loja') + ', ' + rows.length + ' entregas)'});
  B.push({t: 'table', cols: [{h: 'Data', w: 8}, {h: 'Loja', w: 25}, {h: 'Cidade/UF', w: 15}, {h: 'Rota', w: 10}, {h: 'Expedição', w: 17}, {h: 'Saída CD', w: 11}, {h: 'Entrega', w: 18}, {h: 'Situação', w: 14}],
    rows: E.slice(0, TC.__rsCliFull ? Infinity : lim).map((r) => { const x = exped(r); return [TC.fdt(r.data).slice(0, 5), (r.codigo ? r.codigo + ' · ' : '') + (r.cliente || ''), (r.cidade || '') + (r.uf ? '/' + r.uf : ''), r.rota, x.txt, x.saida, entrega(r), sit(r) + (r.janela ? ' · janela ' + r.janela : '')]; })});
  if (rows.length > lim && !TC.__rsCliFull) B.push({t: 'p', s: 'Mostrando as ' + lim + ' primeiras entregas. Reduza o período para ver todas.'});
  B.push({t: 'p', s: 'Saída do CD: horário de saída da rota (início + 30 min). Entrega: horário da chegada quando entregue; senão, a previsão atual.'});
  // dia a dia
  const dias = Array.from(new Set(rows.map((r) => r.data))).sort();
  if (dias.length > 1) {
    B.push({t: 'h1', s: 'Dia a dia'});
    B.push({t: 'table', cols: [{h: 'Data', w: 14}, {h: 'Entregas', w: 14}, {h: '% concl.', w: 14}, {h: 'Pend.', w: 12}, {h: 'Ocorr.', w: 12}, {h: 'SLA', w: 12}, {h: 'On Time', w: 12}, {h: 'OTIF', w: 12}],
      rows: dias.map((d) => { const L = rows.filter((r) => r.data === d), a = conta(L, 'sla_janela'), b = conta(L, 'on_time'), c = conta(L, 'otif'), cc = L.filter((r) => TC.isEnt(r)).length; return [TC.fdt(d).slice(0, 5), String(L.length), pct(cc, L.length), String(L.length - cc), String(L.filter((r) => r.ocorrencia).length), pct(a[0], a[1]), pct(b[0], b[1]), pct(c[0], c[1])]; })});
  }
  const nome = rede ? 'Rede ' + F.cli.v : F.cli.txt;
  return {logoCli: TC.rsCliLogoImg(F.cli), titulo: 'Resumo do cliente', sub: periodo, rodape: 'W ARRAES - Gerência Transporte', blocos: B, arquivo: 'Resumo ' + nome.replace(/[\\/:*?"<>|]/g, ' ') + ' ' + (R.cDe === R.cAte ? R.cDe.split('-').reverse().join('-') : R.cDe.split('-').reverse().join('-') + ' a ' + R.cAte.split('-').reverse().join('-'))};
};
// Excel: o mesmo relatório, sem limite de linhas; cada tabela grande numa aba
const celula = (v) => {
  const t = String(v == null ? '' : v).trim();
  if (/^-?\d+$/.test(t)) return {v: +t, s: 'n'};
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return {v: +t.replace(/\./g, ''), s: 'n'};
  const m = t.match(/^(-?\d+(?:,\d+)?)%$/); if (m) return {v: +m[1].replace(',', '.') / 100, s: 'p'};
  return t;
};
TC.rsCliXlsx = () => {
  TC.__rsCliFull = true; let doc; try { doc = TC.rsCliDoc(); } finally { TC.__rsCliFull = false; }
  if (!doc) return null;
  const nome = (doc.arquivo || 'Resumo do cliente').replace(/^Resumo /, '');
  const resumo = [[{v: 'Resumo do cliente — ' + nome, s: 't'}], [doc.sub]], abas = [];
  let sec = null;
  doc.blocos.forEach((b) => {
    if (b.t === 'h1') { sec = b.s; if (!/^(Rotas do dia|Resumo por loja|Dia a dia)/.test(sec)) { resumo.push([], [{v: sec, s: 'b'}]); } return; }
    const propria = sec && /^(Rotas do dia|Resumo por loja|Dia a dia)/.test(sec);
    if (b.t === 'table') {
      const linhas = [b.cols.map((c) => ({v: c.h, s: 'h'}))].concat(b.rows.map((r) => r.map(celula)));
      if (propria) abas.push({name: /^Rotas/.test(sec) ? 'Rotas do dia' : /^Resumo por loja/.test(sec) ? 'Por loja' : 'Dia a dia', rows: [[{v: sec, s: 't'}], [doc.sub]].concat([[]], linhas), widths: b.cols.map((c) => Math.max(10, Math.round(c.w * 1.1)))});
      else resumo.push(...linhas);
    } else if (b.t === 'p' || b.t === 'li' || b.t === 'box') (propria ? (abas.length ? abas[abas.length - 1].rows : resumo) : resumo).push([(b.t === 'li' ? '• ' : '') + b.s]);
  });
  return {blob: TC.xlsx([{name: 'Resumo', rows: resumo, widths: [16, 18, 14, 14, 14, 14, 18, 14]}].concat(abas)), arquivo: doc.arquivo};
};
document.querySelectorAll('#rs-cli-xls').forEach((b) => { b.onclick = async () => {
  if (!F.cli) { msg('rs-cli-sel'); return; }
  let x = null; try { x = TC.rsCliXlsx(); } catch (e) { msg('rs-cli-erro'); return; }
  if (!x) { msg('rs-cli-vazio'); return; }
  msg('rs-cli-ger'); b.disabled = true;
  try {
    const dl = W.claude && W.claude.use ? await W.claude.use('downloads').catch(() => null) : null;
    if (!dl) throw new Error('sem downloads');
    await dl.save({filename: x.arquivo + '.xlsx', data: x.blob});
    msg('');
  } catch (e) { msg(e && e.code === 'declined' ? '' : 'rs-cli-erro'); }
  b.disabled = false;
}; });
document.querySelectorAll('#rs-cli-pdf').forEach((b) => { b.onclick = async () => {
  if (!F.cli) { msg('rs-cli-sel'); return; }
  const doc = TC.rsCliDoc(); if (!doc) { msg('rs-cli-vazio'); return; }
  msg('rs-cli-ger'); b.disabled = true;
  try {
    const dl = W.claude && W.claude.use ? await W.claude.use('downloads').catch(() => null) : null;
    if (!dl) throw new Error('sem downloads');
    await dl.save({filename: doc.arquivo + '.pdf', data: await TC.pdfRegras(doc)});
    msg('');
  } catch (e) { msg(e && e.code === 'declined' ? '' : 'rs-cli-erro'); }
  b.disabled = false;
}; });
})();
