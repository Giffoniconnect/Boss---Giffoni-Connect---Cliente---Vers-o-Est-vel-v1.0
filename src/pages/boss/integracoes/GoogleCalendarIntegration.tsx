import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { BossLayout } from '../../../components/Layout';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  CalendarDays, 
  ArrowLeft, 
  Save, 
  Play, 
  Terminal, 
  AlertCircle, 
  Check, 
  X,
  Info
} from 'lucide-react';

interface GoogleCalendarConfig {
  status: 'não_configurado' | 'preparado' | 'em_teste' | 'ativo' | 'erro';
  calendarStrategy: 'shared' | 'individual';
  calendarIdPlaceholder: string;
  notes: string;
}

export default function GoogleCalendarIntegration() {
  const navigate = useNavigate();
  const { googleAccessToken, loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Connection fields
  const [config, setConfig] = useState<GoogleCalendarConfig>({
    status: 'não_configurado',
    calendarStrategy: 'shared',
    calendarIdPlaceholder: 'primary',
    notes: ''
  });

  // Real calendars and logs
  const [googleCalendars, setGoogleCalendars] = useState<any[]>([]);
  const [fetchingCalendars, setFetchingCalendars] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [testing, setTesting] = useState(false);

  const token = googleAccessToken || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';

  const loadRealCalendars = async (accessToken: string) => {
    if (!accessToken) return;
    setFetchingCalendars(true);
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          setGoogleCalendars(data.items);
        }
      } else {
        console.warn('Falha ao buscar agendas do Google:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Erro ao buscar agendas do Google:', err);
    } finally {
      setFetchingCalendars(false);
    }
  };

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const docSnap = await getDoc(doc(db, 'settings', 'connectors'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.googleCalendar) {
            setConfig({
              status: data.googleCalendar.status || 'não_configurado',
              calendarStrategy: data.googleCalendar.calendarStrategy || 'shared',
              calendarIdPlaceholder: data.googleCalendar.calendarIdPlaceholder || 'primary',
              notes: data.googleCalendar.notes || ''
            });
          }
        }
      } catch (err) {
        console.error('Erro ao ler Google Calendar de settings/connectors:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    if (token) {
      loadRealCalendars(token);
    }
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleCalendar: {
          status: config.status,
          calendarStrategy: config.calendarStrategy,
          calendarIdPlaceholder: config.calendarIdPlaceholder.trim(),
          notes: config.notes.trim()
        },
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setFeedback({ type: 'success', message: 'Configurações de integração com Google Agenda salvas na nuvem com sucesso!' });
      
      const timestamp = new Date().toLocaleTimeString();
      setLogs(prev => [
        ...prev,
        `[${timestamp}] Configurações atualizadas e gravadas com sucesso no Firestore.`
      ]);
    } catch (err: any) {
      console.error('Erro ao salvar Google Calendar:', err);
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

    addLog("Inicializando aperto de mão lógico com Google Calendar API v3...");

    if (!token) {
      addLog("ERRO: Conta Google não conectada. Por favor, conecte sua conta Google primeiro.");
      setTesting(false);
      return;
    }

    addLog("Conta Google detectada. Validando Escopos OAuth do projeto do barramento...");
    
    try {
      addLog("Solicitando lista de agendas (Calendar List)...");
      const resList = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!resList.ok) {
        throw new Error(`Erro ao obter lista de agendas: ${resList.statusText} (${resList.status})`);
      }

      const listData = await resList.json();
      const calendars = listData.items || [];
      setGoogleCalendars(calendars);
      addLog(`SUCESSO: ${calendars.length} agendas fáticas encontradas na conta Google.`);

      const targetCalendarId = config.calendarIdPlaceholder.trim() || 'primary';
      addLog(`Conectando ao ID de agenda: [${targetCalendarId}]...`);

      // 1. List latest 5 events
      addLog(`Buscando últimos 5 compromissos da agenda [${targetCalendarId}]...`);
      const resEvents = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events?maxResults=5&orderBy=startTime&singleEvents=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!resEvents.ok) {
        throw new Error(`Erro ao listar compromissos: ${resEvents.statusText} (${resEvents.status})`);
      }

      const eventsData = await resEvents.json();
      const events = eventsData.items || [];
      addLog(`SUCESSO: Encontrados ${events.length} compromissos na agenda.`);
      events.forEach((ev: any) => {
        const evDate = ev.start?.dateTime || ev.start?.date || 'Data Indefinida';
        addLog(`  -> Compromisso: "${ev.summary || 'Sem Título'}" em ${new Date(evDate).toLocaleString()}`);
      });

      // 2. Insert test event
      addLog("Testando inserção de compromisso de teste fático...");
      const testEventPayload = {
        summary: 'BOSS Giffoni - Conexão Fática de Teste',
        description: 'Compromisso de teste fático gerado automaticamente pelo barramento BOSS Giffoni para validar a integridade da conexão de escrita.',
        start: {
          dateTime: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hora no futuro
          timeZone: 'America/Sao_Paulo'
        },
        end: {
          dateTime: new Date(Date.now() + 7200 * 1000).toISOString(), // 2 horas no futuro
          timeZone: 'America/Sao_Paulo'
        }
      };

      const resCreate = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testEventPayload)
      });

      if (!resCreate.ok) {
        throw new Error(`Erro ao criar compromisso de teste: ${resCreate.statusText} (${resCreate.status})`);
      }

      const createdEvent = await resCreate.json();
      addLog(`SUCESSO: Compromisso de teste criado com ID: ${createdEvent.id}`);
      addLog(`Link do compromisso no Google Agenda: ${createdEvent.htmlLink}`);

      // Update Firestore state to 'ativo'
      const updatedConfig = { ...config, status: 'ativo' as const };
      setConfig(updatedConfig);
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleCalendar: updatedConfig,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      addLog("Integração ativada e gravada no banco com SUCESSO ABSOLUTO!");
      setFeedback({ type: 'success', message: 'Conexão fática testada, validada e ativa com sucesso no Google!' });

    } catch (err: any) {
      console.error(err);
      addLog(`ERRO CRÍTICO na integração: ${err.message || err}`);
      setFeedback({ type: 'error', message: `Erro no teste de integração: ${err.message || err}` });
      
      const updatedConfig = { ...config, status: 'erro' as const };
      setConfig(updatedConfig);
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleCalendar: updatedConfig,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } finally {
      setTesting(false);
    }
  };

  const handleDisable = async () => {
    const timestamp = new Date().toLocaleTimeString();
    const updated = { ...config, status: 'não_configurado' as const };
    setConfig(updated);
    
    try {
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleCalendar: updated,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setLogs(prev => [
        ...prev,
        `[${timestamp}] Provedor desativado voluntariamente pelo operador.`
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
            <div className="w-8 h-8 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Sincronizando Google Agenda...</span>
          </div>
        </div>
      </BossLayout>
    );
  }

  return (
    <BossLayout>
      <div className="flex-1 p-6 md:p-10 space-y-6 max-w-4xl mx-auto">
        {/* Navigation Breadcrumb & Back button */}
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
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <CalendarDays size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight uppercase">Google Agenda</h2>
                <p className="text-xs text-gray-500 font-medium">Controle de Reuniões e Prazos do Escritório</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-[9px] font-black uppercase border tracking-wider rounded-lg ${
              config.status === 'ativo' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              config.status === 'preparado' ? 'bg-blue-50 text-blue-800 border-blue-200' :
              config.status === 'em_teste' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              config.status === 'erro' ? 'bg-rose-50 text-rose-800 border-rose-200' :
              'bg-gray-100 text-gray-500 border-gray-200'
            }`}>
              {config.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-slate-900 border border-slate-950 p-6 rounded-[2rem] flex gap-3.5 text-slate-100 shadow-xl">
          <Info size={24} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-wider text-blue-400 font-mono">Conector Google Agenda Ativo • BOSS v5</p>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              Alerta automatizado ao advogado sobre reuniões marcadas e prazos cruciais das providências BOSS mapeadas nas etapas fáticas de cada caso.
            </p>
          </div>
        </div>

        {/* AUTHENTICATION CONTROL CARD */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${token ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <Check size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Status de Autenticação Google</h3>
              <p className="text-xs text-gray-500 font-semibold">
                {token ? 'Conectado com sucesso!' : 'Nenhuma conta Google conectada para este navegador.'}
              </p>
            </div>
          </div>
          <div>
            {!token ? (
              <button
                type="button"
                onClick={() => loginWithGoogle('boss_admin')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow active:scale-95"
              >
                <Play size={12} />
                Conectar Conta Google
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 border border-emerald-150 rounded-md font-bold font-mono">
                  CONEXÃO ATIVA
                </span>
                <button
                  type="button"
                  onClick={() => loginWithGoogle('boss_admin')}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg text-[10px] font-bold uppercase transition"
                >
                  Alternar Conta
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MAIN CONFIGURATION FORM */}
        <form onSubmit={handleSave} className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Selecione uma Agenda Real do Google</label>
              {fetchingCalendars ? (
                <div className="text-xs text-gray-400 animate-pulse py-2 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                  Carregando agendas da sua conta Google...
                </div>
              ) : googleCalendars.length > 0 ? (
                <select
                  value={config.calendarIdPlaceholder || 'primary'}
                  onChange={(e) => setConfig({ ...config, calendarIdPlaceholder: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                >
                  <option value="primary">Agenda Principal (primary)</option>
                  {googleCalendars.map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {cal.summary} {cal.primary ? '⭐️ (Principal)' : ''} ({cal.id})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                  Nenhuma agenda listada. Conecte sua Conta Google e clique em "Testar Conexão" para listar.
                </div>
              )}
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Calendar ID Secundário (Opcional - Customizado)</label>
              <input
                type="text"
                value={config.calendarIdPlaceholder}
                onChange={(e) => setConfig({ ...config, calendarIdPlaceholder: e.target.value })}
                placeholder="ex: primary ou c_xxxx@group.calendar.google.com"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Estratégia *</label>
              <select
                value={config.calendarStrategy}
                onChange={(e) => setConfig({ ...config, calendarStrategy: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
              >
                <option value="shared">Agenda Compartilhada Única</option>
                <option value="individual">Calendário por Cliente</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Status Conexão *</label>
              <select
                value={config.status}
                onChange={(e) => setConfig({ ...config, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
              >
                <option value="não_configurado">Não Configurado</option>
                <option value="preparado">Preparado</option>
                <option value="em_teste">Em Testes</option>
                <option value="ativo">Ativo</option>
                <option value="erro">Erro</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Notas Internas de Integração</label>
              <textarea
                value={config.notes}
                onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                rows={3}
                placeholder="Observações complementares fáticas sobre este barramento..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {feedback && (
            <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-100' : 'bg-rose-50 text-rose-900 border border-rose-100'
            }`}>
              <div className="flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{feedback.message}</span>
              </div>
              <button type="button" onClick={() => setFeedback(null)}>
                <X size={14} className="opacity-60 hover:opacity-100" />
              </button>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={testing}
                onClick={handleTestConnection}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:opacity-50 text-xs font-bold uppercase rounded-xl transition flex items-center gap-2 cursor-pointer"
              >
                <Play size={12} />
                <span>{testing ? 'Testando...' : 'Testar Conexão Real'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLogs(!showLogs)}
                className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold uppercase rounded-xl transition flex items-center gap-2"
              >
                <Terminal size={12} />
                <span>Logs</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {config.status !== 'não_configurado' && (
                <button
                  type="button"
                  onClick={handleDisable}
                  className="px-4 py-2 hover:bg-red-50 text-red-500 rounded-xl text-xs font-bold uppercase transition"
                >
                  Desativar
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Save size={14} />
                <span>{saving ? 'Gravando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* LOG PANEL */}
        {showLogs && (
          <div className="bg-slate-900 border border-slate-950 p-5 rounded-3xl text-slate-100 font-mono text-xs space-y-3 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex items-center gap-2">
                <Terminal size={14} className="text-indigo-400" />
                <span>Terminal Real-Time Logs — Google Agenda</span>
              </span>
              <button
                type="button"
                onClick={() => setShowLogs(false)}
                className="text-slate-400 hover:text-white font-sans text-xs font-semibold"
              >
                Ocultar
              </button>
            </div>

            <div className="max-h-[220px] overflow-y-auto space-y-1.5 bg-slate-950 p-4 rounded-2xl shadow-inner scrollbar-thin">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">Nenhum log gravado neste ciclo de visualização. Clique em "Testar Conexão Real" para obter dados fáticos.</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="leading-relaxed hover:bg-slate-900/60 p-0.5 rounded transition">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </BossLayout>
  );
}
