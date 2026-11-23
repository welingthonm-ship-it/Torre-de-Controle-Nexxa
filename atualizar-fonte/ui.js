// Aba "Atualizar dados": lê o relatório no navegador, mostra a prévia e publica as tabelas do portal.
window.NXU = (function () {
  var U = { st: 'idle', file: null, res: null, err: '', step: '', can: null, done: null };
  var IDS = ['resumo_dia', 'rotas_dia', 'ocorrencias_dia', 'pendentes', 'entregas_cliente', 'clientes'];
  var NOMES = { resumo_dia: 'Resumo diário', rotas_dia: 'Rotas por dia', ocorrencias_dia: 'Ocorrências por dia', pendentes: 'Entregas pendentes', entregas_cliente: 'Entregas por cliente', clientes: 'Resumo por cliente' };
  var nf = function (n) { return d3.format(',d')(n); };
  var dbr = function (s) { var p = String(s).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  U.set = function (patch) { Object.assign(U, patch); dash.draw('upd'); };
  function use(name) { return (window.claude && window.claude.use) ? window.claude.use(name).catch(function () { return null; }) : Promise.resolve(null); }

  // Alertas das rotas cadastrados no portal, para gravar junto nos dados atualizados.
  async function alertas() {
    var db = await use('db'); if (!db) return {};
    var snap = await db.collection('alertas').get(), m = {};
    snap.docs.forEach(function (d) { var a = d.data(); if (!a || !a.data || !a.rota) return; if (a.escopo === 'clientes') { (a.ids || []).forEach(function (id) { var k = 'id:' + a.data + '|' + a.rota + '|' + id; if (!m[k] || String(a.em || '') > String(m[k].em || '')) m[k] = a; }); } else m[a.data + '|' + a.rota] = a; });
    return m;
  }

  function waitData(ids, ms) {
    return new Promise(function (ok, fail) {
      var t0 = Date.now();
      (function tick() {
        var st = ids.map(function (id) { return dash.data(id); });
        var bad = st.find(function (g) { return g.status === 'error' || g.status === 'declined' || g.status === 'missing'; });
        if (bad) return fail(new Error('Não consegui carregar os dados atuais do portal (' + (bad.message || bad.status) + ').'));
        if (st.every(function (g) { return g.status === 'ok' && !g.refreshing; })) return ok(st.map(function (g) { return g.data; }));
        if (Date.now() - t0 > ms) return fail(new Error('Os dados atuais do portal demoraram demais para carregar. Tente de novo.'));
        setTimeout(tick, 300);
      })();
    });
  }

  U.read = function (file) {
    if (!file) return;
    U.set({ st: 'reading', file: file, res: null, err: '', done: null });
    file.arrayBuffer().then(function (buf) { return window.nxXls.read(buf); }).then(function (grid) {
      U.grid = grid;
      return Promise.all([waitData(IDS.slice(0, 5), 60000), alertas().catch(function () { return {}; })]).then(function (both) {
        var d = both[0];
        var old = { resumo_dia: d[0], rotas_dia: d[1], ocorrencias_dia: d[2], pendentes: d[3] };
        var res = window.nxTransform.build(grid, d[4], old, both[1]);
        var antes = {}; d[0].forEach(function (r) { antes[r.data] = r; });
        var depois = {}; res.tables.resumo_dia.forEach(function (r) { depois[r.data] = r; });
        res.antes = antes; res.depois = depois; res.linhas = grid.length - 1;
        res.mantidos = Object.keys(antes).filter(function (k) { return res.dias.indexOf(k) < 0; }).sort();
        U.set({ st: 'ready', res: res });
      });
    }).catch(function (e) { U.set({ st: 'error', err: (e && e.message) || String(e) }); });
  };

  U.publish = async function () {
    var res = U.res; if (!res) return;
    try {
      U.set({ st: 'publishing', step: 'Conferindo permissão…' });
      var assets = await use('assets'), db = await use('db');
      if (!assets || !db) throw new Error('Só quem pode editar o portal consegue publicar uma atualização.');
      U.set({ step: 'Gravando os alertas das rotas…' });
      res.alertas = window.nxTransform.annotate(res.tables, await alertas());
      var at = new Date().toISOString(), by = 'Enviado pela aba Atualizar dados (' + U.file.name + ')';
      var atual = {};
      for (var i = 0; i < IDS.length; i++) {
        var snap = await db.doc('datasets/' + IDS[i]).get();
        atual[IDS[i]] = snap.exists ? snap.data() : {};
      }
      var novos = {};
      for (var j = 0; j < IDS.length; j++) {
        var id = IDS[j];
        U.set({ step: 'Enviando ' + NOMES[id] + ' (' + (j + 1) + ' de ' + IDS.length + ')…' });
        var txt = res.csv(res.tables[id], res.cols[id]);
        var up = await assets.upload(new Blob([txt], { type: 'text/csv' }), { type: 'text/csv' });
        novos[id] = up.id;
      }
      U.set({ step: 'Atualizando o portal…' });
      var velhos = [];
      for (var k = 0; k < IDS.length; k++) {
        var id2 = IDS[k], cur = atual[id2] || {}, src = cur.source || {};
        var prev = cur.previousFile && cur.previousFile.url;
        if (prev) velhos.push(prev);
        await db.doc('datasets/' + id2).update({
          source: { kind: 'file', url: '/_blob/' + novos[id2], name: id2 + '.csv', format: 'csv' },
          updated: { at: at, by: by },
          edit: { via: 'user', at: at },
          previousFile: { url: src.url || '', at: (cur.updated && cur.updated.at) || '' }
        });
      }
      // Guarda só a versão imediatamente anterior; apaga as mais antigas que nenhuma tabela usa.
      var emUso = {};
      IDS.forEach(function (x) { emUso['/_blob/' + novos[x]] = 1; var s = atual[x] && atual[x].source; if (s && s.url) emUso[s.url] = 1; });
      for (var v = 0; v < velhos.length; v++) {
        var u = velhos[v];
        if (u && !emUso[u] && /^\/_blob\/[0-9a-f]{32}$/.test(u)) { try { await assets.delete(u.slice(7)); } catch (e) { /* segue */ } }
      }
      IDS.forEach(function (x) { try { dash.refresh(x); } catch (e) { /* segue */ } });
      U.set({ st: 'done', done: { at: at, dias: res.dias, novas: res.novas, alertas: res.alertas } });
      try { if (window.TC && TC.log) { var ds = (res.dias || []).slice().sort(); TC.log('Dados atualizados', { detalhe: 'Relatório do roteirizador: ' + ds.length + ' dia(s) de rota' + (ds.length ? ' (' + ds[0].split('-').reverse().slice(0, 2).join('/') + (ds.length > 1 ? ' a ' + ds[ds.length - 1].split('-').reverse().slice(0, 2).join('/') : '') + ')' : '') }); } } catch (e) { /* segue */ }
    } catch (e) {
      var msg = (e && e.message) || String(e);
      if (e && (e.code === 'not_granted' || e.code === 'not_writer')) msg = 'Só quem pode editar o portal consegue publicar uma atualização.';
      if (e && e.code === 'quota_or_state') msg = 'O espaço de arquivos do portal está cheio. Peça ao Claude para limpar arquivos antigos.';
      U.set({ st: 'error', err: 'A atualização não foi concluída: ' + msg + ' Os dados do portal continuam como estavam.' });
    }
  };

  // Permissão: esconde o envio para quem só visualiza.
  use('user').then(function (user) { return user ? (user.podeAtualizar ? user.podeAtualizar() : user.canEdit()) : null; }).then(function (can) {
    U.can = can;
    document.querySelectorAll('#nx-upd-file').forEach(function (i) { i.disabled = can === false; });
    document.querySelectorAll('#upd-envio-box').forEach(function (b) { b.hidden = can === false; });
    document.querySelectorAll('#upd-sem-permissao').forEach(function (p) { p.hidden = can !== false; });
  });
  document.querySelectorAll('#nx-upd-file').forEach(function (inp) {
    inp.addEventListener('change', function () { if (inp.files && inp.files[0]) U.read(inp.files[0]); });
  });
  document.querySelectorAll('#upd-drop').forEach(function (z) {
    z.addEventListener('dragover', function (e) { e.preventDefault(); z.classList.add('is-over'); });
    z.addEventListener('dragleave', function () { z.classList.remove('is-over'); });
    z.addEventListener('drop', function (e) { e.preventDefault(); z.classList.remove('is-over'); var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && U.can !== false) U.read(f); });
  });

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function stat(lbl, val) { var c = el('div', 'nx-upd-stat'); c.append(el('div', 'tc-sub', lbl), el('div', 'nx-upd-val', val)); return c; }

  dash.draw('upd', function (box) {
    box.replaceChildren();
    if (U.st === 'idle') return;
    if (U.st === 'reading') { box.append(el('p', 'nx-upd-msg', 'Lendo ' + U.file.name + '…')); return; }
    if (U.st === 'error') { box.append(el('p', 'nx-upd-msg nx-upd-err', U.err)); return; }
    if (U.st === 'publishing') { box.append(el('p', 'nx-upd-msg', U.step)); return; }
    if (U.st === 'done') {
      var ok = el('div', 'nx-upd-ok');
      ok.append(el('strong', null, 'Portal atualizado.'), el('span', null, ' ' + nf(U.done.novas) + ' entregas de ' + dbr(U.done.dias[0]) + ' a ' + dbr(U.done.dias[U.done.dias.length - 1]) + ' publicadas' + (U.done.alertas && U.done.alertas.rotas ? ', com os alertas de ' + nf(U.done.alertas.rotas) + ' rotas gravados em ' + nf(U.done.alertas.entregas) + ' entregas pendentes' : '') + '. Todos que abrirem o portal já veem os dados novos.'));
      box.append(ok); return;
    }
    var r = U.res;
    var head = el('div', 'nx-upd-file');
    head.append(el('strong', null, U.file.name), el('span', 'tc-sub', ' · ' + nf(r.linhas) + ' linhas lidas'));
    var grid = el('div', 'nx-upd-stats');
    grid.append(
      stat('Período do arquivo', dbr(r.dias[0]) + ' a ' + dbr(r.dias[r.dias.length - 1])),
      stat('Entregas no arquivo', nf(r.novas)),
      stat('Dias atualizados', nf(r.dias.filter(function (d) { return r.antes[d]; }).length)),
      stat('Dias novos', nf(r.dias.filter(function (d) { return !r.antes[d]; }).length)),
      stat('Dias mantidos do portal', nf(r.mantidos.length)),
      stat('Rotas com alerta gravado', nf(r.alertas ? r.alertas.rotas : 0))
    );
    var wrap = el('div', 'tc-tablewrap tc-scroll nx-upd-tab'), t = el('table', 'tc-table'), th = el('thead'), tr = el('tr');
    ['Dia', 'Entregas hoje no portal', 'Entregas no arquivo', 'Concluídas hoje', 'Concluídas no arquivo', 'Pendentes no arquivo'].forEach(function (h, i) { tr.append(el('th', i ? 'n' : null, h)); });
    th.append(tr); var tb = el('tbody');
    r.dias.slice().reverse().forEach(function (d) {
      var a = r.antes[d], b = r.depois[d], row = el('tr');
      row.append(el('td', null, dbr(d) + (a ? '' : ' (novo)')), el('td', 'n', a ? nf(+a.entregas) : '—'), el('td', 'n', nf(+b.entregas)), el('td', 'n', a ? nf(+a.concluidas) : '—'), el('td', 'n', nf(+b.concluidas)), el('td', 'n', nf(+b.pendentes)));
      tb.append(row);
    });
    t.append(th, tb); wrap.append(t);
    var acts = el('div', 'nx-upd-acts'), pub = el('button', 'nx-btn', 'Publicar no portal'), cancel = el('button', 'nx-btn nx-btn-sec', 'Cancelar');
    pub.type = 'button'; cancel.type = 'button';
    pub.onclick = function () { U.publish(); };
    cancel.onclick = function () { document.querySelectorAll('#nx-upd-file').forEach(function (i) { i.value = ''; }); U.set({ st: 'idle', res: null, file: null }); };
    acts.append(pub, cancel, el('span', 'tc-sub', 'Nada muda no portal até você publicar.'));
    box.append(head, grid, wrap, acts);
  });
  return U;
})();
