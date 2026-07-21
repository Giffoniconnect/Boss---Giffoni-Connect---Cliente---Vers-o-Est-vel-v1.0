export const OFFICE_WHATSAPP_NUMBER = "5531988639056";

export function normalizeWhatsAppNumber(phone: string): string {
  if (!phone) return "";
  // Remover tudo que não for número
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55')) {
    return cleaned;
  }
  if (cleaned.length === 10 || cleaned.length === 11) {
    return '55' + cleaned;
  }
  return cleaned;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const normalized = normalizeWhatsAppNumber(phone);
  if (!normalized) return "";
  const encodedMsg = message ? encodeURIComponent(message) : "";
  return `https://wa.me/${normalized}${encodedMsg ? `?text=${encodedMsg}` : ""}`;
}

export function buildOfficeWhatsAppLink(message: string): string {
  return buildWhatsAppLink(OFFICE_WHATSAPP_NUMBER, message);
}

interface ManualDocumentDeliveryParams {
  clientName: string;
  documentLabel: string;
  documentUrl: string;
  instructions?: string;
}

export function buildManualDocumentDeliveryMessage({
  clientName,
  documentLabel,
  documentUrl,
  instructions
}: ManualDocumentDeliveryParams): string {
  const greeting = `Olá, ${clientName}.\n\nSegue o link para acessar ${documentLabel}:\n\n${documentUrl}`;
  if (instructions) {
    return `${greeting}\n\n${instructions}`;
  }
  return `${greeting}\n\nPor favor, confira, assine e nos envie o documento assinado.`;
}

interface ManualDocumentDeliveryWhatsAppParams extends ManualDocumentDeliveryParams {
  phone: string;
}

export function buildManualDocumentDeliveryWhatsAppLink({
  phone,
  clientName,
  documentLabel,
  documentUrl,
  instructions
}: ManualDocumentDeliveryWhatsAppParams): string {
  const message = buildManualDocumentDeliveryMessage({
    clientName,
    documentLabel,
    documentUrl,
    instructions
  });
  return buildWhatsAppLink(phone, message);
}
