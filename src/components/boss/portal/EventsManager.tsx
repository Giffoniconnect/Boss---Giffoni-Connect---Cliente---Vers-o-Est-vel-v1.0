import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Check,
  FileText,
  Upload,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
  Search,
  User,
  Users,
  CalendarDays,
  Info,
  Notebook,
  LogOut
} from 'lucide-react';
import { doc, updateDoc, addDoc, collection, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

interface EventsManagerProps {
  type: 'audiencia' | 'pericia' | 'reuniao';
  title: string;
  description: string;
  allClientEvents: any[];
  clientCases: any[];
  addingEvent: boolean;
  newEventCaseId: string;
  setNewEventCaseId: (id: string) => void;
  newEventTitle: string;
  setNewEventTitle: (t: string) => void;
  newEventDate: string;
  setNewEventDate: (d: string) => void;
  newEventTime: string;
  setNewEventTime: (t: string) => void;
  newEventLocation: string;
  setNewEventLocation: (l: string) => void;
  newEventDesc: string;
  setNewEventDesc: (d: string) => void;
  newEventVisible: boolean;
  setNewEventVisible: (v: boolean) => void;
  handleCreateEvent: (type: 'audiencia' | 'pericia' | 'reuniao') => Promise<void>;
  handleUpdateEventStatus: (id: string, stat: string) => Promise<void>;
  handleToggleEventVisibility: (e: any) => Promise<void>;
  handleDeleteEvent: (id: string) => Promise<void>;
  setAllClientEvents?: React.Dispatch<React.SetStateAction<any[]>>;
  selectedClient?: any;
}

export const EventsManager: React.FC<EventsManagerProps> = ({
  type,
  title,
  description,
  allClientEvents,
  clientCases,
  addingEvent,
  newEventCaseId,
  setNewEventCaseId,
  newEventTitle,
  setNewEventTitle,
  newEventDate,
  setNewEventDate,
  newEventTime,
  setNewEventTime,
  newEventLocation,
  setNewEventLocation,
  newEventDesc,
  setNewEventDesc,
  newEventVisible,
  setNewEventVisible,
  handleCreateEvent,
  handleUpdateEventStatus,
  handleToggleEventVisibility,
  handleDeleteEvent,
  setAllClientEvents,
  selectedClient
}) => {
  const [showForm, setShowForm] = useState(false);
  const eventsOfThisType = allClientEvents.filter(e => e.type === type);

  // Custom states for audiencias
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRemarcarModalOpen, setIsRemarcarModalOpen] = useState(false);

  const [selectedEventToCancel, setSelectedEventToCancel] = useState<string>('');
  const [cancelJustification, setCancelJustification] = useState<string>('');

  const [selectedEventToRemarcar, setSelectedEventToRemarcar] = useState<string>('');
  const [remarcarJustification, setRemarcarJustification] = useState<string>('');
  const [newRemarcarDate, setNewRemarcarDate] = useState<string>('');
  const [newRemarcarTime, setNewRemarcarTime] = useState<string>('');
  const [newRemarcarLocation, setNewRemarcarLocation] = useState<string>('');
  const [newRemarcarDesc, setNewRemarcarDesc] = useState<string>('');
  const [newRemarcarDuration, setNewRemarcarDuration] = useState<string>('1 hora');

  const [checkingCalendarLocal, setCheckingCalendarLocal] = useState(false);
  const [conflitoLocalAlert, setConflitoLocalAlert] = useState<string | null>(null);

  const [expandedAuditoriaEventId, setExpandedAuditoriaEventId] = useState<string | null>(null);
  const [activeAuditEvents, setActiveAuditEvents] = useState<Record<string, any>>({});
  const [localLogs, setLocalLogs] = useState<any[]>([]);

  // States for Delegador de audiências
  const [isDelegadorModalOpen, setIsDelegadorModalOpen] = useState(false);
  const [selectedEventToDelegate, setSelectedEventToDelegate] = useState<string>('');
  const [delegateResponsavel, setDelegateResponsavel] = useState<'ceo' | 'associado' | 'interno' | ''>('');
  const [delegateAdvogadoAssociadoNome, setDelegateAdvogadoAssociadoNome] = useState<string>('');
  const [delegateSubstJuntado, setDelegateSubstJuntado] = useState<'sim' | 'nao'>('nao');
  const [delegateApresentadoAssociado, setDelegateApresentadoAssociado] = useState<'sim' | 'nao'>('nao');
  const [delegateReuniaoPreAudiencia, setDelegateReuniaoPreAudiencia] = useState<'sim' | 'nao'>('nao');
  const [delegateResponsavelInternoNome, setDelegateResponsavelInternoNome] = useState<string>('');
  const [delegateResponsavelInternoFuncao, setDelegateResponsavelInternoFuncao] = useState<string>('');
  const [delegateObservacoes, setDelegateObservacoes] = useState<string>('');
  const [delegateConfirmado, setDelegateConfirmado] = useState<boolean>(false);

  useEffect(() => {
    if (selectedEventToDelegate) {
      const ev = eventsOfThisType.find(e => e.id === selectedEventToDelegate);
      if (ev) {
        const audit = ev.audit || {};
        setDelegateResponsavel(audit.advogadoResponsavel || '');
        setDelegateAdvogadoAssociadoNome(audit.advogadoAssociadoNome || '');
        setDelegateSubstJuntado(audit.substJuntado === 'sim' ? 'sim' : 'nao');
        setDelegateApresentadoAssociado(audit.apresentadoAssociado === 'sim' ? 'sim' : 'nao');
        setDelegateReuniaoPreAudiencia(audit.reuniaoPreAudiencia === 'sim' ? 'sim' : 'nao');
        setDelegateResponsavelInternoNome(audit.responsavelInternoNome || '');
        setDelegateResponsavelInternoFuncao(audit.responsavelInternoFuncao || '');
        setDelegateObservacoes(audit.delegateObservacoes || '');
        setDelegateConfirmado(audit.delegateConfirmado || false);
      }
    } else {
      setDelegateResponsavel('');
      setDelegateAdvogadoAssociadoNome('');
      setDelegateSubstJuntado('nao');
      setDelegateApresentadoAssociado('nao');
      setDelegateReuniaoPreAudiencia('nao');
      setDelegateResponsavelInternoNome('');
      setDelegateResponsavelInternoFuncao('');
      setDelegateObservacoes('');
      setDelegateConfirmado(false);
    }
  }, [selectedEventToDelegate, isDelegadorModalOpen]);

  const handleConfirmDelegate = async () => {
    if (!selectedEventToDelegate) {
      alert("Selecione uma audiência para delegar.");
      return;
    }
    if (!delegateResponsavel) {
      alert("Selecione o responsável pela audiência.");
      return;
    }
    if (delegateResponsavel === 'associado' && !delegateAdvogadoAssociadoNome.trim()) {
      alert("Informe o nome do advogado associado.");
      return;
    }
    if (delegateResponsavel === 'interno' && (!delegateResponsavelInternoNome.trim() || !delegateResponsavelInternoFuncao.trim())) {
      alert("Preencha o nome e a função do responsável interno.");
      return;
    }
    if (!delegateConfirmado) {
      alert("Por favor, marque a caixa de confirmação da delegação.");
      return;
    }

    const evObj = eventsOfThisType.find(e => e.id === selectedEventToDelegate);
    if (!evObj) return;

    const now = new Date().toISOString();
    const pendenciasList: string[] = [];
    if (delegateResponsavel === 'associado') {
      if (delegateSubstJuntado === 'nao') pendenciasList.push("Substabelecimento com reserva de poderes ainda não foi juntado");
      if (delegateApresentadoAssociado === 'nao') pendenciasList.push("Cliente ainda não foi apresentado ao advogado associado");
      if (delegateReuniaoPreAudiencia === 'nao') pendenciasList.push("Reunião de pré-audiência ainda não marcada para o advogado associado");
    }

    const newHistoryEntry = {
      id: `del_hist_${Date.now()}`,
      timestamp: now,
      responsavel: delegateResponsavel === 'ceo' ? 'CEO' : delegateResponsavel === 'associado' ? 'Advogado associado' : 'Outro responsável interno',
      advogadoAssociado: delegateResponsavel === 'associado' ? delegateAdvogadoAssociadoNome : '',
      responsavelInternoNome: delegateResponsavel === 'interno' ? delegateResponsavelInternoNome : '',
      responsavelInternoFuncao: delegateResponsavel === 'interno' ? delegateResponsavelInternoFuncao : '',
      user: selectedClient?.email || 'direito.rgr@gmail.com',
      pendencias: pendenciasList.length > 0 ? pendenciasList.join("; ") : "Nenhuma pendência crítica",
      observacoes: delegateObservacoes
    };

    const currentAudit = evObj.audit || {};
    const existingHistory = evObj.delegationHistory || [];
    const updatedDelegationHistory = [newHistoryEntry, ...existingHistory];

    const updatedAudit = {
      ...currentAudit,
      advogadoResponsavel: delegateResponsavel,
      advogadoAssociadoNome: delegateResponsavel === 'associado' ? delegateAdvogadoAssociadoNome : '',
      substJuntado: delegateResponsavel === 'associado' ? delegateSubstJuntado : 'sim',
      apresentadoAssociado: delegateResponsavel === 'associado' ? delegateApresentadoAssociado : 'sim',
      reuniaoPreAudiencia: delegateResponsavel === 'associado' ? delegateReuniaoPreAudiencia : 'sim',
      responsavelInternoNome: delegateResponsavel === 'interno' ? delegateResponsavelInternoNome : '',
      responsavelInternoFuncao: delegateResponsavel === 'interno' ? delegateResponsavelInternoFuncao : '',
      delegateObservacoes: delegateObservacoes,
      delegateConfirmado: delegateConfirmado,
      delegationStatus: 'delegada'
    };

    const newTechLog = {
      id: `log_del_${Date.now()}`,
      timestamp: now,
      action: 'Delegação de Audiência',
      details: `Audiência "${evObj.title}" delegada para: ${
        delegateResponsavel === 'ceo' ? 'CEO' : 
        delegateResponsavel === 'associado' ? `Advogado Associado (${delegateAdvogadoAssociadoNome})` : 
        `Responsável Interno (${delegateResponsavelInternoNome} - ${delegateResponsavelInternoFuncao})`
      }. Pendências: [${pendenciasList.join(', ') || 'Nenhuma'}]. Obs: ${delegateObservacoes}`,
      status: pendenciasList.length > 0 ? 'erro' : 'sucesso',
      user: selectedClient?.email || 'direito.rgr@gmail.com'
    };

    const existingAuditLogs = evObj.technicalLogs || [];
    const updatedLogs = [newTechLog, ...existingAuditLogs].slice(0, 100);

    try {
      const eventRef = doc(db, 'caseEvents', selectedEventToDelegate);
      await updateDoc(eventRef, {
        audit: updatedAudit,
        delegationHistory: updatedDelegationHistory,
        technicalLogs: updatedLogs,
        updatedAt: now
      });

      if (setAllClientEvents) {
        setAllClientEvents(prev => prev.map(e => e.id === selectedEventToDelegate ? { 
          ...e, 
          audit: updatedAudit, 
          delegationHistory: updatedDelegationHistory,
          technicalLogs: updatedLogs,
          updatedAt: now 
        } : e));
      }

      setLocalLogs(prev => [
        {
          timestamp: now,
          action: 'Salvar Delegação',
          details: `Delegação concluída com ${pendenciasList.length} pendências para a audiência "${evObj.title}".`,
          status: 'sucesso'
        },
        {
          timestamp: now,
          action: 'Sincronização Todoist',
          details: 'Integração Todoist pendente - alteração apenas registrada internamente.',
          status: 'info'
        },
        ...prev
      ]);

      alert(delegateResponsavel === 'ceo' ? "Audiência delegada ao CEO." : "Delegação operacional registrada com sucesso!");
      setIsDelegadorModalOpen(false);
      setSelectedEventToDelegate('');
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar delegação: " + err.message);
    }
  };

  const defaultStatusText = "Audiência de Conciliação designada para 25/02/2026 às 15h30 – Processo nº 5004123-40.2025.8.13.0713 – 2ª Vara Cível da Comarca de Viçosa -MG";

  // Init local logs on first load of component
  useEffect(() => {
    if (type === 'audiencia' && localLogs.length === 0) {
      setLocalLogs([
        {
          timestamp: new Date().toISOString(),
          action: 'Acesso ao painel',
          details: 'Organizador de Agenda de Audiências carregado com sucesso.',
          status: 'sucesso'
        }
      ]);
    }
  }, [type]);

  // Sync edit audit states when events are loaded/expanded
  const handleToggleExpandAuditoria = (eventId: string) => {
    if (expandedAuditoriaEventId === eventId) {
      setExpandedAuditoriaEventId(null);
    } else {
      setExpandedAuditoriaEventId(eventId);
      const ev = eventsOfThisType.find(e => e.id === eventId);
      if (ev) {
        // Initialize audit state from event, or default values
        const currentAudit = ev.audit || {};
        setActiveAuditEvents(prev => ({
          ...prev,
          [eventId]: {
            peticaoProtocolada: currentAudit.peticaoProtocolada || 'nao',
            peticaoProtocoladaFileName: currentAudit.peticaoProtocoladaFileName || '',
            peticaoProtocoladaFileUrl: currentAudit.peticaoProtocoladaFileUrl || '',
            advogadoResponsavel: currentAudit.advogadoResponsavel || 'ceo',
            advogadoAssociadoNome: currentAudit.advogadoAssociadoNome || '',
            substJuntado: currentAudit.substJuntado || 'nao',
            substJuntadoFileName: currentAudit.substJuntadoFileName || '',
            substJuntadoFileUrl: currentAudit.substJuntadoFileUrl || '',
            apresentadoAssociado: currentAudit.apresentadoAssociado || 'nao',
            reuniaoPreAudiencia: currentAudit.reuniaoPreAudiencia || 'nao',
            reuniaoPreAudienciaFileName: currentAudit.reuniaoPreAudienciaFileName || '',
            reuniaoPreAudienciaFileUrl: currentAudit.reuniaoPreAudienciaFileUrl || '',
            reuniaoData: currentAudit.reuniaoData || '',
            reuniaoHora: currentAudit.reuniaoHora || '',
            reuniaoLocal: currentAudit.reuniaoLocal || '',
            reuniaoResp: currentAudit.reuniaoResp || '',
            reuniaoObs: currentAudit.reuniaoObs || '',
            roteiroPerguntas: currentAudit.roteiroPerguntas || 'nao',
            roteiroPerguntasFileName: currentAudit.roteiroPerguntasFileName || '',
            roteiroPerguntasFileUrl: currentAudit.roteiroPerguntasFileUrl || '',
            possuiTestemunhas: currentAudit.possuiTestemunhas || 'nao',
            testemunhasAvisadas: currentAudit.testemunhasAvisadas || 'nao',
            cartasTestemunhas: currentAudit.cartasTestemunhas || 'nao',
            cartasTestemunhasFileName: currentAudit.cartasTestemunhasFileName || '',
            cartasTestemunhasFileUrl: currentAudit.cartasTestemunhasFileUrl || '',
            testemunhasObs: currentAudit.testemunhasObs || '',
            agendaOfficeAvisado: currentAudit.agendaOfficeAvisado || 'nao',
            clienteAvisado: currentAudit.clienteAvisado || 'nao',
            clienteAvisadoFileName: currentAudit.clienteAvisadoFileName || '',
            clienteAvisadoFileUrl: currentAudit.clienteAvisadoFileUrl || '',
            cadastradaTodoist: currentAudit.cadastradaTodoist || 'pendente',
            cadastradaGoogle: currentAudit.cadastradaGoogle || 'pendente',
            conferenciaConflito: currentAudit.conferenciaConflito || 'nao',
            statusAudienciaText: currentAudit.statusAudienciaText || defaultStatusText
          }
        }));
      }
    }
  };

  const getCriticalPendings = (audit: any) => {
    const pendings: string[] = [];
    if (!audit) return pendings;

    if (!audit.advogadoResponsavel) {
      pendings.push("Advogado responsável não definido");
    } else if (audit.advogadoResponsavel === 'associado' && !audit.advogadoAssociadoNome.trim()) {
      pendings.push("Nome do advogado associado não preenchido");
    }

    if (audit.clienteAvisado === 'nao') {
      pendings.push("Cliente ainda não foi avisado");
    }

    if (audit.cadastradaGoogle === 'nao' || audit.cadastradaGoogle === 'pendente') {
      pendings.push("Audiência não cadastrada no Google Agenda");
    }

    if (audit.conferenciaConflito === 'nao' || audit.conferenciaConflito === 'conflito') {
      pendings.push("Conferência de conflito de agenda não realizada ou com conflito");
    }

    if (audit.roteiroPerguntas === 'nao') {
      pendings.push("Roteiro de perguntas e cenários não anexado");
    }

    if (audit.possuiTestemunhas === 'sim' && audit.testemunhasAvisadas === 'nao') {
      pendings.push("Testemunhas cadastradas mas ainda não avisadas");
    }

    if (audit.advogadoResponsavel === 'associado' && audit.substJuntado === 'nao') {
      pendings.push("Substabelecimento não juntado para o advogado associado");
    }

    return pendings;
  };

  const updateLocalAuditField = (eventId: string, field: string, value: any) => {
    setActiveAuditEvents(prev => {
      const updated = { ...prev[eventId], [field]: value };
      return { ...prev, [eventId]: updated };
    });
  };

  const handleMockFileUpload = (eventId: string, fieldPrefix: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    const fileName = file.name;

    setActiveAuditEvents(prev => {
      const updated = { 
        ...prev[eventId], 
        [`${fieldPrefix}FileName`]: fileName,
        [`${fieldPrefix}FileUrl`]: fileUrl
      };

      // Also set state representation to YES once attached
      if (fieldPrefix === 'peticaoProtocolada') updated.peticaoProtocolada = 'sim';
      if (fieldPrefix === 'substJuntado') updated.substJuntado = 'sim';
      if (fieldPrefix === 'reuniaoPreAudiencia') updated.reuniaoPreAudiencia = 'sim';
      if (fieldPrefix === 'roteiroPerguntas') updated.roteiroPerguntas = 'sim';
      if (fieldPrefix === 'cartasTestemunhas') updated.cartasTestemunhas = 'sim';
      if (fieldPrefix === 'clienteAvisado') updated.clienteAvisado = 'sim';

      return { ...prev, [eventId]: updated };
    });

    const now = new Date().toISOString();
    setLocalLogs(prev => [
      {
        timestamp: now,
        action: 'Anexo de documento',
        details: `Documento "${fileName}" anexado com sucesso ao item de auditoria.`,
        status: 'sucesso'
      },
      ...prev
    ]);
  };

  const handleSaveAudit = async (eventId: string) => {
    const auditState = activeAuditEvents[eventId];
    if (!auditState) return;

    const currentEvent = allClientEvents.find(e => e.id === eventId);
    const existingAudit = currentEvent?.audit || {};

    const criticals = getCriticalPendings(auditState);
    const isConcluido = criticals.length === 0;

    const newLogs: any[] = [];
    const now = new Date().toISOString();

    const fieldsToCompare = [
      { key: 'peticaoProtocolada', label: 'Petição de ciente protocolada' },
      { key: 'advogadoResponsavel', label: 'Advogado responsável' },
      { key: 'advogadoAssociadoNome', label: 'Nome do advogado associado' },
      { key: 'substJuntado', label: 'Substabelecimento juntado' },
      { key: 'apresentadoAssociado', label: 'Cliente apresentado ao associado' },
      { key: 'reuniaoPreAudiencia', label: 'Reunião de pré-audiência' },
      { key: 'roteiroPerguntas', label: 'Roteiro de perguntas e cenários' },
      { key: 'possuiTestemunhas', label: 'Possui testemunhas' },
      { key: 'testemunhasAvisadas', label: 'Testemunhas avisadas' },
      { key: 'cartasTestemunhas', label: 'Cartas/termos de compromisso de testemunhas' },
      { key: 'agendaOfficeAvisado', label: 'Agenda Office avisado' },
      { key: 'clienteAvisado', label: 'Cliente avisado' },
      { key: 'cadastradaTodoist', label: 'Cadastrada no Todoist' },
      { key: 'cadastradaGoogle', label: 'Cadastrada no Google Agenda' },
      { key: 'conferenciaConflito', label: 'Conferência de conflito realizada' },
      { key: 'statusAudienciaText', label: 'Status da audiência' }
    ];

    fieldsToCompare.forEach(f => {
      const oldVal = existingAudit[f.key];
      const newVal = auditState[f.key];
      if (oldVal !== newVal && newVal !== undefined) {
        newLogs.push({
          id: `log_audit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          timestamp: now,
          action: `Alteração no campo: ${f.label}`,
          details: `Alterado de "${oldVal || 'Não definido'}" para "${newVal}"`,
          status: 'sucesso',
          user: selectedClient?.email || 'direito.rgr@gmail.com'
        });
      }
    });

    const existingAuditLogs = currentEvent?.technicalLogs || [];
    const updatedLogs = [...newLogs, ...existingAuditLogs].slice(0, 100);

    try {
      const eventRef = doc(db, 'caseEvents', eventId);
      await updateDoc(eventRef, {
        audit: auditState,
        technicalLogs: updatedLogs,
        updatedAt: now
      });

      if (setAllClientEvents) {
        setAllClientEvents(prev => prev.map(e => e.id === eventId ? { ...e, audit: auditState, technicalLogs: updatedLogs, updatedAt: now } : e));
      }

      setLocalLogs(prev => [
        {
          timestamp: now,
          action: 'Salvar Auditoria',
          details: `Auditoria salva com ${criticals.length} pendências críticas registradas.`,
          status: 'sucesso'
        },
        ...newLogs.map(l => ({
          timestamp: l.timestamp,
          action: l.action,
          details: l.details,
          status: l.status
        })),
        ...prev
      ]);

      alert("Auditoria operacional de audiência salva com sucesso!");
    } catch (err: any) {
      console.error("Error saving audit:", err);
      alert("Erro técnico ao salvar auditoria na Firestore: " + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    
    // Add technical log about creating hearing
    setLocalLogs(prev => [
      {
        timestamp: now,
        action: 'Clique em "Cadastrar audiência"',
        details: `Disparado formulário de criação para nova audiência: "${newEventTitle}"`,
        status: 'info'
      },
      ...prev
    ]);

    await handleCreateEvent(type);
    setShowForm(false);

    setLocalLogs(prev => [
      {
        timestamp: now,
        action: 'Criação de audiência',
        details: `Audiência "${newEventTitle}" salva com sucesso na Firestore.`,
        status: 'sucesso'
      },
      ...prev
    ]);
  };

  // Google Calendar conflict check helper
  const checkGoogleCalendarConflict = async (caseId: string, date: string, time: string, location: string) => {
    const token = localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';
    if (!token) return { status: 'no_token' };
    try {
      const res = await fetch('/api/calendar/check-conflicts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          caseId,
          googleAccessToken: token,
          date,
          time,
          type: 'audiencia',
          local: location,
          link: ''
        })
      });
      if (res.ok) {
        const data = await res.json();
        return { status: 'success', data };
      } else {
        return { status: 'error' };
      }
    } catch (err) {
      return { status: 'error' };
    }
  };

  const handleCancelEventConfirmed = async () => {
    if (!selectedEventToCancel) {
      alert("Selecione a audiência fática a ser cancelada.");
      return;
    }
    if (cancelJustification.trim().length < 5) {
      alert("Por favor, forneça um motivo detalhado para o cancelamento.");
      return;
    }

    const now = new Date().toISOString();
    const eventId = selectedEventToCancel;
    const evObj = eventsOfThisType.find(e => e.id === eventId);
    if (!evObj) return;

    setLocalLogs(prev => [
      {
        timestamp: now,
        action: 'Clique em "Cancelar audiência marcada"',
        details: `Iniciado fluxo de cancelamento para o evento ID: ${eventId}`,
        status: 'info'
      },
      ...prev
    ]);

    try {
      const eventRef = doc(db, 'caseEvents', eventId);
      const updatedHistory = [
        ...(evObj.history || []),
        {
          id: `hist_${Date.now()}`,
          type: 'cancelada',
          dateOriginal: evObj.date,
          dateNew: '',
          reason: cancelJustification.trim(),
          user: selectedClient?.email || 'direito.rgr@gmail.com',
          googleStatus: evObj.eventId ? 'cancelado_no_google' : 'sem_vinculo_google',
          eventId: evObj.eventId || '',
          timestamp: now
        }
      ];

      const updatedLogs = [
        {
          id: `log_${Date.now()}`,
          timestamp: now,
          action: 'Cancelamento de Audiência',
          details: `Audiência cancelada com a seguinte justificativa: ${cancelJustification.trim()}`,
          status: 'sucesso'
        },
        ...(evObj.technicalLogs || [])
      ].slice(0, 50);

      const payload = {
        status: 'cancelado',
        history: updatedHistory,
        technicalLogs: updatedLogs,
        updatedAt: now
      };

      await updateDoc(eventRef, payload);

      if (setAllClientEvents) {
        setAllClientEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...payload } : e));
      }

      setLocalLogs(prev => [
        {
          timestamp: now,
          action: 'Justificativa de cancelamento',
          details: `Justificativa registrada: "${cancelJustification.trim()}"`,
          status: 'sucesso'
        },
        {
          timestamp: now,
          action: 'Cancelamento efetuado',
          details: `Audiência "${evObj.title}" foi marcada como Cancelada com sucesso.`,
          status: 'sucesso'
        },
        ...prev
      ]);

      alert("Audiência cancelada com sucesso.");
      setIsCancelModalOpen(false);
      setSelectedEventToCancel('');
      setCancelJustification('');
    } catch (e: any) {
      console.error(e);
      alert("Erro técnico ao atualizar cancelamento na Firestore: " + e.message);
    }
  };

  const handleRemarcarEventConfirmed = async () => {
    if (!selectedEventToRemarcar) {
      alert("Selecione a audiência a ser remarcada.");
      return;
    }
    if (!newRemarcarDate || !newRemarcarTime) {
      alert("Selecione nova data e novo horário.");
      return;
    }
    if (remarcarJustification.trim().length < 5) {
      alert("Forneça um motivo para a remarcação.");
      return;
    }

    const now = new Date().toISOString();
    const eventId = selectedEventToRemarcar;
    const evObj = eventsOfThisType.find(e => e.id === eventId);
    if (!evObj) return;

    setCheckingCalendarLocal(true);
    setConflitoLocalAlert(null);

    setLocalLogs(prev => [
      {
        timestamp: now,
        action: 'Clique em "Remarcar audiência"',
        details: `Iniciada tentativa de remarcação para o evento "${evObj.title}"`,
        status: 'info'
      },
      ...prev
    ]);

    // Consult calendar conflict before rescheduling
    const conflictResult = await checkGoogleCalendarConflict(
      evObj.caseId || 'f60jptoSi8Z9xat45yIb',
      newRemarcarDate,
      newRemarcarTime,
      newRemarcarLocation || evObj.location
    );

    if (conflictResult.status === 'success' && conflictResult.data?.conflicts?.length > 0) {
      setConflitoLocalAlert("Existe possível conflito de audiência no novo horário informado.");
      setLocalLogs(prev => [
        {
          timestamp: now,
          action: 'Consulta de conflito para nova data',
          details: `Aviso de conflito de agenda detectado no Google Calendar para ${newRemarcarDate} às ${newRemarcarTime}.`,
          status: 'erro'
        },
        ...prev
      ]);
      setCheckingCalendarLocal(false);
      alert("⚠️ Existe possível conflito de audiência no novo horário informado.");
      return;
    }

    try {
      const eventRef = doc(db, 'caseEvents', eventId);
      const updatedHistory = [
        ...(evObj.history || []),
        {
          id: `hist_${Date.now()}`,
          type: 'remarcada',
          dateOriginal: evObj.date,
          dateNew: newRemarcarDate,
          reason: remarcarJustification.trim(),
          user: selectedClient?.email || 'direito.rgr@gmail.com',
          googleStatus: conflictResult.status === 'success' ? 'sincronizado' : 'integracao_pendente',
          eventId: evObj.eventId || '',
          timestamp: now
        }
      ];

      const updatedLogs = [
        {
          id: `log_${Date.now()}`,
          timestamp: now,
          action: 'Remarcação de Audiência',
          details: `Audiência remarcada de ${evObj.date} ${evObj.time} para ${newRemarcarDate} ${newRemarcarTime}. Motivo: ${remarcarJustification.trim()}`,
          status: 'sucesso'
        },
        ...(evObj.technicalLogs || [])
      ].slice(0, 50);

      const payload = {
        date: newRemarcarDate,
        time: newRemarcarTime,
        location: newRemarcarLocation || evObj.location,
        description: newRemarcarDesc || evObj.description,
        status: 'remarcado',
        history: updatedHistory,
        technicalLogs: updatedLogs,
        updatedAt: now
      };

      await updateDoc(eventRef, payload);

      if (setAllClientEvents) {
        setAllClientEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...payload } : e));
      }

      setLocalLogs(prev => [
        {
          timestamp: now,
          action: 'Justificativa de remarcação',
          details: `Motivo: "${remarcarJustification.trim()}"`,
          status: 'sucesso'
        },
        {
          timestamp: now,
          action: 'Remarcação concluída',
          details: `Audiência "${evObj.title}" reagendada com êxito para ${newRemarcarDate} às ${newRemarcarTime}.`,
          status: 'sucesso'
        },
        ...prev
      ]);

      alert("Audiência remarcada com sucesso.");
      setIsRemarcarModalOpen(false);
      setSelectedEventToRemarcar('');
      setRemarcarJustification('');
      setNewRemarcarDate('');
      setNewRemarcarTime('');
      setNewRemarcarLocation('');
      setNewRemarcarDesc('');
    } catch (e: any) {
      console.error(e);
      alert("Erro ao remarcar audiência na Firestore: " + e.message);
    } finally {
      setCheckingCalendarLocal(false);
    }
  };

  // Extract merged history for all hearings
  const allHearingsHistory = eventsOfThisType.flatMap((item) => {
    const itemHistory = Array.isArray(item.history) ? item.history : [];
    return itemHistory.map((hist: any) => ({
      ...hist,
      eventTitle: item.title,
      eventId: item.id
    }));
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Extract merged technical logs
  const allHearingsTechnicalLogs = eventsOfThisType.flatMap((item) => {
    const itemLogs = Array.isArray(item.technicalLogs) ? item.technicalLogs : [];
    return itemLogs.map((log: any) => ({
      ...log,
      eventTitle: item.title,
      eventId: item.id
    }));
  });

  const mergedLogs = [
    ...localLogs.map(l => ({ ...l, eventTitle: 'Sistema / Central' })),
    ...allHearingsTechnicalLogs
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Header card */}
      <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)] gap-4">
        <div>
          <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block">ORGANIZADOR DE AGENDA</span>
          <h2 className="text-2xl font-black text-gray-950 tracking-tight mt-0.5">{title}</h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">{description}</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setLocalLogs(prev => [
              {
                timestamp: new Date().toISOString(),
                action: 'Clique em "Cadastrar audiência"',
                details: showForm ? 'Cadastro de nova audiência recolhido.' : 'Aberto formulário de agendamento de nova audiência.',
                status: 'info'
              },
              ...prev
            ]);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition font-mono self-start sm:self-center shrink-0 cursor-pointer shadow-3xs"
        >
          {showForm ? 'Fechar Cadastro' : `Agendar Nova ${type.charAt(0).toUpperCase() + type.slice(1)}`}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-6 animate-fade-in">
          <div className="border-b border-gray-100 pb-3">
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">Formulário de Agendamento</h4>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1.5">Caso / Processo Associado</label>
                <select
                  value={newEventCaseId || ''}
                  onChange={(e) => setNewEventCaseId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white transition"
                >
                  <option value="">Selecione um caso...</option>
                  {clientCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.registrationType || 'Processo'} ({c.id.substring(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1.5">Título do Evento</label>
                <input
                  type="text"
                  placeholder={`Ex: ${type === 'audiencia' ? 'Audiência de Conciliação fática' : type === 'pericia' ? 'Perícia do INSS' : 'Reunião de Alinhamento'}`}
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none transition"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1.5">Data</label>
                <input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-semibold focus:bg-white focus:outline-none transition"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1.5">Horário</label>
                <input
                  type="time"
                  value={newEventTime}
                  onChange={(e) => setNewEventTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-semibold focus:bg-white focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1.5">Local / Link do Encontro</label>
              <input
                type="text"
                placeholder="Ex: Google Meet, Fórum Central de Londrina - Sala 304, etc"
                value={newEventLocation}
                onChange={(e) => setNewEventLocation(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none transition"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-black text-gray-400 uppercase block mb-1.5">Notas / Orientações p/ Cliente</label>
              <textarea
                placeholder="Insira detalhes que aparecerão no portal, como documentos necessários que o cliente deve portar e orientações comportamentais."
                value={newEventDesc}
                onChange={(e) => setNewEventDesc(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none transition"
              />
            </div>

            <div className="flex items-center gap-3 bg-gray-50 p-3.5 border border-gray-150 rounded-2xl">
              <input
                id={`vis_${type}`}
                type="checkbox"
                checked={newEventVisible}
                onChange={(e) => setNewEventVisible(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <label htmlFor={`vis_${type}`} className="text-xs font-bold text-gray-700 cursor-pointer selection:bg-transparent select-none">
                Disponível no Portal do Cliente (o cliente recebe alerta ativo)
              </label>
            </div>

            <button
              type="submit"
              disabled={addingEvent}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition font-mono cursor-pointer"
            >
              {addingEvent ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
              Salvar Evento na Agenda
            </button>
          </form>
        </div>
      )}

      {/* Events list/table container */}
      <div className="bg-white border border-gray-150 rounded-3xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-1">
        {eventsOfThisType.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-6">
            <div>
              <Calendar size={32} className="mx-auto text-gray-300 mb-2.5 animate-pulse" />
              <p className="text-xs font-black uppercase font-mono tracking-wider text-gray-850">Nenhum registro agendado</p>
              <p className="text-xs mt-1">Nenhuma audiência foi adicionada na agenda deste cliente.</p>
            </div>

            {type === 'audiencia' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 max-w-5xl mx-auto pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(true);
                    setLocalLogs(prev => [
                      {
                        timestamp: new Date().toISOString(),
                        action: 'Clique em "Cadastrar audiência"',
                        details: 'Formulário de agendamento de nova audiência ativado.',
                        status: 'info'
                      },
                      ...prev
                    ]);
                    window.scrollTo({ top: 300, behavior: 'smooth' });
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-150 hover:border-indigo-300 text-indigo-700 font-extrabold rounded-2xl text-xs transition cursor-pointer shadow-3xs hover:bg-indigo-100/50"
                >
                  <Plus size={14} className="stroke-[2.5]" />
                  <span>Cadastrar audiência</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsConflictModalOpen(true);
                    setLocalLogs(prev => [
                      {
                        timestamp: new Date().toISOString(),
                        action: 'Clique em "Resolver conflito de audiência"',
                        details: 'Janela de diagnóstico de conflitos de agenda iniciada.',
                        status: 'info'
                      },
                      ...prev
                    ]);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 border border-amber-150 hover:border-amber-300 text-amber-700 font-extrabold rounded-2xl text-xs transition cursor-pointer shadow-3xs hover:bg-amber-100/50"
                >
                  <ShieldAlert size={14} className="stroke-[2.5]" />
                  <span>Resolver conflito de audiência</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsCancelModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 border border-rose-150 hover:border-rose-300 text-rose-700 font-extrabold rounded-2xl text-xs transition cursor-pointer shadow-3xs hover:bg-rose-100/50"
                >
                  <X size={14} className="stroke-[2.5]" />
                  <span>Cancelar audiência marcada</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsRemarcarModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border border-blue-150 hover:border-blue-300 text-blue-700 font-extrabold rounded-2xl text-xs transition cursor-pointer shadow-3xs hover:bg-blue-100/50"
                >
                  <RefreshCw size={13} className="stroke-[2.5]" />
                  <span>Remarcar audiência</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const now = new Date().toISOString();
                    setLocalLogs(prev => [
                      {
                        timestamp: now,
                        action: 'Clique em "Delegador de audiências"',
                        details: 'Painel do Delegador de Audiências selecionado.',
                        status: 'info'
                      },
                      ...prev
                    ]);
                    setIsDelegadorModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 border border-purple-150 hover:border-purple-300 text-purple-700 font-extrabold rounded-2xl text-xs transition cursor-pointer shadow-3xs hover:bg-purple-100/50"
                >
                  <Users size={14} className="stroke-[2.5]" />
                  <span>Delegador de audiências</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest">
                  <th className="p-4 pl-6">Evento / Caso</th>
                  <th className="p-4">Data & Horário</th>
                  <th className="p-4">Origem / Local</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Visibilidade</th>
                  <th className="p-4">Auditoria</th>
                  <th className="p-4 pr-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold text-gray-750">
                {eventsOfThisType.map((item) => {
                  const hasAuditoriaExpand = expandedAuditoriaEventId === item.id;
                  const itemAuditState = activeAuditEvents[item.id] || item.audit || {};
                  const criticalPendings = getCriticalPendings(itemAuditState);
                  const isAuditedSuccess = criticalPendings.length === 0 && (item.audit);

                  return (
                    <React.Fragment key={item.id}>
                      <tr className={`hover:bg-gray-50/50 transition ${item.status === 'cancelado' ? 'opacity-60 bg-gray-50/30' : ''}`}>
                        <td className="p-4 pl-6">
                          <div className="font-extrabold text-gray-950 text-xs flex items-center gap-2">
                            {item.title}
                            {item.status === 'cancelado' && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[9px] uppercase font-mono rounded-lg">Cancelada</span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-gray-400 mt-0.5">ID Caso: {item.caseId?.substring(0, 8)}...</div>
                        </td>
                        <td className="p-4 font-mono">
                          <div>{item.date ? new Date(item.date).toLocaleDateString('pt-BR') : '—'}</div>
                          <div className="text-[9.5px] text-gray-400 flex items-center gap-1 mt-0.5"><Clock size={11} /> {item.time || '—'}</div>
                        </td>
                        <td className="p-4">
                          <div className="truncate max-w-[150px]">{item.location || 'Sem Especificação'}</div>
                          <div className="text-[10px] text-gray-400 italic max-w-[150px] truncate">{item.description || 'Nenhum memo'}</div>
                        </td>
                        <td className="p-4">
                          <select
                            value={item.status || 'agendado'}
                            onChange={(e) => handleUpdateEventStatus(item.id, e.target.value)}
                            className={`px-3 py-1 border rounded-lg text-[10.1px] font-extrabold uppercase font-mono cursor-pointer ${
                              item.status === 'concluido' || item.status === 'realizado' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                              item.status === 'cancelado' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                              item.status === 'remarcado' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'
                            }`}
                          >
                            <option value="agendado">📅 Agendado</option>
                            <option value="realizado">✅ Realizado</option>
                            <option value="remarcado">🔄 Remarcado</option>
                            <option value="cancelado">❌ Cancelado</option>
                          </select>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleEventVisibility(item)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-[10px] font-bold uppercase transition ${
                              item.visibleToClient 
                                ? 'bg-emerald-50/50 border-emerald-150 text-emerald-700 hover:bg-emerald-50' 
                                : 'bg-gray-50 border-gray-150 text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            {item.visibleToClient ? <Eye size={12} /> : <EyeOff size={12} />}
                            <span>{item.visibleToClient ? 'Público' : 'Privado'}</span>
                          </button>
                        </td>
                        <td className="p-4">
                          {type === 'audiencia' ? (
                            <button
                              onClick={() => handleToggleExpandAuditoria(item.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-[10px] font-extrabold uppercase transition cursor-pointer ${
                                hasAuditoriaExpand 
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-3xs' 
                                  : isAuditedSuccess 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              }`}
                            >
                              <ShieldAlert size={12} />
                              <span>{isAuditedSuccess ? 'Auditoria OK ✅' : 'Auditar ⚠️'}</span>
                              {hasAuditoriaExpand ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          ) : (
                            <span className="text-gray-400 font-mono text-[10px] uppercase">Não se aplica</span>
                          )}
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <button
                            onClick={() => handleDeleteEvent(item.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-transparent hover:border-rose-100 rounded-lg transition cursor-pointer"
                            title="Remover Evento"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Auditoria de Audiência content */}
                      {type === 'audiencia' && hasAuditoriaExpand && (
                        <tr>
                          <td colSpan={7} className="p-6 bg-stone-50/70 border-y border-gray-200 animate-slide-down">
                            <div className="max-w-4xl mx-auto space-y-6">
                              
                              {/* Title block with custom status */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 pb-4 gap-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                                    <ShieldAlert size={16} />
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-black uppercase text-gray-950 font-mono tracking-tight">Auditoria da Audiência</h3>
                                    <p className="text-[11px] text-gray-500 font-medium">Controle fático e conferência operacional completa do ato processual.</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-3xs">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase font-mono">Status da Auditoria:</span>
                                  {criticalPendings.length === 0 ? (
                                    <span className="text-[11px] font-black text-emerald-600 uppercase font-mono flex items-center gap-1">
                                      Concluída <Check size={12} className="stroke-[3]" />
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-black text-red-500 uppercase font-mono flex items-center gap-1">
                                      Pendências ({criticalPendings.length})
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* AUDIT STATUS DECORATION CARD */}
                              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-3xs space-y-3">
                                <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block">Status do Caso</span>
                                <div className="p-3.5 bg-stone-50 border border-stone-150 rounded-xl text-xs font-semibold font-mono text-stone-800 leading-relaxed">
                                  {itemAuditState.statusAudienciaText || defaultStatusText}
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Editar Texto do Status</label>
                                  <input 
                                    type="text"
                                    value={itemAuditState.statusAudienciaText || ''}
                                    onChange={(e) => updateLocalAuditField(item.id, 'statusAudienciaText', e.target.value)}
                                    placeholder="Ex: Audiência de Conciliação designada para..."
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 focus:border-purple-500 rounded-xl text-xs font-semibold outline-none transition"
                                  />
                                </div>
                              </div>

                              {/* CHECKLIST FORM GRID */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                
                                {/* 1. Petição de ciente */}
                                <div className="bg-white p-4 border border-gray-150 rounded-2xl space-y-3 shadow-3xs">
                                  <label className="text-[11px] font-extrabold text-gray-900 block">Petição de ciente da audiência protocolada? *</label>
                                  <div className="flex gap-2">
                                    {[
                                      { id: 'sim', label: 'Sim ✅' },
                                      { id: 'nao', label: 'Não ⚠️' },
                                      { id: 'n_a', label: 'Não se aplica' }
                                    ].map(opt => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => updateLocalAuditField(item.id, 'peticaoProtocolada', opt.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          itemAuditState.peticaoProtocolada === opt.id 
                                            ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-3xs' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="pt-1">
                                    <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wide block mb-1">Anexo da Petição</span>
                                    <div className="flex items-center gap-2">
                                      <label className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer transition">
                                        <Upload size={12} />
                                        <span>Anexar PDF</span>
                                        <input 
                                          type="file" 
                                          accept=".pdf,.doc,.docx"
                                          onChange={(e) => handleMockFileUpload(item.id, 'peticaoProtocolada', e)}
                                          className="hidden" 
                                        />
                                      </label>
                                      {itemAuditState.peticaoProtocoladaFileName && (
                                        <a 
                                          href={itemAuditState.peticaoProtocoladaFileUrl} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-extrabold transition"
                                        >
                                          <FileText size={13} />
                                          <span className="max-w-[150px] truncate">{itemAuditState.peticaoProtocoladaFileName}</span>
                                          <ExternalLink size={10} />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 2. Advogado Responsável */}
                                <div className="bg-white p-4 border border-gray-150 rounded-2xl space-y-3 shadow-3xs">
                                  <label className="text-[11px] font-extrabold text-gray-900 block">Quem será o advogado responsável pela audiência? *</label>
                                  <div className="flex gap-2">
                                    {[
                                      { id: 'ceo', label: 'CEO (Dr. Giffoni)' },
                                      { id: 'associado', label: 'Advogado associado' }
                                    ].map(opt => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => updateLocalAuditField(item.id, 'advogadoResponsavel', opt.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          itemAuditState.advogadoResponsavel === opt.id 
                                            ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-3xs' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                  {itemAuditState.advogadoResponsavel === 'associado' && (
                                    <div className="space-y-1 animate-slide-down pt-1">
                                      <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Qual advogado associado? *</label>
                                      <input 
                                        type="text"
                                        required
                                        value={itemAuditState.advogadoAssociadoNome || ''}
                                        onChange={(e) => updateLocalAuditField(item.id, 'advogadoAssociadoNome', e.target.value)}
                                        placeholder="Digite o nome completo do advogado associado..."
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:bg-white focus:border-purple-500 transition"
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* 3. Substabelecimento */}
                                <div className="bg-white p-4 border border-gray-150 rounded-2xl space-y-3 shadow-3xs">
                                  <label className="text-[11px] font-extrabold text-gray-900 block">Substabelecimento com reserva de poderes foi juntado? *</label>
                                  <div className="flex gap-2">
                                    {[
                                      { id: 'sim', label: 'Sim ✅' },
                                      { id: 'nao', label: 'Não ⚠️' },
                                      { id: 'n_a', label: 'Não se aplica' }
                                    ].map(opt => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => updateLocalAuditField(item.id, 'substJuntado', opt.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          itemAuditState.substJuntado === opt.id 
                                            ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-3xs' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="pt-1">
                                    <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wide block mb-1">Anexo do Substabelecimento</span>
                                    <div className="flex items-center gap-2">
                                      <label className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer transition">
                                        <Upload size={12} />
                                        <span>Anexar PDF</span>
                                        <input 
                                          type="file" 
                                          accept=".pdf"
                                          onChange={(e) => handleMockFileUpload(item.id, 'substJuntado', e)}
                                          className="hidden" 
                                        />
                                      </label>
                                      {itemAuditState.substJuntadoFileName && (
                                        <a 
                                          href={itemAuditState.substJuntadoFileUrl} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-extrabold transition"
                                        >
                                          <FileText size={13} />
                                          <span className="max-w-[150px] truncate">{itemAuditState.substJuntadoFileName}</span>
                                          <ExternalLink size={10} />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 4. Apresentação do Cliente */}
                                <div className="bg-white p-4 border border-gray-150 rounded-2xl space-y-3 shadow-3xs">
                                  <label className="text-[11px] font-extrabold text-gray-900 block">Cliente foi apresentado ao advogado associado? *</label>
                                  <div className="flex gap-2">
                                    {[
                                      { id: 'sim', label: 'Sim ✅' },
                                      { id: 'nao', label: 'Não ⚠️' },
                                      { id: 'n_a', label: 'Não se aplica' }
                                    ].map(opt => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => updateLocalAuditField(item.id, 'apresentadoAssociado', opt.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          itemAuditState.apresentadoAssociado === opt.id 
                                            ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-3xs' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* 5. Reunião Pré-Audiência */}
                                <div className="bg-white p-4 border border-gray-150 rounded-2xl space-y-3 shadow-3xs col-span-1 md:col-span-2">
                                  <label className="text-[11px] font-extrabold text-gray-900 block">Foi marcada reunião de pré-audiência para o advogado associado? *</label>
                                  <div className="flex gap-2 max-w-md">
                                    {[
                                      { id: 'sim', label: 'Sim ✅' },
                                      { id: 'nao', label: 'Não ⚠️' },
                                      { id: 'n_a', label: 'Não se aplica' }
                                    ].map(opt => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => updateLocalAuditField(item.id, 'reuniaoPreAudiencia', opt.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          itemAuditState.reuniaoPreAudiencia === opt.id 
                                            ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-3xs' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>

                                  {itemAuditState.reuniaoPreAudiencia === 'sim' && (
                                    <div className="p-4 bg-stone-50 border border-gray-200 rounded-xl space-y-4 animate-slide-down mt-2">
                                      <span className="text-[10px] font-mono font-black text-gray-400 uppercase block border-b border-gray-200 pb-1.5">Dados da Reunião de Pré-Audiência</span>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Data *</label>
                                          <input 
                                            type="date"
                                            value={itemAuditState.reuniaoData || ''}
                                            onChange={(e) => updateLocalAuditField(item.id, 'reuniaoData', e.target.value)}
                                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Horário *</label>
                                          <input 
                                            type="time"
                                            value={itemAuditState.reuniaoHora || ''}
                                            onChange={(e) => updateLocalAuditField(item.id, 'reuniaoHora', e.target.value)}
                                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Responsável *</label>
                                          <input 
                                            type="text"
                                            value={itemAuditState.reuniaoResp || ''}
                                            placeholder="Ex: Dr. Silva"
                                            onChange={(e) => updateLocalAuditField(item.id, 'reuniaoResp', e.target.value)}
                                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Local / Link *</label>
                                          <input 
                                            type="text"
                                            value={itemAuditState.reuniaoLocal || ''}
                                            placeholder="Ex: Google Meet"
                                            onChange={(e) => updateLocalAuditField(item.id, 'reuniaoLocal', e.target.value)}
                                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none"
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[10px] font-mono font-black text-gray-400 uppercase block">Observações da Reunião</label>
                                        <textarea
                                          value={itemAuditState.reuniaoObs || ''}
                                          onChange={(e) => updateLocalAuditField(item.id, 'reuniaoObs', e.target.value)}
                                          placeholder="Insira detalhes adicionais sobre o alinhamento da pré-audiência..."
                                          rows={2}
                                          className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none resize-none"
                                        />
                                      </div>

                                      <div className="pt-1">
                                        <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wide block mb-1">Comprovante de Agendamento da Reunião</span>
                                        <div className="flex items-center gap-2">
                                          <label className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-300 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer transition">
                                            <Upload size={12} />
                                            <span>Anexar Comprovante</span>
                                            <input 
                                              type="file" 
                                              onChange={(e) => handleMockFileUpload(item.id, 'reuniaoPreAudiencia', e)}
                                              className="hidden" 
                                            />
                                          </label>
                                          {itemAuditState.reuniaoPreAudienciaFileName && (
                                            <a 
                                              href={itemAuditState.reuniaoPreAudienciaFileUrl} 
                                              target="_blank" 
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-extrabold transition"
                                            >
                                              <FileText size={13} />
                                              <span className="max-w-[150px] truncate">{itemAuditState.reuniaoPreAudienciaFileName}</span>
                                              <ExternalLink size={10} />
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* 6. Roteiro de Perguntas */}
                                <div className="bg-white p-4 border border-gray-150 rounded-2xl space-y-3 shadow-3xs">
                                  <label className="text-[11px] font-extrabold text-gray-900 block">Roteiro de perguntas e cenários está pronto e anexado? *</label>
                                  <div className="flex gap-2">
                                    {[
                                      { id: 'sim', label: 'Sim ✅' },
                                      { id: 'nao', label: 'Não ⚠️' },
                                      { id: 'n_a', label: 'Não se aplica' }
                                    ].map(opt => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => updateLocalAuditField(item.id, 'roteiroPerguntas', opt.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          itemAuditState.roteiroPerguntas === opt.id 
                                            ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-3xs' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="pt-1">
                                    <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wide block mb-1">Anexo do Roteiro</span>
                                    <div className="flex items-center gap-2">
                                      <label className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer transition">
                                        <Upload size={12} />
                                        <span>Anexar Documento</span>
                                        <input 
                                          type="file" 
                                          onChange={(e) => handleMockFileUpload(item.id, 'roteiroPerguntas', e)}
                                          className="hidden" 
                                        />
                                      </label>
                                      {itemAuditState.roteiroPerguntasFileName && (
                                        <a 
                                          href={itemAuditState.roteiroPerguntasFileUrl} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-extrabold transition"
                                        >
                                          <FileText size={13} />
                                          <span className="max-w-[150px] truncate">{itemAuditState.roteiroPerguntasFileName}</span>
                                          <ExternalLink size={10} />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 7. Testemunhas */}
                                <div className="bg-white p-4 border border-gray-150 rounded-2xl space-y-3 shadow-3xs">
                                  <label className="text-[11px] font-extrabold text-gray-900 block">Caso possui testemunhas? *</label>
                                  <div className="flex gap-2">
                                    {[
                                      { id: 'sim', label: 'Sim' },
                                      { id: 'nao', label: 'Não' },
                                      { id: 'confirmar', label: 'A confirmar' }
                                    ].map(opt => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => updateLocalAuditField(item.id, 'possuiTestemunhas', opt.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          itemAuditState.possuiTestemunhas === opt.id 
                                            ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-3xs' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>

                                  {itemAuditState.possuiTestemunhas === 'sim' && (
                                    <div className="p-3 bg-stone-50 border border-gray-150 rounded-xl space-y-3 animate-slide-down mt-2">
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-mono font-black text-gray-400 uppercase block">Testemunhas foram avisadas? *</label>
                                        <div className="flex gap-2">
                                          {[
                                            { id: 'sim', label: 'Sim ✅' },
                                            { id: 'nao', label: 'Não ⚠️' }
                                          ].map(o => (
                                            <button
                                              key={o.id}
                                              type="button"
                                              onClick={() => updateLocalAuditField(item.id, 'testemunhasAvisadas', o.id)}
                                              className={`flex-1 py-1 rounded-lg text-xs font-bold border ${
                                                itemAuditState.testemunhasAvisadas === o.id
                                                  ? 'bg-white border-purple-300 text-purple-700 shadow-3xs'
                                                  : 'bg-stone-100 border-transparent text-gray-500'
                                              }`}
                                            >
                                              {o.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-mono font-black text-gray-400 uppercase block">Termos/Cartas emitidas? *</label>
                                        <div className="flex gap-2">
                                          {[
                                            { id: 'sim', label: 'Sim ✅' },
                                            { id: 'nao', label: 'Não ⚠️' },
                                            { id: 'n_a', label: 'N/A' }
                                          ].map(o => (
                                            <button
                                              key={o.id}
                                              type="button"
                                              onClick={() => updateLocalAuditField(item.id, 'cartasTestemunhas', o.id)}
                                              className={`flex-1 py-1 rounded-lg text-[11px] font-bold border ${
                                                itemAuditState.cartasTestemunhas === o.id
                                                  ? 'bg-white border-purple-300 text-purple-700 shadow-3xs'
                                                  : 'bg-stone-100 border-transparent text-gray-500'
                                              }`}
                                            >
                                              {o.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="pt-1">
                                        <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wide block mb-1">Anexo Cartas de Testemunhas</span>
                                        <div className="flex items-center gap-2">
                                          <label className="flex items-center gap-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-300 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer transition">
                                            <Upload size={11} />
                                            <span>Anexar Cartas</span>
                                            <input 
                                              type="file" 
                                              onChange={(e) => handleMockFileUpload(item.id, 'cartasTestemunhas', e)}
                                              className="hidden" 
                                            />
                                          </label>
                                          {itemAuditState.cartasTestemunhasFileName && (
                                            <a 
                                              href={itemAuditState.cartasTestemunhasFileUrl} 
                                              target="_blank" 
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-extrabold transition"
                                            >
                                              <FileText size={13} />
                                              <span className="max-w-[120px] truncate">{itemAuditState.cartasTestemunhasFileName}</span>
                                              <ExternalLink size={10} />
                                            </a>
                                          )}
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[10px] font-mono font-black text-gray-400 uppercase block">Anotações das Testemunhas</label>
                                        <textarea
                                          value={itemAuditState.testemunhasObs || ''}
                                          onChange={(e) => updateLocalAuditField(item.id, 'testemunhasObs', e.target.value)}
                                          placeholder="Nomes, contatos e observações..."
                                          rows={2}
                                          className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none resize-none"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* 8. Avisos de Agenda */}
                                <div className="bg-white p-4 border border-gray-150 rounded-2xl space-y-3 shadow-3xs">
                                  <label className="text-[11px] font-extrabold text-gray-900 block">Agenda Office avisado? *</label>
                                  <div className="flex gap-2">
                                    {[
                                      { id: 'sim', label: 'Sim ✅' },
                                      { id: 'nao', label: 'Não ⚠️' }
                                    ].map(opt => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => updateLocalAuditField(item.id, 'agendaOfficeAvisado', opt.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          itemAuditState.agendaOfficeAvisado === opt.id 
                                            ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-3xs' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* 9. Cliente Avisado */}
                                <div className="bg-white p-4 border border-gray-150 rounded-2xl space-y-3 shadow-3xs">
                                  <label className="text-[11px] font-extrabold text-gray-900 block">Cliente avisado? *</label>
                                  <div className="flex gap-2">
                                    {[
                                      { id: 'sim', label: 'Sim ✅' },
                                      { id: 'nao', label: 'Não ⚠️' }
                                    ].map(opt => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => updateLocalAuditField(item.id, 'clienteAvisado', opt.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          itemAuditState.clienteAvisado === opt.id 
                                            ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-3xs' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="pt-1">
                                    <span className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-wide block mb-1">Comprovante de Aviso (WhatsApp / E-mail)</span>
                                    <div className="flex items-center gap-2">
                                      <label className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer transition">
                                        <Upload size={12} />
                                        <span>Anexar Print</span>
                                        <input 
                                          type="file" 
                                          onChange={(e) => handleMockFileUpload(item.id, 'clienteAvisado', e)}
                                          className="hidden" 
                                        />
                                      </label>
                                      {itemAuditState.clienteAvisadoFileName && (
                                        <a 
                                          href={itemAuditState.clienteAvisadoFileUrl} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-extrabold transition"
                                        >
                                          <FileText size={13} />
                                          <span className="max-w-[150px] truncate">{itemAuditState.clienteAvisadoFileName}</span>
                                          <ExternalLink size={10} />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 10. Todoist & Google Calendar */}
                                <div className="bg-white p-4 border border-gray-150 rounded-2xl space-y-3 shadow-3xs">
                                  <label className="text-[11px] font-extrabold text-gray-900 block">Audiência cadastrada no Todoist? *</label>
                                  <div className="flex gap-2">
                                    {[
                                      { id: 'sim', label: 'Sim ✅' },
                                      { id: 'nao', label: 'Não ⚠️' },
                                      { id: 'pendente', label: 'Pendente' }
                                    ].map(opt => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => updateLocalAuditField(item.id, 'cadastradaTodoist', opt.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          itemAuditState.cadastradaTodoist === opt.id 
                                            ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-3xs' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="bg-white p-4 border border-gray-150 rounded-2xl space-y-3 shadow-3xs">
                                  <label className="text-[11px] font-extrabold text-gray-900 block">Audiência cadastrada no Google Agenda? *</label>
                                  <div className="flex gap-2">
                                    {[
                                      { id: 'sim', label: 'Sim ✅' },
                                      { id: 'nao', label: 'Não ⚠️' },
                                      { id: 'pendente', label: 'Pendente' }
                                    ].map(opt => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => updateLocalAuditField(item.id, 'cadastradaGoogle', opt.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          itemAuditState.cadastradaGoogle === opt.id 
                                            ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-3xs' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* 11. Conflito */}
                                <div className="bg-white p-4 border border-gray-150 rounded-2xl space-y-3 shadow-3xs col-span-1 md:col-span-2">
                                  <label className="text-[11px] font-extrabold text-gray-900 block">Conferência de conflito de audiência realizada? *</label>
                                  <div className="flex gap-2 max-w-md">
                                    {[
                                      { id: 'sim', label: 'Sim ✅' },
                                      { id: 'nao', label: 'Não ⚠️' },
                                      { id: 'conflito', label: 'Conflito identificado' }
                                    ].map(opt => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => updateLocalAuditField(item.id, 'conferenciaConflito', opt.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          itemAuditState.conferenciaConflito === opt.id 
                                            ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-3xs' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>

                                  {itemAuditState.conferenciaConflito === 'conflito' && (
                                    <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl space-y-2 font-medium animate-slide-down mt-2">
                                      <p className="font-extrabold flex items-center gap-1">
                                        <AlertCircle size={14} className="text-red-500 shrink-0" />
                                        <span>⚠️ Alerta: Conflito de agenda identificado para este cliente!</span>
                                      </p>
                                      <p className="text-[11px] text-red-700">Verifique os horários das outras sessões ativas e use a funcionalidade de remarcação se necessário.</p>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsConflictModalOpen(true);
                                        }}
                                        className="mt-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer transition"
                                      >
                                        Analisar Conflito
                                      </button>
                                    </div>
                                  )}
                                </div>

                              </div>

                              {/* HISTÓRICO DE DELEGAÇÕES NA AUDITORIA */}
                              <div className="bg-white p-5 border border-gray-150 rounded-2xl space-y-3.5 shadow-3xs text-left">
                                <span className="text-[10px] font-mono font-black text-purple-600 uppercase tracking-widest block">Histórico de Delegações Operacionais</span>
                                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                                  {(!item.delegationHistory || item.delegationHistory.length === 0) ? (
                                    <p className="text-xs text-gray-400 italic">Nenhuma delegação operacional registrada para esta audiência ainda.</p>
                                  ) : (
                                    item.delegationHistory.map((hist: any, index: number) => (
                                      <div key={hist.id || index} className="p-3 bg-stone-50 border border-stone-150 rounded-xl text-xs space-y-1.5 leading-relaxed">
                                        <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono">
                                          <span>{new Date(hist.timestamp).toLocaleString('pt-BR')}</span>
                                          <span className="font-extrabold text-purple-600">Por: {hist.user}</span>
                                        </div>
                                        <p className="font-extrabold text-gray-900">
                                          Responsável definido: <span className="text-purple-700">{hist.responsavel}</span>
                                          {hist.advogadoAssociado && ` - ${hist.advogadoAssociado}`}
                                          {hist.responsavelInternoNome && ` - ${hist.responsavelInternoNome} (${hist.responsavelInternoFuncao})`}
                                        </p>
                                        <p className="text-[10.5px] text-red-600 font-semibold">{hist.pendencias}</p>
                                        {hist.observacoes && (
                                          <p className="text-[10.5px] text-gray-600 bg-white p-2 rounded-lg border border-gray-100">
                                            <strong>Obs:</strong> "{hist.observacoes}"
                                          </p>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* ALERTA DE PENDENCIAS */}
                              {criticalPendings.length > 0 ? (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-950 space-y-2">
                                  <p className="font-black uppercase tracking-wider text-[11px] text-red-800 flex items-center gap-1.5">
                                    <ShieldAlert size={15} className="text-red-600" />
                                    <span>⚠️ Auditoria de audiência com pendências críticas</span>
                                  </p>
                                  <ul className="list-disc pl-5 space-y-1 font-semibold text-red-900">
                                    {criticalPendings.map((p, idx) => (
                                      <li key={idx}>{p}</li>
                                    ))}
                                  </ul>
                                  <p className="text-[10px] text-red-600 font-extrabold italic pt-1">O salvamento total como concluído está bloqueado até que todas as pendências críticas sejam sanadas.</p>
                                </div>
                              ) : (
                                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 flex items-center gap-2">
                                  <CheckCircle2 size={16} className="text-emerald-600" />
                                  <span className="font-extrabold">✅ Auditoria de audiência concluída! Todos os atos internos fáticos foram devidamente validados.</span>
                                </div>
                              )}

                              {/* SAVE BUTTON */}
                              <div className="flex justify-end gap-3 pt-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveAudit(item.id)}
                                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider font-mono rounded-xl cursor-pointer shadow-3xs transition-all"
                                >
                                  {criticalPendings.length > 0 ? 'Salvar Rascunho da Auditoria 💾' : 'Concluir Auditoria ✅'}
                                </button>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QUICK ACTIONS BUTTONS BLOCK */}
      {type === 'audiencia' && (
        <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
          <div className="border-b border-gray-100 pb-2.5">
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">Ações Rápidas de Agenda</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
            <button
              type="button"
              onClick={() => {
                setShowForm(true);
                setLocalLogs(prev => [
                  {
                    timestamp: new Date().toISOString(),
                    action: 'Clique em "Cadastrar audiência"',
                    details: 'Formulário de agendamento de nova audiência ativado.',
                    status: 'info'
                  },
                  ...prev
                ]);
                window.scrollTo({ top: 300, behavior: 'smooth' });
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-150 hover:border-indigo-300 text-indigo-700 font-extrabold rounded-2xl text-xs transition cursor-pointer shadow-3xs hover:bg-indigo-100/50"
            >
              <Plus size={14} className="stroke-[2.5]" />
              <span>Cadastrar audiência</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsConflictModalOpen(true);
                setLocalLogs(prev => [
                  {
                    timestamp: new Date().toISOString(),
                    action: 'Clique em "Resolver conflito de audiência"',
                    details: 'Janela de diagnóstico de conflitos de agenda iniciada.',
                    status: 'info'
                  },
                  ...prev
                ]);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 border border-amber-150 hover:border-amber-300 text-amber-700 font-extrabold rounded-2xl text-xs transition cursor-pointer shadow-3xs hover:bg-amber-100/50"
            >
              <ShieldAlert size={14} className="stroke-[2.5]" />
              <span>Resolver conflito de audiência</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsCancelModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 border border-rose-150 hover:border-rose-300 text-rose-700 font-extrabold rounded-2xl text-xs transition cursor-pointer shadow-3xs hover:bg-rose-100/50"
            >
              <X size={14} className="stroke-[2.5]" />
              <span>Cancelar audiência marcada</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRemarcarModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border border-blue-150 hover:border-blue-300 text-blue-700 font-extrabold rounded-2xl text-xs transition cursor-pointer shadow-3xs hover:bg-blue-100/50"
            >
              <RefreshCw size={13} className="stroke-[2.5]" />
              <span>Remarcar audiência</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const now = new Date().toISOString();
                setLocalLogs(prev => [
                  {
                    timestamp: now,
                    action: 'Clique em "Delegador de audiências"',
                    details: 'Painel do Delegador de Audiências selecionado.',
                    status: 'info'
                  },
                  ...prev
                ]);
                setIsDelegadorModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 border border-purple-150 hover:border-purple-300 text-purple-700 font-extrabold rounded-2xl text-xs transition cursor-pointer shadow-3xs hover:bg-purple-100/50"
            >
              <Users size={14} className="stroke-[2.5]" />
              <span>Delegador de audiências</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW 4 ADDITIONAL SECTIONS: HISTORICO & LOG TECNICO */}
      {type === 'audiencia' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* SECTION 5: HISTÓRICO DE AUDIÊNCIAS */}
          <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
            <div className="border-b border-gray-100 pb-3 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                <Notebook size={14} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase text-gray-950 tracking-wider font-mono">Histórico de Audiências</h4>
                <p className="text-[10px] text-gray-400 font-semibold">Memória de alterações, remarcações e cancelamentos fáticos.</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {allHearingsHistory.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl text-gray-400 text-xs font-semibold">
                  Ainda não há lançamentos de histórico para as audiências deste cliente.
                </div>
              ) : (
                allHearingsHistory.map((item: any, idx: number) => (
                  <div key={idx} className="p-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase font-mono ${
                        item.type === 'cancelada' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.type}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono font-bold">
                        {new Date(item.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="font-extrabold text-gray-900">{item.eventTitle}</p>
                    <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-gray-500">
                      <div>Data Original: <strong className="text-gray-700">{item.dateOriginal ? new Date(item.dateOriginal).toLocaleDateString('pt-BR') : '—'}</strong></div>
                      {item.dateNew && (
                        <div>Nova Data: <strong className="text-indigo-600">{new Date(item.dateNew).toLocaleDateString('pt-BR')}</strong></div>
                      )}
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-gray-200 text-[10.5px]">
                      <span className="font-bold text-gray-400 font-mono text-[9px] block uppercase">Motivo:</span>
                      <p className="font-semibold text-gray-700 italic mt-0.5">"{item.reason}"</p>
                    </div>
                    <div className="text-[9.5px] font-mono text-gray-400">Responsável: {item.user} | Google: {item.googleStatus}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 6: LOG TÉCNICO COMPARTILHADO */}
          <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gray-950 text-emerald-400 flex items-center justify-center font-mono text-[10px] font-black">
                  &gt;_
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-gray-950 tracking-wider font-mono">Log Técnico do Organizador de Audiências — Google Calendar</h4>
                  <p className="text-[10px] text-gray-400 font-semibold">Auditoria técnica de requisições, eventos e integrações de API.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLocalLogs(prev => [
                    {
                      timestamp: new Date().toISOString(),
                      action: 'Console limpo',
                      details: 'Logs recentes da sessão limpos pelo operador.',
                      status: 'info'
                    }
                  ]);
                }}
                className="text-[9px] font-bold font-mono uppercase bg-gray-100 text-gray-500 hover:bg-gray-200 px-2 py-1 rounded transition cursor-pointer"
              >
                Limpar
              </button>
            </div>

            <div className="bg-gray-950 rounded-2xl p-4 font-mono text-[10.5px] text-gray-300 max-h-[300px] overflow-y-auto space-y-2.5 shadow-inner border border-gray-900 scrollbar-thin">
              {mergedLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-600 italic">
                  &lt; Nenhum log técnico registrado na pilha de auditoria &gt;
                </div>
              ) : (
                mergedLogs.map((log: any, idx: number) => (
                  <div key={idx} className="border-b border-gray-900/60 pb-2 last:border-0 leading-relaxed">
                    <div className="flex items-center gap-2 text-[9px]">
                      <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString('pt-BR')}]</span>
                      <span className={`font-black uppercase tracking-wide ${
                        log.status === 'sucesso' ? 'text-emerald-400' : log.status === 'erro' ? 'text-rose-400' : 'text-blue-400'
                      }`}>
                        {log.action}
                      </span>
                      <span className="text-gray-600 font-sans font-bold">({log.eventTitle || 'Geral'})</span>
                    </div>
                    <p className="text-gray-300 mt-0.5 pl-2">{log.details}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================= MODALS ========================================= */}

      {/* 1. RESOLVER CONFLITO MODAL */}
      {isConflictModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-gray-150 rounded-[2rem] max-w-md w-full overflow-hidden shadow-2xl flex flex-col animate-scale-up">
            <div className="bg-stone-50 border-b border-gray-100 px-6 py-5 flex items-start justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase text-gray-900 tracking-wider font-mono">Resolução de Conflitos</h4>
                  <p className="text-[10px] text-gray-500 font-semibold">Diagnóstico assistido de conciliação de horários.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsConflictModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl text-xs font-semibold text-amber-950 text-center leading-relaxed space-y-2">
                <p>Nenhum conflito de audiência identificado para este cliente.</p>
                <p className="text-[10.5px] text-amber-700 font-bold">Funcionalidade futura para análise e resolução assistida de conflitos de audiência.</p>
              </div>
            </div>

            <div className="bg-stone-50 border-t border-gray-100 px-6 py-4 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsConflictModalOpen(false)}
                className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-extrabold rounded-xl transition text-xs cursor-pointer shadow-3xs"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CANCELAR AUDIENCIA MODAL */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-gray-150 rounded-[2rem] max-w-lg w-full overflow-hidden shadow-2xl flex flex-col animate-scale-up">
            <div className="bg-red-50 border-b border-red-100 px-6 py-5 flex items-start gap-3.5 shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertCircle size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase text-red-900 tracking-wider font-sans leading-tight">
                  Alerta Obrigatório de Cancelamento
                </h4>
                <p className="text-[11px] text-red-700 font-semibold mt-0.5">
                  ⚠️ Atenção: você está prestes a cancelar uma audiência marcada. Essa ação poderá impactar a agenda do escritório e o acompanhamento do cliente. Deseja prosseguir?
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              
              {/* Select event to cancel */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Selecione a Audiência fática *</label>
                <select
                  value={selectedEventToCancel}
                  onChange={(e) => setSelectedEventToCancel(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
                >
                  <option value="">Selecione uma audiência...</option>
                  {eventsOfThisType.filter(e => e.status !== 'cancelado').map(e => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.date ? new Date(e.date).toLocaleDateString('pt-BR') : 'Sem data'} às {e.time || '—'})
                    </option>
                  ))}
                </select>
                {eventsOfThisType.filter(e => e.status !== 'cancelado').length === 0 && (
                  <p className="text-[10px] text-red-500 font-semibold italic mt-0.5">Não há nenhuma audiência ativa cadastrada para ser cancelada.</p>
                )}
              </div>

              {/* Cancel Justification (Motivo) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Motivo do cancelamento (Obrigatório) *</label>
                <textarea
                  rows={3}
                  value={cancelJustification}
                  onChange={(e) => setCancelJustification(e.target.value)}
                  placeholder="Justifique fundamentadamente o motivo do cancelamento operacional deste ato processual fático..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:bg-white rounded-2xl text-xs font-semibold text-gray-800 transition outline-none resize-none"
                />
              </div>

              <div className="bg-gray-50 p-3.5 border border-gray-150 rounded-xl text-[10.5px] text-gray-500 leading-normal">
                <p className="font-extrabold text-gray-700">Políticas Internas Giffoni:</p>
                <p className="mt-0.5">O cancelamento de atos de audiência exige registro em log para conformidade regulatória do portal CRM e histórico jurídico.</p>
              </div>

            </div>

            <div className="bg-stone-50 border-t border-gray-100 px-6 py-4 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setSelectedEventToCancel('');
                  setCancelJustification('');
                }}
                className="px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold rounded-xl text-xs cursor-pointer"
              >
                Não cancelar
              </button>
              <button
                type="button"
                disabled={!selectedEventToCancel || cancelJustification.trim().length < 5}
                onClick={handleCancelEventConfirmed}
                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold px-5 py-2.5 rounded-xl transition text-xs cursor-pointer shadow-3xs disabled:opacity-50"
              >
                <span>Sim, cancelar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. REMARCAR AUDIENCIA MODAL */}
      {isRemarcarModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-gray-150 rounded-[2rem] max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-scale-up">
            
            <div className="bg-blue-50 border-b border-blue-100 px-6 py-5 flex items-start gap-3.5 shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <AlertCircle size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase text-blue-950 tracking-wider font-sans leading-tight">
                  Alerta Obrigatório de Remarcação
                </h4>
                <p className="text-[11px] text-blue-700 font-semibold mt-0.5">
                  ⚠️ Atenção: você está prestes a remarcar uma audiência. Confirme os novos dados antes de prosseguir.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              
              {/* Select event to reschedule */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Selecione a Audiência a ser remarcada *</label>
                <select
                  value={selectedEventToRemarcar}
                  onChange={(e) => {
                    setSelectedEventToRemarcar(e.target.value);
                    const selectedEv = eventsOfThisType.find(ev => ev.id === e.target.value);
                    if (selectedEv) {
                      setNewRemarcarLocation(selectedEv.location || '');
                      setNewRemarcarDesc(selectedEv.description || '');
                    }
                  }}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
                >
                  <option value="">Selecione uma audiência...</option>
                  {eventsOfThisType.filter(e => e.status !== 'cancelado').map(e => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.date ? new Date(e.date).toLocaleDateString('pt-BR') : 'Sem data'} às {e.time || '—'})
                    </option>
                  ))}
                </select>
                {eventsOfThisType.filter(e => e.status !== 'cancelado').length === 0 && (
                  <p className="text-[10px] text-red-500 font-semibold italic mt-0.5">Não há nenhuma audiência cadastrada para ser remarcada.</p>
                )}
              </div>

              {/* New Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Nova Data (Obrigatória) *</label>
                  <input
                    type="date"
                    required
                    value={newRemarcarDate}
                    onChange={(e) => setNewRemarcarDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Novo Horário Inicial (Obrigatório) *</label>
                  <input
                    type="time"
                    required
                    value={newRemarcarTime}
                    onChange={(e) => { setNewEventTime(e.target.value); setNewRemarcarTime(e.target.value); }}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Duração Estimada ou Horário Final *</label>
                  <input
                    type="text"
                    required
                    value={newRemarcarDuration}
                    onChange={(e) => setNewRemarcarDuration(e.target.value)}
                    placeholder="Ex: 1 hora, 15:30"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Novo Local / Link de Acesso</label>
                  <input
                    type="text"
                    value={newRemarcarLocation}
                    onChange={(e) => setNewRemarcarLocation(e.target.value)}
                    placeholder="Link do Teams, sala do fórum..."
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Justification of reschedule */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase">Motivo da remarcação (Obrigatório) *</label>
                <textarea
                  rows={2}
                  value={remarcarJustification}
                  onChange={(e) => setRemarcarJustification(e.target.value)}
                  placeholder="Justifique detalhadamente por que o ato está sendo remarcado faticamente..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:bg-white rounded-2xl text-xs font-semibold text-gray-800 transition outline-none resize-none"
                />
              </div>

              {/* Google integration warning state */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-[10.5px] text-stone-500 font-mono">
                <span className="font-extrabold text-stone-700">Status Google Calendar:</span>
                <p className="mt-0.5">A consulta automática de conflitos será disparada antes da confirmação real.</p>
              </div>

            </div>

            <div className="bg-stone-50 border-t border-gray-100 px-6 py-4 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsRemarcarModalOpen(false);
                  setSelectedEventToRemarcar('');
                  setRemarcarJustification('');
                  setNewRemarcarDate('');
                  setNewRemarcarTime('');
                  setNewRemarcarLocation('');
                  setNewRemarcarDesc('');
                }}
                className="px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold rounded-xl text-xs cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={checkingCalendarLocal || !selectedEventToRemarcar || !newRemarcarDate || !newRemarcarTime || remarcarJustification.trim().length < 5}
                onClick={handleRemarcarEventConfirmed}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-5 py-2.5 rounded-xl transition text-xs cursor-pointer shadow-3xs disabled:opacity-50"
              >
                {checkingCalendarLocal ? <RefreshCw size={12} className="animate-spin" /> : null}
                <span>Confirmar Remarcação</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. DELEGADOR DE AUDIENCIAS MODAL */}
      {isDelegadorModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-gray-150 rounded-[2rem] max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-scale-up text-left">
            
            <div className="bg-purple-50 border-b border-purple-100 px-6 py-5 flex items-start gap-3.5 shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <Users size={20} className="stroke-[2.5]" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black uppercase text-purple-950 tracking-wider font-sans leading-tight">
                  Delegador de audiências
                </h4>
                <p className="text-[11px] text-purple-700 font-semibold mt-0.5">
                  Delegue operacionalmente a audiência fática e atualize a Auditoria do ato.
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsDelegadorModalOpen(false);
                  setSelectedEventToDelegate('');
                }}
                className="text-gray-400 hover:text-gray-600 transition p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              
              {/* Select event to delegate */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-black text-gray-400 uppercase block">Selecione a Audiência fática *</label>
                <select
                  value={selectedEventToDelegate}
                  onChange={(e) => setSelectedEventToDelegate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none transition"
                >
                  <option value="">Selecione uma audiência...</option>
                  {eventsOfThisType.filter(e => e.status !== 'cancelado').map(e => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.date ? new Date(e.date).toLocaleDateString('pt-BR') : 'Sem data'} às {e.time || '—'})
                    </option>
                  ))}
                </select>
                {eventsOfThisType.filter(e => e.status !== 'cancelado').length === 0 && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl mt-1">
                    ⚠️ Nenhuma audiência cadastrada para delegar.
                  </div>
                )}
              </div>

              {selectedEventToDelegate && (
                <>
                  {/* Dynamic Real-time Warnings Block */}
                  {(() => {
                    const selectedEv = eventsOfThisType.find(e => e.id === selectedEventToDelegate);
                    if (!selectedEv) return null;
                    
                    const alerts: string[] = [];
                    if (!delegateResponsavel) {
                      alerts.push("⚠️ Audiência sem responsável definido.");
                    } else if (delegateResponsavel === 'associado') {
                      if (delegateSubstJuntado === 'nao') {
                        alerts.push("⚠️ Advogado associado definido, mas substabelecimento com reserva de poderes ainda não foi juntado.");
                      }
                      if (delegateApresentadoAssociado === 'nao') {
                        alerts.push("⚠️ Cliente ainda não foi apresentado ao advogado associado.");
                      }
                      if (delegateReuniaoPreAudiencia === 'nao') {
                        alerts.push("⚠️ Reunião de pré-audiência ainda não marcada para o advogado associado.");
                      }
                    }

                    if (alerts.length === 0) return null;

                    return (
                      <div className="space-y-2 p-3 bg-amber-50/75 border border-amber-150 rounded-2xl">
                        <span className="text-[9px] font-mono font-black text-amber-800 uppercase tracking-wider block">Alertas Operacionais:</span>
                        {alerts.map((alertText, idx) => (
                          <div key={idx} className="text-[10.5px] font-bold text-amber-900 leading-tight">
                            {alertText}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Responsável Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono font-black text-gray-400 uppercase block">Responsável pela audiência *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'ceo', label: 'CEO' },
                        { id: 'associado', label: 'Advogado Associado' },
                        { id: 'interno', label: 'Responsável Interno' }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDelegateResponsavel(opt.id as any)}
                          className={`py-2 px-3 rounded-xl text-xs font-black transition border text-center cursor-pointer ${
                            delegateResponsavel === opt.id 
                              ? 'bg-purple-600 border-purple-600 text-white shadow-3xs' 
                              : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Conditional Section: ADVOGADO ASSOCIADO */}
                  {delegateResponsavel === 'associado' && (
                    <div className="p-4 bg-purple-50/40 border border-purple-100 rounded-2xl space-y-4 animate-slide-down">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono font-black text-purple-700 uppercase block">Qual advogado associado? *</label>
                        <input
                          type="text"
                          required
                          value={delegateAdvogadoAssociadoNome}
                          onChange={(e) => setDelegateAdvogadoAssociadoNome(e.target.value)}
                          placeholder="Digite o nome completo do advogado associado..."
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:border-purple-400 focus:outline-none transition"
                        />
                      </div>

                      {/* Checklists for associate */}
                      <div className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                          <label className="text-[10.5px] font-bold text-gray-800 block">Substabelecimento com reserva de poderes foi juntado? *</label>
                          <div className="flex gap-2">
                            {[{ id: 'sim', label: 'Sim ✅' }, { id: 'nao', label: 'Não ❌' }].map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setDelegateSubstJuntado(opt.id as any)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                                  delegateSubstJuntado === opt.id 
                                    ? 'bg-purple-600 border-purple-600 text-white shadow-3xs' 
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10.5px] font-bold text-gray-800 block">Cliente foi apresentado ao advogado associado? *</label>
                          <div className="flex gap-2">
                            {[{ id: 'sim', label: 'Sim ✅' }, { id: 'nao', label: 'Não ❌' }].map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setDelegateApresentadoAssociado(opt.id as any)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                                  delegateApresentadoAssociado === opt.id 
                                    ? 'bg-purple-600 border-purple-600 text-white shadow-3xs' 
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10.5px] font-bold text-gray-800 block">Foi marcada reunião de pré-audiência para o advogado associado? *</label>
                          <div className="flex gap-2">
                            {[{ id: 'sim', label: 'Sim ✅' }, { id: 'nao', label: 'Não ❌' }].map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setDelegateReuniaoPreAudiencia(opt.id as any)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                                  delegateReuniaoPreAudiencia === opt.id 
                                    ? 'bg-purple-600 border-purple-600 text-white shadow-3xs' 
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Pending alarm alert banner */}
                      {(delegateSubstJuntado === 'nao' || delegateApresentadoAssociado === 'nao' || delegateReuniaoPreAudiencia === 'nao') && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 space-y-1 mt-2">
                          <p className="font-black uppercase tracking-wider text-[10px] text-red-800">⚠️ Delegação com pendências operacionais</p>
                          <p className="text-[10.5px] text-red-700 leading-normal">
                            A delegação pode ser registrada, mas a Auditoria da Audiência não deve ser marcada como concluída enquanto houver pendências críticas.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Conditional Section: OUTRO RESPONSÁVEL INTERNO */}
                  {delegateResponsavel === 'interno' && (
                    <div className="p-4 bg-amber-50/30 border border-amber-200 rounded-2xl space-y-3.5 animate-slide-down">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono font-black text-amber-800 uppercase block">Nome do responsável interno *</label>
                        <input
                          type="text"
                          required
                          value={delegateResponsavelInternoNome}
                          onChange={(e) => setDelegateResponsavelInternoNome(e.target.value)}
                          placeholder="Ex: Dra. Maria Clara Silva..."
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:border-amber-400 focus:outline-none transition"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono font-black text-amber-800 uppercase block">Função do responsável interno na audiência *</label>
                        <input
                          type="text"
                          required
                          value={delegateResponsavelInternoFuncao}
                          onChange={(e) => setDelegateResponsavelInternoFuncao(e.target.value)}
                          placeholder="Ex: Advogada Substituta, Assistente Jurídico..."
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:border-amber-400 focus:outline-none transition"
                        />
                      </div>

                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                        <p className="font-extrabold">⚠️ Confirme se o responsável interno possui atribuição adequada para o ato de audiência.</p>
                        <p className="text-[10.5px] text-amber-700 leading-normal">
                          Essa escolha não substitui a definição do advogado responsável, salvo se o responsável interno for advogado habilitado e isso for indicado.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Observações Internas */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-black text-gray-400 uppercase block">Observações internas *</label>
                    <textarea
                      rows={2}
                      value={delegateObservacoes}
                      onChange={(e) => setDelegateObservacoes(e.target.value)}
                      placeholder="Adicione observações operacionais relativas a esta delegação..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none transition resize-none"
                    />
                  </div>

                  {/* Confirmação da delegação */}
                  <div className="flex items-center gap-3 bg-purple-50/50 p-3.5 border border-purple-100 rounded-2xl">
                    <input
                      id="delegateConfirmCheck"
                      type="checkbox"
                      checked={delegateConfirmado}
                      onChange={(e) => setDelegateConfirmado(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-gray-300 cursor-pointer"
                    />
                    <label htmlFor="delegateConfirmCheck" className="text-xs font-bold text-purple-950 cursor-pointer selection:bg-transparent select-none">
                      Confirmação da delegação operacional e atualização da auditoria *
                    </label>
                  </div>
                </>
              )}

            </div>

            <div className="bg-stone-50 border-t border-gray-100 px-6 py-4 flex justify-between items-center shrink-0">
              <span className="text-[10px] font-mono font-bold text-gray-400">Todoist: Integração Todoist pendente</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDelegadorModalOpen(false);
                    setSelectedEventToDelegate('');
                  }}
                  className="px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={
                    !selectedEventToDelegate || 
                    !delegateResponsavel || 
                    !delegateConfirmado ||
                    (delegateResponsavel === 'associado' && !delegateAdvogadoAssociadoNome.trim()) ||
                    (delegateResponsavel === 'interno' && (!delegateResponsavelInternoNome.trim() || !delegateResponsavelInternoFuncao.trim()))
                  }
                  onClick={handleConfirmDelegate}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-5 py-2.5 rounded-xl transition text-xs cursor-pointer shadow-3xs disabled:opacity-50"
                >
                  <span>Confirmar Delegação</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
