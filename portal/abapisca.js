// Aba do navegador pisca (título e ícone) enquanto houver clientes a informar nos alertas do Customer Service.
// Vale para quem tem acesso à aba 5.1 Alertas.
(() => {
const W = window;
if (W.__nxAbaT) clearInterval(W.__nxAbaT);
const base = W.__nxTitulo || document.title || 'Torre de Controle · Nexxa'; W.__nxTitulo = base;
const link = () => document.querySelector("link[rel~='icon'][sizes='64x64']") || document.querySelector("link[rel~='icon']");
const icone0 = W.__nxIcone || (link() ? link().href : ''); W.__nxIcone = icone0;
let alerta = W.__nxIconeAl || '';
// ícone de alerta: o símbolo da Nexxa com uma bolinha vermelha
if (!alerta && icone0) {
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64); x.beginPath(); x.arc(46, 18, 16, 0, Math.PI * 2); x.fillStyle = '#D92D20'; x.fill(); x.lineWidth = 4; x.strokeStyle = '#fff'; x.stroke(); alerta = W.__nxIconeAl = c.toDataURL('image/png'); } catch (e) { /* sem ícone de alerta */ } };
  img.src = icone0;
}
const podeVer = () => { const b = document.querySelector("[data-tab='cs']"); return !!b && !b.hidden && getComputedStyle(b).display !== 'none'; };
let fase = false;
const setIcon = (href) => { const l = link(); if (l && href && l.href !== href) l.href = href; };
TC.abaPisca = () => {
  const n = TC.csAvisoN || 0;
  if (!n || !podeVer()) { if (document.title !== base) document.title = base; setIcon(icone0); return false; }
  return true;
};
W.__nxAbaT = setInterval(() => {
  if (!TC.abaPisca()) return;
  fase = !fase;
  const n = TC.csAvisoN;
  document.title = fase ? '(' + n + ') ⚠ ' + (n === 1 ? 'Cliente a informar' : 'Clientes a informar') : base;
  setIcon(fase ? alerta || icone0 : icone0);
}, 1000);
})();
