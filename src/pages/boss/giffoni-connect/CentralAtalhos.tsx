import React, { useState } from 'react';
import { BossLayout } from '../../../components/Layout';
import { 
  Compass, 
  ExternalLink, 
  Globe, 
  Search, 
  Sparkles, 
  Layers, 
  CreditCard, 
  Coins, 
  FileText, 
  FolderOpen, 
  Calendar, 
  MessageSquare, 
  Mail, 
  CheckSquare, 
  ArrowRight,
  ShieldAlert,
  Sliders,
  Users,
  LayoutDashboard
} from 'lucide-react';

interface Shortcut {
  name: string;
  description: string;
  url: string;
  category: 'portais' | 'financeiro' | 'documentos' | 'comunicacao';
  icon: React.ComponentType<any>;
  badge?: string;
  badgeColor?: string;
  isExternal?: boolean;
}

export default function CentralAtalhos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  const shortcuts: Shortcut[] = [
    // Portais
    { 
      name: 'Portal do Cliente Giffoni', 
      description: 'Painel seguro de autoatendimento para os clientes acompanharem andamentos.', 
      url: '/boss-giffoni-clientes/fluxo-producao', 
      category: 'portais', 
      icon: Users,
      badge: 'Ativo',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200'
    },
    { 
      name: 'Dashboard Administrativo Connect', 
      description: 'Painel analítico completo de faturamento, novos leads e saúde processual.', 
      url: '/boss-giffoni-clientes/dashboard', 
      category: 'portais', 
      icon: LayoutDashboard,
      badge: 'Admin Only',
      badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200'
    },
    { 
      name: 'Central de Controle e Setores', 
      description: 'Gerenciamento de fluxos fáticos, delegação de tarefas e distribuição de tarefas.', 
      url: '/boss-giffoni-clientes/central-controle', 
      category: 'portais', 
      icon: Sliders
    },

    // Financeiro
    { 
      name: 'Gateway de Cobranças Asaas', 
      description: 'Gestão integrada de emissão de boletos bancários da Giffoni Consultoria.', 
      url: '/boss-giffoni-clientes/configuracoes/integracoes-asaas', 
      category: 'financeiro', 
      icon: Coins,
      badge: 'Financeiro',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200'
    },
    { 
      name: 'Stripe Global Enterprise', 
      description: 'Interface de processamento de pagamentos globais e cartões de crédito recorrentes.', 
      url: '/boss-giffoni-clientes/configuracoes/integracoes-stripe', 
      category: 'financeiro', 
      icon: CreditCard,
      badge: 'Internacional',
      badgeColor: 'bg-blue-50 text-blue-800 border-blue-200'
    },

    // Documentos e Produtividade
    { 
      name: 'Google Drive do Escritório', 
      description: 'Repositório na nuvem para pastas de clientes de forma segura e padronizada.', 
      url: '/boss-giffoni-clientes/configuracoes/integracoes-google-drive', 
      category: 'documentos', 
      icon: FolderOpen,
      isExternal: true
    },
    { 
      name: 'Gerador AutoML Google Docs', 
      description: 'Geração automatizada de Procurações, Declarações e Contratos fáticos.', 
      url: '/boss-giffoni-clientes/configuracoes/integracoes-google-docs', 
      category: 'documentos', 
      icon: FileText,
      badge: 'Automador',
      badgeColor: 'bg-purple-50 text-purple-800 border-purple-200'
    },
    { 
      name: 'Workspace Todoist Task Sync', 
      description: 'Automatizador e sincronizador das tarefas diárias e notificações do escritório.', 
      url: '/boss-giffoni-clientes/configuracoes/integracoes-todoist', 
      category: 'documentos', 
      icon: CheckSquare,
      isExternal: true
    },
    { 
      name: 'Calendário Google de Audiências', 
      description: 'Sincronização de sessões, audiências reais e perícias agendadas aos clientes.', 
      url: '/boss-giffoni-clientes/configuracoes/integracoes-google-calendar', 
      category: 'documentos', 
      icon: Calendar,
      isExternal: true
    },

    // Atendimento e Comunicação
    { 
      name: 'Integração de WhatsApp API', 
      description: 'Disparador de mensagens de andamentos processuais rápidos aos clientes cadastrados.', 
      url: '/boss-giffoni-clientes/configuracoes/integracoes-whatsapp', 
      category: 'comunicacao', 
      icon: MessageSquare,
      badge: 'Notificações',
      badgeColor: 'bg-emerald-55 text-emerald-950 border-emerald-300'
    },
    { 
      name: 'Integrador Gmail Outlook', 
      description: 'Disparador automático de e-mails institucionais sobre atualizações de casos.', 
      url: '/boss-giffoni-clientes/configuracoes/integracoes-gmail', 
      category: 'comunicacao', 
      icon: Mail,
      badge: 'E-mail',
      badgeColor: 'bg-rose-50 text-rose-800 border-rose-200'
    }
  ];

  const categories = [
    { id: 'todos', label: 'Todos os Atalhos' },
    { id: 'portais', label: 'Portais & Sistemas' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'documentos', label: 'Documentos & Tarefas' },
    { id: 'comunicacao', label: 'Comunicação' },
  ];

  const filteredShortcuts = shortcuts.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'todos' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <BossLayout>
      <div className="space-y-6 animate-fade-in text-left">
        {/* Top Header Card */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-8 md:p-10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-505 opacity-10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-505 opacity-10 rounded-full blur-2xl -ml-20 -mb-20 pointer-events-none"></div>
          
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest font-mono text-indigo-200 border border-white/5">
              <Sparkles size={11} className="text-amber-400" />
              <span>Conexão Unificada</span>
            </div>
            
            <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">
              Central de Atalhos do Ecossistema <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-cyan-200 to-white">Giffoni Connect</span>
            </h1>
            
            <p className="text-xs md:text-sm font-medium text-slate-300 leading-relaxed max-w-2xl">
              Navegue instantaneamente de forma integrada por todos os portais virtuais, ferramentas inteligentes, 
              controladores de faturamento, gerenciador de arquivos e APIs do ecossistema Giffoni.
            </p>
          </div>
        </div>

        {/* Filters and Search Strip */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-gray-150 p-4 rounded-2xl shadow-xs">
          {/* Inner Navigation Tabs */}
          <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer ${
                  selectedCategory === cat.id 
                    ? 'bg-indigo-650 text-white shadow-xs' 
                    : 'text-gray-500 hover:text-gray-905 hover:bg-gray-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Buscar atalho..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>
        </div>

        {/* Shortcuts Grid Grid */}
        {filteredShortcuts.length === 0 ? (
          <div className="bg-white border border-gray-150 rounded-3xl p-12 text-center text-gray-505">
            <Compass size={36} className="mx-auto text-gray-300 mb-2.5" />
            <p className="text-xs font-black uppercase font-mono tracking-wider text-gray-850">Nenhum atalho encontrado</p>
            <p className="text-xs mt-1">Tente ajustar seus termos de busca no ecossistema.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredShortcuts.map((item, index) => {
              const Icon = item.icon;
              return (
                <a
                  key={index}
                  href={item.url}
                  target={item.isExternal ? "_blank" : undefined}
                  rel={item.isExternal ? "noopener noreferrer" : undefined}
                  className="group bg-white border border-gray-150 hover:border-indigo-200 hover:shadow-md rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 relative text-left select-none"
                >
                  <div className="space-y-3">
                    {/* Header line icon and badge */}
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 bg-indigo-55 group-hover:bg-indigo-100 text-indigo-650 rounded-xl transition-colors">
                        <Icon size={16} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.badge && (
                          <span className={`px-2 py-0.5 border text-[9px] font-mono font-black uppercase tracking-wider rounded-md ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        )}
                        {item.isExternal && (
                          <span className="px-1.5 py-0.5 border border-gray-200 bg-gray-50 text-gray-400 text-[8px] font-mono font-black uppercase tracking-wider rounded-md flex items-center gap-1">
                            Link <ExternalLink size={8} />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta name description */}
                    <div className="space-y-1">
                      <h3 className="font-sans font-black text-gray-900 group-hover:text-indigo-650 transition-colors text-sm">
                        {item.name}
                      </h3>
                      <p className="text-xs text-gray-450 leading-relaxed font-semibold">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Footer arrow indicator */}
                  <div className="flex items-center justify-end text-indigo-650 group-hover:text-indigo-850 text-xs font-black uppercase font-mono tracking-wider gap-1 mt-4 pt-3 border-t border-gray-50 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span>Acessar</span>
                    <ArrowRight size={11} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* Operational Status Box */}
        <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 text-cyan-400 rounded-2xl shrink-0">
              <Layers size={20} className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-white font-mono tracking-wider">Integridade dos Sistemas Connect</h4>
              <p className="text-xs text-slate-400 font-semibold mt-1 max-w-xl">
                Todos os barramentos automáticos e canais de Webhooks com as APIs externas (Asaas, Stripe, Google Docs, Drive) estão operando em plena capacidade e em alta velocidade.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-55 border border-emerald-250 rounded-2xl text-emerald-950 font-black tracking-wider text-xs font-mono uppercase shrink-0 self-start md:self-center">
            <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full animate-ping"></span>
            <span>Estável & Sincronizado</span>
          </div>
        </div>
      </div>
    </BossLayout>
  );
}
