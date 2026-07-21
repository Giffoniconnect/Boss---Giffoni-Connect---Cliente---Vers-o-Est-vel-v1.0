# REGRA PERMANENTE — RECOLHIMENTO OBRIGATÓRIO DAS BANDEJAS TÉCNICAS

## 1. Objetivo e Aplicação

Esta regra estabelece as diretrizes de design, usabilidade e comportamento para todas as "bandejas técnicas" (seções expansíveis, painéis de logs, diagnósticos da Batalha Naval, payloads de integração e depuradores em geral) no Portal do Cliente e na esteira financeira de produção. 

Ela visa eliminar a poluição visual, garantir uma interface limpa e focada no usuário ("Clean UI"), e assegurar que logs e auditorias derivem exclusivamente de fontes de dados canônicas e fáticas do sistema.

---

## 2. Diretrizes de Comportamento (Fechado por Padrão)

1. **Estado Inicial Estritamente Fechado**:
   * Todas as bandejas técnicas, contêineres de logs, visões de depuração e diagnósticos de placeholders **MUST** iniciar recolhidos (fechados/colapsados) por padrão ao carregar a página ou subetapa.
   * A expansão de qualquer bandeja técnica só é permitida por meio de **ação expressa e voluntária do usuário** (clique no botão correspondente).

2. **Proibição de Auto-Abertura por Eventos**:
   * É terminantemente proibido abrir automaticamente qualquer bandeja técnica ou painel de logs após a ocorrência de qualquer evento do sistema, tais como:
     * Gerar ou visualizar Preview do documento.
     * Gerar ou regenerar o documento final definitivo.
     * Gravar ou atualizar Condições Operacionais de Faturamento.
     * Executar ou carregar o diagnóstico de Batalha Naval.
     * Receber alertas, mensagens de sucesso ou mensagens de erro.
   * Em caso de erro na geração ou execução, deve ser exibido um banner de aviso amigável curto e bem posicionado, sem forçar a expansão dos logs internos detalhados.

---

## 3. Diretrizes de Auditoria e Logs (Motor Canônico)

1. **Origem Única da Verdade (Single Source of Truth)**:
   * Os dados de diagnósticos e auditorias exibidos em tela devem derivar **única e exclusivamente** do motor documental canônico (`placeholderAudit` ou equivalentes fáticos do back-end).
   * É proibida a criação de lógicas manuais ou listas de placeholders duplicadas no front-end (`expectedPlaceholdersPF`, listas paralelas estáticas de campos obrigatórios, etc.) para tentar simular o resultado da auditoria. Se o motor real não reportar uma pendência, o front-end não deve inventar ou contradizer o diagnóstico do motor real.

2. **Fidelidade de Informação**:
   * "O log não pode contrariar o resultado produzido pelo motor real."
   * Toda informação exibida em logs deve ser perfeitamente idêntica aos metadados fáticos retornados pelas APIs do sistema.

---

## 4. Especificações da UI da Batalha Naval

A Batalha Naval (Auditoria de Rastreabilidade Carry-On) deve ser exibida em um formato altamente estruturado de tabela, facilitando o escaneamento em cascata e identificação ágil de pendências cadastrais.

1. **Estrutura de Tabela Obrigatória**:
   * Deve ser utilizada uma tabela HTML padrão (`<table>`) estruturada, substituindo qualquer layout informal de blocos ou divs flutuantes.
   * A tabela deve conter exatamente as seguintes colunas principais:
     * **Info**: Detalha a descrição do campo, o estágio/etapa fática de origem (ex: Etapa 1 - Cadastro, Etapa 3 - Financeiro) e mensagens em linguagem natural explicativas sobre a conformidade.
     * **Placeholder**: O identificador exato da chave textual substituída no template (ex: `{{CLIENTE_NOME}}`).
     * **Status**: O status da resolução do placeholder (Sucesso / Falha / Alerta) acompanhado do valor fático resolvido (mascarado para preservação de dados).

---

## 5. Auditoria de Código

Qualquer modificação futura que viole estas regras (como auto-expansão não solicitada ou duplicação de dados de auditoria) resultará em rejeição imediata da build devido ao comprometimento da usabilidade e quebra do padrão arquitetural de governança de dados.
