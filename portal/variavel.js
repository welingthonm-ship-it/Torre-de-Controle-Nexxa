(() => {
const W = window;
TC.VAR_PADRAO = {meta_app: 98.5, app_campo: 'app_baixa', meta_janela: 90, peso_janela: 50, lim_oc: 1, peso_oc: 50, pct_frete: 1.5, valor_frota: 1000, meta_sr: 8, meta_tr: 8, meta_outros: 26, bonus_oc0: 30, bonus_jan: 30, lim_jan_plus: 100, bonus_prod_lim: 26, bonus_prod: 30, peso_sab: 2, peso_dom: 3, feriados: ['2025-10-12', '2025-11-02', '2025-11-15', '2025-11-20', '2025-12-25', '2026-01-01', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25', '2027-01-01'], peso_prod: 50, tipos: ['Falta', 'Avaria'], frota: ['NFS', 'COMFRIO']};
// Faixas da frota: cada indicador paga uma parte do seu peso conforme a faixa atingida (f = fração do peso).
// Produtividade em cargas para a meta de 26 (proporcional para outros perfis e meta do mês): 15–17 = 20%, 18–22 = 35%, 23–26 = 50% do variável; acima da meta = plus.
TC.VAR_FAIXAS = {
  prod: [{min: 15, f: 0.4}, {min: 18, f: 0.7}, {min: 23, f: 1}],
  jan: [{min: 80, f: 0.4}, {min: 85, f: 0.7}, {min: 90, f: 1}],
  oc: [{max: 3, f: 0.4}, {max: 2, f: 0.7}, {max: 1, f: 1}]
};
TC.varFx = () => Object.assign({}, TC.VAR_FAIXAS, (TC.varCfg && TC.varCfg.faixas_frota) || {});
TC.varFxProd = (pontos, meta) => { const base = +TC.varCfg.meta_outros || 26, k = meta / (base || 1); let f = 0; TC.varFx().prod.forEach((x) => { if (pontos >= Math.round(x.min * k)) f = x.f; }); return f; };
TC.varFxJan = (jan) => { let f = 0; if (jan === null) return 0; TC.varFx().jan.forEach((x) => { if (jan >= x.min - 1e-9) f = x.f; }); return f; };
TC.varFxOc = (oc) => { let f = 0; if (oc === null) return 0; TC.varFx().oc.forEach((x) => { if (oc <= x.max + 1e-9) f = Math.max(f, x.f); }); return f; };
TC.varPesosFrota = () => { const C = TC.varCfg, pp = Math.min(100, Math.max(0, +C.peso_prod || 0)), r = 100 - pp, pj = +C.peso_janela || 0, po = +C.peso_oc || 0, t = pj + po || 1; return {prod: pp, jan: r * pj / t, oc: r * po / t}; };
TC.varFrota = (t) => { const u = String(t || '').toUpperCase(); return (TC.varCfg.frota || []).some((f) => u.includes(String(f).toUpperCase())); };
TC.varCfg = W.__nxVarCfg || Object.assign({}, TC.VAR_PADRAO);
TC.varF = W.__nxVarF = W.__nxVarF || {mes: null, busca: ''};
const F = TC.varF;
TC.varDraws = ['varXlsLista', 'varXlsListaF', 'varXlsBtn', 'varXlsBtnF', 'varMes', 'varPer', 'varCfg', 'varTipos', 'varSum', 'varTab', 'varDia', 'varDiaNome', 'varDiaSum'];
TC.varFrete = W.__nxVarFrete || {}; W.__nxVarFrete = TC.varFrete;
TC.varAbono = W.__nxVarAbono || {}; W.__nxVarAbono = TC.varAbono;
TC.varMotivos = {folga: 'Folga dada pela gerência', oficina: 'Oficina', coleta: 'Coleta', outro: 'Outro serviço'};
TC.varPerfil = (rota) => { const m = /^[A-Z]{2}([A-Z]{2})/.exec(String(rota || '').toUpperCase()); return m ? m[1] : '—'; };
TC.varMetaPerfil = (p) => { const C = TC.varCfg; return p === 'SR' ? +C.meta_sr : p === 'TR' ? +C.meta_tr : +C.meta_outros; };
TC.varFer = () => new Set(TC.varCfg.feriados || []);
TC.varPesoDia = (iso) => { const a = iso.split('-').map(Number), wd = new Date(a[0], a[1] - 1, a[2]).getDay(), C = TC.varCfg; return TC.varFer().has(iso) || wd === 0 ? (+C.peso_dom || 3) : wd === 6 ? (+C.peso_sab || 2) : 1; };
TC.varUteis = (mes, ate) => { const fer = TC.varFer(), [y, m] = mes.split('-').map(Number), n = new Date(y, m, 0).getDate(), out = []; for (let d = 1; d <= n; d++) { const iso = mes + '-' + String(d).padStart(2, '0'); if (ate && iso > ate) break; if (new Date(y, m - 1, d).getDay() !== 0 && !fer.has(iso)) out.push(iso); } return out; };
TC.varNome = (n) => String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(/\s+/).filter(Boolean).join(' ') || 'SEM MOTORISTA';
TC.varFid = (k) => String(k).replace(/[^A-Za-z0-9]/g, '_').slice(0, 180);
TC.varRedraw = () => { TC.varC = null; TC.varDraws.forEach((n) => dash.draw(n)); };
TC.varRedrawSafe = () => { const a = document.activeElement; if (a && a.classList && a.classList.contains('nx-var-frete')) { a.addEventListener('blur', () => setTimeout(TC.varRedrawSafe, 0), {once: true}); return; } TC.varRedraw(); };
const db = () => (W.claude && W.claude.use ? W.claude.use('db').catch(() => null) : Promise.resolve(null));
const ids = ['meta_app', 'app_campo', 'meta_janela', 'peso_janela', 'lim_oc', 'peso_oc', 'pct_frete', 'valor_frota', 'meta_sr', 'meta_tr', 'meta_outros', 'peso_prod', 'peso_sab', 'peso_dom', 'feriados', 'bonus_oc0', 'bonus_prod', 'bonus_jan', 'lim_jan_plus'];
TC.varForm = () => ids.forEach((k) => document.querySelectorAll('#var-' + k).forEach((e) => { if (document.activeElement !== e) e.value = k === 'feriados' ? (TC.varCfg.feriados || []).map((d) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4)).join(', ') : TC.varCfg[k]; }));
TC.varForm();
document.querySelectorAll('.var-busca').forEach((e) => { e.value = ''; e.oninput = () => { const tab = e.closest('.nx-tab'); F['busca_' + (tab ? tab.id : '')] = e.value; dash.draw('varTab'); }; });
const msg = (k) => ['var-msg-ok', 'var-msg-erro'].forEach((id) => document.querySelectorAll('#' + id).forEach((e) => { e.hidden = id !== k; }));
document.querySelectorAll('#var-salvar').forEach((b) => { b.onclick = async () => {
const c = {};
ids.forEach((k) => { const e = document.getElementById('var-' + k); if (!e) return; c[k] = k === 'app_campo' ? e.value : k === 'feriados' ? (e.value.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || []).map((x) => { const p = x.split('/'); return p[2] + '-' + p[1].padStart(2, '0') + '-' + p[0].padStart(2, '0'); }).sort() : Math.max(0, +String(e.value).replace(',', '.') || 0); });
c.frota = TC.varCfg.frota || TC.VAR_PADRAO.frota;
c.tipos = Array.from(new Set(['Falta'].concat(Array.from(document.querySelectorAll('#var-cfg input[data-tipo]')).filter((x) => x.checked).map((x) => x.dataset.tipo))));
c.em = new Date().toISOString();
b.disabled = true;
try { const d = await db(); if (!d) throw new Error('sem db'); await d.doc('config/variavel').set(c); msg('var-msg-ok'); }
catch (err) { msg('var-msg-erro'); }
b.disabled = false;
}; });
if (W.__nxVarUnsub) { try { W.__nxVarUnsub(); } catch (e) { /* segue */ } }
if (W.__nxVarFUnsub) { try { W.__nxVarFUnsub(); } catch (e) { /* segue */ } }
TC.varSalvaAbono = async (mes, key, dia, motivo) => {
const d = await db(); if (!d) throw new Error('sem db');
const all = JSON.parse(JSON.stringify(TC.varAbono[mes] || {})), id = TC.varFid(key), cur = all[id] || {};
if (motivo) cur[dia] = motivo; else delete cur[dia];
if (Object.keys(cur).length) all[id] = cur; else delete all[id];
await d.doc('variavel_abono/' + mes).set({mes, v: all, em: new Date().toISOString()});
};
TC.varSalvaFrete = async (mes, key, valor, inp) => {
const d = await db(); if (!d) throw new Error('sem db');
const cur = Object.assign({}, TC.varFrete[mes] || {});
if (valor > 0) cur[TC.varFid(key)] = valor; else delete cur[TC.varFid(key)];
await d.doc('variavel_frete/' + mes).set({mes, v: cur, em: new Date().toISOString()});
};
db().then((d) => {
if (!d) return;
if (W.__nxVarAUnsub) { try { W.__nxVarAUnsub(); } catch (e) { /* segue */ } }
W.__nxVarAUnsub = d.collection('variavel_abono').onSnapshot((snap) => {
Object.keys(TC.varAbono).forEach((k) => delete TC.varAbono[k]);
snap.docs.forEach((doc) => { const x = doc.data(); if (x && x.mes) TC.varAbono[x.mes] = x.v || {}; });
TC.varRedrawSafe();
}, () => {});
W.__nxVarFUnsub = d.collection('variavel_frete').onSnapshot((snap) => {
Object.keys(TC.varFrete).forEach((k) => delete TC.varFrete[k]);
snap.docs.forEach((doc) => { const x = doc.data(); if (x && x.mes) TC.varFrete[x.mes] = x.v || {}; });
TC.varRedrawSafe();
}, () => {});
W.__nxVarUnsub = d.doc('config/variavel').onSnapshot((snap) => {
TC.varCfg = W.__nxVarCfg = Object.assign({}, TC.VAR_PADRAO, snap.exists ? snap.data() : {});
TC.varForm(); TC.varRedraw();
}, () => {});
});
})();
TC.varMeses = () => {
const g = dash.data('entregas_cliente'); if (g.status !== 'ok') return [];
return Array.from(new Set(g.data.map((r) => String(r.data).slice(0, 7)).filter(Boolean))).sort().reverse();
};
TC.varCalc = () => {
const g = dash.data('entregas_cliente'); if (g.status !== 'ok') return null;
const ms = TC.varMeses(); const mes = TC.varF.mes && ms.includes(TC.varF.mes) ? TC.varF.mes : ms[0];
const C = TC.varCfg, FR = TC.varFrete[mes] || {}, AB = TC.varAbono[mes] || {}, key = JSON.stringify([mes, C, FR, AB]);
if (TC.varC && TC.varC.src === g.data && TC.varC.key === key) return TC.varC.v;
const tipos = new Set((C.tipos || []).concat(['Falta']));
const ultimo = g.data.reduce((a, r) => (String(r.data).slice(0, 7) === mes && r.data > a ? r.data : a), '');
const ag = (keyFn, base, frota) => {
const m = new Map();
g.data.forEach((r) => {
if (String(r.data).slice(0, 7) !== mes) return;
if (TC.varFrota(r.transportadora) !== !!frota) return;
const k = keyFn(r); let o = m.get(k);
if (!o) { o = Object.assign({ent: 0, app_s: 0, app_a: 0, jan_s: 0, jan_a: 0, ocn: 0}, base(r)); m.set(k, o); }
o.ent++;
if (o.placas && r.placa) o.placas.add(r.placa);
if (o.grafias) { o.grafias[r.motorista || ''] = (o.grafias[r.motorista || ''] || 0) + 1; o.frotas.add(/NFS/i.test(r.transportadora) ? 'NFS' : /COMFRIO/i.test(r.transportadora) ? 'Comfrio' : (r.transportadora || '—')); }
if (o.dias) o.dias.add(r.data);
if (o.cargas) { o.cargas.add(r.data + '|' + r.rota); const pf = TC.varPerfil(r.rota); o.perfis[pf] = (o.perfis[pf] || 0) + 1; }
const ap = r[C.app_campo || 'app_baixa']; if (ap === 'SIM') { o.app_s++; o.app_a++; } else if (ap === 'NÃO') o.app_a++;
if (r.sla_janela === 'SIM') { o.jan_s++; o.jan_a++; } else if (r.sla_janela === 'NÃO') o.jan_a++;
if (r.ocorrencia && tipos.has(r.ocorrencia)) o.ocn++;
});
return Array.from(m.values()).map((o) => {
const app = o.app_a ? 100 * o.app_s / o.app_a : null, jan = o.jan_a ? 100 * o.jan_s / o.jan_a : null, oc = o.ent ? 100 * o.ocn / o.ent : null;
const gat = app !== null && app >= C.meta_app;
const okJ = gat && jan !== null && jan >= C.meta_janela, okO = gat && oc !== null && oc <= C.lim_oc;
const oc0 = !!frota && okO && o.ocn === 0, fO = oc0 ? 1 + (+C.bonus_oc0 || 0) / 100 : 1;
let pct = gat ? (okJ ? C.peso_janela : 0) + (okO ? C.peso_oc * fO : 0) : 0, prod = null, okP = false;
if (frota) {
const w = TC.varPesosFrota();
o.nome = Object.entries(o.grafias).sort((a, b) => b[1] - a[1])[0][0] || 'Sem motorista informado';
o.transp = Array.from(o.frotas).sort().join(' + ');
o.perfil = Object.entries(o.perfis).sort((a, b) => b[1] - a[1])[0][0];
o.metaMes = TC.varMetaPerfil(o.perfil);
const total = TC.varUteis(mes).length, ate = TC.varUteis(mes, ultimo), ab = AB[TC.varFid(o.key)] || {};
o.abonos = ate.filter((dd) => ab[dd]).length;
o.meta = Math.round(o.metaMes * Math.max(0, ate.length - o.abonos) / (total || 1));
o.cUtil = 0; o.cSab = 0; o.cDom = 0;
Array.from(o.cargas).forEach((cg) => { const d = cg.slice(0, 10), a = d.split('-').map(Number), wd = new Date(a[0], a[1] - 1, a[2]).getDay(); if (TC.varFer().has(d) || wd === 0) o.cDom++; else if (wd === 6) o.cSab++; else o.cUtil++; });
const C2 = TC.varCfg; o.pontos = o.cUtil + o.cSab * (+C2.peso_sab || 2) + o.cDom * (+C2.peso_dom || 3);
prod = o.pontos; okP = gat && prod >= o.meta;
o.prodPlus = okP && prod > o.meta;
o.janPlus = okJ && jan !== null && jan >= (+C.lim_jan_plus || 100) - 1e-9;
// faixas: fração do peso de cada indicador (o plus vale só para quem bate a meta cheia)
o.fxP = !gat ? 0 : o.prodPlus ? 1 + (+C.bonus_prod || 0) / 100 : TC.varFxProd(prod, o.meta);
o.fxJ = !gat ? 0 : o.janPlus ? 1 + (+C.bonus_jan || 0) / 100 : TC.varFxJan(jan);
o.fxO = !gat ? 0 : oc0 ? 1 + (+C.bonus_oc0 || 0) / 100 : TC.varFxOc(oc);
o.pctP = w.prod * o.fxP; o.pctJ = w.jan * o.fxJ; o.pctO = w.oc * o.fxO;
pct = o.pctP + o.pctJ + o.pctO;
}
return Object.assign(o, {app, jan, oc, gat, okJ, okO, oc0, okP, prod, pct: Math.round(pct * 10) / 10});
});
};
const v = {
mes,
transp: ag((r) => r.transportadora || 'Sem transportadora', (r) => ({nome: r.transportadora || 'Sem transportadora'})),
mot: ag((r) => (r.motorista || 'Sem motorista') + '|' + (r.transportadora || ''), (r) => ({nome: r.motorista || 'Sem motorista informado', transp: r.transportadora || '—', key: (r.motorista || 'Sem motorista') + '|' + (r.transportadora || '')})).map((o) => Object.assign(o, {bonus: (+C.pct_frete || 0) * o.pct / 100})),
frota: ag((r) => 'F|' + TC.varNome(r.motorista), (r) => ({nome: r.motorista || 'Sem motorista informado', transp: r.transportadora || '—', placas: new Set(), dias: new Set(), cargas: new Set(), perfis: {}, grafias: {}, frotas: new Set(), key: 'F|' + TC.varNome(r.motorista)}), true).map((o) => Object.assign(o, {valor: (C.valor_frota || 0) * o.pct / 100}))
};
v.transp.forEach((t) => { const ms = v.mot.filter((m) => m.transp === t.nome), se = ms.reduce((a, m) => a + m.ent, 0); t.nmot = ms.length; t.nbon = ms.filter((m) => m.pct > 0).length; t.ncheio = ms.filter((m) => m.pct >= 100).length; t.pct = se ? Math.round(ms.reduce((a, m) => a + m.pct * m.ent, 0) / se * 10) / 10 : 0; t.bonus = (+C.pct_frete || 0) * t.pct / 100; });
const ord = (a, b) => (b.pct - a.pct) || (b.ent - a.ent) || (a.nome < b.nome ? -1 : 1);
v.transp.sort((a, b) => (b.pct - a.pct) || (b.ent - a.ent)); v.mot.sort(ord); v.frota.sort(ord);
TC.varC = {src: g.data, key, v};
return v;
};
TC.varP = (n, d) => (n === null || n === undefined ? '—' : d3.format('.' + (d == null ? 1 : d) + 'f')(n).replace('.', ',') + '%');
TC.varR = (n) => 'R$ ' + d3.format(',.2f')(n || 0).replace(/,/g, '#').replace('.', ',').replace(/#/g, '.');
dash.draw('varMes', (sel) => {
const ms = TC.varMeses(); const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
sel.replaceChildren(...ms.map((m) => { const o = document.createElement('option'); o.value = m; o.textContent = nomes[+m.slice(5, 7) - 1] + '/' + m.slice(0, 4); return o; }));
const c = TC.varCalc(); if (c) sel.value = c.mes;
sel.onchange = () => { TC.varF.mes = sel.value; TC.varRedraw(); };
});
dash.draw('varPer', (el) => {
const g = dash.data('entregas_cliente'), c = TC.varCalc(); if (!c || g.status !== 'ok') { el.textContent = '—'; return; }
const ds = g.data.map((r) => r.data).filter((d) => String(d).slice(0, 7) === c.mes).sort();
el.textContent = ds.length ? 'Rotas de ' + TC.fdt(ds[0]) + ' a ' + TC.fdt(ds[ds.length - 1]) + ' no relatório' : '—';
});
dash.draw('varCfg', (el) => {
const C = TC.varCfg, k = el.dataset.k;
if (k === 'fpeso_prod' || k === 'fpeso_janela' || k === 'fpeso_oc') { const w = TC.varPesosFrota(); el.textContent = TC.varP(k === 'fpeso_prod' ? w.prod : k === 'fpeso_janela' ? w.jan : w.oc, 0); return; }
if (k === 'fx_prod') { const F = TC.varFx().prod, w = TC.varPesosFrota(); el.textContent = F.map((x, i) => x.min + (F[i + 1] ? '–' + (F[i + 1].min - 1) : '–' + (+C.meta_outros || 26)) + ' = ' + TC.varP(w.prod * x.f, 0)).join(' · ') + ' · acima de ' + (+C.meta_outros || 26) + ' = ' + TC.varP(w.prod * (1 + (+C.bonus_prod || 0) / 100), 0); return; }
if (k === 'fx_jan') { const F = TC.varFx().jan, w = TC.varPesosFrota(); el.textContent = F.map((x) => '≥ ' + x.min + '% = ' + TC.varP(w.jan * x.f, 1)).join(' · ') + ' · 100% = ' + TC.varP(w.jan * (1 + (+C.bonus_jan || 0) / 100), 1); return; }
if (k === 'fx_oc') { const F = TC.varFx().oc, w = TC.varPesosFrota(); el.textContent = F.map((x) => '≤ ' + x.max + '% = ' + TC.varP(w.oc * x.f, 1)).join(' · ') + ' · zero = ' + TC.varP(w.oc * (1 + (+C.bonus_oc0 || 0) / 100), 1); return; }
if (k === 'metas_prod') { el.textContent = 'SR ' + (+C.meta_sr) + ' · TR ' + (+C.meta_tr) + ' · demais ' + (+C.meta_outros); return; }
if (k === 'pct_frete') { el.textContent = TC.varP(C.pct_frete, 1); return; }
if (k === 'bonus_prod_txt') { el.textContent = 'superando a meta de cargas: +' + TC.varP(C.bonus_prod, 0); return; }
if (k === 'bonus_jan_txt') { el.textContent = (+C.lim_jan_plus >= 100 ? 'zero atraso (100% sem atraso)' : 'a partir de ' + TC.varP(C.lim_jan_plus, 1) + ' sem atraso') + ': +' + TC.varP(C.bonus_jan, 0); return; }
if (k === 'bonus_oc0') { el.textContent = TC.varP(C.bonus_oc0, 0); return; }
if (k === 'valor_frota') { el.textContent = TC.varR(C.valor_frota); return; }
if (k === 'tipos') { el.textContent = Array.from(new Set(['Falta'].concat(C.tipos || []))).join(', '); return; }
el.textContent = k === 'frota' ? (C.frota || []).map((f) => f.charAt(0) + f.slice(1).toLowerCase()).join(' e ').replace('Nfs', 'NFS') : k === 'tipos' ? ((C.tipos || []).join(', ') || 'nenhum') : k.startsWith('peso') ? TC.varP(C[k], 0) : TC.varP(C[k], 1);
});
dash.draw('varTipos', (box) => {
const g = dash.data('entregas_cliente'); box.replaceChildren(); if (g.status !== 'ok') return;
const ts = Array.from(new Set(g.data.map((r) => r.ocorrencia).filter(Boolean))).sort();
box.append(...ts.map((t) => { const l = document.createElement('label'); const c = document.createElement('input'); c.type = 'checkbox'; c.dataset.tipo = t; c.checked = t === 'Falta' || (TC.varCfg.tipos || []).includes(t); if (t === 'Falta') { c.disabled = true; l.title = 'Falta é sempre responsabilidade do transportador'; } l.append(c, ' ' + t + (t === 'Falta' ? ' (sempre)' : '')); return l; }));
});
dash.draw('varSum', (box) => {
const c = TC.varCalc(); box.replaceChildren(); if (!c) return;
const L = c[box.dataset.k], tot = L.reduce((a, o) => a + o.valor, 0);
const item = (t, v) => { const s = document.createElement('span'); s.append(t + ' '); const b = document.createElement('b'); b.textContent = v; s.append(b); box.append(s); };
if (box.dataset.k === 'frota') item('Participantes', TC.fmt(L.length, 'int'));
if (box.dataset.k !== 'frota') { item(box.dataset.k === 'transp' ? 'Transportadoras' : 'Motoristas', TC.fmt(L.length, 'int')); if (box.dataset.k === 'transp') { item('Motoristas com bônus', TC.fmt(L.reduce((a, o) => a + o.nbon, 0), 'int') + ' de ' + TC.fmt(L.reduce((a, o) => a + o.nmot, 0), 'int')); item('Com bônus em pelo menos um motorista', TC.fmt(L.filter((o) => o.nbon > 0).length, 'int')); return; }
item('Sem gatilho (app abaixo da meta)', TC.fmt(L.filter((o) => !o.gat).length, 'int')); item('Bônus cheio (' + TC.varP(TC.varCfg.pct_frete, 2) + ')', TC.fmt(L.filter((o) => o.pct >= 100).length, 'int')); item('Bônus parcial', TC.fmt(L.filter((o) => o.pct > 0 && o.pct < 100).length, 'int')); return; }
item('Sem gatilho (app abaixo da meta)', TC.fmt(L.filter((o) => !o.gat).length, 'int'));
item('100% ou mais do variável', TC.fmt(L.filter((o) => o.pct >= 100).length, 'int'));
item('Com bônus de zero ocorrência', TC.fmt(L.filter((o) => o.oc0).length, 'int'));
if (box.dataset.k === 'frota') { item('Com bônus de produtividade', TC.fmt(L.filter((o) => o.prodPlus).length, 'int')); item('Com bônus de zero atraso', TC.fmt(L.filter((o) => o.janPlus).length, 'int')); }
item('Parcial', TC.fmt(L.filter((o) => o.pct > 0 && o.pct < 100).length, 'int'));
item('Total a pagar', TC.varR(tot));
});
dash.draw('varTab', (tb) => {
const c = TC.varCalc(); if (!c) { tb.replaceChildren(); return; }
const k = tb.dataset.k, mot = k === 'mot', fr = k === 'frota', tab = tb.closest('.nx-tab'), bq = TC.varF['busca_' + (tab ? tab.id : '')] || '';
const nz = (t) => (TC.pdNorm ? TC.pdNorm(t) : String(t).toLowerCase()), q = nz(bq);
const L = c[k].filter((o) => !q || nz(o.nome + ' ' + (o.transp || '') + ' ' + (o.placas ? Array.from(o.placas).join(' ') : '')).includes(q));
const C = TC.varCfg;
tb.replaceChildren(...L.map((o) => {
const tr = document.createElement('tr'); tr.dataset.key = encodeURIComponent(o.nome + '|' + (o.transp || ''));
const td = (t, cl) => { const x = document.createElement('td'); if (cl) x.className = cl; if (t !== null) x.textContent = t; tr.append(x); return x; };
td(o.nome); if (mot) td(o.transp); if (fr) { td(Array.from(o.placas || []).sort().join(', ') || '—'); td(o.transp); td(o.perfil || '—'); }
td(TC.fmt(o.ent, 'int'), 'n');
if (k === 'transp' || mot) {
if (k === 'transp') td(TC.fmt(o.nmot || 0, 'int'), 'n');
td(TC.varP(o.app), 'n ' + (k === 'transp' ? '' : (o.gat ? 'nx-var-ok' : 'nx-var-no')));
if (k === 'transp') { const g2 = td(o.nbon + ' de ' + o.nmot, 'n ' + (o.nbon ? 'nx-var-ok' : 'nx-var-no')); g2.title = o.ncheio + ' com bônus cheio'; } else td(o.gat ? '✔ atingido' : '✘ zerado', o.gat ? 'nx-var-ok' : 'nx-var-no');
const neutro = k === 'transp' ? '' : null;
td(TC.varP(o.jan), 'n ' + (neutro !== null ? '' : (o.jan !== null && o.jan >= C.meta_janela ? 'nx-var-ok' : 'nx-var-no')));
td(TC.varP(o.oc, 2) + ' (' + o.ocn + ')', 'n ' + (neutro !== null ? '' : (o.oc !== null && o.oc <= C.lim_oc ? 'nx-var-ok' : 'nx-var-no')));
const pc = td(null, 'n'); const b = document.createElement('span'); b.className = 'nx-var-pct ' + (o.pct >= 100 ? 'nx-var-p100' : o.pct > 0 ? 'nx-var-p50' : 'nx-var-p0'); b.textContent = TC.varP(o.pct, 0); pc.append(b);
const bc = td(TC.varP(o.bonus, 2), 'n'); bc.style.fontWeight = '600';
if (k === 'transp') { const xc = td(null); if (TC.varPodeBaixar) { const xb = document.createElement('button'); xb.type = 'button'; xb.className = 'nx-chip'; xb.textContent = '⬇ Excel'; xb.title = 'Baixar a apuração desta transportadora em Excel'; xb.onclick = (e) => { e.stopPropagation(); TC.varBaixar([o.nome], xb); }; xc.append(xb); } }
return tr;
}
if (fr) {
td(TC.fmt(o.cUtil, 'int'), 'n'); td(o.cSab ? TC.fmt(o.cSab, 'int') : '—', 'n'); td(o.cDom ? TC.fmt(o.cDom, 'int') : '—', 'n');
{ const cc = td(TC.fmt(o.pontos, 'int'), 'n ' + (o.pontos >= o.meta ? 'nx-var-ok' : o.fxP > 0 ? 'nx-var-mid' : 'nx-var-no')); cc.textContent += ' · ' + TC.varP(o.pctP, 0) + (o.prodPlus ? ' ★' : '');
cc.title = 'Faixa de produtividade: ' + TC.varP(o.pctP, 1) + ' do variável. ' + (o.prodPlus ? 'Superou a meta de ' + o.meta + ': peso da produtividade +' + (+C.bonus_prod || 0) + '%. ' : '') + o.cUtil + ' + ' + o.cSab + ' × ' + (+C.peso_sab || 2) + ' + ' + o.cDom + ' × ' + (+C.peso_dom || 3) + ' = ' + o.pontos; cc.style.fontWeight = '600'; }
const mt = td(TC.fmt(o.meta, 'int'), 'n'); mt.title = 'Meta do mês para o perfil ' + o.perfil + ': ' + o.metaMes + ' cargas; proporcional aos dias úteis até o último dia do relatório' + (o.abonos ? ', descontando ' + o.abonos + ' dia(s) abonado(s)' : '');
td(o.abonos ? TC.fmt(o.abonos, 'int') : '—', 'n');
tr.classList.add('nx-var-click'); if (TC.varF.dia === o.key) tr.classList.add('nx-var-sel');
tr.tabIndex = 0; const abre = () => { TC.varF.dia = o.key; document.querySelectorAll('#var-dia').forEach((e) => { e.hidden = false; }); ['varTab', 'varDia', 'varDiaNome', 'varDiaSum'].forEach((n) => dash.draw(n)); const sec = document.getElementById('var-dia'); if (sec) sec.scrollIntoView({block: 'nearest', behavior: 'smooth'}); };
tr.onclick = abre; tr.onkeydown = (e) => { if (e.key === 'Enter') abre(); };
}
td(TC.varP(o.app), 'n ' + (o.gat ? 'nx-var-ok' : 'nx-var-no'));
td(o.gat ? '✔ atingido' : '✘ zerado', o.gat ? 'nx-var-ok' : 'nx-var-no');
{ const jc = td(TC.varP(o.jan) + (o.janPlus ? ' ★ +' + (+C.bonus_jan || 0) + '%' : ''), 'n ' + (o.jan !== null && o.jan >= C.meta_janela ? 'nx-var-ok' : 'nx-var-no')); if (o.janPlus) jc.title = 'Sem nenhum atraso: o peso deste indicador ganha +' + (+C.bonus_jan || 0) + '%'; }
{ const x = td(TC.varP(o.oc, 2) + ' (' + o.ocn + ')' + (o.oc0 ? ' ★ +' + (+C.bonus_oc0 || 0) + '%' : ''), 'n ' + (o.oc !== null && o.oc <= C.lim_oc ? 'nx-var-ok' : 'nx-var-no')); if (o.oc0) x.title = 'Zero ocorrência: o peso deste indicador ganha +' + (+C.bonus_oc0 || 0) + '%'; }
const pc = td(null, 'n'); const b = document.createElement('span'); b.className = 'nx-var-pct ' + (o.pct > 100 ? 'nx-var-p100 nx-var-plus' : o.pct >= 100 ? 'nx-var-p100' : o.pct > 0 ? 'nx-var-p50' : 'nx-var-p0'); b.textContent = TC.varP(o.pct, 0); pc.append(b);
td(TC.varR(o.valor), 'n');
return tr;
}));
});
TC.varDiaSel = () => { const c = TC.varCalc(); if (!c || !TC.varF.dia) return null; return {c, o: c.frota.find((x) => x.key === TC.varF.dia) || null}; };
dash.draw('varDiaNome', (el) => { const s = TC.varDiaSel(); el.textContent = s && s.o ? s.o.nome + ' (' + s.o.perfil + ')' : '—'; });
dash.draw('varDiaSum', (box) => {
const s = TC.varDiaSel(); box.replaceChildren(); if (!s || !s.o) return;
const o = s.o, item = (t, v) => { const sp = document.createElement('span'); sp.append(t + ' '); const b = document.createElement('b'); b.textContent = v; sp.append(b); box.append(sp); };
item('Cargas em dias úteis', TC.fmt(o.cUtil, 'int'));
item('Sábados', TC.fmt(o.cSab, 'int') + ' (×' + (+TC.varCfg.peso_sab || 2) + ')');
item('Domingos e feriados', TC.fmt(o.cDom, 'int') + ' (×' + (+TC.varCfg.peso_dom || 3) + ')');
item('Total com peso', TC.fmt(o.pontos, 'int'));
item('Meta do perfil ' + o.perfil, TC.fmt(o.metaMes, 'int') + ' no mês');
item('Meta considerada', TC.fmt(o.meta, 'int'));
item('Dias abonados', TC.fmt(o.abonos, 'int'));
item('Produtividade', TC.varP(o.pctP || 0, 1) + ' do variável' + (o.prodPlus ? ' (plus)' : o.okP ? ' (meta cheia)' : o.fxP > 0 ? ' (faixa parcial)' : ' (abaixo da 1ª faixa)'));
});
dash.draw('varDia', (box) => {
const s = TC.varDiaSel(); box.replaceChildren();
document.querySelectorAll('#var-dia').forEach((e) => { e.hidden = !(s && s.o); });
if (!s || !s.o) return;
const g = dash.data('entregas_cliente'), o = s.o, mes = s.c.mes;
const porDia = {};
g.data.forEach((r) => { if (String(r.data).slice(0, 7) === mes && TC.varFrota(r.transportadora) && 'F|' + TC.varNome(r.motorista) === o.key) { (porDia[r.data] = porDia[r.data] || new Set()).add(r.rota); } });
const ultimo = g.data.reduce((a, r) => (String(r.data).slice(0, 7) === mes && r.data > a ? r.data : a), '');
const ab = (TC.varAbono[mes] || {})[TC.varFid(o.key)] || {};
const [y, m] = mes.split('-').map(Number), n = new Date(y, m, 0).getDate(), sem = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
for (let d = 1; d <= n; d++) {
const iso = mes + '-' + String(d).padStart(2, '0'); if (ultimo && iso > ultimo) break;
const wd = new Date(y, m - 1, d).getDay(), rs = porDia[iso];
const fer = TC.varFer().has(iso), pw = TC.varPesoDia(iso);
const c = document.createElement('div'); c.className = 'nx-var-d ' + (rs ? 'is-carga' : ab[iso] ? 'is-abono' : (wd === 0 || fer) ? 'is-dom' : 'is-vazio');
const t = document.createElement('b'); t.textContent = String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + ' ' + sem[wd]; c.append(t);
const info = document.createElement('div');
if (rs) info.textContent = rs.size + (rs.size === 1 ? ' carga: ' : ' cargas: ') + Array.from(rs).sort().join(', ') + (pw > 1 ? ' · vale ×' + pw + ' (' + (fer ? 'feriado' : wd === 0 ? 'domingo' : 'sábado') + ')' : '');
else if (wd === 0 || fer) info.textContent = (fer ? 'Feriado' : 'Domingo') + ' (fora da meta)';
else info.textContent = ab[iso] ? 'Abonado: ' + (TC.varMotivos[ab[iso]] || ab[iso]) : 'Sem carga';
c.append(info);
if (!rs && wd !== 0 && !fer && TC.alPode) {
const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Abono do dia ' + iso);
[['', 'Não abonar'], ...Object.entries(TC.varMotivos)].forEach(([v, l]) => { const op = document.createElement('option'); op.value = v; op.textContent = l; sel.append(op); });
sel.value = ab[iso] || '';
sel.onchange = async () => { sel.disabled = true; try { await TC.varSalvaAbono(mes, o.key, iso, sel.value); document.querySelectorAll('#var-dia-erro').forEach((e) => { e.hidden = true; }); } catch (e) { document.querySelectorAll('#var-dia-erro').forEach((x) => { x.hidden = false; }); } sel.disabled = false; };
c.append(sel);
}
box.append(c);
}
});

// Gerador mínimo de .xlsx (zip sem compressão), sem bibliotecas.
TC.xlsx = (() => {
const enc = new TextEncoder();
const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const zip = (files) => {
const parts = [], cen = []; let off = 0;
files.forEach(([name, txt]) => {
const nb = enc.encode(name), db = enc.encode(txt), c = crc(db);
const h = new DataView(new ArrayBuffer(30));
h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
h.setUint32(14, c, true); h.setUint32(18, db.length, true); h.setUint32(22, db.length, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
parts.push(new Uint8Array(h.buffer), nb, db);
const d = new DataView(new ArrayBuffer(46));
d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x0800, true); d.setUint16(10, 0, true); d.setUint16(12, 0, true); d.setUint16(14, 0x21, true);
d.setUint32(16, c, true); d.setUint32(20, db.length, true); d.setUint32(24, db.length, true); d.setUint16(28, nb.length, true); d.setUint32(42, off, true);
cen.push(new Uint8Array(d.buffer), nb);
off += 30 + nb.length + db.length;
});
const cl = cen.reduce((a, x) => a + x.length, 0);
const e = new DataView(new ArrayBuffer(22));
e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cl, true); e.setUint32(16, off, true);
return new Blob([...parts, ...cen, new Uint8Array(e.buffer)]);
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const col = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
// rows: arrays of cells; cell = string | number | null | {v, s} (s: 'b' negrito, 'p' percentual, 'bp', 't' título)
const sheetXml = (rows, widths) => {
const st = {b: 1, p: 2, t: 3, h: 4, n: 5};
const out = rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((c, ci) => {
if (c === null || c === undefined || c === '') return '';
const o = typeof c === 'object' ? c : {v: c}, ref = col(ci) + (ri + 1), s = o.s ? ' s="' + st[o.s] + '"' : '';
if (typeof o.v === 'number' && isFinite(o.v)) return '<c r="' + ref + '"' + s + '><v>' + o.v + '</v></c>';
return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + esc(o.v) + '</t></is></c>';
}).join('') + '</row>').join('');
const cols = widths ? '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' : '';
return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + cols + '<sheetData>' + out + '</sheetData></worksheet>';
};
const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.00%"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3F4EA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
// sheets: [{name, rows, widths}]
return (sheets) => zip([
['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>'],
['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => '<sheet name="' + esc(String(s.name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>'],
['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
['xl/styles.xml', styles],
...sheets.map((s, i) => ['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(s.rows, s.widths)])
]);
})();
TC.varMesNome = (mes) => ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][+mes.slice(5, 7) - 1];
TC.varXlsTransp = (nomes) => {
const c = TC.varCalc(); if (!c) return null;
const C = TC.varCfg, mesN = TC.varMesNome(c.mes), ano = c.mes.slice(0, 4), f = (x) => (x === null || x === undefined ? '' : x / 100);
const nb = (x) => String(x).replace('.', ',');
const regra = 'Gatilho: uso do app ≥ ' + nb(C.meta_app) + '% · Sem atraso ≥ ' + nb(C.meta_janela) + '% (peso ' + nb(C.peso_janela) + '%) · Ocorrências culpa do transportador ≤ ' + nb(C.lim_oc) + '% (peso ' + nb(C.peso_oc) + '%; tipos: ' + Array.from(new Set(['Falta'].concat(C.tipos || []))).join(', ') + ') · Bônus máximo ' + nb(C.pct_frete) + '% sobre o frete' + ' · Faixas (frota): produtividade ' + TC.varFx().prod.map((x) => x.min + '+ cargas ' + nb(w.prod * x.f) + '%').join(', ') + '; sem atraso ' + TC.varFx().jan.map((x) => '≥' + x.min + '% ' + nb(w.jan * x.f) + '%').join(', ') + '; ocorrências ' + TC.varFx().oc.map((x) => '≤' + x.max + '% ' + nb(w.oc * x.f) + '%').join(', ');
const obsP = 'O bônus é pago individualmente a cada motorista. A linha da transportadora é a média ponderada pelas entregas de cada motorista.';
const quando = 'Apurado pelo portal Torre de Controle em ' + new Date().toLocaleString('pt-BR');
const hT = ['Transportadora', 'Entregas', 'Motoristas', 'Uso do app', 'Motoristas com bônus', 'Sem atraso', 'Ocorrências (qtd)', 'Ocorrências (%)', '% atingido (ponderado)', 'Bônus ponderado sobre o frete'].map((v) => ({v, s: 'h'}));
const hM = ['Motorista', 'Transportadora', 'Entregas', 'Uso do app', 'Gatilho', 'Sem atraso', 'Ocorrências (qtd)', 'Ocorrências (%)', '% atingido', 'Bônus sobre o frete'].map((v) => ({v, s: 'h'}));
const linT = (o) => [o.nome, {v: o.ent, s: 'n'}, {v: o.nmot, s: 'n'}, {v: f(o.app), s: 'p'}, o.nbon + ' de ' + o.nmot, {v: f(o.jan), s: 'p'}, {v: o.ocn, s: 'n'}, {v: f(o.oc), s: 'p'}, {v: o.pct / 100, s: 'p'}, {v: o.bonus / 100, s: 'p'}];
const linM = (o) => [o.nome, o.transp, {v: o.ent, s: 'n'}, {v: f(o.app), s: 'p'}, o.gat ? 'Atingido' : 'Zerado', {v: f(o.jan), s: 'p'}, {v: o.ocn, s: 'n'}, {v: f(o.oc), s: 'p'}, {v: o.pct / 100, s: 'p'}, {v: o.bonus / 100, s: 'p'}];
const W = [34, 26, 11, 12, 11, 12, 16, 15, 12, 18];
const ts = c.transp.filter((t) => !nomes || nomes.includes(t.nome));
const folha = (t) => {
const ms = c.mot.filter((m) => m.transp === t.nome).sort((a, b) => (b.pct - a.pct) || (b.ent - a.ent) || (a.nome < b.nome ? -1 : 1));
return {name: t.nome, widths: W, rows: [[{v: 'Variável Transportadoras — ' + t.nome + ' — ' + mesN + '/' + ano, s: 't'}], [regra], [obsP], [quando], [], hT, linT(t), [], [{v: 'Motoristas da transportadora (' + ms.length + ')', s: 'b'}], hM, ...ms.map(linM)]};
};
const sheets = [];
if (ts.length > 1) sheets.push({name: 'Resumo', widths: W, rows: [[{v: 'Variável Transportadoras — ' + mesN + '/' + ano, s: 't'}], [regra], [obsP], [quando], [], hT, ...ts.map(linT)]});
const usados = {};
ts.forEach((t) => { const fl = folha(t); let n = String(t.nome).replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim() || 'Transportadora'; while (usados[n.toUpperCase()]) n = n.slice(0, 26) + ' ' + (Object.keys(usados).length + 1); usados[n.toUpperCase()] = 1; fl.name = n; sheets.push(fl); });
return {blob: TC.xlsx(sheets), mesN};
};
TC.varBaixar = async (nomes, btn) => {
const dl = await (window.claude && window.claude.use ? window.claude.use('downloads').catch(() => null) : null);
if (!dl) { if (btn) btn.title = 'Download indisponível nesta visualização'; return; }
const c = TC.varCalc(); if (!c) return;
const lista = nomes && nomes.length ? nomes : null;
const x = TC.varXlsTransp(lista); if (!x) return;
const so = lista && lista.length === 1 ? lista[0] + ' ' : '';
const nome = ('Variavel Transportadoras ' + so + x.mesN + '.xlsx').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ');
if (btn) btn.disabled = true;
try { await dl.save({filename: nome, data: x.blob}); } catch (e) { if (btn) btn.title = e && e.code === 'declined' ? 'Download cancelado' : 'Não foi possível baixar'; }
if (btn) btn.disabled = false;
};
TC.varSel = window.__nxVarSel = window.__nxVarSel || new Set();
dash.draw('varXlsLista', (box) => {
const c = TC.varCalc(); box.replaceChildren(); if (!c) return;
const nomes = c.transp.map((t) => t.nome);
Array.from(TC.varSel).forEach((n) => { if (!nomes.includes(n)) TC.varSel.delete(n); });
const upd = () => dash.draw('varXlsBtn');
const all = document.createElement('label'); all.className = 'nx-var-xall';
const ca = document.createElement('input'); ca.type = 'checkbox'; ca.checked = TC.varSel.size === nomes.length && nomes.length > 0;
all.append(ca, ' Selecionar todas');
const itens = c.transp.map((t) => {
const l = document.createElement('label'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = TC.varSel.has(t.nome);
cb.onchange = () => { if (cb.checked) TC.varSel.add(t.nome); else TC.varSel.delete(t.nome); ca.checked = TC.varSel.size === nomes.length; upd(); };
l.append(cb, ' ' + t.nome + ' (' + t.nmot + ' mot. · ' + TC.varP(t.bonus, 2) + ')'); return l;
});
ca.onchange = () => { TC.varSel.clear(); if (ca.checked) nomes.forEach((n) => TC.varSel.add(n)); itens.forEach((l) => { l.firstChild.checked = ca.checked; }); upd(); };
box.append(all, ...itens);
});
dash.draw('varXlsBtn', (el) => { const n = TC.varSel.size; el.textContent = n === 0 ? 'todas' : n === 1 ? Array.from(TC.varSel)[0] : 'das ' + n + ' selecionadas'; });

(() => {
const W = window;
const dl = W.claude && W.claude.use ? W.claude.use('downloads').catch(() => null) : Promise.resolve(null);
dl.then((d) => { TC.varPodeBaixar = !!d; document.querySelectorAll('.nx-var-xls').forEach((b) => { b.hidden = !d; }); dash.draw('varTab'); });
document.querySelectorAll('#var-xls-baixar').forEach((b) => { b.onclick = () => TC.varBaixar(Array.from(TC.varSel), b); });
})();
TC.varSelF = window.__nxVarSelF = window.__nxVarSelF || new Set();
dash.draw('varXlsListaF', (box) => {
const c = TC.varCalc(); box.replaceChildren(); if (!c) return;
const keys = c.frota.map((o) => o.key);
Array.from(TC.varSelF).forEach((k) => { if (!keys.includes(k)) TC.varSelF.delete(k); });
const upd = () => dash.draw('varXlsBtnF');
const all = document.createElement('label'); all.className = 'nx-var-xall';
const ca = document.createElement('input'); ca.type = 'checkbox'; ca.checked = TC.varSelF.size === keys.length && keys.length > 0;
all.append(ca, ' Selecionar todos');
const itens = c.frota.map((o) => {
const l = document.createElement('label'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = TC.varSelF.has(o.key);
cb.onchange = () => { if (cb.checked) TC.varSelF.add(o.key); else TC.varSelF.delete(o.key); ca.checked = TC.varSelF.size === keys.length; upd(); };
l.append(cb, ' ' + o.nome + ' (' + o.transp + ' · ' + TC.varP(o.pct, 1).replace(',0%', '%') + ')'); return l;
});
ca.onchange = () => { TC.varSelF.clear(); if (ca.checked) keys.forEach((k) => TC.varSelF.add(k)); itens.forEach((l) => { l.firstChild.checked = ca.checked; }); upd(); };
box.append(all, ...itens);
});
dash.draw('varXlsBtnF', (el) => { const c = TC.varCalc(), n = TC.varSelF.size; el.textContent = n === 0 ? 'todos' : n === 1 ? ((c && c.frota.find((o) => TC.varSelF.has(o.key))) || {nome: '1 motorista'}).nome : 'dos ' + n + ' selecionados'; });
TC.varXlsFrota = (keys) => {
const c = TC.varCalc(); if (!c) return null;
const C = TC.varCfg, mesN = TC.varMesNome(c.mes), ano = c.mes.slice(0, 4), f = (x) => (x === null || x === undefined ? '' : x / 100), nb = (x) => String(x).replace('.', ',');
const w = TC.varPesosFrota();
const regra = 'Gatilho: uso do app ≥ ' + nb(C.meta_app) + '% · Produtividade (peso ' + nb(w.prod) + '%): meta SR ' + C.meta_sr + ' / TR ' + C.meta_tr + ' / demais ' + C.meta_outros + ' cargas no mês, sábado ×' + C.peso_sab + ', domingo e feriado ×' + C.peso_dom + ', +' + C.bonus_prod + '% ao superar a meta · Sem atraso ≥ ' + nb(C.meta_janela) + '% (peso ' + nb(w.jan) + '%) · Ocorrências ≤ ' + nb(C.lim_oc) + '% (peso ' + nb(w.oc) + '%, +' + C.bonus_oc0 + '% com zero ocorrência) · Valor: até ' + TC.varR(C.valor_frota) + ' por motorista';
const ms = c.frota.filter((o) => !keys || !keys.length || keys.includes(o.key));
const h = ['Motorista', 'Frota', 'Placas', 'Perfil', 'Entregas', 'Cargas dias úteis', 'Cargas sábado', 'Cargas dom./feriado', 'Total com peso', 'Meta de cargas', 'Dias abonados', 'Uso do app', 'Gatilho', 'Sem atraso', 'Ocorrências (qtd)', 'Ocorrências (%)', '% atingido', 'Valor a pagar (R$)'].map((v) => ({v, s: 'h'}));
const lin = (o) => [o.nome, o.transp, Array.from(o.placas).sort().join(', '), o.perfil, {v: o.ent, s: 'n'}, {v: o.cUtil, s: 'n'}, {v: o.cSab, s: 'n'}, {v: o.cDom, s: 'n'}, {v: o.pontos, s: 'n'}, {v: o.meta, s: 'n'}, {v: o.abonos, s: 'n'}, {v: f(o.app), s: 'p'}, o.gat ? 'Atingido' : 'Zerado', {v: f(o.jan), s: 'p'}, {v: o.ocn, s: 'n'}, {v: f(o.oc), s: 'p'}, {v: o.pct / 100, s: 'p'}, {v: Math.round(o.valor * 100) / 100}];
const tot = ms.reduce((a, o) => a + o.valor, 0);
const ap = [[{v: 'Variável Frota — ' + (ms.length === 1 ? ms[0].nome + ' — ' : '') + mesN + '/' + ano, s: 't'}], [regra], ['Apurado pelo portal Torre de Controle em ' + new Date().toLocaleString('pt-BR')], [], h, ...ms.map(lin), [], [{v: 'Total a pagar', s: 'b'}, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', {v: Math.round(tot * 100) / 100, s: 'b'}]];
const g = dash.data('entregas_cliente'), sem = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dia = [[{v: 'Dia a dia — ' + mesN + '/' + ano, s: 't'}], [], ['Motorista', 'Data', 'Dia', 'Cargas', 'Rotas', 'Vale (cada carga)', 'Pontos', 'Abono'].map((v) => ({v, s: 'h'}))];
const ult = g.data.reduce((a, r) => (String(r.data).slice(0, 7) === c.mes && r.data > a ? r.data : a), '');
ms.forEach((o) => {
const por = {};
g.data.forEach((r) => { if (String(r.data).slice(0, 7) === c.mes && TC.varFrota(r.transportadora) && 'F|' + TC.varNome(r.motorista) === o.key) (por[r.data] = por[r.data] || new Set()).add(r.rota); });
const ab = (TC.varAbono[c.mes] || {})[TC.varFid(o.key)] || {};
const [y, m] = c.mes.split('-').map(Number), n = new Date(y, m, 0).getDate();
for (let d = 1; d <= n; d++) {
const iso = c.mes + '-' + String(d).padStart(2, '0'); if (ult && iso > ult) break;
const wd = new Date(y, m - 1, d).getDay(), rs = por[iso], pw = TC.varPesoDia(iso);
if (!rs && !ab[iso] && wd === 0) continue;
dia.push([o.nome, iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4), sem[wd] + (TC.varFer().has(iso) ? ' (feriado)' : ''), {v: rs ? rs.size : 0, s: 'n'}, rs ? Array.from(rs).sort().join(', ') : '', {v: pw, s: 'n'}, {v: rs ? rs.size * pw : 0, s: 'n'}, ab[iso] ? (TC.varMotivos[ab[iso]] || ab[iso]) : '']);
}
});
return {blob: TC.xlsx([{name: 'Apuração Frota ' + mesN, rows: ap, widths: [28, 14, 22, 8, 10, 12, 12, 14, 12, 12, 11, 11, 11, 11, 14, 13, 11, 16]}, {name: 'Dia a dia', rows: dia, widths: [28, 12, 14, 9, 30, 14, 9, 26]}]), mesN, ms};
};
TC.varBaixarFrota = async (btn) => {
const dl = await (window.claude && window.claude.use ? window.claude.use('downloads').catch(() => null) : null);
if (!dl) return;
const x = TC.varXlsFrota(Array.from(TC.varSelF)); if (!x) return;
const nome = ('Variavel Frota ' + (x.ms.length === 1 && TC.varSelF.size === 1 ? x.ms[0].nome + ' ' : '') + x.mesN + '.xlsx').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ');
if (btn) btn.disabled = true;
try { await dl.save({filename: nome, data: x.blob}); } catch (e) { if (btn) btn.title = e && e.code === 'declined' ? 'Download cancelado' : 'Não foi possível baixar'; }
if (btn) btn.disabled = false;
};
document.querySelectorAll('#var-xls-baixar-f').forEach((b) => { b.onclick = () => TC.varBaixarFrota(b); });
