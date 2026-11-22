// Rotas do dia: prioridades (pendentes de dias anteriores, rotas REPO e reprogramadas)
// e aviso de entregas perto de estourar a janela sem chegada do motorista.
(() => {
const W = window;
TC.janAviso = 30;          // minutos antes do fim da janela
TC.priorDias = 10;         // olha pendentes dos últimos 10 dias antes do dia monitorado
const MIN = 60000;
const hm = (dt) => { const s = TC.fdt(dt); return s.length > 10 ? s.slice(0, 5) + ' ' + s.slice(11, 16) : s; };
const d0 = (iso, n) => { const a = iso.split('-').map(Number), d = new Date(a[0], a[1] - 1, a[2] - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

// Entregas da rota perto de estourar a janela: pendentes, sem chegada, faltando até 30 min para o fim da janela.
TC.rtJanela = () => {
  const g = dash.data('entregas_cliente'); if (g.status !== 'ok') return new Map();
  const agora = Date.now(), m = new Map();
  g.data.forEach((r) => {
    if (TC.isEnt(r) || r.chegada_real || r.situacao === 'Devolução total') return;
    if (!/–\d\d:\d\d$/.test(String(r.janela || ''))) return;
    const fim = TC.psPrazo(r), falta = (fim - agora) / MIN;
    if (falta <= 0 || falta > TC.janAviso) return;
    const k = r.data + '|' + r.rota; if (!m.has(k)) m.set(k, []);
    m.get(k).push({r, falta: Math.ceil(falta)});
  });
  return m;
};
TC.rtLinhaExtra = (tr, r, st) => {
  if (!TC.__rtJan) TC.__rtJan = {t: 0, m: new Map()};
  if (Date.now() - TC.__rtJan.t > 5000) TC.__rtJan = {t: Date.now(), m: TC.rtJanela()};
  const L = TC.__rtJan.m.get(r.data + '|' + r.rota); if (!L || !L.length) return;
  const min = Math.min(...L.map((x) => x.falta));
  const c = el('span', 'nx-jan-aviso', '⏰ ' + L.length + (L.length === 1 ? ' entrega' : ' entregas') + ' a ' + min + ' min do fim da janela');
  c.title = 'Sem chegada do motorista: ' + L.map((x) => (x.r.codigo ? x.r.codigo + ' ' : '') + (x.r.cliente || '') + ' (janela ' + x.r.janela + ', faltam ' + x.falta + ' min)').join('; ');
  st.append(c); tr.classList.add('nx-jan-row');
};
dash.draw('rtJanN', (e) => {
  const m = TC.rtJanela(); const n = Array.from(m.values()).reduce((s, l) => s + l.length, 0);
  e.textContent = n ? '⏰ ' + n + (n === 1 ? ' entrega' : ' entregas') + ' em ' + m.size + (m.size === 1 ? ' rota' : ' rotas') + ' a até ' + TC.janAviso + ' min do fim da janela, sem chegada do motorista.' : '';
});

// Prioridades: pedidos de dias anteriores não entregues, rotas de reposição (REPO) e rotas reprogramadas.
TC.rtPrioridades = () => {
  const g = dash.data('entregas_cliente'), day = TC.dayOf && TC.dayOf();
  if (g.status !== 'ok' || !day) return null;
  const ini = d0(day, TC.priorDias), m = new Map();
  g.data.forEach((r) => {
    if (TC.isEnt(r) || r.situacao === 'Devolução total' || r.data > day || r.data < ini) return;
    const repo = /^REPO/i.test(String(r.rota || '')), al = TC.alDaEntrega(r), reprog = !!(al && TC.alProxDia[al.tipo]);
    if (r.data === day && !repo) return;
    const k = r.data + '|' + r.rota;
    if (!m.has(k)) m.set(k, {k, data: r.data, rota: r.rota, r0: r, itens: [], repo, reprog: false, al: TC.alDe(r.data, r.rota)});
    const o = m.get(k); o.itens.push(r); if (reprog) o.reprog = true;
  });
  const L = Array.from(m.values());
  L.forEach((o) => {
    o.motivo = o.repo ? 'Rota de reposição (REPO)' : o.reprog ? 'Reprogramada' : 'Pendente de ' + TC.fdt(o.data).slice(0, 5);
    o.ord = o.repo ? 0 : o.reprog ? 1 : 2;
    const ps = o.itens.map((r) => TC.prevAtual(r)).filter((p) => p && p.dt).sort((a, b) => (a.dt < b.dt ? -1 : 1));
    o.prev = ps[0] || null;
  });
  return L.sort((a, b) => a.ord - b.ord || (a.data < b.data ? -1 : a.data > b.data ? 1 : 0) || b.itens.length - a.itens.length || String(a.rota).localeCompare(String(b.rota)));
};
dash.draw('rtPriorN', (e) => {
  const L = TC.rtPrioridades(); if (!L) { e.textContent = '—'; return; }
  const n = L.reduce((s, o) => s + o.itens.length, 0);
  e.textContent = L.length ? n + (n === 1 ? ' pedido' : ' pedidos') + ' em ' + L.length + (L.length === 1 ? ' rota' : ' rotas') : 'nenhuma';
});
dash.draw('rtPrior', (tb) => {
  const L = TC.rtPrioridades();
  if (!L) { tb.replaceChildren(); return; }
  if (!L.length) { const tr = el('tr'), c = el('td', 'tc-empty', 'Nenhuma prioridade: sem pendentes de dias anteriores, rotas REPO ou reprogramadas.'); c.colSpan = 9; tr.append(c); tb.replaceChildren(tr); return; }
  tb.replaceChildren(...L.map((o) => {
    const tr = el('tr'), r = o.r0;
    const td = (t, cls) => { const c = el('td', cls, t); tr.append(c); return c; };
    td('').append(el('span', 'nx-prior-tag nx-prior-' + (o.repo ? 'repo' : o.reprog ? 'reprog' : 'ant'), o.motivo));
    td(TC.short ? TC.short(o.data) : o.data); td(o.rota); td(r.transportadora || '—'); td(r.motorista || '—');
    td(TC.stLabel[r.status_rota] || r.status_rota || '—');
    const pc = td(String(o.itens.length), 'n');
    pc.title = o.itens.map((x) => (x.codigo ? x.codigo + ' ' : '') + (x.cliente || '')).join('\n');
    td(o.prev ? hm(o.prev.dt) + (o.prev.tipo === 'reprog' ? ' (reprog.)' : o.prev.standby ? ' (no CD)' : '') : '—');
    const ac = td('');
    const als = new Set(o.itens.map((x) => TC.alDaEntrega(x)).filter(Boolean));
    als.forEach((a) => ac.append(TC.alBadge(a), ' '));
    if (!als.size) ac.textContent = '—';
    if (TC.alPode) { tr.classList.add('nx-click'); tr.title = 'Clique para registrar alerta nos clientes desta rota'; tr.onclick = () => TC.alAbrir(o.data, o.rota, 'clientes'); }
    return tr;
  }));
});
if (W.__nxJanTick) clearInterval(W.__nxJanTick);
W.__nxJanTick = setInterval(() => { const t = document.getElementById('rotas'); if (t && !t.hidden) { TC.__rtJan = null; ['rotas', 'rtJanN', 'rtPrior', 'rtPriorN'].forEach((n) => dash.draw(n)); } }, 60000);
})();
