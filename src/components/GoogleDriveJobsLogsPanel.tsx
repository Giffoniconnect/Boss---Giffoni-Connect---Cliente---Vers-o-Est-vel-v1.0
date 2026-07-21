import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { 
  computeLogsForJob, 
  syncJobLogsInFirestore, 
  LogStep 
} from '../lib/googleDriveLogs';
import { 
  FolderOpen, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Copy, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  User, 
  Code,
  FileText,
  Search,
  Filter,
  Check,
  Loader2
} from 'lucide-react';

interface GoogleDriveJobsLogsPanelProps {
  clientId?: string | null;  // If provided, operates in "inline customer mode" showing only jobs for this client
  currentJobId?: string | null;
  onSelectJobId?: (jobId: string | null) => void;
}

export default function GoogleDriveJobsLogsPanel({ 
  clientId, 
  currentJobId,
  onSelectJobId 
}: GoogleDriveJobsLogsPanelProps) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedErrorId, setCopiedErrorId] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});

  const toggleJobLogs = (jobId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setExpandedJobs(prev => ({
      ...prev,
      [jobId]: !prev[jobId]
    }));
  };

  // Timeouts detection and real-time synchronization hook
  useEffect(() => {
    let q = query(
      collection(db, 'googleDriveJobs'), 
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsList: any[] = [];
      snapshot.forEach(d => {
        const data = { id: d.id, ...d.data() };
        docsList.push(data);
      });

      // For pending jobs, run an active check if they are timed out and sync in Firestore
      docsList.forEach(async (job) => {
        const isTimeout = job.status === 'pending' && (Date.now() - new Date(job.createdAt).getTime() > 60000);
        if (isTimeout && job.overallStatus !== 'timeout') {
          await syncJobLogsInFirestore(job.id, job, auth.currentUser?.email);
        }
      });

      setJobs(docsList);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao escutar googleDriveJobs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter jobs based on panel mode (clientId vs global)
  const filteredJobs = jobs.filter(job => {
    // Client ID filter if in inline mode
    if (clientId && job.portalClientId !== clientId) return false;

    // Direct search matching name, id, or folder
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const n = (job.clientFolderName || '').toLowerCase();
      const idStr = (job.id || '').toLowerCase();
      const cliIdStr = (job.portalClientId || '').toLowerCase();
      if (!n.includes(q) && !idStr.includes(q) && !cliIdStr.includes(q)) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      const s = job.overallStatus || job.status || 'pending';
      if (statusFilter === 'success' && s !== 'success') return false;
      if (statusFilter === 'pending' && s !== 'pending' && s !== 'processing') return false;
      if (statusFilter === 'failed' && s !== 'failed' && s !== 'partial_success') return false;
      if (statusFilter === 'timeout' && s !== 'timeout') return false;
    }

    return true;
  });

  const handleCopyText = (text: string, id: string, type: 'id' | 'error') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setCopiedErrorId(id);
      setTimeout(() => setCopiedErrorId(null), 2000);
    }
  };

  const handleReprocessJob = async (job: any, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setReprocessingId(job.id);
    try {
      const email = auth.currentUser?.email || 'Usuário do Portal';
      
      // Compute virtual list of logs for preserving history to array
      const currentLogs = job.logs || [];
      const manualLog: LogStep = {
        step: 'Ação do Usuário — Reprocessar solicitado',
        status: 'pending',
        message: 'Job reenviado manualmente pelo usuário',
        timestamp: new Date().toISOString(),
        source: 'Portal BOSS',
        details: { reprocessedBy: email, originalJobCreatedAt: job.createdAt }
      };

      const updatedPayload = {
        status: 'pending',
        overallStatus: 'pending',
        updatedAt: new Date().toISOString(),
        createdBy: email,
        googleDriveClientFolderId: '',
        googleDriveClientFolderUrl: '',
        folderId: '',
        folderUrl: '',
        errorCode: '',
        errorMessage: '',
        errorStack: '',
        logs: [...currentLogs, manualLog]
      };

      const jobRef = doc(db, 'googleDriveJobs', job.id);
      await setDoc(jobRef, updatedPayload, { merge: true });

      // If there is an external listener hook trigger
      if (onSelectJobId) {
        onSelectJobId(job.id);
      }
    } catch (err) {
      console.error("Erro ao reprocessar job:", err);
    } finally {
      setReprocessingId(null);
    }
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('pt-BR');
    } catch {
      return isoStr;
    }
  };

  const getStatusBadge = (overallStatus: string) => {
    const s = overallStatus || 'pending';
    switch (s) {
      case 'success':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Sucesso
          </span>
        );
      case 'failed':
      case 'partial_success':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-lg bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
            Falha
          </span>
        );
      case 'timeout':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-lg bg-gray-100 text-gray-800 border border-gray-200 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse" />
            Timeout
          </span>
        );
      case 'processing':
      case 'pending':
      default:
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-lg bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
            Processando
          </span>
        );
    }
  };

  const getJobCardStyle = (overallStatus: string) => {
    const s = overallStatus || 'pending';
    switch (s) {
      case 'success':
        return 'border-emerald-250 bg-emerald-50/20 hover:bg-emerald-50/40';
      case 'failed':
      case 'partial_success':
        return 'border-rose-250 bg-rose-50/20 hover:bg-rose-50/40';
      case 'timeout':
        return 'border-gray-200 bg-gray-50/50 hover:bg-gray-100/50';
      case 'processing':
      case 'pending':
      default:
        return 'border-amber-200 bg-amber-50/20 hover:bg-amber-50/40';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Header (Rendered only on general config log list page) */}
      {!clientId && (
        <div className="bg-white border border-gray-150 p-4 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por cliente, Job ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-200 focus:bg-white text-gray-900 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <Filter className="text-gray-400 w-3.5 h-3.5 shrink-0" />
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border tracking-wider transition shrink-0 ${
                statusFilter === 'all' 
                  ? 'bg-slate-900 text-white border-slate-950' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('success')}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border tracking-wider transition shrink-0 ${
                statusFilter === 'success' 
                  ? 'bg-emerald-600 text-white border-emerald-700' 
                  : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              Sucesso
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border tracking-wider transition shrink-0 ${
                statusFilter === 'pending' 
                  ? 'bg-amber-500 text-white border-amber-600' 
                  : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
              }`}
            >
              Andamento
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border tracking-wider transition shrink-0 ${
                statusFilter === 'failed' 
                  ? 'bg-rose-600 text-white border-rose-700' 
                  : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
              }`}
            >
              Falha
            </button>
            <button
              onClick={() => setStatusFilter('timeout')}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border tracking-wider transition shrink-0 ${
                statusFilter === 'timeout' 
                  ? 'bg-gray-650 text-white border-gray-700' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Timeout
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-white border border-gray-150 rounded-3xl">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" />
          <p className="text-[10px] uppercase font-black tracking-widest text-gray-500 mt-2.5">Buscando Logs da Fila...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white border border-gray-150 rounded-3xl">
          <FolderOpen className="w-8 h-8 mx-auto text-gray-300 stroke-1" />
          <p className="text-xs font-semibold text-gray-500 mt-2">Nenhum log operacional encontrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => {
            const isExpanded = !!expandedJobs[job.id];
            const computed = computeLogsForJob(job, auth.currentUser?.email);
            const status = computed.overallStatus;
            const steps = computed.logs;
            const lastCompletedStep = steps.filter(s => s.status === 'success' || s.status === 'failed' || s.status === 'timeout').pop();
            const errorMessage = job.errorMessage || job.error || job.logFalha || '';

            return (
              <div 
                key={job.id} 
                className={`border rounded-3xl p-5 shadow-xs transition-all ${getJobCardStyle(status)}`}
                id={`job-card-${job.id}`}
              >
                {/* Job Header */}
                <div 
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                  onClick={(e) => toggleJobLogs(job.id, e)}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-gray-900 tracking-tight uppercase">
                        {job.clientFolderName || 'Sem Nome de Pasta'}
                      </span>
                      {getStatusBadge(status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 font-mono font-semibold">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {formatDate(job.createdAt)}
                      </span>
                      <span className="flex items-center gap-1 select-all" onClick={(e) => { e.stopPropagation(); handleCopyText(job.id, job.id, 'id'); }}>
                        <Code size={11} />
                        ID: {job.id} 
                        {copiedId === job.id && <span className="text-[10px] text-emerald-600 font-bold ml-1">Copied!</span>}
                      </span>
                      {job.createdBy && (
                        <span className="flex items-center gap-1">
                          <User size={11} />
                          {job.createdBy}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-auto">
                    {/* Action buttons on card header */}
                    {job.googleDriveClientFolderUrl && (
                      <a 
                        href={job.googleDriveClientFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 px-2.5 bg-white hover:bg-slate-50 border border-gray-200 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink size={11} />
                        Abrir Pasta
                      </a>
                    )}

                    <button
                      type="button"
                      disabled={reprocessingId === job.id}
                      onClick={(e) => handleReprocessJob(job, e)}
                      className="p-1 px-2.5 bg-amber-50 hover:bg-amber-105 border border-amber-200 text-amber-800 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={reprocessingId === job.id ? 'animate-spin' : ''} />
                      Reprocessar
                    </button>

                    <button
                      type="button"
                      onClick={(e) => toggleJobLogs(job.id, e)}
                      className="p-1 bg-white hover:bg-gray-105 border border-gray-200 rounded-lg text-gray-500 transition-all cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Subinfo inside card header */}
                <div className="mt-2 text-[11px] text-gray-500 font-semibold border-t border-gray-100/10 pt-2 flex items-center gap-2 justify-between flex-wrap">
                  <div>
                    Última etapa: <span className="font-bold text-gray-800 font-mono">{lastCompletedStep ? lastCompletedStep.step : 'Nenhuma'}</span>
                  </div>
                  {lastCompletedStep && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                      lastCompletedStep.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {lastCompletedStep.message}
                    </span>
                  )}
                </div>

                {/* Compact warnings/success and Ver logs toggle */}
                <div className="mt-3 pt-2.5 border-t border-gray-100/20 flex flex-col gap-2">
                  {/* Compact Warning Box visibly exposed only if collapsed and status failed/timeout */}
                  {!isExpanded && (status === 'failed' || status === 'partial_success' || status === 'timeout') && (
                    <div className="p-3 bg-rose-50/60 border border-rose-150 rounded-xl text-rose-955 text-xs flex items-start gap-2.5 font-semibold animate-in fade-in duration-200">
                      <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-black uppercase text-[9px] tracking-wider text-rose-800">Aviso Compacto de Falha</p>
                        <p className="font-medium text-rose-900 break-words leading-relaxed">
                          {errorMessage || 'O tempo limite de processamento expirou no barramento da fila.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Compact Success info if collapsed */}
                  {!isExpanded && status === 'success' && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50/50 border border-emerald-150 rounded-xl p-2.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">Pasta criada com sucesso e totalmente sincronizada!</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4 mt-1">
                    <button
                      type="button"
                      onClick={(e) => toggleJobLogs(job.id, e)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-105 border border-gray-205 text-slate-700 hover:text-slate-950 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-3xs"
                    >
                      <span>{isExpanded ? 'Ocultar logs' : 'Ver logs'}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {!isExpanded && (
                      <span className="text-[10px] text-gray-400 font-semibold italic">
                        Clique em "Ver logs" para auditoria detalhada das 8 etapas
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-150 space-y-4 animate-in slide-in-from-top-1 duration-200">
                    {/* General Metadata Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-150 text-xs font-semibold">
                      <div className="space-y-2">
                        <h4 className="text-[10px] uppercase font-black tracking-wider text-gray-400 font-mono">1. Dados Gerais do Job</h4>
                        <div className="grid grid-cols-3 gap-y-1.5 gap-x-2 text-[11px]">
                          <span className="text-gray-450 uppercase font-bold text-[10px]">Origem:</span>
                          <span className="col-span-2 text-gray-800">{job.originBlock || 'Módulo fluxo'} ({job.originField || 'clientFolder'})</span>
                          
                          <span className="text-gray-450 uppercase font-bold text-[10px]">Cliente:</span>
                          <span className="col-span-2 text-gray-800">{job.clientType === 'PJ' ? 'Pessoa Jurídica (CNPJ)' : 'Pessoa Física (CPF)'}</span>

                          <span className="text-gray-450 uppercase font-bold text-[10px]">ID Cliente:</span>
                          <span className="col-span-2 text-slate-700 font-mono select-all">{job.portalClientId}</span>

                          <span className="text-gray-450 uppercase font-bold text-[10px]">ID Caso:</span>
                          <span className="col-span-2 text-slate-700 font-mono select-all">{job.caseId || 'Nenhum'}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-[10px] uppercase font-black tracking-wider text-gray-400 font-mono">Retorno obtido</h4>
                        <div className="grid grid-cols-3 gap-y-1.5 gap-x-2 text-[11px]">
                          <span className="text-gray-450 uppercase font-bold text-[10px]">ID Pasta:</span>
                          <span className="col-span-2 font-mono text-slate-700 break-all select-all">{job.googleDriveClientFolderId || job.folderId || 'Aguardando...'}</span>
                          
                          <span className="text-gray-450 uppercase font-bold text-[10px]">URL:</span>
                          <span className="col-span-2 font-mono text-indigo-700 break-all select-all">{job.googleDriveClientFolderUrl || job.folderUrl || 'Aguardando...'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Step-by-Step Tracks */}
                    <div className="space-y-2.5">
                      <h4 className="text-[10px] uppercase font-black tracking-wider text-gray-400 font-mono">2. Etapas Rastreadas da Ponte</h4>
                      <div className="border border-gray-150 rounded-2xl bg-white divide-y divide-gray-100 overflow-hidden text-xs">
                        {steps.map((step, idx) => {
                          const isDone = step.status === 'success';
                          const isFail = step.status === 'failed';
                          const isWait = step.status === 'pending';
                          const isProc = step.status === 'processing';
                          const isTime = step.status === 'timeout';

                          return (
                            <div key={idx} className="p-3 flex items-start gap-3 hover:bg-gray-50/40">
                              <div className="shrink-0 mt-0.5">
                                {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50" />}
                                {isFail && <AlertCircle className="w-4 h-4 text-rose-500 fill-rose-50" />}
                                {isWait && <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200" />}
                                {isProc && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
                                {isTime && <Clock className="w-4 h-4 text-gray-500" />}
                              </div>
                              <div className="space-y-0.5 flex-1 p-0 m-0 border-0">
                                <p className="font-bold text-gray-800 text-[11px] leading-tight flex items-center gap-2">
                                  <span>{step.step}</span>
                                  <span className={`px-1.5 py-0.2 text-[8px] font-black uppercase rounded ${
                                    isDone ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                    isFail ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                    isTime ? 'bg-gray-100 text-gray-700 border border-gray-200' :
                                    'bg-amber-50 text-amber-700 border border-amber-100'
                                  }`}>
                                    {step.status}
                                  </span>
                                </p>
                                <p className="text-[11px] text-gray-500 font-semibold">{step.message}</p>
                                {step.details && Object.keys(step.details).length > 0 && (
                                  <pre className="mt-1 text-[10px] font-mono text-slate-500 bg-slate-50/50 p-2 rounded-lg border border-slate-100 max-h-24 overflow-y-auto whitespace-pre-wrap select-text leading-tight">
                                    {JSON.stringify(step.details, null, 2)}
                                  </pre>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono font-semibold self-center sm:self-start">
                                {formatDate(step.timestamp)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Technical Fields and details actions */}
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      {errorMessage && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(errorMessage, job.id, 'error')}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-900 font-black uppercase tracking-wider rounded-lg text-[9px] transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy size={11} />
                          <span>{copiedErrorId === job.id ? 'Copiado!' : 'Copiar erro'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopyText(JSON.stringify(job, null, 2), job.id, 'id')}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-900 font-black uppercase tracking-wider rounded-lg text-[9px] transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Code size={11} />
                        <span>Ver documento no Firestore (JSON)</span>
                      </button>
                    </div>

                    {/* Firestore JSON representation display */}
                    {copiedId === job.id && (
                      <div className="p-3 bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-[10px] leading-normal select-text max-h-72 overflow-y-auto shadow-inner border border-slate-900">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-1 mb-2 text-slate-400">
                          <span>DOCUMENTO FIRESTORE: googleDriveJobs/{job.id}</span>
                          <span className="text-[9px] uppercase font-bold text-emerald-400">Pronto para copiar!</span>
                        </div>
                        {JSON.stringify(job, null, 2)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
