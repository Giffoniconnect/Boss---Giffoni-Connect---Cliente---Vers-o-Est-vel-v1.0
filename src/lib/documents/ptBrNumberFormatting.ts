/**
 * Brazilian Portuguese Formatting Utilities for the Document Engine.
 * Follows strict financial calculation guidelines using centavos (integers) to avoid floating-point errors.
 */

/**
 * Safely parses a Brazilian Real currency string or number into an integer representing centavos.
 * Handles formats like "R$ 1.500,00", "1500,00", "1500.00", "1.500", or raw numbers.
 */
export function parseCurrencyToCents(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") {
    // If it's a number, convert to cents and round to avoid float issues
    return Math.round(val * 100);
  }
  
  const str = String(val).trim();
  if (!str) return 0;

  // Clean the currency symbol and extra spaces
  let cleanStr = str
    .replace(/R\$\s*/gi, "")
    .replace(/\s/g, "");

  if (!cleanStr) return 0;

  // Check Brazilian format: e.g. "1.500,34"
  if (cleanStr.includes(",")) {
    // Remove all thousands separator dots, replace comma with dot for standard parse
    const normalized = cleanStr.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100);
  } else {
    // Check if it's already standard float or integer: "1500.34" or "1500"
    // Note: if someone enters "1.500" meaning one thousand five hundred but forgot decimals,
    // let's check if there is a dot. If there is a dot followed by 3 digits, e.g. "1.500", "10.000",
    // without a comma, in Brazil this is usually thousands. Let's check for that edge case!
    const dotIndex = cleanStr.indexOf(".");
    if (dotIndex !== -1 && cleanStr.length - dotIndex - 1 === 3) {
      // It's likely a thousands separator (e.g., "1.500" or "10.000")
      // Remove the dot
      const parsed = parseFloat(cleanStr.replace(/\./g, ""));
      return isNaN(parsed) ? 0 : Math.round(parsed * 100);
    }
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100);
  }
}

/**
 * Formats centavos (integer) into Brazilian Real string: R$ X.XXX,XX
 */
export function formatCurrency(cents: number): string {
  if (isNaN(cents)) return "R$ 0,00";
  const reais = cents / 100;
  return reais.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

/**
 * Formats a percentage value nicely, appending "%" if not present.
 */
export function formatPercentage(val: any): string {
  if (val === undefined || val === null) return "0%";
  const str = String(val).trim();
  if (!str) return "0%";
  if (str.endsWith("%")) return str;
  // If it's a number or numeric string
  const num = parseFloat(str.replace(",", "."));
  if (isNaN(num)) return str;
  return `${num}%`.replace(".", ",");
}

/**
 * Helper to write a number out in Portuguese words (por extenso).
 * Supports numbers up to 999.999.999.
 */
function numberToWordsPtBr(num: number): string {
  if (num === 0) return "zero";

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const dezenasMenores = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function convertGroup(n: number): string {
    let output = "";
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) {
      if (c === 1 && d === 0 && u === 0) {
        output += "cem";
      } else {
        output += centenas[c];
      }
    }

    if (d > 0 || u > 0) {
      if (output) output += " e ";
      if (d === 1) {
        output += dezenasMenores[u];
      } else {
        if (d > 1) {
          output += dezenas[d];
          if (u > 0) output += " e " + unidades[u];
        } else if (u > 0) {
          output += unidades[u];
        }
      }
    }

    return output;
  }

  let words = "";
  const milhoes = Math.floor(num / 1000000);
  const milhares = Math.floor((num % 1000000) / 1000);
  const unidadesResto = num % 1000;

  if (milhoes > 0) {
    words += convertGroup(milhoes) + (milhoes === 1 ? " milhão" : " milhões");
  }

  if (milhares > 0) {
    if (words) {
      // Connect million to thousands
      words += (unidadesResto === 0 ? " e " : ", ");
    }
    // "um mil" vs "mil"
    if (milhares === 1) {
      words += "um mil";
    } else {
      words += convertGroup(milhares) + " mil";
    }
  }

  if (unidadesResto > 0) {
    if (words) {
      // If we have a clean hundred or just tens/units, use "e"
      const needsAnd = unidadesResto < 100 || unidadesResto % 100 === 0;
      words += needsAnd ? " e " : ", ";
    }
    words += convertGroup(unidadesResto);
  }

  return words;
}

/**
 * Formats a centavos value to Portuguese words (por extenso).
 * Example: 150000 -> "um mil e quinhentos reais"
 * Example: 150050 -> "um mil e quinhentos reais e cinquenta centavos"
 */
export function formatCurrencyInWords(cents: number): string {
  if (cents <= 0) return "zero reais";

  const totalReais = Math.floor(cents / 100);
  const totalCents = cents % 100;

  let words = "";

  if (totalReais > 0) {
    const reaisWords = numberToWordsPtBr(totalReais);
    words += reaisWords + (totalReais === 1 ? " real" : " reais");
  }

  if (totalCents > 0) {
    if (words) words += " e ";
    const centsWords = numberToWordsPtBr(totalCents);
    words += centsWords + (totalCents === 1 ? " centavo" : " centavos");
  }

  return words;
}
