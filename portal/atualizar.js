// Leitor mínimo de planilhas (.xls BIFF8 e .xlsx) — devolve a 1ª aba como matriz de textos/números.
window.nxXls = (function () {
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 16777216; }
  function i32(b, o) { return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24); }

  // ---------- Compound File (OLE) ----------
  function cfbStream(buf, names) {
    var b = buf, dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (u32(b, 0) !== 0xE011CFD0 || u32(b, 4) !== 0xE11AB1A1) throw new Error('Arquivo não é uma planilha Excel (.xls) válida.');
    var ss = 1 << u16(b, 30), mss = 1 << u16(b, 32);
    var nFat = u32(b, 44), dirStart = u32(b, 48), miniCut = u32(b, 56);
    var miniFatStart = u32(b, 60), nMiniFat = u32(b, 64), difStart = u32(b, 68), nDif = u32(b, 72);
    function off(s) { return 512 + s * ss; }
    var fatSecs = [];
    for (var i = 0; i < 109 && fatSecs.length < nFat; i++) fatSecs.push(u32(b, 76 + i * 4));
    var d = difStart;
    for (var k = 0; k < nDif && fatSecs.length < nFat; k++) {
      var o = off(d), per = ss / 4 - 1;
      for (var j = 0; j < per && fatSecs.length < nFat; j++) fatSecs.push(u32(b, o + j * 4));
      d = u32(b, o + per * 4);
    }
    var per2 = ss / 4, fat = new Uint32Array(fatSecs.length * per2);
    fatSecs.forEach(function (s, n) { var o = off(s); for (var j = 0; j < per2; j++) fat[n * per2 + j] = u32(b, o + j * 4); });
    function chain(start) { var out = [], s = start, guard = 0; while (s < 0xFFFFFFFA && guard++ < fat.length + 1) { out.push(s); s = fat[s]; } return out; }
    function readChain(start, size) {
      var secs = chain(start), out = new Uint8Array(secs.length * ss);
      secs.forEach(function (s, n) { var o = off(s); out.set(b.subarray(o, Math.min(o + ss, b.length)), n * ss); });
      return size != null ? out.subarray(0, size) : out;
    }
    var dir = readChain(dirStart), entries = [];
    for (var p = 0; p + 128 <= dir.length; p += 128) {
      var nl = u16(dir, p + 64), name = '';
      for (var c = 0; c < nl / 2 - 1; c++) name += String.fromCharCode(u16(dir, p + c * 2));
      entries.push({ name: name, type: dir[p + 66], start: u32(dir, p + 116), size: u32(dir, p + 120) });
    }
    var e = entries.find(function (x) { return x.type === 2 && names.indexOf(x.name) >= 0; });
    if (!e) throw new Error('Não encontrei a planilha dentro do arquivo .xls.');
    if (e.size >= miniCut) return readChain(e.start, e.size);
    var root = readChain(entries[0].start), mfat = readChain(miniFatStart).subarray(0, nMiniFat * ss);
    var out = new Uint8Array(e.size), s = e.start, pos = 0;
    while (s < 0xFFFFFFFA && pos < e.size) { var n = Math.min(mss, e.size - pos); out.set(root.subarray(s * mss, s * mss + n), pos); pos += n; s = u32(mfat, s * 4); }
    return out;
  }

  // ---------- BIFF8 ----------
  function rk(v) {
    var n;
    if (v & 2) n = v >> 2;
    else { var a = new DataView(new ArrayBuffer(8)); a.setUint32(4, v & 0xFFFFFFFC, true); a.setUint32(0, 0, true); n = a.getFloat64(0, true); }
    return (v & 1) ? n / 100 : n;
  }
  function parseBiff(wb) {
    var dv = new DataView(wb.buffer, wb.byteOffset, wb.byteLength);
    var recs = [], p = 0;
    while (p + 4 <= wb.length) { var t = u16(wb, p), l = u16(wb, p + 2); recs.push({ t: t, o: p + 4, l: l }); p += 4 + l; }
    // SST com CONTINUE
    var sst = [], sheets = [];
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (r.t === 0x0085) {
        var pos = u32(wb, r.o), cch = wb[r.o + 6], fl = wb[r.o + 7], nm = '';
        for (var c = 0; c < cch; c++) nm += String.fromCharCode(fl & 1 ? u16(wb, r.o + 8 + c * 2) : wb[r.o + 8 + c]);
        sheets.push({ pos: pos, name: nm, kind: wb[r.o + 5] });
      }
      if (r.t === 0x00FC) {
        var parts = [r]; while (recs[i + 1] && recs[i + 1].t === 0x003C) parts.push(recs[++i]);
        sst = readSst(parts);
      }
    }
    function readSst(parts) {
      var pi = 0, q = parts[0].o + 8, end = parts[0].o + parts[0].l, n = u32(wb, parts[0].o + 4), out = [];
      function next() { pi++; q = parts[pi].o; end = parts[pi].o + parts[pi].l; }
      function need(k) { if (q + k > end) next(); }
      for (var s = 0; s < n; s++) {
        need(3);
        var cch = u16(wb, q), fl = wb[q + 2]; q += 3;
        var rt = 0, sz = 0;
        if (fl & 8) { rt = u16(wb, q); q += 2; }
        if (fl & 4) { sz = u32(wb, q); q += 4; }
        var str = '', wide = fl & 1, got = 0;
        while (got < cch) {
          if (q >= end) { next(); wide = wb[q] & 1; q += 1; }
          var avail = wide ? (end - q) >> 1 : end - q, take = Math.min(avail, cch - got), chunk = '';
          for (var c = 0; c < take; c++) chunk += String.fromCharCode(wide ? u16(wb, q + c * 2) : wb[q + c]);
          str += chunk; q += take * (wide ? 2 : 1); got += take;
        }
        var skip = rt * 4 + sz;
        while (skip > 0) { if (q >= end) next(); var t2 = Math.min(skip, end - q); q += t2; skip -= t2; }
        out.push(str);
      }
      return out;
    }
    var sh = sheets.find(function (x) { return x.kind === 0; }) || sheets[0];
    if (!sh) throw new Error('A planilha não tem abas.');
    var start = recs.findIndex(function (r) { return r.o - 4 === sh.pos; });
    var grid = [], lastFormula = null;
    function put(r, c, v) { (grid[r] || (grid[r] = []))[c] = v; }
    for (var j = start + 1; j < recs.length; j++) {
      var R = recs[j], o = R.o;
      if (R.t === 0x000A) break;
      if (R.t === 0x00FD) put(u16(wb, o), u16(wb, o + 2), sst[u32(wb, o + 6)]);
      else if (R.t === 0x0203) put(u16(wb, o), u16(wb, o + 2), dv.getFloat64(o + 6, true));
      else if (R.t === 0x027E) put(u16(wb, o), u16(wb, o + 2), rk(i32(wb, o + 6) >>> 0));
      else if (R.t === 0x00BD) {
        var row = u16(wb, o), c0 = u16(wb, o + 2), cnt = (R.l - 6) / 6;
        for (var m = 0; m < cnt; m++) put(row, c0 + m, rk(i32(wb, o + 4 + m * 6 + 2) >>> 0));
      } else if (R.t === 0x0204) {
        var cl = u16(wb, o + 6), wf = wb[o + 8] & 1, sv = '';
        for (var c3 = 0; c3 < cl; c3++) sv += String.fromCharCode(wf ? u16(wb, o + 9 + c3 * 2) : wb[o + 9 + c3]);
        put(u16(wb, o), u16(wb, o + 2), sv);
      } else if (R.t === 0x0006) {
        var rr = u16(wb, o), cc = u16(wb, o + 2);
        if (u16(wb, o + 12) === 0xFFFF) { var ty = wb[o + 6]; if (ty === 0) lastFormula = [rr, cc]; else if (ty === 1) put(rr, cc, wb[o + 8] ? 'TRUE' : 'FALSE'); }
        else put(rr, cc, dv.getFloat64(o + 6, true));
      } else if (R.t === 0x0207 && lastFormula) {
        var sl = u16(wb, o), sw = wb[o + 2] & 1, s2 = '';
        for (var c4 = 0; c4 < sl; c4++) s2 += String.fromCharCode(sw ? u16(wb, o + 3 + c4 * 2) : wb[o + 3 + c4]);
        put(lastFormula[0], lastFormula[1], s2); lastFormula = null;
      } else if (R.t === 0x0205) {
        if (!wb[o + 7]) put(u16(wb, o), u16(wb, o + 2), wb[o + 6] ? 'TRUE' : 'FALSE');
      }
    }
    return grid;
  }

  // ---------- XLSX ----------
  async function inflate(data) {
    var ds = new DecompressionStream('deflate-raw');
    var out = new Response(new Blob([data]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function unzip(b) {
    var e = b.length - 22; while (e >= 0 && u32(b, e) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Arquivo .xlsx inválido.');
    var n = u16(b, e + 10), p = u32(b, e + 16), files = {};
    for (var i = 0; i < n; i++) {
      var meth = u16(b, p + 10), csize = u32(b, p + 20), nl = u16(b, p + 28), xl = u16(b, p + 30), cl = u16(b, p + 32), lo = u32(b, p + 42);
      var name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
      files[name] = { meth: meth, csize: csize, lo: lo };
      p += 46 + nl + xl + cl;
    }
    return async function (name) {
      var f = files[name]; if (!f) return null;
      var o = f.lo + 30 + u16(b, f.lo + 26) + u16(b, f.lo + 28), raw = b.subarray(o, o + f.csize);
      return new TextDecoder().decode(f.meth === 0 ? raw : await inflate(raw));
    };
  }
  function xmlText(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); }).replace(/&#x([0-9a-f]+);/gi, function (_, d) { return String.fromCharCode(parseInt(d, 16)); }).replace(/&amp;/g, '&'); }
  function colNum(ref) { var m = /^([A-Z]+)/.exec(ref), n = 0; for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64; return n - 1; }
  async function parseXlsx(b) {
    var get = await unzip(b);
    var ss = [], sst = await get('xl/sharedStrings.xml');
    if (sst) (sst.match(/<si>[\s\S]*?<\/si>/g) || []).forEach(function (si) {
      ss.push((si.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).map(function (t) { return xmlText(t.replace(/^<t[^>]*>|<\/t>$/g, '')); }).join(''));
    });
    var wbx = await get('xl/workbook.xml'), rels = await get('xl/_rels/workbook.xml.rels'), path = 'xl/worksheets/sheet1.xml';
    var first = wbx && /<sheet [^>]*r:id="([^"]+)"/.exec(wbx);
    if (first && rels) { var m = new RegExp('<Relationship [^>]*Id="' + first[1] + '"[^>]*Target="([^"]+)"').exec(rels) || new RegExp('<Relationship [^>]*Target="([^"]+)"[^>]*Id="' + first[1] + '"').exec(rels); if (m) path = m[1].charAt(0) === '/' ? m[1].slice(1) : 'xl/' + m[1]; }
    var xml = await get(path); if (!xml) throw new Error('Não encontrei a primeira aba do .xlsx.');
    var grid = [], re = /<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, mm, r = -1;
    var rowRe = /<row [^>]*?r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g, rm;
    while ((rm = rowRe.exec(xml))) {
      r = +rm[1] - 1; var row = grid[r] = [];
      re.lastIndex = 0;
      while ((mm = re.exec(rm[2]))) {
        var at = mm[1], body = mm[2] || '', ref = /r="([A-Z]+\d+)"/.exec(at), t = /t="(\w+)"/.exec(at);
        var vm = /<v>([\s\S]*?)<\/v>/.exec(body), v;
        if (t && t[1] === 's') v = vm ? ss[+vm[1]] : '';
        else if (t && t[1] === 'inlineStr') v = xmlText((/<t[^>]*>([\s\S]*?)<\/t>/.exec(body) || ['', ''])[1]);
        else if (t && (t[1] === 'str' || t[1] === 'e')) v = vm ? xmlText(vm[1]) : '';
        else if (t && t[1] === 'b') v = vm && vm[1] === '1' ? 'TRUE' : 'FALSE';
        else v = vm ? +vm[1] : '';
        row[ref ? colNum(ref[1]) : row.length] = v;
      }
    }
    return grid;
  }

  async function read(arrayBuffer) {
    var b = new Uint8Array(arrayBuffer), grid;
    if (b[0] === 0x50 && b[1] === 0x4B) grid = await parseXlsx(b);
    else if (b[0] === 0xD0 && b[1] === 0xCF) grid = parseBiff(cfbStream(b, ['Workbook', 'Book']));
    else throw new Error('Formato não reconhecido. Envie o relatório em .xls ou .xlsx.');
    var w = 0; grid.forEach(function (r) { if (r && r.length > w) w = r.length; });
    var out = [];
    for (var i = 0; i < grid.length; i++) { var r = grid[i] || [], row = new Array(w); for (var c = 0; c < w; c++) row[c] = r[c] == null ? '' : r[c]; out.push(row); }
    return out;
  }
  return { read: read };
})();
// Transforma o relatório AnaliticoRota nas tabelas do portal.
window.nxTransform = (function () {
  var NEED = ['Data Rota', 'Nome Rota', 'Código Cliente', 'Nome Cliente', 'Entrega Efetuada', 'Status Rota', 'Sequência Entrega Planejado'];
  function s(v) { return v == null ? '' : String(v).trim(); }
  // Aceita "dd/mm/aaaa hh:mm[:ss]", "aaaa-mm-dd hh:mm" e datas numéricas do Excel (arquivo salvo de novo pelo Excel).
  function txt(v) {
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      var d = new Date(Math.round((v - 25569) * 86400000)), p = function (n) { return (n < 10 ? '0' : '') + n; };
      return p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
    }
    var t = s(v), m = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d:\d\d))?/.exec(t);
    if (m) return m[3] + '/' + m[2] + '/' + m[1] + (m[4] ? ' ' + m[4] : '');
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/.exec(t);
    if (m) return (m[1].length < 2 ? '0' : '') + m[1] + '/' + (m[2].length < 2 ? '0' : '') + m[2] + '/' + m[3] + m[4];
    return t;
  }
  function isoD(v) { var m = /^(\d\d)\/(\d\d)\/(\d{4})/.exec(txt(v)); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }
  function isoDt(v) { var m = /^(\d\d)\/(\d\d)\/(\d{4}) (\d\d:\d\d)/.exec(txt(v)); return m ? m[3] + '-' + m[2] + '-' + m[1] + ' ' + m[4] : ''; }
  function hhmm(v) { var m = /^\d\d\/\d\d\/\d{4} (\d\d:\d\d)/.exec(txt(v)); return m ? m[1] : ''; }
  function int(v) { return v === '' || v == null || isNaN(+v) ? '' : String(Math.round(+v)); }
  function num(v) { return v === '' || v == null || isNaN(+v) ? '' : String(+v); }
  function mins(a, b) { if (!a || !b) return ''; var t = function (x) { return Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10), +x.slice(11, 13), +x.slice(14, 16)); }; return String(Math.round((t(b) - t(a)) / 60000)); }
  function pct(n, d) { return d ? (Math.round(n / d * 1000) / 10).toFixed(1) : ''; }
  function rate(rows, col) { var y = 0, n = 0; rows.forEach(function (r) { if (r[col] === 'SIM') y++; else if (r[col] === 'NÃO') n++; }); return pct(y, y + n); }

  var TOLERANCIA_MIN = 60;
  // Dia-alvo da entrega: o dia da chegada planejada; se o roteirizador previu chegar mais de 1 h depois do fim
  // da janela, o alvo passa a ser a janela do dia seguinte.
  function alvo(janela, chegPrev, chegReal) {
    var p = String(chegPrev || ''), d0 = (p || String(chegReal || '')).slice(0, 10), fim = String(janela || '').split('–')[1];
    if (!p || !/^\d\d:\d\d$/.test(fim || '') || !/^\d\d:\d\d$/.test(p.slice(11, 16))) return d0;
    var f = +fim.slice(0, 2) * 60 + +fim.slice(3, 5), h = +p.slice(11, 13) * 60 + +p.slice(14, 16);
    if (h <= f + TOLERANCIA_MIN) return d0;
    var t = new Date(Date.parse(d0 + 'T00:00:00Z') + 864e5);
    return t.toISOString().slice(0, 10);
  }
  // Regra da janela (vale para todas as medições de SLA do portal): a entrega é SIM quando a chegada no
  // cliente acontece até 1 hora depois do FIM da janela, pelo horário do dia em que chegou; chegada em
  // dia anterior ao dia-alvo (antecipada) também conta. Janela sem horário real (início = fim) usa o dia-alvo da entrega (ver alvo()).
  function hm(t) { return /^\d\d:\d\d$/.test(t || '') ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : null; }
  function slaJanela(janela, chegPrev, chegReal, orig) {
    if ((orig !== 'SIM' && orig !== 'NÃO') || !chegReal || !janela) return orig;
    var p = String(janela).split('–'), ini = hm(p[0]), fim = hm(p[1]);
    if (fim === null) return orig;
    if (ini !== null && ini !== fim) { if (String(chegReal).slice(0, 10) < alvo(janela, chegPrev, chegReal)) return 'SIM'; var c = hm(String(chegReal).slice(11, 16)); return c === null ? orig : (c <= fim + TOLERANCIA_MIN ? 'SIM' : 'NÃO'); }
    var limite = Date.parse(alvo(janela, chegPrev, chegReal) + 'T' + p[1] + ':00Z') + TOLERANCIA_MIN * 60000;
    var real = Date.parse(String(chegReal).replace(' ', 'T') + ':00Z');
    if (isNaN(limite) || isNaN(real)) return orig;
    return real <= limite ? 'SIM' : 'NÃO';
  }
  // Regra do On Time: chegada até 1 hora depois do INÍCIO da janela, pelo horário do dia em que chegou
  // (antecipada também conta). Pendentes ficam como vieram do roteirizador.
  function onTime(janela, chegPrev, chegReal, entregue, orig) {
    if (entregue !== 'SIM' || !chegReal || !janela) return orig;
    var p = String(janela).split('–'), ini = hm(p[0]), fim = hm(p[1]);
    if (ini === null) return orig;
    if (fim !== null && ini !== fim) { if (String(chegReal).slice(0, 10) < alvo(janela, chegPrev, chegReal)) return 'SIM'; var c = hm(String(chegReal).slice(11, 16)); return c === null ? orig : (c <= ini + TOLERANCIA_MIN ? 'SIM' : 'NÃO'); }
    var limite = Date.parse(alvo(janela, chegPrev, chegReal) + 'T' + p[0] + ':00Z') + TOLERANCIA_MIN * 60000;
    var real = Date.parse(String(chegReal).replace(' ', 'T') + ':00Z');
    if (isNaN(limite) || isNaN(real)) return orig;
    return real <= limite ? 'SIM' : 'NÃO';
  }
  // Regra do OTIF: entrega realizada no prazo (On Time pela regra do portal) e sem ocorrência
  // (Falta, Avaria, Qualidade, Devolução). Sem On Time avaliado, fica como veio do roteirizador.
  function otif(onTimeV, ocorrencia, entregue, orig) {
    if (entregue !== 'SIM' || (onTimeV !== 'SIM' && onTimeV !== 'NÃO')) return orig;
    return onTimeV === 'SIM' && !ocorrencia ? 'SIM' : 'NÃO';
  }
  function aplicaSla(r) {
    var orig = r.sla_janela_relatorio != null && r.sla_janela_relatorio !== '' ? r.sla_janela_relatorio : r.sla_janela;
    var origOt = r.on_time_relatorio != null && r.on_time_relatorio !== '' ? r.on_time_relatorio : r.on_time;
    var origOf = r.otif_relatorio != null && r.otif_relatorio !== '' ? r.otif_relatorio : r.otif;
    var ot = onTime(r.janela, r.chegada_prevista, r.chegada_real, r.entregue, origOt);
    return Object.assign({}, r, {
      sla_janela_relatorio: orig, sla_janela: slaJanela(r.janela, r.chegada_prevista, r.chegada_real, orig),
      on_time_relatorio: origOt, on_time: ot,
      otif_relatorio: origOf, otif: otif(ot, r.ocorrencia, r.entregue, origOf)
    });
  }
  function pctTaxa(rows, col) { var y = 0, n = 0; rows.forEach(function (r) { if (r[col] === 'SIM') y++; else if (r[col] === 'NÃO') n++; }); return n + y ? (Math.round(y / (y + n) * 1000) / 10).toFixed(1) : ''; }
  // Recalcula o % SLA janela do resumo diário e das rotas a partir das entregas (vale para todo o histórico).
  function refreshSla(tables) {
    var E = tables.entregas_cliente || [], porDia = {}, porRota = {};
    E.forEach(function (r) { (porDia[r.data] = porDia[r.data] || []).push(r); var k = r.data + '|' + r.rota; (porRota[k] = porRota[k] || []).push(r); });
    (tables.resumo_dia || []).forEach(function (r, i, a) { if (porDia[r.data]) a[i] = Object.assign({}, r, { sla_janela_pct: pctTaxa(porDia[r.data], 'sla_janela'), on_time_pct: pctTaxa(porDia[r.data], 'on_time'), otif_pct: pctTaxa(porDia[r.data], 'otif') }); });
    (tables.rotas_dia || []).forEach(function (r, i, a) { var x = porRota[r.data + '|' + r.rota]; if (x) a[i] = Object.assign({}, r, { sla_janela_pct: pctTaxa(x, 'sla_janela'), on_time_pct: pctTaxa(x, 'on_time') }); });
  }

  // Coordenadas do cliente: corrige latitude/longitude trocadas e descarta valores fora do Brasil.
  function coord(la, lo) {
    var a = +la, b = +lo;
    if (!isFinite(a) || !isFinite(b) || (!a && !b)) return ['', ''];
    if (a < -40 && b > -40) { var t = a; a = b; b = t; }
    if (a < -34.5 || a > 6 || b < -74.5 || b > -28) return ['', ''];
    return [String(Math.round(a * 1e5) / 1e5), String(Math.round(b * 1e5) / 1e5)];
  }

  // Aderência ao app: entrega realizada com a baixa registrada no app a até 500 m do cliente.
  var RAIO_APP_M = 500;
  function appRaio(entregue, latEnt, dist) {
    if (entregue !== 'SIM') return '-';
    var la = +latEnt, d = +dist;
    if (!isFinite(la) || !la) return 'NÃO';
    return isFinite(d) && d > 0 && d <= RAIO_APP_M ? 'SIM' : 'NÃO';
  }

  function header(grid) {
    for (var i = 0; i < Math.min(grid.length, 20); i++) {
      var h = grid[i].map(s);
      if (NEED.every(function (n) { return h.indexOf(n) >= 0; })) return i;
    }
    var first = (grid[0] || []).map(s);
    var miss = NEED.filter(function (n) { return first.indexOf(n) < 0; });
    throw new Error('Este arquivo não parece ser o relatório Analítico de Rotas: faltam as colunas ' + miss.join(', ') + '.');
  }

  function entregas(grid) {
    var hi = header(grid), h = grid[hi].map(s), ix = {};
    h.forEach(function (n, i) { if (!(n in ix)) ix[n] = i; });
    function g(row, n) { var i = ix[n]; return i == null ? '' : row[i]; }
    var out = [], seen = {};
    for (var r = hi + 1; r < grid.length; r++) {
      var row = grid[r];
      var data = isoD(g(row, 'Data Rota')), rota = s(g(row, 'Nome Rota')), codigo = s(g(row, 'Código Cliente'));
      if (!data || !rota) continue;
      var ent = s(g(row, 'Entrega Efetuada')), oc = s(g(row, 'Descrição Ocorrência'));
      var sp = int(g(row, 'Sequência Entrega Planejado'));
      var key = data + '|' + rota + '|' + sp + '|' + codigo, k = seen[key] = (seen[key] == null ? 0 : seen[key] + 1);
      var saida = isoDt(g(row, 'Início Rota Realizado')), cheg = isoDt(g(row, 'Chegada Cliente Realizado'));
      var pend = ent !== 'SIM';
      var ll = coord(g(row, 'Latitude Cliente'), g(row, 'Longitude Cliente'));
      if (!ll[0]) ll = coord(g(row, 'Latitude Entrega'), g(row, 'Longitude Entrega'));
      var ji = s(g(row, 'Janela Atendimento Entrega Inicial (1)')), jf = s(g(row, 'Janela Atendimento Entrega Final (1)'));
      out.push({
        data: data, codigo: codigo, cliente: s(g(row, 'Nome Cliente')), grupo: s(g(row, 'ID Tipo Cliente')), endereco: s(g(row, 'Endereço')), bairro: s(g(row, 'Bairro')),
        cidade: s(g(row, 'Cidade')), uf: s(g(row, 'Estado')), lat: ll[0], lon: ll[1], rota: rota, transportadora: s(g(row, 'Nome Transportadora')),
        deposito: s(g(row, 'Nome Depósito')), placa: s(g(row, 'Placa')), motorista: s(g(row, 'Nome Motorista')), seq_planejada: sp, seq_realizada: int(g(row, 'Sequência Entrega Realizado')),
        status_rota: s(g(row, 'Status Rota')), entregue: ent, carregamento: isoDt(g(row, 'Carregamento Rota')), saida_prevista: isoDt(g(row, 'Início Rota Planejado')), saida_cd: saida,
        chegada_prevista: isoDt(g(row, 'Chegada Cliente Planejado')), chegada_real: cheg,
        inicio_atend: isoDt(g(row, 'Início Atendimento Cliente Realizado')), fim_atend: isoDt(g(row, 'Fim Atendimento Cliente Realizado')),
        limite: isoDt(g(row, 'Data Limite Atendimento')), janela: ji && jf ? ji + '–' + jf : '',
        sla_janela: slaJanela(ji && jf ? ji + '–' + jf : '', isoDt(g(row, 'Chegada Cliente Planejado')), cheg, s(g(row, 'SLA Janela Atendimento'))),
        sla_janela_relatorio: s(g(row, 'SLA Janela Atendimento')),
        on_time_relatorio: s(g(row, 'On Time')), on_time: onTime(ji && jf ? ji + '–' + jf : '', isoDt(g(row, 'Chegada Cliente Planejado')), cheg, ent, s(g(row, 'On Time'))), otif: otif(onTime(ji && jf ? ji + '–' + jf : '', isoDt(g(row, 'Chegada Cliente Planejado')), cheg, ent, s(g(row, 'On Time'))), oc, ent, s(g(row, 'OTIF Entrega'))), otif_relatorio: s(g(row, 'OTIF Entrega')),
        ocorrencia: oc, comentario: s(g(row, 'Comentários Ocorrência')),
        min_espera: pend ? '' : int(g(row, 'Minutos Espera Entrega')), min_descarga: pend ? '' : int(g(row, 'Minutos Descarga Entrega')), min_atendimento: pend ? '' : int(g(row, 'Minutos Total Entrega')),
        min_cd_ate_cliente: mins(saida, cheg), peso_kg: num(g(row, 'Peso Entrega')), volumes: int(g(row, 'Volume Entrega')),
        app_baixa: ent !== 'SIM' ? '-' : (+g(row, 'Latitude Entrega') ? 'SIM' : 'NÃO'),
        dist_baixa_m: (function (d) { d = +d; return isFinite(d) && d > 0 ? String(Math.round(d)) : ''; })(g(row, 'Distância Cliente (metros)')),
        app_no_raio: appRaio(ent, g(row, 'Latitude Entrega'), g(row, 'Distância Cliente (metros)')),
        situacao: ent !== 'SIM' ? 'Pendente' : oc === 'Devolução Total' ? 'Devolução total' : oc ? 'Entregue com ocorrência' : 'Entregue',
        id: key + '|' + k,
        _chegPrevRaw: txt(g(row, 'Chegada Cliente Planejado')), _inicio: hhmm(g(row, 'Início Rota Realizado')), _fim: hhmm(g(row, 'Fim Rota Realizado')),
        _transito: s(g(row, 'Em Trânsito'))
      });
    }
    if (!out.length) {
      var linhas = 0;
      for (var q = hi + 1; q < grid.length; q++) if (grid[q].some(function (c) { return s(c) !== ''; })) linhas++;
      if (!linhas) throw new Error('O arquivo veio vazio: só tem a linha de títulos, sem nenhuma rota. Exporte o relatório de novo no roteirizador (confira o período e os filtros) e envie o arquivo novo.');
      var ex = grid[hi + 1] ? s(g(grid[hi + 1], 'Data Rota')) : '';
      throw new Error('O arquivo tem ' + linhas + ' linhas, mas não consegui ler a Data Rota ou o Nome Rota delas' + (ex ? ' (exemplo de data: "' + ex + '")' : '') + '. Envie o relatório exatamente como sai do roteirizador, sem abrir e salvar no Excel.');
    }
    return out;
  }

  function group(rows, keyFn) { var m = new Map(); rows.forEach(function (r) { var k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; }

  function derive(E) {
    var resumo = [], rotas = [], ocor = [], pend = [];
    var byDay = group(E, function (r) { return r.data; });
    Array.from(byDay.keys()).sort().forEach(function (d) {
      var x = byDay.get(d), conc = x.filter(function (r) { return r.entregue === 'SIM'; }).length;
      var p = x.filter(function (r) { return r.entregue !== 'SIM'; }), oc = x.filter(function (r) { return r.ocorrencia; }).length;
      var peso = x.reduce(function (a, r) { return a + (+r.peso_kg || 0); }, 0);
      resumo.push({
        data: d, rotas: new Set(x.map(function (r) { return r.rota; })).size, entregas: x.length, concluidas: conc, pendentes: p.length, ocorrencias: oc,
        em_transito: x.filter(function (r) { return r._transito === 'SIM'; }).length,
        pend_execucao: p.filter(function (r) { return r.status_rota === 'EmExecucao'; }).length,
        pend_standby: p.filter(function (r) { return r.status_rota === 'StandBy'; }).length,
        pend_baldeio: p.filter(function (r) { return r.status_rota === 'Baldeio'; }).length,
        peso_entregue_kg: Math.round(peso).toFixed(1), pct_concluidas: pct(conc, x.length), pct_ocorrencia: pct(oc, x.length),
        sla_janela_pct: rate(x, 'sla_janela'), on_time_pct: rate(x, 'on_time'), otif_pct: rate(x, 'otif')
      });
      var tipos = group(x.filter(function (r) { return r.ocorrencia; }), function (r) { return r.ocorrencia; });
      Array.from(tipos.keys()).sort().forEach(function (t) { ocor.push({ data: d, ocorrencia: t, qtd: tipos.get(t).length }); });
      var byRota = group(x, function (r) { return r.rota; });
      Array.from(byRota.keys()).sort().forEach(function (k) {
        var y = byRota.get(k), f = y[0], c = y.filter(function (r) { return r.entregue === 'SIM'; }).length;
        rotas.push({
          data: d, rota: k, transportadora: f.transportadora, deposito: f.deposito, status_rota: f.status_rota, inicio: f._inicio, fim: f._fim,
          entregas: y.length, concluidas: c, pendentes: y.length - c, ocorrencias: y.filter(function (r) { return r.ocorrencia; }).length,
          pct_concluidas: pct(c, y.length), sla_janela_pct: rate(y, 'sla_janela'), on_time_pct: rate(y, 'on_time')
        });
      });
    });
    var pseen = {};
    E.forEach(function (r) {
      if (r.entregue === 'SIM') return;
      var k = r.data + '|' + r.rota + '|' + r.seq_planejada, n = pseen[k] = (pseen[k] == null ? 0 : pseen[k] + 1);
      pend.push({ data: r.data, rota: r.rota, seq: r.seq_planejada, cliente: r.cliente, cidade: r.cidade, uf: r.uf, status_rota: r.status_rota, chegada_prevista: r._chegPrevRaw, transportadora: r.transportadora, id: k + '|' + n });
    });
    return { resumo_dia: resumo, rotas_dia: rotas, ocorrencias_dia: ocor, pendentes: pend };
  }

  function clientes(E) {
    var by = group(E, function (r) { return r.codigo; }), out = [];
    Array.from(by.keys()).sort().forEach(function (k) {
      var y = by.get(k), last = y.reduce(function (a, r) { return r.data > a.data ? r : a; }, y[0]), c = y.filter(function (r) { return r.entregue === 'SIM'; }).length;
      out.push({
        codigo: k, cliente: last.cliente, cidade: last.cidade, uf: last.uf, entregas: y.length, concluidas: c, pendentes: y.length - c,
        ocorrencias: y.filter(function (r) { return r.ocorrencia; }).length, ultima_entrega: last.data,
        sla_janela_pct: rate(y, 'sla_janela'), on_time_pct: rate(y, 'on_time')
      });
    });
    return out;
  }

  var COLS = {
    resumo_dia: ['data', 'rotas', 'entregas', 'concluidas', 'pendentes', 'ocorrencias', 'em_transito', 'pend_execucao', 'pend_standby', 'pend_baldeio', 'peso_entregue_kg', 'pct_concluidas', 'pct_ocorrencia', 'sla_janela_pct', 'on_time_pct', 'otif_pct'],
    ocorrencias_dia: ['data', 'ocorrencia', 'qtd'],
    rotas_dia: ['data', 'rota', 'transportadora', 'deposito', 'status_rota', 'inicio', 'fim', 'entregas', 'concluidas', 'pendentes', 'ocorrencias', 'pct_concluidas', 'sla_janela_pct', 'on_time_pct', 'alerta', 'alerta_obs'],
    pendentes: ['data', 'rota', 'seq', 'cliente', 'cidade', 'uf', 'status_rota', 'chegada_prevista', 'transportadora', 'alerta', 'alerta_obs', 'id'],
    clientes: ['codigo', 'cliente', 'cidade', 'uf', 'entregas', 'concluidas', 'pendentes', 'ocorrencias', 'ultima_entrega', 'sla_janela_pct', 'on_time_pct'],
    entregas_cliente: ['data', 'codigo', 'cliente', 'grupo', 'endereco', 'bairro', 'cidade', 'uf', 'lat', 'lon', 'rota', 'transportadora', 'deposito', 'placa', 'motorista', 'seq_planejada', 'seq_realizada', 'status_rota', 'entregue', 'carregamento', 'saida_prevista', 'saida_cd', 'chegada_prevista', 'chegada_real', 'inicio_atend', 'fim_atend', 'limite', 'janela', 'sla_janela', 'on_time', 'otif', 'ocorrencia', 'comentario', 'min_espera', 'min_descarga', 'min_atendimento', 'min_cd_ate_cliente', 'peso_kg', 'volumes', 'app_baixa', 'dist_baixa_m', 'app_no_raio', 'situacao', 'sla_janela_relatorio', 'on_time_relatorio', 'otif_relatorio', 'alerta', 'alerta_obs', 'alerta_em', 'id']
  };

  function csv(rows, cols) {
    function q(v) { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    return cols.join(',') + '\n' + rows.map(function (r) { return cols.map(function (c) { return q(r[c]); }).join(','); }).join('\n') + '\n';
  }

  // Mescla: datas presentes no arquivo novo substituem as antigas; datas só no portal ficam.
  function merge(oldRows, newRows) {
    var dates = new Set(newRows.map(function (r) { return r.data; }));
    return oldRows.filter(function (r) { return !dates.has(String(r.data)); }).concat(newRows)
      .sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
  }

  var TIPOS = { sinistro: 'Sinistro – carga roubada (recolocar os pedidos)', socorro: 'Carro quebrado – buscando socorro', quebrado_prox: 'Carro quebrado – carga seguirá no próximo dia', reprogramado: 'Reprogramado para o próximo dia', atraso_saida: 'Saída com atraso – possíveis atrasos nas entregas', baixa_manual: 'Baixa manual – entregue (falha no app)', outro: 'Outra divergência' };
  // Baixa manual: entrega apontada como entregue pelo monitoramento quando o app do motorista falhou.
  function baixaManual(rows, alertas) {
    var A = alertas || {};
    return rows.map(function (r) {
      if (r.entregue === 'SIM') return r;
      var a = A[String(r.data) + '|' + String(r.rota)];
      if (!a || a.tipo !== 'baixa_manual' || (a.ids && a.ids.length && a.ids.indexOf(r.id) < 0)) return r;
      var em = a.entregue_em || '';
      return Object.assign({}, r, { entregue: 'SIM', situacao: 'Entregue (baixa manual)', chegada_real: r.chegada_real || em, inicio_atend: r.inicio_atend || em, fim_atend: r.fim_atend || em, comentario: (r.comentario ? r.comentario + ' · ' : '') + 'Baixa manual pelo monitoramento (falha no app)' + (a.obs ? ': ' + a.obs : '') });
    });
  }
  // Grava os alertas das rotas nas tabelas: rota do dia, entregas pendentes da rota e lista de pendentes.
  // Os alertas cadastrados no portal são a referência; um alerta removido some das tabelas.
  function annotate(tables, alertas) {
    var A = alertas || {}, n = 0, rotas = {};
    function get(r) { return A[String(r.data) + '|' + String(r.rota)] || null; }
    function lbl(a) { return TIPOS[a.tipo] || a.label || 'Alerta'; }
    (tables.entregas_cliente || []).forEach(function (r, i, arr) {
      var a = r.entregue !== 'SIM' ? get(r) : null;
      arr[i] = Object.assign({}, r, { alerta: a ? lbl(a) : '', alerta_obs: a ? (a.obs || '') : '', alerta_em: a ? (a.em || '') : '' });
      if (a) n++;
    });
    (tables.rotas_dia || []).forEach(function (r, i, arr) {
      var a = get(r); arr[i] = Object.assign({}, r, { alerta: a ? lbl(a) : '', alerta_obs: a ? (a.obs || '') : '' });
      if (a) rotas[r.data + '|' + r.rota] = 1;
    });
    (tables.pendentes || []).forEach(function (r, i, arr) {
      var a = get(r); arr[i] = Object.assign({}, r, { alerta: a ? lbl(a) : '', alerta_obs: a ? (a.obs || '') : '' });
    });
    return { entregas: n, rotas: Object.keys(rotas).length };
  }

  function build(grid, oldEntregas, oldDerived, alertas) {
    var E = baixaManual(entregas(grid), alertas);
    var gmap = {}; E.forEach(function (r) { if (r.grupo) gmap[r.codigo] = r.grupo; });
    var oldE = baixaManual(oldEntregas || [], alertas).map(function (r) { return r.grupo || !gmap[r.codigo] ? r : Object.assign({}, r, { grupo: gmap[r.codigo] }); });
    var allE = merge(oldE, E).map(aplicaSla);
    var D = derive(E), out = { entregas_cliente: allE, clientes: clientes(allE) };
    Object.keys(D).forEach(function (k) { out[k] = merge((oldDerived && oldDerived[k]) || [], D[k]); });
    var dias = Array.from(new Set(E.map(function (r) { return r.data; }))).sort();
    refreshSla(out);
    var al = annotate(out, alertas);
    return { tables: out, novas: E.length, dias: dias, cols: COLS, csv: csv, alertas: al };
  }
  return { build: build, annotate: annotate, aplicaSla: aplicaSla, refreshSla: refreshSla, slaJanela: slaJanela, entregas: entregas, derive: derive, clientes: clientes, COLS: COLS, csv: csv };
})();
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
    snap.docs.forEach(function (d) { var a = d.data(); if (a && a.data && a.rota) m[a.data + '|' + a.rota] = a; });
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
    } catch (e) {
      var msg = (e && e.message) || String(e);
      if (e && (e.code === 'not_granted' || e.code === 'not_writer')) msg = 'Só quem pode editar o portal consegue publicar uma atualização.';
      if (e && e.code === 'quota_or_state') msg = 'O espaço de arquivos do portal está cheio. Peça ao Claude para limpar arquivos antigos.';
      U.set({ st: 'error', err: 'A atualização não foi concluída: ' + msg + ' Os dados do portal continuam como estavam.' });
    }
  };

  // Permissão: esconde o envio para quem só visualiza.
  use('user').then(function (user) { return user ? user.canEdit() : null; }).then(function (can) {
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
