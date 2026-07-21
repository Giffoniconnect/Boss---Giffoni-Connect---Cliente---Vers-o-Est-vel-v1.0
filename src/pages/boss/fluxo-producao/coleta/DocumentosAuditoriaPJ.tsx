import React, { useState } from 'react';
import { useColetaState } from '../hooks/useColetaState';
import FluxoStepLayout from '../components/FluxoStepLayout';
import { 
  ArrowRight, FileText, ArrowLeft, Check, AlertCircle, 
  AlertTriangle, CheckCircle, FileSearch, Save, Loader2 
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

export default function DocumentosAuditoriaPJ() {
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

  // Metrics calculation
  let totalExpected = 5; // procuracao-generated, procuracao-signed, contrato-generated, contrato-signed, cnpj/social/residencia/rgsocio (counts as 1)
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

  // Minimum required corporate documents count
  const minDocsChecked = (wizardState.q4_cnpj === 'sim' ? 1 : 0) + 
                         (wizardState.q4_contrato_social === 'sim' ? 1 : 0) + 
                         (wizardState.q4_endereco_sede === 'sim' ? 1 : 0) + 
                         (wizardState.q4_rg_socio === 'sim' ? 1 : 0);
  received += (minDocsChecked / 4); // normalized contribution

  // Custom requests
  if (wizardState.q5_1 === 'sim' && requests.length > 0) {
    totalExpected += requests.length;
    requests.forEach(r => {
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
      setSuccess('Parabéns! Coleta de documentos corporativos PJ finalizada e auditada com sucesso!');
      setTimeout(() => {
        navigate(`/boss-giffoni-clientes/fluxo-producao`);
      }, 2000);
    } catch (err: any) {
      setError(`Erro ao finalizar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <FluxoStepLayout 
      stepName="Coleta de Documentos" 
      caseId={caseId}
      coletaSubetapasStep="documentos-auditoria"
      tipoPessoa="PJ"
      wizardState={wizardState}
    >
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-4">
        
        {/* HEADER PANEL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                Etapa 6 — Pessoa Jurídica (PJ)
              </span>
              <span className="text-xs text-gray-400">Cliente: <strong>{clientName}</strong></span>
            </div>
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none pt-1">
              Auditoria Final & Encerramento do Fluxo PJ
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-necessidade-PJ`)}
            className="p-2 bg-gray-50 border border-gray-150 rounded-xl text-gray-500 hover:text-gray-950 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer font-bold text-xs"
          >
            <ArrowLeft size={13} className="mr-1" /> Voltar às Provas
          </button>
        </div>

        {fetching ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-100 border-t-indigo-650 rounded-full animate-spin"></div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 font-mono">Carregando dados da etapa...</span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* NOTIFICATION TOASTS */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-semibold flex gap-2 items-center">
                <AlertCircle size={14} className="text-red-650 shrink-0" />
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
                  <span className="text-gray-900 block mt-0.5 font-extrabold uppercase">Pessoa Jurídica (PJ)</span>
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
              
              {/* Procuracao PJ Summary */}
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

              {/* Declaracao PJ Summary */}
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

              {/* Contrato honorários PJ Summary */}
              <div className="bg-white border border-gray-150 p-5 rounded-2xl space-y-4 text-left">
                <h4 className="text-xs font-black text-indigo-950 uppercase font-mono border-b pb-1">6.3 — Contrato de Honorários PJ</h4>
                <div className="space-y-3.5 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 font-bold">Contrato de honorários foi gerado? (varia de acordo com a resposta no item 3.1)</span>
                    <span className="font-extrabold text-gray-800">
                      {wizardState.q3_1 === 'sim' ? 'Sim ✅' : wizardState.q3_1 === 'nao' ? 'Não ❌' : 'Não preenchido ➖'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 font-bold font-sans">Entregue ao cliente (Item 3.3)</span>
                    <span className="font-extrabold text-gray-800">
                      {Array.isArray(wizardState?.q3_3) && wizardState.q3_3.length > 0 
                        ? `Sim (Canais: ${wizardState.q3_3.join(' / ').toUpperCase()}) ✅` 
                        : 'Não entregue ❌'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 font-bold font-sans">Assinado pelo cliente? (Item 3.4)</span>
                    <span className="font-extrabold text-gray-805">
                      {wizardState.q3_4 === 'sim' ? 'Sim ✅' : wizardState.q3_4 === 'nao' ? 'Não ❌' : 'Não preenchido ➖'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 font-bold">Assinado pelo Advogado? (Item 3.5)</span>
                    <span className="font-extrabold text-gray-800">
                      {wizardState.q3_5 === 'sim' ? 'Sim ✅' : wizardState.q3_5 === 'nao' ? 'Não ❌' : 'Não preenchido ➖'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 font-bold font-sans">Meio de recebimento do contrato de honorários: (Item 3.6)</span>
                    <span className="font-extrabold text-gray-800">
                      {wizardState.q3_6 === 'sim' ? 'Recebido Digitalizado ✅' : wizardState.q3_6 === 'nao' ? 'Não Recebido / Pendente ❌' : 'Não preenchido ➖'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-404 font-bold font-sans">Digitalização ou Upload foi realizado do contrato (Item 3.7)</span>
                    <span className="font-extrabold text-gray-800">
                      {wizardState.q3_7 === 'sim' ? 'Sim (Custódia Fiel) ✅' : 'Não feito ❌'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Minimum required documents PJ */}
              <div className="bg-white border border-gray-150 p-4 rounded-2xl space-y-2">
                <h4 className="text-xs font-black text-indigo-950 uppercase font-mono border-b pb-1 font-semibold">6.4 — Documentos Mínimos PJ</h4>
                <div className="text-xs font-semibold space-y-1 text-gray-700">
                  <div className="flex items-center gap-1.5"><span>{wizardState.q4_cnpj === 'sim' ? '✅' : '❌'}</span> <span>Cartão CNPJ recebido</span></div>
                  <div className="flex items-center gap-1.5"><span>{wizardState.q4_contrato_social === 'sim' ? '✅' : '❌'}</span> <span>Contrato Social recebido</span></div>
                  <div className="flex items-center gap-1.5"><span>{wizardState.q4_endereco_sede === 'sim' ? '✅' : '❌'}</span> <span>Endereço Sede recebido</span></div>
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
                
                {requests && requests.length > 0 ? (
                  <div className="space-y-3">
                    {requests.map((req) => {
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
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-amber-500 shrink-0" size={16} />
                  <span className="text-[10px] font-black uppercase text-amber-850 tracking-wider font-mono">6.6 — Cobrança de Dependências Corporativas Ativas</span>
                </div>
                
                <div className="bg-white border rounded-lg p-2.5 font-mono text-[10px] text-gray-700 block select-all whitespace-pre-wrap">
                  {"Prezado cliente, identificamos pendências documentais societárias em nosso controle cadastral. Favor providenciar o envio:\n" +
                    (wizardState.q1_3 !== 'sim' ? "* Procuração Ad Judicia PJ assinada\n" : "") +
                    (wizardState.q2_1 === 'sim' && wizardState.q2_4 !== 'sim' ? "* Balancete/Declaração de Hipossuficiência assinado\n" : "") +
                    (wizardState.q3_4 !== 'sim' ? "* Contrato de Honorários PJ assinado\n" : "") +
                    requests.filter(req => wizardState.q5_provas?.[req.id]?.received !== 'sim').map(r => `* ${r.title}\n`).join('')
                  }
                </div>

                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => { setSuccess('Controle de pendência jurídica PJ disparado com sucesso!'); setTimeout(() => setSuccess(null), 2500); }} 
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Enviar Notificação de Cobrança (Diretoria)
                  </button>
                </div>
              </div>
            )}

            {/* FINAL VALIDATION FIELD */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-950 space-y-3">
              <span className="text-[10px] uppercase font-mono font-black text-emerald-800 tracking-wider block">Validação de Coleta Integral PJ</span>
              <p className="text-xs leading-relaxed font-semibold">Os arquivos físicos e digitais do cliente Pessoa Jurídica encontram-se plenamente auditados na controladoria de provas do escritório Priscilla Giffoni.</p>
              
              <button
                type="button"
                disabled={saving}
                onClick={handleFinalizeAll}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] cursor-pointer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <><span>Finalizar Auditoria & Avançar Fluxo</span><ArrowRight size={14} /></>}
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
