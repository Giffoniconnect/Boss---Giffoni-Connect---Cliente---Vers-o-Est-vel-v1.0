import React, { useState, useEffect } from 'react';
import { Phone, Check, Edit2, AlertCircle, Send, Info, MessageSquare } from 'lucide-react';
import { buildWhatsAppLink } from '../../../../lib/whatsapp';

interface DirectReferralFieldsProps {
  leadFormData: any;
  setLeadFormData: React.Dispatch<React.SetStateAction<any>>;
  leadType: 'PF' | 'PJ';
}

export function DirectReferralFields({
  leadFormData,
  setLeadFormData,
  leadType
}: DirectReferralFieldsProps) {
  // Get canonical phone
  const mainPhone = leadType === 'PF' 
    ? leadFormData.pessoaFisica?.telefone || '' 
    : leadFormData.pessoaJuridica?.telefone || '';

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [tempPhone, setTempPhone] = useState(mainPhone);
  const [sendingStatus, setSendingStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);

  // Sync temp phone with main phone changes
  useEffect(() => {
    setTempPhone(mainPhone);
  }, [mainPhone]);

  // Handle phone correction and save to canonical source
  const handleConfirmPhoneChange = () => {
    setLeadFormData((prev: any) => {
      if (leadType === 'PF') {
        return {
          ...prev,
          pessoaFisica: {
            ...prev.pessoaFisica,
            telefone: tempPhone
          }
        };
      } else {
        return {
          ...prev,
          pessoaJuridica: {
            ...prev.pessoaJuridica,
            telefone: tempPhone
          }
        };
      }
    });
    setIsEditingPhone(false);
  };

  // Compile thank you message templates
  const compileMessage = () => {
    if (leadType === 'PF') {
      const nomeCompleto = leadFormData.pessoaFisica?.nomeCompleto || '';
      return `Olá, ${nomeCompleto || 'Lead'}.\n\nAgradecemos pelo seu contato com a Giffoni Advogados Associados. Recebemos suas informações e nossa equipe dará continuidade ao atendimento.\n\nPermanecemos à disposição.\n\nAtenciosamente,\nGiffoni Advogados Associados`;
    } else {
      const representante = leadFormData.pessoaJuridica?.representanteLegal || '';
      const razaoSocial = leadFormData.pessoaJuridica?.razaoSocial || '';
      const nomeFantasia = leadFormData.pessoaJuridica?.nomeFantasia || '';
      
      const nomeContatoOuEmpresa = representante || razaoSocial || nomeFantasia || 'Lead';
      const empresaLabel = razaoSocial || nomeFantasia || 'empresa';

      return `Olá, ${nomeContatoOuEmpresa}.\n\nAgradecemos pelo contato com a Giffoni Advogados Associados. Recebemos as informações da empresa ${empresaLabel} e nossa equipe dará continuidade ao atendimento.\n\nPermanecemos à disposição.\n\nAtenciosamente,\nGiffoni Advogados Associados`;
    }
  };

  const generatedMessageText = compileMessage();

  // Send Thank You message
  const handleSendThankYouMessage = async () => {
    if (!mainPhone) {
      alert("Não foi possível preparar a mensagem porque o telefone do LEAD não foi informado.");
      return;
    }

    setSendingStatus('sending');
    setApiErrorMessage(null);

    try {
      // 1. Try sending via server-side secure API
      const res = await fetch('/api/whatsapp/test-send-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: mainPhone,
          message: generatedMessageText
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSendingStatus('success');
        setLeadFormData((prev: any) => ({
          ...prev,
          agradecimentoLeadStatus: 'Enviado',
          agradecimentoLeadResultado: data
        }));
      } else {
        // Fallback to manual WhatsApp opening if server-side automated is missing/unconfigured
        console.warn("API wascript responded with failure or missing token, falling back to manual whatsapp window.", data);
        const manualLink = buildWhatsAppLink(mainPhone, generatedMessageText);
        
        // Log status as manual
        setLeadFormData((prev: any) => ({
          ...prev,
          agradecimentoLeadStatus: 'Aberta manualmente',
          agradecimentoLeadResultado: data
        }));

        window.open(manualLink, '_blank');
        setSendingStatus('success');
      }
    } catch (err: any) {
      console.error("Error calling automated WhatsApp API, opening manually", err);
      // Fallback to manual WhatsApp opening
      const manualLink = buildWhatsAppLink(mainPhone, generatedMessageText);
      
      setLeadFormData((prev: any) => ({
        ...prev,
        agradecimentoLeadStatus: 'Aberta manualmente',
        agradecimentoLeadResultado: { error: err.message || String(err) }
      }));

      window.open(manualLink, '_blank');
      setSendingStatus('success');
    }
  };

  return (
    <div className="bg-[#eff6ff]/60 border border-blue-200 rounded-2xl p-5 space-y-5 animate-fade-in" id="direct-referral-fields-container">
      <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
        <span className="p-1 bg-blue-100 text-blue-600 rounded-lg">
          <Info size={16} />
        </span>
        <h4 className="text-xs font-black uppercase tracking-wider text-blue-950">
          Detalhamento da Indicação Direta
        </h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quem indicou o LEAD */}
        <div>
          <label className="block text-[9.5px] font-bold text-gray-550 uppercase tracking-wider mb-1">
            Quem indicou o LEAD? <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={leadFormData.indicadoPorNome || ''}
            onChange={(e) => setLeadFormData({ ...leadFormData, indicadoPorNome: e.target.value })}
            className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            placeholder={leadType === 'PF' ? "Nome da pessoa que realizou a indicação" : "Nome da pessoa que indicou"}
          />
        </div>

        {/* PJ Extra field: Empresa relacionada */}
        {leadType === 'PJ' && (
          <div>
            <label className="block text-[9.5px] font-bold text-gray-550 uppercase tracking-wider mb-1">
              Empresa / Organização Relacionada <span className="text-gray-400 font-medium">(Opcional)</span>
            </label>
            <input
              type="text"
              value={leadFormData.indicadoPorEmpresa || ''}
              onChange={(e) => setLeadFormData({ ...leadFormData, indicadoPorEmpresa: e.target.value })}
              className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="Empresa ou órgão relacionado à indicação"
            />
          </div>
        )}
      </div>

      {/* Carry-On Telephone Rule Block */}
      <div className="bg-white/80 border border-blue-100 rounded-xl p-4 space-y-2.5">
        <label className="block text-[9.5px] font-bold text-gray-500 uppercase tracking-wider">
          Qual o telefone de contato do LEAD?
        </label>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {isEditingPhone ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={tempPhone}
                onChange={(e) => setTempPhone(e.target.value)}
                className="flex-1 text-xs font-semibold px-3 py-1.5 bg-white border border-blue-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="(00) 90000-0000"
                autoFocus
              />
              <button
                type="button"
                onClick={handleConfirmPhoneChange}
                className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Check size={14} />
                <span>Confirmar</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 bg-slate-50 border border-gray-150 px-3 py-2 rounded-xl flex-1">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                <Phone size={14} className="text-slate-400" />
                <span>{mainPhone ? mainPhone : 'Não cadastrado'}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTempPhone(mainPhone);
                  setIsEditingPhone(true);
                }}
                className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 size={11} />
                <span>Corrigir Telefone</span>
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Warning Message */}
        <div className="text-[10.5px] leading-relaxed">
          {mainPhone ? (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <span>●</span> Telefone carregado automaticamente a partir dos dados principais do LEAD.
            </span>
          ) : (
            <span className="text-rose-700 font-extrabold flex items-center gap-1">
              <AlertCircle size={12} className="text-rose-600" />
              <span>Telefone não informado no cadastro principal do LEAD.</span>
            </span>
          )}
        </div>
      </div>

      {/* Enviar Mensagem de Agradecimento Block */}
      <div className="border-t border-blue-100 pt-4 space-y-3">
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!leadFormData.enviarAgradecimentoLead}
            onChange={(e) => setLeadFormData({ ...leadFormData, enviarAgradecimentoLead: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4.5 h-4.5 mt-0.5 cursor-pointer"
          />
          <div>
            <span className="block text-xs text-blue-950 font-extrabold">
              Enviar mensagem de agradecimento ao LEAD
            </span>
            <span className="block text-[10px] text-blue-600 leading-normal font-semibold">
              Destinado ao telefone canônico do próprio lead ({mainPhone || 'não informado'}).
            </span>
          </div>
        </label>

        {leadFormData.enviarAgradecimentoLead && (
          <div className="bg-white border border-blue-150 rounded-xl p-4 space-y-3.5 animate-fade-in" id="thank-you-message-panel">
            <div className="flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-2">
              <MessageSquare size={14} className="text-slate-400" />
              <span className="text-xs font-extrabold uppercase tracking-wider">Visualização da Mensagem</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
              {generatedMessageText}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="text-[10px] font-bold">
                Status: {' '}
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  leadFormData.agradecimentoLeadStatus === 'Enviado'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : leadFormData.agradecimentoLeadStatus === 'Aberta manualmente'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {leadFormData.agradecimentoLeadStatus || 'Pendente'}
                </span>
              </div>

              {!mainPhone ? (
                <div className="bg-rose-50 border border-rose-150 rounded-xl p-2.5 flex items-start gap-2 max-w-sm">
                  <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                  <span className="text-[10px] text-rose-800 font-extrabold leading-tight">
                    Não foi possível preparar a mensagem porque o telefone do LEAD não foi informado.
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={sendingStatus === 'sending'}
                  onClick={handleSendThankYouMessage}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <Send size={12} />
                  <span>{sendingStatus === 'sending' ? 'Enviando...' : 'Enviar Agradecimento'}</span>
                </button>
              )}
            </div>

            {sendingStatus === 'success' && (
              <p className="text-[10px] text-emerald-700 font-extrabold animate-fade-in">
                ✓ Ação concluída com sucesso! Status do agradecimento atualizado para "{leadFormData.agradecimentoLeadStatus}".
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
