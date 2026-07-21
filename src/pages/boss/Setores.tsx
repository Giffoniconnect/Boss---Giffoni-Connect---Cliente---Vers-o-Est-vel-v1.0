import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BossLayout } from '../../components/Layout';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Megaphone, 
  Handshake, 
  PiggyBank, 
  Scale, 
  Heart, 
  Cpu, 
  Target, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight 
} from 'lucide-react';
import { motion } from 'motion/react';

interface SectorInfo {
  id: string;
  name: string;
  title: string;
  indicator: string;
  icon: React.ComponentType<any>;
  colorClass: string;
  iconBgClass: string;
}

const SECTORS: SectorInfo[] = [
  {
    id: 'marketing',
    name: 'Marketing',
    title: 'Build - Marketing (Portal BOSS)',
    indicator: '5+',
    icon: Megaphone,
    colorClass: 'text-purple-600 border-purple-100 bg-purple-50',
    iconBgClass: 'bg-purple-100 text-purple-700',
  },
  {
    id: 'comercial',
    name: 'Comercial',
    title: 'Build - Setor Comercial (Portal BOSS)',
    indicator: '1',
    icon: Handshake,
    colorClass: 'text-blue-600 border-blue-100 bg-blue-50',
    iconBgClass: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'financeiro',
    name: 'Financeiro',
    title: 'Build - Financeiro - Painel BOSS - Giffoni Clientes',
    indicator: '4+',
    icon: PiggyBank,
    colorClass: 'text-emerald-600 border-emerald-100 bg-emerald-50',
    iconBgClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'juridico',
    name: 'Jurídico Interno',
    title: 'Build - Jurídico Interno - Painel BOSS - Clientes',
    indicator: '1',
    icon: Scale,
    colorClass: 'text-amber-600 border-amber-100 bg-amber-50',
    iconBgClass: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'rh',
    name: 'RH',
    title: 'Build - RH - Painel BOSS - Clientes',
    indicator: '1',
    icon: Heart,
    colorClass: 'text-rose-600 border-rose-100 bg-rose-50',
    iconBgClass: 'bg-rose-100 text-rose-700',
  },
  {
    id: 'operacional',
    name: 'Operacional',
    title: 'Build - Operacional - Clientes - BOSS',
    indicator: '2+',
    icon: Cpu,
    colorClass: 'text-indigo-600 border-indigo-100 bg-indigo-50',
    iconBgClass: 'bg-indigo-100 text-indigo-700',
  },
  {
    id: 'estrategico',
    name: 'Estratégico',
    title: 'Build - Estratégico - Clientes - BOSS',
    indicator: '1',
    icon: Target,
    colorClass: 'text-cyan-600 border-cyan-100 bg-cyan-50',
    iconBgClass: 'bg-cyan-100 text-cyan-700',
  },
  {
    id: 'crm',
    name: 'CRM',
    title: 'Build - CRM - Giffoni Advogados Associados',
    indicator: '2+',
    icon: Handshake,
    colorClass: 'text-indigo-650 border-indigo-100 bg-indigo-50',
    iconBgClass: 'bg-indigo-100 text-indigo-700',
  },
];

export default function Setores() {
  const navigate = useNavigate();
  const [links, setLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSectorsLinks() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'sectors'));
        if (snap.exists()) {
          const data = snap.data();
          setLinks(data as Record<string, string>);
        } else {
          // If no doc in firestore, try fallback to localStorage for redundancy
          const localSectors = localStorage.getItem('giffoni_sectors_links');
          if (localSectors) {
            setLinks(JSON.parse(localSectors));
          }
        }
      } catch (err) {
        console.error('Error loading sectors links:', err);
        // Resilient fallback
        const localSectors = localStorage.getItem('giffoni_sectors_links');
        if (localSectors) {
          setLinks(JSON.parse(localSectors));
        }
      } finally {
        setLoading(false);
      }
    }
    fetchSectorsLinks();
  }, []);

  return (
    <BossLayout>
      <div className="mb-10">
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Setores do Escritório</h2>
        <p className="text-gray-500 mt-1">
          Acompanhe os fluxos de trabalho e acesse os painéis específicos de cada departamento.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-20 text-gray-400 font-sans">
          <div className="w-10 h-10 border-4 border-gray-100 border-t-gray-900 rounded-full animate-spin"></div>
          <span className="text-sm font-bold uppercase tracking-widest">Sincronizando painéis...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SECTORS.map((sector, index) => {
            const link = links[sector.id]?.trim();
            const hasLink = !!link;

            return (
              <motion.div
                key={sector.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-xl hover:shadow-gray-100 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${sector.iconBgClass}`}>
                      <sector.icon size={22} />
                    </div>
                    
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-600 border border-gray-100">
                      Builds: {sector.indicator}
                    </span>
                  </div>

                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">
                    Setor {sector.name}
                  </span>
                  
                  <h3 className="text-lg font-bold text-gray-900 leading-snug mb-3 min-h-[52px]">
                    {sector.title}
                  </h3>

                  <div className="mb-6 flex items-center gap-1.5">
                    {sector.id === 'marketing' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-md">
                        <CheckCircle2 size={12} /> Sistema Interno Integrado
                      </span>
                    ) : sector.id === 'crm' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                        <CheckCircle2 size={12} /> Sistema Interno Integrado
                      </span>
                    ) : sector.id === 'rh' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md">
                        <CheckCircle2 size={12} /> Sistema Interno Integrado
                      </span>
                    ) : hasLink ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        <CheckCircle2 size={12} /> Link Configurado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md italic">
                        Link configurável
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-50 pt-4 flex flex-col gap-2">
                  {sector.id !== 'marketing' && sector.id !== 'crm' && sector.id !== 'rh' && !hasLink && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>Link ainda não configurado</span>
                    </div>
                  )}

                  {sector.id === 'marketing' ? (
                    <button
                      onClick={() => navigate('/boss/leads/private/dashboard')}
                      className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white hover:shadow-lg rounded-2xl font-bold text-sm text-center transition-all inline-flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      <span>Ver Dashboard do Setor de Marketing</span>
                      <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ) : sector.id === 'crm' ? (
                    <button
                      onClick={() => navigate('/boss/CRM/private/dashboard')}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-lg rounded-2xl font-bold text-sm text-center transition-all inline-flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      <span>Ver Dashboard do CRM</span>
                      <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ) : sector.id === 'rh' ? (
                    <button
                      onClick={() => navigate('/boss-giffoni-clientes/setores/dashboard.RH.Giffoni.Adv.Associados')}
                      className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white hover:shadow-lg rounded-2xl font-bold text-sm text-center transition-all inline-flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      <span>Ver Dashboard do Setor de RH</span>
                      <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ) : hasLink ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 bg-gray-900 hover:bg-black text-white hover:shadow-lg rounded-2xl font-bold text-sm text-center transition-all inline-flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      <span>Acessar {sector.name}</span>
                      <ExternalLink size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </a>
                  ) : (
                    <button
                      disabled
                      className="w-full py-3.5 bg-gray-100 text-gray-400 rounded-2xl font-bold text-sm text-center cursor-not-allowed inline-flex items-center justify-center gap-2 border border-gray-200/50"
                    >
                      <span>Dashboard do Setor {sector.name}</span>
                      <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </BossLayout>
  );
}
