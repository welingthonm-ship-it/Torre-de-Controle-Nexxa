// 1.7 Atrasos previstos: entregas de hoje que devem chegar depois da janela (ou já atrasadas de dias anteriores).
// Enquanto alguma não tiver alerta, a aba pisca; ao registrar o alerta (atraso ou outro), a entrega deixa de piscar.
(() => {
const W = window;
TC.atF = W.__nxAtF || {sit: 'sem', q: ''}; W.__nxAtF = TC.atF;
const F = TC.atF;
const hm = (dt) => { const s = TC.fdt(dt); return s.length > 10 ? s.slice(0, 5) + ' ' + s.slice(11, 16) : s; };
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
// alerta que conta como "tratada": qualquer alerta na entrega ou na rota, menos baixa manual
TC.atAlerta = (r) => { const a = TC.alDaEntrega(r); return a && a.tipo !== 'baixa_manual' ? a : null; };
TC.atrasos = () => {
  const g = dash.data('entregas_cliente'); if (g.status !== 'ok') return null;
  const hoje = TC.hojeISO(), now = Math.floor(Date.now() / 60000), out = [];
  g.data.forEach((r) => {
    if (TC.isEnt(r) || TC.zerada(r) || r.chegada_real || r.situacao === 'Devolução total') return;
    const alvo = TC.alvoData(r); if (!alvo || alvo > hoje) return;
    const p = TC.prevAtual(r); if (p && p.tipo === 'real') return;
    let nivel = '', min = 0;
    if (alvo < hoje) { nivel = 'atrasada'; }
    else {
      const fim = String(r.janela || '').split('–')[1], ini = String(r.janela || '').split('–')[0];
      if (!/^\d\d:\d\d$/.test(fim || '') || ini === fim || !p || p.m === undefined) return;
      const jf = TC.tmin(alvo + ' ' + fim);
      const m = Math.max(p.m, now);
      if (m > jf + 60) { nivel = 'previsto'; min = m - jf; }
      else if (m > jf) { nivel = 'possivel'; min = m - jf; }
      else return;
    }
    out.push({r, p, nivel, min, al: TC.atAlerta(r)});
  });
  const ord = {atrasada: 0, previsto: 1, possivel: 2};
  return out.sort((a, b) => (!!a.al - !!b.al) || ord[a.nivel] - ord[b.nivel] || b.min - a.min || String(a.r.rota).localeCompare(String(b.r.rota)));
};
const NIVEL = {atrasada: 'Atrasada (dia anterior)', previsto: 'Atraso previsto', possivel: 'Possível atraso'};
TC.atCache = {t: 0, L: null};
const lista = () => { if (Date.now() - TC.atCache.t > 3000) TC.atCache = {t: Date.now(), L: TC.atrasos()}; return TC.atCache.L; };
const redraw = () => { TC.atCache.t = 0; ['atN', 'atTot', 'atList', 'atFN'].forEach((n) => dash.draw(n)); };
TC.atRedraw = redraw;

// contador na barra lateral + pisca enquanto houver entrega com atraso previsto sem alerta
dash.draw('atN', (e) => {
  const L = lista(); const n = L ? L.filter((x) => !x.al).length : 0;
  e.textContent = n ? String(n) : '';
  const b = e.closest('button'); if (b) b.classList.toggle('nx-blink', n > 0);
});
dash.draw('atTot', (e) => {
  const L = lista(); if (!L) { e.textContent = '—'; return; }
  const sem = L.filter((x) => !x.al).length;
  e.textContent = !L.length ? 'Nenhuma entrega com atraso previsto agora.' : sem ? sem + (sem === 1 ? ' entrega sem alerta' : ' entregas sem alerta') + ' · ' + (L.length - sem) + ' já com alerta' : 'Todas as ' + L.length + ' entregas com atraso previsto já têm alerta.';
});
const passa = (x, ign) => (ign === 'sit' || F.sit === 'todas' || (F.sit === 'sem' ? !x.al : !!x.al))
  && (!F.q || [x.r.rota, x.r.motorista, x.r.cliente, x.r.codigo, x.r.transportadora].join(' ').toLowerCase().includes(F.q.toLowerCase()));
dash.draw('atFN', (e) => { const L = lista() || []; const k = e.dataset.k; e.textContent = '(' + L.filter((x) => passa(x, 'sit') && (k === 'todas' || (k === 'sem' ? !x.al : !!x.al))).length + ')'; });
const chips = () => document.querySelectorAll('.nx-chip[data-at-sit]').forEach((c) => c.classList.toggle('is-on', c.dataset.atSit === F.sit));
document.querySelectorAll('.nx-chip[data-at-sit]').forEach((c) => { c.onclick = () => { F.sit = c.dataset.atSit; chips(); redraw(); }; });
chips();
document.querySelectorAll('#at-busca').forEach((i) => { i.value = F.q; i.oninput = () => { F.q = i.value.trim(); dash.draw('atList'); dash.draw('atFN'); }; });

// abre o editor de alerta já com os clientes atrasados da rota marcados e o tipo "atraso"
TC.atAbrir = (data, rota, ids) => {
  TC.alAbrir(data, rota, 'clientes');
  TC.alBxTodos = false; TC.alBxSel = new Set(ids);
  document.querySelectorAll('#al-tipo').forEach((s) => { s.value = 'atraso_entrega'; });
  TC.alBxVis();
};
dash.draw('atList', (tb) => {
  const L = lista();
  const vazio = (t) => { const tr = el('tr'), c = el('td', 'tc-empty', t); c.colSpan = 10; tr.append(c); tb.replaceChildren(tr); };
  if (!L) return vazio('Carregando…');
  const vis = L.filter((x) => passa(x));
  if (!vis.length) return vazio(L.length ? 'Nenhuma entrega com esses filtros.' : 'Nenhuma entrega com atraso previsto agora.');
  const semPorRota = new Map(); L.forEach((x) => { if (!x.al) { const k = x.r.data + '|' + x.r.rota; if (!semPorRota.has(k)) semPorRota.set(k, []); semPorRota.get(k).push(x.r.id); } });
  tb.replaceChildren(...vis.map((x) => {
    const r = x.r, tr = el('tr', x.al ? 'nx-at-ok' : 'nx-at-pisca');
    const td = (t, cls) => { const c = el('td', cls, t); tr.append(c); return c; };
    td('').append(el('span', 'nx-at-nivel nx-at-' + x.nivel, NIVEL[x.nivel] + (x.min ? ' +' + TC.fmin(x.min) : '')));
    td(r.rota + (r.data !== TC.hojeISO() ? ' · ' + TC.fdt(r.data).slice(0, 5) : ''));
    td(r.transportadora || '—'); td(r.motorista || '—');
    td((r.codigo ? r.codigo + ' · ' : '') + (r.cliente || ''));
    td(r.janela || '—');
    td(x.p && x.p.dt ? hm(x.p.dt) + (x.p.standby ? ' (no CD)' : '') : '—', 'nx-prev-bad');
    td(TC.stLabel[r.status_rota] || r.status_rota || '—');
    const ac = td('');
    if (x.al) ac.append(TC.alBadge(x.al));
    else if (TC.alPode) {
      const ids = semPorRota.get(r.data + '|' + r.rota) || [r.id];
      const b = el('button', 'nx-btn nx-at-btn', 'Registrar alerta' + (ids.length > 1 ? ' (' + ids.length + ' da rota)' : '')); b.type = 'button';
      b.onclick = () => TC.atAbrir(r.data, r.rota, ids);
      ac.append(b);
    } else ac.append(el('span', 'nx-at-sem', 'Sem alerta'));
    return tr;
  }));
});
// recalcula a cada minuto (a previsão anda com o relógio)
if (W.__nxAtTick) clearInterval(W.__nxAtTick);
W.__nxAtTick = setInterval(redraw, 60000);
const re = TC.alRedraw; TC.alRedraw = () => { if (re) re(); redraw(); };
})();
