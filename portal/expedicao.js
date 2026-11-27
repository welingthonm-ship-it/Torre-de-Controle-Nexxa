// Rotas do dia: previsão de expedição (data e hora) para rotas em stand-by. A previsão de entrega passa a partir dela.
(() => {
const W = window;
const db = () => (W.claude && W.claude.use ? W.claude.use('db').catch(() => null) : Promise.resolve(null));
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const id = (data, rota) => (TC.alId ? TC.alId(data, rota) : String(data + '_' + rota).replace(/[^A-Za-z0-9_\-.~:@+]/g, '~'));
const fdh = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) + ' ' + s.slice(11, 16) : '');
TC.exp = W.__nxExp || new Map(); W.__nxExp = TC.exp;
TC.expDe = (data, rota) => TC.exp.get(data + '|' + rota) || null;
if (!W.__nxExpSub) {
  W.__nxExpSub = true;
  db().then((d) => { if (!d) return; d.collection('expedicao').onSnapshot((snap) => {
    TC.exp.clear(); snap.docs.forEach((x) => { const a = x.data(); if (a && a.data && a.rota && a.prev) TC.exp.set(a.data + '|' + a.rota, a); });
    ['rotas', 'expBox', 'rtPrior', 'cgStops', 'cliEnt', 'entPrev'].forEach((n) => dash.draw(n));
  }, () => {}); });
}
// a rota ainda não saiu do CD (stand-by, sem saída registrada)
TC.expPendente = (data, rota) => {
  const ix = TC.cgIdx ? TC.cgIdx() : null, rs = (ix && ix.get(data + '|' + rota)) || [];
  return rs.length ? rs.some((x) => x.status_rota === 'StandBy') && !rs.some((x) => x.saida_cd) : false;
};
// marca na linha da rota
const antes = TC.rtLinhaExtra;
TC.rtLinhaExtra = (tr, r, st) => {
  if (antes) antes(tr, r, st);
  if (r.status_rota !== 'StandBy') return;
  const e = TC.expDe(r.data, r.rota);
  if (e) {
    const s = el('span', 'nx-exp-tag', '🚚 Expedição prevista ' + fdh(e.prev)); s.title = (e.obs ? e.obs + ' · ' : '') + (e.por_nome ? 'por ' + e.por_nome : '');
    st.append(s);
  }
  if (TC.alPode) {
    const b = el('button', 'nx-al-btn nx-exp-btn', e ? 'Alterar previsão' : '⏱ Prev. expedição'); b.type = 'button';
    b.onclick = (ev) => { ev.stopPropagation(); TC.expAbrir(r.data, r.rota); };
    st.append(b);
  }
};
TC.expEd = W.__nxExpEd || null;
TC.expAbrir = (data, rota) => { TC.expEd = W.__nxExpEd = {data, rota, erro: '', salvando: false}; document.querySelectorAll('#exp-modal').forEach((m) => { m.hidden = false; }); dash.draw('expBox'); };
const fecha = () => { TC.expEd = W.__nxExpEd = null; document.querySelectorAll('#exp-modal').forEach((m) => { m.hidden = true; }); };
let quem = '';
(W.NX_AUTH && W.NX_AUTH.usuario ? Promise.resolve({name: W.NX_AUTH.usuario}) : (W.claude && W.claude.use ? W.claude.use('user').catch(() => null) : Promise.resolve(null)).then((u) => (u && u.me ? u.me() : null))).then((m) => { quem = (m && m.name) || ''; }).catch(() => {});
dash.draw('expBox', (box) => {
  const E = TC.expEd; box.replaceChildren(); if (!E) return;
  const e = TC.expDe(E.data, E.rota);
  box.append(el('h3', '', 'Previsão de expedição · rota ' + E.rota), el('p', '', 'A rota está em stand-by (em separação/carregamento). Informe quando ela deve sair do CD; a previsão de entrega dos clientes passa a contar a partir desse horário.'));
  const p2 = (n) => String(n).padStart(2, '0'), d = new Date();
  const inp = el('input', 'nx-input'); inp.type = 'datetime-local'; inp.setAttribute('aria-label', 'Data e hora previstas de expedição');
  inp.value = e ? e.prev.replace(' ', 'T') : d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(Math.min(23, d.getHours() + 1)) + ':00';
  const ob = el('input', 'nx-input'); ob.type = 'text'; ob.maxLength = 200; ob.placeholder = 'Observação (opcional): ex. aguardando produto, carregando'; ob.value = e && e.obs ? e.obs : '';
  const l1 = el('label', 'nx-exp-l', 'Data e hora da expedição '); l1.append(inp);
  const l2 = el('label', 'nx-exp-l', 'Observação '); l2.append(ob);
  box.append(l1, l2);
  if (E.erro) box.append(el('p', 'nx-al-err', E.erro));
  const acts = el('div', 'nx-al-acts');
  const ok = el('button', 'nx-btn', E.salvando ? 'Salvando…' : 'Salvar previsão'); ok.type = 'button'; ok.disabled = E.salvando;
  ok.onclick = async () => {
    const v = (inp.value || '').replace('T', ' ').slice(0, 16);
    if (!/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(v)) { E.erro = 'Informe a data e a hora.'; dash.draw('expBox'); return; }
    E.salvando = true; E.erro = ''; dash.draw('expBox');
    try {
      const dd = await db(); if (!dd) throw new Error('sem db');
      await dd.doc('expedicao/' + id(E.data, E.rota)).set({data: E.data, rota: E.rota, prev: v, obs: ob.value.trim(), em: new Date().toISOString(), por_nome: quem});
      if (TC.log) TC.log(e ? 'Previsão de expedição alterada' : 'Previsão de expedição registrada', {data: E.data, rota: E.rota, detalhe: 'Saída prevista ' + fdh(v) + (e ? ' (antes ' + fdh(e.prev) + ')' : '') + (ob.value.trim() ? ' · ' + ob.value.trim() : '')});
      fecha();
    } catch (er) { E.salvando = false; E.erro = 'Não foi possível salvar (seu acesso pode não permitir).'; dash.draw('expBox'); }
  };
  acts.append(ok);
  if (e) { const rm = el('button', 'nx-btn nx-btn-sec', 'Remover previsão'); rm.type = 'button'; rm.onclick = async () => { try { const dd = await db(); await dd.doc('expedicao/' + id(E.data, E.rota)).delete(); if (TC.log) TC.log('Previsão de expedição removida', {data: E.data, rota: E.rota, detalhe: 'Era ' + fdh(e.prev)}); fecha(); } catch (er) { E.erro = 'Não foi possível remover.'; dash.draw('expBox'); } }; acts.append(rm); }
  const no = el('button', 'nx-btn nx-btn-sec', 'Cancelar'); no.type = 'button'; no.onclick = fecha; acts.append(no);
  box.append(acts);
});
document.querySelectorAll('#exp-modal').forEach((m) => { m.onclick = (ev) => { if (ev.target === m) fecha(); }; m.onkeydown = (ev) => { if (ev.key === 'Escape') fecha(); }; });
})();
