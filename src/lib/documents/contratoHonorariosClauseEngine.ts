import {
  parseCurrencyToCents,
  formatCurrency,
  formatCurrencyInWords,
  formatPercentage
} from "./ptBrNumberFormatting.js";

export interface ClauseEngineInput {
  modeloHonorarios?: string;
  formaPagamento?: string;
  tipoRecebimento?: string;
  pixBanco?: string;
  pixChave?: string;
  quantidadeParcelas?: string | number;
  diaVencimento?: string | number;
  dataPrimeiroVencimento?: string;
  
  // Financial values
  honorarioFixoValor?: string | number;
  valorEntrada?: string | number;
  valorParcela?: string | number;
  
  // Percentages
  percentualExito?: string | number;
  percentualExitoSobreRetroativo?: string | number;
  quantidadeParcelasExitoPrevidenciario?: string | number;

  // New canonical properties from Part 1
  baseCalculoExito?: string;
  baseCalculoExitoDescricao?: string;
  eventoCaracterizadorExito?: string;
  valoresIncluidosNaBase?: string[] | string;
  valoresExcluidosDaBase?: string[] | string;
  sucumbenciaTratamento?: string;
  despesasRessarciveis?: boolean | string;
  regrasDespesas?: string;
}

export interface ClauseTemplateDefinition {
  templateKey: string;
  versionId: string;
  templates: {
    fixo?: string;
    exito_simples?: string;
    exito_completo_trabalhista?: string;
    exito_completo_previdenciario?: string;
    fixo_mais_exito_simples?: string;
    fixo_mais_exito_completo_trabalhista?: string;
    fixo_mais_exito_completo_previdenciario?: string;
  };
}

// Highly polished, canonical default template clauses
export const DEFAULT_CLAUSE_TEMPLATES = {
  fixo: "A título de honorários advocatícios contratuais, fica estabelecido o valor fixo de {VALOR_FIXO}, que será {FORMA_PAGAMENTO_DETALHES}.",
  
  exito_simples: "A título de honorários advocatícios em caso de êxito na demanda, fica estabelecido o percentual de {PERCENTUAL_EXITO} sobre o proveito econômico efetivo obtido pela PARTE CONTRATANTE, devido apenas em caso de desfecho favorável.",
  
  exito_completo_trabalhista: "A título de honorários advocatícios em caso de êxito na demanda, fica estabelecido o percentual de {PERCENTUAL_EXITO} incidentes sobre todos os valores efetivamente recebidos pela PARTE CONTRATANTE ou apurados em liquidação, acordo, alvará ou depósitos judiciais, apurados minuciosamente conforme tabela analítica de rateio.",
  
  exito_completo_previdenciario: "A título de honorários advocatícios em caso de êxito na correspondente demanda previdenciária, fica estabelecido o percentual de {PERCENTUAL_EXITO_RETROATIVO} incidentes sobre o montante total de valores atrasados (retroativos) recebidos pela PARTE CONTRATANTE{PARCELAS_INSS_DETALHES}, em conformidade com as regras de proveito previdenciário.",
  
  fixo_mais_exito_simples: "A título de honorários advocatícios, pactua-se de forma cumulada: (a) o valor fixo de {VALOR_FIXO}, sendo {FORMA_PAGAMENTO_DETALHES}; e (b) o percentual de {PERCENTUAL_EXITO} sobre o proveito econômico final obtido pela PARTE CONTRATANTE como honorários de êxito.",
  
  fixo_mais_exito_completo_trabalhista: "A título de honorários advocatícios, pactua-se de forma cumulada: (a) o valor fixo de {VALOR_FIXO}, sendo {FORMA_PAGAMENTO_DETALHES}; e (b) o percentual de {PERCENTUAL_EXITO} incidentes sobre todos os valores recebidos ou apurados em liquidação, acordo, alvará ou depósitos judiciais vinculados ao processo trabalhista, apurados em tabela analítica.",
  
  fixo_mais_exito_completo_previdenciario: "A título de honorários advocatícios, pactua-se de forma cumulada: (a) o valor fixo de {VALOR_FIXO}, sendo {FORMA_PAGAMENTO_DETALHES}; e (b) o percentual de {PERCENTUAL_EXITO_RETROATIVO} incidentes sobre o montante de parcelas atrasadas (retroativos){PARCELAS_INSS_DETALHES_CUMULADO}."
};

/**
 * Builds the text detailing the bank/pix/cash receipt method.
 */
