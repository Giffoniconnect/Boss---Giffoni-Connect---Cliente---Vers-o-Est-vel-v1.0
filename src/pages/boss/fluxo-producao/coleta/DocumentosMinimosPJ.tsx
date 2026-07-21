import React from 'react';
import { useColetaState } from '../hooks/useColetaState';
import FluxoStepLayout from '../components/FluxoStepLayout';
import { 
  ArrowRight, FileText, UploadCloud, Trash2, ArrowLeft, 
  Check, AlertCircle 
} from 'lucide-react';

export default function DocumentosMinimosPJ() {
  const {
    caseId,
    fetching,
    error,
    success,
    clientName,
    wizardState,
    saveWizardStateUpdate,
    addWizardFile,
    removeWizardFile,
    navigate
  } = useColetaState();

  const handleNextPhase = () => {
    saveWizardStateUpdate({ step4_completed: true }).then(() => {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-necessidade-PJ`);
    });
  };

  const FileUploadBox = ({ field, labelText }: { field: string, labelText: string }) => {
    const files = wizardState[field] || [];
    return (
      <div className="space-y-2 mt-1">
        <label className="group flex flex-col items-center justify-center border border-dashed border-gray-300 hover:border-indigo-500 rounded-xl p-2 bg-gray-50/50 hover:bg-gray-55 transition-all cursor-pointer">
          <UploadCloud className="text-gray-400 group-hover:text-indigo-600 mb-0.5" size={16} />
          <span className="text-[10px] font-bold text-gray-750">{labelText}</span>
          <input 
            type="file" 
            className="hidden" 
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const name = e.target.files[0].name;
                const size = (e.target.files[0].size / 1024 / 1024).toFixed(2) + ' MB';
                addWizardFile(field, name, size);
              }
            }}
          />
        </label>
        {files.length > 0 && (
          <div className="space-y-0.5">
            {files.map((f: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-1 px-2 bg-indigo-50 border border-indigo-150 rounded-lg text-[11px]">
                <span className="truncate font-semibold text-indigo-900 flex items-center gap-0.5 max-w-[85%]">
                  <FileText size={10} /> {f.name}
                </span>
                <button type="button" onClick={() => removeWizardFile(field, idx)} className="text-rose-600 hover:bg-rose-100 p-0.5 rounded">
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <FluxoStepLayout 
      stepName="Coleta de Documentos" 
      caseId={caseId}
      coletaSubetapasStep="documentos-minimos"
      tipoPessoa="PJ"
      wizardState={wizardState}
    >
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-4">
        
        {/* HEADER PANEL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                Etapa 4 — Pessoa Jurídica (PJ)
              </span>
              <span className="text-xs text-gray-400">Cliente: <strong>{clientName}</strong></span>
            </div>
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none pt-1">
              Documentos Mínimos Obrigatórios (PJ)
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-contrato-PJ`)}
            className="p-2 bg-gray-50 border border-gray-150 rounded-xl text-gray-500 hover:text-gray-950 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer font-bold text-xs"
          >
            <ArrowLeft size={13} className="mr-1" /> Voltar ao Contrato
          </button>
        </div>

        {fetching ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-150 border-t-indigo-650 rounded-full animate-spin"></div>
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
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900 text-xs font-bold flex gap-2 items-center">
                <Check className="text-emerald-500 shrink-0" size={14} />
                <span>{success}</span>
              </div>
            )}

            {/* FLOW QUESTIONNAIRE CARD */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-2xs space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* CNPJ */}
                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-1">
                  <p className="text-xs font-extrabold text-gray-805">4.1 Cartão CNPJ atualizado recebido?</p>
                  <div className="flex gap-4 mt-1">
                    {['sim', 'nao'].map(o => (
                      <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-bold uppercase text-gray-700">
                        <input 
                          type="radio" 
                          name="q4_cnpj" 
                          checked={wizardState.q4_cnpj === o} 
                          onChange={() => saveWizardStateUpdate({ q4_cnpj: o })} 
                          className="text-indigo-600"
                        />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* CONTRATO SOCIAL */}
                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-1">
                  <p className="text-xs font-extrabold text-gray-805">4.2 Contrato Social Consolidadado recebido?</p>
                  <div className="flex gap-4 mt-1">
                    {['sim', 'nao'].map(o => (
                      <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-bold uppercase text-gray-700">
                        <input 
                          type="radio" 
                          name="q4_contrato_social" 
                          checked={wizardState.q4_contrato_social === o} 
                          onChange={() => saveWizardStateUpdate({ q4_contrato_social: o })} 
                          className="text-indigo-600"
                        />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* ENDERECO SEDE */}
                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-1">
                  <p className="text-xs font-extrabold text-gray-805">4.3 Comprovante de endereço da sede recebido?</p>
                  <div className="flex gap-4 mt-1">
                    {['sim', 'nao'].map(o => (
                      <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-bold uppercase text-gray-700">
                        <input 
                          type="radio" 
                          name="q4_endereco_sede" 
                          checked={wizardState.q4_endereco_sede === o} 
                          onChange={() => saveWizardStateUpdate({ q4_endereco_sede: o })} 
                          className="text-indigo-600"
                        />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* RG SOCIO */}
                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-1">
                  <p className="text-xs font-extrabold text-gray-850">4.4 Cópia do RG/CNH do Sócio Administrador?</p>
                  <div className="flex gap-4 mt-1">
                    {['sim', 'nao'].map(o => (
                      <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-bold uppercase text-gray-700">
                        <input 
                          type="radio" 
                          name="q4_rg_socio" 
                          checked={wizardState.q4_rg_socio === o} 
                          onChange={() => saveWizardStateUpdate({ q4_rg_socio: o })} 
                          className="text-indigo-600"
                        />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* CPF SOCIO */}
                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-1">
                  <p className="text-xs font-extrabold text-gray-850">4.5 Cópia do CPF do Sócio Administrador?</p>
                  <div className="flex gap-4 mt-1">
                    {['sim', 'nao'].map(o => (
                      <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-bold uppercase text-gray-700">
                        <input 
                          type="radio" 
                          name="q4_cpf_socio" 
                          checked={wizardState.q4_cpf_socio === o} 
                          onChange={() => saveWizardStateUpdate({ q4_cpf_socio: o })} 
                          className="text-indigo-600"
                        />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* RESIDENCIA SOCIO */}
                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-1">
                  <p className="text-xs font-extrabold text-gray-850">4.6 Comprovante de residência do Administrador?</p>
                  <div className="flex gap-4 mt-1">
                    {['sim', 'nao'].map(o => (
                      <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-bold uppercase text-gray-700">
                        <input 
                          type="radio" 
                          name="q4_residencia_socio" 
                          checked={wizardState.q4_residencia_socio === o} 
                          onChange={() => saveWizardStateUpdate({ q4_residencia_socio: o })} 
                          className="text-indigo-600"
                        />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>

              {/* ANEXAR OBJETOS corporativos */}
              <div className="p-4 bg-indigo-50/20 border border-indigo-100/70 rounded-2xl space-y-3">
                <p className="text-xs font-extrabold text-gray-900">4.7 Deseja anexar os arquivos corporativos agora?</p>
                <div className="flex gap-4">
                  {['sim', 'nao'].map(o => (
                    <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-extrabold text-gray-750">
                      <input 
                        type="radio" 
                        name="q4_anexar_pj" 
                        checked={wizardState.q4_anexar_pj === o} 
                        onChange={() => saveWizardStateUpdate({ q4_anexar_pj: o })} 
                      />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>

                {wizardState.q4_anexar_pj === 'sim' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 animate-in fade-in duration-200">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500">Cartão CNPJ</span>
                      <FileUploadBox field="cnpjFiles" labelText="CNPJ" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500">Contrato Social</span>
                      <FileUploadBox field="contratoSocialFiles" labelText="Social" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500">Endereço Sede</span>
                      <FileUploadBox field="enderecoSedeFiles" labelText="Sede" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500">RG Administrador</span>
                      <FileUploadBox field="rgSocioFiles" labelText="RG Sócio" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500">CPF Administrador</span>
                      <FileUploadBox field="cpfSocioFiles" labelText="CPF Sócio" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500">Endereço Administrador</span>
                      <FileUploadBox field="residenciaSocioFiles" labelText="Sócio Res." />
                    </div>
                  </div>
                )}

              </div>

              {/* FLOW ACTIONS FOOTER */}
              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  disabled={!wizardState.q4_cnpj || !wizardState.q4_contrato_social || !wizardState.q4_endereco_sede || !wizardState.q4_rg_socio}
                  onClick={handleNextPhase}
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span>Próxima Fase</span>
                  <ArrowRight size={13} />
                </button>
              </div>

            </div>

          </div>
        )}

      </div>
    </FluxoStepLayout>
  );
}
