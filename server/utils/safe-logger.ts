export function maskCPF(cpf: string): string {
  if (!cpf) return "";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return "***.***.***-00";
  return `***.***.***-${cleaned.substring(9)}`;
}

export function maskCNPJ(cnpj: string): string {
  if (!cnpj) return "";
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return "**.***.***/****-00";
  return `**.***.***/****-${cleaned.substring(12)}`;
}

export function maskCpfCnpj(val: string): string {
  if (!val) return "";
  const cleaned = val.replace(/\D/g, "");
  if (cleaned.length <= 11) {
    return maskCPF(cleaned);
  }
  return maskCNPJ(cleaned);
}

export function maskEmail(email: string): string {
  if (!email) return "";
  const parts = email.split("@");
  if (parts.length !== 2) return "e***@domain.com";
  const name = parts[0];
  const domain = parts[1];
  const firstChar = name.charAt(0);
  return `${firstChar}***@${domain}`;
}

export function maskPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 4) return "(**) *****-0000";
  const lastFour = cleaned.substring(cleaned.length - 4);
  return `(**) *****-${lastFour}`;
}

export function sanitizeErrorMessage(message: string): string {
  if (!message) return "";
  // Ensure the access token or api key is never printed
  let sanitized = message;
  if (process.env.ASAAS_API) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(process.env.ASAAS_API), "g"), "[ASAAS_API_REDACTED]");
  }
  return sanitized;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export class SafeLogger {
  static info(message: string, context?: any) {
    console.log(`[INFO] [ASAAS_INTEGRATION] ${message}`, context ? JSON.stringify(this.sanitizeContext(context)) : "");
  }

  static warn(message: string, context?: any) {
    console.warn(`[WARN] [ASAAS_INTEGRATION] ${message}`, context ? JSON.stringify(this.sanitizeContext(context)) : "");
  }

  static error(message: string, error?: any, context?: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `[ERROR] [ASAAS_INTEGRATION] ${message} - Error: ${sanitizeErrorMessage(errorMsg)}`,
      context ? JSON.stringify(this.sanitizeContext(context)) : ""
    );
  }

  private static sanitizeContext(context: any): any {
    if (!context || typeof context !== "object") return context;
    const sanitized = { ...context };

    // Redact sensitive keys
    const keysToRedact = ["access_token", "apiKey", "secret", "password", "token", "ASAAS_API", "Authorization"];
    for (const key of Object.keys(sanitized)) {
      if (keysToRedact.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
        sanitized[key] = "[REDACTED]";
      } else if (key === "cpfCnpj" || key === "cpf" || key === "cnpj") {
        sanitized[key] = maskCpfCnpj(sanitized[key]);
      } else if (key === "email") {
        sanitized[key] = maskEmail(sanitized[key]);
      } else if (key === "mobilePhone" || key === "phone" || key === "telephone") {
        sanitized[key] = maskPhone(sanitized[key]);
      } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeContext(sanitized[key]);
      }
    }
    return sanitized;
  }
}
