export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateAsaasChargeInput(data: any): ValidationResult {
  const errors: string[] = [];

  // 1. Mode check
  const mode = data.charge?.mode;
  if (!["ONE_TIME", "INSTALLMENT", "SUBSCRIPTION"].includes(mode)) {
    errors.push("O tipo de cobrança (mode) deve ser ONE_TIME, INSTALLMENT ou SUBSCRIPTION.");
  }

  // 2. Value validation
  if (mode === "ONE_TIME") {
    const value = data.charge?.value;
    if (typeof value !== "number" || value <= 0) {
      errors.push("Para cobranças à vista, o valor deve ser maior que zero.");
    } else {
      const decimals = (value.toString().split(".")[1] || "").length;
      if (decimals > 2) {
        errors.push("O valor não pode ter mais de duas casas decimais.");
      }
    }
    
    // Due Date
    const dueDate = data.charge?.dueDate;
    if (!dueDate || isNaN(Date.parse(dueDate))) {
      errors.push("Data de vencimento inválida.");
    } else if (new Date(dueDate).setHours(23, 59, 59, 999) < new Date().setHours(0, 0, 0, 0)) {
      errors.push("A data de vencimento não pode ser anterior à data atual.");
    }
  }

  if (mode === "INSTALLMENT") {
    const totalValue = data.charge?.totalValue;
    if (typeof totalValue !== "number" || totalValue <= 0) {
      errors.push("Para parcelamentos, o valor total deve ser maior que zero.");
    } else {
      const decimals = (totalValue.toString().split(".")[1] || "").length;
      if (decimals > 2) {
        errors.push("O valor total não pode ter mais de duas casas decimais.");
      }
    }

    const installmentCount = data.charge?.installmentCount;
    if (typeof installmentCount !== "number" || !Number.isInteger(installmentCount) || installmentCount < 2) {
      errors.push("O número de parcelas deve ser um número inteiro igual ou superior a 2.");
    }

    // Due Date
    const firstDueDate = data.charge?.firstDueDate;
    if (!firstDueDate || isNaN(Date.parse(firstDueDate))) {
      errors.push("Data do primeiro vencimento inválida.");
    } else if (new Date(firstDueDate).setHours(23, 59, 59, 999) < new Date().setHours(0, 0, 0, 0)) {
      errors.push("A data do primeiro vencimento não pode ser anterior à data atual.");
    }
  }

  if (mode === "SUBSCRIPTION") {
    const valuePerCycle = data.charge?.valuePerCycle;
    if (typeof valuePerCycle !== "number" || valuePerCycle <= 0) {
      errors.push("Para assinaturas, o valor da mensalidade deve ser maior que zero.");
    } else {
      const decimals = (valuePerCycle.toString().split(".")[1] || "").length;
      if (decimals > 2) {
        errors.push("O valor da mensalidade não pode ter mais de duas casas decimais.");
      }
    }

    // Due Date
    const nextDueDate = data.charge?.nextDueDate;
    if (!nextDueDate || isNaN(Date.parse(nextDueDate))) {
      errors.push("Data da primeira cobrança inválida.");
    } else if (new Date(nextDueDate).setHours(23, 59, 59, 999) < new Date().setHours(0, 0, 0, 0)) {
      errors.push("A data da primeira cobrança não pode ser anterior à data atual.");
    }
  }

  // 3. Description
  const description = data.charge?.description;
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    errors.push("A descrição da cobrança é obrigatória.");
  } else if (description.length > 255) {
    errors.push("A descrição não deve exceder 255 caracteres.");
  }

  // 4. Customer details
  const customer = data.customer;
  if (!customer) {
    errors.push("Dados do cliente são obrigatórios.");
  } else {
    const name = customer.name;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      errors.push("O nome do cliente é obrigatório.");
    }

    const cpfCnpj = customer.cpfCnpj ? customer.cpfCnpj.replace(/\D/g, "") : "";
    if (!cpfCnpj) {
      errors.push("CPF ou CNPJ do cliente é obrigatório.");
    } else if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      errors.push("O documento do cliente deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ).");
    }

    if (customer.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customer.email)) {
        errors.push("E-mail com formato inválido.");
      }
    }

    if (customer.mobilePhone) {
      const phoneDigits = customer.mobilePhone.replace(/\D/g, "");
      if (phoneDigits.length < 10) {
        errors.push("O número de celular/telefone informado deve ter no mínimo 10 dígitos (com DDD).");
      }
    }

    if (customer.address?.postalCode) {
      const cepDigits = customer.address.postalCode.replace(/\D/g, "");
      if (cepDigits.length !== 8) {
        errors.push("O CEP deve conter exatamente 8 dígitos.");
      }
    }
  }

  // 5. Drive destination
  const destinationDriveFolderId = data.source?.destinationDriveFolderId;
  if (!destinationDriveFolderId || typeof destinationDriveFolderId !== "string" || destinationDriveFolderId.trim().length === 0) {
    errors.push("A pasta de destino do Google Drive é obrigatória.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
