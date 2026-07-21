import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BossLayout } from '../../../components/Layout';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  Calendar, 
  Clock, 
  ArrowLeft, 
  Sliders, 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  MessageSquare, 
  CheckSquare, 
  RefreshCw, 
  User, 
  Building2,
  Tag,
  AlertCircle,
  Video,
  MapPin,
  ExternalLink
} from 'lucide-react';

export default function ManagingPrivateLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load marketing leads
      const leadsQuery = query(collection(db, 'marketingLeads'), orderBy('createdAt', 'desc'));
      const leadsSnap = await getDocs(leadsQuery);
      const leadsList = leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeads(leadsList);

      // Try loading meetings
      const meetingsSnap = await getDocs(collection(db, 'leadsMeetings'));
      const meetingsList = meetingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort meetings by date/time (newest first)
      const sortedMeetings = meetingsList.sort((a: any, b: any) => {
        const dateTimeA = new Date(`${a.date || ''}T${a.time || '00:00'}`).getTime();
        const dateTimeB = new Date(`${b.date || ''}T${b.time || '00:00'}`).getTime();
        return dateTimeB - dateTimeA;
      });
      setMeetings(sortedMeetings);

    } catch (e: any) {
      console.error(e);
      setError('Erro ao ler registros. Carregando dados locais do localStorage.');
      
      // Fallback local storage leads
      const localLeads = localStorage.getItem('local_marketing_leads');
      if (localLeads) {
        setLeads(JSON.parse(localLeads));
      }

      // Fallback local storage meetings
      const localMeetings = localStorage.getItem('local_marketing_meetings');
      if (localMeetings) {
        setMeetings(JSON.parse(localMeetings));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const filteredLeads = leads.filter(l => {
    const name = getLeadName(l) || '';
    const contact = getLeadContact(l);
    return (
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.areaJuridica || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <BossLayout>
      <div id="managing-private-leads-dashboard" className="max-w-7xl mx-auto px-4 md:px-0 space-y-8 animate-fade-in pb-12">
        
        {/* HEADER */}
        <div className="border-b border-gray-150 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 border border-indigo-100/65 rounded-xl text-indigo-650 flex items-center justify-center">
                  <Sliders size={16} />
                </span>
                <span className="text-[10px] uppercase font-black tracking-widest text-indigo-650 font-mono">
                  Módulo de Agendamentos
                </span>
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight mt-1">Gestão de Leads Particulares</h1>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Marque, reagende e organize suas reuniões comerciais com os leads através de canais integrados (Gmail, WhatsApp, Todoist).
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => navigate('/boss/leads/private/dashboard')}
              className="text-xs font-bold text-gray-650 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-4xs transition hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
            >
              <ArrowLeft size={14} />
              <span>Voltar ao Dashboard de Leads</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-150 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-amber-800 font-semibold">{error}</p>
          </div>
        )}

        {/* PRIMARY ACTION CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CARD 1: MARCAR REUNIAO */}
          <div 
            onClick={() => navigate('/boss/leads/private/dashboard/managing.private.leads/marcar.meet')}
            className="cursor-pointer bg-white border-2 border-indigo-100 hover:border-indigo-300 rounded-[2rem] p-6 shadow-3xs hover:shadow-2xs transition-all duration-300 flex flex-col justify-between gap-6 group"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition border bg-indigo-50 border-indigo-105 text-indigo-650 group-hover:bg-indigo-100">
                <Calendar size={22} className="text-indigo-600 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">
                  Marcar Reunião Comercial
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed mt-1 font-semibold">
                  Agende uma nova reunião para um cliente em potencial particular. Integre avisos por e-mail (Gmail), WhatsApp ou solicite tarefas para a secretaria via Todoist.
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/boss/leads/private/dashboard/managing.private.leads/marcar.meet');
              }}
              className="py-2.5 px-4 w-full rounded-xl font-black text-xs uppercase tracking-wider text-center flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-4xs cursor-pointer transition-colors"
            >
              <span>Marcar Nova Reunião</span>
              <Plus size={14} />
            </button>
          </div>

          {/* CARD 2: REAGENDAR REUNIAO */}
          <div 
            onClick={() => navigate('/boss/leads/private/dashboard/managing.private.leads/remarcar.meet')}
            className="cursor-pointer bg-white border-2 border-slate-100 hover:border-slate-300 rounded-[2rem] p-6 shadow-3xs hover:shadow-2xs transition-all duration-300 flex flex-col justify-between gap-6 group"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition border bg-slate-50 border-slate-150 text-slate-600 group-hover:bg-slate-100">
                <RefreshCw size={22} className="text-slate-600 group-hover:rotate-45 transition-transform duration-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">
                  Reagendar Reunião de Lead
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed mt-1 font-semibold">
                  Altere a data, o horário ou o canal de uma reunião anteriormente agendada. Dispare um novo cronograma formatado e notificação de alteração via canais integrados.
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/boss/leads/private/dashboard/managing.private.leads/remarcar.meet');
              }}
              className="py-2.5 px-4 w-full rounded-xl font-black text-xs uppercase tracking-wider text-center flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white shadow-4xs cursor-pointer transition-colors"
            >
              <span>Reagendar Reunião</span>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* ACTIVE MEETINGS AND HISTORY */}
        {meetings.length > 0 && (
          <div className="bg-slate-50/50 border border-gray-150 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
              <Clock size={16} className="text-indigo-600" />
              <span>Cronograma de Reuniões Cadastradas</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {meetings.slice(0, 6).map((meet: any) => (
                <div key={meet.id} className="bg-white border border-gray-150 rounded-2xl p-4 shadow-[0_1px_3px_rgb(0,0,0,0.02)] hover:shadow-xs transition space-y-3">
                  <div className="flex justify-between items-start gap-2 border-b border-gray-100 pb-2">
                    <div>
                      <span className={`px-2 py-0.5 text-[8.5px] font-extrabold uppercase rounded-full inline-block ${
                        meet.urgency === 'Urgentíssima' || meet.urgency === 'Alta'
                          ? 'bg-rose-550/10 text-rose-750 border border-rose-150'
                          : 'bg-indigo-50 text-indigo-750 border border-indigo-150'
                      }`}>
                        {meet.urgency || 'Baixa'}
                      </span>
                      <h4 className="font-bold text-xs text-gray-950 mt-1 line-clamp-1">{meet.subject}</h4>
                    </div>
                    <span className="font-mono text-[10px] text-gray-400 font-bold whitespace-nowrap">
                      {meet.date ? new Date(meet.date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </span>
                  </div>

                  <div className="text-xxs space-y-1 text-gray-600">
                    <p className="flex items-center gap-1.5">
                      <User size={10} className="text-gray-400" />
                      <span className="font-semibold text-gray-750">Nome do Lead: <strong>{meet.leadName}</strong></span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Clock size={10} className="text-gray-400" />
                      <span>Horário: <strong>{meet.time || '—'}</strong></span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      {meet.locationType === 'físico' ? <MapPin size={10} className="text-gray-400" /> : <Video size={10} className="text-gray-400" />}
                      <span>Local/Aplicativo: <strong className="uppercase">{meet.locationType === 'físico' ? meet.location : meet.appType || 'Online'}</strong></span>
                    </p>
                    {meet.method && (
                      <p className="flex items-center gap-1.5 text-indigo-600 font-bold mt-1.5 pt-1.5 border-t border-slate-50">
                        <Tag size={10} />
                        <span>Canal de Agendamento: <span className="uppercase">{meet.method}</span></span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEADS LIST FOR QUICK SCHEDULING */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Lista de Leads para Operação</h3>
              <p className="text-[11px] text-gray-400 font-semibold">Busque interessados cadastrados e inicie agendamentos diretamente.</p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-450 pointer-events-none" size={14} />
              <input
                type="text"
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-gray-400 select-none">
              Carregando leads cadastrados...
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-12 border border-dashed rounded-2xl text-center text-xs font-bold text-gray-400">
              Nenhum lead encontrado para busca ou cadastrado.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-150 rounded-2xl">
              <table className="w-full text-left text-xs text-gray-650 min-w-[700px]">
                <thead className="bg-slate-50/70 border-b border-gray-150 text-[10px] text-gray-450 uppercase font-black tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Lead</th>
                    <th className="px-4 py-4">Tipo</th>
                    <th className="px-4 py-4">Área Jurídica</th>
                    <th className="px-4 py-4">Contatos</th>
                    <th className="px-4 py-4">Status Funil</th>
                    <th className="px-5 py-4 text-right">Ação Comercial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 font-semibold text-gray-700">
                  {filteredLeads.map((l: any) => {
                    const name = getLeadName(l);
                    const isPF = l.tipoPessoa === 'PF';
                    const contacts = getLeadContact(l);
                    return (
                      <tr key={l.id} className="hover:bg-slate-50/40 transition">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                              isPF ? 'bg-blue-50 border-blue-100 text-blue-650' : 'bg-purple-50 border-purple-100 text-purple-650'
                            }`}>
                              {isPF ? <User size={14} /> : <Building2 size={14} />}
                            </div>
                            <div>
                              <span className="font-extrabold text-gray-900 block leading-tight">{name}</span>
                              <span className="text-[10px] text-gray-400 font-mono italic">ID: {l.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase inline-block ${
                            isPF ? 'bg-blue-50 text-blue-800' : 'bg-purple-50 text-purple-800'
                          }`}>
                            {l.tipoPessoa}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="bg-slate-100 hover:bg-slate-150 text-slate-700 px-2 py-0.5 rounded text-[9.5px] font-bold uppercase transition">
                            {l.areaJuridica || 'Família'}
                          </span>
                        </td>
                        <td className="px-4 py-4 space-y-0.5">
                          <span className="block text-slate-800 font-bold font-mono">{contacts.phone || '—'}</span>
                          <span className="block text-gray-400 text-[10.5px] lowercase truncate max-w-[180px]">{contacts.email || '—'}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="bg-amber-50 text-amber-850 px-2 py-0.5 rounded-full text-[9px] border border-amber-200/50">
                            {l.statusFunil || 'Novo Lead'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => navigate(`/boss/leads/private/dashboard/managing.private.leads/marcar.meet?leadId=${l.id}`)}
                            className="text-[10px] uppercase font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 px-2.5 py-1.5 rounded-lg shadow-4xs transition cursor-pointer inline-flex items-center gap-1"
                          >
                            <Calendar size={10} />
                            <span>Agendar</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => navigate(`/boss/leads/private/dashboard/managing.private.leads/remarcar.meet?leadId=${l.id}`)}
                            className="text-[10px] uppercase font-extrabold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-4xs transition cursor-pointer inline-flex items-center gap-1"
                          >
                            <RefreshCw size={10} />
                            <span>Remarcar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </BossLayout>
  );
}
