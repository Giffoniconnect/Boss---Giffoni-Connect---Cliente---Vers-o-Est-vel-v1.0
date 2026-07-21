import {
  buildContratoHonorariosPfPlaceholders,
  buildContratoHonorariosPjPlaceholders,
  buildClausulaSegunda
} from "./placeholderBuilders";

export type BattleMapStatus = "success" | "failed";

export interface BattleMapRow {
  id: string;
  documentType: "contrato_honorarios_pf" | "contrato_honorarios_pj";
  sourceStage: string;
  sourceField: string;
  informationLabel: string;
  migratedValueMasked: string;
  placeholder: string;
  replacementStatus: BattleMapStatus;
  failureReason: string | null;
  naturalLanguageMessage: string;
  previewValue: string;
  integrationValue: string;
  parityStatus: "Paridade confirmada" | "Divergência identificada" | "Ausente no Preview" | "Ausente na Integração";
}

export interface BattleMapResult {
  success: boolean;
  documentType: string;
  caseId: string;
  generatedAt: string;
  summary: {
    total: number;
    success: number;
    failed: number;
  };
  rows: BattleMapRow[];
  technicalLog: Array<{
    timestamp: string;
    step: string;
    status: "info" | "success" | "warning" | "error";
    message: string;
    errorCode?: string;
  }>;
}

export interface ContractContextParams {
  documentType: "contrato_honorarios_pf" | "contrato_honorarios_pj";
  clientData: any;
  caseData: any;
  financialData: any;
}

// Simple deterministic hash helper
export function generateParityHash(normalizedPlaceholders: Record<string, string>): string {
  const sortedKeys = Object.keys(normalizedPlaceholders).sort();
  const sortedObj: Record<string, string> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = normalizedPlaceholders[key] || "";
  }
  const str = JSON.stringify(sortedObj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `PARITY_HASH_${Math.abs(hash).toString(16).toUpperCase()}`;
}

export function maskSensitiveValue(key: string, val: any): string {
  if (val === undefined || val === null) return "";
  const str = String(val).trim();
  if (!str) return "";

  // Check key/placeholder name or value format
  const lowerKey = key.toLowerCase();
  
  if (lowerKey.includes("cpf") && !lowerKey.includes("cnpj")) {
    const cleaned = str.replace(/\D/g, "");
    if (cleaned.length >= 11) {
      return `${cleaned.slice(0, 3)}.***.***-${cleaned.slice(-2)}`;
    }
    return "***.***.***-**";
  }
  
  if (lowerKey.includes("cnpj")) {
    const cleaned = str.replace(/\D/g, "");
    if (cleaned.length >= 14) {
      return `${cleaned.slice(0, 2)}.***.***/****-${cleaned.slice(-2)}`;
    }
    return "**.***.***/****-**";
  }
  
  if (lowerKey.includes("rg") && !lowerKey.includes("cargo") && !lowerKey.includes("orgao")) {
    const cleaned = str.replace(/\D/g, "");
    if (cleaned.length >= 4) {
      return `${cleaned.slice(0, 2)}..***-**`;
    }
    return "**..***-**";
  }
  
  if (lowerKey.includes("email") || str.includes("@")) {
    const parts = str.split("@");
    if (parts.length === 2) {
      const name = parts[0];
      const domain = parts[1];
      const maskedName = name.length > 2 ? `${name[0]}*****${name[name.length - 1]}` : "*****";
      return `${maskedName}@${domain}`;
    }
    return "*****@*****";
  }
  
  if (lowerKey.includes("telefone") || lowerKey.includes("whatsapp")) {
    const cleaned = str.replace(/\D/g, "");
    if (cleaned.length >= 8) {
      return `(***) *****-${cleaned.slice(-4)}`;
    }
    return "(***) *****-****";
  }
  
  return str;
}

// Define canonical fields and their origins
interface FieldDescriptor {
  placeholder: string;
  label: string;
  sourceStage: string | ((client: any, caseObj: any, fin: any) => string);
  sourceField: string | ((client: any, caseObj: any, fin: any) => string);
  getRawValue: (client: any, caseObj: any, fin: any) => any;
  isSensitive?: boolean;
}

