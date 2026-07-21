import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BossLayout } from '../../../components/Layout';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ArrowLeft, Users, ShieldAlert, Globe, Code, ExternalLink, Loader2, ListFilter, Cpu } from 'lucide-react';

interface ClientTechnicalInfo {
  id: string;
  name: string;
  slug: string;
  type: string;
  createdAt?: any;
  missingFields?: string[];
  cadastroIncompleto?: boolean;
}

export default function DetalhesTecnicosClientes() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientTechnicalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClients() {
      try {
        setLoading(true);
        const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetched: ClientTechnicalInfo[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const name = data.type === 'PF' 
            ? (data.pfDadosPessoais?.pf_nomeCompleto || data.pfData?.pf_nomeCompleto || 'Sem Nome') 
            : (data.pjDadosEmpresa?.pj_razaoSocial || data.pjData?.pj_razaoSocial || 'Sem Razão Social');
          
          fetched.push({
            id: doc.id,
            name,
            slug: data.slug || '',
            type: data.type || '',
            createdAt: data.createdAt,
            missingFields: data.missingFields || [],
            cadastroIncompleto: data.cadastroIncompleto === true
          });
        });
        setClients(fetched);
      } catch (err: any) {
        console.error('Error fetching technical clients:', err);
        setError(err.message || 'Falha ao conectar com o barramento do Firestore.');
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  return (
    <BossLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-650 font-bold font-mono text-xs uppercase mb-1">
              <Cpu size={14} />
              <span>Diagnóstico de Inquilinos • BOSS v5</span>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Detalhes Técnicos do Cliente</h2>
            <p className="text-xs text-gray-500 mt-1">
              Área administrativa de governança e isolamento de inquilinos. Gerencie UUIDs, namespaces e rotas dinâmicas.
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
            <div className="flex flex-col items-center gap-4 text-gray-400">
              <Loader2 className="animate-spin text-indigo-650" size={32} />
              <span className="text-xs font-black uppercase tracking-widest text-gray-500 font-mono">Indexando inquilinos...</span>
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
        ) : clients.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] border border-gray-150 p-16 text-center text-gray-400">
            <Users size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-xs font-bold uppercase tracking-wider">Nenhum inquilino cadastrado no Firestore.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-150 rounded-[2.5rem] p-6 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-gray-700 min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    <th className="pb-4">Cliente Associado</th>
                    <th className="pb-4">Slug do Inquilino</th>
                    <th className="pb-4">Identificadores Internos (Document ID)</th>
                    <th className="pb-4">Referências Técnicas</th>
                    <th className="pb-4 text-right">Rotas Relacionadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {clients.map((doc) => {
                    const portalPreviewRoute = `/boss-giffoni-clientes/portal-cliente-preview/${doc.id}`;
                    const editClientRoute = `/boss-giffoni-clientes/portal-cliente-giffoni/${doc.id}/login`;
                    
                    return (
                      <tr key={doc.id} className="hover:bg-gray-55/40 transition">
                        {/* Name */}
                        <td className="py-4 pr-3">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide ${
                              doc.type === 'PF' ? 'bg-indigo-50 text-indigo-750 border border-indigo-100' : 'bg-amber-50 text-amber-750 border border-amber-100'
                            }`}>
                              {doc.type || 'PF'}
                            </span>
                            <span className="font-bold text-gray-900 truncate max-w-[200px]" title={doc.name}>
                              {doc.name}
                            </span>
                          </div>
                        </td>

                        {/* Slug */}
                        <td className="py-4 pr-3">
                          {doc.slug ? (
                            <span className="font-mono text-indigo-600 bg-indigo-50/30 px-2 py-1 rounded-md border border-indigo-100/40 text-[11px] font-bold">
                              {doc.slug}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-mono italic">Sem Namespace</span>
                          )}
                        </td>

                        {/* Firestore UUID Document ID */}
                        <td className="py-4 pr-3">
                          <span className="font-mono text-gray-500 font-bold bg-gray-50 border border-gray-150 px-2.5 py-1 rounded-md text-xs">
                            {doc.id}
                          </span>
                        </td>

                        {/* Referências Técnicas */}
                        <td className="py-4 pr-3 space-y-1">
                          <div className="text-[10px] text-gray-450 font-semibold font-mono">
                            Status: <strong className={doc.cadastroIncompleto ? 'text-amber-600' : 'text-emerald-600'}>
                              {doc.cadastroIncompleto ? 'Incompleto' : 'Consolidado'}
                            </strong>
                          </div>
                          {doc.missingFields && doc.missingFields.length > 0 && (
                            <div className="text-[9px] text-gray-400 font-mono truncate max-w-[180px]" title={doc.missingFields.join(', ')}>
                              Campos Faltando ({doc.missingFields.length})
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 text-right space-y-1.5 shrink-0">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => navigate(`/boss-giffoni-clientes/portal-cliente-preview/${doc.slug || doc.id}`)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1"
                              title="Visualizar Painel"
                            >
                              <Globe size={11} />
                              <span>Painel</span>
                            </button>
                            <button
                              onClick={() => navigate(`/boss-giffoni-clientes/setores`)}
                              className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-150 text-gray-700 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1"
                              title="Visualizar Setores"
                            >
                              <Code size={11} />
                              <span>Setores</span>
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