export function buildRecebimentoDetails(input: ClauseEngineInput): string {
  const tipo = input.tipoRecebimento || "PIX";
  const pixBanco = input.pixBanco || "Nubank";
  const pixChave = input.pixChave || "";

  switch (tipo) {
    case "Dinheiro":
      return "pago em dinheiro, mediante recibo.";
    case "PIX":
      return `pago mediante PIX para a conta de titularidade da PARTE CONTRATADA junto ao ${pixBanco}, chave PIX ${pixChave}.`;
    case "Transferência Bancária":
      return "pago mediante transferência bancária para conta indicada pela PARTE CONTRATADA.";
    case "PagSeguro":
      return "pago mediante link de pagamento emitido pela plataforma PagSeguro.";
    case "InfinitePay":
      return "pago mediante link de pagamento emitido pela plataforma InfinitePay.";
    case "ASAAS":
      return "pago mediante boleto, PIX ou link de pagamento emitido pela plataforma ASAAS.";
    case "Stripe":
      return "pago mediante link de pagamento emitido pela plataforma Stripe.";
    case "Cartão de Crédito - Maquininha PagSeguro":
      return "pago mediante cartão de crédito na maquininha da PagSeguro.";
    default:
      return "pago conforme condições acordadas.";
  }
}

/**
 * Builds the text detailing the fixed payment configuration (installments, etc.).
 */
export function buildFormaPagamentoDetails(input: ClauseEngineInput, recebimentoDetails: string): string {
  const forma = input.formaPagamento || "À vista";
  const qtdParcelas = input.quantidadeParcelas || "1";
  const diaVenc = input.diaVencimento || "10";
  const primeiroVenc = input.dataPrimeiroVencimento || "A combinar";

  // Parse values to centavos for precision
  const valorFixoCents = parseCurrencyToCents(input.honorarioFixoValor);
  const valorParcelaCents = parseCurrencyToCents(input.valorParcela);
  const valorEntradaCents = parseCurrencyToCents(input.valorEntrada);

  const valorFixoFormatted = `${formatCurrency(valorFixoCents)} (${formatCurrencyInWords(valorFixoCents)})`;
  const valorParcelaFormatted = `${formatCurrency(valorParcelaCents)} (${formatCurrencyInWords(valorParcelaCents)})`;
  const valorEntradaFormatted = `${formatCurrency(valorEntradaCents)} (${formatCurrencyInWords(valorEntradaCents)})`;

  if (forma === "À vista") {
    return `mencionado valor de ${valorFixoFormatted} pago à vista, mediante ${recebimentoDetails}`;
  }
  
  if (forma === "Parcelado") {
    return `mencionado valor de ${valorFixoFormatted} parcelado em ${qtdParcelas} vezes mensais e sucessivas de ${valorParcelaFormatted}, vencendo-se a primeira em ${primeiroVenc} e as demais todo dia ${diaVenc} dos meses subsequentes, mediante ${recebimentoDetails}`;
  }
  
  if (forma === "Entrada + Parcelado") {
    return `mencionado valor de ${valorFixoFormatted}, com sinal de ${valorEntradaFormatted} a título de entrada e saldo em ${qtdParcelas} parcelas mensais e sucessivas de ${valorParcelaFormatted}, vencendo-se a primeira em ${primeiroVenc} e as demais todo dia ${diaVenc} dos meses subsequentes, mediante ${recebimentoDetails}`;
  }

  return `mencionado valor de ${valorFixoFormatted} pago conforme condições da forma ${forma}`;
}

function getBaseCalculoLabel(base?: string, customDesc?: string): string {
  if (!base) return "proveito econômico efetivo obtido pela PARTE CONTRATANTE";
  switch (base) {
    case "valor_efetivamente_recebido":
      return "valores efetivamente recebidos pela PARTE CONTRATANTE";
    case "valor_bruto_acordo":
      return "valor bruto total obtido em acordo";
    case "proveito_economico":
      return "proveito econômico efetivo obtido pela PARTE CONTRATANTE";
    case "credito_liquido_cliente":
      return "crédito líquido apurado em favor da PARTE CONTRATANTE";
    case "valor_personalizado":
      return customDesc || "base de cálculo personalizada acordada";
    default:
      return "proveito econômico obtido";
  }
}

/**
 * Compile the complete Clause Segunda text.
 * Pure function that maps clean outputs using normalized PT-BR formats and precise numbers.
 */
