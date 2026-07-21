import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Info,
  ShieldCheck,
  FileCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  Lock,
  User,
  Calendar,
  Layers,
  Loader2,
  HardDrive,
  Plus,
  Trash2,
  Copy,
  Check,
  Clock,
  Eye,
  Activity,
  Award,
  ChevronRight,
  CheckSquare
} from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';

interface ExtendedProtocolData {
  protocolResponsible: string;
  expectedProtocolDate: string;
  actualProtocolDate: string;
  protocolSystem: string;
  protocolStatus: 'nao_preparado' | 'aguardando_revisao' | 'pronto_para_protocolar' | 'agendado' | 'protocolado' | 'devolvido' | 'cancelado';
  processNumber: string;
  protocolReceiptName: string;
  protocolReceiptUrl: string;
  googleDriveFileId: string;
  googleDrivePrepared: boolean;
  notes: string;
  convertedToJudicialCase: boolean;
  completedAt: string;
  updatedAt: string;

  // Step 1.10.1.1 fields
  clientsList: string[];
  exAdversosList: string[];
  subject: string;
  court: string;
  comarca: string;

  // Step 1.10.1.2 Perícia fields
  periciaMarked: boolean;
  periciaDate: string;
  periciaTime: string;
  periciaLocal: string;
  periciaPerito: string;
  periciaType: 'presencial' | 'online';
  periciaEscritorioComparecer: boolean;

  // Step 1.10.1.3 Prazo fields
  prazoMarked: boolean;
  prazoQual: string;
  prazoFatal: string;
  prazoResponsavel: string;
  prazoSeguranca: string;
  prazoDependeClienteInfo: boolean;
  prazoQualInfo: string;
  prazoDependeClienteProof: boolean;
  prazoQualProof: string;

  // Step 1.10.1.4 Audiência fields
  audienciaMarked: boolean;
  audienciaDate: string;
  audienciaTime: string;
  audienciaLocal: string;
  audienciaJuizo: string;
  audienciaType: 'presencial' | 'online';
  audienciaPlatform: string;
  audienciaPlatformType: 'zoom' | 'webex' | 'gmeet' | 'teams' | 'outro';
  audienciaLink: string;
  audienciaClienteAvisado: boolean;

  // Step 1.10.1.5 Contrato fields
  contratoCriado: boolean;
  contratoValorTotal: string;
  contratoParcelas: string;
  contratoVencimentoDia: string;
  contratoAssinado: boolean;

  // Step 1.10.1.6 Andamento fields
  andamentoConferido: boolean;
  andamentoResumo: string;

  // Step 1.10.1.7 Controladoria fields
  controladoriaMigrado: boolean;
  controladoriaData: string;
  controladoriaResponsavel: string;
}

const DEFAULT_PROTOCOL: ExtendedProtocolData = {
  protocolResponsible: '',
  expectedProtocolDate: '',
  actualProtocolDate: '',
  protocolSystem: '',
  protocolStatus: 'nao_preparado',
  processNumber: '',
  protocolReceiptName: '',
  protocolReceiptUrl: '',
  googleDriveFileId: '',
  googleDrivePrepared: false,
  notes: '',
  convertedToJudicialCase: false,
  completedAt: '',
  updatedAt: '',

  clientsList: [],
  exAdversosList: [],
  subject: '',
  court: '',
  comarca: '',

  periciaMarked: false,
  periciaDate: '',
  periciaTime: '',
  periciaLocal: '',
  periciaPerito: '',
  periciaType: 'presencial',
  periciaEscritorioComparecer: false,

  prazoMarked: false,
  prazoQual: '',
  prazoFatal: '',
  prazoResponsavel: '',
  prazoSeguranca: '',
  prazoDependeClienteInfo: false,
  prazoQualInfo: '',
  prazoDependeClienteProof: false,
  prazoQualProof: '',

  audienciaMarked: false,
  audienciaDate: '',
  audienciaTime: '',
  audienciaLocal: '',
  audienciaJuizo: '',
  audienciaType: 'presencial',
  audienciaPlatform: '',
  audienciaPlatformType: 'zoom',
  audienciaLink: '',
  audienciaClienteAvisado: false,

  contratoCriado: false,
  contratoValorTotal: '',
  contratoParcelas: '',
  contratoVencimentoDia: '',
  contratoAssinado: false,

  andamentoConferido: false,
  andamentoResumo: '',

  controladoriaMigrado: false,
  controladoriaData: '',
  controladoriaResponsavel: ''
};

// CNJ Format: 0000000-00.0000.0.00.0000 (20 digits)
function formatCNJ(value: string) {
  const clean = value.replace(/\D/g, '').substring(0, 20);
  if (clean.length === 0) return '';
  
  let formatted = '';
  const n = clean.substring(0, 7);
  formatted = n;
  if (clean.length > 7) {
    const d = clean.substring(7, 9);
    formatted += '-' + d;
  }
  if (clean.length > 9) {
    const a = clean.substring(9, 13);
    formatted += '.' + a;
  }
  if (clean.length > 13) {
    const j = clean.substring(13, 14);
    formatted += '.' + j;
  }
  if (clean.length > 14) {
    const tr = clean.substring(14, 16);
    formatted += '.' + tr;
  }
  if (clean.length > 16) {
    const o = clean.substring(16, 20);
    formatted += '.' + o;
  }
  return formatted;
}

