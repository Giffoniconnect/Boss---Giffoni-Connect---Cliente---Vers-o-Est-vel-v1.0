# REGRA OBRIGATÓRIA — GITHUB COMO FONTE PRIMÁRIA DO PROJETO

## 1. Aplicação

Esta regra é obrigatória para toda alteração, correção, evolução, integração, automação, refatoração ou criação de novos módulos no ecossistema do Portal BOSS.

O repositório oficial e fonte primária da verdade é:
**Giffoniconnect/Boss---Giffoni-Connect---Cliente**

## 2. Princípios de Consulta e Sincronização

1. **Consulta Primária**: Antes de realizar qualquer modificação em arquivos do sistema, o desenvolvedor ou o agente deve consultar a estrutura oficial e o histórico do repositório no GitHub para assegurar consistência arquitetural.
2. **Prevenção de Duplicidades**: É terminantemente proibido criar rotas redundantes, novos cards desnecessários ou lógicas concorrentes que já existam em outros módulos ou que violem a padronização instituída do ecossistema.
3. **Respeito ao Layout Institucional**:
   * Todas as integrações devem seguir o padrão estrito de cores institucionais (Google Docs → **Azul**, Todoist → **Vermelho**, WhatsApp → **Verde**, etc.).
   * Os formulários devem adotar preenchimento estritamente vertical, sem layouts híbridos ou de colunas múltiplas, visando máxima usabilidade e fluidez na leitura em cascata.
4. **Sem Alteração de Arquitetura**: Manutenções corretivas em componentes principais (como `DadosCaso.tsx`) devem manter a assinatura de funções, as rotas vigentes e o motor de automação perfeitamente intactos.

## 3. Diretrizes para Correções e Evolução

* **Rastreabilidade**: Todas as chamadas de API devem possuir logs técnicos detalhados e estruturados, salvos de forma persistente e exibidos em uma linha do tempo (Timeline) legível e profissional.
* **Integridade Operacional**: A automação com o Google Docs e Google Drive deve validar minuciosamente cada etapa do fluxo (autenticação, existência da pasta do cliente, preenchimento de placeholders e versionamento) para evitar arquivos duplicados ou deslocados no Drive.
