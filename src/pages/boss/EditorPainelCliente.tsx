import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  query, 
  where,
  addDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BossLayout } from '../../components/Layout';

// Core dynamic layouts unified with Fluxo de Produção
import { PFForm } from '../../modules/boss/components/forms/PFForm';
import { PJForm } from '../../modules/boss/components/forms/PJForm';
import { SocioForm } from '../../modules/boss/components/forms/SocioForm';
import { AccessForm } from '../../modules/boss/components/forms/AccessForm';
import { BankingForm } from '../../modules/boss/components/forms/BankingForm';
import { 
  ArrowLeft, Save, ExternalLink, Shield, User, Briefcase, 
  Activity, ListTodo, Plus, Trash2, CheckCircle, Clock, DollarSign, 
  ChevronRight, AlertCircle, FileText, Send, Loader2, Gavel
} from 'lucide-react';

export default function EditorPainelCliente() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Master data
  const [client, setClient] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  
  // UI Tabs & sub-states
  const [activeTab, setActiveTab ] = useState<'overview' | 'cadastro' | 'casos' | 'visibilidade' | 'timeline' | 'logs'>('overview');
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [activeCaseTab, setActiveCaseTab] = useState<'dados' | 'experiencia' | 'informacoes' | 'provas' | 'financeiro' | 'edrp' | 'controladoria' | 'timeline_caso' | 'visibilidade_caso'>('dados');
  
  // Form State - Client Detail
  const [formData, setFormData] = useState<any>({});
  
  // Case Forms, information requests, evidence requests, financials
  const [caseFormData, setCaseFormData] = useState<any>({});
  const [infoRequests, setInfoRequests] = useState<any[]>([]);
  const [evidenceRequests, setEvidenceRequests] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  
  // Case Experience details (Roadmap)
  const [caseExperience, setCaseExperience] = useState<any>({
    currentPhase: '',
    currentPhaseLabel: '',
    progressPercentage: 0,
    estimatedDurationDays: 120,
    estimatedDurationLabel: 'Prazo médio estimado',
    phaseStartedAt: '',
    publicPhaseDescription: '',
    nextPublicStep: '',
    expectationNotice: 'O prazo pode variar conforme o Tribunal, volume processual e necessidade de manifestações adicionais.'
  });

  // Case Priority details (Home Priority)
  const [casePriority, setCasePriority] = useState<any>({
    priorityLevel: 'informative',
    priorityTitle: '',
    priorityDescription: '',
    priorityActionLabel: '',
    priorityActionRoute: '',
    priorityVisible: false
  });

  // Case Timeline events array
  const [caseTimelineEvents, setCaseTimelineEvents] = useState<any[]>([]);

  // Selection list for public micro-updates
  const [selectedQuickMicroValue, setSelectedQuickMicroValue] = useState<string>('A equipe realizou nova revisão técnica do seu caso.');

  // Custom case timeline manual event state
  const [customCaseTimelineEvent, setCustomCaseTimelineEvent] = useState({
    title: '',
    description: '',
    eventDate: '',
    eventType: 'atendimento',
    originType: 'BOSS_INTERNAL',
    publicVisible: true,
    automatic: false,
    icon: 'Activity',
    color: 'indigo',
    priority: 'medium'
  });

  // New modal/forms states
  const [newInfoReq, setNewInfoReq] = useState({ title: '', question: '', visibleToClient: true, status: 'pending', internalNotes: '' });
  const [newEvidenceReq, setNewEvidenceReq] = useState({ title: '', description: '', documentType: '', visibleToClient: true, status: 'pending', deadline: '', internalNotes: '' });
  const [newFin, setNewFin] = useState({ totalValue: '', paidValue: '', pendingValue: '', status: 'pendente', paymentMethod: 'PIX', paymentLink: '', dueDate: '', observations: '', visibleToClient: true });
  const [newTimelineEvent, setNewTimelineEvent] = useState({ title: '', description: '', date: '', type: 'info', priority: 'medium' });

  // Fetch all necessary data for the client
  const fetchData = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      // 1. Fetch Client Document from clients
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      if (!clientDoc.exists()) {
        alert('Cliente não localizado no banco de dados.');
        navigate('/boss-giffoni-clientes/central-controle');
        return;
      }
      
      const clientData = clientDoc.data();
      setClient(clientData);
      
      const pf = clientData.pfDadosPessoais || clientData.pfData || {};
      const pj = clientData.pjDadosEmpresa || clientData.pjData || {};
      const socio = clientData.socioDadosPessoais || clientData.socioData || {};
      const access = clientData.acessoSistema || {};
      const bancario = clientData.bancarioDadosBancarios || clientData.bancarioData || {};
      
      // Setup Form Data matching the fields structure
      const initialFormData: any = {
        id: clientId,
        slug: clientData.slug || '',
        type: clientData.type || 'PF',
        active: clientData.active !== false,
        visibleToClient: clientData.visibleToClient !== false,
        portalStatus: clientData.portalStatus || 'criado',
        gdriveUrl: clientData.gdriveUrl || '',
        gdocsUrl: clientData.gdocsUrl || '',
        
        acesso_emailLogin: access.acesso_emailLogin || clientData.email || '',
        acesso_senha: access.acesso_senha || clientData.senhaVisivelPreview || '',
        acesso_statusAcesso: access.acesso_statusAcesso || 'ativo',
  
        ...pf,
        ...pj,
        ...socio,
        ...bancario,
      };

      const defaults: any = {
        pf_nomeCompleto: '',
        pf_cpf: '',
        pf_rg: '',
        pf_dataNascimento: '',
        pf_nacionalidade: '',
        pf_profissao: '',
        pf_estadoCivil: '',
        pf_email: '',
        pf_telefone: '',
        pf_whatsapp: '',
        pf_cep: '',
        pf_endereco: '',
        pf_numero: '',
        pf_complemento: '',
        pf_bairro: '',
        pf_cidade: '',
        pf_estado: '',
        pf_instagram: '',
        pf_facebook: '',
        pf_tiktok: '',
        
        pj_razaoSocial: '',
        pj_nomeFantasia: '',
        pj_cnpj: '',
        pj_telefoneEmpresa: '',
        pj_whatsappEmpresa: '',
        pj_cepEmpresa: '',
        pj_enderecoEmpresa: '',
        pj_numeroEmpresa: '',
        pj_complementoEmpresa: '',
        pj_bairroEmpresa: '',
        pj_cidadeEmpresa: '',
        pj_estadoEmpresa: '',
        pj_instagramEmpresa: '',
        pj_facebookEmpresa: '',
        pj_tiktokEmpresa: '',
        pj_emailEmpresa: '',

        socio_nomeCompleto: '',
        socio_cpf: '',
        socio_rg: '',
        socio_dataNascimento: '',
        socio_profissao: '',
        socio_estadoCivil: '',
        socio_cep: '',
        socio_endereco: '',
        socio_numero: '',
        socio_complemento: '',
        socio_bairro: '',
        socio_cidade: '',
        socio_estado: '',
        socio_instagram: '',
        socio_facebook: '',
        socio_tiktok: '',

        bancario_possuiDadosBancarios: false,
        bancario_tipoChavePix: '',
        bancario_chavePix: '',
        bancario_bancoPix: '',
        bancario_titularPix: '',
        bancario_banco: '',
        bancario_agencia: '',
        bancario_conta: '',
        bancario_tipoConta: '',
        bancario_titularConta: '',
        bancario_titularEhCliente: false,
        bancario_usarCpfComoPix: false
      };

      Object.keys(defaults).forEach(key => {
        if (initialFormData[key] === undefined) {
          initialFormData[key] = defaults[key];
        }
      });

      if (!initialFormData.pf_dataNascimento && pf.pf_nascimento) {
        initialFormData.pf_dataNascimento = pf.pf_nascimento;
      }

      setFormData({
        ...initialFormData,
        showDashboard: clientData.showDashboard !== false,
        showCadastros: clientData.showCadastros !== false,
        showCasos: clientData.showCasos !== false,
        showProvas: clientData.showProvas !== false,
        showInformacoes: clientData.showInformacoes !== false,
        showAudiencias: clientData.showAudiencias !== false,
        showPericias: clientData.showPericias !== false,
        showReunioes: clientData.showReunioes !== false,
        showFinanceiro: clientData.showFinanceiro !== false,
  
        gdocsContractUrl: clientData.gdocsContractUrl || '',
        gdocsPowerOfAttorneyUrl: clientData.gdocsPowerOfAttorneyUrl || '',
        gdocsDeclaraUrl: clientData.gdocsDeclaraUrl || '',
        gdocsDraftUrl: clientData.gdocsDraftUrl || '',
  
        publicTimeline: clientData.publicTimeline || [],
        masterEditorLogs: clientData.masterEditorLogs || []
      });

      // 2. Fetch Cases matching clientId
      const casesSnap = await getDocs(query(collection(db, 'cases'), where('clientId', '==', clientId)));
      const casesList = casesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCases(casesList);

      // 3. Fetch Master Logs
      const logsSnap = await getDocs(query(collection(db, 'masterEditorLogs'), where('clientId', '==', clientId)));
      const logsList = logsSnap.docs.map(doc => doc.data()).sort((a: any, b: any) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
      setLogs(logsList);

    } catch (err) {
      console.error(err);
      alert('Erro ao carregar dados do cliente do Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientId]);

  // Handle case selection and load dependencies nested under this case
  const handleSelectCase = async (c: any) => {
    setSelectedCase(c);
    setCaseFormData({
      id: c.id,
      title: c.title || '',
      actionType: c.actionType || c.subject || '',
      oppositeParty: c.oppositeParty || '',
      processNumber: c.processNumber || '',
      court: c.court || '',
      vara: c.courtRoom || c.vara || '',
      comarca: c.comarca || '',
      internalStatus: c.internalStatus || '',
      publicStatus: c.publicStatus || c.clientStatus || '',
      description: c.description || '',
      responsible: c.responsible || c.lawyer || '',
      priority: c.priority || 'média',
      visibleToClient: c.visibleToClient !== false,
      visivelParaCliente: c.visivelParaCliente !== false,
      statusPublicoCliente: c.statusPublicoCliente || '',
      edrp: c.edrp || {},
      controladoria: c.controladoria || {},
      technicalCategory: c.technicalCategory || '',
      subCategory: c.subCategory || ''
    });

    // Populate roadmap & priority states with defaults if empty
    const roadmap = c.clientExperience || {};
    setCaseExperience({
      currentPhase: roadmap.currentPhase || '',
      currentPhaseLabel: roadmap.currentPhaseLabel || '',
      progressPercentage: roadmap.progressPercentage !== undefined ? Number(roadmap.progressPercentage) : 0,
      estimatedDurationDays: roadmap.estimatedDurationDays !== undefined ? Number(roadmap.estimatedDurationDays) : 120,
      estimatedDurationLabel: roadmap.estimatedDurationLabel || 'Prazo médio estimado',
      phaseStartedAt: roadmap.phaseStartedAt || '',
      publicPhaseDescription: roadmap.publicPhaseDescription || '',
      nextPublicStep: roadmap.nextPublicStep || '',
      expectationNotice: roadmap.expectationNotice || 'O prazo pode variar conforme o Tribunal, volume processual e necessidade de manifestações adicionais.'
    });

    const cp = c.clientPriority || {};
    setCasePriority({
      priorityLevel: cp.priorityLevel || 'informative',
      priorityTitle: cp.priorityTitle || '',
      priorityDescription: cp.priorityDescription || '',
      priorityActionLabel: cp.priorityActionLabel || '',
      priorityActionRoute: cp.priorityActionRoute || '',
      priorityVisible: cp.priorityVisible === true
    });

    // Reset quick selection items or manual entry
    setSelectedQuickMicroValue('A equipe realizou nova revisão técnica do seu caso.');
    setCustomCaseTimelineEvent({
      title: '',
      description: '',
      eventDate: new Date().toISOString().split('T')[0],
      eventType: 'atendimento',
      originType: 'BOSS_INTERNAL',
      publicVisible: true,
      automatic: false,
      icon: 'Activity',
      color: 'indigo',
      priority: 'medium'
    });

    // Load related requests
    try {
      const infoSnap = await getDocs(query(collection(db, 'caseInformationRequests'), where('caseId', '==', c.id)));
      setInfoRequests(infoSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const evidenceSnap = await getDocs(query(collection(db, 'caseEvidenceRequests'), where('caseId', '==', c.id)));
      setEvidenceRequests(evidenceSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const finSnap = await getDocs(query(collection(db, 'caseFinancials'), where('caseId', '==', c.id)));
      setFinancials(finSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch Case Timeline Events
      const timelineSnap = await getDocs(query(collection(db, 'caseTimeline'), where('caseId', '==', c.id)));
      const timelineList = timelineSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => {
          const dateA = a.eventDate || a.createdAt || '';
          const dateB = b.eventDate || b.createdAt || '';
          return dateB.localeCompare(dateA);
        });
      setCaseTimelineEvents(timelineList);
    } catch (err) {
      console.error('Erro ao buscar dados dependentes do caso:', err);
    }
  };

  // Create an Audit Log in masterEditorLogs
  const addAuditLog = async (area: string, action: string, prevObj: any, newObj: any) => {
    const logId = 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const rightNow = new Date().toISOString();
    try {
      await setDoc(doc(db, 'masterEditorLogs', logId), {
        id: logId,
        clientId: clientId,
        caseId: selectedCase?.id || '',
        areaChanged: area,
        action: action,
        previousValue: JSON.stringify(prevObj),
        newValue: JSON.stringify(newObj),
        changedBy: 'BOSS_PORTAL_ADMIN',
        changedAt: rightNow,
        reason: 'Edição direta via Editor do Painel do Cliente'
      });
      // reload logs list
      setLogs(p => [{ id: logId, areaChanged: area, action, changedAt: rightNow, changedBy: 'BOSS_PORTAL_ADMIN' }, ...p]);
    } catch (e) {
      console.warn('Erro ao criar log de auditoria técnica:', e);
    }
  };

  // ACTION: SAVE CLIENT MASTER DATA
  const handleSaveClientData = async () => {
    if (!clientId) return;
    setSaving(true);
    try {
      const rightNow = new Date().toISOString();
      const oldSlug = client.slug || '';
      const newSlug = formData.slug || '';

      if (newSlug !== oldSlug) {
        const checkSnap = await getDoc(doc(db, 'clientPortals', newSlug));
        if (checkSnap.exists()) {
          alert(`Erro: O slug [/${newSlug}] já está sendo utilizado por outro portal.`);
          setSaving(false);
          return;
        }
      }

      const clientName = formData.type === 'PF' ? formData.pf_nomeCompleto : formData.pj_razaoSocial;

      const syncedPayload: any = {
        ...client,
        id: clientId,
        clientId: clientId,
        type: formData.type,
        active: formData.active,
        visibleToClient: formData.visibleToClient,
        portalStatus: formData.portalStatus,
        slug: newSlug,
        senhaVisivelPreview: formData.acesso_senha,
        gdriveUrl: formData.gdriveUrl,
        gdocsUrl: formData.gdocsUrl,
        updatedAt: rightNow,

        showDashboard: formData.showDashboard !== false,
        showCadastros: formData.showCadastros !== false,
        showCasos: formData.showCasos !== false,
        showProvas: formData.showProvas !== false,
        showInformacoes: formData.showInformacoes !== false,
        showAudiencias: formData.showAudiencias !== false,
        showPericias: formData.showPericias !== false,
        showReunioes: formData.showReunioes !== false,
        showFinanceiro: formData.showFinanceiro !== false,

        gdocsContractUrl: formData.gdocsContractUrl || '',
        gdocsPowerOfAttorneyUrl: formData.gdocsPowerOfAttorneyUrl || '',
        gdocsDeclaraUrl: formData.gdocsDeclaraUrl || '',
        gdocsDraftUrl: formData.gdocsDraftUrl || '',

        publicTimeline: formData.publicTimeline || [],
        
        pfDadosPessoais: {
          pf_nomeCompleto: formData.pf_nomeCompleto || '',
          pf_cpf: formData.pf_cpf || '',
          pf_rg: formData.pf_rg || '',
          pf_dataNascimento: formData.pf_dataNascimento || '',
          pf_nacionalidade: formData.pf_nacionalidade || '',
          pf_profissao: formData.pf_profissao || '',
          pf_estadoCivil: formData.pf_estadoCivil || ''
        },
        pfContato: {
          pf_email: formData.pf_email || '',
          pf_telefone: formData.pf_telefone || '',
          pf_whatsapp: formData.pf_whatsapp || ''
        },
        pfEndereco: {
          pf_cep: formData.pf_cep || '',
          pf_endereco: formData.pf_endereco || '',
          pf_numero: formData.pf_numero || '',
          pf_bairro: formData.pf_bairro || '',
          pf_cidade: formData.pf_cidade || '',
          pf_estado: formData.pf_estado || ''
        },
        pjDadosEmpresa: {
          pj_razaoSocial: formData.pj_razaoSocial || '',
          pj_nomeFantasia: formData.pj_nomeFantasia || '',
          pj_cnpj: formData.pj_cnpj || '',
          pj_telefoneEmpresa: formData.pj_telefoneEmpresa || '',
          pj_whatsappEmpresa: formData.pj_whatsappEmpresa || '',
          pj_cepEmpresa: formData.pj_cepEmpresa || '',
          pj_enderecoEmpresa: formData.pj_enderecoEmpresa || '',
          pj_bairroEmpresa: formData.pj_bairroEmpresa || '',
          pj_cidadeEmpresa: formData.pj_cidadeEmpresa || '',
          pj_estadoEmpresa: formData.pj_estadoEmpresa || ''
        },
        socioDadosPessoais: {
          socio_nomeCompleto: formData.socio_nomeCompleto || '',
          socio_cpf: formData.socio_cpf || '',
          socio_rg: formData.socio_rg || '',
          socio_dataNascimento: formData.socio_dataNascimento || '',
          socio_profissao: formData.socio_profissao || '',
          socio_estadoCivil: formData.socio_estadoCivil || '',
          socio_cep: formData.socio_cep || '',
          socio_endereco: formData.socio_endereco || '',
          socio_bairro: formData.socio_bairro || '',
          socio_cidade: formData.socio_cidade || '',
          socio_estado: formData.socio_estado || ''
        },
        bancarioDadosBancarios: {
          bancario_possuiDadosBancarios: formData.bancario_possuiDadosBancarios,
          bancario_tipoChavePix: formData.bancario_tipoChavePix || '',
          bancario_chavePix: formData.bancario_chavePix || '',
          bancario_bancoPix: formData.bancario_bancoPix || '',
          bancario_titularPix: formData.bancario_titularPix || '',
          bancario_banco: formData.bancario_banco || '',
          bancario_agencia: formData.bancario_agencia || '',
          bancario_conta: formData.bancario_conta || '',
          bancario_tipoConta: formData.bancario_tipoConta || '',
          bancario_titularConta: formData.bancario_titularConta || '',
          bancario_titularEhCliente: formData.bancario_titularEhCliente,
          bancario_usarCpfComoPix: formData.bancario_usarCpfComoPix
        },
        acessoSistema: {
          acesso_emailLogin: formData.acesso_emailLogin || '',
          acesso_statusAcesso: formData.acesso_statusAcesso || 'ativo',
          acesso_senha: formData.acesso_senha || ''
        }
      };

      // 1. Write deep clients/{clientId}
      await setDoc(doc(db, 'clients', clientId), syncedPayload);

      // 2. Write clientPortals
      if (oldSlug !== newSlug) {
        if (oldSlug) {
          await deleteDoc(doc(db, 'clientPortals', oldSlug));
        }
        await setDoc(doc(db, 'clientPortals', newSlug), {
          clientId: clientId,
          slug: newSlug,
          active: formData.active,
          createdAt: rightNow,
          updatedAt: rightNow
        });
      } else {
        await updateDoc(doc(db, 'clientPortals', newSlug), {
          active: formData.active,
          updatedAt: rightNow
        });
      }

      // Action 1: Create or update credenciaisCliente/{clientId}
      await setDoc(doc(db, 'credenciaisCliente', clientId), {
        id: clientId,
        clienteId: clientId,
        slug: newSlug,
        login: formData.acesso_emailLogin.toLowerCase().trim(),
        senha: formData.acesso_senha,
        password: formData.acesso_senha,
        ativo: formData.active !== false,
        atualizadoEm: rightNow,
        criadoEm: client.createdAt || client.criadoEm || rightNow,
        ultimoAcesso: client.ultimoAcesso || null,
        tentativasFalhas: client.tentativasFalhas || 0,
        bloqueadoEm: client.bloqueadoEm || null,
        observacoes: 'Credencial sincronizada pelo Editor Especial de Painel do Cliente'
      }, { merge: true });

      // Action 2: Update users/{clientId} using merge: true
      await setDoc(doc(db, 'users', clientId), {
        email: formData.acesso_emailLogin.toLowerCase().trim(),
        role: "client",
        clientId: clientId,
        clientSlug: newSlug,
        name: clientName,
        status: formData.acesso_statusAcesso || "ativo",
        senhaVisivelPreview: formData.acesso_senha,
        updatedAt: rightNow
      }, { merge: true });

      // Action 3: Guarantee clientes/{clientId} with specified fields using merge: true
      await setDoc(doc(db, 'clientes', clientId), {
        id: clientId,
        clientId: clientId,
        slug: newSlug,
        nome: clientName,
        name: clientName,
        email: formData.acesso_emailLogin.toLowerCase().trim(),
        status: "active",
        portalAtivo: true,
        atualizadoEm: rightNow,
        updatedAt: rightNow
      }, { merge: true });

      await addAuditLog('Cadastro Geral de Cliente', 'SAVE_CLIENT', client, syncedPayload);
      alert('Cadastro do Cliente e credenciais atualizados com sucesso no banco de dados!');
      setClient(syncedPayload);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar os dados cadastrais do cliente: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ACTION: SAVE CASE DATA (cases/{caseId} and casos/{caseId})
  const handleSaveCaseData = async () => {
    if (!selectedCase) return;
    setSaving(true);
    try {
      const rightNow = new Date().toISOString();
      const updatedCaseObj = {
        ...selectedCase,
        title: caseFormData.title,
        actionType: caseFormData.actionType,
        subject: caseFormData.actionType,
        oppositeParty: caseFormData.oppositeParty,
        processNumber: caseFormData.processNumber,
        court: caseFormData.court,
        courtRoom: caseFormData.vara,
        vara: caseFormData.vara,
        comarca: caseFormData.comarca,
        internalStatus: caseFormData.internalStatus,
        publicStatus: caseFormData.publicStatus,
        clientStatus: caseFormData.publicStatus,
        description: caseFormData.description,
        responsible: caseFormData.responsible,
        lawyer: caseFormData.responsible,
        priority: caseFormData.priority,
        visibleToClient: caseFormData.visibleToClient,
        visivelParaCliente: caseFormData.visivelParaCliente,
        technicalCategory: caseFormData.technicalCategory || '',
        subCategory: caseFormData.subCategory || '',
        updatedAt: rightNow
      };

      // Save inside cases/{caseId}
      await setDoc(doc(db, 'cases', selectedCase.id), updatedCaseObj, { merge: true });
      // Save inside casos/{caseId}
      await setDoc(doc(db, 'casos', selectedCase.id), updatedCaseObj, { merge: true });

      await addAuditLog('Caso do Cliente - Ficha do Processo', 'UPDATE_CASE', selectedCase, updatedCaseObj);
      alert('Caso e Ficha do Processo salvos com sucesso!');
      setSelectedCase(updatedCaseObj);
      
      // Update local cases array
      setCases(prev => prev.map(c => c.id === selectedCase.id ? updatedCaseObj : c));
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar dados do caso: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Helper to create direct timeline events linked to the case in the "caseTimeline" collection
  const createCaseTimelineEventDirect = async (fields: {
    title: string;
    description: string;
    eventType: string;
    originType: string;
    publicVisible: boolean;
    automatic: boolean;
    icon?: string;
    color?: string;
    priority?: string;
    eventDate?: string;
  }) => {
    if (!selectedCase) return null;
    const eventId = 'case_ev_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const rightNow = new Date().toISOString();
    const payload = {
      id: eventId,
      clientId: clientId || '',
      caseId: selectedCase.id,
      title: fields.title,
      description: fields.description,
      eventDate: fields.eventDate || new Date().toISOString().split('T')[0],
      eventType: fields.eventType,
      originType: fields.originType,
      publicVisible: fields.publicVisible,
      automatic: fields.automatic,
      editedByBoss: !fields.automatic,
      icon: fields.icon || 'Activity',
      color: fields.color || 'indigo',
      priority: fields.priority || 'medium',
      createdAt: rightNow,
      updatedAt: rightNow
    };

    try {
      await setDoc(doc(db, 'caseTimeline', eventId), payload);
      setCaseTimelineEvents(prev => [payload, ...prev]);
      await addAuditLog('Timeline do Caso', 'CREATE_CASE_TIMELINE_EVENT', {}, payload);
      return payload;
    } catch (e: any) {
      console.error('Erro ao adicionar evento na timeline do caso:', e);
      return null;
    }
  };

  // Helper to create or update an operational task linked to this case
  const syncOperationalTask = async (params: {
    sourceType: string;
    sourceId: string;
    title: string;
    description: string;
    sector: string;
    priority: string;
    dueDate?: string;
  }) => {
    if (!selectedCase) return;
    const taskId = `${params.sourceType}_${params.sourceId}`;
    const docRef = doc(db, 'operationalTasks', taskId);
    const rightNow = new Date().toISOString();

    try {
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data() || {};
        const payload = {
          ...existingData,
          title: params.title,
          description: params.description,
          sector: params.sector,
          priority: params.priority,
          dueDate: params.dueDate || existingData.dueDate || '',
          updatedAt: rightNow
        };
        await setDoc(docRef, payload, { merge: true });
      } else {
        const payload = {
          id: taskId,
          clientId: clientId || '',
          caseId: selectedCase.id,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          title: params.title,
          description: params.description,
          sector: params.sector,
          priority: params.priority,
          status: 'pending',
          dueDate: params.dueDate || '',
          assignedTo: '',
          createdAt: rightNow,
          updatedAt: rightNow,
          visibleToClient: false
        };
        await setDoc(docRef, payload);
      }
    } catch (e) {
      console.error('Erro ao sincronizar tarefa operacional:', e);
    }
  };

  // Delete Case Timeline Event
  const handleDeleteCaseTimelineEvent = async (eventId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta atualização pública do caso?')) return;
    try {
      await deleteDoc(doc(db, 'caseTimeline', eventId));
      setCaseTimelineEvents(prev => prev.filter(ev => ev.id !== eventId));
      await addAuditLog('Timeline do Caso', 'DELETE_CASE_TIMELINE_EVENT', { id: eventId }, {});
      alert('Evento da timeline excluído com sucesso.');
    } catch (e: any) {
      alert('Erro ao excluir evento: ' + e.message);
    }
  };

  // ACTION: SAVE CLIENT EXPERIENCE & PRIORITY ROADMAP
  const handleSaveClientExperienceAndPriority = async () => {
    if (!selectedCase) return;
    setSaving(true);
    try {
      const rightNow = new Date().toISOString();
      const clientExperience = {
        currentPhase: caseExperience.currentPhase || '',
        currentPhaseLabel: caseExperience.currentPhaseLabel || '',
        progressPercentage: Number(caseExperience.progressPercentage) || 0,
        estimatedDurationDays: Number(caseExperience.estimatedDurationDays) || 120,
        estimatedDurationLabel: caseExperience.estimatedDurationLabel || 'Prazo médio estimado',
        phaseStartedAt: caseExperience.phaseStartedAt || '',
        publicPhaseDescription: caseExperience.publicPhaseDescription || '',
        nextPublicStep: caseExperience.nextPublicStep || '',
        expectationNotice: caseExperience.expectationNotice || 'O prazo pode variar conforme o Tribunal, volume processual e necessidade de manifestações adicionais.'
      };

      const clientPriority = {
        priorityLevel: casePriority.priorityLevel || 'informative',
        priorityTitle: casePriority.priorityTitle || '',
        priorityDescription: casePriority.priorityDescription || '',
        priorityActionLabel: casePriority.priorityActionLabel || '',
        priorityActionRoute: casePriority.priorityActionRoute || '',
        priorityVisible: casePriority.priorityVisible === true
      };

      const updatedCaseObj = {
        ...selectedCase,
        clientExperience,
        clientPriority,
        updatedAt: rightNow
      };

      // Save inside cases/{caseId}
      await setDoc(doc(db, 'cases', selectedCase.id), updatedCaseObj, { merge: true });
      // Save inside casos/{caseId}
      await setDoc(doc(db, 'casos', selectedCase.id), updatedCaseObj, { merge: true });

      await addAuditLog('Caso do Cliente - Experiência & Prioridade', 'UPDATE_CASE_EXPERIENCE_PRIORITY', {
        clientExperience: selectedCase.clientExperience,
        clientPriority: selectedCase.clientPriority
      }, {
        clientExperience,
        clientPriority
      });

      setSelectedCase(updatedCaseObj);
      // Update local cases list
      setCases(prev => prev.map(c => c.id === selectedCase.id ? updatedCaseObj : c));
      alert('Configurações da Experiência do Cliente salvas com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar experiência do cliente: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ACTION: QUICK MICRO-UPDATE EVENT GENERATION
  const handleGenerateQuickMicro = async () => {
    if (!selectedCase) return;
    try {
      await createCaseTimelineEventDirect({
        title: selectedQuickMicroValue,
        description: 'Andamento de monitoramento ativo verificado pela equipe.',
        eventType: 'acompanhamento',
        originType: 'BOSS_INTERNAL',
        publicVisible: true,
        automatic: false,
        icon: 'Activity',
        color: 'emerald',
        priority: 'medium'
      });
      alert('Microatualização pública gerada e publicada com sucesso!');
    } catch (e: any) {
      alert('Erro ao gerar microatualização: ' + e.message);
    }
  };

  // ACTION: MANUAL UNIQUE TIMELINE EVENT GENERATION
  const handleCreateCustomCaseTimelineEvent = async () => {
    if (!selectedCase) return;
    if (!customCaseTimelineEvent.title) {
      alert('Por favor, informe um título para o evento.');
      return;
    }
    try {
      await createCaseTimelineEventDirect({
        title: customCaseTimelineEvent.title,
        description: customCaseTimelineEvent.description || '',
        eventType: customCaseTimelineEvent.eventType,
        originType: customCaseTimelineEvent.originType,
        publicVisible: customCaseTimelineEvent.publicVisible,
        automatic: false,
        icon: customCaseTimelineEvent.icon,
        color: customCaseTimelineEvent.color,
        priority: customCaseTimelineEvent.priority,
        eventDate: customCaseTimelineEvent.eventDate
      });
      setCustomCaseTimelineEvent({
        title: '',
        description: '',
        eventDate: new Date().toISOString().split('T')[0],
        eventType: 'atendimento',
        originType: 'BOSS_INTERNAL',
        publicVisible: true,
        automatic: false,
        icon: 'Activity',
        color: 'indigo',
        priority: 'medium'
      });
      alert('Evento da timeline do caso publicado com sucesso!');
    } catch (e: any) {
      alert('Erro ao publicar evento na timeline do caso: ' + e.message);
    }
  };

  // ACTION: CREATE INFO REQUEST
  const handleCreateInfoReq = async () => {
    if (!selectedCase) return;
    try {
      const payload = {
        clientId: clientId,
        caseId: selectedCase.id,
        title: newInfoReq.title || 'Solicitação de Informação',
        question: newInfoReq.question,
        status: newInfoReq.status || 'pending',
        visibleToClient: newInfoReq.visibleToClient,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        internalNotes: newInfoReq.internalNotes || '',
        resposta: ''
      };

      const docRef = await addDoc(collection(db, 'caseInformationRequests'), payload);
      const createdItem = { id: docRef.id, ...payload };
      setInfoRequests(prev => [...prev, createdItem]);
      setNewInfoReq({ title: '', question: '', visibleToClient: true, status: 'pending', internalNotes: '' });

      // Create automatic timeline event for caseTimeline API
      await createCaseTimelineEventDirect({
        title: "Nova solicitação de informação",
        description: "Precisamos de uma informação complementar para dar continuidade ao seu caso.",
        eventType: "documento",
        originType: "SYSTEM_EVENT",
        publicVisible: payload.visibleToClient !== false,
        automatic: true
      });

      await addAuditLog('Solicitação de Informações do Caso', 'CREATE_INFO_REQ', {}, createdItem);
      
      // Sync operational task for Controladoria
      await syncOperationalTask({
        sourceType: 'INFO_REQUEST',
        sourceId: createdItem.id,
        title: "Acompanhar resposta de informação do cliente",
        description: `Solicitação: ${createdItem.title}. Aguardando resposta do cliente.`,
        sector: "controladoria",
        priority: "important"
      });

      alert('Solicitação de informação enviada!');
    } catch (e: any) {
      console.error(e);
      alert('Erro ao criar solicitação: ' + e.message);
    }
  };

  // ACTION: UPDATE INFO REQUEST
  const handleUpdateInfoReqStatus = async (item: any, fields: any) => {
    try {
      const payload = {
        ...item,
        ...fields,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'caseInformationRequests', item.id), payload, { merge: true });
      setInfoRequests(p => p.map(i => i.id === item.id ? payload : i));
      await addAuditLog('Solicitação de Informações do Caso', 'UPDATE_INFO_REQ_STATUS', item, payload);
    } catch (e: any) {
      alert('Erro ao atualizar: ' + e.message);
    }
  };

  // ACTION: DELETE INFO REQUEST
  const handleDeleteInfoReq = async (id: string) => {
    if (!confirm('Tem certeza de que deseja remover esta solicitação de informação?')) return;
    try {
      await deleteDoc(doc(db, 'caseInformationRequests', id));
      setInfoRequests(p => p.filter(i => i.id !== id));
      await addAuditLog('Solicitação de Informações', 'DELETE_INFO_REQ', { id }, {});
    } catch (e: any) {
      alert('Erro ao deletar: ' + e.message);
    }
  };

  // ACTION: CREATE EVIDENCE REQUEST
  const handleCreateEvidenceReq = async () => {
    if (!selectedCase) return;
    try {
      const payload = {
        clientId: clientId,
        caseId: selectedCase.id,
        title: newEvidenceReq.title || 'Solicitação de Documento',
        description: newEvidenceReq.description,
        documentType: newEvidenceReq.documentType || 'PDF',
        status: newEvidenceReq.status || 'pending',
        deadline: newEvidenceReq.deadline || '',
        visibleToClient: newEvidenceReq.visibleToClient,
        arquivosEnviados: [],
        observacaoInterna: newEvidenceReq.internalNotes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'caseEvidenceRequests'), payload);
      const createdItem = { id: docRef.id, ...payload };
      setEvidenceRequests(prev => [...prev, createdItem]);
      setNewEvidenceReq({ title: '', description: '', documentType: '', visibleToClient: true, status: 'pending', deadline: '', internalNotes: '' });

      // Create automatic timeline event for caseTimeline API
      await createCaseTimelineEventDirect({
        title: "Novo documento solicitado",
        description: "Precisamos que você envie um documento para continuidade do seu caso.",
        eventType: "documento",
        originType: "SYSTEM_EVENT",
        publicVisible: payload.visibleToClient !== false,
        automatic: true
      });

      await addAuditLog('Solicitação de Provas', 'CREATE_EVIDENCE_REQ', {}, createdItem);

      // Sync operational task for Controladoria
      await syncOperationalTask({
        sourceType: 'EVIDENCE_REQUEST',
        sourceId: createdItem.id,
        title: "Acompanhar envio de prova/documento pelo cliente",
        description: `Item: ${createdItem.title}. Tipo: ${createdItem.documentType}. Prazo limite: ${createdItem.deadline || 'Sem prazo'}.`,
        sector: "controladoria",
        priority: "urgent",
        dueDate: createdItem.deadline
      });

      alert('Solicitação de provas/documentos adicionada com sucesso!');
    } catch (e: any) {
      console.error(e);
      alert('Erro ao criar solicitação de prova: ' + e.message);
    }
  };

  // ACTION: UPDATE EVIDENCE REQUEST
  const handleUpdateEvidenceReqStatus = async (item: any, fields: any) => {
    try {
      const payload = {
        ...item,
        ...fields,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'caseEvidenceRequests', item.id), payload, { merge: true });
      setEvidenceRequests(p => p.map(i => i.id === item.id ? payload : i));
      await addAuditLog('Solicitação de Provas', 'UPDATE_EVIDENCE_REQ_STATUS', item, payload);
    } catch (e: any) {
      alert('Erro ao atualizar: ' + e.message);
    }
  };

  // ACTION: DELETE EVIDENCE REQUEST
  const handleDeleteEvidenceReq = async (id: string) => {
    if (!confirm('Deseja excluir esta solicitação de documentos?')) return;
    try {
      await deleteDoc(doc(db, 'caseEvidenceRequests', id));
      setEvidenceRequests(p => p.filter(i => i.id !== id));
      await addAuditLog('Solicitação de Provas', 'DELETE_EVIDENCE_REQ', { id }, {});
    } catch (e: any) {
      alert('Erro ao deletar solicitação de prova: ' + e.message);
    }
  };

  // ACTION: CREATE/SAVE FINANCIAL
  const handleSaveFinancialRecord = async () => {
    if (!selectedCase) return;
    try {
      const payload = {
        clientId: clientId,
        caseId: selectedCase.id,
        totalValue: newFin.totalValue === 'Não possuo' ? 'Não possuo' : (parseFloat(newFin.totalValue) || 0),
        paidValue: newFin.paidValue === 'Não possuo' ? 'Não possuo' : (parseFloat(newFin.paidValue) || 0),
        pendingValue: newFin.pendingValue === 'Não possuo' ? 'Não possuo' : (parseFloat(newFin.pendingValue) || 0),
        status: newFin.status || 'pendente',
        paymentMethod: newFin.paymentMethod,
        paymentLink: newFin.paymentLink || '',
        dueDate: newFin.dueDate || '',
        observations: newFin.observations || '',
        visibleToClient: newFin.visibleToClient,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'caseFinancials'), payload);
      const createdItem = { id: docRef.id, ...payload };
      setFinancials(prev => [...prev, createdItem]);
      setNewFin({ totalValue: '', paidValue: '', pendingValue: '', status: 'pendente', paymentMethod: 'PIX', paymentLink: '', dueDate: '', observations: '', visibleToClient: true });
      
      // Create automatic timeline event for caseTimeline API
      if (payload.visibleToClient) {
        await createCaseTimelineEventDirect({
          title: "Nova informação financeira disponível",
          description: "Há uma nova informação financeira disponível no seu painel.",
          eventType: "financeiro",
          originType: "FINANCIAL_EVENT",
          publicVisible: true,
          automatic: true
        });
      }

      await addAuditLog('Financeiro do Caso', 'CREATE_FINANCIAL', {}, createdItem);

      // Sync operational task for Financeiro
      await syncOperationalTask({
        sourceType: 'FINANCIAL',
        sourceId: createdItem.id,
        title: "Acompanhar pendência financeira do cliente",
        description: `Fatura de valor pendente de ${typeof createdItem.pendingValue === 'number' ? `R$ ${createdItem.pendingValue}` : createdItem.pendingValue}. Status: ${createdItem.status}. Vencimento: ${createdItem.dueDate || 'Sem data'}.`,
        sector: "financeiro",
        priority: "important",
        dueDate: createdItem.dueDate
      });

      alert('Registro financeiro adicionado com sucesso!');
    } catch (e: any) {
      console.error(e);
      alert('Erro ao criar registro financeiro: ' + e.message);
    }
  };

  // ACTION: DELETE FINANCIAL RECORD
  const handleDeleteFinancial = async (id: string) => {
    if (!confirm('Tem certeza de que deseja remover esta fatura financeira?')) return;
    try {
      await deleteDoc(doc(db, 'caseFinancials', id));
      setFinancials(p => p.filter(f => f.id !== id));
      await addAuditLog('Financeiro do Caso', 'DELETE_FINANCIAL', { id }, {});
    } catch (e: any) {
      alert('Erro ao excluir registro financeiro: ' + e.message);
    }
  };

  // ACTION: SAVE EDRP BLOCK
  const handleSaveEDRP = async () => {
    if (!selectedCase) return;
    setSaving(true);
    try {
      const prevEdrp = selectedCase.edrp || {};
      const updatedEdrp = {
        ...prevEdrp,
        structuring: caseFormData.edrp?.structuring || '',
        delegation: caseFormData.edrp?.delegation || '',
        revision: caseFormData.edrp?.revision || '',
        protocol: caseFormData.edrp?.protocol || '',
        statusEDRP: caseFormData.edrp?.statusEDRP || 'Pendente',
        responsibleEDRP: caseFormData.edrp?.responsibleEDRP || '',
        nextAction: caseFormData.edrp?.nextAction || '',
        internalNotes: caseFormData.edrp?.internalNotes || '',
        visibleToClient: caseFormData.edrp?.visibleToClient !== false,
        publicTitle: caseFormData.edrp?.publicTitle || '',
        publicDescription: caseFormData.edrp?.publicDescription || '',
        publicVisible: caseFormData.edrp?.publicVisible !== false,
        generatePublicTimelineEvent: false // Reset after execution
      };

      await updateDoc(doc(db, 'cases', selectedCase.id), { edrp: updatedEdrp });
      await updateDoc(doc(db, 'casos', selectedCase.id), { edrp: updatedEdrp });

      const updatedCaseObj = { ...selectedCase, edrp: updatedEdrp };
      setSelectedCase(updatedCaseObj);
      setCases(prev => prev.map(c => c.id === selectedCase.id ? updatedCaseObj : c));

      // Generate public event in caseTimeline if toggle was checked
      if (caseFormData.edrp?.generatePublicTimelineEvent && caseFormData.edrp?.publicTitle) {
        await createCaseTimelineEventDirect({
          title: caseFormData.edrp.publicTitle,
          description: caseFormData.edrp.publicDescription || 'O bloco de métricas de andamento processual foi atualizado.',
          eventType: 'documento',
          originType: 'BOSS_INTERNAL',
          publicVisible: caseFormData.edrp.publicVisible !== false,
          automatic: false
        });
      }

      setCaseFormData(prev => ({
        ...prev,
        edrp: {
          ...prev.edrp,
          ...updatedEdrp,
          generatePublicTimelineEvent: false
        }
      }));

      await addAuditLog('Caso do Cliente - Bloco EDRP', 'UPDATE_EDRP', prevEdrp, updatedEdrp);

      // Create/update operational task for EDRP next action
      if (updatedEdrp.nextAction && updatedEdrp.nextAction.trim() !== '') {
        const clientName = formData.pf_nomeCompleto || formData.pj_razaoSocial || client?.name || client?.nome || 'Cliente';
        await syncOperationalTask({
          sourceType: 'EDRP_NEXT',
          sourceId: selectedCase.id,
          title: `Ação operacional EDRP - ${clientName}`,
          description: `Próxima ação: ${updatedEdrp.nextAction}. Responsável: ${updatedEdrp.responsibleEDRP || 'Pendente'}.`,
          sector: 'edrp',
          priority: 'important'
        });
      }

      alert('Bloco EDRP salvo com sucesso!');
    } catch (e: any) {
      alert('Erro ao salvar EDRP: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ACTION: SAVE CONTROLADORIA BLOCK
  const handleSaveControladoria = async () => {
    if (!selectedCase) return;
    setSaving(true);
    try {
      const prevControladoria = selectedCase.controladoria || {};
      const updatedControladoria = {
        ...prevControladoria,
        statusControladoria: caseFormData.controladoria?.statusControladoria || 'Análise',
        internalDeadline: caseFormData.controladoria?.internalDeadline || '',
        fatalDeadline: caseFormData.controladoria?.fatalDeadline || '',
        responsibleControladoria: caseFormData.controladoria?.responsibleControladoria || '',
        currentAction: caseFormData.controladoria?.currentAction || '',
        nextAction: caseFormData.controladoria?.nextAction || '',
        internalNotes: caseFormData.controladoria?.internalNotes || '',
        visibleToClient: caseFormData.controladoria?.visibleToClient !== false,
        publicTitle: caseFormData.controladoria?.publicTitle || '',
        publicDescription: caseFormData.controladoria?.publicDescription || '',
        publicVisible: caseFormData.controladoria?.publicVisible !== false,
        generatePublicTimelineEvent: false // Reset after execution
      };

      await updateDoc(doc(db, 'cases', selectedCase.id), { controladoria: updatedControladoria });
      await updateDoc(doc(db, 'casos', selectedCase.id), { controladoria: updatedControladoria });

      const updatedCaseObj = { ...selectedCase, controladoria: updatedControladoria };
      setSelectedCase(updatedCaseObj);
      setCases(prev => prev.map(c => c.id === selectedCase.id ? updatedCaseObj : c));

      // Generate public event in caseTimeline if toggle was checked
      if (caseFormData.controladoria?.generatePublicTimelineEvent && caseFormData.controladoria?.publicTitle) {
        await createCaseTimelineEventDirect({
          title: caseFormData.controladoria.publicTitle,
          description: caseFormData.controladoria.publicDescription || 'A controladoria interna emitiu uma nova providência pública.',
          eventType: 'tribunal',
          originType: 'BOSS_INTERNAL',
          publicVisible: caseFormData.controladoria.publicVisible !== false,
          automatic: false
        });
      }

      setCaseFormData(prev => ({
        ...prev,
        controladoria: {
          ...prev.controladoria,
          ...updatedControladoria,
          generatePublicTimelineEvent: false
        }
      }));

      await addAuditLog('Caso do Cliente - Bloco Controladoria', 'UPDATE_CONTROLADORIA', prevControladoria, updatedControladoria);

      // Create/update operational task for Controladoria next level actions
      if ((updatedControladoria.nextAction && updatedControladoria.nextAction.trim() !== '') || (updatedControladoria.fatalDeadline && updatedControladoria.fatalDeadline.trim() !== '')) {
        const clientName = formData.pf_nomeCompleto || formData.pj_razaoSocial || client?.name || client?.nome || 'Cliente';
        await syncOperationalTask({
          sourceType: 'CONTROLADORIA_NEXT',
          sourceId: selectedCase.id,
          title: `Providência Controladoria - ${clientName}`,
          description: `Mapeado na controladoria. Próxima ação: ${updatedControladoria.nextAction || 'Sem ação cadastrada'}. Prazo fatal: ${updatedControladoria.fatalDeadline || 'Sem prazo'}.`,
          sector: 'controladoria',
          priority: 'urgent',
          dueDate: updatedControladoria.fatalDeadline
        });
      }

      alert('Bloco de Controladoria salvo com sucesso!');
    } catch (e: any) {
      alert('Erro ao salvar Controladoria: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ACTION: ADD EVENT TO CLIENT CUSTOM TIMELINE
  const handleAddTimelineEvent = async () => {
    try {
      const newEvent = {
        id: 'timeline_' + Date.now(),
        title: newTimelineEvent.title || 'Marco no Caso',
        description: newTimelineEvent.description || '',
        date: newTimelineEvent.date || new Date().toISOString().split('T')[0],
        type: newTimelineEvent.type || 'info',
        priority: newTimelineEvent.priority || 'medium',
      };

      const updatedTimeline = [newEvent, ...(formData.publicTimeline || [])];
      
      await updateDoc(doc(db, 'clients', clientId!), { publicTimeline: updatedTimeline });
      setFormData((prev: any) => ({ ...prev, publicTimeline: updatedTimeline }));
      setNewTimelineEvent({ title: '', description: '', date: '', type: 'info', priority: 'medium' });

      await addAuditLog('Timeline do Cliente', 'ADD_TIMELINE_EVENT', formData.publicTimeline, updatedTimeline);
      alert('Evento de timeline publicado no Portal do Cliente com sucesso!');
    } catch (e: any) {
      alert('Erro ao adicionar evento na timeline: ' + e.message);
    }
  };

  // ACTION: REMOVE EVENT FROM CLIENT CUSTOM TIMELINE
  const handleRemoveTimelineEvent = async (id: string) => {
    if (!confirm('Deseja remover este marco da timeline do cliente?')) return;
    try {
      const updatedTimeline = (formData.publicTimeline || []).filter((e: any) => e.id !== id);
      await updateDoc(doc(db, 'clients', clientId!), { publicTimeline: updatedTimeline });
      setFormData((prev: any) => ({ ...prev, publicTimeline: updatedTimeline }));
      await addAuditLog('Timeline do Cliente', 'REMOVE_TIMELINE_EVENT', { id }, updatedTimeline);
    } catch (e: any) {
      alert('Erro ao remover evento: ' + e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-indigo-650 animate-spin" />
          <span className="text-sm font-bold uppercase tracking-widest text-indigo-750">Abrindo Editor Administrativo...</span>
        </div>
      </div>
    );
  }

  const clientNameRaw = client?.pfDadosPessoais?.pf_nomeCompleto || client?.pjDadosEmpresa?.pj_razaoSocial || client?.name || 'Cliente';

  return (
    <BossLayout>
      <div className="flex flex-col h-full bg-gray-50 font-sans select-none fill-none">
        
        {/* HEADER TOP ADMIN BAR */}
        <header className="bg-white border-b border-gray-150 py-4.5 px-6 sticky top-0 z-40 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/boss-giffoni-clientes/central-controle')}
              className="p-2 border border-gray-150 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              title="Voltar para a central mestre"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[19px] font-black tracking-tight text-gray-900 uppercase">
                  {clientNameRaw}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${client?.active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                  {client?.active !== false ? 'Ativo' : 'Suspenso'}
                </span>
                {formData.slug && (
                  <span className="text-xs bg-gray-100 text-gray-500 font-mono px-2 py-0.5 rounded-lg border border-gray-250">
                    /{formData.slug}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-450 font-bold font-sans">
                Painel Administrativo do Portal do Cliente • Gerenciamento direto de credenciais, visibilidade e peças processuais.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/boss-giffoni-clientes/portal-cliente-preview/${clientId}`)}
              className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-black uppercase transition-all shadow-2xs border border-purple-200 cursor-pointer flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Abrir Portal do Cliente
            </button>
            
            <button
              onClick={handleSaveClientData}
              disabled={saving}
              className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all shadow-md shadow-indigo-100 cursor-pointer flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </button>
          </div>
        </header>

        {/* MAIN BODY AREA WITH LEFT SIDEBAR FIXED & RIGHT CONTENT CONTAINER */}
        <div className="flex flex-1 min-h-[calc(100vh-80px)]">
          
          {/* SIDEBAR MAIN LEFT SELECTOR */}
          <aside className="w-68 bg-white border-r border-gray-150 py-6 px-4 space-y-1.5 shrink-0 flex flex-col justify-between">
            <nav className="space-y-1">
              {[
                { id: 'overview', label: '📊 1. Visão Geral', desc: 'Resumo geral do painel' },
                { id: 'cadastro', label: '👤 2. Dados Cadastrais', desc: 'Edição de ficha mestre e acesso' },
                { id: 'casos', label: '💼 3. Casos do Cliente', desc: 'Visualizar / Gerenciar processos' },
                { id: 'visibilidade', label: '👁️ 4. Visibilidade do Portal', desc: 'Ligar/Desligar módulos públicos' },
                { id: 'timeline', label: '📅 5. Timeline Pública', desc: 'Linha do tempo pública' },
                { id: 'logs', label: '📜 6. Logs de Alteração', desc: 'Histórico técnico do editor' }
              ].map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex flex-col items-start p-3 rounded-xl text-left border cursor-pointer transition-all ${
                      isActive 
                        ? 'bg-indigo-650 text-white border-transparent shadow-xs font-bold' 
                        : 'bg-white hover:bg-gray-50 border-gray-100 text-gray-700'
                    }`}
                  >
                    <span className="text-xs font-black uppercase text-[12px]">{item.label}</span>
                    <span className={`text-[10px] mt-0.5 ${isActive ? 'text-indigo-200' : 'text-gray-450 font-medium'}`}>{item.desc}</span>
                  </button>
                );
              })}
            </nav>
            
            <div className="bg-gray-50 border border-gray-150 p-4 rounded-xl text-center">
              <span className="text-[12px] font-black text-gray-800 uppercase block">Área Crítica</span>
              <p className="text-[10px] text-gray-450 mt-1 font-medium">As ações feitas aqui são espelhadas em tempo real e impactam o acesso definitivo e login do cliente.</p>
            </div>
          </aside>

          {/* MAIN CONTAINER CONTENT */}
          <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto space-y-8 width-full">
            
            {/* ----------------------------------------------- */}
            {/* TAB 1: VISÃO GERAL (OVERVIEW) */}
            {/* ----------------------------------------------- */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-[18px] font-black text-gray-800 uppercase tracking-tight">Visão Geral do Painel de {clientNameRaw}</h2>
                  <p className="text-xs text-gray-500">Uma síntese operacional, acessível apenas por administradores da Central mestre.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
                    <span className="text-[10px] uppercase font-black text-gray-400 block">Total de Casos Ativos</span>
                    <span className="text-[28px] font-black text-indigo-750 block mt-1">{cases.length}</span>
                    <span className="text-[10px] text-gray-450 block mt-1">processos vinculados no banco</span>
                  </div>
                  <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
                    <span className="text-[10px] uppercase font-black text-gray-400 block">E-mail de Login</span>
                    <span className="text-xs font-mono font-bold text-gray-800 block mt-2 select-all break-all">{formData.acesso_emailLogin || 'Não definido'}</span>
                    <span className="text-[10px] text-emerald-600 font-bold block mt-1">Ativo para autenticação</span>
                  </div>
                  <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
                    <span className="text-[10px] uppercase font-black text-gray-400 block">Status de Acesso</span>
                    <span className="text-xs font-bold text-gray-800 block mt-2 capitalize">{formData.acesso_statusAcesso || 'Ativo'}</span>
                    <span className="text-[10px] text-gray-450 block mt-0.5">Controla suspensão temporária</span>
                  </div>
                  <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
                    <span className="text-[10px] uppercase font-black text-gray-400 block">Últimas Operações</span>
                    <span className="text-xs font-bold text-gray-800 block mt-2">{logs.length} logs</span>
                    <span className="text-[10px] text-gray-450 block mt-0.5">Histórico técnico auditável</span>
                  </div>
                </div>

                <div className="p-6 bg-white border rounded-2xl space-y-4">
                  <span className="text-xs font-black uppercase text-gray-800 block border-b pb-2">Status do Mapeamento do Cliente</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <span className="text-xs font-bold text-gray-500">Dados do Portal</span>
                      <ul className="mt-2 space-y-2 text-xs">
                        <li className="flex justify-between border-b pb-1">
                          <span className="text-gray-400">ID Único (clientId):</span>
                          <span className="font-mono text-gray-600 select-all font-bold">{clientId}</span>
                        </li>
                        <li className="flex justify-between border-b pb-1">
                          <span className="text-gray-400">Senha visível:</span>
                          <span className="font-mono text-gray-800 font-extrabold select-all">{formData.acesso_senha || 'Não definida'}</span>
                        </li>
                        <li className="flex justify-between border-b pb-1">
                          <span className="text-gray-400">Tipo de Ficha:</span>
                          <span className="font-bold text-indigo-700">{formData.type}</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-500">Módulos Ativos no Portal</span>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {['Dashboard', 'Cadastros', 'Casos', 'Provas', 'Informações', 'Financeiro'].map(module => {
                          const stateKey = `show${module === 'Informações' ? 'Informacoes' : module === 'Configurações' ? 'Configuracoes' : module}`;
                          const isEnabled = formData[stateKey] !== false;
                          return (
                            <div key={module} className={`p-2 rounded-lg border text-center ${isEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                              <span className="text-[10px] font-bold block">{module}</span>
                              <span className="text-[9px] block uppercase font-black">{isEnabled ? 'LIGADO' : 'DESLIGADO'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------------------------------------- */}
            {/* TAB 2: DADOS CADASTRAIS */}
            {/* ----------------------------------------------- */}
            {activeTab === 'cadastro' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-3 text-xs">
                  <div>
                    <h2 className="text-[18px] font-black text-gray-800 uppercase tracking-tight font-sans">Ficha Cadastral e Acesso de Login</h2>
                    <p className="text-xs text-gray-500">Edite as informações pessoais, dados comerciais, chaves Pix e credenciais de acesso do cliente.</p>
                  </div>
                  <button
                    onClick={handleSaveClientData}
                    className="px-4.5 py-2 bg-indigo-655 hover:bg-indigo-750 text-white rounded-xl text-xs font-black uppercase transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" /> Salvar Cadastro do Cliente
                  </button>
                </div>
                {/* Dynamic Sub-form inclusion with styling similar to CadastroFluxo */}
                <div className="boss-form-breathable space-y-8 animate-in fade-in duration-300">
                  <style>{`
                    .boss-form-breathable label {
                      color: rgb(107 114 128) !important;
                      font-weight: 700 !important;
                      text-transform: uppercase !important;
                      font-size: 0.6875rem !important;
                      letter-spacing: 0.05em !important;
                    }
                    .boss-form-breathable input, 
                    .boss-form-breathable select {
                      height: 3.25rem !important;
                      padding-left: 1.25rem !important;
                      padding-right: 1.25rem !important;
                      background-color: rgb(249 250 251 / 0.5) !important;
                      border: 1px solid rgb(229 231 235) !important;
                      font-size: 0.875rem !important;
                      border-radius: 0.875rem !important;
                    }
                    .boss-form-breathable input:focus, 
                    .boss-form-breathable select:focus {
                      border-color: rgb(17 24 39) !important;
                      background-color: #ffffff !important;
                    }
                    .boss-form-breathable .bg-white.p-6.rounded-2xl.border {
                      background-color: transparent !important;
                      border: none !important;
                      padding: 0 !important;
                      box-shadow: none !important;
                      border-radius: 0 !important;
                      margin-bottom: 2.25rem !important;
                    }
                    .boss-form-breathable h3,
                    .boss-form-breathable h4 {
                      color: rgb(17 24 39) !important;
                      font-size: 0.8125rem !important;
                      font-weight: 800 !important;
                      letter-spacing: 0.05em !important;
                      border-bottom: 1.5px solid rgb(243 244 246);
                      padding-bottom: 0.625rem;
                      margin-bottom: 1.5rem !important;
                      text-transform: uppercase;
                    }
                    .boss-form-breathable .border-t {
                      border-top: none !important;
                      padding-top: 0.5rem !important;
                    }
                  `}</style>
                  {formData.type === 'PF' ? (
                    <PFForm data={formData} onChange={(d) => setFormData(d)} />
                  ) : (
                    <div className="space-y-8">
                      <PJForm data={formData} onChange={(d) => setFormData(d)} />
                      
                      <div className="border-t border-gray-100 pt-6 font-sans">
                        <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-4 font-mono">Quadro de Sócios / Representante do CNPJ</h3>
                        <SocioForm data={formData} onChange={(d) => setFormData(d)} />
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-6">
                    <AccessForm data={formData} onChange={(d) => setFormData(d)} />
                  </div>

                  <div className="border-t border-gray-100 pt-6">
                    <BankingForm 
                      data={formData} 
                      onChange={(d) => setFormData(d)} 
                      clientName={formData.type === 'PF' ? (formData.pf_nomeCompleto || '') : (formData.pj_razaoSocial || '')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ----------------------------------------------- */}
            {/* TAB 3: CASOS DO CLIENTE (WITH SECONDARY SIDEBAR) */}
            {/* ----------------------------------------------- */}
            {activeTab === 'casos' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-[18px] font-black text-gray-800 uppercase tracking-tight">Processos e Casos Contenciosos</h2>
                  <p className="text-xs text-gray-500">Selecione um processo do cliente abaixo para acessar a ficha técnica avançada de controle, relatórios e permissões de cliente.</p>
                </div>

                {cases.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-250">
                    <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <span className="text-xs font-black uppercase text-gray-500 block">Nenhum processo localizado</span>
                    <p className="text-[11px] text-gray-400 mt-1 font-medium">Este cliente ainda não possui nenhum caso registrado na coleção "cases" vinculando seu ID.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    
                    {/* Cases List Selector */}
                    <div className="md:col-span-4 bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs divide-y">
                      <div className="p-4 bg-gray-50 border-b">
                        <span className="text-[11px] font-black uppercase text-gray-700 block">Casos Registrados</span>
                      </div>
                      {cases.map((c) => {
                        const isChosen = selectedCase?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => handleSelectCase(c)}
                            className={`w-full p-4 text-left border-l-3 transition-all cursor-pointer flex justify-between items-center ${isChosen ? 'bg-indigo-50/60 border-l-indigo-650 text-indigo-950 font-bold shadow-2xs' : 'border-l-transparent hover:bg-gray-50 text-gray-700'}`}
                          >
                            <div className="space-y-1">
                              <span className="text-xs font-black block leading-none">{c.title || 'Caso Sem Título'}</span>
                              <span className="text-[10px] text-gray-400 font-mono block">{c.id}</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 ${isChosen ? 'text-indigo-600 font-bold' : 'text-gray-300'}`} />
                          </button>
                        );
                      })}
                    </div>

                    {/* Case Custom Administrative Manager Detail Page */}
                    <div className="md:col-span-8 space-y-6">
                      {!selectedCase ? (
                        <div className="text-center py-16 bg-white border rounded-2xl">
                          <EyeCirclePlaceholder />
                        </div>
                      ) : (
                        <div className="bg-white border rounded-2xl overflow-hidden shadow-xs">
                          {/* Inner Case Tab Selector Bar */}
                          <div className="p-4 bg-gray-50 border-b flex flex-wrap justify-between items-center gap-3">
                            <div>
                              <span className="text-xs font-black uppercase text-gray-800">{selectedCase.title || 'Caso Ativo'}</span>
                              <span className="text-[10px] block text-gray-400 mt-0.5 font-mono">UID: {selectedCase.id}</span>
                            </div>
                            
                            <div className="flex gap-2">
                              {/* Open Detail Preview */}
                              <button
                                onClick={handleSaveCaseData}
                                className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                              >
                                <Save className="w-3.5 h-3.5" /> Salvar Peça Processual
                              </button>
                            </div>
                          </div>

                          {/* Secondary Internal Nav Tabs */}
                          <div className="bg-white border-b p-4 flex flex-wrap gap-2.5">
                            {[
                              { id: 'dados', label: 'Dados do caso', icon: Briefcase },
                              { id: 'experiencia', label: 'Experiência do Cliente', icon: Activity },
                              { id: 'informacoes', label: 'Solicitação de informações', icon: ListTodo },
                              { id: 'provas', label: 'Solicitação de provas', icon: FileText },
                              { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
                              { id: 'edrp', label: 'EDRP', icon: Shield },
                              { id: 'controladoria', label: 'Controladoria', icon: AlertCircle },
                              { id: 'timeline_caso', label: 'Timeline pública', icon: Clock },
                              { id: 'visibilidade_caso', label: 'Visibilidade', icon: User }
                            ].map((tab) => {
                              const IconComp = tab.icon;
                              const isChosen = activeCaseTab === tab.id;
                              return (
                                <button
                                  key={tab.id}
                                  onClick={() => setActiveCaseTab(tab.id as any)}
                                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold uppercase transition-all cursor-pointer ${isChosen ? 'bg-indigo-650 text-white shadow-sm font-extrabold' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
                                >
                                  <IconComp className="w-5 h-5 shrink-0" />
                                  <span>{tab.label}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Nested Case Action Panels */}
                          <div className="p-6">
                            
                            {/* CASE INNER TAB 1: BASIC FIELDS */}
                            {activeCaseTab === 'dados' && (
                              <div className="space-y-4 animate-in fade-in duration-100 text-xs text-gray-700">
                                
                                {/* Categorização Técnica da Demanda */}
                                <div className="p-5 bg-gray-50/50 border border-gray-150 rounded-2xl space-y-4">
                                  <div className="flex items-center gap-2 border-b pb-2">
                                    <Shield className="w-5 h-5 text-indigo-600" />
                                    <div>
                                      <span className="text-xs font-black uppercase text-gray-800 block">Categorização Técnica da Demanda</span>
                                      <p className="text-[10px] text-gray-400 font-medium">Selecione o tipo de rito e modalidade operacional deste caso.</p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Card: Judicial */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCaseFormData({
                                          ...caseFormData,
                                          technicalCategory: 'Judicial',
                                          subCategory: 'Petição Inicial a ajuizar'
                                        });
                                      }}
                                      className={`p-4 text-left rounded-xl border-2 transition-all flex items-start gap-4 cursor-pointer select-none ${
                                        caseFormData.technicalCategory === 'Judicial'
                                          ? 'bg-indigo-50/60 border-indigo-600 shadow-2xs'
                                          : 'bg-white border-gray-200 hover:border-gray-300'
                                      }`}
                                    >
                                      <div className={`p-2 rounded-lg ${caseFormData.technicalCategory === 'Judicial' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                                        <Gavel className="w-5 h-5" />
                                      </div>
                                      <div className="space-y-1">
                                        <span className={`text-xs font-black uppercase block ${caseFormData.technicalCategory === 'Judicial' ? 'text-indigo-950' : 'text-gray-750'}`}>Judicial</span>
                                        <span className="text-[10px] text-gray-400 font-medium block">Rito sob tutela jurisdicional do Poder Judiciário.</span>
                                      </div>
                                    </button>

                                    {/* Card: Extrajudicial */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCaseFormData({
                                          ...caseFormData,
                                          technicalCategory: 'Extrajudicial',
                                          subCategory: 'Requerimento Administrativo'
                                        });
                                      }}
                                      className={`p-4 text-left rounded-xl border-2 transition-all flex items-start gap-4 cursor-pointer select-none ${
                                        caseFormData.technicalCategory === 'Extrajudicial'
                                          ? 'bg-purple-50/60 border-purple-600 shadow-2xs'
                                          : 'bg-white border-gray-200 hover:border-gray-300'
                                      }`}
                                    >
                                      <div className={`p-2 rounded-lg ${caseFormData.technicalCategory === 'Extrajudicial' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                                        <FileText className="w-5 h-5" />
                                      </div>
                                      <div className="space-y-1">
                                        <span className={`text-xs font-black uppercase block ${caseFormData.technicalCategory === 'Extrajudicial' ? 'text-purple-950' : 'text-gray-750'}`}>Extrajudicial</span>
                                        <span className="text-[10px] text-gray-400 font-medium block">Rito resolvido pela via extrajudicial ou administrativa.</span>
                                      </div>
                                    </button>
                                  </div>

                                  {/* Sub-cards based on Technical Category Selection */}
                                  <AnimatePresence mode="wait">
                                    {caseFormData.technicalCategory === 'Judicial' && (
                                      <motion.div
                                        key="judicial-sub"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="mt-4 pt-3 border-t border-dashed border-gray-200"
                                      >
                                        <span className="text-[10px] font-black uppercase text-gray-400 block mb-2">Selecione o Rito Judicial</span>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          {/* Subcard A: Petição Inicial a ajuizar */}
                                          <button
                                            type="button"
                                            onClick={() => setCaseFormData({ ...caseFormData, subCategory: 'Petição Inicial a ajuizar' })}
                                            className={`p-3 text-left rounded-lg border-1.5 transition-all cursor-pointer select-none ${
                                              caseFormData.subCategory === 'Petição Inicial a ajuizar'
                                                ? 'bg-indigo-50 border-indigo-600 font-bold text-indigo-950 shadow-2xs'
                                                : 'bg-white border-gray-200 hover:border-gray-300 text-gray-650'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-extrabold">Petição Inicial a ajuizar</span>
                                              {caseFormData.subCategory === 'Petição Inicial a ajuizar' && <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />}
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-medium mt-1">Fase inicial de estruturação pré-ajuizamento.</p>
                                          </button>

                                          {/* Subcard B: Processo judicial em Andamento */}
                                          <button
                                            type="button"
                                            onClick={() => setCaseFormData({ ...caseFormData, subCategory: 'Processo judicial em Andamento' })}
                                            className={`p-3 text-left rounded-lg border-1.5 transition-all cursor-pointer select-none ${
                                              caseFormData.subCategory === 'Processo judicial em Andamento'
                                                ? 'bg-indigo-50 border-indigo-600 font-bold text-indigo-950 shadow-2xs'
                                                : 'bg-white border-gray-200 hover:border-gray-300 text-gray-650'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-extrabold">Processo judicial em Andamento</span>
                                              {caseFormData.subCategory === 'Processo judicial em Andamento' && <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />}
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-medium mt-1">Ação judicial já distribuída e em andamento.</p>
                                          </button>
                                        </div>
                                      </motion.div>
                                    )}

                                    {caseFormData.technicalCategory === 'Extrajudicial' && (
                                      <motion.div
                                        key="extrajudicial-sub"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="mt-4 pt-3 border-t border-dashed border-gray-200"
                                      >
                                        <span className="text-[10px] font-black uppercase text-gray-400 block mb-2">Procedimento Administrativo / Extrajudicial</span>
                                        <div className="grid grid-cols-1 gap-3">
                                          {/* Subcard C: Requerimento Administrativo */}
                                          <button
                                            type="button"
                                            onClick={() => setCaseFormData({ ...caseFormData, subCategory: 'Requerimento Administrativo' })}
                                            className={`p-3 text-left rounded-lg border-1.5 transition-all cursor-pointer select-none flex items-center justify-between ${
                                              caseFormData.subCategory === 'Requerimento Administrativo'
                                                ? 'bg-purple-50 border-purple-600 font-bold text-purple-950 shadow-2xs'
                                                : 'bg-white border-gray-250 hover:border-gray-350 text-gray-650'
                                            }`}
                                          >
                                            <div>
                                              <span className="text-xs font-extrabold">Requerimento Administrativo</span>
                                              <p className="text-[10px] text-gray-400 font-medium mt-1">Negociação, acordo extrajudicial ou solicitação administrativa em órgãos.</p>
                                            </div>
                                            {caseFormData.subCategory === 'Requerimento Administrativo' && <CheckCircle className="w-4 h-4 text-purple-600 shrink-0" />}
                                          </button>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-gray-400 font-bold mb-1 uppercase">
                                      <span className="text-indigo-600 font-black">{clientNameRaw}</span> — Título Público
                                    </label>
                                    <input type="text" value={caseFormData.title} onChange={(e) => setCaseFormData({...caseFormData, title: e.target.value})} className="w-full p-2 border.5 rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 font-bold mb-1 uppercase">Matéria / Tipo Ação</label>
                                    <input type="text" value={caseFormData.actionType} onChange={(e) => setCaseFormData({...caseFormData, actionType: e.target.value})} className="w-full p-2 border.5 rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 font-bold mb-1 uppercase">Parte Contrária</label>
                                    <input type="text" value={caseFormData.oppositeParty} onChange={(e) => setCaseFormData({...caseFormData, oppositeParty: e.target.value})} className="w-full p-2 border.5 rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 font-bold mb-1 uppercase">Nº Processo</label>
                                    <input type="text" value={caseFormData.processNumber} onChange={(e) => setCaseFormData({...caseFormData, processNumber: e.target.value})} className="w-full p-2 border.5 rounded-xl outline-none font-mono" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 font-bold mb-1 uppercase">Tribunal</label>
                                    <input type="text" value={caseFormData.court} onChange={(e) => setCaseFormData({...caseFormData, court: e.target.value})} className="w-full p-2 border.5 rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 font-bold mb-1 uppercase">Vara</label>
                                    <input type="text" value={caseFormData.vara} onChange={(e) => setCaseFormData({...caseFormData, vara: e.target.value})} className="w-full p-2 border.5 rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 font-bold mb-1 uppercase">Comarca</label>
                                    <input type="text" value={caseFormData.comarca} onChange={(e) => setCaseFormData({...caseFormData, comarca: e.target.value})} className="w-full p-2 border.5 rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 font-bold mb-1 uppercase">Responsável Interno</label>
                                    <input type="text" value={caseFormData.responsible} onChange={(e) => setCaseFormData({...caseFormData, responsible: e.target.value})} className="w-full p-2 border.5 rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 font-bold mb-1 uppercase">Status Interno</label>
                                    <input type="text" value={caseFormData.internalStatus} onChange={(e) => setCaseFormData({...caseFormData, internalStatus: e.target.value})} className="w-full p-2 border.5 rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 font-bold mb-1 uppercase">Status Público Portal</label>
                                    <input type="text" value={caseFormData.publicStatus} onChange={(e) => setCaseFormData({...caseFormData, publicStatus: e.target.value})} className="w-full p-2 border.5 rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 font-bold mb-1 uppercase">Prioridade</label>
                                    <select value={caseFormData.priority} onChange={(e) => setCaseFormData({...caseFormData, priority: e.target.value})} className="w-full p-2 border.5 rounded-xl outline-none">
                                      <option value="alta">Alta</option>
                                      <option value="média">Média</option>
                                      <option value="baixa">Baixa</option>
                                    </select>
                                  </div>
                                  <div className="flex items-center gap-6 pt-4">
                                    <label className="flex items-center gap-1.5 font-bold cursor-pointer selection:bg-none">
                                      <input type="checkbox" checked={caseFormData.visibleToClient} onChange={(e) => setCaseFormData({...caseFormData, visibleToClient: e.target.checked})} className="rounded border-gray-350 w-4.5 h-4.5" />
                                      Visível ao Cliente (visibleToClient)
                                    </label>
                                    <label className="flex items-center gap-1.5 font-bold cursor-pointer selection:bg-none">
                                      <input type="checkbox" checked={caseFormData.visivelParaCliente} onChange={(e) => setCaseFormData({...caseFormData, visivelParaCliente: e.target.checked})} className="rounded border-gray-350 w-4.5 h-4.5" />
                                      Espelhar Visibilidade (visivelParaCliente)
                                    </label>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-gray-400 font-bold mb-1 uppercase">Descrição Interna / Histórico</label>
                                  <textarea value={caseFormData.description} onChange={(e) => setCaseFormData({...caseFormData, description: e.target.value})} className="w-full p-3 border.5 rounded-2xl h-24 outline-none resize-none" />
                                </div>
                              </div>
                            )}

                            {/* CASE INNER TAB 2: INFORMATION REQUESTS */}
                            {activeCaseTab === 'informacoes' && (
                              <div className="space-y-6 animate-in fade-in duration-100 text-xs">
                                <div className="p-4 bg-gray-50 border rounded-2xl space-y-3">
                                  <span className="text-[11px] font-black uppercase text-gray-800 block">Enviar Nova Solicitação de Informação</span>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input 
                                      type="text" 
                                      placeholder="Título da Pergunta (Ex: Detalhes do Acidente)" 
                                      value={newInfoReq.title} 
                                      onChange={(e) => setNewInfoReq({...newInfoReq, title: e.target.value})} 
                                      className="p-2 border rounded-xl outline-none text-xs" 
                                    />
                                    <input 
                                      type="text" 
                                      placeholder="Pergunta completa" 
                                      value={newInfoReq.question} 
                                      onChange={(e) => setNewInfoReq({...newInfoReq, question: e.target.value})} 
                                      className="p-2 border rounded-xl outline-none text-xs" 
                                    />
                                  </div>
                                  <div className="flex justify-between items-center gap-4 text-[11px]">
                                    <span className="text-gray-400 font-medium">As perguntas aparecem pendentes na área de comunicados do cliente.</span>
                                    <button 
                                      onClick={handleCreateInfoReq}
                                      className="px-4 py-2 bg-indigo-650 text-white font-black uppercase rounded-lg hover:bg-indigo-750 transition-colors"
                                    >
                                      Enviar Solicitação
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-3 divide-y">
                                  {infoRequests.length === 0 ? (
                                    <p className="text-center text-gray-400 italic font-medium py-3">Nenhuma solicitação cadastrada para este caso.</p>
                                  ) : (
                                    infoRequests.map(item => (
                                      <div key={item.id} className="pt-3 flex justify-between items-center text-xs">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-gray-900">{item.title}</span>
                                            <span className={`px-2 py-0.2 rounded-full text-[9px] uppercase font-black ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-600'}`}>{item.status === 'completed' ? 'Respondido' : 'Pendente'}</span>
                                          </div>
                                          <p className="text-gray-500 font-medium">{item.question}</p>
                                          {item.resposta && <p className="text-indigo-900 font-bold bg-indigo-50/50 p-2 rounded-lg border border-indigo-150">Resposta: {item.resposta}</p>}
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                          <button onClick={() => handleUpdateInfoReqStatus(item, { status: item.status === 'completed' ? 'pending' : 'completed' })} className="p-1 px-2 border rounded-lg hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer">
                                            Alterar Status
                                          </button>
                                          <button onClick={() => handleDeleteInfoReq(item.id)} className="p-1.5 border border-red-200 rounded-lg hover:bg-red-50 text-red-650 cursor-pointer">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}

                            {/* CASE INNER TAB 3: EVIDENCE REQUESTS */}
                            {activeCaseTab === 'provas' && (
                              <div className="space-y-6 animate-in fade-in duration-100 text-xs">
                                <div className="p-4 bg-gray-50 border rounded-2xl space-y-3">
                                  <span className="text-[11px] font-black uppercase text-gray-800 block">Solicitar Envio de Documento / Prova</span>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input type="text" placeholder="Título (Ex: Procuração)" value={newEvidenceReq.title} onChange={(e) => setNewEvidenceReq({...newEvidenceReq, title: e.target.value})} className="p-2 border rounded-xl outline-none text-xs" />
                                    <input type="text" placeholder="Especificações adicionais" value={newEvidenceReq.description} onChange={(e) => setNewEvidenceReq({...newEvidenceReq, description: e.target.value})} className="p-2 border rounded-xl outline-none text-xs" />
                                    <input type="text" placeholder="Prazo fatal (Ex: 05/06/2026)" value={newEvidenceReq.deadline} onChange={(e) => setNewEvidenceReq({...newEvidenceReq, deadline: e.target.value})} className="p-2 border rounded-xl outline-none text-xs" />
                                  </div>
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-gray-400 font-medium">Permite upload de PDF/imagens no app do cliente.</span>
                                    <button onClick={handleCreateEvidenceReq} className="px-4 py-2 bg-indigo-650 text-white font-black uppercase rounded-lg hover:bg-indigo-750 transition-colors">Solicitar Documento</button>
                                  </div>
                                </div>

                                <div className="space-y-3 divide-y">
                                  {evidenceRequests.length === 0 ? (
                                    <p className="text-center text-gray-400 italic py-3 font-medium">Nenhum pedido de documentos pendente no portal.</p>
                                  ) : (
                                    evidenceRequests.map(item => (
                                      <div key={item.id} className="pt-3 flex justify-between items-center text-xs">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-gray-900">{item.title}</span>
                                            <span className={`px-2 py-0.2 rounded-full text-[9px] uppercase font-black ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-600'}`}>{item.status === 'completed' ? 'Entregue' : 'Pendente'}</span>
                                          </div>
                                          <p className="text-gray-500 font-medium">{item.description}</p>
                                          {item.arquivosEnviados?.length > 0 && (
                                            <div className="bg-emerald-50/50 p-2 rounded-xl text-[10px] text-emerald-800 font-bold uppercase mt-1">
                                              Arquivos anexados pelo cliente: {item.arquivosEnviados.join(', ')}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                          <button onClick={() => handleUpdateEvidenceReqStatus(item, { status: item.status === 'completed' ? 'pending' : 'completed' })} className="p-1 px-2 border rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">Toggle status</button>
                                          <button onClick={() => handleDeleteEvidenceReq(item.id)} className="p-1.5 border border-red-200 rounded-lg hover:bg-red-50 text-red-650 cursor-pointer">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}

                            {/* CASE INNER TAB 4: CASE FINANCIAL RECORDING */}
                            {activeCaseTab === 'financeiro' && (
                              <div className="space-y-6 animate-in fade-in duration-100 text-xs">
                                <div className="p-4 bg-gray-50 border rounded-2xl space-y-3">
                                  <span className="text-[11px] font-black uppercase text-gray-850 block">Lançamento de Fatura do Caso</span>
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div className="flex items-center gap-1.5 bg-white border rounded-xl px-2">
                                      <input type="text" placeholder="Valor Total" value={newFin.totalValue} onChange={(e) => setNewFin({...newFin, totalValue: e.target.value})} className="w-full py-2 outline-none border-none text-xs bg-transparent" />
                                      <label className="flex items-center gap-1 text-[10px] text-gray-500 font-bold shrink-0 cursor-pointer select-none">
                                        <input 
                                          type="checkbox" 
                                          checked={newFin.totalValue === 'Não possuo'} 
                                          onChange={(e) => {
                                            setNewFin({
                                              ...newFin, 
                                              totalValue: e.target.checked ? 'Não possuo' : ''
                                            });
                                          }} 
                                          className="w-3.5 h-3.5 rounded border-gray-300"
                                        />
                                        Não possuo
                                      </label>
                                    </div>

                                    <div className="flex items-center gap-1.5 bg-white border rounded-xl px-2">
                                      <input type="text" placeholder="Valor Pago" value={newFin.paidValue} onChange={(e) => setNewFin({...newFin, paidValue: e.target.value})} className="w-full py-2 outline-none border-none text-xs bg-transparent" />
                                      <label className="flex items-center gap-1 text-[10px] text-gray-500 font-bold shrink-0 cursor-pointer select-none">
                                        <input 
                                          type="checkbox" 
                                          checked={newFin.paidValue === 'Não possuo'} 
                                          onChange={(e) => {
                                            setNewFin({
                                              ...newFin, 
                                              paidValue: e.target.checked ? 'Não possuo' : ''
                                            });
                                          }} 
                                          className="w-3.5 h-3.5 rounded border-gray-300"
                                        />
                                        Não possuo
                                      </label>
                                    </div>

                                    <div className="flex items-center gap-1.5 bg-white border rounded-xl px-2">
                                      <input type="text" placeholder="Valor Pendente" value={newFin.pendingValue} onChange={(e) => setNewFin({...newFin, pendingValue: e.target.value})} className="w-full py-2 outline-none border-none text-xs bg-transparent" />
                                      <label className="flex items-center gap-1 text-[10px] text-gray-500 font-bold shrink-0 cursor-pointer select-none">
                                        <input 
                                          type="checkbox" 
                                          checked={newFin.pendingValue === 'Não possuo'} 
                                          onChange={(e) => {
                                            setNewFin({
                                              ...newFin, 
                                              pendingValue: e.target.checked ? 'Não possuo' : ''
                                            });
                                          }} 
                                          className="w-3.5 h-3.5 rounded border-gray-300"
                                        />
                                        Não possuo
                                      </label>
                                    </div>

                                    <select value={newFin.status} onChange={(e) => setNewFin({...newFin, status: e.target.value})} className="p-2 border rounded-xl outline-none bg-white">
                                      <option value="pendente">Pendente</option>
                                      <option value="pago">Pago</option>
                                      <option value="atrasado">Atrasado</option>
                                    </select>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input type="text" placeholder="Link de pagamento (opcional)" value={newFin.paymentLink} onChange={(e) => setNewFin({...newFin, paymentLink: e.target.value})} className="p-2 border rounded-xl outline-none" />
                                    <input type="text" placeholder="Vencimento (Ex: 10/06/2026)" value={newFin.dueDate} onChange={(e) => setNewFin({...newFin, dueDate: e.target.value})} className="p-2 border rounded-xl outline-none" />
                                    <input type="text" placeholder="Forma pagamento (Ex: PIX, Cartão)" value={newFin.paymentMethod} onChange={(e) => setNewFin({...newFin, paymentMethod: e.target.value})} className="p-2 border rounded-xl outline-none" />
                                  </div>
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-gray-400 font-medium">As faturas listadas aparecem na aba financeira do Portal do Cliente.</span>
                                    <button onClick={handleSaveFinancialRecord} className="px-4 py-2 bg-indigo-650 text-white font-black uppercase rounded-lg hover:bg-indigo-750 transition-colors">Inserir Fatura</button>
                                  </div>
                                </div>

                                <div className="space-y-3 divide-y">
                                  {financials.length === 0 ? (
                                    <p className="text-center text-gray-400 italic py-3 font-medium">Nenhum registro financeiro localizado.</p>
                                  ) : (
                                    financials.map(f => (
                                      <div key={f.id} className="pt-3 flex justify-between items-center text-xs">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-indigo-950">
                                              {typeof f.totalValue === 'number' ? `R$ ${f.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : f.totalValue}
                                            </span>
                                            <span className={`px-2 py-0.2 rounded-full text-[9px] uppercase font-black ${f.status === 'pago' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-600'}`}>{f.status}</span>
                                          </div>
                                          <p className="text-gray-500 font-medium">
                                            Pago: {typeof f.paidValue === 'number' ? `R$ ${f.paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : f.paidValue} | Vence em: {f.dueDate || 'À vista'}
                                          </p>
                                        </div>
                                        <button onClick={() => handleDeleteFinancial(f.id)} className="p-1.5 border border-red-150 rounded-lg text-red-600 hover:bg-rose-50 cursor-pointer">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}

                            {/* CASE INNER TAB 5: EDRP METRICS BLOCK */}
                            {activeCaseTab === 'edrp' && (
                              <div className="space-y-4 animate-in fade-in duration-100 text-xs">
                                <div className="flex justify-between items-center border-b pb-2">
                                  <span className="text-[11px] font-black uppercase text-gray-800">Métricas EDRP (Estruturação, Delegação, Revisão, Protocolo)</span>
                                  <button onClick={handleSaveEDRP} className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] uppercase cursor-pointer">
                                    Salvar EDRP
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-gray-450 font-bold mb-1 uppercase">Estruturação (Structuring)</label>
                                    <input type="text" value={caseFormData.edrp?.structuring || ''} onChange={(e) => setCaseFormData({...caseFormData, edrp: { ...caseFormData.edrp, structuring: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-455 font-bold mb-1 uppercase">Delegação (Delegation)</label>
                                    <input type="text" value={caseFormData.edrp?.delegation || ''} onChange={(e) => setCaseFormData({...caseFormData, edrp: { ...caseFormData.edrp, delegation: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-455 font-bold mb-1 uppercase">Revisão (Revision)</label>
                                    <input type="text" value={caseFormData.edrp?.revision || ''} onChange={(e) => setCaseFormData({...caseFormData, edrp: { ...caseFormData.edrp, revision: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-455 font-bold mb-1 uppercase">Protocolo (Protocol)</label>
                                    <input type="text" value={caseFormData.edrp?.protocol || ''} onChange={(e) => setCaseFormData({...caseFormData, edrp: { ...caseFormData.edrp, protocol: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-455 font-bold mb-1 uppercase">Status EDRP</label>
                                    <select value={caseFormData.edrp?.statusEDRP || 'Pendente'} onChange={(e) => setCaseFormData({...caseFormData, edrp: { ...caseFormData.edrp, statusEDRP: e.target.value}})} className="w-full p-2 border rounded-xl bg-white">
                                      <option value="Pendente">Pendente</option>
                                      <option value="Em Produção">Em Produção</option>
                                      <option value="Revisionado">Revisionado</option>
                                      <option value="Pronto para Protocolar">Pronto para Protocolar</option>
                                      <option value="Protocolado">Protocolado</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-gray-455 font-bold mb-1 uppercase">Responsável Secundário / Advogado</label>
                                    <input type="text" value={caseFormData.edrp?.responsibleEDRP || ''} onChange={(e) => setCaseFormData({...caseFormData, edrp: { ...caseFormData.edrp, responsibleEDRP: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-gray-455 font-bold mb-1 uppercase">Próxima Ação EDRP</label>
                                    <input type="text" value={caseFormData.edrp?.nextAction || ''} onChange={(e) => setCaseFormData({...caseFormData, edrp: { ...caseFormData.edrp, nextAction: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-gray-455 font-bold mb-1 uppercase">Observações Internas EDRP</label>
                                    <textarea value={caseFormData.edrp?.internalNotes || ''} onChange={(e) => setCaseFormData({...caseFormData, edrp: { ...caseFormData.edrp, internalNotes: e.target.value}})} className="w-full p-2.5 border rounded-2xl h-16 resize-none" />
                                  </div>

                                  <div className="md:col-span-2 border-t pt-4 mt-2 space-y-4">
                                    <span className="text-[11px] font-black uppercase text-indigo-800 block">Campos Públicos EDRP (Refletidos no Portal do Cliente)</span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-gray-500 font-bold mb-1 uppercase">Título Público EDRP</label>
                                        <input type="text" placeholder="Ex: Fase de Elaboração de Peça Concluída" value={caseFormData.edrp?.publicTitle || ''} onChange={(e) => setCaseFormData({...caseFormData, edrp: { ...caseFormData.edrp, publicTitle: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                      </div>
                                      <div>
                                        <label className="block text-gray-500 font-bold mb-1 uppercase">Descrição Pública EDRP</label>
                                        <input type="text" placeholder="Ex: Nossos especialistas concluíram a estruturação e revisão do caso." value={caseFormData.edrp?.publicDescription || ''} onChange={(e) => setCaseFormData({...caseFormData, edrp: { ...caseFormData.edrp, publicDescription: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                      </div>
                                      <div className="flex items-center gap-1.5 font-bold pt-2">
                                        <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                                          <input type="checkbox" checked={caseFormData.edrp?.publicVisible !== false} onChange={(e) => setCaseFormData({...caseFormData, edrp: { ...caseFormData.edrp, publicVisible: e.target.checked}})} className="rounded border-gray-350 w-4 h-4" />
                                          Permitir visualização pública destes campos
                                        </label>
                                      </div>
                                      <div className="flex items-center gap-1.5 font-bold pt-2">
                                        <label className="flex items-center gap-1.5 font-bold cursor-pointer text-indigo-700">
                                          <input type="checkbox" checked={caseFormData.edrp?.generatePublicTimelineEvent === true} onChange={(e) => setCaseFormData({...caseFormData, edrp: { ...caseFormData.edrp, generatePublicTimelineEvent: e.target.checked}})} className="rounded border-indigo-350 w-4 h-4" />
                                          Gerar marco na Timeline Pública ao salvar
                                        </label>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="md:col-span-2 flex items-center pt-2">
                                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                                      <input type="checkbox" checked={caseFormData.edrp?.visibleToClient !== false} onChange={(e) => setCaseFormData({...caseFormData, edrp: { ...caseFormData.edrp, visibleToClient: e.target.checked}})} className="rounded border-gray-350 w-4 h-4" />
                                      Tornar bloco EDRP visível ao cliente no portal
                                    </label>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* CASE INNER TAB 6: CONTROLADORIA METRICS */}
                            {activeCaseTab === 'controladoria' && (
                              <div className="space-y-4 animate-in fade-in duration-100 text-xs">
                                <div className="flex justify-between items-center border-b pb-2">
                                  <span className="text-[11px] font-black uppercase text-gray-805">Controle de Controladoria, Prazos e Providências Judiciais</span>
                                  <button onClick={handleSaveControladoria} className="px-3.5 py-1 bg-indigo-650 hover:bg-indigo-750 text-white rounded-lg font-bold text-[10px] uppercase cursor-pointer">
                                    Salvar Controladoria
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-gray-450 font-bold mb-1 uppercase">Prazo Interno do Escritório</label>
                                    <input type="text" value={caseFormData.controladoria?.internalDeadline || ''} onChange={(e) => setCaseFormData({...caseFormData, controladoria: { ...caseFormData.controladoria, internalDeadline: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-450 font-bold mb-1 uppercase">Prazo Fatal / Mestre</label>
                                    <input type="text" value={caseFormData.controladoria?.fatalDeadline || ''} onChange={(e) => setCaseFormData({...caseFormData, controladoria: { ...caseFormData.controladoria, fatalDeadline: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-450 font-bold mb-1 uppercase">Providência Atual</label>
                                    <input type="text" value={caseFormData.controladoria?.currentAction || ''} onChange={(e) => setCaseFormData({...caseFormData, controladoria: { ...caseFormData.controladoria, currentAction: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-450 font-bold mb-1 uppercase">Próxima Providência</label>
                                    <input type="text" value={caseFormData.controladoria?.nextAction || ''} onChange={(e) => setCaseFormData({...caseFormData, controladoria: { ...caseFormData.controladoria, nextAction: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-450 font-bold mb-1 uppercase">Responsável da Controladoria</label>
                                    <input type="text" value={caseFormData.controladoria?.responsibleControladoria || ''} onChange={(e) => setCaseFormData({...caseFormData, controladoria: { ...caseFormData.controladoria, responsibleControladoria: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-gray-450 font-bold mb-1 uppercase">Status de Auditoria</label>
                                    <select value={caseFormData.controladoria?.statusControladoria || 'Análise'} onChange={(e) => setCaseFormData({...caseFormData, controladoria: { ...caseFormData.controladoria, statusControladoria: e.target.value}})} className="w-full p-2 border rounded-xl bg-white">
                                      <option value="Análise">Análise</option>
                                      <option value="Saneado">Saneado</option>
                                      <option value="Prazo Prorrogado">Prazo Prorrogado</option>
                                      <option value="Inadimplido">Inadimplido</option>
                                    </select>
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-gray-450 font-bold mb-1">Notas de Controladoria</label>
                                    <textarea value={caseFormData.controladoria?.internalNotes || ''} onChange={(e) => setCaseFormData({...caseFormData, controladoria: { ...caseFormData.controladoria, internalNotes: e.target.value}})} className="w-full p-2.5 border rounded-2xl h-16 resize-none" />
                                  </div>

                                  <div className="md:col-span-2 border-t pt-4 mt-2 space-y-4">
                                    <span className="text-[11px] font-black uppercase text-indigo-800 block">Campos Públicos Controladoria (Refletidos no Portal do Cliente)</span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-gray-500 font-bold mb-1 uppercase">Título Público Controladoria</label>
                                        <input type="text" placeholder="Ex: Entrada em fase de auditoria e contagem de prazos" value={caseFormData.controladoria?.publicTitle || ''} onChange={(e) => setCaseFormData({...caseFormData, controladoria: { ...caseFormData.controladoria, publicTitle: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                      </div>
                                      <div>
                                        <label className="block text-gray-500 font-bold mb-1 uppercase">Descrição Pública Controladoria</label>
                                        <input type="text" placeholder="Ex: O tribunal abriu prazo e a equipe de controladores está revisando as providências." value={caseFormData.controladoria?.publicDescription || ''} onChange={(e) => setCaseFormData({...caseFormData, controladoria: { ...caseFormData.controladoria, publicDescription: e.target.value}})} className="w-full p-2 border rounded-xl outline-none" />
                                      </div>
                                      <div className="flex items-center gap-1.5 font-bold pt-2">
                                        <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                                          <input type="checkbox" checked={caseFormData.controladoria?.publicVisible !== false} onChange={(e) => setCaseFormData({...caseFormData, controladoria: { ...caseFormData.controladoria, publicVisible: e.target.checked}})} className="rounded border-gray-350 w-4 h-4" />
                                          Permitir visualização pública destes campos
                                        </label>
                                      </div>
                                      <div className="flex items-center gap-1.5 font-bold pt-2">
                                        <label className="flex items-center gap-1.5 font-bold cursor-pointer text-indigo-700">
                                          <input type="checkbox" checked={caseFormData.controladoria?.generatePublicTimelineEvent === true} onChange={(e) => setCaseFormData({...caseFormData, controladoria: { ...caseFormData.controladoria, generatePublicTimelineEvent: e.target.checked}})} className="rounded border-indigo-350 w-4 h-4" />
                                          Gerar marco na Timeline Pública ao salvar
                                        </label>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="md:col-span-2 pt-2">
                                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                                      <input type="checkbox" checked={caseFormData.controladoria?.visibleToClient !== false} onChange={(e) => setCaseFormData({...caseFormData, controladoria: { ...caseFormData.controladoria, visibleToClient: e.target.checked}})} className="rounded border-gray-350 w-4 h-4" />
                                      Visível para o cliente no portal
                                    </label>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* CASE INNER TAB: EXPERIÊNCIA DO CLIENTE */}
                            {activeCaseTab === 'experiencia' && (
                              <div className="space-y-6 animate-in fade-in duration-100">
                                <div className="flex justify-between items-center border-b pb-3">
                                  <div>
                                    <h3 className="text-[18px] font-black uppercase text-gray-800 text-slate-800">Construtor da Experiência do Cliente</h3>
                                    <p className="text-xs text-gray-400">Configure o Roadmap visual interativo e a prioridade automática que o cliente verá na Home.</p>
                                  </div>
                                  <button onClick={handleSaveClientExperienceAndPriority} className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-black uppercase tracking-wide cursor-pointer transition-colors shadow-xs">
                                    Salvar Experiência & Roadmap
                                  </button>
                                </div>

                                {/* Bloco A: Roadmap Visual */}
                                <div className="p-6 bg-gray-50 border border-gray-100 rounded-2xl space-y-4">
                                  <div className="flex items-center gap-2 border-b pb-2">
                                    <Activity className="w-5 h-5 text-indigo-600" />
                                    <span className="text-[15px] font-black uppercase text-indigo-800">A) Roadmap Visual do Caso</span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold text-gray-650">
                                    <div>
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Fase Atual Interna (id)</label>
                                      <input type="text" placeholder="Ex: peticao_inicial" value={caseExperience.currentPhase || ''} onChange={(e) => setCaseExperience({...caseExperience, currentPhase: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Fase Atual para o Cliente (Label)</label>
                                      <input type="text" placeholder="Ex: Petição Inicial Elaborada" value={caseExperience.currentPhaseLabel || ''} onChange={(e) => setCaseExperience({...caseExperience, currentPhaseLabel: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Porcentagem de Progresso ({caseExperience.progressPercentage || 0}%)</label>
                                      <input type="range" min="0" max="100" value={caseExperience.progressPercentage || 0} onChange={(e) => setCaseExperience({...caseExperience, progressPercentage: Number(e.target.value)})} className="w-full h-2 bg-gray-250 rounded-lg appearance-none cursor-pointer mt-4" />
                                    </div>
                                    <div>
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Prazo Médio Estimado (Dias)</label>
                                      <input type="number" placeholder="Ex: 120" value={caseExperience.estimatedDurationDays || 120} onChange={(e) => setCaseExperience({...caseExperience, estimatedDurationDays: Number(e.target.value)})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Subtítulo / Sufixo do Prazo</label>
                                      <input type="text" value={caseExperience.estimatedDurationLabel || ''} onChange={(e) => setCaseExperience({...caseExperience, estimatedDurationLabel: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Data Inicial da Fase Atual</label>
                                      <input type="date" value={caseExperience.phaseStartedAt || ''} onChange={(e) => setCaseExperience({...caseExperience, phaseStartedAt: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none text-gray-650 font-mono" />
                                    </div>
                                    <div className="md:col-span-3">
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Descrição Detalhada e Amigável da Fase Atual</label>
                                      <textarea placeholder="O que está acontecendo agora de forma compreensível para o cliente..." value={caseExperience.publicPhaseDescription || ''} onChange={(e) => setCaseExperience({...caseExperience, publicPhaseDescription: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl h-20 resize-none outline-none" />
                                    </div>
                                    <div className="md:col-span-3">
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Próximo Passo / Próxima Expectativa Pública</label>
                                      <input type="text" placeholder="Ex: Intimação da parte contrária para apresentar defesa pública" value={caseExperience.nextPublicStep || ''} onChange={(e) => setCaseExperience({...caseExperience, nextPublicStep: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none" />
                                    </div>
                                    <div className="md:col-span-3">
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Alerta / Nota de Expectativa Contratual</label>
                                      <textarea placeholder="Ex: O prazo pode variar conforme o Tribunal e andamento..." value={caseExperience.expectationNotice || ''} onChange={(e) => setCaseExperience({...caseExperience, expectationNotice: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl h-16 resize-none outline-none" />
                                    </div>
                                  </div>
                                </div>

                                {/* Bloco B: Prioridade Automática Home */}
                                <div className="p-6 bg-gray-50 border border-gray-100 rounded-2xl space-y-4">
                                  <div className="flex items-center gap-2 border-b pb-2">
                                    <AlertCircle className="w-5 h-5 text-indigo-650" />
                                    <span className="text-[15px] font-black uppercase text-indigo-805">B) Card de Atenção com Ação (Prioridades Automáticas na Home)</span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-gray-650">
                                    <div>
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Status Visual / Classificação</label>
                                      <select value={casePriority.priorityLevel || 'informative'} onChange={(e) => setCasePriority({...casePriority, priorityLevel: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none">
                                        <option value="danger">Vermelho (Crítico / Ação Obrigatória)</option>
                                        <option value="warning">Amarelo (Atenção / Pendência Suave)</option>
                                        <option value="success">Verde (Sucesso / Atualização Relevante)</option>
                                        <option value="informative">Azul (Informativo Geral)</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Título do Card de Atenção</label>
                                      <input type="text" placeholder="Ex: Assinatura Eletrônica pendente!" value={casePriority.priorityTitle || ''} onChange={(e) => setCasePriority({...casePriority, priorityTitle: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none" />
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Descrição da Prioridade</label>
                                      <textarea placeholder="O que o cliente precisa saber ou fazer imediatamente..." value={casePriority.priorityDescription || ''} onChange={(e) => setCasePriority({...casePriority, priorityDescription: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl h-16 resize-none outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Texto do Botão de Ação</label>
                                      <input type="text" placeholder="Ex: Assinar Contrato Agora" value={casePriority.priorityActionLabel || ''} onChange={(e) => setCasePriority({...casePriority, priorityActionLabel: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-gray-500 mb-1 uppercase text-[12px]">Destino da Rota no Portal (Router Link)</label>
                                      <input type="text" placeholder="Ex: /documentos" value={casePriority.priorityActionRoute || ''} onChange={(e) => setCasePriority({...casePriority, priorityActionRoute: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none" />
                                    </div>
                                    <div className="md:col-span-2 pt-2">
                                      <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                                        <input type="checkbox" checked={casePriority.priorityVisible === true} onChange={(e) => setCasePriority({...casePriority, priorityVisible: e.target.checked})} className="rounded border-gray-350 w-4 h-4" />
                                        Ativar e exibir este alerta de prioridade mestre na Home do Portal
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* CASE INNER TAB: TIMELINE PÚBLICA DO CASO */}
                            {activeCaseTab === 'timeline_caso' && (
                              <div className="space-y-6 animate-in fade-in duration-100">
                                <div className="border-b pb-3">
                                  <h3 className="text-[18px] font-black uppercase text-gray-800 text-slate-800">Timeline Pública do Caso (Refletida no Painel)</h3>
                                  <p className="text-xs text-gray-400">Publique marcos interativos e microatualizações de monitoramento ativo exclusivos para este caso.</p>
                                </div>

                                {/* Bloco 1: Micro-Public Updates rápidas */}
                                <div className="p-5 bg-indigo-50/50 border border-indigo-100/55 rounded-2xl space-y-4">
                                  <span className="text-[13px] font-black uppercase text-indigo-900 block">D) Microatualizações Públicas Prontas (Escolha Rápida)</span>
                                  <div className="flex flex-wrap items-end gap-3 text-xs">
                                    <div className="flex-1 min-w-[280px]">
                                      <label className="block text-gray-500 font-bold mb-1 uppercase">Selecione o Modelo de Andamento</label>
                                      <select value={selectedQuickMicroValue} onChange={(e) => setSelectedQuickMicroValue(e.target.value)} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none font-bold text-gray-700">
                                        <option value="A equipe realizou nova revisão técnica do seu caso.">“A equipe realizou nova revisão técnica do seu caso.”</option>
                                        <option value="Seguimos acompanhando movimentações do Tribunal.">“Seguimos acompanhando movimentações do Tribunal.”</option>
                                        <option value="A controladoria revisou o andamento do processo.">“A controladoria revisou o andamento do processo.”</option>
                                        <option value="A documentação foi conferida pela equipe.">“A documentação foi conferida pela equipe.”</option>
                                        <option value="O caso permanece em monitoramento active.">“O caso permanece em monitoramento ativo.”</option>
                                      </select>
                                    </div>
                                    <button onClick={handleGenerateQuickMicro} className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl font-bold uppercase tracking-wide cursor-pointer text-xs flex items-center gap-1.5 shadow-xs shrink-0 self-end">
                                      <Activity className="w-4 h-4" /> Gerar microatualização pública
                                    </button>
                                  </div>
                                </div>

                                {/* Bloco 2: Criar Evento Manual na Timeline */}
                                <div className="p-6 bg-white border border-gray-200 rounded-2xl space-y-4 shadow-2xs">
                                  <span className="text-[13px] font-black uppercase text-indigo-900 block font-black text-slate-800">Criar Evento Manual na Timeline do Caso</span>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold text-gray-650 font-bold">
                                    <div className="md:col-span-2">
                                      <label className="block text-gray-450 mb-1 uppercase text-[11px]">Título do Evento</label>
                                      <input type="text" placeholder="Ex: Juntada de Petição de Manifestação" value={customCaseTimelineEvent.title} onChange={(e) => setCustomCaseTimelineEvent({...customCaseTimelineEvent, title: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-gray-450 mb-1 uppercase text-[11px]">Data do Evento</label>
                                      <input type="date" value={customCaseTimelineEvent.eventDate} onChange={(e) => setCustomCaseTimelineEvent({...customCaseTimelineEvent, eventDate: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none font-mono text-gray-600" />
                                    </div>
                                    <div className="md:col-span-3">
                                      <label className="block text-gray-450 mb-1 uppercase text-[11px]">Descrição Pública</label>
                                      <textarea placeholder="Explicação compreensível sobre esta etapa que ficará visível ao cliente..." value={customCaseTimelineEvent.description} onChange={(e) => setCustomCaseTimelineEvent({...customCaseTimelineEvent, description: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl h-16 resize-none outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-gray-450 mb-1 uppercase text-[11px]">Categoria / Tipo de Evento</label>
                                      <select value={customCaseTimelineEvent.eventType} onChange={(e) => setCustomCaseTimelineEvent({...customCaseTimelineEvent, eventType: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none">
                                        <option value="atendimento">Atendimento Geral</option>
                                        <option value="tribunal">Tribunal / Decisão / Despacho</option>
                                        <option value="documento">Análise de Peça / Documento</option>
                                        <option value="financeiro">Financeiro / Pagamento</option>
                                        <option value="acordo">Acordo Judicial / Conciliação</option>
                                        <option value="liminar">Medida Liminar / Urgência</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-gray-455 mb-1 uppercase text-[11px]">Cor Visual do Marcador</label>
                                      <select value={customCaseTimelineEvent.color} onChange={(e) => setCustomCaseTimelineEvent({...customCaseTimelineEvent, color: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none">
                                        <option value="indigo">Indigo (Padrão)</option>
                                        <option value="emerald">Verde (Sucesso)</option>
                                        <option value="amber">Amarelo (Atenção)</option>
                                        <option value="rose">Vermelho (Crítico)</option>
                                        <option value="sky">Azul Claro (Informativo)</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-gray-455 mb-1 uppercase text-[11px]">Ícone Correspondente</label>
                                      <select value={customCaseTimelineEvent.icon} onChange={(e) => setCustomCaseTimelineEvent({...customCaseTimelineEvent, icon: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none">
                                        <option value="Activity">Pulso / Atividade</option>
                                        <option value="Briefcase">Caso / Pasta</option>
                                        <option value="FileText">Documento / Petição</option>
                                        <option value="CheckCircle">Visto / Saneado</option>
                                        <option value="DollarSign">Cifrão / Financeiro</option>
                                        <option value="Scale">Balança da Justiça</option>
                                      </select>
                                    </div>
                                    <div className="md:col-span-3 flex items-center justify-between pt-2">
                                      <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                                        <input type="checkbox" checked={customCaseTimelineEvent.publicVisible === true} onChange={(e) => setCustomCaseTimelineEvent({...customCaseTimelineEvent, publicVisible: e.target.checked})} className="rounded border-gray-350 w-4 h-4" />
                                        Tornar este evento público e visível imediatamente no Portal
                                      </label>
                                      <button onClick={handleCreateCustomCaseTimelineEvent} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase transition-all cursor-pointer">
                                        Publicar Novo Evento de Timeline
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Bloco 3: Lista de Eventos Cadastrados */}
                                <div className="space-y-3">
                                  <span className="text-[13px] font-black uppercase text-gray-700 block font-bold text-slate-800">Histórico de Eventos e Marcos de Timeline do Caso</span>
                                  {caseTimelineEvents.length === 0 ? (
                                    <div className="p-8 text-center bg-gray-50 border border-dashed rounded-2xl text-gray-400 font-bold">
                                      Nenhum marco cadastrado na timeline pública deste caso.
                                    </div>
                                  ) : (
                                    <div className="divide-y border rounded-2xl overflow-hidden bg-white shadow-2xs">
                                      {caseTimelineEvents.map((ev) => (
                                        <div key={ev.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-50 transition-colors">
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                              <span className={`w-2.5 h-2.5 rounded-full bg-${ev.color || 'indigo'}-500`} />
                                              <span className="font-extrabold text-gray-805 text-[13px]">{ev.title}</span>
                                              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono uppercase font-semibold">{ev.eventType}</span>
                                              {ev.automatic && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-bold">AUTOMÁTICO</span>}
                                            </div>
                                            <p className="text-gray-500 font-semibold text-xs">{ev.description}</p>
                                            <div className="text-[10px] text-gray-400 font-mono">
                                              Data do Evento: <b className="text-gray-500">{ev.eventDate}</b> | Modificado em: {new Date(ev.updatedAt || ev.createdAt).toLocaleString()}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${ev.publicVisible ? 'bg-emerald-55 text-emerald-750 border border-emerald-100' : 'bg-rose-55 text-rose-750 border border-rose-100'}`}>
                                              {ev.publicVisible ? 'Visível' : 'Oculto'}
                                            </span>
                                            <button onClick={() => handleDeleteCaseTimelineEvent(ev.id)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer transition-colors" title="Excluir da Timeline">
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* CASE INNER TAB: VISIBILIDADE DO CASO */}
                            {activeCaseTab === 'visibilidade_caso' && (
                              <div className="space-y-6 animate-in fade-in duration-100">
                                <div className="flex justify-between items-center border-b pb-3">
                                  <div>
                                    <h3 className="text-[18px] font-black uppercase text-gray-800 text-slate-800">Controle de Visibilidade do Caso</h3>
                                    <p className="text-xs text-gray-400">Gerencie se este caso estará acessível para o Portal do Cliente de forma mestre.</p>
                                  </div>
                                  <button onClick={handleSaveCaseData} className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-black uppercase tracking-wide cursor-pointer transition-colors shadow-xs">
                                    Salvar Alterações de Visibilidade
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-bold">
                                  {/* Toggle 1: visibleToClient */}
                                  <div className="p-6 bg-white border border-gray-250 rounded-2xl shadow-3xs flex items-start gap-4">
                                    <input type="checkbox" id="visibleToClient" checked={caseFormData.visibleToClient !== false} onChange={(e) => setCaseFormData({...caseFormData, visibleToClient: e.target.checked})} className="mt-1.5 rounded border-gray-350 w-5 h-5 shrink-0 cursor-pointer" />
                                    <div className="space-y-1">
                                      <label htmlFor="visibleToClient" className="text-[15px] font-black text-gray-805 uppercase cursor-pointer block">Caso Visível para o Cliente</label>
                                      <p className="text-xs text-gray-500 font-bold">Toma efeito mestre se o caso e detalhes secundários podem ser visualizados na lista do Portal.</p>
                                    </div>
                                  </div>

                                  {/* Toggle 2: visivelParaCliente */}
                                  <div className="p-6 bg-white border border-gray-250 rounded-2xl shadow-3xs flex items-start gap-4">
                                    <input type="checkbox" id="visivelParaCliente" checked={caseFormData.visivelParaCliente !== false} onChange={(e) => setCaseFormData({...caseFormData, visivelParaCliente: e.target.checked})} className="mt-1.5 rounded border-gray-350 w-5 h-5 shrink-0 cursor-pointer" />
                                    <div className="space-y-1">
                                      <label htmlFor="visivelParaCliente" className="text-[15px] font-black text-gray-805 uppercase cursor-pointer block">Permitir Visualização Ativa (visivelParaCliente)</label>
                                      <p className="text-xs text-gray-500 font-bold">Mapeamento adicional para compatibilidade total com os flags do Portal legado.</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* ----------------------------------------------- */}
            {/* TAB 4: VISIBILIDADE GLOBAL DO PORTAL */}
            {/* ----------------------------------------------- */}
            {activeTab === 'visibilidade' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-[18px] font-black text-gray-800 uppercase tracking-tight">Regras de Visibilidade e Módulos do Portal</h2>
                    <p className="text-xs text-gray-500">Determine exatamente quais seções e telas estarão liberadas na área interna do cliente.</p>
                  </div>
                  <button onClick={handleSaveClientData} className="px-5 py-2 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-black uppercase tracking-wide cursor-pointer transition-colors">
                    Salvar Permissões
                  </button>
                </div>

                <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-2xs space-y-4">
                  <span className="text-xs font-black text-gray-850 uppercase block border-b pb-2">Toggle de Visualização Rápida</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    
                    {[
                      { id: 'showDashboard', label: 'Painel Inicial (Dashboard)', desc: 'Exibe a boas-vindas com a clock mestre, avisos e timeline' },
                      { id: 'showCadastros', label: 'Dados Cadastrais do Cliente', desc: 'Exibe a ficha com dados bancários, telefone e endereço para confirmação' },
                      { id: 'showCasos', label: 'Ficha de Casos e Processos', desc: 'Permite que o cliente veja a lista e acompanhamento público de seus processos' },
                      { id: 'showProvas', label: 'Pedidos de Documentação / Provas', desc: 'Exibe campo de Upload e arquivo em anexo para envios rápidos' },
                      { id: 'showInformacoes', label: 'Coleta de Informações', desc: 'Permite responder questionários e sanar dúvidas do escritório' },
                      { id: 'showFinanceiro', label: 'Aba Financeira do Cliente', desc: 'Exibe faturamentos e links de pagamento ativos no portal' },
                      { id: 'showAudiencias', label: 'Audiências Públicas', desc: 'Mostra datas, salas e pautas de conciliação' },
                      { id: 'showPericias', label: 'Perícias Técnicas', desc: 'Mostra agendamentos periciais do tribunal' },
                      { id: 'showReunioes', label: 'Reuniões de Alinhamento', desc: 'Seção para acompanhamento de chamadas e reuniões agendadas' }
                    ].map(item => (
                      <div key={item.id} className="flex items-start justify-between p-3.5 bg-gray-50/50 rounded-xl border border-gray-150">
                        <div className="space-y-0.5 max-w-[80%]">
                          <span className="text-xs font-black text-gray-800 uppercase">{item.label}</span>
                          <p className="text-[10px] text-gray-450 font-medium">{item.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={formData[item.id] !== false} 
                            onChange={(e) => setFormData({...formData, [item.id]: e.target.checked})}
                            className="sr-only peer" 
                          />
                          <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-350 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-650"></div>
                        </label>
                      </div>
                    ))}
                    
                  </div>
                </div>
              </div>
            )}

            {/* ----------------------------------------------- */}
            {/* TAB 5: PUBLIC TIMELINE FOR THE CLIENT */}
            {/* ----------------------------------------------- */}
            {activeTab === 'timeline' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-[18px] font-black text-gray-800 uppercase tracking-tight">Timeline e Avisos Especiais de {clientNameRaw}</h2>
                  <p className="text-xs text-gray-500">Adicione avisos, andamentos e comunicados que serão exibidos na tela inicial do Portal do Cliente.</p>
                </div>

                {/* Event Creation Form */}
                <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-2xs space-y-4 text-xs">
                  <span className="text-[11px] font-black uppercase text-gray-800 block border-b pb-2">Publicar Comunicado Rápido</span>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-gray-450 font-bold mb-1 uppercase">Título do Marco</label>
                      <input 
                        type="text" 
                        value={newTimelineEvent.title} 
                        onChange={(e) => setNewTimelineEvent({...newTimelineEvent, title: e.target.value})} 
                        className="w-full p-2.5 border rounded-xl outline-none" 
                        placeholder="Ex: Petição Inicial protocolada"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-gray-455 font-bold mb-1 uppercase">Descrição Detalhada</label>
                      <input 
                        type="text" 
                        value={newTimelineEvent.description} 
                        onChange={(e) => setNewTimelineEvent({...newTimelineEvent, description: e.target.value})} 
                        className="w-full p-2.5 border rounded-xl outline-none" 
                        placeholder="Descrição curta que o cliente lerá no feed"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-455 font-bold mb-1 uppercase">Data do Marco</label>
                      <input 
                        type="date" 
                        value={newTimelineEvent.date} 
                        onChange={(e) => setNewTimelineEvent({...newTimelineEvent, date: e.target.value})} 
                        className="w-full p-2.5 border rounded-xl outline-none text-gray-700" 
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button 
                      onClick={handleAddTimelineEvent}
                      className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl font-black uppercase tracking-wide cursor-pointer transition-colors flex items-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" /> Publicar Marco
                    </button>
                  </div>
                </div>

                {/* Timeline Feed Container */}
                <div className="bg-white border rounded-2xl p-6 shadow-2xs space-y-6">
                  <span className="text-xs font-black uppercase text-gray-800 block border-b pb-2">Histórico de Comunicados Públicos</span>
                  
                  {(!formData.publicTimeline || formData.publicTimeline.length === 0) ? (
                    <p className="text-center text-gray-400 font-medium py-6 italic text-xs">Nenhum evento registrado ainda na timeline pública deste cliente.</p>
                  ) : (
                    <div className="relative border-l border-gray-150 pl-6 ml-4 space-y-6">
                      {formData.publicTimeline.map((item: any, idx: number) => (
                        <div key={item.id || idx} className="relative text-xs">
                          {/* Dot Milestone marker */}
                          <div className="absolute -left-[30px] top-1.5 w-3 h-3 bg-indigo-600 rounded-full border border-white"></div>
                          
                          <div className="flex items-start justify-between gap-6 bg-gray-50/50 p-4 rounded-xl border border-gray-150">
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <span className="font-extrabold text-xs text-gray-900 uppercase">{item.title}</span>
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.2 rounded font-bold font-sans">{item.date}</span>
                              </div>
                              <p className="text-gray-500 font-medium leading-relaxed">{item.description}</p>
                            </div>
                            
                            <button
                              onClick={() => handleRemoveTimelineEvent(item.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer border border-transparent hover:border-rose-150 transition-colors"
                              title="Remover comunicado"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ----------------------------------------------- */}
            {/* TAB 6: AUDIT LOGGER SYSTEM */}
            {/* ----------------------------------------------- */}
            {activeTab === 'logs' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-[18px] font-black text-gray-800 uppercase tracking-tight">Logs de Alteração de Administrador Mestre</h2>
                  <p className="text-xs text-gray-500">Histórico completo de auditoria para fins de compliance. Toda alteração de login, ficha ou caso cria uma entrada fixa.</p>
                </div>

                <div className="bg-white border rounded-2xl overflow-hidden shadow-xs divide-y divide-gray-100">
                  <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <span className="text-[11px] font-black uppercase text-gray-700 block">Registros do Sistema (Auditoria)</span>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-indigo-50 border border-indigo-200 text-indigo-850 uppercase">{logs.length} Entradas</span>
                  </div>

                  {logs.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-xs text-gray-400 italic font-medium">Nenhum log gravado para este cliente até o momento.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {logs.map((log: any) => (
                        <div key={log.id} className="p-4 bg-white hover:bg-gray-55 transition-colors text-xs font-sans">
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1.5">
                              <span className="px-2 py-0.5 bg-gray-100 rounded-lg text-[9px] font-black uppercase tracking-wider text-gray-500 border border-gray-200">{log.areaChanged || 'Painel de Controle'}</span>
                              <p className="text-xs font-black text-gray-800 uppercase mt-1">{log.action}</p>
                              {log.previousValue && log.newValue && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-2.5 bg-gray-50 rounded-lg font-mono text-[10px] text-gray-450 border whitespace-pre-wrap select-all">
                                  <div>
                                    <span className="font-bold text-rose-700 uppercase leading-none block border-b pb-1 mb-1">Anterior:</span>
                                    {log.previousValue}
                                  </div>
                                  <div>
                                    <span className="font-bold text-emerald-700 uppercase leading-none block border-b pb-1 mb-1">Novo:</span>
                                    {log.newValue}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="text-right text-[10px] text-gray-400 font-bold shrink-0">
                              <span>{log.changedBy}</span>
                              <span className="block text-[9px] mt-0.5 whitespace-nowrap font-sans font-medium">{log.changedAt ? new Date(log.changedAt).toLocaleString('pt-BR') : 'Data Indisponível'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </BossLayout>
  );
}

// Simple reusable child components for elegant design
function EyeCirclePlaceholder() {
  return (
    <div className="py-20 text-center text-gray-400 space-y-4">
      <EyeCircleIcon />
      <span className="text-xs font-black uppercase text-gray-500 block">Nenhum Caso Ativo Selecionado</span>
      <p className="text-[10.5px] text-gray-400 font-medium max-w-sm mx-auto">
        Por favor, selecione um processo no painel esquerdo para visualizar a pauta, solicitações de informação, faturas secundárias, metas EDRP e controladoria.
      </p>
    </div>
  );
}

function EyeCircleIcon() {
  return (
    <div className="w-12 h-12 rounded-full border border-gray-250 flex items-center justify-center mx-auto text-gray-350 bg-gray-50 shrink-0">
      <Briefcase className="w-5 h-5 text-gray-400" />
    </div>
  );
}
