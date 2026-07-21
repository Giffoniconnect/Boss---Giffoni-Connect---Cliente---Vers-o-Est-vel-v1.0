export function sanitizeNameForSlug(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD') // splits combined characters into letters and diacritics
    .replace(/[\u0300-\u036f]/g, '') // removes diacritics
    .replace(/[^a-z0-9\s-]/g, '') // removes special characters
    .trim()
    .replace(/\s+/g, '-') // replaces spaces with hyphens
    .replace(/-+/g, '-'); // collapses multiple hyphens
}

export function createShortHashFromDocument(document: string): string {
  const clean = document.replace(/\D/g, '');
  if (!clean) return 'xxxxxx';
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(6, '0').slice(0, 6);
}

export function generateSafeClientSlug(name: string, type: string, document: string): string {
  const cleanNameSlug = sanitizeNameForSlug(name);
  const typeSuffix = type.toLowerCase() === 'pj' ? 'pj' : 'pf';
  const docHash = createShortHashFromDocument(document);
  return `${cleanNameSlug}-${typeSuffix}-${docHash}`;
}
