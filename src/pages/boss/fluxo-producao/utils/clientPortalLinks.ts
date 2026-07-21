export interface PortalSettings {
  link?: string;
  portalExternalMode?: 'ai_studio_preview' | 'dominio_publicado';
  portalPublicDomain?: string;
}

export const DEFAULT_PORTAL_LINK = 'https://aistudio.google.com/apps/93c62126-a17f-4c18-8bc7-d327df1ca6b5?showPreview=true&showAssistant=true';

export function getClientInternalPath(slug: string): string {
  return `/portal-cliente-giffoni/${slug}/login`;
}

export function getClientExternalPortalBase(portalSettings?: PortalSettings): string {
  return portalSettings?.link || DEFAULT_PORTAL_LINK;
}

export function getClientPortalInstruction(slug: string, portalSettings?: PortalSettings): string {
  const mode = portalSettings?.portalExternalMode || 'ai_studio_preview';
  const internalPath = getClientInternalPath(slug);

  if (mode === 'ai_studio_preview') {
    return `Abra o app externo do Portal do Cliente e valide a rota interna ${internalPath}.`;
  }

  const baseDomain = portalSettings?.portalPublicDomain || 'https://clientes.giffoniconnect.com';
  const domainClean = baseDomain.endsWith('/') ? baseDomain.slice(0, -1) : baseDomain;
  return `${domainClean}${internalPath}`;
}