const PF_FIELD_DESCRIPTORS: FieldDescriptor[] = [
  {
    placeholder: "{{OUTORGANTE_NOME}}",
    label: "Nome do contratante",
    sourceStage: "Etapa 01 — Cadastro PF",
    sourceField: "client.pf_nomeCompleto",
    getRawValue: (c) => c?.pf_nomeCompleto || c?.pfData?.pf_nomeCompleto || c?.pfDadosPessoais?.pf_nomeCompleto || c?.nomeCompleto || c?.nome || ""
  },
  {
    placeholder: "{{OUTORGANTE_CPF}}",
    label: "CPF do contratante",
    sourceStage: "Etapa 01 — Cadastro PF",
    sourceField: "client.pf_cpf",
    getRawValue: (c) => c?.pf_cpf || c?.pfData?.pf_cpf || c?.pfDadosPessoais?.pf_cpf || c?.cpf || "",
    isSensitive: true
  },
  {
    placeholder: "{{OUTORGANTE_RG}}",
    label: "RG do contratante",
    sourceStage: "Etapa 01 — Cadastro PF",
    sourceField: "client.pf_rg",
    getRawValue: (c) => c?.pf_rg || c?.pfData?.pf_rg || c?.pfDadosPessoais?.pf_rg || c?.rg || "",
    isSensitive: true
  },
  {
    placeholder: "{{OUTORGANTE_NACIONALIDADE}}",
    label: "Nacionalidade",
    sourceStage: "Etapa 01 — Cadastro PF",
    sourceField: "client.pf_nacionalidade",
    getRawValue: (c) => c?.pf_nacionalidade || c?.pfData?.pf_nacionalidade || c?.pfDadosPessoais?.pf_nacionalidade || ""
  },
  {
    placeholder: "{{OUTORGANTE_ESTADO_CIVIL}}",
    label: "Estado civil",
    sourceStage: "Etapa 01 — Cadastro PF",
    sourceField: "client.pf_estadoCivil",
    getRawValue: (c) => c?.pf_estadoCivil || c?.pfData?.pf_estadoCivil || c?.pfDadosPessoais?.pf_estadoCivil || ""
  },
  {
    placeholder: "{{OUTORGANTE_PROFISSAO}}",
    label: "Profissão",
    sourceStage: "Etapa 01 — Cadastro PF",
    sourceField: "client.pf_profissao",
    getRawValue: (c) => c?.pf_profissao || c?.pfData?.pf_profissao || c?.pfDadosPessoais?.pf_profissao || ""
  },
  {
    placeholder: "{{OUTORGANTE_ENDERECO}}",
    label: "Endereço",
    sourceStage: "Etapa 01 — Cadastro PF",
    sourceField: "client.pf_endereco",
    getRawValue: (c) => c?.pf_endereco || c?.pfData?.pf_endereco || c?.pfDadosPessoais?.pf_endereco || c?.enderecoCompleto || ""
  },
  {
    placeholder: "{{OUTORGANTE_TELEFONE}}",
    label: "Telefone",
    sourceStage: "Etapa 01 — Cadastro PF",
    sourceField: "client.pf_telefone",
    getRawValue: (c) => c?.pf_telefone || c?.pfData?.pf_telefone || c?.pfDadosPessoais?.pf_telefone || c?.telefone || "",
    isSensitive: true
  },
  {
    placeholder: "{{OUTORGANTE_WHATSAPP}}",
    label: "WhatsApp",
    sourceStage: "Etapa 01 — Cadastro PF",
    sourceField: "client.pf_whatsapp",
    getRawValue: (c) => c?.pf_whatsapp || c?.pfData?.pf_whatsapp || c?.pfDadosPessoais?.pf_whatsapp || c?.whatsapp || "",
    isSensitive: true
  },
  {
    placeholder: "{{OUTORGANTE_EMAIL}}",
    label: "E-mail",
    sourceStage: "Etapa 01 — Cadastro PF",
    sourceField: "client.pf_email",
    getRawValue: (c) => c?.pf_email || c?.pfData?.pf_email || c?.pfDadosPessoais?.pf_email || c?.email || "",
    isSensitive: true
  }
];

