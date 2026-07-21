/**
 * Utility to prepare safe, non-sensitive, public data payloads
 * intended to be mirrored or fetched by the external Client Portal.
 * 
 * Strictly excludes: internal EDRP stages, delegation, structural revisions,
 * formal audits, security rules, and confidential backoffice notes.
 */

export interface PublicClientPayload {
  client: {
    clientId: string;
    slug: string;
    name: string;
    type: 'PF' | 'PJ';
    publicContactData: {
      email?: string;
      phone?: string;
      whatsapp?: string;
    };
  };
  cases: Array<{
    caseId: string;
    title: string;
    registrationType?: string;
    statusPublicoCliente: string;
    processNumber?: string;
    visibleToClient: boolean;
  }>;
  informationRequests: Array<{
    id: string;
    caseId: string;
    title: string;
    description?: string;
    status: string;
    visibleToClient: boolean;
    dueDate?: string;
  }>;
  evidenceRequests: Array<{
    id: string;
    caseId: string;
    title: string;
    description?: string;
    status: string;
    visibleToClient: boolean;
    dueDate?: string;
  }>;
  financials: Array<{
    id: string;
    caseId?: string;
    description: string;
    amount: number;
    dueDate?: string;
    paymentStatus: string;
    visibleToClient: boolean;
  }> | { notice: string };
}

export function buildPublicClientPayload(
  client: any,
  cases: any[],
  infoRequests: any[],
  evidenceRequests: any[],
  financials: any[]
): PublicClientPayload {
  // Determine client direct public identity
  const name = client?.type === 'PF'
    ? (client?.pfDadosPessoais?.pf_nomeCompleto || client?.pfData?.pf_nomeCompleto || 'Sem Nome')
    : (client?.pjDadosEmpresa?.pj_razaoSocial || client?.pjData?.pj_razaoSocial || 'Sem Razão Social');

  const publicContactData = client?.type === 'PF'
    ? {
        email: client?.pfContato?.pf_email || client?.pfData?.pf_email,
        phone: client?.pfContato?.pf_telefone || client?.pfData?.pf_telefone,
        whatsapp: client?.pfContato?.pf_whatsapp || client?.pfData?.pf_whatsapp,
      }
    : {
        email: client?.pjContatoEmpresa?.pj_emailEmpresa || client?.pjData?.pj_emailEmpresa,
        phone: client?.pjContatoEmpresa?.pj_telefoneEmpresa || client?.pjData?.pj_telefoneEmpresa,
        whatsapp: client?.pjContatoEmpresa?.pj_whatsappEmpresa || client?.pjData?.pj_whatsappEmpresa,
      };

  // Only include visible cases & filter public properties
  const safeCases = cases
    .filter(c => c.visibleToClient === true)
    .map(c => ({
      caseId: c.id,
      title: c.title || 'Caso Sem Título',
      registrationType: c.registrationType,
      statusPublicoCliente: c.statusPublicoCliente || 'Em análise preparatória',
      processNumber: c.processNumber,
      visibleToClient: true
    }));

  const publicCaseIds = new Set(safeCases.map(c => c.caseId));

  // Filter public text information requests (must belong to a public case OR directly flagged)
  const safeInfoRequests = infoRequests
    .filter(r => r.visibleToClient === true && publicCaseIds.has(r.caseId))
    .map(r => ({
      id: r.id,
      caseId: r.caseId,
      title: r.title || 'Solicitação de Informação',
      description: r.description,
      status: r.status || 'pendente',
      visibleToClient: true,
      dueDate: r.dueDate
    }));

  // Filter public documentation/evidence requests
  const safeEvidenceRequests = evidenceRequests
    .filter(r => r.visibleToClient === true && publicCaseIds.has(r.caseId))
    .map(r => ({
      id: r.id,
      caseId: r.caseId,
      title: r.title || 'Solicitação de Prova',
      description: r.description,
      status: r.status || 'pendente',
      visibleToClient: true,
      dueDate: r.dueDate
    }));

  // Handle financials visibility safely
  const publicFinancialRecords = financials.filter(
    f => f.visibleToClient === true && (!f.caseId || publicCaseIds.has(f.caseId))
  );

  const safeFinancials = publicFinancialRecords.length > 0
    ? publicFinancialRecords.map(f => ({
        id: f.id,
        caseId: f.caseId,
        description: f.description || 'Lançamento',
        amount: Number(f.amount || 0),
        dueDate: f.dueDate,
        paymentStatus: f.paymentStatus || 'aberto',
        visibleToClient: true
      }))
    : { notice: "Este recurso está sendo atualizado pelo BOSS" };

  return {
    client: {
      clientId: client?.id || '',
      slug: client?.slug || '',
      name,
      type: client?.type || 'PF',
      publicContactData
    },
    cases: safeCases,
    informationRequests: safeInfoRequests,
    evidenceRequests: safeEvidenceRequests,
    financials: safeFinancials
  };
}
