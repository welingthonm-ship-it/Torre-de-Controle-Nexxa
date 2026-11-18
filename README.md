# Torre de Controle – Transporte (Nexxa)

Portal de monitoramento de transporte: resumo do dia, rotas, entregas pendentes, ocorrências, rastreio de cliente e de carga, modo TV, variável de transportadoras e frota, e controle de acesso por perfil.

**Portal publicado (link fixo, sempre na versão mais recente):**
https://claude.ai/code/artifact/fa947590-1bf6-4bb5-abc9-664c8fdc6732

> Este repositório é uma cópia do código-fonte. Ele **não** atualiza o portal automaticamente: o portal roda a partir dos arquivos guardados no próprio artifact. Depois de mudanças no portal, os arquivos precisam ser enviados de novo para cá.

## Estrutura

| Pasta / arquivo | Conteúdo |
|---|---|
| `portal/index.html` | Página principal: abas, estilos, núcleo `TC` (prazos D+N, SLA, previsão de entrega), rastreio, modo TV, mapa |
| `portal/resumo.js` | Aba Resumo (filtros por data da carga e data da entrega, progresso por data) |
| `portal/carga.js` | Rastreio – Consulta carga (linha do tempo + paradas) |
| `portal/pendentes.js` | Entregas pendentes (hoje / atrasadas / próximos dias, busca por motorista/placa) |
| `portal/variavel.js` / `variavel.css` | Variável de transportadoras (% até 1,5% por motorista) e frota (R$ 1.000, produtividade + nível de serviço), exportação Excel |
| `portal/pdfregras.js` | Geração do PDF de regras com marca d'água Nexxa |
| `portal/usuarios.js` / `usuarios.css` | Login por perfil, senhas (SHA-256 com sal) e restrição de abas |
| `portal/tv.css` | Estilos do modo TV |
| `portal/brasil.js` | Contorno do mapa do Brasil |
| `portal/atualizar.js` | Leitura das planilhas e cálculo dos dados (gerado a partir de `atualizar-fonte/`) |
| `atualizar-fonte/` | Fontes do `atualizar.js`: `xlsread.js` (leitor XLSX), `transform.js` (regras de SLA/On Time/OTIF, baixa manual), `ui.js` |

## Regras principais

- **SLA (janela):** SIM quando a chegada ocorre até 60 min após o fim da janela no dia da chegada; chegada antes do dia previsto conta como SIM.
- **On Time:** mesma lógica, usando o início da janela + 60 min.
- **Saída real:** início da rota + 30 min. A previsão é recalculada a cada minuto a partir da última parada atendida.

## Perfis de acesso

| Perfil | Abas |
|---|---|
| Administrador | Todas |
| Operação | Todas, exceto Atualizar dados e Variável |
| Customer Service | Customer Service - Alertas, Rastreio - Consulta cliente |
| Monitoramento | Modo TV, Resumo do dia, Rotas do dia, Entregas pendentes, Prazos D+N, Mapa, Ocorrências do dia, Rastreio (cliente e carga) |
| Fechamento de Frete | Ocorrências do dia, Ranking de transportadoras e de motoristas, Variável (transportadoras e frota), Rastreio - Consulta carga, Histórico |

Referência em `config/perfis.json` (sem senhas). A configuração ativa é editada na tela Usuários do portal.

## Versão web (Vercel)

A pasta `site/` permite rodar o mesmo portal fora do Claude, em qualquer hospedagem estática (Vercel, Netlify etc.), **sem duplicar o código das abas**: o `index.html` da raiz carrega `portal/index.html` e os mesmos arquivos `.js`/`.css`.

| Arquivo | Função |
|---|---|
| `index.html` (raiz) | Página de entrada (fontes, D3.js, base visual) |
| `site/base.css` | As variáveis de layout (cores, fontes, espaçamentos) que no Claude vêm da plataforma |
| `site/dash-shim.js` | Implementa `dash.draw`, `dash.data`, `dash.calc` e `claude.use(...)` (banco, arquivos, downloads, usuário) |
| `site/loader.js` | Monta o portal a partir de `portal/index.html` |
| `site/config.js` | Configuração (pastas, permissão de edição) |
| `vercel.json` | Cabeçalhos de cache |

**Publicar na Vercel:** Root Directory = `./` (raiz do repositório), Application Preset = **Other**, sem comando de build.

**Dados nesta etapa:** ficam salvos no navegador de quem usa (IndexedDB). Para carregar, envie o relatório do roteirizador na aba **Atualizar dados**. Alertas, perfis e configurações do variável também ficam só naquele navegador. A próxima etapa troca esse armazenamento por um banco compartilhado (Supabase), mudando apenas `site/dash-shim.js`.

## Dados

Os dados (entregas, clientes, motoristas, perfis e senhas) ficam no banco do portal e **não** estão neste repositório. Não versione planilhas ou exportações com dados de clientes ou motoristas.

---
W ARRAES – Gerência Transporte · CNPJ 70.070.143/0001-55
