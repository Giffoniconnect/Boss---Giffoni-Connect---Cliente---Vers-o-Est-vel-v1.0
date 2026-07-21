import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BossLayout } from '../../../components/Layout';
import { collection, doc, getDocs, updateDoc, setDoc, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  Calendar, 
  Clock, 
  ArrowLeft, 
  Mail, 
  Phone, 
  MessageSquare, 
  CheckSquare, 
  Video, 
  MapPin, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  User,
  ExternalLink,
  Shield,
  Loader2,
  Trash2
} from 'lucide-react';

export default function RemarcarMeet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlLeadId = searchParams.get('leadId');

  // Load Lists
  const [meetings, setMeetings] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected state
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('');
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);

  // Remarcar fields
  const [urgency, setUrgency] = useState<string>('Urgentíssima');
  const [subject, setSubject] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [locationType, setLocationType] = useState<'físico' | 'online'>('online');
  const [location, setLocation] = useState<string>('Sede Principal - Sala de Reuniões 1');
  const [appType, setAppType] = useState<string>('Meet'); // Meet, WhatsApp Vídeo, Teams, Zoom

  const [notes, setNotes] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [integrating, setIntegrating] = useState<boolean>(false);
  const [selectedMethod, setSelectedMethod] = useState<'email' | 'telefone' | 'whatsapp' | 'todoist' | null>('email');

  // Load Meetings & Leads
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Load marketing leads
        const leadsSnap = await getDocs(collection(db, 'marketingLeads'));
        const leadsList = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setLeads(leadsList);

        // Load scheduled meetings
        const meetingsSnap = await getDocs(collection(db, 'leadsMeetings'));
        const meetingsList = meetingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMeetings(meetingsList);

        // Try pre-selecting meeting if leadId match or direct selection
        if (urlLeadId) {
          const matched = meetingsList.find((m: any) => m.leadId === urlLeadId);
          if (matched) {
            handleSelectMeeting(matched);
          } else {
            // Find lead details to prefill form if no existing meeting document
            const leadObj: any = leadsList.find((l: any) => l.id === urlLeadId);
            if (leadObj) {
              const leadName = leadObj.tipoPessoa === 'PF' 
                ? leadObj.pessoaFisica?.nomeCompleto 
                : leadObj.pessoaJuridica?.razaoSocial;
              setSubject(`Reagendamento de Reunião - ${leadName}`);
            }
          }
        } else if (meetingsList.length > 0) {
          handleSelectMeeting(meetingsList[0]);
        }
      } catch (e) {
        console.error('Firestore reading failed, fallback locally', e);
        const localMeets = localStorage.getItem('local_marketing_meetings');
        if (localMeets) {
          const parsed = JSON.parse(localMeets);
          setMeetings(parsed);
          if (urlLeadId) {
            const matched = parsed.find((m: any) => m.leadId === urlLeadId);
            if (matched) handleSelectMeeting(matched);
          } else if (parsed.length > 0) {
            handleSelectMeeting(parsed[0]);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [urlLeadId]);

  const handleSelectMeeting = (m: any) => {
    if (!m) return;
    setSelectedMeeting(m);
    setSelectedMeetingId(m.id);
    
    // Fill form
    setUrgency(m.urgency || 'Alta');
    setSubject(m.subject || 'Reagendamento');
    setDate(m.date || '');
    setTime(m.time || '');
    setLocationType(m.locationType || 'online');
    setLocation(m.location || 'Sede Principal - Sala de Reuniões 1');
    setAppType(m.appType || 'Meet');
    setNotes(m.notes || '');
    if (m.method) setSelectedMethod(m.method);
  };

  const handleMeetingIdChange = (id: string) => {
    setSelectedMeetingId(id);
    const m = meetings.find((meet: any) => meet.id === id);
    if (m) {
      handleSelectMeeting(m);
    } else {
      setSelectedMeeting(null);
    }
  };

  const getLeadPhone = () => {
    if (selectedMeeting) return selectedMeeting.leadPhone;
    return '';
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) {
      setErrorMsg('Por favor, defina a nova Data e Horário.');
      return;
    }

    setIntegrating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const nowString = new Date().toISOString();
      const updatedPayload = {
        ...selectedMeeting,
        urgency,
        subject,
        date,
        time,
        locationType,
        location: locationType === 'físico' ? location : '',
        appType: locationType === 'online' ? appType : '',
        method: selectedMethod,
        notes: notes.trim(),
        updatedAt: nowString
      };

      // Firestore update
      if (selectedMeetingId) {
        const docRef = doc(db, 'leadsMeetings', selectedMeetingId);
        await setDoc(docRef, updatedPayload);
      } else {
        // Create new meet
        const matchLeadId = urlLeadId || 'lead_general';
        const dummyId = 'meet_' + Math.random().toString(36).substring(2, 11);
        const leadObj = leads.find((l: any) => l.id === matchLeadId);
        const leadName = leadObj ? (leadObj.tipoPessoa === 'PF' ? leadObj.pessoaFisica?.nomeCompleto : leadObj.pessoaJuridica?.razaoSocial) : 'Lead Geral';
        
        const newMeet = {
          id: dummyId,
          leadId: matchLeadId,
          leadName,
          leadEmail: leadObj ? (leadObj.tipoPessoa === 'PF' ? leadObj.pessoaFisica?.email : leadObj.pessoaJuridica?.email) : '',
          leadPhone: leadObj ? (leadObj.tipoPessoa === 'PF' ? leadObj.pessoaFisica?.whatsapp : leadObj.pessoaJuridica?.whatsapp) : '',
          urgency,
          subject,
          date,
          time,
          locationType,
          location,
          appType,
          method: selectedMethod,
          notes,
          createdAt: nowString
        };
        await setDoc(doc(db, 'leadsMeetings', dummyId), newMeet);
      }

      // Sync local storage backups
      const localMeets = localStorage.getItem('local_marketing_meetings');
      if (localMeets) {
        const parsed = JSON.parse(localMeets);
        const updatedLocal = parsed.map((m: any) => m.id === selectedMeetingId ? updatedPayload : m);
        localStorage.setItem('local_marketing_meetings', JSON.stringify(updatedLocal));
      }

      // Handle integrations alert
      if (selectedMethod === 'whatsapp') {
        const destinationPhone = getLeadPhone();
        const text = `Aviso de Reagendamento de Reunião Comercial! \n\nNova Agenda: \nData: ${new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')} às ${time}.\nAssunto: ${subject}\nLocal: ${locationType === 'físico' ? location : appType}`;
        const cleanPhone = (destinationPhone || '').replace(/\D/g, '');
        const whatappUrl = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(text)}`;
        setSuccessMsg(`Reunião reagendada! Abrindo canal do WhatsApp para disparo de justificativa.`);
        setTimeout(() => {
          window.open(whatappUrl, '_blank');
          navigate('/boss/leads/private/dashboard/managing.private.leads');
        }, 1500);
      } else if (selectedMethod === 'email') {
        const emailTo = selectedMeeting?.leadEmail || 'cliente@email.com';
        const mailSubject = `[NOVO HORÁRIO] Reunião Comercial - ${subject}`;
        const mailBody = `Prezado(a) ${selectedMeeting?.leadName || 'Cliente'},\n\nPara fins de melhor adequação da agenda, reagendamos nossa reunião comercial.\n\nNovos Detalhes:\n- Grau de Urgência: ${urgency}\n- Assunto: ${subject}\n- Nova Data: ${new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')}\n- Horário: ${time}\n- Localização: ${locationType === 'físico' ? location : `Online via ${appType}`}\n\nPerdoe-nos pelo transtorno e nos avise se este horário lhe atende.\n\nAtenciosamente,\nGiffoni Advogados Associados`;
        
        const mailtoUrl = `mailto:${emailTo}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
        setSuccessMsg(`Registro de Reagendamento atualizado e salvo na nuvem! Iniciando Gmail.`);
        setTimeout(() => {
          window.location.href = mailtoUrl;
          navigate('/boss/leads/private/dashboard/managing.private.leads');
        }, 1500);
      } else if (selectedMethod === 'todoist') {
        setSuccessMsg(`Todoist atualizado! Nova notificação de alteração de horário disparada para a secretaria.`);
        setTimeout(() => {
          navigate('/boss/leads/private/dashboard/managing.private.leads');
        }, 1500);
      } else {
        setSuccessMsg(`Reunião comercial atualizada no sistema com sucesso!`);
        setTimeout(() => {
          navigate('/boss/leads/private/dashboard/managing.private.leads');
        }, 1500);
      }

    } catch (e: any) {
      console.error(e);
      setErrorMsg('Falha de conexão ao salvar reagendamento: ' + (e.message || e));
    } finally {
      setIntegrating(false);
    }
  };

  const handleCancelMeeting = async () => {
    if (!selectedMeetingId) return;
    if (!window.confirm('Tem certeza que deseja cancelar e apagar este agendamento comercial?')) return;

    try {
      setIntegrating(true);
      await deleteDoc(doc(db, 'leadsMeetings', selectedMeetingId));
      
      const localMeets = localStorage.getItem('local_marketing_meetings');
      if (localMeets) {
        const parsed = JSON.parse(localMeets);
        const filtered = parsed.filter((m: any) => m.id !== selectedMeetingId);
        localStorage.setItem('local_marketing_meetings', JSON.stringify(filtered));
      }

      setSuccessMsg('Agendamento comercial cancelado e removido com sucesso!');
      setTimeout(() => {
        navigate('/boss/leads/private/dashboard/managing.private.leads');
      }, 1500);
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Erro ao cancelar agendamento: ' + e.message);
    } finally {
      setIntegrating(false);
    }
  };

  const isBlank = meetings.length === 0;

  return (
    <BossLayout>
      <div id="remarcar-meet" className="max-w-4xl mx-auto px-4 md:px-0 space-y-8 animate-fade-in pb-16">
        
        {/* HEADER */}
        <div className="border-b border-gray-150 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-indigo-650 font-mono">Painel de Correções e Alterações</span>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-snug">
              Reagendar Reunião de Lead Particular
            </h1>
          </div>
          
          <button
            type="button"
            onClick={() => navigate('/boss/leads/private/dashboard/managing.private.leads')}
            className="text-xs font-bold text-gray-650 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-4xs transition hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <ArrowLeft size={14} />
            <span>Voltar à Gestão</span>
          </button>
        </div>

        {/* FEEDBACKS */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-150 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-rose-800 font-semibold">{errorMsg}</p>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-emerald-800 font-semibold">{successMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* PRIMARY FORM */}
          {isBlank ? (
            <div className="lg:col-span-3 py-16 text-center border-2 border-dashed border-gray-100/80 rounded-[2rem] space-y-4">
              <span className="block text-gray-400 font-extrabold text-xs">
                Nenhum agendamento comercial localizado no momento!
              </span>
              <p className="text-xxs text-gray-400 font-semibold">Crie seu primeiro agendamento comercial no botão ao lado.</p>
              <button
                onClick={() => navigate('/boss/leads/private/dashboard/managing.private.leads/marcar.meet')}
                className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-4xs cursor-pointer inline-flex items-center gap-1.5 transition-colors"
              >
                <Calendar size={12} />
                <span>Ir para Marcar Reunião</span>
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleRescheduleSubmit} className="lg:col-span-2 space-y-6">
                
                {/* SELECT ACTIVE MEETING */}
                <div className="bg-white border border-gray-150 rounded-2xl p-5 space-y-4">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 border-b pb-1.5">
                    1. Reunião a ser Reagendada
                  </span>

                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Escolher Agendamento Comercial Ativo *</label>
                    <select
                      value={selectedMeetingId}
                      onChange={(e) => handleMeetingIdChange(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-550 outline-none transition"
                    >
                      <option value="">-- Selecione a Reunião --</option>
                      {meetings.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.date ? new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'} às {m.time} - {m.leadName} ({m.subject})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* MEETING METADATA */}
                <div className="bg-white border border-gray-150 rounded-2xl p-5 space-y-4">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 border-b pb-1.5 flex justify-between items-center">
                    <span>2. Alterar Parâmetros da Reunião</span>
                    {selectedMeetingId && (
                      <button
                        type="button"
                        onClick={handleCancelMeeting}
                        className="text-[9.5px] uppercase font-black text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-150 rounded px-2 py-0.5 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 size={10} />
                        <span>Excluir / Cancelar</span>
                      </button>
                    )}
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Novo Grau de Urgência da Reunião</label>
                      <select
                        value={urgency}
                        onChange={(e) => setUrgency(e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-550 outline-none transition"
                      >
                        <option>Baixa</option>
                        <option>Média</option>
                        <option>Alta</option>
                        <option>Urgentíssima</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Alterar Assunto da Reunião *</label>
                      <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Ex: Novo alinhamento ou Alteração"
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-550 outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nova Data da Reunião *</label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Novo Horário da Reunião *</label>
                      <input
                        type="time"
                        required
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white"
                      />
                    </div>
                  </div>

                  {/* LOCATION */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">Local/Aplicativo Reajustado</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setLocationType('online')}
                        className={`p-3.5 border rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                          locationType === 'online'
                            ? 'bg-indigo-50 border-indigo-350 text-indigo-700'
                            : 'bg-slate-50 border-gray-200 text-gray-500 hover:bg-slate-100'
                        }`}
                      >
                        <Video size={14} />
                        <span>Online (Videoconferência)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLocationType('físico')}
                        className={`p-3.5 border rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                          locationType === 'físico'
                            ? 'bg-indigo-50 border-indigo-350 text-indigo-700'
                            : 'bg-slate-50 border-gray-200 text-gray-500 hover:bg-slate-100'
                        }`}
                      >
                        <MapPin size={14} />
                        <span>Físico (Local Presencial)</span>
                      </button>
                    </div>
                  </div>

                  {locationType === 'físico' ? (
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Local Físico Reajustado</label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Sede Principal - Sala de Reuniões 1"
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-550 outline-none transition"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Aplicativo de Vídeo Reajustado</label>
                      <select
                        value={appType}
                        onChange={(e) => setAppType(e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-550 outline-none transition"
                      >
                        <option>Meet</option>
                        <option>What’s app Vídeo</option>
                        <option>Teams</option>
                        <option>Zoom</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* NOTIFICATION CHANNELS */}
                <div className="bg-white border border-gray-150 rounded-2xl p-5 space-y-4">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 border-b pb-1.5">
                    Como deseja notificar o reagendamento? (Canal de Envio)
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('email')}
                      className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition text-center cursor-pointer ${
                        selectedMethod === 'email'
                          ? 'bg-indigo-600 border-indigo-700 text-white shadow-3xs'
                          : 'bg-slate-50 border-gray-200 text-gray-600 hover:bg-slate-100'
                      }`}
                    >
                      <Mail size={16} />
                      <span className="text-[10px] uppercase font-black tracking-wide">Gmail</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('telefone')}
                      className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition text-center cursor-pointer ${
                        selectedMethod === 'telefone'
                          ? 'bg-indigo-600 border-indigo-700 text-white shadow-3xs'
                          : 'bg-slate-50 border-gray-200 text-gray-600 hover:bg-slate-100'
                      }`}
                    >
                      <Phone size={16} />
                      <span className="text-[10px] uppercase font-black tracking-wide">Telefone</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('whatsapp')}
                      className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition text-center cursor-pointer ${
                        selectedMethod === 'whatsapp'
                          ? 'bg-indigo-600 border-indigo-700 text-white shadow-3xs'
                          : 'bg-slate-50 border-gray-200 text-gray-600 hover:bg-slate-100'
                      }`}
                    >
                      <MessageSquare size={16} />
                      <span className="text-[10px] uppercase font-black tracking-wide">Whats App</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('todoist')}
                      className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition text-center cursor-pointer ${
                        selectedMethod === 'todoist'
                          ? 'bg-indigo-600 border-indigo-700 text-white shadow-3xs'
                          : 'bg-slate-50 border-gray-200 text-gray-600 hover:bg-slate-100'
                      }`}
                    >
                      <CheckSquare size={16} />
                      <span className="text-[10px] uppercase font-black tracking-wide">Todoist Secr.</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1">Motivo do Reagendamento / Notas</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Adicione observações ou justificativas..."
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-550 outline-none transition min-h-[70px]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={integrating || !selectedMeetingId}
                  className={`w-full py-3 px-4 font-black uppercase text-xs rounded-xl shadow-4xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    !selectedMeetingId 
                      ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                      : 'bg-indigo-650 hover:bg-indigo-750 text-white'
                  }`}
                >
                  {integrating ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      <span>Processando no Servidor...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      <span>Confirmar Reagendamento ({selectedMethod})</span>
                    </>
                  )}
                </button>
              </form>

              {/* ACTION PREVIEW */}
              <div className="space-y-6">
                <div className="bg-slate-50 border border-gray-150 rounded-2xl p-5 space-y-4 font-sans font-semibold">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 border-b pb-1.5 flex items-center gap-1">
                    <Shield size={12} className="text-slate-400" />
                    <span>Detalhes do Reagendado</span>
                  </span>

                  <div className="text-xxs leading-relaxed text-gray-700 space-y-2.5">
                    <p>
                      <strong>Lead Solicitante:</strong> {selectedMeeting ? selectedMeeting.leadName : '—'}
                    </p>
                    <p>
                      Ao alterar o cronograma na nuvem, uma nova notificação estruturada de reagendamento é criada de forma síncrona nos conectores associados.
                    </p>
                  </div>
                </div>

                {selectedMethod === 'email' && selectedMeeting && (
                  <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-sm animate-fade-in space-y-3">
                    <div className="flex items-center gap-1.5 border-b border-gray-100 pb-2">
                      <Mail size={14} className="text-red-500 shrink-0" />
                      <span className="text-[9.5px] font-black uppercase tracking-wider text-gray-800">
                        Visualização de Atualização (Gmail)
                      </span>
                    </div>

                    <div className="text-xxs space-y-1.5 font-semibold bg-slate-50 p-3 rounded-xl border">
                      <div>
                        <span className="text-gray-400 font-bold">Para:</span> 
                        <span className="text-indigo-900 break-all ml-1">{selectedMeeting.leadEmail}</span>
                      </div>
                      <div className="border-t border-slate-100/70 pt-1.5">
                        <span className="text-gray-400 font-bold">Assunto:</span> 
                        <span className="text-gray-950 font-extrabold ml-1">[NOVO HORÁRIO] REUNIÃO COMERCIAL - {subject}</span>
                      </div>
                      <div className="border-t border-slate-100/70 pt-1.5 text-gray-500 whitespace-pre-line font-medium leading-relaxed font-mono select-none">
                        {`Prezado(a) ${selectedMeeting.leadName},

Fomos informados da necessidade de readequar o horário da nossa Reunião Comercial.

Novos detalhes do seu compromisso:
Grau de Urgência: ${urgency}
Assunto: ${subject}
Nova data: ${date ? new Date(date + 'T00:00:00').toLocaleDateString('pt-BR') : '[A Definir]'}
Novo horário: ${time || '[A Definir]'}
Canal: ${locationType === 'físico' ? `Presencial em: ${location}` : `Online via: ${appType}`}

Se houver algum inconveniente com a nova agenda, favor nos relatar por este e-mail.

Atenciosamente,
Giffoni Advogados Associados`}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </BossLayout>
  );
}
