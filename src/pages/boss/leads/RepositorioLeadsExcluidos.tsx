import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BossLayout } from '../../../components/Layout';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  ArrowLeft, 
  Trash2, 
  RotateCcw, 
  Search, 
  AlertCircle, 
  CheckCircle,
  Building2,
  User,
  Clock,
  Calendar,
  X,
  Mail,
  Phone
} from 'lucide-react';

export default function RepositorioLeadsExcluidos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [excludedLeads, setExcludedLeads] = useState<any[]>([]);
  const [leadToConfirmDelete, setLeadToConfirmDelete] = useState<any | null>(null);

  // Load excluded leads from Firestore
  const loadDeletedLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      let delList: any[] = [];
      try {
        const q = query(collection(db, 'marketingLeadsDeleted'));
        const snapDel = await getDocs(q);
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
      setError('Erro ao carregar dados do repositório de excluídos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeletedLeads();
  }, []);

  // Restore lead (Move back to marketingLeads)
  const handleRestoreLead = async (lead: any) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // 1. Reconstruct clean payload to save in active leads
      const restoredPayload = {
        ...lead,
        updatedAt: new Date().toISOString(),
        restoredAt: new Date().toISOString(),
        funnelStatus: lead.funnelStatus || 'Novo Lead'
      };

      // Remove deletion metadata to keep it clean
      delete restoredPayload.excludedAt;
      delete restoredPayload.excludedBy;
      delete restoredPayload.excluidoMotivo;

      // 2. Save back to original collection
      await setDoc(doc(db, 'marketingLeads', lead.id), restoredPayload);
      
      // 3. Delete from matching deleted collection
      await deleteDoc(doc(db, 'marketingLeadsDeleted', lead.id));

      // 4. Update local backup as well
      const localLeads = localStorage.getItem('local_marketing_leads');
      if (localLeads) {
        const parsed = JSON.parse(localLeads);
        parsed.unshift(restoredPayload);
        localStorage.setItem('local_marketing_leads', JSON.stringify(parsed));
      }

      const localDel = localStorage.getItem('local_deleted_marketing_leads');
      if (localDel) {
        const parsedDel = JSON.parse(localDel);
        const filteredDel = parsedDel.filter((l: any) => l.id !== lead.id);
        localStorage.setItem('local_deleted_marketing_leads', JSON.stringify(filteredDel));
      }

      setSuccess(`Lead "${getLeadName(lead)}" restaurado com sucesso para o painel de ativos!`);
      
      // Reload list
      await loadDeletedLeads();
    } catch (e: any) {
      console.error('Erro ao restaurar:', e);
      setError(`Erro ao restaurar o lead: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  // Permanent Delete trigger
  const triggerPermanentDelete = (lead: any) => {
    setLeadToConfirmDelete(lead);
  };

  // Confirm permanent deletion
  const handlePermanentDelete = async () => {
    if (!leadToConfirmDelete) return;

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Delete from Firestore
      await deleteDoc(doc(db, 'marketingLeadsDeleted', leadToConfirmDelete.id));

      // Update local storage backup
      const localDel = localStorage.getItem('local_deleted_marketing_leads');
      if (localDel) {
        const parsedDel = JSON.parse(localDel);
        const filteredDel = parsedDel.filter((l: any) => l.id !== leadToConfirmDelete.id);
        localStorage.setItem('local_deleted_marketing_leads', JSON.stringify(filteredDel));
      }

      setSuccess(`Lead "${getLeadName(leadToConfirmDelete)}" excluído definitivamente.`);
      setLeadToConfirmDelete(null);
      
      // Reload list
      await loadDeletedLeads();
    } catch (e: any) {
      console.error('Erro ao excluir permanentemente:', e);
      setError(`Erro ao excluir permanentemente: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const getLeadName = (lead: any) => {
    if (!lead) return '—';
    return lead.tipoPessoa === 'PF' 
      ? lead.pessoaFisica?.nomeCompleto 
      : lead.pessoaJuridica?.razaoSocial;
  };

  const getLeadContact = (lead: any) => {
    if (!lead) return { email: '', phone: '' };
    return lead.tipoPessoa === 'PF'
      ? { email: lead.pessoaFisica?.email || '', phone: lead.pessoaFisica?.whatsapp || lead.pessoaFisica?.telefone || '' }
      : { email: lead.pessoaJuridica?.email || '', phone: lead.pessoaJuridica?.whatsapp || lead.pessoaJuridica?.telefone || '' };
  };

  // Filtering based on search query
  const filteredDeletedLeads = excludedLeads.filter(lead => {
    if (!searchTerm) return true;
    const name = getLeadName(lead).toLowerCase();
    const contact = getLeadContact(lead);
    const area = (lead.areaJuridica || '').toLowerCase();
    const email = (contact.email || '').toLowerCase();
    const phone = (contact.phone || '').toLowerCase();
    const query = searchTerm.toLowerCase();

    return name.includes(query) || area.includes(query) || email.includes(query) || phone.includes(query);
  });

  return (
    <BossLayout>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-150 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/boss/leads/private/dashboard')}
              className="p-2 border border-gray-200 hover:border-indigo-300 text-gray-500 hover:text-indigo-600 rounded-xl bg-white shadow-3xs hover:shadow-2xs transition-all cursor-pointer"
              title="Voltar ao Painel"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <span className="text-[10px] font-black uppercase text-indigo-650 tracking-wider font-mono">Gerenciador de Captação</span>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight mt-0.5">Repositório de LEADS Excluídos</h1>
              <p className="text-[11px] text-gray-500 font-bold mt-0.5">Lixeira protegida para restauração ou expurgo definitivo de leads</p>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/boss/leads/private/dashboard')}
            className="px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 bg-white border border-gray-200 hover:border-gray-300 rounded-xl shadow-3xs cursor-pointer transition"
          >
            Voltar ao Dashboard
          </button>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="bg-rose-50 border border-rose-150 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-rose-800 font-semibold">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-emerald-800 font-semibold">{success}</p>
          </div>
        )}

        {/* CONTAINER CARD */}
        <div className="bg-white border border-gray-150 rounded-[2rem] p-6 shadow-3xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Leads no Arquivo Morto</h2>
              <p className="text-[11px] text-gray-400 font-bold mt-0.5">Total de {filteredDeletedLeads.length} leads excluídos temporariamente</p>
            </div>

            {/* SEARCH */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={13} />
              <input 
                type="text" 
                placeholder="Pesquisar excluídos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8.5 pr-4 py-1.5 focus:bg-white bg-slate-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500 w-60 transition-all font-sans"
              />
            </div>
          </div>

          {/* TABLE */}
          {loading ? (
            <div className="p-12 text-center text-gray-400 max-w-md mx-auto space-y-3">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-650 animate-spin mx-auto" />
              <p className="text-xs font-bold font-mono text-gray-500">Acessando banco de dados...</p>
            </div>
          ) : filteredDeletedLeads.length === 0 ? (
            <div className="p-12 text-center text-gray-400 italic font-medium text-xs border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
              O Repositório de Leads excluídos está vazio.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-150 text-[10px] font-black uppercase tracking-wider text-gray-400 h-9 bg-slate-50/50 rounded-lg">
                    <td className="px-3 py-2 font-black">Lead</td>
                    <td className="px-3 py-2 font-black">Tipo</td>
                    <td className="px-3 py-2 font-black">Contato</td>
                    <td className="px-3 py-2 font-black">Área Jurídica</td>
                    <td className="px-3 py-2 font-black">Data Exclusão</td>
                    <td className="px-3 py-2 font-black text-right">Ações</td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[11.5px] font-medium leading-normal">
                  {filteredDeletedLeads.map((lead) => {
                    const isPf = lead.tipoPessoa === 'PF';
                    const name = getLeadName(lead);
                    const contact = getLeadContact(lead);
                    
                    let dateStr = '—';
                    if (lead.excludedAt) {
                      try {
                        dateStr = new Date(lead.excludedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                      } catch {
                        dateStr = lead.excludedAt;
                      }
                    }

                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/85 transition duration-150">
                        <td className="px-3 py-3 font-bold text-gray-800">
                          <div className="flex flex-col">
                            <span>{name}</span>
                            {lead.excluidoMotivo && (
                              <span className="text-[9.5px] text-rose-600 font-bold mt-1 max-w-xs leading-relaxed">
                                Motivo: {lead.excluidoMotivo}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {isPf ? (
                            <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-150">
                              Física (PF)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider bg-purple-50 text-purple-600 border border-purple-150">
                              Jurídica (PJ)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-0.5 text-gray-550">
                            {contact.email && (
                              <span className="flex items-center gap-1">
                                <Mail size={10} className="text-gray-400" />
                                {contact.email}
                              </span>
                            )}
                            {contact.phone && (
                              <span className="flex items-center gap-1 font-mono text-[10.5px]">
                                <Phone size={10} className="text-gray-400" />
                                {contact.phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-bold text-gray-700">
                          {lead.areaJuridica || '—'}
                        </td>
                        <td className="px-3 py-3 text-gray-450 font-bold font-mono">
                          {dateStr}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleRestoreLead(lead)}
                              className="p-1.5 px-3 bg-emerald-50 border border-emerald-250 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                              title="Recuperar de volta ao painel principal"
                            >
                              <RotateCcw size={11} />
                              Recuperar
                            </button>
                            <button
                              type="button"
                              onClick={() => triggerPermanentDelete(lead)}
                              className="p-1.5 bg-rose-50 border border-rose-250 text-rose-600 hover:bg-rose-650 hover:text-white rounded-lg text-[10px] font-medium transition cursor-pointer"
                              title="Excluir Permanentemente"
                            >
                              <Trash2 size={11} />
                            </button>
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

        {/* DEFINITIVE CONFIRMATION MODAL */}
        {leadToConfirmDelete && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in animate-duration-200">
            <div className="bg-white rounded-[2rem] border-2 border-rose-100 p-6 max-w-sm w-full shadow-2xl space-y-5">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-150 text-rose-650 flex items-center justify-center shrink-0">
                  <AlertCircle size={22} className="text-rose-600 animate-pulse" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Excluir Definitivamente</h3>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-extrabold">Remoção Irreversível</span>
                </div>
              </div>

              <div className="space-y-3 font-semibold text-xxs leading-relaxed text-gray-700">
                <p className="bg-rose-550/10 border border-rose-100 p-3.5 rounded-2xl text-rose-900 font-black text-center text-xs">
                  “Deseja expurgar permanentemente o lead {getLeadName(leadToConfirmDelete)}?”
                </p>
                <p className="text-gray-500 font-medium">
                  Esta ação é destrutiva e final. O lead será removido definitivamente de todos os bancos de dados do sistema, impossibilitando qualquer recuperação futura.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setLeadToConfirmDelete(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-gray-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handlePermanentDelete}
                  className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-4xs shadow-rose-250 transition-colors cursor-pointer text-center font-bold"
                >
                  Confirmo Exclusão
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </BossLayout>
  );
}
