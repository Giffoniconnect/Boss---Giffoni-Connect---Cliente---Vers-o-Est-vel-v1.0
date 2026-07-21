// LEGADO — função absorvida pelo Fluxo de Produção e Central de Controle. Não usar como rota ativa.
import React, { useEffect, useState } from 'react';
import { BossLayout } from '../../components/Layout';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Plus, Search, ExternalLink, ChevronRight, User, Building2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Client {
  id: string;
  type: 'PF' | 'PJ';
  slug: string;
  active: boolean;
  pfData?: any;
  pjData?: any;
  createdAt?: any;
}

export default function ClientesList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(docs);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'clients');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getClientName = (client: Client | any) => {
    if (client.type === 'PF') return client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Sem Nome';
    return client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Sem Razão Social';
  };

  const getClientEmail = (client: Client | any) => {
    if (client.type === 'PF') return client.pfContato?.pf_email || client.pfData?.pf_email || 'Sem E-mail';
    return client.pjContatoEmpresa?.pj_emailEmpresa || client.pjData?.pj_emailEmpresa || 'Sem E-mail';
  };

  const handleDelete = async (client: Client) => {
    setDeletingId(client.id);
    try {
      // Delete client document
      await deleteDoc(doc(db, 'clients', client.id));
      
      // Delete slug mapping if exists
      if (client.slug) {
        await deleteDoc(doc(db, 'clientPortals', client.slug));
      }

      // Also try to delete invite mapping
      try {
        await deleteDoc(doc(db, 'users_invites', client.id));
      } catch (e) {
        // Ignore if invite doesn't exist
      }
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error deleting client:', err);
      handleFirestoreError(err, OperationType.DELETE, `clients/${client.id}`);
      alert('Falha ao excluir cliente. Verifique as permissões.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredClients = clients.filter(c => {
    const name = getClientName(c).toLowerCase();
    const slug = c.slug.toLowerCase();
    const search = searchTerm.toLowerCase();
    return name.includes(search) || slug.includes(search);
  });

  return (
    <BossLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Gestão de Clientes</h2>
          <p className="text-gray-500">Mapeamento modular de acessos PF e PJ.</p>
        </div>
        <button
          onClick={() => navigate('/boss-giffoni-clientes/clientes/novo')}
          className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-xl shadow-gray-200"
        >
          <Plus size={20} />
          Novo Cadastro
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome, razão social ou slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 placeholder:text-gray-400 transition-all font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
              <tr>
                <th className="px-8 py-5">Identificação</th>
                <th className="px-8 py-5 text-center">Tipo</th>
                <th className="px-8 py-5">Status Portal</th>
                <th className="px-8 py-5">Slug</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-gray-100 border-t-gray-900 rounded-full animate-spin"></div>
                      <span className="text-sm text-gray-400 font-bold">Sincronizando base de dados...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-gray-400 font-medium italic">
                    Nenhum cliente modular encontrado.
                  </td>
                </tr>
              ) : filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="font-bold text-gray-900 leading-tight mb-1">{getClientName(client)}</div>
                    <div className="text-xs text-gray-400 font-medium">{getClientEmail(client)}</div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${
                      client.type === 'PF' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                    }`}>
                      {client.type === 'PF' ? <User size={18} /> : <Building2 size={18} />}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      client.active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${client.active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {client.active ? 'Liberado' : 'Suspenso'}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <code className="text-xs bg-gray-100 px-3 py-1.5 rounded-xl text-gray-500 font-mono">/{client.slug}</code>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                       <button 
                        onClick={() => navigate(`/boss-giffoni-clientes/clientes/${client.id}`)}
                        className="p-3 bg-white border border-gray-100 text-gray-900 rounded-xl hover:bg-gray-50 transition-all active:scale-90"
                        title="Gerenciar Detalhes"
                      >
                        <ChevronRight size={18} />
                      </button>
                      <button 
                        onClick={() => window.open(`/portal-cliente-giffoni/${client.slug}/dashboard`, '_blank')}
                        className="p-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-lg shadow-gray-200 active:scale-90"
                        title="Abrir Visão do Cliente"
                      >
                        <ExternalLink size={18} />
                      </button>
                      <button 
                        onClick={() => setConfirmDelete(client)}
                        disabled={deletingId === client.id}
                        className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 transition-all active:scale-90 disabled:opacity-50"
                        title="Excluir Registro"
                      >
                        {deletingId === client.id ? (
                          <div className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Confirmar Exclusão?</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Você está prestes a deletar <span className="font-bold text-gray-900">"{getClientName(confirmDelete)}"</span>. 
              Esta ação é <span className="font-bold text-red-600 uppercase">irreversível</span> e todos os dados serão removidos permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deletingId === confirmDelete.id}
                className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2"
              >
                {deletingId === confirmDelete.id ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Confirmar Deletar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </BossLayout>
  );
}
