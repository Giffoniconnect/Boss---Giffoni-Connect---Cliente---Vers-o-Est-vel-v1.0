import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Info,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  FileCheck,
  Loader2,
  User,
  Calendar,
  Sparkles
} from 'lucide-react';

interface ReviewFormalData {
  reviewerName: string;
  reviewDate: string;
  reviewDeadline: string;
  reviewStatus: string;
  approvedForProtocol: boolean;
  requestedAdjustments: string;
  finalNotes: string;
  forcedAdvance: boolean;
  forcedAdvanceReason: string;
  completedAt: string;
  updatedAt: string;
}

const DEFAULT_REVIEW: ReviewFormalData = {
  reviewerName: '',
  reviewDate: '',
  reviewDeadline: '',
  reviewStatus: 'aguardando_revisao',
  approvedForProtocol: false,
  requestedAdjustments: '',
  finalNotes: '',
  forcedAdvance: false,
  forcedAdvanceReason: '',
  completedAt: '',
  updatedAt: ''
};

const TEAM_MEMBERS = [
  'Dr. Arthur Giffoni',
  'Dra. Mariana Vasconcelos',
  'Dr. Ricardo Rodrigues',
  'Dra. Beatriz Ramos',
  'Dr. Carlos Eduardo'
];

export default function DecisaoRevisao() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [review, setReview] = useState<ReviewFormalData>(DEFAULT_REVIEW);
  const [showForcedDialog, setShowForcedDialog] = useState(false);

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

        const rawReview = cData.reviewFormal || {};
        const edrpReview = cData.edrp?.reviewPreparation || {};
        
        let initialStatus = rawReview.reviewStatus || 'aguardando_revisao';
        let initialAdjustments = rawReview.requestedAdjustments || '';
        let initialApproved = rawReview.approvedForProtocol || false;

        // Sync with EDRP if necessary
        const hasEdrpAuditCompleted = edrpReview.completed || edrpReview.reviewStatus === 'aprovado' || edrpReview.reviewStatus === 'reprovado' || edrpReview.reviewStatus === 'ajustes_solicitados';
        if (hasEdrpAuditCompleted && (!rawReview.reviewStatus || rawReview.reviewStatus === 'aguardando_revisao')) {
          if (edrpReview.reviewStatus === 'aprovado') {
            initialStatus = 'aprovada_sem_ressalvas';
            initialApproved = true;
          } else if (edrpReview.reviewStatus === 'reprovado') {
            initialStatus = 'nao_aprovada';
            initialApproved = false;
          } else if (edrpReview.reviewStatus === 'ajustes_solicitados') {
            initialStatus = 'aprovada_com_ressalvas';
            initialApproved = false;
          }
          initialAdjustments = edrpReview.adjustmentsRequested || edrpReview.reviewInstructions || '';
        }

        const merged: ReviewFormalData = {
          reviewerName: rawReview.reviewerName || edrpReview.reviewResponsible || '',
          reviewDate: rawReview.reviewDate || edrpReview.reviewDate || new Date().toISOString().split('T')[0],
          reviewDeadline: rawReview.reviewDeadline || edrpReview.reviewDeadline || '',
          reviewStatus: initialStatus,
          approvedForProtocol: initialApproved,
          requestedAdjustments: initialAdjustments,
          finalNotes: rawReview.finalNotes || edrpReview.notes || '',
          forcedAdvance: rawReview.forcedAdvance || false,
          forcedAdvanceReason: rawReview.forcedAdvanceReason || '',
          completedAt: rawReview.completedAt || edrpReview.completedAt || '',
          updatedAt: rawReview.updatedAt ?? ''
        };

        setReview(merged);

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados de decisão: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  const resolveStatusInterno = (status: string) => {
    switch (status) {
      case 'aprovada_sem_ressalvas':
      case 'aprovado':
        return 'Aprovado para protocolo';
      case 'aprovada_com_ressalvas':
      case 'ajustes_solicitados':
        return 'Com ressalva';
      case 'nao_aprovada':
      case 'reprovado':
        return 'Com pendência';
      case 'aguardando_revisao':
        return 'Aguardando revisão';
      case 'em_revisao':
        return 'Em revisão';
      default:
        return 'Em revisão';
    }
  };

  const handleChange = (field: keyof ReviewFormalData, value: any) => {
    setReview((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === 'reviewStatus') {
        if (value === 'aprovada_sem_ressalvas' || value === 'aprovado') {
          updated.approvedForProtocol = true;
          updated.forcedAdvance = false;
        } else {
          updated.approvedForProtocol = false;
        }
      }

      if (field === 'approvedForProtocol') {
        if (value === true) {
          updated.reviewStatus = 'aprovada_sem_ressalvas';
          updated.forcedAdvance = false;
        } else if (updated.reviewStatus === 'aprovada_sem_ressalvas' || updated.reviewStatus === 'aprovado') {
          updated.reviewStatus = 'aguardando_revisao';
        }
      }

      return updated;
    });
  };

  const handleSave = async (silent = false, action: 'none' | 'exit' | 'advance' = 'none') => {
    if (!caseId) return false;
    setSaving(true);
    setError(null);
    if (!silent) setSuccess(null);

    try {
      const now = new Date().toISOString();
      const statusInt = resolveStatusInterno(review.reviewStatus);

      if (review.forcedAdvance && !review.forcedAdvanceReason.trim()) {
        throw new Error('O motivo da liberação forçada de aprovação é obrigatório.');
      }

      const payload: any = {
        reviewFormal: {
          ...review,
          completedAt: (review.reviewStatus === 'aprovada_sem_ressalvas' || review.reviewStatus === 'aprovado') ? (review.completedAt || now) : '',
          updatedAt: now
        },
        statusInterno: statusInt,
        updatedAt: now,
        revisaoSubetapaLogs: [
          ...(caseObj?.revisaoSubetapaLogs || []),
          {
            timestamp: now,
            action: action === 'advance' ? 'Salvar e Avançar para Protocolo' : 'Salvar Decisão de Auditoria',
            subetapa: 'Subetapa 03 — Decisão sobre a aprovação',
            details: `Parecer: ${review.reviewStatus}, Aprovado para protocolo: ${review.approvedForProtocol}, Avanço forçado: ${review.forcedAdvance}`
          }
        ]
      };

      if (action === 'advance') {
        payload.productionStage = 'protocolo';
      }

      await updateDoc(doc(db, 'cases', caseId!), payload);

      setCaseObj((prev: any) => ({
        ...prev,
        reviewFormal: payload.reviewFormal,
        statusInterno: statusInt,
        revisaoSubetapaLogs: payload.revisaoSubetapaLogs,
        productionStage: action === 'advance' ? 'protocolo' : prev.productionStage
      }));

      if (!silent) {
        setSuccess('Dados de Decisão de Auditoria atualizados com sucesso!');
      }

      if (action === 'exit') {
        navigate('/boss-giffoni-clientes/fluxo-producao');
      } else if (action === 'advance') {
        navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/protocolo`);
      }

      return true;
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar parecer: ${err.message || err}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAdvanceValidation = async () => {
    const isApproved = review.approvedForProtocol || review.reviewStatus === 'aprovado' || review.reviewStatus === 'aprovada_sem_ressalvas';

    if (isApproved) {
      await handleSave(true, 'advance');
    } else {
      if (review.forcedAdvance && review.forcedAdvanceReason.trim()) {
        await handleSave(true, 'advance');
      } else {
        setShowForcedDialog(true);
      }
    }
  };

  const handleConfirmForcedAdvance = async (reason: string) => {
    if (!reason.trim()) {
      setError('Por favor, informe um motivo legível para a liberação sem revisão aprovada.');
      return;
    }

    const updatedReview = {
      ...review,
      forcedAdvance: true,
      forcedAdvanceReason: reason
    };
    setReview(updatedReview);

    try {
      const now = new Date().toISOString();
      const statusInt = resolveStatusInterno(updatedReview.reviewStatus);

      const payload: any = {
        reviewFormal: {
          ...updatedReview,
          updatedAt: now
        },
        statusInterno: statusInt,
        productionStage: 'protocolo',
        updatedAt: now,
        revisaoSubetapaLogs: [
          ...(caseObj?.revisaoSubetapaLogs || []),
          {
            timestamp: now,
            action: 'Avanço Forçado Confirmado',
            subetapa: 'Subetapa 03 — Decisão sobre a aprovação',
            details: `Avanço forçado justificado: "${reason}"`
          }
        ]
      };

      await updateDoc(doc(db, 'cases', caseId!), payload);
      setShowForcedDialog(false);
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/protocolo`);
    } catch (err: any) {
      setError(`Erro ao registrar liberação forçada: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Revisão" caseId={caseId}>
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-bold font-mono text-gray-500 tracking-wide uppercase">
            Carregando Decisão de Auditoria...
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
              <FileCheck className="text-indigo-600" size={24} />
              Decisão sobre a Revisão
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Subetapa 03 — Decisão e status de auditoria do caso
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

        {/* Error and Success Banners */}
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

        {/* FORCED ADVANCE ALERT WARNING */}
        {showForcedDialog && (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl space-y-4 shadow-sm animate-fade-in">
            <div className="flex gap-3">
              <ShieldAlert size={22} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-black text-xs text-amber-950 uppercase tracking-tight">Confirmação de Liberação sem Aprovação</h4>
                <p className="text-xs text-amber-900/85 mt-1 leading-relaxed">
                  Avançar sem revisão aprovada gerará um <strong>alerta crítico</strong> no relatório de integridade que bloqueará o faturamento seguro do processo. Para forçar a etapa de protocolo, você deve justificar esta conduta operacional.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-800">Motivo da liberação forçada *</label>
              <textarea
                value={review.forcedAdvanceReason}
                onChange={(e) => handleChange('forcedAdvanceReason', e.target.value)}
                placeholder="Exemplo: Autorização especial da diretoria operacional devido ao prazo decadencial..."
                className="w-full bg-white border border-amber-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-xs text-amber-950 min-h-[80px]"
              />
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowForcedDialog(false)}
                className="text-xs text-gray-500 font-bold hover:text-gray-900 bg-white border border-gray-200 py-2 px-4 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmForcedAdvance(review.forcedAdvanceReason)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-5 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                Avançar mesmo assim
              </button>
            </div>
          </div>
        )}

        {/* INTEGRATION NOTICE */}
        {caseObj?.edrp?.reviewPreparation?.completed && (
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs flex gap-3.5 items-start">
            <Info size={18} className="text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-extrabold uppercase tracking-wide text-indigo-950 block text-[10px]">Parecer Importado de EDRP (Etapa de Estruturação)</span>
              <p className="text-indigo-900 leading-relaxed font-semibold">
                Conforme as regras de conformidade do BOSS, identificamos que um parecer técnico de auditoria já foi realizado na <strong>Etapa 08 (EDRP)</strong> para este caso. Para evitar duplicação ou divergência de formulários, esses dados foram sincronizados automaticamente. Você pode alterar as datas ou emitir novas ressalvas abaixo se necessário.
              </p>
            </div>
          </div>
        )}

        {/* DECISION CARD */}
        <div id="decisao-auditoria-card" className="border border-indigo-150 rounded-3xl p-6 bg-white space-y-6 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FileCheck size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-950 uppercase tracking-tight font-sans">Decisão e Status de Auditoria do Caso</h3>
              <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Defina se a estruturação está apta para protocolo definitivo em juízo.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase text-gray-500">Escolha o Parecer do Auditor Técnico *</label>
              <select
                value={review.reviewStatus}
                onChange={(e) => handleChange('reviewStatus', e.target.value)}
                className="w-full bg-white border border-gray-250 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 transition-all font-bold cursor-pointer h-[40px]"
              >
                <option value="aguardando_revisao">Aguardando revisão</option>
                <option value="revisao_agendada">Revisão agendada</option>
                <option value="pre_revisao_em_andamento">Pré-revisão em andamento</option>
                <option value="aguardando_decisao">Aguardando decisão</option>
                <option value="aprovada_sem_ressalvas">Aprovado</option>
                <option value="aprovada_com_ressalvas">Aprovado com ressalvas</option>
                <option value="nao_aprovada">Reprovado</option>
                <option value="devolvido_para_correcao">Devolvido para correção</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Liberação de Protocolo</label>
              <div className="flex items-center h-[38px]">
                <label className="inline-flex items-center gap-3 cursor-pointer text-xs font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={review.approvedForProtocol}
                    onChange={(e) => handleChange('approvedForProtocol', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4.5 h-4.5 transition-all"
                  />
                  <span>Confirmar liberação definitiva para protocolo</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase text-gray-500">Responsável pela Decisão</label>
              <select
                value={review.reviewerName}
                onChange={(e) => handleChange('reviewerName', e.target.value)}
                className="w-full bg-white border border-gray-250 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 transition-all font-semibold cursor-pointer h-[40px]"
              >
                <option value="">Selecione um responsável...</option>
                {TEAM_MEMBERS.map(member => (
                  <option key={member} value={member}>{member}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase text-gray-500">Data da Decisão</label>
              <input
                type="date"
                value={review.reviewDate}
                onChange={(e) => handleChange('reviewDate', e.target.value)}
                className="w-full bg-white border border-gray-250 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs text-gray-800 transition-all font-semibold h-[40px]"
              />
            </div>
          </div>

          {/* INSTRUCTIONS AREA - KEEP EVERYTHING IN HERE */}
          <div className="space-y-2 p-4.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <label className="block text-[10px] font-black uppercase text-slate-800 tracking-wide">Instruções Objetivas de Ajustes e Observações Jurídicas (Pendências)</label>
            <p className="text-[9px] text-gray-400 mb-2">Descreva todos os pontos de melhoria, ressalvas ou observações essenciais levantadas na auditoria.</p>
            <textarea
              value={review.requestedAdjustments}
              onChange={(e) => handleChange('requestedAdjustments', e.target.value)}
              placeholder="Exemplo: Ajustar o valor da pretensão indenizatória com base na planilha de cálculo anexada e juntar comprovante de rendimentos atualizado."
              className="w-full bg-white border border-gray-250 rounded-xl p-3.5 text-xs text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[110px]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-gray-500">Observações Gerais (Próxima Ação)</label>
            <textarea
              value={review.finalNotes}
              onChange={(e) => handleChange('finalNotes', e.target.value)}
              placeholder="Descreva observações adicionais, próximas ações ou ressalvas gerais..."
              className="w-full bg-white border border-gray-250 rounded-xl p-3 text-xs text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[75px]"
            />
          </div>

          {/* FORCED ADVANCE DETAILS PERMANENT STATUS */}
          {review.forcedAdvance && (
            <div className="p-4 bg-red-50 border border-red-150 rounded-2xl space-y-1">
              <h5 className="text-[10px] font-extrabold text-red-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={14} />
                Caso em Avanço Forçado sem Aprovação Técnica
              </h5>
              <p className="text-xs text-red-900 leading-relaxed font-semibold">
                Motivo registrado: <span className="font-normal italic">"{review.forcedAdvanceReason}"</span>
              </p>
            </div>
          )}
        </div>

        {/* BOTTOM CONTROLS & NAVIGATION BUTTONS */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/revisao`)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            Voltar para o Painel
          </button>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false, 'none')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-700 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              <Save size={13} />
              {saving ? 'Gravando...' : 'Salvar Parecer'}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false, 'exit')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-950 text-gray-900 hover:bg-gray-50 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              Salvar e Sair
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleAdvanceValidation}
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
