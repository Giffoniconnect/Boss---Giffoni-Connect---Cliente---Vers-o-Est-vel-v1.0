import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BossLayout } from '../../../components/Layout';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { buildWhatsAppLink } from '../../../lib/whatsapp';
import { 
  Building2, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Save,
  Sparkles,
  Phone,
  Instagram,
  Facebook,
  Copy,
  Check,
  Send,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { LeadTodoistAutomationCard } from '../../../components/boss/leads/todoist/LeadTodoistAutomationCard';
import { DirectReferralFields } from '../../../components/boss/leads/shared/DirectReferralFields';
import { useLeadStepNavigation } from '../../../components/boss/leads/shared/useLeadStepNavigation';
import { LeadStepNavigation } from '../../../components/boss/leads/shared/LeadStepNavigation';

export default function CadastrarLeadsPJ() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);

  // Todoist states
  const [hasSaved, setHasSaved] = useState(false);
  const [todoistSubmitting, setTodoistSubmitting] = useState(false);
  const [todoistSuccess, setTodoistSuccess] = useState<string | null>(null);
  const [todoistError, setTodoistError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form Fields State for PJ
  const initialFormData = {
    origemLead: 'WhatsApp',
    areaJuridica: 'Trabalhista',
    assunto: '',
    dorPrincipal: '',
    urgencia: 'Média',
    existePrazo: false,
    dataPrazo: '',
    jaCliente: 'Caso Novo', // Já é Cliente do Escritório ou caso é novo?
    solicitarReuniao: false, // Permitindo Solicitar Agendamento de Reunião
    documentosRecebidos: false,
    responsavelInterno: 'Comercial Interno',
    valorPotencial: '',
    tipoContrato: 'Fixos',
    proveitoEconomico: '',
    percentualExito: '20',
    valorFixoParte: '',
    statusFunil: 'Novo Lead',
    classificacao: 'Geral',
    proximoPasso: '',
    observacoes: '',
    indicadoPorNome: '',
    indicadoPorTelefone: '',
    indicadoPorEmpresa: '',
    agradecimentoStatus: 'Pendente', // Pendente, Enviado, Não Necessário
    enviarAgradecimentoLead: false,
    agradecimentoLeadStatus: 'Pendente',
    agradecimentoLeadResultado: null,

    pessoaJuridica: {
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      representanteLegal: '',
      cargoRepresentante: 'CEO', // CEO, sócio, sócio Administrador, outro
      cargoRepresentanteOutro: '', // em branco para preenchimento se outro
      email: '',
      emailNotOwned: false,
      telefone: '',
      telefoneNotOwned: false,
      possuiWhatsapp: false,
      instagramEmpresa: '',
      instagramNotOwned: false,
      tiktokEmpresa: '',
      tiktokNotOwned: false,
      facebookEmpresa: '',
      facebookNotOwned: false,
      instagramRepresentante: '',
      facebookRepresentante: '',
      tiktokRepresentante: ''
    }
  };

  const [leadFormData, setLeadFormData] = useState<any>(initialFormData);

  const [searchParams] = useSearchParams();
  const editLeadId = searchParams.get('edit');

  const {
    navigatingStep2,
    handleSaveAndNavigate
  } = useLeadStepNavigation({
    leadType: 'PJ',
    leadFormData,
    editLeadId,
    setError,
    setSuccess,
    setCreatedLeadId,
    setHasSaved
  });

  const handleContractFieldChange = (field: string, val: any) => {
    setLeadFormData((prev: any) => {
      const updated = { ...prev, [field]: val };
      
      let computed = prev.valorPotencial;
      const tc = updated.tipoContrato || 'Fixos';
      const fixed = parseFloat(updated.valorFixoParte) || 0;
      const benefit = parseFloat(updated.proveitoEconomico) || 0;
      const pct = parseFloat(updated.percentualExito) || 0;

      if (tc === 'Fixos') {
        computed = updated.valorFixoParte !== '' ? String(fixed) : '';
      } else if (tc === 'Êxito') {
        computed = (updated.proveitoEconomico !== '' && updated.percentualExito !== '') ? String(benefit * (pct / 100)) : '';
      } else if (tc === 'Misto') {
        computed = String(fixed + (benefit * (pct / 100)));
      }
      
      return {
        ...updated,
        valorPotencial: computed
      };
    });
  };

  useEffect(() => {
    if (!editLeadId) return;
    const fetchLeadToEdit = async () => {
      try {
        const docRef = doc(db, 'marketingLeads', editLeadId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setLeadFormData({
            ...initialFormData,
            ...data,
            pessoaJuridica: {
              ...initialFormData.pessoaJuridica,
              ...(data.pessoaJuridica || {})
            }
          });
        }
      } catch (err) {
        console.error("Erro ao carregar lead para edição", err);
      }
    };
    fetchLeadToEdit();
  }, [editLeadId]);

  // Handle Submission (Create or Update Lead)
  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const name = leadFormData.pessoaJuridica.razaoSocial;

    if (!name || name.trim() === '') {
      setError('Preencha a Razão Social da Empresa.');
      setSubmitting(false);
      return;
    }

    try {
      const newId = editLeadId || ('lead_' + Math.random().toString(36).substring(2, 11));
      const now = new Date().toISOString();

      // Resolve final cargo value
      const cargoReal = leadFormData.pessoaJuridica.cargoRepresentante === 'Outro'
        ? leadFormData.pessoaJuridica.cargoRepresentanteOutro
        : leadFormData.pessoaJuridica.cargoRepresentante;

      const payload = {
        ...leadFormData,
        id: newId,
        tipoPessoa: 'PJ',
        convertidoEmCliente: leadFormData.convertidoEmCliente || false,
        createdAt: leadFormData.createdAt || now,
        updatedAt: now,
        possuiProcesso: leadFormData.jaCliente === 'Já é Cliente',
        pessoaJuridica: {
          ...leadFormData.pessoaJuridica,
          // Compatibilidade com os campos antigos do banco
          inscricaoEstadual: leadFormData.pessoaJuridica.inscricaoEstadual || '',
          cpfRepresentante: leadFormData.pessoaJuridica.cpfRepresentante || '',
          rgRepresentante: leadFormData.pessoaJuridica.rgRepresentante || '',
          endereco: leadFormData.pessoaJuridica.endereco || '',
          cidade: leadFormData.pessoaJuridica.cidade || '',
          uf: leadFormData.pessoaJuridica.uf || '',
          cargoRepresentante: cargoReal
        }
      };

      const docRef = doc(db, 'marketingLeads', newId);
      await setDoc(docRef, payload);

      // Local storage backup
      try {
        const local = localStorage.getItem('local_marketing_leads');
        const list = local ? JSON.parse(local) : [];
        localStorage.setItem('local_marketing_leads', JSON.stringify([payload, ...list]));
      } catch (e) {
        console.warn('Could not sync lead to local backup', e);
      }

      setSuccess(`Lead Pessoa Jurídica salvo com sucesso! Os cards de preview e envio para o Todoist foram alimentados abaixo.`);
      setCreatedLeadId(newId);
      setHasSaved(true);
    } catch (e: any) {
      console.error(e);
      setError('Erro ao salvar o LEAD no banco de dados. Por favor tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BossLayout>
      <div className="max-w-xl mx-auto px-4 md:px-0 space-y-8 animate-fade-in pb-16">
        
        {/* HEADER */}
        <div className="border-b border-gray-150 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-[#2563ea] font-mono">Etapa 01 — Identificação do Cliente em Potencial</span>
            <h1 className="text-xl font-black text-gray-900 tracking-tight leading-snug">
              Ficha LEAD PJ - Identificação do Cliente em Potencial
            </h1>
          </div>
          
          <button
            type="button"
            onClick={() => navigate('/boss/cadastrar.leads/private')}
            className="text-xs font-bold text-gray-650 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-4xs transition hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <ArrowLeft size={14} />
            <span>Voltar</span>
          </button>
        </div>

        {/* FEEDBACK */}
        {error && (
          <div className="bg-rose-50 border border-rose-150 rounded-2xl p-4.5 flex items-start gap-3">
            <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={16} />
            <div className="text-xs text-rose-800 font-bold">{error}</div>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-4 justify-between shadow-2xs">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={24} />
              <div>
                <strong className="text-emerald-950 text-sm block font-black">Lead Salvo com Sucesso!</strong>
                <span className="text-xs text-emerald-850 font-bold">Os dados básicos do lead de Pessoa Jurídica foram gravados de forma segura. Utilize a seção abaixo para visualizar e Enviar o Lead para o Todoist.</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto font-sans">
              <button
                type="button"
                onClick={() => {
                  setSuccess(null);
                  setCreatedLeadId(null);
                  setHasSaved(false);
                  setTodoistSuccess(null);
                  setTodoistError(null);
                  setLeadFormData(initialFormData);
                }}
                className="px-3.5 py-2 bg-white border border-emerald-250 text-emerald-800 hover:bg-emerald-100/50 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
              >
                Cadastrar Outro
              </button>
              {createdLeadId && (
                <button
                  type="button"
                  onClick={() => navigate(`/boss/cadastrar.leads/private/etapa02/${createdLeadId}`)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition cursor-pointer shadow-sm animate-pulse"
                >
                  <span>Ir para Etapa 02</span>
                  <Sparkles size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* COMPREHENSIVE PJ FORM */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs"
        >
          <div className="p-5 text-white flex items-center justify-between bg-purple-600">
            <div className="flex items-center gap-2.5">
              <Building2 size={20} />
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wide">
                  Dados Cadastrais de LEAD da Pessoa Jurídica
                </h3>
                <p className="text-[10px] text-white/90">Insira as informações cadastrais essenciais e de qualificação comercial da empresa.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmitLead} className="p-6 space-y-6">
            
            {/* SECTION 1: CADASTRO BASICO */}
            <div className="space-y-4">
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-450 border-b border-gray-100 pb-1.5">
                1. Informações Cadastrais Básicas (Pessoa Jurídica)
              </span>

              <div className="flex flex-col gap-4">
                {/* 1. Razão Social */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Razão Social</label>
                  <input 
                    type="text" 
                    required
                    value={leadFormData.pessoaJuridica.razaoSocial}
                    onChange={(e) => setLeadFormData({
                      ...leadFormData,
                      pessoaJuridica: { ...leadFormData.pessoaJuridica, razaoSocial: e.target.value }
                    })}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition"
                    placeholder="Razão Social completa da empresa"
                  />
                </div>

                {/* 2. Nome Fantasia */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nome Fantasia</label>
                  <input 
                    type="text" 
                    value={leadFormData.pessoaJuridica.nomeFantasia}
                    onChange={(e) => setLeadFormData({
                      ...leadFormData,
                      pessoaJuridica: { ...leadFormData.pessoaJuridica, nomeFantasia: e.target.value }
                    })}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition"
                    placeholder="Nome Fantasia / Marca"
                  />
                </div>

                {/* 3. CNPJ */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">CNPJ</label>
                  <input 
                    type="text" 
                    value={leadFormData.pessoaJuridica.cnpj}
                    onChange={(e) => setLeadFormData({
                      ...leadFormData,
                      pessoaJuridica: { ...leadFormData.pessoaJuridica, cnpj: e.target.value }
                    })}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition font-mono"
                    placeholder="00.000.000/0001-00"
                  />
                </div>

                {/* 4. Nome Completo do Representante Legal */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nome Completo do Representante legal</label>
                  <input 
                    type="text" 
                    value={leadFormData.pessoaJuridica.representanteLegal}
                    onChange={(e) => setLeadFormData({
                      ...leadFormData,
                      pessoaJuridica: { ...leadFormData.pessoaJuridica, representanteLegal: e.target.value }
                    })}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition"
                    placeholder="Nome do representante / decisor"
                  />
                </div>

                {/* 5. Cargo representante com cascata/cascade */}
                <div className="bg-slate-50/40 p-3.5 border border-gray-150 rounded-2xl space-y-3.5">
                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Cargo representante</label>
                    <select 
                      value={leadFormData.pessoaJuridica.cargoRepresentante}
                      onChange={(e) => setLeadFormData({
                        ...leadFormData,
                        pessoaJuridica: { ...leadFormData.pessoaJuridica, cargoRepresentante: e.target.value }
                      })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:bg-white outline-none transition cursor-pointer"
                    >
                      <option value="CEO">CEO</option>
                      <option value="Sócio">Sócio</option>
                      <option value="Sócio Administrador">Sócio Administrador</option>
                      <option value="Outro">Outro...</option>
                    </select>
                  </div>

                  {leadFormData.pessoaJuridica.cargoRepresentante === 'Outro' && (
                    <div className="animate-fade-in">
                      <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Especifique o Cargo</label>
                      <input 
                        type="text" 
                        required
                        value={leadFormData.pessoaJuridica.cargoRepresentanteOutro}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, cargoRepresentanteOutro: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:bg-white outline-none transition"
                        placeholder="Ex: Diretor de Operações"
                      />
                    </div>
                  )}
                </div>

                {/* 6. Email */}
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-650 mb-2 shrink-0">
                    <input 
                      type="checkbox" 
                      checked={!!leadFormData.pessoaJuridica.emailNotOwned}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { 
                            ...leadFormData.pessoaJuridica, 
                            emailNotOwned: checked,
                            email: checked ? '' : leadFormData.pessoaJuridica.email 
                          }
                        });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                    />
                    <span>Não possuo</span>
                  </label>
                  <div className="flex-1">
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email</label>
                    <input 
                      type="email" 
                      disabled={!!leadFormData.pessoaJuridica.emailNotOwned}
                      value={leadFormData.pessoaJuridica.emailNotOwned ? '' : leadFormData.pessoaJuridica.email}
                      onChange={(e) => setLeadFormData({
                        ...leadFormData,
                        pessoaJuridica: { ...leadFormData.pessoaJuridica, email: e.target.value }
                      })}
                      className={`w-full text-xs font-semibold px-3 py-2 border rounded-xl outline-none transition ${
                        leadFormData.pessoaJuridica.emailNotOwned 
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                          : 'bg-slate-50 border-gray-200 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                      placeholder={leadFormData.pessoaJuridica.emailNotOwned ? 'E-mail indisponível' : 'comercial@empresa.com'}
                    />
                  </div>
                </div>

                {/* 7. Telefone comercial (botão se possui whatsapp) */}
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-650 mb-2 shrink-0">
                    <input 
                      type="checkbox" 
                      checked={!!leadFormData.pessoaJuridica.telefoneNotOwned}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { 
                            ...leadFormData.pessoaJuridica, 
                            telefoneNotOwned: checked,
                            telefone: checked ? '' : leadFormData.pessoaJuridica.telefone,
                            possuiWhatsapp: checked ? false : leadFormData.pessoaJuridica.possuiWhatsapp
                          }
                        });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                    />
                    <span>Não possuo</span>
                  </label>
                  <div className="flex-1">
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Telefone Comercial</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input 
                        type="text" 
                        disabled={!!leadFormData.pessoaJuridica.telefoneNotOwned}
                        value={leadFormData.pessoaJuridica.telefoneNotOwned ? '' : leadFormData.pessoaJuridica.telefone}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, telefone: e.target.value }
                        })}
                        className={`flex-1 text-xs font-semibold px-3 py-2 border rounded-xl outline-none transition ${
                          leadFormData.pessoaJuridica.telefoneNotOwned 
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                            : 'bg-slate-50 border-gray-200 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                        placeholder={leadFormData.pessoaJuridica.telefoneNotOwned ? 'Telefone indisponível' : '(00) 90000-0000'}
                      />
                      <button
                        type="button"
                        disabled={!!leadFormData.pessoaJuridica.telefoneNotOwned}
                        onClick={() => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, possuiWhatsapp: !leadFormData.pessoaJuridica.possuiWhatsapp }
                        })}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 border cursor-pointer ${
                          leadFormData.pessoaJuridica.telefoneNotOwned
                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                            : leadFormData.pessoaJuridica.possuiWhatsapp 
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-extrabold shadow-sm'
                              : 'bg-white border-gray-200 text-gray-500 hover:bg-slate-50'
                        }`}
                      >
                        <span className={leadFormData.pessoaJuridica.possuiWhatsapp && !leadFormData.pessoaJuridica.telefoneNotOwned ? 'text-emerald-600 font-black' : 'text-gray-400'}>
                          💬
                        </span>
                        <span>Possui WhatsApp</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 8. Instagram da empresa */}
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-650 mb-2 shrink-0">
                    <input 
                      type="checkbox" 
                      checked={!!leadFormData.pessoaJuridica.instagramNotOwned}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { 
                            ...leadFormData.pessoaJuridica, 
                            instagramNotOwned: checked,
                            instagramEmpresa: checked ? '' : leadFormData.pessoaJuridica.instagramEmpresa 
                          }
                        });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                    />
                    <span>Não possuo</span>
                  </label>
                  <div className="flex-1">
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Instagram da empresa</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-gray-400 text-xs font-bold">@</span>
                      <input 
                        type="text" 
                        disabled={!!leadFormData.pessoaJuridica.instagramNotOwned}
                        value={leadFormData.pessoaJuridica.instagramNotOwned ? '' : leadFormData.pessoaJuridica.instagramEmpresa}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, instagramEmpresa: e.target.value }
                        })}
                        className={`w-full text-xs font-semibold pl-8 pr-3 py-2 border rounded-xl outline-none transition ${
                          leadFormData.pessoaJuridica.instagramNotOwned 
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                            : 'bg-slate-50 border-gray-200 focus:bg-white'
                        }`}
                        placeholder={leadFormData.pessoaJuridica.instagramNotOwned ? 'Instagram indisponível' : 'empresa.oficial'}
                      />
                    </div>
                  </div>
                </div>

                {/* 9. Tik tok da empresa */}
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-650 mb-2 shrink-0">
                    <input 
                      type="checkbox" 
                      checked={!!leadFormData.pessoaJuridica.tiktokNotOwned}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { 
                            ...leadFormData.pessoaJuridica, 
                            tiktokNotOwned: checked,
                            tiktokEmpresa: checked ? '' : leadFormData.pessoaJuridica.tiktokEmpresa 
                          }
                        });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                    />
                    <span>Não possuo</span>
                  </label>
                  <div className="flex-1">
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tik tok da empresa</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-gray-400 text-xs font-bold">@</span>
                      <input 
                        type="text" 
                        disabled={!!leadFormData.pessoaJuridica.tiktokNotOwned}
                        value={leadFormData.pessoaJuridica.tiktokNotOwned ? '' : leadFormData.pessoaJuridica.tiktokEmpresa}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, tiktokEmpresa: e.target.value }
                        })}
                        className={`w-full text-xs font-semibold pl-8 pr-3 py-2 border rounded-xl outline-none transition ${
                          leadFormData.pessoaJuridica.tiktokNotOwned 
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                            : 'bg-slate-50 border-gray-200 focus:bg-white'
                        }`}
                        placeholder={leadFormData.pessoaJuridica.tiktokNotOwned ? 'TikTok indisponível' : 'empresa.tiktok'}
                      />
                    </div>
                  </div>
                </div>

                {/* 10. Facebook da empresa */}
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-650 mb-2 shrink-0">
                    <input 
                      type="checkbox" 
                      checked={!!leadFormData.pessoaJuridica.facebookNotOwned}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { 
                            ...leadFormData.pessoaJuridica, 
                            facebookNotOwned: checked,
                            facebookEmpresa: checked ? '' : leadFormData.pessoaJuridica.facebookEmpresa 
                          }
                        });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                    />
                    <span>Não possuo</span>
                  </label>
                  <div className="flex-1">
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Facebook da empresa</label>
                    <input 
                      type="text" 
                      disabled={!!leadFormData.pessoaJuridica.facebookNotOwned}
                      value={leadFormData.pessoaJuridica.facebookNotOwned ? '' : leadFormData.pessoaJuridica.facebookEmpresa}
                      onChange={(e) => setLeadFormData({
                        ...leadFormData,
                        pessoaJuridica: { ...leadFormData.pessoaJuridica, facebookEmpresa: e.target.value }
                      })}
                      className={`w-full text-xs font-semibold px-3 py-2 border rounded-xl outline-none transition ${
                        leadFormData.pessoaJuridica.facebookNotOwned 
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                          : 'bg-slate-50 border-gray-200 focus:bg-white'
                      }`}
                      placeholder={leadFormData.pessoaJuridica.facebookNotOwned ? 'Facebook indisponível' : 'Link da Fanpage'}
                    />
                  </div>
                </div>

                {/* 11. Instagram do representante */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Instagram do representante</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-gray-400 text-xs font-bold">@</span>
                    <input 
                      type="text" 
                      value={leadFormData.pessoaJuridica.instagramRepresentante}
                      onChange={(e) => setLeadFormData({
                        ...leadFormData,
                        pessoaJuridica: { ...leadFormData.pessoaJuridica, instagramRepresentante: e.target.value }
                      })}
                      className="w-full text-xs font-semibold pl-8 pr-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white"
                      placeholder="representante.perfil"
                    />
                  </div>
                </div>

                {/* 12. Facebook do representante */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Facebook do representante</label>
                  <input 
                    type="text" 
                    value={leadFormData.pessoaJuridica.facebookRepresentante}
                    onChange={(e) => setLeadFormData({
                      ...leadFormData,
                      pessoaJuridica: { ...leadFormData.pessoaJuridica, facebookRepresentante: e.target.value }
                    })}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white"
                    placeholder="Perfil do representante"
                  />
                </div>

                {/* 13. Tik tok do representante */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tik tok do representante</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-gray-400 text-xs font-bold">@</span>
                    <input 
                      type="text" 
                      value={leadFormData.pessoaJuridica.tiktokRepresentante}
                      onChange={(e) => setLeadFormData({
                        ...leadFormData,
                        pessoaJuridica: { ...leadFormData.pessoaJuridica, tiktokRepresentante: e.target.value }
                      })}
                      className="w-full text-xs font-semibold pl-8 pr-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white"
                      placeholder="representante.tiktok"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: QUALIFICACAO */}
            <div className="space-y-4 pt-2">
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-450 border-b border-gray-100 pb-1.5">
                2. Informações de Negócio & Qualificação da Demanda
              </span>

              <div className="flex flex-col gap-4">
                {/* 1. Origem do LEAD */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Origem do LEAD</label>
                  <select 
                    value={leadFormData.origemLead}
                    onChange={(e) => setLeadFormData({ ...leadFormData, origemLead: e.target.value })}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white outline-none transition cursor-pointer"
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

                {leadFormData.origemLead === 'Indicação Direta' && (
                  <DirectReferralFields
                    leadFormData={leadFormData}
                    setLeadFormData={setLeadFormData}
                    leadType="PJ"
                  />
                )}

                {/* 2. Área Jurídica de Interesse */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Área Jurídica de Interesse</label>
                  <select 
                    value={leadFormData.areaJuridica}
                    onChange={(e) => setLeadFormData({ ...leadFormData, areaJuridica: e.target.value })}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white outline-none transition cursor-pointer"
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

                {/* 3. Classificação Comercial */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Classificação Comercial</label>
                  <select 
                    value={leadFormData.classificacao}
                    onChange={(e) => setLeadFormData({ ...leadFormData, classificacao: e.target.value })}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white outline-none transition cursor-pointer"
                  >
                    <option>Geral</option>
                    <option>Grandes Contas</option>
                    <option>Pro-Bono / Amigo</option>
                    <option>Recorrência (Retainer)</option>
                  </select>
                </div>

                {/* 4. Assunto */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Assunto</label>
                  <input 
                    type="text" 
                    value={leadFormData.assunto}
                    onChange={(e) => setLeadFormData({ ...leadFormData, assunto: e.target.value })}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white outline-none transition"
                    placeholder="Ex: Assessoria em Planejamento Tributário Anual"
                  />
                </div>

                {/* Tipo de Contrato de Honorários */}
                <div className="bg-purple-50/40 p-4 border border-purple-100 rounded-2xl space-y-3">
                  <div>
                    <label className="block text-[9.5px] font-bold text-purple-800 uppercase tracking-wider mb-1.5">
                      Tipo de Contrato de Honorários
                    </label>
                    <select
                      value={leadFormData.tipoContrato || 'Fixos'}
                      onChange={(e) => handleContractFieldChange('tipoContrato', e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-2 bg-white border border-purple-200 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 transition cursor-pointer"
                    >
                      <option value="Fixos">Honorários Fixos (Pró-labore)</option>
                      <option value="Êxito">Honorários Ad Exitum (Êxito)</option>
                      <option value="Misto">Honorários Mistos (Fixo + Êxito)</option>
                      <option value="Outro">Outro Formato</option>
                    </select>
                  </div>

                  {(leadFormData.tipoContrato === 'Fixos' || leadFormData.tipoContrato === 'Misto') && (
                    <div className="animate-fade-in text-xs">
                      <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Valor Pro-labore Fixo (R$)
                      </label>
                      <input
                        type="number"
                        value={leadFormData.valorFixoParte || ''}
                        onChange={(e) => handleContractFieldChange('valorFixoParte', e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:bg-white outline-none focus:ring-1 focus:ring-purple-500 transition"
                        placeholder="Ex: 10000"
                      />
                    </div>
                  )}

                  {(leadFormData.tipoContrato === 'Êxito' || leadFormData.tipoContrato === 'Misto') && (
                    <div className="grid grid-cols-2 gap-3 animate-fade-in text-xs">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Proveito Econômico Estimado (R$)
                        </label>
                        <input
                          type="number"
                          value={leadFormData.proveitoEconomico || ''}
                          onChange={(e) => handleContractFieldChange('proveitoEconomico', e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:bg-white outline-none focus:ring-1 focus:ring-purple-500 transition"
                          placeholder="Ex: 100000"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Percentual de Êxito (%)
                        </label>
                        <input
                          type="number"
                          value={leadFormData.percentualExito || ''}
                          onChange={(e) => handleContractFieldChange('percentualExito', e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-xl focus:bg-white outline-none focus:ring-1 focus:ring-purple-500 transition font-sans"
                          placeholder="Ex: 20"
                        />
                      </div>
                    </div>
                  )}

                  {leadFormData.tipoContrato && leadFormData.tipoContrato !== 'Outro' && (
                    <div className="bg-purple-50/50 p-2 text-[10px] text-purple-900 border border-purple-100 rounded-lg font-semibold space-y-1">
                      <span className="block font-bold uppercase tracking-wider text-[8px] text-purple-800">
                        Memória de Cálculo (Automática):
                      </span>
                      {leadFormData.tipoContrato === 'Fixos' && (
                        <div>
                          Valor Fixo = <span className="font-bold">R$ {parseFloat(leadFormData.valorFixoParte) || 0}</span>
                        </div>
                      )}
                      {leadFormData.tipoContrato === 'Êxito' && (
                        <div>
                          Proveito Econômico (R$ {parseFloat(leadFormData.proveitoEconomico) || 0}) x Êxito ({parseFloat(leadFormData.percentualExito) || 0}%) = <span className="font-bold text-purple-700">R$ {parseFloat(leadFormData.valorPotencial) || 0}</span>
                        </div>
                      )}
                      {leadFormData.tipoContrato === 'Misto' && (
                        <div>
                          Fixo (R$ {parseFloat(leadFormData.valorFixoParte) || 0}) + [Proveito (R$ {parseFloat(leadFormData.proveitoEconomico) || 0}) x Êxito ({parseFloat(leadFormData.percentualExito) || 0}%)] = <span className="font-bold text-purple-700">R$ {leadFormData.valorPotencial || 0}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. Valor em Potencial estimado */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Valor em Potencial estimado (R$) <span className="text-[9px] text-purple-600 lowercase normal-case font-normal">(Calculado ou ajustado livremente)</span>
                  </label>
                  <input 
                    type="number" 
                    value={leadFormData.valorPotencial}
                    onChange={(e) => setLeadFormData({ ...leadFormData, valorPotencial: e.target.value })}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white outline-none font-sans"
                    placeholder="Ex: 50000"
                  />
                </div>

                {/* 6. Resumo da Dor Relatada pelo cliente */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Resumo da Dor Relatada pelo cliente</label>
                  <textarea 
                    rows={3}
                    value={leadFormData.dorPrincipal}
                    onChange={(e) => setLeadFormData({ ...leadFormData, dorPrincipal: e.target.value })}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white outline-none transition"
                    placeholder="O que motivou o contato? Qual o problema central dele?"
                  />
                </div>

                {/* 7. Já é Cliente do Escritório ou caso é novo? */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Já é Cliente do Escritório ou caso é novo?
                  </label>
                  <div className="flex flex-col gap-2">
                    {[
                      { value: 'Já é Cliente', label: 'Já é Cliente da Giffoni Advogados' },
                      { value: 'Caso Novo', label: 'Não, é um Caso Novo (Inédito)' }
                    ].map(opt => (
                      <label 
                        key={opt.value} 
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          leadFormData.jaCliente === opt.value
                            ? 'bg-purple-50/50 border-purple-500 text-purple-955 font-bold'
                            : 'bg-slate-50/50 border-gray-200 text-gray-650 hover:bg-slate-50'
                        }`}
                      >
                        <input 
                          type="radio"
                          name="jaCliente"
                          value={opt.value}
                          checked={leadFormData.jaCliente === opt.value}
                          onChange={() => setLeadFormData({ ...leadFormData, jaCliente: opt.value })}
                          className="text-purple-600 focus:ring-purple-500 cursor-pointer h-4 w-4 shrink-0"
                        />
                        <span className="text-xs">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 8. Existe Prazo em andamento? */}
                <div className="bg-slate-50/50 p-4 border border-gray-200 rounded-2xl space-y-3">
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Existe Prazo em andamento?
                  </label>
                  <div className="flex gap-4">
                    {[
                      { value: true, label: 'Sim' },
                      { value: false, label: 'Não' }
                    ].map(o => (
                      <label key={o.value.toString()} className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-700">
                        <input 
                          type="radio" 
                          name="existePrazo" 
                          checked={leadFormData.existePrazo === o.value} 
                          onChange={() => setLeadFormData({ ...leadFormData, existePrazo: o.value })}
                          className="text-purple-600 focus:ring-purple-500 cursor-pointer h-4 w-4"
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>

                  {leadFormData.existePrazo && (
                    <div className="animate-fade-in pt-1">
                      <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data Limite do Prazo</label>
                      <input 
                        type="date" 
                        value={leadFormData.dataPrazo}
                        onChange={(e) => setLeadFormData({ ...leadFormData, dataPrazo: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-1.5 bg-white border border-gray-200 rounded-xl"
                      />
                    </div>
                  )}
                </div>

                {/* 9. Ações Recomendadas terá a interface com a Gestão de LEADS (Permitindo Solicitar Agendamento de Reunião) */}
                <div className="bg-purple-50/50 p-4 border border-purple-150 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-purple-950">
                      Ações Recomendadas (Interface Gestão de LEADS)
                    </span>
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer p-2.5 bg-white border border-purple-100 rounded-xl hover:bg-white/85 transition shadow-4xs">
                    <input 
                      type="checkbox" 
                      checked={leadFormData.solicitarReuniao}
                      onChange={(e) => setLeadFormData({ ...leadFormData, solicitarReuniao: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-550 w-4.5 h-4.5 mt-0.5 cursor-pointer"
                    />
                    <div>
                      <strong className="block text-xs text-purple-950 font-extrabold">Solicitar Agendamento de Reunião</strong>
                      <span className="block text-[10px] text-purple-650 leading-relaxed font-semibold">
                        Sinaliza no Painel que este lead precisa de uma chamada de alinhamento imediata.
                      </span>
                    </div>
                  </label>

                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={() => alert("As opções para agendar Reuniões Comerciais estarão disponíveis no Painel de Ações de cada Lead cadastrado!")}
                      className="w-full py-2 bg-purple-650 hover:bg-purple-750 text-white rounded-xl text-[10.5px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      <span>Permitir Solicitar Agendamento de Reunião 📅</span>
                    </button>
                  </div>
                </div>

                {/* 10. Documentos Prévios Recebidos? */}
                <div className="flex items-center">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-black text-slate-700">
                    <input 
                      type="checkbox" 
                      checked={leadFormData.documentosRecebidos}
                      onChange={(e) => setLeadFormData({ ...leadFormData, documentosRecebidos: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4.5 h-4.5 cursor-pointer"
                    />
                    <span>Documentos Prévios Recebidos?</span>
                  </label>
                </div>

                {/* 11. Observações Gerais */}
                <div>
                  <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Observações Gerais</label>
                  <textarea 
                    rows={3}
                    value={leadFormData.observacoes}
                    onChange={(e) => setLeadFormData({ ...leadFormData, observacoes: e.target.value })}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white outline-none transition"
                    placeholder="Adicione quaisquer anotações adicionais..."
                  />
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-3.5">
              <button
                type="button"
                onClick={() => navigate('/boss/cadastrar.leads/private')}
                className="px-5 py-3 border border-gray-250 text-gray-600 hover:bg-slate-50 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-7 py-3 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-md bg-purple-600 hover:bg-purple-700 active:bg-purple-800"
              >
                <Save size={14} />
                <span>{submitting ? 'Salvando...' : 'Salvar dados do LEAD'}</span>
              </button>
            </div>

          </form>
        </motion.div>

        {/* NEW REAL TODOIST AUTOMATION CARD */}
        <LeadTodoistAutomationCard
          leadId={editLeadId || createdLeadId}
          lead={leadFormData}
          tipoPessoa="PJ"
          onLeadUpdated={(updatedFields) => {
            setLeadFormData((prev: any) => ({
              ...prev,
              ...updatedFields
            }));
          }}
        />

        <LeadStepNavigation
          id="ir-para-etapa-02-btn-pj"
          navigating={navigatingStep2}
          onClick={handleSaveAndNavigate}
        />

      </div>
    </BossLayout>
  );
}
