// 1.8 Reprogramações: pedidos com alerta de reprogramação para o dia seguinte (reprogramado, quebrado – segue amanhã,
// excesso de volumes). A Programação confirma cada pedido; enquanto houver pedido sem validação, a aba pisca.
(() => {
const W = window;
TC.rpVal = W.__nxRpVal || new Map(); W.__nxRpVal = TC.rpVal;
TC.rpF = W.__nxRpF || {sit: 'pend', q: ''}; W.__nxRpF = TC.rpF;
const F = TC.rpF;
const chave = (id) => String(id).replace(/[^A-Za-z0-9_\-.~:@+]/g, '~');
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const db = () => (W.claude && W.claude.use ? W.claude.use('db').catch(() => null) : Promise.resolve(null));
const p2 = (n) => String(n).padStart(2, '0');
const isoDe = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const diaSeg = (iso) => { const a = String(iso || '').slice(0, 10).split('-').map(Number); if (a.length < 3 || !a[0]) return ''; return isoDe(new Date(a[0], a[1] - 1, a[2] + 1)); };
const fd = (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '—');

// pedidos reprogramados (ainda não entregues)
TC.rpVolRe = /volume[s]?\s*(excedid|em\s*excesso)|exce(sso|dente)\s*de\s*volume|exced\w*\s*volume/i;
TC.rpLista = () => {
  const g = dash.data('entregas_cliente'); if (g.status !== 'ok') return null;
  const out = [];
  const push = (x) => { if (!TC.rpSaiu(x.r, x.nova)) out.push(x); };
  // pedido que já voltou ao app em execução (em nova rota/data, ou a própria rota saiu do stand-by e foi expedida) sai da tela
  const emExec = (x) => x.status_rota === 'EmExecucao' || x.status_rota === 'Concluida' || !!x.saida_cd;
  const porCod = new Map();
  g.data.forEach((x) => { if (x.codigo && emExec(x)) { const L = porCod.get(x.codigo) || []; L.push(x); porCod.set(x.codigo, L); } });
  TC.rpSaiu = (r, nova) => (r.status_rota === 'EmExecucao' && !!r.saida_cd && String(r.saida_cd).slice(0, 10) > r.data) || (porCod.get(r.codigo) || []).some((x) => x !== r && x.data > r.data && x.data <= (nova || r.data));
  g.data.forEach((r) => {
    if (TC.isEnt(r) || TC.zerada(r) || r.situacao === 'Devolução total') return;
    if (/^REPO/i.test(String(r.rota || ''))) return;   // rotas de reposição ficam fora
    const al = TC.alDaEntrega(r);
    // carga inteira que não saiu do CD no dia (stand-by, sem expedição) também é reprogramação
    const reprogAl = al && (TC.alProxDia[al.tipo] || TC.rpVolRe.test(al.obs || ''));
    // motivo "volume excedido" registrado pelo motorista na entrega (ocorrência ou comentário do app)
    const vol = !reprogAl && TC.rpVolRe.test((r.ocorrencia || '') + ' ' + (r.comentario || ''));
    if (vol) { push({r, al: null, vol: true, nova: diaSeg(r.data), prev: '', v: TC.rpVal.get(chave(r.id))}); return; }
    const naoSaiu = !reprogAl && r.status_rota === 'StandBy' && !r.saida_cd && r.data < TC.hojeISO();
    if (!reprogAl && !naoSaiu) return;
    if (naoSaiu) { push({r, al: null, naoSaiu: true, nova: diaSeg(r.data), prev: '', v: TC.rpVal.get(chave(r.id))}); return; }
    const p = TC.prevAtual(r);
    const nova = p && p.tipo === 'reprog' && p.dt ? String(p.dt).slice(0, 10) : diaSeg(al.em ? isoDe(new Date(al.em)) : r.data);
    push({r, al, nova, prev: p && p.tipo === 'reprog' ? p.dt : '', v: TC.rpVal.get(chave(r.id))});
  });
  return out;
};
const grupos = (L) => {
  const m = new Map();
  L.forEach((x) => { const k = x.r.data + '|' + x.r.rota; if (!m.has(k)) m.set(k, {k, data: x.r.data, rota: x.r.rota, r0: x.r, al: x.al, naoSaiu: !!x.naoSaiu, vol: false, itens: []}); if (x.vol) m.get(k).vol = true; m.get(k).itens.push(x); });
  const G = Array.from(m.values());
  G.forEach((g) => { g.itens.sort((a, b) => (+a.r.seq_planejada || 0) - (+b.r.seq_planejada || 0)); g.pend = g.itens.filter((x) => !x.v).length;
    const tot = g.itens.length ? (dash.data('entregas_cliente').data || []).filter((r) => r.data === g.data && r.rota === g.rota && !TC.isEnt(r)).length : 0;
    g.inteira = g.naoSaiu || (g.al && g.al.escopo !== 'clientes') || (tot > 0 && g.itens.length >= tot); });
  return G.sort((a, b) => (b.pend > 0) - (a.pend > 0) || String((b.al && b.al.em) || b.data).localeCompare(String((a.al && a.al.em) || a.data)) || String(a.rota).localeCompare(String(b.rota)));
};
const redraw = () => ['rpN', 'rpTot', 'rpList', 'rpFN'].forEach((n) => dash.draw(n));
TC.rpRedraw = redraw;
if (!W.__nxRpSub) {
  W.__nxRpSub = true;
  db().then((d) => { if (!d) return; d.collection('reprog').onSnapshot((snap) => { TC.rpVal.clear(); snap.docs.forEach((x) => TC.rpVal.set(x.id, x.data())); redraw(); }, () => {}); });
}
let quem = '';
(W.NX_AUTH && W.NX_AUTH.usuario ? Promise.resolve({name: W.NX_AUTH.usuario}) : (W.claude && W.claude.use ? W.claude.use('user').catch(() => null) : Promise.resolve(null)).then((u) => (u && u.me ? u.me() : null)))
  .then((m) => { quem = (m && m.name) || ''; }).catch(() => {});

// contador na barra lateral + pisca enquanto houver reprogramação sem validação
dash.draw('rpN', (e) => {
  const L = TC.rpLista(); const n = L ? L.filter((x) => !x.v).length : 0;
  e.textContent = n ? String(n) : '';
  const b = e.closest('button'); if (b) b.classList.toggle('nx-blink', n > 0);
});
dash.draw('rpTot', (e) => {
  const L = TC.rpLista(); if (!L) { e.textContent = '—'; return; }
  const p = L.filter((x) => !x.v).length;
  e.textContent = !L.length ? 'Nenhum pedido reprogramado.' : p ? p + (p === 1 ? ' pedido aguardando validação' : ' pedidos aguardando validação') + ' · ' + (L.length - p) + ' validado' + (L.length - p === 1 ? '' : 's') : 'Todos os ' + L.length + ' pedidos reprogramados validados.';
});
const passa = (x, ign) => (ign === 'sit' || F.sit === 'todas' || (F.sit === 'pend' ? !x.v : !!x.v))
  && (!F.q || [x.r.rota, x.r.motorista, x.r.cliente, x.r.codigo, x.r.transportadora].join(' ').toLowerCase().includes(F.q.toLowerCase()));
dash.draw('rpFN', (e) => { const L = TC.rpLista() || []; const k = e.dataset.k; e.textContent = '(' + L.filter((x) => passa(x, 'sit') && (k === 'todas' || (k === 'pend' ? !x.v : !!x.v))).length + ')'; });
const chips = () => document.querySelectorAll('.nx-chip[data-rp-sit]').forEach((c) => c.classList.toggle('is-on', c.dataset.rpSit === F.sit));
document.querySelectorAll('.nx-chip[data-rp-sit]').forEach((c) => { c.onclick = () => { F.sit = c.dataset.rpSit; chips(); redraw(); }; });
chips();
document.querySelectorAll('#rp-busca').forEach((i) => { i.value = F.q; i.oninput = () => { F.q = i.value.trim(); dash.draw('rpList'); dash.draw('rpFN'); }; });

dash.draw('rpList', (box) => {
  const L = TC.rpLista();
  if (!L) { box.replaceChildren(); return; }
  if (!L.length) { box.replaceChildren(el('p', 'tc-empty', 'Nenhum pedido reprogramado para o dia seguinte.')); return; }
  const G = grupos(L.filter((x) => passa(x)));
  if (!G.length) { box.replaceChildren(el('p', 'tc-empty', 'Nenhum pedido com esses filtros.')); return; }
  box.replaceChildren(...G.map((g) => {
    const c = el('div', 'nx-ov nx-rp' + (g.pend ? ' is-pend' : ' is-ok'));
    const h = el('div', 'nx-ov-h');
    h.append(g.al ? TC.alBadge(g.al) : el('span', 'nx-rp-tag', g.vol ? 'Volume excedido' : 'Não expedida (stand-by)'), g.inteira ? el('span', 'nx-rp-inteira', 'Carga inteira · ' + g.itens.length + ' pedido' + (g.itens.length === 1 ? '' : 's')) : el('span', 'nx-rp-parcial', 'Parcial · ' + g.itens.length + ' pedido' + (g.itens.length === 1 ? '' : 's')), el('b', '', 'Rota ' + g.rota + ' · ' + TC.fdt(g.data).slice(0, 5)), el('span', '', (g.r0.transportadora || '—') + ' · ' + (g.r0.motorista || 'motorista não informado') + (g.r0.placa ? ' · ' + g.r0.placa : '')));
    c.append(h);
    if (g.vol) c.append(el('div', 'nx-ov-com', 'Motivo registrado na entrega: volume excedido. ' + Array.from(new Set(g.itens.map((x) => x.r.comentario).filter(Boolean))).slice(0, 3).join(' · ')));
    if (g.naoSaiu) c.append(el('div', 'nx-ov-com', 'A rota ficou em stand-by e não teve saída do CD no dia: a carga inteira passa para o dia seguinte.'));
    if (g.al && g.al.obs) c.append(el('div', 'nx-ov-com', 'Alerta: ' + g.al.obs + (g.al.em ? ' (registrado em ' + new Date(g.al.em).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) + ')' : '')));
    const tb = el('table', 'tc-table nx-rp-tab');
    const hr = el('tr'); ['', 'Seq.', 'Cliente', 'Cidade/UF', 'Janela', 'Reprogramado para', 'Validação'].forEach((t) => hr.append(el('th', '', t)));
    const thead = el('thead'); thead.append(hr); const tbody = el('tbody'); tb.append(thead, tbody);
    const marc = [];
    g.itens.forEach((x) => {
      const tr = el('tr', x.v ? 'nx-rp-ok' : 'nx-rp-pend');
      const c0 = el('td');
      if (!x.v) { const cb = el('input'); cb.type = 'checkbox'; cb.checked = true; cb.setAttribute('aria-label', 'Validar ' + (x.r.cliente || '')); marc.push({cb, x}); c0.append(cb); }
      tr.append(c0, el('td', '', String(x.r.seq_planejada || '—')), el('td', '', (x.r.codigo ? x.r.codigo + ' · ' : '') + (x.r.cliente || '')), el('td', '', (x.r.cidade || '') + (x.r.uf ? '/' + x.r.uf : '')), el('td', '', x.r.janela || '—'));
      tr.append(el('td', '', x.v ? fd(x.v.nova_data) : fd(x.nova) + (x.prev ? ' · prev. ' + String(x.prev).slice(11, 16) : '')));
      const cv = el('td');
      if (x.v) {
        cv.append(el('span', 'nx-rp-vok', 'Validado' + (x.v.por_nome ? ' por ' + x.v.por_nome : '') + (x.v.em ? ' em ' + new Date(x.v.em).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '') + (x.v.obs ? ' · ' + x.v.obs : '')));
        const un = el('button', 'nx-al-btn', 'Desfazer'); un.type = 'button';
        un.onclick = async () => { try { const d = await db(); await d.doc('reprog/' + chave(x.r.id)).delete(); if (TC.log) TC.log('Reprogramação: validação desfeita', {data: x.r.data, rota: x.r.rota, detalhe: (x.r.codigo ? x.r.codigo + ' ' : '') + (x.r.cliente || '')}); } catch (e) { cv.append(el('span', 'nx-al-err', ' Não foi possível desfazer.')); } };
        cv.append(' ', un);
      } else cv.append(el('span', 'nx-rp-vpend', 'Aguardando'));
      tr.append(cv); tbody.append(tr);
    });
    const wrap = el('div', 'tc-tablewrap'); wrap.append(tb); c.append(wrap);
    if (marc.length) {
      const fm = el('div', 'nx-ov-form');
      const dt = el('input', 'nx-input nx-date'); dt.type = 'date'; dt.value = marc[0].x.nova || '';
      const l1 = el('label', '', 'Programado para '); l1.append(dt);
      const ob = el('input', 'nx-input'); ob.type = 'text'; ob.maxLength = 200; ob.placeholder = 'Observação (opcional): ex. programado na rota X, veículo Y';
      const l2 = el('label', 'nx-ov-js', 'Observação '); l2.append(ob);
      const bt = el('button', 'nx-btn', g.inteira && marc.length === g.itens.length ? 'Validar carga inteira' : 'Validar reprogramação'); bt.type = 'button';
      const er = el('span', 'nx-al-err'); er.hidden = true;
      bt.onclick = async () => {
        const sel = marc.filter((m) => m.cb.checked).map((m) => m.x);
        if (!sel.length || !dt.value) { er.textContent = 'Marque ao menos um pedido e informe a data programada.'; er.hidden = false; return; }
        bt.disabled = true; er.hidden = true;
        try {
          const d = await db(); if (!d) throw new Error('sem banco');
          const em = new Date().toISOString();
          for (const x of sel) {
            await d.doc('reprog/' + chave(x.r.id)).set({id: x.r.id, data: x.r.data, rota: x.r.rota, codigo: x.r.codigo || '', cliente: x.r.cliente || '', transportadora: x.r.transportadora || '', tipo: g.al ? g.al.tipo : g.vol ? 'volume_excedido' : 'nao_expedida', inteira: !!g.inteira, nova_data: dt.value, obs: ob.value.trim(), em, por_nome: quem});
          }
          if (TC.log) TC.log(g.inteira ? 'Reprogramação validada (carga inteira)' : 'Reprogramação validada', {data: g.data, rota: g.rota, detalhe: (g.vol ? 'Volume excedido · ' : g.naoSaiu ? 'Não expedida · ' : '') + 'Programado para ' + fd(dt.value) + ' · ' + TC.logClientes(g.data, g.rota, sel.map((x) => x.r.id)) + (ob.value.trim() ? ' · ' + ob.value.trim() : '')});
        } catch (e) { er.textContent = 'Não foi possível salvar (seu acesso pode não permitir).'; er.hidden = false; bt.disabled = false; }
      };
      fm.append(l1, l2, bt, er); c.append(fm);
    }
    return c;
  }));
});
const re = TC.alRedraw; TC.alRedraw = () => { if (re) re(); redraw(); };
})();