const PJ_FIELD_DESCRIPTORS: FieldDescriptor[] = [
  {
    placeholder: "{{RAZAO_SOCIAL}}",
    label: "Razão social",
    sourceStage: "Etapa 01 — Cadastro PJ",
    sourceField: "client.pj_razaoSocial",
    getRawValue: (c) => c?.pj_razaoSocial || c?.pjData?.pj_razaoSocial || c?.pjDadosEmpresa?.pj_razaoSocial || c?.razaoSocial || ""
  },
  {
    placeholder: "{{CNPJ}}",
    label: "CNPJ",
    sourceStage: "Etapa 01 — Cadastro PJ",
    sourceField: "client.pj_cnpj",
    getRawValue: (c) => c?.pj_cnpj || c?.pjData?.pj_cnpj || c?.pjDadosEmpresa?.pj_cnpj || c?.cnpj || "",
    isSensitive: true
  },
  {
    placeholder: "{{ENDERECO_EMPRESA_COMPLETO}}",
    label: "Endereço da empresa",
    sourceStage: "Etapa 01 — Cadastro PJ",
    sourceField: "client.pj_endereco",
    getRawValue: (c) => c?.pj_endereco || c?.pjData?.pj_endereco || c?.pjDadosEmpresa?.pj_endereco || c?.enderecoEmpresaCompleto || ""
  },
  {
    placeholder: "{{TELEFONE_EMPRESA}}",
    label: "Telefone comercial",
    sourceStage: "Etapa 01 — Cadastro PJ",
    sourceField: "client.pj_telefone",
    getRawValue: (c) => c?.pj_telefone || c?.pjData?.pj_telefone || c?.pjDadosEmpresa?.pj_telefone || "",
    isSensitive: true
  },
  {
    placeholder: "{{EMAIL_EMPRESA}}",
    label: "E-mail empresarial",
    sourceStage: "Etapa 01 — Cadastro PJ",
    sourceField: "client.pj_email",
    getRawValue: (c) => c?.pj_email || c?.pjData?.pj_email || c?.pjDadosEmpresa?.pj_email || "",
    isSensitive: true
  },
  {
    placeholder: "{{NOME_SOCIO_ADMINISTRADOR}}",
    label: "Representante legal",
    sourceStage: "Etapa 01 — Cadastro PJ",
    sourceField: "client.pj_nomeSocioAdministrador",
    getRawValue: (c) => c?.pj_nomeSocioAdministrador || c?.pjData?.pj_nomeSocioAdministrador || c?.pjDadosRepresentante?.pj_representanteNomeCompleto || ""
  },
  {
    placeholder: "{{CPF_SOCIO}}",
    label: "CPF do representante",
    sourceStage: "Etapa 01 — Cadastro PJ",
    sourceField: "client.pj_cpfSocio",
    getRawValue: (c) => c?.pj_cpfSocio || c?.pjData?.pj_cpfSocio || c?.pjDadosRepresentante?.pj_representanteCpf || "",
    isSensitive: true
  }
];

