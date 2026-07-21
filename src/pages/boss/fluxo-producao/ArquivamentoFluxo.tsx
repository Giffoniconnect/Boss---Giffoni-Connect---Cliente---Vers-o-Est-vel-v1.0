import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardDrive,
  DollarSign,
  CheckSquare,
  Mail,
  Smartphone,
  Table,
  ShieldCheck,
  Terminal,
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';

const ARCHIVE_REASONS = [
  'Sucesso total (Ação Ganha & Executada/Paga)',
  'Acordo homologado e quitado',
  'Improcedência total sem possibilidade de recurso',
  'Desistência voluntária do autor/cliente',
  'Perda do objeto da ação',
  'Acordo extrajudicial satisfatório',
  'Prescrição ou Decadência irremediável',
  'Outro motivo administrativo'
];

export default function ArquivamentoFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

  // General Archive Fields
  const [archiveData, setArchiveData] = useState({
    archivedReason: ARCHIVE_REASONS[0],
    isArchivedConfirmed: false,
    archivedNotes: '',
    archivedResponsible: ''
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

          setArchiveData({
            archivedReason: data.archivedReason || ARCHIVE_REASONS[0],
            isArchivedConfirmed: data.archived === true || data.statusInterno === 'Arquivado',
            archivedNotes: data.archivedNotes || '',
            archivedResponsible: data.archivedBy || data.arquivamento?.auditoria?.responsavel || ''
          });

          if (data.clientId) {
            const clientDoc = await getDoc(doc(db, 'clients', data.clientId));
            if (clientDoc.exists()) {
              setClient(clientDoc.data());
            }
          }
        } else {
          setError('Caso de ID fornecido não encontrado.');
        }
      } catch (err: any) {
        console.error(err);
        setError('Erro ao carregar os dados de arquivamento.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [caseId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setArchiveData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setArchiveData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSaveGeneral = async () => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const isArchived = archiveData.isArchivedConfirmed;
      const updatePayload = {
        archived: isArchived,
        archivedReason: archiveData.archivedReason,
        archivedNotes: archiveData.archivedNotes,
        archivedBy: archiveData.archivedResponsible,
        statusInterno: isArchived ? 'Arquivado' : (caseObj.statusInterno === 'Arquivado' ? 'Pendente de arquivamento' : caseObj.statusInterno),
        productionStage: isArchived ? 'arquivamento' : caseObj.productionStage,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'cases', caseId), updatePayload);
      setSuccess('Parâmetros gerais de arquivamento salvos com sucesso!');

      setCaseObj((prev: any) => ({
        ...prev,
        ...updatePayload
      }));

    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar parâmetros gerais: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Arquivamento" caseId={caseId}>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <p className="text-xs font-bold font-mono text-gray-500 tracking-wide uppercase">
            Buscando painel de arquivamento...
          </p>
        </div>
      </FluxoStepLayout>
    );
  }

  const resolvedClientName = client
    ? (client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true
        ? (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Cadastro de Cliente PJ')
        : (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Cadastro de Cliente PF'))
    : 'Buscando Cliente...';

  const resolvedClientSlug = client?.slug || 'sem-slug';

  // Dynamic Status Resolvers for 6 Sub-stages
  const arq = caseObj?.arquivamento || {};

  // 1. Financeiro
  const getFinanceiroStatus = () => {
    const fin = arq.financeiro;
    if (!fin) return { label: 'Não Iniciado ⚪', class: 'text-gray-500 bg-gray-50 border-gray-200' };
    if (fin.haPendenciaFinanceira === 'sim') return { label: 'Com Pendência ❌', class: 'text-red-700 bg-red-50 border-red-100' };
    if (fin.haPendenciaFinanceira === 'nao') return { label: 'Verificado ✅', class: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
    return { label: 'Não Iniciado ⚪', class: 'text-gray-500 bg-gray-50 border-gray-200' };
  };

  // 2. Todoist
  const getTodoistStatus = () => {
    const tod = arq.todoist;
    if (!tod) return { label: 'Não Iniciado ⚪', class: 'text-gray-500 bg-gray-50 border-gray-200' };
    if (tod.casoArquivadoNoTodoist === 'sim') return { label: 'Arquivado ✅', class: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
    if (tod.casoArquivadoNoTodoist === 'nao') return { label: 'Pendente ⚠️', class: 'text-amber-700 bg-amber-50 border-amber-100' };
    return { label: 'Não Iniciado ⚪', class: 'text-gray-500 bg-gray-50 border-gray-200' };
  };

  // 3. Gmail
  const getGmailStatus = () => {
    const gml = arq.gmail;
    if (!gml) return { label: 'Não Iniciado ⚪', class: 'text-gray-500 bg-gray-50 border-gray-200' };
    if (gml.emailsClienteArquivadosOuDeletados === 'sim') return { label: 'E-mails Organizados ✅', class: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
    if (gml.emailsClienteArquivadosOuDeletados === 'nao') return { label: 'Pendente ⚠️', class: 'text-amber-700 bg-amber-50 border-amber-100' };
    return { label: 'Não Iniciado ⚪', class: 'text-gray-500 bg-gray-50 border-gray-200' };
  };

  // 4. CRM
  const getCRMStatus = () => {
    const crm = arq.crmCliente;
    if (!crm) return { label: 'Não Iniciado ⚪', class: 'text-gray-500 bg-gray-50 border-gray-200' };
    if (crm.clienteInformadoArquivamento === 'sim') return { label: 'Notificado ✅', class: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
    if (crm.clienteInformadoArquivamento === 'nao') return { label: 'Pendente ⚠️', class: 'text-amber-700 bg-amber-50 border-amber-100' };
    return { label: 'Não Iniciado ⚪', class: 'text-gray-500 bg-gray-50 border-gray-200' };
  };

  // 5. Sheets
  const getSheetsStatus = () => {
    const sht = arq.googleSheets;
    if (!sht) return { label: 'Não Iniciado ⚪', class: 'text-gray-500 bg-gray-50 border-gray-200' };
    if (sht.formulaTodoistArquivadaGoogleSheets === 'sim') return { label: 'Registrado ✅', class: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
    if (sht.formulaTodoistArquivadaGoogleSheets === 'nao') return { label: 'Pendente ⚠️', class: 'text-amber-700 bg-amber-50 border-amber-100' };
    return { label: 'Não Iniciado ⚪', class: 'text-gray-500 bg-gray-50 border-gray-200' };
  };

  // 6. Auditoria
  const getAuditoriaStatus = () => {
    const aud = arq.auditoria;
    if (!aud) return { label: 'Não Iniciado ⚪', class: 'text-gray-500 bg-gray-50 border-gray-200' };
    if (aud.statusFinal === 'Arquivamento completo ✅') return { label: 'Completo ✅', class: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
    if (aud.statusFinal === 'Arquivamento bloqueado ❌') return { label: 'Bloqueado ❌', class: 'text-red-700 bg-red-50 border-red-100 font-bold' };
    return { label: 'Pendente ⚠️', class: 'text-amber-700 bg-amber-50 border-amber-100' };
  };

  const statusFin = getFinanceiroStatus();
  const statusTod = getTodoistStatus();
  const statusGml = getGmailStatus();
  const statusCrm = getCRMStatus();
  const statusSht = getSheetsStatus();
  const statusAud = getAuditoriaStatus();

  return (
    <FluxoStepLayout
      stepName="Arquivamento"
      caseId={caseId}
      statusText={caseObj?.statusInterno || 'Pendente de arquivamento'}
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
        <div className="bg-gray-50 border border-gray-150 rounded-3xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black tracking-wider text-indigo-500 uppercase">Fase 15 — Setor de Arquivamento</span>
              <h4 className="text-lg font-black text-gray-900 leading-tight">
                {resolvedClientName}
              </h4>
              <p className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 items-center font-semibold">
                <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">
                  {resolvedClientSlug}
                </span>
                <span>• Serviço: <strong className="text-gray-700">{caseObj?.registrationType || 'Não Definido'}</strong></span>
                <span>• Pasta: <strong className="text-gray-700">{caseObj?.pastaNumero || 'Não Informada'}</strong></span>
                <span>• ID do Caso: <strong className="font-mono text-gray-600">{caseId}</strong></span>
              </p>
            </div>
          </div>
        </div>

        {/* HUB SUB-STAGES HEADER */}
        <div className="space-y-2">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <HardDrive className="text-indigo-600" size={18} />
            Subetapas de Arquivamento Obrigatórias
          </h3>
          <p className="text-xs text-gray-500 font-medium">
            Selecione cada subetapa abaixo para realizar as conferências de controle. O arquivamento completo depende do sucesso de todas as fases.
          </p>
        </div>

        {/* 6 SUB-STAGES CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Financeiro */}
          <div
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento.financeiro`)}
            className="group bg-white border border-gray-150 hover:border-indigo-400 p-5 rounded-2xl cursor-pointer transition-all hover:shadow-md flex flex-col justify-between gap-4 h-[155px]"
          >
            <div className="space-y-1">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Subetapa 01</span>
                <DollarSign size={18} className="text-gray-400 group-hover:text-indigo-600 transition-all" />
              </div>
              <h4 className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-all uppercase tracking-wide">
                Arquivamento Financeiro
              </h4>
              <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                Verificação de saldos, taxas administrativas e conferência de pendências financeiras.
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusFin.class}`}>
                {statusFin.label}
              </span>
              <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* 2. Todoist */}
          <div
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento.todoist`)}
            className="group bg-white border border-gray-150 hover:border-indigo-400 p-5 rounded-2xl cursor-pointer transition-all hover:shadow-md flex flex-col justify-between gap-4 h-[155px]"
          >
            <div className="space-y-1">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Subetapa 02</span>
                <CheckSquare size={18} className="text-gray-400 group-hover:text-indigo-600 transition-all" />
              </div>
              <h4 className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-all uppercase tracking-wide">
                Arquivamento Todoist
              </h4>
              <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                Conclusão e encerramento de todas as pendências, prazos e tarefas de pauta no Todoist.
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusTod.class}`}>
                {statusTod.label}
              </span>
              <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* 3. Gmail */}
          <div
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento.Gmail`)}
            className="group bg-white border border-gray-150 hover:border-indigo-400 p-5 rounded-2xl cursor-pointer transition-all hover:shadow-md flex flex-col justify-between gap-4 h-[155px]"
          >
            <div className="space-y-1">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Subetapa 03</span>
                <Mail size={18} className="text-gray-400 group-hover:text-indigo-600 transition-all" />
              </div>
              <h4 className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-all uppercase tracking-wide">
                Arquivamento Gmail
              </h4>
              <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                Localização e organização da caixa de e-mails com buscas rápidas automatizadas.
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusGml.class}`}>
                {statusGml.label}
              </span>
              <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* 4. CRM — Arquivamento */}
          <div
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento.CRM.Cliente`)}
            className="group bg-white border border-gray-150 hover:border-indigo-400 p-5 rounded-2xl cursor-pointer transition-all hover:shadow-md flex flex-col justify-between gap-4 h-[155px]"
          >
            <div className="space-y-1">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Subetapa 04</span>
                <Smartphone size={18} className="text-gray-400 group-hover:text-indigo-600 transition-all" />
              </div>
              <h4 className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-all uppercase tracking-wide">
                CRM — Arquivamento
              </h4>
              <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                Mensagem e notificação formal de despedida e encerramento ao cliente final.
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusCrm.class}`}>
                {statusCrm.label}
              </span>
              <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* 5. Google Sheets */}
          <div
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento.Google.Sheets`)}
            className="group bg-white border border-gray-150 hover:border-indigo-400 p-5 rounded-2xl cursor-pointer transition-all hover:shadow-md flex flex-col justify-between gap-4 h-[155px]"
          >
            <div className="space-y-1">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Subetapa 05</span>
                <Table size={18} className="text-gray-400 group-hover:text-indigo-600 transition-all" />
              </div>
              <h4 className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-all uppercase tracking-wide">
                Google Sheets
              </h4>
              <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                Arquivamento da fórmula padrão do Todoist através do conceito Last Row.
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusSht.class}`}>
                {statusSht.label}
              </span>
              <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* 6. Auditoria */}
          <div
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento.auditoria`)}
            className="group bg-white border border-gray-150 hover:border-indigo-400 p-5 rounded-2xl cursor-pointer transition-all hover:shadow-md flex flex-col justify-between gap-4 h-[155px]"
          >
            <div className="space-y-1">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Subetapa 06</span>
                <ShieldCheck size={18} className="text-gray-400 group-hover:text-indigo-600 transition-all" />
              </div>
              <h4 className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-all uppercase tracking-wide">
                Auditoria Geral
              </h4>
              <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                Painel de conformidade e decisão final de conclusão definitiva do caso.
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusAud.class}`}>
                {statusAud.label}
              </span>
              <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </div>

        {/* PARÂMETROS GERAIS PREV-COMPATIBILIDADE */}
        <div className="bg-white rounded-3xl border border-gray-150 p-6 space-y-6">
          <h4 className="text-xs font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2 border-b border-indigo-50 pb-3">
            <HardDrive size={18} />
            Parâmetros Gerais de Arquivamento Histórico
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                  Motivo Principal do Arquivamento
                </label>
                <select
                  name="archivedReason"
                  value={archiveData.archivedReason}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-semibold focus:ring-2 focus:ring-indigo-150 cursor-pointer h-[46px]"
                >
                  {ARCHIVE_REASONS.map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                  Responsável pelo Arquivamento Geral
                </label>
                <input
                  type="text"
                  name="archivedResponsible"
                  value={archiveData.archivedResponsible}
                  onChange={handleChange}
                  placeholder="Nome do advogado ou controlador..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-indigo-150 h-[46px]"
                />
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isArchivedConfirmed"
                    checked={archiveData.isArchivedConfirmed}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 rounded text-indigo-600 border-indigo-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
                    Caso Considerado Arquivado Definitivamente
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                Memória de Arquivamento e Observações Gerais
              </label>
              <textarea
                name="archivedNotes"
                rows={6}
                value={archiveData.archivedNotes}
                onChange={handleChange}
                placeholder="Registrar um resumo de como se encerrou o processo, valores totais levantados, expedição de alvarás pendentes, ou detalhes cruciais de fechamento de pasta..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-indigo-150"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveGeneral}
              className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save size={13} />
              {saving ? 'Gravando...' : 'Salvar Parâmetros Gerais'}
            </button>
          </div>
        </div>

        {/* LOGS DE AUDITORIA DE REVISÃO DA PASTA */}
        {caseObj?.arquivamentoSubetapaLogs && caseObj.arquivamentoSubetapaLogs.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-300 space-y-4 shadow-inner">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider flex items-center gap-2 font-mono">
                <Terminal size={16} className="text-teal-400" />
                Histórico de Auditorias & logs das Subetapas
              </h3>
              <Clock size={15} className="text-slate-500" />
            </div>

            <div className="max-h-[220px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {caseObj.arquivamentoSubetapaLogs.map((log: any, index: number) => (
                <div key={index} className="p-3 bg-slate-950/70 border border-slate-850 rounded-xl font-mono text-[11px] leading-relaxed space-y-1">
                  <div className="flex justify-between items-center text-teal-400 border-b border-slate-900 pb-1">
                    <span className="font-bold">{log.subetapa}</span>
                    <span className="text-[9px] text-slate-500">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold">Ação:</span> <span className="text-slate-200">{log.action}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold">Detalhes:</span> <span className="text-slate-300">{log.details}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BOTTOM CONTROLS & NAVIGATION */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(flowRoutes.relatorioIntegridade(caseId!))}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            <ArrowLeft size={14} />
            Voltar para Relatório de Integridade
          </button>

          <button
            type="button"
            onClick={() => navigate(flowRoutes.recadastramento())}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
          >
            <span>Ir para Recadastramento</span>
            <ArrowRight size={14} />
          </button>
        </div>

      </div>
    </FluxoStepLayout>
  );
}
