import { EvidenceRequest } from '../hooks/useColetaState';

export interface AuditItem {
  id: string;
  section: string;
  label: string;
  status: 'ok' | 'atencao' | 'pendente' | 'erro_critico';
  statusText: '✅ Completo' | '🟨 Atenção' | '🟥 X Pendência' | '⚠️ Trava Crítica';
  details: string;
  weight: number;
  isCriticalLock: boolean;
  impact?: string;
  action?: string;
  responsible: 'Cliente' | 'Secretaria' | 'Advogado' | 'Controladoria';
}

export interface SectionScore {
  name: string;
  percent: number;
  totalWeight: number;
  completedWeight: number;
}

export interface ComplianceAuditResult {
  generatedAt: string;
  overallPercent: number;
  totalPendingCount: number;
  totalCriticalLocksCount: number;
  items: AuditItem[];
  sectionScores: Record<string, SectionScore>;
  criticalLocks: AuditItem[];
  pendingItems: AuditItem[];
  unblockingOrder: string[];
}

function hasVal(v: any): boolean {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function isCNJValid(cnj: string): boolean {
  if (!cnj) return false;
  // Standard CNJ format: 0000000-00.0000.0.00.0000 (20 digits plus symbols)
  const digits = cnj.replace(/\D/g, '');
  return digits.length === 20;
}

// Helper to check standard comprovante de residência date validity (mock check for 90 days)
function checkComprovanteDate(dateStr: string): 'recent' | 'old' | 'missing' {
  if (!dateStr) return 'missing';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 90 ? 'old' : 'recent';
  } catch (e) {
    return 'recent'; // Fallback
  }
}

