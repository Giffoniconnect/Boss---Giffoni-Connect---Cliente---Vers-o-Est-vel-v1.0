import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BossLayout } from '../../../components/Layout';
import { Users, FolderKanban, ArrowLeft, Cpu, ShieldAlert, Code } from 'lucide-react';

export default function DetalhesTecnicos() {
  const navigate = useNavigate();

  return (
    <BossLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-650 font-bold font-mono text-xs uppercase mb-1">
              <Cpu size={14} />
              <span>Zona de Desenvolvimento & Governança • BOSS v5</span>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Estratificação de Detalhes Técnicos</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              Nesta área segura e centralizada, residem todos os identificadores sistêmicos, metadados internos e slugs operacionais das coleções do Firestore para fins de depuração e integridade.
            </p>
          </div>

          <button
            onClick={() => navigate('/boss-giffoni-clientes/configuracoes')}
            className="self-start sm:self-auto px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-150 rounded-xl text-gray-600 hover:text-gray-900 text-xs font-bold uppercase transition duration-150 flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Voltar</span>
          </button>
        </div>

        {/* SECURITY BULLETIN CARD */}
        <div className="bg-slate-900 border border-slate-950 p-6 rounded-[2rem] flex gap-4 text-slate-100 shadow-lg">
          <ShieldAlert size={24} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-wider text-amber-400 font-mono">Políticas de Isolamento Multianfitrião (SaaS)</p>
            <p className="text-xs text-slate-350 leading-relaxed font-semibold">
              De acordo com as diretivas de proteção de dados e integridade fática, IDs internos e slugs foram ocultados de todas as interfaces e fluxos operacionais de produção para evitar poluição visual e vazamento de informações. Use estes repositórios técnicos para auditoria manual.
            </p>
          </div>
        </div>

        {/* DETAILS CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Detalhes Técnicos do Cliente */}
          <div className="bg-white border border-gray-150 rounded-[2.5rem] p-8 flex flex-col justify-between space-y-6 shadow-sm hover:shadow-md transition duration-150">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-650 rounded-2xl flex items-center justify-center shadow-inner">
                  <Users size={22} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">Detalhes Técnicos do Cliente</h3>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-600 font-bold bg-indigo-50/50 px-2 py-0.5 rounded-md">
                    collection('clients')
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                Consulte e gerencie namespaces/slugs do inquilino, ID do cliente fático no banco de dados Firestore, referências técnicas, validação de campos obrigatórios e mapeamento de rotas de integração.
              </p>

              <div className="border-t border-gray-100 pt-4 space-y-2 text-xs text-gray-550 list-disc pl-1 font-semibold">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  <span>Clientes Associados e Tipos GP/PF/PJ</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  <span>Namespace / Slug exclusivo do cliente</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  <span>Mapeamento de rotas e integridade do perfil</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/boss-giffoni-clientes/configuracoes/detalhes-tecnicos/clientes')}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold uppercase transition duration-150 shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Code size={14} />
              <span>Explorar Clientes</span>
            </button>
          </div>

          {/* Card 2: Detalhes Técnicos do Caso */}
          <div className="bg-white border border-gray-150 rounded-[2.5rem] p-8 flex flex-col justify-between space-y-6 shadow-sm hover:shadow-md transition duration-150">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-50 text-amber-650 rounded-2xl flex items-center justify-center shadow-inner">
                  <FolderKanban size={22} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">Detalhes Técnicos do Caso</h3>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-amber-600 font-bold bg-amber-50/50 px-2 py-0.5 rounded-md">
                    collection('cases')
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                Inspecione os registros processuais do Firestore. Verifique o vínculo do caso com inquilinos específicos, ID técnico do documento (UUIDv4), status técnico interno e referências fáticas nas etapas de produção.
              </p>

              <div className="border-t border-gray-100 pt-4 space-y-2 text-xs text-gray-550 list-disc pl-1 font-semibold">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                  <span>Casos Ativos e ID de inquilino (clientId)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                  <span>ID Técnico do Caso e UUID do Firestore</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                  <span>Metadados e Status de Produção Técnicos</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/boss-giffoni-clientes/configuracoes/detalhes-tecnicos/casos')}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold uppercase transition duration-150 shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Code size={14} />
              <span>Explorar Casos</span>
            </button>
          </div>

        </div>
      </div>
    </BossLayout>
  );
}
