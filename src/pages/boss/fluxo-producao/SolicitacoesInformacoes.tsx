import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import RequestStatusBadge from './components/RequestStatusBadge';
import RequestVisibilityBadge from './components/RequestVisibilityBadge';
import { 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  Info, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  AlertTriangle, 
  HelpCircle, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  CheckSquare, 
  Loader2, 
  AlertCircle, 
  MessageSquare,
  Lock,
  Archive,
  RefreshCw
} from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';

interface InfoRequest {
  id: string;
  caseId: string;
  clientId: string;
  clientSlug: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'pendente' | 'respondido' | 'em_analise' | 'aprovado' | 'rejeitado' | 'complemento_solicitado' | 'arquivado';
  visibleToClient: boolean;
  clientAnswer?: string;
  clientAnsweredAt?: string;
  bossAnalysisStatus?: string;
  bossAnalysisNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function SolicitacoesInformacoes() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  // Root states
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Loaded documents
  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [requests, setRequests] = useState<InfoRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [solicitarInfoComp, setSolicitarInfoComp] = useState<boolean>(true);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null); // null means "New request"
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formVisible, setFormVisible] = useState(true);
  
  // Status & analysis states for editing
  const [formStatus, setFormStatus] = useState<InfoRequest['status']>('pendente');
  const [formAnalysisStatus, setFormAnalysisStatus] = useState('');
  const [formAnalysisNotes, setFormAnalysisNotes] = useState('');

  const [refreshToggle, setRefreshToggle] = useState(0);

  // Resolve client info
  const clientName = client 
    ? (client.type === 'PF' 
        ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Sem Nome') 
        : (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Sem Razão Social'))
    : '';
  const clientSlug = client?.slug || '';

  // Load resource details on mount & refresh trigger
  useEffect(() => {
    if (!caseId) {
      setError('Identificador do caso ausente na URL.');
      setFetching(false);
      return;
    }

    async function loadResources() {
      try {
        setLoadingRequests(true);
        // 1. Fetch case
        const caseSnap = await getDoc(doc(db, 'cases', caseId!));
        if (!caseSnap.exists()) {
          setError(`Caso referenciado por ID [${caseId}] não existe no banco de dados.`);
          setFetching(false);
          setLoadingRequests(false);
          return;
        }
        const cData = caseSnap.data();
        setCaseObj(cData);
        if (cData.solicitarInfoComp !== undefined) {
          setSolicitarInfoComp(cData.solicitarInfoComp);
        } else {
          setSolicitarInfoComp(true);
        }

        // 2. Fetch Client if available
        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            setClient(clientSnap.data());
          }
        }

        // 3. Fetch Case Information Requests
        const q = query(
          collection(db, 'caseInformationRequests'),
          where('caseId', '==', caseId)
        );
        const querySnap = await getDocs(q);
        const reqList: InfoRequest[] = [];
        querySnap.forEach((docSnap) => {
          reqList.push({
            id: docSnap.id,
            ...docSnap.data()
          } as InfoRequest);
        });

        // Sort requests: newest first
        reqList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRequests(reqList);

      } catch (err: any) {
        console.error(err);
        setError(`Erro técnico de carregamento de dados: ${err.message || err}`);
      } finally {
        setFetching(false);
        setLoadingRequests(false);
      }
    }

    loadResources();
  }, [caseId, refreshToggle]);
  
  const handleToggleSolicitarInfoComp = async (value: boolean) => {
    setSolicitarInfoComp(value);
    setError(null);
    setSuccess(null);
    try {
      const nowISO = new Date().toISOString();
      const updateData: any = {
        solicitarInfoComp: value,
        updatedAt: nowISO
      };

      if (!value) {
        updateData.infoStatus = 'concluido';
        updateData.infoCompleted = true;
      } else {
        const hasPending = requests.some(r => r.status === 'pendente' || r.status === 'complemento_solicitado');
        if (requests.length > 0 && !hasPending) {
          updateData.infoStatus = 'concluido';
          updateData.infoCompleted = true;
        } else {
          updateData.infoStatus = 'pendente';
          updateData.infoCompleted = false;
        }
      }

      await updateDoc(doc(db, 'cases', caseId!), updateData);
      
      setCaseObj((prev: any) => ({
        ...prev,
        ...updateData
      }));

      setSuccess(`Preferência salva: ${value ? '"Sim"' : '"Não"'}.`);
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar preferência: ${err.message || err}`);
    }
  };

  // Handle Form Submission: Create or Update Request
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formTitle.trim()) {
      setError('O título da solicitação é obrigatório.');
      return;
    }

    if (!formDesc.trim()) {
      setError('A descrição de orientações ao cliente é obrigatória.');
      return;
    }

    setSaving(true);
    const nowISO = new Date().toISOString();

    try {
      const payload: any = {
        caseId: caseId!,
        clientId: caseObj?.clientId || '',
        clientSlug: clientSlug || '',
        title: formTitle.trim(),
        description: formDesc.trim(),
        dueDate: formDueDate || '',
        visibleToClient: formVisible,
        updatedAt: nowISO
      };

      if (editingId) {
        // Edit Mode
        payload.status = formStatus;
        payload.bossAnalysisStatus = formAnalysisStatus;
        payload.bossAnalysisNotes = formAnalysisNotes.trim();

        await updateDoc(doc(db, 'caseInformationRequests', editingId), payload);
        setSuccess('Solicitação de informação atualizada com sucesso!');
      } else {
        // Create Mode
        payload.status = 'pendente';
        payload.bossAnalysisStatus = '';
        payload.bossAnalysisNotes = '';
        payload.createdAt = nowISO;

        const docRef = await addDoc(collection(db, 'caseInformationRequests'), payload);
        setSuccess('Nova solicitação de informação agendada com êxito!');
      }

      // If visible to client, update main case status as specified in REGRA 9
      if (formVisible) {
        await updateDoc(doc(db, 'cases', caseId!), {
          statusPublicoCliente: "Aguardando documentos",
          productionStatus: "em_producao",
          updatedAt: nowISO
        });
      }

      // Reset form states
      resetForm();
      setRefreshToggle((prev) => prev + 1);

    } catch (err: any) {
      console.error(err);
      setError(`Erro na persistência fática da solicitação: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditInit = (req: InfoRequest) => {
    setError(null);
    setSuccess(null);
    setEditingId(req.id);
    setFormTitle(req.title);
    setFormDesc(req.description);
    setFormDueDate(req.dueDate || '');
    setFormVisible(req.visibleToClient);
    setFormStatus(req.status);
    setFormAnalysisStatus(req.bossAnalysisStatus || '');
    setFormAnalysisNotes(req.bossAnalysisNotes || '');
  };

  const resetForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormDesc('');
    setFormDueDate('');
    setFormVisible(true);
    setFormStatus('pendente');
    setFormAnalysisStatus('');
    setFormAnalysisNotes('');
  };

  // Inline Quick Actions
  const handleQuickStatusUpdate = async (reqId: string, statusText: InfoRequest['status'], analysisStatus?: string) => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    const nowISO = new Date().toISOString();

    try {
      const payload: any = {
        status: statusText,
        updatedAt: nowISO
      };

      if (analysisStatus !== undefined) {
        payload.bossAnalysisStatus = analysisStatus;
      }

      await updateDoc(doc(db, 'caseInformationRequests', reqId), payload);
      setSuccess(`Status da solicitação alterado para "${statusText}" com sucesso.`);
      setRefreshToggle((p) => p + 1);
    } catch (err: any) {
      console.error(err);
      setError(`Erro na ação rápida: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndAdvance = async () => {
    setSaving(true);
    setError(null);
    const nowISO = new Date().toISOString();

    try {
      await updateDoc(doc(db, 'cases', caseId!), {
        productionStage: "financeiro",
        infoStatus: "concluido",
        infoCompleted: true,
        updatedAt: nowISO
      });
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId!}/financeiro`);
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao atualizar etapa de produção para avanço: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndExit = async () => {
    navigate('/boss-giffoni-clientes/fluxo-producao');
  };

  if (!caseId) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-20 bg-white border border-red-200 rounded-3xl shadow-sm text-center">
        <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-black text-gray-900 uppercase">Acesso Restrito</h3>
        <p className="text-xs text-gray-500 mt-2">
          Não há caseId associado na URL de requisição para carregar as solicitações de informações.
        </p>
        <button
          type="button"
          onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
          className="mt-6 inline-flex bg-gray-900 hover:bg-black text-white text-xs font-bold px-6 py-2.5 rounded-xl cursor-pointer"
        >
          Retornar ao Painel
        </button>
      </div>
    );
  }

  return (
    <FluxoStepLayout stepName="Solicitações de Informações" caseId={caseId} statusText={caseObj?.status === 'rascunho' ? 'Rascunho' : 'Ativo'}>
      <div className="space-y-6">

        {/* FEEDBACK BANNERS */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-900 text-xs flex gap-3 items-center animate-fadeIn">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-900 text-xs flex gap-3 items-center animate-fadeIn">
            <Check className="text-emerald-500 shrink-0" size={16} />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        {/* TOP METADATA SUMMARY BAR IN COMPLIANCE WITH REGRA 2 */}
        {!fetching && caseObj && (
          <div className="bg-gray-50/70 border border-gray-150 rounded-2xl p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              <div className="space-y-1">
                <span className="text-[9px] font-black tracking-wider text-gray-400 uppercase">Cliente Titular</span>
                <h4 className="text-xs font-bold text-gray-950 break-words">{clientName || 'Carregando...'}</h4>
              </div>
              <div className="space-y-1 sm:pl-4">
                <span className="text-[9px] font-black tracking-wider text-gray-400 uppercase">Modalidade</span>
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-tight break-words">{caseObj.registrationType}</h4>
                <span className="inline-block text-[8px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-md font-mono mt-0.5">
                  {caseObj.registrationTypeKey || 'peticao_inicial'}
                </span>
              </div>
              <div className="space-y-1 sm:pl-4">
                <span className="text-[9px] font-black tracking-wider text-gray-400 uppercase">Controle Operacional</span>
                <div className="text-[10px] text-gray-600 space-y-0.5">
                  <div>Interno: <span className="font-bold text-gray-700">{caseObj.statusInterno || 'Em produção'}</span></div>
                  <div className="break-words">Público: <span className="font-bold text-indigo-700">{caseObj.statusPublicoCliente || 'Aguardando...'}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOOLEAN SELECTOR CARD */}
        {!fetching && caseObj && (
          <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs text-left space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-black uppercase text-gray-800 tracking-tight">
                  Você deseja solicitar informações complementares?
                </h4>
                <p className="text-xs text-gray-500 leading-normal">
                  Defina se esse caso necessita de informações e esclarecimentos fáticos adicionais do cliente.
                </p>
              </div>

              {/* SEGMENTED TOGGLERS */}
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleSolicitarInfoComp(true)}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all border ${
                    solicitarInfoComp === true
                      ? 'bg-gray-950 border-gray-950 text-white shadow-xs'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {solicitarInfoComp === true && <Check size={13} className="stroke-[3px]" />}
                    <span>Sim</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleSolicitarInfoComp(false)}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all border ${
                    solicitarInfoComp === false
                      ? 'bg-gray-950 border-gray-950 text-white shadow-xs'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {solicitarInfoComp === false && <Check size={13} className="stroke-[3px]" />}
                    <span>Não</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ALERTS SECTION IN COMPLIANCE WITH REGRA 11 */}
        {!fetching && solicitarInfoComp && requests.length === 0 && (
          <div className="p-4 bg-amber-50 border border-amber-205 rounded-2xl text-amber-900 text-xs space-y-1 animate-fadeIn">
            <div className="flex gap-2 items-center">
              <AlertTriangle size={16} className="text-amber-600" />
              <h5 className="font-bold uppercase tracking-wider text-[10px]">Aviso de Consistência Fática</h5>
            </div>
            <p className="font-medium leading-relaxed">
              Nenhuma solicitação registrada para este caso. <strong>Avanço sem solicitações.</strong> O relatório de integridade poderá apontar atenção no final do fluxo.
            </p>
          </div>
        )}

        {/* DISPLAY WHEN SOLICITAR IS NO */}
        {!fetching && !solicitarInfoComp && (
          <div className="p-10 bg-emerald-50/45 border border-emerald-100 rounded-3xl text-center space-y-3.5 animate-fadeIn">
            <div className="w-12 h-12 bg-emerald-100/75 rounded-full flex items-center justify-center text-emerald-700 mx-auto">
              <CheckSquare size={24} className="stroke-[2.5px]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black uppercase tracking-tight text-emerald-950">
                Informações complementares dispensadas
              </h4>
              <p className="text-xs text-emerald-800 max-w-md mx-auto leading-relaxed">
                Você selecionou que não deseja solicitar informações complementares para este caso. O passo foi marcado como concluído com sucesso. Clique em <strong>Salvar e Avançar</strong> para prosseguir para a próxima etapa.
              </p>
            </div>
          </div>
        )}

        {fetching ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-gray-500" size={28} />
            <span className="text-xs font-bold font-mono uppercase tracking-widest text-gray-500">Buscando solicitações...</span>
          </div>
        ) : solicitarInfoComp ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* LEFT AREA: REQUESTS LIST (8 COLUMNS) */}
            <div className="xl:col-span-7 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">
                  Lista de Solicitações ({requests.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setRefreshToggle((prev) => prev + 1)}
                  className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
                  title="Atualizar Lista"
                >
                  <RefreshCw size={14} className={loadingRequests ? 'animate-spin' : ''} />
                </button>
              </div>

              {requests.length === 0 ? (
                <div className="p-10 border-2 border-dashed border-gray-150 rounded-2xl text-center text-gray-400 flex flex-col items-center justify-center gap-2">
                  <FileText size={32} className="text-gray-300" />
                  <span className="text-xs font-semibold">Tabela vazia para este caso</span>
                  <p className="text-[10px] text-gray-400 max-w-xs leading-relaxed">Utilize o formulário ao lado para cadastrar perguntas ou solicitação de esclarecimentos fáticos.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {requests.map((req) => (
                    <div 
                      key={req.id} 
                      className={`p-5 bg-white border rounded-2xl transition-all shadow-xs space-y-4 ${
                        editingId === req.id 
                          ? 'border-indigo-500 ring-1 ring-indigo-500' 
                          : 'border-gray-150 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1">
                          <h5 className="text-xs font-bold text-gray-900">{req.title}</h5>
                          <p className="text-xs text-gray-500 leading-relaxed max-w-md">{req.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <RequestStatusBadge status={req.status} />
                          <RequestVisibilityBadge visible={req.visibleToClient} />
                        </div>
                      </div>

                      {/* Display Client response if present */}
                      {req.clientAnswer ? (
                        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-1">
                          <div className="flex items-center gap-1 text-[9px] font-black text-blue-800 uppercase tracking-wider">
                            <MessageSquare size={11} />
                            <span>Resposta do Cliente</span>
                          </div>
                          <p className="text-xs text-blue-950 font-medium">{req.clientAnswer}</p>
                          {req.clientAnsweredAt && (
                            <span className="block text-[8px] text-blue-500 font-mono">
                              Submetido em: {new Date(req.clientAnsweredAt).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg w-max">
                          <Clock size={11} />
                          <span>Aguardando digitação no Portal do Cliente</span>
                        </div>
                      )}

                      {/* Boss Review & Notes display if set */}
                      {(req.bossAnalysisStatus || req.bossAnalysisNotes) && (
                        <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1">
                          <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                            <CheckSquare size={11} />
                            <span>Parecer de Auditoria do BOSS</span>
                          </div>
                          <div className="text-[10px] font-semibold text-gray-700">
                            Status Parecer: <span className="uppercase text-gray-900 font-bold">{req.bossAnalysisStatus || 'Sem Parecer'}</span>
                          </div>
                          {req.bossAnalysisNotes && (
                            <p className="text-xs text-gray-600 italic">“{req.bossAnalysisNotes}”</p>
                          )}
                        </div>
                      )}

                      {/* ACTION BULLETS IN COMPLIANCE WITH REGRA 7 */}
                      <div className="flex flex-wrap items-center justify-between pt-2.5 border-t border-gray-100 gap-2">
                        <span className="text-[9px] text-gray-400 font-mono">
                          Criado em {new Date(req.createdAt).toLocaleDateString('pt-BR')}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* Approve Action */}
                          {req.status !== 'aprovado' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusUpdate(req.id, 'aprovado', 'aprovado')}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-transparent text-emerald-800 text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                              title="Marcar como Aprovado"
                            >
                              Aprovar
                            </button>
                          )}

                          {/* Reject Action */}
                          {req.status !== 'rejeitado' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusUpdate(req.id, 'rejeitado', 'rejeitado')}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 border border-transparent text-red-800 text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                              title="Rejeitar Reposta"
                            >
                              Rejeitar
                            </button>
                          )}

                          {/* Solicit Complement Action */}
                          {req.status !== 'complemento_solicitado' && (
                            <button
                              type="button"
                              onClick={() => {
                                handleEditInit(req);
                                setFormStatus('complemento_solicitado');
                                setFormAnalysisStatus('complemento_solicitado');
                              }}
                              className="px-2 py-1 bg-purple-55 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                              title="Solicitar Complemento ao Usuário"
                            >
                              Complemento
                            </button>
                          )}

                          {/* Archive Action */}
                          {req.status !== 'arquivado' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusUpdate(req.id, 'arquivado')}
                              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                              title="Arquivar Solicitação"
                            >
                              <Archive size={10} />
                              <span>Arquivar</span>
                            </button>
                          )}

                          {/* Edit Details Launcher */}
                          <button
                            type="button"
                            onClick={() => handleEditInit(req)}
                            className="p-1 px-1.5 hover:bg-gray-200 border border-gray-150 text-gray-600 rounded-lg cursor-pointer"
                            title="Editar completo"
                          >
                            <Edit2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT AREA: FORM CARD (5 COLUMNS) */}
            <form onSubmit={handleSubmitForm} className="xl:col-span-5 bg-white border border-gray-150 rounded-2xl p-6 space-y-4 shadow-sm animate-fadeIn">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h4 className="text-xs font-black uppercase text-gray-500 tracking-wider font-mono">
                  {editingId ? 'Editar Solicitação' : 'Nova Solicitação fática'}
                </h4>
                {editingId && (
                  <button 
                    type="button" 
                    onClick={resetForm}
                    className="text-[9px] font-black uppercase tracking-wider text-rose-500 hover:underline cursor-pointer"
                  >
                    Cancelar Edição
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Título da Pergunta / Campo *</label>
                <input 
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Histórico do Vínculo Empregatício"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-1 focus:ring-gray-950 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Orientação / Explicação Fática *</label>
                <textarea 
                  rows={4}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Explique ao cliente em termos simples qual detalhe histórico ou qual faturamento de ano específico é exigido..."
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-1 focus:ring-gray-950 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Prazo de Resolução</label>
                <input 
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-1 focus:ring-gray-950 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                />
              </div>

              {/* TOGGLING CLIENT VISIBILITY (Triggers statusPublicoCliente = 'Aguardando documentos') */}
              <div className="flex items-center justify-between p-3 bg-gray-50/70 rounded-xl border border-gray-100">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase text-gray-600 tracking-wider">Visível no Portal?</span>
                  <p className="text-[9px] text-gray-400">Se ativo, disponibiliza na Timeline em tempo real.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormVisible(!formVisible)}
                  className={`w-10 h-5.5 flex items-center rounded-full p-0.5 transition-all outline-none duration-150 cursor-pointer ${
                    formVisible ? 'bg-indigo-600 justify-end' : 'bg-gray-200 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
                </button>
              </div>

              {/* EDITING EXCLUSIVE FIELDS: STATUS, ANALYSIS STATUS, ANALYSIS NOTES */}
              {editingId && (
                <div className="p-4 bg-indigo-50/30 border border-indigo-100/50 rounded-xl mt-4 space-y-3">
                  <h5 className="text-[9px] font-black tracking-wider uppercase text-indigo-750 font-mono">
                    Auditoria e Status de Atendimento (BOSS)
                  </h5>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-500">Status Geral Solicitação</label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 outline-none cursor-pointer"
                      >
                        <option value="pendente">Pendente de Resposta</option>
                        <option value="respondido">Respondido pelo Cliente</option>
                        <option value="em_analise">Em análise de Auditoria</option>
                        <option value="aprovado">Aprovado / Consolidado</option>
                        <option value="rejeitado">Rejeitado</option>
                        <option value="complemento_solicitado">Complemento Solicitado</option>
                        <option value="arquivado">Arquivado</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-500">Resultado da Análise</label>
                      <select
                        value={formAnalysisStatus}
                        onChange={(e) => setFormAnalysisStatus(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 outline-none cursor-pointer"
                      >
                        <option value="">Ainda sem veredito</option>
                        <option value="aprovado">Aprovado de acordo com requisitos</option>
                        <option value="rejeitado">Rejeitado sob desconformidade fática</option>
                        <option value="complemento_solicitado">Requer complemento fático</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-500 font-mono">Anotações do Analista BOSS / Feedback</label>
                      <textarea
                        rows={2}
                        value={formAnalysisNotes}
                        onChange={(e) => setFormAnalysisNotes(e.target.value)}
                        placeholder="Insira detalhes corretivos se a resposta fática estiver em desconformidade..."
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MUTABILITY REGRA NOTICE INSIDE FORM */}
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex gap-2 items-start text-blue-900">
                <Lock size={12} className="text-blue-500 shrink-0 mt-0.5" />
                <span className="text-[9px] font-semibold leading-normal">
                  <strong>Aviso Técnico de Portabilidade:</strong> A resposta do cliente será imutável após o envio formal e definitivo no Portal do Cliente.
                </span>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-gray-950 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <>
                    <Plus size={14} />
                    <span>{editingId ? 'Confirmar Alterações' : 'Agendar Solicitação'}</span>
                  </>
                )}
              </button>
            </form>

          </div>
        ) : null}

        {/* BOTTOM STEP CONTROLS BAR */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(flowRoutes.solicitacoesProvas(caseId))}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer"
          >
            <ArrowLeft size={14} />
            Voltar para Coletar Provas
          </button>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSaveAndExit}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-950 text-gray-900 px-6 py-3 rounded-xl font-bold transition-all text-xs hover:bg-gray-50 cursor-pointer"
            >
              <Save size={14} />
              Salvar e Sair
            </button>
            
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveAndAdvance}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gray-950 hover:bg-black text-white px-8 py-3.5 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-md"
            >
              {saving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <>
                  <span>Salvar e Avançar</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </FluxoStepLayout>
  );
}
