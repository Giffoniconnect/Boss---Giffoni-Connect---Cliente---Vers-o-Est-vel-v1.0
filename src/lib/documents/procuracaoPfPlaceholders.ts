/**
 * Builds placeholders Map for the Procuracao PF document generation.
 * LOGS PREFIX CODE: PORTAL_PROC_PF_PLACEHOLDERS_BUILT
 */
import { buildProcuracaoPfPlaceholders as unifiedBuild, PROCURACAO_PF_REQUIRED_PLACEHOLDERS } from './placeholderBuilders';

export { PROCURACAO_PF_REQUIRED_PLACEHOLDERS };

export function buildProcuracaoPfPlaceholders(client: any): Record<string, string> {
  return unifiedBuild(client);
}

