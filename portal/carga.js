(() => {
const W = window;
TC.cg = W.__nxCg = W.__nxCg || {data: null, rota: null};
TC.cgIdx = () => {
const g = dash.data('entregas_cliente'); if (g.status !== 'ok') return null;
if (TC.cgI && TC.cgI.src === g.data) return TC.cgI.m;
const m = new Map();
g.data.forEach((r) => { const k = r.data + '|' + r.rota; let a = m.get(k); if (!a) { a = []; m.set(k, a); } a.push(r); });
m.forEach((a) => a.sort((x, y) => (+x.seq_planejada || 0) - (+y.seq_planejada || 0)));
TC.cgI = {src: g.data, m};
return m;
};
TC.cgRows = () => { const m = TC.cgIdx(); return m && TC.cg.rota ? (m.get(TC.cg.data + '|' + TC.cg.rota) || []) : []; };
TC.cgDraws = ['cgHead', 'cgDatas', 'cgCards', 'cgTl', 'cgStops'];
TC.cgRedraw = () => TC.cgDraws.forEach((n) => dash.draw(n));
const vis = (ok, v) => {
document.querySelectorAll('#cg-nao-achado').forEach((e) => { e.hidden = ok || !v; });
document.querySelectorAll('#cg-hint').forEach((e) => { e.hidden = ok || !!v; });
document.querySelectorAll('#cg-conteudo').forEach((e) => { e.hidden = !ok; });
};
TC.cgSet = (data, rota) => { TC.cg.data = data; TC.cg.rota = rota; vis(true, 'x'); TC.cgRedraw(); };
document.querySelectorAll('#nx-cg-input').forEach((inp) => {
const pick = () => {
const v = inp.value.trim(), m = TC.cgIdx(); if (!m) return;
const [rp, dp] = v.split(' — ');
const rota = (rp || '').trim().toUpperCase();
let data = null;
if (dp && /^\d\d\/\d\d\/\d{4}/.test(dp.trim())) { const x = dp.trim().slice(0, 10).split('/'); data = x[2] + '-' + x[1] + '-' + x[0]; }
const datas = Array.from(m.keys()).filter((k) => k.slice(11).toUpperCase() === rota).map((k) => k.slice(0, 10)).sort();
if (!data || !datas.includes(data)) data = datas[datas.length - 1] || null;
const ok = !!data;
vis(ok, v);
if (ok) { const key = Array.from(m.keys()).find((k) => k.slice(0, 10) === data && k.slice(11).toUpperCase() === rota); TC.cgSet(data, key.slice(11)); }
};
inp.addEventListener('change', pick);
inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') pick(); });
});
if (TC.cg.rota) vis(true, 'x');
})();
dash.draw('cgList', (dl) => {
const m = TC.cgIdx(); if (!m) { dl.replaceChildren(); return; }
const ks = Array.from(m.keys()).sort((a, b) => (a < b ? 1 : -1));
dl.replaceChildren(...ks.map((k) => { const r = m.get(k)[0], o = document.createElement('option'); o.value = r.rota + ' — ' + TC.fdt(r.data); o.label = [r.transportadora, r.motorista, r.placa, m.get(k).length + ' entregas'].filter(Boolean).join(' · '); return o; }));
});
dash.draw('cgHead', (box) => {
const rows = TC.cgRows(); box.replaceChildren(); if (!rows.length) return;
const r = rows[0], el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const top = el('div'), nome = el('div', 'nx-cli-nome', 'Carga ' + r.rota);
const b = el('span', 'tc-badge ' + (TC.stClass[r.status_rota] || 'tc-b-oth'), TC.stLabel[r.status_rota] || r.status_rota || '—');
nome.append(' ', b);
const al = TC.alDe(r.data, r.rota); if (al) nome.append(' ', TC.alBadge(al));
const meta = el('div', 'nx-cg-meta');
[['Data da carga', TC.dlabel(r.data)], ['Transportadora', r.transportadora || '—'], ['Motorista', r.motorista || '—'], ['Placa', r.placa || '—'], ['Depósito', r.deposito || '—']].forEach(([k, v]) => { const sp = el('span', null, k + ': '); sp.append(el('b', null, v)); meta.append(sp); });
top.append(nome, meta); box.append(top);
});
dash.draw('cgDatas', (box) => {
const m = TC.cgIdx(); box.replaceChildren(); if (!m || !TC.cg.rota) return;
const ds = Array.from(m.keys()).filter((k) => k.slice(11) === TC.cg.rota).map((k) => k.slice(0, 10)).sort().reverse();
if (ds.length < 2) return;
box.append('Outras datas desta rota: ');
ds.slice(0, 20).forEach((d) => { const c = document.createElement('button'); c.type = 'button'; c.className = 'nx-chip' + (d === TC.cg.data ? ' is-on' : ''); c.textContent = TC.fdt(d).slice(0, 5); c.title = TC.dlabel(d); c.onclick = () => TC.cgSet(d, TC.cg.rota); box.append(c); });
});
dash.draw('cgCards', (box) => {
const rows = TC.cgRows(); box.replaceChildren(); if (!rows.length) return;
const a = TC.rsAgg(rows), ps = TC.psConta(rows);
const card = (h, v, sub) => { const c = document.createElement('div'); c.className = 'tc-card'; const t = document.createElement('h3'); t.textContent = h; const n = document.createElement('div'); n.className = 'tc-big'; n.textContent = v; c.append(t, n); if (sub) c.append(sub); box.append(c); };
card('Entregas', TC.fmt(a.entregas, 'int'));
card('Concluídas', TC.fmt(a.concluidas, 'int'), (() => { const d = document.createElement('div'); d.className = 'tc-sub'; d.textContent = TC.fmt(a.pct_concluidas, 'pct') + ' da carga'; return d; })());
const pr = document.createElement('div'); pr.className = 'nx-psrow'; TC.psRow(pr, ps); card('Pendentes', TC.fmt(a.pendentes, 'int'), a.pendentes ? pr : null);
card('Ocorrências', TC.fmt(a.ocorrencias, 'int'));
card('SLA janela', TC.fmt(a.sla_janela_pct, 'pct'));
card('On Time', TC.fmt(a.on_time_pct, 'pct'));
card('OTIF', TC.fmt(a.otif_pct, 'pct'));
card('Peso', TC.fmt(a.peso_entregue_kg, 'kg'));
});
dash.draw('cgTl', (ol) => {
const rows = TC.cgRows(); ol.replaceChildren(); if (!rows.length) return;
const r = rows[0], first = (f) => rows.map((x) => x[f]).filter(Boolean).sort()[0] || '', last = (f) => rows.map((x) => x[f]).filter(Boolean).sort().pop() || '';
const t = (x) => { if (!x) return null; const [d, h] = x.split(' '); const a = d.split('-').map(Number), b = (h || '00:00').split(':').map(Number); return new Date(a[0], a[1] - 1, a[2], b[0], b[1]).getTime() / 60000; };
const conc = rows.filter((x) => TC.isEnt(x)).length, fim = rows.every((x) => TC.isEnt(x)) || r.status_rota === 'Concluida';
const saida = TC.saidaReal(first('saida_cd')), sp = r.saida_prevista, ch1 = first('chegada_real'), fimU = last('fim_atend');
const atrS = saida && sp ? t(saida) - t(sp) : null;
const st = [
['Roteirizada', TC.dlabel(r.data), rows.length + ' entregas planejadas', true],
['Carregamento', TC.fdt(first('carregamento')), 'Depósito ' + (r.deposito || '—'), !!first('carregamento')],
['Saída do CD', TC.fdt(saida), (saida ? 'Início da rota ' + TC.fdt(first('saida_cd')).slice(11) + ' + 30 min · ' : '') + 'Prevista ' + TC.fdt(sp) + (atrS !== null ? ' · ' + (atrS > 0 ? 'atraso de ' + TC.fmin(atrS) : 'no horário') : ''), !!saida, atrS > 0 ? 'is-warn' : ''],
['Primeira chegada em cliente', TC.fdt(ch1), ch1 && saida ? 'Deslocamento: ' + TC.fmin(t(ch1) - t(saida)) : '', !!ch1],
[fim ? 'Carga finalizada' : 'Em andamento', fim ? TC.fdt(fimU) : conc + ' de ' + rows.length + ' entregas concluídas', fim && saida && fimU ? 'Duração desde a saída: ' + TC.fmin(t(fimU) - t(saida)) : (fimU ? 'Última finalização ' + TC.fdt(fimU) : ''), fim]
];
st.forEach(([n, v, sub, done, cls], i) => {
const li = document.createElement('li'); li.className = (done ? 'is-done ' : 'is-todo ') + (cls || '') + (i === st.length - 1 ? ' nx-last' : '');
const dot = document.createElement('span'); dot.className = 'nx-dot';
const d = document.createElement('div'); const a = document.createElement('div'); a.className = 'nx-st'; a.textContent = n; const b = document.createElement('div'); b.className = 'nx-t'; b.textContent = v || '—'; d.append(a, b);
if (sub) { const c = document.createElement('div'); c.className = 'tc-sub'; c.textContent = sub; d.append(c); }
li.append(dot, d); ol.append(li);
});
});
dash.draw('cgStops', (tb) => {
const rows = TC.cgRows();
tb.replaceChildren(...rows.map((r) => {
const tr = document.createElement('tr'); tr.dataset.key = encodeURIComponent(r.id); tr.tabIndex = 0;
const td = (x, c) => { const e = document.createElement('td'); if (c) e.className = c; if (x !== null) e.textContent = x; tr.append(e); return e; };
td(r.seq_planejada || '—', 'n'); td(+r.seq_realizada ? r.seq_realizada : '—', 'n'); td(r.codigo || '—'); td(r.cliente || '—');
const s = td(null); const b = document.createElement('span'); b.className = 'tc-badge ' + (TC.sitClass[TC.sitDe(r)] || 'tc-b-oth'); b.textContent = TC.sitDe(r) || '—'; s.append(b);
{ const pc = TC.pdCls(r); if (pc) s.append(' ', TC.psPill(pc, null, true)); }
td((r.cidade || '—') + '/' + (r.uf || '—'));
td(null).append(TC.dnBadge(r)); td(r.janela || '—'); TC.prevCell(td(null), r); td(TC.fdt(r.fim_atend));
td(r.sla_janela || '—'); td(r.ocorrencia || '—');
const go = () => {
const g = dash.data('clientes'); if (g.status !== 'ok' || !g.data.some((x) => x.codigo === r.codigo)) return;
document.querySelectorAll('#nx-cli-input').forEach((i) => { i.value = r.codigo; });
document.querySelectorAll('#cli-nao-achado,#cli-hint').forEach((e) => { e.hidden = true; });
document.querySelectorAll('#cli-conteudo').forEach((e) => { e.hidden = false; });
TC.cli = r.codigo; TC.ent = r.id; TC.cliRedraw(); TC.showTab('consulta-cliente');
};
tr.onclick = go; tr.onkeydown = (e) => { if (e.key === 'Enter') go(); };
return tr;
}));
});
