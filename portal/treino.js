// Aba Treinamento: PDFs do variável, POP dos motoristas e POP do monitoramento.
(() => {
TC.treinoHoras = window.__nxTreinoHoras || {inicio: '05:00', fim: '', limiteAlerta: '08:00'};
const H = TC.treinoHoras;
const RODAPE = 'W ARRAES - Gerência Transporte · CNPJ 70.070.143/0001-55';
const ciencia = {t: 'assin', s: 'Declaro que recebi o treinamento deste procedimento e estou ciente das regras.'};

TC.popMonitoramentoBlocos = () => [
{t: 'h1', s: 'POP de treinamento · Monitoramento de entregas'},
{t: 'p', s: 'Procedimento Operacional Padrão da equipe de monitoramento da Torre de Controle. Define o horário de trabalho, a rotina do turno e como registrar alertas no portal, para que o Customer Service e os clientes sejam avisados a tempo.'},
{t: 'table', cols: [{h: 'Horário do turno', w: 40}, {h: 'Atividade', w: 70}], rows: [
  ['Início: ' + H.inicio, 'Chegada, atualização do portal e conferência da expedição'],
  ['Até ' + H.limiteAlerta, 'Prazo para registrar alerta das rotas que não vão sair ou vão sair com atraso'],
  ['Durante o turno', 'Acompanhamento das rotas, entregas, ocorrências e uso do app'],
  ['Término' + (H.fim ? ': ' + H.fim : ''), 'Fechamento do dia e passagem de turno']]},
{t: 'h2', s: '1. Chegada (' + H.inicio + ')'},
{t: 'li', s: 'Chegar às ' + H.inicio + ' e abrir o portal da Torre de Controle.'},
{t: 'li', s: 'Baixar o relatório do roteirizador (Analítico de Rota) e enviar na tela Atualizar dados. Conferir a data e a hora de "Atualizado em".'},
{t: 'li', s: 'Repetir a atualização ao longo do turno para que as previsões e os alertas fiquem em dia.'},
{t: 'h2', s: '2. Rotas expedidas e não expedidas'},
{t: 'li', s: 'Abrir 1.2 Rotas do dia com o filtro Dia monitorado.'},
{t: 'li', s: 'Expedidas: rotas com status Em execução (veículo já saiu do CD, com horário de saída).'},
{t: 'li', s: 'Não expedidas: rotas com status Stand-by (pedido em separação/carregamento, sem horário de expedição).'},
{t: 'li', s: 'Para cada rota não expedida, confirmar com a expedição do CD se ela vai sair e em que horário.'},
{t: 'h2', s: '3. Rota que não vai sair (alerta até ' + H.limiteAlerta + ')'},
{t: 'box', bold: true, s: 'Toda rota que não vai sair no dia deve ter o alerta registrado no portal até as ' + H.limiteAlerta + ', na coluna Alerta de 1.2 Rotas do dia.'},
{t: 'li', s: 'Escolher o tipo de alerta correto: Reprogramado para o próximo dia, Carro quebrado – carga seguirá no próximo dia ou Sinistro – carga roubada.'},
{t: 'li', s: 'Escrever na observação o motivo e a nova data prevista. A previsão das entregas passa para o dia seguinte e o Customer Service recebe o aviso para informar os clientes.'},
{t: 'h2', s: '4. Rota que vai sair com atraso'},
{t: 'li', s: 'Registrar o alerta "Saída com atraso – possíveis atrasos nas entregas", com o horário previsto de saída na observação.'},
{t: 'li', s: 'Conferir em 1.3 Entregas pendentes e em 4.2 Consulta carga quais clientes podem ficar fora da janela e avisar o Customer Service.'},
{t: 'h2', s: '5. Durante o turno'},
{t: 'li', s: 'Acompanhar 1.1 Resumo do dia, 1.3 Entregas pendentes (atrasadas primeiro) e 1.5 Mapa de entregas.'},
{t: 'li', s: 'Carro quebrado na rota: registrar "Carro quebrado – buscando socorro" e atualizar quando houver solução.'},
{t: 'li', s: 'Falha no app do motorista: registrar "Baixa manual – entregue (falha no app)" apenas nas entregas confirmadas.'},
{t: 'li', s: 'Devoluções só com autorização do suporte. Conferir as ocorrências em 1.6 Ocorrências do dia.'},
{t: 'li', s: 'Cobrar dos motoristas o uso do app em todas as entregas (meta de 98,5% de aderência).'},
{t: 'h2', s: '6. Encerramento do turno' + (H.fim ? ' (' + H.fim + ')' : '')},
{t: 'li', s: 'Fazer a última atualização do portal.'},
{t: 'li', s: 'Rotas com entregas que não serão feitas no dia: registrar o alerta de reprogramação.'},
{t: 'li', s: 'Baixar o relatório PDF das pendentes (1.3 Entregas pendentes) e repassar para a próxima equipe e para o Customer Service.'},
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