export function compileClausulaSegunda(
  input: ClauseEngineInput,
  templateDefinition?: ClauseTemplateDefinition
): string {
  const modelo = input.modeloHonorarios || "fixo";
  
  // Choose templates source
  const templates = templateDefinition?.templates || DEFAULT_CLAUSE_TEMPLATES;
  const rawTemplate = (templates as any)[modelo] || DEFAULT_CLAUSE_TEMPLATES.fixo;

  // Formatting variables
  const valorFixoCents = parseCurrencyToCents(input.honorarioFixoValor);
  const valorFixoFormatted = `${formatCurrency(valorFixoCents)} (${formatCurrencyInWords(valorFixoCents)})`;
  
  const percentualExitoFormatted = formatPercentage(input.percentualExito || "30%");
  const percentualExitoRetroativoFormatted = formatPercentage(input.percentualExitoSobreRetroativo || percentualExitoFormatted);
  const qtdParcelasFuturas = Number(input.quantidadeParcelasExitoPrevidenciario) || 0;

  // Build nested sub-texts
  const recebimentoDetails = buildRecebimentoDetails(input);
  const formaPagamentoDetails = buildFormaPagamentoDetails(input, recebimentoDetails);

  // Previdenciario specific details
  const parcelasInssDetails = qtdParcelasFuturas > 0 
    ? `, bem como o valor equivalente a ${qtdParcelasFuturas} parcelas mensais do benefício previdenciário concedido após sua implantação` 
    : "";
  const parcelasInssDetailsCumulado = qtdParcelasFuturas > 0 
    ? `, cumulado ainda com o valor de ${qtdParcelasFuturas} parcelas do benefício previdenciário implantado` 
    : "";

  // Perform substitution
  let clauseText = rawTemplate
    .replace(/{VALOR_FIXO}/g, valorFixoFormatted)
    .replace(/{FORMA_PAGAMENTO_DETALHES}/g, formaPagamentoDetails)
    .replace(/{PERCENTUAL_EXITO}/g, percentualExitoFormatted)
    .replace(/{PERCENTUAL_EXITO_RETROATIVO}/g, percentualExitoRetroativoFormatted)
    .replace(/{PARCELAS_INSS_DETALHES}/g, parcelasInssDetails)
    .replace(/{PARCELAS_INSS_DETALHES_CUMULADO}/g, parcelasInssDetailsCumulado);

  // Dynamic Base of Calculation replacement (Requirement: do not leave 'proveito econômico' fixed if selected otherwise)
  if (input.baseCalculoExito) {
    const baseLabel = getBaseCalculoLabel(input.baseCalculoExito, input.baseCalculoExitoDescricao);
    clauseText = clauseText.replace(/proveito econômico efetivo obtido pela PARTE CONTRATANTE/g, baseLabel);
    clauseText = clauseText.replace(/proveito econômico final obtido pela PARTE CONTRATANTE/g, baseLabel);
  }

  // Evento caracterizador do êxito
  if (input.eventoCaracterizadorExito && input.eventoCaracterizadorExito.trim() !== "") {
    clauseText += ` Fica estabelecido que o direito aos honorários de êxito será caracterizado e considerado devido a partir do seguinte evento de êxito: ${input.eventoCaracterizadorExito}.`;
  }

  // Valores incluídos e excluídos
  const incs = Array.isArray(input.valoresIncluidosNaBase) 
    ? input.valoresIncluidosNaBase 
    : typeof input.valoresIncluidosNaBase === "string" 
      ? input.valoresIncluidosNaBase.split(",").map(x => x.trim()).filter(Boolean)
      : [];
  const excs = Array.isArray(input.valoresExcluidosDaBase)
    ? input.valoresExcluidosDaBase
    : typeof input.valoresExcluidosDaBase === "string"
      ? input.valoresExcluidosDaBase.split(",").map(x => x.trim()).filter(Boolean)
      : [];

  if (incs.length > 0) {
    clauseText += ` Estão expressamente incluídos na base de cálculo dos honorários de êxito: ${incs.join(", ")}.`;
  }
  if (excs.length > 0) {
    clauseText += ` Estão expressamente excluídos da base de cálculo dos honorários de êxito: ${excs.join(", ")}.`;
  }

  // Tratamento de sucumbência
  if (input.sucumbenciaTratamento === "separada_do_contrato") {
    clauseText += " Fica pactuado que os honorários de sucumbência eventualmente fixados judicialmente pertencem exclusivamente aos advogados da PARTE CONTRATADA, cumulativamente aos honorários contratuais aqui estabelecidos.";
  } else if (input.sucumbenciaTratamento === "incluida_expressamente") {
    clauseText += " Fica pactuado que eventuais honorários de sucumbência recebidos pelos advogados serão compensados ou abatidos dos honorários contratuais devidos pela PARTE CONTRATANTE.";
  }

  // Despesas ressarcíveis
  if (input.despesasRessarciveis === true || String(input.despesasRessarciveis) === "true") {
    clauseText += ` Além dos honorários advocatícios, correrá por conta da PARTE CONTRATANTE o reembolso de todas as despesas e custas necessárias para o andamento processual, reguladas da seguinte forma: ${input.regrasDespesas || "reembolso integral mediante prestação de contas com comprovantes"}.`;
  }

  return clauseText;
}
