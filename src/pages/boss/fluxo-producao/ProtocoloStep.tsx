import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Clipboard, AlertCircle, ChevronRight, Scale } from 'lucide-react';

interface ProtocoloStepProps {
  caseId: string;
  onNext: () => void;
  onSetLoading: (loading: boolean) => void;
  onAlert: (msg: string) => void;
}

export default function ProtocoloStep({ caseId, onNext, onSetLoading, onAlert }: ProtocoloStepProps) {
  const [protocol, setProtocol] = useState({
    protocolStatus: 'aguardando', // aguardando, agendado, protocolado, pendente, cancelado
    scheduledDate: '',
    completionDate: '',
    systemPlatform: 'pje', // pje, esaj, eproc, projudi, fisico
    receiptUrl: '',
    protocolNotes: '',
    registrationType: '' // Load for checking peticao_inicial conversion
  });
  const [processNo, setProcessNo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadProtocol() {
      onSetLoading(true);
      try {
        const caseDoc = await getDoc(doc(db, 'cases', caseId));
        if (caseDoc.exists()) {
          const data = caseDoc.data();
          setProtocol({
            protocolStatus: data.protocolStatus || 'aguardando',
            scheduledDate: data.scheduledDate || '',
            completionDate: data.completionDate || '',
            systemPlatform: data.systemPlatform || 'pje',
            receiptUrl: data.receiptUrl || '',
            protocolNotes: data.protocolNotes || '',
            registrationType: data.registrationType || ''
          });
          setProcessNo(data.processNumber || '');
        }
      } catch (err) {
        console.error(err);
      } finally {
        onSetLoading(false);
      }
    }
    loadProtocol();
  }, [caseId]);

  const applyCNJMask = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 20);
    let masked = '';
    if (digits.length > 0) masked += digits.slice(0, 7);
    if (digits.length > 7) masked += '-' + digits.slice(7, 9);
    if (digits.length > 9) masked += '.' + digits.slice(9, 13);
    if (digits.length > 13) masked += '.' + digits.slice(13, 14);
    if (digits.length > 14) masked += '.' + digits.slice(14, 16);
    if (digits.length > 16) masked += '.' + digits.slice(16, 20);
    return masked;
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();

    const isProtocolCompleted = protocol.protocolStatus === 'protocolado';
    const isPetInic = protocol.registrationType === 'peticao_inicial';

    if (isProtocolCompleted && isPetInic && !processNo.trim()) {
      onAlert('Erro: Ao concluir o protocolo de uma Petição Inicial, o preenchimento do número processual CNJ é obrigatório para converter a ação.');
      return;
    }

    setIsSaving(true);
    try {
      const updateData: any = {
        ...protocol,
        processNumber: processNo,
        productionStage: 'controladoria',
        updatedAt: serverTimestamp()
      };

      // Perform conversion if applicable
      if (isProtocolCompleted && isPetInic) {
        updateData.registrationType = 'processo_judicial_ajuizado';
        updateData.statusPublicoCliente = 'Processo judicial ajuizado';
        updateData.actionCategory = 'judicial';
      }

      await updateDoc(doc(db, 'cases', caseId), updateData);
      onAlert('Protocolo fático gravado com sucesso!');
      if (isProtocolCompleted && isPetInic) {
        onAlert('Sucesso: Sua ação foi convertida automaticamente para Processo Judicial Ajuizado!');
      }
      onNext();
    } catch (err) {
      console.error(err);
      onAlert('Não foi possível gravar os dados processuais do protocolo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleNext} className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2 border-b border-gray-50 pb-3">
          <Clipboard size={18} className="text-blue-600" /> EDRP: Cumprimento e Agendamento de Protocolo
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Status de Distribuição</label>
            <select
              name="protocolStatus"
              value={protocol.protocolStatus}
              onChange={(e) => setProtocol(p => ({ ...p, protocolStatus: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            >
              <option value="aguardando">Aguardando Parecer / Revisão</option>
              <option value="agendado">Agendando / Programado</option>
              <option value="protocolado">Protocolado / Distribuído com Sucesso</option>
              <option value="pendente">Pendente de Documentação complementar</option>
              <option value="cancelado">Cancelado por desistência</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Tribunal / Sítio Eletrônico</label>
            <select
              name="systemPlatform"
              value={protocol.systemPlatform}
              onChange={(e) => setProtocol(p => ({ ...p, systemPlatform: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            >
              <option value="pje">PJe (Processo Judicial Eletrônico)</option>
              <option value="esaj">e-SAJ (Tribunal Estadual de Justiça)</option>
              <option value="eproc">eProc (Justiça Federal / TJ)</option>
              <option value="projudi">Projudi</option>
              <option value="fisico">Meio Físico / Cartório Distrital</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest font-sans">Data Designada para Envio</label>
            <input
              type="date"
              value={protocol.scheduledDate}
              onChange={(e) => setProtocol(p => ({ ...p, scheduledDate: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Data Concreta do Protocolo</label>
            <input
              type="date"
              value={protocol.completionDate}
              onChange={(e) => setProtocol(p => ({ ...p, completionDate: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Link do Comprovante de Protocolo (Nuvem / Drive)</label>
            <input
              type="text"
              value={protocol.receiptUrl}
              onChange={(e) => setProtocol(p => ({ ...p, receiptUrl: e.target.value }))}
              placeholder="https://drive.google.com/open?id=..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Chave de Validação / Notas Administrativas</label>
            <input
              type="text"
              value={protocol.protocolNotes}
              onChange={(e) => setProtocol(p => ({ ...p, protocolNotes: e.target.value }))}
              placeholder="ex: chave_seguranca_pje: xxxx-xxxx"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      {protocol.protocolStatus === 'protocolado' && protocol.registrationType === 'peticao_inicial' && (
        <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl space-y-4">
          <div className="flex gap-2">
            <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-xs font-black uppercase tracking-wider">Conversão de Fluxo Judicial</p>
              <p className="text-xs font-semibold leading-relaxed mt-0.5">
                Uma vez concluído o protocolo fático de uma Petição Inicial, o caso se transforma em Processo Judicial Ajuizado. Insira o número de identificação processual CNJ gerado pelo Tribunal para operacionalizar a conversão.
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-blue-800 uppercase tracking-wider">Número processual CNJ</label>
            <input
              type="text"
              value={processNo}
              onChange={(e) => setProcessNo(applyCNJMask(e.target.value))}
              placeholder="0000000-00.0000.0.00.0000"
              className="w-full px-4 py-3 bg-white border border-blue-150 rounded-xl outline-none font-mono text-xs focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-8 py-3 rounded-xl flex items-center gap-2 transition-all"
        >
          {isSaving ? 'Salvando...' : 'Confirmar e Prosseguir'}
          <ChevronRight size={18} />
        </button>
      </div>
    </form>
  );
}
