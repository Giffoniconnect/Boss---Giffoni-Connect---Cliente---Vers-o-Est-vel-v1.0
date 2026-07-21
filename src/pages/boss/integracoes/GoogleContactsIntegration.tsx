import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { BossLayout } from '../../../components/Layout';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  Users, 
  ArrowLeft, 
  Save, 
  Play, 
  Terminal, 
  AlertCircle, 
  Check, 
  X,
  Info,
  ExternalLink,
  Plus,
  RefreshCw
} from 'lucide-react';

interface GoogleContactsConfig {
  status: 'não_configurado' | 'preparado' | 'em_teste' | 'ativo' | 'erro';
  notes: string;
}

export default function GoogleContactsIntegration() {
  const navigate = useNavigate();
  const { googleAccessToken, loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Connection config
  const [config, setConfig] = useState<GoogleContactsConfig>({
    status: 'não_configurado',
    notes: ''
  });

  // System clients and Google contacts state
  const [systemClients, setSystemClients] = useState<any[]>([]);
  const [googleContacts, setGoogleContacts] = useState<any[]>([]);
  const [fetchingContacts, setFetchingContacts] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingClientId, setSyncingClientId] = useState<string | null>(null);

  const token = googleAccessToken || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';

  const loadRealContacts = async (accessToken: string) => {
    if (!accessToken) return;
    setFetchingContacts(true);
    try {
      const res = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=10', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.connections) {
          setGoogleContacts(data.connections);
        }
      } else {
        console.warn('Falha ao buscar contatos do Google:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Erro ao buscar contatos do Google:', err);
    } finally {
      setFetchingContacts(false);
    }
  };

  const loadSystemClients = async () => {
    try {
      const q = query(collection(db, 'clients'), limit(10));
      const querySnap = await getDocs(q);
      const list: any[] = [];
      querySnap.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          name: data.name || data.fullName || 'Sem Nome',
          email: data.email || '',
          phone: data.phone || data.pfDadosPessoais?.pf_celular || data.pjDadosEmpresa?.pj_telefone || '',
          ...data
        });
      });
      setSystemClients(list);
    } catch (err) {
      console.error('Erro ao carregar clientes do sistema:', err);
    }
  };

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const docSnap = await getDoc(doc(db, 'settings', 'connectors'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.googleContacts) {
            setConfig({
              status: data.googleContacts.status || 'não_configurado',
              notes: data.googleContacts.notes || ''
            });
          }
        }
        await loadSystemClients();
      } catch (err) {
        console.error('Erro ao ler Google Contacts de settings/connectors:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    if (token) {
      loadRealContacts(token);
    }
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleContacts: {
          status: config.status,
          notes: config.notes.trim()
        },
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setFeedback({ type: 'success', message: 'Configurações de integração com Google Contatos salvas com sucesso!' });
      
      const timestamp = new Date().toLocaleTimeString();
      setLogs(prev => [
        ...prev,
        `[${timestamp}] Configurações do Google Contatos atualizadas e gravadas com sucesso no Firestore.`
      ]);
    } catch (err: any) {
      console.error('Erro ao salvar Google Contacts:', err);
      setFeedback({ type: 'error', message: `Erro ao salvar configurações: ${err.message || err}` });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setLogs([]);
    setShowLogs(true);
    const timestamp = () => new Date().toLocaleTimeString();

    const addLog = (msg: string) => {
      setLogs(prev => [...prev, `[${timestamp()}] ${msg}`]);
    };

    addLog("Inicializando aperto de mão lógico com Google People API v1...");

    if (!token) {
      addLog("ERRO: Conta Google não conectada. Por favor, conecte sua conta Google primeiro.");
      setTesting(false);
      return;
    }

    addLog("Conta Google detectada. Validando Escopos OAuth para leitura de contatos...");
    
    try {
      addLog("Solicitando lista de conexões (Google Connections List)...");
      const resList = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=5', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!resList.ok) {
        throw new Error(`Erro ao obter contatos: ${resList.statusText} (${resList.status})`);
      }

      const listData = await resList.json();
      const connections = listData.connections || [];
      setGoogleContacts(connections);
      addLog(`SUCESSO: ${connections.length} contatos fáticos encontrados na conta Google.`);

      connections.forEach((conn: any) => {
        const name = conn.names?.[0]?.displayName || 'Contato sem nome';
        const email = conn.emailAddresses?.[0]?.value || 'Sem e-mail';
        addLog(`  -> Encontrado: "${name}" (${email})`);
      });

      // Update Firestore state to 'ativo'
      const updatedConfig = { ...config, status: 'ativo' as const };
      setConfig(updatedConfig);
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleContacts: updatedConfig,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      addLog("Integração Google Contatos ativada e gravada no banco com SUCESSO!");
      setFeedback({ type: 'success', message: 'Conexão fática testada e ativa com sucesso no Google Contatos!' });

    } catch (err: any) {
      console.error(err);
      addLog(`ERRO CRÍTICO na integração: ${err.message || err}`);
      setFeedback({ type: 'error', message: `Erro no teste de integração: ${err.message || err}` });
      
      const updatedConfig = { ...config, status: 'erro' as const };
      setConfig(updatedConfig);
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleContacts: updatedConfig,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncClient = async (client: any) => {
    if (!token) {
      setFeedback({ type: 'error', message: 'Por favor, conecte sua conta Google primeiro.' });
      return;
    }
    setSyncingClientId(client.id);
    const timestamp = () => new Date().toLocaleTimeString();
    setShowLogs(true);
    const addLog = (msg: string) => setLogs(prev => [...prev, `[${timestamp()}] ${msg}`]);

    addLog(`Exportando cliente [${client.name}] para o Google Contatos...`);

    try {
      const payload = {
        names: [{ givenName: client.name }],
        emailAddresses: client.email ? [{ value: client.email }] : [],
        phoneNumbers: client.phone ? [{ value: client.phone }] : [],
        biographies: [{ value: 'Cliente cadastrado no Portal BOSS Giffoni.' }]
      };

      const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Erro na criação do contato: ${res.statusText} (${res.status})`);
      }

      const created = await res.json();
      addLog(`SUCESSO: Contato [${client.name}] sincronizado faticamente no Google Contatos.`);
      addLog(`ResourceName retornado: ${created.resourceName}`);

      setFeedback({ type: 'success', message: `Cliente "${client.name}" exportado com sucesso total para o Google Contatos!` });
      await loadRealContacts(token);

    } catch (err: any) {
      console.error(err);
      addLog(`Erro ao exportar cliente: ${err.message || err}`);
      setFeedback({ type: 'error', message: `Erro na exportação: ${err.message || err}` });
    } finally {
      setSyncingClientId(null);
    }
  };

  const handleDisable = async () => {
    const timestamp = new Date().toLocaleTimeString();
    const updated = { ...config, status: 'não_configurado' as const };
    setConfig(updated);
    
    try {
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleContacts: updated,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setLogs(prev => [
        ...prev,
        `[${timestamp}] Integração com Google Contatos desativada voluntariamente.`
      ]);
      setFeedback({ type: 'success', message: 'Integração desativada.' });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <BossLayout>
        <div className="flex-1 p-6 md:p-10 flex items-center justify-center bg-gray-50 text-gray-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-100 border-t-amber-600 rounded-full animate-spin"></div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Sincronizando Google Contatos...</span>
          </div>
        </div>
      </BossLayout>
    );
  }

  return (
    <BossLayout>
      <div className="flex-1 p-6 md:p-10 space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <button 
              onClick={() => navigate('/boss-giffoni-clientes/configuracoes')}
              className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 transition cursor-pointer border-none bg-transparent outline-none"
            >
              <ArrowLeft size={14} />
              Voltar para Configurações
            </button>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <Users size={20} />
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Google Contatos (CRM)</h1>
                <p className="text-xs text-gray-500 font-semibold">Integrador de agenda e clientes unificado</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!token ? (
              <button
                type="button"
                onClick={() => loginWithGoogle('boss_admin')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
              >
                Conectar Conta Google
              </button>
            ) : (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-3 py-1.5 border border-emerald-150 rounded-lg font-bold uppercase tracking-wider font-mono">
                Autenticado via Google
              </span>
            )}
          </div>
        </div>

        {feedback && (
          <div className={`p-4 rounded-2xl text-xs flex gap-3 ${feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-950' : 'bg-red-50 border border-red-100 text-red-950'}`}>
            {feedback.type === 'success' ? <Check size={18} className="text-emerald-600 shrink-0" /> : <AlertCircle size={18} className="text-red-600 shrink-0" />}
            <span className="font-semibold">{feedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <form onSubmit={handleSave} className="md:col-span-2 space-y-6">
            <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="text-sm font-black uppercase text-gray-800 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3">
                <span>Parâmetros de Sincronização</span>
              </h3>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Status da Integração</label>
                  <select
                    value={config.status}
                    onChange={(e) => setConfig(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none cursor-pointer"
                  >
                    <option value="não_configurado">Não Configurado</option>
                    <option value="preparado">Preparado</option>
                    <option value="em_teste">Em Testes</option>
                    <option value="ativo">Ativo (Produção)</option>
                    <option value="erro">Erro</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Observações Internas</label>
                  <textarea
                    rows={3}
                    value={config.notes}
                    onChange={(e) => setConfig(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notas ou instruções específicas sobre a sincronização de contatos com o Google..."
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 rounded-xl text-xs font-bold uppercase tracking-wider transition duration-150 flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow"
                >
                  <Save size={13} />
                  <span>{saving ? 'Gravando...' : 'Salvar Ajustes'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Play size={12} />
                  <span>{testing ? 'Testando...' : 'Testar Conexão'}</span>
                </button>

                {config.status !== 'não_configurado' && (
                  <button
                    type="button"
                    onClick={handleDisable}
                    className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-650 rounded-xl text-xs font-bold uppercase transition"
                  >
                    Desativar
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* QUICK SIDEBAR */}
          <div className="space-y-6">
            <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider font-mono">Status da Conta</h3>
              
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl space-y-3 font-mono text-[10px] leading-relaxed text-slate-600">
                <div className="flex justify-between items-center border-b border-slate-150/50 pb-2">
                  <span>Provedor:</span>
                  <span className="font-bold">Google People API</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-150/50 pb-2">
                  <span>Autorização OAuth:</span>
                  <span className={`font-bold ${token ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {token ? 'SIM (Ativa)' : 'NÃO (Pendente)'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span>Contatos Lidos:</span>
                  <span className="font-bold text-gray-800">{googleContacts.length} carregados</span>
                </div>
              </div>

              {!token && (
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl flex gap-2 items-start text-[10px] text-amber-900 leading-normal font-semibold">
                  <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>Por favor, conecte sua conta Google no canto superior direito para liberar a exportação real.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* EXPORT CLIENTS GRID CARD */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-black uppercase text-gray-800 tracking-tight">Exportar Clientes para Google Contatos</h3>
              <p className="text-[10px] text-gray-400 font-semibold">Selecione clientes do portal para cadastrar instantaneamente no Google</p>
            </div>
            <button
              onClick={loadSystemClients}
              className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-500 transition"
              title="Recarregar Clientes"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {systemClients.length === 0 ? (
            <div className="p-10 border border-dashed border-gray-200 rounded-2xl text-center text-xs text-gray-400 font-medium">
              Nenhum cliente fático localizado para exportação.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">
                    <th className="py-2.5 font-mono">Nome Completo</th>
                    <th className="py-2.5 font-mono">E-mail</th>
                    <th className="py-2.5 font-mono">Telefone</th>
                    <th className="py-2.5 font-mono text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {systemClients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-2.5 font-bold text-gray-800">{client.name}</td>
                      <td className="py-2.5 font-mono text-gray-500">{client.email || <span className="italic text-gray-300">Sem e-mail</span>}</td>
                      <td className="py-2.5 font-mono text-gray-500">{client.phone || <span className="italic text-gray-300">Sem telefone</span>}</td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          disabled={syncingClientId === client.id || !token}
                          onClick={() => handleSyncClient(client)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-700 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          {syncingClientId === client.id ? 'Gravando...' : <><Plus size={10} /> Exportar</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TERMINAL LOG COMPONENT */}
        <div className="border border-gray-150 rounded-3xl p-6 bg-slate-900 text-teal-400 shadow-inner space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-slate-300 font-mono tracking-wider">
              <Terminal size={16} />
              <span className="text-xs font-black uppercase">
                Terminal Real-Time Logs — Google Contatos
              </span>
            </div>
            
            <button
              type="button"
              onClick={() => setShowLogs(!showLogs)}
              className="text-xs text-slate-400 hover:text-white font-mono uppercase bg-slate-800 px-2 py-1 rounded"
            >
              {showLogs ? 'Ocultar' : 'Expandir Logs'}
            </button>
          </div>
          
          <div className="font-mono text-[11px] leading-relaxed text-slate-400 space-y-1 max-h-[220px] overflow-y-auto">
            <p>[SYSTEM_WATCHER] Subsistema de sincronização de Contatos carregado com sucesso.</p>
            {showLogs && logs.map((log, index) => (
              <p key={index} className="text-teal-400 animate-fadeIn">{log}</p>
            ))}
            {!showLogs && logs.length > 0 && (
              <p className="text-slate-500 italic">Testes em andamento. {logs.length} linhas de logs geradas. Clique em "Expandir Logs" para ver.</p>
            )}
          </div>
        </div>
      </div>
    </BossLayout>
  );
}
