import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BossLayout } from '../../../components/Layout';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  Building2, 
  User, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Edit3, 
  X,
  FileCheck, 
  Sparkles, 
  TrendingDown, 
  XCircle, 
  Scale, 
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';

export default function CadastrarLeadsEtapa2() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);

  // Qualification sub-options State
  const [qualificationStatus, setQualificationStatus] = useState<'idle' | 'disqualify' | 'qualified'>('idle');
  const [disqualifyReason, setDisqualifyReason] = useState('');
  
  // Viability Analysis form state
  const [viabilityForm, setViabilityForm] = useState({
    viabilidadeTecnica: 'Alta',
    probabilidadeExito: 'Provável',
    parecerViabilidade: '',
    honorariosPropostos: ''
  });
  const [showViabilityForm, setShowViabilityForm] = useState(false);

  // Fetch Lead Info
  const loadLead = async () => {
    if (!leadId) return;
    try {
      setLoading(true);
      setError(null);
      const docRef = doc(db, 'marketingLeads', leadId);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();
        setLead({ id: snap.id, ...data });
        setEditFormData(data);
        if (data.analiseViabilidade) {
          setViabilityForm({
            viabilidadeTecnica: data.analiseViabilidade.viabilidadeTecnica || 'Alta',
            probabilidadeExito: data.analiseViabilidade.probabilidadeExito || 'Provável',
            parecerViabilidade: data.analiseViabilidade.parecerViabilidade || '',
            honorariosPropostos: data.analiseViabilidade.honorariosPropostos || ''
          });
        }
      } else {
        // Fallback to localStorage list
        const local = localStorage.getItem('local_marketing_leads');
        const list = local ? JSON.parse(local) : [];
        const found = list.find((item: any) => item.id === leadId);

        if (found) {
          setLead(found);
          setEditFormData(found);
          if (found.analiseViabilidade) {
            setViabilityForm({
              viabilidadeTecnica: found.analiseViabilidade.viabilidadeTecnica || 'Alta',
              probabilidadeExito: found.analiseViabilidade.probabilidadeExito || 'Provável',
              parecerViabilidade: found.analiseViabilidade.parecerViabilidade || '',
              honorariosPropostos: found.analiseViabilidade.honorariosPropostos || ''
            });
          }
        } else {
          setError('Lead não localizado no banco de dados ou backup local.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar detalhes do lead: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLead();
  }, [leadId]);

  // Save changes from Edit Form
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) return;
    try {
      setLoading(true);
      setError(null);
      const parentNow = new Date().toISOString();
      const updatedPayload = {
        ...editFormData,
        updatedAt: parentNow
      };

      const docRef = doc(db, 'marketingLeads', leadId);
      await updateDoc(docRef, updatedPayload);

      // Local storage sync
      const local = localStorage.getItem('local_marketing_leads');
      const list = local ? JSON.parse(local) : [];
      const updatedList = list.map((item: any) => item.id === leadId ? updatedPayload : item);
      localStorage.setItem('local_marketing_leads', JSON.stringify(updatedList));

      setLead(updatedPayload);
      setSuccess('Painel do Cliente em Potencial atualizado com sucesso!');
      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao atualizar dados: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Disqualify Lead Flow
  const handleConfirmDisqualify = async () => {
    if (!leadId || !disqualifyReason.trim()) {
      alert('Por favor, informe a justificativa da desqualificação.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const parentNow = new Date().toISOString();
      const updatedFields = {
        statusFunil: 'Perdido',
        motivoDesqualificacao: disqualifyReason,
        updatedAt: parentNow
      };

      const docRef = doc(db, 'marketingLeads', leadId);
      await updateDoc(docRef, updatedFields);

      // Local storage sync
      const local = localStorage.getItem('local_marketing_leads');
      const list = local ? JSON.parse(local) : [];
      const updatedList = list.map((item: any) => item.id === leadId ? { ...item, ...updatedFields } : item);
      localStorage.setItem('local_marketing_leads', JSON.stringify(updatedList));

      setSuccess('Lead desqualificado comercialmente com sucesso.');
      setQualificationStatus('idle');
      
      setTimeout(() => {
        navigate('/boss/leads/private/dashboard');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao desqualificar lead: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Save Viability Analysis
  const handleSaveViability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) return;
    try {
      setLoading(true);
      setError(null);
      const parentNow = new Date().toISOString();
      const updatedFields = {
        statusFunil: 'Em Análise Jurídica',
        analiseViabilidade: viabilityForm,
        updatedAt: parentNow
      };

      const docRef = doc(db, 'marketingLeads', leadId);
      await updateDoc(docRef, updatedFields);

      // Local storage sync
      const local = localStorage.getItem('local_marketing_leads');
      const list = local ? JSON.parse(local) : [];
      const updatedList = list.map((item: any) => item.id === leadId ? { ...item, ...updatedFields } : item);
      localStorage.setItem('local_marketing_leads', JSON.stringify(updatedList));

      setLead({ ...lead, ...updatedFields });
      setSuccess('Análise de Viabilidade Técnica e Comercial salva com sucesso!');
      setShowViabilityForm(false);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao salvar análise de viabilidade: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Convert Lead / Converter em Cliente
  const handleConvertLead = async () => {
    if (!lead) return;
    try {
      setLoading(true);
      setError(null);
      const parentNow = new Date().toISOString();
      const updatedFields = {
        statusFunil: 'Convertido em Cliente',
        convertidoEmCliente: true,
        dataConversao: parentNow,
        updatedAt: parentNow
      };

      const docRef = doc(db, 'marketingLeads', lead.id);
      await updateDoc(docRef, updatedFields);

      // Local storage sync
      const local = localStorage.getItem('local_marketing_leads');
      const list = local ? JSON.parse(local) : [];
      const updatedList = list.map((item: any) => item.id === lead.id ? { ...item, ...updatedFields } : item);
      localStorage.setItem('local_marketing_leads', JSON.stringify(updatedList));

      // Save structured conversion payload into localStorage
      const conversionData = {
        leadId: lead.id,
        tipoPessoa: lead.tipoPessoa,
        origemOriginal: lead.origemLead,
        pessoaFisica: lead.pessoaFisica,
        pessoaJuridica: lead.pessoaJuridica,
        originalLead: lead
      };
      localStorage.setItem('temp_lead_data', JSON.stringify(conversionData));

      setSuccess('Lead convertido com sucesso! Redirecionando para preenchimento de ficha de produção...');

      setTimeout(() => {
        navigate(`/boss-giffoni-clientes/fluxo-producao/cadastro?path=novo-cliente`);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao converter lead: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <BossLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-0 space-y-8 animate-fade-in pb-16">
        
        {/* HEADER & STAGE INDICATION MAP */}
        <div className="border-b border-gray-150 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-indigo-650 font-mono">
                Etapa 02 — Relacionamento do Cliente em Potencial
              </span>
              <h1 className="text-xl font-black text-gray-900 tracking-tight leading-snug">
                Funil de Vendas de Serviços Jurídicos da Giffoni Advogados - Relacionamento do Cliente em Potencial da Giffoni Advogados Associados
              </h1>
            </div>
            
            <button
              type="button"
              onClick={() => navigate('/boss/leads/private/dashboard')}
              className="text-xs font-bold text-gray-650 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-4xs transition hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
            >
              <ArrowLeft size={14} />
              <span>Voltar ao Dashboard</span>
            </button>
          </div>

          {/* SATELLITE STEPPING MAP */}
          <div className="grid grid-cols-3 gap-2 mt-6">
            <div className="bg-emerald-50 border border-emerald-150 p-3 rounded-xl flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">✓</div>
              <div>
                <span className="block text-[8px] uppercase tracking-normal font-black text-emerald-800">Etapa 01</span>
                <span className="block text-[10px] font-bold text-emerald-950">Identificação</span>
              </div>
            </div>

            <div className="bg-indigo-600 border border-indigo-700 text-white p-3 rounded-xl flex items-center gap-2 shadow-sm">
              <div className="w-5 h-5 rounded-full bg-white text-indigo-600 flex items-center justify-center text-[10px] font-black font-sans">02</div>
              <div>
                <span className="block text-[8px] uppercase tracking-normal font-black text-indigo-200">Etapa Ativa</span>
                <span className="block text-[10px] font-black">Relacionamento & Viabilidade</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-gray-150 p-3 rounded-xl flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-black font-sans">03</div>
              <div>
                <span className="block text-[8px] uppercase tracking-normal font-black text-slate-400">Etapa Final</span>
                <span className="block text-[10px] font-bold text-slate-600">Qualificação / Conversão</span>
              </div>
            </div>
          </div>
        </div>

        {/* FEEDBACK FEED */}
        {error && (
          <div className="bg-rose-50 border border-rose-150 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-rose-800 font-bold">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-emerald-800 font-bold">{success}</p>
          </div>
        )}

        {loading && !lead ? (
          <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-gray-500">Buscando e consolidando dados cadastrais do lead...</p>
          </div>
        ) : (
          <>
            {/* STAGE CONTAINER WITH COLLABORATIVE VIEWER & COMPREHENSIVE CONSOLIDATOR */}
            <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs">
              <div className="bg-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-650 rounded-2xl text-white">
                    {lead?.tipoPessoa === 'PJ' ? <Building2 size={22} /> : <User size={22} />}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm uppercase tracking-wider font-mono">
                      Painel do Cliente em Potencial — Ficha Consolidada
                    </h3>
                    <p className="text-[10px] text-gray-400">
                      Visualização unificada de dados qualificados na Etapa 01. Tipo de Pessoa: <strong className="text-white text-xs">{lead?.tipoPessoa}</strong>
                    </p>
                  </div>
                </div>

                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditFormData({ ...lead });
                      setIsEditing(true);
                    }}
                    className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm ml-auto sm:ml-0"
                  >
                    <Edit3 size={12} />
                    <span>Editar Painel</span>
                  </button>
                )}
              </div>

              {/* READ MODE (CONSOLIDATED VERSION) */}
              {!isEditing ? (
                <div className="p-6 space-y-8">
                  {/* DETALHES CADASTRAIS DO CLIENTE EM POTENCIAL */}
                  <div className="space-y-4">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-450 border-b border-gray-100 pb-1.5">
                      1. Informações de Identificação Cadastral ({lead?.tipoPessoa === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'})
                    </span>

                    {lead?.tipoPessoa === 'PF' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs bg-slate-50/50 p-4 border border-gray-200/40 rounded-2xl">
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Nome Completo</span>
                          <span className="font-black text-gray-900 text-sm">{lead?.pessoaFisica?.nomeCompleto || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">CPF</span>
                          <span className="font-bold text-gray-800 font-mono">{lead?.pessoaFisica?.cpf || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">RG</span>
                          <span className="font-semibold text-gray-700">{lead?.pessoaFisica?.rg || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Data de Nascimento</span>
                          <span className="font-semibold text-gray-700">{lead?.pessoaFisica?.dataNascimento ? new Date(lead?.pessoaFisica?.dataNascimento).toLocaleDateString('pt-BR') : '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Estado Civil</span>
                          <span className="font-semibold text-gray-700">{lead?.pessoaFisica?.estadoCivil || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Profissão</span>
                          <span className="font-semibold text-gray-700">{lead?.pessoaFisica?.profissao || '—'}</span>
                        </div>
                        <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100/60 mt-1">
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-gray-400" />
                            <div>
                              <span className="block text-[8px] uppercase text-gray-400">Telefone / WhatsApp</span>
                              <span className="font-bold text-indigo-950 font-mono">{lead?.pessoaFisica?.whatsapp || lead?.pessoaFisica?.telefone || '—'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:col-span-2">
                            <Mail size={14} className="text-gray-400" />
                            <div>
                              <span className="block text-[8px] uppercase text-gray-400">Email Particular</span>
                              <span className="font-bold text-gray-800 break-all">{lead?.pessoaFisica?.email || '—'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="sm:col-span-3 flex items-start gap-2 pt-2 border-t border-gray-100/60 font-medium">
                          <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="block text-[8px] uppercase text-gray-400">Endereço Residencial</span>
                            <span className="text-gray-700">{lead?.pessoaFisica?.endereco || '—'} {lead?.pessoaFisica?.cidade ? `— ${lead?.pessoaFisica?.cidade}` : ''} {lead?.pessoaFisica?.uf ? `(${lead?.pessoaFisica?.uf})` : ''}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs bg-slate-50/50 p-4 border border-gray-200/40 rounded-2xl">
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Razão Social</span>
                          <span className="font-black text-gray-900 text-sm">{lead?.pessoaJuridica?.razaoSocial || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Nome Fantasia</span>
                          <span className="font-bold text-gray-800">{lead?.pessoaJuridica?.nomeFantasia || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">CNPJ</span>
                          <span className="font-bold text-gray-700 font-mono">{lead?.pessoaJuridica?.cnpj || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Inscrição Estadual</span>
                          <span className="font-semibold text-gray-700">{lead?.pessoaJuridica?.inscricaoEstadual || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Representante Legal</span>
                          <span className="font-bold text-gray-900 uppercase">{lead?.pessoaJuridica?.representanteLegal || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Cargo / CPF do Rep</span>
                          <span className="font-semibold text-gray-700">{lead?.pessoaJuridica?.cargoRepresentante || 'Representante'} — {lead?.pessoaJuridica?.cpfRepresentante || '—'}</span>
                        </div>
                        <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100/60 mt-1">
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-gray-400" />
                            <div>
                              <span className="block text-[8px] uppercase text-gray-400">WhatsApp Comercial</span>
                              <span className="font-bold text-indigo-950 font-mono">{lead?.pessoaJuridica?.whatsapp || lead?.pessoaJuridica?.telefone || '—'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:col-span-2">
                            <Mail size={14} className="text-gray-400" />
                            <div>
                              <span className="block text-[8px] uppercase text-gray-400">Email Corporativo</span>
                              <span className="font-bold text-gray-800 break-all">{lead?.pessoaJuridica?.email || '—'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="sm:col-span-3 flex items-start gap-2 pt-2 border-t border-gray-100/60 font-medium">
                          <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="block text-[8px] uppercase text-gray-400">Sede da Empresa</span>
                            <span className="text-gray-700">{lead?.pessoaJuridica?.endereco || '—'} {lead?.pessoaJuridica?.cidade ? `— ${lead?.pessoaJuridica?.cidade}` : ''} {lead?.pessoaJuridica?.uf ? `(${lead?.pessoaJuridica?.uf})` : ''}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CASO JURÍDICO & DEMANDA */}
                  <div className="space-y-4">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-450 border-b border-gray-100 pb-1.5">
                      2. Qualificação Jurídica da Demanda e Fatores de Negócio
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                      <div className="bg-slate-50/55 p-3 rounded-xl border border-gray-150">
                        <span className="block text-[8.5px] uppercase text-gray-400 font-extrabold">Origem do Lead</span>
                        <span className="font-black text-gray-800 text-sm block mt-0.5">{lead?.origemLead || '—'}</span>
                      </div>
                      
                      <div className="bg-slate-50/55 p-3 rounded-xl border border-gray-150">
                        <span className="block text-[8.5px] uppercase text-gray-400 font-extrabold">Área de Interesse</span>
                        <span className="font-black text-indigo-700 text-sm block mt-0.5">{lead?.areaJuridica || '—'}</span>
                      </div>

                      <div className="bg-slate-50/55 p-3 rounded-xl border border-gray-150">
                        <span className="block text-[8.5px] uppercase text-gray-400 font-extrabold">Responsável Interno</span>
                        <span className="font-bold text-gray-800 text-sm block mt-0.5">{lead?.responsavelInterno || '—'}</span>
                      </div>

                      <div className="bg-slate-50/55 p-3 rounded-xl border border-gray-150">
                        <span className="block text-[8.5px] uppercase text-gray-400 font-extrabold">Status no Funil Comercial</span>
                        <span className="font-black text-purple-700 text-sm block mt-0.5 font-mono">{lead?.statusFunil || '—'}</span>
                      </div>

                      <div className="md:col-span-2 bg-slate-50/55 p-4.5 rounded-xl border border-gray-150 space-y-2">
                        <span className="block text-[8.5px] uppercase text-gray-400 font-extrabold">Assunto da Demanda</span>
                        <p className="font-bold text-gray-900 text-sm">{lead?.assunto || '—'}</p>
                        
                        <div className="pt-2 border-t border-gray-100 flex justify-between text-[11px] font-semibold text-gray-600">
                          <span>Processo Ativo: <strong>{lead?.possuiProcesso ? 'Sim' : 'Não'}</strong></span>
                          {lead?.possuiProcesso && (
                            <span className="font-mono">Nº: <strong className="text-gray-900 select-all">{lead?.numeroProcesso}</strong></span>
                          )}
                        </div>
                      </div>

                      <div className="md:col-span-2 bg-slate-50/55 p-4.5 rounded-xl border border-gray-150 space-y-2">
                        <span className="block text-[8.5px] uppercase text-gray-400 font-extrabold">Fatores Temporais (Prazos)</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 font-black text-[10px] rounded uppercase ${lead?.existePrazo ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-slate-150 text-slate-600'}`}>
                            {lead?.existePrazo ? 'Morte / Prazo Fatal' : 'Sem prazo fatal'}
                          </span>
                          {lead?.existePrazo && lead?.dataPrazo && (
                            <span className="font-black text-rose-800">
                              Limite: {new Date(lead?.dataPrazo).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                        <div className="pt-1.5 text-[11px] font-bold text-gray-500">
                          Urgência Comercial: <strong className="text-amber-700 font-black">{lead?.urgencia || 'Média'}</strong>
                        </div>
                      </div>

                      <div className="md:col-span-4 bg-slate-50/55 p-4.5 rounded-xl border border-gray-150">
                        <span className="block text-[8.5px] uppercase text-gray-400 font-extrabold">Dor Principal do Negócio</span>
                        <p className="font-bold text-gray-800 text-xs leading-relaxed mt-1">{lead?.dorPrincipal || '—'}</p>
                      </div>

                      <div className="md:col-span-3 bg-slate-50/55 p-4 px-5 rounded-xl border border-gray-150 flex items-center justify-between">
                        <div>
                          <span className="block text-[8.5px] uppercase text-gray-400 font-extrabold">Próximo Passo Orientado</span>
                          <span className="font-black text-indigo-950 text-xs">{lead?.proximoPasso || 'Aguardando call técnica'}</span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 font-mono">Etapa 02</span>
                      </div>

                      <div className="bg-slate-50/55 p-4 rounded-xl border border-gray-150 text-right">
                        <span className="block text-[8.5px] uppercase text-gray-400 font-extrabold">Valor Comercial Estimado</span>
                        <span className="font-black text-emerald-700 text-lg block mt-1">
                          R$ {parseFloat(String(lead?.valorPotencial || 0).replace(/[^\d.]/g, '') || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SYSTEM INTEGRATION FEEDBACK */}
                  {lead?.analiseViabilidade && (
                    <div className="bg-indigo-50 border border-indigo-150 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-indigo-950 font-black text-xs">
                        <Scale size={16} />
                        <span>ANÁLISE DE VIABILIDADE TÉCNICA E JURÍDICA REGISTRADA</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-indigo-900 pt-1">
                        <div>
                          Definição de Viabilidade: <strong className="text-indigo-950 font-extrabold text-sm">{lead?.analiseViabilidade?.viabilidadeTecnica}</strong>
                        </div>
                        <div>
                          Probabilidade de Êxito: <strong className="text-indigo-950 font-extrabold text-sm">{lead?.analiseViabilidade?.probabilidadeExito}</strong>
                        </div>
                        <div>
                          Honorários Estimados: <strong className="text-emerald-800 font-extrabold text-sm">
                            R$ {parseFloat(String(lead?.analiseViabilidade?.honorariosPropostos || 0).replace(/[^\d.]/g, '') || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      </div>
                      {lead?.analiseViabilidade?.parecerViabilidade && (
                        <div className="text-xs text-indigo-950 bg-white/60 p-3 rounded-lg border border-indigo-100 mt-2">
                          <strong className="block text-[10px] text-indigo-405 mb-0.5 uppercase">Parecer do Advogado Associado:</strong>
                          <span className="italic block mt-1 leading-relaxed font-bold">{lead?.analiseViabilidade?.parecerViabilidade}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECTION 3: CONTROLE COMERCIAL & INFORMAÇÕES DE CONTATO ADICIONAIS (ETAPA 01) */}
                  <div className="space-y-4 pt-6 mt-6 border-t border-gray-150">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-450 border-b border-gray-100 pb-1.5">
                      3. Controle Comercial e Redes Sociais Integradas (Etapa 01)
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
                      {/* Classificação */}
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-gray-150">
                        <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400 font-sans">Classificação</span>
                        <span className="font-bold text-gray-800 block mt-0.5 font-sans">{lead?.classificacao || 'Geral'}</span>
                      </div>

                      {/* Já é Cliente? */}
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-gray-150">
                        <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400 font-sans">Vínculo com Escritório</span>
                        <span className="font-bold text-gray-800 block mt-0.5 font-sans">{lead?.jaCliente || (lead?.possuiProcesso ? 'Já é Cliente' : 'Caso Novo')}</span>
                      </div>

                      {/* Agendamento de Reunião solicitado? */}
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-gray-150">
                        <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400 font-sans">Agendar Reunião</span>
                        <span className={`inline-block px-2 py-0.5 text-[9px] rounded font-black uppercase mt-1 font-sans ${lead?.solicitarReuniao ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-gray-100 text-gray-650'}`}>
                          {lead?.solicitarReuniao ? 'Sim (Solicitada)' : 'Não'}
                        </span>
                      </div>

                      {/* Documentação Inicial */}
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-gray-150">
                        <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400 font-sans">Documentação Comercial</span>
                        <span className={`inline-block px-2 py-0.5 text-[9px] rounded font-black uppercase mt-1 font-sans ${lead?.documentosRecebidos ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-gray-100 text-gray-650'}`}>
                          {lead?.documentosRecebidos ? 'Recebida' : 'Pendente e em cobrança'}
                        </span>
                      </div>

                      {/* Redes Sociais */}
                      <div className="md:col-span-2 bg-slate-50/50 p-3 rounded-xl border border-gray-150">
                        <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400 font-sans">Redes Sociais e Perfis Associados</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1.5 text-[11px] font-sans">
                          {lead?.tipoPessoa === 'PF' ? (
                            <>
                              <div>
                                <span className="text-gray-400 font-bold">Instagram:</span>{' '}
                                <span className="font-black text-gray-800">{lead?.pessoaFisica?.instagram || 'Não informado'}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 font-bold">TikTok:</span>{' '}
                                <span className="font-black text-gray-800">{lead?.pessoaFisica?.tiktok || 'Não informado'}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 font-bold">Facebook:</span>{' '}
                                <span className="font-black text-gray-800">{lead?.pessoaFisica?.facebook || 'Não informado'}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="sm:col-span-3 border-b border-gray-200/50 pb-1 mb-1 space-y-1">
                                <span className="text-[10px] uppercase font-black tracking-widest text-indigo-650 font-mono block">Empresa</span>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <span className="text-gray-400 font-bold">Instagram:</span>{' '}
                                    <span className="font-semibold text-gray-800">{lead?.pessoaJuridica?.instagramEmpresa || 'Não informado'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400 font-bold">TikTok:</span>{' '}
                                    <span className="font-semibold text-gray-800">{lead?.pessoaJuridica?.tiktokEmpresa || 'Não informado'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400 font-bold">Facebook:</span>{' '}
                                    <span className="font-semibold text-gray-800">{lead?.pessoaJuridica?.facebookEmpresa || 'Não informado'}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="sm:col-span-3 space-y-1">
                                <span className="text-[10px] uppercase font-black tracking-widest text-red-650 font-mono block">Representante</span>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <span className="text-gray-400 font-bold">Instagram:</span>{' '}
                                    <span className="font-semibold text-gray-800">{lead?.pessoaJuridica?.instagramRepresentante || 'Não informado'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400 font-bold">TikTok:</span>{' '}
                                    <span className="font-semibold text-gray-800">{lead?.pessoaJuridica?.tiktokRepresentante || 'Não informado'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400 font-bold">Facebook:</span>{' '}
                                    <span className="font-semibold text-gray-800">{lead?.pessoaJuridica?.facebookRepresentante || 'Não informado'}</span>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Observações Gerais */}
                      <div className="md:col-span-3 bg-slate-50/50 p-4.5 rounded-xl border border-gray-150">
                        <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400 font-sans">Observações Gerais - Etapa 01</span>
                        <p className="text-gray-800 text-xs mt-1.5 italic font-black leading-relaxed whitespace-pre-wrap bg-white p-3 border border-gray-100 rounded-lg shadow-3xs font-sans">{lead?.observacoes || 'Sem observações gerais cadastradas na etapa 01.'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* EDIT MODE (FORM COMPONENT CONSOLIDATED) */
                <form onSubmit={handleSaveEdit} className="p-6 space-y-6">
                  <div className="bg-amber-50 border border-amber-100 text-amber-900 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2">
                    <Clock size={16} />
                    <span>Modo de Edição Ativo. Modifique os parâmetros cadastrados e salve para consolidá-los.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {lead?.tipoPessoa === 'PF' ? (
                      <>
                        <div className="sm:col-span-2">
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Nome Completo</label>
                          <input 
                            type="text" 
                            required
                            value={editFormData?.pessoaFisica?.nomeCompleto || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaFisica: { ...editFormData.pessoaFisica, nomeCompleto: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">CPF</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaFisica?.cpf || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaFisica: { ...editFormData.pessoaFisica, cpf: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">RG</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaFisica?.rg || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaFisica: { ...editFormData.pessoaFisica, rg: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Estado Civil</label>
                          <select 
                            value={editFormData?.pessoaFisica?.estadoCivil || 'Solteiro(a)'}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaFisica: { ...editFormData.pessoaFisica, estadoCivil: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl focus:bg-white"
                          >
                            <option>Solteiro(a)</option>
                            <option>Casado(a)</option>
                            <option>Divorciado(a)</option>
                            <option>Viúvo(a)</option>
                            <option>União Estável</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Profissão</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaFisica?.profissao || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaFisica: { ...editFormData.pessoaFisica, profissao: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">WhatsApp / Telefone</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaFisica?.whatsapp || editFormData?.pessoaFisica?.telefone || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaFisica: { ...editFormData.pessoaFisica, whatsapp: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl focus:bg-white font-mono"
                          />
                        </div>
                        <div className="sm:col-span-2 font-semibold">
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Email Particular</label>
                          <input 
                            type="email"
                            value={editFormData?.pessoaFisica?.email || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaFisica: { ...editFormData.pessoaFisica, email: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl focus:bg-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Endereço Residencial</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaFisica?.endereco || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaFisica: { ...editFormData.pessoaFisica, endereco: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Cidade / UF</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaFisica?.cidade || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaFisica: { ...editFormData.pessoaFisica, cidade: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl focus:bg-white"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="sm:col-span-2">
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Razão Social</label>
                          <input 
                            type="text" 
                            required
                            value={editFormData?.pessoaJuridica?.razaoSocial || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaJuridica: { ...editFormData.pessoaJuridica, razaoSocial: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">CNPJ</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaJuridica?.cnpj || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaJuridica: { ...editFormData.pessoaJuridica, cnpj: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Nome Fantasia</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaJuridica?.nomeFantasia || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaJuridica: { ...editFormData.pessoaJuridica, nomeFantasia: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Inscrição Estadual</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaJuridica?.inscricaoEstadual || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaJuridica: { ...editFormData.pessoaJuridica, inscricaoEstadual: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Representante Legal</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaJuridica?.representanteLegal || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaJuridica: { ...editFormData.pessoaJuridica, representanteLegal: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">CPF Representante</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaJuridica?.cpfRepresentante || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaJuridica: { ...editFormData.pessoaJuridica, cpfRepresentante: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Cargo Representante</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaJuridica?.cargoRepresentante || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaJuridica: { ...editFormData.pessoaJuridica, cargoRepresentante: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">WhatsApp / Telefone</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaJuridica?.whatsapp || editFormData?.pessoaJuridica?.telefone || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaJuridica: { ...editFormData.pessoaJuridica, whatsapp: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl font-mono"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">E-mail Comercial</label>
                          <input 
                            type="email"
                            value={editFormData?.pessoaJuridica?.email || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaJuridica: { ...editFormData.pessoaJuridica, email: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Endereço da Sede</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaJuridica?.endereco || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaJuridica: { ...editFormData.pessoaJuridica, endereco: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Cidade / UF</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaJuridica?.cidade || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaJuridica: { ...editFormData.pessoaJuridica, cidade: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* PARTE DE NEGÓCIO */}
                  <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Origem do Lead</label>
                      <select 
                        value={editFormData?.origemLead || 'WhatsApp'}
                        onChange={(e) => setEditFormData({ ...editFormData, origemLead: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                      >
                        <option>WhatsApp</option>
                        <option>Indicação Direta</option>
                        <option>Instagram</option>
                        <option>Facebook</option>
                        <option>TikTok</option>
                        <option>Google Ads / Prospecção Tráfego</option>
                        <option>Instagram / Facebook Ads</option>
                        <option>Redes Sociais</option>
                        <option>Atendimento Balcão / Físico</option>
                        <option>Eventos / Palestras</option>
                        <option>Parceria Externa</option>
                        <option>Outros</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Área Jurídica</label>
                      <select 
                        value={editFormData?.areaJuridica || 'Trabalhista'}
                        onChange={(e) => setEditFormData({ ...editFormData, areaJuridica: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                      >
                        <option>Trabalhista</option>
                        <option>Previdenciário (INSS)</option>
                        <option>Cível / Família</option>
                        <option>Tributário</option>
                        <option>Empresarial / Societário</option>
                        <option>Administrativo / Servidor Público</option>
                        <option>Imobiliário</option>
                        <option>Direito Agrário</option>
                        <option>Outros</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Responsável Interno</label>
                      <input 
                        type="text"
                        value={editFormData?.responsavelInterno || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, responsavelInterno: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Assunto da Demanda</label>
                      <input 
                        type="text"
                        value={editFormData?.assunto || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, assunto: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Valor Potencial (R$)</label>
                      <input 
                        type="number"
                        value={editFormData?.valorPotencial || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, valorPotencial: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Dor Principal Relatada</label>
                      <textarea
                        rows={2}
                        value={editFormData?.dorPrincipal || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, dorPrincipal: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                      />
                    </div>

                    {/* EDITABLE DADOS ADICIONAIS FROM ETAPA 01 */}
                    <div className="sm:col-span-1">
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Classificação do Lead</label>
                      <select 
                        value={editFormData?.classificacao || 'Geral'}
                        onChange={(e) => setEditFormData({ ...editFormData, classificacao: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl cursor-pointer"
                      >
                        <option>Geral</option>
                        <option>Alta Prioridade</option>
                        <option>Estratégico</option>
                        <option>Parceria</option>
                      </select>
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Já é Cliente / Vínculo</label>
                      <select 
                        value={editFormData?.jaCliente || 'Caso Novo'}
                        onChange={(e) => setEditFormData({ ...editFormData, jaCliente: e.target.value, possuiProcesso: e.target.value === 'Já é Cliente' })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl cursor-pointer"
                      >
                        <option>Caso Novo</option>
                        <option>Já é Cliente</option>
                      </select>
                    </div>

                    <div className="sm:col-span-1 flex flex-col justify-center">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-650 select-none">
                        <input 
                          type="checkbox"
                          checked={!!editFormData?.solicitarReuniao}
                          onChange={(e) => setEditFormData({ ...editFormData, solicitarReuniao: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-250 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Solicitar Reunião</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-650 select-none mt-2">
                        <input 
                          type="checkbox"
                          checked={!!editFormData?.documentosRecebidos}
                          onChange={(e) => setEditFormData({ ...editFormData, documentosRecebidos: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-250 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Documentos Iniciais Recebidos</span>
                      </label>
                    </div>

                    {/* Edit Social Profiles */}
                    {editFormData?.tipoPessoa === 'PF' ? (
                      <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-100/60 pt-3 mt-1">
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Instagram</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaFisica?.instagram || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaFisica: { ...(editFormData?.pessoaFisica || {}), instagram: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">TikTok</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaFisica?.tiktok || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaFisica: { ...(editFormData?.pessoaFisica || {}), tiktok: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Facebook</label>
                          <input 
                            type="text"
                            value={editFormData?.pessoaFisica?.facebook || ''}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              pessoaFisica: { ...(editFormData?.pessoaFisica || {}), facebook: e.target.value }
                            })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl focus:bg-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100/60 pt-4 mt-1">
                        {/* Empresa Socials */}
                        <div className="space-y-3.5 bg-slate-50/40 p-3 rounded-xl border border-gray-100">
                          <span className="text-[10px] font-extrabold uppercase text-indigo-700 block tracking-widest font-mono border-b border-gray-100 pb-1">Redes Sociais da Empresa</span>
                          <div className="grid grid-cols-1 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">Instagram Empresa</label>
                              <input 
                                type="text"
                                value={editFormData?.pessoaJuridica?.instagramEmpresa || ''}
                                onChange={(e) => setEditFormData({
                                  ...editFormData,
                                  pessoaJuridica: { ...(editFormData?.pessoaJuridica || {}), instagramEmpresa: e.target.value }
                                })}
                                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">TikTok Empresa</label>
                              <input 
                                type="text"
                                value={editFormData?.pessoaJuridica?.tiktokEmpresa || ''}
                                onChange={(e) => setEditFormData({
                                  ...editFormData,
                                  pessoaJuridica: { ...(editFormData?.pessoaJuridica || {}), tiktokEmpresa: e.target.value }
                                })}
                                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">Facebook Empresa</label>
                              <input 
                                type="text"
                                value={editFormData?.pessoaJuridica?.facebookEmpresa || ''}
                                onChange={(e) => setEditFormData({
                                  ...editFormData,
                                  pessoaJuridica: { ...(editFormData?.pessoaJuridica || {}), facebookEmpresa: e.target.value }
                                })}
                                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Representante Socials */}
                        <div className="space-y-3.5 bg-rose-50/10 p-3 rounded-xl border border-gray-100">
                          <span className="text-[10px] font-extrabold uppercase text-red-700 block tracking-widest font-mono border-b border-gray-100 pb-1">Redes Sociais do Representante</span>
                          <div className="grid grid-cols-1 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">Instagram Representante</label>
                              <input 
                                type="text"
                                value={editFormData?.pessoaJuridica?.instagramRepresentante || ''}
                                onChange={(e) => setEditFormData({
                                  ...editFormData,
                                  pessoaJuridica: { ...(editFormData?.pessoaJuridica || {}), instagramRepresentante: e.target.value }
                                })}
                                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">TikTok Representante</label>
                              <input 
                                type="text"
                                value={editFormData?.pessoaJuridica?.tiktokRepresentante || ''}
                                onChange={(e) => setEditFormData({
                                  ...editFormData,
                                  pessoaJuridica: { ...(editFormData?.pessoaJuridica || {}), tiktokRepresentante: e.target.value }
                                })}
                                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">Facebook Representante</label>
                              <input 
                                type="text"
                                value={editFormData?.pessoaJuridica?.facebookRepresentante || ''}
                                onChange={(e) => setEditFormData({
                                  ...editFormData,
                                  pessoaJuridica: { ...(editFormData?.pessoaJuridica || {}), facebookRepresentante: e.target.value }
                                })}
                                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Observações Gerais editable */}
                    <div className="sm:col-span-3 pt-3 border-t border-gray-100/50 mt-1">
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Observações Gerais - Etapa 01</label>
                      <textarea
                        rows={3}
                        value={editFormData?.observacoes || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, observacoes: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-250 rounded-xl"
                        placeholder="Digite ou atualize observações gerais, anotações de ligações e particularidades do prospect."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-slate-50 rounded-xl text-xs font-black uppercase tracking-wider transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* INTERACTIVE COMPONENT: QUALIFICACAO / OUTCOMES */}
            <div className="bg-slate-900 text-white border border-slate-950 rounded-3xl p-6 md:p-8 space-y-6 shadow-md transition-all duration-300">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4.5">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400 font-mono">Resultado Comercial Prático</span>
                  <h3 className="text-lg font-black text-white tracking-tight">Decisão e Desfecho da Qualificação</h3>
                  <p className="text-[10.5px] text-gray-450 mt-1">Determine a viabilidade jurídica e financeira antes do encaminhamento.</p>
                </div>
                <div className="px-3.5 py-1 bg-white/10 border border-white/10 rounded-full text-[10px] text-gray-300 font-black tracking-wider uppercase font-mono">
                  Etapa 02 Final
                </div>
              </div>

              {/* ACTION TOGGLER BUTTONS */}
              {qualificationStatus === 'idle' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Desqualificar CARD */}
                  <button
                    type="button"
                    onClick={() => {
                      setQualificationStatus('disqualify');
                      setShowViabilityForm(false);
                    }}
                    className="group text-left border border-white/10 bg-white/5 hover:bg-white/[0.08] hover:border-rose-500/20 p-5 rounded-2xl transition duration-200 cursor-pointer flex flex-col justify-between h-32 gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-400 group-hover:bg-rose-500/20">
                      <TrendingDown size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white tracking-wider uppercase">Desqualificar LEAD</h4>
                      <p className="text-[10.5px] text-gray-400 font-semibold mt-1">Classificar como perdido, arquivado ou sem escopo técnico viável.</p>
                    </div>
                  </button>

                  {/* Qualificar CARD */}
                  <button
                    type="button"
                    onClick={() => {
                      setQualificationStatus('qualified');
                    }}
                    className="group text-left border border-indigo-500/20 bg-indigo-650/10 hover:bg-indigo-650/20 hover:border-indigo-500/40 p-5 rounded-2xl transition duration-200 cursor-pointer flex flex-col justify-between h-32 gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 group-hover:bg-indigo-500/30">
                      <FileCheck size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white tracking-wider uppercase">Qualificar LEAD</h4>
                      <p className="text-[10.5px] text-gray-405 font-semibold mt-1">Verificado, oportuno e pronto para avançar no relacionamento com o escritório.</p>
                    </div>
                  </button>
                </div>
              )}

              {/* FLOW: DISQUALIFY FORM */}
              {qualificationStatus === 'disqualify' && (
                <div className="bg-rose-950/20 border border-rose-500/30 p-5 rounded-2xl space-y-4 animate-fade-in text-xs font-semibold text-rose-50/90">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-white block">Justificativa da Desqualificação do Lead</span>
                    <button 
                      type="button" 
                      onClick={() => setQualificationStatus('idle')}
                      className="text-rose-400 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p className="text-[10.5px] text-rose-300 leading-relaxed font-bold">
                    Ao desqualificar o cliente em potencial, os dados cadastrais serão atualizados e o status passará para "Perdido" no funil de vendas.
                  </p>
                  <textarea
                    rows={2.5}
                    required
                    value={disqualifyReason}
                    onChange={(e) => setDisqualifyReason(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-950 border border-rose-900/30 rounded-xl text-white placeholder-rose-700 outline-none focus:border-rose-500/50"
                    placeholder="Ex: Falta de recursos para retenção, prazo processual expirado, ou ausência de documentos necessários."
                  />
                  <div className="flex justify-end gap-2 text-xs font-black">
                    <button
                      type="button"
                      onClick={() => setQualificationStatus('idle')}
                      className="px-4 py-2 border border-rose-900/40 text-rose-300 hover:bg-rose-900/20 rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDisqualify}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl uppercase tracking-wider"
                    >
                      Confirmar Desqualificação
                    </button>
                  </div>
                </div>
              )}

              {/* FLOW: QUALIFIED SELECTION (SUB-OPTIONS PANEL) */}
              {qualificationStatus === 'qualified' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-indigo-400" />
                      <span className="font-extrabold text-[#818cf8] tracking-widest uppercase text-[10px] font-mono">Lead de Interesse Qualificado</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => {
                        setQualificationStatus('idle');
                        setShowViabilityForm(false);
                      }}
                      className="text-indigo-300 hover:text-white flex items-center gap-1.5 text-xs font-bold"
                    >
                      <span>Voltar</span>
                      <X size={14} />
                    </button>
                  </div>

                  <p className="text-xs text-gray-300 font-semibold leading-relaxed">
                    Escolha o procedimento de ação preferido para o lead qualificado abaixo. Você pode iniciar um estudo técnico detalhado de viabilidade ou proferir a contratação imediata:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Option: Análise de Viabilidade */}
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/boss/cadastrar.leads/private/etapa02/${leadId}/viabilidade`);
                      }}
                      className="text-left p-4.5 border border-white/10 bg-white/5 hover:bg-white/[0.08] rounded-2xl transition duration-200 flex items-start gap-4 cursor-pointer"
                    >
                      <div className="p-3.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25 mt-0.5 shrink-0">
                        <Scale size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-white text-xs block font-black">Regulamentar Análise de Viabilidade</strong>
                          {lead?.analiseViabilidade?.conclusaoCategoria && (
                            <span className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/40 text-[9px] text-indigo-300 rounded font-black uppercase font-mono tracking-wider shrink-0">
                              {lead.analiseViabilidade.conclusaoCategoria}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 block mt-1 leading-normal font-semibold">
                          Defina e justifique a viabilidade jurídica da tutela demandada com dados mercadológicos e técnicos.
                        </span>
                        {lead?.analiseViabilidade?.proximaAcaoRecomendada && (
                          <span className="text-[9px] text-gray-500 block mt-2 font-mono">
                            Próxima Ação: {lead.analiseViabilidade.proximaAcaoRecomendada}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Option: Converter LEAD */}
                    <button
                      type="button"
                      onClick={handleConvertLead}
                      className="text-left p-4.5 border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 to-emerald-950/20 hover:from-indigo-900/30 hover:to-emerald-900/30 rounded-2xl transition duration-200 flex items-start gap-4 cursor-pointer group"
                    >
                      <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 mt-0.5 shrink-0 group-hover:bg-emerald-500/20 transition">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <strong className="text-white text-xs block font-black">Converter LEAD</strong>
                        <span className="text-[10px] text-gray-455 block mt-1 leading-normal font-semibold">
                          Converta este lead particular em cliente formal no fluxo de produção da Giffoni Advogados Associados.
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* SUB-FORM: REGISTRAR ANÁLISE DE VIABILIDADE */}
                  {showViabilityForm && (
                    <motion.form 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onSubmit={handleSaveViability}
                      className="bg-slate-950 border border-white/5 p-5 rounded-2xl space-y-4 text-xs text-gray-300 font-semibold mt-4 shadow-sm"
                    >
                      <div className="border-b border-white/10 pb-2">
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">Laudo Prévio / Ficha de Viabilidade Técnica e Comercial</h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] uppercase tracking-wider text-gray-400 mb-1.5">Classificação de Viabilidade</label>
                          <select
                            value={viabilityForm.viabilidadeTecnica}
                            onChange={(e) => setViabilityForm({ ...viabilityForm, viabilidadeTecnica: e.target.value })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white cursor-pointer"
                          >
                            <option>Alta</option>
                            <option>Média</option>
                            <option>Baixa / Com ressalvas críticas</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9px] uppercase tracking-wider text-gray-400 mb-1.5">Probabilidade de Êxito</label>
                          <select
                            value={viabilityForm.probabilidadeExito}
                            onChange={(e) => setViabilityForm({ ...viabilityForm, probabilidadeExito: e.target.value })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white cursor-pointer"
                          >
                            <option>Provável</option>
                            <option>Possível</option>
                            <option>Remota</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[9px] uppercase tracking-wider text-gray-400 mb-1.5">Estimativa Inicial de Honorários Honoríficos e Sucumbenciais (R$)</label>
                          <input
                            type="number"
                            value={viabilityForm.honorariosPropostos}
                            onChange={(e) => setViabilityForm({ ...viabilityForm, honorariosPropostos: e.target.value })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-gray-650"
                            placeholder="Ex: 15000"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[9px] uppercase tracking-wider text-gray-400 mb-1.5">Observações Jurídicas e Fundamentações do Parecer</label>
                          <textarea
                            rows={3}
                            value={viabilityForm.parecerViabilidade}
                            onChange={(e) => setViabilityForm({ ...viabilityForm, parecerViabilidade: e.target.value })}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-gray-655"
                            placeholder="Descreva a fundamentação, riscos e argumentos jurídicos identificados..."
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 font-black">
                        <button
                          type="button"
                          onClick={() => setShowViabilityForm(false)}
                          className="px-4 py-2 border border-white/10 text-gray-400 hover:bg-white/5 rounded-xl block"
                        >
                          Recuar
                        </button>
                        <button
                          type="submit"
                          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl uppercase tracking-wider shadow-md"
                        >
                          Registrar Análise de Viabilidade
                        </button>
                      </div>
                    </motion.form>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </BossLayout>
  );
}
