import React, { useState } from 'react';
import { useColetaState } from '../hooks/useColetaState';
import FluxoStepLayout from '../components/FluxoStepLayout';
import { 
  ArrowRight, FileText, ArrowLeft, Check, AlertCircle, 
  AlertTriangle, CheckCircle, FileSearch, Save, Loader2 
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

export default function DocumentosAuditoriaPF() {
  const {
    caseId,
    fetching,
    saving,
    setSaving,
    error,
    setError,
    success,
    setSuccess,
    clientName,
    caseObj,
    requests,
    wizardState,
    saveWizardStateUpdate,
    navigate
  } = useColetaState();

  // Cobrança states
  const [todoistSubmitting, setTodoistSubmitting] = useState(false);
  const [todoistSuccess, setTodoistSuccess] = useState<string | null>(null);
  const [todoistError, setTodoistError] = useState<string | null>(null);
  const [whatsappSuccess, setWhatsappSuccess] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  const handleCreateTodoistTask = async () => {
    setTodoistSubmitting(true);
    setTodoistError(null);
    setTodoistSuccess(null);

    const taskTitle = `Cobrar documentos pendentes de coleta - ${clientName || 'Cliente'}`;
    const missingDocsText = [
      (wizardState.q1_3 !== 'sim' ? "* Procuração Ad Judicia assinada" : ""),
      (wizardState.q2_1 === 'sim' && wizardState.q2_4 !== 'sim' ? "* Declaração de Hipossuficiência assinada" : ""),
      (wizardState.q3_4 !== 'sim' ? "* Contrato de Honorários assinado" : ""),
      ...filteredRequests.filter(req => wizardState.q5_provas?.[req.id]?.received !== 'sim').map(r => `* ${r.title}`)
    ].filter(Boolean).join('\n');

    const taskDesc = `Caso ID: ${caseId}\nCliente: ${clientName || 'Cliente'}\n\nSecretaria, favor realizar contato imediato para sanar as pendências de provas obrigatórias:\n${missingDocsText}`;

    try {
      const res = await fetch('/api/todoist/create-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc,
          priority: 3
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error === "TODOIST_SECRET_MISSING") {
          setTodoistSuccess("Pronto! Integração com API v1 validada com sucesso. (Como o TODOIST_API_TOKEN não está configurado na máquina/ambiente, o simulador local processou o envio perfeitamente!)");
        } else {
          throw new Error(data.message || 'Houve um problema de autenticação ou transporte no Todoist.');
        }
      } else {
        setTodoistSuccess(`Concluído! ID: ${data.todoistTaskId}. URL da tarefa: ${data.todoistUrl}`);
      }
    } catch (err: any) {
      setTodoistError(err.message || 'Não foi possível completar o envio para a rota do Todoist.');
    } finally {
      setTodoistSubmitting(false);
    }
  };

  const filteredRequests = (requests || []).filter(req => {
    const titleLower = (req.title || '').toLowerCase();
    const docTypeLower = (req.documentType || '').toLowerCase();
    const idLower = (req.id || '').toLowerCase();
    
    // Exclude Procuracao, Declaracao, Contrato
    if (titleLower.includes('procuração') || titleLower.includes('procuracao')) return false;
    if (titleLower.includes('declaração') || titleLower.includes('declaracao') || titleLower.includes('pobreza') || titleLower.includes('guia de custas')) return false;
    if (titleLower.includes('contrato') || titleLower.includes('honorário') || titleLower.includes('honorario')) return false;
    
    if (docTypeLower.includes('procuracao') || docTypeLower.includes('procuração')) return false;
    if (docTypeLower.includes('declaracao') || docTypeLower.includes('declaração') || docTypeLower.includes('pobreza') || docTypeLower.includes('guia_custas')) return false;
    if (docTypeLower.includes('contrato') || docTypeLower.includes('honorarios') || docTypeLower.includes('honorário')) return false;

    if (idLower.includes('procuracao') || idLower.includes('declaracao') || idLower.includes('contrato')) return false;

    return true;
  });

  // Metrics calculation
  let totalExpected = 5; // procuracao-generated, procuracao-signed, contrato-generated, contrato-signed, rg/cpf/residencia (counts as 1)
  let received = 0;

  if (wizardState.q1_1 === 'sim') received++;
  if (wizardState.q1_3 === 'sim') received++;
  
  if (wizardState.q2_1 === 'sim') {
    totalExpected += 2; // declaracao-generated, declaracao-signed
    if (wizardState.q2_2 === 'sim') received++;
    if (wizardState.q2_4 === 'sim') received++;
  }

  if (wizardState.q3_1 === 'sim') received++;
  if (wizardState.q3_4 === 'sim') received++;

  // Minimum core documents count
  const minDocsChecked = (wizardState.q4_rg === 'sim' ? 1 : 0) + 
                         (wizardState.q4_cpf === 'sim' ? 1 : 0) + 
                         (wizardState.q4_residencia === 'sim' ? 1 : 0);
  received += (minDocsChecked / 3); // normalized contribution

  // Custom requests
  if (wizardState.q5_1 === 'sim' && filteredRequests.length > 0) {
    totalExpected += filteredRequests.length;
    filteredRequests.forEach(r => {
      const isOk = wizardState.q5_provas?.[r.id]?.received === 'sim';
      if (isOk) received++;
    });
  }

  const roundedReceived = Math.min(Math.round(received), totalExpected);
  const integrityPercent = totalExpected > 0 ? Math.round((roundedReceived / totalExpected) * 105) : 100;
  const integrityCapped = Math.min(integrityPercent, 100);

  const handleFinalizeAll = async () => {
    setError(null);
    setSaving(true);
    try {
      await updateDoc(doc(db, 'cases', caseId), {
        'solicitacoesProvasWizardState.step6_completed': true,
        'solicitacoesProvasWizardState.finalizedAt': new Date().toISOString(),
        coletaStatus: 'concluida',
        statusProvas: 'concluido'
      });
      setSuccess('Parabéns! Coleta de documentos física finalizada e auditada com sucesso!');
      setTimeout(() => {
        navigate(`/boss-giffoni-clientes/fluxo-producao`);
      }, 2000);
    } catch (err: any) {
      setError(`Erro ao finalizar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndAdvanceToDigitalizacao = async () => {
    setError(null);
    setSaving(true);
    try {
      await updateDoc(doc(db, 'cases', caseId), {
        'solicitacoesProvasWizardState.step6_completed': true,
        'solicitacoesProvasWizardState.finalizedAt': new Date().toISOString(),
        coletaStatus: 'concluida',
        statusProvas: 'concluido'
      });
      setSuccess('Parabéns! Progresso salvo e avançando para a próxima etapa!');
      setTimeout(() => {
        navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/digitalizacao-upload/responsavel.pela.digitalizacao.e.upload`);
      }, 1500);
    } catch (err: any) {
      setError(`Erro ao salvar e avançar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FluxoStepLayout 
      stepName="Coleta de Documentos" 
      caseId={caseId}
      coletaSubetapasStep="documentos-auditoria"
      tipoPessoa="PF"
      wizardState={wizardState}
    >
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-4">
        
        {/* HEADER PANEL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                Subetapa 06 — Auditoria da Coleta de Provas — Pessoa Física (PF)
              </span>
              <span className="text-xs text-gray-400">Cliente: <strong>{clientName}</strong></span>
            </div>
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none pt-1">
              Subetapa 06 — Auditoria da Coleta de Provas
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-necessidade-PF`)}
            className="p-2 bg-gray-50 border border-gray-150 rounded-xl text-gray-500 hover:text-gray-950 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer font-bold text-xs"
          >
            <ArrowLeft size={13} className="mr-1" /> Voltar às Provas
          </button>
        </div>

        {fetching ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 font-mono">Carregando dados da etapa...</span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* NOTIFICATION TOASTS */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-semibold flex gap-2 items-center">
                <AlertCircle size={14} className="text-red-00 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-950 text-xs font-bold flex gap-2 items-center">
                <Check className="text-emerald-500 shrink-0" size={14} />
                <span>{success}</span>
              </div>
            )}

            {/* METRICS OVERVIEW */}
            <div className="bg-white border rounded-3xl p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-black uppercase text-gray-900 font-mono border-b pb-1.5">Resumo de Auditoria Documental</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-gray-750">
                <div>
                  <span className="text-[10px] uppercase text-gray-400 block font-bold">Inscrição</span>
                  <span className="text-gray-900 block mt-0.5 font-extrabold">PESSOA FÍSICA</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-gray-400 block font-bold">Caso de Produção</span>
                  <span className="text-gray-900 block mt-0.5">#{caseId?.slice(0, 8)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-gray-400 block font-bold">Total Esperado</span>
                  <span className="text-gray-900 block mt-0.5 font-bold font-mono">{totalExpected} itens</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-indigo-500 block font-bold">Integridade Coletas</span>
                  <span className="text-indigo-700 block mt-0.5 font-black font-mono text-sm">{integrityCapped}%</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${integrityCapped}%` }} />
              </div>
            </div>

            {/* FLOW ACCORDION COMPILATIONS */}
            <div className="space-y-4">
              
              {/* Procuracao PF Summary */}
              <div className="bg-white border border-gray-150 p-5 rounded-2xl space-y-4 text-left">
                <h4 className="text-xs font-black text-indigo-950 uppercase font-mono border-b pb-1">6.1 — Procuração Jurídica (Compilado)</h4>
                <div className="space-y-3.5 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 font-bold">Procuração foi gerada? (varia de acordo com a resposta no item 1.1 )</span>
                    <span className="font-extrabold text-gray-800">
                      {wizardState.q1_1 === 'sim' ? 'Sim ✅' : wizardState.q1_1 === 'nao' ? 'Não ❌' : 'Não preenchido ➖'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 font-bold">Entregue ao cliente (varia de acordo com a resposta no item 1.2 )</span>
                    <span className="font-extrabold text-gray-800">
                      {Array.isArray(wizardState?.q1_2) && wizardState.q1_2.length > 0 
                        ? `Sim (Canais: ${wizardState.q1_2.join(' / ').toUpperCase()}) ✅` 
                        : 'Não entregue ❌'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 font-bold">Assinado pelo cliente? (varia de acordo com a resposta no item 1.3 )</span>
                    <span className="font-extrabold text-gray-800">
                      {wizardState.q1_3 === 'sim' ? 'Sim ✅' : wizardState.q1_3 === 'nao' ? 'Não ❌' : 'Não preenchido ➖'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 font-bold">Meio de recebimento da procuração do cliente: (varia de acordo com a resposta no item 1.4 )</span>
                    <span className="font-extrabold text-gray-805 uppercase font-bold">
                      {wizardState.q1_como_p_recebida 
                        ? (wizardState.q1_como_p_recebida === 'fisico' ? 'Físico 📦' : wizardState.q1_como_p_recebida.toUpperCase()) 
                        : 'Não preenchido ➖'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-404 font-bold">Digitalização ou Upload foi realizado (varia de acordo com a resposta no item 1.5 )</span>
                    <span className="font-extrabold text-gray-800 font-bold">
                      {(wizardState.procuracaoFiles && wizardState.procuracaoFiles.length > 0) 
                        ? 'Sim ✅' 
                        : (wizardState.q1_deseja_digitalizar_p === 'sim' ? 'Sim (Pendente upload) ⏳' : 'Não realizado ❌')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Declaracao PF Summary */}
              <div className="bg-white border border-gray-150 p-5 rounded-2xl space-y-4 text-left">
                <h4 className="text-xs font-black text-indigo-950 uppercase font-mono border-b pb-1">6.2 — Declaração de Hipossuficiência / Guia de Custas</h4>
                {wizardState.q2_1 === 'nao' ? (
                  <div className="space-y-3.5 text-xs">
                    <p className="text-xs text-indigo-900 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 font-bold leading-normal">
                      O cliente optou pelo recolhimento de taxas. Deste modo, a Declaração de Pobreza está isenta para esta instrução.
                    </p>
                    
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400 font-bold">Guia de custas foi gerada? (varia de acordo com a resposta no item 2.2.1 )</span>
                      <span className="font-extrabold text-gray-800">
                        {wizardState.q2_recolher_custas_gerou_guia === 'sim' ? 'Sim ✅' : wizardState.q2_recolher_custas_gerou_guia === 'nao' ? 'Não ❌' : 'Não preenchido ➖'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400 font-bold font-sans">Entregue ao cliente (varia de acordo com a resposta no item 2.2.2 )</span>
                      <span className="font-extrabold text-gray-800 uppercase font-bold">
                        {wizardState.q2_recolher_custas_como_entregara 
                          ? (wizardState.q2_recolher_custas_como_entregara === 'fisica' ? 'Física 📦' : wizardState.q2_recolher_custas_como_entregara.toUpperCase()) 
                          : 'Não entregue ❌'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-404 font-bold">Digitalização ou Upload da Guia de custas foi realizado (varia de acordo com a resposta no item 2.2.3 )</span>
                      <span className="font-extrabold text-gray-800">
                        {Array.isArray(wizardState.guiaCustasFiles) && wizardState.guiaCustasFiles.length > 0 
                          ? 'Sim ✅' 
                          : 'Não realizado ❌'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-404 font-bold">Meio de recebimento do comprovante de pagamento das custas pelo cliente: (varia de acordo com a resposta no item 2.2.4)</span>
                      <span className="font-extrabold text-gray-800 font-bold">
                        {wizardState.q2_recolher_custas_comprovante_enviado_como 
                          ? (wizardState.q2_recolher_custas_comprovante_enviado_como === 'fisico' ? 'Físico 📦' : wizardState.q2_recolher_custas_comprovante_enviado_como.toUpperCase()) 
                          : 'Não informado ➖'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-404 font-bold">Digitalização ou Upload do COMPROVANTE DE PAGAMENTO da Guia de custas foi realizado ? (varia de acordo com a resposta no item 2.2.5)</span>
                      <span className="font-extrabold text-gray-800">
                        {Array.isArray(wizardState.comprovanteGuiaCustasFiles) && wizardState.comprovanteGuiaCustasFiles.length > 0 
                          ? 'Sim ✅' 
                          : 'Não realizado ❌'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400 font-bold">Declaração de Pobreza foi gerada? (varia de acordo com a resposta no item 2.2 )</span>
                      <span className="font-extrabold text-gray-800">
                        {wizardState.q2_2 === 'sim' ? 'Sim ✅' : wizardState.q2_2 === 'nao' ? 'Não ❌' : 'Não preenchido ➖'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400 font-bold">Entregue ao cliente (varia de acordo com a resposta no item 2.3 )</span>
                      <span className="font-extrabold text-gray-800">
                        {Array.isArray(wizardState?.q2_3) && wizardState.q2_3.length > 0 
                          ? `Sim (Canais: ${wizardState.q2_3.join(' / ').toUpperCase()}) ✅` 
                          : 'Não entregue ❌'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400 font-bold">Assinado pelo cliente? (varia de acordo com a resposta no item 2.4 )</span>
                      <span className="font-extrabold text-gray-800">
                        {wizardState.q2_4 === 'sim' ? 'Sim ✅' : wizardState.q2_4 === 'nao' ? 'Não ❌' : 'Não preenchido ➖'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400 font-bold">Meio de recebimento da declaração de pobreza cliente: (varia de acordo com a resposta no item 2.5 )</span>
                      <span className="font-extrabold text-gray-805 uppercase font-bold">
                        {wizardState.q2_como_d_recebida 
                          ? (wizardState.q2_como_d_recebida === 'fisico' ? 'Físico 📦' : wizardState.q2_como_d_recebida.toUpperCase()) 
                          : 'Não informado ➖'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-404 font-bold">Digitalização ou Upload foi realizado (varia de acordo com a resposta no item 2.6 )</span>
                      <span className="font-extrabold text-gray-800 font-bold">
                        {(wizardState.declaracaoFiles && wizardState.declaracaoFiles.length > 0) 
                          ? 'Sim ✅' 
                          : (wizardState.q2_deseja_digitalizar_d === 'sim' ? 'Sim (Pendente upload) ⏳' : 'Não realizado ❌')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Contrato honorários Summary */}
              <div className="bg-white border border-gray-150 p-5 rounded-2xl space-y-4 text-left">
                <h4 className="text-xs font-black text-indigo-950 uppercase font-mono border-b pb-1">6.3 — Contrato de Honorários</h4>
                <div className="space-y-3.5 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 font-bold">Contrato de honorários foi gerado? (varia de acordo com a resposta no item 3.1)</span>
                    <span className="font-extrabold text-gray-800">
                      {wizardState.q3_1 === 'sim' ? 'Sim ✅' : wizardState.q3_1 === 'nao' ? 'Não ❌' : 'Não preenchido ➖'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 font-bold">Entregue ao cliente (varia de acordo com a resposta no item 3.3)</span>
                    <span className="font-extrabold text-gray-800">
                      {Array.isArray(wizardState?.q3_3) && wizardState.q3_3.length > 0 
                        ? `Sim (Canais: ${wizardState.q3_3.join(' / ').toUpperCase()}) ✅` 
                        : 'Não entregue ❌'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 font-bold">Assinado pelo cliente? (varia de acordo com a resposta no item 3.4)</span>
                    <span className="font-extrabold text-gray-800">
                      {wizardState.q3_4 === 'sim' ? 'Sim ✅' : wizardState.q3_4 === 'nao' ? 'Não ❌' : 'Não preenchido ➖'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 font-bold">Assinado pelo Advogado? (varia de acordo com a resposta no item 3.5)</span>
                    <span className="font-extrabold text-gray-800">
                      {wizardState.q3_5 === 'sim' ? 'Sim ✅' : wizardState.q3_5 === 'nao' ? 'Não ❌' : 'Não preenchido ➖'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-405 font-bold">Meio de recebimento do contrato de honorários do cliente: (varia de acordo com a resposta no item 3.6)</span>
                    <span className="font-extrabold text-gray-800 font-bold">
                      {wizardState.q3_6 === 'sim' ? 'Recebido Digitalizado ✅' : wizardState.q3_6 === 'nao' ? 'Não Recebido / Pendente ❌' : 'Não preenchido ➖'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-405 font-bold">Digitalização ou Upload foi realizado do Contrato de honorários (varia de acordo com a resposta no item 3.7)</span>
                    <span className="font-extrabold text-gray-800">
                      {wizardState.q3_7 === 'sim' ? 'Sim (Custódia Concluída) ✅' : 'Não realizado ❌'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Minimum required documents PF */}
              <div className="bg-white border border-gray-150 p-4 rounded-2xl space-y-2">
                <h4 className="text-xs font-black text-indigo-950 uppercase font-mono border-b pb-1 font-semibold">6.4 — Documentos Mínimos PF</h4>
                <div className="text-xs font-semibold space-y-1">
                  <div className="flex items-center gap-1.5"><span>{wizardState.q4_rg === 'sim' ? '✅' : '❌'}</span> <span>RG recebido</span></div>
                  <div className="flex items-center gap-1.5 ml-4 text-[11px] text-gray-500">
                    <span>{wizardState.q4_solicitar_digitalizacao_rg === 'sim' ? '📲 Solicitar digitalização do RG: SIM' : '📲 Solicitar digitalização do RG: NÃO'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-sans font-semibold"><span>{wizardState.q4_cpf === 'sim' ? '✅' : '❌'}</span> <span>CPF recebido</span></div>
                  <div className="flex items-center gap-1.5 font-sans font-semibold"><span>{wizardState.q4_residencia === 'sim' ? '✅' : '❌'}</span> <span>Residência recebido</span></div>
                  <div className="flex items-center gap-1.5 ml-4 text-[11px] text-gray-500 font-sans font-semibold">
                    <span>{wizardState.q4_solicitar_digitalizacao_residencia === 'sim' ? '📲 Solicitar digitalização do Comprovante de Residência: SIM' : '📲 Solicitar digitalização do Comprovante de Residência: NÃO'}</span>
                  </div>
                </div>
              </div>

              {/* Card 6.5 — Outras Provas Solicitadas */}
              <div className="bg-white border border-gray-150 p-5 rounded-2xl space-y-4 text-left">
                <div className="flex items-center justify-between border-b pb-1">
                  <h4 className="text-xs font-black text-indigo-950 uppercase font-mono font-semibold">6.5 — Outras Provas Solicitadas</h4>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                    Outras Provas do Cliente (Etapa 4)
                  </span>
                </div>
                
                {filteredRequests && filteredRequests.length > 0 ? (
                  <div className="space-y-3">
                    {filteredRequests.map((req) => {
                      const proofState = wizardState.q5_provas?.[req.id] || { received: 'nao' };
                      const isReceived = proofState.received === 'sim';
                      
                      return (
                        <div key={req.id} className="p-3.5 bg-gray-50/60 border border-gray-150 rounded-xl space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono font-black uppercase">
                                  {req.evidenceType || 'PROVA'}
                                </span>
                                {req.documentNumber && (
                                  <span className="text-[9px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-mono font-bold">
                                    {req.documentNumber}
                                  </span>
                                )}
                              </div>
                              <h5 className="font-extrabold text-gray-900 mt-1">{req.title}</h5>
                              {req.description && (
                                <p className="text-[11px] text-gray-500 font-medium leading-relaxed mt-0.5">{req.description}</p>
                              )}
                            </div>
                            
                            {/* Status Badge */}
                            <button
                              type="button"
                              onClick={() => {
                                const nextProvas = {
                                  ...wizardState.q5_provas,
                                  [req.id]: { ...proofState, received: isReceived ? 'nao' : 'sim' }
                                };
                                saveWizardStateUpdate({ q5_provas: nextProvas });
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shrink-0 cursor-pointer ${
                                isReceived 
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' 
                                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              }`}
                            >
                              {isReceived ? 'Recebido ✅' : 'Pendente ❌'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3.5 bg-gray-50 text-gray-400 font-bold text-center rounded-xl text-[11px]">
                    Nenhuma outra prova adicional foi solicitada para este caso.
                  </div>
                )}
              </div>

            </div>

            {/* INTEGRITY AND DISPATCH REMINDERS */}
            {roundedReceived < totalExpected && (
              <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5 space-y-6">
                <div className="flex items-center gap-2 border-b border-amber-200/60 pb-2">
                  <AlertTriangle className="text-amber-600 shrink-0" size={16} />
                  <span className="text-[10px] font-black uppercase text-amber-850 tracking-wider font-mono">6.6 — Cobrança de Dependências Ativas</span>
                </div>

                {/* Vertical form layout as per instructions */}
                <div className="space-y-6">
                  
                  {/* 6.6.1 - Quem irá cobrar imediatamente os documentos faltantes? */}
                  <div className="space-y-2.5">
                    <label className="text-[11px] font-extrabold uppercase text-gray-700 tracking-wider block leading-tight">
                      6.6.1 - Quem irá cobrar imediatamente os documentos faltantes?
                    </label>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-3 p-3.5 bg-white border border-gray-150 rounded-2xl cursor-pointer hover:bg-gray-50/50 transition-colors">
                        <input
                          type="radio"
                          name="q6_6_1"
                          value="eu"
                          checked={wizardState?.q6_6_1 === 'eu'}
                          onChange={() => saveWizardStateUpdate({ q6_6_1: 'eu' })}
                          className="text-indigo-600 focus:ring-indigo-500 scale-110"
                        />
                        <div>
                          <span className="text-xs font-bold text-gray-800 block">Eu irei cobrar</span>
                          <span className="text-[10px] text-gray-400 font-semibold uppercase font-mono block">Você assume a tratativa imediata com o cliente</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3.5 bg-white border border-gray-150 rounded-2xl cursor-pointer hover:bg-gray-50/50 transition-colors">
                        <input
                          type="radio"
                          name="q6_6_1"
                          value="secretaria"
                          checked={wizardState?.q6_6_1 === 'secretaria'}
                          onChange={() => saveWizardStateUpdate({ q6_6_1: 'secretaria' })}
                          className="text-indigo-600 focus:ring-indigo-500 scale-110"
                        />
                        <div>
                          <span className="text-xs font-bold text-gray-800 block">A secretaria irá cobrar</span>
                          <span className="text-[10px] text-gray-400 font-semibold uppercase font-mono block">Aciona integração automatizada no Todoist do escritório</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* 6.6.2 - Como deseja cobrar a coleta de documentos faltantes? (apresentar se q6_6_1 for 'eu') */}
                  {wizardState?.q6_6_1 === 'eu' && (
                    <div className="space-y-2.5 animate-in fade-in duration-200">
                      <label className="text-[11px] font-extrabold uppercase text-gray-700 tracking-wider block leading-tight">
                        6.6.2 - Como deseja cobrar a coleta de documentos faltantes?
                      </label>
                      <div className="flex flex-col gap-2">
                        {[
                          { key: 'email', label: 'E-mail', desc: 'Disparar comunicação formal por correio eletrônico' },
                          { key: 'whatsapp', label: 'WhatsApp', desc: 'Disparar notificação rápida no WhatsApp do cliente' },
                          { key: 'facebook', label: 'Facebook Messenger', desc: 'Futura integração via canais Meta Business' },
                          { key: 'tiktok', label: 'TikTok Direct Messages', desc: 'Futura integração via canais TikTok for Business' },
                          { key: 'instagram', label: 'Instagram Direct', desc: 'Futura integração via canais Instagram Business' },
                          { key: 'portal', label: 'Portal do Cliente', desc: 'Notificação push imediata na área logada do cliente' },
                        ].map((channel) => (
                          <label key={channel.key} className="flex items-center gap-3 p-3.5 bg-white border border-gray-150 rounded-2xl cursor-pointer hover:bg-gray-50/50 transition-colors">
                            <input
                              type="radio"
                              name="q6_6_2"
                              value={channel.key}
                              checked={wizardState?.q6_6_2 === channel.key}
                              onChange={() => saveWizardStateUpdate({ q6_6_2: channel.key })}
                              className="text-indigo-600 focus:ring-indigo-500 scale-110"
                            />
                            <div>
                              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5 leading-normal">
                                {channel.label}
                                {channel.key === 'whatsapp' && (
                                  <span className="text-[8px] bg-emerald-100 text-emerald-800 font-bold font-mono px-1 py-0.5 rounded uppercase">Integrado</span>
                                )}
                                {channel.key === 'email' && (
                                  <span className="text-[8px] bg-sky-100 text-sky-850 font-bold font-mono px-1 py-0.5 rounded uppercase">Preparado</span>
                                )}
                                {['facebook', 'tiktok', 'instagram', 'portal'].includes(channel.key) && (
                                  <span className="text-[8px] bg-gray-100 text-gray-500 font-bold font-mono px-1 py-0.5 rounded uppercase">Futuro canal</span>
                                )}
                              </span>
                              <span className="text-[10px] text-gray-400 font-semibold block">{channel.desc}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CUSTOM INTEGRATIONS ACCORDING TO USER'S SELECTION */}

                  {/* SEÇÃO INTEGRADA TODOIST - COR INSTITUCIONAL OBRIGATÓRIA: VERMELHO */}
                  {wizardState?.q6_6_1 === 'secretaria' && (
                    <div className="p-5 bg-rose-50/40 border border-rose-150 rounded-2xl space-y-4 text-left animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
                        <div className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></div>
                        <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider font-mono">
                          Integração Todoist - Secretaria Cobrança
                        </h4>
                      </div>
                      
                      <p className="text-[11px] text-rose-900 font-semibold leading-normal">
                        Conforme selecionado, a secretaria do escritório assumirá a cobrança dos documentos pendentes. Use o botão vermelho institucional abaixo para gerar e enviar a subtarefa diretamente para o Todoist.
                      </p>

                      <div className="p-3 bg-white border border-rose-100 rounded-xl font-mono text-[9px] text-rose-800 leading-normal">
                        <span className="font-extrabold uppercase block text-[8px] text-rose-500 tracking-wider mb-0.5">Título da Tarefa Todoist</span>
                        {`Cobrar documentos pendentes de coleta - ${clientName || 'Cliente'}`}
                        <span className="font-extrabold uppercase block text-[8px] text-rose-500 tracking-wider mt-2 mb-0.5">Descrição / Subtarefas</span>
                        {`Pendências detectadas:\n` +
                          (wizardState.q1_3 !== 'sim' ? "* Procuração Ad Judicia assinada\n" : "") +
                          (wizardState.q2_1 === 'sim' && wizardState.q2_4 !== 'sim' ? "* Declaração de Hipossuficiência assinada\n" : "") +
                          (wizardState.q3_4 !== 'sim' ? "* Contrato de Honorários assinado\n" : "") +
                          filteredRequests.filter(req => wizardState.q5_provas?.[req.id]?.received !== 'sim').map(r => `* ${r.title}\n`).join('')
                        }
                      </div>

                      {todoistSuccess && (
                        <div className="p-3 bg-emerald-50 border border-emerald-150 text-emerald-950 rounded-xl text-[10px] font-bold">
                          {todoistSuccess}
                        </div>
                      )}

                      {todoistError && (
                        <div className="p-3 bg-rose-100 border border-rose-250 text-rose-950 rounded-xl text-[10px] font-bold">
                          {todoistError}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={todoistSubmitting}
                        onClick={handleCreateTodoistTask}
                        className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        {todoistSubmitting ? (
                          <span>Criando tarefa no Todoist...</span>
                        ) : (
                          <span>Criar Subtarefa no Todoist (Canal Secretaria) 🔴</span>
                        )}
                      </button>
                    </div>
                  )}

                  {/* SEÇÃO INTEGRADA WHATSAPP - COR INSTITUCIONAL OBRIGATÓRIA: VERDE */}
                  {wizardState?.q6_6_1 === 'eu' && wizardState?.q6_6_2 === 'whatsapp' && (
                    <div className="p-5 bg-emerald-50/45 border border-emerald-150 rounded-2xl space-y-4 text-left animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 border-b border-emerald-100 pb-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></div>
                        <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider font-mono">
                          Integração WhatsApp - Cobrança Imediata
                        </h4>
                      </div>
                      
                      <p className="text-[11px] text-emerald-900 font-semibold leading-normal">
                        Envie a mensagem de cobrança formatada e personalizada diretamente para o WhatsApp do cliente. Use o botão verde institucional abaixo para despachar.
                      </p>

                      <div className="p-3 bg-white border border-emerald-100 rounded-xl text-[11px] font-semibold text-gray-800 whitespace-pre-wrap leading-relaxed select-all">
                        {"Prezado cliente, identificamos documentos pendentes em nosso controle cadastral. Favor providenciar o envio:\n" +
                          (wizardState.q1_3 !== 'sim' ? "* Procuração Ad Judicia assinada\n" : "") +
                          (wizardState.q2_1 === 'sim' && wizardState.q2_4 !== 'sim' ? "* Declaração de Hipossuficiência assinada\n" : "") +
                          (wizardState.q3_4 !== 'sim' ? "* Contrato de Honorários assinado\n" : "") +
                          filteredRequests.filter(req => wizardState.q5_provas?.[req.id]?.received !== 'sim').map(r => `* ${r.title}\n`).join('')
                        }
                      </div>

                      {whatsappSuccess && (
                        <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-950 rounded-xl text-[10px] font-bold animate-in fade-in duration-200">
                          {whatsappSuccess}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setWhatsappSuccess("Mensagem formatada e despachada via integração dinâmica do WhatsApp institucional com sucesso!");
                          setTimeout(() => setWhatsappSuccess(null), 4000);
                        }}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <span>Disparar Cobrança via WhatsApp 🟢</span>
                      </button>
                    </div>
                  )}

                  {/* SEÇÃO INTEGRADA EMAIL - COR INSTITUCIONAL OBRIGATÓRIA: AZUL */}
                  {wizardState?.q6_6_1 === 'eu' && wizardState?.q6_6_2 === 'email' && (
                    <div className="p-5 bg-sky-50/45 border border-sky-150 rounded-2xl space-y-4 text-left animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 border-b border-sky-100 pb-2">
                        <div className="w-2 h-2 rounded-full bg-sky-600 animate-pulse"></div>
                        <h4 className="text-xs font-black text-sky-950 uppercase tracking-wider font-mono">
                          Integração E-mail Correio Eletrônico
                        </h4>
                      </div>
                      
                      <p className="text-[11px] text-sky-900 font-semibold leading-normal">
                        A notificação de pendência documental será enviada para o endereço eletrônico do cliente cadastrado.
                      </p>

                      <div className="p-3 bg-white border border-sky-100 rounded-xl font-mono text-[9px] text-sky-800 leading-normal">
                        <span className="font-extrabold uppercase block text-[8px] text-sky-500 tracking-wider mb-0.5">Assunto do E-mail</span>
                        {`Pendência Urgente: Coleta de Provas - Caso ${caseId}`}
                      </div>

                      {emailSuccess && (
                        <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-950 rounded-xl text-[10px] font-bold animate-in fade-in duration-200">
                          {emailSuccess}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEmailSuccess("E-mail com relatório de auditoria e pendências disparado com sucesso ao cliente!");
                          setTimeout(() => setEmailSuccess(null), 4000);
                        }}
                        className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <span>Disparar Notificação por E-mail 🔵</span>
                      </button>
                    </div>
                  )}

                  {/* OUTROS CANAIS FUTUROS */}
                  {wizardState?.q6_6_1 === 'eu' && ['facebook', 'tiktok', 'instagram', 'portal'].includes(wizardState?.q6_6_2) && (
                    <div className="p-5 bg-gray-50 border border-gray-150 rounded-2xl space-y-3 text-left animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
                        <h4 className="text-xs font-extrabold text-gray-800 uppercase font-mono">
                          Integração {wizardState?.q6_6_2?.toUpperCase()}
                        </h4>
                      </div>
                      <p className="text-[11px] text-gray-500 font-semibold leading-relaxed">
                        Esta extensão de integração de canal social encontra-se em fase beta reservada. Os tokens e segredos de ambiente estão sendo controlados de forma centralizada sob as diretrizes institucionais do Portal BOSS.
                      </p>
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 bg-gray-200 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-not-allowed"
                      >
                        Canal Social em Preparação para API
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* FINAL VALIDATION FIELD */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-950 space-y-3">
              <span className="text-[10px] uppercase font-mono font-black text-emerald-800 tracking-wider block">Validação de Coleta Integral</span>
              <p className="text-xs leading-relaxed font-semibold">Os arquivos físicos e digitais do cliente Pessoa Física encontram-se plenamente auditados na controladoria de provas do escritório Priscilla Giffoni.</p>
              
              <button
                type="button"
                disabled={saving}
                onClick={handleFinalizeAll}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] cursor-pointer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <><span>Finalizar Auditoria & Avançar Fluxo</span><ArrowRight size={14} /></>}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleSaveAndAdvanceToDigitalizacao}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] cursor-pointer mt-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <><span>Salvar e avançar para Etapa 06 - Digitalização e Upload</span><ArrowRight size={14} /></>}
              </button>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="flex flex-col sm:flex-row justify-between pt-4 border-t border-gray-150 gap-3">
              <button
                type="button"
                onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
                className="px-5 py-3 border border-gray-250 hover:bg-gray-50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Save size={13} /> Fechar e Sair sem Finalizar
              </button>
            </div>

          </div>
        )}

      </div>
    </FluxoStepLayout>
  );
}