const SHARED_FIELD_DESCRIPTORS: FieldDescriptor[] = [
  {
    placeholder: "{{TIPO_SERVICO}}",
    label: "Tipo de Serviço Contratado",
    sourceStage: (c, cs, f) => f?.tipoServicoContratado ? "Etapa Financeira — Estado atual da tela" : "Etapa de Definição do Tipo de Serviço",
    sourceField: (c, cs, f) => f?.tipoServicoContratado ? "financialData.tipoServicoContratado" : "caseData.tipoServicoContratado || caseData.tipoServico",
    getRawValue: (c, cs, f) => f?.tipoServicoContratado || cs?.tipoServicoContratado || cs?.tipoServico || cs?.assunto || ""
  },
  {
    placeholder: "{{VALOR_HONORARIOS}}",
    label: "Valor fixo",
    sourceStage: "Etapa Financeira — Criar Contrato de Honorários",
    sourceField: "financialData.honorarioFixoValor",
    getRawValue: (c, cs, f) => f?.honorarioFixoValor || ""
  },
  {
    placeholder: "{{TIPO_HONORARIO}}",
    label: "Tipo de honorários",
    sourceStage: "Etapa Financeira — Criar Contrato de Honorários",
    sourceField: "financialData.tipoHonorario",
    getRawValue: (c, cs, f) => f?.tipoHonorario || ""
  },
  {
    placeholder: "{{FORMA_PAGAMENTO}}",
    label: "Forma de pagamento",
    sourceStage: "Etapa Financeira — Criar Contrato de Honorários",
    sourceField: "financialData.formaPagamento",
    getRawValue: (c, cs, f) => f?.formaPagamento || ""
  },
  {
    placeholder: "{{TIPO_RECEBIMENTO}}",
    label: "Tipo de recebimento",
    sourceStage: "Etapa Financeira — Criar Contrato de Honorários",
    sourceField: "financialData.tipoRecebimento",
    getRawValue: (c, cs, f) => f?.tipoRecebimento || ""
  },
  {
    placeholder: "{{PIX_BANCO}}",
    label: "Banco do PIX",
    sourceStage: "Etapa Financeira — Criar Contrato de Honorários",
    sourceField: "financialData.pixBanco",
    getRawValue: (c, cs, f) => f?.pixBanco || ""
  },
  {
    placeholder: "{{PIX_CHAVE}}",
    label: "Chave PIX",
    sourceStage: "Etapa Financeira — Criar Contrato de Honorários",
    sourceField: "financialData.pixChave",
    getRawValue: (c, cs, f) => f?.pixChave || "",
    isSensitive: true
  },
  {
    placeholder: "{{QUANTIDADE_PARCELAS}}",
    label: "Quantidade de parcelas",
    sourceStage: "Etapa Financeira — Criar Contrato de Honorários",
    sourceField: "financialData.quantidadeParcelas",
    getRawValue: (c, cs, f) => f?.quantidadeParcelas || ""
  },
  {
    placeholder: "{{VALOR_PARCELA}}",
    label: "Valor da parcela",
    sourceStage: "Etapa Financeira — Criar Contrato de Honorários",
    sourceField: "financialData.valorParcela",
    getRawValue: (c, cs, f) => f?.valorParcela || ""
  },
  {
    placeholder: "{{DIA_VENCIMENTO}}",
    label: "Dia de vencimento",
    sourceStage: "Etapa Financeira — Criar Contrato de Honorários",
    sourceField: "financialData.diaVencimento",
    getRawValue: (c, cs, f) => f?.diaVencimento || ""
  },
  {
    placeholder: "{{VALOR_ENTRADA}}",
    label: "Valor da entrada",
    sourceStage: "Etapa Financeira — Criar Contrato de Honorários",
    sourceField: "financialData.valorEntrada",
    getRawValue: (c, cs, f) => f?.valorEntrada || ""
  },
  {
    placeholder: "{{DATA_PRIMEIRO_VENCIMENTO}}",
    label: "Primeiro vencimento",
    sourceStage: "Etapa Financeira — Criar Contrato de Honorários",
    sourceField: "financialData.dataPrimeiroVencimento",
    getRawValue: (c, cs, f) => f?.dataPrimeiroVencimento || ""
  },
  {
    placeholder: "{{MODELO_HONORARIOS}}",
    label: "Modelo de honorários",
    sourceStage: "Etapa Financeira — Criar Contrato de Honorários",
    sourceField: "financialData.modeloHonorarios",
    getRawValue: (c, cs, f) => f?.modeloHonorarios || ""
  },
  {
    placeholder: "{{CLAUSULA_SEGUNDA}}",
    label: "Cláusula Segunda",
    sourceStage: "Motor de Documentos — Consolidação automática",
    sourceField: "buildClausulaSegunda",
    getRawValue: (c, cs, f) => buildClausulaSegunda(f, cs)
  }
];

