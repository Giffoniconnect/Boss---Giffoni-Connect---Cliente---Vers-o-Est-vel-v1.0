import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  ClipboardList, 
  Save, 
  BookOpen, 
  UserCheck, 
  Calendar, 
  CheckCircle, 
  FileCheck, 
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Briefcase
} from 'lucide-react';
import { 
  EDRP_STAGES, 
  REGISTRATION_TYPES, 
  REVIEW_STATUSES, 
  PROTOCOL_STATUSES, 
  CONTROLADORIA_STATUSES,
  getStageLabel, 
  getRegTypeLabel,
  mapRegTypeToActionCategory
} from '../../../utils/edrpHelpers';

interface CaseEDRPPanelProps {
  caseId: string;
  caseData: any;
  onUpdate: (updatedCase: any) => void;
}

export default function CaseEDRPPanel({ caseId, caseData, onUpdate }: CaseEDRPPanelProps) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Collapse panels state
  const [isHeaderOpen, setIsHeaderOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'geral' | 'delegacao' | 'compromissos' | 'qualidade' | 'protocolo' | 'arquivamento'>('geral');

  // Form states matching existing data or healthy defaults
  const [formData, setFormData] = useState({
    edrpStage: caseData.edrpStage || 'cadastro',
    registrationType: caseData.registrationType || 'peticao_inicial',
    structureNotes: caseData.structureNotes || '',
    
    // Delegation
    delegationResponsible: caseData.delegationResponsible || '',
    delegationSector: caseData.delegationSector || '',
    delegationTask: caseData.delegationTask || '',
    delegationInternalDeadline: caseData.delegationInternalDeadline || '',
    
    // Scheduling
    schedulingType: caseData.schedulingType || '',
    schedulingDate: caseData.schedulingDate || '',
    schedulingTime: caseData.schedulingTime || '',
    schedulingNotes: caseData.schedulingNotes || '',
    
    // Review
    reviewResponsible: caseData.reviewResponsible || '',
    reviewDate: caseData.reviewDate || '',
    reviewStatus: caseData.reviewStatus || 'aguardando_revisao',
    reviewNotes: caseData.reviewNotes || '',
    
    // Protocol
    protocolScheduleDate: caseData.protocolScheduleDate || '',
    protocolResponsible: caseData.protocolResponsible || '',
    protocolSystem: caseData.protocolSystem || '',
    protocolStatus: caseData.protocolStatus || 'nao_aplicavel',
    
    // Controladoria & Archive
    controladoriaStatus: caseData.controladoriaStatus || 'nao_enviado',
    archiveReason: caseData.archiveReason || '',

    // Hearings
    audienciaAgendada: caseData.audienciaAgendada || false,
    audienciaData: caseData.audienciaData || '',
    audienciaHora: caseData.audienciaHora || '',
    audienciaLocalOuLink: caseData.audienciaLocalOuLink || '',
    audienciaResponsavel: caseData.audienciaResponsavel || '',
    audienciaObservacoes: caseData.audienciaObservacoes || '',
  });

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Automatic category mapping on type change
      if (field === 'registrationType') {
        const mappedCat = mapRegTypeToActionCategory(value);
        return {
          ...updated,
          actionCategory: mappedCat
        };
      }
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const caseRef = doc(db, 'cases', caseId);
      
      const mappedCategory = mapRegTypeToActionCategory(formData.registrationType);
      
      // Compile updates object
      const updates: Record<string, any> = {
        ...formData,
        actionCategory: mappedCategory,
        updatedAt: serverTimestamp(),
      };

      // Check for Archive transition
      if (formData.edrpStage === 'arquivamento') {
        updates.status = 'arquivado';
        updates.archived = true;
        updates.archivedAt = serverTimestamp();
        if (!formData.archiveReason) {
          updates.archiveReason = 'Caso arquivado via Painel EDRP.';
        }
      } else {
        updates.status = 'ativo';
        updates.archived = false;
        updates.archivedAt = null;
      }

      await updateDoc(caseRef, updates);
      
      // Update local state in the parent
      onUpdate({
        ...caseData,
        ...updates,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating case EDRP:', err);
      setError(err?.message || 'Erro inesperado ao salvar alterações no EDRP.');
    } finally {
      setSaving(false);
    }
  };

  const inputClasses = "w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm text-gray-800 font-medium";
  const labelClasses = "block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5";

  const isJudicialProcess = formData.registrationType === 'processo_judicial_em_andamento' || 
                            formData.registrationType === 'processo_judicial_ajuizado';

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden w-full transition-all">
      {/* Title Header bar */}
      <div 
        onClick={() => setIsHeaderOpen(!isHeaderOpen)}
        className="px-8 py-5 flex items-center justify-between border-b border-gray-50 bg-gray-50/20 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center text-white">
            <ClipboardList size={20} />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900 leading-none">Painel de Desenvolvimento - EDRP</h2>
            <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-widest">
              Etapa Atual: <span className="text-blue-600 font-black">{getStageLabel(formData.edrpStage)}</span> • Tipo: {getRegTypeLabel(formData.registrationType)}
            </p>
          </div>
        </div>
        <div className="text-gray-400">
          {isHeaderOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {isHeaderOpen && (
        <form onSubmit={handleSave} className="p-8 space-y-6">
          {/* PIPELINE STEPPER METRIC */}
          <div className="overflow-x-auto pb-4 scrollbar-thin">
            <div className="flex items-center min-w-[960px] gap-1 px-1">
              {EDRP_STAGES.map((s, idx) => {
                const isActive = formData.edrpStage === s.id;
                const isPassed = EDRP_STAGES.findIndex(item => item.id === formData.edrpStage) >= idx;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleFieldChange('edrpStage', s.id)}
                    className="flex-1 flex flex-col items-center gap-1 group focus:outline-none"
                  >
                    {/* Visual bar */}
                    <div className="w-full h-1.5 rounded-full transition-all relative">
                      <div className={`absolute inset-0 rounded-full transition-all ${
                        isActive 
                        ? 'bg-blue-600' 
                        : isPassed 
                        ? 'bg-blue-300' 
                        : 'bg-gray-200'
                      }`} />
                    </div>
                    {/* Node Text & Badge */}
                    <span className={`text-[9px] font-black uppercase text-center truncate w-20 leading-tight mt-1 transition-all ${
                      isActive 
                      ? 'text-blue-600 font-black' 
                      : isPassed 
                      ? 'text-gray-700 font-semibold' 
                      : 'text-gray-400'
                    }`}>
                      {idx + 1}. {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* INTERNAL SUITE TABS SELECTOR */}
          <div className="flex items-center gap-1 border-b border-gray-100 overflow-x-auto scrollbar-none pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('geral')}
              className={`px-4 py-2 border-b-2 text-xs font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'geral' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Geral & Faturamento
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('delegacao')}
              className={`px-4 py-2 border-b-2 text-xs font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'delegacao' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Delegação (Etapa 7)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('compromissos')}
              className={`px-4 py-2 border-b-2 text-xs font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'compromissos' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Agendamentos (Etapa 8)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('qualidade')}
              className={`px-4 py-2 border-b-2 text-xs font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'qualidade' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Qualidade & Revisão (Etapa 9)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('protocolo')}
              className={`px-4 py-2 border-b-2 text-xs font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'protocolo' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Protocolização (Etapa 10)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('arquivamento')}
              className={`px-4 py-2 border-b-2 text-xs font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'arquivamento' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Encerramento (11 & 12)
            </button>
          </div>

          {/* TAB CONTENTS */}
          <div className="pt-2">
            {activeTab === 'geral' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClasses}>Etapa Atual</label>
                  <select
                    value={formData.edrpStage}
                    onChange={(e) => handleFieldChange('edrpStage', e.target.value)}
                    className={inputClasses}
                  >
                    {EDRP_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClasses}>Tipo de Cadastro</label>
                  <select
                    value={formData.registrationType}
                    onChange={(e) => handleFieldChange('registrationType', e.target.value)}
                    className={inputClasses}
                  >
                    {REGISTRATION_TYPES.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className={labelClasses}>Notas de Estruturação (Etapa 6)</label>
                  <textarea
                    rows={3}
                    value={formData.structureNotes}
                    onChange={(e) => handleFieldChange('structureNotes', e.target.value)}
                    className={inputClasses}
                    placeholder="Instruções e diretrizes processuais recomendadas..."
                  />
                </div>

                {/* Conditional hearing fields inside geral tab if applicable */}
                {isJudicialProcess && (
                  <div className="md:col-span-2 bg-blue-50/40 p-5 rounded-2xl border border-blue-100/50 space-y-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="audienciaAgendadaPanel"
                        checked={formData.audienciaAgendada}
                        onChange={(e) => handleFieldChange('audienciaAgendada', e.target.checked)}
                        className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="audienciaAgendadaPanel" className="text-xs font-bold text-blue-900 cursor-pointer">
                        Audiência Agendada para este Processo?
                      </label>
                    </div>

                    {formData.audienciaAgendada && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-blue-900 mb-1">Data</label>
                          <input
                            type="date"
                            value={formData.audienciaData}
                            onChange={(e) => handleFieldChange('audienciaData', e.target.value)}
                            className={inputClasses}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-blue-900 mb-1">Hora</label>
                          <input
                            type="time"
                            value={formData.audienciaHora}
                            onChange={(e) => handleFieldChange('audienciaHora', e.target.value)}
                            className={inputClasses}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-blue-900 mb-1">Responsável</label>
                          <input
                            type="text"
                            value={formData.audienciaResponsavel}
                            onChange={(e) => handleFieldChange('audienciaResponsavel', e.target.value)}
                            className={inputClasses}
                            placeholder="Advogado"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-[10px] font-black uppercase text-blue-900 mb-1">Local / Link Virtual</label>
                          <input
                            type="text"
                            value={formData.audienciaLocalOuLink}
                            onChange={(e) => handleFieldChange('audienciaLocalOuLink', e.target.value)}
                            className={inputClasses}
                            placeholder="Link Zoom, Teams, ou Tribunal Físico"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-[10px] font-black uppercase text-blue-900 mb-1">Observações da Audiência</label>
                          <textarea
                            rows={2}
                            value={formData.audienciaObservacoes}
                            onChange={(e) => handleFieldChange('audienciaObservacoes', e.target.value)}
                            className={inputClasses}
                            placeholder="Observações complementares..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'delegacao' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={labelClasses}>Colaborador Delegado</label>
                  <input
                    type="text"
                    value={formData.delegationResponsible}
                    onChange={(e) => handleFieldChange('delegationResponsible', e.target.value)}
                    className={inputClasses}
                    placeholder="Nome do advogado/estagiário"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Setor Alvo</label>
                  <input
                    type="text"
                    value={formData.delegationSector}
                    onChange={(e) => handleFieldChange('delegationSector', e.target.value)}
                    className={inputClasses}
                    placeholder="ex: Cível, Previdenciário"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Prazo Atendimento Interno</label>
                  <input
                    type="date"
                    value={formData.delegationInternalDeadline}
                    onChange={(e) => handleFieldChange('delegationInternalDeadline', e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className={labelClasses}>Tarefa Proposta</label>
                  <textarea
                    rows={3}
                    value={formData.delegationTask}
                    onChange={(e) => handleFieldChange('delegationTask', e.target.value)}
                    className={inputClasses}
                    placeholder="Insira detalhes descritivos da tarefa operada..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'compromissos' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={labelClasses}>Tipo de Agendamento</label>
                  <input
                    type="text"
                    value={formData.schedulingType}
                    onChange={(e) => handleFieldChange('schedulingType', e.target.value)}
                    className={inputClasses}
                    placeholder="ex: Perícia, Réplica, Audiência"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Data do Evento</label>
                  <input
                    type="date"
                    value={formData.schedulingDate}
                    onChange={(e) => handleFieldChange('schedulingDate', e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className={labelClasses}>Hora do Evento</label>
                  <input
                    type="time"
                    value={formData.schedulingTime}
                    onChange={(e) => handleFieldChange('schedulingTime', e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className={labelClasses}>Anotações do Compromisso</label>
                  <textarea
                    rows={3}
                    value={formData.schedulingNotes}
                    onChange={(e) => handleFieldChange('schedulingNotes', e.target.value)}
                    className={inputClasses}
                    placeholder="Observações complementares relevantes..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'qualidade' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={labelClasses}>Status da Revisão</label>
                  <select
                    value={formData.reviewStatus}
                    onChange={(e) => handleFieldChange('reviewStatus', e.target.value)}
                    className={inputClasses}
                  >
                    {REVIEW_STATUSES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClasses}>Advogado Revisor</label>
                  <input
                    type="text"
                    value={formData.reviewResponsible}
                    onChange={(e) => handleFieldChange('reviewResponsible', e.target.value)}
                    className={inputClasses}
                    placeholder="Nome do revisor sênior"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Data da Revisão</label>
                  <input
                    type="date"
                    value={formData.reviewDate}
                    onChange={(e) => handleFieldChange('reviewDate', e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className={labelClasses}>Observações de Qualidade</label>
                  <textarea
                    rows={3}
                    value={formData.reviewNotes}
                    onChange={(e) => handleFieldChange('reviewNotes', e.target.value)}
                    className={inputClasses}
                    placeholder="Descreva correções ou notas de aprovação..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'protocolo' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className={labelClasses}>Status Protocolo</label>
                  <select
                    value={formData.protocolStatus}
                    onChange={(e) => handleFieldChange('protocolStatus', e.target.value)}
                    className={inputClasses}
                  >
                    {PROTOCOL_STATUSES.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClasses}>Previsão Protocolo</label>
                  <input
                    type="date"
                    value={formData.protocolScheduleDate}
                    onChange={(e) => handleFieldChange('protocolScheduleDate', e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className={labelClasses}>Responsável</label>
                  <input
                    type="text"
                    value={formData.protocolResponsible}
                    onChange={(e) => handleFieldChange('protocolResponsible', e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className={labelClasses}>Sistema Alvo</label>
                  <input
                    type="text"
                    value={formData.protocolSystem}
                    onChange={(e) => handleFieldChange('protocolSystem', e.target.value)}
                    className={inputClasses}
                    placeholder="PJe, eSAJ, Creta"
                  />
                </div>
              </div>
            )}

            {activeTab === 'arquivamento' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClasses}>Status Controladoria (Etapa 11)</label>
                  <select
                    value={formData.controladoriaStatus}
                    onChange={(e) => handleFieldChange('controladoriaStatus', e.target.value)}
                    className={inputClasses}
                  >
                    {CONTROLADORIA_STATUSES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClasses}>Motivo Encerramento (Etapa 12)</label>
                  <input
                    type="text"
                    value={formData.archiveReason}
                    onChange={(e) => handleFieldChange('archiveReason', e.target.value)}
                    className={inputClasses}
                    placeholder="ex: Acordo aceito e quitado, trânsito em julgado"
                  />
                </div>

                {formData.edrpStage === 'arquivamento' && (
                  <div className="md:col-span-2 p-4 bg-red-50 rounded-2xl border border-red-100/60 flex items-start gap-3">
                    <ShieldAlert className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                    <div>
                      <h4 className="text-xs font-black text-red-700 uppercase tracking-wider mb-0.5">Aviso de Arquivamento</h4>
                      <p className="text-[11px] text-red-600 font-semibold max-w-xl">
                        Ao selecionar a etapa "Arquivamento", o status do caso será atualizado automaticamente para "arquivado" e o campo "archived" será definido como true após salvar.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STATUS NOTIFICATIONS */}
          {error && (
            <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl border border-red-100 flex items-center gap-2">
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-2xl border border-emerald-100 flex items-center gap-2">
              <CheckCircle size={16} />
              <span>Alterações operacionais EDRP salvas com sucesso!</span>
            </div>
          )}

          {/* SAVE CONTROLS BAR */}
          <div className="flex justify-end pt-4 border-t border-gray-50">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white font-bold text-xs uppercase tracking-widest px-8 py-3.5 rounded-2xl hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-50 cursor-pointer"
            >
              <Save size={16} />
              {saving ? 'Gravando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
