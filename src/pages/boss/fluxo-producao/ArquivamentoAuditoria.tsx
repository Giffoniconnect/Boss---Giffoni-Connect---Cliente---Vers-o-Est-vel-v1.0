import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  Terminal,
  Clock,
  Sparkles,
  Lock,
  Unlock
} from 'lucide-react';

export default function ArquivamentoAuditoria() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

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

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados de auditoria de arquivamento: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  if (loading) {
    return (
      <FluxoStepLayout stepName="Arquivamento" caseId={caseId}>
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-bold font-mono text-gray-500 tracking-wide uppercase">
            Carregando Auditoria de Arquivamento...
          </span>
        </div>
      </FluxoStepLayout>
    );
  }

  // Extract previous sub-stage data safely
  const arq = caseObj?.arquivamento || {};
  const fin = arq.financeiro || {};
  const tod = arq.todoist || {};
  const gml = arq.gmail || {};
  const crm = arq.crmCliente || {};
  const sht = arq.googleSheets || {};

  // Resolve questions answers
  const isFinanceiroOk = fin.haPendenciaFinanceira === 'nao';
  const isGmailOk = gml.emailsClienteArquivadosOuDeletados === 'sim';
  const isCrmOk = crm.clienteInformadoArquivamento === 'sim';
  const isTodoistOk = tod.casoArquivadoNoTodoist === 'sim';
  const isSheetsOk = sht.formulaTodoistArquivadaGoogleSheets === 'sim';

  // Checklist items
  const items = {
    financeiroVerificado: isFinanceiroOk,
    gmailVerificado: isGmailOk,
    crmClienteFeito: isCrmOk,
    todoistArquivado: isTodoistOk,
    googleSheetsArquivado: isSheetsOk,
    
    // Complementary items
    emailConferido: gml.emailConferido === true,
    todoistAtualizado: tod.todoistAtualizado === true,
    financeiroAtualizado: fin.financeiroVerificado === true,
    crmDespedida: crm.crmDespedidaFeito === true,
    googleSheetsAutomaticamenteAtualizado: sht.googleSheetsAtualizado === true
  };

  // Determine blockers
  const isBlockedFinanceiro = fin.haPendenciaFinanceira === 'sim';
  const isBlockedCrm = crm.clienteInformadoArquivamento === 'nao';
  const isBlockedTodoist = tod.casoArquivadoNoTodoist === 'nao';
  const isBlockedSheets = sht.formulaTodoistArquivadaGoogleSheets === 'nao';

  const isBlocked = isBlockedFinanceiro || isBlockedCrm || isBlockedTodoist || isBlockedSheets;

  // Determine complete status
  const isAllRequiredOk = isFinanceiroOk && isCrmOk && isTodoistOk && isSheetsOk;

  let statusFinal = 'Arquivamento pendente ⚠️';
  let statusBadgeColor = 'text-amber-700 bg-amber-50 border-amber-200';
  let statusIcon = <AlertTriangle className="text-amber-500" size={20} />;

  if (isBlocked) {
    statusFinal = 'Arquivamento bloqueado ❌';
    statusBadgeColor = 'text-red-700 bg-red-50 border-red-200';
    statusIcon = <Lock className="text-red-500" size={20} />;
  } else if (isAllRequiredOk) {
    statusFinal = 'Arquivamento completo ✅';
    statusBadgeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    statusIcon = <ShieldCheck className="text-emerald-500" size={20} />;
  }

  const handleFinalize = async () => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const now = new Date().toISOString();

      // Setup update data
      const existingArquivamento = caseObj?.arquivamento || {};
      const updatedArquivamento = {
        ...existingArquivamento,
        auditoria: {
          financeiroVerificado: items.financeiroVerificado,
          gmailVerificado: items.gmailVerificado,
          crmClienteFeito: items.crmClienteFeito,
          todoistArquivado: items.todoistArquivado,
          googleSheetsArquivado: items.googleSheetsArquivado,
          emailConferido: items.emailConferido,
          todoistAtualizado: items.todoistAtualizado,
          financeiroAtualizado: items.financeiroAtualizado,
          crmDespedida: items.crmDespedida,
          googleSheetsAutomaticamenteAtualizado: items.googleSheetsAutomaticamenteAtualizado,
          statusFinal
        }
      };

      const logEntry = {
        timestamp: now,
        subetapa: 'Subetapa 06 — Auditoria do Arquivamento',
        action: 'Finalizar Auditoria de Arquivamento',
        details: `Status final determinado: ${statusFinal}`
      };

      const updatedLogs = [
        ...(caseObj?.arquivamentoSubetapaLogs || []),
        logEntry
      ];

      // If complete, we can actually mark the whole case as archived
      const isComplete = statusFinal === 'Arquivamento completo ✅';
      
      const updatePayload: any = {
        arquivamento: updatedArquivamento,
        arquivamentoSubetapaLogs: updatedLogs,
        updatedAt: now
      };

      if (isComplete) {
        updatePayload.archived = true;
        updatePayload.statusInterno = 'Arquivado';
        updatePayload.productionStage = 'arquivamento';
        updatePayload.archivedAt = now;
      } else {
        // If not complete, keep the current status unless it was already archived
        updatePayload.archived = false;
        if (caseObj.statusInterno === 'Arquivado') {
          updatePayload.statusInterno = 'Pendente de arquivamento';
        }
      }

      await updateDoc(doc(db, 'cases', caseId!), updatePayload);

      setCaseObj((prev: any) => ({
        ...prev,
        ...updatePayload
      }));

      setSuccess(
        isComplete
          ? 'Arquivamento finalizado com sucesso! O caso foi marcado como Arquivado.'
          : 'Auditoria de arquivamento salva com status de rascunho.'
      );

      setTimeout(() => {
        navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento`);
      }, 1200);

    } catch (err: any) {
      console.error(err);
      setError(`Erro ao finalizar auditoria de arquivamento: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const resolvedClientName = client
    ? (client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true
        ? (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Razão Social Ausente')
        : (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Cadastro Sem Nome'))
    : 'Buscando Cliente...';

  return (
    <FluxoStepLayout
      stepName="Arquivamento"
      caseId={caseId}
      statusText={caseObj?.statusInterno || 'Em arquivamento'}
    >
      <div className="space-y-8 font-sans">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 pb-5">
          <div className="space-y-1">
            <span className="text-[10px] font-black tracking-wider text-indigo-500 uppercase">Subetapa 06 de 06</span>
            <h2 id="page-title" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <FileCheck2 className="text-indigo-600" size={24} />
              Auditoria do Arquivamento
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Painel de conformidade — valide as conferências obrigatórias e autorize o encerramento seguro deste processo.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento`)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all cursor-pointer self-start"
          >
            <ArrowLeft size={14} />
            Voltar para o Hub
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-950 text-xs flex gap-3 items-center">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-950 text-xs flex gap-3 items-center">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        {/* STATUS FINAL PANEL */}
        <div className={`p-6 border rounded-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${statusBadgeColor}`}>
          <div className="flex items-center gap-3">
            {statusIcon}
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-60 block">Status Final da Auditoria</span>
              <span className="text-sm font-black uppercase tracking-tight">{statusFinal}</span>
            </div>
          </div>
          <div className="text-xs font-medium max-w-md">
            {statusFinal === 'Arquivamento completo ✅' && (
              <p className="text-emerald-800">
                Excelente! Todas as etapas essenciais foram validadas. O caso está apto a ser finalizado definitivamente.
              </p>
            )}
            {statusFinal === 'Arquivamento pendente ⚠️' && (
              <p className="text-amber-800">
                Existem conferências com status pendente. Você pode salvar um rascunho de progresso, mas a conclusão final exige que todos os itens estejam válidos.
              </p>
            )}
            {statusFinal === 'Arquivamento bloqueado ❌' && (
              <p className="text-red-800 font-semibold">
                <strong>Bloqueio Ativo:</strong> Há pendência financeira em aberto ou o cliente não foi avisado. A conclusão do arquivamento está bloqueada.
              </p>
            )}
          </div>
        </div>

        {/* AUDIT CHECKLISTS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* OBRIGATORIAS */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-gray-100 pb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 block"></span>
              Conferências Obrigatórias
            </h3>

            <div className="space-y-3.5">
              {/* 1. Financeiro */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-800 block">1. Financeiro verificado?</span>
                  <span className="text-[10px] text-gray-400 font-medium block">Não deve haver pendências em aberto</span>
                </div>
                <span className="text-base">{items.financeiroVerificado ? '✅' : '❌'}</span>
              </div>

              {/* 2. Gmail */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-800 block">2. Gmail verificado?</span>
                  <span className="text-[10px] text-gray-400 font-medium block">E-mails arquivados/deletados com sucesso</span>
                </div>
                <span className="text-base">{items.gmailVerificado ? '✅' : '❌'}</span>
              </div>

              {/* 3. CRM */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-800 block">3. CRM cliente feito?</span>
                  <span className="text-[10px] text-gray-400 font-medium block">Avisar o cliente do encerramento do caso</span>
                </div>
                <span className="text-base">{items.crmClienteFeito ? '✅' : '❌'}</span>
              </div>

              {/* 4. Todoist */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-800 block">4. Caso arquivado no Todoist?</span>
                  <span className="text-[10px] text-gray-400 font-medium block">Tarefas e prazos concluídos na pauta</span>
                </div>
                <span className="text-base">{items.todoistArquivado ? '✅' : '❌'}</span>
              </div>

              {/* 5. Google Sheets */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-800 block">5. Caso arquivado no Google Sheets?</span>
                  <span className="text-[10px] text-gray-400 font-medium block">Dados exportados para planilha corporativa</span>
                </div>
                <span className="text-base">{items.googleSheetsArquivado ? '✅' : '❌'}</span>
              </div>
            </div>
          </div>

          {/* COMPLEMENTAR */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-gray-100 pb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 block"></span>
              Conferências Complementares
            </h3>

            <div className="space-y-3.5">
              {/* 1. E-mail Conferido */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-800 block">E-mail conferido?</span>
                  <span className="text-[10px] text-gray-400 font-medium block">Mapeamento concluído na Caixa de Entrada</span>
                </div>
                <span className="text-base">{items.emailConferido ? '✅' : '❌'}</span>
              </div>

              {/* 2. Todoist Atualizado */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-800 block">Todoist atualizado?</span>
                  <span className="text-[10px] text-indigo-600 font-bold block flex items-center gap-1">
                    <Sparkles size={11} />
                    Pensar em automatizar
                  </span>
                </div>
                <span className="text-base">{items.todoistAtualizado ? '✅' : '❌'}</span>
              </div>

              {/* 3. Financeiro Atualizado */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-800 block">Financeiro atualizado?</span>
                  <span className="text-[10px] text-indigo-600 font-bold block flex items-center gap-1">
                    <Sparkles size={11} />
                    Pensar em automatizar
                  </span>
                </div>
                <span className="text-base">{items.financeiroAtualizado ? '✅' : '❌'}</span>
              </div>

              {/* 4. CRM Despedida */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-800 block">CRM de despedida?</span>
                  <span className="text-[10px] text-gray-400 font-medium block">Contato de despedida devidamente registrado</span>
                </div>
                <span className="text-base">{items.crmDespedida ? '✅' : '❌'}</span>
              </div>

              {/* 5. Sheets Atualizado */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-800 block">Google Sheets automaticamente atualizado?</span>
                  <span className="text-[10px] text-gray-400 font-medium block">Planilha registrada no conceito Last Row</span>
                </div>
                <span className="text-base">{items.googleSheetsAutomaticamenteAtualizado ? '✅' : '❌'}</span>
              </div>
            </div>
          </div>

        </div>

        {/* LOG TECNICO COMPONENTE */}
        <div className="border border-gray-150 rounded-3xl p-6 bg-slate-900 text-teal-400 shadow-inner space-y-2">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Terminal size={16} />
            <span className="text-xs font-black uppercase text-slate-300 font-mono tracking-wider">
              Automação & Logs de Audit
            </span>
          </div>
          <p className="text-[11px] font-mono leading-relaxed text-slate-400">
            [AUDITOR_ENGINE] Status: <span className={isBlocked ? 'text-rose-400' : isAllRequiredOk ? 'text-emerald-400' : 'text-amber-400'}>{statusFinal.toUpperCase()}</span>
          </p>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento`)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            Voltar para o Hub
          </button>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={saving}
              onClick={handleFinalize}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm text-white ${
                isBlocked
                  ? 'bg-slate-350 cursor-not-allowed opacity-60'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
              title={isBlocked ? 'Arquivamento bloqueado por pendências críticas' : 'Concluir e Arquivar Caso'}
            >
              {isBlocked ? (
                <>
                  <Lock size={14} />
                  <span>Arquivamento Bloqueado</span>
                </>
              ) : (
                <>
                  <Unlock size={14} />
                  <span>{isAllRequiredOk ? 'Finalizar e Concluir Arquivamento' : 'Salvar Parecer de Auditoria'}</span>
                </>
              )}
              <Loader2 className={saving ? 'animate-spin ml-1' : 'hidden'} size={14} />
            </button>
          </div>
        </div>

      </div>
    </FluxoStepLayout>
  );
}
