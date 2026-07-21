import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  Save,
  Clock,
  Users,
  Search,
  Sparkles,
  Terminal,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info
} from 'lucide-react';

interface AgendaSecretariaData {
  schedulerResponsible: string;
  scheduleType: 'estruturacao' | 'revisao' | 'estruturacao_revisao';
  suggestedDate: string;
  suggestedTime: string;
  estimatedDuration: string;
  priority: 'baixa' | 'media' | 'alta';
  secretariaNotes: string;
  scheduleStatus: 'pendente' | 'solicitado' | 'agendado' | 'reagendado' | 'concluido' | 'cancelado';
  responsibleUser: string;
  protocolUser: string;
  protocolDate: string;
  reviewerUser: string;
  projectId: string;
  projectName: string;
  todoistParentTaskId: string;
  isProtocolDateCustomized: boolean;
  todoistPayload: any;
  todoistLogs: string[];
}

const TEAM_MEMBERS = [
  'Dr. Arthur Giffoni',
  'Dra. Mariana Vasconcelos',
  'Dr. Ricardo Rodrigues',
  'Dra. Beatriz Ramos',
  'Dr. Carlos Eduardo'
];

const CASCADE_REVISORS: { [key: string]: string } = {
  'Dr. Arthur Giffoni': 'Dra. Mariana Vasconcelos',
  'Dra. Mariana Vasconcelos': 'Dr. Arthur Giffoni',
  'Dr. Ricardo Rodrigues': 'Dra. Beatriz Ramos',
  'Dra. Beatriz Ramos': 'Dr. Arthur Giffoni',
  'Dr. Carlos Eduardo': 'Dra. Beatriz Ramos'
};

const PROJECT_SUGGESTIONS: { [key: string]: { id: string; name: string } } = {
  'Dr. Arthur Giffoni': { id: 'p_101', name: '@Giffoni - Contencioso Geral' },
  'Dra. Mariana Vasconcelos': { id: 'p_103', name: '@Giffoni - Direito de Família' },
  'Dr. Ricardo Rodrigues': { id: 'p_102', name: '@Giffoni - Planejamento Previdenciário' },
  'Dra. Beatriz Ramos': { id: 'p_104', name: '@Giffoni - Trabalhista e Previdenciário' },
  'Dr. Carlos Eduardo': { id: 'p_105', name: '@Giffoni - Administrativo e Contratos' }
};

const ALL_MOCK_PROJECTS = [
  { id: 'p_101', name: '@Giffoni - Contencioso Geral' },
  { id: 'p_102', name: '@Giffoni - Planejamento Previdenciário' },
  { id: 'p_103', name: '@Giffoni - Direito de Família' },
  { id: 'p_104', name: '@Giffoni - Trabalhista e Previdenciário' },
  { id: 'p_105', name: '@Giffoni - Administrativo e Contratos' },
  { id: 'p_106', name: '@Giffoni - Tributário' },
  { id: 'p_107', name: '@Giffoni - Penal e Defesa' }
];

const SECRETARIA_USERS = [
  'Secretaria Executiva RGR',
  'Ana Carolina (Gestora Comercial)',
  'Felipe Santos (Atendimento)',
  'Mariana Vasconcelos'
];

const calculateSuggestedDate = (priority: 'baixa' | 'media' | 'alta'): string => {
  const today = new Date();
  let daysToAdd = 30;
  if (priority === 'media') daysToAdd = 15;
  if (priority === 'alta') daysToAdd = 5;
  
  today.setDate(today.getDate() + daysToAdd);
  return today.toISOString().split('T')[0];
};

const DEFAULT_AGENDA: AgendaSecretariaData = {
  schedulerResponsible: SECRETARIA_USERS[0],
  scheduleType: 'estruturacao',
  suggestedDate: calculateSuggestedDate('baixa'),
  suggestedTime: '09:00',
  estimatedDuration: '02:00',
  priority: 'baixa',
  secretariaNotes: '',
  scheduleStatus: 'pendente',
  responsibleUser: TEAM_MEMBERS[0],
  protocolUser: TEAM_MEMBERS[0],
  protocolDate: calculateSuggestedDate('baixa'),
  reviewerUser: CASCADE_REVISORS[TEAM_MEMBERS[0]],
  projectId: PROJECT_SUGGESTIONS[TEAM_MEMBERS[0]].id,
  projectName: PROJECT_SUGGESTIONS[TEAM_MEMBERS[0]].name,
  todoistParentTaskId: '',
  isProtocolDateCustomized: false,
  todoistPayload: null,
  todoistLogs: []
};

