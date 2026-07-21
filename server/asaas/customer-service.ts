import { requestAsaas } from "./asaas-client";
import { SafeLogger } from "../utils/safe-logger";
import { AsaasCustomerLookupStatus } from "../contracts/asaas-contract";

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

export interface CustomerResolveResult {
  customerId: string;
  lookupStatus: AsaasCustomerLookupStatus;
  customerData: any;
}

export async function resolveAsaasCustomer(
  bossClientId: string,
  customerData: {
    name: string;
    cpfCnpj: string;
    email?: string;
    mobilePhone?: string;
    address?: {
      postalCode?: string;
      street?: string;
      number?: string;
      district?: string;
      complement?: string;
    };
  },
  savedCustomerId?: string
): Promise<CustomerResolveResult> {
  const cleanCpfCnpj = customerData.cpfCnpj.replace(/\D/g, "");
  const externalRef = `GC_CLIENT:${bossClientId}`;

  // 1. Try finding by saved customer ID
  if (savedCustomerId && savedCustomerId.trim() !== "") {
    try {
      SafeLogger.info(`Looking up Asaas customer by saved ID: ${savedCustomerId}`);
      const customer = await requestAsaas<AsaasCustomer>("GET", `/customers/${savedCustomerId}`);
      if (customer && customer.id) {
        SafeLogger.info(`Customer found by saved ID: ${customer.id}`);
        return {
          customerId: customer.id,
          lookupStatus: "FOUND_BY_SAVED_ID",
          customerData: customer,
        };
      }
    } catch (err: any) {
      SafeLogger.warn(`Saved customer ID ${savedCustomerId} lookup failed: ${err.message}. Moving to externalReference lookup.`);
    }
  }

  // 2. Try finding by externalReference
  try {
    SafeLogger.info(`Looking up Asaas customer by externalReference: ${externalRef}`);
    const listRes = await requestAsaas<{ data: AsaasCustomer[] }>(
      "GET",
      `/customers?externalReference=${encodeURIComponent(externalRef)}`
    );
    if (listRes.data && listRes.data.length > 0) {
      const customer = listRes.data[0];
      SafeLogger.info(`Customer found by externalReference: ${customer.id}`);
      return {
        customerId: customer.id,
        lookupStatus: "FOUND_BY_EXTERNAL_REFERENCE",
        customerData: customer,
      };
    }
  } catch (err: any) {
    SafeLogger.error(`Lookup by externalReference failed: ${err.message}`);
  }

  // 3. Try finding by document (CPF or CNPJ)
  try {
    SafeLogger.info(`Looking up Asaas customer by document: ${cleanCpfCnpj}`);
    const listRes = await requestAsaas<{ data: AsaasCustomer[] }>(
      "GET",
      `/customers?cpfCnpj=${cleanCpfCnpj}`
    );
    if (listRes.data && listRes.data.length > 0) {
      if (listRes.data.length > 1) {
        SafeLogger.warn(`Duplicate customers found in Asaas for document: ${cleanCpfCnpj}`);
        throw new Error("Foram encontrados cadastros duplicados deste cliente no ASAAS. É necessária conferência antes de gerar a cobrança.");
      }
      const customer = listRes.data[0];
      SafeLogger.info(`Customer found by document: ${customer.id}`);
      return {
        customerId: customer.id,
        lookupStatus: "FOUND_BY_DOCUMENT",
        customerData: customer,
      };
    }
  } catch (err: any) {
    if (err.message.includes("duplicados")) {
      throw err;
    }
    SafeLogger.error(`Lookup by document failed: ${err.message}`);
  }

  // 4. Create new customer
  try {
    SafeLogger.info(`No existing customer found. Creating new customer in Asaas with externalReference: ${externalRef}`);
    
    // Build payload. Remove properties that are empty or undefined
    const payload: Record<string, any> = {
      name: customerData.name.trim(),
      cpfCnpj: cleanCpfCnpj,
      externalReference: externalRef,
      notificationDisabled: true, // Required as per instructions
    };

    if (customerData.email && customerData.email.trim() !== "") {
      payload.email = customerData.email.trim();
    }
    if (customerData.mobilePhone && customerData.mobilePhone.trim() !== "") {
      payload.mobilePhone = customerData.mobilePhone.replace(/\D/g, "");
    }
    if (customerData.address) {
      if (customerData.address.postalCode) {
        payload.postalCode = customerData.address.postalCode.replace(/\D/g, "");
      }
      if (customerData.address.street && customerData.address.street.trim() !== "") {
        payload.address = customerData.address.street.trim();
      }
      if (customerData.address.number && customerData.address.number.toString().trim() !== "") {
        payload.addressNumber = customerData.address.number.toString().trim();
      }
      if (customerData.address.district && customerData.address.district.trim() !== "") {
        payload.province = customerData.address.district.trim();
      }
      if (customerData.address.complement && customerData.address.complement.trim() !== "") {
        payload.complement = customerData.address.complement.trim();
      }
    }

    const newCustomer = await requestAsaas<AsaasCustomer>("POST", "/customers", payload);
    SafeLogger.info(`Successfully created new customer in Asaas ID: ${newCustomer.id}`);
    
    return {
      customerId: newCustomer.id,
      lookupStatus: "CREATED",
      customerData: newCustomer,
    };
  } catch (err: any) {
    SafeLogger.error("Failed to create customer in Asaas:", err);
    throw new Error(`Não foi possível cadastrar o cliente no ASAAS: ${err.message}`);
  }
}