export function runCaseComplianceAudit(
  caseObj: any,
  client: any,
  infoRequests: any[] = [],
  evidenceRequests: any[] = [],
  financials: any[] = []
): ComplianceAuditResult {
  const items: AuditItem[] = [];
  const caseData = caseObj || {};
  const isPf = client?.type === 'PF';
  const isPj = client?.type === 'PJ';
  const clientTypeLabel = isPf ? 'Pessoa Física' : isPj ? 'Pessoa Jurídica' : 'Tipo Indefinido';

  // Wizard state from Coletar Provas
  const wiz = caseData.solicitacoesProvasWizardState || {};

  // -------------------------------------------------------------
  // SEÇÃO 3: CADASTRO PESSOA FÍSICA (Applicable if PF)
  // -------------------------------------------------------------
  const pf = client?.pfDadosPessoais || client?.pfData || {};
  const acesso = client?.acessoSistema || {};
  const bancario = client?.bancarioData || client?.bancarioDadosBancarios || {};

  if (isPf) {
    // Bloco Dados Pessoais
    const hasNome = hasVal(pf.pf_nomeCompleto);
    items.push({
      id: 'pf_nome',
      section: 'Cadastro',
      label: 'Nome Completo',
      status: hasNome ? 'ok' : 'erro_critico',
      statusText: hasNome ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasNome ? `Nome informado: ${pf.pf_nomeCompleto}` : 'Nome Completo não preenchido',
      weight: 3,
      isCriticalLock: !hasNome,
      impact: 'Impede a identificação civil de fato, qualificação da petição, procuração e contrato.',
      action: 'Acessar cadastro e preencher o Nome Completo.',
      responsible: 'Secretaria'
    });

    const hasNacio = hasVal(pf.pf_nacionalidade);
    items.push({
      id: 'pf_nacio',
      section: 'Cadastro',
      label: 'Nacionalidade',
      status: hasNacio ? 'ok' : 'pendente',
      statusText: hasNacio ? '✅ Completo' : '🟥 X Pendência',
      details: hasNacio ? `Nacionalidade: ${pf.pf_nacionalidade}` : 'Nacionalidade ausente',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    const hasEstCivil = hasVal(pf.pf_estadoCivil);
    items.push({
      id: 'pf_est_civil',
      section: 'Cadastro',
      label: 'Estado Civil',
      status: hasEstCivil ? 'ok' : 'pendente',
      statusText: hasEstCivil ? '✅ Completo' : '🟥 X Pendência',
      details: hasEstCivil ? `Estado Civil: ${pf.pf_estadoCivil}` : 'Estado Civil ausente',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    const hasProf = hasVal(pf.pf_profissao);
    items.push({
      id: 'pf_prof',
      section: 'Cadastro',
      label: 'Profissão',
      status: hasProf ? 'ok' : 'pendente',
      statusText: hasProf ? '✅ Completo' : '🟥 X Pendência',
      details: hasProf ? `Profissão: ${pf.pf_profissao}` : 'Profissão não informada',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    const hasCpf = hasVal(pf.pf_cpf);
    items.push({
      id: 'pf_cpf',
      section: 'Cadastro',
      label: 'CPF',
      status: hasCpf ? 'ok' : 'erro_critico',
      statusText: hasCpf ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasCpf ? `CPF informado: ${pf.pf_cpf}` : 'CPF ausente do cadastro',
      weight: 3,
      isCriticalLock: !hasCpf,
      impact: 'Impede a identificação fiscal federal, faturamentos, distribuição de processos judiciais e auditorias.',
      action: 'Adicionar CPF válido no cadastro de cliente.',
      responsible: 'Secretaria'
    });

    const hasRg = hasVal(pf.pf_rg);
    items.push({
      id: 'pf_rg',
      section: 'Cadastro',
      label: 'RG',
      status: hasRg ? 'ok' : 'erro_critico',
      statusText: hasRg ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasRg ? `RG informado: ${pf.pf_rg}` : 'RG ausente do cadastro',
      weight: 3,
      isCriticalLock: !hasRg,
      impact: 'Impede validação de assinatura física, qualificação em juízo e emissão de procuração.',
      action: 'Adicionar RG e Órgão Emissor no cadastro do cliente.',
      responsible: 'Secretaria'
    });

    const hasNasc = hasVal(pf.pf_nascimento);
    items.push({
      id: 'pf_nasc',
      section: 'Cadastro',
      label: 'Data de Nascimento',
      status: hasNasc ? 'ok' : 'atencao',
      statusText: hasNasc ? '✅ Completo' : '🟨 Atenção',
      details: hasNasc ? `Nascimento: ${pf.pf_nascimento}` : 'Data de nascimento ausente',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    // Bloco Contato
    const hasEmail = hasVal(pf.pf_email);
    items.push({
      id: 'pf_email',
      section: 'Cadastro',
      label: 'E-mail',
      status: hasEmail ? 'ok' : 'atencao',
      statusText: hasEmail ? '✅ Completo' : '🟨 Atenção',
      details: hasEmail ? `E-mail: ${pf.pf_email}` : 'E-mail não cadastrado para comunicações formais',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    const hasTel = hasVal(pf.pf_telefone) || hasVal(pf.pf_whatsapp);
    items.push({
      id: 'pf_tel',
      section: 'Cadastro',
      label: 'Telefone Residencial/Comercial',
      status: hasTel ? 'ok' : 'atencao',
      statusText: hasTel ? '✅ Completo' : '🟨 Atenção',
      details: hasTel ? 'Telefone cadastrado.' : 'Telefone fixo/geral ausente',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    // WhatsApp Rule: WhatsApp vazio vira trava crítica se houver coletas pendentes ao cliente
    const hasWhats = hasVal(pf.pf_whatsapp);
    const hasPendingDocs = evidenceRequests.some(r => r.status === 'pendente') || infoRequests.some(r => r.status === 'pendente');
    const isWhatsBlocker = !hasWhats && hasPendingDocs;
    items.push({
      id: 'pf_whatsapp',
      section: 'Cadastro',
      label: 'WhatsApp',
      status: hasWhats ? 'ok' : (isWhatsBlocker ? 'erro_critico' : 'pendente'),
      statusText: hasWhats ? '✅ Completo' : (isWhatsBlocker ? '⚠️ Trava Crítica' : '🟥 X Pendência'),
      details: hasWhats ? `WhatsApp: ${pf.pf_whatsapp}` : 'WhatsApp de contato direto não informado',
      weight: isWhatsBlocker ? 3 : 1,
      isCriticalLock: isWhatsBlocker,
      impact: isWhatsBlocker ? 'Impede o envio de notificações, cobranças de documentos e links de questionários ao cliente.' : undefined,
      action: isWhatsBlocker ? 'Registrar o número de celular/WhatsApp do cliente para unificar comunicações.' : undefined,
      responsible: 'Secretaria'
    });

    // Bloco Endereço
    const hasCep = hasVal(pf.pf_cep);
    items.push({
      id: 'pf_cep',
      section: 'Cadastro',
      label: 'CEP',
      status: hasCep ? 'ok' : 'pendente',
      statusText: hasCep ? '✅ Completo' : '🟥 X Pendência',
      details: hasCep ? `CEP: ${pf.pf_cep}` : 'CEP residencial não informado',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    const hasEnd = hasVal(pf.pf_endereco);
    items.push({
      id: 'pf_end',
      section: 'Cadastro',
      label: 'Logradouro / Endereço',
      status: hasEnd ? 'ok' : 'pendente',
      statusText: hasEnd ? '✅ Completo' : '🟥 X Pendência',
      details: hasEnd ? `Rua: ${pf.pf_endereco}` : 'Logradouro ausente',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    const hasNum = hasVal(pf.pf_numero);
    items.push({
      id: 'pf_num',
      section: 'Cadastro',
      label: 'Número Residencial',
      status: hasNum ? 'ok' : 'atencao',
      statusText: hasNum ? '✅ Completo' : '🟨 Atenção',
      details: hasNum ? `Número: ${pf.pf_numero}` : 'Sem número (Pode ser s/n)',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    const hasBairro = hasVal(pf.pf_bairro);
    items.push({
      id: 'pf_bairro',
      section: 'Cadastro',
      label: 'Bairro',
      status: hasBairro ? 'ok' : 'pendente',
      statusText: hasBairro ? '✅ Completo' : '🟥 X Pendência',
      details: hasBairro ? `Bairro: ${pf.pf_bairro}` : 'Bairro ausente',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    const hasCidUf = hasVal(pf.pf_cidade) && hasVal(pf.pf_estado);
    items.push({
      id: 'pf_cidade_uf',
      section: 'Cadastro',
      label: 'Cidade & Estado',
      status: hasCidUf ? 'ok' : 'erro_critico',
      statusText: hasCidUf ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasCidUf ? `Cidade: ${pf.pf_cidade} - ${pf.pf_estado}` : 'Cidade e/ou UF em branco',
      weight: 3,
      isCriticalLock: !hasCidUf,
      impact: 'Prejudica a delimitação de competência fática (foro distrital / comarca do caso) e qualificação inicial.',
      action: 'Adicionar cidade e UF corretos do cliente.',
      responsible: 'Secretaria'
    });

    // Complemento & Redes Sociais are facultative
    items.push({
      id: 'pf_complemento',
      section: 'Cadastro',
      label: 'Complemento Endereço',
      status: hasVal(pf.pf_complemento) ? 'ok' : 'atencao',
      statusText: hasVal(pf.pf_complemento) ? '✅ Completo' : '🟨 Atenção',
      details: hasVal(pf.pf_complemento) ? pf.pf_complemento : 'Não informado (Facultativo)',
      weight: 0,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    // Bloco Acesso ao Sistema PF
    const hasLoginEmail = hasVal(acesso.acesso_emailLogin);
    items.push({
      id: 'pf_login_email',
      section: 'Cadastro',
      label: 'E-mail de Login do Portal',
      status: hasLoginEmail ? 'ok' : 'pendente',
      statusText: hasLoginEmail ? '✅ Completo' : '🟥 X Pendência',
      details: hasLoginEmail ? `Acesso por: ${acesso.acesso_emailLogin}` : 'Cliente sem e-mail de login cadastrado',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    const hasPass = hasVal(acesso.acesso_senha);
    items.push({
      id: 'pf_senha',
      section: 'Cadastro',
      label: 'Senha de Acesso',
      status: hasPass ? 'ok' : 'erro_critico',
      statusText: hasPass ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasPass ? 'Senha registrada com criptografia segura' : 'Sem senha cadastrada no sistema',
      weight: 3,
      isCriticalLock: !hasPass,
      impact: 'O cliente não consegue fazer login no Portal Boss Clientes para conferir andamentos.',
      action: 'Cadastrar senha no módulo de acesso do cliente.',
      responsible: 'Secretaria'
    });

    const showAcessoStatus = acesso.acesso_statusAcesso || 'não_definido';
    items.push({
      id: 'pf_status_acesso',
      section: 'Cadastro',
      label: 'Status de Acesso',
      status: showAcessoStatus !== 'não_definido' ? 'ok' : 'atencao',
      statusText: showAcessoStatus !== 'não_definido' ? '✅ Completo' : '🟨 Atenção',
      details: `Status ativo: ${showAcessoStatus}`,
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    // Dados Bancários Facultativos PF (Weight 0 fallback, unless requirements mandate)
    const exigenciaFin = financials.length > 0 || caseData.requiresFinancial === true;
    const hasPix = hasVal(bancario.bancario_chavePix);
    const pixStatus = hasPix ? 'ok' : (exigenciaFin ? 'erro_critico' : 'atencao');
    const pixStatusText = hasPix ? '✅ Completo' : (exigenciaFin ? '⚠️ Trava Crítica' : '🟨 Atenção');
    items.push({
      id: 'pf_dados_bancarios',
      section: 'Cadastro',
      label: 'Dados Bancários e Chave Pix',
      status: pixStatus,
      statusText: pixStatusText,
      details: hasPix ? `Banco: ${bancario.bancario_banco || 'Não especificado'} | Pix: ${bancario.bancario_chavePix}` : 'Nenhum dado bancário ou chave Pix informado',
      weight: exigenciaFin ? 3 : 0,
      isCriticalLock: !hasPix && exigenciaFin,
      impact: !hasPix && exigenciaFin ? 'Impede ordens de reembolso, faturas, alvarás judiciais ou repasses ao cliente.' : undefined,
      action: !hasPix && exigenciaFin ? 'Solicitar e preencher os dados bancários completos e chave Pix.' : undefined,
      responsible: 'Secretaria'
    });
  }

  // -------------------------------------------------------------
  // SEÇÃO 4: CADASTRO PESSOA JURÍDICA (Applicable if PJ)
  // -------------------------------------------------------------
  const pj = client?.pjDadosEmpresa || client?.pjData || {};
  const socio = client?.socioData || client?.socioDadosPessoais || {};

  if (isPj) {
    const hasCnpj = hasVal(pj.pj_cnpj);
    items.push({
      id: 'pj_cnpj',
      section: 'Cadastro',
      label: 'CNPJ Empresa',
      status: hasCnpj ? 'ok' : 'erro_critico',
      statusText: hasCnpj ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasCnpj ? `CNPJ informado: ${pj.pj_cnpj}` : 'CNPJ da empresa ausente',
      weight: 3,
      isCriticalLock: !hasCnpj,
      impact: 'Impede qualificação formal, emissão tributária da empresa e faturamento contratual legal.',
      action: 'Adicionar CNPJ ativo no prontuário tributário do cliente.',
      responsible: 'Secretaria'
    });

    const hasRazao = hasVal(pj.pj_razaoSocial);
    items.push({
      id: 'pj_razao_social',
      section: 'Cadastro',
      label: 'Razão Social',
      status: hasRazao ? 'ok' : 'erro_critico',
      statusText: hasRazao ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasRazao ? `Razão Social: ${pj.pj_razaoSocial}` : 'Razão Social da empresa em branco',
      weight: 3,
      isCriticalLock: !hasRazao,
      impact: 'Inviabiliza a elaboração segura de contratos societários, petições fáticas e atos constitutivos.',
      action: 'Preencher a Razão Social da empresa.',
      responsible: 'Secretaria'
    });

    const hasFantasia = hasVal(pj.pj_nomeFantasia);
    items.push({
      id: 'pj_nome_fantasia',
      section: 'Cadastro',
      label: 'Nome Fantasia',
      status: hasFantasia ? 'ok' : 'atencao',
      statusText: hasFantasia ? '✅ Completo' : '🟨 Atenção',
      details: hasFantasia ? `Nome Fantasia: ${pj.pj_nomeFantasia}` : 'Nome fantasia em branco (Será usado Razão Social)',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    // Contato PJ
    const hasPjEmail = hasVal(pj.pj_emailEmpresa);
    items.push({
      id: 'pj_email_empresa',
      section: 'Cadastro',
      label: 'E-mail Comercial Empresa',
      status: hasPjEmail ? 'ok' : 'atencao',
      statusText: hasPjEmail ? '✅ Completo' : '🟨 Atenção',
      details: hasPjEmail ? `E-mail: ${pj.pj_emailEmpresa}` : 'Nenhum e-mail comercial corporativo cadastrado',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    // Endereço PJ
    const hasPjCep = hasVal(pj.pj_cepEmpresa);
    items.push({
      id: 'pj_cep_empresa',
      section: 'Cadastro',
      label: 'CEP da Empresa',
      status: hasPjCep ? 'ok' : 'pendente',
      statusText: hasPjCep ? '✅ Completo' : '🟥 X Pendência',
      details: hasPjCep ? `CEP: ${pj.pj_cepEmpresa}` : 'CEP corporativo da sede não informado',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });

    const hasPjCid = hasVal(pj.pj_cidadeEmpresa) && hasVal(pj.pj_estadoEmpresa);
    items.push({
      id: 'pj_cidade_uf',
      section: 'Cadastro',
      label: 'Cidade & Estado Sede',
      status: hasPjCid ? 'ok' : 'erro_critico',
      statusText: hasPjCid ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasPjCid ? `Cidade Sede: ${pj.pj_cidadeEmpresa} - ${pj.pj_estadoEmpresa}` : 'Cidade Sede/Estado da empresa em branco',
      weight: 3,
      isCriticalLock: !hasPjCid,
      impact: 'Prejudica a estruturação territorial de foro e delimitação de comarca societária.',
      action: 'Adicionar cidade sede e estado nos dados cadastrais.',
      responsible: 'Secretaria'
    });

    // Sócio Administrador PJ - Dados Pessoais
    const hasSocioNome = hasVal(socio.socio_nomeCompleto);
    items.push({
      id: 'pj_socio_nome',
      section: 'Cadastro',
      label: 'Nome do Sócio Administrador',
      status: hasSocioNome ? 'ok' : 'erro_critico',
      statusText: hasSocioNome ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasSocioNome ? `Sócio Administrador: ${socio.socio_nomeCompleto}` : 'Sócio administrador não informado',
      weight: 3,
      isCriticalLock: !hasSocioNome,
      impact: 'Inviabiliza a representação fática judicial e qualificação de procuradores autorizados sob a PJ.',
      action: 'Vincular e qualificar o sócio administrador no cadastro.',
      responsible: 'Secretaria'
    });

    const hasSocioDoc = hasVal(socio.socio_cpf) && hasVal(socio.socio_rg);
    items.push({
      id: 'pj_socio_documentos',
      section: 'Cadastro',
      label: 'Documentos do Sócio (CPF/RG)',
      status: hasSocioDoc ? 'ok' : 'erro_critico',
      statusText: hasSocioDoc ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasSocioDoc ? `CPF Sócio: ${socio.socio_cpf} | RG: ${socio.socio_rg}` : 'Socio administrador com CPF ou RG ausentes',
      weight: 3,
      isCriticalLock: !hasSocioDoc,
      impact: 'Impede a extração eletrônica de procurações de representação jurídica da empresa para a advocacia.',
      action: 'Preencher o CPF e RG do sócio administrador autorizante.',
      responsible: 'Secretaria'
    });

    const hasSocioCargo = hasVal(socio.socio_profissao) || hasVal(socio.socio_cargo);
    items.push({
      id: 'pj_socio_cargo',
      section: 'Cadastro',
      label: 'Cargo / Poderes de Representação',
      status: hasSocioCargo ? 'ok' : 'erro_critico',
      statusText: hasSocioCargo ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasSocioCargo ? `Cargo: ${socio.socio_cargo || socio.socio_profissao}` : 'Cargo de representação do sócio não informado',
      weight: 3,
      isCriticalLock: !hasSocioCargo,
      impact: 'Impede comprovar legitimidade e poderes de outorga contratual em petições e relatórios judiciais.',
      action: 'Cadastrar o cargo empresarial ou atribuição de outorga do sócio (ex: Sócio Administrador).',
      responsible: 'Secretaria'
    });

    // Bancário PJ - Chave pix com atenção se não titularidade
    const hasPjPix = hasVal(bancario.bancario_chavePix);
    const pixPjTitular = bancario.bancario_titularConta || '';
    const isOwnerAuthorized = pixPjTitular.toLowerCase().includes(pj.pj_razaoSocial?.toLowerCase() || '___') || 
                              pixPjTitular.toLowerCase().includes(socio.socio_nomeCompleto?.toLowerCase() || '___') ||
                              bancario.bancario_titularEhCliente === true;
    const pixPjStatus = !hasPjPix ? 'atencao' : (isOwnerAuthorized ? 'ok' : 'atencao');
    const pixPjStatusText = !hasPjPix ? '🟨 Atenção' : (isOwnerAuthorized ? '✅ Completo' : '🟨 Atenção');
    items.push({
      id: 'pj_dados_bancarios',
      section: 'Cadastro',
      label: 'Dados Bancários Corporativos',
      status: pixPjStatus,
      statusText: pixPjStatusText,
      details: hasPjPix 
        ? `Banco: ${bancario.bancario_banco || 'Não especificado'} | Pix: ${bancario.bancario_chavePix}${!isOwnerAuthorized ? ' (Requer validação: Titular divergente de CNPJ/Sócio!' : ' (Cadastro Autorizado)'}` 
        : 'Nenhum dado bancário registrado para a empresa.',
      weight: 0,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });
  }

  // -------------------------------------------------------------
  // SEÇÃO 5: ENTREVISTA 5W2H
  // -------------------------------------------------------------
  const checklist = caseData.checklist5w2h || {};
  const bases = caseData.basesFaticas || '';

  // 5W2H Checklist queries
  const hasOQue = checklist.oQue === true || hasVal(caseData.oQueAconteceu) || bases.length > 50;
  items.push({
    id: '5w2h_oque',
    section: 'Entrevista',
    label: 'O quê ocorreu? (Bases do Litígio)',
    status: hasOQue ? 'ok' : 'erro_critico',
    statusText: hasOQue ? '✅ Completo' : '⚠️ Trava Crítica',
    details: hasOQue ? 'Narrativa fática sobre conflito processual descrita com sucesso.' : 'Fatos narrados insuficientes ou em branco',
    weight: 3,
    isCriticalLock: !hasOQue,
    impact: 'Torna inviável a petição inicial técnica por ausência completa de causa de pedir.',
    action: 'Ir para Etapa 3 (Entrevista 5W2H) e preencher "O que aconteceu?".',
    responsible: 'Advogado'
  });

  const hasQuem = checklist.quem === true || hasVal(caseData.quemParticipou);
  items.push({
    id: '5w2h_quem',
    section: 'Entrevista',
    label: 'Quem participou?',
    status: hasQuem ? 'ok' : 'erro_critico',
    statusText: hasQuem ? '✅ Completo' : '⚠️ Trava Crítica',
    details: hasQuem ? 'Co-autores e adversários mapeados na entrevista.' : 'Qualificação de intervenientes e testemunhas em branco',
    weight: 3,
    isCriticalLock: !hasQuem,
    impact: 'Impede a identificação do polo ativo, passivo e delimitação subjetiva da lide.',
    action: 'Mapear os envolvidos e os réus na seção "Quem participou".',
    responsible: 'Advogado'
  });

  const hasOnde = checklist.onde === true || hasVal(caseData.ondeAconteceu);
  items.push({
    id: '5w2h_onde',
    section: 'Entrevista',
    label: 'Onde aconteceu?',
    status: hasOnde ? 'ok' : 'pendente',
    statusText: hasOnde ? '✅ Completo' : '🟥 X Pendência',
    details: hasOnde ? `Local informado: ${caseData.ondeAconteceu || 'Registrado'}` : 'Local e circunscrição do dano não preenchidos',
    weight: 1,
    isCriticalLock: false,
    responsible: 'Advogado'
  });

  const hasQuando = checklist.quando === true || hasVal(caseData.quandoAconteceu);
  items.push({
    id: '5w2h_quando',
    section: 'Entrevista',
    label: 'Quando aconteceu?',
    status: hasQuando ? 'ok' : 'erro_critico',
    statusText: hasQuando ? '✅ Completo' : '⚠️ Trava Crítica',
    details: hasQuando ? `Data informada: ${caseData.quandoAconteceu || 'Mapeada'}` : 'Data dos fatos em branco',
    weight: 3,
    isCriticalLock: !hasQuando,
    impact: 'Risco gravíssimo de decurso em prescrição do direito de ação e inviabiliza tutela de urgência imediata.',
    action: 'Inserir a data precisa do ocorrido ou termo inicial de lesão do direito do cliente.',
    responsible: 'Advogado'
  });

  const hasComo = checklist.como === true || hasVal(caseData.comoAconteceu);
  items.push({
    id: '5w2h_como',
    section: 'Entrevista',
    label: 'Como aconteceu? (Dinâmica)',
    status: hasComo ? 'ok' : 'pendente',
    statusText: hasComo ? '✅ Completo' : '🟥 X Pendência',
    details: hasComo ? 'Dinâmica fática descrita com riquezas de detalhes.' : 'Sem roteiro cronológico do esbulho/lesão',
    weight: 1,
    isCriticalLock: false,
    responsible: 'Advogado'
  });

  const hasPorque = checklist.porque === true || hasVal(caseData.porQueAconteceu);
  items.push({
    id: '5w2h_porque',
    section: 'Entrevista',
    label: 'Por que aconteceu?',
    status: hasPorque ? 'ok' : 'atencao',
    statusText: hasPorque ? '✅ Completo' : '🟨 Atenção',
    details: hasPorque ? 'Motivações e nexo de causalidade descritos.' : 'Nexo causal subjetivo em aberto',
    weight: 1,
    isCriticalLock: false,
    responsible: 'Advogado'
  });

  const hasComoFeito = checklist.comoResolver === true || hasVal(caseData.comoPretendeResolver);
  const isComoFeitoGeneric = hasComoFeito && (caseData.comoPretendeResolver || '').toLowerCase().length < 15;
  items.push({
    id: '5w2h_comofeito',
    section: 'Entrevista',
    label: 'Como será resolvido?',
    status: isComoFeitoGeneric ? 'atencao' : (hasComoFeito ? 'ok' : 'pendente'),
    statusText: isComoFeitoGeneric ? '🟨 Atenção' : (hasComoFeito ? '✅ Completo' : '🟥 X Pendência'),
    details: isComoFeitoGeneric ? 'Resposta de resolução genérica cadastrada, necessário detalhar.' : (hasComoFeito ? 'Roteiro de pretensão material e jurídica concluído.' : 'Roteiro de resolução fática não preenchido'),
    weight: 1,
    isCriticalLock: false,
    responsible: 'Advogado'
  });

  // -------------------------------------------------------------
  // SEÇÃO 6: TIPO DE SERVIÇO
  // -------------------------------------------------------------
  const isJudicial = caseData.registrationTypeKey === 'judicial' || caseData.registrationType === 'judicial';
  const isExtrajudicial = caseData.registrationTypeKey === 'extrajudicial' || caseData.registrationType === 'extrajudicial';
  const isPeticaoInicial = caseData.subStepKey === 'peticao-inicial' || caseData.serviceSubtype === 'peticao_inicial';
  const isEmAndamento = caseData.subStepKey === 'processo-judicial-em-andamento' || caseData.serviceSubtype === 'processo_andamento';
  const isRequerimento = caseData.subStepKey === 'requerimento-administrativo' || caseData.serviceSubtype === 'requerimento_adm';

  const classificationOk = isJudicial || isExtrajudicial;
  items.push({
    id: 'srv_classif',
    section: 'Tipo de Serviço',
    label: 'Classificação Operacional',
    status: classificationOk ? 'ok' : 'pendente',
    statusText: classificationOk ? '✅ Completo' : '🟥 X Pendência',
    details: classificationOk ? `Rito do caso: ${isJudicial ? 'Judicial' : 'Extrajudicial'}` : 'Não classificado se lide é judicial ou administrativa',
    weight: 1,
    isCriticalLock: false,
    responsible: 'Secretaria'
  });

  if (isJudicial) {
    if (isPeticaoInicial) {
      const hasRé = hasVal(caseData.adverseParty);
      items.push({
        id: 'srv_judicial_re',
        section: 'Tipo de Serviço',
        label: 'Classe: Réu / Parte Adversa',
        status: hasRé ? 'ok' : 'erro_critico',
        statusText: hasRé ? '✅ Completo' : '⚠️ Trava Crítica',
        details: hasRé ? `Parte contrária: ${caseData.adverseParty}` : 'Parte contrária (polaridade passiva) não informada',
        weight: 3,
        isCriticalLock: !hasRé,
        impact: 'Impede a estruturação substantiva da petição (qualificação réu) e ajuizamento seguro.',
        action: 'Qualificar a Parte Adversa / Réu na Etapa 4.',
        responsible: 'Advogado'
      });

      const hasAssunto = hasVal(caseData.caseType) || hasVal(caseData.subject);
      items.push({
        id: 'srv_judicial_tema',
        section: 'Tipo de Serviço',
        label: 'Matéria do Litígio / Assunto',
        status: hasAssunto ? 'ok' : 'erro_critico',
        statusText: hasAssunto ? '✅ Completo' : '⚠️ Trava Crítica',
        details: hasAssunto ? `Área/Ação: ${caseData.caseType || caseData.subject}` : 'Matéria fática sem classificação (Assunto em branco)',
        weight: 3,
        isCriticalLock: !hasAssunto,
        impact: 'Causa o travamento operacional de eixos da central e classificação no rol de distribuição.',
        action: 'Classificar a matéria e assunto do processo na Etapa 4.',
        responsible: 'Advogado'
      });

      const hasComarca = hasVal(caseData.comarca);
      items.push({
        id: 'srv_judicial_comarca',
        section: 'Tipo de Serviço',
        label: 'Comarca de Distribuição',
        status: hasComarca ? 'ok' : 'erro_critico',
        statusText: hasComarca ? '✅ Completo' : '⚠️ Trava Crítica',
        details: hasComarca ? `Comarca: ${caseData.comarca}` : 'Comarca de ajuizamento não preenchida',
        weight: 3,
        isCriticalLock: !hasComarca,
        impact: 'Inviabiliza a definição de foro de execução e competência territorial judicial.',
        action: 'Definir a comarca ou foro judiciário competente.',
        responsible: 'Advogado'
      });
    }

    if (isEmAndamento) {
      const cnj = caseData.processNumber || '';
      const cnjValid = isCNJValid(cnj);
      items.push({
        id: 'srv_andamento_cnj',
        section: 'Tipo de Serviço',
        label: 'Número de Processo Ativo (CNJ)',
        status: cnj ? (cnjValid ? 'ok' : 'erro_critico') : 'erro_critico',
        statusText: cnj ? (cnjValid ? '✅ Completo' : '⚠️ Trava Crítica') : '⚠️ Trava Crítica',
        details: cnj 
          ? (cnjValid ? `CNJ Mapeado: ${cnj}` : 'Formato CNJ Inválido (Deve possuir 20 dígitos)') 
          : 'Número completo do processo judiciário não informado',
        weight: 3,
        isCriticalLock: !cnjValid,
        impact: !cnjValid ? 'Bloqueia o monitoramento automatizado, controle de prazos em aberto e repasse à Controladoria.' : undefined,
        action: !cnjValid ? 'Inserir ou corrigir o número do processo respeitando exatamente os 20 dígitos padrão CNJ.' : undefined,
        responsible: 'Controladoria'
      });
    }
  }

  if (isExtrajudicial && isRequerimento) {
    const hasOrgao = hasVal(caseData.orgaoAdministrativo) || hasVal(caseData.orgao);
    items.push({
      id: 'srv_extrajudicial_orgao',
      section: 'Tipo de Serviço',
      label: 'Órgão Administrativo de Destino',
      status: hasOrgao ? 'ok' : 'pendente',
      statusText: hasOrgao ? '✅ Completo' : '🟥 X Pendência',
      details: hasOrgao ? `Entidade: ${caseData.orgaoAdministrativo || caseData.orgao}` : 'Autarquia / Órgão Administrativo não selecionado',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Advogado'
    });
  }

  // -------------------------------------------------------------
  // SEÇÃO 7: COLETAR PROVAS
  // -------------------------------------------------------------
  // Procuração
  const srvProcuracaoCriada = caseData.procuracaoStatus === 'criada' || hasVal(caseData.procuracaoGoogleDocsUrl);
  // Checked files signed: array length of procuracaoFiles > 0
  const isProcuracaoSigned = (wiz.procuracaoFiles || caseData.procuracaoFiles || []).length > 0 || wiz.q1_3 === 'sim';
  
  items.push({
    id: 'proof_proc_gen',
    section: 'Provas',
    label: 'Procuração: Geração por Template',
    status: srvProcuracaoCriada ? 'ok' : 'erro_critico',
    statusText: srvProcuracaoCriada ? '✅ Completo' : '⚠️ Trava Crítica',
    details: srvProcuracaoCriada ? `Procuração gerada no Google Docs: ${caseData.procuracaoGoogleDocsUrl}` : 'Procuração oficial da defesa ainda não gerada',
    weight: 3,
    isCriticalLock: !srvProcuracaoCriada,
    impact: 'Impede o protocolo seguro e representação fática do escritório perante as secretarias e servidores.',
    action: 'Acessar Etapa 6 (Coletas) e acionar a Geração de Procuração.',
    responsible: 'Secretaria'
  });

  items.push({
    id: 'proof_proc_sign',
    section: 'Provas',
    label: 'Procuração: Coleta de Assinatura',
    status: isProcuracaoSigned ? 'ok' : 'erro_critico',
    statusText: isProcuracaoSigned ? '✅ Completo' : '⚠️ Trava Crítica',
    details: isProcuracaoSigned ? 'Procuração assinada digitalmente e anexada ao prontuário.' : 'Arquivo de procuração assinada não encontrado no drive',
    weight: 3,
    isCriticalLock: !isProcuracaoSigned,
    impact: 'Sem procuração outorgada assinada, o peticionamento inicial é nulo sob penalidades de inépcia imediata.',
    action: 'Enviar link de assinatura eletrônica do documento de procuração ou anexar o arquivo assinado.',
    responsible: 'Cliente'
  });

  // Custas recolhimento vs Pobreza declaracao
  const exigeCustas = wiz.q3_1 === 'sim';
  if (exigeCustas) {
    const hasGuiaDoc = (wiz.contratoFiles || []).length > 0 || hasVal(caseData.guiaCustasUrl) || caseData.guiaPaga === true;
    items.push({
      id: 'proof_custas',
      section: 'Provas',
      label: 'Guia de Custas e Taxas Embandeira',
      status: hasGuiaDoc ? 'ok' : 'erro_critico',
      statusText: hasGuiaDoc ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasGuiaDoc ? 'Guia emitida e comprovante de pagamento processados com sucesso.' : 'Comprovante tributário de pagamento das custas em aberto',
      weight: 3,
      isCriticalLock: !hasGuiaDoc,
      impact: 'O protocolo será imediatamente bloqueado em juízo por ausência de taxas processuais pagas.',
      action: 'Anexar comprovante fático das custas recolhidas ou emitir guia judiciária.',
      responsible: 'Cliente'
    });
  } else {
    // Declaracao Pobreza
    const isPobrezaSigned = (wiz.declaracaoFiles || caseData.declaracaoFiles || []).length > 0 || wiz.q2_4 === 'sim';
    items.push({
      id: 'proof_pobreza',
      section: 'Provas',
      label: 'Declaração de Pobreza (Gratuidade)',
      status: isPobrezaSigned ? 'ok' : 'erro_critico',
      statusText: isPobrezaSigned ? '✅ Completo' : '⚠️ Trava Crítica',
      details: isPobrezaSigned ? 'Declaração técnica de hipossuficiência outorgada.' : 'Assinatura fática da declaração de pobreza pendente no prontuário',
      weight: 3,
      isCriticalLock: !isPobrezaSigned,
      impact: 'O juízo indeferirá o pedido liminar de justiça gratuita, travando o provimento imediato de tutela.',
      action: 'Gerar termo de declaração de benefício para o polo ativo assinar.',
      responsible: 'Cliente'
    });
  }

  // Documentos PF vs PJ
  if (isPf) {
    const hasRgFile = (wiz.rgFiles || []).length > 0 || wiz.q4_rg === 'sim';
    items.push({
      id: 'proof_pf_rg',
      section: 'Provas',
      label: 'RG do Cliente Anexado',
      status: hasRgFile ? 'ok' : 'pendente',
      statusText: hasRgFile ? '✅ Completo' : '🟥 X Pendência',
      details: hasRgFile ? 'Identidade original digitalizada preservada.' : 'Documento RG ausente',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Cliente'
    });

    const hasCpfFile = (wiz.cpfFiles || []).length > 0 || wiz.q4_cpf === 'sim';
    items.push({
      id: 'proof_pf_cpf',
      section: 'Provas',
      label: 'CPF do Cliente Anexado',
      status: hasCpfFile ? 'ok' : 'pendente',
      statusText: hasCpfFile ? '✅ Completo' : '🟥 X Pendência',
      details: hasCpfFile ? 'Cadastro federal (CPF) anexado.' : 'Upload de comprovante CPF pendente',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Cliente'
    });

    const comprovStatus = checkComprovanteDate(wiz.q4_residencia_data || caseData.comprovanteResidenciaDate);
    const hasResideFile = (wiz.residenciaFiles || []).length > 0 || wiz.q4_residencia === 'sim';
    items.push({
      id: 'proof_pf_reside',
      section: 'Provas',
      label: 'Comprovante de Residência Residencial',
      status: !hasResideFile ? 'pendente' : (comprovStatus === 'old' ? 'atencao' : 'ok'),
      statusText: !hasResideFile ? '🟥 X Pendência' : (comprovStatus === 'old' ? '🟨 Atenção' : '✅ Completo'),
      details: !hasResideFile 
        ? 'Comprovante de endereço ausente da pasta do caso' 
        : (comprovStatus === 'old' ? 'Comprovante de endereço possivelmente desatualizado (Enviado a mais de 90 dias)' : 'Endereço recente conferido com sucesso.'),
      weight: 1,
      isCriticalLock: false,
      responsible: 'Cliente'
    });
  }

  if (isPj) {
    const hasContratoSoc = (wiz.contratoSocialFiles || []).length > 0 || wiz.q4_contrato_social === 'sim';
    items.push({
      id: 'proof_pj_contratosoc',
      section: 'Provas',
      label: 'Contrato Social Constitutivo',
      status: hasContratoSoc ? 'ok' : 'erro_critico',
      statusText: hasContratoSoc ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasContratoSoc ? 'Contrato social / Estatuto constitutivo validado.' : 'Cópia societária do Contrato Social em aberto',
      weight: 3,
      isCriticalLock: !hasContratoSoc,
      impact: 'Invalida a legitimação fática da defesa, pois impede comprovar legitimidade societária outorgante.',
      action: 'Anexar cópia do Contrato Social societário da empresa.',
      responsible: 'Cliente'
    });

    const hasCnpjDoc = (wiz.cnpjFiles || []).length > 0 || wiz.q4_cnpj === 'sim';
    items.push({
      id: 'proof_pj_cnpjdoc',
      section: 'Provas',
      label: 'Cartão CNPJ Receita Federal',
      status: hasCnpjDoc ? 'ok' : 'atencao',
      statusText: hasCnpjDoc ? '✅ Completo' : '🟨 Atenção',
      details: hasCnpjDoc ? 'Inscrição CNPJ salva na pasta.' : 'Cartão CNPJ federal desatualizado ou em aberto.',
      weight: 1,
      isCriticalLock: false,
      responsible: 'Cliente'
    });
  }

  // Outras Provas (Evidence requests conditionality)
  const exigeProvas = wiz.q5_1 === 'sim' || evidenceRequests.length > 0;
  if (exigeProvas) {
    evidenceRequests.forEach((req, idx) => {
      const isApproved = req.status === 'aprovado' || req.status === 'arquivado';
      const isPending = req.status === 'pendente';
      items.push({
        id: `proof_custom_${req.id}`,
        section: 'Provas',
        label: `Prova: ${req.title || `Item de Prova ${idx + 1}`}`,
        status: isApproved ? 'ok' : (isPending ? 'pendente' : 'atencao'),
        statusText: isApproved ? '✅ Completo' : (isPending ? '🟥 X Pendência' : '🟨 Atenção'),
        details: `Status: ${req.status} | ${req.description || 'Provas fáticas gerais para fundamentação de mérito.'}`,
        weight: isPending ? 1 : 0,
        isCriticalLock: false,
        responsible: 'Cliente'
      });
    });
  }

  // -------------------------------------------------------------
  // SEÇÃO 8: INFORMAÇÕES COMPLEMENTARES
  // -------------------------------------------------------------
  const exigeInfoComp = caseData.solicitarInfoComp === true || infoRequests.length > 0;
  if (exigeInfoComp) {
    infoRequests.forEach((req, idx) => {
      const isDone = req.status === 'conferido' || req.status === 'concluido' || hasVal(req.answer);
      const isPendente = !isDone && req.isCritical === true;
      items.push({
        id: `info_comp_${req.id}`,
        section: 'Informações Complementares',
        label: `Info: ${req.title || `Solicitação ${idx + 1}`}`,
        status: isDone ? 'ok' : (isPendente ? 'erro_critico' : 'pendente'),
        statusText: isDone ? '✅ Completo' : (isPendente ? '⚠️ Trava Crítica' : '🟥 X Pendência'),
        details: isDone ? `Respondido: "${req.answer}"` : 'Pergunta complementar aguardando retorno do cliente.',
        weight: isPendente ? 3 : 1,
        isCriticalLock: isPendente,
        impact: isPendente ? 'A resposta é essencial para elucidar teses fáticas ou refutar fundamentações contrárias.' : undefined,
        action: isPendente ? 'Entrar em contato com o cliente e colher a resposta técnica.' : undefined,
        responsible: 'Cliente'
      });
    });
  } else {
    items.push({
      id: 'info_comp_isento',
      section: 'Informações Complementares',
      label: 'Isenção de Prontuários Opcionais',
      status: 'ok',
      statusText: '✅ Completo',
      details: 'Não há solicitações complementares em aberto.',
      weight: 0,
      isCriticalLock: false,
      responsible: 'Secretaria'
    });
  }

  // -------------------------------------------------------------
  // SEÇÃO 9: ESTRUTURAÇÃO DO CASO (DRIVE / DOCS)
  // -------------------------------------------------------------
  const folderId = client?.googleDriveClientFolderId || caseData.gdriveFolderId || '';
  const folderUrl = client?.googleDriveClientFolderUrl || caseData.gdriveFolderUrl || '';
  const hasDrive = hasVal(folderId);
  items.push({
    id: 'edrp_drive_exists',
    section: 'Google Drive',
    label: 'Pasta do Caso no Google Drive',
    status: hasDrive ? 'ok' : 'erro_critico',
    statusText: hasDrive ? '✅ Completo' : '⚠️ Trava Crítica',
    details: hasDrive ? `ID do Drive indexado: ${folderId}` : 'Não foi criada a pasta no Google Drive para faturamento das coletas',
    weight: 3,
    isCriticalLock: !hasDrive,
    impact: 'Sem pasta no drive, o sistema não consegue depositar petições, procurações geradas e provas indexadas de forma automatizada.',
    action: 'Ir para Etapa 8 (Estruturação) e executar a criação de pastas.',
    responsible: 'Secretaria'
  });

  const hasDocsLinks = hasVal(caseData.procuracaoGoogleDocsUrl) || hasVal(caseData.contratoGoogleDocsUrl);
  items.push({
    id: 'edrp_docs_exists',
    section: 'Google Docs',
    label: 'Documentos do Caso criados no GDocs',
    status: hasDocsLinks ? 'ok' : 'pendente',
    statusText: hasDocsLinks ? '✅ Completo' : '🟥 X Pendência',
    details: hasDocsLinks ? 'Documentos técnicos com links salvos e unificados.' : 'Links e templates no Google Docs ausentes no prontuário',
    weight: 1,
    isCriticalLock: false,
    responsible: 'Secretaria'
  });

  // Folder sub-structures check (documents, provas, peças)
  const isFoldersStructOk = caseData.isFoldersStructComplete === true || hasDrive;
  items.push({
    id: 'edrp_struct_complete',
    section: 'Estruturação',
    label: 'Estruturação Fiel de Subpastas',
    status: isFoldersStructOk ? 'ok' : 'pendente',
    statusText: isFoldersStructOk ? '✅ Completo' : '🟥 X Pendência',
    details: isFoldersStructOk ? 'Criação estruturada das subpastas das peças judiciais concluídas.' : 'Diretórios/subpastas não criados no drive do cliente',
    weight: 1,
    isCriticalLock: false,
    responsible: 'Secretaria'
  });

  // -------------------------------------------------------------
  // SEÇÃO 10: DELEGAÇÃO
  // -------------------------------------------------------------
  const hasResponsible = hasVal(caseData.operatorId) || hasVal(caseData.responsibleName);
  items.push({
    id: 'del_respons',
    section: 'Delegação',
    label: 'Membro / Advogado Responsável',
    status: hasResponsible ? 'ok' : 'erro_critico',
    statusText: hasResponsible ? '✅ Completo' : '⚠️ Trava Crítica',
    details: hasResponsible ? `Distribuição de atos para: ${caseData.responsibleName || caseData.operatorId}` : 'Nenhum advogado responsável delegado no caso',
    weight: 3,
    isCriticalLock: !hasResponsible,
    impact: 'Sem responsável delegado, o processo judicial adentra em estado neutro operacional, gerando atraso e perdas.',
    action: 'Delegar um profissional responsável na Etapa 10.',
    responsible: 'Advogado'
  });

  const hasDeliveryDate = hasVal(caseData.deliveryDate);
  items.push({
    id: 'del_deliver_date',
    section: 'Delegação',
    label: 'Prazo Limite / Operacional Interno',
    status: hasDeliveryDate ? 'ok' : 'erro_critico',
    statusText: hasDeliveryDate ? '✅ Completo' : '⚠️ Trava Crítica',
    details: hasDeliveryDate ? `Data operacional: ${hasDeliveryDate}` : 'Sem prazo interno de fechamento cadastrado',
    weight: 3,
    isCriticalLock: !hasDeliveryDate,
    impact: 'Gera perda de previsibilidade fática operacional interna e pode implicar atraso na tese jurídica.',
    action: 'Definir uma data operacional limite de entrega.',
    responsible: 'Advogado'
  });

  const hasTodoist = hasVal(caseData.todoistTaskId) || caseData.todoistTaskComplete === true;
  items.push({
    id: 'del_todoist_sync',
    section: 'Delegação',
    label: 'Sincronização de Tarefa Todoist',
    status: hasTodoist ? 'ok' : 'erro_critico',
    statusText: hasTodoist ? '✅ Completo' : '⚠️ Trava Crítica',
    details: hasTodoist ? 'Tarefa gerada com checklist de acompanhamento.' : 'Todoist task não criada na central operacional',
    weight: 3,
    isCriticalLock: !hasTodoist,
    impact: 'O time de produção do escritório perde o canal dinâmico de monitoramento e acompanhamento de subtarefas.',
    action: 'Acionar a criação de tarefas no Todoist para o operador.',
    responsible: 'Secretaria'
  });

  // -------------------------------------------------------------
  // SEÇÃO 11: REVISÃO JURÍDICA
  // -------------------------------------------------------------
  const draftEx = hasVal(caseData.caseDraft) || hasVal(caseData.prePeticionamentoText) || caseData.draftStatus === 'completo';
  items.push({
    id: 'rev_draft_ready',
    section: 'Revisão',
    label: 'Atividade: Elaboração da Peça',
    status: draftEx ? 'ok' : 'pendente',
    statusText: draftEx ? '✅ Completo' : '🟥 X Pendência',
    details: draftEx ? 'Fundamentação jurídica e escrita prévia concluídos.' : 'Fundamentos e peças judiciais finais pendentes de escrita técnica',
    weight: 1,
    isCriticalLock: false,
    responsible: 'Advogado'
  });

  const revLegal = caseData.revisionCompleted === true || caseData.juridicalRevision === true;
  items.push({
    id: 'rev_legal_audit',
    section: 'Revisão',
    label: 'Revisão Jurídica de Tese',
    status: revLegal ? 'ok' : 'erro_critico',
    statusText: revLegal ? '✅ Completo' : '⚠️ Trava Crítica',
    details: revLegal ? 'Revisão em observância às doutrinas e jurisprudências realizada.' : 'Revisão jurídica em aberto por advogado revisor',
    weight: 3,
    isCriticalLock: !revLegal,
    impact: 'A peça jurídica final é transmitida sem a auditoria técnica de teses, acarretando riscos fiscais e sucumbências.',
    action: 'Validar teses do rito processual na Etapa 11.',
    responsible: 'Advogado'
  });

  const hasApproval = caseData.finalApproval === true || caseData.statusInterno === 'Aprovado para protocolo';
  items.push({
    id: 'rev_approval',
    section: 'Revisão',
    label: 'Assinatura Autorizada (Aprovação Final)',
    status: hasApproval ? 'ok' : 'erro_critico',
    statusText: hasApproval ? '✅ Completo' : '⚠️ Trava Crítica',
    details: hasApproval ? 'Aprovação concedida para distribuição processual imediata.' : 'Caso pendente de outorga de distribuição pelo conselheiro',
    weight: 3,
    isCriticalLock: !hasApproval,
    impact: 'Bloqueia o peticionamento de autos por ausência de crivo técnico final administrativo.',
    action: 'Responsável legal atestar assinatura eletrônica de aprovação final do prontuário.',
    responsible: 'Advogado'
  });

  // -------------------------------------------------------------
  // SEÇÃO 12: PROTOCOLO / DISTRIBUIÇÃO OU ANDAMENTOS
  // -------------------------------------------------------------
  const prtNum = hasVal(caseData.processNumber) || hasVal(caseData.protocoloId);
  items.push({
    id: 'prt_num',
    section: 'Protocolo',
    label: 'Distribuição: Registro CNPJ/CNJ Processual',
    status: prtNum ? 'ok' : 'erro_critico',
    statusText: prtNum ? '✅ Completo' : '⚠️ Trava Crítica',
    details: prtNum ? `CNJ em juízo: ${caseData.processNumber}` : 'Protocolo em aberto (Sem número de autenticação do ajuizamento)',
    weight: 3,
    isCriticalLock: !prtNum,
    impact: 'Dificulta a apuração fática pública, controle operacional judiciário e repasse às pastas.',
    action: 'Registrar o comprovante definitivo de protocolo com número correspondente Judicial da comarca.',
    responsible: 'Controladoria'
  });

  // Conditionals: Periodicos, Audiencias, Prazos
  const temPericia = caseData.possuiPericia === true;
  if (temPericia) {
    const periciaCpl = hasVal(caseData.dataPericia) && hasVal(caseData.localPericia);
    items.push({
      id: 'prt_pericia_det',
      section: 'Protocolo',
      label: 'Perícia Técnica Registrada',
      status: periciaCpl ? 'ok' : 'erro_critico',
      statusText: periciaCpl ? '✅ Completo' : '⚠️ Trava Crítica',
      details: periciaCpl ? `Agendada para: ${caseData.dataPericia} em ${caseData.localPericia}` : 'Caso possui perícia fática ativa porém sem data ou local agendados',
      weight: 3,
      isCriticalLock: !periciaCpl,
      impact: 'Risco gravíssimo de não-comparecimento do cliente à perícia oficial e perda sumária de direito à prova técnica.',
      action: 'Registrar com urgência a data e local da perícia agendada pelo juízo.',
      responsible: 'Controladoria'
    });
  }

  const temPrazo = caseData.possuiPrazoEmAberto === true;
  if (temPrazo) {
    const hasPrazoFatal = hasVal(caseData.prazoFatal);
    items.push({
      id: 'prt_prazo_fatal',
      section: 'Protocolo',
      label: 'Prazo Fatal em Aberto - Data e Responsabilidade',
      status: hasPrazoFatal ? 'ok' : 'erro_critico',
      statusText: hasPrazoFatal ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasPrazoFatal ? `Termo de vencimento: ${caseData.prazoFatal}` : 'Processo judicial com prazo corrido sem data fatal informada',
      weight: 3,
      isCriticalLock: !hasPrazoFatal,
      impact: 'Trava Crítica Máxima: Perda fatal de prazo judicial de réplica, contestação ou recurso acarreta revelia e trânsito em julgado imediato.',
      action: 'Adicionar a data fatal do prazo processual e designar o operador.',
      responsible: 'Controladoria'
    });
  }

  const temAudiencia = caseData.possuiAudiencia === true;
  if (temAudiencia) {
    const hasAudDate = hasVal(caseData.dataAudiencia) && hasVal(caseData.horaAudiencia);
    const hasClientNotified = caseData.clienteAvisadoAudiencia === true;
    items.push({
      id: 'prt_audiencia_det',
      section: 'Protocolo',
      label: 'Audiência Agendada - Informações do Rito',
      status: hasAudDate ? 'ok' : 'erro_critico',
      statusText: hasAudDate ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasAudDate ? `Audiência em: ${caseData.dataAudiencia} às ${caseData.horaAudiencia}` : 'Sem dados fáticos de data e hora para a sessão judiciária marcada',
      weight: 3,
      isCriticalLock: !hasAudDate,
      impact: 'Provoca o não-comparecimento da parte adversa ou do próprio patrocinador fático à assentada, implicando extinção ou confissão.',
      action: 'Qualificar e agendar a data e rito judiciário da audiência.',
      responsible: 'Controladoria'
    });

    items.push({
      id: 'prt_audiencia_notif',
      section: 'Protocolo',
      label: 'Notificação de Prontidão (Cliente Avisado)',
      status: hasClientNotified ? 'ok' : 'erro_critico',
      statusText: hasClientNotified ? '✅ Completo' : '⚠️ Trava Crítica',
      details: hasClientNotified ? 'Comunicação oficial e cientificação do cliente registradas.' : 'O cliente não está ciente de que possui audiência judicial designada!',
      weight: 3,
      isCriticalLock: !hasClientNotified,
      impact: 'Risco fático grave de revelia fática ou contumácia do cliente por desconhecimento do ato processual.',
      action: 'Cientificar imediatamente o cliente sobre a data da audiência e colher aceitação.',
      responsible: 'Secretaria'
    });
  }

  // Migração para Controladoria
  const isMigrated = caseData.controladoriaStatus === 'recebido' || caseData.controladoriaCompleted === true || caseData.statusInterno === 'Em controladoria';
  items.push({
    id: 'prt_controladoria_done',
    section: 'Controladoria',
    label: 'Migração para Eixo Contábil/Controladoria',
    status: isMigrated ? 'ok' : 'erro_critico',
    statusText: isMigrated ? '✅ Completo' : '⚠️ Trava Crítica',
    details: isMigrated ? 'Processo recebido e mapeado no painel unificado da controladoria.' : 'Processo distribuído em juízo porém com pendência de migração interna',
    weight: 3,
    isCriticalLock: !isMigrated,
    impact: 'Deixa o processo fora da malha de varredura ativa de novas publicações judiciais em Diário Oficial.',
    action: 'Formalizar a migração eletrônica de custódia interna de arquivos para controladoria.',
    responsible: 'Controladoria'
  });

  // -------------------------------------------------------------
  // SEÇÃO 13: JÁ SOU CLIENTE / REAPROVEITAMENTO
  // -------------------------------------------------------------
  const isReused = caseData.isCadastroReaproveitado === true;
  const isOldIncomplete = client?.cadastroIncompleto === true;
  items.push({
    id: 'rec_reuse_profile',
    section: 'Cadastro',
    label: 'Reaproveitamento de Dados Cadastrais',
    status: isReused ? (isOldIncomplete ? 'atencao' : 'ok') : 'ok',
    statusText: isReused ? (isOldIncomplete ? '🟨 Atenção' : '✅ Completo') : '✅ Completo',
    details: isReused 
      ? (isOldIncomplete ? 'Dados reaproveitados do cadastro do cliente legado, porém o cadastro necessita correções!' : 'Perfil consolidado reaproveitado sem inconsistências judiciais.')
      : 'Cadastro originado totalmente do zero.',
    weight: 0,
    isCriticalLock: false,
    responsible: 'Secretaria'
  });

  // -------------------------------------------------------------
  // SEÇÃO 14: CONTROLADORIA DE PUBLICIDADE
  // -------------------------------------------------------------
  const controladoriaPrazosOk = !temPrazo || (hasVal(caseData.prazoFatal) && hasVal(caseData.prazoResponsavelId));
  items.push({
    id: 'ct_controladoria_aud',
    section: 'Controladoria',
    label: 'Rito de Auditoria de Prazos',
    status: controladoriaPrazosOk ? 'ok' : 'erro_critico',
    statusText: controladoriaPrazosOk ? '✅ Completo' : '⚠️ Trava Crítica',
    details: controladoriaPrazosOk ? 'Controle de prazos íntegro conduzido de forma regular.' : 'Identificado prazo processual sem data fatal ou sem advogado associado',
    weight: 3,
    isCriticalLock: !controladoriaPrazosOk,
    impact: 'Trava Crítica Máxima: Abandono ou desconhecimento de prazos judiciais expõe o escritório a graves sinistros pecuniários de imperícia.',
    action: 'Complementar o cadastro de prazo na controladoria designando o prazo fatal e o patrono correspondente.',
    responsible: 'Controladoria'
  });

  // -------------------------------------------------------------
  // SEÇÃO 15: ARQUIVAMENTO
  // -------------------------------------------------------------
  const hasOpenTasks = caseData.hasOpenTasks === true || (wiz.q5_1 === 'sim' && evidenceRequests.some(r => r.status === 'pendente'));
  const hasFutureDeadlines = caseData.hasFutureDeadlines === true;
  const isArchivedRequested = caseData.archived === true || caseData.statusInterno === 'Arquivado';

  if (isArchivedRequested) {
    if (hasOpenTasks) {
      items.push({
        id: 'arq_pendencias',
        section: 'Arquivamento',
        label: 'Aferição de Pendências antes de Arquivar',
        status: 'erro_critico',
        statusText: '⚠️ Trava Crítica',
        details: 'Forçado arquivamento do caso de forma incorreta com pendências em aberto descritas no prontuário.',
        weight: 3,
        isCriticalLock: true,
        responsible: 'Controladoria'
      });
    }

    if (hasFutureDeadlines) {
      items.push({
        id: 'arq_prazos_ativos',
        section: 'Arquivamento',
        label: 'Aferição de Prazos Ativos em Processos Arquivados',
        status: 'erro_critico',
        statusText: '⚠️ Trava Crítica',
        details: 'Caso arquivado com prazo fatal futuro em aberto sem baixa do juiz!',
        weight: 3,
        isCriticalLock: true,
        responsible: 'Controladoria'
      });
    }
  } else {
    items.push({
      id: 'arq_checking',
      section: 'Arquivamento',
      label: 'Prevenção de Arquivamento Inconsistente',
      status: 'ok',
      statusText: '✅ Completo',
      details: 'Sem impedimento para trâmite administrativo.',
      weight: 0,
      isCriticalLock: false,
      responsible: 'Controladoria'
    });
  }

  // -------------------------------------------------------------
  // SEÇÃO 16: RECADASTRAMENTO
  // -------------------------------------------------------------
  const isLegacyClient = client?.isLegado === true || client?.reaproveitado === true;
  if (isLegacyClient) {
    const drivesConnected = hasVal(client?.gdriveFolderId) || hasVal(client?.googleDriveClientFolderId);
    items.push({
      id: 're_legacy_drive',
      section: 'Google Drive',
      label: 'Vínculo de Drive Legado',
      status: drivesConnected ? 'ok' : 'erro_critico',
      statusText: drivesConnected ? '✅ Completo' : '⚠️ Trava Crítica',
      details: drivesConnected ? 'Pasta do drive legado importada com arquivos.' : 'Drive de cliente legado offline ou não re-vinculado no Portal',
      weight: 3,
      isCriticalLock: !drivesConnected,
      impact: 'O operador é incapaz de herdar documentos originais e históricos de peticionamento.',
      action: 'Registrar e vincular manualmente os links correspondentes da estrutura legada no Workspace.',
      responsible: 'Secretaria'
    });
  }

  // -------------------------------------------------------------
  // SEÇÃO 22: REGRAS DE CÁLCULO & PERCENTUAL DE INTEGRIDADE
  // -------------------------------------------------------------
  // Weight calculations per block as well as total, ignoring facultative items with weight 0
  const sectionsGroup: Record<string, AuditItem[]> = {};
  items.forEach(item => {
    if (!sectionsGroup[item.section]) {
      sectionsGroup[item.section] = [];
    }
    sectionsGroup[item.section].push(item);
  });

  const sectionScores: Record<string, SectionScore> = {};
  let globalTotalWeight = 0;
  let globalCompletedWeight = 0;

  Object.entries(sectionsGroup).forEach(([secName, secItems]) => {
    let totalW = 0;
    let completedW = 0;

    secItems.forEach(item => {
      totalW += item.weight;
      if (item.status === 'ok') {
        completedW += item.weight;
      }
    });

    const percent = totalW > 0 ? Math.round((completedW / totalW) * 100) : 100;
    sectionScores[secName] = {
      name: secName,
      percent,
      totalWeight: totalW,
      completedWeight: completedW
    };

    globalTotalWeight += totalW;
    globalCompletedWeight += completedW;
  });

  const overallPercent = globalTotalWeight > 0 ? Math.round((globalCompletedWeight / globalTotalWeight) * 100) : 100;

  // Filter lists
  const criticalLocks = items.filter(item => item.isCriticalLock);
  const pendingItems = items.filter(item => item.status === 'pendente' || item.status === 'atencao');

  // -------------------------------------------------------------
  // SEÇÃO 19: ORDEM DE DESTRAVAMENTO (LOGICAL SOLUTION ORDER)
  // -------------------------------------------------------------
  const unblockingOrder: string[] = [];
  
  // Logical order rules constraints:
  // 1. Cadastros PF/PJ must be solved first
  const pfPjLocks = criticalLocks.filter(l => l.section === 'Cadastro');
  pfPjLocks.forEach(l => {
    unblockingOrder.push(`Completar dados cadastrais do cliente: preencher o campo "${l.label}" (${l.responsible}).`);
  });

  // 2. Drive Folders & Structure next
  const driveLocks = criticalLocks.filter(l => l.section === 'Google Drive' || l.section === 'Estruturação');
  driveLocks.forEach(l => {
    unblockingOrder.push(`Providenciar estruturação do local de arquivos: "${l.label}" (${l.responsible}).`);
  });

  // 3. Document generations and coletas next
  const coletaLocks = criticalLocks.filter(l => l.section === 'Provas');
  coletaLocks.forEach(l => {
    unblockingOrder.push(`Sanar pendência de documentos de prova: "${l.label}" (${l.responsible}).`);
  });

  // 4. Entrevista/Tipo de Serviço
  const entrevistaLocks = criticalLocks.filter(l => l.section === 'Entrevista' || l.section === 'Tipo de Serviço');
  entrevistaLocks.forEach(l => {
    unblockingOrder.push(`Qualificar rito processual e fatos da demanda: "${l.label}" (${l.responsible}).`);
  });

  // 5. Delegação & Responsáveis
  const delegationLocks = criticalLocks.filter(l => l.section === 'Delegação');
  delegationLocks.forEach(l => {
    unblockingOrder.push(`Designar equipe operacional do caso: "${l.label}" (${l.responsible}).`);
  });

  // 6. Revisão & Drafts
  const revisionLocks = criticalLocks.filter(l => l.section === 'Revisão');
  revisionLocks.forEach(l => {
    unblockingOrder.push(`Revisar fundamentos jurídicos de ação: "${l.label}" (${l.responsible}).`);
  });

  // 7. Protocolo, prazos, controladoria
  const restLocks = criticalLocks.filter(l => l.section !== 'Cadastro' && l.section !== 'Google Drive' && l.section !== 'Estruturação' && l.section !== 'Provas' && l.section !== 'Entrevista' && l.section !== 'Tipo de Serviço' && l.section !== 'Delegação' && l.section !== 'Revisão');
  restLocks.forEach(l => {
    unblockingOrder.push(`Medidas finais de peticionamento e controle: "${l.label}" (${l.responsible}).`);
  });

  // Fallbacks for unblocking if there are no critical locks, but has pendencies
  if (unblockingOrder.length === 0 && pendingItems.length > 0) {
    pendingItems.forEach(p => {
      unblockingOrder.push(`Resolver pendência secundária: "${p.label}" de seção [${p.section}] (${p.responsible}).`);
    });
  }

  if (unblockingOrder.length === 0) {
    unblockingOrder.push('Caso totalmente íntegro! Pronto para arquivamento definitivo de rotinas ou prosseguimento.');
  }

  return {
    generatedAt: new Date().toISOString(),
    overallPercent,
    totalPendingCount: pendingItems.length,
    totalCriticalLocksCount: criticalLocks.length,
    items,
    sectionScores,
    criticalLocks,
    pendingItems,
    unblockingOrder
  };
}
