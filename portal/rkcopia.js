// Rankings: copiar o quadro (imagem) e a mensagem para colar no WhatsApp.
(() => {
const NOMES = {motoristas_dia: 'motoristas', transportadoras_dia: 'transportadoras', clientes_rk_dia: 'clientes'};
TC.rkLista = (id) => {
  const rows = TC.rkRows(id); if (!rows) return null;
  const st = TC.RK[id];
  return TC.rkSort(rows.filter((r) => r.entregas >= st.min), st.ord);
};
TC.rkSub = (list) => {
  const t = {};
  ['entregas', 'viagens', 'concluidas', 'ocorrencias', 'sla_sim', 'sla_aval', 'ontime_sim', 'ontime_aval', 'otif_sim', 'otif_aval', 'app_sim', 'app_aval'].forEach((f) => { t[f] = d3.sum(list, (r) => +r[f] || 0); });
  return Object.assign(t, {conc: TC.rkPct(t.concluidas, t.entregas), sla: TC.rkPct(t.sla_sim, t.sla_aval), ontime: TC.rkPct(t.ontime_sim, t.ontime_aval), otif: TC.rkPct(t.otif_sim, t.otif_aval), oc: TC.rkPct(t.ocorrencias, t.entregas), app: TC.rkPct(t.app_sim, t.app_aval)});
};
const pctTxt = (v) => (v === null || v === undefined ? '—' : TC.fmt(v, 'pct'));
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };

// Mensagem sugerida, gerada a partir do subtotal; o usuário pode editar à vontade.
TC.rkMsgPadrao = (id) => {
  const list = TC.rkLista(id); if (!list || !list.length) return '';
  const t = TC.rkSub(list), st = TC.RK[id];
  const quem = id !== 'transportadoras_dia' ? (st.transp ? 'da transportadora ' + st.transp : 'das transportadoras') : 'das transportadoras';
  const alvo = id === 'motoristas_dia' ? 'os motoristas' : id === 'clientes_rk_dia' ? 'as entregas nesses clientes' : 'as transportadoras';
  const extra = [];
  if (t.sla !== null && t.sla < 90) extra.push('as entregas dentro da janela (SLA janela em ' + pctTxt(t.sla) + ', meta 90%)');
  if (t.oc !== null && t.oc > 1) extra.push('as ocorrências (' + pctTxt(t.oc) + ' das entregas, limite 1%)');
  const app = t.app !== null && t.app < 98.5;
  if (!app && !extra.length) return saudacao() + ', parabéns! Indicadores ' + quem + ' dentro das metas no período: uso do app ' + pctTxt(t.app) + ', SLA janela ' + pctTxt(t.sla) + ' e ocorrências ' + pctTxt(t.oc) + '.';
  const ext = extra.join(' e ');
  if (app) return saudacao() + ', preciso de uma ação sobre ' + alvo + ' para o uso do app em todas as entregas. Índice médio ' + quem + ' está em ' + pctTxt(t.app) + ', muito baixo (meta 98,5%).' + (ext ? ' Também precisamos melhorar ' + ext + '.' : '');
  return saudacao() + ', preciso de uma ação sobre ' + alvo + ' para melhorar ' + ext + '.';
};

dash.draw('rkMsg', (ta) => {
  const id = TC.rkOf(ta); if (!id) return;
  if (ta.dataset.editado === '1') return;
  ta.value = TC.rkMsgPadrao(id);
});
document.querySelectorAll('[data-rk] .rk-msg').forEach((ta) => ta.addEventListener('input', () => { ta.dataset.editado = '1'; }));
document.querySelectorAll('[data-rk] .rk-msg-reset').forEach((b) => b.addEventListener('click', () => {
  const sec = b.closest('[data-rk]'), ta = sec.querySelector('.rk-msg'); if (!ta) return;
  delete ta.dataset.editado; ta.value = TC.rkMsgPadrao(sec.dataset.rk);
}));

// Desenha o quadro num canvas, no mesmo layout da tabela, com a mensagem embaixo.
const quebra = (ctx, txt, w) => {
  const out = [];
  String(txt || '').split('\n').forEach((par) => {
    let linha = '';
    par.split(/\s+/).forEach((p) => { const t = linha ? linha + ' ' + p : p; if (ctx.measureText(t).width > w && linha) { out.push(linha); linha = p; } else linha = t; });
    out.push(linha);
  });
  return out;
};
TC.rkCanvas = (id, msg) => {
  const full = TC.rkLista(id); if (!full || !full.length) return null;
  const st = TC.RK[id], R = TC.rkRange(id), t = TC.rkSub(full), mot = id === 'motoristas_dia', cli = id === 'clientes_rk_dia';
  const list = cli ? full.slice(0, 40) : full;   // imagem de redes: as 40 primeiras da ordem escolhida
  const F = 'Roboto, "Segoe UI", Arial, sans-serif';
  const cols = [
    {h: '#', w: 46, a: 'c'}, {h: mot ? 'Motorista' : cli ? 'Rede / cliente' : 'Transportadora', w: cli ? 300 : 230, a: 'l'}];
  if (mot) cols.push({h: 'Transportadora', w: 160, a: 'l'});
  if (cli) cols.push({h: 'Lojas', w: 80, a: 'r'});
  cols.push({h: 'Entregas', w: 90, a: 'r'}, {h: cli ? 'Rotas' : 'Viagens', w: 80, a: 'r'}, {h: '% Concluídas', w: 120, a: 'r'},
    {h: 'Aderência app', w: 180, a: 'b', k: 'app', cor: '#7A5AF8'}, {h: 'SLA janela', w: 180, a: 'b', k: 'sla', cor: TC.pal[0]},
    {h: '% ocorr.', w: 90, a: 'r'}, {h: 'On Time', w: 180, a: 'b', k: 'ontime', cor: TC.pal[2]}, {h: 'OTIF', w: 180, a: 'b', k: 'otif', cor: TC.pal[3]});
  const W = cols.reduce((s, c) => s + c.w, 0) + 40, RH = 44, top = 96;
  const c0 = document.createElement('canvas'), cx0 = c0.getContext('2d'); cx0.font = '500 28px ' + F;
  const linhas = msg ? quebra(cx0, msg, W - 80) : [];
  const H = top + RH * (list.length + 2) + 24 + (linhas.length ? linhas.length * 42 + 50 : 0);
  const k = 2, cv = document.createElement('canvas'); cv.width = W * k; cv.height = H * k;
  const ctx = cv.getContext('2d'); ctx.scale(k, k); ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
  // título
  ctx.fillStyle = '#1F7A3A'; ctx.fillRect(20, 22, 5, 30);
  ctx.fillStyle = '#1B2B22'; ctx.font = '600 22px ' + F; ctx.textAlign = 'left';
  const tit = 'Ranking do período'; ctx.fillText(tit, 36, 38);
  const tw = ctx.measureText(tit).width; ctx.font = '20px ' + F; ctx.fillStyle = '#5A6B61';
  ctx.fillText(' · ' + TC.fdt(R.de) + ' a ' + TC.fdt(R.ate) + ((mot || cli) && st.transp ? ' · ' + st.transp : ''), 36 + tw, 38);
  ctx.font = '14px ' + F; ctx.fillText('Torre de Controle Nexxa · ' + (mot ? 'Ranking de motoristas' : cli ? 'Ranking de clientes' : 'Ranking de transportadoras'), 36, 70);
  // cabeçalho
  let y = top; ctx.fillStyle = '#F4F7F5'; ctx.fillRect(20, y, W - 40, RH);
  ctx.font = '600 15px ' + F; ctx.fillStyle = '#1F7A3A';
  const cel = (txt, c, x, yy) => {
    const pad = 10;
    if (c.a === 'r') { ctx.textAlign = 'right'; ctx.fillText(txt, x + c.w - pad, yy); }
    else if (c.a === 'c') { ctx.textAlign = 'center'; ctx.fillText(txt, x + c.w / 2, yy); }
    else { ctx.textAlign = 'left'; ctx.fillText(txt, x + pad, yy, c.w - 2 * pad); }
  };
  let x = 20; cols.forEach((c) => { cel(c.h, Object.assign({}, c, {a: c.a === 'b' ? 'l' : c.a}), x, y + RH / 2); x += c.w; });
  const barra = (v, c, x0, yy, claro, txtCor) => {
    const bw = c.w - 90, bx = x0 + 10;
    ctx.fillStyle = claro ? 'rgba(255,255,255,.6)' : '#E8ECEA'; ctx.fillRect(bx, yy - 4, bw, 8);
    ctx.fillStyle = c.cor; ctx.fillRect(bx, yy - 4, bw * Math.max(0, Math.min(100, v || 0)) / 100, 8);
    ctx.fillStyle = txtCor; ctx.textAlign = 'right'; ctx.fillText(pctTxt(v), x0 + c.w - 10, yy);
  };
  const linha = (r, sub, ix) => {
    y += RH;
    ctx.fillStyle = sub ? '#FFF4C2' : ix < 3 ? '#EEF6F0' : '#FFFFFF'; ctx.fillRect(20, y, W - 40, RH);
    ctx.fillStyle = sub ? '#F4C152' : '#E3E8E5'; ctx.fillRect(20, y + RH - (sub ? 2 : 1), W - 40, sub ? 2 : 1);
    if (sub) ctx.fillRect(20, y, W - 40, 2);
    const yy = y + RH / 2; let xx = 20;
    ctx.font = (sub ? '600 ' : '') + '15px ' + F; ctx.fillStyle = sub ? '#3D3200' : '#1B2B22';
    const vals = sub
      ? ['', (mot ? 'SUBTOTAL · ' + list.length + ' MOTORISTAS' : cli ? 'TOTAL · ' + full.length + ' REDES' : 'TOTAL · ' + list.length + ' TRANSPORTADORAS')].concat(mot ? [st.transp || 'Todas'] : cli ? [TC.fmt(d3.sum(full, (r) => r.lojas), 'int')] : [])
      : [String(ix + 1), mot ? r.motorista : cli ? r.grupo : r.transportadora].concat(mot ? [r.transportadora] : cli ? [TC.fmt(r.lojas, 'int')] : []);
    const d = sub ? t : r;
    vals.push(TC.fmt(d.entregas, 'int'), TC.fmt(d.viagens, 'int'), pctTxt(d.conc), null, null, pctTxt(d.oc), null, null);
    cols.forEach((c, i) => {
      if (c.a === 'b') barra(d[c.k], c, xx, yy, sub, sub ? '#3D3200' : '#1B2B22');
      else if (i === 0 && !sub) {
        const cores = ['#F2B01E', '#9AA5A0', '#C8742B'];
        ctx.fillStyle = ix < 3 ? cores[ix] : '#EEF1EF'; ctx.beginPath(); ctx.arc(xx + c.w / 2, yy, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = ix < 3 ? '#FFFFFF' : '#1B2B22'; cel(vals[i], c, xx, yy); ctx.fillStyle = '#1B2B22';
      } else cel(vals[i], c, xx, yy);
      xx += c.w;
    });
  };
  linha(null, true, -1);
  list.forEach((r, ix) => linha(r, false, ix));
  if (linhas.length) {
    y += RH + 40; ctx.font = '500 28px ' + F; ctx.fillStyle = '#1B2B22'; ctx.textAlign = 'left';
    linhas.forEach((l) => { ctx.fillText(l, 40, y); y += 42; });
  }
  return cv;
};

const aviso = (sec, cls) => {
  sec.querySelectorAll('.rk-aviso').forEach((s) => { s.hidden = !s.classList.contains(cls); });
  clearTimeout(sec._rkT); sec._rkT = setTimeout(() => sec.querySelectorAll('.rk-aviso').forEach((s) => { s.hidden = true; }), 4000);
};
const nomeArq = (id) => {
  const st = TC.RK[id], R = TC.rkRange(id);
  return 'Ranking ' + NOMES[id] + (st.transp ? ' ' + st.transp : '') + ' ' + TC.fdt(R.de).replace(/\//g, '-') + ' a ' + TC.fdt(R.ate).replace(/\//g, '-') + '.png';
};
const baixar = async (sec, id, blob) => {
  try {
    const dl = await claude.use('downloads'); if (!dl) throw new Error('sem downloads');
    await dl.save({filename: nomeArq(id), data: blob}); aviso(sec, 'rk-av-baixado');
  } catch (e) { aviso(sec, 'rk-av-erro'); }
};
document.querySelectorAll('[data-rk] .rk-copiar').forEach((b) => b.addEventListener('click', async () => {
  const sec = b.closest('[data-rk]'), id = sec.dataset.rk, ta = sec.querySelector('.rk-msg');
  const cv = TC.rkCanvas(id, ta ? ta.value.trim() : '');
  if (!cv) { aviso(sec, 'rk-av-vazio'); return; }
  const blob = await new Promise((ok) => cv.toBlob(ok, 'image/png'));
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error('sem clipboard');
    await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
    aviso(sec, 'rk-av-copiado');
  } catch (e) { await baixar(sec, id, blob); }
}));
document.querySelectorAll('[data-rk] .rk-baixar').forEach((b) => b.addEventListener('click', async () => {
  const sec = b.closest('[data-rk]'), id = sec.dataset.rk, ta = sec.querySelector('.rk-msg');
  const cv = TC.rkCanvas(id, ta ? ta.value.trim() : '');
  if (!cv) { aviso(sec, 'rk-av-vazio'); return; }
  await baixar(sec, id, await new Promise((ok) => cv.toBlob(ok, 'image/png')));
}));
document.querySelectorAll('[data-rk] .rk-copiar-txt').forEach((b) => b.addEventListener('click', async () => {
  const sec = b.closest('[data-rk]'), ta = sec.querySelector('.rk-msg'); if (!ta) return;
  try { await navigator.clipboard.writeText(ta.value); aviso(sec, 'rk-av-texto'); }
  catch (e) { ta.focus(); ta.select(); aviso(sec, 'rk-av-sel'); }
}));
const re = TC.rkRedraw; TC.rkRedraw = () => { re(); dash.draw('rkMsg'); };
})();
