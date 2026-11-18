// Usuários e perfis: cada pessoa entra com a própria conta Claude; o perfil define quais abas ela vê.
(() => {
const W = window;
const ABAS = () => Array.from(document.querySelectorAll('.nx-tabs [data-tab]')).filter((b) => b.dataset.tab !== 'usuarios').map((b) => ({id: b.dataset.tab, nome: b.textContent.replace(/[📺⬆]/g, '').replace(/\s+\d+$/, '').trim()}));
const PADRAO = () => ({
padrao: 'operacao',
perfis: {
admin: {nome: 'Administrador', abas: ABAS().map((a) => a.id)},
operacao: {nome: 'Operação', abas: ABAS().map((a) => a.id).filter((t) => !['atualizar', 'variavel', 'variavel-frota'].includes(t))},
cs: {nome: 'Customer Service', abas: ['cs', 'consulta-cliente']}
}
});
TC.ac = W.__nxAc = W.__nxAc || {cfg: null, usuarios: {}, eu: null, editor: null, pronto: false, login: null};
const A = TC.ac;
const raiz = () => { const h = document.querySelector('.nx-tabs'); return h ? h.closest('header') && h.closest('header').parentElement : null; };
if (!A.pronto) { const r = raiz(); if (r) r.classList.add('nx-acesso-pendente'); }
const use = (n) => (W.claude && W.claude.use ? W.claude.use(n).catch(() => null) : Promise.resolve(null));
TC.acCfg = () => A.cfg || PADRAO();
TC.acPerfilDe = (id) => { const c = TC.acCfg(), u = id && A.usuarios[id]; const p = u && c.perfis[u.perfil] ? u.perfil : c.padrao; return c.perfis[p] ? p : Object.keys(c.perfis)[0]; };
TC.acComSenha = () => Object.entries(TC.acCfg().perfis).filter(([, p]) => p.senha && p.senha.h);
// Na versão web com login próprio (W.NX_AUTH), a pessoa já entrou com usuário e senha: não pede a senha do perfil.
TC.acPrecisaLogin = () => !W.NX_AUTH && !A.editor && !A.login && TC.acComSenha().length > 0;
TC.acAbas = () => {
if (A.editor) return null; // editor do portal vê tudo
if (TC.acPrecisaLogin()) return new Set();
const c = TC.acCfg(), p = c.perfis[A.login || TC.acPerfilDe(A.eu)];
return new Set(p ? p.abas : []);
};
TC.acHash = async (sal, senha) => { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sal + '|' + senha)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''); };
TC.acAplica = () => {
const ok = TC.acAbas();
document.querySelectorAll('.nx-tabs [data-tab]').forEach((b) => { const t = b.dataset.tab; b.hidden = t === 'usuarios' ? !A.editor : (ok ? !ok.has(t) : false); });
if (ok) {
const atual = document.querySelector('.nx-tab:not([hidden])');
if (!atual || !ok.has(atual.id)) { const prim = Array.from(document.querySelectorAll('.nx-tabs [data-tab]')).find((b) => !b.hidden); if (prim) TC.acShow(prim.dataset.tab); else document.querySelectorAll('.nx-tab').forEach((s) => { s.hidden = true; }); }
}
document.querySelectorAll('#acesso-sem-abas').forEach((e) => { e.hidden = !(ok && ok.size === 0) || TC.acPrecisaLogin(); });
document.querySelectorAll('#nx-login').forEach((e) => { e.hidden = !TC.acPrecisaLogin(); });
document.querySelectorAll('#nx-sair').forEach((e) => { e.hidden = !A.login; });
['loginPerfis', 'loginMsg', 'usSenhas'].forEach((n) => dash.draw(n));
const r = raiz(); if (r) r.classList.remove('nx-acesso-pendente');
A.pronto = true;
['usPerfis', 'usLista', 'usPadrao', 'usEu', 'usSenhas'].forEach((n) => dash.draw(n));
};
if (!TC.acShow) { TC.acShow = TC.showTab; TC.showTab = (id) => { const ok = TC.acAbas(); if (id === 'usuarios' && !A.editor) return; if (ok && id !== 'usuarios' && !ok.has(id)) return; TC.acShow(id); }; document.querySelectorAll('.nx-tabs [data-tab]').forEach((b) => b.addEventListener('click', (e) => { if (b.hidden) e.stopImmediatePropagation(); }, true)); }
document.querySelectorAll('.nx-tabs [data-tab="usuarios"]').forEach((b) => b.addEventListener('click', () => TC.showTab('usuarios')));
if (W.__nxAcT) clearTimeout(W.__nxAcT);
W.__nxAcT = setTimeout(() => { if (!A.pronto) { if (A.editor === null) A.editor = false; TC.acAplica(); } }, 8000);
(async () => {
const user = await use('user');
A.editor = user ? !!(await user.canEdit()) : false;
A.eu = user ? await user.id() : null;
const db = await use('db');
if (!db) { TC.acAplica(); return; }
let n = 0; const fim = () => { if (++n >= 2) TC.acAplica(); else if (A.pronto) TC.acAplica(); };
if (W.__nxAcU1) { try { W.__nxAcU1(); } catch (e) { /* segue */ } }
if (W.__nxAcU2) { try { W.__nxAcU2(); } catch (e) { /* segue */ } }
W.__nxAcU1 = db.doc('config/perfis').onSnapshot((s) => { A.cfg = s.exists ? Object.assign(PADRAO(), s.data()) : null; fim(); }, () => fim());
W.__nxAcU2 = db.collection('usuarios').onSnapshot((s) => { A.usuarios = {}; s.docs.forEach((d) => { A.usuarios[d.id] = d.data(); }); fim(); }, () => fim());
TC.acDb = db; TC.acUser = user;
})();
TC.acSalvaCfg = async (cfg) => { TC.acMsg('Perfis e senhas são alterados somente pelo Claude.'); return; try { await TC.acDb.doc('config/perfis').set({perfis: cfg.perfis, padrao: cfg.padrao, em: new Date().toISOString()}); TC.acMsg(''); } catch (e) { TC.acMsg('Não consegui salvar. Só quem edita o portal pode mudar perfis.'); } };
TC.acMsg = (t) => { TC.acMsgTxt = t; dash.draw('usMsg'); };
})();
dash.draw('usMsg', (el) => { el.textContent = TC.acMsgTxt || ''; });
dash.draw('usEu', (el) => {
const A = TC.ac; if (!A.pronto) { el.textContent = '—'; return; }
el.textContent = A.editor ? 'Você edita o portal: entra sem senha e vê todas as abas.' : 'Seu perfil: ' + ((TC.acCfg().perfis[A.login || TC.acPerfilDe(A.eu)] || {}).nome || '—');
});
dash.draw('usPadrao', (el) => { const c = TC.acCfg(); el.textContent = (c.perfis[c.padrao] || {}).nome || '—'; });
dash.draw('usPerfis', (box) => {
box.replaceChildren(); if (!TC.ac.editor) return;
const c = TC.acCfg(), abas = Array.from(document.querySelectorAll('.nx-tabs [data-tab]')).filter((b) => b.dataset.tab !== 'usuarios').map((b) => ({id: b.dataset.tab, nome: b.textContent.replace(/[📺⬆]/g, '').replace(/\s+\d+$/, '').trim()}));
const t = document.createElement('table'); t.className = 'tc-table nx-us-mat';
const th = document.createElement('thead'), hr = document.createElement('tr');
const h0 = document.createElement('th'); h0.textContent = 'Aba'; hr.append(h0);
Object.entries(c.perfis).forEach(([k, p]) => { const h = document.createElement('th'); h.className = 'nx-us-pf'; const s = document.createElement('div'); s.textContent = p.nome; h.append(s); if (false) { const x = document.createElement('button'); x.type = 'button'; x.className = 'nx-us-x'; x.textContent = 'remover'; x.title = 'Remover o perfil ' + p.nome; x.onclick = () => { const n = JSON.parse(JSON.stringify(c)); delete n.perfis[k]; if (n.padrao === k) n.padrao = Object.keys(n.perfis)[0]; TC.acSalvaCfg(n); }; h.append(x); } hr.append(h); });
th.append(hr); t.append(th);
const tb = document.createElement('tbody');
abas.forEach((a) => {
const tr = document.createElement('tr'); tr.dataset.key = a.id; const td0 = document.createElement('td'); td0.textContent = a.nome; tr.append(td0);
Object.entries(c.perfis).forEach(([k, p]) => { const td = document.createElement('td'); td.className = 'nx-us-c'; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = p.abas.includes(a.id); cb.disabled = true; cb.setAttribute('aria-label', p.nome + ': ' + a.nome);
cb.onchange = () => { const n = JSON.parse(JSON.stringify(c)); const s = new Set(n.perfis[k].abas); if (cb.checked) s.add(a.id); else s.delete(a.id); n.perfis[k].abas = abas.map((x) => x.id).filter((x) => s.has(x)); TC.acSalvaCfg(n); };
td.append(cb); tr.append(td); });
tb.append(tr);
});
t.append(tb); box.append(t);
});
dash.draw('usLista', (box) => {
box.replaceChildren(); const A = TC.ac; if (!A.editor || !TC.acUser) return;
const ids = Object.keys(A.usuarios); const c = TC.acCfg();
if (!ids.length) { const p = document.createElement('p'); p.className = 'tc-sub'; p.textContent = 'Ninguém com perfil definido ainda. Quem não estiver aqui usa o perfil padrão.'; box.append(p); return; }
const ps = TC.acNomes || {};
const falta = ids.filter((i) => !ps[i]);
if (falta.length && !TC.acBuscando) { TC.acBuscando = true; TC.acUser.profiles(ids).then((r) => { TC.acNomes = Object.assign({}, TC.acNomes || {}, r); TC.acBuscando = false; dash.draw('usLista'); }); }
ids.forEach((i) => { if (!ps[i]) ps[i] = {name: '', avatarUrl: '', guest: false}; });
const t = document.createElement('table'); t.className = 'tc-table'; const tb = document.createElement('tbody');
const hd = document.createElement('thead'); const hr = document.createElement('tr'); ['Pessoa', 'Perfil'].forEach((x) => { const h = document.createElement('th'); h.textContent = x; hr.append(h); }); hd.append(hr);
ids.sort((a, b) => ((ps[a] && ps[a].name) || '').localeCompare((ps[b] && ps[b].name) || '')).forEach((id) => {
const tr = document.createElement('tr'); tr.dataset.key = id;
const td1 = document.createElement('td'); const im = document.createElement('img'); im.className = 'nx-us-av'; im.alt = ''; im.src = ps[id].avatarUrl; td1.append(im, ' ' + (ps[id].name || 'Pessoa sem nome visível') + (ps[id].guest ? ' (convidado)' : ''));
const td2 = document.createElement('td'); td2.textContent = (c.perfis[A.usuarios[id].perfil] || c.perfis[c.padrao] || {}).nome || '—';
tr.append(td1, td2); tb.append(tr);
});
t.append(hd, tb); box.append(t);
});
dash.draw('loginPerfis', (sel) => {
const L = TC.acComSenha(), pref = TC.ac.eu && TC.ac.usuarios[TC.ac.eu] ? TC.ac.usuarios[TC.ac.eu].perfil : null;
sel.replaceChildren(...L.map(([k, p]) => { const o = document.createElement('option'); o.value = k; o.textContent = p.nome; return o; }));
if (pref && L.some(([k]) => k === pref)) sel.value = pref;
});
dash.draw('loginMsg', (el) => { el.textContent = TC.acLoginErro || ''; });
document.querySelectorAll('#login-entrar').forEach((b) => { b.onclick = async () => {
const sel = document.getElementById('login-perfil'), inp = document.getElementById('login-senha');
const k = sel && sel.value, p = TC.acCfg().perfis[k];
if (!p || !p.senha) return;
let h = ''; try { h = await TC.acHash(p.senha.sal, inp ? inp.value : ''); } catch (e) { TC.acLoginErro = 'Este navegador não conseguiu conferir a senha.'; dash.draw('loginMsg'); return; }
if (h !== p.senha.h) { TC.acLoginErro = 'Senha incorreta.'; dash.draw('loginMsg'); if (inp) inp.value = ''; return; }
TC.acLoginErro = ''; TC.ac.login = k; if (inp) inp.value = ''; TC.acAplica();
}; });
document.querySelectorAll('#login-senha').forEach((i) => { i.onkeydown = (e) => { if (e.key === 'Enter') { const b = document.getElementById('login-entrar'); if (b) b.click(); } }; });
document.querySelectorAll('#nx-sair').forEach((b) => { b.onclick = () => { TC.ac.login = null; TC.acAplica(); }; });
dash.draw('usSenhas', (box) => {
box.replaceChildren(); if (!TC.ac.editor) return;
const c = TC.acCfg();
Object.entries(c.perfis).forEach(([k, p]) => {
const row = document.createElement('div'); row.className = 'nx-us-senha';
const nm = document.createElement('b'); nm.textContent = p.nome;
const st = document.createElement('span'); st.className = 'tc-sub'; st.textContent = p.senha && p.senha.h ? '🔒 com senha' : 'sem senha';
row.append(nm, st);
box.append(row);
});
});
