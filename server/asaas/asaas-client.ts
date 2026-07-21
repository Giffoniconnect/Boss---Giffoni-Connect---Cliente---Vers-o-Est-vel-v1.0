import { SafeLogger } from "../utils/safe-logger";

export interface AsaasConfig {
  baseUrl: string;
  apiKey: string;
  environment: "sandbox" | "production";
}

export function getAsaasConfig(): AsaasConfig {
  const apiKey = process.env.ASAAS_API;

  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Secret ASAAS_API ausente ou ambiente não identificado.");
  }

  const trimmed = apiKey.trim();
  if (trimmed.startsWith("$aact_hmlg_")) {
    return {
      baseUrl: "https://api-sandbox.asaas.com/v3",
      apiKey: trimmed,
      environment: "sandbox",
    };
  } else if (trimmed.startsWith("$aact_prod_")) {
    return {
      baseUrl: "https://api.asaas.com/v3",
      apiKey: trimmed,
      environment: "production",
    };
  } else {
    throw new Error("Secret ASAAS_API ausente ou ambiente não identificado.");
  }
}

export async function requestAsaas<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: any,
  headersOverride?: Record<string, string>
): Promise<T> {
  const config = getAsaasConfig();
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "GiffoniConnect-Asaas/1.0",
    "access_token": config.apiKey,
    ...headersOverride,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    // Under 403 GET rules, do not send body on GET requests
    if (method !== "GET") {
      options.body = JSON.stringify(body);
    }
  }

  SafeLogger.info(`ASAAS HTTP REQUEST [${method}] to endpoint path: ${path}`);

  try {
    const response = await fetch(url, options);

    if (response.status === 401) {
      throw new Error("Não foi possível autenticar no ASAAS. Verifique o secret ASAAS_API e o ambiente configurado.");
    }

    if (!response.ok) {
      let errDetails = "";
      try {
        const errJson = await response.json();
        if (errJson.errors && Array.isArray(errJson.errors)) {
          errDetails = errJson.errors.map((e: any) => e.description).join(", ");
        } else {
          errDetails = JSON.stringify(errJson);
        }
      } catch {
        errDetails = await response.text();
      }
      
      const errMsg = `ASAAS API Error [Status ${response.status}]: ${errDetails}`;
      SafeLogger.error(errMsg);
      throw new Error(errDetails || `Erro ${response.status} na requisição ao ASAAS.`);
    }

    // Handle PDF or raw binary response
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/pdf")) {
      const buffer = await response.arrayBuffer();
      return buffer as any;
    }

    const json = await response.json();
    return json as T;
  } catch (error: any) {
    SafeLogger.error(`Failed during ASAAS HTTP REQUEST [${method}] to path: ${path}`, error);
    throw error;
  }
}
