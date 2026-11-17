// PDF das regras do variável (sem bibliotecas): A4, Helvetica, marca d'água com o logo da Nexxa.
TC.pdfRegras = (() => {
const W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const base = (ch) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
const cw = (ch, bold) => { const b = base(ch); const c = b.charCodeAt(0); let w = c >= 32 && c <= 126 ? W[c - 32] : ch === '•' ? 350 : ch === '—' ? 1000 : ch === '–' ? 556 : 556; return bold ? w * 1.07 : w; };
const tw = (s, size, bold) => Array.from(s).reduce((a, ch) => a + cw(ch, bold), 0) * size / 1000;
const MAP = {'€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94};
const fix = (s) => String(s).replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/★/g, '*').replace(/×/g, 'x').replace(/→/g, '->');
const latin = (s) => Array.from(fix(s)).map((ch) => { const c = ch.charCodeAt(0); const b = MAP[ch] || (c < 256 ? c : 63); return String.fromCharCode(b); }).join('');
const pdfStr = (s) => '(' + latin(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ')';
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((x) => x.toFixed(3)).join(' '); };
const wrap = (s, size, bold, maxW) => { const out = []; let line = ''; String(s).split(/\s+/).forEach((w) => { const t = line ? line + ' ' + w : w; if (tw(t, size, bold) > maxW && line) { out.push(line); line = w; } else line = t; }); if (line) out.push(line); return out; };
const logoJpeg = async (fundo) => {
const img = document.querySelector('.nx-logo img'); if (!img) return null;
const im = new Image(); im.src = img.src; await im.decode().catch(() => null);
if (!im.naturalWidth) return null;
const k = 3, cv = document.createElement('canvas'); cv.width = im.naturalWidth * k; cv.height = im.naturalHeight * k;
const g = cv.getContext('2d'); g.fillStyle = fundo; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
const url = cv.toDataURL('image/jpeg', 0.92); const bin = atob(url.split(',')[1]);
return {w: cv.width, h: cv.height, bin};
};
// blocos: {t:'h1'|'h2'|'p'|'li'|'table'|'box', ...}
return async (doc) => {
const PW = 595.28, PH = 841.89, M = 48, CW = PW - 2 * M;
const G1 = '#0B3B22', G2 = '#2E8B4A', SOFT = '#EAF5EE', TXT = '#1F2A24', MUT = '#5B6B62';
const logo = await logoJpeg('#FFFFFF');
const pages = []; let ops = [], y = 0;
const T = (x, yy, s, size, bold, color) => { ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + rgb(color || TXT) + ' rg ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' Td ' + pdfStr(s) + ' Tj ET'); };
const R = (x, yy, w, h, color) => { ops.push(rgb(color) + ' rg ' + [x, yy, w, h].map((v) => v.toFixed(2)).join(' ') + ' re f'); };
const L = (x1, y1, x2, y2, color, wd) => { ops.push(rgb(color) + ' RG ' + (wd || 0.6) + ' w ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' l S'); };
const novaPagina = () => {
if (ops.length) pages.push(ops);
ops = [];
// marca d'água: logo grande, girado e transparente
if (logo) { const w = 420, h = w * logo.h / logo.w; ops.push('q /GSw gs ' + [Math.cos(0.5), Math.sin(0.5), -Math.sin(0.5), Math.cos(0.5), PW / 2, PH / 2].map((v) => v.toFixed(4)).join(' ') + ' cm ' + w + ' 0 0 ' + h.toFixed(2) + ' ' + (-w / 2) + ' ' + (-h / 2).toFixed(2) + ' cm /ImW Do Q'); }
// faixa do topo
R(0, PH - 86, PW, 86, G1); R(0, PH - 90, PW, 4, G2);
if (logo) { const h = 30, w = h * logo.w / logo.h; R(M - 8, PH - 66, w + 16, h + 12, '#FFFFFF'); ops.push('q ' + w.toFixed(2) + ' 0 0 ' + h + ' ' + M + ' ' + (PH - 60) + ' cm /ImL Do Q'); }
T(PW - M - tw(doc.titulo, 15, true), PH - 42, doc.titulo, 15, true, '#FFFFFF');
T(PW - M - tw(doc.sub, 9.5), PH - 60, doc.sub, 9.5, false, '#CFE8D7');
// rodapé
L(M, 40, PW - M, 40, '#C9D6CE', 0.6);
T(M, 26, doc.rodape, 8, false, MUT);
const pg = 'Página ' + (pages.length + 1); T(PW - M - tw(pg, 8), 26, pg, 8, false, MUT);
y = PH - 116;
};
const precisa = (h) => { if (y - h < 56) novaPagina(); };
novaPagina();
doc.blocos.forEach((b) => {
if (b.t === 'h1') { precisa(40); y -= 6; R(M, y - 4, 4, 18, G2); T(M + 12, y, b.s, 14, true, G1); y -= 24; }
else if (b.t === 'h2') { precisa(28); T(M, y, b.s, 11, true, G2); y -= 17; }
else if (b.t === 'p' || b.t === 'li') {
const x = b.t === 'li' ? M + 14 : M, lines = wrap(b.s, 9.6, false, CW - (x - M));
precisa(lines.length * 13 + 4);
if (b.t === 'li') R(M + 4, y + 2.4, 3.4, 3.4, G2);
lines.forEach((ln) => { T(x, y, ln, 9.6, false, TXT); y -= 13; }); y -= 3;
}
else if (b.t === 'box') {
const lines = wrap(b.s, 9.6, !!b.bold, CW - 24), h = lines.length * 13 + 14;
precisa(h + 8); R(M, y - h + 10, CW, h, SOFT); R(M, y - h + 10, 3, h, G2);
let yy = y - 2; lines.forEach((ln) => { T(M + 14, yy, ln, 9.6, !!b.bold, G1); yy -= 13; }); y -= h + 8;
}
else if (b.t === 'table') {
const cols = b.cols, tot = cols.reduce((a, c) => a + c.w, 0), ws = cols.map((c) => c.w / tot * CW);
const linha = (cells, head) => {
const wr = cells.map((c, i) => wrap(String(c), 9, head, ws[i] - 10));
const h = Math.max(...wr.map((w) => w.length)) * 12 + 8;
precisa(h);
if (head) R(M, y - h + 10, CW, h, G1);
let x = M; wr.forEach((w, i) => { let yy = y; w.forEach((ln) => { T(x + 5, yy, ln, 9, head, head ? '#FFFFFF' : TXT); yy -= 12; }); x += ws[i]; });
y -= h; if (!head) L(M, y + 10, M + CW, y + 10, '#D7E2DB', 0.5);
};
linha(cols.map((c) => c.h), true); b.rows.forEach((r) => linha(r, false)); y -= 8;
}
else if (b.t === 'gap') y -= b.h || 8;
else if (b.t === 'page') { if (y < PH - 120) novaPagina(); }
else if (b.t === 'assin') { precisa(52); T(M, y, b.s || '', 9.6, false, TXT); y -= 30; [['Motorista', M, 240], ['Data', M + 260, 80], ['Assinatura', M + 360, CW - 360]].forEach(([r, x, w]) => { L(x, y, x + w, y, '#5B6B62', 0.7); T(x, y - 12, r, 8.5, false, MUT); }); y -= 30; }
});
pages.push(ops);
// monta o arquivo
const objs = [];
const add = (s) => { objs.push(s); return objs.length; };
const catalogo = add(null), arvore = add(null);
const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
const gs = add('<< /Type /ExtGState /ca 0.07 /CA 0.07 >>');
let imL = null;
if (logo) imL = add({head: '<< /Type /XObject /Subtype /Image /Width ' + logo.w + ' /Height ' + logo.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + logo.bin.length + ' >>', bin: logo.bin});
const res = '<< /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> /ExtGState << /GSw ' + gs + ' 0 R >>' + (imL ? ' /XObject << /ImL ' + imL + ' 0 R /ImW ' + imL + ' 0 R >>' : '') + ' >>';
const kids = pages.map((p) => { const st = p.join('\n'); const c = add({head: '<< /Length ' + st.length + ' >>', bin: st}); return add('<< /Type /Page /Parent ' + arvore + ' 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources ' + res + ' /Contents ' + c + ' 0 R >>'); });
objs[catalogo - 1] = '<< /Type /Catalog /Pages ' + arvore + ' 0 R >>';
objs[arvore - 1] = '<< /Type /Pages /Kids [' + kids.map((k) => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offs = [];
objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + (typeof o === 'string' ? o : o.head + '\nstream\n' + o.bin + '\nendstream') + '\nendobj\n'; });
const xref = out.length;
out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalogo + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF';
const u8 = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) u8[i] = out.charCodeAt(i) & 255;
return new Blob([u8]);
};
})();
TC.varRegrasDoc = (k) => {
const C = TC.varCfg, c = TC.varCalc(), mesN = c ? TC.varMesNome(c.mes) + '/' + c.mes.slice(0, 4) : '';
const nb = (x, d) => (d == null ? String(x) : (+x).toFixed(d)).replace('.', ',');
const w = TC.varPesosFrota(), tipos = Array.from(new Set(['Falta'].concat(C.tipos || []))).join(', ');
const bo = 1 + (+C.bonus_oc0 || 0) / 100, bp = 1 + (+C.bonus_prod || 0) / 100, bj = 1 + (+C.bonus_jan || 0) / 100;
const maxF = w.prod * bp + w.jan * bj + w.oc * bo;
const reais = (v) => 'R$ ' + (+v).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const pc = (v) => nb(v, 1).replace(',0', '') + '%';
const gat = {t: 'box', bold: true, s: 'Gatilho para concorrer: uso do app de no mínimo ' + nb(C.meta_app) + '% das entregas. Abaixo disso, o variável do mês fica zerado.'};
const obs = [
{t: 'h1', s: 'Observações importantes'},
{t: 'li', s: 'Atrasos causados pela operação (CD) serão desconsiderados da apuração, somente nos dias em que houve atraso da operação.'},
{t: 'li', s: 'As regras e os pesos podem ter alterações de um mês para o outro, sempre com informação antecipada aos participantes.'},
{t: 'box', bold: true, s: 'Falta de mercadoria: quando for comprovado que a mercadoria entrou no veículo, a falta poderá ser cobrada pelo valor do produto acrescido de 50%.'}];
const defs = [
{t: 'h1', s: 'Definições'},
{t: 'li', s: 'Uso do app: entregas baixadas pelo aplicativo do motorista sobre as entregas avaliadas no mês.'},
{t: 'li', s: 'Entrega sem atraso: chegada no cliente até 1 hora depois do fim da janela de atendimento no dia previsto; entregas antecipadas contam como sem atraso.'},
{t: 'li', s: 'Ocorrência por culpa do transportador: entregas com ocorrência dos tipos ' + tipos + '. Falta é sempre responsabilidade do transportador.'},
{t: 'li', s: 'Período: entregas das rotas do mês de apuração (data da carga).'},
{t: 'gap', h: 10},
{t: 'p', s: 'Documento gerado pelo portal Torre de Controle - Transporte em ' + new Date().toLocaleString('pt-BR') + '. As regras podem ser revistas pela Gerência de Transporte.'}];
const base = {rodape: 'W ARRAES - Gerência Transporte · CNPJ 70.070.143/0001-55', sub: 'Regras vigentes' + (mesN ? ' · apuração ' + mesN : '')};
if (k === 'frota') return Object.assign(base, {titulo: 'Variável da Frota · NFS e Comfrio', blocos: [
{t: 'p', s: 'Regras do pagamento variável dos motoristas da frota própria (NFS e Comfrio). Valor do variável: até ' + reais(C.valor_frota) + ' por motorista no mês, multiplicado pelo percentual atingido. Metade é produtividade e a outra metade é nível de serviço. Motoristas com o mesmo nome são somados, mesmo que tenham rodado com placas diferentes.'},
gat,
{t: 'h1', s: 'Indicadores, pesos e plus'},
{t: 'table', cols: [{h: 'Indicador', w: 30}, {h: 'Meta', w: 28}, {h: 'Peso', w: 10}, {h: 'Plus', w: 34}], rows: [
['Uso do app (gatilho)', '>= ' + nb(C.meta_app) + '%', '—', 'Abaixo da meta, variável zerado'],
['Produtividade (cargas no mês)', 'SR ' + C.meta_sr + ' · TR ' + C.meta_tr + ' · demais ' + C.meta_outros + ' cargas', pc(w.prod), '+' + nb(C.bonus_prod) + '% no peso ao superar a meta de cargas'],
['Entregas sem atraso', '>= ' + nb(C.meta_janela) + '%', pc(w.jan), '+' + nb(C.bonus_jan) + '% no peso ' + (+C.lim_jan_plus >= 100 ? 'sem nenhum atraso (100%)' : 'a partir de ' + nb(C.lim_jan_plus) + '% sem atraso')],
['Ocorrências por culpa do transportador', '<= ' + nb(C.lim_oc) + '%', pc(w.oc), '+' + nb(C.bonus_oc0) + '% no peso com zero ocorrência']]},
{t: 'h1', s: 'Como contam as cargas'},
{t: 'li', s: 'Carga em dia útil (segunda a sexta) vale 1; carga de sábado vale ' + (C.peso_sab || 2) + '; carga de domingo ou feriado vale ' + (C.peso_dom || 3) + '.'},
{t: 'li', s: 'O perfil do veículo é lido no nome da rota (3ª e 4ª letras, ex.: SPTR424 = TR).'},
{t: 'li', s: 'A meta é proporcional aos dias úteis do mês (segunda a sábado, sem feriados). Dias abonados pela gerência saem da conta: folga dada pela gerência, oficina, coleta e outros serviços, avaliados no dia a dia.'},
{t: 'h1', s: 'Quanto se recebe'},
{t: 'table', cols: [{h: 'Situação', w: 62}, {h: '% do variável', w: 18}, {h: 'Valor', w: 20}], rows: [
['Todas as metas atingidas, sem plus', '100%', reais(C.valor_frota)],
['Todas as metas e os três plus', pc(maxF), reais(C.valor_frota * maxF / 100)],
['Só produtividade', pc(w.prod), reais(C.valor_frota * w.prod / 100)],
['Só nível de serviço (sem atraso e ocorrências)', pc(w.jan + w.oc), reais(C.valor_frota * (w.jan + w.oc) / 100)],
['Abaixo do gatilho do app', '0%', reais(0)]]},
...obs,
{t: 'h2', s: 'Advertências (somente frota)'},
{t: 'box', bold: true, s: 'Uma advertência no mês: o motorista perde 50% do valor final do variável. Acima de duas advertências no mês: o variável é zerado.'},
...defs,
{t: 'page'},
{t: 'h1', s: 'POP de treinamento · Procedimentos da frota'},
{t: 'p', s: 'Procedimento Operacional Padrão para os motoristas e ajudantes da frota própria (NFS e Comfrio). Todos os itens abaixo devem ser cumpridos em todas as rotas e fazem parte da avaliação do variável.'},
{t: 'h2', s: '1. Checklist do veículo (antes de cada saída)'},
{t: 'li', s: 'Pneus: calibragem, desgaste, cortes e estepe em condições de uso.'},
{t: 'li', s: 'Freios, luzes, setas, luz de ré, buzina, retrovisores e limpador de para-brisa funcionando.'},
{t: 'li', s: 'Níveis de óleo, água e combustível suficientes para a rota.'},
{t: 'li', s: 'Baú limpo, sem odor, portas e travas funcionando; equipamento de refrigeração ligado e na temperatura correta quando a carga exigir.'},
{t: 'li', s: 'Documentos do veículo e do motorista (CRLV e CNH) e notas fiscais da carga a bordo; EPIs e equipamentos obrigatórios no veículo.'},
{t: 'li', s: 'Qualquer problema encontrado deve ser comunicado ao suporte antes da saída. Não sair com o veículo sem condições seguras.'},
{t: 'h2', s: '2. Horário de chegada para expedição'},
{t: 'li', s: 'Chegar ao CD no horário programado para o carregamento. O atraso na expedição atrasa toda a rota e as janelas dos clientes.'},
{t: 'li', s: 'Em caso de imprevisto, avisar o suporte imediatamente, antes do horário programado.'},
{t: 'h2', s: '3. Uso do aplicativo'},
{t: 'li', s: 'Iniciar a rota no app antes de sair do CD e seguir a sequência de entregas planejada.'},
{t: 'li', s: 'Registrar no app a chegada, o início e o fim do atendimento de cada cliente, no local do cliente (até 500 m).'},
{t: 'li', s: 'Nunca dar baixa fora do cliente, depois de sair do local ou várias entregas de uma vez.'},
{t: 'li', s: 'Registrar toda ocorrência no app no momento em que acontecer, com foto e motivo.'},
{t: 'li', s: 'Se o app falhar, avisar o suporte na hora para que a baixa seja feita pelo monitoramento.'},
{t: 'h2', s: '4. Conferência das mercadorias no cliente'},
{t: 'li', s: 'Conferir junto com o ajudante, volume a volume, os produtos e as quantidades de cada nota antes de entregar.'},
{t: 'li', s: 'Conferir junto com o recebedor do cliente e verificar o estado das embalagens no ato da entrega.'},
{t: 'li', s: 'Qualquer divergência (falta, sobra, avaria ou produto trocado) deve ser registrada no app e comunicada ao suporte antes de sair do cliente.'},
{t: 'li', s: 'Canhoto assinado com nome legível, data e horário do recebimento.'},
{t: 'li', s: 'Falta de mercadoria: quando for comprovado que a mercadoria entrou no veículo, a falta poderá ser cobrada pelo valor do produto acrescido de 50%.'},
{t: 'h2', s: '5. Devoluções'},
{t: 'box', bold: true, s: 'É proibido sair do cliente com devolução, total ou parcial, sem autorização do suporte. Ligar para o suporte, informar o motivo, aguardar a autorização e registrar a devolução no app. A mercadoria volta ao CD com a nota e o motivo registrados.'},
{t: 'h2', s: '6. Fim da rota'},
{t: 'li', s: 'Finalizar a rota no app, devolver canhotos, notas e devoluções no CD e informar ao suporte qualquer pendência do dia.'},
{t: 'assin', s: 'Declaro que recebi o treinamento deste procedimento e estou ciente das regras.'},
]});
return Object.assign(base, {titulo: 'Variável das Transportadoras', blocos: [
{t: 'p', s: 'Regras do pagamento variável dos motoristas das transportadoras terceiras. O bônus é calculado e pago individualmente para cada motorista, em percentual sobre o frete, até o limite de ' + nb(C.pct_frete) + '%. Não há acréscimos (plus). A visão por transportadora é apenas a média ponderada pelas entregas dos seus motoristas: uma transportadora pode ter motoristas premiados mesmo que, na média, não atinja as metas.'},
gat,
{t: 'h1', s: 'Indicadores e pesos'},
{t: 'table', cols: [{h: 'Indicador', w: 34}, {h: 'Meta', w: 22}, {h: 'Peso no bônus', w: 18}, {h: 'Observação', w: 40}], rows: [
['Uso do app (gatilho)', '>= ' + nb(C.meta_app) + '%', '—', 'Abaixo da meta, bônus zerado'],
['Entregas sem atraso', '>= ' + nb(C.meta_janela) + '%', nb(C.peso_janela) + '%', 'Na janela do cliente, com 1 h de tolerância'],
['Ocorrências por culpa do transportador', '<= ' + nb(C.lim_oc) + '%', nb(C.peso_oc) + '%', 'Tipos: ' + tipos]]},
{t: 'h1', s: 'Bônus sobre o frete'},
{t: 'table', cols: [{h: 'Resultado do motorista', w: 60}, {h: '% atingido', w: 20}, {h: 'Bônus sobre o frete', w: 25}], rows: [
['Atingiu as duas metas', '100%', nb(+C.pct_frete, 2) + '%'],
['Atingiu uma das metas', '50%', nb(C.pct_frete * 0.5, 2) + '%'],
['Não atingiu nenhuma meta ou ficou abaixo do gatilho do app', '0%', '0,00%']]},
{t: 'box', s: 'Exemplo: motorista com R$ 20.000,00 de frete no mês e as duas metas atingidas recebe ' + nb(+C.pct_frete, 2) + '% = ' + reais(20000 * C.pct_frete / 100) + '.'},
...obs,
...defs]});
};
TC.varBaixarRegras = async (btn, k) => {
const dl = await (window.claude && window.claude.use ? window.claude.use('downloads').catch(() => null) : null);
if (!dl) return;
if (btn) btn.disabled = true;
try { const d = TC.varRegrasDoc(k); const blob = await TC.pdfRegras(d); const c = TC.varCalc(); await dl.save({filename: 'Regras Variavel ' + (k === 'frota' ? 'Frota' : 'Transportadoras') + (c ? ' ' + TC.varMesNome(c.mes) : '') + '.pdf', data: blob}); }
catch (e) { if (btn) btn.title = e && e.code === 'declined' ? 'Download cancelado' : 'Não foi possível gerar o PDF'; }
if (btn) btn.disabled = false;
};
document.querySelectorAll('.var-pdf-regras').forEach((b) => { b.onclick = () => TC.varBaixarRegras(b, b.dataset.k); });
