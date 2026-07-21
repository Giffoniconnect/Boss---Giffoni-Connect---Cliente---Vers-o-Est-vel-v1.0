import { requestAsaas } from "./asaas-client";
import { SafeLogger } from "../utils/safe-logger";

export interface AsaasNotification {
  id: string;
  customer: string;
  event: string;
  enabled: boolean;
}

export async function disableAllCustomerNotifications(customerId: string): Promise<void> {
  SafeLogger.info(`Retrieving notifications for customer ID: ${customerId}`);
  
  try {
    const listRes = await requestAsaas<{ data: AsaasNotification[] }>(
      "GET",
      `/notifications?customer=${customerId}`
    );

    const notifications = listRes.data || [];
    SafeLogger.info(`Found ${notifications.length} notifications for customer ID: ${customerId}`);

    // If there are no notifications, that's fine (perhaps none configured, or all cleared)
    if (notifications.length === 0) {
      SafeLogger.info(`No notifications found to disable for customer ID: ${customerId}`);
      return;
    }

    // Disable each notification individually using its real ID
    for (const notification of notifications) {
      SafeLogger.info(`Disabling notification ID: ${notification.id} for customer ID: ${customerId}`);
      
      const payload = {
        enabled: false,
        emailEnabledForCustomer: false,
        smsEnabledForCustomer: false,
        phoneCallEnabledForCustomer: false,
        whatsappEnabledForCustomer: false,
        emailEnabledForProvider: false,
        smsEnabledForProvider: false
      };

      await requestAsaas("POST", `/notifications/${notification.id}`, payload);
      SafeLogger.info(`Successfully disabled notification ID: ${notification.id}`);
    }

    SafeLogger.info(`All ${notifications.length} notifications disabled successfully for customer ID: ${customerId}`);
  } catch (err: any) {
    SafeLogger.error(`Failed to disable notifications for customer ID: ${customerId}`, err);
    throw new Error(`Não foi possível confirmar a desativação das notificações do cliente no ASAAS. A cobrança não foi criada para evitar envio automático indesejado.`);
  }
}
