import React, { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { BossLayout } from '../../../components/Layout';
import { 
  HeartHandshake, 
  Cake, 
  Gift, 
  Search, 
  Calendar, 
  Briefcase, 
  User, 
  ArrowLeft,
  ChevronRight,
  Send,
  Sparkles,
  Award
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CrmDashboard() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Month selector (1-indexed: 1 = Janeiro, etc.)
  const currentMonthIdx = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIdx);

  const MONTHS_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  useEffect(() => {
    async function fetchClients() {
      try {
        setLoading(true);
        const snap = await getDocs(collection(db, 'clients'));
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setClients(list);
      } catch (err) {
        console.error('Error fetching clients for CRM:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  // Helpers to fetch clean properties
  const getClientName = (c: any) => {
    if (!c) return '—';
    if (c.type === 'PF') {
      const pf = c.pfData || c.pfDadosPessoais || {};
      return pf.pf_nomeCompleto || c.name || 'Pessoa Física Sem Nome';
    } else {
      const pj = c.pjData || c.pjDadosEmpresa || {};
      return pj.pj_razaoSocial || c.name || 'Pessoa Jurídica Sem Razão Social';
    }
  };

  const getClientNascimento = (c: any): string => {
    const pf = c.pfData || c.pfDadosPessoais || {};
    return pf.pf_dataNascimento || pf.dataNascimento || '';
  };

  const getClientProfession = (c: any): string => {
    const pf = c.pfData || c.pfDadosPessoais || {};
    return pf.pf_profissao || pf.profissao || '';
  };

  // Helper to extract month index from birthdate string e.g., "1985-06-15" or "15/06/1985"
  const getMonthFromBirthdate = (dateStr: string): number | null => {
    if (!dateStr) return null;
    const clean = dateStr.trim();
    if (clean.includes('-')) {
      // YYYY-MM-DD
      const parts = clean.split('-');
      if (parts.length >= 2) {
        const m = parseInt(parts[1], 10);
        if (!isNaN(m)) return m;
      }
    } else if (clean.includes('/')) {
      // DD/MM/YYYY
      const parts = clean.split('/');
      if (parts.length >= 2) {
        const m = parseInt(parts[1], 10);
        if (!isNaN(m)) return m;
      }
    }
    return null;
  };

  // Extract day from birthdate string
  const getDayFromBirthdate = (dateStr: string): string => {
    if (!dateStr) return '';
    const clean = dateStr.trim();
    if (clean.includes('-')) {
      const parts = clean.split('-');
      return parts[2] ? parts[2] : '';
    } else if (clean.includes('/')) {
      return clean.split('/')[0] || '';
    }
    return '';
  };

  // Filter clients for birthdays this month
  const birthdayClients = clients.filter(c => {
    if (c.type !== 'PF') return false;
    const dob = getClientNascimento(c);
    const m = getMonthFromBirthdate(dob);
    return m === selectedMonth;
  });

  // Sort birthday clients by day
  const sortedBirthdayClients = [...birthdayClients].sort((a, b) => {
    const dayA = parseInt(getDayFromBirthdate(getClientNascimento(a)), 10) || 0;
    const dayB = parseInt(getDayFromBirthdate(getClientNascimento(b)), 10) || 0;
    return dayA - dayB;
  });

  // Calculate profession breakdowns
  const professionsBreakdown: Record<string, { count: number; clients: any[] }> = {};
  clients.forEach(c => {
    if (c.type === 'PF') {
      const prof = getClientProfession(c).trim();
      const key = prof ? prof.toUpperCase() : 'NÃO INFORMADA';
      if (!professionsBreakdown[key]) {
        professionsBreakdown[key] = { count: 0, clients: [] };
      }
      professionsBreakdown[key].count += 1;
      professionsBreakdown[key].clients.push(c);
    }
  });

  const sortedProfessions = Object.entries(professionsBreakdown)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);

  // Filter sorted professions by search term
  const filteredProfessions = sortedProfessions.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.clients.some(c => getClientName(c).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <BossLayout>
      <div className="flex flex-col gap-6 font-sans text-left">
        {/* Header and Back navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              onClick={() => navigate('/boss-giffoni-clientes/setores')}
              className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-[#5850ec] hover:text-[#4338ca] transition cursor-pointer mb-2"
            >
              <ArrowLeft size={12} />
              Voltar aos setores
            </button>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <HeartHandshake size={22} />
              </span>
              CRM — Giffoni Advogados Associados
            </h1>
            <p className="text-gray-500 text-sm">
              Compilado estratégico e relacionamento fático de aniversariantes e profissões de nossos clientes.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20 text-gray-400">
            <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <span className="text-xs font-black uppercase tracking-widest">Sincronizando banco CRM...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: BIRTHDAYS COMPILATION (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-xs space-y-6">
                
                {/* Birthday Header and Month Select */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                      <Cake size={18} />
                    </span>
                    <div>
                      <h2 className="text-base font-extrabold text-gray-900">Aniversariantes do Mês</h2>
                      <p className="text-[11px] text-gray-400 font-medium">Controle cronológico de datas festivas</p>
                    </div>
                  </div>

                  {/* Month Selector dropdown */}
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="text-xs font-black bg-slate-50 border border-gray-200 px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {MONTHS_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        Mês: {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Celebrants Grid */}
                {sortedBirthdayClients.length === 0 ? (
                  <div className="text-center py-12 text-gray-450 space-y-2">
                    <span className="text-2xl block">🎂</span>
                    <p className="font-extrabold text-xs uppercase tracking-wider">Nenhum aniversariante cadastrado em {MONTHS_NAMES[selectedMonth - 1]}</p>
                    <p className="text-xxs text-gray-400 font-medium max-w-sm mx-auto">Consulte outros meses no seletor ou certifique-se de preencher a data de nascimento nas fichas cadastrais.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedBirthdayClients.map((client) => {
                      const dobString = getClientNascimento(client);
                      const dayVal = getDayFromBirthdate(dobString);
                      return (
                        <div
                          key={client.id}
                          className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 border border-gray-150 rounded-2xl transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Calendar Day Badge */}
                            <div className="w-11 h-11 bg-orange-50 text-orange-700 border border-orange-100 rounded-xl flex flex-col items-center justify-center shrink-0 font-mono">
                              <span className="text-[10px] font-black uppercase leading-tight">Dia</span>
                              <span className="text-base font-black leading-tight mt-0.5">{dayVal || '??'}</span>
                            </div>

                            <div className="min-w-0">
                              <h4 className="font-black text-xs text-slate-800 truncate leading-snug">
                                {getClientName(client)}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-mono text-gray-400 font-semibold flex items-center gap-0.5">
                                  <Calendar size={10} /> {dobString}
                                </span>
                                {getClientProfession(client) && (
                                  <span className="text-[10px] text-indigo-650 bg-indigo-50 px-1.5 py-0.5 rounded-md font-sans font-bold flex items-center gap-0.5 max-w-[150px] truncate">
                                    <Briefcase size={9} /> {getClientProfession(client)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action - Redirect to Client's Integrated Portal */}
                          <button
                            type="button"
                            onClick={() => {
                              const slugStr = client.slug;
                              if (!slugStr) {
                                alert("Não foi possível abrir o Editor do Portal porque o cliente não possui slug cadastrado.");
                                return;
                              }
                              navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slugStr}/Editar-CRM-do-Cliente`);
                            }}
                            className="p-2 bg-white hover:bg-[#5850ec] hover:text-white border border-gray-200 rounded-xl transition text-gray-500 cursor-pointer shadow-3xs group-hover:scale-105"
                            title="Abrir CRM do Cliente no Portal Integrado"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: PROFESSIONS COMPILATION (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-xs space-y-5">
                
                {/* Professions Header & Search bar */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-gray-100 pb-4">
                    <span className="w-9 h-9 rounded-xl bg-indigo-50 text-[#5850ec] flex items-center justify-center shrink-0">
                      <Briefcase size={18} />
                    </span>
                    <div>
                      <h2 className="text-base font-extrabold text-gray-900">Profissões Cadastradas</h2>
                      <p className="text-[11px] text-gray-400 font-medium">Breakdown demográfico do ecossistema</p>
                    </div>
                  </div>

                  {/* Search box */}
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <Search size={14} />
                    </span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Filtrar por profissão ou cliente..."
                      className="w-full pl-9 pr-4 py-2.5 text-xs font-semibold bg-slate-50 border border-gray-150 rounded-2xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                {/* Professions List */}
                {filteredProfessions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 space-y-2">
                    <span className="text-xl block">💼</span>
                    <p className="font-extrabold text-xs uppercase tracking-wider">Nenhuma profissão localizada</p>
                    <p className="text-xxs text-slate-400 font-medium">Ajuste o termo de pesquisa inserido na barra de filtros.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {filteredProfessions.map((profEntry) => (
                      <div
                        key={profEntry.name}
                        className="bg-slate-50 border border-gray-150 p-4 rounded-2xl space-y-2.5 text-left"
                      >
                        {/* Profession Title and Total Counts */}
                        <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
                          <span className="text-[11px] font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#5850ec]" />
                            {profEntry.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                            {profEntry.count} {profEntry.count === 1 ? 'cliente' : 'clientes'}
                          </span>
                        </div>

                        {/* List of Clients with this profession */}
                        <div className="space-y-1.5">
                          {profEntry.clients.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => {
                                const slugStr = c.slug;
                                if (!slugStr) {
                                  alert("Não foi possível abrir o Editor do Portal porque o cliente não possui slug cadastrado.");
                                  return;
                                }
                                navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slugStr}/Editar-CRM-do-Cliente`);
                              }}
                              className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-3xs transition cursor-pointer text-xxs group"
                            >
                              <span className="font-bold text-gray-700 group-hover:text-indigo-900 truncate">
                                {getClientName(c)}
                              </span>
                              <span className="text-xxs font-bold text-gray-400 group-hover:text-indigo-700 inline-flex items-center gap-0.5">
                                Abrir CRM <ChevronRight size={10} />
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </BossLayout>
  );
}
