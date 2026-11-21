// Ocorrências do dia: validação das faltas pelo monitoramento (carga bipada + vídeo do carregamento).
// Falta nova sem validação faz a aba piscar em laranja na barra lateral.
(() => {
const W = window;
TC.ocVal = W.__nxOcVal || new Map(); W.__nxOcVal = TC.ocVal;
TC.ocValDias = 3;   // faltas dos últimos 3 dias de rota precisam de validação
const chave = (id) => String(id).replace(/[^A-Za-z0-9_\-.~:@+]/g, '~');
const d0 = (iso, n) => { const t = new Date(iso + 'T12:00:00'); t.setDate(t.getDate() - n); return t.toISOString().slice(0, 10); };
TC.ocFaltas = () => {
  const g = dash.data('entregas_cliente'); if (g.status !== 'ok') return null;
  let ult = ''; g.data.forEach((r) => { if (r.data > ult) ult = r.data; });
  const lim = d0(ult || '2000-01-01', TC.ocValDias - 1);
  return g.data.filter((r) => r.ocorrencia === 'Falta' && r.data >= lim)
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : String(a.rota).localeCompare(String(b.rota))));
};
TC.ocPend = () => { const f = TC.ocFaltas(); return f ? f.filter((r) => !TC.ocVal.has(chave(r.id))) : null; };
const redraw = () => ['ocValN', 'ocValList', 'ocValTot'].forEach((n) => dash.draw(n));
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

// Contador na barra lateral + pisca em laranja enquanto houver falta sem validação
dash.draw('ocValN', (el) => {
  const p = TC.ocPend(); const n = p ? p.length : 0;
  el.textContent = n ? String(n) : '';
  const b = el.closest('button'); if (b) b.classList.toggle('nx-blink', n > 0);
});
dash.draw('ocValTot', (el) => {
  const f = TC.ocFaltas(); if (!f) { el.textContent = '—'; return; }
  const p = f.filter((r) => !TC.ocVal.has(chave(r.id))).length;
  el.textContent = p ? p + (p === 1 ? ' falta aguardando validação' : ' faltas aguardando validação') + ' · ' + (f.length - p) + ' validada' + (f.length - p === 1 ? '' : 's') : 'Todas as ' + f.length + ' faltas validadas';
});
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const selSN = (lbl) => { const s = el('select', 'dash-select'); s.setAttribute('aria-label', lbl); [['', '—'], ['Sim', 'Sim'], ['Não', 'Não']].forEach(([v, t]) => s.append(new Option(t, v))); return s; };
const RES = {comprovada: 'Falta comprovada: carga bipada e vídeo do carregamento. Responsabilidade do motorista/transportadora.', nao_comprovada: 'Falta não comprovada: sem bipagem ou sem vídeo do carregamento.'};
TC.ocValRes = RES;
dash.draw('ocValList', (box) => {
  const f = TC.ocFaltas();
  if (!f) { box.replaceChildren(); return; }
  if (!f.length) { box.replaceChildren(el('p', 'tc-empty', 'Nenhuma falta registrada nos últimos ' + TC.ocValDias + ' dias.')); return; }
  const pend = f.filter((r) => !TC.ocVal.has(chave(r.id))), ok = f.filter((r) => TC.ocVal.has(chave(r.id)));
  const card = (r) => {
    const v = TC.ocVal.get(chave(r.id));
    const c = el('div', 'nx-ov' + (v ? ' is-ok' : ' is-pend'));
    const h = el('div', 'nx-ov-h');
    h.append(el('b', '', TC.fdt(r.data).slice(0, 5) + ' · Rota ' + r.rota), el('span', '', (r.transportadora || '—') + ' · ' + (r.motorista || 'motorista não informado') + (r.placa ? ' · ' + r.placa : '')));
    c.append(h, el('div', 'nx-ov-cli', (r.codigo ? r.codigo + ' · ' : '') + (r.cliente || '')));
    if (r.comentario) c.append(el('div', 'nx-ov-com', 'Registro do motorista: ' + r.comentario));
    if (v) {
      c.append(el('div', 'nx-ov-res ' + (v.resultado === 'comprovada' ? 'is-comp' : 'is-nc'), RES[v.resultado] || '—'));
      c.append(el('div', 'nx-ov-det', 'Bipada: ' + v.bipada + ' · Vídeo: ' + v.video + ' · ' + v.justificativa + ' — validado' + (v.por_nome ? ' por ' + v.por_nome : '') + (v.em ? ' em ' + new Date(v.em).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '')));
      const re = el('button', 'nx-chip', 'Refazer validação'); re.type = 'button';
      re.onclick = async () => { try { const d = await db(); await d.doc('validacoes/' + chave(r.id)).delete(); } catch (e) { c.append(el('p', 'nx-al-err', 'Não foi possível desfazer.')); } };
      c.append(re);
      return c;
    }
    const fm = el('div', 'nx-ov-form');
    const bp = selSN('A carga foi bipada?'), vd = selSN('Tem vídeo do carregamento?');
    const js = el('input', 'nx-input'); js.type = 'text'; js.maxLength = 300; js.placeholder = 'Justificativa (ex.: bipado às 05:42, vídeo no grupo da expedição)'; js.setAttribute('aria-label', 'Justificativa');
    const l1 = el('label', '', 'Carga bipada? '); l1.append(bp);
    const l2 = el('label', '', 'Vídeo do carregamento? '); l2.append(vd);
    const l3 = el('label', 'nx-ov-js', 'Justificativa '); l3.append(js);
    const bt = el('button', 'nx-btn', 'Validar'); bt.type = 'button';
    const er = el('span', 'nx-al-err'); er.hidden = true;
    bt.onclick = async () => {
      if (!bp.value || !vd.value || !js.value.trim()) { er.textContent = 'Preencha bipagem, vídeo e justificativa.'; er.hidden = false; return; }
      bt.disabled = true;
      try {
        const d = await db(); if (!d) throw new Error('sem banco');
        await d.doc('validacoes/' + chave(r.id)).set({id: r.id, data: r.data, rota: r.rota, codigo: r.codigo || '', cliente: r.cliente || '', motorista: r.motorista || '', transportadora: r.transportadora || '',
          bipada: bp.value, video: vd.value, justificativa: js.value.trim(), resultado: bp.value === 'Sim' && vd.value === 'Sim' ? 'comprovada' : 'nao_comprovada', em: new Date().toISOString(), por_nome: quem});
      } catch (e) { er.textContent = 'Não foi possível salvar (seu acesso pode não permitir).'; er.hidden = false; bt.disabled = false; }
    };
    fm.append(l1, l2, l3, bt, er);
    c.append(fm);
    return c;
  };
  const out = [];
  if (pend.length) { out.push(el('h3', 'nx-ov-t', 'Aguardando validação (' + pend.length + ')')); pend.forEach((r) => out.push(card(r))); }
  if (ok.length) { out.push(el('h3', 'nx-ov-t', 'Validadas (' + ok.length + ')')); ok.forEach((r) => out.push(card(r))); }
  box.replaceChildren(...out);
});
})();
