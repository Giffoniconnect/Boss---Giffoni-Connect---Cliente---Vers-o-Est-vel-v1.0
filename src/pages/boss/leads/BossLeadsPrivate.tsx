import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BossLayout } from '../../../components/Layout';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  query, 
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  UserPlus, 
  Building2, 
  ArrowRight, 
  ArrowLeft,
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle, 
  XOctagon, 
  Plus, 
  Sliders, 
  Eye, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Coins, 
  AlertCircle, 
  Search, 
  Filter,
  Calendar,
  Briefcase,
  Phone,
  ArrowLeftRight,
  Facebook,
  Instagram,
  Share2,
  Sparkles,
  UserCheck,
  RotateCcw,
  MessageSquare,
  Megaphone,
  Globe,
  Award,
  Store,
  HelpCircle,
  FileCheck,
  FileText
} from 'lucide-react';

const FUNNEL_STATUSES = [
  'Novo Lead',
  'Primeiro Contato',
  'Aguardando Documentos',
  'Aguardando Reunião',
  'Em Análise Jurídica',
  'Proposta Enviada',
  'Follow-up',
  'Convertido em Cliente',
  'Perdido',
  'Arquivado'
];

export default function BossLeadsPrivate() {
  const navigate = useNavigate();

  // Core State
  const [leads, setLeads] = useState<any[]>([]);
  const [excludedLeads, setExcludedLeads] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ativos' | 'excluidos'>('ativos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter / Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');

  // Form Toggles
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [formType, setFormType] = useState<'PF' | 'PJ'>('PF');
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [leadIdToDelete, setLeadIdToDelete] = useState<string | null>(null);

  // Form Fields State
  const [leadFormData, setLeadFormData] = useState<any>({
    origemLead: 'WhatsApp',
    areaJuridica: 'Trabalhista',
    assunto: '',
    dorPrincipal: '',
    urgencia: 'Média',
    existePrazo: false,
    dataPrazo: '',
    possuiProcesso: false,
    numeroProcesso: '',
    parteContraria: '',
    documentosRecebidos: false,
    responsavelInterno: '',
    valorPotencial: '',
    statusFunil: 'Novo Lead',
    classificacao: 'Geral',
    proximoPasso: '',
    observacoes: '',

    pessoaFisica: {
      nomeCompleto: '',
      cpf: '',
      rg: '',
      dataNascimento: '',
      estadoCivil: 'Solteiro(a)',
      profissao: '',
      telefone: '',
      whatsapp: '',
      email: '',
      endereco: '',
      cidade: '',
      uf: ''
    },

    pessoaJuridica: {
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      inscricaoEstadual: '',
      representanteLegal: '',
      cpfRepresentante: '',
      cargoRepresentante: '',
      telefone: '',
      whatsapp: '',
      email: '',
      endereco: '',
      cidade: '',
      uf: ''
    }
  });

  // Load leads from Firestore
  const loadLeadsFromFirestore = async () => {
    try {
      setLoading(true);
      setError(null);
      let list: any[] = [];
      try {
        const q = query(collection(db, 'marketingLeads'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (orderError) {
        console.warn('Failing ordered query, trying simple query...', orderError);
        const snap = await getDocs(collection(db, 'marketingLeads'));
        list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        list.sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        });
      }
      setLeads(list);

      // Load excluded leads
      let delList: any[] = [];
      try {
        const snapDel = await getDocs(collection(db, 'marketingLeadsDeleted'));
        delList = snapDel.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        delList.sort((a, b) => {
          const tA = a.excludedAt ? new Date(a.excludedAt).getTime() : 0;
          const tB = b.excludedAt ? new Date(b.excludedAt).getTime() : 0;
          return tB - tA;
        });
      } catch (delError) {
        console.warn('Error loading deleted leads, trying local backup:', delError);
        const localDel = localStorage.getItem('local_deleted_marketing_leads');
        if (localDel) {
          delList = JSON.parse(localDel);
        }
      }
      setExcludedLeads(delList);
    } catch (e: any) {
      console.error(e);
      // Soften warning and load local backups
      const local = localStorage.getItem('local_marketing_leads');
      if (local) {
        setLeads(JSON.parse(local));
      }
      const localDel = localStorage.getItem('local_deleted_marketing_leads');
      if (localDel) {
        setExcludedLeads(JSON.parse(localDel));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeadsFromFirestore();
  }, []);

  // Save changes back to localStorage for hybrid reliability
  const syncLocalBackup = (updatedList: any[]) => {
    localStorage.setItem('local_marketing_leads', JSON.stringify(updatedList));
  };

  const syncLocalExcludedBackup = (updatedDelList: any[]) => {
    localStorage.setItem('local_deleted_marketing_leads', JSON.stringify(updatedDelList));
  };

  // Status Handlers
  const getFunnelBadgeColor = (status: string) => {
    switch (status) {
      case 'Novo Lead': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Primeiro Contato': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Aguardando Documentos': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Aguardando Reunião': return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'Em Análise Jurídica': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Proposta Enviada': return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'Follow-up': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Convertido em Cliente': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Perdido': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Stats Counters Calculations
  const stats = React.useMemo(() => {
    const totalLeads = leads.length;
    const pfLeads = leads.filter(l => l.tipoPessoa === 'PF').length;
    const pjLeads = leads.filter(l => l.tipoPessoa === 'PJ').length;
    const newLeads = leads.filter(l => l.statusFunil === 'Novo Lead').length;
    
    const activeLeads = leads.filter(l => 
      !['Convertido em Cliente', 'Perdido', 'Arquivado'].includes(l.statusFunil)
    ).length;

    const deadlineLeads = leads.filter(l => l.existePrazo).length;
    const convertedLeads = leads.filter(l => l.convertidoEmCliente || l.statusFunil === 'Convertido em Cliente').length;
    const lostLeads = leads.filter(l => l.statusFunil === 'Perdido').length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
    
    const estimatedPotential = leads.reduce((sum, current) => {
      const val = parseFloat(String(current.valorPotencial || 0).replace(/[^\d.]/g, ''));
      return isNaN(val) ? sum : sum + val;
    }, 0);

    const whatsappCount = leads.filter(l => {
      const src = (l.origemLead || '').toLowerCase();
      return src === 'whatsapp';
    }).length;

    const indicacaoCount = leads.filter(l => {
      const src = (l.origemLead || '').toLowerCase();
      return src.includes('indica') || src.includes('indicacao') || src.includes('indicação');
    }).length;

    const instagramCount = leads.filter(l => {
      const src = (l.origemLead || '').toLowerCase();
      return (src.includes('instagram') || src === 'insta' || src === 'ig') && !src.includes('ads');
    }).length;

    const facebookCount = leads.filter(l => {
      const src = (l.origemLead || '').toLowerCase();
      return (src.includes('facebook') || src === 'fb') && !src.includes('ads');
    }).length;

    const tiktokCount = leads.filter(l => {
      const src = (l.origemLead || '').toLowerCase();
      return src.includes('tiktok') || src.includes('tik tok') || src.includes('tik-tok');
    }).length;

    const googleAdsCount = leads.filter(l => {
      const src = (l.origemLead || '').toLowerCase();
      return src.includes('google') || src.includes('gads');
    }).length;

    const socialAdsCount = leads.filter(l => {
      const src = (l.origemLead || '').toLowerCase();
      return src.includes('ads') && (src.includes('instagram') || src.includes('facebook'));
    }).length;

    const redesSociaisCount = leads.filter(l => {
      const src = (l.origemLead || '').toLowerCase();
      return src === 'redes sociais' || src === 'rede social' || src === 'redes_sociais';
    }).length;

    const balcaoCount = leads.filter(l => {
      const src = (l.origemLead || '').toLowerCase();
      return src.includes('balcão') || src.includes('atendimento') || src.includes('físico') || src.includes('fisico');
    }).length;

    const eventosCount = leads.filter(l => {
      const src = (l.origemLead || '').toLowerCase();
      return src.includes('evento') || src.includes('palestra');
    }).length;

    const parceriaCount = leads.filter(l => {
      const src = (l.origemLead || '').toLowerCase();
      return src.includes('parceria');
    }).length;

    const outrosCount = leads.filter(l => {
      const src = (l.origemLead || '').toLowerCase();
      if (src.includes('outros') || src === 'outro' || src === '') return true;
      const matched = src === 'whatsapp' ||
        src.includes('indica') || src.includes('indicacao') || src.includes('indicação') ||
        ((src.includes('instagram') || src === 'insta' || src === 'ig') && !src.includes('ads')) ||
        ((src.includes('facebook') || src === 'fb') && !src.includes('ads')) ||
        src.includes('tiktok') || src.includes('tik tok') || src.includes('tik-tok') ||
        src.includes('google') || src.includes('gads') ||
        (src.includes('ads') && (src.includes('instagram') || src.includes('facebook'))) ||
        src === 'redes sociais' || src === 'rede social' || src === 'redes_sociais' ||
        src.includes('balcão') || src.includes('atendimento') || src.includes('físico') || src.includes('fisico') ||
        src.includes('evento') || src.includes('palestra') ||
        src.includes('parceria');
      return !matched;
    }).length;

    return {
      totalLeads,
      pfLeads,
      pjLeads,
      newLeads,
      activeLeads,
      deadlineLeads,
      convertedLeads,
      lostLeads,
      conversionRate,
      estimatedPotential,
      whatsappCount,
      indicacaoCount,
      instagramCount,
      facebookCount,
      tiktokCount,
      googleAdsCount,
      socialAdsCount,
      redesSociaisCount,
      balcaoCount,
      eventosCount,
      parceriaCount,
      outrosCount
    };
  }, [leads]);

  // Handle Submission (Create Lead)
  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const name = formType === 'PF' 
      ? leadFormData.pessoaFisica.nomeCompleto 
      : leadFormData.pessoaJuridica.razaoSocial;

    if (!name || name.trim() === '') {
      setError(formType === 'PF' ? 'Preencha o Nome Completo do Lead.' : 'Preencha a Razão Social da Empresa.');
      return;
    }

    try {
      const newId = 'lead_' + Math.random().toString(36).substring(2, 11);
      const now = new Date().toISOString();

      const payload = {
        ...leadFormData,
        id: newId,
        tipoPessoa: formType,
        convertidoEmCliente: false,
        createdAt: now,
        updatedAt: now
      };

      const docRef = doc(db, 'marketingLeads', newId);
      await setDoc(docRef, payload);

      const updatedLeads = [payload, ...leads];
      setLeads(updatedLeads);
      syncLocalBackup(updatedLeads);

      setSuccess(`Lead ${formType === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'} cadastrado com sucesso!`);
      
      // Reset Form
      setLeadFormData({
        origemLead: 'WhatsApp',
        areaJuridica: 'Trabalhista',
        assunto: '',
        dorPrincipal: '',
        urgencia: 'Média',
        existePrazo: false,
        dataPrazo: '',
        possuiProcesso: false,
        numeroProcesso: '',
        parteContraria: '',
        documentosRecebidos: false,
        responsavelInterno: '',
        valorPotencial: '',
        statusFunil: 'Novo Lead',
        classificacao: 'Geral',
        proximoPasso: '',
        observacoes: '',
        pessoaFisica: {
          nomeCompleto: '',
          cpf: '',
          rg: '',
          dataNascimento: '',
          estadoCivil: 'Solteiro(a)',
          profissao: '',
          telefone: '',
          whatsapp: '',
          email: '',
          endereco: '',
          cidade: '',
          uf: ''
        },
        pessoaJuridica: {
          razaoSocial: '',
          nomeFantasia: '',
          cnpj: '',
          inscricaoEstadual: '',
          representanteLegal: '',
          cpfRepresentante: '',
          cargoRepresentante: '',
          telefone: '',
          whatsapp: '',
          email: '',
          endereco: '',
          cidade: '',
          uf: ''
        }
      });

      setShowAddForm(false);
    } catch (e: any) {
      console.error(e);
      setError('Falha ao cadastrar no Firestore: ' + (e.message || e));
    }
  };

  // Convert Lead / Converter em Cliente
  const handleConvertLead = async (lead: any) => {
    setError(null);
    setSuccess(null);

    try {
      const parentNow = new Date().toISOString();
      const updatedFields = {
        statusFunil: 'Convertido em Cliente',
        convertidoEmCliente: true,
        dataConversao: parentNow,
        updatedAt: parentNow
      };

      // update in Firestore
      const docRef = doc(db, 'marketingLeads', lead.id);
      await updateDoc(docRef, updatedFields);

      // update local state
      const updatedList = leads.map(l => l.id === lead.id ? { ...l, ...updatedFields } : l);
      setLeads(updatedList);
      syncLocalBackup(updatedList);

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

    } catch (e: any) {
      console.error(e);
      setError('Erro ao converter lead: ' + (e.message || e));
    }
  };

  // Delete Lead
  const handleDeleteLead = (leadId: string) => {
    setLeadIdToDelete(leadId);
  };

  // Restore Lead
  const handleRestoreLead = async (leadId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const leadToRestore = excludedLeads.find(l => l.id === leadId);
      if (leadToRestore) {
        const { excludedAt, ...restoredPayload } = leadToRestore;
        restoredPayload.statusFunil = 'Novo Lead';
        restoredPayload.updatedAt = new Date().toISOString();

        // Write back to active collection
        await setDoc(doc(db, 'marketingLeads', leadId), restoredPayload);
        // Delete from deleted collection
        await deleteDoc(doc(db, 'marketingLeadsDeleted', leadId));

        // Update states
        const filteredDel = excludedLeads.filter(l => l.id !== leadId);
        setExcludedLeads(filteredDel);
        syncLocalExcludedBackup(filteredDel);

        const updatedActive = [restoredPayload, ...leads];
        setLeads(updatedActive);
        syncLocalBackup(updatedActive);

        setSuccess('Lead restaurado com sucesso! Voltando ao painel de ativos.');
      }
    } catch (e: any) {
      console.error(e);
      setError('Erro ao restaurar lead: ' + (e.message || e));
    }
  };

  // Confirm delete handler (moves to Excluded Repository if active, deletes permanently if already excluded)
  const confirmDeleteLead = async () => {
    if (!leadIdToDelete) return;
    try {
      const leadToExclude = leads.find(l => l.id === leadIdToDelete);
      if (leadToExclude) {
        // Enforce the requirement: todo LEAD que for excluído deverá ir para este repositório
        const excludedPayload = {
          ...leadToExclude,
          excludedAt: new Date().toISOString(),
          statusFunil: 'Excluído'
        };

        // Save to marketingLeadsDeleted
        await setDoc(doc(db, 'marketingLeadsDeleted', leadIdToDelete), excludedPayload);

        // Delete from marketingLeads
        await deleteDoc(doc(db, 'marketingLeads', leadIdToDelete));

        // Update states
        const filtered = leads.filter(l => l.id !== leadIdToDelete);
        setLeads(filtered);
        syncLocalBackup(filtered);

        const updatedExcluded = [excludedPayload, ...excludedLeads];
        setExcludedLeads(updatedExcluded);
        syncLocalExcludedBackup(updatedExcluded);

        setSuccess('Lead enviado para o Repositório de Excluídos com sucesso!');
      } else {
        // It's already in the excluded repository
        const leadInDeleted = excludedLeads.find(l => l.id === leadIdToDelete);
        if (leadInDeleted) {
          await deleteDoc(doc(db, 'marketingLeadsDeleted', leadIdToDelete));
          const filteredDel = excludedLeads.filter(l => l.id !== leadIdToDelete);
          setExcludedLeads(filteredDel);
          syncLocalExcludedBackup(filteredDel);
          setSuccess('Lead excluído permanentemente do Repositório!');
        }
      }

      setSelectedLeadForDetail(null);
      setLeadIdToDelete(null);
    } catch (e: any) {
      console.error(e);
      setError('Falha ao processar exclusão do lead: ' + (e.message || e));
      setLeadIdToDelete(null);
    }
  };

  // Edit / update details
  const handleSaveEdit = async () => {
    if (!selectedLeadForDetail) return;
    try {
      const parentNow = new Date().toISOString();
      const payload = {
        ...selectedLeadForDetail,
        updatedAt: parentNow
      };

      const isLeadInExcluded = excludedLeads.some(l => l.id === selectedLeadForDetail.id);
      const targetCollection = isLeadInExcluded ? 'marketingLeadsDeleted' : 'marketingLeads';

      await setDoc(doc(db, targetCollection, selectedLeadForDetail.id), payload);
      
      if (isLeadInExcluded) {
        const updated = excludedLeads.map(l => l.id === selectedLeadForDetail.id ? payload : l);
        setExcludedLeads(updated);
        syncLocalExcludedBackup(updated);
      } else {
        const updated = leads.map(l => l.id === selectedLeadForDetail.id ? payload : l);
        setLeads(updated);
        syncLocalBackup(updated);
      }

      setSuccess('Lead atualizado com sucesso!');
      setIsEditing(false);
    } catch (e: any) {
      console.error(e);
      setError('Erro ao salvar alterações do lead: ' + (e.message || e));
    }
  };

  // Filter List
  const filteredLeads = leads.filter(l => {
    // search text
    const nameStr = l.tipoPessoa === 'PF' 
      ? (l.pessoaFisica?.nomeCompleto || '') 
      : (l.pessoaJuridica?.razaoSocial || l.pessoaJuridica?.nomeFantasia || '');

    const contactStr = l.tipoPessoa === 'PF'
      ? (l.pessoaFisica?.email || l.pessoaFisica?.telefone || l.pessoaFisica?.cpf || '')
      : (l.pessoaJuridica?.email || l.pessoaJuridica?.telefone || l.pessoaJuridica?.cnpj || '');

    const searchMatch = (
      nameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contactStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.areaJuridica || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.origemLead || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.responsavelInterno || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const typeMatch = selectedTypeFilter === 'All' || l.tipoPessoa === selectedTypeFilter;
    const statusMatch = selectedStatusFilter === 'All' || l.statusFunil === selectedStatusFilter;

    return searchMatch && typeMatch && statusMatch;
  });

  // Filter Excluded List
  const filteredExcludedLeads = excludedLeads.filter(l => {
    const nameStr = l.tipoPessoa === 'PF' 
      ? (l.pessoaFisica?.nomeCompleto || '') 
      : (l.pessoaJuridica?.razaoSocial || l.pessoaJuridica?.nomeFantasia || '');

    const contactStr = l.tipoPessoa === 'PF'
      ? (l.pessoaFisica?.email || l.pessoaFisica?.telefone || l.pessoaFisica?.cpf || '')
      : (l.pessoaJuridica?.email || l.pessoaJuridica?.telefone || l.pessoaJuridica?.cnpj || '');

    const searchMatch = (
      nameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contactStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.areaJuridica || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.origemLead || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.responsavelInterno || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const typeMatch = selectedTypeFilter === 'All' || l.tipoPessoa === selectedTypeFilter;

    return searchMatch && typeMatch;
  });

  return (
    <BossLayout>
      <div id="boss-marketing-leads-panel" className="max-w-7xl mx-auto px-4 md:px-0 space-y-8 animate-fade-in pb-12">
        
        {/* HEADER SECTION */}
        <div className="border-b border-gray-150 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">BOSS Marketing — Leads Privados</h1>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Central de cadastro, qualificação e conversão de leads particulares direcionados ao fluxo de conformidade.
              </p>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => navigate('/boss-giffoni-clientes/setores')}
                className="text-xs font-bold text-indigo-700 bg-white border border-indigo-200 hover:bg-slate-50 px-4 py-2.5 rounded-xl shadow-4xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Voltar para Setores do Escritório</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/boss/leads/private/dashboard/managing.private.leads')}
                className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-4 py-2.5 rounded-xl shadow-4xs transition hover:bg-indigo-150 flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders size={14} />
                <span>Gestão de Leads Particulares</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/boss/cadastrar.leads/private')}
                className="text-xs font-bold text-white bg-indigo-600 border border-indigo-700 px-4 py-2.5 rounded-xl shadow-4xs transition hover:bg-indigo-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>Cadastrar LEAD</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
                className="text-xs font-bold text-gray-650 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-4xs transition hover:bg-slate-50 flex items-center cursor-pointer"
              >
                ⟨ Voltar ao Fluxo de Produção
              </button>
            </div>
          </div>
        </div>

        {/* FEEDBACK STATUSES */}
        {error && (
          <div className="bg-rose-50 border border-rose-150 rounded-2xl p-4 flex items-start gap-3">
            <XOctagon className="text-rose-600 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-rose-800 font-semibold">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-emerald-800 font-semibold">{success}</p>
          </div>
        )}

        {/* INDICATORS DASHBOARD */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-[0_1px_3px_rgb(0,0,0,0.03)] selection:bg-purple-100">
            <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Total Leads</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl font-black text-gray-950">{stats.totalLeads}</span>
              <span className="text-[10px] text-gray-400 font-bold font-mono">cadastrados</span>
            </div>
            <div className="grid grid-cols-2 text-[9px] text-gray-500 font-semibold mt-2.5 pt-2 border-t border-gray-100">
              <span>PF: <strong>{stats.pfLeads}</strong></span>
              <span>PJ: <strong>{stats.pjLeads}</strong></span>
            </div>
          </div>

          <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-[0_1px_3px_rgb(0,0,0,0.03)]">
            <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Em Atendimento</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl font-black text-indigo-700">{stats.activeLeads}</span>
              <span className="text-[10px] text-indigo-450 font-bold font-mono">leads ativos</span>
            </div>
            <div className="text-[9px] text-gray-400 font-bold mt-2.5 pt-2 border-t border-gray-100 flex items-center gap-1">
              <Clock size={10} className="text-amber-500" />
              <span>Novos hoje: <strong>{stats.newLeads}</strong></span>
            </div>
          </div>

          <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-[0_1px_3px_rgb(0,0,0,0.03)]">
            <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Leads com Prazo</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl font-black text-amber-700">{stats.deadlineLeads}</span>
              <span className="text-[10px] text-amber-500 font-bold">urgentes</span>
            </div>
            <div className="text-[9px] text-gray-400 font-bold mt-2.5 pt-2 border-t border-gray-100 flex items-center gap-1">
              <Calendar size={10} className="text-amber-500" />
              <span>Acompanhar datas limite</span>
            </div>
          </div>

          <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-[0_1px_3px_rgb(0,0,0,0.03)]">
            <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Taxa Conversão</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl font-black text-emerald-700">{stats.conversionRate}%</span>
              <span className="text-[10px] text-emerald-500 font-bold font-mono">convertidos</span>
            </div>
            <div className="text-[9px] text-gray-500 font-bold mt-2.5 pt-2 border-t border-gray-100 flex items-center gap-1.5">
              <span>Ganhos: <strong>{stats.convertedLeads}</strong></span>
              <span className="text-slate-300">|</span>
              <span>Perdidos: <strong>{stats.lostLeads}</strong></span>
            </div>
          </div>

          <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-[0_1px_3px_rgb(0,0,0,0.03)] col-span-2 md:col-span-1">
            <span className="block text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Potencial Estimado</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-[10px] font-bold text-gray-400">R$</span>
              <span className="text-lg font-black text-slate-800 font-mono">
                {stats.estimatedPotential.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-[9px] text-gray-400 font-bold mt-2.5 pt-2 border-t border-gray-100 flex items-center gap-1">
              <Coins size={10} className="text-yellow-600" />
              <span>Valor total estimado</span>
            </div>
          </div>
        </div>

        {/* FONTES DE CAPTAÇÃO / ORIGENS DOS LEADS */}
        <div className="bg-slate-50/50 border border-gray-150 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 border border-indigo-100/65 rounded-xl text-indigo-650 flex items-center justify-center">
                <Sparkles size={14} />
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-755">
                  Fontes de Captação dos Leads
                </h4>
                <p className="text-[10px] text-gray-450 font-bold">Distribuição de origem e canais de prospecção do Marketing</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
            {[
              { label: 'WhatsApp', count: stats.whatsappCount, colorClass: 'text-emerald-650', bgClass: 'bg-emerald-50 border-emerald-100/70', barBg: 'bg-emerald-550', hoverBorder: 'hover:border-emerald-300', icon: <MessageSquare size={15} /> },
              { label: 'Indicação Direta', count: stats.indicacaoCount, colorClass: 'text-blue-600', bgClass: 'bg-blue-50 border-blue-100/70', barBg: 'bg-blue-500', hoverBorder: 'hover:border-blue-300', icon: <UserCheck size={15} /> },
              { label: 'Instagram', count: stats.instagramCount, colorClass: 'text-pink-600', bgClass: 'bg-pink-50 border-pink-100/70', barBg: 'bg-pink-500', hoverBorder: 'hover:border-pink-300', icon: <Instagram size={15} /> },
              { label: 'Facebook', count: stats.facebookCount, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50 border-indigo-100/70', barBg: 'bg-indigo-500', hoverBorder: 'hover:border-indigo-300', icon: <Facebook size={15} /> },
              { label: 'TikTok', count: stats.tiktokCount, colorClass: 'text-slate-800', bgClass: 'bg-slate-50 border-slate-200', barBg: 'bg-slate-800', hoverBorder: 'hover:border-slate-400', icon: <Share2 size={15} /> },
              { label: 'Google Ads', count: stats.googleAdsCount, colorClass: 'text-amber-600', bgClass: 'bg-amber-50 border-amber-100/70', barBg: 'bg-amber-500', hoverBorder: 'hover:border-amber-300', icon: <Globe size={15} /> },
              { label: 'Insta/FB Ads', count: stats.socialAdsCount, colorClass: 'text-rose-600', bgClass: 'bg-rose-50 border-rose-100/70', barBg: 'bg-rose-500', hoverBorder: 'hover:border-rose-300', icon: <Megaphone size={15} /> },
              { label: 'Redes Sociais', count: stats.redesSociaisCount, colorClass: 'text-violet-600', bgClass: 'bg-violet-50 border-violet-100/70', barBg: 'bg-violet-500', hoverBorder: 'hover:border-violet-300', icon: <Users size={15} /> },
              { label: 'Balcão / Físico', count: stats.balcaoCount, colorClass: 'text-teal-650', bgClass: 'bg-teal-50 border-teal-100/70', barBg: 'bg-teal-550', hoverBorder: 'hover:border-teal-300', icon: <Store size={15} /> },
              { label: 'Eventos / Palestras', count: stats.eventosCount, colorClass: 'text-purple-650', bgClass: 'bg-purple-50 border-purple-100/70', barBg: 'bg-purple-550', hoverBorder: 'hover:border-purple-300', icon: <Award size={15} /> },
              { label: 'Parceria Externa', count: stats.parceriaCount, colorClass: 'text-teal-700', bgClass: 'bg-teal-50/70 border-teal-100/70', barBg: 'bg-teal-600', hoverBorder: 'hover:border-teal-400', icon: <Briefcase size={15} /> },
              { label: 'Outros', count: stats.outrosCount, colorClass: 'text-gray-600', bgClass: 'bg-gray-50 border-gray-200', barBg: 'bg-gray-500', hoverBorder: 'hover:border-gray-400', icon: <HelpCircle size={15} /> }
            ].map((srcItem, idx) => {
              const perc = stats.totalLeads > 0 ? Math.round((srcItem.count / stats.totalLeads) * 100) : 0;
              return (
                <div key={idx} className={`bg-white border border-gray-150 rounded-2xl p-3.5 shadow-3xs flex flex-col justify-between gap-2.5 group transition-all duration-300 ${srcItem.hoverBorder} hover:shadow-2xs`}>
                  <div className="flex justify-between items-start gap-1">
                    <div className="flex-1">
                      <span className={`block text-[9px] uppercase tracking-wider font-extrabold whitespace-normal break-words leading-tight ${srcItem.colorClass} mb-1`} title={srcItem.label}>
                        {srcItem.label}
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-gray-950 font-mono tracking-tight">{srcItem.count}</span>
                        <span className="text-[8.5px] text-gray-400 font-bold font-mono">({perc}%)</span>
                      </div>
                    </div>
                    <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 border transition ${srcItem.bgClass} ${srcItem.colorClass}`}>
                      {srcItem.icon}
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                    <div 
                      className={`${srcItem.barBg} h-full rounded-full transition-all duration-500`} 
                      style={{ width: `${perc}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* INFORMATIVE EXPLANATION BANNER */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xs border border-slate-800 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 w-44 h-44 bg-indigo-550/15 rounded-full blur-3xl" />
          <h3 className="font-extrabold text-base mb-1">Entrada Estratégica de Leads do Escritório</h3>
          <p className="text-xs text-slate-300 leading-relaxed max-w-4xl font-medium">
            Antes de abrir um caso no fluxo de produção, cadastre aqui o interessado, registre sua origem, identifique se é Pessoa Física ou Pessoa Jurídica, qualifique a demanda e acompanhe a conversão de forma blindada, sem misturar potenciais compradores com o rol formal de clientes ativos.
          </p>
        </div>

        {/* TWO PRIMARY CADASTRO CARDS */}
        {false && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card PF */}
          <div className="bg-white border-2 border-blue-100 hover:border-blue-200 rounded-[2rem] p-6 shadow-3xs hover:shadow-2xs transition transition-all duration-350 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                <UserPlus size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Cadastrar LEAD Pessoa Física Particular</h3>
                <p className="text-xs text-gray-500 leading-relaxed mt-1 font-semibold">
                  Registro rápido estruturado de interessados pessoa natural (caderneta comercial ou campanhas de captação PF).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormType('PF');
                setShowAddForm(true);
                // scroll
                document.getElementById('add-lead-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="py-2.5 px-4 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-4xs"
            >
              <span>Cadastrar Lead PF</span>
              <Plus size={14} />
            </button>
          </div>

          {/* Card PJ */}
          <div className="bg-white border-2 border-purple-100 hover:border-purple-200 rounded-[2rem] p-6 shadow-3xs hover:shadow-2xs transition transition-all duration-350 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-purple-50 border border-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                <Building2 size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Cadastrar LEAD Pessoa Jurídica Particular</h3>
                <p className="text-xs text-gray-500 leading-relaxed mt-1 font-semibold">
                  Registro para empresas, consultorias, indústrias, comissões jurídicas prévias corporativas (PJ).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormType('PJ');
                setShowAddForm(true);
                document.getElementById('add-lead-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="py-2.5 px-4 w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-4xs"
            >
              <span>Cadastrar Lead PJ</span>
              <Plus size={14} />
            </button>
          </div>
        </div>
        )}

        {/* ADD LEAD EXPANDED CARD FORM (Toggled) */}
        {false && showAddForm && (
          <div id="add-lead-form-anchor" className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs animate-slide-in duration-300">
            <div className={`p-4.5 border-b text-white flex items-center justify-between ${formType === 'PF' ? 'bg-blue-600' : 'bg-purple-600'}`}>
              <div className="flex items-center gap-2.5">
                {formType === 'PF' ? <UserPlus size={18} /> : <Building2 size={18} />}
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wide">
                    {formType === 'PF' ? 'Cadastrar LEAD Pessoa Física Particular' : 'Cadastrar LEAD Pessoa Jurídica Particular'}
                  </h3>
                  <p className="text-[10px] text-white/80">Preencha todos os dados iniciais do interessado comercial.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddForm(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitLead} className="p-6 space-y-6">
              
              {/* STAGING PERSONAL OR CORPORATE BLOCK */}
              <div className="space-y-4">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-gray-100 pb-1.5">
                  1. Informações Cadastrais Básicas
                </span>

                {formType === 'PF' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nome Completo *</label>
                      <input 
                        type="text" 
                        required
                        value={leadFormData.pessoaFisica.nomeCompleto}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaFisica: { ...leadFormData.pessoaFisica, nomeCompleto: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="Nome Completo do interessado"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">CPF</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaFisica.cpf}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaFisica: { ...leadFormData.pessoaFisica, cpf: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-mono"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">RG</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaFisica.rg}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaFisica: { ...leadFormData.pessoaFisica, rg: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="0000000-0"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data Nascimento</label>
                      <input 
                        type="date" 
                        value={leadFormData.pessoaFisica.dataNascimento}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaFisica: { ...leadFormData.pessoaFisica, dataNascimento: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Estado Civil</label>
                      <select 
                        value={leadFormData.pessoaFisica.estadoCivil}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaFisica: { ...leadFormData.pessoaFisica, estadoCivil: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      >
                        <option>Solteiro(a)</option>
                        <option>Casado(a)</option>
                        <option>Divorciado(a)</option>
                        <option>Viúvo(a)</option>
                        <option>União Estável</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Profissão</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaFisica.profissao}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaFisica: { ...leadFormData.pessoaFisica, profissao: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="Ex: Engenheiro"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Telefone Particular</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaFisica.telefone}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaFisica: { ...leadFormData.pessoaFisica, telefone: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-mono"
                        placeholder="(00) 0000-0000"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">WhatsApp de Contato</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaFisica.whatsapp}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaFisica: { ...leadFormData.pessoaFisica, whatsapp: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-mono"
                        placeholder="(00) 90000-0000"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">E-mail</label>
                      <input 
                        type="email" 
                        value={leadFormData.pessoaFisica.email}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaFisica: { ...leadFormData.pessoaFisica, email: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="contato@exemplo.com"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Endereço Residencial</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaFisica.endereco}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaFisica: { ...leadFormData.pessoaFisica, endereco: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="Rua, Número, Bairro, Complemento"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Cidade / UF</label>
                      <input 
                        type="text" 
                        value={`${leadFormData.pessoaFisica.cidade}${leadFormData.pessoaFisica.uf ? '/' + leadFormData.pessoaFisica.uf : ''}`}
                        onChange={(e) => {
                          const parts = e.target.value.split('/');
                          setLeadFormData({
                            ...leadFormData,
                            pessoaFisica: { 
                              ...leadFormData.pessoaFisica, 
                              cidade: parts[0] || '', 
                              uf: (parts[1] || '').toUpperCase() 
                            }
                          });
                        }}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="Cidade/UF"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Razão Social *</label>
                      <input 
                        type="text" 
                        required
                        value={leadFormData.pessoaJuridica.razaoSocial}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, razaoSocial: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                        placeholder="Razão Social completa"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nome Fantasia</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaJuridica.nomeFantasia}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, nomeFantasia: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                        placeholder="Nome fantasia comercial"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">CNPJ</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaJuridica.cnpj}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, cnpj: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition font-mono"
                        placeholder="00.000.000/0001-00"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Inscrição Estadual/Municipal</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaJuridica.inscricaoEstadual}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, inscricaoEstadual: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                        placeholder="Insc. Est. / Isento"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Representante Legal da Empresa</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaJuridica.representanteLegal}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, representanteLegal: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                        placeholder="Nome completo do sócio/rep."
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">CPF Representante</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaJuridica.cpfRepresentante}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, cpfRepresentante: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition font-mono"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Cargo Representante</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaJuridica.cargoRepresentante}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, cargoRepresentante: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                        placeholder="Assoc., Sócio-Administrador, etc..."
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Telefone Corporativo</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaJuridica.telefone}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, telefone: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition font-mono"
                        placeholder="(00) 0000-0000"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">WhatsApp Comercial</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaJuridica.whatsapp}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, whatsapp: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition font-mono"
                        placeholder="(00) 90000-0000"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">E-mail Comercial</label>
                      <input 
                        type="email" 
                        value={leadFormData.pessoaJuridica.email}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, email: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                        placeholder="contato@empresa.com"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Sede / Endereço</label>
                      <input 
                        type="text" 
                        value={leadFormData.pessoaJuridica.endereco}
                        onChange={(e) => setLeadFormData({
                          ...leadFormData,
                          pessoaJuridica: { ...leadFormData.pessoaJuridica, endereco: e.target.value }
                        })}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                        placeholder="Rua, Número, Bairro, Complemento"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Cidade / UF</label>
                      <input 
                        type="text" 
                        value={`${leadFormData.pessoaJuridica.cidade}${leadFormData.pessoaJuridica.uf ? '/' + leadFormData.pessoaJuridica.uf : ''}`}
                        onChange={(e) => {
                          const parts = e.target.value.split('/');
                          setLeadFormData({
                            ...leadFormData,
                            pessoaJuridica: { 
                              ...leadFormData.pessoaJuridica, 
                              cidade: parts[0] || '', 
                              uf: (parts[1] || '').toUpperCase() 
                            }
                          });
                        }}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                        placeholder="Cidade/UF"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* COMMERCIAL QUALIFICATION METADATA BLOCK */}
              <div className="space-y-4">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-gray-100 pb-1.5">
                  2. Atendimento Comercial & Diagnóstico Jurídico
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Origem do Lead</label>
                    <select 
                      value={leadFormData.origemLead}
                      onChange={(e) => setLeadFormData({ ...leadFormData, origemLead: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    >
                      <option>WhatsApp</option>
                      <option>Campanha Google Ads</option>
                      <option>Campanha Meta (Instagram/FB)</option>
                      <option>Redes Sociais (Orgânico)</option>
                      <option>TikTok Ads</option>
                      <option>Indicação de Parceiro</option>
                      <option>Indicação de Cliente</option>
                      <option>Atendimento Presencial Direto</option>
                      <option>Outra origem</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Área de Interesse</label>
                    <select 
                      value={leadFormData.areaJuridica}
                      onChange={(e) => setLeadFormData({ ...leadFormData, areaJuridica: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    >
                      <option>Trabalhista</option>
                      <option>Previdenciário (INSS)</option>
                      <option>Bancário / Revisional</option>
                      <option>Família e Sucessões</option>
                      <option>Cível Geral</option>
                      <option>Consumidor</option>
                      <option>Tributário</option>
                      <option>Empresarial / Societário</option>
                      <option>Penal / Criminal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Dono / Responsável</label>
                    <input 
                      type="text" 
                      value={leadFormData.responsavelInterno}
                      onChange={(e) => setLeadFormData({ ...leadFormData, responsavelInterno: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      placeholder="Nome do advogado/comercial"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Valor Estimado (R$)</label>
                    <input 
                      type="text" 
                      value={leadFormData.valorPotencial}
                      onChange={(e) => setLeadFormData({ ...leadFormData, valorPotencial: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition font-mono"
                      placeholder="R$ 5.000,00"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Assunto Resumido</label>
                    <input 
                      type="text" 
                      value={leadFormData.assunto}
                      onChange={(e) => setLeadFormData({ ...leadFormData, assunto: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      placeholder="Ex: Rescisão indireta por falta de FGTS / Cobrança indevida"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Dor Principal identificada</label>
                    <input 
                      type="text" 
                      value={leadFormData.dorPrincipal}
                      onChange={(e) => setLeadFormData({ ...leadFormData, dorPrincipal: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      placeholder="O que o incomoda/pretende atingir"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 select-none">
                      <input 
                        type="checkbox" 
                        checked={leadFormData.existePrazo}
                        onChange={(e) => setLeadFormData({ ...leadFormData, existePrazo: e.target.checked })}
                        className="rounded accent-indigo-650"
                      />
                      <span>Existe Prazo Fatal?</span>
                    </label>
                    {leadFormData.existePrazo && (
                      <input 
                        type="date" 
                        value={leadFormData.dataPrazo}
                        onChange={(e) => setLeadFormData({ ...leadFormData, dataPrazo: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2 mt-1 bg-rose-50/50 border border-rose-200 rounded-xl outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 select-none font-mono">
                      <input 
                        type="checkbox" 
                        checked={leadFormData.possuiProcesso}
                        onChange={(e) => setLeadFormData({ ...leadFormData, possuiProcesso: e.target.checked })}
                        className="rounded accent-indigo-650"
                      />
                      <span>Já possui Processo?</span>
                    </label>
                    {leadFormData.possuiProcesso && (
                      <input 
                        type="text" 
                        value={leadFormData.numeroProcesso}
                        onChange={(e) => setLeadFormData({ ...leadFormData, numeroProcesso: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2 mt-1 bg-slate-50 border border-gray-200 rounded-xl outline-none font-mono"
                        placeholder="Nº Processo Judicial"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 select-none">
                      <input 
                        type="checkbox" 
                        checked={leadFormData.documentosRecebidos}
                        onChange={(e) => setLeadFormData({ ...leadFormData, documentosRecebidos: e.target.checked })}
                        className="rounded accent-indigo-650"
                      />
                      <span>Documentos Recebidos?</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Parte Contrária</label>
                    <input 
                      type="text" 
                      value={leadFormData.parteContraria}
                      onChange={(e) => setLeadFormData({ ...leadFormData, parteContraria: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      placeholder="Réu / Empresa Oposta"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Próximo Passo Comercial</label>
                    <input 
                      type="text" 
                      value={leadFormData.proximoPasso}
                      onChange={(e) => setLeadFormData({ ...leadFormData, proximoPasso: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      placeholder="Ex: Agendar reunião de alinhamento com Dr. Pedro na terça-feira às 14:00"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Observações Internas</label>
                    <textarea 
                      value={leadFormData.observacoes}
                      onChange={(e) => setLeadFormData({ ...leadFormData, observacoes: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition min-h-[70px]"
                      placeholder="Observações complementares importantes..."
                    />
                  </div>
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className="flex items-center justify-end gap-3.5 pt-4 border-t border-gray-150">
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className={`py-2 px-5 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer ${formType === 'PF' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                >
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LIST / WORKSPACE SECTION */}
        <div className="bg-white border border-gray-150 rounded-[2rem] p-6 shadow-3xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Painel de Leads Cadastrados</h2>
              <p className="text-[11px] text-gray-400 font-bold mt-0.5">Gerenciamento comercial em tempo real</p>
            </div>

            {/* FILTERS */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={13} />
                <input 
                  type="text" 
                  placeholder="Pesquisar leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8.5 pr-4 py-1.5 focus:bg-white bg-slate-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500 w-44 focus:w-60 transition-all font-sans"
                />
              </div>

              <select 
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-gray-200 rounded-xl text-[10.5px] font-bold text-gray-600 focus:outline-none focus:ring-1"
              >
                <option value="All">Todos Tipos</option>
                <option value="PF">Pessoa Física</option>
                <option value="PJ">Pessoa Jurídica</option>
              </select>

              {activeTab === 'ativos' && (
                <select 
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-gray-200 rounded-xl text-[10.5px] font-bold text-gray-600 focus:outline-none focus:ring-1"
                >
                  <option value="All">Todos Status</option>
                  {FUNNEL_STATUSES.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => navigate('/boss/leads/private/dashboard/repositorio-excluidos')}
                className="px-3 py-1.5 bg-rose-50 border border-rose-150 hover:bg-rose-600 hover:text-white text-[10.5px] font-black uppercase text-rose-650 rounded-xl transition duration-150 flex items-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <XOctagon size={11.5} />
                <span>Lixeira ({excludedLeads.length})</span>
              </button>
            </div>
          </div>

          {/* TABS SELECTOR */}
          <div className="flex border-b border-gray-100 pb-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setActiveTab('ativos');
                setSelectedLeadForDetail(null);
              }}
              className={`pb-2 px-4 text-xs font-black uppercase tracking-wider transition-all duration-205 border-b-2 cursor-pointer ${
                activeTab === 'ativos'
                  ? 'border-indigo-650 text-indigo-650'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Leads Ativos ({filteredLeads.length})
            </button>
            <button
              type="button"
              onClick={() => {
                navigate('/boss/leads/private/dashboard/repositorio-excluidos');
              }}
              className={`pb-2 px-4 text-xs font-black uppercase tracking-wider transition-all duration-205 border-b-2 cursor-pointer flex items-center gap-1.5 border-transparent text-gray-400 hover:text-rose-650`}
            >
              <XOctagon size={13} />
              <span>Repositório de Excluídos ({filteredExcludedLeads.length})</span>
            </button>
          </div>

          {/* LEADS LIST / KANBAN COMPATIBLE TABLE */}
          {(activeTab === 'ativos' ? filteredLeads : filteredExcludedLeads).length === 0 ? (
            <div className="p-12 text-center text-gray-400 italic font-medium text-xs border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
              {activeTab === 'ativos' 
                ? 'Nenhum lead encontrado nas condições selecionadas.' 
                : 'O Repositório de Leads excluídos está vazio.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-150 text-[10px] font-black uppercase tracking-wider text-gray-400 h-9 bg-slate-50/50 rounded-lg">
                    <th className="px-3 py-2">Nome / Razão Social</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">E-mail / Telefone</th>
                    <th className="px-3 py-2">Área Jurídica</th>
                    <th className="px-3 py-2">Origem</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[11.5px] font-medium leading-normal">
                  {(activeTab === 'ativos' ? filteredLeads : filteredExcludedLeads).map((lead) => {
                    const isPf = lead.tipoPessoa === 'PF';
                    const name = isPf 
                      ? (lead.pessoaFisica?.nomeCompleto || 'Sem nome')
                      : (lead.pessoaJuridica?.razaoSocial || 'Sem razão social');

                    const contactMail = isPf ? lead.pessoaFisica?.email : lead.pessoaJuridica?.email;
                    const contactPhone = isPf ? lead.pessoaFisica?.whatsapp || lead.pessoaFisica?.telefone : lead.pessoaJuridica?.whatsapp || lead.pessoaJuridica?.telefone;

                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/85 transition duration-150">
                        <td className="px-3 py-2.5 font-bold text-gray-800 break-all select-all">
                          {name}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${isPf ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                            {isPf ? 'PF' : 'PJ'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-sans font-semibold text-gray-600">
                          <div className="block">{contactMail || '—'}</div>
                          <div className="block text-slate-400 font-mono text-[10px]">{contactPhone || '—'}</div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-bold uppercase text-[9.5px]">
                            {lead.areaJuridica}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 font-semibold">
                          {lead.origemLead}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full border text-[9.5px] font-extrabold ${getFunnelBadgeColor(lead.statusFunil)}`}>
                            {lead.statusFunil}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLeadForDetail(lead);
                                setIsEditing(false);
                              }}
                              className="p-1 px-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Visualizar Diagnóstico Detalhado"
                            >
                              <Eye size={12} />
                              <span>Ver</span>
                            </button>

                            {activeTab === 'ativos' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/boss/cadastrar.leads/private/etapa02/${lead.id}`)}
                                  className="p-1 px-2 bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100/70 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Progredir para Etapa 02: Relacionamento"
                                >
                                  <Sparkles size={11} className="text-indigo-650" />
                                  <span>Etapa 02</span>
                                </button>

                                {!lead.convertidoEmCliente && lead.statusFunil !== 'Convertido em Cliente' && (
                                  <button
                                    type="button"
                                    onClick={() => handleConvertLead(lead)}
                                    className="p-1 px-2.5 bg-emerald-50 text-emerald-800 border border-emerald-100 hover:bg-emerald-100 rounded-lg text-[10px] font-black tracking-wide uppercase transition flex items-center gap-0.5 cursor-pointer"
                                    title="Converter em Caso no Fluxo de Produção"
                                  >
                                    <ArrowLeftRight size={12} />
                                    <span>Converter</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (lead.tipoPessoa === 'PF') {
                                      navigate(`/boss/cadastrar.leads/private/lead-pf?edit=${lead.id}`);
                                    } else {
                                      navigate(`/boss/cadastrar.leads/private/lead-pj?edit=${lead.id}`);
                                    }
                                  }}
                                  className="p-1 text-slate-500 hover:text-indigo-650 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title="Editar Cadastro do Cliente (Etapa 01)"
                                >
                                  <Edit size={13} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteLead(lead.id)}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Excluir"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRestoreLead(lead.id)}
                                  className="p-1 px-2.5 bg-indigo-50 text-indigo-850 border border-indigo-100 hover:bg-indigo-100 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Restaurar Lead para Ativo"
                                >
                                  <RotateCcw size={12} className="text-indigo-700 animate-spin" style={{ animationIterationCount: 1, animationDuration: '0.8s' }} />
                                  <span>Restaurar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (lead.tipoPessoa === 'PF') {
                                      navigate(`/boss/cadastrar.leads/private/lead-pf?edit=${lead.id}`);
                                    } else {
                                      navigate(`/boss/cadastrar.leads/private/lead-pj?edit=${lead.id}`);
                                    }
                                  }}
                                  className="p-1 text-slate-500 hover:text-indigo-650 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title="Editar Cadastro do Cliente (Etapa 01)"
                                >
                                  <Edit size={13} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteLead(lead.id)}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Excluir Permanentemente"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* NEW CARD: ANÁLISE DE VIABILIDADE */}
        <div className="bg-white border border-gray-150 rounded-[2rem] p-6 shadow-3xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-650 flex items-center justify-center shrink-0">
                  <FileCheck size={18} />
                </span>
                Análise de Viabilidade
              </h2>
              <p className="text-[11px] text-gray-400 font-bold mt-0.5">Diagnósticos jurídicos, viabilidade técnica e probabilidade de êxito dos leads</p>
            </div>
          </div>

          {/* Viability statistics counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-700">Viabilidade Alta</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-emerald-800">
                  {leads.filter(l => l.analiseViabilidade?.viabilidadeTecnica === 'Alta').length}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">leads</span>
              </div>
            </div>

            <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-700">Viabilidade Média</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-amber-800">
                  {leads.filter(l => l.analiseViabilidade?.viabilidadeTecnica === 'Média').length}
                </span>
                <span className="text-[10px] text-amber-600 font-bold">leads</span>
              </div>
            </div>

            <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-rose-750">Viabilidade Baixa</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-rose-800">
                  {leads.filter(l => l.analiseViabilidade?.viabilidadeTecnica === 'Baixa').length}
                </span>
                <span className="text-[10px] text-rose-600 font-bold">leads</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-500">Viabilidade Pendente</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-gray-700">
                  {leads.filter(l => !l.analiseViabilidade).length}
                </span>
                <span className="text-[10px] text-gray-500 font-bold font-mono">não realizada</span>
              </div>
            </div>
          </div>

          {/* List of Leads with viability details or options */}
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-150 text-[10px] font-black uppercase tracking-wider text-gray-400 h-9 bg-slate-50/50 rounded-lg">
                  <th className="px-3 py-2">Lead</th>
                  <th className="px-3 py-2">Classificação</th>
                  <th className="px-3 py-2">Probabilidade Êxito</th>
                  <th className="px-3 py-2">Parecer Técnico</th>
                  <th className="px-3 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[11.5px] font-medium leading-normal">
                {leads.slice(0, 10).map((lead) => {
                  const isPf = lead.tipoPessoa === 'PF';
                  const name = isPf 
                    ? (lead.pessoaFisica?.nomeCompleto || 'Sem nome')
                    : (lead.pessoaJuridica?.razaoSocial || 'Sem razão social');

                  const viability = lead.analiseViabilidade?.viabilidadeTecnica;
                  const prob = lead.analiseViabilidade?.probabilidadeExito || '—';
                  const parecer = lead.analiseViabilidade?.parecerViabilidade || 'Nenhum parecer técnico registrado ainda.';

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/60 transition duration-150">
                      <td className="px-3 py-2.5 font-bold text-gray-800">
                        <div className="flex flex-col">
                          <span>{name}</span>
                          <span className="text-[9.5px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                            {isPf ? 'Pessoa Física' : 'Pessoa Jurídica'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {viability === 'Alta' ? (
                          <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-250">
                            Alta
                          </span>
                        ) : viability === 'Média' ? (
                          <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-250">
                            Média
                          </span>
                        ) : viability === 'Baixa' ? (
                          <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-rose-50 text-rose-750 border border-rose-250">
                            Baixa
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-slate-50 text-gray-500 border border-slate-200">
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-gray-700">
                        {prob}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 max-w-xs truncate" title={parecer}>
                        {parecer}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLeadForDetail(lead);
                              setIsEditing(false);
                            }}
                            className="p-1 px-2.5 bg-slate-50 border border-gray-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-650 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye size={12} />
                            Ficha
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/boss/cadastrar.leads/private/etapa02/${lead.id}/viabilidade`)}
                            className="p-1 px-2.5 bg-indigo-50 border border-indigo-150 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <FileText size={12} />
                            Analisar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                      Nenhum lead disponível para análise de viabilidade.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DETAILS / QUICK DIAGNOSTIC VIEW AND EDIT SLIDE-OVER OR MODAL PANEL */}
        {selectedLeadForDetail && (
          <div className="bg-slate-50 border border-gray-200 rounded-[2rem] p-6 shadow-xs animate-fade-in relative">
            <button 
              onClick={() => setSelectedLeadForDetail(null)}
              className="absolute right-4 top-4 p-1.5 bg-white border rounded-full text-gray-400 hover:text-gray-600 shadow-4xs transition"
            >
              <X size={15} />
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4 mb-5">
              <div>
                <span className="text-[9.5px] uppercase tracking-widest font-extrabold text-indigo-650 font-mono">Ficha de Diagnóstico Qualificado</span>
                <h3 className="text-xl font-black text-gray-900 mt-1 uppercase">
                  {selectedLeadForDetail.tipoPessoa === 'PF' 
                    ? selectedLeadForDetail.pessoaFisica?.nomeCompleto 
                    : selectedLeadForDetail.pessoaJuridica?.razaoSocial}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="px-3.5 py-1.5 bg-white border text-gray-700 rounded-lg text-xs font-bold shadow-4xs hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit size={13} />
                    <span>Editar Ficha</span>
                  </button>
                ) : (
                  <button 
                    onClick={handleSaveEdit}
                    className="px-3.5 py-1.5 bg-indigo-650 text-white rounded-lg text-xs font-bold shadow-4xs hover:bg-indigo-700 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save size={13} />
                    <span>Salvar</span>
                  </button>
                )}
                {!selectedLeadForDetail.convertidoEmCliente && (
                  <>
                    <button 
                      onClick={() => navigate(`/boss/cadastrar.leads/private/etapa02/${selectedLeadForDetail.id}`)}
                      className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-4xs hover:bg-indigo-700 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles size={13} />
                      <span>Acessar Etapa 02 (Relacionamento)</span>
                    </button>
                    <button 
                      onClick={() => handleConvertLead(selectedLeadForDetail)}
                      className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-4xs hover:bg-emerald-700 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeftRight size={13} />
                      <span>Converter em Cliente</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* CONTENT PANELS OR EDIT INPUTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* CONTACT DETAILS & ADDRESS */}
              <div className="bg-white border rounded-2xl p-5 space-y-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b pb-1.5 block">
                  Informações Físicas / Sociais
                </span>

                {selectedLeadForDetail.tipoPessoa === 'PF' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 leading-tight text-xs">
                    <div className="sm:col-span-2">
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Nome Completo</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaFisica.nomeCompleto}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaFisica: { ...selectedLeadForDetail.pessoaFisica, nomeCompleto: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-bold text-gray-800 break-all select-all">{selectedLeadForDetail.pessoaFisica?.nomeCompleto || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">CPF</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaFisica.cpf}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaFisica: { ...selectedLeadForDetail.pessoaFisica, cpf: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-800 font-mono select-all">{selectedLeadForDetail.pessoaFisica?.cpf || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">RG</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaFisica.rg}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaFisica: { ...selectedLeadForDetail.pessoaFisica, rg: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-800 select-all">{selectedLeadForDetail.pessoaFisica?.rg || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Estado Civil</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaFisica.estadoCivil}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaFisica: { ...selectedLeadForDetail.pessoaFisica, estadoCivil: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-805">{selectedLeadForDetail.pessoaFisica?.estadoCivil || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Profissão</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaFisica.profissao}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaFisica: { ...selectedLeadForDetail.pessoaFisica, profissao: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-800 uppercase block truncate">{selectedLeadForDetail.pessoaFisica?.profissao || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Celular / WhatsApp</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaFisica.whatsapp}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaFisica: { ...selectedLeadForDetail.pessoaFisica, whatsapp: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-bold text-gray-800 font-mono select-all">{selectedLeadForDetail.pessoaFisica?.whatsapp || selectedLeadForDetail.pessoaFisica?.telefone || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">E-mail</span>
                      {isEditing ? (
                        <input 
                          type="email" 
                          value={selectedLeadForDetail.pessoaFisica.email}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaFisica: { ...selectedLeadForDetail.pessoaFisica, email: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-700 break-all select-all">{selectedLeadForDetail.pessoaFisica?.email || '—'}</span>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Endereço Completo</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaFisica.endereco}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaFisica: { ...selectedLeadForDetail.pessoaFisica, endereco: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-800 uppercase break-all">{selectedLeadForDetail.pessoaFisica?.endereco || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Cidade</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaFisica.cidade}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaFisica: { ...selectedLeadForDetail.pessoaFisica, cidade: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-750 uppercase">{selectedLeadForDetail.pessoaFisica?.cidade || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Estado / UF</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaFisica.uf}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaFisica: { ...selectedLeadForDetail.pessoaFisica, uf: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold font-mono"
                        />
                      ) : (
                        <span className="font-bold text-gray-800 font-mono uppercase">{selectedLeadForDetail.pessoaFisica?.uf || '—'}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 leading-tight text-xs">
                    <div className="sm:col-span-2">
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Razão Social</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaJuridica.razaoSocial}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaJuridica: { ...selectedLeadForDetail.pessoaJuridica, razaoSocial: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-bold text-gray-800 break-all select-all">{selectedLeadForDetail.pessoaJuridica?.razaoSocial || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">CNPJ</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaJuridica.cnpj}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaJuridica: { ...selectedLeadForDetail.pessoaJuridica, cnpj: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold font-mono"
                        />
                      ) : (
                        <span className="font-semibold text-gray-800 font-mono select-all">{selectedLeadForDetail.pessoaJuridica?.cnpj || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Nome Fantasia</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaJuridica.nomeFantasia}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaJuridica: { ...selectedLeadForDetail.pessoaJuridica, nomeFantasia: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-800">{selectedLeadForDetail.pessoaJuridica?.nomeFantasia || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Sócio/Representador Legal</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaJuridica.representanteLegal}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaJuridica: { ...selectedLeadForDetail.pessoaJuridica, representanteLegal: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-800 uppercase block truncate">{selectedLeadForDetail.pessoaJuridica?.representanteLegal || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Cargo Representante</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaJuridica.cargoRepresentante}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaJuridica: { ...selectedLeadForDetail.pessoaJuridica, cargoRepresentante: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-700 block truncate">{selectedLeadForDetail.pessoaJuridica?.cargoRepresentante || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Celular / WhatsApp</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaJuridica.whatsapp}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaJuridica: { ...selectedLeadForDetail.pessoaJuridica, whatsapp: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold font-mono"
                        />
                      ) : (
                        <span className="font-bold text-gray-800 font-mono select-all">{selectedLeadForDetail.pessoaJuridica?.whatsapp || selectedLeadForDetail.pessoaJuridica?.telefone || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">E-mail Comercial</span>
                      {isEditing ? (
                        <input 
                          type="email" 
                          value={selectedLeadForDetail.pessoaJuridica.email}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaJuridica: { ...selectedLeadForDetail.pessoaJuridica, email: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-700 break-all select-all">{selectedLeadForDetail.pessoaJuridica?.email || '—'}</span>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Sede da Empresa</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaJuridica.endereco}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaJuridica: { ...selectedLeadForDetail.pessoaJuridica, endereco: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-800 uppercase break-all">{selectedLeadForDetail.pessoaJuridica?.endereco || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Cidade</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaJuridica.cidade}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaJuridica: { ...selectedLeadForDetail.pessoaJuridica, cidade: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-gray-750 uppercase">{selectedLeadForDetail.pessoaJuridica?.cidade || '—'}</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Estado / UF</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={selectedLeadForDetail.pessoaJuridica.uf}
                          onChange={(e) => setSelectedLeadForDetail({
                            ...selectedLeadForDetail,
                            pessoaJuridica: { ...selectedLeadForDetail.pessoaJuridica, uf: e.target.value }
                          })}
                          className="w-full p-2 border rounded-lg font-semibold font-mono"
                        />
                      ) : (
                        <span className="font-bold text-gray-805 font-mono uppercase">{selectedLeadForDetail.pessoaJuridica?.uf || '—'}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* DEMAND & FUNNEL QUALIFICATION */}
              <div className="bg-white border rounded-2xl p-5 space-y-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b pb-1.5 block">
                  Diagnóstico da Demanda & Negociação
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Origem do Lead</span>
                    {isEditing ? (
                      <select 
                        value={selectedLeadForDetail.origemLead}
                        onChange={(e) => setSelectedLeadForDetail({ ...selectedLeadForDetail, origemLead: e.target.value })}
                        className="w-full p-2 border rounded-lg font-semibold"
                      >
                        <option>WhatsApp</option>
                        <option>Campanha Google Ads</option>
                        <option>Campanha Meta (Instagram/FB)</option>
                        <option>Redes Sociais (Orgânico)</option>
                        <option>TikTok Ads</option>
                        <option>Indicação de Parceiro</option>
                        <option>Indicação de Cliente</option>
                        <option>Atendimento Presencial Direto</option>
                      </select>
                    ) : (
                      <span className="font-semibold text-gray-750 block">{selectedLeadForDetail.origemLead || '—'}</span>
                    )}
                  </div>

                  <div>
                    <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Área de Interesse</span>
                    {isEditing ? (
                      <select 
                        value={selectedLeadForDetail.areaJuridica}
                        onChange={(e) => setSelectedLeadForDetail({ ...selectedLeadForDetail, areaJuridica: e.target.value })}
                        className="w-full p-2 border rounded-lg font-semibold"
                      >
                        <option>Trabalhista</option>
                        <option>Previdenciário (INSS)</option>
                        <option>Bancário / Revisional</option>
                        <option>Família e Sucessões</option>
                        <option>Cível Geral</option>
                        <option>Consumidor</option>
                        <option>Empresarial / Societário</option>
                        <option>Tributário</option>
                        <option>Penal / Criminal</option>
                      </select>
                    ) : (
                      <span className="bg-slate-100/80 text-slate-700 px-2 py-0.5 rounded font-extrabold uppercase text-[9.5px] inline-block">{selectedLeadForDetail.areaJuridica || '—'}</span>
                    )}
                  </div>

                  <div>
                    <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Dono / Responsável</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={selectedLeadForDetail.responsavelInterno}
                        onChange={(e) => setSelectedLeadForDetail({ ...selectedLeadForDetail, responsavelInterno: e.target.value })}
                        className="w-full p-2 border rounded-lg font-semibold"
                      />
                    ) : (
                      <span className="font-semibold text-gray-750 block">{selectedLeadForDetail.responsavelInterno || '—'}</span>
                    )}
                  </div>

                  <div>
                    <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Status Funil</span>
                    {isEditing ? (
                      <select 
                        value={selectedLeadForDetail.statusFunil}
                        onChange={(e) => setSelectedLeadForDetail({ ...selectedLeadForDetail, statusFunil: e.target.value })}
                        className="w-full p-2 border rounded-lg font-semibold"
                      >
                        {FUNNEL_STATUSES.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border inline-block ${getFunnelBadgeColor(selectedLeadForDetail.statusFunil)}`}>
                        {selectedLeadForDetail.statusFunil}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Valor Estimado</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={selectedLeadForDetail.valorPotencial}
                        onChange={(e) => setSelectedLeadForDetail({ ...selectedLeadForDetail, valorPotencial: e.target.value })}
                        className="w-full p-2 border rounded-lg font-semibold font-mono"
                      />
                    ) : (
                      <span className="font-bold text-slate-900 font-mono block">
                        R$ {parseFloat(String(selectedLeadForDetail.valorPotencial || 0).replace(/[^\d.]/g, '')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Existe Prazo Fatal?</span>
                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input 
                          type="checkbox" 
                          checked={selectedLeadForDetail.existePrazo}
                          onChange={(e) => setSelectedLeadForDetail({ ...selectedLeadForDetail, existePrazo: e.target.checked })}
                          className="rounded accent-indigo-650"
                        />
                        {selectedLeadForDetail.existePrazo && (
                          <input 
                            type="date" 
                            value={selectedLeadForDetail.dataPrazo}
                            onChange={(e) => setSelectedLeadForDetail({ ...selectedLeadForDetail, dataPrazo: e.target.value })}
                            className="p-1 border rounded-lg font-semibold text-xxs w-28"
                          />
                        )}
                      </div>
                    ) : (
                      <span className={`font-semibold ${selectedLeadForDetail.existePrazo ? 'text-rose-600 font-extrabold' : 'text-gray-500'}`}>
                        {selectedLeadForDetail.existePrazo ? `Sim (Prazo: ${selectedLeadForDetail.dataPrazo ? new Date(selectedLeadForDetail.dataPrazo).toLocaleDateString('pt-BR') : '—'})` : 'Não'}
                      </span>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Assunto Comercial do Caso</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={selectedLeadForDetail.assunto}
                        onChange={(e) => setSelectedLeadForDetail({ ...selectedLeadForDetail, assunto: e.target.value })}
                        className="w-full p-2 border rounded-lg font-semibold text-xs"
                      />
                    ) : (
                      <span className="font-bold text-gray-800 block break-words">{selectedLeadForDetail.assunto || '—'}</span>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Dor Principal do Interessado</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={selectedLeadForDetail.dorPrincipal}
                        onChange={(e) => setSelectedLeadForDetail({ ...selectedLeadForDetail, dorPrincipal: e.target.value })}
                        className="w-full p-2 border rounded-lg font-semibold text-xs"
                      />
                    ) : (
                      <span className="font-semibold text-gray-700 block break-words">{selectedLeadForDetail.dorPrincipal || '—'}</span>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Próximo Passo / Ação Comercial</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={selectedLeadForDetail.proximoPasso}
                        onChange={(e) => setSelectedLeadForDetail({ ...selectedLeadForDetail, proximoPasso: e.target.value })}
                        className="w-full p-2 border rounded-lg font-semibold text-xs"
                      />
                    ) : (
                      <span className="font-extrabold text-blue-950 block">{selectedLeadForDetail.proximoPasso || '—'}</span>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <span className="block text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Observações Adicionais</span>
                    {isEditing ? (
                      <textarea 
                        value={selectedLeadForDetail.observacoes}
                        onChange={(e) => setSelectedLeadForDetail({ ...selectedLeadForDetail, observacoes: e.target.value })}
                        className="w-full p-2 border rounded-lg font-semibold text-xs min-h-[60px]"
                      />
                    ) : (
                      <span className="font-medium text-gray-500 block break-words bg-slate-50 p-3.5 rounded-xl border border-gray-100">{selectedLeadForDetail.observacoes || '—'}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EXCLUSION CONFIRMATION MODAL */}
        {leadIdToDelete && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in animate-duration-200" id="delete-lead-modal">
            <div className="bg-white rounded-[2rem] border-2 border-rose-100 p-6 max-w-sm w-full shadow-2xl space-y-5 animate-scale-in">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-150 text-rose-650 flex items-center justify-center shrink-0">
                  <AlertCircle size={22} className="text-rose-600 animate-pulse" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Excluir Lead definitvo</h3>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-extrabold">Aviso de Segurança</span>
                </div>
              </div>

              <div className="space-y-3 font-semibold text-xxs leading-relaxed text-gray-700">
                <p className="bg-rose-550/10 border border-rose-100 p-3.5 rounded-2xl text-rose-900 font-black text-center text-xs">
                  “Deseja Excluir definitivamente o LEAD do sistema”
                </p>
                <p className="text-gray-500 font-medium">
                  Esta exclusão excluirá o LEAD apenas da Firestore do Portal BOSS. Caso clique em <strong className="text-rose-600">Confirmo</strong> abaixo, aquele LEAD será de imediato e definitivamente excluído.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setLeadIdToDelete(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-gray-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteLead}
                  className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-4xs shadow-rose-250 transition-colors cursor-pointer text-center font-bold"
                >
                  Confirmo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </BossLayout>
  );
}
