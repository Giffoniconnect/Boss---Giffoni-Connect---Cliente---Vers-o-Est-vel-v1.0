# REGRA PERMANENTE — GOVERNANÇA DO AVANÇO ADMINISTRATIVO

## 1. Objetivo e Aplicação

Esta regra estabelece as diretrizes obrigatórias de governança para qualquer alteração (criação, remoção, renomeação, divisão, união ou reordenação) de rotas, etapas principais ou subetapas no sistema **Giffoni Connect**. 

Qualquer modificação que interfira na esteira fática de produção deve atualizar a matriz canônica e validar de forma íntegra e sem divergências o indicador de **Avanço Administrativo**.

---

## 2. Requisitos de Informação de Rota e Fluxo

Todo prompt, implementação ou especificação que altere ou crie elementos no fluxo de produção deve obrigatoriamente mapear e atualizar os seguintes itens:

1. **Etapa-mãe**: Definir claramente a qual etapa-mãe a rota ou subrota pertence.
2. **Posição da Etapa**: A posição exata da etapa na sequência cronológica do fluxo.
3. **Total de Etapas**: O total exato de etapas principais cadastradas no sistema.
4. **Subrotas Pertencentes**: A listagem de todas as subrotas pertencentes à etapa atual.
5. **Navegação de Adjacência**: Especificar explicitamente a rota fática anterior e a próxima rota do fluxo.
6. **Impacto no Percentual**: O cálculo fático de como a mudança afeta o percentual global do Avanço Administrativo.
7. **Impacto na Timeline e Breadcrumb**: Alinhamento visual imediato para evitar que a timeline aponte uma etapa diferente do breadcrumb ou do cabeçalho.
8. **Controles de Navegação (Voltar e Salvar/Avançar)**: Ajuste dos manipuladores de navegação para que respondam corretamente à nova matriz de adjacência.
9. **Estados de Conclusão**: Mapear as condições para que a etapa seja considerada **concluída**, **em andamento** ou **pendente**.
10. **Comportamento de Fallback**: Garantir o tratamento correto para rotas não mapeadas ou desconhecidas, evitando travamentos ou comportamentos silenciosos de erro.

---

## 3. Diretrizes de Desenvolvimento e Restrições (Anti-Hardcode)

Para garantir a robustez e integridade do indicador de Avanço Administrativo, ficam impostas as seguintes restrições:

* **Proibição de Percentuais/Totais Hardcoded**: Todos os cálculos de percentual concluído e contagem de etapas devem ser derivados em tempo de execução da **Matriz Canônica**, em vez de valores numéricos estáticos e isolados.
* **Proibição de Contadores Paralelos**: É terminantemente proibido manter estados paralelos ou contagens de progresso independentes em componentes periféricos que possam causar discrepâncias com a timeline principal.
* **Proibição de Rotas Órfãs**: Toda nova rota criada deve ser explicitamente vinculada a uma etapa-mãe na matriz do fluxo.
* **Proibição de Fallback Silencioso para Etapa 1**: Caso uma rota não seja reconhecida ou esteja fora do mapeamento, o sistema deve registrar a falha de consistência ou avisar o usuário adequadamente, nunca regredir silenciosamente para a Etapa 1 como se o progresso estivesse zerado.
* **Validação de Limites de Progresso**: O percentual global de avanço é restrito matematicamente ao intervalo fático de `[0%, 100%]`. Valores negativos ou superiores a 100% são considerados falhas graves de validação.
* **Paridade de Timeline, Etapa Atual e Avanço**: A timeline visual, a indicação de etapa atual no breadcrumb e o valor percentual de progresso na esteira devem permanecer 100% sincronizados.

---

## 4. Fonte Única de Verdade (Matriz Canônica)

A **Matriz Canônica** do fluxo é o objeto estruturado e unificado que dita as regras de negócio para:
* Etapa ativa e totalizadora;
* Ordem cronológica das fases;
* Subrotas autorizadas;
* Percentual ponderado ou linear de progresso;
* Rótulos e Breadcrumbs;
* Navegação dinâmica em cascata.

Toda alteração de arquitetura de rotas deve começar pela atualização deste arquivo ou estrutura unificada, que servirá de insumo para todos os componentes dependentes no ecossistema.
