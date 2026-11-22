// Aba Treinamento: PDFs do variável, POP dos motoristas e POP do monitoramento.
(() => {
TC.treinoHoras = window.__nxTreinoHoras || {inicio: '05:00', fim: '', limiteAlerta: '08:00'};
const H = TC.treinoHoras;
const RODAPE = 'W ARRAES - Gerência Transporte · CNPJ 70.070.143/0001-55';
const ciencia = {t: 'assin', s: 'Declaro que recebi o treinamento deste procedimento e estou ciente das regras.'};

TC.popMonitoramentoBlocos = () => [
{t: 'h1', s: 'POP · Monitoramento de entregas'},
{t: 'p', s: 'Rotina do turno da Torre de Controle, hora a hora. Siga a escala na ordem e registre tudo no portal.'},
{t: 'table', cols: [{h: 'Horário', w: 16}, {h: 'O que fazer', w: 84}], rows: [
  [H.inicio, 'Chegada. Abrir o portal e enviar o relatório do roteirizador em Atualizar dados.'],
  ['05:00–06:00', 'Expedição em 1.2 Rotas do dia: Em execução = expedidas; Stand-by = não expedidas. Confirmar com o CD se todas vão sair.'],
  ['06:00', 'Checar as PRIORIDADES do dia (quadro abaixo) e garantir que saiam primeiro.'],
  ['Até ' + H.limiteAlerta, 'Registrar alerta em toda rota que não vai sair (reprogramado, carro quebrado ou sinistro) e "Saída com atraso" nas que vão atrasar.'],
  ['Durante o turno', 'Acompanhar 1.3 Entregas pendentes (atrasadas primeiro) e o mapa. Validar em 1.6 as ocorrências (falta, avaria, devolução total): bipagem e vídeo. Cobrar o uso do app.'],
  ['Encerramento' + (H.fim ? ' (' + H.fim + ')' : ''), 'Última atualização. Reprogramar o que não será entregue. Baixar o Relatório de fechamento (1.2) e repassar ao próximo turno e ao Customer Service.']]},
{t: 'h2', s: 'Prioridades das 06:00'},
{t: 'li', s: '1. Rotas de reposição: rotas que começam com "REPO".'},
{t: 'li', s: '2. Cargas e pedidos não entregues nos dias anteriores (1.3 Entregas pendentes → Atrasadas).'},
{t: 'li', s: '3. Cargas com alerta "Reprogramado para o próximo dia" (pendentes do dia anterior reprogramadas).'},
{t: 'box', bold: true, s: 'Prioridade sem previsão de saída até as ' + H.limiteAlerta + ' precisa de alerta e aviso ao Customer Service.'},
{t: 'h2', s: 'Regras rápidas'},
{t: 'li', s: 'Alerta sempre com o motivo e a nova data na observação.'},
{t: 'li', s: 'Baixa manual só para entrega confirmada com falha no app.'},
{t: 'li', s: 'Devolução só com autorização do suporte.'},
Object.assign({}, ciencia, {rotulo: 'Nome do colaborador'})
];

TC.treinoDocs = {
  monitoramento: () => ({titulo: 'POP · Monitoramento de entregas', sub: 'Procedimento do turno de monitoramento', rodape: RODAPE, blocos: TC.popMonitoramentoBlocos(), arquivo: 'POP Monitoramento'}),
  motoristas: () => ({titulo: 'POP · Procedimentos dos motoristas', sub: 'Frota própria (NFS e Comfrio)', rodape: RODAPE, blocos: TC.popMotoristasBlocos(), arquivo: 'POP Motoristas'})
};
const salva = async (btn, doc) => {
  const dl = await (window.claude && window.claude.use ? window.claude.use('downloads').catch(() => null) : null);
  if (!dl) return;
  btn.disabled = true;
  try { await dl.save({filename: doc.arquivo + '.pdf', data: await TC.pdfRegras(doc)}); }
  catch (e) { console.warn('[treino]', e); }
  btn.disabled = false;
};
document.querySelectorAll('[data-treino]').forEach((b) => { b.onclick = () => {
  const k = b.dataset.treino;
  if (k === 'var-transp') return TC.varBaixarRegras(b, 'transp');
  if (k === 'var-frota') return TC.varBaixarRegras(b, 'frota');
  if (TC.treinoDocs[k]) return salva(b, TC.treinoDocs[k]());
}; });
})();
