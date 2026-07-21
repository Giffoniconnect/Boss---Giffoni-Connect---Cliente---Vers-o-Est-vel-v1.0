import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { BookOpen, AlertTriangle, Scale, Shield, ChevronRight } from 'lucide-react';

interface DadosCasoStepProps {
  caseId: string;
  onNext: () => void;
  onSetLoading: (loading: boolean) => void;
  onAlert: (msg: string) => void;
}

const PRIORITIES = [
  { id: 'baixa', label: 'Baixa', color: 'bg-gray-100 text-gray-700' },
  { id: 'media', label: 'Média', color: 'bg-blue-100 text-blue-700' },
  { id: 'alta', label: 'Alta', color: 'bg-amber-100 text-amber-700' },
  { id: 'urgente', label: 'Urgente / Liminar', color: 'bg-red-100 text-red-700' }
];

export default function DadosCasoStep({ caseId, onNext, onSetLoading, onAlert }: DadosCasoStepProps) {
  const [formData, setFormData] = useState({
    title: '',
    adverseParty: '',
    caseType: '',
    description: '',
    priority: 'media',
    responsibleLawyer: '',
    tribunal: '',
    court: '',
    district: '',
    visibleToClient: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadCase() {
      onSetLoading(true);
      try {
        const caseDoc = await getDoc(doc(db, 'cases', caseId));
        if (caseDoc.exists()) {
          const data = caseDoc.data();
          setFormData({
            title: data.title || '',
            adverseParty: data.adverseParty || '',
            caseType: data.caseType || '',
            description: data.description || '',
            priority: data.priority || 'media',
            responsibleLawyer: data.responsibleLawyer || '',
            tribunal: data.tribunal || '',
            court: data.court || '',
            district: data.district || '',
            visibleToClient: data.visibleToClient ?? true
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        onSetLoading(false);
      }
    }
    loadCase();
  }, [caseId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      onAlert('O título descritivo do caso é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'cases', caseId), {
        ...formData,
        updatedAt: serverTimestamp()
      });
      onNext();
    } catch (err) {
      console.error(err);
      onAlert('Não foi possível gravar os dados secundários do caso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleNext} className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="md:col-span-2 space-y-2">
          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
            Título Geral do Caso (ex: Divórcio Consensual, Revisão de Aposentadoria)
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Digite o título principal..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
            Parte Adversa (Réu / Reclamado / Interessado)
          </label>
          <input
            type="text"
            name="adverseParty"
            value={formData.adverseParty}
            onChange={handleChange}
            placeholder="Parte adversa..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
            Tipo de Ação / Tema (Jurídico)
          </label>
          <input
            type="text"
            name="caseType"
            value={formData.caseType}
            onChange={handleChange}
            placeholder="ex: Direito de Família, Previdenciário..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
            Advogado Técnico Responsável
          </label>
          <input
            type="text"
            name="responsibleLawyer"
            value={formData.responsibleLawyer}
            onChange={handleChange}
            placeholder="Nome do advogado..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
            Prioridade de Produção
          </label>
          <select
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
          >
            {PRIORITIES.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 space-y-2">
          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
            Resumo dos Fatos / Descrição Sucinta
          </label>
          <textarea
            name="description"
            rows={4}
            value={formData.description}
            onChange={handleChange}
            placeholder="Insira notas preliminares ou resumo factual..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
          <Scale size={16} className="text-gray-400" /> Juiz, Comarca e Tribunal (Se aplicável)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
              Tribunal (ex: TJSP, TRF3, TRT2)
            </label>
            <input
              type="text"
              name="tribunal"
              value={formData.tribunal}
              onChange={handleChange}
              placeholder="Tribunal governamental..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
              Vara / Órgão Julgador
            </label>
            <input
              type="text"
              name="court"
              value={formData.court}
              onChange={handleChange}
              placeholder="ex: 2ª Vara Cível..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
              Comarca / Cidade Sede
            </label>
            <input
              type="text"
              name="district"
              value={formData.district}
              onChange={handleChange}
              placeholder="Sede comarca..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">Visibilidade para o Cliente</h4>
          <p className="text-xs text-gray-500 font-semibold">Se habilitado, o cliente poderá acompanhar as atualizações desse caso em seu portal.</p>
        </div>
        <input
          type="checkbox"
          checked={formData.visibleToClient}
          onChange={(e) => setFormData(p => ({ ...p, visibleToClient: e.target.checked }))}
          className="w-5 h-5 rounded border-gray-350 text-blue-600 focus:ring-blue-50"
        />
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-8 py-3 rounded-xl flex items-center gap-2 transition-all"
        >
          {isSubmitting ? 'Salvando...' : 'Gravar e Ir p/ Próximo Passo'}
          <ChevronRight size={18} />
        </button>
      </div>
    </form>
  );
}
