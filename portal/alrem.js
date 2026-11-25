// Remover alerta. Se algum cliente já foi informado, abre um aviso: ao confirmar, o alerta sai do portal
// (some das observações dos clientes) e fica para esses clientes a observação
// "Veículo seguindo viagem dentro do programado", para o Customer Service avisar de novo.
(() => {
const W = window;
const db = () => (W.claude && W.claude.use ? W.claude.use('db').catch(() => null) : Promise.resolve(null));
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
TC.alNormObs = 'Veículo seguindo viagem dentro do programado';
TC.alRm = W.__nxAlRm || null;
const nomeAl = (a) => (TC.alTipos[a.tipo] || a.tipo) + (a.escopo === 'clientes' ? ' (por cliente)' : '');
// pedidos cobertos pelo alerta e os já informados
const pedsDe = (a) => {
  const x = ((TC.csDados && TC.csDados().lista) || []).find((y) => y.a === a);
  if (x) return x.peds;
  const g = dash.data('entregas_cliente');
  return (g.status === 'ok' ? g.data : []).filter((r) => r.data === a.data && r.rota === a.rota && !TC.isEnt(r) && (a.escopo !== 'clientes' || (a.ids || []).includes(r.id)));
};
const caminho = (a) => 'alertas/' + (a._id ? a._id : TC.alId(a.data, a.rota));
const executa = async (a, informados, depois) => {
  const d = await db(); if (!d) throw new Error('sem db');
  await d.doc(caminho(a)).delete();
  if (TC.log) TC.log('Alerta removido', {data: a.data, rota: a.rota, detalhe: nomeAl(a) + (a.obs ? ' · ' + a.obs : '') + (informados.length ? ' · ' + informados.length + ' cliente(s) já tinham sido informados' : '')});
  if (informados.length) {
    const ids = informados.map((p) => p.id);
    // a informação anterior deixa de valer: esses clientes precisam receber a nova observação
    for (const id of ids) { try { await d.doc('alertas/' + TC.alId(a.data, a.rota) + '/informados/' + TC.csPedKey(id)).delete(); } catch (e) { /* segue */ } }
    const agora = new Date().toISOString();
    await d.doc('alertas/' + TC.alId(a.data, a.rota) + '__c' + Date.now().toString(36)).set({data: a.data, rota: a.rota, tipo: 'normalizado', escopo: 'clientes', ids, obs: TC.alNormObs + ' (alerta anterior removido: ' + (TC.alTipos[a.tipo] || a.tipo) + ')', em: agora, editado_em: agora, por: ''});
    if (TC.log) TC.log('Situação normalizada registrada', {data: a.data, rota: a.rota, detalhe: TC.alNormObs + ' · ' + TC.logClientes(a.data, a.rota, ids)});
  }
  if (depois) depois();
};
// ponto único para remover um alerta de rota ou por cliente
TC.alRemover = async (a, depois) => {
  if (!a) return;
  const peds = pedsDe(a), informados = peds.filter((p) => TC.csInf(a, p.id));
  TC.alRm = W.__nxAlRm = {a, informados, depois, erro: false, salvando: false};
  document.querySelectorAll('#al-rm').forEach((e) => { e.hidden = false; });
  dash.draw('alRmBox');
};
const fecha = () => { TC.alRm = W.__nxAlRm = null; document.querySelectorAll('#al-rm').forEach((e) => { e.hidden = true; }); };
dash.draw('alRmBox', (box) => {
  const R = TC.alRm; box.replaceChildren(); if (!R) return;
  const n = R.informados.length;
  if (!n) {
    box.append(el('h3', '', 'Remover alerta'));
    box.append(el('p', '', 'Remover o alerta "' + nomeAl(R.a) + '" da rota ' + R.a.rota + '? Nenhum cliente foi informado ainda; o alerta some das observações dos clientes.'));
    if (R.erro) box.append(el('p', 'nx-al-err', 'Não foi possível remover agora. Tente de novo.'));
    const acts0 = el('div', 'nx-al-acts');
    const ok0 = el('button', 'nx-btn', R.salvando ? 'Removendo…' : 'Remover alerta'); ok0.type = 'button'; ok0.disabled = R.salvando;
    ok0.onclick = async () => { R.salvando = true; R.erro = false; dash.draw('alRmBox'); try { await executa(R.a, [], R.depois); fecha(); } catch (e) { R.salvando = false; R.erro = true; dash.draw('alRmBox'); } };
    const no0 = el('button', 'nx-btn nx-btn-sec', 'Cancelar'); no0.type = 'button'; no0.onclick = fecha;
    acts0.append(ok0, no0); box.append(acts0); setTimeout(() => ok0.focus(), 0);
    return;
  }
  box.append(el('h3', '', 'Clientes já informados'));
  box.append(el('p', '', 'O alerta "' + nomeAl(R.a) + '" da rota ' + R.a.rota + ' já foi informado a ' + n + (n === 1 ? ' cliente' : ' clientes') + ':'));
  const ul = el('ul', 'nx-rm-lista'); R.informados.slice(0, 12).forEach((p) => {
    const i = TC.csInf(R.a, p.id) || {};
    ul.append(el('li', '', (p.codigo ? p.codigo + ' · ' : '') + (p.cliente || p.id) + (i.em ? ' — informado em ' + new Date(i.em).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '')));
  });
  if (n > 12) ul.append(el('li', '', '… e mais ' + (n - 12)));
  box.append(ul);
  box.append(el('p', 'nx-rm-obs', 'Ao remover, o alerta some das observações dos clientes e fica registrada para ' + (n === 1 ? 'ele' : 'eles') + ' a observação "' + TC.alNormObs + '". O Customer Service recebe de novo esses clientes em 5.1 Alertas para avisar.'));
  if (R.erro) box.append(el('p', 'nx-al-err', 'Não foi possível remover agora. Tente de novo.'));
  const acts = el('div', 'nx-al-acts');
  const ok = el('button', 'nx-btn', R.salvando ? 'Removendo…' : 'Remover e registrar observação'); ok.type = 'button'; ok.disabled = R.salvando;
  ok.onclick = async () => { R.salvando = true; R.erro = false; dash.draw('alRmBox'); try { await executa(R.a, R.informados, R.depois); fecha(); } catch (e) { R.salvando = false; R.erro = true; dash.draw('alRmBox'); } };
  const no = el('button', 'nx-btn nx-btn-sec', 'Cancelar'); no.type = 'button'; no.onclick = fecha;
  acts.append(ok, no); box.append(acts);
  setTimeout(() => ok.focus(), 0);
});
document.querySelectorAll('#al-rm').forEach((m) => { m.onclick = (ev) => { if (ev.target === m) fecha(); }; m.onkeydown = (ev) => { if (ev.key === 'Escape') fecha(); }; });
})();
