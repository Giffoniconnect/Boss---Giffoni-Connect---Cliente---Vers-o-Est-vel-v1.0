import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import { ArrowLeft, ArrowRight, Save, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';

export default function AudienciasFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [caseObj, setCaseObj] = useState<any>(null);

  const [audienciaMarked, setAudienciaMarked] = useState(false);
  const [audienciaDate, setAudienciaDate] = useState('');
  const [audienciaTime, setAudienciaTime] = useState('');
  const [audienciaLocal, setAudienciaLocal] = useState('');
  const [audienciaJuizo, setAudienciaJuizo] = useState('');
  const [audienciaType, setAudienciaType] = useState('presencial');
  const [audienciaPlatformType, setAudienciaPlatformType] = useState('zoom');
  const [audienciaLink, setAudienciaLink] = useState('');
  const [audienciaClienteAvisado, setAudienciaClienteAvisado] = useState(false);

  // Google Calendar Integration States
  const [checkingCalendar, setCheckingCalendar] = useState(false);
  const [calendarConfigStatus, setCalendarConfigStatus] = useState<string>('carregando');
  const [calendarLogs, setCalendarLogs] = useState<string[]>([]);
  const [googleEvent, setGoogleEvent] = useState<any>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [sameEventFound, setSameEventFound] = useState(false);
  const [sameEvent, setSameEvent] = useState<any>(null);
  const [logOpen, setLogOpen] = useState(false);

  const addLog = (msg: string) => {
    setCalendarLogs(prev => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`]);
  };

  useEffect(() => {
    if (caseObj?.protocol?.audienciaGoogleCalendar) {
      setGoogleEvent(caseObj.protocol.audienciaGoogleCalendar);
    }
  }, [caseObj]);

  const handleGoogleCalendarSync = async () => {
    if (!audienciaDate || !audienciaTime) {
      setError('Por favor, defina a data e o horário da audiência antes de agendar no Google Calendar.');
      return;
    }

    setCheckingCalendar(true);
    setConflicts([]);
    setSameEventFound(false);
    setSameEvent(null);
    setCalendarLogs([]);

    addLog('Iniciando fluxo de automação do Google Calendar no setor de audiências.');

    const token = localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';
    if (!token) {
      addLog('Falha: Token do Google não encontrado. Operador não autenticado.');
      setError('Você precisa fazer login com sua conta Google para agendar compromissos. Acesse Configurações > Integrações.');
      setCheckingCalendar(false);
      return;
    }

    addLog('Token de acesso Google localizado com sucesso.');

    try {
      addLog('Verificando status de configuração da integração na Firestore...');
      const conflictRes = await fetch('/api/calendar/check-conflicts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          caseId,
          googleAccessToken: token,
          date: audienciaDate,
          time: audienciaTime,
          type: 'audiencia',
          local: audienciaLocal,
          link: audienciaLink
        })
      });

      if (!conflictRes.ok) {
        const errData = await conflictRes.json();
        addLog(`Erro técnico na validação de conflitos: ${errData.error}`);
        setError(errData.error || 'Erro ao consultar conflitos.');
        setCheckingCalendar(false);
        return;
      }

      const conflictData = await conflictRes.json();
      setCalendarConfigStatus('ativo');
      addLog('Integração com Google Calendar ativa na base de dados Firestore.');
      addLog(`Calendário utilizado: ${conflictData.calendarId}`);

      if (conflictData.sameEventFound) {
        setSameEventFound(true);
        setSameEvent(conflictData.sameEvent);
        addLog(`Atenção: Evento idêntico/repetido detectado para este caso! Título: "${conflictData.sameEvent.summary}"`);
        addLog('O sistema identificou as mesmas partes, data e horário para evitar duplicidade de evento.');
        setCheckingCalendar(false);
        return;
      }

      if (conflictData.conflicts && conflictData.conflicts.length > 0) {
        setConflicts(conflictData.conflicts);
        addLog(`Atenção: Encontrados ${conflictData.conflicts.length} conflitos reais de agenda no mesmo intervalo!`);
        for (const conf of conflictData.conflicts) {
          addLog(`Conflito: "${conf.title}" no local "${conf.location}"`);
        }
        setCheckingCalendar(false);
        return;
      }

      addLog('Nenhum conflito ou duplicidade detectada na agenda. Prosseguindo para criação do evento...');
      await executeEventCreation(token);

    } catch (err: any) {
      addLog(`Erro crítico durante a automação: ${err.message}`);
      setError(`Falha ao sincronizar com Google Calendar: ${err.message}`);
      setCheckingCalendar(false);
    }
  };

  const executeEventCreation = async (tokenOverride?: string) => {
    const token = tokenOverride || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';
    setCheckingCalendar(true);
    try {
      addLog('Formatando título, fatiamento e dados sugeridos conforme padrão Giffoni...');
      const createRes = await fetch('/api/calendar/create-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          caseId,
          googleAccessToken: token,
          date: audienciaDate,
          time: audienciaTime,
          type: 'audiencia',
          local: audienciaLocal,
          link: audienciaLink,
          juizo: audienciaJuizo,
          audienciaType,
          observacoes: 'Gerado via automação do setor de audiências.'
        })
      });

      if (!createRes.ok) {
        const errData = await createRes.json();
        addLog(`Erro técnico ao registrar evento no Google Calendar: ${errData.error}`);
        setError(errData.error || 'Erro ao criar evento.');
        setCheckingCalendar(false);
        return;
      }

      const eventData = await createRes.json();
      setGoogleEvent(eventData);
      addLog(`Sucesso! Evento criado com ID ${eventData.eventId}`);
      addLog(`Link gerado: ${eventData.htmlLink}`);
      addLog('Metadata salvo permanentemente no Firestore sob o protocolo do caso.');
      setSuccess('Audiência agendada no Google Calendar com sucesso!');
    } catch (err: any) {
      addLog(`Erro de comunicação com API ao registrar evento: ${err.message}`);
      setError(`Erro ao criar evento no Google Calendar: ${err.message}`);
    } finally {
      setCheckingCalendar(false);
    }
  };

  useEffect(() => {
    if (!caseId) return;

    async function fetchData() {
      try {
        setLoading(true);
        const caseRef = doc(db, 'cases', caseId!);
        const caseSnap = await getDoc(caseRef);

        if (caseSnap.exists()) {
          const cData = caseSnap.data();
          setCaseObj(cData);
          
          const rawProtocol = cData.protocol || {};
          setAudienciaMarked(rawProtocol.audienciaMarked ?? false);
          setAudienciaDate(rawProtocol.audienciaDate || '');
          setAudienciaTime(rawProtocol.audienciaTime || '');
          setAudienciaLocal(rawProtocol.audienciaLocal || '');
          setAudienciaJuizo(rawProtocol.audienciaJuizo || '');
          setAudienciaType(rawProtocol.audienciaType || 'presencial');
          setAudienciaPlatformType(rawProtocol.audienciaPlatformType || 'zoom');
          setAudienciaLink(rawProtocol.audienciaLink || '');
          setAudienciaClienteAvisado(rawProtocol.audienciaClienteAvisado ?? false);
        }
      } catch (err: any) {
        setError(`Erro ao carregar dados: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [caseId]);

  const handleSave = async (action: 'none' | 'advance' | 'exit' = 'none') => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const caseRef = doc(db, 'cases', caseId!);

      await updateDoc(caseRef, {
        'protocol.audienciaMarked': audienciaMarked,
        'protocol.audienciaDate': audienciaDate,
        'protocol.audienciaTime': audienciaTime,
        'protocol.audienciaLocal': audienciaLocal,
        'protocol.audienciaJuizo': audienciaJuizo,
        'protocol.audienciaType': audienciaType,
        'protocol.audienciaPlatformType': audienciaPlatformType,
        'protocol.audienciaLink': audienciaLink,
        'protocol.audienciaClienteAvisado': audienciaClienteAvisado,
      });

      setSuccess('Audiência salva com sucesso!');

      if (action === 'exit') {
        navigate('/boss-giffoni-clientes/fluxo-producao');
      } else if (action === 'advance') {
        navigate(flowRoutes.agendarPericia(caseId!));
      }
    } catch (err: any) {
      setError(`Erro ao salvar audiência: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Audiências" caseId={caseId}>
        <div className="p-16 text-center text-gray-400">Carregando...</div>
      </FluxoStepLayout>
    );
  }

  return (
    <FluxoStepLayout
      stepName="Audiências"
      caseId={caseId}
      statusText={caseObj?.statusInterno || 'Em andamento'}
    >
      <div className="space-y-8 font-sans">
        {error && (
          <div className="p-5 bg-red-50 border border-red-150 rounded-2xl text-red-955 text-xs flex gap-3 items-center">
            <AlertCircle size={18} className="text-red-650 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-5 bg-emerald-50 border border-emerald-150 rounded-2xl text-emerald-950 text-xs flex gap-3 items-center">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        <div className="border border-gray-150 rounded-3xl p-6 bg-white shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={16} /> Audiências
              </h3>
              <p className="text-xs text-gray-400 mt-1">Tem audiência agendada para este caso?</p>
            </div>
            <div className="flex gap-1.5 border border-gray-200 p-1.5 rounded-2xl bg-gray-50/50">
              <button
                type="button"
                onClick={() => setAudienciaMarked(true)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  audienciaMarked ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setAudienciaMarked(false)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  !audienciaMarked ? 'bg-gray-250 text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Não
              </button>
            </div>
          </div>

          {audienciaMarked && (
            <div className="space-y-5 animate-in slide-in-from-top-3 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Dia da Audiência</label>
                  <input
                    type="date"
                    value={audienciaDate}
                    onChange={(e) => setAudienciaDate(e.target.value)}
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Horário da Sessão</label>
                  <input
                    type="time"
                    value={audienciaTime}
                    onChange={(e) => setAudienciaTime(e.target.value)}
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Vara / Juízo Designado</label>
                  <input
                    type="text"
                    value={audienciaJuizo}
                    onChange={(e) => setAudienciaJuizo(e.target.value)}
                    placeholder="Ex: Vara de Família de Osasco"
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold placeholder-gray-300"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                    {audienciaType === 'presencial' ? 'Endereço Completo da Audiência *' : 'Local ou Fórum'}
                  </label>
                  <input
                    type="text"
                    value={audienciaLocal}
                    onChange={(e) => setAudienciaLocal(e.target.value)}
                    placeholder={audienciaType === 'presencial' ? 'Informe o endereço físico completo da audiência' : 'Rua fática do Fórum ou Tribunal'}
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold placeholder-gray-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Modalidade</label>
                  <div className="flex gap-2 border border-gray-150 p-1 rounded-xl bg-gray-50/55 h-[38px] items-center">
                    <button type="button" onClick={() => setAudienciaType('presencial')} className={`flex-1 text-center text-[11px] font-bold py-1 rounded-lg ${audienciaType === 'presencial' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>Presencial</button>
                    <button type="button" onClick={() => setAudienciaType('online')} className={`flex-1 text-center text-[11px] font-bold py-1 rounded-lg ${audienciaType === 'online' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>Online</button>
                  </div>
                </div>

                {audienciaType === 'online' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Tipo de Sistema</label>
                      <select value={audienciaPlatformType} onChange={(e) => setAudienciaPlatformType(e.target.value)} className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-bold h-[38px]">
                        <option value="MEET">MEET</option>
                        <option value="Zoom">Zoom</option>
                        <option value="Microsoft TEAMS">Microsoft TEAMS</option>
                        <option value="Cisco Webex">Cisco Webex</option>
                        <option value="outro">outro (blancket)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Link de Conexão Virtual</label>
                      <input type="text" value={audienciaLink} onChange={(e) => setAudienciaLink(e.target.value)} placeholder="https://..." className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-mono" />
                    </div>
                  </>
                )}

                <div className="md:col-span-3 flex items-center gap-3 bg-emerald-50/50 p-3.5 border border-emerald-100 rounded-2xl">
                  <input type="checkbox" id="audienciaClienteAvisado" checked={audienciaClienteAvisado} onChange={(e) => setAudienciaClienteAvisado(e.target.checked)} className="w-4.5 h-4.5 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer text-indigo-600" />
                  <label htmlFor="audienciaClienteAvisado" className="text-xs text-emerald-950 font-bold select-none cursor-pointer">
                    O cliente foi devidamente avisado faticamente de todos os detalhes desta audiência?
                  </label>
                </div>
              </div>

              {/* Google Calendar Integration Sector */}
              <div className="mt-6 border-t border-gray-150 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                      <Calendar size={14} className="text-indigo-600" /> Integração Google Calendar
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">Sincronize esta audiência diretamente com a agenda do escritório.</p>
                  </div>
                  {googleEvent && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-150 rounded-lg px-2.5 py-1 font-bold flex items-center gap-1 animate-in fade-in">
                      <CheckCircle2 size={12} className="text-emerald-600" /> Agendado no Google
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {!googleEvent ? (
                    <button
                      type="button"
                      disabled={checkingCalendar || !audienciaDate || !audienciaTime}
                      onClick={handleGoogleCalendarSync}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      <Calendar size={14} />
                      {checkingCalendar ? 'Consultando Agenda...' : 'Agendar automaticamente a audiência'}
                    </button>
                  ) : (
                    <a
                      href={googleEvent.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
                    >
                      <Calendar size={14} />
                      Ver audiência agendada
                    </a>
                  )}

                  {conflicts.length > 0 && (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-2 bg-gray-100 text-gray-400 border border-gray-200 px-4 py-2.5 rounded-xl font-bold text-xs cursor-not-allowed"
                    >
                      Resolver conflito de audiência (Futuro)
                    </button>
                  )}
                </div>

                {/* Same Event detected warning */}
                {sameEventFound && sameEvent && (
                  <div className="p-4 bg-blue-50 border border-blue-150 rounded-2xl space-y-2 text-xs animate-in slide-in-from-top-2">
                    <div className="flex gap-2.5 items-center text-blue-900 font-bold">
                      <AlertCircle size={16} className="text-blue-600" />
                      <span>Audiência Repetida Detectada</span>
                    </div>
                    <p className="text-blue-800 text-[11px]">
                      Identificamos que já existe um evento para este caso com o título <strong>"{sameEvent.summary}"</strong> na mesma data e horário.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <a
                        href={sameEvent.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] inline-flex items-center gap-1"
                      >
                        Ver compromisso existente
                      </a>
                      <button
                        type="button"
                        onClick={() => executeEventCreation()}
                        className="bg-transparent hover:bg-blue-100 text-blue-700 border border-blue-250 px-3 py-1.5 rounded-lg font-bold text-[10px]"
                      >
                        Forçar novo agendamento
                      </button>
                    </div>
                  </div>
                )}

                {/* Real Conflict detected warning */}
                {conflicts.length > 0 && (
                  <div className="p-4 bg-orange-50 border border-orange-150 rounded-2xl space-y-2 text-xs animate-in slide-in-from-top-2">
                    <div className="flex gap-2.5 items-center text-orange-950 font-bold">
                      <AlertCircle size={16} className="text-orange-600" />
                      <span>Conflito Real de Horário</span>
                    </div>
                    <p className="text-orange-900 text-[11px]">
                      Atenção: Existem outros compromissos agendados no mesmo horário na agenda do escritório:
                    </p>
                    <ul className="space-y-1.5 pl-4 text-orange-900 text-[11px] list-disc">
                      {conflicts.map((c, i) => (
                        <li key={i}>
                          <strong>{c.title}</strong> - Local: {c.location || 'Não especificado'}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => executeEventCreation()}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg font-bold text-[10px]"
                      >
                        Forçar agendamento (Ignorar conflitos)
                      </button>
                    </div>
                  </div>
                )}

                {/* Automation Console log section */}
                <div className="border border-gray-150 rounded-2xl overflow-hidden bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setLogOpen(!logOpen)}
                    className="w-full flex items-center justify-between p-3.5 bg-gray-100 hover:bg-gray-150 transition-all border-none outline-none text-left cursor-pointer"
                  >
                    <span className="text-[10px] font-black uppercase text-gray-600 tracking-wider">
                      Log Técnico da Automação de Audiências — Google Calendar
                    </span>
                    <span className="text-xs font-bold text-gray-500">{logOpen ? 'Ocultar' : 'Exibir'}</span>
                  </button>
                  {logOpen && (
                    <div className="p-4 font-mono text-[9px] text-gray-600 space-y-1 max-h-48 overflow-y-auto bg-gray-900 text-emerald-400">
                      {calendarLogs.length === 0 ? (
                        <span className="text-gray-500 italic">Nenhum log gerado para esta sessão.</span>
                      ) : (
                        calendarLogs.map((log, i) => (
                          <div key={i}>{log}</div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(flowRoutes.prazos(caseId!))}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            <ArrowLeft size={14} />
            Voltar para Prazos
          </button>
          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('none')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-700 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              <Save size={13} />
              {saving ? 'Gravando...' : 'Salvar Audiência'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('exit')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-950 text-gray-900 hover:bg-gray-50 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              Salvar e Sair
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('advance')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
            >
              <span>Salvar e Avançar</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </FluxoStepLayout>
  );
}
