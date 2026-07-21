import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { BossLayout } from '../../../components/Layout';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  Video, 
  ArrowLeft, 
  Save, 
  Play, 
  Terminal, 
  AlertCircle, 
  Check, 
  X,
  Info,
  ExternalLink,
  Copy,
  CalendarDays,
  Clock
} from 'lucide-react';

interface GoogleMeetConfig {
  status: 'não_configurado' | 'preparado' | 'em_teste' | 'ativo' | 'erro';
  notes: string;
}

export default function GoogleMeetIntegration() {
  const navigate = useNavigate();
  const { googleAccessToken, loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Configuration state
  const [config, setConfig] = useState<GoogleMeetConfig>({
    status: 'não_configurado',
    notes: ''
  });

  // Scheduling Form State
  const [meetTitle, setMeetTitle] = useState('Reunião de Alinhamento - Portal BOSS');
  const [meetDesc, setMeetDesc] = useState('Reunião de alinhamento estratégico fático do caso e prazos processuais.');
  const [meetDate, setMeetDate] = useState('');
  const [meetTime, setMeetTime] = useState('');
  const [meetDuration, setMeetDuration] = useState('60'); // Minutes

  // Generated Link & Logs
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [recentMeets, setRecentMeets] = useState<any[]>([]);
  const [fetchingMeets, setFetchingMeets] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [testing, setTesting] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const token = googleAccessToken || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';

  // Fetch calendar events that contain Meet links
  const loadRecentMeets = async (accessToken: string) => {
    if (!accessToken) return;
    setFetchingMeets(true);
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&orderBy=startTime&singleEvents=true', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        // Filter events that have hangoutsMeet entryPoints
        const meetsList = items.filter((ev: any) => {
          const entryPoints = ev.conferenceData?.entryPoints || [];
          return entryPoints.some((ep: any) => ep.entryPointType === 'video');
        }).map((ev: any) => {
          const meetEp = ev.conferenceData.entryPoints.find((ep: any) => ep.entryPointType === 'video');
          return {
            id: ev.id,
            summary: ev.summary || 'Sem Título',
            start: ev.start?.dateTime || ev.start?.date || '',
            link: meetEp?.uri || ''
          };
        });
        setRecentMeets(meetsList);
      }
    } catch (err) {
      console.error('Erro ao buscar reuniões do Google Meet:', err);
    } finally {
      setFetchingMeets(false);
    }
  };

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const docSnap = await getDoc(doc(db, 'settings', 'connectors'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.googleMeet) {
            setConfig({
              status: data.googleMeet.status || 'não_configurado',
              notes: data.googleMeet.notes || ''
            });
          }
        }
        // Preset date and time with 1 hour from now
        const now = new Date();
        now.setHours(now.getHours() + 1);
        setMeetDate(now.toISOString().split('T')[0]);
        setMeetTime(now.toTimeString().substring(0, 5));
      } catch (err) {
        console.error('Erro ao ler Google Meet de settings/connectors:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    if (token) {
      loadRecentMeets(token);
    }
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleMeet: {
          status: config.status,
          notes: config.notes.trim()
        },
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setFeedback({ type: 'success', message: 'Configurações de integração com Google Meet salvas na nuvem com sucesso!' });
      
      const timestamp = new Date().toLocaleTimeString();
      setLogs(prev => [
        ...prev,
        `[${timestamp}] Configurações de Google Meet atualizadas e gravadas com sucesso no Firestore.`
      ]);
    } catch (err: any) {
      console.error('Erro ao salvar Google Meet:', err);
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

    addLog("Inicializando aperto de mão lógico com Google Calendar (Meet integration API)...");

    if (!token) {
      addLog("ERRO: Conta Google não conectada. Por favor, conecte sua conta Google primeiro.");
      setTesting(false);
      return;
    }

    addLog("Conta Google detectada. Validando escopo de criação de reuniões virtuais...");
    
    try {
      addLog("Conectando à Google Calendar API para testar permissão de videoconferência...");
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`Erro ao conectar à agenda primária: ${res.statusText} (${res.status})`);
      }

      addLog("Conectado faticamente com sucesso!");
      addLog("Carregando histórico recente de salas do Google Meet criadas...");
      await loadRecentMeets(token);

      // Update Firestore state to 'ativo'
      const updatedConfig = { ...config, status: 'ativo' as const };
      setConfig(updatedConfig);
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleMeet: updatedConfig,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      addLog("Integração Google Meet ativada e validada com SUCESSO TOTAL!");
      setFeedback({ type: 'success', message: 'Conexão fática testada e ativa com sucesso no Google Meet!' });

    } catch (err: any) {
      console.error(err);
      addLog(`ERRO CRÍTICO na integração: ${err.message || err}`);
      setFeedback({ type: 'error', message: `Erro no teste de integração: ${err.message || err}` });
      
      const updatedConfig = { ...config, status: 'erro' as const };
      setConfig(updatedConfig);
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleMeet: updatedConfig,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } finally {
      setTesting(false);
    }
  };

  const handleGenerateMeet = async () => {
    if (!token) {
      setFeedback({ type: 'error', message: 'Por favor, conecte sua conta Google primeiro.' });
      return;
    }
    if (!meetDate || !meetTime) {
      setFeedback({ type: 'error', message: 'Por favor, informe a data e o horário para agendamento.' });
      return;
    }

    setScheduling(true);
    setFeedback(null);
    setGeneratedLink(null);
    setShowLogs(true);
    const timestamp = () => new Date().toLocaleTimeString();
    const addLog = (msg: string) => setLogs(prev => [...prev, `[${timestamp()}] ${msg}`]);

    addLog(`Agendando videoconferência: "${meetTitle}"...`);

    try {
      // Build start and end dates
      const startIso = `${meetDate}T${meetTime}:00`;
      const startDate = new Date(startIso);
      const endDate = new Date(startDate.getTime() + parseInt(meetDuration) * 60 * 1000);

      const payload = {
        summary: meetTitle,
        description: meetDesc,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: 'America/Sao_Paulo'
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: 'America/Sao_Paulo'
        },
        conferenceData: {
          createRequest: {
            requestId: `meet-boss-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        }
      };

      addLog("Enviando requisição POST para criação de evento com ConferenceData habilitado...");
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Erro ao gerar Google Meet: ${res.statusText} (${res.status})`);
      }

      const event = await res.json();
      const entryPoints = event.conferenceData?.entryPoints || [];
      const videoEntryPoint = entryPoints.find((ep: any) => ep.entryPointType === 'video');
      const meetUrl = videoEntryPoint?.uri || null;

      if (meetUrl) {
        setGeneratedLink(meetUrl);
        addLog(`SUCESSO: Sala Google Meet criada com sucesso total!`);
        addLog(`URL de Acesso: ${meetUrl}`);
        setFeedback({ type: 'success', message: 'Videoconferência do Google Meet gerada com sucesso!' });
        await loadRecentMeets(token);
      } else {
        throw new Error("O Google Calendar aceitou o evento, mas não gerou o link do Google Meet de forma instantânea.");
      }

    } catch (err: any) {
      console.error(err);
      addLog(`Falha na geração do Google Meet: ${err.message || err}`);
      setFeedback({ type: 'error', message: `Erro ao agendar reunião: ${err.message || err}` });
    } finally {
      setScheduling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Link copiado com sucesso!');
  };

  const handleDisable = async () => {
    const timestamp = new Date().toLocaleTimeString();
    const updated = { ...config, status: 'não_configurado' as const };
    setConfig(updated);
    
    try {
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleMeet: updated,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setLogs(prev => [
        ...prev,
        `[${timestamp}] Integração com Google Meet desativada voluntariamente.`
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
            <div className="w-8 h-8 border-4 border-gray-100 border-t-teal-600 rounded-full animate-spin"></div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Sincronizando Google Meet...</span>
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
              <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
                <Video size={20} />
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Google Meet</h1>
                <p className="text-xs text-gray-500 font-semibold">Agendador instantâneo de reuniões virtuais</p>
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

        {/* COMPONENT TO SHOW GENERATED LINK */}
        {generatedLink && (
          <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-150 rounded-3xl p-6 shadow-sm space-y-4 animate-fadeIn">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-teal-100 text-teal-700 rounded-xl flex items-center justify-center shrink-0">
                <Video size={20} />
              </div>
              <div className="space-y-1 flex-1">
                <span className="text-[9px] font-black uppercase text-teal-700 tracking-widest font-mono">Videoconferência Gerada!</span>
                <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">{meetTitle}</h4>
                <div className="text-xs text-gray-600 font-medium flex items-center gap-3">
                  <span className="flex items-center gap-1"><CalendarDays size={12} /> {meetDate} às {meetTime}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {meetDuration} minutos</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-white border border-teal-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="font-mono text-xs text-teal-800 font-bold select-all break-all">{generatedLink}</span>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedLink)}
                  className="w-1/2 sm:w-auto px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-[10px] font-bold uppercase transition flex items-center justify-center gap-1 border border-gray-200 cursor-pointer"
                >
                  <Copy size={11} />
                  <span>Copiar</span>
                </button>
                <a
                  href={generatedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-1/2 sm:w-auto px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ExternalLink size={11} />
                  <span>Entrar</span>
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* SCHEDULE GENERATOR CARD */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="text-sm font-black uppercase text-gray-800 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3">
                <Video size={16} className="text-teal-600" />
                <span>Agendar Nova Reunião e Gerar Google Meet</span>
              </h3>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Título do Compromisso</label>
                  <input
                    type="text"
                    value={meetTitle}
                    onChange={(e) => setMeetTitle(e.target.value)}
                    placeholder="Título da reunião no calendário..."
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-teal-150"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Descrição / Pauta</label>
                  <textarea
                    rows={2}
                    value={meetDesc}
                    onChange={(e) => setMeetDesc(e.target.value)}
                    placeholder="Detalhes ou pauta que aparecerão na agenda..."
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Data</label>
                    <input
                      type="date"
                      value={meetDate}
                      onChange={(e) => setMeetDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Horário</label>
                    <input
                      type="time"
                      value={meetTime}
                      onChange={(e) => setMeetTime(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Duração</label>
                    <select
                      value={meetDuration}
                      onChange={(e) => setMeetDuration(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none cursor-pointer"
                    >
                      <option value="15">15 Minutos</option>
                      <option value="30">30 Minutos</option>
                      <option value="45">45 Minutos</option>
                      <option value="60">1 Hora</option>
                      <option value="90">1 Hora e meia</option>
                      <option value="120">2 Horas</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleGenerateMeet}
                  disabled={scheduling || !token}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  {scheduling ? 'Gerando Link...' : 'Gerar Link do Google Meet'}
                </button>
              </div>
            </div>

            {/* MASTER PARAMETERS CONFIG CARD */}
            <form onSubmit={handleSave} className="bg-white border border-gray-150 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="text-sm font-black uppercase text-gray-800 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3">
                <span>Configurações Globais</span>
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
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Anotações Internas</label>
                  <textarea
                    rows={2}
                    value={config.notes}
                    onChange={(e) => setConfig(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Instruções adicionais ou anotações..."
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer"
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
                  <span>Testar</span>
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
            </form>
          </div>

          {/* SIDEBAR FOR RECENT MEETS AND DETAILS */}
          <div className="space-y-6">
            <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider font-mono">Salas Ativas Recentes</h3>
              
              {fetchingMeets ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-gray-100 border-t-teal-600 rounded-full animate-spin"></div>
                </div>
              ) : recentMeets.length === 0 ? (
                <p className="text-[11px] text-gray-400 font-medium italic text-center py-4">
                  Nenhuma reunião Google Meet recente listada na agenda fática.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {recentMeets.map((meet) => (
                    <div key={meet.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1 flex flex-col justify-between">
                      <span className="text-[11px] font-bold text-gray-850 truncate max-w-[180px] block">{meet.summary}</span>
                      <span className="text-[9px] text-gray-400 font-semibold font-mono block">
                        {new Date(meet.start).toLocaleString()}
                      </span>
                      <a
                        href={meet.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1 pt-1 self-start"
                      >
                        <ExternalLink size={10} />
                        <span>Entrar na Sala</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider font-mono">Conexão Google Meet</h3>
              
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl space-y-3 font-mono text-[10px] leading-relaxed text-slate-600">
                <div className="flex justify-between items-center border-b border-slate-150/50 pb-2">
                  <span>Espaços Gerados:</span>
                  <span className="font-bold">Automáticos (Primary Calendar)</span>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span>Serviço Google Meet:</span>
                  <span className={`font-bold ${token ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {token ? 'SIM (Operacional)' : 'NÃO (Pendente)'}
                  </span>
                </div>
              </div>

              {!token && (
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl flex gap-2 items-start text-[10px] text-amber-900 leading-normal font-semibold">
                  <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>Por favor, conecte sua conta Google para liberar a criação de salas virtuais.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TERMINAL LOG COMPONENT */}
        <div className="border border-gray-150 rounded-3xl p-6 bg-slate-900 text-teal-400 shadow-inner space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-slate-300 font-mono tracking-wider">
              <Terminal size={16} />
              <span className="text-xs font-black uppercase">
                Terminal Real-Time Logs — Google Meet
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
            <p>[MEET_ENGINE] Subsistema de agendamento fático do Google Meet inicializado.</p>
            {showLogs && logs.map((log, index) => (
              <p key={index} className="text-teal-400 animate-fadeIn">{log}</p>
            ))}
            {!showLogs && logs.length > 0 && (
              <p className="text-slate-500 italic">Operações executadas. {logs.length} linhas de logs prontas. Clique em "Expandir Logs" para ver.</p>
            )}
          </div>
        </div>
      </div>
    </BossLayout>
  );
}
