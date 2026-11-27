// Ocorrências do dia: validação das faltas pelo monitoramento (carga bipada + vídeo do carregamento).
// Falta nova sem validação faz a aba piscar em laranja na barra lateral.
(() => {
const W = window;
TC.ocVal = W.__nxOcVal || new Map(); W.__nxOcVal = TC.ocVal;
TC.ocValDias = 3;   // ocorrências dos últimos 3 dias de rota precisam de validação
TC.ocValTipos = ['Falta', 'Avaria', 'Devolução Total'];   // tipos que o monitoramento valida
// Ocorrências zeradas: data de rota até o corte não entram mais na validação (nem no contador laranja).
TC.ocCorte = '2026-11-20';
const chave = (id) => String(id).replace(/[^A-Za-z0-9_\-.~:@+]/g, '~');
const d0 = (iso, n) => { const t = new Date(iso + 'T12:00:00'); t.setDate(t.getDate() - n); return t.toISOString().slice(0, 10); };
TC.ocFaltas = () => {
  const g = dash.data('entregas_cliente'); if (g.status !== 'ok') return null;
  let ult = ''; g.data.forEach((r) => { if (r.data > ult) ult = r.data; });
  const lim = d0(ult || '2000-01-01', TC.ocValDias - 1);
  return g.data.filter((r) => TC.ocValTipos.includes(r.ocorrencia) && r.data >= lim && !(TC.ocCorte && r.data <= TC.ocCorte))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : String(a.rota).localeCompare(String(b.rota))));
};
// Lista da tela: com período escolhido, todas as ocorrências desses dias; sem período, os últimos 3 dias.
TC.ocLista = () => {
  if (!F.de && !F.ate) return TC.ocFaltas();
  const g = dash.data('entregas_cliente'); if (g.status !== 'ok') return null;
  return g.data.filter((r) => TC.ocValTipos.includes(r.ocorrencia) && !(TC.ocCorte && r.data <= TC.ocCorte) && (!F.de || r.data >= F.de) && (!F.ate || r.data <= F.ate))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : String(a.rota).localeCompare(String(b.rota))));
};
TC.ocPend = () => { const f = TC.ocFaltas(); return f ? f.filter((r) => !TC.ocVal.has(chave(r.id))) : null; };
const redraw = () => ['ocValN', 'ocValList', 'ocValTot', 'ocValFN', 'ocValTr', 'rsOcResp'].forEach((n) => dash.draw(n));
// Filtros da lista: situação, transportadora e busca (rota, motorista, cliente)
TC.ocF = W.__nxOcF || {sit: 'pend', tr: '', q: '', de: '', ate: ''}; W.__nxOcF = TC.ocF;
const F = TC.ocF;
const sitDe = (r) => { const v = TC.ocVal.get(chave(r.id)); return !v ? 'pend' : v.resultado === 'comprovada' ? 'comp' : 'nc'; };
const passa = (r, ign) => (ign === 'sit' || F.sit === 'todas' || (F.sit === 'val' ? sitDe(r) !== 'pend' : sitDe(r) === F.sit))
  && (ign === 'tr' || !F.tr || r.transportadora === F.tr)
  && (!F.q || [r.rota, r.motorista, r.cliente, r.codigo, r.placa].join(' ').toLowerCase().includes(F.q.toLowerCase()));
