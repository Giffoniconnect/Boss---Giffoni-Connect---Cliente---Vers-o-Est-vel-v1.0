import { GiffoniAsaasChargeContractV1, AsaasOperationStatus } from "../contracts/asaas-contract";
import { validateAsaasChargeInput } from "../contracts/asaas-schemas";
import { resolveBossContext, updateBossAsaasCustomerId } from "../boss/boss-client-service";
import { resolveAsaasCustomer } from "./customer-service";
import { disableAllCustomerNotifications } from "./notification-service";
import { createAsaasCharge, lookupAsaasChargeByExternalRef } from "./charge-service";
import { downloadAsaasPdf } from "./pdf-service";
import { uploadPdfToDrive } from "../drive/drive-storage-service";
import { SafeLogger, maskCpfCnpj, maskEmail, maskPhone } from "../utils/safe-logger";

export async function orchestrateAsaasCharge(
  db: any,
  jwtClient: any,
  input: {
    caseId: string;
    charge: {
      mode: "ONE_TIME" | "INSTALLMENT" | "SUBSCRIPTION";
      description: string;
      value?: number;
      dueDate?: string;
      totalValue?: number;
      installmentCount?: number;
      firstDueDate?: string;
      valuePerCycle?: number;
      nextDueDate?: string;
    };
    operator?: {
      userId?: string;
      name?: string;
    };
  }
): Promise<GiffoniAsaasChargeContractV1> {
  const operationId = `OP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
  const idempotencyKey = `IDEM_${input.caseId}_${input.charge.mode}_${Date.now()}`.toUpperCase();
  const externalReference = `REF_${input.caseId}_${input.charge.mode}_${Date.now().toString().substring(4)}`.toUpperCase();

  const now = new Date().toISOString();

  // Initialize Contract
  const contract: GiffoniAsaasChargeContractV1 = {
    schemaVersion: "1.0.0",
    operation: {
      operationId,
      idempotencyKey,
      externalReference,
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
    },
    source: {
      portal: "GIFFONI_BOSS",
      bossClientId: "",
      financialContractId: input.caseId,
      caseId: input.caseId,
      requestedByUserId: input.operator?.userId,
      requestedByName: input.operator?.name,
      destinationDriveFolderId: "",
    },
    customer: {
      personType: "PF",
      name: "",
      cpfCnpj: "",
      address: {},
      asaas: {
        externalReference: "",
        lookupStatus: "NOT_CHECKED",
      },
    },
    charge: input.charge as any,
    fixedPolicy: {
      interestMonthlyPercent: 1,
      finePercent: 10,
      fineType: "PERCENTAGE",
      discountEnabled: false,
      feePassThroughEnabled: false,
      receiveInTwoBusinessDaysEnabled: false,
      postalServiceEnabled: false,
      printedDocumentEnabled: true,
      creditCardEnabled: false,
      notificationsEnabled: false,
    },
    notifications: {
      whatsappEnabled: false,
      emailEnabled: false,
      smsEnabled: false,
      voiceCallEnabled: false,
      notifyNewCharge: false,
      notifyChargeChange: false,
      sendBeforeDueDate: false,
      sendOnDueDate: false,
      sendIdentificationFieldOnDueDate: false,
      notifyOverdue: false,
      resendAfterDueDate: false,
      notifyPaymentConfirmation: false,
    },
    drive: {
      destinationFolderId: "",
      status: "PENDING",
      files: [],
    },
    audit: {
      events: [],
    },
  };

  const addAudit = (action: string, status: "STARTED" | "SUCCESS" | "WARNING" | "ERROR", safeMessage: string) => {
    contract.audit.events.push({
      timestamp: new Date().toISOString(),
      action,
      status,
      actorUserId: input.operator?.userId,
      safeMessage,
    });
    SafeLogger.info(`Audit: [${action}] [${status}] ${safeMessage}`);
  };

  const saveContract = async (status: AsaasOperationStatus) => {
    contract.operation.status = status;
    contract.operation.updatedAt = new Date().toISOString();
    try {
      await db.collection("asaas_charge_contracts").doc(externalReference).set(contract);
    } catch (err: any) {
      SafeLogger.error("Failed to save charge contract to Firestore", err);
    }
  };

  addAudit("ORCHESTRATION_STARTED", "STARTED", `Iniciando geração de cobrança modalidade ${input.charge.mode} para Caso ID: ${input.caseId}`);

  try {
    // Step 1: Resolve BOSS customer & case information
    addAudit("BOSS_LOOKUP", "STARTED", "Buscando dados cadastrais e financeiros do cliente no Giffoni BOSS.");
    let bossContext;
    try {
      bossContext = await resolveBossContext(db, input.caseId);
      
      contract.source.bossClientId = bossContext.bossClientId;
      contract.source.destinationDriveFolderId = bossContext.destinationDriveFolderId;
      contract.drive.destinationFolderId = bossContext.destinationDriveFolderId;
      
      contract.customer.personType = bossContext.clientType;
      contract.customer.name = bossContext.name;
      contract.customer.cpfCnpj = bossContext.cpfCnpj;
      contract.customer.email = bossContext.email || undefined;
      contract.customer.mobilePhone = bossContext.mobilePhone || undefined;
      contract.customer.address = bossContext.address;
      contract.customer.asaas.externalReference = `GC_CLIENT:${bossContext.bossClientId}`;

      const maskedDoc = maskCpfCnpj(bossContext.cpfCnpj);
      const maskedEmail = maskEmail(bossContext.email);
      const maskedPhone = maskPhone(bossContext.mobilePhone);

      addAudit("BOSS_LOOKUP", "SUCCESS", `BOSS resolvido: Cliente ${bossContext.name} (${maskedDoc}), Email: ${maskedEmail}, Tel: ${maskedPhone}`);
    } catch (err: any) {
      addAudit("BOSS_LOOKUP", "ERROR", `Erro ao carregar dados do BOSS: ${err.message}`);
      throw err;
    }

    // Step 2: Validate Data Structure
    addAudit("DATA_VALIDATION", "STARTED", "Validando as regras de integridade do payload de cobrança.");
    const validation = validateAsaasChargeInput(contract);
    if (!validation.isValid) {
      const errorMsg = `Regras de negócio violadas: ${validation.errors.join("; ")}`;
      addAudit("DATA_VALIDATION", "ERROR", errorMsg);
      throw new Error(errorMsg);
    }
    addAudit("DATA_VALIDATION", "SUCCESS", "Validação de dados concluída com êxito.");

    await saveContract("CUSTOMER_LOOKUP");

    // Step 3: Check/Create customer in ASAAS
    addAudit("CUSTOMER_LOOKUP", "STARTED", `Pesquisando cliente no ASAAS usando prioridade de identificadores.`);
    let asaasCustomerResult;
    try {
      asaasCustomerResult = await resolveAsaasCustomer(
        bossContext.bossClientId,
        {
          name: bossContext.name,
          cpfCnpj: bossContext.cpfCnpj,
          email: bossContext.email,
          mobilePhone: bossContext.mobilePhone,
          address: bossContext.address,
        },
        bossContext.savedCustomerId
      );

      contract.customer.asaas.customerId = asaasCustomerResult.customerId;
      contract.customer.asaas.lookupStatus = asaasCustomerResult.lookupStatus;
      contract.customer.asaas.syncedAt = new Date().toISOString();

      addAudit("CUSTOMER_LOOKUP", "SUCCESS", `Cliente resolvido no ASAAS com ID: ${asaasCustomerResult.customerId} (Método: ${asaasCustomerResult.lookupStatus})`);

      // Update BOSS with the resolved Asaas customer ID
      if (asaasCustomerResult.lookupStatus !== "FOUND_BY_SAVED_ID") {
        await updateBossAsaasCustomerId(db, bossContext.bossClientId, asaasCustomerResult.customerId);
        addAudit("BOSS_UPDATE_CUSTOMER_ID", "SUCCESS", `ID do cliente ASAAS atualizado no Firestore do Giffoni BOSS.`);
      }
    } catch (err: any) {
      addAudit("CUSTOMER_LOOKUP", "ERROR", `Falha na resolução do cliente no ASAAS: ${err.message}`);
      throw err;
    }

    await saveContract("NOTIFICATIONS_DISABLING");

    // Step 4: Disable Notifications in ASAAS
    addAudit("NOTIFICATIONS_DISABLING", "STARTED", `Iniciando desativação de notificações e comunicações diretas do cliente no ASAAS.`);
    try {
      await disableAllCustomerNotifications(asaasCustomerResult.customerId);
      addAudit("NOTIFICATIONS_DISABLING", "SUCCESS", "Todas as notificações do cliente foram totalmente desativadas.");
    } catch (err: any) {
      addAudit("NOTIFICATIONS_DISABLING", "ERROR", err.message);
      throw err;
    }

    await saveContract("CREATING_ASAAS_ENTITY");

    // Step 5: Check Idempotency in ASAAS
    addAudit("IDEMPOTENCY_CHECK", "STARTED", `Verificando existência prévia da cobrança no ASAAS por referência externa: ${externalReference}`);
    let chargeResult = await lookupAsaasChargeByExternalRef(externalReference, input.charge.mode);
    if (chargeResult) {
      addAudit("IDEMPOTENCY_CHECK", "WARNING", `Cobrança já existente localizada no ASAAS com ID: ${chargeResult.paymentId || chargeResult.subscriptionId}. Reutilizando entidade.`);
    } else {
      // Step 6: Create Charge in ASAAS
      addAudit("CREATING_ASAAS_ENTITY", "STARTED", `Criando cobrança modalidade ${input.charge.mode} no ASAAS para o cliente.`);
      try {
        chargeResult = await createAsaasCharge(asaasCustomerResult.customerId, input.charge, externalReference);
        addAudit("CREATING_ASAAS_ENTITY", "SUCCESS", `Cobrança criada com sucesso no ASAAS. ID: ${chargeResult.paymentId || chargeResult.installmentId || chargeResult.subscriptionId}`);
      } catch (err: any) {
        addAudit("CREATING_ASAAS_ENTITY", "ERROR", `Falha ao emitir cobrança no ASAAS: ${err.message}`);
        throw err;
      }
    }

    contract.asaasResult = chargeResult;
    await saveContract("DOWNLOADING_PDF");

    // Step 7: Download PDF from ASAAS
    addAudit("DOWNLOADING_PDF", "STARTED", `Iniciando download do boleto/carnê oficial gerado pelo ASAAS.`);
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await downloadAsaasPdf(input.charge.mode, {
        paymentId: chargeResult.paymentId,
        installmentId: chargeResult.installmentId,
        subscriptionId: chargeResult.subscriptionId,
        bankSlipUrl: chargeResult.bankSlipUrl,
      });
      addAudit("DOWNLOADING_PDF", "SUCCESS", `Boleto/carnê em formato PDF baixado com sucesso. Tamanho: ${pdfBuffer.length} bytes.`);
    } catch (err: any) {
      addAudit("DOWNLOADING_PDF", "ERROR", `Não foi possível baixar o PDF: ${err.message}. Definindo como Sucesso Parcial.`);
      contract.drive.status = "FAILED";
      await saveContract("PARTIAL_SUCCESS_DRIVE_PENDING");
      return contract;
    }

    await saveContract("UPLOADING_TO_DRIVE");

    // Step 8: Upload to Google Drive
    addAudit("UPLOADING_TO_DRIVE", "STARTED", `Enviando arquivo PDF para a pasta do cliente no Google Drive.`);
    try {
      contract.drive.status = "UPLOADING";
      
      const cleanName = bossContext.name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
      const shortId = input.caseId.substring(0, 6).toUpperCase();
      const fileName = `BOLETO_HONORARIOS_${cleanName}_${shortId}_${input.charge.mode}.pdf`;

      const uploadResult = await uploadPdfToDrive(jwtClient, bossContext.destinationDriveFolderId, fileName, pdfBuffer);
      
      contract.drive.status = "UPLOADED";
      contract.drive.files.push({
        driveFileId: uploadResult.driveFileId,
        fileName: uploadResult.fileName,
        mimeType: "application/pdf",
        webViewLink: uploadResult.webViewLink,
        webContentLink: uploadResult.webContentLink,
        uploadedAt: uploadResult.uploadedAt,
        sourceType: input.charge.mode === "ONE_TIME" ? "BANK_SLIP" : (input.charge.mode === "INSTALLMENT" ? "INSTALLMENT_PAYMENT_BOOK" : "SUBSCRIPTION_PAYMENT_BOOK"),
        asaasPaymentId: chargeResult.paymentId,
        asaasInstallmentId: chargeResult.installmentId,
        asaasSubscriptionId: chargeResult.subscriptionId,
      });

      addAudit("UPLOADING_TO_DRIVE", "SUCCESS", `PDF enviado com sucesso para o Google Drive. File ID: ${uploadResult.driveFileId}`);
      await saveContract("COMPLETED");
    } catch (err: any) {
      addAudit("UPLOADING_TO_DRIVE", "ERROR", `Erro no envio para o Drive: ${err.message}. Definindo como Sucesso Parcial.`);
      contract.drive.status = "FAILED";
      await saveContract("PARTIAL_SUCCESS_DRIVE_PENDING");
    }

    return contract;
  } catch (globalErr: any) {
    addAudit("FLOW_FAILED", "ERROR", `Fluxo abortado devido a um erro crítico: ${globalErr.message}`);
    await saveContract("FAILED");
    throw globalErr;
  }
}

// Retry Drive Upload mechanism for Partial Success
export async function retryDriveUploadForContract(
  db: any,
  jwtClient: any,
  externalReference: string,
  operator?: { userId?: string; name?: string }
): Promise<GiffoniAsaasChargeContractV1> {
  SafeLogger.info(`Retrying Google Drive upload for contract: ${externalReference}`);

  const docSnap = await db.collection("asaas_charge_contracts").doc(externalReference).get();
  if (!docSnap.exists) {
    throw new Error(`Contrato ${externalReference} não encontrado para reprocessamento.`);
  }

  const contract = docSnap.data() as GiffoniAsaasChargeContractV1;
  if (contract.operation.status !== "PARTIAL_SUCCESS_DRIVE_PENDING") {
    throw new Error(`O contrato ${externalReference} não está em estado de Sucesso Parcial Pendente.`);
  }

  const addAudit = (action: string, status: "STARTED" | "SUCCESS" | "WARNING" | "ERROR", safeMessage: string) => {
    contract.audit.events.push({
      timestamp: new Date().toISOString(),
      action,
      status,
      actorUserId: operator?.userId,
      safeMessage,
    });
    SafeLogger.info(`Audit (Retry): [${action}] [${status}] ${safeMessage}`);
  };

  const saveContract = async (status: AsaasOperationStatus) => {
    contract.operation.status = status;
    contract.operation.updatedAt = new Date().toISOString();
    await db.collection("asaas_charge_contracts").doc(externalReference).set(contract);
  };

  addAudit("RETRY_DRIVE_UPLOAD", "STARTED", "Iniciando reprocessamento do upload do PDF ao Google Drive.");

  try {
    if (!contract.asaasResult) {
      throw new Error("Contrato de dados não contém resultados do ASAAS necessários para o download do PDF.");
    }

    // Step 1: Download PDF
    addAudit("DOWNLOADING_PDF", "STARTED", "Baixando boleto/carnê do ASAAS para reprocessamento.");
    const pdfBuffer = await downloadAsaasPdf(contract.charge.mode, {
      paymentId: contract.asaasResult.paymentId,
      installmentId: contract.asaasResult.installmentId,
      subscriptionId: contract.asaasResult.subscriptionId,
      bankSlipUrl: contract.asaasResult.bankSlipUrl,
    });
    addAudit("DOWNLOADING_PDF", "SUCCESS", "PDF baixado com sucesso.");

    // Step 2: Upload to Google Drive
    addAudit("UPLOADING_TO_DRIVE", "STARTED", "Enviando arquivo PDF para o Google Drive.");
    contract.drive.status = "UPLOADING";
    
    // Resolve clean name
    const cleanName = contract.customer.name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
    const shortId = contract.source.caseId ? contract.source.caseId.substring(0, 6).toUpperCase() : "GDI";
    const fileName = `BOLETO_HONORARIOS_${cleanName}_${shortId}_${contract.charge.mode}.pdf`;

    const uploadResult = await uploadPdfToDrive(jwtClient, contract.source.destinationDriveFolderId, fileName, pdfBuffer);
    
    contract.drive.status = "UPLOADED";
    contract.drive.files.push({
      driveFileId: uploadResult.driveFileId,
      fileName: uploadResult.fileName,
      mimeType: "application/pdf",
      webViewLink: uploadResult.webViewLink,
      webContentLink: uploadResult.webContentLink,
      uploadedAt: uploadResult.uploadedAt,
      sourceType: contract.charge.mode === "ONE_TIME" ? "BANK_SLIP" : (contract.charge.mode === "INSTALLMENT" ? "INSTALLMENT_PAYMENT_BOOK" : "SUBSCRIPTION_PAYMENT_BOOK"),
      asaasPaymentId: contract.asaasResult.paymentId,
      asaasInstallmentId: contract.asaasResult.installmentId,
      asaasSubscriptionId: contract.asaasResult.subscriptionId,
    });

    addAudit("RETRY_DRIVE_UPLOAD", "SUCCESS", "Reprocessamento concluído com êxito. PDF salvo no Google Drive.");
    await saveContract("COMPLETED");

    return contract;
  } catch (err: any) {
    addAudit("RETRY_DRIVE_UPLOAD", "ERROR", `Falha na tentativa de reprocessamento: ${err.message}`);
    await saveContract("PARTIAL_SUCCESS_DRIVE_PENDING");
    throw err;
  }
}
