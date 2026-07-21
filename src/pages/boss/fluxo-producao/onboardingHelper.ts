export interface ClientOnboardingData {
  name: string;
  phone: string;
  hasWhatsapp: boolean;
  instagram: string;
  facebook: string;
  tiktok: string;
  email: string;
  phoneNotOwned: boolean;
  instagramNotOwned: boolean;
  facebookNotOwned: boolean;
  tiktokNotOwned: boolean;
  emailNotOwned: boolean;
}

export type OnboardingStepStatus =
  | 'available'
  | 'pending'
  | 'in_progress'
  | 'awaiting_human_confirmation'
  | 'completed'
  | 'dispensed_not_owned'
  | 'dispensed_no_channel'
  | 'blocked_missing_data'
  | 'failed';

export interface OnboardingStepPlan {
  id: number;
  name: string;
  route: string;
  status: OnboardingStepStatus;
  reason?: string;
  technicalStatus?: 'completed' | 'pending' | 'failed' | 'not_applicable';
  humanCertified?: boolean;
}

export function extractClientOnboardingFields(client: any): ClientOnboardingData {
  if (!client) {
    return {
      name: '',
      phone: '',
      hasWhatsapp: false,
      instagram: '',
      facebook: '',
      tiktok: '',
      email: '',
      phoneNotOwned: false,
      instagramNotOwned: false,
      facebookNotOwned: false,
      tiktokNotOwned: false,
      emailNotOwned: false,
    };
  }

  const isPj = client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true;

  const name = isPj
    ? (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || client.name || '')
    : (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || client.name || '');

  const phone = isPj
    ? (client.pjDadosEmpresa?.pj_telefoneEmpresa || client.pjData?.pj_telefoneEmpresa || client.pjDadosEmpresa?.pj_telefoneRepresentante || client.pjData?.pj_telefoneRepresentante || client.phone || '')
    : (client.pfDadosPessoais?.pf_telefoneCelular || client.pfData?.pf_telefoneCelular || client.phone || '');

  const hasWhatsapp = isPj
    ? (client.pjDadosEmpresa?.pj_possuiWhatsappEmpresa === true || client.pjData?.pj_possuiWhatsappEmpresa === true || client.pj_possuiWhatsappEmpresa === true || client.possuiWhatsApp === true)
    : (client.pfContato?.pf_possuiWhatsapp === true || client.pfData?.pf_possuiWhatsapp === true || client.pf_possuiWhatsapp === true || client.possuiWhatsApp === true);

  const instagram = isPj
    ? (client.pjDadosEmpresa?.pj_instagramEmpresa || client.pjData?.pj_instagramEmpresa || client.pj_instagramEmpresa || '')
    : (client.pfDadosPessoais?.pf_instagram || client.pfData?.pf_instagram || client.pf_instagram || '');

  const facebook = isPj
    ? (client.pjDadosEmpresa?.pj_facebookEmpresa || client.pjData?.pj_facebookEmpresa || client.pj_facebookEmpresa || '')
    : (client.pfDadosPessoais?.pf_facebook || client.pfData?.pf_facebook || client.pf_facebook || '');

  const tiktok = isPj
    ? (client.pjDadosEmpresa?.pj_tiktokEmpresa || client.pjData?.pj_tiktokEmpresa || client.pj_tiktokEmpresa || '')
    : (client.pfDadosPessoais?.pf_tiktok || client.pfData?.pf_tiktok || client.pf_tiktok || '');

  const email = isPj
    ? (client.pjDadosEmpresa?.pj_emailEmpresa || client.pjData?.pj_emailEmpresa || client.email || '')
    : (client.pfDadosPessoais?.pf_email || client.pfData?.pf_email || client.email || '');

  const phoneNotOwned = phone === 'Não possuo' || client.phoneNotOwned === true;
  const instagramNotOwned = instagram === 'Não possuo' || client.instagramNotOwned === true;
  const facebookNotOwned = facebook === 'Não possuo' || client.facebookNotOwned === true;
  const tiktokNotOwned = tiktok === 'Não possuo' || client.tiktokNotOwned === true;
  const emailNotOwned = email === 'Não possuo' || client.emailNotOwned === true;

  return {
    name,
    phone,
    hasWhatsapp,
    instagram,
    facebook,
    tiktok,
    email,
    phoneNotOwned,
    instagramNotOwned,
    facebookNotOwned,
    tiktokNotOwned,
    emailNotOwned,
  };
}