export default function AgendamentoRevisao() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [agenda, setAgenda] = useState<AgendaSecretariaData>(DEFAULT_AGENDA);

  const [projectSearch, setProjectSearch] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  useEffect(() => {
    if (!caseId) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const caseRef = doc(db, 'cases', caseId!);
        const caseSnap = await getDoc(caseRef);

        if (!caseSnap.exists()) {
          setError(`Caso de ID [${caseId}] não encontrado.`);
          setLoading(false);
          return;
        }

        const cData = caseSnap.data();
        setCaseObj(cData);

        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            setClient(clientSnap.data());
          }
        }

        const rawAgenda = cData.agendaSecretaria || {};
        const mergedAgenda: AgendaSecretariaData = {
          ...DEFAULT_AGENDA,
          ...rawAgenda,
          todoistParentTaskId: rawAgenda.todoistParentTaskId || cData.todoistTaskId || cData.todoistParentTaskId || ''
        };
        if (!mergedAgenda.suggestedDate) {
          mergedAgenda.suggestedDate = calculateSuggestedDate(mergedAgenda.priority);
        }
        if (!mergedAgenda.protocolDate && mergedAgenda.suggestedDate) {
          mergedAgenda.protocolDate = mergedAgenda.suggestedDate;
        }
        setAgenda(mergedAgenda);

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados de agendamento: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  const handleAgendaFieldChange = (field: keyof AgendaSecretariaData, value: any) => {
    setAgenda((prev) => {
      const updated = { ...prev, [field]: value };
      
      if (field === 'responsibleUser') {
        updated.protocolUser = value;
        if (CASCADE_REVISORS[value]) {
          updated.reviewerUser = CASCADE_REVISORS[value];
        } else {
          updated.reviewerUser = TEAM_MEMBERS[0];
        }
        if (PROJECT_SUGGESTIONS[value]) {
          updated.projectId = PROJECT_SUGGESTIONS[value].id;
          updated.projectName = PROJECT_SUGGESTIONS[value].name;
        }
      }

      if (field === 'suggestedDate') {
        if (!prev.isProtocolDateCustomized) {
          updated.protocolDate = value;
        }
      }

      if (field === 'protocolDate') {
        updated.isProtocolDateCustomized = true;
      }

      return updated;
    });
  };

  const handleAgendaPriorityChange = (priority: 'baixa' | 'media' | 'alta') => {
    const updatedDate = calculateSuggestedDate(priority);
    setAgenda((prev) => {
      const updated = {
        ...prev,
        priority,
        suggestedDate: updatedDate
      };
      if (!prev.isProtocolDateCustomized) {
        updated.protocolDate = updatedDate;
      }
      return updated;
    });
  };

  const handlePrepareTodoist = () => {
    const createdBy = localStorage.getItem('boss_user_email') || 'direito.rgr@gmail.com';
    const commentsEsc = `Estruturar o caso vinculado ao case_id: ${caseId}. Conferir dados do cliente, modalidade da demanda, documentos solicitados, riscos, pedidos, competência e estratégia processual. Após finalizar, atualizar o BOSS e sinalizar para revisão.`;
    const commentsRev = `Revisar a estruturação vinculada ao case_id: ${caseId}. Conferir coerência jurídica, documentos, dados cadastrais, pedidos, competência, riscos e aptidão para protocolo. Em caso de ressalvas, preencher instruções objetivas no BOSS.`;

    let commentsTemplate = '';
    if (agenda.scheduleType === 'estruturacao') {
      commentsTemplate = commentsEsc;
    } else if (agenda.scheduleType === 'revisao') {
      commentsTemplate = commentsRev;
    } else {
      commentsTemplate = `ESTRUTURAÇÃO: ${commentsEsc}\n\nREVISÃO: ${commentsRev}`;
    }

    const payload = {
      caseId: caseId || '',
      todoistParentTaskId: agenda.todoistParentTaskId || caseObj?.todoistTaskId || caseObj?.todoistParentTaskId || 'task_main_id_placeholder',
      taskType: agenda.scheduleType,
      title: `[Secretaria] ${agenda.scheduleType === 'estruturacao_revisao' ? 'Estruturação e Revisão' : agenda.scheduleType === 'estruturacao' ? 'Estruturação' : 'Revisão'} - Caso #${caseId}`,
      responsibleUser: agenda.responsibleUser,
      reviewerUser: agenda.reviewerUser,
      dueDate: agenda.suggestedDate,
      priority: agenda.priority,
      projectId: agenda.projectId,
      commentsTemplate,
      createdBy,
      createdAt: new Date().toISOString()
    };

    const logs = [
      `[${new Date().toLocaleTimeString()}] ✔ Tarefa principal vinculada ao case_id [${caseId}] localizada com sucesso no Todoist corporativo.`,
      `[${new Date().toLocaleTimeString()}] ✔ Subtarefa do tipo "${agenda.scheduleType === 'estruturacao_revisao' ? 'Estruturação & Revisão' : agenda.scheduleType}" estruturada e preparada na fila do microsserviço.`,
      `[${new Date().toLocaleTimeString()}] ✔ Projeto Todoist "${agenda.projectName || 'Não informado'}" (ID: ${agenda.projectId || 'N/A'}) selecionado de forma inteligente pelo BOSS.`,
      `[${new Date().toLocaleTimeString()}] ✔ Operador responsável designado: "${agenda.responsibleUser || 'Não informado'}".`,
      `[${new Date().toLocaleTimeString()}] ✔ Revisor designado via cascata: "${agenda.reviewerUser || 'Não informado'}".`,
      `[${new Date().toLocaleTimeString()}] ✔ Status do microsserviço Todoist: Preparado / Aguardando Sincronização Automática ("todoist_service_idle").`
    ];

    setAgenda(prev => ({
      ...prev,
      todoistPayload: payload,
      todoistLogs: logs
    }));
  };

  const handleSave = async () => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const now = new Date().toISOString();
      const payload = {
        agendaSecretaria: {
          ...agenda,
          todoistParentTaskId: agenda.todoistParentTaskId || caseObj?.todoistTaskId || caseObj?.todoistParentTaskId || ''
        },
        updatedAt: now,
        // Update the log for sub-step access
        revisaoSubetapaLogs: [
          ...(caseObj?.revisaoSubetapaLogs || []),
          {
            timestamp: now,
            action: 'Salvar Agendamento Administrativo',
            subetapa: 'Subetapa 01 — Agendamento de Revisão',
            details: `Agendamento status: ${agenda.scheduleStatus}, Responsável: ${agenda.responsibleUser}`
          }
        ]
      };

      await updateDoc(doc(db, 'cases', caseId!), payload);

      setCaseObj((prev: any) => ({
        ...prev,
        agendaSecretaria: payload.agendaSecretaria,
        revisaoSubetapaLogs: payload.revisaoSubetapaLogs
      }));

      setSuccess('Agenda Administrativa da Secretaria salva com sucesso!');
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar a agenda: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Revisão" caseId={caseId}>
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-bold font-mono text-gray-500 tracking-wide uppercase">
            Carregando Agendamento de Revisão...
          </span>
        </div>
      </FluxoStepLayout>
    );
  }

  const resolvedClientName = client
    ? (client.type === 'PF'
        ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Cadastro Sem Nome')
        : (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Razão Social Ausente'))
    : 'Buscando Cliente...';

  // Format Status for human-friendly viewing
  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      pendente: 'Pendente ⏳',
      solicitado: 'Solicitado 📨',
      agendado: 'Agendado 🗓️',
      reagendado: 'Reagendado 🔁',
      concluido: 'Concluído ✅',
      cancelado: 'Cancelado ❌'
    };
    return map[status] || status;
  };

  // Check if there is already a real scheduling in the system
  const hasAgendamento = agenda && agenda.suggestedDate && agenda.suggestedTime && agenda.scheduleStatus !== 'cancelado';

  return (
    <FluxoStepLayout
      stepName="Revisão"
      caseId={caseId}
      statusText={caseObj?.statusInterno || 'Aguardando revisão'}
    >
      <div className="space-y-8 font-sans">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 pb-5">
          <div className="space-y-1">
            <h2 id="page-title" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Calendar className="text-indigo-600" size={24} />
              Agendamento de Revisão
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Subetapa 01 — Organização administrativa da revisão do caso
            </p>
          </div>
          <button
            type="button"
            id="back-to-hub-btn"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/revisao`)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all cursor-pointer self-start"
          >
            <ArrowLeft size={14} />
            Voltar para Painel de Revisão
          </button>
        </div>

        {/* Info banners */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-900 text-xs flex gap-3 items-center">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-900 text-xs flex gap-3 items-center">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{success}</span>
          </div>
        )}

        {/* CLIENT QUICK INFO */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">CLIENTE ATRELADO</span>
            <span className="text-sm font-bold text-slate-900">{resolvedClientName}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">REGISTRO DE DEMANDA</span>
            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded">
              {caseObj?.registrationType || 'Não Definido'}
            </span>
          </div>
        </div>

        {/* VIEW CURRENT SCHEDULING CARD */}
        <div className="border border-gray-150 rounded-3xl p-6 bg-white space-y-4 shadow-sm">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Clock size={16} className="text-indigo-500" />
            Status Fático do Agendamento
          </h3>
          
          {!hasAgendamento ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-gray-500 text-xs flex flex-col items-center justify-center gap-2">
              <Calendar className="text-gray-300 animate-pulse" size={24} />
              <p className="font-bold">Nenhum agendamento de revisão encontrado.</p>
              <p className="text-[11px] text-gray-400">Preencha o formulário administrativo abaixo para programar a auditoria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 p-5 bg-indigo-50/40 border border-indigo-100/50 rounded-2xl text-xs font-medium text-indigo-950">
              <div className="space-y-0.5">
                <span className="block text-[8px] font-black uppercase text-indigo-400 tracking-wider">DATA REVISÃO</span>
                <span className="font-bold">{agenda.suggestedDate ? new Date(agenda.suggestedDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span>
              </div>
              <div className="space-y-0.5">
                <span className="block text-[8px] font-black uppercase text-indigo-400 tracking-wider">HORÁRIO</span>
                <span className="font-bold">{agenda.suggestedTime || '-'}</span>
              </div>
              <div className="space-y-0.5">
                <span className="block text-[8px] font-black uppercase text-indigo-400 tracking-wider">RESPONSÁVEL</span>
                <span className="font-bold">{agenda.responsibleUser || '-'}</span>
              </div>
              <div className="space-y-0.5">
                <span className="block text-[8px] font-black uppercase text-indigo-400 tracking-wider">SECRETARIA</span>
                <span className="font-bold">{agenda.schedulerResponsible || '-'}</span>
              </div>
              <div className="space-y-0.5">
                <span className="block text-[8px] font-black uppercase text-indigo-400 tracking-wider">STATUS</span>
                <span className="font-bold uppercase font-mono text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">{translateStatus(agenda.scheduleStatus)}</span>
              </div>
              <div className="space-y-0.5 col-span-2 sm:col-span-1">
                <span className="block text-[8px] font-black uppercase text-indigo-400 tracking-wider">OBSERVAÇÕES</span>
                <span className="font-semibold block truncate" title={agenda.secretariaNotes}>{agenda.secretariaNotes || 'Sem observações.'}</span>
              </div>
            </div>
          )}
        </div>

        {/* MAIN CARD: AGENDA ADMINISTRATIVA DA SECRETARIA */}
        <div id="agenda-admin-card" className="border border-gray-150 rounded-3xl p-6 bg-slate-50/50 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-150/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Clock size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Agenda Administrativa da Secretaria</h3>
                <p className="text-[10.5px] text-gray-500 mt-0.5">Planejamento, agendamento de estruturação, revisão e integração com o Todoist.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 self-start sm:self-center font-mono text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-150">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
              <span>ESTRUTURAÇÃO VINCULADA AO CASE ID</span>
            </div>
          </div>

          {/* BASIC SCHEDULING FIELDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wide text-ash-500">Responsável pelo Agendamento</label>
              <select
                value={agenda.schedulerResponsible}
                onChange={(e) => handleAgendaFieldChange('schedulerResponsible', e.target.value)}
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-xs text-gray-800 transition-all font-semibold cursor-pointer h-[40px]"
              >
                {SECRETARIA_USERS.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wide text-ash-500">Tipo de Agendamento</label>
              <select
                value={agenda.scheduleType}
                onChange={(e) => handleAgendaFieldChange('scheduleType', e.target.value as any)}
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-xs text-gray-800 transition-all font-semibold cursor-pointer h-[40px]"
              >
                <option value="estruturacao">Estruturação</option>
                <option value="revisao">Revisão</option>
                <option value="estruturacao_revisao">Estruturação e Revisão</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wide text-ash-500">Status do Agendamento</label>
              <select
                value={agenda.scheduleStatus}
                onChange={(e) => handleAgendaFieldChange('scheduleStatus', e.target.value as any)}
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-xs text-gray-800 transition-all font-bold cursor-pointer h-[40px]"
              >
                <option value="pendente">Pendente</option>
                <option value="solicitado">Solicitado</option>
                <option value="agendado">Agendado</option>
                <option value="reagendado">Reagendado</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {/* DATES & TIMES & PRIORITY */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-gray-150">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Data Sugerida</label>
              <input
                type="date"
                value={agenda.suggestedDate}
                onChange={(e) => handleAgendaFieldChange('suggestedDate', e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-xs text-gray-800 font-medium h-[38px] transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Horário Sugerido</label>
              <input
                type="time"
                value={agenda.suggestedTime}
                onChange={(e) => handleAgendaFieldChange('suggestedTime', e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-xs text-gray-800 font-medium h-[38px] transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Duração Estimada</label>
              <select
                value={agenda.estimatedDuration}
                onChange={(e) => handleAgendaFieldChange('estimatedDuration', e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-xs text-gray-800 font-medium h-[38px] transition-all cursor-pointer"
              >
                <option value="00:30">30 minutos</option>
                <option value="01:00">1 hora</option>
                <option value="01:30">1 hora e 30 min</option>
                <option value="02:00">2 horas</option>
                <option value="03:00">3 horas</option>
                <option value="04:00">4 horas</option>
              </select>
            </div>

            <div className="space-y-1.2 col-span-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Prioridade e Prazo Limite</label>
              <div className="grid grid-cols-3 gap-1 h-[38px] items-center">
                {(['baixa', 'media', 'alta'] as const).map((level) => {
                  const active = agenda.priority === level;
                  let colorClass = 'border-gray-200 text-gray-600 hover:bg-gray-50';
                  if (active) {
                    if (level === 'baixa') colorClass = 'bg-green-500 text-white border-green-500';
                    if (level === 'media') colorClass = 'bg-amber-500 text-white border-amber-500';
                    if (level === 'alta') colorClass = 'bg-rose-500 text-white border-rose-500';
                  }
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => handleAgendaPriorityChange(level)}
                      className={`text-[9.5px] font-extrabold uppercase tracking-wider py-2 rounded-lg border text-center transition-all cursor-pointer ${colorClass}`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* DELEGATION ENGINE & ADVANCED INTEGRATIONS BLOCK */}
          <div className="bg-slate-100/60 rounded-2xl p-5 border border-slate-200/80 space-y-4">
            <h4 className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <Users size={14} className="text-slate-500" />
              Regras Jurídicas de Delegação e Busca de Projetos
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-500">Destinatário da Delegação (Executa & Protocola) *</label>
                  <select
                    value={agenda.responsibleUser}
                    onChange={(e) => handleAgendaFieldChange('responsibleUser', e.target.value)}
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-xs text-gray-800 transition-all font-semibold cursor-pointer h-[40px]"
                  >
                    {TEAM_MEMBERS.map(member => (
                      <option key={member} value={member}>{member}</option>
                    ))}
                  </select>
                  <p className="text-[9.5px] text-gray-400 italic">"Quem recebe executa e também fica responsável pelo protocolo final."</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Designado para Protocolo</label>
                    <div className="bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-500 font-bold">
                      {agenda.protocolUser}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide">Data Unificada do Protocolo</label>
                    <input
                      type="date"
                      value={agenda.protocolDate}
                      onChange={(e) => handleAgendaFieldChange('protocolDate', e.target.value)}
                      className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-1.5 text-xs text-gray-800 font-semibold h-[38px]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-500">Auditor Revisor Designado (Cascata) 👑</label>
                  <div className="bg-indigo-50 border border-indigo-150 rounded-xl px-3.5 py-3 text-xs text-indigo-900 font-extrabold flex items-center justify-between">
                    <span>{agenda.reviewerUser}</span>
                    <span className="text-[9px] uppercase tracking-widest bg-indigo-600 text-white px-2 py-0.5 rounded font-mono">CASCATA ATIVADA</span>
                  </div>
                  <p className="text-[9.5px] text-indigo-600">Revisor escolhido de acordo com a regra de submissão do responsável executivo.</p>
                </div>
              </div>

              <div className="space-y-3.5">
                <div className="space-y-1.5 relative">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-500">Buscador Inteligente de Projetos Todoist 🔍</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="🔍 Digite para pesquisar projetos (ex: Trabalhista, Família...)"
                      value={projectSearch}
                      onChange={(e) => {
                        setProjectSearch(e.target.value);
                        setShowProjectDropdown(true);
                      }}
                      onFocus={() => setShowProjectDropdown(true)}
                      className="w-full bg-white border border-indigo-200/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl pl-9 pr-4 py-2.5 text-xs text-indigo-950 transition-all font-semibold"
                    />
                    <Search size={14} className="absolute left-3.5 top-3.5 text-indigo-400" />
                  </div>

                  {showProjectDropdown && (
                    <div className="absolute z-30 left-0 right-0 max-h-48 overflow-y-auto bg-white border border-gray-150 rounded-xl shadow-lg mt-1 p-1 sm:text-xs">
                      {ALL_MOCK_PROJECTS.filter(p => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase())).map(prj => (
                        <button
                          key={prj.id}
                          type="button"
                          onClick={() => {
                            handleAgendaFieldChange('projectId', prj.id);
                            handleAgendaFieldChange('projectName', prj.name);
                            setProjectSearch('');
                            setShowProjectDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 text-xs font-medium text-gray-700 flex items-center justify-between"
                        >
                          <span>{prj.name}</span>
                          <span className="font-mono text-[9px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{prj.id}</span>
                        </button>
                      ))}
                      <div className="p-2 border-t border-gray-100 text-center text-[10px] text-gray-400 font-mono">
                        Selecione um projeto para vincular as subtarefas no Todoist.
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100/70 flex items-center justify-between font-medium">
                    <div className="space-y-0.5">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-indigo-500">PROJETO VINCULADO</span>
                      <span className="text-xs font-bold text-gray-800">{agenda.projectName}</span>
                    </div>
                    <span className="font-mono text-[10px] bg-white border border-indigo-250 text-indigo-700 px-2 py-1 rounded">ID: {agenda.projectId}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-400">ID da Tarefa Principal (Todoist case_id)</label>
                  <input
                    type="text"
                    value={agenda.todoistParentTaskId}
                    onChange={(e) => handleAgendaFieldChange('todoistParentTaskId', e.target.value)}
                    placeholder="Vazio (Será resolvido no microsserviço)"
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-xs font-mono text-gray-800"
                  />
                  <p className="text-[9.5px] text-gray-400">Subtarefas criadas no Todoist serão filhas desta tarefa principal.</p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handlePrepareTodoist}
                className="w-full inline-flex items-center justify-center gap-2 bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 px-5 rounded-xl shadow-xs cursor-pointer transition-all uppercase tracking-wide"
              >
                <Sparkles size={14} className="animate-spin" />
                Sincronizar e Preparar Subtarefas no Todoist
              </button>
            </div>
          </div>

          {/* TODOIST LOGS DISPLAY */}
          {agenda.todoistPayload && (
            <div className="space-y-2 p-4 bg-slate-900 rounded-2xl border border-slate-950 font-mono text-xs text-teal-400 shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[10px] uppercase text-slate-500 tracking-wider">
                <span className="flex items-center gap-2">
                  <Terminal size={12} />
                  Fila do Microsserviço de Integração (Todoist)
                </span>
                <span className="text-emerald-500 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-900">PREPARADO</span>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto text-[11px] leading-relaxed">
                {agenda.todoistLogs.map((log, i) => (
                  <p key={i} className="text-gray-300">{log}</p>
                ))}
              </div>
              <div className="border-t border-slate-800/80 pt-2.5 mt-2">
                <span className="block text-[9px] text-rose-400 uppercase font-bold tracking-widest mb-1">Payload Completo Preparado para Envio Futuro:</span>
                <pre className="text-[10.5px] leading-tight text-teal-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(agenda.todoistPayload, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-500">Observações Gerais para a Secretaria</label>
            <textarea
              value={agenda.secretariaNotes || ''}
              onChange={(e) => handleAgendaFieldChange('secretariaNotes', e.target.value)}
              placeholder="Descreva instruções de agendamento de pautas, ausências ou avisos adicionais para a secretaria..."
              className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-xs text-gray-800 transition-all font-medium placeholder-gray-300 min-h-[75px]"
            />
          </div>
        </div>

        {/* BOTTOM CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/revisao`)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            Voltar para o Painel
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
          >
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar Agendamento'}
          </button>
        </div>
      </div>
    </FluxoStepLayout>
  );
}
