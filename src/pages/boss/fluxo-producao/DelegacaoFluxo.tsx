import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import { 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  Users, 
  ClipboardList, 
  CheckSquare, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Compass,
  Info
} from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';

const TEAM_MEMBERS = [
  'Dr. Arthur Giffoni',
  'Dra. Mariana Vasconcelos',
  'Dr. Ricardo Rodrigues',
  'Dra. Beatriz Ramos',
  'Dr. Carlos Eduardo'
];

const SECTORS = [
  'Contencioso Cível',
  'Juizados',
  'Trabalhista',
  'Previdenciário',
  'Tributário',
  'Administrativo',
  'Contratos',
  'Outros'
];

export default function DelegacaoFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

  const [delegation, setDelegation] = useState({
    responsiblePerson: '',
    responsibleSector: 'Contencioso Cível',
    priority: 'media',
    internalDeadline: '',
    status: 'pendente', // nao_delegado, pendente, em_andamento, concluido, devolvido_com_pendencia
    delegatedTask: '',
    notes: '',
    todoistPrepared: false,
    todoistProject: '',
    todoistTaskId: '',
    collaboratorPanelPrepared: false,
    collaboratorAssignedUser: '',
    collaboratorAssignmentStatus: 'Não Enviado'
  });

  useEffect(() => {
    if (!caseId) return;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const caseDoc = await getDoc(doc(db, 'cases', caseId));
        if (caseDoc.exists()) {
          const data = caseDoc.data();
          setCaseObj(data);
          
          const rawEdrp = data.edrp || {};
          const rawDelegation = rawEdrp.delegation || {};
          
          setDelegation({
            responsiblePerson: rawDelegation.responsiblePerson || data.operatorId || TEAM_MEMBERS[0],
            responsibleSector: rawDelegation.responsibleSector || 'Contencioso Cível',
            priority: rawDelegation.priority || 'media',
            internalDeadline: rawDelegation.internalDeadline || data.dueDate || '',
            status: rawDelegation.status || data.taskStatus || 'pendente',
            delegatedTask: rawDelegation.delegatedTask || data.taskDescription || '',
            notes: rawDelegation.notes || '',
            todoistPrepared: rawDelegation.todoistPrepared ?? !!(data.todoistProjectId || data.todoistTaskId),
            todoistProject: rawDelegation.todoistProject || data.todoistProjectId || '',
            todoistTaskId: rawDelegation.todoistTaskId || data.todoistTaskId || '',
            collaboratorPanelPrepared: rawDelegation.collaboratorPanelPrepared ?? false,
            collaboratorAssignedUser: rawDelegation.collaboratorAssignedUser || '',
            collaboratorAssignmentStatus: rawDelegation.collaboratorAssignmentStatus || 'Não Enviado'
          });

          if (data.clientId) {
            const clientDoc = await getDoc(doc(db, 'clients', data.clientId));
            if (clientDoc.exists()) {
              setClient(clientDoc.data());
            }
          }
        } else {
          setError('Caso não encontrado.');
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar os dados de delegação.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [caseId]);

  const handleFieldChange = (field: string, value: any) => {
    setDelegation(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (advanceAfter = false) => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const now = new Date().toISOString();
      const updatedEdrp = {
        ...(caseObj?.edrp || {}),
        delegation: {
          responsiblePerson: delegation.responsiblePerson,
          responsibleSector: delegation.responsibleSector,
          priority: delegation.priority,
          internalDeadline: delegation.internalDeadline,
          status: delegation.status,
          delegatedTask: delegation.delegatedTask,
          notes: delegation.notes,
          todoistPrepared: delegation.todoistPrepared,
          todoistProject: delegation.todoistProject,
          todoistTaskId: delegation.todoistTaskId,
          collaboratorPanelPrepared: delegation.collaboratorPanelPrepared,
          collaboratorAssignedUser: delegation.collaboratorAssignedUser,
          collaboratorAssignmentStatus: delegation.collaboratorAssignmentStatus,
          updatedAt: now
        }
      };

      const updateData = {
        edrp: updatedEdrp,
        // Legacy fields mapping for backwards compatibility
        operatorId: delegation.responsiblePerson,
        taskDescription: delegation.delegatedTask,
        dueDate: delegation.internalDeadline,
        todoistProjectId: delegation.todoistProject,
        todoistTaskId: delegation.todoistTaskId,
        taskStatus: delegation.status === 'concluido' ? 'concluido' : 'em_desenvolvimento',
        delegationCompleted: true,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'cases', caseId), updateData);
      setSuccess('Instruções e diretrizes de delegação salvas com sucesso!');

      if (advanceAfter) {
        setTimeout(() => {
          navigate(flowRoutes.revisao(caseId));
        }, 800);
      }
    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao gravar as diretrizes de delegação.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Delegação de Tarefas" caseId={caseId}>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <p className="text-sm font-semibold text-gray-500">Buscando informações do caso...</p>
        </div>
      </FluxoStepLayout>
    );
  }

  const resolvedClientName = client
    ? (client.isCompany === true || client.tipoPessoa === 'PJ'
        ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Cadastro de Cliente PJ')
        : (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Cadastro de Cliente PF'))
    : 'Buscando Cliente...';

  const resolvedClientSlug = client?.slug || 'sem-slug';

  return (
    <FluxoStepLayout 
      stepName="Delegação" 
      caseId={caseId}
      statusText={caseObj?.statusInterno || 'Pendente de delegação'}
    >
      <div className="space-y-8 font-sans">
        
        {/* TOP MESSAGES */}
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

        {/* METADATA CORNER */}
        <div className="bg-gray-50/70 border border-gray-100 rounded-[1.5rem] p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Etapa 09</span>
              <h4 className="text-base font-black text-gray-900 leading-tight">
                {resolvedClientName}
              </h4>
              <p className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 items-center font-medium">
                <span className="font-mono text-indigo-600 bg-indigo-50/60 px-2 py-0.5 rounded text-[10px] font-bold">
                  {resolvedClientSlug}
                </span>
                <span>• Serviço: <strong className="text-gray-700">{caseObj?.registrationType || 'Não Definido'}</strong></span>
                <span>• ID: <strong className="font-mono text-gray-600">{caseId}</strong></span>
              </p>
            </div>
          </div>
        </div>

        {/* CORE FORM */}
        <div className="grid grid-cols-1 gap-6 font-sans">
          <div className="bg-white rounded-3xl border border-gray-150 p-6 space-y-6">
            <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2 border-b border-gray-100 pb-3">
              <Users size={18} className="text-blue-600" />
              Parâmetros e Alocação da Delegação de Tarefas
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-sans font-extrabold uppercase tracking-wide text-gray-400">Responsável Principal</label>
                <select
                  value={delegation.responsiblePerson}
                  onChange={(e) => handleFieldChange('responsiblePerson', e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-xs text-gray-800 transition-all font-medium cursor-pointer h-[38px]"
                >
                  {TEAM_MEMBERS.map((member) => (
                    <option key={member} value={member}>{member}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-sans font-extrabold uppercase tracking-wide text-gray-400">Setor Responsável</label>
                <select
                  value={delegation.responsibleSector}
                  onChange={(e) => handleFieldChange('responsibleSector', e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-xs text-gray-800 transition-all font-medium cursor-pointer h-[38px]"
                >
                  {SECTORS.map((sec) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-sans font-extrabold uppercase tracking-wide text-gray-400">Prioridade</label>
                <select
                  value={delegation.priority}
                  onChange={(e) => handleFieldChange('priority', e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-xs text-gray-800 transition-all font-medium cursor-pointer h-[38px]"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-sans font-extrabold uppercase tracking-wide text-gray-400">Prazo Interno de Entrega</label>
                <input
                  type="date"
                  value={delegation.internalDeadline}
                  onChange={(e) => handleFieldChange('internalDeadline', e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-xs text-gray-800 transition-all font-medium h-[38px]"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-[10px] font-sans font-extrabold uppercase tracking-wide text-gray-400">Status da Delegação</label>
                <select
                  value={delegation.status}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-xs text-gray-800 transition-all font-medium cursor-pointer h-[38px]"
                >
                  <option value="nao_delegado">Não Delegado</option>
                  <option value="pendente">Pendente de Aceite</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluido">Concluído</option>
                  <option value="devolvido_com_pendencia">Devolvido com Pendência</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-sans font-extrabold uppercase tracking-wide text-gray-400">Tarefa Delegada (Descrição detalhada da exigência)</label>
              <textarea
                value={delegation.delegatedTask}
                onChange={(e) => handleFieldChange('delegatedTask', e.target.value)}
                placeholder="Descreva minuciosamente a instrução e parâmetros para o especialista..."
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-xs text-gray-800 transition-all font-medium placeholder-gray-300 min-h-[75px]"
              />
            </div>

            <div className="space-y-1.5 font-sans">
              <label className="block text-[10px] font-sans font-extrabold uppercase tracking-wide text-gray-400">Observações de Acompanhamento</label>
              <textarea
                value={delegation.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                placeholder="Escreva notas e histórico sobre esta delegação..."
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-xs text-gray-800 transition-all font-medium placeholder-gray-300 min-h-[60px]"
              />
            </div>

            {/* INTEGRATIONS PREPARATION (Delegation Context) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-gray-150">
              
              {/* TODOIST AREA */}
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
                <h5 className="text-[11px] font-bold text-gray-700 tracking-tight flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Sincronizador Todoist (Preparação)
                </h5>
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-600">
                  <input
                    type="checkbox"
                    checked={delegation.todoistPrepared}
                    onChange={(e) => handleFieldChange('todoistPrepared', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  <span>Preparar Task no Todoist</span>
                </label>

                {delegation.todoistPrepared && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <div className="space-y-1">
                      <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Projeto Todoist</span>
                      <input
                        type="text"
                        value={delegation.todoistProject}
                        onChange={(e) => handleFieldChange('todoistProject', e.target.value)}
                        placeholder="Ex: Contencioso"
                        className="w-full bg-white border border-gray-200 rounded-lg p-1.5 text-[11px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">ID Tarefa Todoist</span>
                      <input
                        type="text"
                        value={delegation.todoistTaskId}
                        onChange={(e) => handleFieldChange('todoistTaskId', e.target.value)}
                        placeholder="Autogerado no sync"
                        className="w-full bg-white border border-gray-200 rounded-lg p-1.5 text-[11px]"
                      />
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 text-blue-800 rounded-xl p-3 border border-blue-100/60 flex gap-2 items-start text-[10px] font-medium leading-relaxed">
                  <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Aviso:</strong> Integração Todoist preparada. Criação real de tarefa será implementada em build futuro com conector seguro.
                  </span>
                </div>
              </div>

              {/* COLLABORATOR PANEL AREA */}
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
                <h5 className="text-[11px] font-bold text-gray-700 tracking-tight flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Painel de Colaboradores (Preparação)
                </h5>
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-600">
                  <input
                    type="checkbox"
                    checked={delegation.collaboratorPanelPrepared}
                    onChange={(e) => handleFieldChange('collaboratorPanelPrepared', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  <span>Habilitar Atribuição Externa</span>
                </label>

                {delegation.collaboratorPanelPrepared && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <div className="space-y-1">
                      <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Usuário Designado</span>
                      <input
                        type="text"
                        value={delegation.collaboratorAssignedUser}
                        onChange={(e) => handleFieldChange('collaboratorAssignedUser', e.target.value)}
                        placeholder="E-mail ou ID do Advogado"
                        className="w-full bg-white border border-gray-200 rounded-lg p-1.5 text-[11px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Status da Atribuição</span>
                      <input
                        type="text"
                        value={delegation.collaboratorAssignmentStatus}
                        onChange={(e) => handleFieldChange('collaboratorAssignmentStatus', e.target.value)}
                        placeholder="Não Enviado"
                        className="w-full bg-white border border-gray-200 rounded-lg p-1.5 text-[11px]"
                      />
                    </div>
                  </div>
                )}

                <div className="bg-amber-50 text-amber-900 rounded-xl p-3 border border-amber-100/60 flex gap-2 items-start text-[10px] font-medium leading-relaxed">
                  <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Aviso:</strong> Integração com Painel de Colaboradores será implementada em build futuro.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM CONTROLS & NAVIGATION */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(flowRoutes.prePeticionamentoIa(caseId!))}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white shadow-xs"
          >
            <ArrowLeft size={14} />
            Voltar para Pré-Peticionamento com IA
          </button>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-blue-600 text-blue-600 hover:bg-blue-50 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer"
            >
              <Save size={13} />
              {saving ? 'Gravando...' : 'Salvar Dados'}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
            >
              <span>Salvar e Avançar</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </FluxoStepLayout>
  );
}
