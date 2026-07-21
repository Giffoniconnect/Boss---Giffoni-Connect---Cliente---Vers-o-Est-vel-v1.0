import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  getDoc, 
  setDoc,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BossLayout } from '../../components/Layout';
import { 
  Sliders, Search, User, Users, Briefcase, DollarSign, Compass, 
  Activity, ShieldAlert, AlertTriangle, CheckCircle, Copy, ExternalLink, 
  RefreshCw, Plus, Calendar, MessageSquare, Clock, FileText, Check, XCircle,
  Trash2, Highlighter, Eraser
} from 'lucide-react';

type TabId = 'clientes' | 'casos' | 'slugs' | 'usuarios' | 'financeiro' | 'solicitacoes' | 'agenda' | 'edrp' | 'integridade';

export default function CentralControle() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('clientes');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data State
  const [clients, setClients] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [usersInvites, setUsersInvites] = useState<any[]>([]);
  const [clientPortals, setClientPortals] = useState<any[]>([]);
  const [infoRequests, setInfoRequests] = useState<any[]>([]);
  const [evidenceRequests, setEvidenceRequests] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [portalSettings, setPortalSettings] = useState<any>(null);

  // Filter States
  const [casesFilter, setCasesFilter] = useState<'all' | 'em_producao' | 'com_pendencias' | 'pronto_relatorio' | 'concluido' | 'concluido_ressalvas' | 'arquivado'>('all');
  const [finFilter, setFinFilter] = useState<'all' | 'pendente' | 'aguardando' | 'pago' | 'parcial' | 'atrasado' | 'erro_webhook' | 'stripe' | 'asaas' | 'manual'>('all');
  const [edrpFilter, setEdrpFilter] = useState<'all' | 'sem_estruturacao' | 'sem_delegacao' | 'aguardando_revisao' | 'pronto_protocolo' | 'com_pendencia' | 'protocolado' | 'controladoria'>('all');

  // Modals state
  const [safeDeleteWarning, setSafeDeleteWarning] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<any | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  // Master Client Editor State
  const [selectedMasterClient, setSelectedMasterClient] = useState<any | null>(null);
  const [masterEditorTab, setMasterEditorTab] = useState<'identificacao' | 'acesso_slug' | 'cadastro' | 'casos' | 'provas' | 'informacoes' | 'audiencias' | 'pericias' | 'reunioes' | 'financeiro' | 'timeline' | 'visibilidade' | 'gdrive' | 'gdocs' | 'logs' | 'integridade'>('identificacao');
  const [masterFormData, setMasterFormData] = useState<any>({});
  const [dashboardFilter, setDashboardFilter] = useState<'incompletos' | 'producao' | 'pendencias' | 'revisao' | 'protocol' | 'protocolados' | null>(null);

  // Mini-states inside Master Editor interactive sub-actions
  const [newTimelineText, setNewTimelineText] = useState('');
  const [newTimelineType, setNewTimelineType] = useState<'info' | 'alerta' | 'sucesso'>('info');
  const [diagResults, setDiagResults] = useState<any[]>([]);
  const [diagStatusGeral, setDiagStatusGeral] = useState<'Íntegro' | 'Atenção' | 'Erro crítico' | null>(null);
  const [diagRun, setDiagRun] = useState(false);

  // Modo Sublinhador (Highlighter Mode)
  const [highlighterActive, setHighlighterActive] = useState(false);
  const [selectedDetailBlock, setSelectedDetailBlock] = useState<any>(null);

  const handleMouseUp = () => {
    if (!highlighterActive) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    
    try {
      const range = selection.getRangeAt(0);

      // Evitar quebrar inputs, botões, textareas, links e formulários
      let parent: Node | null = range.commonAncestorContainer;
      if (parent.nodeType === Node.TEXT_NODE) {
        parent = parent.parentNode;
      }
      
      if (parent instanceof HTMLElement) {
        const isInteractive = parent.closest('button, input, textarea, select, a, [role="button"], [class*="cursor-pointer"]');
        if (isInteractive) {
          selection.removeAllRanges();
          return;
        }
      }

      // Criar o wrapper span com a classe de marcação visual
      const span = document.createElement('span');
      span.className = 'highlight-marker bg-yellow-100 border-b-2 border-yellow-500 rounded-sm font-semibold select-text';
      
      range.surroundContents(span);
    } catch (e) {
      console.warn('Seleção cruza múltiplos elementos complexos, impossível sublinhar diretamente:', e);
    }
    
    selection.removeAllRanges();
  };

  const handleClearHighlights = () => {
    const highlights = document.querySelectorAll('.highlight-marker');
    highlights.forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      }
    });
    alert('Todas as marcações temporárias do painel foram limpas!');
  };

  const loadAllCollections = async () => {
    setLoading(true);
    try {
      const [
        clientsSnap, casesSnap, usersSnap, invitesSnap, portalsSnap,
        infoSnap, evidenceSnap, financialsSnap, eventsSnap, portalSettingsSnap
      ] = await Promise.all([
        getDocs(collection(db, 'clients')).catch(err => {
          console.warn("Aviso ao buscar 'clients' do Firestore:", err);
          return { docs: [] } as any;
        }),
        getDocs(collection(db, 'cases')).catch(err => {
          console.warn("Aviso ao buscar 'cases' do Firestore:", err);
          return { docs: [] } as any;
        }),
        getDocs(collection(db, 'users')).catch(err => {
          console.warn("Aviso ao buscar 'users' do Firestore:", err);
          return { docs: [] } as any;
        }),
        getDocs(collection(db, 'users_invites')).catch(err => {
          console.warn("Aviso ao buscar 'users_invites' do Firestore:", err);
          return { docs: [] } as any;
        }),
        getDocs(collection(db, 'clientPortals')).catch(err => {
          console.warn("Aviso ao buscar 'clientPortals' do Firestore:", err);
          return { docs: [] } as any;
        }),
        getDocs(collection(db, 'caseInformationRequests')).catch(err => {
          console.warn("Aviso ao buscar 'caseInformationRequests' do Firestore:", err);
          return { docs: [] } as any;
        }),
        getDocs(collection(db, 'caseEvidenceRequests')).catch(err => {
          console.warn("Aviso ao buscar 'caseEvidenceRequests' do Firestore:", err);
          return { docs: [] } as any;
        }),
        getDocs(collection(db, 'caseFinancials')).catch(err => {
          console.warn("Aviso ao buscar 'caseFinancials' do Firestore:", err);
          return { docs: [] } as any;
        }),
        getDocs(collection(db, 'caseEvents')).catch(err => {
          console.warn("Aviso ao buscar 'caseEvents' do Firestore:", err);
          return { docs: [] } as any;
        }),
        getDoc(doc(db, 'settings', 'portal')).catch(err => {
          console.warn("Aviso ao buscar 'settings/portal' do Firestore:", err);
          return { exists: () => false, data: () => null } as any;
        })
      ]);

      setClients(clientsSnap.docs ? clientsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : []);
      setCases(casesSnap.docs ? casesSnap.docs.map(d => ({ id: d.id, ...d.data() })) : []);
      setUsers(usersSnap.docs ? usersSnap.docs.map(d => ({ id: d.id, ...d.data() })) : []);
      setUsersInvites(invitesSnap.docs ? invitesSnap.docs.map(d => ({ id: d.id, ...d.data() })) : []);
      setClientPortals(portalsSnap.docs ? portalsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : []);
      setInfoRequests(infoSnap.docs ? infoSnap.docs.map(d => ({ id: d.id, ...d.data() })) : []);
      setEvidenceRequests(evidenceSnap.docs ? evidenceSnap.docs.map(d => ({ id: d.id, ...d.data() })) : []);
      setFinancials(financialsSnap.docs ? financialsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : []);
      setEvents(eventsSnap.docs ? eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : []);

      if (portalSettingsSnap.exists()) {
        setPortalSettings(portalSettingsSnap.data());
      }
    } catch (err) {
      console.error("Erro ao carregar coleções:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllCollections();
  }, []);

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(successMessage);
    } catch {
      alert(`Conteúdo copiado de forma segura: ${text}`);
    }
  };

  // Helper resolvers
  const getClientDisplayName = (clientId: string) => {
    const c = clients.find(cl => cl.id === clientId);
    if (!c) return 'Não Encontrado';
    return c.type === 'PF' 
      ? (c.pfDadosPessoais?.pf_nomeCompleto || c.pfData?.pf_nomeCompleto || 'Sem Nome')
      : (c.pjDadosEmpresa?.pj_razaoSocial || c.pjData?.pj_razaoSocial || 'Sem Razão Social');
  };

  const getClientEmail = (c: any) => {
    return c?.acessoSistema?.acesso_emailLogin || c?.email || 'Sem E-mail';
  };

  const getClientPhone = (c: any) => {
    if (c?.type === 'PF') {
      return c.pfContato?.pf_telefone || c.pfContato?.pf_whatsapp || c.pfData?.pf_telefone || 'Sem número';
    }
    return c?.pjContatoEmpresa?.pj_telefoneEmpresa || c?.pjData?.pj_telefoneEmpresa || 'Sem número';
  };

  const getClientDocument = (c: any) => {
    if (c?.type === 'PF') return c.pfDadosPessoais?.pf_cpf || 'Não Informado';
    return c?.pjDadosEmpresa?.pj_cnpj || 'Não Informado';
  };

  // Search filter logic matching ANY of the targets recursively
  const searchLower = searchTerm.trim().toLowerCase();
  const matchingClientIds = new Set<string>();
  const matchingCaseIds = new Set<string>();

  clients.forEach(c => {
    const name = getClientDisplayName(c.id);
    const docNum = getClientDocument(c);
    const email = getClientEmail(c);
    const phone = getClientPhone(c);
    const slug = c.slug || '';

    const match = !searchLower ||
      name.toLowerCase().includes(searchLower) ||
      docNum.includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      phone.includes(searchLower) ||
      slug.toLowerCase().includes(searchLower) ||
      c.id.toLowerCase().includes(searchLower);

    if (match) matchingClientIds.add(c.id);
  });

  cases.forEach(ca => {
    const title = ca.title || '';
    const cnj = ca.processNumber || '';
    const service = ca.registrationType || '';
    const statusInt = ca.statusInterno || ca.status || '';
    const statusPub = ca.statusPublicoCliente || '';
    const lawyer = ca.responsibleLawyer || '';
    const slug = ca.clientSlug || '';

    const match = !searchLower ||
      title.toLowerCase().includes(searchLower) ||
      ca.id.toLowerCase().includes(searchLower) ||
      cnj.toLowerCase().includes(searchLower) ||
      service.toLowerCase().includes(searchLower) ||
      statusInt.toLowerCase().includes(searchLower) ||
      statusPub.toLowerCase().includes(searchLower) ||
      lawyer.toLowerCase().includes(searchLower) ||
      slug.toLowerCase().includes(searchLower) ||
      matchingClientIds.has(ca.clientId);

    if (match) {
      matchingCaseIds.add(ca.id);
      if (ca.clientId) matchingClientIds.add(ca.clientId);
    }
  });

  // Displays corresponding to current filters and search
  const displayedClients = clients.filter(c => {
    if (!matchingClientIds.has(c.id)) return false;
    if (dashboardFilter === 'incompletos') {
      return c.cadastroIncompleto === true;
    }
    return true;
  });
  
  const displayedCases = cases.filter(ca => {
    if (!matchingCaseIds.has(ca.id)) return false;

    if (dashboardFilter === 'producao') {
      return ca.statusInterno === 'em_producao' || ca.status === 'em_producao' || ca.productionStatus === 'em_producao';
    }
    if (dashboardFilter === 'pendencias') {
      return ca.statusInterno === 'com_pendencias' || ca.status === 'com_pendencias' || ca.productionStatus === 'com_pendencias';
    }
    if (dashboardFilter === 'revisao') {
      return ca.protocolStatus === 'aguardando';
    }
    if (dashboardFilter === 'protocol') {
      return ca.protocolStatus === 'agendado';
    }
    if (dashboardFilter === 'protocolados') {
      return ca.protocolStatus === 'protocolado';
    }

    if (casesFilter === 'all') return true;
    if (casesFilter === 'arquivado') return ca.status === 'arquivado';
    return ca.productionStatus === casesFilter;
  });

  const displayedSlugs = clientPortals.filter(p => {
    const client = clients.find(c => c.slug === p.slug);
    const matchesSearch = !searchLower || 
      p.slug?.toLowerCase().includes(searchLower) || 
      (p.clientId && matchingClientIds.has(p.clientId));
    return matchesSearch;
  });

  const displayedUsers = users.filter(u => {
    const matchesSearch = !searchLower ||
      u.email?.toLowerCase().includes(searchLower) ||
      u.clientSlug?.toLowerCase().includes(searchLower) ||
      (u.clientId && matchingClientIds.has(u.clientId));
    return matchesSearch;
  });

  const displayedFinancials = financials.filter(f => {
    const matchesSearch = !searchLower ||
      f.caseId?.toLowerCase().includes(searchLower) ||
      f.clientId?.toLowerCase().includes(searchLower) ||
      (f.status || f.paymentStatus || '').toLowerCase().includes(searchLower) ||
      (f.clientId && matchingClientIds.has(f.clientId)) ||
      (f.caseId && matchingCaseIds.has(f.caseId));
    if (!matchesSearch) return false;

    if (finFilter === 'all') return true;
    const status = (f.status || f.paymentStatus || '').toLowerCase();
    const provider = (f.provider || '').toLowerCase();
    const webhook = (f.webhookStatus || '').toLowerCase();

    if (finFilter === 'pendente') return status === 'pendente' || status === 'aberto';
    if (finFilter === 'aguardando') return status === 'aguardando' || status === 'aguardando pagamento' || status === 'aguardando_pagamento';
    if (finFilter === 'pago') return status === 'pago';
    if (finFilter === 'parcial') return status === 'parcial' || status === 'parcialmente pago';
    if (finFilter === 'atrasado') return status === 'atrasado' || status === 'em atraso' || status === 'em_atraso';
    if (finFilter === 'erro_webhook') return webhook === 'erro' || webhook.includes('erro');
    if (finFilter === 'stripe') return provider === 'stripe';
    if (finFilter === 'asaas') return provider === 'asaas';
    if (finFilter === 'manual') return provider === 'manual' || !provider;
    return true;
  });

  const combinedRequests = [
    ...infoRequests.map(r => ({ ...r, reqType: 'Informação', parsedTitle: r.title || r.question || 'Sem título' })),
    ...evidenceRequests.map(r => ({ ...r, reqType: 'Prova', parsedTitle: r.title || 'Sem título' }))
  ].filter(r => !searchLower || r.caseId?.toLowerCase().includes(searchLower) || r.parsedTitle?.toLowerCase().includes(searchLower) || matchingCaseIds.has(r.caseId));

  const displayedEvents = events.filter(e => !searchLower || e.title?.toLowerCase().includes(searchLower) || e.type?.toLowerCase().includes(searchLower) || matchingCaseIds.has(e.caseId) || (e.clientId && matchingClientIds.has(e.clientId)));

  const displayedEdrpCases = cases.filter(ca => {
    if (!matchingCaseIds.has(ca.id)) return false;

    if (dashboardFilter === 'revisao') {
      return ca.protocolStatus === 'aguardando';
    }
    if (dashboardFilter === 'protocol') {
      return ca.protocolStatus === 'agendado';
    }
    if (dashboardFilter === 'protocolados') {
      return ca.protocolStatus === 'protocolado';
    }

    if (edrpFilter === 'all') return true;
    if (edrpFilter === 'sem_estruturacao') return !ca.structuring && !ca.edrp?.structuring;
    if (edrpFilter === 'sem_delegacao') return !ca.responsibleLawyer && !ca.delegation?.responsible;
    if (edrpFilter === 'aguardando_revisao') return ca.productionStage === 'revisao';
    if (edrpFilter === 'pronto_protocolo') return ca.productionStage === 'protocolo';
    if (edrpFilter === 'com_pendencia') return ca.productionStatus === 'com_pendencias';
    if (edrpFilter === 'protocolado') return ca.statusInterno === 'protocolado' || ca.status === 'protocolado';
    if (edrpFilter === 'controladoria') return ca.productionStage === 'controladoria';
    return true;
  });

  const handleOpenMasterEditor = (client: any) => {
    setSelectedMasterClient(client);
    setMasterEditorTab('identificacao');
    
    const pf = client.pfDadosPessoais || client.pfData || {};
    const pj = client.pjDadosEmpresa || client.pjData || {};
    const socio = client.socioDadosPessoais || client.socioData || {};
    const access = client.acessoSistema || {};
    const bancario = client.bancarioDadosBancarios || client.bancarioData || {};

    setMasterFormData({
      clientId: client.id || client.clientId,
      slug: client.slug || '',
      type: client.type || 'PF',
      active: client.active !== false,
      visibleToClient: client.visibleToClient !== false,
      portalStatus: client.portalStatus || 'criado',
      gdriveUrl: client.gdriveUrl || '',
      gdocsUrl: client.gdocsUrl || '',
      
      acesso_emailLogin: access.acesso_emailLogin || client.email || '',
      acesso_senha: access.acesso_senha || client.senhaVisivelPreview || '',
      acesso_statusAcesso: access.acesso_statusAcesso || 'ativo',

      pf_nomeCompleto: pf.pf_nomeCompleto || '',
      pf_cpf: pf.pf_cpf || '',
      pf_rg: pf.pf_rg || '',
      pf_dataNascimento: pf.pf_dataNascimento || pf.pf_nascimento || '',
      pf_nacionalidade: pf.pf_nacionalidade || '',
      pf_profissao: pf.pf_profissao || '',
      pf_estadoCivil: pf.pf_estadoCivil || '',
      pf_email: pf.pf_email || '',
      pf_telefone: pf.pf_telefone || '',
      pf_whatsapp: pf.pf_whatsapp || '',
      pf_cep: pf.pf_cep || '',
      pf_endereco: pf.pf_endereco || '',
      pf_numero: pf.pf_numero || '',
      pf_bairro: pf.pf_bairro || '',
      pf_cidade: pf.pf_cidade || '',
      pf_estado: pf.pf_estado || '',

      pj_razaoSocial: pj.pj_razaoSocial || '',
      pj_nomeFantasia: pj.pj_nomeFantasia || '',
      pj_cnpj: pj.pj_cnpj || '',
      pj_telefoneEmpresa: pj.pj_telefoneEmpresa || '',
      pj_whatsappEmpresa: pj.pj_whatsappEmpresa || '',
      pj_cepEmpresa: pj.pj_cepEmpresa || '',
      pj_enderecoEmpresa: pj.pj_enderecoEmpresa || '',
      pj_bairroEmpresa: pj.pj_bairroEmpresa || '',
      pj_cidadeEmpresa: pj.pj_cidadeEmpresa || '',
      pj_estadoEmpresa: pj.pj_estadoEmpresa || '',

      socio_nomeCompleto: socio.socio_nomeCompleto || '',
      socio_cpf: socio.socio_cpf || '',
      socio_rg: socio.socio_rg || '',
      socio_dataNascimento: socio.socio_dataNascimento || '',
      socio_profissao: socio.socio_profissao || '',
      socio_estadoCivil: socio.socio_estadoCivil || '',
      socio_cep: socio.socio_cep || '',
      socio_endereco: socio.socio_endereco || '',
      socio_bairro: socio.socio_bairro || '',
      socio_cidade: socio.socio_cidade || '',
      socio_estado: socio.socio_estado || '',

      bancario_possuiDadosBancarios: bancario.bancario_possuiDadosBancarios || false,
      bancario_tipoChavePix: bancario.bancario_tipoChavePix || '',
      bancario_chavePix: bancario.bancario_chavePix || '',
      bancario_bancoPix: bancario.bancario_bancoPix || '',
      bancario_titularPix: bancario.bancario_titularPix || '',
      bancario_banco: bancario.bancario_banco || '',
      bancario_agencia: bancario.bancario_agencia || '',
      bancario_conta: bancario.bancario_conta || '',
      bancario_tipoConta: bancario.bancario_tipoConta || '',
      bancario_titularConta: bancario.bancario_titularConta || '',
      bancario_titularEhCliente: bancario.bancario_titularEhCliente || false,
      bancario_usarCpfComoPix: bancario.bancario_usarCpfComoPix || false,

      showDashboard: client.showDashboard !== false,
      showCadastros: client.showCadastros !== false,
      showCasos: client.showCasos !== false,
      showProvas: client.showProvas !== false,
      showInformacoes: client.showInformacoes !== false,
      showAudiencias: client.showAudiencias !== false,
      showPericias: client.showPericias !== false,
      showReunioes: client.showReunioes !== false,
      showFinanceiro: client.showFinanceiro !== false,

      gdocsContractUrl: client.gdocsContractUrl || '',
      gdocsPowerOfAttorneyUrl: client.gdocsPowerOfAttorneyUrl || '',
      gdocsDeclaraUrl: client.gdocsDeclaraUrl || '',
      gdocsDraftUrl: client.gdocsDraftUrl || '',

      publicTimeline: client.publicTimeline || [],

      masterEditorLogs: client.masterEditorLogs || []
    });
  };

  const updateMasterField = (key: string, value: any) => {
    setMasterFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSaveMasterEditor = async () => {
    setLoading(true);
    try {
      const rightNow = new Date().toISOString();
      const targetId = masterFormData.clientId;
      const oldSlug = selectedMasterClient.slug || '';
      const newSlug = masterFormData.slug || '';

      if (newSlug !== oldSlug) {
        const checkSnap = await getDoc(doc(db, 'clientPortals', newSlug));
        if (checkSnap.exists()) {
          alert(`Erro: O slug [/${newSlug}] já está sendo utilizado por outro portal.`);
          setLoading(false);
          return;
        }
      }

      const updatedDiffFields: string[] = [];
      const previous = selectedMasterClient;
      
      const checkUpdate = (fieldKey: string, newVal: any, oldVal: any) => {
        if (newVal !== oldVal) {
          updatedDiffFields.push(fieldKey);
        }
      };

      checkUpdate('name', masterFormData.pf_nomeCompleto || masterFormData.pj_razaoSocial, previous.pfDadosPessoais?.pf_nomeCompleto || previous.pjDadosEmpresa?.pj_razaoSocial);
      checkUpdate('slug', newSlug, oldSlug);
      checkUpdate('visibleToClient', masterFormData.visibleToClient, previous.visibleToClient);
      checkUpdate('active', masterFormData.active, previous.active);
      checkUpdate('gdriveUrl', masterFormData.gdriveUrl, previous.gdriveUrl);
      checkUpdate('gdocsUrl', masterFormData.gdocsUrl, previous.gdocsUrl);

      const logEntry = {
        action: 'MASTER_EDITOR_SUBMIT',
        timestamp: rightNow,
        fieldsUpdated: updatedDiffFields.length > 0 ? updatedDiffFields : ['multiple_subblocks'],
        operator: 'BOSS_PORTAL_ADMIN'
      };

      const newLogsList = [logEntry, ...(masterFormData.masterEditorLogs || [])];

      // Save full, independent audit log document to masterEditorLogs collection
      try {
        const docLogId = 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        await setDoc(doc(db, 'masterEditorLogs', docLogId), {
          id: docLogId,
          clientId: targetId,
          caseId: '',
          areaChanged: updatedDiffFields.length > 0 ? updatedDiffFields.join(', ') : 'Várias Áreas',
          action: 'MASTER_EDITOR_SUBMIT',
          previousValue: JSON.stringify({
            slug: oldSlug,
            active: previous.active,
            visibleToClient: previous.visibleToClient
          }),
          newValue: JSON.stringify({
            slug: newSlug,
            active: masterFormData.active,
            visibleToClient: masterFormData.visibleToClient
          }),
          changedBy: 'BOSS_PORTAL_ADMIN',
          changedAt: rightNow,
          reason: 'Sincronização manual via Editor do Painel'
        });
      } catch (logErr) {
        console.warn("Aviso ao salvar log na coleção 'masterEditorLogs':", logErr);
      }

      const syncedPayload: any = {
        ...previous,
        clientId: targetId,
        type: masterFormData.type,
        active: masterFormData.active,
        visibleToClient: masterFormData.visibleToClient,
        portalStatus: masterFormData.portalStatus,
        slug: newSlug,
        senhaVisivelPreview: masterFormData.acesso_senha,
        gdriveUrl: masterFormData.gdriveUrl,
        gdocsUrl: masterFormData.gdocsUrl,
        updatedAt: rightNow,
        masterEditorLogs: newLogsList,

        // Modular display switches
        showDashboard: masterFormData.showDashboard !== false,
        showCadastros: masterFormData.showCadastros !== false,
        showCasos: masterFormData.showCasos !== false,
        showProvas: masterFormData.showProvas !== false,
        showInformacoes: masterFormData.showInformacoes !== false,
        showAudiencias: masterFormData.showAudiencias !== false,
        showPericias: masterFormData.showPericias !== false,
        showReunioes: masterFormData.showReunioes !== false,
        showFinanceiro: masterFormData.showFinanceiro !== false,

        // Extended Custom GDocs Draft templates
        gdocsContractUrl: masterFormData.gdocsContractUrl || '',
        gdocsPowerOfAttorneyUrl: masterFormData.gdocsPowerOfAttorneyUrl || '',
        gdocsDeclaraUrl: masterFormData.gdocsDeclaraUrl || '',
        gdocsDraftUrl: masterFormData.gdocsDraftUrl || '',

        // Public notifications feed stream
        publicTimeline: masterFormData.publicTimeline || [],
        
        pfDadosPessoais: {
          pf_nomeCompleto: masterFormData.pf_nomeCompleto,
          pf_cpf: masterFormData.pf_cpf,
          pf_rg: masterFormData.pf_rg,
          pf_dataNascimento: masterFormData.pf_dataNascimento,
          pf_nacionalidade: masterFormData.pf_nacionalidade,
          pf_profissao: masterFormData.pf_profissao,
          pf_estadoCivil: masterFormData.pf_estadoCivil
        },
        pfContato: {
          pf_email: masterFormData.pf_email,
          pf_telefone: masterFormData.pf_telefone,
          pf_whatsapp: masterFormData.pf_whatsapp
        },
        pfEndereco: {
          pf_cep: masterFormData.pf_cep,
          pf_endereco: masterFormData.pf_endereco,
          pf_numero: masterFormData.pf_numero,
          pf_bairro: masterFormData.pf_bairro,
          pf_cidade: masterFormData.pf_cidade,
          pf_estado: masterFormData.pf_estado
        },

        pjDadosEmpresa: {
          pj_razaoSocial: masterFormData.pj_razaoSocial,
          pj_nomeFantasia: masterFormData.pj_nomeFantasia,
          pj_cnpj: masterFormData.pj_cnpj,
          pj_telefoneEmpresa: masterFormData.pj_telefoneEmpresa,
          pj_whatsappEmpresa: masterFormData.pj_whatsappEmpresa,
          pj_cepEmpresa: masterFormData.pj_cepEmpresa,
          pj_enderecoEmpresa: masterFormData.pj_enderecoEmpresa,
          pj_bairroEmpresa: masterFormData.pj_bairroEmpresa,
          pj_cidadeEmpresa: masterFormData.pj_cidadeEmpresa,
          pj_estadoEmpresa: masterFormData.pj_estadoEmpresa
        },

        socioDadosPessoais: {
          socio_nomeCompleto: masterFormData.socio_nomeCompleto,
          socio_cpf: masterFormData.socio_cpf,
          socio_rg: masterFormData.socio_rg,
          socio_dataNascimento: masterFormData.socio_dataNascimento,
          socio_profissao: masterFormData.socio_profissao,
          socio_estadoCivil: masterFormData.socio_estadoCivil,
          socio_cep: masterFormData.socio_cep,
          socio_endereco: masterFormData.socio_endereco,
          socio_bairro: masterFormData.socio_bairro,
          socio_cidade: masterFormData.socio_cidade,
          socio_estado: masterFormData.socio_estado
        },

        bancarioDadosBancarios: {
          bancario_possuiDadosBancarios: masterFormData.bancario_possuiDadosBancarios,
          bancario_tipoChavePix: masterFormData.bancario_tipoChavePix,
          bancario_chavePix: masterFormData.bancario_chavePix,
          bancario_bancoPix: masterFormData.bancario_bancoPix,
          bancario_titularPix: masterFormData.bancario_titularPix,
          bancario_banco: masterFormData.bancario_banco,
          bancario_agencia: masterFormData.bancario_agencia,
          bancario_conta: masterFormData.bancario_conta,
          bancario_tipoConta: masterFormData.bancario_tipoConta,
          bancario_titularConta: masterFormData.bancario_titularConta,
          bancario_titularEhCliente: masterFormData.bancario_titularEhCliente,
          bancario_usarCpfComoPix: masterFormData.bancario_usarCpfComoPix
        },

        acessoSistema: {
          acesso_emailLogin: masterFormData.acesso_emailLogin,
          acesso_statusAcesso: masterFormData.acesso_statusAcesso,
          acesso_senha: masterFormData.acesso_senha
        },

        portalMirror: {
          name: masterFormData.type === 'PF' ? masterFormData.pf_nomeCompleto : masterFormData.pj_razaoSocial,
          type: masterFormData.type,
          pfDadosPessoais: {
            nomeCompleto: masterFormData.pf_nomeCompleto,
            cpf: masterFormData.pf_cpf,
            rg: masterFormData.pf_rg,
            dataNascimento: masterFormData.pf_dataNascimento,
            nacionalidade: masterFormData.pf_nacionalidade,
            profissao: masterFormData.pf_profissao,
            estadoCivil: masterFormData.pf_estadoCivil
          },
          pfContato: {
            email: masterFormData.pf_email,
            telefone: masterFormData.pf_telefone,
            whatsapp: masterFormData.pf_whatsapp
          },
          pfEndereco: {
            cep: masterFormData.pf_cep,
            logradouro: masterFormData.pf_endereco,
            numero: masterFormData.pf_numero,
            bairro: masterFormData.pf_bairro,
            cidade: masterFormData.pf_cidade,
            uf: masterFormData.pf_estado
          },
          dadosBancariosOpcional: {
            bancario_possuiDadosBancarios: masterFormData.bancario_possuiDadosBancarios,
            tipoPix: masterFormData.bancario_tipoChavePix,
            chavePix: masterFormData.bancario_chavePix,
            banco: masterFormData.bancario_banco,
            agencia: masterFormData.bancario_agencia,
            conta: masterFormData.bancario_conta,
            tipoConta: masterFormData.bancario_tipoConta,
            titular: masterFormData.bancario_titularConta
          }
        }
      };

      await setDoc(doc(db, 'clients', targetId), syncedPayload);

      if (oldSlug !== newSlug) {
        if (oldSlug) {
          await deleteDoc(doc(db, 'clientPortals', oldSlug));
        }
        await setDoc(doc(db, 'clientPortals', newSlug), {
          clientId: targetId,
          slug: newSlug,
          active: masterFormData.active,
          createdAt: rightNow,
          updatedAt: rightNow
        });
      } else {
        await updateDoc(doc(db, 'clientPortals', newSlug), {
          active: masterFormData.active,
          updatedAt: rightNow
        });
      }

      // Action 1: Create or update credenciaisCliente/{targetId}
      await setDoc(doc(db, 'credenciaisCliente', targetId), {
        id: targetId,
        clienteId: targetId,
        slug: newSlug,
        login: masterFormData.acesso_emailLogin.toLowerCase().trim(),
        senha: masterFormData.acesso_senha,
        password: masterFormData.acesso_senha,
        ativo: masterFormData.active !== false,
        atualizadoEm: rightNow,
        criadoEm: previous.createdAt || previous.criadoEm || rightNow,
        ultimoAcesso: previous.ultimoAcesso || null,
        tentativasFalhas: previous.tentativasFalhas || 0,
        bloqueadoEm: previous.bloqueadoEm || null,
        observacoes: 'Credencial sincronizada pelo Editor Mestre da Central de Controle'
      }, { merge: true });

      // Action 2: Update users/{targetId} using merge: true
      await setDoc(doc(db, 'users', targetId), {
        email: masterFormData.acesso_emailLogin.toLowerCase().trim(),
        role: "client",
        clientId: targetId,
        clientSlug: newSlug,
        name: masterFormData.pf_nomeCompleto || masterFormData.pj_razaoSocial,
        status: masterFormData.acesso_statusAcesso || "ativo",
        senhaVisivelPreview: masterFormData.acesso_senha,
        updatedAt: rightNow
      }, { merge: true });

      // Action 3: Guarantee clientes/{targetId} with specified fields using merge: true
      await setDoc(doc(db, 'clientes', targetId), {
        id: targetId,
        clientId: targetId,
        slug: newSlug,
        nome: masterFormData.pf_nomeCompleto || masterFormData.pj_razaoSocial,
        name: masterFormData.pf_nomeCompleto || masterFormData.pj_razaoSocial,
        email: masterFormData.acesso_emailLogin.toLowerCase().trim(),
        status: "active",
        portalAtivo: true,
        atualizadoEm: rightNow,
        updatedAt: rightNow
      }, { merge: true });

      alert('Toda alteração gravada e espelhada no Portal do Cliente com sucesso! Log técnico de auditoria adicionado.');
      setSelectedMasterClient(null);
      loadAllCollections();
    } catch (err: any) {
      console.error(err);
      alert(`Falha ao salvar no Editor Mestre do Portal: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleForceSyncClient = async (c: any) => {
    setLoading(true);
    try {
      const rightNow = new Date().toISOString();
      const targetId = c.id;
      const slug = c.slug || '';
      
      const emailLogin = c.acessoSistema?.acesso_emailLogin || c.email || '';
      const password = c.acessoSistema?.acesso_senha || c.senhaVisivelPreview || '';
      const name = c.type === 'PF' 
        ? (c.pfDadosPessoais?.pf_nomeCompleto || c.pfData?.pf_nomeCompleto || 'Sem Nome')
        : (c.pjDadosEmpresa?.pj_razaoSocial || c.pjData?.pj_razaoSocial || 'Sem Razão Social');
        
      if (!emailLogin) {
        alert('Erro: O cliente não possui e-mail de login configurado no cadastro de acesso.');
        setLoading(false);
        return;
      }
      if (!password) {
        alert('Erro: O cliente não possui senha configurada no cadastro.');
        setLoading(false);
        return;
      }
      if (!slug) {
        alert('Erro: O cliente não possui slug de portal configurado.');
        setLoading(false);
        return;
      }

      // 1. clients - update clients document to ensure matches
      await setDoc(doc(db, 'clients', targetId), {
        email: emailLogin,
        slug: slug,
        senhaVisivelPreview: password,
        updatedAt: rightNow
      }, { merge: true });

      // 2. clientes - update clientes document
      await setDoc(doc(db, 'clientes', targetId), {
        id: targetId,
        clientId: targetId,
        slug: slug,
        nome: name,
        name: name,
        email: emailLogin.toLowerCase().trim(),
        status: "active",
        portalAtivo: true,
        atualizadoEm: rightNow,
        updatedAt: rightNow
      }, { merge: true });

      // 3. users - update users/targetId (for login lookup/roles)
      await setDoc(doc(db, 'users', targetId), {
        email: emailLogin.toLowerCase().trim(),
        role: "client",
        clientId: targetId,
        clientSlug: slug,
        name: name,
        status: c.acessoSistema?.acesso_statusAcesso || "ativo",
        senhaVisivelPreview: password,
        updatedAt: rightNow
      }, { merge: true });

      // 4. credenciaisCliente - update credentials lookup
      await setDoc(doc(db, 'credenciaisCliente', targetId), {
        id: targetId,
        clienteId: targetId,
        slug: slug,
        login: emailLogin.toLowerCase().trim(),
        senha: password,
        password: password,
        ativo: c.active !== false,
        atualizadoEm: rightNow,
        criadoEm: c.createdAt || c.criadoEm || rightNow,
        ultimoAcesso: c.ultimoAcesso || null,
        tentativasFalhas: c.tentativasFalhas || 0,
        bloqueadoEm: c.bloqueadoEm || null,
        observacoes: 'Credencial sincronizada pelo Editor Mestre da Central de Controle'
      }, { merge: true });

      // 5. clientPortals - update/set clientPortals
      await setDoc(doc(db, 'clientPortals', slug), {
        clientId: targetId,
        slug: slug,
        active: c.active !== false,
        updatedAt: rightNow
      }, { merge: true });

      alert('Acesso do Portal do Cliente recriado com sucesso. Use o e-mail e senha exibidos no cadastro.');
      loadAllCollections();
    } catch (err: any) {
      console.error(err);
      alert(`Erro na sincronização do portal: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // DB INTEGRITY AUDIT ENGINE (Aba 9 & Diagnostic computation)
  const runDiagnostic = () => {
    const criticalErrorsList: string[] = [];
    const warningList: string[] = [];

    clients.forEach(c => {
      const name = getClientDisplayName(c.id);
      if (!c.slug) {
        criticalErrorsList.push(`Cliente [${name}] está sem slug cadastrado.`);
      } else {
        const portal = clientPortals.find(p => p.slug === c.slug);
        if (!portal) {
          criticalErrorsList.push(`Tabela clientPortals ausente para o slug "/${c.slug}" do cliente.`);
        } else if (portal.clientId !== c.id) {
          criticalErrorsList.push(`Tabela clientPortals aponta para clientId incorreto para o slug "/${c.slug}".`);
        }
      }
    });

    cases.forEach(ca => {
      if (!ca.clientId) {
        criticalErrorsList.push(`Caso [${ca.title || ca.id}] está sem clientId.`);
      } else if (!clients.some(cl => cl.id === ca.clientId)) {
        criticalErrorsList.push(`Caso [${ca.title}] aponta para clientId inexistente: "${ca.clientId}".`);
      }
      if (!ca.clientSlug) {
        criticalErrorsList.push(`Caso [${ca.title}] está sem clientSlug.`);
      }
      if (!ca.statusInterno && !ca.status) {
        criticalErrorsList.push(`Caso [${ca.title}] está sem statusInterno.`);
      }
      if (!ca.statusPublicoCliente) {
        criticalErrorsList.push(`Caso [${ca.title}] está sem statusPublicoCliente.`);
      }

      // EDRP check warnings
      const hasStructuring = !!(ca.structuring || ca.edrp?.structuring);
      const hasDelegation = !!(ca.responsibleLawyer || ca.delegation?.responsible);
      if (!hasStructuring) warningList.push(`Processo [${ca.title}]: Estágio estruturação EDRP não está preenchido.`);
      if (!hasDelegation) warningList.push(`Processo [${ca.title}]: Estágio delegação EDRP sem responsável.`);
    });

    users.forEach(u => {
      if (u.role === 'client') {
        if (!u.clientId) criticalErrorsList.push(`Usuário client [${u.email}] está sem clientId.`);
        if (!u.clientSlug) criticalErrorsList.push(`Usuário client [${u.email}] está sem clientSlug.`);
      }
    });

    financials.forEach(f => {
      if (!f.caseId) {
        criticalErrorsList.push(`Faturamento [${f.id}] sem caseId.`);
      } else if (!cases.some(ca => ca.id === f.caseId)) {
        criticalErrorsList.push(`Faturamento [${f.id}] aponta para caseId inexistente: "${f.caseId}".`);
      }
    });

    // Connector Checklist warnings
    const hasStripe = portalSettings?.stripeActive || process.env.VITE_STRIPE_PUBLIC_KEY || false;
    const hasAsaas = portalSettings?.asaasActive || false;
    const hasDrive = portalSettings?.googleDriveConnected || false;

    if (!hasStripe && !hasAsaas) warningList.push("Provedor de finanças (Stripe / Asaas) não configurado ou inativo.");
    if (!hasDrive) warningList.push("Provedor Google Drive não está ativo na central de mídias.");

    let statusGeral: 'Pronto para deploy' | 'Pronto com ressalvas' | 'Não recomendado para deploy' = 'Pronto para deploy';
    if (criticalErrorsList.length > 0) {
      statusGeral = 'Não recomendado para deploy';
    } else if (warningList.length > 0) {
      statusGeral = 'Pronto com ressalvas';
    }

    return {
      criticalErrorsList,
      warningList,
      statusGeral
    };
  };

  const handleCopyResumo = () => {
    const { criticalErrorsList, statusGeral } = runDiagnostic();
    const totalP = cases.filter(c => c.productionStatus === 'com_pendencias').length;

    const summaryText = `Central de Controle BOSS — Diagnóstico
Clientes: ${clients.length}
Casos: ${cases.length}
Pendências: ${totalP}
Erros críticos: ${criticalErrorsList.length}
Status geral: ${statusGeral}
Recomendação: ${statusGeral === 'Não recomendado para deploy' ? 'Ajustar erros estruturais cadastrais do portal' : 'Sincronizações homologadas para produção'}`;

    copyToClipboard(summaryText, 'Resumo do diagnóstico administrativo copiado!');
  };

  const togglePortalSuspension = async (client: any, activeState: boolean) => {
    try {
      await updateDoc(doc(db, 'clients', client.id), { active: activeState });
      if (client.slug) {
        await updateDoc(doc(db, 'clientPortals', client.slug), { active: activeState });
      }
      alert(`Acesso ao portal de ${client.slug} definido como: ${activeState ? 'ATIVO' : 'SUSPENSO'}`);
      loadAllCollections();
    } catch (err) {
      console.error(err);
      alert('Incapaz de atualizar estado de ativação do portal de clientes.');
    }
  };

  const handleMarkRequestStatus = async (req: any, newStatus: string) => {
    try {
      const colName = req.reqType === 'Informação' ? 'caseInformationRequests' : 'caseEvidenceRequests';
      await updateDoc(doc(db, colName, req.id), {
        status: newStatus,
        bossFeedback: `Avaliado pelo BOSS - ${newStatus.toUpperCase()}`,
        updatedAt: new Date()
      });
      alert(`Solicitação marcada como: ${newStatus.toUpperCase()}`);
      loadAllCollections();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkFinancialAttention = async (f: any) => {
    try {
      await updateDoc(doc(db, 'caseFinancials', f.id), {
        status: 'Atrasado',
        webhookStatus: 'Cobrança manual e auditoria solicitada pelo BOSS',
        attentionFlagged: true
      });
      alert('Alerta de atenção administrativa anexado ao lançamento de faturamento.');
      loadAllCollections();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmDeleteClient = async () => {
    if (!clientToDelete) return;
    setIsDeletingClient(true);
    try {
      const targetId = clientToDelete.id;
      const slug = clientToDelete.slug;

      // 1. Delete client documents
      await deleteDoc(doc(db, 'clients', targetId));
      await deleteDoc(doc(db, 'clientes', targetId));
      await deleteDoc(doc(db, 'users', targetId));
      await deleteDoc(doc(db, 'users_invites', targetId));
      await deleteDoc(doc(db, 'credenciaisCliente', targetId));

      // 2. Delete slug/portal mapping
      if (slug) {
        await deleteDoc(doc(db, 'clientPortals', slug));
      }

      // 3. Delete linked cases & casos
      const casesToDelete = cases.filter(ca => ca.clientId === targetId || ca.clienteId === targetId);
      const deletePromises: Promise<void>[] = [];
      casesToDelete.forEach(ca => {
        deletePromises.push(deleteDoc(doc(db, 'cases', ca.id)));
        deletePromises.push(deleteDoc(doc(db, 'casos', ca.id)));
      });
      await Promise.all(deletePromises);

      alert(`Cadastro de "${getClientDisplayName(targetId)}" e seus acessos foram excluídos definitivamente do banco de dados.`);
      setClientToDelete(null);
      setSafeDeleteWarning(null);
      await loadAllCollections();
    } catch (err: any) {
      console.error('Erro ao excluir cliente completo:', err);
      alert(`Falha ao excluir cliente completo: ${err.message || err}`);
    } finally {
      setIsDeletingClient(false);
    }
  };

  const diag = runDiagnostic();

  return (
    <BossLayout>
      <div 
        className={`space-y-6 font-sans max-w-7xl mx-auto transition-all duration-300 ${
          highlighterActive ? 'select-text cursor-crosshair bg-yellow-50/10' : 'select-none'
        }`}
        onMouseUp={handleMouseUp}
      >
        
        {/* Dynamic Admin Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-150 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-indigo-650 rounded-xl flex items-center justify-center text-white shadow-md">
              <Sliders size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none mb-1">Central de Controle BOSS</h1>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider font-mono">Consola Mestre de Auditoria e Integridade</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2 lg:mb-0">
            {/* Modo Sublinhador buttons group */}
            <button
              type="button"
              onClick={() => setHighlighterActive(!highlighterActive)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border transition-all ${
                highlighterActive 
                  ? 'bg-amber-500 hover:bg-amber-600 border-amber-600 text-white shadow-sm ring-2 ring-amber-200' 
                  : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
              }`}
            >
              <Highlighter size={13} className={highlighterActive ? "animate-pulse" : ""} />
              <span>{highlighterActive ? 'Sublinhador: ATIVO' : 'Modo Sublinhador'}</span>
            </button>
            <button
              type="button"
              onClick={handleClearHighlights}
              className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-rose-50 hover:text-rose-600 rounded-xl text-xs font-bold text-gray-700 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Limpar todas as marcações temporárias de realce de texto"
            >
              <Eraser size={13} />
              <span>Limpar Marcações</span>
            </button>

            <button
              onClick={() => {
                loadAllCollections();
                alert('Banco de dados sincronizado!');
              }}
              className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-indigo-500" : ""} />
              <span>Sincronizar Banco</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('integridade');
                alert('Diagnóstico estrutural recalculado abaixo.');
              }}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold font-mono border border-amber-200 flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert size={14} />
              <span>Gerar Diagnose</span>
            </button>
            <button
              onClick={handleCopyResumo}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Copy size={13} />
              <span>Copiar Resumo</span>
            </button>
            <button
              onClick={() => navigate('/boss-giffoni-clientes/configurações')}
              className="px-3.5 py-2 bg-gray-50 border border-gray-200 hover:bg-gray-150 rounded-xl text-xs font-bold text-gray-650 cursor-pointer text-center"
            >
              Ir para Conectores
            </button>
            <button
              onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer text-center"
            >
              Painel de Produção
            </button>
          </div>
        </div>

        {/* Global Multi-symmetric Search Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-3xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisa global: Nome, CPF, CNPJ, e-mail, telefone, slug, clientId, caseId, número CNJ, serviço, status faturamento, etc..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold placeholder:text-gray-400"
            />
            <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="px-3 py-2 bg-gray-100 text-gray-500 font-bold rounded-lg text-xs"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Espaço de Status e Métricas Dedicado */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {[
            { id: 'incompletos', label: 'Cadastros Incompletos', count: clients.filter(c => c.cadastroIncompleto === true).length, color: 'text-amber-600 bg-amber-50 border-amber-100', tab: 'clientes' },
            { id: 'producao', label: 'Casos em Produção', count: cases.filter(ca => ca.statusInterno === 'em_producao' || ca.status === 'em_producao' || ca.productionStatus === 'em_producao').length, color: 'text-indigo-600 bg-indigo-50 border-indigo-100', tab: 'casos' },
            { id: 'pendencias', label: 'Casos com Pendências', count: cases.filter(ca => ca.statusInterno === 'com_pendencias' || ca.status === 'com_pendencias' || ca.productionStatus === 'com_pendencias').length, color: 'text-rose-600 bg-rose-50 border-rose-100', tab: 'casos' },
            { id: 'revisao', label: 'Casos p/ Revisão', count: cases.filter(ca => ca.protocolStatus === 'aguardando').length, color: 'text-orange-600 bg-orange-50 border-orange-100', tab: 'edrp' },
            { id: 'protocol', label: 'Casos p/ Protocolo', count: cases.filter(ca => ca.protocolStatus === 'agendado').length, color: 'text-cyan-600 bg-cyan-50 border-cyan-100', tab: 'edrp' },
            { id: 'protocolados', label: 'Casos Protocolados', count: cases.filter(ca => ca.protocolStatus === 'protocolado').length, color: 'text-emerald-700 bg-emerald-50 border-emerald-100', tab: 'edrp' },
          ].map((card) => {
            const isSelected = dashboardFilter === card.id;
            return (
              <button
                key={card.id}
                onClick={() => {
                  if (isSelected) {
                    setDashboardFilter(null);
                  } else {
                    setDashboardFilter(card.id as any);
                    setActiveTab(card.tab as any);
                  }
                }}
                className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] cursor-pointer shadow-3xs ${
                  isSelected 
                    ? 'ring-2 ring-indigo-600 bg-white border-transparent text-indigo-700' 
                    : `${card.color} hover:bg-opacity-80`
                }`}
              >
                <span className="text-2xl font-black">{card.count}</span>
                <span className="text-[10px] font-black uppercase tracking-wider mt-1 text-gray-700 block">{card.label}</span>
              </button>
            );
          })}
        </div>

        {dashboardFilter && (
          <div className="flex items-center justify-between p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-800">
            <span>Filtro de métrica em exibição nas abas abaixo: {dashboardFilter.toUpperCase()}</span>
            <button 
              onClick={() => setDashboardFilter(null)} 
              className="px-3 py-1 bg-white text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-105 cursor-pointer text-[10px] uppercase font-black"
            >
              Remover Filtro
            </button>
          </div>
        )}

        {/* Tab Navigation Tray (9 items requested) */}
        <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto pb-1.5 scrollbar-none">
          {[
            { id: 'clientes', label: 'Clientes', count: displayedClients.length },
            { id: 'casos', label: 'Casos / Processos', count: displayedCases.length },
            { id: 'slugs', label: 'Slugs & Rotas', count: displayedSlugs.length },
            { id: 'usuarios', label: 'Acessos & Contas', count: displayedUsers.length },
            { id: 'financeiro', label: 'Financeiro', count: displayedFinancials.length },
            { id: 'solicitacoes', label: 'Solicitações (Info/Provas)', count: combinedRequests.length },
            { id: 'agenda', label: 'Agenda & Atos', count: displayedEvents.length },
            { id: 'edrp', label: 'Esteira EDRP', count: displayedEdrpCases.length },
            { id: 'integridade', label: 'Auditoria de Deploy', count: diag.criticalErrorsList.length, warning: true },
          ].map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as TabId)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950'
                }`}
              >
                <span>{t.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-black ${
                  isActive 
                    ? 'bg-indigo-800 text-indigo-100' 
                    : t.warning && t.count > 0 
                      ? 'bg-rose-100 text-rose-700' 
                      : 'bg-gray-150 text-gray-700'
                }`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* LOADING BOX CONTAINER */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-gray-100 rounded-3xl gap-2 font-mono">
            <div className="w-8 h-8 border-4 border-gray-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <span className="text-xs text-gray-500 uppercase font-black tracking-wider">Aguarde. Carregando bancos...</span>
          </div>
        )}

        {/* CURRENT ACTIVE TAB BODY */}
        {!loading && (
          <div className="min-h-[300px]">
            
            {/* ABA 1: CLIENTES */}
            {activeTab === 'clientes' && (
              <div className="space-y-6">
                {displayedClients.length === 0 ? (
                  <div className="bg-white border border-gray-150 rounded-2xl p-10 text-center text-gray-500 italic text-[16px]">
                    Nenhum cliente cadastrado atende aos critérios descritos.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {displayedClients.map(c => {
                      const clientName = getClientDisplayName(c.id);
                      const numCasos = cases.filter(ca => ca.clientId === c.id).length;
                      return (
                        <div 
                          key={c.id} 
                          className="bg-white border border-gray-200/90 rounded-[24px] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-6 hover:border-indigo-200"
                        >
                          {/* TOP HEADER: Nome do cliente, Processos, e Status GERAL */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-gray-100 pb-5">
                            <div className="space-y-2">
                              <h3 className="text-[19px] md:text-[20px] font-black text-gray-900 tracking-tight leading-tight">
                                {clientName}
                              </h3>
                              <span className="text-[15px] text-indigo-600 font-bold block font-mono">
                                {numCasos} processo(s) vinculado(s)
                              </span>
                              
                              {/* Status do Portal & Integridade */}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {c.portalStatus === 'criado' ? (
                                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[13px] font-bold">
                                    Portal criado
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 bg-amber-50 text-amber-850 border border-amber-100 rounded-lg text-[13px] font-bold">
                                    Portal não criado
                                  </span>
                                )}
                                {c.cadastroIncompleto === true ? (
                                  <span 
                                    className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-[13px] font-bold" 
                                    title={c.missingFields && c.missingFields.length > 0 ? `Campos faltantes: ${c.missingFields.join(', ')}` : 'Cadastro incompleto'}
                                  >
                                    Cadastro incompleto
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-150 rounded-lg text-[13px] font-bold">
                                    Cadastro completo
                                  </span>
                                )}
                              </div>
                              {c.cadastroIncompleto === true && c.missingFields && c.missingFields.length > 0 && (
                                <span className="text-[14px] text-rose-600 block mt-1 font-semibold">
                                  Falta preencher: {c.missingFields.join(', ')}
                                </span>
                              )}
                            </div>
                            
                            <div className="sm:text-right shrink-0">
                              <span className={`inline-block px-4 py-1.5 rounded-full text-[15px] font-black uppercase tracking-wider ${
                                c.active !== false 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' 
                                  : 'bg-rose-50 text-rose-700 border border-rose-250'
                              }`}>
                                {c.active !== false ? 'Ativo' : 'Suspenso'}
                              </span>
                            </div>
                          </div>

                          {/* BODY BLOCKS: Identificação, Contato, Portal */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[15px] text-gray-750">
                            {/* Bloco 1: Identificação */}
                            <div 
                              onClick={() => setSelectedDetailBlock({ client: c, type: 'identificacao' })}
                              className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 space-y-2 flex flex-col justify-between hover:bg-indigo-50/25 hover:border-indigo-300 hover:scale-[1.01] cursor-pointer transition-all duration-200"
                              title="Clique para ver detalhes de Identificação"
                            >
                              <div>
                                <span className="text-[12px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                                  Identificação
                                </span>
                                <span className="text-[13px] font-medium text-gray-500 block">CPF / CNPJ</span>
                                <code className="font-mono text-[15px] font-bold text-gray-900 block truncate">
                                  {getClientDocument(c) || 'Não informado'}
                                </code>
                              </div>
                              <div className="pt-2 border-t border-gray-200/50">
                                <span className="text-[13px] font-medium text-gray-500 block">Instância ID</span>
                                <code className="font-mono text-[14px] text-gray-650 block select-all bg-white px-1.5 py-0.5 rounded border border-gray-150 truncate" title={c.id}>
                                  {c.id}
                                </code>
                              </div>
                            </div>

                            {/* Bloco 2: Contato */}
                            <div 
                              onClick={() => setSelectedDetailBlock({ client: c, type: 'contato' })}
                              className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 space-y-2 flex flex-col justify-between hover:bg-indigo-50/25 hover:border-indigo-300 hover:scale-[1.01] cursor-pointer transition-all duration-200"
                              title="Clique para ver detalhes de Contato"
                            >
                              <div>
                                <span className="text-[12px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                                  Contato
                                </span>
                                <span className="text-[13px] font-medium text-gray-500 block">E-mail de Acesso</span>
                                <span className="text-[15px] font-semibold text-gray-900 block truncate" title={getClientEmail(c)}>
                                  {getClientEmail(c) || 'Não cadastrado'}
                                </span>
                              </div>
                              <div className="pt-2 border-t border-gray-200/50">
                                <span className="text-[13px] font-medium text-gray-500 block">Telefone Celular</span>
                                <span className="text-[15px] font-semibold text-gray-900 block truncate">
                                  {getClientPhone(c) || 'Não cadastrado'}
                                </span>
                              </div>
                            </div>

                            {/* Bloco 3: Portal config */}
                            <div 
                              onClick={() => setSelectedDetailBlock({ client: c, type: 'portal' })}
                              className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50 space-y-2 flex flex-col justify-between hover:bg-indigo-50/70 hover:border-indigo-300 hover:scale-[1.01] cursor-pointer transition-all duration-200"
                              title="Clique para ver detalhes de Configurações Portal"
                            >
                              <div>
                                <span className="text-[12px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">
                                  Configurações Portal
                                </span>
                                <span className="text-[13px] font-medium text-gray-500 block">Endereço Slug</span>
                                <span className="font-mono font-bold text-indigo-650 text-[15px] block truncate">
                                  /{c.slug || 'sem-slug'}
                                </span>
                              </div>
                              <div className="pt-2 border-t border-indigo-100/50">
                                <span className="text-[14px] font-medium text-gray-500 block">Status de Acesso</span>
                                <span className="text-[15px] font-bold text-indigo-900 block">
                                  {c.portalAtivo !== false ? 'Habilitado' : 'Suspenso'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* ACTIONS FOOTER ROWS BAR */}
                          <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-2 justify-end">
                            <button
                              onClick={() => navigate(`/boss-giffoni-clientes/clientes/${c.id}`)}
                              className="px-3.5 py-2 hover:bg-gray-100 text-[15px] font-extrabold text-gray-750 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer transition-colors"
                            >
                              Abrir
                            </button>
                            <button
                              onClick={() => navigate(`/boss-giffoni-clientes/portal-cliente-preview/${c.id}`)}
                              className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-[15px] font-extrabold text-purple-700 rounded-xl cursor-pointer transition-colors"
                            >
                              Preview
                            </button>
                            <button
                              onClick={() => {
                                const link = portalSettings?.link || 'https://aistudio.google.com/apps/93c62126-a17f-4c18-8bc7-d327df1ca6b5?showPreview=true&showAssistant=true';
                                window.open(link, '_blank');
                              }}
                              className="px-3.5 py-2 bg-white border border-gray-250 hover:bg-gray-55 text-[15px] font-extrabold text-gray-700 rounded-xl cursor-pointer transition-colors shadow-2xs"
                            >
                              App Externo
                            </button>
                            <button
                              onClick={() => handleOpenMasterEditor(c)}
                              className="px-3.5 py-2 bg-blue-650 hover:bg-blue-750 text-[15px] text-white rounded-xl font-extrabold cursor-pointer transition-colors shadow-sm shadow-blue-100"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => {
                                const slugStr = c?.slug;
                                if (!slugStr) {
                                  alert("Não foi possível abrir o Editor do Portal porque o cliente não possui slug cadastrado.");
                                  return;
                                }
                                navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slugStr}/Editar-Painel-Geral-do-Cliente`);
                              }}
                              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-[15px] text-white rounded-xl font-extrabold cursor-pointer transition-colors shadow-sm shadow-indigo-100"
                            >
                              Editar Painel do Cliente
                            </button>
                            <button
                              onClick={() => togglePortalSuspension(c, c.active === false)}
                              className={`px-3.5 py-2 rounded-xl text-[15px] font-extrabold uppercase tracking-wide cursor-pointer transition-all ${
                                c.active !== false 
                                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200/50' 
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-850 border border-emerald-200/50'
                              }`}
                            >
                              {c.active !== false ? 'Suspender' : 'Reativar'}
                            </button>
                            <button
                              onClick={() => {
                                setActiveTab('integridade');
                                setSearchTerm(c.slug || '');
                              }}
                              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-[15px] text-slate-700 rounded-xl cursor-pointer font-extrabold transition-colors"
                            >
                              Integridade
                            </button>
                            <button
                              onClick={() => handleForceSyncClient(c)}
                              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-[15px] text-indigo-750 border border-indigo-200 rounded-xl cursor-pointer font-extrabold transition-colors"
                              title="Sincronizar credenciais e recriar acessos do portal"
                            >
                              Recriar acesso do Portal
                            </button>
                            <button
                              onClick={() => {
                                setClientToDelete(c);
                                setSafeDeleteWarning(c.id);
                              }}
                              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-[15px] text-red-600 rounded-xl font-extrabold cursor-pointer transition-colors"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: CASOS */}
            {activeTab === 'casos' && (
              <div className="space-y-4">
                {/* Cases Filter Tabs Row */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'all', label: 'Todos os Casos' },
                    { id: 'em_producao', label: 'Em Produção' },
                    { id: 'com_pendencias', label: 'Com Pendências' },
                    { id: 'pronto_relatorio', label: 'Pronto p/ Relatório' },
                    { id: 'concluido', label: 'Concluídos' },
                    { id: 'concluido_ressalvas', label: 'Concluído com Ressalvas' },
                    { id: 'arquivado', label: 'Arquivados' }
                  ].map((f) => {
                    const isSel = casesFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setCasesFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer ${
                          isSel ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div className="bg-white border border-gray-150 rounded-2xl shadow-3xs overflow-hidden">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">ID / Pasta</th>
                        <th className="py-3">Título / Serviço</th>
                        <th className="py-3">Cliente (Slug)</th>
                        <th className="py-3">Processo Nº CNJ</th>
                        <th className="py-3">Responsável</th>
                        <th className="py-3 text-center">Status Interno</th>
                        <th className="py-3 text-center">Status Público</th>
                        <th className="py-3 text-right pr-4">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                      {displayedCases.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-gray-400 italic font-medium">Nenhum caso encontrado para este filtro de busca.</td>
                        </tr>
                      ) : (
                        displayedCases.map(ca => {
                          const clientName = getClientDisplayName(ca.clientId);
                          return (
                            <tr key={ca.id} className="hover:bg-gray-50/40">
                              <td className="py-4 px-4 font-mono text-xs text-gray-400 font-bold block mt-1">{ca.id}</td>
                              <td className="py-4">
                                <span className="font-extrabold text-gray-900 block">{ca.title}</span>
                                <span className="text-xs text-gray-500 font-semibold block uppercase mt-1">{ca.registrationType || 'Tese judicial'}</span>
                              </td>
                              <td className="py-4">
                                <span className="font-semibold block">{clientName}</span>
                                <span className="text-xs text-indigo-650 font-mono font-bold block mt-1">/{ca.clientSlug}</span>
                              </td>
                              <td className="py-4 font-mono text-gray-450 font-semibold">{ca.processNumber || 'Extrajudicial / Administrativo'}</td>
                              <td className="py-4 text-gray-600 font-bold">{ca.responsibleLawyer || 'Não Designado'}</td>
                              <td className="py-4 text-center">
                                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-bold uppercase">
                                  {ca.statusInterno || ca.status || 'Pendente'}
                                </span>
                              </td>
                              <td className="py-4 text-center">
                                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold uppercase">
                                  {ca.statusPublicoCliente || 'Aguardando'}
                                </span>
                              </td>
                              <td className="py-4 text-right pr-4 space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao?caseId=${ca.id}`)}
                                  className="px-3 py-1.5 bg-emerald-600 font-bold text-white hover:bg-emerald-700 rounded-lg cursor-pointer text-xs"
                                >
                                  Continuar Fluxo
                                </button>
                                <button
                                  onClick={() => navigate(`/boss-giffoni-clientes/portal-cliente-preview/${ca.clientId}`)}
                                  className="px-3 py-1.5 bg-indigo-50 text-indigo-750 hover:bg-indigo-100 rounded-lg text-xs font-bold cursor-pointer"
                                >
                                  Espelho Público
                                </button>
                                <button
                                  onClick={() => copyToClipboard(ca.id, 'ID do Caso Copiado!')}
                                  className="px-2.5 py-1.5 bg-white border border-gray-200 text-xs font-semibold text-gray-750 hover:bg-gray-50 rounded-lg"
                                >
                                  ID
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 3: SLUGS */}
            {activeTab === 'slugs' && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-950 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs font-semibold">
                    <p className="font-extrabold text-amber-900">Segurança de Rota: Slug Travado</p>
                    <p className="text-amber-800 font-medium">O slug de sincronização é estabelecido no momento do cadastro do portal e travado em produção. Para resolver inconsistências, uma correção técnica controlada do BOSS é necessária.</p>
                  </div>
                </div>

                <div className="bg-white border border-gray-150 rounded-2xl shadow-3xs overflow-hidden">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Identificador Slug</th>
                        <th className="py-3">Vínculo Cliente</th>
                        <th className="py-3">Coleção clients</th>
                        <th className="py-3 font-semibold">Coleção clientPortals</th>
                        <th className="py-3">Vínculo Consistente</th>
                        <th className="py-3">Estado de Ativação</th>
                        <th className="py-3">Rota Interna de Login</th>
                        <th className="py-3 text-right pr-4">Ações de Segurança</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                      {displayedSlugs.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-gray-400 italic font-mono">Nenhum portal cadastrado no clientPortals correspondente ao filtro.</td>
                        </tr>
                      ) : (
                        displayedSlugs.map(p => {
                          const cl = clients.find(c => c.slug === p.slug);
                          const existsInClients = !!cl;
                          const existsInPortals = clientPortals.some(port => port.slug === p.slug);
                          const isConsistent = cl && p.clientId === cl.id;

                          return (
                            <tr key={p.id} className="hover:bg-gray-50/40 font-mono">
                              <td className="py-4 px-4 font-extrabold text-indigo-600">/{p.slug}</td>
                              <td className="py-4 font-sans font-bold text-gray-900">{cl ? getClientDisplayName(cl.id) : 'Órfão'}</td>
                              <td className="py-4">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${existsInClients ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                  {existsInClients ? 'Cadastrado' : 'Ausente'}
                                </span>
                              </td>
                              <td className="py-4 font-semibold">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${existsInPortals ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                  {existsInPortals ? 'Registrado' : 'Incompleto'}
                                </span>
                              </td>
                              <td className="py-4">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${isConsistent ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                                  {isConsistent ? 'Sim' : 'Correção Técnica Necessária'}
                                </span>
                              </td>
                              <td className="py-4 font-sans font-bold">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${p.active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                  {p.active !== false ? 'Ativo' : 'Suspenso'}
                                </span>
                              </td>
                              <td className="py-4 text-gray-400">/portal-cliente-giffoni/{p.slug}/login</td>
                              <td className="py-4 text-right pr-4 font-sans space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => copyToClipboard(p.slug, 'Slug Copiado!')}
                                  className="px-2 py-1 bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Copiar Slug
                                </button>
                                <button
                                  onClick={() => copyToClipboard(`/portal-cliente-giffoni/${p.slug}/login`, 'Rota interna copiada!')}
                                  className="px-2 py-1 bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Copiar Rota
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 4: USUÁRIOS/ACESSOS */}
            {activeTab === 'usuarios' && (
              <div className="bg-white border border-gray-150 rounded-2xl shadow-3xs overflow-hidden">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">E-mail Credencial</th>
                      <th className="py-3">Role / Perfil</th>
                      <th className="py-3 font-semibold">Vínculo clientId</th>
                      <th className="py-3">Vínculo clientSlug</th>
                      <th className="py-3 text-center">Status</th>
                      <th className="py-3 text-center">Cadastro Existe?</th>
                      <th className="py-3 text-center">Portal Ativo?</th>
                      <th className="py-3 text-right pr-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                    {displayedUsers.map(u => {
                      const clientExists = clients.some(c => c.id === u.clientId);
                      const portalExists = clientPortals.some(p => p.slug === u.clientSlug);
                      return (
                        <tr key={u.id} className="hover:bg-gray-50/40">
                          <td className="py-4 px-4 text-xs">
                            <span className="font-extrabold text-gray-900 block">{u.email}</span>
                            {(() => {
                              const relatedClient = clients.find(cl => cl.id === u.clientId);
                              const password = u.senhaVisivelPreview || relatedClient?.senhaVisivelPreview || relatedClient?.acessoSistema?.acesso_senha;
                              if (!password) return null;
                              return (
                                <div className="mt-1.5 p-2 bg-amber-50 border border-amber-100 rounded-lg text-amber-850 text-[10px] font-sans">
                                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                                    <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Preview</span>
                                    <span>Senha: <span className="font-mono text-gray-900 select-all font-bold">{password}</span></span>
                                  </div>
                                  <span className="text-[9px] text-amber-600 block leading-normal mt-0.5">🔒 Senha visível apenas em modo preview.</span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              u.role === 'boss_admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {u.role || 'client'}
                            </span>
                          </td>
                          <td className="py-4 font-mono font-semibold text-gray-500">{u.clientId || 'Nulo'}</td>
                          <td className="py-4 font-mono font-bold text-indigo-600">{u.clientSlug || 'Sem portal'}</td>
                          <td className="py-4 text-center">
                            <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-[10px] font-black uppercase">
                              {u.status || 'Ativo'}
                            </span>
                          </td>
                          <td className="py-4 text-center">
                            <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                              clientExists ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}>
                              {clientExists ? 'Sim' : 'Não'}
                            </span>
                          </td>
                          <td className="py-4 text-center">
                            <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                              portalExists ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}>
                              {portalExists ? 'Sim' : 'Não'}
                            </span>
                          </td>
                          <td className="py-4 text-right pr-4 space-x-1.5 whitespace-nowrap font-sans">
                            <button
                              onClick={() => u.clientId && navigate(`/boss-giffoni-clientes/clientes/${u.clientId}`)}
                              className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold rounded text-[10px]"
                            >
                              Abrir Cliente
                            </button>
                            <button
                              onClick={() => copyToClipboard(u.email, 'E-mail Copiado!')}
                              className="px-2 py-1 bg-white border border-gray-200 font-bold rounded text-[10px]"
                            >
                              Copiar E-mail
                            </button>
                            <button
                              onClick={() => {
                                updateDoc(doc(db, 'users', u.id), { status: 'pendente' });
                                alert('Marcado pendente.');
                                loadAllCollections();
                              }}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-[10px] text-amber-700 rounded font-bold"
                            >
                              Pendência
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ABA 5: FINANCEIRO */}
            {activeTab === 'financeiro' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'all', label: 'Todos os Faturamentos' },
                    { id: 'pendente', label: 'Aberto / Sem pagamento' },
                    { id: 'aguardando', label: 'Aguardando Compensação' },
                    { id: 'pago', label: 'Compensado' },
                    { id: 'parcial', label: 'Parcialmente Pago' },
                    { id: 'atrasado', label: 'Em atraso' },
                    { id: 'erro_webhook', label: 'Erro Webhook' },
                    { id: 'stripe', label: 'Gateway: Stripe' },
                    { id: 'asaas', label: 'Gateway: Asaas' },
                    { id: 'manual', label: 'Controle Manual/Temporário' }
                  ].map((f) => {
                    const isSel = finFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFinFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer ${
                          isSel ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div className="bg-white border border-gray-150 rounded-2xl shadow-3xs overflow-hidden">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Caso de Origem ID</th>
                        <th className="py-3">Cliente Assinado</th>
                        <th className="py-3">Valor Honorário</th>
                        <th className="py-3">Metodologia</th>
                        <th className="py-3">Status Cobrança</th>
                        <th className="py-3">Provedor</th>
                        <th className="py-3">Webhook Automação</th>
                        <th className="py-3">Contrato / Matriz</th>
                        <th className="py-3 text-right pr-4">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                      {displayedFinancials.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-gray-400 italic">Nenhum lançamento fático financeiro catalogado para este filtro.</td>
                        </tr>
                      ) : (
                        displayedFinancials.map(f => {
                          const clientName = getClientDisplayName(f.clientId);
                          const total = Number(f.totalAmount || f.amount || 0);
                          const hasWebhookError = (f.webhookStatus || '').toLowerCase().includes('erro');
                          return (
                            <tr key={f.id} className="hover:bg-gray-50/40">
                              <td className="py-4 px-4 font-mono text-xs text-gray-450 font-bold block mt-1">{f.caseId || 'Indeterminado'}</td>
                              <td className="py-4">
                                <span className="font-semibold block">{clientName}</span>
                                <span className="text-xs text-gray-450 block font-mono mt-0.5">{f.clientId}</span>
                              </td>
                              <td className="py-4 font-mono font-extrabold text-emerald-700">
                                R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-4 text-gray-500 uppercase font-semibold text-xs">
                                {f.installments ? `${f.installmentsPaid || 0} de ${f.installments} Parcela(s)` : 'Contrato Fixo'}
                              </td>
                              <td className="py-4">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                  (f.status || f.paymentStatus || '').toLowerCase() === 'pago' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                }`}>
                                  {f.status || f.paymentStatus || 'Aberto'}
                                </span>
                              </td>
                              <td className="py-4 uppercase font-bold text-xs text-indigo-650">{f.provider || 'Manual'}</td>
                              <td className="py-4 font-semibold text-gray-500">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-black ${hasWebhookError ? 'bg-rose-50 text-rose-700' : 'bg-gray-150 text-gray-650'}`}>
                                  {f.webhookStatus || 'Sem Notificações'}
                                </span>
                              </td>
                              <td className="py-4 text-gray-500">
                                {f.contractLinked ? 'Contrato Vinculado' : 'Aguardando formalização'}
                              </td>
                              <td className="py-4 text-right pr-4 space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao?caseId=${f.caseId}`)}
                                  className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded-lg text-xs cursor-pointer"
                                >
                                  Fluxo
                                </button>
                                <button
                                  onClick={() => f.paymentLink && copyToClipboard(f.paymentLink, 'Link de pagamento copiado!')}
                                  className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-50"
                                  disabled={!f.paymentLink}
                                >
                                  Link
                                </button>
                                <button
                                  onClick={() => handleMarkFinancialAttention(f)}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg cursor-pointer"
                                >
                                  Atenção
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 6: SOLICITAÇÕES */}
            {activeTab === 'solicitacoes' && (
              <div className="bg-white border border-gray-150 rounded-2xl shadow-3xs overflow-hidden">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3">Caso ID</th>
                      <th className="py-3 text-semibold">Título Solicitado / Pergunta</th>
                      <th className="py-3">Status</th>
                      <th className="py-3">Data Prazo</th>
                      <th className="py-3 text-center">Visível Portal</th>
                      <th className="py-3">Análise de Qualidade BOSS</th>
                      <th className="py-3 text-right pr-4">Ações Operacionais</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                    {combinedRequests.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-400 italic">Nenhuma solicitação de esclarecimento ou provas cadastrada no banco.</td>
                      </tr>
                    ) : (
                      combinedRequests.map((r, index) => {
                        const status = r.status || 'pendente';
                        return (
                          <tr key={r.id || index} className="hover:bg-gray-50/40">
                            <td className="py-4 px-4 font-mono font-bold">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                r.reqType === 'Informação' ? 'bg-cyan-50 text-cyan-700' : 'bg-indigo-50 text-indigo-750'
                              }`}>
                                {r.reqType}
                              </span>
                            </td>
                            <td className="py-4 font-mono font-bold text-gray-450 text-xs">{r.caseId}</td>
                            <td className="py-4">
                              <p className="font-extrabold text-gray-900 leading-tight">{r.parsedTitle}</p>
                              {r.description && <p className="text-xs text-gray-500 mt-1 font-medium">{r.description}</p>}
                            </td>
                            <td className="py-4 uppercase text-xs font-extrabold tracking-wider">
                              <span className={`px-1.5 py-0.5 rounded ${
                                status === 'respondido' || status === 'enviado' || status === 'entregue' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-600'
                              }`}>
                                {status}
                              </span>
                            </td>
                            <td className="py-4 font-mono text-gray-500">{r.dueDate || 'Sem Prazo'}</td>
                            <td className="py-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                r.visibleToClient !== false ? 'bg-indigo-50 text-indigo-650' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {r.visibleToClient !== false ? 'Sim' : 'Oculto'}
                              </span>
                            </td>
                            <td className="py-4 font-bold text-indigo-600 italic">
                              {r.bossFeedback || 'Aguardando Avaliação'}
                            </td>
                            <td className="py-4 text-right pr-4 space-x-1.5 whitespace-nowrap font-sans">
                              <button
                                onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao?caseId=${r.caseId}`)}
                                className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded-lg text-xs cursor-pointer"
                              >
                                Ver Fluxo
                              </button>
                              <button
                                onClick={() => handleMarkRequestStatus(r, 'aprovado')}
                                className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-750 cursor-pointer"
                              >
                                Aprovar
                              </button>
                              <button
                                onClick={() => handleMarkRequestStatus(r, 'rejeitado')}
                                className="px-2.5 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 cursor-pointer"
                              >
                                Rejeitar
                              </button>
                              <button
                                onClick={() => handleMarkRequestStatus(r, 'complemento_solicitado')}
                                className="px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 cursor-pointer"
                              >
                                Complemento
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ABA 7: AGENDA */}
            {activeTab === 'agenda' && (
              <div className="bg-white border border-gray-150 rounded-2xl shadow-3xs overflow-hidden">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3">Vínculo Cliente</th>
                      <th className="py-3">Título Evento</th>
                      <th className="py-3">Data</th>
                      <th className="py-3 font-semibold">Hora</th>
                      <th className="py-3">Local físico / Link video</th>
                      <th className="py-3">Agenda Responsável</th>
                      <th className="py-3 text-center">Visivel Portal</th>
                      <th className="py-3 text-right pr-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                    {displayedEvents.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-gray-400 font-semibold italic text-sm">Nenhum evento cadastrado para os filtros da Central de Controle.</td>
                      </tr>
                    ) : (
                      displayedEvents.map((e, index) => {
                        const clDisplay = getClientDisplayName(e.clientId);
                        return (
                          <tr key={e.id || index} className="hover:bg-gray-50/40">
                            <td className="py-4 px-4 font-mono font-bold">
                              <span className="px-2 py-0.5 bg-indigo-50/75 text-indigo-700 rounded text-xs font-bold uppercase">
                                {e.type || 'Ato judicial'}
                              </span>
                            </td>
                            <td className="py-4">
                              <span className="font-bold text-gray-900 block">{clDisplay}</span>
                              <span className="text-xs text-gray-450 block font-mono">Case: {e.caseId}</span>
                            </td>
                            <td className="py-4">
                              <span className="font-extrabold text-gray-900 block">{e.title}</span>
                              {e.description && <span className="text-xs text-gray-550 block mt-1 leading-tight">{e.description}</span>}
                            </td>
                            <td className="py-4 font-mono text-gray-500">{e.date || 'À definir'}</td>
                            <td className="py-4 font-mono text-gray-550 font-bold">{e.time || '--:--'}</td>
                            <td className="py-4 text-indigo-600 font-mono truncate max-w-[150px]">{e.location || 'Sem link cadastrado'}</td>
                            <td className="py-4 font-semibold text-gray-605">{e.responsible || 'Coletivo escritório'}</td>
                            <td className="py-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                e.visibleToClient !== false ? 'bg-indigo-50 text-indigo-650' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {e.visibleToClient !== false ? 'Sim' : 'Oculto'}
                              </span>
                            </td>
                            <td className="py-4 text-right pr-4 space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao?caseId=${e.caseId}`)}
                                className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 font-bold rounded-lg text-xs"
                              >
                                Ver Fluxo
                              </button>
                              <button
                                onClick={() => e.location && copyToClipboard(e.location, 'Link/Local copiado!')}
                                className="px-2.5 py-1.5 bg-white border border-gray-200 font-bold rounded-lg text-xs disabled:opacity-50"
                                disabled={!e.location}
                              >
                                Copiar Link
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ABA 8: EDRP */}
            {activeTab === 'edrp' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'all', label: 'Todos os Casos do EDRP' },
                    { id: 'sem_estruturacao', label: 'Falta Tese/Fatos' },
                    { id: 'sem_delegacao', label: 'Falta Delegar Responsável' },
                    { id: 'aguardando_revisao', label: 'Estágio Revisão Ativo' },
                    { id: 'pronto_protocolo', label: 'Estágio Protocolo Ativo' },
                    { id: 'com_pendencia', label: 'Com Pendência Operacional' },
                    { id: 'protocolado', label: 'Protocolo Concluído' },
                    { id: 'controladoria', label: 'Estágio Controladoria Ativo' }
                  ].map((f) => {
                    const isSel = edrpFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setEdrpFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer ${
                          isSel ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div className="bg-white border border-gray-150 rounded-2xl shadow-3xs overflow-hidden">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Caso / Processo</th>
                        <th className="py-3">Cliente fiduciário</th>
                        <th className="py-3 text-center">Estruturação Tese</th>
                        <th className="py-3 text-center">Delegação Ativa</th>
                        <th className="py-3 text-center">Revisado?</th>
                        <th className="py-3 text-center">Protocolado?</th>
                        <th className="py-3 text-center">Todoist Integrado</th>
                        <th className="py-3 text-center">Painel Colaborador</th>
                        <th className="py-3 text-right pr-4">Ações Operacionais</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs text-gray-750 font-mono">
                      {displayedEdrpCases.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-gray-450 italic font-sans text-sm">Nenhum caso elegível para este checklist de EDRP.</td>
                        </tr>
                      ) : (
                        displayedEdrpCases.map(ca => {
                          const clName = getClientDisplayName(ca.clientId);
                          const hasStructuring = !!(ca.structuring || ca.edrp?.structuring);
                          const hasDelegation = !!(ca.responsibleLawyer || ca.delegation?.responsible);
                          const isReviewed = ca.productionStage === 'protocolo' || ca.productionStage === 'controladoria' || ca.reviewApproved === true;
                          const isProtocoled = ca.statusInterno === 'protocolado' || ca.status === 'protocolado' || !!ca.protocolNumber;
                          const todoistIntegrity = ca.todoistConnected || ca.todoistActive ? 'Sim' : 'Não';
                          const staffCheck = ca.responsibleLawyer ? 'Ativo' : 'Vazio';

                          return (
                            <tr key={ca.id} className="hover:bg-gray-50/40">
                              <td className="py-4 px-4 font-sans font-extrabold text-gray-900 block mt-1">{ca.title}</td>
                              <td className="py-4 font-sans font-bold text-gray-600">{clName}</td>
                              <td className="py-4 text-center">
                                <span className={`px-2 py-1 rounded-md text-xs font-semibold ${hasStructuring ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                  {hasStructuring ? 'Preenchido' : 'Pendente'}
                                </span>
                              </td>
                              <td className="py-4 text-center">
                                <span className={`px-2 py-1 rounded-md text-xs font-semibold ${hasDelegation ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                  {hasDelegation ? 'Designado' : 'Pendente'}
                                </span>
                              </td>
                              <td className="py-4 text-center">
                                <span className={`px-2 py-1 rounded-md text-xs font-semibold ${isReviewed ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {isReviewed ? 'Aprovado' : 'Em revisão'}
                                </span>
                              </td>
                              <td className="py-4 text-center">
                                <span className={`px-2 py-1 rounded-md text-xs font-semibold ${isProtocoled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-750'}`}>
                                  {isProtocoled ? 'Sim' : 'Aguardando'}
                                </span>
                              </td>
                              <td className="py-4 text-center font-bold text-xs text-gray-600">{todoistIntegrity}</td>
                              <td className="py-4 text-center font-bold text-xs text-gray-700 font-sans">{staffCheck}</td>
                              <td className="py-4 text-right pr-4 font-sans space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao?caseId=${ca.id}`)}
                                  className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-lg text-xs font-bold text-gray-700 cursor-pointer"
                                >
                                  Retomar EDRP
                                </button>
                                <button
                                  onClick={() => navigate(`/boss-giffoni-clientes/portal-cliente-preview/${ca.clientId}`)}
                                  className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold cursor-pointer"
                                >
                                  Integridade
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 9: INTEGRIDADE */}
            {activeTab === 'integridade' && (
              <div className="space-y-6">
                
                {/* Deployment Recommendation Flag Banner */}
                <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm ${
                  diag.statusGeral.includes('PRONTO') 
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-900' 
                    : 'bg-rose-50 border-rose-100 text-rose-900'
                }`}>
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider font-mono opacity-85 block">Avaliação do Módulo</span>
                    <h3 className="text-xl font-black tracking-tight leading-none mb-1">{diag.statusGeral}</h3>
                    <p className="text-xs font-bold leading-relaxed">
                      {diag.statusGeral === 'Não recomendado para deploy' 
                        ? 'Foram identificados um ou mais erros críticos de vinculação nas tabelas relacionais do sistema. Resolva os erros abaixo antes de publicar.'
                        : 'Sua infraestrutura de dados fáticos está completamente limpa de erros órfãos relacionais. Recomendado para deploy!'
                      }
                    </p>
                  </div>
                  <div className="shrink-0 flex gap-2">
                    <button
                      onClick={loadAllCollections}
                      className="px-4 py-2.5 bg-white font-bold rounded-xl text-xs text-gray-750 border border-gray-200 hover:bg-gray-50"
                    >
                      Auditar Novamente
                    </button>
                    <button
                      onClick={handleCopyResumo}
                      className="px-4 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl text-xs"
                    >
                      Copiar Resumo
                    </button>
                  </div>
                </div>

                {/* Dashboard Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total de Clientes', val: clients.length, color: 'text-gray-900' },
                    { label: 'Total de Casos', val: cases.length, color: 'text-gray-900' },
                    { label: 'Casos em Produção', val: cases.filter(ca => ca.productionStatus === 'em_producao').length, color: 'text-indigo-600' },
                    { label: 'Casos com Pendências', val: cases.filter(ca => ca.productionStatus === 'com_pendencias').length, color: 'text-amber-600' },
                    { label: 'Casos Concluídos', val: cases.filter(ca => ca.productionStatus === 'concluido').length, color: 'text-emerald-700' },
                    { label: 'Casos Sem Slug', val: cases.filter(ca => !ca.clientSlug).length, color: 'text-rose-600' },
                    { label: 'Casos Sem clientId', val: cases.filter(ca => !ca.clientId).length, color: 'text-rose-600' },
                    { label: 'Finanças Órfãs', val: financials.filter(f => !f.caseId || !cases.some(ca => ca.id === f.caseId)).length, color: 'text-rose-600' }
                  ].map((stat, i) => (
                    <div key={i} className="p-4 bg-white border border-gray-150 rounded-2xl text-center shadow-3xs">
                      <span className="text-xs font-black uppercase text-gray-500 block tracking-wider leading-relaxed">{stat.label}</span>
                      <h4 className={`text-3xl font-black mt-1 ${stat.color}`}>{stat.val}</h4>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Critical Errors List */}
                  <div className="bg-white border border-gray-150 p-6 rounded-2xl shadow-3xs space-y-4">
                    <h4 className="font-extrabold text-sm tracking-tight text-gray-900 border-b border-gray-100 pb-2.5 flex items-center gap-2">
                      <XCircle size={16} className="text-red-500" />
                      <span>Erros Críticos Estruturais ({diag.criticalErrorsList.length})</span>
                    </h4>
                    
                    {diag.criticalErrorsList.length === 0 ? (
                      <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl text-center">
                        Nenhum erro estrutural crítico fático detectado! Tudo pronto.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
                        {diag.criticalErrorsList.map((err, i) => (
                          <div key={i} className="p-3 bg-red-50 text-red-800 text-xs border border-red-100 rounded-xl leading-relaxed font-mono flex items-start gap-2">
                            <span>•</span>
                            <p className="flex-1">{err}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Warning Advisories List */}
                  <div className="bg-white border border-gray-150 p-6 rounded-2xl shadow-3xs space-y-4">
                    <h4 className="font-extrabold text-sm tracking-tight text-gray-900 border-b border-gray-100 pb-2.5 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-500" />
                      <span>Alertas de Pendências / Conectores ({diag.warningList.length})</span>
                    </h4>
                    
                    {diag.warningList.length === 0 ? (
                      <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl text-center">
                        Excelente! Sem alertas ou avisos de preenchimento.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
                        {diag.warningList.map((war, i) => (
                          <div key={i} className="p-3 bg-amber-50/50 text-amber-900 text-xs border border-amber-100 rounded-xl leading-relaxed font-mono flex items-start gap-2">
                            <span>⚠</span>
                            <p className="flex-1">{war}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </div>

      {/* Detalhamento de Informações Modal */}
      {selectedDetailBlock && (() => {
        const { client, type } = selectedDetailBlock;
        const clientName = getClientDisplayName(client.id);
        const pf = client.pfDadosPessoais || client.pfData || {};
        const pj = client.pjDadosEmpresa || client.pjData || {};
        const socio = client.socioDadosPessoais || client.socioData || {};
        const access = client.acessoSistema || {};
        const bancario = client.bancarioDadosBancarios || client.bancarioData || {};

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-3xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-[24px] w-full max-w-2xl border border-gray-150 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden">
              
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-50/25">
                <div className="space-y-1">
                  <span className="text-[11px] font-black uppercase tracking-widest text-indigo-650 block">Detalhamento Operacional</span>
                  <h3 className="font-black text-gray-950 text-lg md:text-xl leading-tight">
                    {type === 'identificacao' && '📂 Dados de Identificação'}
                    {type === 'contato' && '📞 Contatos & Endereço'}
                    {type === 'portal' && '🌐 Configurações & Acesso Portal'}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Cliente: <span className="font-extrabold text-gray-800">{clientName}</span> 
                    (ID: <code className="font-mono bg-white px-1 py-0.5 rounded text-[10px] border ml-1">{client.id}</code>)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDetailBlock(null)}
                  className="w-10 h-10 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl flex items-center justify-center font-bold text-sm cursor-pointer shadow-2xs transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-6 overflow-y-auto space-y-6 text-[14px] text-gray-700 leading-relaxed font-sans">
                
                {type === 'identificacao' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Tipo de Pessoa</span>
                        <span className="text-[15px] font-bold text-indigo-900">{client.type === 'PJ' ? 'Pessoa Jurídica (PJ)' : 'Pessoa Física (PF)'}</span>
                      </div>
                      <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Status Geral</span>
                        <span className={`text-[15px] font-bold uppercase tracking-wider ${client.active !== false ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {client.active !== false ? 'Ativo' : 'Suspenso'}
                        </span>
                      </div>
                    </div>

                    {client.type === 'PJ' ? (
                      <div className="space-y-5">
                        <div className="bg-indigo-50/15 p-4 rounded-xl border border-indigo-100/30 space-y-3">
                          <h4 className="font-bold text-[14px] text-indigo-950 border-b pb-1.5 border-indigo-100/50">Empresa (Dados PJ)</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
                            <div>
                              <span className="text-gray-450 block">Razão Social</span>
                              <span className="font-bold text-[15px] text-gray-900">{pj.pj_razaoSocial || 'Não informado'}</span>
                            </div>
                            <div>
                              <span className="text-gray-450 block">Nome Fantasia</span>
                              <span className="font-bold text-[15px] text-gray-900">{pj.pj_nomeFantasia || 'Não informado'}</span>
                            </div>
                            <div>
                              <span className="text-gray-455 block">CNPJ</span>
                              <span className="font-mono font-bold text-[15px] text-gray-900">{pj.pj_cnpj || 'Não informado'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                          <h4 className="font-bold text-[14px] text-gray-800 border-b pb-1.5 border-gray-200">Sócio Administrador</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
                            <div>
                              <span className="text-gray-455 block">Nome Completo</span>
                              <span className="font-semibold text-[14px] text-gray-900">{socio.socio_nomeCompleto || 'Não informado'}</span>
                            </div>
                            <div>
                              <span className="text-gray-455 block">CPF / RG</span>
                              <span className="font-mono font-semibold text-[14px] text-gray-900">
                                {socio.socio_cpf || 'S/ CPF'} / {socio.socio_rg || 'S/ RG'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-455 block">Nascimento / Profissão</span>
                              <span className="font-semibold text-[14px] text-gray-900">
                                {socio.socio_dataNascimento || 'S/ nascimento'} — {socio.socio_profissao || 'S/ profissão'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-indigo-50/15 p-4 rounded-xl border border-indigo-100/30 space-y-3">
                        <h4 className="font-bold text-[14px] text-indigo-950 border-b pb-1.5 border-indigo-100/50">Dados Pessoais (PF)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
                          <div>
                            <span className="text-gray-450 block">Nome Completo</span>
                            <span className="font-bold text-[15px] text-gray-900">{pf.pf_nomeCompleto || 'Não informado'}</span>
                          </div>
                          <div>
                            <span className="text-gray-450 block">CPF / RG</span>
                            <span className="font-mono font-bold text-[15px] text-gray-900">
                              {pf.pf_cpf || 'Não informado'} {pf.pf_rg ? ` / RG ${pf.pf_rg}` : ''}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-450 block">Data de Nascimento</span>
                            <span className="font-semibold text-[14px] text-gray-900">{pf.pf_dataNascimento || 'Não informado'}</span>
                          </div>
                          <div>
                            <span className="text-gray-450 block">Nacionalidade / Estado Civil</span>
                            <span className="font-semibold text-[14px] text-gray-900">{pf.pf_nacionalidade || 'Brasileira'} — {pf.pf_estadoCivil || 'Não informado'}</span>
                          </div>
                          <div>
                            <span className="text-gray-450 block">Profissão</span>
                            <span className="font-semibold text-[14px] text-gray-900">{pf.pf_profissao || 'Não informado'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {type === 'contato' && (
                  <div className="space-y-5">
                    <div className="bg-indigo-50/15 p-4 rounded-xl border border-indigo-100/30 space-y-3">
                      <h4 className="font-bold text-[14px] text-indigo-950 border-b pb-1.5 border-indigo-100/50">Informações de Contato</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
                        <div>
                          <span className="text-gray-450 block">E-mail Operacional</span>
                          <span className="font-bold text-[14px] text-gray-900 break-all select-all">{getClientEmail(client) || 'Não informado'}</span>
                        </div>
                        <div>
                          <span className="text-gray-450 block">Telefone / Celular</span>
                          <span className="font-bold text-[14px] text-gray-900 select-all">{getClientPhone(client) || 'Não informado'}</span>
                        </div>
                        {client.type === 'PJ' ? (
                          <>
                            <div>
                              <span className="text-gray-450 block">Email da Empresa</span>
                              <span className="font-semibold text-[14px] text-gray-900 break-all">{pj.pj_emailEmpresa || 'Não informado'}</span>
                            </div>
                            <div>
                              <span className="text-gray-450 block">Whatsapp Empresa</span>
                              <span className="font-semibold text-[14px] text-gray-900">{pj.pj_whatsappEmpresa || 'Não informado'}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="text-gray-450 block">E-mail Pessoal</span>
                              <span className="font-semibold text-[14px] text-gray-900 break-all">{pf.pf_email || 'Não informado'}</span>
                            </div>
                            <div>
                              <span className="text-gray-450 block">Whatsapp Pessoal</span>
                              <span className="font-semibold text-[14px] text-gray-900">{pf.pf_whatsapp || 'Não informado'}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                      <h4 className="font-bold text-[14px] text-gray-800 border-b pb-1.5 border-gray-200">Endereço Cadastral</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
                        <div className="md:col-span-2">
                          <span className="text-gray-455 block">CEP</span>
                          <span className="font-mono font-bold text-[14px] text-gray-900">{client.type === 'PJ' ? pj.pj_cepEmpresa : pf.pf_cep || 'Não informado'}</span>
                        </div>
                        <div className="md:col-span-2">
                          <span className="text-gray-455 block">Endereço Completo</span>
                          <span className="font-semibold text-[14px] text-gray-900">
                            {client.type === 'PJ' 
                              ? `${pj.pj_enderecoEmpresa || ''} ${pj.pj_bairroEmpresa ? ` - Bairro ${pj.pj_bairroEmpresa}` : ''}`
                              : `${pf.pf_endereco || ''}${pf.pf_numero ? `, nº ${pf.pf_numero}` : ''}${pf.pf_bairro ? ` - Bairro ${pf.pf_bairro}` : ''}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-455 block">Cidade / Município</span>
                          <span className="font-semibold text-[14px] text-gray-900">
                            {client.type === 'PJ' ? pj.pj_cidadeEmpresa : pf.pf_cidade || 'Não informado'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-455 block">Estado / UF</span>
                          <span className="font-semibold text-[14px] text-gray-900">
                            {client.type === 'PJ' ? pj.pj_estadoEmpresa : pf.pf_estado || 'Não informado'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {type === 'portal' && (
                  <div className="space-y-5">
                    <div className="bg-indigo-50/15 p-4 rounded-xl border border-indigo-100/30 space-y-3">
                      <h4 className="font-bold text-[14px] text-indigo-950 border-b pb-1.5 border-indigo-100/50">Dados de Credencial de Acesso</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
                        <div>
                          <span className="text-gray-450 block">Endereço Slug (URL Portal)</span>
                          <span className="font-mono font-black text-[15px] text-indigo-650">/{client.slug || 'sem-slug'}</span>
                        </div>
                        <div>
                          <span className="text-gray-450 block">Acesso ao Portal</span>
                          <span className="font-bold text-[14px] text-indigo-900">
                            {client.portalAtivo !== false ? 'Habilitado/Ativo' : 'Suspenso/Inativo'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-450 block">E-mail de Login</span>
                          <span className="font-semibold font-mono text-[14px] text-gray-900 select-all">{access.acesso_emailLogin || client.email || 'Não informado'}</span>
                        </div>
                        <div>
                          <span className="text-gray-455 block">Senha Temporária / Atual</span>
                          <code className="font-mono font-bold text-[14px] text-gray-900 bg-white px-1.5 py-0.5 rounded border border-gray-150 inline-block leading-none mt-1 select-all">
                            {access.acesso_senha || client.senhaVisivelPreview || 'Não configurada'}
                          </code>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                      <h4 className="font-bold text-[14px] text-gray-800 border-b pb-1.5 border-gray-200">Links de Pastas & Documentos</h4>
                      <div className="text-[13px] space-y-2">
                        <div>
                          <span className="text-gray-455 block mb-1">Pasta no Google Drive</span>
                          {client.gdriveUrl ? (
                            <a 
                              href={client.gdriveUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1 bg-white border px-3 py-1.5 rounded-lg shadow-3xs"
                            >
                              Abrir Pasta no Drive <ExternalLink size={13} />
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">Nenhuma pasta do Google Drive associada</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                      <h4 className="font-bold text-[14px] text-gray-850 border-b pb-1.5 border-gray-200">Módulos Ativos do Cliente</h4>
                      <div className="grid grid-cols-2 gap-3 text-[12px] font-semibold text-gray-750">
                        <div className="flex items-center gap-2 bg-white p-2 border border-gray-150 rounded-lg">
                          <CheckCircle size={15} className={client.showDashboard !== false ? "text-emerald-500" : "text-gray-300"} />
                          <span>Dashboard</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white p-2 border border-gray-150 rounded-lg">
                          <CheckCircle size={15} className={client.showCadastros !== false ? "text-emerald-500" : "text-gray-300"} />
                          <span>Cadastros</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white p-2 border border-gray-150 rounded-lg">
                          <CheckCircle size={15} className={client.showCasos !== false ? "text-emerald-500" : "text-gray-300"} />
                          <span>Processos</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white p-2 border border-gray-150 rounded-lg">
                          <CheckCircle size={15} className={client.showProvas !== false ? "text-emerald-500" : "text-gray-300"} />
                          <span>Módulo Provas</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white p-2 border border-gray-150 rounded-lg">
                          <CheckCircle size={15} className={client.showInformacoes !== false ? "text-emerald-500" : "text-gray-300"} />
                          <span>Módulo Solicitações</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white p-2 border border-gray-150 rounded-lg">
                          <CheckCircle size={15} className={client.showAudiencias !== false ? "text-emerald-500" : "text-gray-300"} />
                          <span>Agenda Audiências</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                      <h4 className="font-bold text-[14px] text-gray-800 border-b pb-1.5 border-gray-200">Configurações Financeiras</h4>
                      {bancario.bancario_possuiDadosBancarios ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
                          <div>
                            <span className="text-gray-455 block">Banco</span>
                            <span className="font-semibold text-gray-900">{bancario.bancario_banco || 'Não informado'}</span>
                          </div>
                          <div>
                            <span className="text-gray-455 block">Tipo / Chave PIX</span>
                            <span className="font-mono font-bold text-gray-900 select-all">({bancario.bancario_tipoChavePix || 'Chave'}) {bancario.bancario_chavePix || 'Não informado'}</span>
                          </div>
                          <div>
                            <span className="text-gray-455 block">Conta / Agência</span>
                            <span className="font-mono font-medium text-gray-900">
                              Ag: {bancario.bancario_agencia || 'S/A'} - Conta: {bancario.bancario_conta || 'S/C'} ({bancario.bancario_tipoConta || 'Corrente'})
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-455 block">Titular</span>
                            <span className="font-semibold text-gray-900 truncate block">{bancario.bancario_titularConta || bancario.bancario_titularPix || 'Cliente'}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[13px] text-gray-450 italic">Nenhum dado bancário ou chave PIX cadastrado para este cliente.</p>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-150 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenMasterEditor(client);
                    setSelectedDetailBlock(null);
                  }}
                  className="px-4.5 py-2 bg-blue-650 hover:bg-blue-750 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-colors"
                >
                  Abrir no Editor do Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDetailBlock(null)}
                  className="px-4.5 py-2 bg-gray-200 hover:bg-gray-250 text-gray-800 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Safety Warning dialog modal */}
      {safeDeleteWarning && !clientToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-3xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md border border-gray-100 shadow-xl space-y-4 text-center">
            <ShieldAlert size={44} className="text-indigo-650 mx-auto" />
            <h3 className="font-black text-gray-950 text-base">Operação Bloqueada</h3>
            <p className="text-xs text-gray-650 font-bold leading-relaxed">
              {safeDeleteWarning}
            </p>
            <button
              onClick={() => setSafeDeleteWarning(null)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow"
            >
              Ciente da Operação
            </button>
          </div>
        </div>
      )}

      {/* Client Deletion Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-3xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-[1.5rem] w-full max-w-md border border-gray-100 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-650 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 size={28} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-black text-gray-950 text-lg">Excluir Cadastro Permanentemente?</h3>
              <p className="text-xs text-gray-500 leading-relaxed font-sans">
                Você tem certeza de que deseja remover <span className="font-extrabold text-gray-950">"{getClientDisplayName(clientToDelete.id)}"</span> (ID: <code className="font-mono bg-gray-50 px-1 py-0.5 rounded text-[11px]">{clientToDelete.id}</code>)?
              </p>
              <div className="bg-red-50/50 border border-red-100/65 rounded-xl p-3 text-left text-[11px] text-red-750 font-semibold leading-relaxed font-sans">
                <span className="font-black block mb-0.5 uppercase tracking-wide text-[10px]">Atenção:</span>
                Esta ação excluirá o cliente, seu acesso ao portal, credenciais, slug e casos vinculados. Esta ação não poderá ser desfeita.
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setClientToDelete(null);
                  setSafeDeleteWarning(null);
                }}
                disabled={isDeletingClient}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-gray-700 rounded-xl font-bold text-xs transition-all cursor-pointer disabled:opacity-55"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteClient}
                disabled={isDeletingClient}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md shadow-red-100 flex items-center justify-center gap-2 disabled:opacity-55"
              >
                {isDeletingClient ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <span>Deletar Efetivamente</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* EDITOR MESTRE DO PORTAL DO CLIENTE - MODAL */}
      {/* ========================================== */}
      {selectedMasterClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-150 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4.5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-black uppercase rounded-md">MÓDULO DE DEPLOY MESTRE</span>
                  <h2 className="text-sm font-black tracking-tight font-sans uppercase">
                    Editor do Painel do Cliente — {masterFormData.pf_nomeCompleto || masterFormData.pj_razaoSocial || ''}
                  </h2>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Visualização, edição e deploy direto de dados cadastrais, credenciais e integrações para o portal <span className="font-bold text-slate-200">/{masterFormData.slug}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedMasterClient(null)} 
                className="text-slate-400 hover:text-white font-bold transition-colors cursor-pointer text-xs uppercase"
              >
                [ Fechar ]
              </button>
            </div>

            {/* Modal Workspace (Sidebar + Content) */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Sidebar Tabs */}
              <div className="w-64 bg-slate-50 border-r border-gray-150 flex flex-col p-3 overflow-y-auto gap-1">
                {[
                  { id: 'identificacao', label: '🆔 1. Identificação', desc: 'Nome, tipo (PF/PJ) e status' },
                  { id: 'acesso_slug', label: '🔑 2. Acesso e Slug', desc: 'Slug, e-mail e senha visível' },
                  { id: 'cadastro', label: '👤 3. Dados Cadastrais', desc: 'Ficha PF, PJ, Sócios e Banco' },
                  { id: 'casos', label: '💼 4. Casos', desc: 'Processos e contencioso' },
                  { id: 'provas', label: '📂 5. Provas', desc: 'Solicitações de documentos' },
                  { id: 'informacoes', label: 'ℹ️ 6. Informações', desc: 'Formulários e perguntas' },
                  { id: 'audiencias', label: '⚖️ 7. Audiências', desc: 'Controle de sessões' },
                  { id: 'pericias', label: '🔬 8. Perícias', desc: 'Agendamento pericial' },
                  { id: 'reunioes', label: '💬 9. Reuniões', desc: 'Encontros de alinhamento' },
                  { id: 'financeiro', label: '💰 10. Financeiro', desc: 'Faturamentos e Pix mestre' },
                  { id: 'timeline', label: '📅 11. Timeline Pública', desc: 'Comunicados e andamento' },
                  { id: 'visibilidade', label: '👁️ 12. Visibilidade', desc: 'Exibir/ocultar módulos' },
                  { id: 'gdrive', label: '📁 13. gdrive', desc: 'Google Drive pasta raiz' },
                  { id: 'gdocs', label: '📄 14. gdocs', desc: 'Drafts e procuração google docs' },
                  { id: 'logs', label: '📜 15. Logs', desc: 'Auditoria técnica mestre' },
                  { id: 'integridade', label: '🛡️ 16. Integridade', desc: 'Frequência de erros / Soluções' },
                ].map((item) => {
                  const isActive = masterEditorTab as string === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setMasterEditorTab(item.id as any)}
                      className={`flex flex-col items-start p-2.5 rounded-xl text-left transition-colors cursor-pointer border w-full ${
                        isActive
                          ? 'bg-indigo-650 text-white border-transparent'
                          : 'hover:bg-gray-100 text-gray-700 bg-white border-gray-100'
                      }`}
                    >
                      <span className="text-[11px] font-black">{item.label}</span>
                      <span className={`text-[9px] mt-0.5 ${isActive ? 'text-indigo-200' : 'text-gray-400'}`}>{item.desc}</span>
                    </button>
                  );
                })}

                <div className="mt-auto p-2 bg-slate-105 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 font-bold block">STATUS DO PROVEDOR</span>
                  <span className={`text-[11px] font-black uppercase mt-0.5 inline-block px-2 py-0.5 rounded-md ${
                    masterFormData.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {masterFormData.active ? '● PORTAL ATIVO' : '● SUSPENSO'}
                  </span>
                </div>
              </div>

              {/* Work Pane */}
              <div className="flex-1 p-6 overflow-y-auto bg-white">
                
                {masterEditorTab === 'identificacao' && (
                  <div className="space-y-5 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">Identificação Inicial do Cadastro Mestre</h3>
                    <p className="text-[10px] text-gray-450 font-bold mb-4">Parâmetros centrais de qualificação da pessoa.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Nome do Cliente / Pasta Comercial</label>
                        <input
                          type="text"
                          value={masterFormData.type === 'PF' ? (masterFormData.pf_nomeCompleto || '') : (masterFormData.pj_razaoSocial || '')}
                          onChange={(e) => {
                            if (masterFormData.type === 'PF') {
                              updateMasterField('pf_nomeCompleto', e.target.value);
                            } else {
                              updateMasterField('pj_razaoSocial', e.target.value);
                            }
                          }}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Tipo de Personalidade Jurídica</label>
                        <select
                          value={masterFormData.type || 'PF'}
                          onChange={(e) => updateMasterField('type', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-bold"
                        >
                          <option value="PF">Pessoa Física (PF)</option>
                          <option value="PJ">Pessoa Jurídica (PJ)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">ID Único do Cliente (Sempre Imutável)</label>
                        <input
                          type="text"
                          readOnly
                          value={masterFormData.clientId || ''}
                          className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl outline-none text-[11px] font-mono font-bold text-gray-400 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Situação Geral de Cadastro</label>
                        <select
                          value={masterFormData.active === false ? 'false' : 'true'}
                          onChange={(e) => updateMasterField('active', e.target.value === 'true')}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-bold"
                        >
                          <option value="true">Ativo (Permitir sincronização do portal)</option>
                          <option value="false">Inativo / Suspenso (Bloqueado de forma global)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {masterEditorTab === 'acesso_slug' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">Credenciais & Endereço Slug de Acesso</h3>
                    <p className="text-[10px] text-gray-455 font-bold mb-4">Gerencie as credenciais do portal do cliente e o caminho de URL seguro.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Slug do Portal do Cliente</label>
                        <div className="flex items-center">
                          <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-200 text-[11px] font-bold text-gray-400 rounded-l-xl">/portal/</span>
                          <input
                            type="text"
                            value={masterFormData.slug || ''}
                            onChange={(e) => updateMasterField('slug', e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-r-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-bold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Status Interno do Portal (Mirror State)</label>
                        <select
                          value={masterFormData.portalStatus || 'criado'}
                          onChange={(e) => updateMasterField('portalStatus', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-bold"
                        >
                          <option value="criado">Criado & Configurado</option>
                          <option value="nao_criado">Incompleto / Pendente</option>
                          <option value="suspenso">Suspenso Administrativamente</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">E-mail de Login do Portal</label>
                        <input
                          type="email"
                          value={masterFormData.acesso_emailLogin || ''}
                          onChange={(e) => updateMasterField('acesso_emailLogin', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Senha de Acesso (Visível no BOSS)</label>
                        <input
                          type="text"
                          value={masterFormData.acesso_senha || ''}
                          onChange={(e) => updateMasterField('acesso_senha', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {masterEditorTab === 'cadastro' && (
                  <div className="space-y-5 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <h3 className="text-xs font-black uppercase text-gray-800">Ficha Cadastral do Cliente Mestre</h3>
                        <p className="text-[10px] text-gray-450 font-bold">Unificação de dados cadastrais (PF, PJ, Sócios e Banco).</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-6">
                      {/* Section A: PF Data */}
                      <div>
                        <span className="text-[10px] font-black uppercase text-indigo-700 block mb-3 border-b border-indigo-100 pb-1">👤 PESSOA FÍSICA (PF)</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Nome Completo</label>
                            <input
                              type="text"
                              value={masterFormData.pf_nomeCompleto || ''}
                              onChange={(e) => updateMasterField('pf_nomeCompleto', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">CPF</label>
                            <input
                              type="text"
                              value={masterFormData.pf_cpf || ''}
                              onChange={(e) => updateMasterField('pf_cpf', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">RG</label>
                            <input
                              type="text"
                              value={masterFormData.pf_rg || ''}
                              onChange={(e) => updateMasterField('pf_rg', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Nascimento (DD/MM/AAAA)</label>
                            <input
                              type="text"
                              value={masterFormData.pf_dataNascimento || ''}
                              onChange={(e) => updateMasterField('pf_dataNascimento', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Telefone / Whats</label>
                            <input
                              type="text"
                              value={masterFormData.pf_telefone || ''}
                              onChange={(e) => updateMasterField('pf_telefone', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">E-mail Cadastral</label>
                            <input
                              type="email"
                              value={masterFormData.pf_email || ''}
                              onChange={(e) => updateMasterField('pf_email', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">CEP</label>
                            <input
                              type="text"
                              value={masterFormData.pf_cep || ''}
                              onChange={(e) => updateMasterField('pf_cep', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Endereço Completo</label>
                            <input
                              type="text"
                              value={masterFormData.pf_endereco || ''}
                              onChange={(e) => updateMasterField('pf_endereco', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Número</label>
                            <input
                              type="text"
                              value={masterFormData.pf_numero || ''}
                              onChange={(e) => updateMasterField('pf_numero', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section B: PJ Data */}
                      <div>
                        <span className="text-[10px] font-black uppercase text-indigo-700 block mb-3 border-b border-indigo-100 pb-1">🏢 PESSOA JURÍDICA (PJ)</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Razão Social</label>
                            <input
                              type="text"
                              value={masterFormData.pj_razaoSocial || ''}
                              onChange={(e) => updateMasterField('pj_razaoSocial', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Nome Fantasia</label>
                            <input
                              type="text"
                              value={masterFormData.pj_nomeFantasia || ''}
                              onChange={(e) => updateMasterField('pj_nomeFantasia', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">CNPJ</label>
                            <input
                              type="text"
                              value={masterFormData.pj_cnpj || ''}
                              onChange={(e) => updateMasterField('pj_cnpj', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Telefone Comercial</label>
                            <input
                              type="text"
                              value={masterFormData.pj_telefoneEmpresa || ''}
                              onChange={(e) => updateMasterField('pj_telefoneEmpresa', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section C: Partners */}
                      <div>
                        <span className="text-[10px] font-black uppercase text-indigo-700 block mb-3 border-b border-indigo-100 pb-1">👥 SÓCIOS & REPRESENTANTES</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Nome do Sócio Principal</label>
                            <input
                              type="text"
                              value={masterFormData.socio_nomeCompleto || ''}
                              onChange={(e) => updateMasterField('socio_nomeCompleto', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">CPF do Sócio</label>
                            <input
                              type="text"
                              value={masterFormData.socio_cpf || ''}
                              onChange={(e) => updateMasterField('socio_cpf', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Profissão / Cargo</label>
                            <input
                              type="text"
                              value={masterFormData.socio_profissao || ''}
                              onChange={(e) => updateMasterField('socio_profissao', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section D: Banking */}
                      <div>
                        <span className="text-[10px] font-black uppercase text-indigo-700 block mb-3 border-b border-indigo-100 pb-1">💰 CONFIGURAÇÕES BANCÁRIAS E CHAVE PIX</span>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Tipo de Chave Pix</label>
                            <input
                              type="text"
                              value={masterFormData.bancario_tipoChavePix || ''}
                              onChange={(e) => updateMasterField('bancario_tipoChavePix', e.target.value)}
                              placeholder="CPF, CNPJ, Celular, E-mail..."
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Chave Pix</label>
                            <input
                              type="text"
                              value={masterFormData.bancario_chavePix || ''}
                              onChange={(e) => updateMasterField('bancario_chavePix', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Banco Relacionado</label>
                            <input
                              type="text"
                              value={masterFormData.bancario_bancoPix || ''}
                              onChange={(e) => updateMasterField('bancario_bancoPix', e.target.value)}
                              placeholder="Nome do Banco"
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Titular Recomendado</label>
                            <input
                              type="text"
                              value={masterFormData.bancario_titularPix || ''}
                              onChange={(e) => updateMasterField('bancario_titularPix', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {masterEditorTab === 'casos' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">💼 Casos Relacionados</h3>
                    <p className="text-[10px] text-gray-400 font-bold mb-4">Controle central de todos os processos e contenciosos associados a este cliente.</p>
                    
                    {cases.filter(ca => ca.clientId === masterFormData.clientId).length === 0 ? (
                      <div className="text-[11px] text-gray-400 font-bold bg-gray-50 p-3 rounded-xl border border-gray-150 text-center">Nenhum caso associado a este cliente no momento.</div>
                    ) : (
                      <div className="space-y-3">
                        {cases.filter(ca => ca.clientId === masterFormData.clientId).map((ca) => (
                          <div key={ca.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                            <div>
                              <span className="px-2 py-0.5 bg-slate-700 text-white text-[9px] font-black uppercase rounded-md">{ca.registrationType || 'PROCESSO'}</span>
                              <h4 className="text-xs font-black uppercase text-slate-800 mt-1">{ca.title || 'Caso Sem Nome'}</h4>
                              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">CNJ: {ca.processNumber || 'NÃO CONFIGURADO'}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[10px] font-black uppercase">{ca.productionStatus || 'EM ANDAMENTO'}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('casos');
                                  setSearchTerm(ca.id);
                                  setSelectedMasterClient(null);
                                }}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 rounded-lg text-[10px] font-black text-slate-750 border border-slate-205 cursor-pointer"
                              >
                                EDITAR CASO
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {masterEditorTab === 'provas' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">📂 Provas & Pedidos de Evidência (Evidence Portal Mirror)</h3>
                    <p className="text-[10px] text-gray-450 font-bold mb-4">Veja ou fiscalize as solicitações de documentos e provas solicitadas.</p>
                    
                    {evidenceRequests.filter(er => er.clientId === masterFormData.clientId || cases.filter(ca => ca.clientId === masterFormData.clientId).map(ca => ca.id).includes(er.caseId)).length === 0 ? (
                      <div className="text-[11px] text-gray-400 font-bold bg-gray-50 p-3 rounded-xl border border-gray-150 text-center">Nenhuma solicitação de prova pendente ou enviada para este cliente.</div>
                    ) : (
                      <div className="space-y-2">
                        {evidenceRequests.filter(er => er.clientId === masterFormData.clientId || cases.filter(ca => ca.clientId === masterFormData.clientId).map(ca => ca.id).includes(er.caseId)).map((er: any) => (
                          <div key={er.id} className="p-3 bg-white border border-gray-100 rounded-xl flex items-center justify-between text-[11px] gap-2">
                            <div>
                              <span className="font-black text-gray-800 block uppercase">{er.title || er.reqType || 'Documento Requerido'}</span>
                              <span className="text-[9px] text-gray-400 font-bold max-w-xs truncate block">{er.description || 'Provas complementares de petição inicial'}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                              er.status === 'Enviado' ? 'bg-emerald-55 text-emerald-800' : 'bg-amber-50 text-amber-800'
                            }`}>{er.status || 'Ativo'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {masterEditorTab === 'informacoes' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">ℹ️ Informações & Questionários Cadastrais</h3>
                    <p className="text-[10px] text-gray-450 font-bold mb-4">Fichas de perguntas jurídicas de preenchimento para elaboração de petições.</p>
                    
                    {infoRequests.filter(ir => ir.clientId === masterFormData.clientId || cases.filter(ca => ca.clientId === masterFormData.clientId).map(ca => ca.id).includes(ir.caseId)).length === 0 ? (
                      <div className="text-[11px] text-gray-400 font-bold bg-gray-50 p-3 rounded-xl border border-gray-150 text-center">Nenhum pedido de informação ativa ou questionário de triagem enviado.</div>
                    ) : (
                      <div className="space-y-2">
                        {infoRequests.filter(ir => ir.clientId === masterFormData.clientId || cases.filter(ca => ca.clientId === masterFormData.clientId).map(ca => ca.id).includes(ir.caseId)).map((ir: any) => (
                          <div key={ir.id} className="p-3 bg-white border border-gray-110 rounded-xl flex items-center justify-between text-[11px] gap-2">
                            <div>
                              <span className="font-black text-gray-800 block uppercase">{ir.title || 'Formulário de Triagem'}</span>
                              <span className="text-[9px] block text-gray-400 font-mono">ID: {ir.id}</span>
                            </div>
                            <span className="px-2 py-0.5 bg-sky-50 text-sky-700 font-bold text-[9px] uppercase rounded-md">{ir.status || 'Pendente'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {masterEditorTab === 'audiencias' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">⚖️ Controle de Audiências Judiciais</h3>
                    <p className="text-[10px] text-gray-450 font-bold mb-4">Sessões marcadas de conciliação, instrução ou julgamento em tribunais.</p>
                    
                    {events.filter(e => e.clientId === masterFormData.clientId && (e.type || '').toLowerCase() === 'audiência').length === 0 ? (
                      <div className="text-[11px] text-gray-400 font-bold bg-gray-50 p-3 rounded-xl border border-gray-150 text-center">Nenhuma audiência judicial agendada no momento.</div>
                    ) : (
                      <div className="space-y-2">
                        {events.filter(e => e.clientId === masterFormData.clientId && (e.type || '').toLowerCase() === 'audiência').map((e) => (
                          <div key={e.id} className="p-3 bg-white border border-rose-100 rounded-xl flex items-center justify-between text-[11px] gap-2">
                            <div>
                              <span className="font-black text-gray-800 block uppercase">{e.title}</span>
                              <span className="text-[10px] block text-gray-400 font-bold font-mono">{e.date} {e.time}</span>
                            </div>
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-black text-[9px] uppercase rounded-md">🔴 AUDIÊNCIA</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {masterEditorTab === 'pericias' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">🔬 Perícias Médicas & Técnicas</h3>
                    <p className="text-[10px] text-gray-450 font-bold mb-4">Controle de vistorias técnicas, perícias contábeis ou de assistência médica agendadas.</p>
                    
                    {events.filter(e => e.clientId === masterFormData.clientId && (e.type || '').toLowerCase().includes('perícia')).length === 0 ? (
                      <div className="text-[11px] text-gray-400 font-bold bg-gray-50 p-3 rounded-xl border border-gray-150 text-center">Nenhuma perícia técnica/médica registrada para este cliente.</div>
                    ) : (
                      <div className="space-y-2">
                        {events.filter(e => e.clientId === masterFormData.clientId && (e.type || '').toLowerCase().includes('perícia')).map((e) => (
                          <div key={e.id} className="p-3 bg-white border border-teal-100 rounded-xl flex items-center justify-between text-[11px] gap-2">
                            <div>
                              <span className="font-black text-gray-800 block uppercase">{e.title}</span>
                              <span className="text-[10px] block text-gray-400 font-bold font-mono">{e.date} {e.time}</span>
                            </div>
                            <span className="px-2 py-0.5 bg-teal-50 text-teal-700 font-black text-[9px] uppercase rounded-md">🔬 PERÍCIA</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {masterEditorTab === 'reunioes' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">💬 Reuniões & Encontros de Alinhamento</h3>
                    <p className="text-[10px] text-gray-450 font-bold mb-4">Agenda integrada de meetings, calls de alinhamento e defesas prévias.</p>
                    
                    {events.filter(e => e.clientId === masterFormData.clientId && ['reunião', 'call', 'meeting'].includes((e.type || '').toLowerCase()) ).length === 0 ? (
                      <div className="text-[11px] text-gray-400 font-bold bg-gray-50 p-3 rounded-xl border border-gray-150 text-center">Nenhuma reunião ou call agendada com este cliente.</div>
                    ) : (
                      <div className="space-y-2">
                        {events.filter(e => e.clientId === masterFormData.clientId && ['reunião', 'call', 'meeting'].includes((e.type || '').toLowerCase()) ).map((e) => (
                          <div key={e.id} className="p-3 bg-white border border-indigo-100 rounded-xl flex items-center justify-between text-[11px] gap-2">
                            <div>
                              <span className="font-black text-gray-800 block uppercase">{e.title}</span>
                              <span className="text-[10px] block text-gray-400 font-bold font-mono">{e.date} {e.time}</span>
                            </div>
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-black text-[9px] uppercase rounded-md">💬 REUNIÃO</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {masterEditorTab === 'financeiro' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">💰 Painel Financeiro Mestre</h3>
                    <p className="text-[10px] text-gray-450 font-bold mb-4">Fluxo de caixa de faturas, custas judiciais indenizatórias e cobranças emitidas.</p>
                    
                    {financials.filter(f => f.clientId === masterFormData.clientId).length === 0 ? (
                      <div className="text-[11px] text-gray-400 font-bold bg-gray-50 p-3 rounded-xl border border-gray-150 text-center">Nenhum faturamento ou custa financeira ligada a este cliente.</div>
                    ) : (
                      <div className="space-y-2">
                        {financials.filter(f => f.clientId === masterFormData.clientId).map((f: any) => (
                          <div key={f.id} className="p-3 bg-white border border-emerald-100 rounded-xl flex items-center justify-between text-[11px] gap-2">
                            <div>
                              <span className="font-black text-slate-800 block uppercase">{f.description || 'Cobrança Judicial'}</span>
                              <span className="text-[10px] block text-emerald-700 font-mono font-bold">R$ {parseFloat(f.amount || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${
                              f.status === 'Paid' || f.status === 'Pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>{f.status || 'Ativo'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {masterEditorTab === 'logs' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">Log de Atividades e Auditoria Deploy Mestre</h3>
                    <p className="text-[10px] text-gray-400 font-bold mb-4">Registro imutável de modificações técnicas aplicadas de forma centralizada.</p>

                    {!(masterFormData.masterEditorLogs && masterFormData.masterEditorLogs.length > 0) ? (
                      <div className="text-[11px] text-gray-400 font-bold bg-gray-50 p-3 rounded-xl border border-gray-150 text-center">Toda alteração de dados gera logs de deploy. Faça alterações e salve para registrar.</div>
                    ) : (
                      <div className="border border-gray-150 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                        <table className="w-full text-left text-xs bg-white">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-black uppercase text-gray-500">
                              <th className="py-2.5 px-3">Data/Hora Log</th>
                              <th className="py-2.5 px-2">Operação</th>
                              <th className="py-2.5 px-2">Campos Alterados</th>
                            </tr>
                          </thead>
                          <tbody>
                            {masterFormData.masterEditorLogs.map((log: any, idx: number) => (
                              <tr key={idx} className="border-b border-gray-100 text-[10px]">
                                <td className="py-2 px-3 font-mono font-bold text-gray-400">{log.timestamp}</td>
                                <td className="py-2 px-2 text-indigo-700 font-black">{log.action}</td>
                                <td className="py-2 px-2 font-mono text-gray-700 max-w-xs truncate">{log.fieldsUpdated?.join(', ') || 'Nenhum'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {masterEditorTab === 'timeline' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">📢 Timeline Pública & Alertas Rápidos</h3>
                    <p className="text-[10px] text-gray-450 font-bold mb-4">Adicione avisos imediatos de andamento ou comunicados gerais na timeline pública deste cliente.</p>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Novo Comunicado na Timeline</label>
                        <textarea
                          rows={2}
                          value={newTimelineText}
                          onChange={(e) => setNewTimelineText(e.target.value)}
                          placeholder="Ex: Seu processo foi distribuído para a 3ª Vara Cível de Recife. Aguardamos homologação..."
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <label className="text-[10px] font-black uppercase text-gray-400">Tipo de Alerta:</label>
                          <select
                            value={newTimelineType}
                            onChange={(e: any) => setNewTimelineType(e.target.value)}
                            className="bg-white border border-gray-200 text-[10px] font-black uppercase rounded-lg px-2 py-1 outline-none text-gray-700"
                          >
                            <option value="info">💬 Informativo</option>
                            <option value="alerta">⚠️ Atenção Urgente</option>
                            <option value="sucesso">✅ Vitória / Sucesso</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newTimelineText.trim()) return;
                            const rightNowStr = new Date().toISOString();
                            const newEntry = {
                              id: rightNowStr + Math.random().toString(36).substring(2),
                              text: newTimelineText,
                              type: newTimelineType,
                              date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                              timestamp: rightNowStr
                            };
                            const updatedTimeline = [newEntry, ...(masterFormData.publicTimeline || [])];
                            updateMasterField('publicTimeline', updatedTimeline);
                            setNewTimelineText('');
                          }}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase cursor-pointer"
                        >
                          Inserir Evento
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      <span className="text-[10px] font-black uppercase text-gray-400 block pb-1 border-b">Feed Atual do Portal do Cliente ({masterFormData.publicTimeline?.length || 0})</span>
                      {!(masterFormData.publicTimeline && masterFormData.publicTimeline.length > 0) ? (
                        <p className="text-[11px] text-gray-400 text-center font-bold bg-gray-50 p-3 rounded-xl border">Nenhum evento registrado. Insira um acima.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {masterFormData.publicTimeline.map((item: any) => (
                            <div key={item.id} className="p-2.5 bg-white border border-gray-100 rounded-xl flex items-start justify-between gap-3 text-xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                    item.type === 'sucesso' ? 'bg-emerald-50 text-emerald-700' : item.type === 'alerta' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                                  }`}>{item.type || 'INFO'}</span>
                                  <span className="text-[9px] font-bold text-gray-400">{item.date}</span>
                                </div>
                                <p className="text-[11px] text-gray-750 font-medium mt-1">{item.text}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = masterFormData.publicTimeline.filter((t: any) => t.id !== item.id);
                                  updateMasterField('publicTimeline', updated);
                                }}
                                className="text-red-500 hover:text-red-700 text-[10px] font-bold p-1"
                              >
                                Excluir
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {masterEditorTab === 'visibilidade' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">👁️ Visibilidade & Módulos Habilitados no Portal</h3>
                    <p className="text-[10px] text-gray-450 font-bold mb-4">Escolha quais abas e módulos estarão visíveis para o cliente quando ele acessar o app.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                      {[
                        { key: 'showDashboard', label: '📊 Dashboard de Boas-Vindas', desc: 'Resumo com cartões e atalhos rápidos do cliente' },
                        { key: 'showCadastros', label: '👤 Dados Cadastrais', desc: 'Permite visualizar informações de PF/PJ' },
                        { key: 'showCasos', label: '💼 Processos e Casos Jurídicos', desc: 'Permite acompanhar CNJs e estágio atual do caso' },
                        { key: 'showProvas', label: '📂 Canal e Pedidos de Evidência', desc: 'Seção para upload de provas enviadas ou pendentes' },
                        { key: 'showInformacoes', label: 'ℹ️ Central de Fichas e Triagens', desc: 'Seção de perguntas e questionários' },
                        { key: 'showAudiencias', label: '⚖️ Calendário de Audiências', desc: 'Sinalização visual de audiências' },
                        { key: 'showPericias', label: '🔬 Seção de Perícias', desc: 'Compromissos médicos e técnicos' },
                        { key: 'showReunioes', label: '💬 Reuniões e Encontros', desc: 'Call de alinhamento e defesas' },
                        { key: 'showFinanceiro', label: '💰 Gestão Financeira', desc: 'Exibe faturas do cliente no portal' }
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-2.5 bg-white border border-gray-100 rounded-xl">
                          <div className="flex flex-col gap-0.5 max-w-[80%]">
                            <span className="text-[11px] font-black text-slate-800 uppercase leading-none">{item.label}</span>
                            <span className="text-[9px] text-gray-400 font-bold">{item.desc}</span>
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => updateMasterField(item.key, masterFormData[item.key] === false ? true : false)}
                              className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none flex ${
                                masterFormData[item.key] !== false ? 'bg-indigo-600 justify-end' : 'bg-gray-250 justify-start'
                              }`}
                            >
                              <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {masterEditorTab === 'gdrive' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">📁 Google Drive Integrado (gdrive)</h3>
                    <p className="text-[10px] text-gray-450 font-bold mb-4">Gerencie as conexões de arquivos compartilhados do Google Drive mestre.</p>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">URL Completa da Pasta do Cliente</label>
                        <input
                          type="text"
                          value={masterFormData.gdriveUrl || ''}
                          onChange={(e) => updateMasterField('gdriveUrl', e.target.value)}
                          placeholder="https://drive.google.com/drive/folders/..."
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                        />
                      </div>
                      {masterFormData.gdriveUrl && (
                        <a
                          href={masterFormData.gdriveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-700 hover:underline uppercase mt-1"
                        >
                          Mapear no Drive <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {masterEditorTab === 'gdocs' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <h3 className="text-xs font-black uppercase text-gray-800 mb-1 border-b pb-1">📄 Google Docs (gdocs) & Modelos de Procuração/Contratos</h3>
                    <p className="text-[10px] text-gray-450 font-bold mb-4">Insira os templates de minutas do Google Docs que são gerados automaticamente ou assinados eletronicamente.</p>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Modelo de Contrato de Honorários URL</label>
                        <input
                          type="text"
                          value={masterFormData.gdocsContractUrl || ''}
                          onChange={(e) => updateMasterField('gdocsContractUrl', e.target.value)}
                          placeholder="https://docs.google.com/document/d/..."
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Modelo de Procuração Ad Judicia URL</label>
                        <input
                          type="text"
                          value={masterFormData.gdocsPowerOfAttorneyUrl || ''}
                          onChange={(e) => updateMasterField('gdocsPowerOfAttorneyUrl', e.target.value)}
                          placeholder="https://docs.google.com/document/d/..."
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Declaração de Hipossuficiência URL</label>
                        <input
                          type="text"
                          value={masterFormData.gdocsDeclaraUrl || ''}
                          onChange={(e) => updateMasterField('gdocsDeclaraUrl', e.target.value)}
                          placeholder="https://docs.google.com/document/d/..."
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Minuta de Petição Inicial Integrada URL</label>
                        <input
                          type="text"
                          value={masterFormData.gdocsDraftUrl || ''}
                          onChange={(e) => updateMasterField('gdocsDraftUrl', e.target.value)}
                          placeholder="https://docs.google.com/document/d/..."
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {masterEditorTab === 'integridade' && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <h3 className="text-xs font-black uppercase text-gray-800">Verificar Integridade do Painel do Cliente</h3>
                        <p className="text-[10px] text-gray-450 font-bold font-sans">Diagnóstico completo automatizado de credenciais, slug, permissões, sincronizações e espelhamento.</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const errors: any[] = [];
                            
                            // Check 1: cliente existe em clients?
                            const clientExists = clients.some(c => c.id === masterFormData.clientId);
                            if (!clientExists) {
                              errors.push({
                                code: 'CLIENT_NOT_FOUND',
                                message: 'Cliente não foi localizado no banco (coleção "clients").',
                                severity: 'CRITICAL',
                                fixable: false
                              });
                            }

                            // Check 2: active está true?
                            if (masterFormData.active !== true) {
                              errors.push({
                                code: 'INACTIVE_PORTAL',
                                message: 'O portal deste cliente está desativado (campo active não é true).',
                                severity: 'WARNING',
                                fixable: true
                              });
                            }

                            // Check 3: visibleToClient está true?
                            if (masterFormData.visibleToClient !== true) {
                              errors.push({
                                code: 'NOT_VISIBLE_TO_CLIENT',
                                message: 'A visibilidade do portal para o cliente está desligada (visibleToClient não é true).',
                                severity: 'WARNING',
                                fixable: true
                              });
                            }

                            // Check 4: e-mail de login existe?
                            if (!masterFormData.acesso_emailLogin) {
                              errors.push({
                                code: 'MISSING_EMAIL',
                                message: 'Primeiro e-mail de login do cliente está ausente das configurações de acesso.',
                                severity: 'CRITICAL',
                                fixable: true
                              });
                            }

                            // Check 5: senha existe?
                            if (!masterFormData.acesso_senha) {
                              errors.push({
                                code: 'MISSING_PASSWORD',
                                message: 'Nenhuma senha de acesso cadastrada ou visível nas chaves.',
                                severity: 'CRITICAL',
                                fixable: true
                              });
                            }

                            // Check 6: clientSlug existe?
                            if (!masterFormData.slug) {
                              errors.push({
                                code: 'NO_SLUG',
                                message: 'Este cliente mestre não possui Slug de acesso cadastrado (clientSlug vazio).',
                                severity: 'CRITICAL',
                                fixable: true
                              });
                            }

                            // Check 7: clientPortals existe?
                            let portalDocExists = false;
                            let portalDocClientId = '';
                            if (masterFormData.slug) {
                              const portalSnap = await getDoc(doc(db, 'clientPortals', masterFormData.slug));
                              portalDocExists = portalSnap.exists();
                              if (!portalDocExists) {
                                errors.push({
                                  code: 'MISSING_PORTAL_DOC',
                                  message: `Documento de espelhamento em clientPortals/[${masterFormData.slug}] está ausente.`,
                                  severity: 'CRITICAL',
                                  fixable: true
                                });
                              } else {
                                portalDocClientId = portalSnap.data()?.clientId || '';
                              }
                            } else {
                              errors.push({
                                code: 'MISSING_PORTAL_DOC_NO_SLUG',
                                message: 'Impossível verificar clientPortals com slug vazio.',
                                severity: 'CRITICAL',
                                fixable: false
                              });
                            }

                            // Check 8: users existe?
                            const userSnap = await getDoc(doc(db, 'users', masterFormData.clientId));
                            const userDocExists = userSnap.exists();
                            let userDocClientId = '';
                            let userDocSlug = '';
                            let userData: any = null;
                            if (!userDocExists) {
                              errors.push({
                                code: 'MISSING_USER_DOC',
                                message: `Documento de credenciais em users/[${masterFormData.clientId}] está ausente.`,
                                severity: 'CRITICAL',
                                fixable: true
                              });
                            } else {
                              userData = userSnap.data();
                              userDocClientId = userData?.clientId || '';
                              userDocSlug = userData?.clientSlug || '';
                            }

                            // Check 9: clientId bate entre coleções?
                            if (portalDocExists && portalDocClientId !== masterFormData.clientId) {
                              errors.push({
                                code: 'PORTAL_CLIENT_MISMATCH',
                                message: `O documento em clientPortals/[${masterFormData.slug}] aponta para outro clientId (${portalDocClientId || 'nenhum'}).`,
                                severity: 'CRITICAL',
                                fixable: true
                              });
                            }
                            if (userDocExists && userDocClientId && userDocClientId !== masterFormData.clientId) {
                              errors.push({
                                code: 'USER_CLIENT_MISMATCH',
                                message: `O documento em users/[${masterFormData.clientId}] aponta para outro clientId (${userDocClientId}).`,
                                severity: 'CRITICAL',
                                fixable: true
                              });
                            }

                            // Check 10: há casos vinculados?
                            const linkedCases = cases.filter(ca => ca.clientId === masterFormData.clientId);
                            if (linkedCases.length === 0) {
                              errors.push({
                                code: 'NO_LINKED_CASES',
                                message: 'Nenhum Processo Judicial (Caso) está vinculado a este cliente no banco.',
                                severity: 'WARNING',
                                fixable: false
                              });
                            }

                            // Check 11: há dados visíveis ao cliente?
                            const hasVisibleCases = linkedCases.some(ca => ca.visibleToClient === true || ca.visibleToClient === undefined);
                            const clientInfoReqs = infoRequests.filter(r => r.clientId === masterFormData.clientId);
                            const clientEvidenceReqs = evidenceRequests.filter(e => e.clientId === masterFormData.clientId);
                            const totalVisibleItems = (hasVisibleCases ? 1 : 0) + clientInfoReqs.length + clientEvidenceReqs.length;
                            if (totalVisibleItems === 0 || masterFormData.visibleToClient !== true) {
                              errors.push({
                                code: 'NO_VISIBLE_DATA_TO_CLIENT',
                                message: 'Este cliente possui zero painéis, processos ou requisições configuradas como visíveis.',
                                severity: 'WARNING',
                                fixable: true
                              });
                            }

                            // Check 12: há divergência entre BOSS e Portal do Cliente?
                            let hasDivergence = false;
                            let divergenceDetails = [];
                            if (userDocExists && userData) {
                              const bossName = masterFormData.type === 'PF' ? masterFormData.pf_nomeCompleto : masterFormData.pj_razaoSocial;
                              if (userData.name !== bossName) {
                                hasDivergence = true;
                                divergenceDetails.push(`Nome BOSS (${bossName}) diferente de Usuário (${userData.name})`);
                              }
                              if (userData.email !== masterFormData.acesso_emailLogin) {
                                hasDivergence = true;
                                divergenceDetails.push(`E-mail BOSS (${masterFormData.acesso_emailLogin}) diferente de Usuário (${userData.email})`);
                              }
                              if (userData.clientSlug !== masterFormData.slug) {
                                hasDivergence = true;
                                divergenceDetails.push(`Slug BOSS (${masterFormData.slug}) diferente de Usuário (${userData.clientSlug})`);
                              }
                              if (userData.senhaVisivelPreview !== masterFormData.acesso_senha) {
                                hasDivergence = true;
                                divergenceDetails.push('Senha BOSS diferente de Usuário');
                              }
                            }
                            if (hasDivergence) {
                              errors.push({
                                code: 'BOSS_PORTAL_DIVERGENCE',
                                message: `Dados divergentes entre BOSS e Portal de Acesso: ${divergenceDetails.join('; ')}.`,
                                severity: 'WARNING',
                                fixable: true
                              });
                            }

                            setDiagResults(errors);
                            setDiagStatusGeral(errors.length === 0 ? 'Íntegro' : errors.some(e => e.severity === 'CRITICAL') ? 'Erro crítico' : 'Atenção');
                            setDiagRun(true);
                          } catch (err: any) {
                            console.error(err);
                            alert('Erro ao rodar diagnóstico: ' + err.message);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-lg text-[10px] font-black uppercase cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Verificar Integridade do Painel do Cliente
                      </button>
                    </div>

                    {!diagRun ? (
                      <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-250">
                        <ShieldAlert className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <span className="text-[11px] text-gray-500 font-bold uppercase block">Pronto para Verificação de Integridade</span>
                        <p className="text-[10px] text-gray-400 mt-1 font-medium">Clique no botão para executar a varredura das 12 regras de integridade do painel.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white border">
                          <span className="text-[10px] font-black uppercase text-gray-400">RESULTADO GERAL DO PAINEL:</span>
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                            diagStatusGeral === 'Íntegro' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            diagStatusGeral === 'Erro crítico' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>{diagStatusGeral}</span>
                        </div>

                        {diagResults.length === 0 ? (
                          <div className="p-4 bg-emerald-50 text-emerald-850 border border-emerald-150 rounded-xl text-xs flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-650 flex-shrink-0" />
                            <div>
                              <span className="font-extrabold uppercase block text-[11px]">Painel Totalmente Íntegro</span>
                              <p className="text-[10px] text-emerald-700 mt-0.5">Nenhuma falha de login, vínculos apagados ou espelhamento foi encontrada.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {diagResults.map((item, index) => (
                              <div key={index} className="p-3 bg-white border border-gray-150 rounded-xl flex items-start justify-between gap-3 text-xs shadow-3xs">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${
                                      item.severity === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-150' : 'bg-amber-50 text-amber-700 border-amber-150'
                                    }`}>{item.severity}</span>
                                    <span className="font-mono text-[9px] text-gray-400 font-bold">{item.code}</span>
                                  </div>
                                  <p className="text-[11px] text-gray-755 font-bold mt-1 uppercase leading-snug">{item.message}</p>
                                </div>
                                {item.fixable && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                        setLoading(true);
                                        try {
                                          const nowStr = new Date().toISOString();
                                          
                                          if (item.code === 'NOT_VISIBLE_TO_CLIENT' || item.code === 'NO_VISIBLE_DATA_TO_CLIENT') {
                                            updateMasterField('visibleToClient', true);
                                            await setDoc(doc(db, 'masterEditorLogs', 'log_fix_' + Date.now()), {
                                              id: 'log_fix_' + Date.now(),
                                              clientId: masterFormData.clientId,
                                              areaChanged: 'Visibilidade',
                                              action: 'FIX_VISIBLE_TO_CLIENT',
                                              previousValue: 'false',
                                              newValue: 'true',
                                              changedBy: 'BOSS_PORTAL_ADMIN',
                                              changedAt: nowStr,
                                              reason: 'Ativação assistida de visibilidade de painel'
                                            });
                                            alert('A visibilidade do Portal foi ativada temporariamente! Salve o formulário para gravar na ficha.');
                                          } 
                                          else if (item.code === 'MISSING_EMAIL') {
                                            const emailValue = prompt('Digite o e-mail de login correto:', masterFormData.pf_email || masterFormData.pj_emailEmpresa || 'cliente@giffoni.com');
                                            if (emailValue) {
                                              updateMasterField('acesso_emailLogin', emailValue);
                                              await setDoc(doc(db, 'masterEditorLogs', 'log_fix_' + Date.now()), {
                                                id: 'log_fix_' + Date.now(),
                                                clientId: masterFormData.clientId,
                                                areaChanged: 'Acesso',
                                                action: 'FIX_EMAIL_LOGIN',
                                                previousValue: masterFormData.acesso_emailLogin || '',
                                                newValue: emailValue,
                                                changedBy: 'BOSS_PORTAL_ADMIN',
                                                changedAt: nowStr,
                                                reason: 'Correção assistida de e-mail de login'
                                              });
                                              alert('E-mail atualizado provisoriamente. Salve o formulário para gravar no banco.');
                                            }
                                          } 
                                          else if (item.code === 'MISSING_PASSWORD') {
                                            const senhaValue = prompt('Digite a senha para acesso:', '123456');
                                            if (senhaValue) {
                                              updateMasterField('acesso_senha', senhaValue);
                                              await setDoc(doc(db, 'masterEditorLogs', 'log_fix_' + Date.now()), {
                                                id: 'log_fix_' + Date.now(),
                                                clientId: masterFormData.clientId,
                                                areaChanged: 'Acesso',
                                                action: 'FIX_PASSWORD',
                                                previousValue: masterFormData.acesso_senha || '',
                                                newValue: senhaValue,
                                                changedBy: 'BOSS_PORTAL_ADMIN',
                                                changedAt: nowStr,
                                                reason: 'Correção assistida de senha de login'
                                              });
                                              alert('Senha atualizada provisoriamente. Salve o formulário para gravar no banco.');
                                            }
                                          } 
                                          else if (item.code === 'MISSING_PORTAL_DOC' || item.code === 'PORTAL_CLIENT_MISMATCH') {
                                            if (!masterFormData.slug) {
                                              alert('Erro: É necessário definir o slug de acesso primeiro.');
                                              setLoading(false);
                                              return;
                                            }
                                            await setDoc(doc(db, 'clientPortals', masterFormData.slug), {
                                              clientId: masterFormData.clientId,
                                              slug: masterFormData.slug,
                                              active: masterFormData.active !== false,
                                              createdAt: nowStr,
                                              updatedAt: nowStr
                                            });
                                            await setDoc(doc(db, 'masterEditorLogs', 'log_fix_' + Date.now()), {
                                              id: 'log_fix_' + Date.now(),
                                              clientId: masterFormData.clientId,
                                              areaChanged: 'clientPortals',
                                              action: 'RECREATE_PORTAL_LINK',
                                              previousValue: 'Nenhum / Desalinhado',
                                              newValue: masterFormData.slug,
                                              changedBy: 'BOSS_PORTAL_ADMIN',
                                              changedAt: nowStr,
                                              reason: 'Vínculo do slug recriado assistidamente via integridade'
                                            });
                                            alert('Vínculo em clientPortals do slug recriado/corrigido com sucesso!');
                                          } 
                                          else if (item.code === 'MISSING_USER_DOC' || item.code === 'USER_CLIENT_MISMATCH') {
                                            const correctEmail = masterFormData.acesso_emailLogin || masterFormData.pf_email || 'cliente@giffoni.com';
                                            const correctSenha = masterFormData.acesso_senha || '123456';
                                            await setDoc(doc(db, 'users', masterFormData.clientId), {
                                              email: correctEmail,
                                              role: 'client',
                                              clientId: masterFormData.clientId,
                                              clientSlug: masterFormData.slug || '',
                                              name: masterFormData.type === 'PF' ? masterFormData.pf_nomeCompleto : masterFormData.pj_razaoSocial,
                                              status: masterFormData.acesso_statusAcesso || 'Ativo',
                                              senhaVisivelPreview: correctSenha,
                                              updatedAt: nowStr
                                            });
                                            await setDoc(doc(db, 'masterEditorLogs', 'log_fix_' + Date.now()), {
                                              id: 'log_fix_' + Date.now(),
                                              clientId: masterFormData.clientId,
                                              areaChanged: 'users',
                                              action: 'RECREATE_USER_LINK',
                                              previousValue: 'Nenhum / Desalinhado',
                                              newValue: correctEmail,
                                              changedBy: 'BOSS_PORTAL_ADMIN',
                                              changedAt: nowStr,
                                              reason: 'Vínculo em users de credenciais de login recriado'
                                            });
                                            alert('Vínculo em users de credenciais de login recriado com absoluto sucesso!');
                                          } 
                                          else if (item.code === 'NO_SLUG') {
                                            const newSlugValue = prompt('Digite o novo slug único para este cliente:', masterFormData.pf_nomeCompleto ? masterFormData.pf_nomeCompleto.split(' ')[0].toLowerCase() : 'portal-cliente');
                                            if (newSlugValue) {
                                              updateMasterField('slug', newSlugValue);
                                              await setDoc(doc(db, 'masterEditorLogs', 'log_fix_' + Date.now()), {
                                                id: 'log_fix_' + Date.now(),
                                                clientId: masterFormData.clientId,
                                                areaChanged: 'Slug',
                                                action: 'UPDATE_CLIENT_SLUG',
                                                previousValue: masterFormData.slug || '',
                                                newValue: newSlugValue,
                                                changedBy: 'BOSS_PORTAL_ADMIN',
                                                changedAt: nowStr,
                                                reason: 'Atualização de slug assistida via integridade'
                                              });
                                              alert('Slug alterado provisoriamente. Salve o formulário para gravar na tabela!');
                                            }
                                          } 
                                          else if (item.code === 'BOSS_PORTAL_DIVERGENCE') {
                                            const correctName = masterFormData.type === 'PF' ? masterFormData.pf_nomeCompleto : masterFormData.pj_razaoSocial;
                                            const correctEmail = masterFormData.acesso_emailLogin || masterFormData.pf_email || 'cliente@giffoni.com';
                                            const correctSenha = masterFormData.acesso_senha || '123456';
                                            
                                            await setDoc(doc(db, 'users', masterFormData.clientId), {
                                              email: correctEmail,
                                              role: 'client',
                                              clientId: masterFormData.clientId,
                                              clientSlug: masterFormData.slug || '',
                                              name: correctName,
                                              status: masterFormData.acesso_statusAcesso || 'Ativo',
                                              senhaVisivelPreview: correctSenha,
                                              updatedAt: nowStr
                                            });

                                            if (masterFormData.slug) {
                                              await setDoc(doc(db, 'clientPortals', masterFormData.slug), {
                                                clientId: masterFormData.clientId,
                                                slug: masterFormData.slug,
                                                active: masterFormData.active !== false,
                                                createdAt: nowStr,
                                                updatedAt: nowStr
                                              });
                                            }
                                            
                                            await setDoc(doc(db, 'masterEditorLogs', 'log_fix_' + Date.now()), {
                                              id: 'log_fix_' + Date.now(),
                                              clientId: masterFormData.clientId,
                                              areaChanged: 'portalMirror',
                                              action: 'REGENERATE_PORTAL_MIRROR',
                                              previousValue: 'Divergências Cadastrais',
                                              newValue: 'Sincronizado',
                                              changedBy: 'BOSS_PORTAL_ADMIN',
                                              changedAt: nowStr,
                                              reason: 'Regeneração completa e alinhamento de credenciais e portalMirror'
                                            });
                                            alert('Portal Mirror e dados de login sincronizados e alinhados com sucesso!');
                                          }
                                          else if (item.code === 'INACTIVE_PORTAL') {
                                            updateMasterField('active', true);
                                            await setDoc(doc(db, 'masterEditorLogs', 'log_fix_' + Date.now()), {
                                              id: 'log_fix_' + Date.now(),
                                              clientId: masterFormData.clientId,
                                              areaChanged: 'Status',
                                              action: 'REACTIVATE_PORTAL',
                                              previousValue: 'false',
                                              newValue: 'true',
                                              changedBy: 'BOSS_PORTAL_ADMIN',
                                              changedAt: nowStr,
                                              reason: 'Reativação de portal desativado via verificação de integridade'
                                            });
                                            alert('Status de ativação definido como verdadeiro! Salve o formulário para persistir no cliente.');
                                          }

                                          // Trigger recalculate / filter out corrected item
                                          setDiagResults(prev => prev.filter(p => p.code !== item.code));
                                        } catch (fixErr: any) {
                                          alert('Erro na autocorreção: ' + fixErr.message);
                                        } finally {
                                          setLoading(false);
                                        }
                                    }}
                                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-250 text-amber-700 rounded-lg text-[9px] font-black uppercase cursor-pointer transition-colors"
                                  >
                                    Corrigir Automaticamente
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            {/* Modal Actions */}
            <div className="border-t border-gray-150 px-6 py-4 bg-slate-50 flex items-center justify-between">
              <span className="text-[10px] text-gray-450 font-bold uppercase">SISTEMA INTEGRADO DE COMPLIANCE DEPLOY</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMasterClient(null)}
                  className="px-4 py-2.5 bg-white hover:bg-gray-100 border border-gray-250 text-gray-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Descartar Alterações
                </button>
                <button
                  type="button"
                  onClick={handleSaveMasterEditor}
                  disabled={loading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-all active:scale-[0.98] shadow-md shadow-blue-100 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Gravar e Sincronizar Portal'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </BossLayout>
  );
}
