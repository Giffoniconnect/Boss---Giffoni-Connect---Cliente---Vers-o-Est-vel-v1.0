import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BossLayout } from '../../../components/Layout';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ArrowLeft, FolderKanban, ShieldAlert, Code, Loader2, Cpu, Link2, ExternalLink } from 'lucide-react';

interface CaseTechnicalInfo {
  id: string;
  clientId: string;
  clientSlug: string;
  registrationType: string;
  status: string;
  statusInterno: string;
  updatedAt?: any;
}

export default function DetalhesTecnicosCasos() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseTechnicalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCases() {
      try {
        setLoading(true);
        const q = query(collection(db, 'cases'), orderBy('updatedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetched: CaseTechnicalInfo[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetched.push({
            id: doc.id,
            clientId: data.clientId || '',
            clientSlug: data.clientSlug || '',
            registrationType: data.registrationType || '',
            status: data.status || '',
            statusInterno: data.statusInterno || '',
            updatedAt: data.updatedAt
          });
        });
        setCases(fetched);
      } catch (err: any) {
        console.error('Error fetching technical cases:', err);
        setError(err.message || 'Falha ao conectar com o barramento do Firestore.');
      } finally {
        setLoading(false);
      }
    }
    fetchCases();
  }, []);

  return (
    <BossLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-650 font-bold font-mono text-xs uppercase mb-1">
              <Cpu size={14} />
              <span>Auditoria de Casos • BOSS v5</span>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Detalhes Técnicos do Caso</h2>
            <p className="text-xs text-gray-500 mt-1">
              Fórmula de integridade fática para representação de casos. Gerencie UUIDs de casos, vínculos e rastreabilidade.
            </p>
          </div>

          <button
            onClick={() => navigate('/boss-giffoni-clientes/configuracoes/detalhes-tecnicos')}
            className="self-start sm:self-auto px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-150 rounded-xl text-gray-600 hover:text-gray-900 text-xs font-bold uppercase transition duration-150 flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Voltar Hub</span>
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-[2.5rem] border border-gray-150 p-16 shadow-sm text-center">
            <div className="flex flex-col items-center gap-4 text-gray-400 font-sans">
              <Loader2 className="animate-spin text-amber-600" size={32} />
              <span className="text-xs font-black uppercase tracking-widest text-gray-500 font-mono">Indexando casos ativos...</span>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-150 rounded-3xl text-red-900 text-xs flex gap-3.5 items-start">
            <ShieldAlert size={20} className="text-red-500 shrink-0 mt-0.5 animate-bounce" />
            <div className="space-y-1">
              <h4 className="font-extrabold uppercase tracking-wide">Erro de Conectividade</h4>
              <p className="font-semibold leading-relaxed">{error}</p>
            </div>
          </div>
        ) : cases.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] border border-gray-150 p-16 text-center text-gray-400">
            <FolderKanban size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-xs font-bold uppercase tracking-wider">Nenhum caso ativo cadastrado no Firestore.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-150 rounded-[2.5rem] p-6 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-gray-700 min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    <th className="pb-4">Caso Ativo / Serviço</th>
                    <th className="pb-4">ID Técnico (Document ID)</th>
                    <th className="pb-4">Vínculo do Caso</th>
                    <th className="pb-4">Status Técnico</th>
                    <th className="pb-4 text-right">Rotas Relacionadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cases.map((cs) => {
                    const step1Route = `/boss-giffoni-clientes/fluxo-producao/${cs.id}/cadastro`;
                    const currentStatus = cs.status || 'rascunho';
                    
                    return (
                      <tr key={cs.id} className="hover:bg-gray-55/40 transition">
                        {/* Name / Category */}
                        <td className="py-4 pr-3">
                          <div className="flex flex-col space-y-0.5">
                            <span className="font-bold text-gray-900 truncate max-w-[200px]" title={cs.registrationType}>
                              {cs.registrationType || 'Serviço Não Selecionado'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase">
                              Modalidade Técnica
                            </span>
                          </div>
                        </td>

                        {/* Case UUID */}
                        <td className="py-4 pr-3">
                          <span className="font-mono text-gray-600 font-bold bg-gray-50 border border-gray-150 px-2.5 py-1 rounded-md text-xs">
                            {cs.id}
                          </span>
                        </td>

                        {/* Relational Vínculo */}
                        <td className="py-4 pr-3 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 font-semibold font-mono">
                            <Link2 size={12} className="text-indigo-500 shrink-0" />
                            <span>clientId: </span>
                            <span className="text-indigo-650 font-bold">{cs.clientId || 'sem-vinculo'}</span>
                          </div>
                          {cs.clientSlug && (
                            <div className="text-[10px] text-gray-400 font-semibold font-mono">
                              Slug: <span className="font-bold">{cs.clientSlug}</span>
                            </div>
                          )}
                        </td>

                        {/* Status Técnico */}
                        <td className="py-4 pr-3 space-y-1">
                          <div className="flex flex-wrap gap-1">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                              currentStatus === 'rascunho' ? 'bg-amber-50 text-amber-850' : 'bg-indigo-50 text-indigo-850'
                            }`}>
                              Life: {currentStatus}
                            </span>
                            {cs.statusInterno && (
                              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-gray-100 text-gray-800">
                                Interno: {cs.statusInterno}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Action buttons */}
                        <td className="py-4 text-right space-y-1.5 shrink-0">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${cs.id}/cadastro`)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-150 text-amber-800 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1"
                              title="Visualizar Caso"
                            >
                              <ExternalLink size={11} />
                              <span>Fluxo</span>
                            </button>
                            <button
                              onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao`)}
                              className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-150 text-gray-750 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1"
                              title="Visualizar Lista"
                            >
                              <Code size={11} />
                              <span>Hub</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </BossLayout>
  );
}