export function buildOnboardingExecutionPlan(clientData: ClientOnboardingData, onboardingState: any): OnboardingStepPlan[] {
  const onb = onboardingState || {};
  
  // Step 1: Google Contacts
  const gcState = onb.googleContacts || {};
  let step1Status: OnboardingStepStatus = 'available';
  let step1Reason = '';
  
  if (clientData.phoneNotOwned || clientData.phone === 'Não possuo') {
    step1Status = 'dispensed_not_owned';
    step1Reason = 'Telefone formalmente registrado como inexistente.';
  } else if (!clientData.name || !clientData.phone || clientData.phone.trim() === '') {
    step1Status = 'blocked_missing_data';
    step1Reason = 'Telefone está vazio e não marcado como "Não possuo".';
  } else if (gcState.status === 'completed' && gcState.humanCertified) {
    step1Status = 'completed';
  } else if (gcState.status === 'completed' && !gcState.humanCertified) {
    step1Status = 'awaiting_human_confirmation';
  } else if (gcState.status === 'failed') {
    step1Status = 'failed';
  }

  // Step 2: Welcome WhatsApp
  const wzState = onb.welcomeZap || {};
  let step2Status: OnboardingStepStatus = 'available';
  let step2Reason = '';

  if (clientData.phoneNotOwned || clientData.phone === 'Não possuo' || !clientData.hasWhatsapp) {
    step2Status = 'dispensed_not_owned';
    step2Reason = 'Cliente não possui WhatsApp ou telefone inexistente.';
  } else if (!clientData.phone || clientData.phone.trim() === '') {
    step2Status = 'blocked_missing_data';
    step2Reason = 'Telefone do cliente é obrigatório para WhatsApp.';
  } else if (wzState.status === 'completed' && wzState.humanCertified) {
    step2Status = 'completed';
  } else if (wzState.status === 'completed' && !wzState.humanCertified) {
    step2Status = 'awaiting_human_confirmation';
  } else if (wzState.status === 'failed') {
    step2Status = 'failed';
  }

  // Step 3: Instagram
  const instState = onb.instagram || {};
  let step3Status: OnboardingStepStatus = 'available';
  let step3Reason = '';

  if (clientData.instagramNotOwned || clientData.instagram === 'Não possuo') {
    step3Status = 'dispensed_not_owned';
    step3Reason = 'Instagram formalmente registrado como inexistente.';
  } else if (!clientData.instagram || clientData.instagram.trim() === '') {
    step3Status = 'blocked_missing_data';
    step3Reason = 'Instagram está vazio e não marcado como "Não possuo".';
  } else if (instState.status === 'completed' && instState.humanCertified) {
    step3Status = 'completed';
  } else if (instState.status === 'completed' && !instState.humanCertified) {
    step3Status = 'awaiting_human_confirmation';
  } else if (instState.status === 'failed') {
    step3Status = 'failed';
  }

  // Step 4: Facebook
  const fbState = onb.facebook || {};
  let step4Status: OnboardingStepStatus = 'available';
  let step4Reason = '';

  if (clientData.facebookNotOwned || clientData.facebook === 'Não possuo') {
    step4Status = 'dispensed_not_owned';
    step4Reason = 'Facebook formalmente registrado como inexistente.';
  } else if (!clientData.facebook || clientData.facebook.trim() === '') {
    step4Status = 'blocked_missing_data';
    step4Reason = 'Facebook está vazio e não marcado como "Não possuo".';
  } else if (fbState.status === 'completed' && fbState.humanCertified) {
    step4Status = 'completed';
  } else if (fbState.status === 'completed' && !fbState.humanCertified) {
    step4Status = 'awaiting_human_confirmation';
  } else if (fbState.status === 'failed') {
    step4Status = 'failed';
  }

  // Step 5: TikTok
  const tkState = onb.tiktok || {};
  let step5Status: OnboardingStepStatus = 'available';
  let step5Reason = '';

  if (clientData.tiktokNotOwned || clientData.tiktok === 'Não possuo') {
    step5Status = 'dispensed_not_owned';
    step5Reason = 'TikTok formalmente registrado como inexistente.';
  } else if (!clientData.tiktok || clientData.tiktok.trim() === '') {
    step5Status = 'blocked_missing_data';
    step5Reason = 'TikTok está vazio e não marcado como "Não possuo".';
  } else if (tkState.status === 'completed' && tkState.humanCertified) {
    step5Status = 'completed';
  } else if (tkState.status === 'completed' && !tkState.humanCertified) {
    step5Status = 'awaiting_human_confirmation';
  } else if (tkState.status === 'failed') {
    step5Status = 'failed';
  }

  // Step 6: Welcome Email
  const emState = onb.email || {};
  let step6Status: OnboardingStepStatus = 'available';
  let step6Reason = '';

  if (clientData.emailNotOwned || clientData.email === 'Não possuo') {
    step6Status = 'dispensed_not_owned';
    step6Reason = 'E-mail formalmente registrado como inexistente.';
  } else if (!clientData.email || clientData.email.trim() === '') {
    step6Status = 'blocked_missing_data';
    step6Reason = 'E-mail está vazio e não marcado como "Não possuo".';
  } else if (emState.status === 'completed' && emState.humanCertified) {
    step6Status = 'completed';
  } else if (emState.status === 'completed' && !emState.humanCertified) {
    step6Status = 'awaiting_human_confirmation';
  } else if (emState.status === 'failed') {
    step6Status = 'failed';
  }

  // Step 7: AvaliaCard
  const acState = onb.avaliacard || {};
  let step7Status: OnboardingStepStatus = 'available';
  let step7Reason = '';

  const hasNoWhatsapp = clientData.phoneNotOwned || clientData.phone === 'Não possuo' || !clientData.hasWhatsapp || !clientData.phone || clientData.phone.trim() === '';
  const hasNoEmail = clientData.emailNotOwned || clientData.email === 'Não possuo' || !clientData.email || clientData.email.trim() === '';

  if (hasNoWhatsapp && hasNoEmail) {
    step7Status = 'dispensed_no_channel';
    step7Reason = 'Sem canais de envio válidos (WhatsApp ou E-mail).';
  } else if (acState.status === 'completed' && acState.humanCertified) {
    step7Status = 'completed';
  } else if (acState.status === 'completed' && !acState.humanCertified) {
    step7Status = 'awaiting_human_confirmation';
  } else if (acState.status === 'failed') {
    step7Status = 'failed';
  }

  // Step 8: Auditoria do Onboarding
  const audState = onb.auditoria || {};
  let step8Status: OnboardingStepStatus = 'available';
  let step8Reason = '';

  if (audState.status === 'completed') {
    step8Status = 'completed';
  }

  return [
    {
      id: 1,
      name: 'Subetapa 01 — Adicionar telefone celular automaticamente',
      route: 'add.telefone.do.cliente',
      status: step1Status,
      reason: step1Reason,
      technicalStatus: gcState.status || 'pending',
      humanCertified: gcState.humanCertified || false,
    },
    {
      id: 2,
      name: 'Subetapa 02 — Boas-vindas via W.A Speed',
      route: 'welcome.zap',
      status: step2Status,
      reason: step2Reason,
      technicalStatus: wzState.status || 'pending',
      humanCertified: wzState.humanCertified || false,
    },
    {
      id: 3,
      name: 'Subetapa 03 — Adicionar cliente no Instagram',
      route: 'add.cliente.no.instagram',
      status: step3Status,
      reason: step3Reason,
      technicalStatus: instState.status || 'pending',
      humanCertified: instState.humanCertified || false,
    },
    {
      id: 4,
      name: 'Subetapa 04 — Adicionar cliente no Facebook',
      route: 'add.cliente.no.facebook',
      status: step4Status,
      reason: step4Reason,
      technicalStatus: fbState.status || 'pending',
      humanCertified: fbState.humanCertified || false,
    },
    {
      id: 5,
      name: 'Subetapa 05 — Adicionar cliente no TikTok',
      route: 'add.cliente.no.tiktok',
      status: step5Status,
      reason: step5Reason,
      technicalStatus: tkState.status || 'pending',
      humanCertified: tkState.humanCertified || false,
    },
    {
      id: 6,
      name: 'Subetapa 06 — E-mail de boas-vindas',
      route: 'enviar.email.cliente',
      status: step6Status,
      reason: step6Reason,
      technicalStatus: emState.status || 'pending',
      humanCertified: emState.humanCertified || false,
    },
    {
      id: 7,
      name: 'Subetapa 07 — AvaliaCard: avaliação do Google',
      route: 'avaliacard',
      status: step7Status,
      reason: step7Reason,
      technicalStatus: acState.status || 'pending',
      humanCertified: acState.humanCertified || false,
    },
    {
      id: 8,
      name: 'Subetapa 08 — Auditoria do Onboarding',
      route: 'auditoria.onboarding.cliente',
      status: step8Status,
      reason: step8Reason,
      technicalStatus: audState.status || 'pending',
      humanCertified: audState.status === 'completed',
    },
  ];
}