const chips = () => document.querySelectorAll('.nx-chip[data-ov-sit]').forEach((c) => c.classList.toggle('is-on', c.dataset.ovSit === F.sit));
document.querySelectorAll('.nx-chip[data-ov-sit]').forEach((c) => { c.onclick = () => { F.sit = c.dataset.ovSit; chips(); redraw(); }; });
chips();
const datas = () => { document.querySelectorAll('#ov-de').forEach((i) => { i.value = F.de; }); document.querySelectorAll('#ov-ate').forEach((i) => { i.value = F.ate; }); document.querySelectorAll('#ov-3d').forEach((c) => c.classList.toggle('is-on', !F.de && !F.ate)); };
document.querySelectorAll('#ov-de, #ov-ate').forEach((i) => { i.onchange = () => { F[i.id === 'ov-de' ? 'de' : 'ate'] = i.value; datas(); redraw(); }; });
document.querySelectorAll('#ov-3d').forEach((c) => { c.onclick = () => { F.de = ''; F.ate = ''; datas(); redraw(); }; });
datas();
document.querySelectorAll('#ov-busca').forEach((i) => { i.value = F.q; i.oninput = () => { F.q = i.value.trim(); dash.draw('ocValList'); dash.draw('ocValFN'); }; });
dash.draw('ocValFN', (el) => {
  const f = TC.ocLista(); if (!f) { el.textContent = '—'; return; }
  const k = el.dataset.k;
  const n = f.filter((r) => passa(r, 'sit') && (k === 'todas' || (k === 'val' ? sitDe(r) !== 'pend' : sitDe(r) === k))).length;
  el.textContent = '(' + n + ')';
});
dash.draw('ocValTr', (sel) => {
  const f = TC.ocLista() || [];
  const ts = Array.from(new Set(f.map((r) => r.transportadora).filter(Boolean))).sort();
  sel.replaceChildren(new Option('Todas as transportadoras', ''), ...ts.map((t) => new Option(t, t)));
  if (F.tr && !ts.includes(F.tr)) F.tr = '';
  sel.value = F.tr;
  sel.onchange = () => { F.tr = sel.value; redraw(); };
});
const db = () => (W.claude && W.claude.use ? W.claude.use('db').catch(() => null) : Promise.resolve(null));
if (!W.__nxOcValSub) {
  W.__nxOcValSub = true;
  db().then((d) => { if (!d) return; d.collection('validacoes').onSnapshot((snap) => {
    TC.ocVal.clear(); snap.docs.forEach((x) => TC.ocVal.set(x.id, x.data())); redraw();
  }, () => {}); });
}
let quem = '';
(W.claude && W.claude.use ? W.claude.use('user').catch(() => null) : Promise.resolve(null))
  .then((u) => (u && u.me ? u.me() : null)).then((m) => { quem = (m && m.name) || ''; }).catch(() => {});