export default function NovoCasoFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  // Shared 'protocol' object is used in firebase database to enable subsequent step modules to work out of the box!
  const [protocol, setProtocol] = useState<ExtendedProtocolData>(DEFAULT_PROTOCOL);

  const [newClientInput, setNewClientInput] = useState('');
  const [newExAdversoInput, setNewExAdversoInput] = useState('');
  const [copiedFormula, setCopiedFormula] = useState(false);

  const isCNJValid = (value: string) => {
    return value.replace(/\D/g, '').length === 20;
  };

  useEffect(() => {
    if (!caseId) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const caseRef = doc(db, 'cases', caseId!);
        const caseSnap = await getDoc(caseRef);

        if (!caseSnap.exists()) {
          setError(`Caso de ID [${caseId}] não encontrado.`);
          setLoading(false);
          return;
        }

        const cData = caseSnap.data();
        setCaseObj(cData);

        let resolvedPrimaryClient = 'Cliente';
        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            const cliData = clientSnap.data();
            setClient(cliData);
            resolvedPrimaryClient = cliData.type === 'PF'
              ? (cliData.pfDadosPessoais?.pf_nomeCompleto || cliData.pfData?.pf_nomeCompleto || 'Cliente')
              : (cliData.pjDadosEmpresa?.pj_razaoSocial || cliData.pjData?.pj_razaoSocial || 'Cliente');
          }
        }

        const rawProtocol = cData.protocol || {};
        
        let loadedClientsList = rawProtocol.clientsList || [];
        if (!Array.isArray(loadedClientsList) || loadedClientsList.length === 0) {
          loadedClientsList = [resolvedPrimaryClient];
        }

        const merged: ExtendedProtocolData = {
          protocolResponsible: rawProtocol.protocolResponsible || '',
          expectedProtocolDate: rawProtocol.expectedProtocolDate || '',
          actualProtocolDate: rawProtocol.actualProtocolDate || '',
          protocolSystem: rawProtocol.protocolSystem || '',
          protocolStatus: rawProtocol.protocolStatus || 'nao_preparado',
          processNumber: rawProtocol.processNumber || '',
          protocolReceiptName: rawProtocol.protocolReceiptName || '',
          protocolReceiptUrl: rawProtocol.protocolReceiptUrl || '',
          googleDriveFileId: rawProtocol.googleDriveFileId || '',
          googleDrivePrepared: rawProtocol.googleDrivePrepared || false,
          notes: rawProtocol.notes || '',
          convertedToJudicialCase: rawProtocol.convertedToJudicialCase || false,
          completedAt: rawProtocol.completedAt || '',
          updatedAt: rawProtocol.updatedAt ?? '',

          clientsList: loadedClientsList,
          exAdversosList: rawProtocol.exAdversosList || [],
          subject: rawProtocol.subject || '',
          court: rawProtocol.court || '',
          comarca: rawProtocol.comarca || '',

          periciaMarked: rawProtocol.periciaMarked ?? false,
          periciaDate: rawProtocol.periciaDate || '',
          periciaTime: rawProtocol.periciaTime || '',
          periciaLocal: rawProtocol.periciaLocal || '',
          periciaPerito: rawProtocol.periciaPerito || '',
          periciaType: rawProtocol.periciaType || 'presencial',
          periciaEscritorioComparecer: rawProtocol.periciaEscritorioComparecer ?? false,

          prazoMarked: rawProtocol.prazoMarked ?? false,
          prazoQual: rawProtocol.prazoQual || '',
          prazoFatal: rawProtocol.prazoFatal || '',
          prazoResponsavel: rawProtocol.prazoResponsavel || '',
          prazoSeguranca: rawProtocol.prazoSeguranca || '',
          prazoDependeClienteInfo: rawProtocol.prazoDependeClienteInfo ?? false,
          prazoQualInfo: rawProtocol.prazoQualInfo || '',
          prazoDependeClienteProof: rawProtocol.prazoDependeClienteProof ?? false,
          prazoQualProof: rawProtocol.prazoQualProof || '',

          audienciaMarked: rawProtocol.audienciaMarked ?? false,
          audienciaDate: rawProtocol.audienciaDate || '',
          audienciaTime: rawProtocol.audienciaTime || '',
          audienciaLocal: rawProtocol.audienciaLocal || '',
          audienciaJuizo: rawProtocol.audienciaJuizo || '',
          audienciaType: rawProtocol.audienciaType || 'presencial',
          audienciaPlatform: rawProtocol.audienciaPlatform || '',
          audienciaPlatformType: rawProtocol.audienciaPlatformType || 'zoom',
          audienciaLink: rawProtocol.audienciaLink || '',
          audienciaClienteAvisado: rawProtocol.audienciaClienteAvisado ?? false,

          contratoCriado: rawProtocol.contratoCriado ?? false,
          contratoValorTotal: rawProtocol.contratoValorTotal || '',
          contratoParcelas: rawProtocol.contratoParcelas || '',
          contratoVencimentoDia: rawProtocol.contratoVencimentoDia || '',
          contratoAssinado: rawProtocol.contratoAssinado ?? false,

          andamentoConferido: rawProtocol.andamentoConferido ?? false,
          andamentoResumo: rawProtocol.andamentoResumo || '',

          controladoriaMigrado: rawProtocol.controladoriaMigrado ?? false,
          controladoriaData: rawProtocol.controladoriaData || '',
          controladoriaResponsavel: rawProtocol.controladoriaResponsavel || ''
        };

        setProtocol(merged);
      } catch (err: any) {
        console.error(err);
        setError(`Erro ao buscar dados do caso: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  const handleChange = (field: keyof ExtendedProtocolData, value: any) => {
    setProtocol((prev) => {
      let val = value;
      if (field === 'processNumber') {
        val = formatCNJ(value);
      }
      return { ...prev, [field]: val };
    });
  };

  const handleAddClient = () => {
    if (!newClientInput.trim()) return;
    setProtocol((prev) => ({
      ...prev,
      clientsList: [...prev.clientsList, newClientInput.trim()]
    }));
    setNewClientInput('');
  };

  const handleRemoveClient = (index: number) => {
    setProtocol((prev) => ({
      ...prev,
      clientsList: prev.clientsList.filter((_, idx) => idx !== index)
    }));
  };

  const handleAddExAdverso = () => {
    if (!newExAdversoInput.trim()) return;
    setProtocol((prev) => ({
      ...prev,
      exAdversosList: [...prev.exAdversosList, newExAdversoInput.trim()]
    }));
    setNewExAdversoInput('');
  };

  const handleRemoveExAdverso = (index: number) => {
    setProtocol((prev) => ({
      ...prev,
      exAdversosList: prev.exAdversosList.filter((_, idx) => idx !== index)
    }));
  };

  const generatedTodoistFormula = `[${protocol.clientsList.join(' & ')}] x [${protocol.exAdversosList.join(' & ')}] - [${protocol.subject || 'Assunto'}] - [${protocol.processNumber || 'Sem CNJ'}] - [${protocol.court || 'Sem Vara'}] - [${protocol.comarca || 'Sem Comarca'}]`;

  const copyTodoistFormula = () => {
    navigator.clipboard.writeText(generatedTodoistFormula);
    setCopiedFormula(true);
    setTimeout(() => setCopiedFormula(false), 2000);
  };

  const handleSave = async (silent = false, action: 'none' | 'exit' | 'advance' = 'none') => {
    if (!caseId) return false;
    setSaving(true);
    setError(null);
    if (!silent) setSuccess(null);

    if (!isCNJValid(protocol.processNumber)) {
      setError('🚨 O número do processo (CNJ) é obrigatório e de preenchimento obrigatório com exatamente 20 dígitos para cadastro legítimo de caso.');
      setSaving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }

    try {
      const now = new Date().toISOString();

      const updatedProtocol: ExtendedProtocolData = {
        ...protocol,
        completedAt: protocol.protocolStatus === 'protocolado' ? (protocol.completedAt || now) : '',
        updatedAt: now
      };

      const payload: any = {
        protocol: updatedProtocol,
        processNumber: protocol.processNumber,
        updatedAt: now
      };

      if (action === 'advance') {
        payload.productionStage = 'controladoria';
        payload.statusInterno = 'Em controladoria';
      }

      await updateDoc(doc(db, 'cases', caseId!), payload);

      setCaseObj((prev: any) => ({
        ...prev,
        ...payload,
        protocol: updatedProtocol
      }));

      if (!silent) {
        setSuccess('Etapa 1.10.1 Cadastro de Novo Caso salva de forma exemplar no Connect!');
      }

      if (action === 'exit') {
        navigate('/boss-giffoni-clientes/fluxo-producao');
      } else if (action === 'advance') {
        navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/controladoria`);
      }

      return true;
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar cadastro do novo caso: ${err.message || err}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Cadastro de Novo Caso" caseId={caseId}>
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-gray-900" size={28} />
          <span className="text-xs font-bold font-mono tracking-wide uppercase">
            Carregando Sincronizador de Cadastro...
          </span>
        </div>
      </FluxoStepLayout>
    );
  }

  const resolvedClientName = client
    ? (client.type === 'PF'
        ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Sem Nome')
        : (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Razão Social Ausente'))
    : 'Buscando Cliente...';

  const resolvedClientSlug = client?.slug || 'sem-slug';

  return (
    <FluxoStepLayout
      stepName="1.10.1 Cadastro de Novo Caso"
      caseId={caseId}
      statusText={caseObj?.statusInterno || 'Novo Caso'}
    >
      <div className="space-y-8 font-sans">
        
        {/* Alerts & Errors */}
        {error && (
          <div className="p-5 bg-red-50 border border-red-150 rounded-2xl text-red-955 text-xs flex gap-3 items-center shadow-xs">
            <AlertCircle size={18} className="text-red-650 shrink-0" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-5 bg-emerald-50 border border-emerald-150 rounded-2xl text-emerald-950 text-xs flex gap-3 items-center shadow-xs">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span className="font-semibold leading-relaxed">{success}</span>
          </div>
        )}

        {/* DETAILS PANEL */}
        <div className="bg-gray-50 border border-gray-150 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md font-mono">
                {resolvedClientSlug}
              </span>
              <h4 className="text-sm font-extrabold text-gray-900 leading-tight">
                {resolvedClientName}
              </h4>
              <p className="text-[11px] text-gray-450 font-medium">
                Caso vinculado: <strong className="text-gray-700 font-mono">{caseId}</strong> • Tipo Original: <strong className="text-indigo-600">{caseObj?.registrationType || 'Não Definido'}</strong>
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold px-3 py-1.5 rounded-xl border border-gray-150 bg-white text-gray-700">
                Fase do Caso: {caseObj?.productionStage || 'novo-caso'}
              </span>
            </div>
          </div>
        </div>

        {/* ======================= STEP 1.10.1.1 ======================= */}
        <div className="border border-gray-150 rounded-3xl p-6 space-y-6 bg-white shadow-3xs">
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-4">
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 font-bold text-xs">
              1.10.1.1
            </div>
            <div>
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Opção 1.10.1.1 — Cadastrar Novo Caso / Processo</h3>
              <p className="text-[10.5px] text-gray-400">Insira as partes fáticas do processo correlato ao novo caso.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Relação de Clientes *</label>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newClientInput}
                  onChange={(e) => setNewClientInput(e.target.value)}
                  placeholder="Nome do cliente adicional"
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={handleAddClient}
                  className="px-3 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {protocol.clientsList.map((c, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-150 text-indigo-750 text-xs font-bold rounded-xl animate-fadeIn">
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveClient(idx)}
                      className="text-indigo-400 hover:text-indigo-800 font-bold text-[11px] font-sans h-3.5 leading-none"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Relação de Ex-adversos</label>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newExAdversoInput}
                  onChange={(e) => setNewExAdversoInput(e.target.value)}
                  placeholder="Exemplo: Empresa Ré, Banco S/A"
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={handleAddExAdverso}
                  className="px-3 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {protocol.exAdversosList.length === 0 ? (
                  <span className="text-[11px] text-gray-400 italic mt-2.5">Adicione os ex-adversos neste caso de produção</span>
                ) : (
                  protocol.exAdversosList.map((exa, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-150 text-red-750 text-xs font-bold rounded-xl animate-fadeIn">
                      <span>{exa}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExAdverso(idx)}
                        className="text-red-400 hover:text-red-800 font-bold text-[11px] font-sans h-3.5 leading-none"
                      >
                        &times;
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Assunto Competente</label>
              <input
                type="text"
                value={protocol.subject}
                onChange={(e) => handleChange('subject', e.target.value)}
                placeholder="Exemplo: Concessão de LOAS"
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 transition-all font-medium placeholder-gray-300"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Vara / Órgão do Tribunal</label>
              <input
                type="text"
                value={protocol.court}
                onChange={(e) => handleChange('court', e.target.value)}
                placeholder="Exemplo: 2ª Vara Cível"
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 transition-all font-medium placeholder-gray-300"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Comarca de Jurisdição</label>
              <input
                type="text"
                value={protocol.comarca}
                onChange={(e) => handleChange('comarca', e.target.value)}
                placeholder="Exemplo: São Paulo - SP"
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 transition-all font-medium placeholder-gray-300"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black uppercase tracking-wider text-red-500">
                  Número do Processo (CNJ) *
                </label>
                {isCNJValid(protocol.processNumber) ? (
                  <span className="text-[8.5px] text-emerald-600 uppercase font-black tracking-widest font-mono">CNJ Válido</span>
                ) : (
                  <span className="text-[8.5px] text-red-500 uppercase font-black tracking-widest font-mono">Falta 20 dígitos</span>
                )}
              </div>
              <input
                type="text"
                value={protocol.processNumber}
                onChange={(e) => handleChange('processNumber', e.target.value)}
                placeholder="0000000-00.0000.0.00.0000"
                className={`w-full bg-white border focus:ring-1 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold transition-all placeholder-gray-350 ${
                  isCNJValid(protocol.processNumber) ? 'border-emerald-250 focus:border-emerald-600 focus:ring-emerald-600 text-emerald-950' : 'border-red-250 focus:border-indigo-650 focus:ring-indigo-650'
                }`}
              />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-950 rounded-2xl p-5 text-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[8.5px] font-mono tracking-widest font-black uppercase text-indigo-400 bg-indigo-950/85 px-2.5 py-1 rounded">
                Métrica Oficial / Fórmula Todoist de Organização de Atividades
              </span>
              <p className="text-xs text-slate-100 font-mono font-bold leading-normal tracking-tight break-all">
                {generatedTodoistFormula}
              </p>
            </div>

            <button
              type="button"
              onClick={copyTodoistFormula}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-slate-850 hover:bg-slate-800 text-white min-w-[125px] justify-center px-4.5 py-2.5 rounded-xl transition-all cursor-pointer shadow-3xs"
            >
              {copiedFormula ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copiar Fórmula</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ======================= STEP 1.10.1.2 ======================= */}
        <div className="border border-gray-150 rounded-3xl p-6 space-y-6 bg-white shadow-3xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 font-bold text-xs font-sans">
                1.10.1.2
              </div>
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Opção 1.10.1.2 — Caso possui perícia marcada?</h3>
                <p className="text-[10.5px] text-gray-400">Valores de laudo ou perícias judiciais faticamente fixadas.</p>
              </div>
            </div>

            <div className="flex gap-1.5 border border-gray-200 p-1.5 rounded-2xl bg-gray-50/50">
              <button
                type="button"
                onClick={() => handleChange('periciaMarked', true)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  protocol.periciaMarked ? 'bg-indigo-600 text-white shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => handleChange('periciaMarked', false)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  !protocol.periciaMarked ? 'bg-gray-250 text-gray-800 shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Não
              </button>
            </div>
          </div>

          {protocol.periciaMarked && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-in slide-in-from-top-3 duration-200">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Dia da Perícia</label>
                <input
                  type="date"
                  value={protocol.periciaDate}
                  onChange={(e) => handleChange('periciaDate', e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Horário</label>
                <input
                  type="time"
                  value={protocol.periciaTime}
                  onChange={(e) => handleChange('periciaTime', e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Perito Responsável</label>
                <input
                  type="text"
                  value={protocol.periciaPerito}
                  onChange={(e) => handleChange('periciaPerito', e.target.value)}
                  placeholder="Nome do expert judicial"
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-medium placeholder-gray-355"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Local da Perícia</label>
                <input
                  type="text"
                  value={protocol.periciaLocal}
                  onChange={(e) => handleChange('periciaLocal', e.target.value)}
                  placeholder="Endereço fático da clínica ou órgão judicial"
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-medium placeholder-gray-355"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Modalidade de Perícia</label>
                <div className="flex gap-2 border border-gray-150 p-1 rounded-xl bg-gray-50/55 h-[38px] items-center">
                  <button
                    type="button"
                    onClick={() => handleChange('periciaType', 'presencial')}
                    className={`flex-1 text-center text-[11px] font-bold py-1 rounded-lg transition-all cursor-pointer ${
                      protocol.periciaType === 'presencial' ? 'bg-indigo-600 text-white' : 'text-gray-500'
                    }`}
                  >
                    Presencial
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('periciaType', 'online')}
                    className={`flex-1 text-center text-[11px] font-bold py-1 rounded-lg transition-all cursor-pointer ${
                      protocol.periciaType === 'online' ? 'bg-indigo-600 text-white' : 'text-gray-500'
                    }`}
                  >
                    Online
                  </button>
                </div>
              </div>

              <div className="md:col-span-3 flex items-center gap-3 bg-indigo-50/50 p-3.5 border border-indigo-100 rounded-2xl">
                <input
                  type="checkbox"
                  id="periciaEscritorioComparecer"
                  checked={protocol.periciaEscritorioComparecer}
                  onChange={(e) => handleChange('periciaEscritorioComparecer', e.target.checked)}
                  className="w-4.5 h-4.5 border-gray-300 rounded focus:ring-indigo-500 h-4 w-4 cursor-pointer text-indigo-600"
                />
                <label htmlFor="periciaEscritorioComparecer" className="text-xs text-indigo-900 font-bold select-none cursor-pointer">
                  O escritório precisa comparecer para assistir o cliente presencialmente ou acompanhar faticamente?
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ======================= STEP 1.10.1.3 ======================= */}
        <div className="border border-gray-150 rounded-3xl p-6 space-y-6 bg-white shadow-3xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 font-bold text-xs font-sans">
                1.10.1.3
              </div>
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Opção 1.10.1.3 — Caso possui prazo em aberto?</h3>
                <p className="text-[10.5px] text-gray-400">Prazos e termos processuais judicialmente vigentes.</p>
              </div>
            </div>

            <div className="flex gap-1.5 border border-gray-200 p-1.5 rounded-2xl bg-gray-50/50">
              <button
                type="button"
                onClick={() => handleChange('prazoMarked', true)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  protocol.prazoMarked ? 'bg-indigo-600 text-white shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => handleChange('prazoMarked', false)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  !protocol.prazoMarked ? 'bg-gray-250 text-gray-800 shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Não
              </button>
            </div>
          </div>

          {protocol.prazoMarked && (
            <div className="space-y-5 animate-in slide-in-from-top-3 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Qual prazo está aberto?</label>
                  <input
                    type="text"
                    value={protocol.prazoQual}
                    onChange={(e) => handleChange('prazoQual', e.target.value)}
                    placeholder="Exemplo: Manifestação de provas, réplica jurídica"
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-medium placeholder-gray-350"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-red-500">Quando vencerá — PRAZO FATAL *</label>
                  <input
                    type="date"
                    value={protocol.prazoFatal}
                    onChange={(e) => handleChange('prazoFatal', e.target.value)}
                    className="w-full bg-white border border-gray-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 py-2 text-xs font-bold text-red-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Responsável Cumprimento</label>
                  <input
                    type="text"
                    value={protocol.prazoResponsavel}
                    onChange={(e) => handleChange('prazoResponsavel', e.target.value)}
                    placeholder="Operador ou advogado associado"
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-medium placeholder-gray-350"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-600">Revisão Interna — PRAZO SEGURANÇA *</label>
                  <input
                    type="date"
                    value={protocol.prazoSeguranca}
                    onChange={(e) => handleChange('prazoSeguranca', e.target.value)}
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-bold text-indigo-900"
                  />
                </div>

                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Depends on info */}
                  <div className="p-3.5 border border-indigo-100 rounded-2xl bg-indigo-50/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-indigo-950 uppercase tracking-wider">Depende de INFO do cliente?</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleChange('prazoDependeClienteInfo', true)}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${
                            protocol.prazoDependeClienteInfo ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
                          }`}
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChange('prazoDependeClienteInfo', false)}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${
                            !protocol.prazoDependeClienteInfo ? 'bg-gray-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
                          }`}
                        >
                          Não
                        </button>
                      </div>
                    </div>

                    {protocol.prazoDependeClienteInfo && (
                      <div className="space-y-1.5 animate-fadeIn">
                        <input
                          type="text"
                          value={protocol.prazoQualInfo}
                          onChange={(e) => handleChange('prazoQualInfo', e.target.value)}
                          placeholder="Fale qual informação é necessária..."
                          className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-2.5 py-1.5 text-[11px] font-medium"
                        />
                        <span className="text-[10px] text-amber-800 font-bold block bg-amber-50 rounded px-2.5 py-1 border border-amber-100 line-clamp-2">
                          ⚡ Alerta: Irá registrar no Portal do Cliente um alerta urgente de informação.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Depends on Proofs */}
                  <div className="p-3.5 border border-purple-100 rounded-2xl bg-purple-50/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-purple-950 uppercase tracking-wider">Depende de PROVAS do cliente?</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleChange('prazoDependeClienteProof', true)}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${
                            protocol.prazoDependeClienteProof ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
                          }`}
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChange('prazoDependeClienteProof', false)}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${
                            !protocol.prazoDependeClienteProof ? 'bg-gray-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
                          }`}
                        >
                          Não
                        </button>
                      </div>
                    </div>

                    {protocol.prazoDependeClienteProof && (
                      <div className="space-y-1.5 animate-fadeIn">
                        <input
                          type="text"
                          value={protocol.prazoQualProof}
                          onChange={(e) => handleChange('prazoQualProof', e.target.value)}
                          placeholder="Qual prova documental é pendente?"
                          className="w-full bg-white border border-gray-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-lg px-2.5 py-1.5 text-[11px] font-medium"
                        />
                        <span className="text-[10px] text-amber-800 font-bold block bg-amber-50 rounded px-2.5 py-1 border border-amber-100 line-clamp-2">
                          💥 Alerta: Irá registrar no Portal do Cliente uma solicitação de prova urgente fática.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================= STEP 1.10.1.4 ======================= */}
        <div className="border border-gray-150 rounded-3xl p-6 space-y-6 bg-white shadow-3xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 font-bold text-xs font-sans">
                1.10.1.4
              </div>
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Opção 1.10.1.4 — Caso possui audiência marcada?</h3>
                <p className="text-[10.5px] text-gray-400">Sessões ordinárias e interrogatórios marcados.</p>
              </div>
            </div>

            <div className="flex gap-1.5 border border-gray-200 p-1.5 rounded-2xl bg-gray-50/50">
              <button
                type="button"
                onClick={() => handleChange('audienciaMarked', true)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  protocol.audienciaMarked ? 'bg-indigo-600 text-white shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => handleChange('audienciaMarked', false)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  !protocol.audienciaMarked ? 'bg-gray-250 text-gray-800 shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Não
              </button>
            </div>
          </div>

          {protocol.audienciaMarked && (
            <div className="space-y-5 animate-in slide-in-from-top-3 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Ajuizamento / Dia</label>
                  <input
                    type="date"
                    value={protocol.audienciaDate}
                    onChange={(e) => handleChange('audienciaDate', e.target.value)}
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Horário da Sessão</label>
                  <input
                    type="time"
                    value={protocol.audienciaTime}
                    onChange={(e) => handleChange('audienciaTime', e.target.value)}
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Juízo / Vara Competente</label>
                  <input
                    type="text"
                    value={protocol.audienciaJuizo}
                    onChange={(e) => handleChange('audienciaJuizo', e.target.value)}
                    placeholder="Exemplo: Vara Federal, Comarca Geral"
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-medium placeholder-gray-350"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Local fático</label>
                  <input
                    type="text"
                    value={protocol.audienciaLocal}
                    onChange={(e) => handleChange('audienciaLocal', e.target.value)}
                    placeholder="Exemplo: Fórum Central Barra Funda"
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-medium placeholder-gray-355"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Modalidade Audiência</label>
                  <div className="flex gap-2 border border-gray-150 p-1 rounded-xl bg-gray-50/55 h-[38px] items-center">
                    <button
                      type="button"
                      onClick={() => handleChange('audienciaType', 'presencial')}
                      className={`flex-1 text-center text-[11px] font-bold py-1 rounded-lg transition-all cursor-pointer ${
                        protocol.audienciaType === 'presencial' ? 'bg-indigo-600 text-white' : 'text-gray-500'
                      }`}
                    >
                      Presencial
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange('audienciaType', 'online')}
                      className={`flex-1 text-center text-[11px] font-bold py-1 rounded-lg transition-all cursor-pointer ${
                        protocol.audienciaType === 'online' ? 'bg-indigo-600 text-white' : 'text-gray-500'
                      }`}
                    >
                      Online
                    </button>
                  </div>
                </div>

                {protocol.audienciaType === 'online' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Plataforma Virtual</label>
                      <select
                        value={protocol.audienciaPlatformType}
                        onChange={(e) => handleChange('audienciaPlatformType', e.target.value)}
                        className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-bold font-mono h-[38px] cursor-pointer"
                      >
                        <option value="zoom">Zoom Video</option>
                        <option value="webex">Cisco Webex</option>
                        <option value="gmeet">Google Meet</option>
                        <option value="teams">Microsoft Teams</option>
                        <option value="outro">Outro sistema com link</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Link Completo de Conexão</label>
                      <input
                        type="text"
                        value={protocol.audienciaLink}
                        onChange={(e) => handleChange('audienciaLink', e.target.value)}
                        placeholder="https://zoom.us/j/..."
                        className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-mono h-[38px]"
                      />
                    </div>
                  </>
                )}

                <div className="md:col-span-3 flex items-center gap-3 bg-emerald-50/50 p-3.5 border border-emerald-100 rounded-2xl">
                  <input
                    type="checkbox"
                    id="audienciaClienteAvisado"
                    checked={protocol.audienciaClienteAvisado}
                    onChange={(e) => handleChange('audienciaClienteAvisado', e.target.checked)}
                    className="w-4.5 h-4.5 border-gray-300 rounded focus:ring-indigo-500 h-4 w-4 cursor-pointer text-indigo-600"
                  />
                  <label htmlFor="audienciaClienteAvisado" className="text-xs text-emerald-950 font-bold select-none cursor-pointer">
                    O cliente foi formally e previamente avisado faticamente de todos os detalhes desta audiência?
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================= STEP 1.10.1.5 ======================= */}
        <div className="border border-gray-150 rounded-3xl p-6 space-y-6 bg-white shadow-3xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 font-bold text-xs font-sans">
                1.10.1.5
              </div>
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Opção 1.10.1.5 — Criar Novo Contrato Financeiro</h3>
                <p className="text-[10.5px] text-gray-400">Defina os honorários advocatícios ou cláusulas contratuais fáticas.</p>
              </div>
            </div>

            <div className="flex gap-1.5 border border-gray-200 p-1.5 rounded-2xl bg-gray-50/50">
              <button
                type="button"
                onClick={() => handleChange('contratoCriado', true)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  protocol.contratoCriado ? 'bg-indigo-600 text-white shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Gerado
              </button>
              <button
                type="button"
                onClick={() => handleChange('contratoCriado', false)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  !protocol.contratoCriado ? 'bg-gray-250 text-gray-800 shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Pendente
              </button>
            </div>
          </div>

          {protocol.contratoCriado && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 animate-in slide-in-from-top-3 duration-200">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Valor Total Estimado (R$)</label>
                <input
                  type="text"
                  value={protocol.contratoValorTotal}
                  onChange={(e) => handleChange('contratoValorTotal', e.target.value)}
                  placeholder="R$ 5.000,00"
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Quantidade de Parcelas</label>
                <input
                  type="number"
                  value={protocol.contratoParcelas}
                  onChange={(e) => handleChange('contratoParcelas', e.target.value)}
                  placeholder="Exemplo: 5"
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Dia Vencimento Preferido</label>
                <input
                  type="number"
                  value={protocol.contratoVencimentoDia}
                  onChange={(e) => handleChange('contratoVencimentoDia', e.target.value)}
                  placeholder="Exemplo: 10"
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-bold"
                />
              </div>

              <div className="flex items-center gap-3 bg-indigo-50/30 p-3.5 border border-indigo-100 rounded-2xl md:col-span-1 h-[38px] mt-6.5">
                <input
                  type="checkbox"
                  id="contratoAssinado"
                  checked={protocol.contratoAssinado}
                  onChange={(e) => handleChange('contratoAssinado', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="contratoAssinado" className="text-xs text-indigo-900 font-bold select-none cursor-pointer">
                  Assinado pelo Cliente?
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ======================= STEP 1.10.1.6 ======================= */}
        <div className="border border-gray-150 rounded-3xl p-6 space-y-6 bg-white shadow-3xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 font-bold text-xs font-sans">
                1.10.1.6
              </div>
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Opção 1.10.1.6 — Conferir Andamento Processual</h3>
                <p className="text-[10.5px] text-gray-400">Efetue o levantamento nos Tribunais PJe ou correlatos para ratificar a situação fática.</p>
              </div>
            </div>

            <div className="flex gap-1.5 border border-gray-200 p-1.5 rounded-2xl bg-gray-50/50">
              <button
                type="button"
                onClick={() => handleChange('andamentoConferido', true)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  protocol.andamentoConferido ? 'bg-indigo-600 text-white shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Conferido
              </button>
              <button
                type="button"
                onClick={() => handleChange('andamentoConferido', false)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  !protocol.andamentoConferido ? 'bg-gray-250 text-gray-800 shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Pendente
              </button>
            </div>
          </div>

          {protocol.andamentoConferido && (
            <div className="space-y-1.5 animate-in slide-in-from-top-3 duration-200">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Resumo da Última Movimentação Judicial Encontrada</label>
              <textarea
                value={protocol.andamentoResumo}
                onChange={(e) => handleChange('andamentoResumo', e.target.value)}
                placeholder="Insira detalhes como: Decisão interlocutória publicada, expedido mandado, remetido ao juiz fático..."
                className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3.5 text-xs text-gray-800 font-medium placeholder-gray-300 min-h-[90px]"
              />
            </div>
          )}
        </div>

        {/* ======================= STEP 1.10.1.7 ======================= */}
        <div className="border border-gray-150 rounded-3xl p-6 space-y-6 bg-white shadow-3xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 font-bold text-xs font-sans">
                1.10.1.7
              </div>
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Opção 1.10.1.7 — Migrar Informações para o Setor da Controladoria</h3>
                <p className="text-[10.5px] text-gray-450">Prepare os registros fáticos para auditorias, trâmites e controle interno do escritório.</p>
              </div>
            </div>

            <div className="flex gap-1.5 border border-gray-200 p-1.5 rounded-2xl bg-gray-50/50">
              <button
                type="button"
                onClick={() => handleChange('controladoriaMigrado', true)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  protocol.controladoriaMigrado ? 'bg-indigo-600 text-white shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Migrado
              </button>
              <button
                type="button"
                onClick={() => handleChange('controladoriaMigrado', false)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  !protocol.controladoriaMigrado ? 'bg-gray-250 text-gray-800 shadow-3xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Não Migrado
              </button>
            </div>
          </div>

          {protocol.controladoriaMigrado && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in slide-in-from-top-3 duration-200">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Responsável pela Liberação para Controladoria</label>
                <input
                  type="text"
                  value={protocol.controladoriaResponsavel}
                  onChange={(e) => handleChange('controladoriaResponsavel', e.target.value)}
                  placeholder="Nome do Auditor do Fluxo"
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-medium placeholder-gray-350"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Data e Hora de Migração</label>
                <input
                  type="datetime-local"
                  value={protocol.controladoriaData}
                  onChange={(e) => handleChange('controladoriaData', e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-xs font-medium"
                />
              </div>

              <div className="md:col-span-2 p-4 bg-emerald-50 border border-emerald-100 text-emerald-950 font-bold rounded-2xl text-xs flex gap-3 items-center">
                <Award size={18} className="text-emerald-500 shrink-0" />
                <span>🚀 Caso validado e migrado plenamente para o setor inteligente de Controladoria Giffoni Advogados!</span>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM NAV BAR */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(`${flowRoutes.tipoServico(caseId!)}?clientId=${caseObj?.clientId}&source=novo-caso`)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            <ArrowLeft size={14} />
            Voltar para Tipo de Serviço
          </button>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false, 'none')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-700 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              <Save size={13} />
              {saving ? 'Gravando...' : 'Salvar Informações'}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false, 'exit')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-950 text-gray-900 hover:bg-gray-50 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              Salvar e Sair
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false, 'advance')}
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
