import { SafeLogger } from "../utils/safe-logger";

export interface ResolvedBossContext {
  bossClientId: string;
  caseId: string;
  clientType: "PF" | "PJ";
  name: string;
  cpfCnpj: string;
  email: string;
  mobilePhone: string;
  savedCustomerId?: string;
  destinationDriveFolderId: string;
  address: {
    postalCode?: string;
    city?: string;
    street?: string;
    district?: string;
    number?: string;
    complement?: string;
  };
  caseFinancials?: {
    valorParcela?: number;
    quantidadeParcelas?: number;
    valorContrato?: number;
    formaPagamento?: string;
    description?: string;
  };
}

export async function resolveBossContext(db: any, caseId: string): Promise<ResolvedBossContext> {
  SafeLogger.info(`Resolving Giffoni BOSS context for case ID: ${caseId}`);

  const caseSnap = await db.collection("cases").doc(caseId).get();
  if (!caseSnap.exists) {
    throw new Error(`Caso referenciado por ID [${caseId}] não existe no banco de dados do BOSS.`);
  }

  const caseData = caseSnap.data();
  const clientId = caseData.clientId;
  if (!clientId) {
    throw new Error(`O caso [${caseId}] não possui um cliente associado (clientId ausente).`);
  }

  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    throw new Error(`O cliente [${clientId}] associado ao caso não existe no banco de dados.`);
  }

  const clientData = clientSnap.data();
  const clientType = clientData.type || clientData.clientType || "PF";

  // Name mapping
  let name = "";
  if (clientType === "PJ") {
    name = clientData.pjData?.pj_razaoSocial || clientData.pjDadosPessoais?.pj_razaoSocial || clientData.razaoSocial || clientData.nomeCompleto || clientData.nome || clientData.name || "";
  } else {
    name = clientData.pfData?.pf_nomeCompleto || clientData.pfDadosPessoais?.pf_nomeCompleto || clientData.nomeCompleto || clientData.nome || clientData.name || "";
  }
  name = name.trim();
  if (!name) {
    throw new Error(`Nome ou Razão Social do cliente não localizado. Verifique o cadastro do cliente.`);
  }

  // Document mapping
  let cpfCnpj = "";
  if (clientType === "PJ") {
    cpfCnpj = clientData.pjData?.pj_cnpj || clientData.pjDadosPessoais?.pj_cnpj || clientData.cnpj || clientData.cpfCnpj || "";
  } else {
    cpfCnpj = clientData.pfData?.pf_cpf || clientData.pfDadosPessoais?.pf_cpf || clientData.portalMirror?.pfDadosPessoais?.cpf || clientData.cpf || clientData.cpfCnpj || "";
  }
  cpfCnpj = cpfCnpj.replace(/\D/g, "");
  if (!cpfCnpj) {
    throw new Error(`Documento CPF/CNPJ do cliente não localizado. Verifique o cadastro do cliente.`);
  }

  // Contact mapping
  let email = "";
  if (clientType === "PJ") {
    email = clientData.pjData?.pj_email || clientData.pjDadosPessoais?.pj_email || clientData.email || "";
  } else {
    email = clientData.pfDadosPessoais?.pf_email || clientData.pfData?.pf_email || clientData.email || "";
  }
  email = email.trim();

  let mobilePhone = "";
  if (clientType === "PJ") {
    mobilePhone = clientData.pjData?.pj_whatsapp || clientData.pjDadosPessoais?.pj_whatsapp || clientData.phone || "";
  } else {
    mobilePhone = clientData.pfDadosPessoais?.pf_whatsapp || clientData.pfDadosPessoais?.pf_telefone || clientData.pfData?.pf_whatsapp || clientData.pfData?.pf_telefone || clientData.mobilePhone || clientData.phone || "";
  }
  mobilePhone = mobilePhone.replace(/\D/g, "");

  // Address mapping
  const address: ResolvedBossContext["address"] = {};
  if (clientType === "PJ") {
    const pjAddr = clientData.pjEndereco || clientData.pjData || {};
    address.postalCode = (pjAddr.pj_cep || pjAddr.cep || "").replace(/\D/g, "");
    address.street = pjAddr.pj_logradouro || pjAddr.logradouro || pjAddr.address || "";
    address.number = String(pjAddr.pj_numero || pjAddr.numero || "");
    address.district = pjAddr.pj_bairro || pjAddr.bairro || "";
    address.city = pjAddr.pj_cidade || pjAddr.cidade || "";
    address.complement = pjAddr.pj_complemento || pjAddr.complemento || "";
  } else {
    const pfAddr = clientData.pfEndereco || clientData.pfData || {};
    address.postalCode = (pfAddr.pf_cep || pfAddr.cep || "").replace(/\D/g, "");
    address.street = pfAddr.pf_logradouro || pfAddr.logradouro || pfAddr.address || "";
    address.number = String(pfAddr.pf_numero || pfAddr.numero || "");
    address.district = pfAddr.pf_bairro || pfAddr.bairro || "";
    address.city = pfAddr.pf_cidade || pfAddr.cidade || "";
    address.complement = pfAddr.pf_complemento || pfAddr.complemento || "";
  }

  // Saved Asaas customer ID
  const savedCustomerId =
    clientData.integrations?.asaas?.customerId ||
    clientData.asaasCustomerId ||
    clientData.customerId ||
    clientData.asaas_customer_id ||
    "";

  // Google Drive destination folder ID
  const destinationDriveFolderId = (
    clientData.googleDriveClientFolderId ||
    clientData.gdriveFolderId ||
    caseData.gdriveFolderId ||
    ""
  ).trim();

  if (!destinationDriveFolderId) {
    throw new Error(`Não há pasta real do Google Drive vinculada ao cliente. Acesse o cadastro do cliente e execute primeiro a Automação Google Drive.`);
  }

  const caseFinancials = {
    valorParcela: Number(caseData.valorParcela) || undefined,
    quantidadeParcelas: Number(caseData.quantidadeParcelas) || undefined,
    valorContrato: Number(caseData.valorTotalHonorarios || caseData.valorContrato || caseData.valorAcordo || caseData.valorTotal || caseData.valorParcela) || undefined,
    formaPagamento: caseData.formaPagamento || undefined,
    description: caseData.processoNumero || caseData.processoTipo || caseData.description || "Honorários Advocatícios - Giffoni Advogados",
  };

  return {
    bossClientId: clientId,
    caseId,
    clientType: clientType === "PJ" ? "PJ" : "PF",
    name,
    cpfCnpj,
    email,
    mobilePhone,
    savedCustomerId,
    destinationDriveFolderId,
    address,
    caseFinancials,
  };
}

export async function updateBossAsaasCustomerId(db: any, clientId: string, customerId: string): Promise<void> {
  SafeLogger.info(`Updating client ${clientId} with Asaas Customer ID: ${customerId}`);
  try {
    const clientRef = db.collection("clients").doc(clientId);
    await clientRef.set({
      asaasCustomerId: customerId,
      integrations: {
        asaas: {
          customerId: customerId,
          updatedAt: new Date().toISOString()
        }
      }
    }, { merge: true });
    SafeLogger.info(`Client ${clientId} successfully updated with Asaas Customer ID`);
  } catch (err: any) {
    SafeLogger.error(`Failed to update client ${clientId} with Asaas Customer ID`, err);
  }
}

export { resolveBossContext as resolveAsaasCustomer };
