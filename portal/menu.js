// Barra lateral: recolher / mostrar o menu (lembrado neste navegador).
(() => {
const raiz = () => document.querySelector('.tc.nx');
const aplica = (off) => {
  const r = raiz(); if (r) r.classList.toggle('nx-side-off', off);
  document.querySelectorAll('#nx-side-tg').forEach((b) => b.setAttribute('aria-expanded', off ? 'false' : 'true'));
};
let off = false;
try { off = localStorage.getItem('nx-menu-recolhido') === '1'; } catch (e) { /* sem armazenamento */ }
aplica(off);
document.querySelectorAll('#nx-side-tg').forEach((b) => { b.onclick = () => {
  off = !(raiz() && raiz().classList.contains('nx-side-off'));
  aplica(off);
  try { localStorage.setItem('nx-menu-recolhido', off ? '1' : '0'); } catch (e) { /* ok */ }
}; });
})();
