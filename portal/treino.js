// Aba Treinamento: PDFs do variável, POP dos motoristas e POP do monitoramento.
(() => {
TC.treinoHoras = window.__nxTreinoHoras || {inicio: '05:00', fim: '', limiteAlerta: '08:00'};
const H = TC.treinoHoras;
const RODAPE = 'W ARRAES - Gerência Transporte';
const ciencia = {t: 'assin', s: 'Declaro que recebi o treinamento deste procedimento e estou ciente das regras.'};

TC.popMonitoramentoBlocos = () => [
{t: 'h1', s: 'POP · Monitoramento de entregas'},
{t: 'p', s: 'Rotina do turno da Torre de Controle, hora a hora. Siga a escala na ordem e registre tudo no portal.'},
{t: 'table', cols: [{h: 'Horário', w: 16}, {h: 'O que fazer', w: 84}], rows: [
  [H.inicio, 'Chegada. Abrir o portal e enviar o relatório do roteirizador em Atualizar dados.'],
  ['05:00–06:00', 'Expedição em 1.2 Rotas do dia: Em execução = expedidas; Stand-by = não expedidas. Confirmar com o CD se todas vão sair.'],
  ['06:00', 'Checar as PRIORIDADES do dia (quadro em 1.2 Rotas do dia) e garantir que saiam primeiro.'],
  ['06:00–07:00', 'Checagem Performaxxi: conferir se TODAS as cargas do dia estão no Performaxxi e com o app iniciado pelo motorista. Carga fora do sistema ou sem app: cobrar a transportadora na hora.'],
  ['Até ' + H.limiteAlerta, 'Registrar alerta em toda rota que não vai sair (reprogramado, carro quebrado ou sinistro) e "Saída com atraso" nas que vão atrasar.'],
  ['Durante o turno', 'Acompanhar 1.3 Entregas pendentes (atrasadas primeiro) e o mapa. Validar em 1.6 as ocorrências (falta, avaria, devolução total): bipagem e vídeo. Motorista sem dar chegada/baixa no app: cobrar na hora.'],
  ['Encerramento' + (H.fim ? ' (' + H.fim + ')' : ''), 'Última atualização. Zero pendente sem informação: entregue sem baixa no app = baixa manual; não entregue = alerta com motivo e nova data. Baixar o Relatório de fechamento (1.2) para o próximo turno e o CS; ranking (2.2) com o mau uso do app para a transportadora.']]},
{t: 'h2', s: 'Checagem Performaxxi e uso do app'},
{t: 'li', s: '1. Toda carga expedida no CD precisa estar no Performaxxi; rota sem início no app após a saída: ligar para o motorista e a transportadora.'},
{t: 'li', s: '2. Cobrança diária: em 2.2 Ranking de motoristas, filtrar a transportadora e enviar (botão copiar quadro) os motoristas com baixa aderência ao app, entregas sem chegada/baixa e % de ocorrência alto.'},
{t: 'li', s: '3. Motorista reincidente no mau uso do app: levar à gestão para aplicar as regras do variável.'},
{t: 'h2', s: 'Prioridades das 06:00'},
{t: 'li', s: '1. Rotas de reposição: rotas que começam com "REPO".'},
{t: 'li', s: '2. Tudo que ficou pendente no dia anterior (não entregue nem baixado manualmente) é prioridade no dia seguinte (quadro Prioridades em 1.2).'},
{t: 'li', s: '3. Cargas com alerta "Reprogramado para o próximo dia" (pendentes do dia anterior reprogramadas).'},
{t: 'box', bold: true, s: 'Fim do expediente: nenhuma pendente sem alerta. Sem saída até ' + H.limiteAlerta + ': alerta e aviso ao CS.'},
{t: 'p', s: 'Regras rápidas: alerta sempre com o motivo e a nova data na observação · baixa manual só para entrega confirmada com falha no app · devolução só com autorização do suporte.'},
Object.assign({}, ciencia, {rotulo: 'Nome do colaborador'})
];

TC.guiaRastreioBlocos = () => [
{t: 'h1', s: 'Guia do rastreio · Torre de Controle'},
{t: 'p', s: 'O portal concentra num só lugar as informações de cada entrega, para que Monitoramento, Customer Service e os demais departamentos falem a mesma coisa com o cliente. Este guia mostra o passo a passo do rastreio e quem faz o quê.'},
{t: 'h2', s: 'Quem faz o quê'},
{t: 'table', cols: [{h: 'Departamento', w: 24}, {h: 'Responsabilidade', w: 56}, {h: 'Onde', w: 20}], rows: [
  ['Monitoramento', 'Atualiza o portal, confere a expedição e registra alertas nas rotas (até 08:00) com o motivo e a nova data.', '1.2 Rotas do dia'],
  ['Customer Service', 'Consulta pedidos e cargas, informa os clientes das rotas com alerta e marca "cliente informado".', '4.1, 4.2 e 5.1'],
  ['Monitoramento', 'Valida as ocorrências (falta, avaria, devolução total): bipagem e vídeo do carregamento.', '1.6 Ocorrências'],
  ['Todos', 'Usam a mesma previsão e a mesma situação do portal ao falar com o cliente.', 'Rastreio']]},
{t: 'h2', s: '4.1 Consulta cliente · passo a passo'},
{t: 'li', s: '1. Digite o código ou o nome do cliente e escolha o período.'},
{t: 'li', s: '2. Os cards mostram entregas, concluídas, pendentes, ocorrências, SLA janela e On Time do cliente.'},
{t: 'li', s: '3. Na tabela "Entregas do cliente" veja a rota, a entrega planejada, a situação e a chegada ou previsão.'},
{t: 'li', s: '4. Clique numa entrega para abrir o Ciclo do pedido: roteirização, carregamento, saída do CD, chegada, início e fim do atendimento, motorista, endereço e ocorrência.'},
{t: 'h2', s: '4.2 Consulta carga · passo a passo'},
{t: 'li', s: '1. Digite a rota, a placa ou o nome do motorista.'},
{t: 'li', s: '2. A Linha do tempo da carga mostra em que etapa a rota está.'},
{t: 'li', s: '3. Em Paradas da carga veja cada cliente na ordem planejada e realizada, com situação, prazo, janela, previsão, SLA e ocorrência.'},
{t: 'li', s: '4. Clique numa parada para abrir o ciclo do pedido daquele cliente.'},
{t: 'h2', s: 'Como ler a previsão'},
{t: 'table', cols: [{h: 'Na tela', w: 30}, {h: 'O que significa', w: 70}], rows: [
  ['Chegou em …', 'Entrega feita: horário real de chegada no cliente.'],
  ['prev. dd/mm hh:mm', 'Previsão atual: última parada atendida (ou saída real do veículo) + percurso planejado, recalculada a cada minuto.'],
  ['em separação/carregamento', 'Rota em stand-by, ainda sem horário de expedição no CD.'],
  ['reprog. dd/mm hh:mm', 'Rota reprogramada: saída às 06:00 do dia seguinte + percurso, nunca antes da janela do cliente.'],
  ['Previsão em vermelho', 'Deve chegar mais de 1 hora depois do fim da janela: avisar o cliente antes.']]},
{t: 'h2', s: 'Situação e indicadores'},
{t: 'li', s: 'Situação: Entregue, Entregue com ocorrência, Devolução total, Entregue (baixa manual) ou Pendente.'},
{t: 'li', s: 'SLA janela: SIM quando chega até 1 hora depois do fim da janela. On Time: até 1 hora depois do início da janela.'},
{t: 'h2', s: 'O que fazer quando…'},
{t: 'li', s: 'O cliente pergunta do pedido: abrir 4.1, passar a situação e a previsão da tela. Se a rota tiver alerta, explicar o motivo registrado.'},
{t: 'li', s: 'Uma rota recebe alerta: em 5.1 Alertas, avisar os clientes e marcar "cliente informado" (pode selecionar vários de uma vez).'},
{t: 'li', s: 'A previsão passa da janela: avisar o cliente antes do horário, sem esperar a reclamação.'},
{t: 'box', bold: true, s: 'Regra de ouro: a informação dada ao cliente é sempre a que está no portal. Se algo estiver diferente, avise o monitoramento para corrigir.'},
Object.assign({}, ciencia, {rotulo: 'Nome do colaborador'})
];
TC.treinoDocs = {
  monitoramento: () => ({titulo: 'POP · Monitoramento de entregas', sub: 'Procedimento do turno de monitoramento', rodape: RODAPE, blocos: TC.popMonitoramentoBlocos(), arquivo: 'POP Monitoramento'}),
  rastreio: () => ({titulo: 'Guia do rastreio', sub: 'Consulta cliente, consulta carga e comunicação', rodape: RODAPE, blocos: TC.guiaRastreioBlocos(), arquivo: 'Guia do Rastreio'}),
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
