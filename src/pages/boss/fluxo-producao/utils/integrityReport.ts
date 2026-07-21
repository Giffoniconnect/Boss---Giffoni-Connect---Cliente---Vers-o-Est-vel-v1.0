export interface IntegrityItem {
  section: string;
  label: string;
  status: 'OK' | 'Atenção' | 'Pendente' | 'Erro Crítico';
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface IntegrityResult {
  generatedAt: string;
  result: 'Pronto para deploy' | 'Pronto com ressalvas' | 'Não recomendado para deploy';
  items: IntegrityItem[];
  okCount: number;
  attentionCount: number;
  pendingCount: number;
  criticalCount: number;
}

export function buildIntegrityReport(
  caseObj: any,
  client: any,
  portal: any,
  user: any,
  invite: any,
  infoRequests: any[],
  evidenceRequests: any[],
  financials: any[],
  connectors: any
): IntegrityResult {
  const items: IntegrityItem[] = [];

  // 1. Cliente
  if (!client) {
    items.push({
      section: 'Cliente',
      label: 'Existência do Documento de Cliente',
      status: 'Erro Crítico',
      details: 'O documento correspondente na coleção "clients" não foi localizado ou o ID atribuído ao Caso está corrompido.',
      severity: 'critical'
    });
  } else {
    items.push({
      section: 'Cliente',
      label: 'Existência de Vínculo',
      status: 'OK',
      details: 'Cadastro de Cliente ativo e vinculado corretamente ao prontuário do Caso.',
      severity: 'low'
    });

    const isPf = client.type === 'PF';
    const clientName = isPf
      ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto)
      : (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial);

    if (!clientName || clientName.trim() === '') {
      items.push({
        section: 'Cliente',
        label: 'Nome ou Razão Social preenchidos',
        status: 'Erro Crítico',
        details: 'O nome (Pessoa Física) ou a Razão Social (Pessoa Jurídica) do cliente está vazio no banco de dados.',
        severity: 'critical'
      });
    } else {
      items.push({
        section: 'Cliente',
        label: 'Nome / Razão Social preenchidos',
        status: 'OK',
        details: `Identificação fática válida: [${clientName}].`,
        severity: 'low'
      });
    }

    const docNum = isPf
      ? (client.pfDadosPessoais?.pf_cpf || client.pfData?.pf_cpf)
      : (client.pjDadosEmpresa?.pj_cnpj || client.pjData?.pj_cnpj);

    if (!docNum || docNum.trim() === '') {
      items.push({
        section: 'Cliente',
        label: 'CPF ou CNPJ preenchido',
        status: 'Atenção',
        details: 'CPF ou CNPJ não localizado no perfil do cliente. Necessário para regularização fiscal e judicial futura.',
        severity: 'medium'
      });
    } else {
      items.push({
        section: 'Cliente',
        label: 'Documentação Primária (CPF/CNPJ)',
        status: 'OK',
        details: `Identificação tributária informada: [${docNum}].`,
        severity: 'low'
      });
    }

    const contact = isPf
      ? (client.pfDadosPessoais?.pf_celular || client.pfDadosPessoais?.pf_email || client.pfData?.pf_email)
      : (client.pjDadosResponsavel?.pj_whatsappResponsavel || client.pjDadosEmpresa?.pj_emailCorporativo);

    if (!contact) {
      items.push({
        section: 'Cliente',
        label: 'Dados de Contato e Comunicação',
        status: 'Atenção',
        details: 'Nenhum celular, whatsapp ou e-mail corporativo localizado para envio fático de notificações automáticas.',
        severity: 'medium'
      });
    } else {
      items.push({
        section: 'Cliente',
        label: 'Dados de Contato e Comunicação',
        status: 'OK',
        details: 'Presença de dados de comunicação primários no perfil cadastral.',
        severity: 'low'
      });
    }

    // New Check 1: Cadastro Incompleto Check
    if (client.cadastroIncompleto === true) {
      const missingList = Array.isArray(client.missingFields) ? client.missingFields : [];
      items.push({
        section: 'Cliente',
        label: 'Integridade dos Campos Cadastrais',
        status: 'Atenção',
        details: `O cadastro do cliente está incompleto. Campos pendentes: ${missingList.length > 0 ? missingList.join(', ') : 'dados não preenchidos'}.`,
        severity: 'medium'
      });
    } else {
      items.push({
        section: 'Cliente',
        label: 'Integridade dos Campos Cadastrais',
        status: 'OK',
        details: 'Todos os campos cadastrais obrigatórios preenchidos com sucesso.',
        severity: 'low'
      });
    }

    // New Check 2: Portal Status & Visibility Coordination
    const portStat = client.portalStatus || 'nao_criado';
    const isCaseVisible = caseObj?.visibleToClient === true || caseObj?.visibletoClient === true || caseObj?.visibleToClient === 'true';
    if (portStat === 'nao_criado') {
      if (isCaseVisible) {
        items.push({
          section: 'Cliente',
          label: 'Status de Acesso do Portal',
          status: 'Erro Crítico',
          details: 'O caso foi marcado como visível para o cliente, mas o portal de acesso ainda não foi criado.',
          severity: 'critical'
        });
      } else {
        items.push({
          section: 'Cliente',
          label: 'Status de Acesso do Portal',
          status: 'Atenção',
          details: 'Cliente interno sem portal de acesso criado.',
          severity: 'medium'
        });
      }
    } else {
      items.push({
        section: 'Cliente',
        label: 'Status de Acesso do Portal',
        status: 'OK',
        details: 'Portal de acesso do inquilino devidamente criado e vinculado.',
        severity: 'low'
      });
    }

    // New Check 3: Preview Password Active Warning
    if (client.senhaVisivelPreview) {
      items.push({
        section: 'Cliente',
        label: 'Visualização Segura da Senha',
        status: 'Atenção',
        details: 'O cliente possui senha de pré-visualização ativa.',
        severity: 'low'
      });
    }

    // New Check 4: Slug & Portal status pairing
    const hasSlug = !!(client.slug && client.slug.trim() !== '');
    if (!hasSlug) {
      if (portStat === 'criado') {
        items.push({
          section: 'Cliente',
          label: 'Atribuição de Slug Exclusiva',
          status: 'Erro Crítico',
          details: 'O cliente possui portal marcado como "criado", mas não há slug atribuído no registro. Isso impede rotas dinâmicas.',
          severity: 'critical'
        });
      } else {
        items.push({
          section: 'Cliente',
          label: 'Atribuição de Slug Exclusiva',
          status: 'Atenção',
          details: 'Não há slug fático definido para este rascunho de cliente interno.',
          severity: 'medium'
        });
      }
    } else {
      items.push({
        section: 'Cliente',
        label: 'Atribuição de Slug Exclusiva',
        status: 'OK',
        details: `Slug de inquilino ativo: [${client.slug}].`,
        severity: 'low'
      });
    }

    if (client.active === undefined) {
      items.push({
        section: 'Cliente',
        label: 'Status de Ativação do Cliente',
        status: 'Atenção',
        details: 'Parâmetro "active" ausente ou indefinido no registro de clientes.',
        severity: 'low'
      });
    } else if (client.active === false) {
      items.push({
        section: 'Cliente',
        label: 'Status de Ativação do Cliente',
        status: 'Pendente',
        details: 'O registro de cliente está temporariamente inativo ou bloqueado no ecossistema.',
        severity: 'high'
      });
    } else {
      items.push({
        section: 'Cliente',
        label: 'Status de Ativação do Cliente',
        status: 'OK',
        details: 'Registro de conta em conformidade ("active": true).',
        severity: 'low'
      });
    }
  }

  // 2. Portal do Cliente
  if (!portal) {
    items.push({
      section: 'Portal',
      label: 'Existência do Portal do Cliente (clientPortals)',
      status: 'Erro Crítico',
      details: `Incapaz de localizar documento correspondente na coleção "clientPortals" sob o slug do inquilino.`,
      severity: 'critical'
    });
  } else {
    items.push({
      section: 'Portal',
      label: 'Existência do Portal do Cliente',
      status: 'OK',
      details: 'Ponto de entrada do Portal localizado sob o namespace correspondente.',
      severity: 'low'
    });

    if (!portal.clientId || portal.clientId !== caseObj?.clientId) {
      items.push({
        section: 'Portal',
        label: 'Verificação de Inquilino Proprietário (Relational Sync)',
        status: 'Erro Crítico',
        details: 'A coleção "clientPortals" possui um ID de cliente desalinhado com o prontuário deste caso.',
        severity: 'critical'
      });
    } else {
      items.push({
        section: 'Portal',
        label: 'Verificação de Inquilino Proprietário',
        status: 'OK',
        details: 'O Portal aponta corretamente para o Tenant ID fático do cliente.',
        severity: 'low'
      });
    }

    if (portal.active === undefined) {
      items.push({
        section: 'Portal',
        label: 'Status de Ativação do Portal',
        status: 'Atenção',
        details: 'O parâmetro "active" do inquilino está indefinido.',
        severity: 'medium'
      });
    } else if (portal.active === false) {
      items.push({
        section: 'Portal',
        label: 'Status de Ativação do Portal',
        status: 'Erro Crítico',
        details: 'O portal deste inquilino foi desligado administrativamente no painel de controle.',
        severity: 'critical'
      });
    } else {
      items.push({
        section: 'Portal',
        label: 'Status de Ativação do Portal',
        status: 'OK',
        details: 'Serviço de portal do inquilino ativo e aceitando autenticações externos.',
        severity: 'low'
      });
    }
  }

  // 3. Usuário do Cliente
  if (!user) {
    // Check if user invite is created
    if (invite) {
      items.push({
        section: 'Usuário',
        label: 'Conta de Usuário Credenciada',
        status: 'Pendente',
        details: 'Nenhuma conta ativa na coleção "users" vinculada a este cliente. No entanto, um convite de onboarding foi gerado.',
        severity: 'medium'
      });
    } else {
      items.push({
        section: 'Usuário',
        label: 'Conta de Usuário Credenciada',
        status: 'Atenção',
        details: 'O cliente não possui usuário ativo ou convites correspondentes criados na infraestrutura.',
        severity: 'high'
      });
    }
  } else {
    items.push({
      section: 'Usuário',
      label: 'Conta de Usuário Credenciada',
      status: 'OK',
      details: `Conta vinculada ativa: [${user.email || 'sem email'}].`,
      severity: 'low'
    });

    if (!user.email || user.email.trim() === '') {
      items.push({
        section: 'Usuário',
        label: 'E-mail do Usuário cadastrado',
        status: 'Erro Crítico',
        details: 'O e-mail da conta de usuário está em branco.',
        severity: 'critical'
      });
    }

    if (user.role !== 'client') {
      items.push({
        section: 'Usuário',
        label: 'Instruções de Permissão (Role Check)',
        status: 'Erro Crítico',
        details: `Usuário possui privilégio incorreto: [${user.role}]. Deveria ser "client".`,
        severity: 'critical'
      });
    } else {
      items.push({
        section: 'Usuário',
        label: 'Instruções de Permissão (Role Check)',
        status: 'OK',
        details: 'Verificado privilégio compatível do inquilino ("role": "client").',
        severity: 'low'
      });
    }

    if (user.clientId !== caseObj?.clientId) {
      items.push({
        section: 'Usuário',
        label: 'Segurança e Isolamento de Inquilino (clientId)',
        status: 'Erro Crítico',
        details: 'O ID de cliente da conta de usuário se difere do ID do prontuário do Caso.',
        severity: 'critical'
      });
    }

    if (user.clientSlug !== caseObj?.clientSlug) {
      items.push({
        section: 'Usuário',
        label: 'Segurança e Isolamento de Inquilino (clientSlug)',
        status: 'Atenção',
        details: 'Incoerência de Slug identificada no objeto do usuário.',
        severity: 'medium'
      });
    }
  }

  // 4. Convite
  if (!invite) {
    if (user) {
      items.push({
        section: 'Convite',
        label: 'Onboarding e Convite Primário',
        status: 'OK',
        details: 'O cliente já realizou onboarding e possui conta de acesso devidamente instalada.',
        severity: 'low'
      });
    } else {
      items.push({
        section: 'Convite',
        label: 'Onboarding e Convite Primário',
        status: 'Atenção',
        details: 'Nenhum convite ativo na coleção "users_invites" gerado para onboarding preliminar.',
        severity: 'medium'
      });
    }
  } else {
    items.push({
      section: 'Convite',
      label: 'Onboarding e Convite Primário',
      status: 'OK',
      details: `Registro de convite localizado sob o hash correspondente. Status: [${invite.status || 'aberto'}].`,
      severity: 'low'
    });
  }

  // 5. Caso
  if (!caseObj) {
    items.push({
      section: 'Prontuário',
      label: 'Integridade do Caso',
      status: 'Erro Crítico',
      details: 'Objeto do caso ausente de verificação técnica.',
      severity: 'critical'
    });
  } else {
    const requiredCaseFields = [
      { key: 'clientId', label: 'ID de Cliente Proprietário' },
      { key: 'clientSlug', label: 'Namespace / Slug do Inquilino' },
      { key: 'registrationTypeKey', label: 'Tipo de Serviço Chave' },
      { key: 'title', label: 'Título do Prontuário' },
      { key: 'caseType', label: 'Matéria / Ramo de Atuação' },
      { key: 'statusInterno', label: 'Status Operacional Interno' },
      { key: 'statusPublicoCliente', label: 'Status Informativo Público' },
      { key: 'productionStage', label: 'Estágio do Fluxo de Produção' },
      { key: 'productionStatus', label: 'Status Consolidado de Produção' }
    ];

    requiredCaseFields.forEach((item) => {
      if (!caseObj[item.key] || caseObj[item.key].toString().trim() === '') {
        items.push({
          section: 'Prontuário',
          label: `Parâmetro Mandatório: ${item.label}`,
          status: 'Erro Crítico',
          details: `O campo correspondente [${item.key}] está em branco no registro cases/${caseObj.id || 'id_caso'}.`,
          severity: 'critical'
        });
      } else {
        items.push({
          section: 'Prontuário',
          label: `Parâmetro Mandatório: ${item.label}`,
          status: 'OK',
          details: `Parâmetro validado: "${caseObj[item.key]}".`,
          severity: 'low'
        });
      }
    });
  }

  // 6. Dados do Caso
  if (caseObj) {
    if (!caseObj.title || caseObj.title.trim() === 'Sem Título' || caseObj.title.trim() === '') {
      items.push({
        section: 'Dados do Caso',
        label: 'Título de Prontuário fático',
        status: 'Erro Crítico',
        details: 'Título do prontuário encontra-se ausente ou padrão.',
        severity: 'critical'
      });
    }
    if (!caseObj.caseType || caseObj.caseType.trim() === '') {
      items.push({
        section: 'Dados do Caso',
        label: 'Matéria ou Natureza Jurídica',
        status: 'Atenção',
        details: 'Ramo de atuação ou foco do caso não selecionado (ex: Tributário, Cível).',
        severity: 'medium'
      });
    }

    const hasResponsible = caseObj.responsible && caseObj.responsible.trim() !== '';
    const hasOpposing = caseObj.opposingParty && caseObj.opposingParty.trim() !== '';

    if (!hasResponsible && !hasOpposing) {
      items.push({
        section: 'Dados do Caso',
        label: 'Responsável Operacional ou Parte Adversa',
        status: 'Atenção',
        details: 'Obrigatório preencher ao menos um dos dois campos para fins de distribuição ou indexação de passivos.',
        severity: 'medium'
      });
    } else {
      items.push({
        section: 'Dados do Caso',
        label: 'Partes Cadastradas (Responsável / Requerido)',
        status: 'OK',
        details: 'Sincronia cadastral de partes validada.',
        severity: 'low'
      });
    }

    // CNJ check when applicable
    const isJudicial =
      caseObj.registrationTypeKey === 'processo_judicial_em_andamento' ||
      caseObj.registrationTypeKey === 'processo_judicial_ajuizado';

    if (isJudicial) {
      if (!caseObj.processNumber || caseObj.processNumber.replace(/\D/g, '').length < 20) {
        items.push({
          section: 'Dados do Caso',
          label: 'Código de Identificação Judiciária (CNJ)',
          status: 'Atenção',
          details: 'Número de distribuição judicial CNJ (20 dígitos) ausente ou inválido.',
          severity: 'high'
        });
      } else {
        items.push({
          section: 'Dados do Caso',
          label: 'Código de Identificação Judiciária (CNJ)',
          status: 'OK',
          details: `CNJ válido sincronizado: ${caseObj.processNumber}.`,
          severity: 'low'
        });
      }

      if (!caseObj.court && !caseObj.courtSection && !caseObj.courtCity) {
        items.push({
          section: 'Dados do Caso',
          label: 'Localizador Competente (Tribunal/Vara/Comarca)',
          status: 'Atenção',
          details: 'Informações de juízo, vara competente ou tribunal não especificadas.',
          severity: 'medium'
        });
      } else {
        items.push({
          section: 'Dados do Caso',
          label: 'Localizador Competente (Tribunal/Vara/Comarca)',
          status: 'OK',
          details: `Ponto de destino mapeado: ${caseObj.court || ''} / ${caseObj.courtSection || ''} (${caseObj.courtCity || ''}).`,
          severity: 'low'
        });
      }
    }
  }

  // 7. Solicitações de Informações
  if (infoRequests.length === 0) {
    items.push({
      section: 'Solicitações de Informações',
      label: 'Checagem de Requisições de Dados',
      status: 'Atenção',
      details: 'Não há solicitações registradas na base para coleta de dados complementares com o cliente.',
      severity: 'medium'
    });
  } else {
    const hasVisible = infoRequests.some((r) => r.visibleToClient === true);
    if (!hasVisible) {
      items.push({
        section: 'Solicitações de Informações',
        label: 'Visibilidade para o Cliente',
        status: 'Atenção',
        details: 'Existem solicitações criadas, mas nenhuma está visível ao cliente no Portal.',
        severity: 'medium'
      });
    } else {
      items.push({
        section: 'Solicitações de Informações',
        label: 'Checagem de Requisições de Dados',
        status: 'OK',
        details: `Verificadas ${infoRequests.length} solicitações vinculadas com visibilidade ativa.`,
        severity: 'low'
      });
    }
  }

  // 8. Solicitações de Provas
  if (evidenceRequests.length === 0) {
    items.push({
      section: 'Solicitações de Provas',
      label: 'Documentos e Provas para Distribuição',
      status: 'Atenção',
      details: 'Nenhuma pasta ou upload de provas registrado. Casos judiciais ou administrativos exigem dockets robustos.',
      severity: 'medium'
    });
  } else {
    items.push({
      section: 'Solicitações de Provas',
      label: 'Documentos e Provas para Distribuição',
      status: 'OK',
      details: `Encontradas ${evidenceRequests.length} requisições fáticas de provas configuradas.`,
      severity: 'low'
    });
  }

  // 9. Financeiro
  if (financials.length === 0) {
    items.push({
      section: 'Concisão Financeira',
      label: 'Gestão de Faturamento / Honorários',
      status: 'Atenção',
      details: 'Nenhum lançamento financeiro, guia ou taxa judiciária vinculada no prontuário.',
      severity: 'medium'
    });
  } else {
    items.push({
      section: 'Concisão Financeira',
      label: 'Lançamentos de Despesas / Custos',
      status: 'OK',
      details: `Localizados ${financials.length} registros sincronizados de fatura.`,
      severity: 'low'
    });

    const isMissingCaseId = financials.some((f) => !f.caseId || f.caseId !== caseObj?.id);
    const isMissingClientId = financials.some((f) => !f.clientId || f.clientId !== caseObj?.clientId);

    if (isMissingCaseId || isMissingClientId) {
      items.push({
        section: 'Concisão Financeira',
        label: 'Segurança Financeira (Relational Sync)',
        status: 'Erro Crítico',
        details: 'Identificadas guias financeiras correspondentes a outro cliente ou prontuário cadastral.',
        severity: 'critical'
      });
    }

    if (caseObj && !caseObj.feeContractAttached) {
      items.push({
        section: 'Concisão Financeira',
        label: 'Contrato de Honorários Vinculado',
        status: 'Atenção',
        details: 'Não há comprovação de contrato de honorários advocatícios homologado e assinado anexado na ficha.',
        severity: 'medium'
      });
    } else {
      items.push({
        section: 'Concisão Financeira',
        label: 'Contrato de Honorários Vinculado',
        status: 'OK',
        details: 'Contrato operacional previamente homologado.',
        severity: 'low'
      });
    }
  }

  // Setup warnings for simulated integrations
  items.push({
    section: 'Financeiro',
    label: 'Plataformas de Liquidação (Stripe / Asaas)',
    status: 'Atenção',
    details: 'Integração fática de cartão e boletos em modo sandbox operacional, aguardando ativação de credenciais finais.',
    severity: 'low'
  });

  // 10. EDRP
  const edrp = caseObj?.edrp || {};
  const struct = caseObj?.estruturacao || edrp.estruturacao;
  const deleg = caseObj?.delegacao || edrp.delegacao;
  const prep = caseObj?.preparacaoProtocolo || edrp.preparacaoProtocolo;
  const revForm = caseObj?.reviewFormal;

  if (!struct || !struct.primaryTese) {
    items.push({
      section: 'Segurança Operacional',
      label: 'Estruturação EDRP',
      status: 'Pendente',
      details: 'Fase de estruturação técnica primária do caso (tese) está incompleta ou vazia.',
      severity: 'high'
    });
  } else {
    items.push({
      section: 'Segurança Operacional',
      label: 'Estruturação EDRP',
      status: 'OK',
      details: 'Estruturação jurídica e resumo de fatos cadastrados regularmente.',
      severity: 'low'
    });
  }

  if (!deleg || !deleg.operatorId) {
    items.push({
      section: 'Segurança Operacional',
      label: 'Delegação e Controle de Alocação',
      status: 'Atenção',
      details: 'Não há responsável operacional ou operador alocado para a preparação final.',
      severity: 'medium'
    });
  } else {
    items.push({
      section: 'Segurança Operacional',
      label: 'Delegação e Controle de Alocação',
      status: 'OK',
      details: `Operador nominal faturado: [${deleg.operatorName || deleg.operatorId}].`,
      severity: 'low'
    });
  }

  // Review & Forced Advance Critical Alert logic
  if (!revForm) {
    items.push({
      section: 'Segurança Operacional',
      label: 'Revisão Formal Técnica',
      status: 'Erro Crítico',
      details: 'Nenhum formulário de Auditoria Técnica de Revisão foi preenchido.',
      severity: 'critical'
    });
  } else {
    if (revForm.reviewStatus === 'aprovado' || revForm.approvedForProtocol) {
      items.push({
        section: 'Segurança Operacional',
        label: 'Aprovação Formal pelo Auditor',
        status: 'OK',
        details: `Caso auditado e liberado pelo revisor [${revForm.reviewerName || 'Auditor'}].`,
        severity: 'low'
      });
    } else {
      if (revForm.forcedAdvance) {
        items.push({
          section: 'Segurança Operacional',
          label: 'Aprovação Formal pelo Auditor',
          status: 'Erro Crítico',
          details: `Revisão NOT aprovada! Trâmite prosseguiu via liberação forçada. Motivo: "${revForm.forcedAdvanceReason}".`,
          severity: 'critical'
        });
      } else {
        items.push({
          section: 'Segurança Operacional',
          label: 'Aprovação Formal pelo Auditor',
          status: 'Pendente',
          details: `Revisão técnica incompletada ou ajuste solicitado pendente pelo auditor. Status: [${revForm.reviewStatus}].`,
          severity: 'high'
        });
      }
    }
  }

  // Warning features
  items.push({
    section: 'EDRP',
    label: 'Plataformas de Comunicação Externa (Todoist)',
    status: 'Atenção',
    details: 'Tarefas sincronizadas de forma offline. Integração real aguardando liberação de token.',
    severity: 'low'
  });

  items.push({
    section: 'EDRP',
    label: 'Painel de Workspace e Colaboradores',
    status: 'Atenção',
    details: 'Painel de gestão fática simulado nos widgets locais.',
    severity: 'low'
  });

  // 11. Protocolo
  const prot = caseObj?.protocol;
  if (!prot) {
    items.push({
      section: 'Processamento de Protocolo',
      label: 'Protocolo e Distribuição',
      status: 'Pendente',
      details: 'Não há registros de trâmites de distribuição judiciais ou administrativos.',
      severity: 'high'
    });
  } else {
    if (prot.protocolStatus === 'protocolado') {
      if (!prot.protocolResponsible || !prot.actualProtocolDate || !prot.protocolSystem) {
        items.push({
          section: 'Processamento de Protocolo',
          label: 'Validação Fática de Distribuição',
          status: 'Erro Crítico',
          details: 'Marcado como protocolado, porém faltam dados fáticos mandatórios: Responsável, Data Real ou Órgão receptor.',
          severity: 'critical'
        });
      } else {
        items.push({
          section: 'Processamento de Protocolo',
          label: 'Validação Fática de Distribuição',
          status: 'OK',
          details: `Distribuído por: [${prot.protocolResponsible}] no dia [${prot.actualProtocolDate}] via [${prot.protocolSystem}].`,
          severity: 'low'
        });
      }

      if (caseObj?.registrationTypeKey === 'peticao_inicial' && (!prot.processNumber || prot.processNumber.replace(/\D/g, '').length < 20)) {
        items.push({
          section: 'Processamento de Protocolo',
          label: 'Geração de Identificação CNJ',
          status: 'Erro Crítico',
          details: 'Petições iniciais protocoladas exigem obrigatoriamente um número CNJ completo de 20 dígitos informado.',
          severity: 'critical'
        });
      }
    } else {
      items.push({
        section: 'Processamento de Protocolo',
        label: 'Situação de Trâmite de Protocolo',
        status: 'Atenção',
        details: `Distribuição secundária agendada/preparada. Status: [${prot.protocolStatus}].`,
        severity: 'medium'
      });
    }

    if (!prot.protocolReceiptUrl && !prot.googleDriveFileId) {
      items.push({
        section: 'Processamento de Protocolo',
        label: 'Comprovante do Órgão Receptor',
        status: 'Atenção',
        details: 'Falta anexar ou referenciar um link de comprovante oficial do recebimento do protocolo.',
        severity: 'medium'
      });
    } else {
      items.push({
        section: 'Processamento de Protocolo',
        label: 'Comprovante do Órgão Receptor',
        status: 'OK',
        details: 'Link ou ID de comprovante indexado ao prontuário.',
        severity: 'low'
      });
    }
  }

  // 12. Controladoria
  const ctrl = caseObj?.controladoria;
  if (!ctrl) {
    items.push({
      section: 'Parecer Governamental',
      label: 'Triagem da Controladoria',
      status: 'Erro Crítico',
      details: 'O prontuário do caso não foi avaliado na triagem final de controladoria administrativa.',
      severity: 'critical'
    });
  } else {
    if (ctrl.status === 'apto' || ctrl.status === 'apto_com_ressalvas' || ctrl.status === 'concluido') {
      items.push({
        section: 'Parecer Governamental',
        label: 'Homologação de Trânsito Interno',
        status: 'OK',
        details: `Trâmite auditado e classificado como apto para fechamento pelo auditor nominal.`,
        severity: 'low'
      });
    } else if (ctrl.status === 'devolvido_com_pendencia') {
      items.push({
        section: 'Parecer Governamental',
        label: 'Homologação de Trânsito Interno',
        status: 'Pendente',
        details: `Caso devolvido com pendências administrativas. Requer correção na fase: [${ctrl.returnToStage}].`,
        severity: 'high'
      });
    } else if (ctrl.status === 'inapto') {
      items.push({
        section: 'Parecer Governamental',
        label: 'Homologação de Trânsito Interno',
        status: 'Erro Crítico',
        details: `A controladoria bloqueou o prontuário declarando-o Inapto. Motivos: "${ctrl.findings || 'vazio'}"`,
        severity: 'critical'
      });
    } else {
      items.push({
        section: 'Parecer Governamental',
        label: 'Homologação de Trânsito Interno',
        status: 'Atenção',
        details: `Conferência inconclusa. Status atual da controladoria: [${ctrl.status}].`,
        severity: 'medium'
      });
    }
  }

  // 13. Conectores
  const isConnectorsActive = connectors && connectors.status === 'ativo';
  if (!connectors) {
    items.push({
      section: 'Conectores',
      label: 'Conectores e Webhooks cadastrados',
      status: 'Atenção',
      details: 'Sem conexão com webhooks externos. Trâmite exclusivamente fático interno.',
      severity: 'low'
    });
  } else if (!isConnectorsActive) {
    items.push({
      section: 'Conectores',
      label: 'Conectores e Webhooks cadastrados',
      status: 'Atenção',
      details: `Conector offline ou pendente de ativação. Estado: [${connectors.status || 'inativo'}]`,
      severity: 'low'
    });
  } else {
    items.push({
      section: 'Conectores',
      label: 'Conectores e Webhooks cadastrados',
      status: 'OK',
      details: 'Endpoints de conectores e webhooks configurados e habilitados para distribuição de feeds.',
      severity: 'low'
    });
  }

  // 14. Classification
  let hasCritical = items.some((item) => item.status === 'Erro Crítico');
  let hasAttention = items.some((item) => item.status === 'Atenção');
  let hasPending = items.some((item) => item.status === 'Pendente');

  let result: 'Pronto para deploy' | 'Pronto com ressalvas' | 'Não recomendado para deploy' = 'Pronto para deploy';

  if (hasCritical) {
    result = 'Não recomendado para deploy';
  } else if (hasAttention || hasPending) {
    result = 'Pronto com ressalvas';
  }

  // Counts
  const okCount = items.filter((i) => i.status === 'OK').length;
  const attentionCount = items.filter((i) => i.status === 'Atenção').length;
  const pendingCount = items.filter((i) => i.status === 'Pendente').length;
  const criticalCount = items.filter((i) => i.status === 'Erro Crítico').length;

  return {
    generatedAt: new Date().toISOString(),
    result,
    items,
    okCount,
    attentionCount,
    pendingCount,
    criticalCount
  };
}