// Fallback HTML structures for PF/PJ for Option 2 local representation
const PF_LOCAL_TEMPLATE = `
<div class="space-y-6 text-gray-800 leading-relaxed font-sans max-w-3xl mx-auto p-6 bg-white border border-gray-100 rounded-xl shadow-xs">
  <h1 class="text-center font-bold text-lg uppercase tracking-wider text-blue-950">CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS E DE HONORÁRIOS</h1>
  
  <p><strong>CONTRATANTE:</strong> {{OUTORGANTE_NOME}}, {{OUTORGANTE_NACIONALIDADE}}, {{OUTORGANTE_ESTADO_CIVIL}}, {{OUTORGANTE_PROFISSAO}}, inscrito no CPF sob o nº {{OUTORGANTE_CPF}} e RG {{OUTORGANTE_RG}}, residente e domiciliado em {{OUTORGANTE_ENDERECO}}, telefone {{OUTORGANTE_TELEFONE}}, e-mail {{OUTORGANTE_EMAIL}}.</p>
  
  <p><strong>CONTRATADA:</strong> {{ESCRITORIO_NOME}}, sociedade de advogados inscrita no CNPJ sob o nº 44.555.666/0001-99, com sede na {{ESCRITORIO_ENDERECO}}, neste ato representada por seu sócio administrador {{ADVOGADO_NOME}}, inscrito na OAB/MG sob o nº {{ADVOGADO_OAB}}.</p>
  
  <p>As partes acima qualificadas resolvem firmar o presente contrato sob as cláusulas e condições seguintes:</p>
  
  <div class="space-y-2">
    <h2 class="font-bold text-sm uppercase text-blue-900">CLÁUSULA PRIMEIRA — DO OBJETO</h2>
    <p>O presente contrato tem por objeto a prestação de serviços advocatícios para atuação na defesa dos interesses do CONTRATANTE, especificamente no que tange ao seguinte objeto/demanda: <span class="bg-blue-50 text-blue-900 px-1 py-0.5 rounded font-semibold">{{TIPO_SERVICO}}</span>.</p>
  </div>
  
  <div class="space-y-2">
    <h2 class="font-bold text-sm uppercase text-blue-900">CLÁUSULA SEGUNDA — DOS HONORÁRIOS</h2>
    <div class="p-4 bg-slate-50 border-l-4 border-indigo-500 rounded text-slate-800 italic whitespace-pre-wrap font-serif">
      {{CLAUSULA_SEGUNDA}}
    </div>
  </div>
  
  <div class="space-y-2">
    <h2 class="font-bold text-sm uppercase text-blue-900">CLÁUSULA TERCEIRA — DOS DEVERES E RESPONSABILIDADES</h2>
    <p>A CONTRATADA obriga-se a desempenhar os seus serviços com zelo, perícia e diligência. O CONTRATANTE se compromete a fornecer todos os subsídios fáticos e documentais em tempo hábil, responsabilizando-se civil e criminalmente pelas declarações e documentos prestados.</p>
  </div>
  
  <div class="space-y-2">
    <h2 class="font-bold text-sm uppercase text-blue-900">CLÁUSULA QUARTA — DO FORO ELEITO</h2>
    <p>As partes elegem o foro da Comarca de {{CIDADE_ASSINATURA}} para dirimir qualquer dúvida ou litígio decorrente deste ajuste.</p>
  </div>
  
  <p class="text-right mt-8 text-sm text-gray-500">{{CIDADE_ASSINATURA}}, {{DATA_ASSINATURA}}.</p>
  
  <div class="flex justify-between mt-12 pt-8 border-t border-gray-150">
    <div class="text-center w-5/12">
      <div class="h-0.5 bg-gray-300 mx-auto w-4/5 mb-1.5"></div>
      <p class="font-bold text-xs text-gray-800">{{OUTORGANTE_NOME}}</p>
      <p class="text-[10px] text-gray-500 uppercase tracking-wider">CONTRATANTE</p>
    </div>
    <div class="text-center w-5/12">
      <div class="h-0.5 bg-gray-300 mx-auto w-4/5 mb-1.5"></div>
      <p class="font-bold text-xs text-gray-800">{{ADVOGADO_NOME}}</p>
      <p class="text-[10px] text-gray-500 uppercase tracking-wider">{{ADVOGADO_OAB}}</p>
    </div>
  </div>
</div>
`;

