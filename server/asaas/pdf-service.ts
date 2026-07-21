import { requestAsaas } from "./asaas-client";
import { SafeLogger } from "../utils/safe-logger";

export async function downloadAsaasPdf(
  mode: "ONE_TIME" | "INSTALLMENT" | "SUBSCRIPTION",
  ids: { paymentId?: string; installmentId?: string; subscriptionId?: string; bankSlipUrl?: string }
): Promise<Buffer> {
  SafeLogger.info(`Downloading PDF for mode ${mode}`, ids);

  try {
    if (mode === "ONE_TIME") {
      if (ids.bankSlipUrl) {
        SafeLogger.info(`Downloading payment slip from public URL: ${ids.bankSlipUrl}`);
        const res = await fetch(ids.bankSlipUrl);
        if (!res.ok) {
          throw new Error(`Failed to download public bank slip: Status ${res.status}`);
        }
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } else if (ids.paymentId) {
        // Fallback to fetch bank slip via payments API if URL is missing
        SafeLogger.info(`Downloading bank slip from payments API: /payments/${ids.paymentId}/bankSlip`);
        const arrayBuffer = await requestAsaas<ArrayBuffer>("GET", `/payments/${ids.paymentId}/bankSlip`, undefined, {
          Accept: "application/pdf",
        });
        return Buffer.from(arrayBuffer);
      }
      throw new Error("ONE_TIME mode requires bankSlipUrl or paymentId to download PDF.");
    }

    if (mode === "INSTALLMENT") {
      if (!ids.installmentId) {
        throw new Error("INSTALLMENT mode requires installmentId to download paymentBook.");
      }
      SafeLogger.info(`Downloading installment payment book (carnê) for ID: ${ids.installmentId}`);
      const arrayBuffer = await requestAsaas<ArrayBuffer>("GET", `/installments/${ids.installmentId}/paymentBook`, undefined, {
        Accept: "application/pdf",
      });
      return Buffer.from(arrayBuffer);
    }

    if (mode === "SUBSCRIPTION") {
      if (!ids.subscriptionId) {
        throw new Error("SUBSCRIPTION mode requires subscriptionId to download paymentBook.");
      }
      SafeLogger.info(`Downloading subscription payment book (carnê) for ID: ${ids.subscriptionId}`);
      const arrayBuffer = await requestAsaas<ArrayBuffer>("GET", `/subscriptions/${ids.subscriptionId}/paymentBook`, undefined, {
        Accept: "application/pdf",
      });
      return Buffer.from(arrayBuffer);
    }

    throw new Error(`Unsupported mode for PDF download: ${mode}`);
  } catch (err: any) {
    SafeLogger.error("Error downloading Asaas PDF", err);
    throw new Error(`Falha ao obter o PDF de cobrança do ASAAS: ${err.message}`);
  }
}
