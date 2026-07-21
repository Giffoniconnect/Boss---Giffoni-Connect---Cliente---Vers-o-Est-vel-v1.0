export type AsaasChargeMode =
  | "ONE_TIME"
  | "INSTALLMENT"
  | "SUBSCRIPTION";

export type AsaasBillingType = "BOLETO";

export type AsaasOperationStatus =
  | "DRAFT"
  | "VALIDATING"
  | "CUSTOMER_LOOKUP"
  | "CUSTOMER_FOUND"
  | "CUSTOMER_CREATED"
  | "NOTIFICATIONS_DISABLING"
  | "NOTIFICATIONS_DISABLED"
  | "CREATING_ASAAS_ENTITY"
  | "ASAAS_ENTITY_CREATED"
  | "DOWNLOADING_PDF"
  | "UPLOADING_TO_DRIVE"
  | "COMPLETED"
  | "PARTIAL_SUCCESS_DRIVE_PENDING"
  | "BLOCKED"
  | "FAILED";

export type AsaasCustomerLookupStatus =
  | "NOT_CHECKED"
  | "FOUND_BY_SAVED_ID"
  | "FOUND_BY_EXTERNAL_REFERENCE"
  | "FOUND_BY_DOCUMENT"
  | "NOT_FOUND"
  | "CREATED"
  | "DUPLICATE_CONFLICT"
  | "ERROR";

export interface GiffoniAsaasChargeContractV1 {
  schemaVersion: "1.0.0";

  operation: {
    operationId: string;
    idempotencyKey: string;
    externalReference: string;
    status: AsaasOperationStatus;
    createdAt: string;
    updatedAt: string;
  };

  source: {
    portal: "GIFFONI_BOSS";
    bossClientId: string;
    financialContractId: string; // This corresponds to caseId
    caseId?: string;
    productionFlowId?: string;
    requestedByUserId?: string;
    requestedByName?: string;
    destinationDriveFolderId: string;
    destinationDriveFolderName?: string;
  };

  customer: {
    personType: "PF" | "PJ";
    name: string;
    cpfCnpj: string;
    email?: string;
    mobilePhone?: string;

    address: {
      postalCode?: string;
      city?: string;
      street?: string;
      district?: string;
      number?: string;
      complement?: string;
    };

    asaas: {
      customerId?: string;
      externalReference: string;
      lookupStatus: AsaasCustomerLookupStatus;
      syncedAt?: string;
    };
  };

  charge:
    | {
        mode: "ONE_TIME";
        description: string;
        billingType: "BOLETO";
        value: number;
        dueDate: string;
      }
    | {
        mode: "INSTALLMENT";
        description: string;
        billingType: "BOLETO";
        totalValue: number;
        installmentCount: number;
        firstDueDate: string;
        installmentValuePreview?: number;
      }
    | {
        mode: "SUBSCRIPTION";
        description: string;
        billingType: "BOLETO";
        valuePerCycle: number;
        nextDueDate: string;
        cycle: "MONTHLY";
        indefiniteUntilCancelled: true;
      };

  fixedPolicy: {
    interestMonthlyPercent: 1;
    finePercent: 10;
    fineType: "PERCENTAGE";
    discountEnabled: false;
    feePassThroughEnabled: false;
    receiveInTwoBusinessDaysEnabled: false;
    postalServiceEnabled: false;
    printedDocumentEnabled: true;
    creditCardEnabled: false;
    notificationsEnabled: false;
  };

  notifications: {
    whatsappEnabled: false;
    emailEnabled: false;
    smsEnabled: false;
    voiceCallEnabled: false;
    notifyNewCharge: false;
    notifyChargeChange: false;
    sendBeforeDueDate: false;
    sendOnDueDate: false;
    sendIdentificationFieldOnDueDate: false;
    notifyOverdue: false;
    resendAfterDueDate: false;
    notifyPaymentConfirmation: false;
  };

  asaasResult?: {
    entityType:
      | "PAYMENT"
      | "INSTALLMENT"
      | "SUBSCRIPTION";

    customerId: string;
    paymentId?: string;
    installmentId?: string;
    subscriptionId?: string;
    status?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    identificationField?: string;
    dateCreated?: string;
  };

  drive: {
    destinationFolderId: string;
    status:
      | "PENDING"
      | "CHECKING_FOLDER"
      | "FOLDER_READY"
      | "UPLOADING"
      | "UPLOADED"
      | "FAILED";

    files: Array<{
      driveFileId: string;
      fileName: string;
      mimeType: "application/pdf";
      webViewLink?: string;
      webContentLink?: string;
      uploadedAt: string;
      sourceType:
        | "BANK_SLIP"
        | "INSTALLMENT_PAYMENT_BOOK"
        | "SUBSCRIPTION_PAYMENT_BOOK";
      asaasPaymentId?: string;
      asaasInstallmentId?: string;
      asaasSubscriptionId?: string;
    }>;
  };

  audit: {
    events: Array<{
      timestamp: string;
      action: string;
      status: "STARTED" | "SUCCESS" | "WARNING" | "ERROR";
      actorUserId?: string;
      safeMessage: string;
      httpStatus?: number;
      asaasEntityId?: string;
      retryable?: boolean;
    }>;
  };
}
