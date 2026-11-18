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

  var TIPOS = { sinistro: 'Sinistro – carga roubada (recolocar os pedidos)', socorro: 'Carro quebrado – buscando socorro', quebrado_prox: 'Carro quebrado – carga seguirá no próximo dia', reprogramado: 'Reprogramado para o próximo dia', baixa_manual: 'Baixa manual – entregue (falha no app)', outro: 'Outra divergência' };
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
