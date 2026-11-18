// Monta o portal a partir de /portal/index.html (o mesmo arquivo usado no Claude),
// para que exista uma única fonte do código das abas.
(async () => {
  const BASE = (window.NX_CONFIG && window.NX_CONFIG.portal) || '/portal/';
  const raiz = document.getElementById('nx-root');
  const aviso = (t) => { raiz.textContent = t; raiz.className = 'nx-boot-erro'; };
  let html;
  try {
    const r = await fetch(BASE + 'index.html', {cache: 'no-cache'});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    html = await r.text();
  } catch (e) { aviso('Não foi possível carregar o portal (' + e.message + ').'); return; }

  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const frag = tpl.content;
  // caminhos relativos (estilos, imagens) apontam para a pasta do portal
  const abs = (u) => !u || /^(https?:|data:|blob:|#|\/)/.test(u) ? u : BASE + u;
  frag.querySelectorAll('link[href]').forEach((l) => l.setAttribute('href', abs(l.getAttribute('href'))));
  frag.querySelectorAll('img[src]').forEach((i) => i.setAttribute('src', abs(i.getAttribute('src'))));
  // estilos e conteúdo entram primeiro; os scripts rodam depois, na ordem do arquivo
  const scripts = Array.from(frag.querySelectorAll('script'));
  const marcas = scripts.map((s) => { const m = document.createComment('script'); s.replaceWith(m); return m; });
  raiz.replaceChildren(frag);

  for (let i = 0; i < scripts.length; i++) {
    const old = scripts[i], s = document.createElement('script');
    Array.from(old.attributes).forEach((a) => { if (a.name !== 'src') s.setAttribute(a.name, a.value); });
    const src = old.getAttribute('src');
    if (src) {
      s.src = /^(https?:)?\/\//.test(src) || src.startsWith('/') ? src : BASE + src;
      await new Promise((ok) => { s.onload = ok; s.onerror = () => { console.error('[nexxa] não carregou', src); ok(); }; marcas[i].replaceWith(s); });
    } else {
      s.textContent = old.textContent;
      try { marcas[i].replaceWith(s); } catch (e) { console.error('[nexxa] script', i, e); }
    }
  }
  window.dash._start();
})();
