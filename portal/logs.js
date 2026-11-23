// Log de alterações: registra quem fez o quê (alertas, baixa manual, clientes informados, validações, atualização de dados, acessos).
// Cada registro fica em logs/<AAAA-MM>/itens/<id>; a tela 6.2 lê um mês por vez.
(() => {
const W = window;
const db = () => (W.claude && W.claude.use ? W.claude.use('db').catch(() => null) : Promise.resolve(null));
const p2 = (n) => String(n).padStart(2, '0');
const mesDe = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1);
let quem = null;
const quemSou = async () => {
  if (quem) return quem;
  if (W.NX_AUTH && W.NX_AUTH.usuario) return (quem = {id: W.NX_AUTH.uid || '', nome: W.NX_AUTH.usuario});
  try {
    const u = W.claude && W.claude.use ? await W.claude.use('user') : null;
    const m = u && u.me ? await u.me() : null;
    quem = {id: (m && m.id) || '', nome: (m && m.name) || ''};
  } catch (e) { quem = {id: '', nome: ''}; }
  return quem;
};
// TC.log('Alerta registrado', {data, rota, detalhe})
TC.log = async (acao, info) => {
  try {
    const d = await db(); if (!d) return;
    const q = await quemSou(), agora = new Date();
    const id = agora.getTime().toString(36) + Math.random().toString(36).slice(2, 7);
    const doc = Object.assign({em: agora.toISOString(), acao, por_id: q.id, por_nome: q.nome || '', perfil: (W.NX_AUTH && W.NX_AUTH.perfil) || ''}, info || {});
    Object.keys(doc).forEach((k) => { if (doc[k] === undefined) delete doc[k]; });
    await d.doc('logs/' + mesDe(agora) + '/itens/' + id).set(doc);
  } catch (e) { console.warn('[log]', e); }
};
// acesso ao portal (versão web, uma vez por sessão do navegador)
if (W.NX_AUTH && W.NX_AUTH.usuario && W.NX_AUTH.uid !== 'local') {
  let ja = false; try { ja = sessionStorage.getItem('nx-log-acesso') === '1'; sessionStorage.setItem('nx-log-acesso', '1'); } catch (e) { /* segue */ }
  if (!ja) TC.log('Entrou no portal', {});
}

// ---------- tela 6.2 ----------
TC.lg = W.__nxLg || {mes: mesDe(new Date()), quem: '', acao: '', q: ''}; W.__nxLg = TC.lg;
const F = TC.lg;
TC.lgRows = W.__nxLgRows || {mes: '', rows: null}; W.__nxLgRows = TC.lgRows;
let unsub = null;
const ouve = () => {
  if (TC.lgRows.mes === F.mes && unsub) return;
  if (unsub) { try { unsub(); } catch (e) { /* segue */ } unsub = null; }
  TC.lgRows.mes = F.mes; TC.lgRows.rows = null; redraw();
  db().then((d) => {
    if (!d) { TC.lgRows.rows = []; redraw(); return; }
    unsub = d.collection('logs/' + F.mes + '/itens').onSnapshot((snap) => {
      TC.lgRows.rows = snap.docs.map((x) => Object.assign({_id: x.id}, x.data())).sort((a, b) => String(b.em).localeCompare(String(a.em)));
      redraw();
    }, () => { TC.lgRows.rows = []; redraw(); });
  });
};
const redraw = () => ['lgList', 'lgN', 'lgQuem', 'lgAcao'].forEach((n) => dash.draw(n));
const passa = (r, ign) => (ign === 'quem' || !F.quem || r.por_nome === F.quem) && (ign === 'acao' || !F.acao || r.acao === F.acao)
  && (!F.q || [r.rota, r.data, r.detalhe, r.cliente, r.acao, r.por_nome].join(' ').toLowerCase().includes(F.q.toLowerCase()));
dash.draw('lgMes', (sel) => {
  const out = []; const d = new Date(); d.setDate(1);
  for (let i = 0; i < 12; i++) { const m = mesDe(d); out.push(new Option(new Date(d).toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'}), m)); d.setMonth(d.getMonth() - 1); }
  sel.replaceChildren(...out); sel.value = F.mes;
  sel.onchange = () => { F.mes = sel.value; F.quem = ''; F.acao = ''; ouve(); };
});
const opts = (sel, campo, rot) => {
  const rows = TC.lgRows.rows || [];
  const vs = Array.from(new Set(rows.filter((r) => passa(r, campo)).map((r) => (campo === 'quem' ? r.por_nome : r.acao)).filter(Boolean))).sort();
  sel.replaceChildren(new Option(rot, ''), ...vs.map((v) => new Option(v, v)));
  if (F[campo] && !vs.includes(F[campo])) F[campo] = '';
  sel.value = F[campo];
  sel.onchange = () => { F[campo] = sel.value; redraw(); };
};
dash.draw('lgQuem', (sel) => opts(sel, 'quem', 'Todos os usuários'));
dash.draw('lgAcao', (sel) => opts(sel, 'acao', 'Todas as ações'));
dash.draw('lgN', (el) => {
  const rows = TC.lgRows.rows; if (!rows) { el.textContent = 'Carregando…'; return; }
  const n = rows.filter((r) => passa(r)).length;
  el.textContent = n + (n === 1 ? ' registro' : ' registros') + (n !== rows.length ? ' de ' + rows.length : '');
});
const fdh = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
dash.draw('lgList', (tb) => {
  const rows = TC.lgRows.rows;
  const vazio = (t) => { const tr = document.createElement('tr'), c = document.createElement('td'); c.colSpan = 5; c.className = 'tc-empty'; c.textContent = t; tr.append(c); tb.replaceChildren(tr); };
  if (!rows) return vazio('Carregando…');
  const vis = rows.filter((r) => passa(r));
  if (!vis.length) return vazio(rows.length ? 'Nenhum registro com esses filtros.' : 'Nenhuma alteração registrada neste mês.');
  tb.replaceChildren(...vis.slice(0, 1000).map((r) => {
    const tr = document.createElement('tr');
    const td = (t, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; c.textContent = t; tr.append(c); return c; };
    td(fdh(r.em), 'nx-lg-em'); td(r.por_nome || '(sem nome)');
    const a = td(''); const s = document.createElement('span'); s.className = 'nx-lg-acao nx-lg-' + (/remov|desmarc|desfeit/i.test(r.acao) ? 'rem' : /Entrou/.test(r.acao) ? 'ace' : /atualiz/i.test(r.acao) ? 'upd' : 'add'); s.textContent = r.acao; a.append(s);
    td(r.rota ? r.rota + (r.data ? ' · ' + TC.fdt(r.data).slice(0, 5) : '') : '—');
    td(r.detalhe || '—', 'nx-lg-det');
    return tr;
  }));
});
document.querySelectorAll('#lg-busca').forEach((i) => { i.value = F.q; i.oninput = () => { F.q = i.value.trim(); redraw(); }; });
ouve();
})();
