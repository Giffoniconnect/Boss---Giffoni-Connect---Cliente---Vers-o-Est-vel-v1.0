import { requestAsaas } from "./asaas-client";
import { SafeLogger } from "../utils/safe-logger";

export interface CreateChargeResult {
  entityType: "PAYMENT" | "INSTALLMENT" | "SUBSCRIPTION";
  customerId: string;
  paymentId?: string;
  installmentId?: string;
  subscriptionId?: string;
  status: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  identificationField?: string;
  dateCreated: string;
}

export async function createAsaasCharge(
  customerId: string,
  chargeData: any,
  externalReference: string
): Promise<CreateChargeResult> {
  const mode = chargeData.mode;

  if (mode === "ONE_TIME") {
    SafeLogger.info(`Creating ONE_TIME payment for customer ${customerId}`);
    const payload = {
      customer: customerId,
      billingType: "BOLETO",
      value: chargeData.value,
      dueDate: chargeData.dueDate,
      description: chargeData.description.trim(),
      externalReference,
      interest: {
        value: 1,
      },
      fine: {
        value: 10,
        type: "PERCENTAGE",
      },
      postalService: false,
    };

    const res = await requestAsaas<any>("POST", "/payments", payload);
    SafeLogger.info(`ONE_TIME payment created: ${res.id}`);

    // Retrieve identificationField (line code)
    let identificationField: string | undefined;
    try {
      SafeLogger.info(`Fetching identificationField for payment: ${res.id}`);
      const idenRes = await requestAsaas<any>("GET", `/payments/${res.id}/identificationField`);
      identificationField = idenRes?.identificationField || idenRes?.barCode;
    } catch (err: any) {
      SafeLogger.warn(`Failed to fetch identificationField for payment ${res.id}: ${err.message}`);
    }

    return {
      entityType: "PAYMENT",
      customerId,
      paymentId: res.id,
      status: res.status || "PENDING",
      invoiceUrl: res.invoiceUrl,
      bankSlipUrl: res.bankSlipUrl,
      identificationField,
      dateCreated: res.dateCreated || new Date().toISOString(),
    };
  }

  if (mode === "INSTALLMENT") {
    SafeLogger.info(`Creating INSTALLMENT payment for customer ${customerId} (Count: ${chargeData.installmentCount})`);
    const payload = {
      customer: customerId,
      billingType: "BOLETO",
      installmentCount: chargeData.installmentCount,
      totalValue: chargeData.totalValue,
      dueDate: chargeData.firstDueDate,
      description: chargeData.description.trim(),
      externalReference,
      interest: {
        value: 1,
      },
      fine: {
        value: 10,
        type: "PERCENTAGE",
      },
      postalService: false,
    };

    const res = await requestAsaas<any>("POST", "/payments", payload);
    SafeLogger.info(`INSTALLMENT created with id: ${res.id}, installmentId: ${res.installmentId}`);

    if (!res.installmentId) {
      SafeLogger.warn(`Payment created but no installmentId found in response for reference ${externalReference}`);
    }

    return {
      entityType: "INSTALLMENT",
      customerId,
      paymentId: res.id,
      installmentId: res.installmentId,
      status: res.status || "PENDING",
      invoiceUrl: res.invoiceUrl,
      bankSlipUrl: res.bankSlipUrl,
      dateCreated: res.dateCreated || new Date().toISOString(),
    };
  }

  if (mode === "SUBSCRIPTION") {
    SafeLogger.info(`Creating SUBSCRIPTION for customer ${customerId}`);
    const payload = {
      customer: customerId,
      billingType: "BOLETO",
      value: chargeData.valuePerCycle,
      nextDueDate: chargeData.nextDueDate,
      cycle: "MONTHLY",
      description: chargeData.description.trim(),
      externalReference,
      interest: {
        value: 1,
      },
      fine: {
        value: 10,
        type: "PERCENTAGE",
      },
    };

    const res = await requestAsaas<any>("POST", "/subscriptions", payload);
    SafeLogger.info(`SUBSCRIPTION created: ${res.id}`);

    return {
      entityType: "SUBSCRIPTION",
      customerId,
      subscriptionId: res.id,
      status: res.status || "ACTIVE",
      dateCreated: res.dateCreated || new Date().toISOString(),
    };
  }

  throw new Error(`Unsupported charge mode: ${mode}`);
}

export async function lookupAsaasChargeByExternalRef(
  externalReference: string,
  mode: "ONE_TIME" | "INSTALLMENT" | "SUBSCRIPTION"
): Promise<CreateChargeResult | null> {
  try {
    SafeLogger.info(`Checking if charge already exists in Asaas by externalReference: ${externalReference}`);
    
    if (mode === "SUBSCRIPTION") {
      const res = await requestAsaas<{ data: any[] }>("GET", `/subscriptions?externalReference=${encodeURIComponent(externalReference)}`);
      if (res.data && res.data.length > 0) {
        const item = res.data[0];
        SafeLogger.info(`Existing subscription found: ${item.id}`);
        return {
          entityType: "SUBSCRIPTION",
          customerId: item.customer,
          subscriptionId: item.id,
          status: item.status,
          dateCreated: item.dateCreated,
        };
      }
    } else {
      const res = await requestAsaas<{ data: any[] }>("GET", `/payments?externalReference=${encodeURIComponent(externalReference)}`);
      if (res.data && res.data.length > 0) {
        const item = res.data[0];
        SafeLogger.info(`Existing payment found: ${item.id}, installmentId: ${item.installmentId}`);
        
        let identificationField: string | undefined;
        try {
          const idenRes = await requestAsaas<any>("GET", `/payments/${item.id}/identificationField`);
          identificationField = idenRes?.identificationField || idenRes?.barCode;
        } catch {
          // Ignore failure
        }

        return {
          entityType: item.installmentId ? "INSTALLMENT" : "PAYMENT",
          customerId: item.customer,
          paymentId: item.id,
          installmentId: item.installmentId,
          status: item.status,
          invoiceUrl: item.invoiceUrl,
          bankSlipUrl: item.bankSlipUrl,
          identificationField,
          dateCreated: item.dateCreated,
        };
      }
    }
    return null;
  } catch (err: any) {
    SafeLogger.error(`Failed to lookup charge by externalReference ${externalReference}: ${err.message}`);
    return null;
  }
}