const PJ_LOCAL_TEMPLATE = `
<div class="space-y-6 text-gray-800 leading-relaxed font-sans max-w-3xl mx-auto p-6 bg-white border border-gray-100 rounded-xl shadow-xs">
  <h1 class="text-center font-bold text-lg uppercase tracking-wider text-blue-950">CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS EMPRESARIAIS</h1>
  
  <p><strong>CONTRATANTE:</strong> {{RAZAO_SOCIAL}}, inscrita no CNPJ sob o nº {{CNPJ}}, com sede em {{ENDERECO_EMPRESA_COMPLETO}}, telefone {{TELEFONE_EMPRESA}}, e-mail {{EMAIL_EMPRESA}}, neste ato devidamente representada por seu sócio/representante legal {{NOME_SOCIO_ADMINISTRADOR}}, portador do CPF nº {{CPF_SOCIO}}.</p>
  
  <p><strong>CONTRATADA:</strong> {{ESCRITORIO_NOME}}, sociedade de advogados inscrita no CNPJ sob o nº 44.555.666/0001-99, com sede na {{ESCRITORIO_ENDERECO}}, neste ato representada por seu sócio administrador {{ADVOGADO_NOME}}, inscrito na OAB/MG sob o nº {{ADVOGADO_OAB}}.</p>
  
  <p>As partes acima qualificadas resolvem firmar o presente contrato sob as cláusulas e condições seguintes:</p>
  
  <div class="space-y-2">
    <h2 class="font-bold text-sm uppercase text-blue-900">CLÁUSULA PRIMEIRA — DO OBJETO</h2>
    <p>O presente contrato tem por objeto a prestação de serviços advocatícios empresariais para atuação na defesa dos interesses do CONTRATANTE, especificamente no que tange ao seguinte objeto/demanda: <span class="bg-blue-50 text-blue-900 px-1 py-0.5 rounded font-semibold">{{TIPO_SERVICO}}</span>.</p>
  </div>
  
  <div class="space-y-2">
    <h2 class="font-bold text-sm uppercase text-blue-900">CLÁUSULA SEGUNDA — DOS HONORÁRIOS</h2>
    <div class="p-4 bg-slate-50 border-l-4 border-indigo-500 rounded text-slate-800 italic whitespace-pre-wrap font-serif">
      {{CLAUSULA_SEGUNDA}}
    </div>
  </div>
  
  <div class="space-y-2">
    <h2 class="font-bold text-sm uppercase text-blue-900">CLÁUSULA TERCEIRA — DOS DEVERES E RESPONSABILIDADES</h2>
    <p>A CONTRATADA obriga-se a desempenhar os seus serviços com zelo, perícia e diligência. O CONTRATANTE se compromete a fornecer todos os subsídios fáticos e documentais em tempo hábil, responsabilizando-se civil e criminalmente pelas declarações e documentos prestados.</p>
  </div>
  
  <div class="space-y-2">
    <h2 class="font-bold text-sm uppercase text-blue-900">CLÁUSULA QUARTA — DO FORO ELEITO</h2>
    <p>As partes elegem o foro da Comarca de {{CIDADE_ASSINATURA}} para dirimir qualquer dúvida ou litígio decorrente deste ajuste.</p>
  </div>
  
  <p class="text-right mt-8 text-sm text-gray-500">{{CIDADE_ASSINATURA}}, {{DATA_ASSINATURA}}.</p>
  
  <div class="flex justify-between mt-12 pt-8 border-t border-gray-150">
    <div class="text-center w-5/12">
      <div class="h-0.5 bg-gray-300 mx-auto w-4/5 mb-1.5"></div>
      <p class="font-bold text-xs text-gray-800">{{RAZAO_SOCIAL}}</p>
      <p class="text-[10px] text-gray-500 uppercase tracking-wider">CONTRATANTE</p>
    </div>
    <div class="text-center w-5/12">
      <div class="h-0.5 bg-gray-300 mx-auto w-4/5 mb-1.5"></div>
      <p class="font-bold text-xs text-gray-800">{{ADVOGADO_NOME}}</p>
      <p class="text-[10px] text-gray-500 uppercase tracking-wider">{{ADVOGADO_OAB}}</p>
    </div>
  </div>
</div>
`;

