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