// Contador na barra lateral (sem piscar)
dash.draw('ocValN', (el) => {
  const p = TC.ocPend(); const n = p ? p.length : 0;
  el.textContent = n ? String(n) : '';
  const b = el.closest('button'); if (b) b.classList.remove('nx-blink');   // a aba 1.6 não pisca; mostra só o contador
});
dash.draw('ocValTot', (el) => {
  const f = TC.ocLista(); if (!f) { el.textContent = '—'; return; }
  const p = f.filter((r) => !TC.ocVal.has(chave(r.id))).length;
  el.textContent = p ? p + (p === 1 ? ' ocorrência aguardando validação' : ' ocorrências aguardando validação') + ' · ' + (f.length - p) + ' validada' + (f.length - p === 1 ? '' : 's') : 'Todas as ' + f.length + ' ocorrências validadas';
});
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const selSN = (lbl) => { const s = el('select', 'dash-select'); s.setAttribute('aria-label', lbl); [['', '—'], ['Sim', 'Sim'], ['Não', 'Não']].forEach(([v, t]) => s.append(new Option(t, v))); return s; };
const RES = {comprovada: 'Ocorrência comprovada: carga bipada e vídeo do carregamento. Responsabilidade do motorista/transportadora.', nao_comprovada: 'Ocorrência não comprovada: sem bipagem ou sem vídeo do carregamento.'};
TC.ocValRes = RES;
// Resumo do dia: % de ocorrências dividido pela área responsável (definida na validação)
dash.draw('rsOcResp', (box) => {
  const c = TC.rsCalc ? TC.rsCalc() : null;
  box.replaceChildren(); if (!c || !c.rows.length) return;
  const oc = c.rows.filter((r) => r.ocorrencia);
  // Só ocorrências (atrasos não entram). Falta e Avaria = Transporte, salvo outra área definida na validação
  if (!oc.length) return;
  const m = new Map(); TC.ocResp.forEach((a) => m.set(a, 0));
  oc.forEach((r) => { const v = TC.ocVal.get(chave(r.id)); const k = v && v.responsavel ? v.responsavel : /^(Falta|Avaria)$/i.test(r.ocorrencia) ? 'Nexxa-Transporte' : v ? 'Validada sem área' : 'Sem validação'; m.set(k, (m.get(k) || 0) + 1); });
  const totOc = oc.length;
  const tot = c.rows.length;
  Array.from(m.entries()).filter(([k, n]) => n > 0 || TC.ocResp.includes(k)).forEach(([k, n]) => {
    const row = el('div', 'nx-ocr-row' + (k === 'Sem validação' ? ' is-pend' : n ? '' : ' is-zero'));
    const pc = tot ? n / tot * 100 : 0, sh = totOc ? n / totOc * 100 : 0;
    const bar = el('i', 'nx-ocr-bar'); const f = el('b'); f.style.width = Math.min(100, sh) + '%'; bar.append(f);
    row.append(el('span', 'nx-ocr-k', k.replace('Nexxa-', '')), bar, el('span', 'nx-ocr-v', pc.toFixed(pc && pc < 1 ? 2 : 1).replace('.', ',') + '% (' + n + ')'));
    row.title = k + ': ' + n + ' ocorrência(s)' + (k === 'Nexxa-Transporte' ? ' (falta e avaria contam como Transporte)' : '') + ', ' + sh.toFixed(0) + '% das ocorrências e ' + pc.toFixed(1).replace('.', ',') + '% das entregas do filtro';
    box.append(row);
  });
});
if (TC.rsDraws && !TC.rsDraws.includes('rsOcResp')) TC.rsDraws.push('rsOcResp');
TC.ocResp = ['Nexxa-Transporte', 'Nexxa-Comercial', 'Nexxa-Logistica', 'Nexxa-ADM'];   // responsável pela ocorrência
dash.draw('ocValList', (box) => {
  const f = TC.ocLista();
  if (!f) { box.replaceChildren(); return; }
  if (!f.length) { box.replaceChildren(el('p', 'tc-empty', 'Nenhuma falta, avaria ou devolução total ' + (F.de || F.ate ? 'no período escolhido.' : 'nos últimos ' + TC.ocValDias + ' dias.'))); return; }
  const vis = f.filter((r) => passa(r));
  if (!vis.length) { box.replaceChildren(el('p', 'tc-empty', 'Nenhuma ocorrência com esses filtros.')); return; }
  const pend = vis.filter((r) => !TC.ocVal.has(chave(r.id))), ok = vis.filter((r) => TC.ocVal.has(chave(r.id)));
  const card = (r) => {
    const v = TC.ocVal.get(chave(r.id));
    const c = el('div', 'nx-ov' + (v ? ' is-ok' : ' is-pend'));
    const h = el('div', 'nx-ov-h');
    h.append(el('span', 'nx-ov-tipo', r.ocorrencia), el('b', '', TC.fdt(r.data).slice(0, 5) + ' · Rota ' + r.rota), el('span', '', (r.transportadora || '—') + ' · ' + (r.motorista || 'motorista não informado') + (r.placa ? ' · ' + r.placa : '')));
    c.append(h, el('div', 'nx-ov-cli', (r.codigo ? r.codigo + ' · ' : '') + (r.cliente || '')));
    if (r.comentario) c.append(el('div', 'nx-ov-com', 'Registro do motorista: ' + r.comentario));
    if (v) {
      c.append(el('div', 'nx-ov-res ' + (v.resultado === 'comprovada' ? 'is-comp' : 'is-nc'), RES[v.resultado] || '—'));
      c.append(el('div', 'nx-ov-det', (v.responsavel ? 'Responsável: ' + v.responsavel + ' · ' : '') + 'Bipada: ' + v.bipada + ' · Vídeo: ' + v.video + ' · ' + v.justificativa + ' — validado' + (v.por_nome ? ' por ' + v.por_nome : '') + (v.em ? ' em ' + new Date(v.em).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '')));
      const re = el('button', 'nx-chip', 'Refazer validação'); re.type = 'button';
      re.onclick = async () => { try { const d = await db(); await d.doc('validacoes/' + chave(r.id)).delete(); if (TC.log) TC.log('Validação de ocorrência desfeita', {data: r.data, rota: r.rota, detalhe: r.ocorrencia + ' · ' + (r.codigo ? r.codigo + ' ' : '') + (r.cliente || '')}); } catch (e) { c.append(el('p', 'nx-al-err', 'Não foi possível desfazer.')); } };
      c.append(re);
      return c;
    }
    const fm = el('div', 'nx-ov-form');
    const rp = el('select', 'dash-select'); rp.setAttribute('aria-label', 'Responsável pela ocorrência'); rp.append(new Option('Selecione…', ''), ...TC.ocResp.map((x) => new Option(x, x)));
    const l0 = el('label', '', 'Responsável '); l0.append(rp);
    const bp = selSN('A carga foi bipada?'), vd = selSN('Tem vídeo do carregamento?');
    const js = el('input', 'nx-input'); js.type = 'text'; js.maxLength = 300; js.placeholder = 'Justificativa (ex.: bipado às 05:42, vídeo no grupo da expedição)'; js.setAttribute('aria-label', 'Justificativa');
    const l1 = el('label', '', 'Carga bipada? '); l1.append(bp);
    const l2 = el('label', '', 'Vídeo do carregamento? '); l2.append(vd);
    const l3 = el('label', 'nx-ov-js', 'Justificativa '); l3.append(js);
    const bt = el('button', 'nx-btn', 'Validar'); bt.type = 'button';
    const er = el('span', 'nx-al-err'); er.hidden = true;
    bt.onclick = async () => {
      if (!rp.value || !bp.value || !vd.value || !js.value.trim()) { er.textContent = 'Preencha responsável, bipagem, vídeo e justificativa.'; er.hidden = false; return; }
      bt.disabled = true;
      try {
        const d = await db(); if (!d) throw new Error('sem banco');
        await d.doc('validacoes/' + chave(r.id)).set({id: r.id, data: r.data, rota: r.rota, codigo: r.codigo || '', cliente: r.cliente || '', motorista: r.motorista || '', transportadora: r.transportadora || '',
          responsavel: rp.value, bipada: bp.value, video: vd.value, justificativa: js.value.trim(), resultado: bp.value === 'Sim' && vd.value === 'Sim' ? 'comprovada' : 'nao_comprovada', em: new Date().toISOString(), por_nome: quem});
        if (TC.log) TC.log('Ocorrência validada', {data: r.data, rota: r.rota, detalhe: r.ocorrencia + ' · ' + (r.codigo ? r.codigo + ' ' : '') + (r.cliente || '') + ' · responsável ' + rp.value + ' · ' + (bp.value === 'Sim' && vd.value === 'Sim' ? 'comprovada' : 'não comprovada') + ' (bipada: ' + bp.value + ', vídeo: ' + vd.value + ') · ' + js.value.trim()});
      } catch (e) { er.textContent = 'Não foi possível salvar (seu acesso pode não permitir).'; er.hidden = false; bt.disabled = false; }
    };
    fm.append(l0, l1, l2, l3, bt, er);
    c.append(fm);
    return c;
  };
  const out = [];
  if (pend.length) { out.push(el('h3', 'nx-ov-t', 'Aguardando validação (' + pend.length + ')')); pend.forEach((r) => out.push(card(r))); }
  if (ok.length) { out.push(el('h3', 'nx-ov-t', 'Validadas (' + ok.length + ')')); ok.forEach((r) => out.push(card(r))); }
  box.replaceChildren(...out);
});
})();