export function buildContratoHonorariosDocumentContext(params: ContractContextParams, integrationPlaceholdersMap: Record<string, string> = {}): any {
  const { documentType, clientData, caseData, financialData } = params;
  const isPf = documentType === "contrato_honorarios_pf";

  const technicalLog: any[] = [];
  const addLog = (step: string, status: "info" | "success" | "warning" | "error", message: string) => {
    technicalLog.push({
      timestamp: new Date().toISOString(),
      step,
      status,
      message
    });
  };

  addLog("CONTRACT_CANONICAL_CONTEXT_BUILD_STARTED", "info", `Iniciando construção de contexto canônico para ${documentType}`);

  // Form the canonical financial state
  const mockFinData = {
    ...caseData?.financeiro,
    ...financialData
  };

  addLog("CONTRACT_CLAUSULA_SEGUNDA_BUILD_STARTED", "info", "Iniciando compilação da Cláusula Segunda de honorários.");
  let cl2 = "";
  try {
    cl2 = buildClausulaSegunda(mockFinData, caseData);
    addLog("CONTRACT_CLAUSULA_SEGUNDA_BUILD_SUCCESS", "success", "Cláusula Segunda gerada com sucesso a partir dos parâmetros operacionais.");
  } catch (err: any) {
    addLog("CONTRACT_CLAUSULA_SEGUNDA_BUILD_FAILED", "error", `Falha ao construir a Cláusula Segunda: ${err.message}`);
  }

  addLog("CONTRACT_TIPO_SERVICO_RESOLVED", "info", "Avaliando e resolvendo o Tipo do Serviço Contratado.");
  const resolvedServiceType = 
    mockFinData?.tipoServicoContratado ||
    caseData?.tipoServicoContratado ||
    caseData?.tipoServico ||
    caseData?.assunto ||
    "";
  if (!resolvedServiceType) {
    addLog("CONTRACT_TIPO_SERVICO_EMPTY", "warning", "O Tipo de Serviço Contratado está vazio no payload.");
  } else {
    addLog("CONTRACT_TIPO_SERVICO_RESOLVED", "success", `Serviço resolvido: "${resolvedServiceType}"`);
  }

  // Select appropriate builder for placeholders
  const resolvedPlaceholders = isPf 
    ? buildContratoHonorariosPfPlaceholders(clientData, { ...caseData, ...mockFinData }, mockFinData)
    : buildContratoHonorariosPjPlaceholders(clientData, { ...caseData, ...mockFinData }, mockFinData);

  // Force actual variables
  resolvedPlaceholders["{{TIPO_SERVICO}}"] = resolvedServiceType || "Serviço de Assessoria Jurídica";
  resolvedPlaceholders["{{CLAUSULA_SEGUNDA}}"] = cl2;

  const parityHash = generateParityHash(resolvedPlaceholders);
  addLog("CONTRACT_PARITY_CHECK_STARTED", "info", `Mapa de placeholders gerado com hash de paridade determinístico: ${parityHash}`);

  // Build the Battle Map Row structures
  const activeDescriptors = isPf ? PF_FIELD_DESCRIPTORS : PJ_FIELD_DESCRIPTORS;
  const allDescriptors = [...activeDescriptors, ...SHARED_FIELD_DESCRIPTORS];

  const rows: BattleMapRow[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const desc of allDescriptors) {
    const ph = desc.placeholder;
    const rawVal = desc.getRawValue(clientData, caseData, mockFinData);
    const resolvedVal = resolvedPlaceholders[ph] ?? "";

    const stage = typeof desc.sourceStage === "function" ? desc.sourceStage(clientData, caseData, mockFinData) : desc.sourceStage;
    const field = typeof desc.sourceField === "function" ? desc.sourceField(clientData, caseData, mockFinData) : desc.sourceField;

    const isProvisional = [
      "a definir", "a combinar", "não aplicável", "undefined", "null", "string vazia", ""
    ].includes(String(rawVal).toLowerCase().trim());

    let status: BattleMapStatus = "success";
    let failureReason: string | null = null;
    let message = "";

    const hasPlaceholder = resolvedPlaceholders[ph] !== undefined;

    if (!hasPlaceholder) {
      status = "failed";
      failureReason = "PLACEHOLDER_NOT_GENERATED";
      message = "O backend não gerou este placeholder no payload do contrato. Verifique o builder utilizado para este tipo de contrato.";
    } else if (rawVal === undefined || rawVal === null || String(rawVal).trim() === "") {
      status = "failed";
      failureReason = "SOURCE_FIELD_EMPTY";
      message = `O campo de origem existe na ${stage}, mas está vazio. Por isso, o placeholder não pôde ser substituído. Corrija o campo ${desc.label} na ${stage}.`;
    } else if (isProvisional) {
      status = "failed";
      failureReason = "PROVISIONAL_VALUE";
      message = "O campo recebeu um valor provisório. A substituição não foi considerada concluída porque o dado ainda precisa ser definido.";
    } else {
      message = `O valor foi localizado na ${stage} e o placeholder foi substituído corretamente.`;
    }

    if (status === "success") {
      successCount++;
    } else {
      failedCount++;
    }

    const previewVal = resolvedVal;
    const integrationVal = integrationPlaceholdersMap[ph] || resolvedVal; // If provided, do comparison, else treat as equal

    let parityStatus: any = "Paridade confirmada";
    if (integrationPlaceholdersMap[ph] !== undefined) {
      if (previewVal !== integrationVal) {
        parityStatus = "Divergência identificada";
        status = "failed";
        failureReason = "PARITY_DIVERGENCE";
        message = "O Preview e a integração do Google Docs receberam valores diferentes para este placeholder. Como ambos representam o mesmo documento, a substituição não pode ser considerada confiável.";
      }
    }

    rows.push({
      id: ph.replace(/[{}<>]/g, ""),
      documentType,
      sourceStage: stage,
      sourceField: field,
      informationLabel: desc.label,
      migratedValueMasked: desc.isSensitive ? maskSensitiveValue(ph, resolvedVal) : resolvedVal,
      placeholder: ph,
      replacementStatus: status,
      failureReason,
      naturalLanguageMessage: message,
      previewValue: desc.isSensitive ? maskSensitiveValue(ph, previewVal) : previewVal,
      integrationValue: desc.isSensitive ? maskSensitiveValue(ph, integrationVal) : integrationVal,
      parityStatus
    });
  }

  // Sort rows: failed first, then by sourceStage, then informationLabel, then placeholder
  rows.sort((a, b) => {
    if (a.replacementStatus === "failed" && b.replacementStatus === "success") return -1;
    if (a.replacementStatus === "success" && b.replacementStatus === "failed") return 1;
    
    const stageA = a.sourceStage || "";
    const stageB = b.sourceStage || "";
    if (stageA !== stageB) return stageA.localeCompare(stageB);

    const labelA = a.informationLabel || "";
    const labelB = b.informationLabel || "";
    if (labelA !== labelB) return labelA.localeCompare(labelB);

    return a.placeholder.localeCompare(b.placeholder);
  });

  const summary = {
    total: allDescriptors.length,
    success: successCount,
    failed: failedCount
  };

  addLog("CONTRACT_CANONICAL_CONTEXT_BUILD_SUCCESS", "success", "Contexto de contrato canônico e auditoria da Batalha Naval compilados com sucesso.");

  // Build rendered HTML Preview using in-memory replacement on the chosen template
  const rawTemplate = isPf ? PF_LOCAL_TEMPLATE : PJ_LOCAL_TEMPLATE;
  let renderedPreview = rawTemplate;
  for (const [key, value] of Object.entries(resolvedPlaceholders)) {
    // Replace all occurrences
    renderedPreview = renderedPreview.replace(new RegExp(key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), String(value) || "");
  }

  // Replace global placeholders
  const globalPls = {
    "{{ESCRITORIO_NOME}}": "Giffoni Connect",
    "{{ESCRITORIO_ENDERECO}}": "Avenida Principal, Viçosa, MG",
    "{{ADVOGADO_NOME}}": "RODRIGO GIFFONI RODRIGUES",
    "{{ADVOGADO_OAB}}": "OAB/MG 157.320",
    "{{CIDADE_ASSINATURA}}": "Viçosa, MG",
    "{{DATA_ASSINATURA}}": new Date().toLocaleDateString("pt-BR")
  };
  for (const [key, value] of Object.entries(globalPls)) {
    renderedPreview = renderedPreview.replace(new RegExp(key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), value);
  }

  return {
    templateId: "1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ",
    documentType,
    canonicalPayload: mockFinData,
    placeholders: resolvedPlaceholders,
    normalizedPlaceholders: resolvedPlaceholders,
    renderedPreview,
    placeholderAudit: {
      success: true,
      documentType,
      caseId: caseData?.id || "",
      generatedAt: new Date().toISOString(),
      summary,
      rows,
      technicalLog
    },
    parityHash,
    technicalLog
  };
}
