import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Scale, FileText, ClipboardList, Briefcase, Eye, ChevronRight } from 'lucide-react';

interface ServicoStepProps {
  clientId: string;
  slug: string;
  caseId: string | null;
  onNext: (caseId: string) => void;
  onSetLoading: (loading: boolean) => void;
  onAlert: (msg: string) => void;
}

const SERVICES = [
  { 
    id: 'peticao_inicial', 
    label: 'Petição Inicial', 
    desc: 'Elaboração e instrução de ação para distribuição em órgãos do judiciário.',
    statusPublico: 'Aguardando distribuição',
    icon: Scale
  },
  { 
    id: 'requerimento_administrativo', 
    label: 'Requerimento Administrativo', 
    desc: 'Procedimentos e pedidos perante cartórios, INSS, conselhos ou entes federativos.',
    statusPublico: 'Requerimento pendente',
    icon: ClipboardList
  },
  { 
    id: 'extrajudicial', 
    label: 'Extrajudicial', 
    desc: 'Tratativas de acordos, notificações extrajudiciais, mediações ou conciliações.',
    statusPublico: 'Tratativa extrajudicial pendente',
    icon: Briefcase
  },
  { 
    id: 'processo_judicial_em_andamento', 
    label: 'Processo Judicial em Andamento', 
    desc: 'Acompanhamento processual ativo de litígio previamente distribuído.',
    statusPublico: 'Processo judicial em andamento',
    icon: FileText
  },
  { 
    id: 'processo_judicial_ajuizado', 
    label: 'Processo Judicial Ajuizado', 
    desc: 'Ação que recentemente alcançou protocolo fático e possui número CNJ.',
    statusPublico: 'Processo judicial ajuizado',
    icon: FileText
  }
];

export default function ServicoStep({ clientId, slug, caseId, onNext, onSetLoading, onAlert }: ServicoStepProps) {
  const [selectedService, setSelectedService] = useState('peticao_inicial');
  const [processNo, setProcessNo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (caseId) {
      async function loadCase() {
        onSetLoading(true);
        try {
          const caseDoc = await getDoc(doc(db, 'cases', caseId));
          if (caseDoc.exists()) {
            const data = caseDoc.data();
            setSelectedService(data.registrationType || 'peticao_inicial');
            setProcessNo(data.processNumber || '');
          }
        } catch (err) {
          console.error(err);
        } finally {
          onSetLoading(false);
        }
      }
      loadCase();
    }
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

  const handleNext = async () => {
    const serviceInfo = SERVICES.find(s => s.id === selectedService);
    if (!serviceInfo) return;

    if ((selectedService === 'processo_judicial_em_andamento' || selectedService === 'processo_judicial_ajuizado') && !processNo) {
      onAlert('Para cadastrar processos preexistentes ou ajuizados, o número único CNJ é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    try {
      const casePayload: any = {
        clientId,
        clientSlug: slug,
        registrationType: selectedService,
        actionCategory: selectedService === 'requerimento_administrativo' ? 'administrativo' : selectedService === 'extrajudicial' ? 'extrajudicial' : 'judicial',
        processNumber: processNo,
        status: 'em_producao',
        productionStatus: 'em_producao',
        statusInterno: 'em_producao',
        statusPublicoCliente: serviceInfo.statusPublico,
        updatedAt: serverTimestamp()
      };

      let activeId = caseId;
      if (caseId) {
        await updateDoc(doc(db, 'cases', caseId), casePayload);
      } else {
        casePayload.createdAt = serverTimestamp();
        casePayload.title = 'CASO EM INSTRUÇÃO';
        const docRef = await addDoc(collection(db, 'cases'), casePayload);
        activeId = docRef.id;
        await updateDoc(doc(db, 'cases', docRef.id), { caseId: docRef.id });
      }

      onNext(activeId!);
    } catch (err) {
      console.error(err);
      onAlert('Não foi possível registrar o tipo de produção do caso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-4">
        {SERVICES.map(srv => {
          const Icon = srv.icon;
          const isSelected = selectedService === srv.id;
          return (
            <div
              key={srv.id}
              onClick={() => setSelectedService(srv.id)}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                isSelected ? 'border-blue-600 bg-blue-50/20' : 'border-gray-100 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isSelected ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-400'
              }`}>
                <Icon size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-900">{srv.label}</h4>
                <p className="text-xs text-gray-500 leading-relaxed font-semibold">{srv.desc}</p>
                <div className="flex items-center gap-1.5 pt-1.5">
                  <Eye size={12} className="text-blue-500" />
                  <span className="text-xs text-blue-700 font-extrabold uppercase tracking-widest">
                    Status Público: {srv.statusPublico}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(selectedService === 'processo_judicial_em_andamento' || selectedService === 'processo_judicial_ajuizado') && (
        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-150 space-y-2">
          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
            Número Processual Único CNJ
          </label>
          <input
            type="text"
            value={processNo}
            onChange={(e) => setProcessNo(applyCNJMask(e.target.value))}
            placeholder="0000000-00.0000.0.00.0000"
            className="w-full px-4 py-3 bg-white border border-gray-150 rounded-xl outline-none font-mono text-sm focus:ring-2 focus:ring-blue-100"
          />
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={handleNext}
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-8 py-3 rounded-xl flex items-center gap-2 transition-all"
        >
          {isSubmitting ? 'Salvando...' : 'Confirmar e Continuar'}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
