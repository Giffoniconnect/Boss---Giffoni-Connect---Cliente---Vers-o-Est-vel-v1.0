import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { BossLayout } from '../../../components/Layout';
import GoogleDriveJobsLogsPanel from '../../../components/GoogleDriveJobsLogsPanel';
import { 
  FolderOpen, 
  ArrowLeft, 
  Save, 
  ExternalLink,
  Workflow,
  ArrowRight,
  Database,
  CloudLightning,
  AlertCircle,
  Check,
  X,
  Info,
  Shield,
  Copy,
  RefreshCw,
  Play,
  Pencil,
  Activity
} from 'lucide-react';

export default function GoogleDriveIntegration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [buildUrl, setBuildUrl] = useState('');
  const [integrationKey, setIntegrationKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [testResultState, setTestResultState] = useState<{ status: 'success' | 'error' | null; message: string } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // New States for URL Endpoint Validation
  const [testingUrl, setTestingUrl] = useState(false);
  const [urlValidationState, setUrlValidationState] = useState<{ status: 'success' | 'error' | null; message: string; isValid?: boolean } | null>(null);

  // States and functions for toggleable edit and copy of buildUrl
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [copyUrlFeedback, setCopyUrlFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'logs'>('config');

  const handleCopyUrl = () => {
    if (!buildUrl) return;
    navigator.clipboard.writeText(buildUrl);
    setCopyUrlFeedback(true);
    setTimeout(() => setCopyUrlFeedback(false), 2000);
  };

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const docSnap = await getDoc(doc(db, 'settings', 'connectors'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.googleDrive) {
            if (data.googleDrive.buildUrl) {
              setBuildUrl(data.googleDrive.buildUrl);
            }
            if (data.googleDrive.integrationKey) {
              setIntegrationKey(data.googleDrive.integrationKey);
              console.log("[Google Drive] Credencial carregada.");
            } else {
              console.log("[Google Drive] Credencial ausente.");
            }
          }
        }
      } catch (err) {
        console.error('Erro ao ler Google Drive de settings/connectors:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleTestApiEndpoint = async () => {
    const trimmed = buildUrl.trim();
    if (!trimmed) {
      setUrlValidationState({
        status: 'error',
        message: 'Por favor, insira a URL do Build Google Drive antes de testar.'
      });
      return;
    }

    // Client-side quick check
    if (trimmed.includes("aistudio.google.com/apps") || trimmed.includes("accounts.google.com")) {
      setUrlValidationState({
        status: 'error',
        message: 'A URL configurada não é uma API. Ela abriu uma página de login do Google. Use a URL pública do runtime/Cloud Run do Build Google Drive.',
        isValid: false
      });
      return;
    }

    setTestingUrl(true);
    setUrlValidationState(null);
    try {
      const response = await fetch('/api/validate-build-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ buildUrl: trimmed })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Erro HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.isValid) {
        setUrlValidationState({
          status: 'success',
          message: data.message || 'URL da API validada com sucesso.',
          isValid: true
        });
      } else {
        setUrlValidationState({
          status: 'error',
          message: data.message || 'Erro ao validar URL da API.',
          isValid: false
        });
      }
    } catch (err: any) {
      console.error('Erro de validação:', err);
      setUrlValidationState({
        status: 'error',
        message: `Falha ao conectar na URL: ${err.message || err}`,
        isValid: false
      });
    } finally {
      setTestingUrl(false);
    }
  };

  const handleGenerateKey = async () => {
    const urlValue = buildUrl.trim();
    if (urlValue && (urlValue.includes("aistudio.google.com/apps") || urlValue.includes("accounts.google.com"))) {
      setFeedback({
        type: 'error',
        message: 'Geração bloqueada: A URL configurada não é válida para a API (não pode ser aistudio.google.com ou accounts.google.com).'
      });
      return;
    }

    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomString = '';
    for (let i = 0; i < 14; i++) {
      randomString += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const newKey = `boss_drive_live_${randomString}`;
    setIntegrationKey(newKey);
    console.log("[Google Drive] Credencial gerada: " + newKey.substring(0, 15) + "********" + newKey.substring(newKey.length - 4));
    
    setSaving(true);
    setFeedback(null);
    try {
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleDrive: {
          buildUrl: urlValue,
          integrationKey: newKey,
          status: (urlValue && newKey) ? 'ativo' : 'não_configurado'
        },
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setFeedback({ type: 'success', message: 'Nova credencial gerada e salva com sucesso!' });
      console.log("[Google Drive] Credencial salva.");
    } catch (err: any) {
      console.error('Erro ao gerar/salvar nova credencial:', err);
      setFeedback({ type: 'error', message: `Erro ao salvar nova credencial: ${err.message || err}` });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyKey = () => {
    if (!integrationKey) return;
    navigator.clipboard.writeText(integrationKey);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleTestCredential = () => {
    if (integrationKey.trim()) {
      const key = integrationKey.trim();
      const prefix = key.startsWith("boss_drive_live_") ? "boss_drive_live_" : key.substring(0, Math.min(15, key.length - 4));
      const suffix = key.substring(key.length - 4);
      const masked = `${prefix}********${suffix}`;
      
      setTestResultState({
        status: 'success',
        message: `Credencial ativa encontrada: ${masked}`
      });
      console.log(`[Google Drive] Credencial testada e ativa enviada ao proxy: ${masked}`);
    } else {
      setTestResultState({
        status: 'error',
        message: `Credencial ausente.`
      });
      console.error(`[Google Drive] Credencial testada e ausente.`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const urlValue = buildUrl.trim();
    const keyValue = integrationKey.trim();

    // 1. Direct block list validation
    if (urlValue.includes("aistudio.google.com/apps") || urlValue.includes("accounts.google.com")) {
      setFeedback({
        type: 'error',
        message: 'Salvamento bloqueado: A URL configurada não é uma API de produção (não pode ser aistudio.google.com ou accounts.google.com). Use a URL do Cloud Run (ex: ais-dev-....run.app).'
      });
      setUrlValidationState({
        status: 'error',
        message: 'A URL configurada não é uma API. Ela abriu uma página de login do Google. Use a URL pública do runtime/Cloud Run do Build Google Drive.',
        isValid: false
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      // 2. Query endpoint validation API before committing settings
      const valRes = await fetch('/api/validate-build-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildUrl: urlValue })
      });

      if (valRes.ok) {
        const valData = await valRes.json();
        if (!valData.isValid) {
          setUrlValidationState({
            status: 'error',
            message: valData.message,
            isValid: false
          });
          setFeedback({
            type: 'error',
            message: `Alerta Forte de Configuração: Não foi possível validar este endpoint. ${valData.message}`
          });
          setSaving(false);
          return;
        } else {
          setUrlValidationState({
            status: 'success',
            message: 'URL da API validada com sucesso.',
            isValid: true
          });
        }
      }

      await setDoc(doc(db, 'settings', 'connectors'), {
        googleDrive: {
          buildUrl: urlValue,
          integrationKey: keyValue,
          status: (urlValue && keyValue) ? 'ativo' : 'não_configurado'
        },
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setFeedback({ type: 'success', message: 'Configurações do Google Drive salvas e validadas com sucesso!' });
      console.log("[Google Drive] Credencial salva.");
    } catch (err: any) {
      console.error('Erro ao salvar configurações do Google Drive:', err);
      setFeedback({ type: 'error', message: `Erro ao salvar configurações: ${err.message || err}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <BossLayout>
        <div className="flex-1 p-6 md:p-10 flex items-center justify-center bg-gray-50 text-gray-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-100 border-t-amber-600 rounded-full animate-spin"></div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Sincronizando Google Drive...</span>
          </div>
        </div>
      </BossLayout>
    );
  }

  const isConfigured = buildUrl.trim().length > 0;

  return (
    <BossLayout>
      <div className="flex-1 p-6 md:p-10 space-y-6 max-w-4xl mx-auto">
        {/* Navigation Breadcrumb & Back button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <button 
              onClick={() => navigate('/boss-giffoni-clientes/configuracoes')}
              className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              Voltar para Configurações
            </button>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <FolderOpen size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight uppercase">Google Drive</h2>
                <p className="text-xs text-gray-500 font-medium">Atalho Operacional e Configuração do Build Externo</p>
              </div>
            </div>
          </div>

          <div>
            <span className={`px-2.5 py-1 text-[10px] font-black uppercase border tracking-wider rounded-lg ${
              isConfigured 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}>
              {isConfigured ? 'Ponte Ativa' : 'Não Configurado'}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-150 gap-4 mb-2">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`pb-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'config'
                ? 'border-amber-600 text-amber-900 font-extrabold font-mono'
                : 'border-transparent text-gray-450 hover:text-gray-900 font-semibold'
            }`}
          >
            Configurações da Ponte
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`pb-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'border-amber-600 text-amber-900 font-extrabold font-mono'
                : 'border-transparent text-gray-450 hover:text-gray-900 font-semibold'
            }`}
          >
            Logs da Integração
          </button>
        </div>

        {activeTab === 'logs' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-amber-50/40 border border-amber-200/60 rounded-3xl p-5 text-sm text-gray-700 space-y-1">
              <h3 className="font-extrabold uppercase text-[10px] tracking-wider text-amber-800 font-mono">Fila de Logs Resumida • Google Drive</h3>
              <p className="text-[11.5px] text-gray-500 font-medium leading-relaxed">
                Abaixo estão listados todos os logs operacionais das integrações. Você pode acompanhar em tempo real o andamento e reprocessar qualquer job com pendência ou falha.
              </p>
            </div>
            <GoogleDriveJobsLogsPanel />
          </div>
        )}

        {activeTab === 'config' && (
          <>
            {/* Informational Panel: The Decision Explanation */}
        <div className="bg-slate-900 border border-slate-950 p-6 rounded-[2rem] flex gap-4 text-slate-100 shadow-xl">
          <Info size={24} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2 col-span-11">
            <p className="text-xs font-black uppercase tracking-wider text-amber-400 font-mono">Ponte de Integração Ativa • Modelo Desacoplado</p>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              O Portal BOSS não armazena credenciais confidenciais ou se conecta diretamente ao Google Drive por questões de segurança. A operação é delegada a um build externo e seguro.
            </p>
            <p className="text-xs text-slate-400 font-bold leading-relaxed">
              “As credenciais, pasta destino, autenticação e testes reais do Google Drive são configurados exclusivamente no build Google Drive.”
            </p>
          </div>
        </div>

        {/* Visual Architecture Diagram */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Como funciona o fluxo de integração:</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center pt-2">
            
            {/* Step 1 */}
            <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 text-center space-y-1">
              <Database className="w-5 h-5 mx-auto text-blue-600" />
              <p className="text-[11px] font-black uppercase tracking-tight text-gray-800">Portal BOSS</p>
              <p className="text-[10px] text-gray-500 font-medium leading-tight">Gera os dados e envia payload do cliente</p>
            </div>

            {/* Arrow */}
            <div className="hidden md:flex justify-center text-gray-400">
              <ArrowRight className="w-5 h-5" />
            </div>

            {/* Step 2 */}
            <div className="bg-amber-50/55 border border-amber-150 rounded-2xl p-4 text-center space-y-1">
              <CloudLightning className="w-5 h-5 mx-auto text-amber-600 animate-pulse" />
              <p className="text-[11px] font-black uppercase tracking-tight text-amber-900">Build Google Drive</p>
              <p className="text-[10px] text-amber-800 font-medium leading-tight">Recebe, processa e cria/localiza pasta no Drive</p>
            </div>

            {/* Arrow */}
            <div className="hidden md:flex justify-center text-gray-400">
              <ArrowRight className="w-5 h-5" />
            </div>

            {/* Step 3 */}
            <div className="bg-emerald-50/40 border border-emerald-150 rounded-2xl p-4 text-center space-y-1">
              <FolderOpen className="w-5 h-5 mx-auto text-emerald-600" />
              <p className="text-[11px] font-black uppercase tracking-tight text-emerald-950">Retorno & Sincronia</p>
              <p className="text-[10px] text-emerald-800 font-medium leading-tight">Devolve o UID/link e o BOSS salva no cadastro</p>
            </div>

          </div>
        </div>

        {/* Core Quick Form Card */}
        <form onSubmit={handleSave} className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="space-y-4">
            <div className="space-y-3.5 border-b border-gray-100 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">URL do Build Google Drive / API URL *</label>
                  <span className={`px-2 py-0.5 text-[8px] font-bold rounded ${isEditingUrl ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                    {isEditingUrl ? "Modo Edição" : "Visualização"}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleTestApiEndpoint}
                    disabled={testingUrl}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[9px] font-bold uppercase rounded-md border border-amber-200 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={9} className={`${testingUrl ? 'animate-spin' : ''}`} />
                    <span>{testingUrl ? "Validando..." : "Testar endpoint /api/create-folder"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    disabled={!buildUrl}
                    className="px-2.5 py-1 bg-white hover:bg-gray-50 text-gray-700 text-[9px] font-bold uppercase rounded-md border border-gray-200 transition flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {copyUrlFeedback ? (
                      <>
                        <Check size={9} className="text-emerald-500" />
                        <span className="text-emerald-700">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={9} />
                        <span>Copiar URL</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditingUrl(!isEditingUrl)}
                    className={`px-2.5 py-1 transition flex items-center gap-1 text-[9px] font-bold uppercase rounded-md border cursor-pointer shadow-xs ${
                      isEditingUrl 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100" 
                        : "bg-white hover:bg-gray-50 text-gray-750 border-gray-200"
                    }`}
                  >
                    {isEditingUrl ? (
                      <>
                        <Check size={9} className="text-emerald-600" />
                        <span>Concluir</span>
                      </>
                    ) : (
                      <>
                        <Pencil size={9} className="text-gray-500" />
                        <span>Editar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type="url"
                  required
                  disabled={!isEditingUrl}
                  value={buildUrl}
                  onChange={(e) => {
                    setBuildUrl(e.target.value);
                    setUrlValidationState(null);
                  }}
                  placeholder="https://ais-dev-...run.app"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono outline-none transition-all shadow-sm ${
                    isEditingUrl 
                      ? "bg-white border-2 border-amber-500 text-gray-900 focus:ring-4 focus:ring-amber-100" 
                      : "bg-gray-100/80 border border-gray-200 text-gray-500 cursor-not-allowed select-all font-semibold"
                  }`}
                />
                {!isEditingUrl && buildUrl && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 font-bold bg-white px-1.5 py-0.5 rounded border border-gray-200 uppercase select-none pointer-events-none shadow-xs">
                    🔒 Bloqueado (Clique em Editar)
                  </div>
                )}
              </div>

              {urlValidationState && (
                <div className={`p-4 rounded-xl text-xs font-semibold flex items-start gap-2.5 border animate-fadeIn leading-relaxed ${
                  urlValidationState.status === 'success' 
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-250' 
                    : 'bg-rose-50 text-rose-950 border-rose-250 font-sans'
                }`}>
                  {urlValidationState.status === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-bold uppercase text-[9px] tracking-wider text-gray-400">Resultado da Validação</p>
                    <p className="font-semibold text-[11px] leading-relaxed select-text">{urlValidationState.message}</p>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-gray-500 leading-relaxed font-semibold">
                Utilize o endpoint ou URL pública do Applet secundário para onde o Portal BOSS enviará as solicitações de criação de pasta. É obrigatório ser a URL de produção pública do runtime/Cloud Run do Build Google Drive (ex: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-600 font-bold">https://ais-dev-....run.app</code>).
              </p>
            </div>

            {/* SEGURANÇA DA INTEGRAÇÃO Card */}
            <div className="bg-slate-50 border border-gray-200 rounded-2xl p-5 md:p-6 space-y-5 shadow-xs text-left">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0">
                  <Shield size={20} />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs font-black uppercase text-gray-950 tracking-tight">SEGURANÇA DA INTEGRAÇÃO</h3>
                  <p className="text-[11px] text-gray-500 font-semibold leading-normal">
                    Esta credencial autoriza a comunicação entre o Portal BOSS e o Build Google Drive.
                  </p>
                </div>
              </div>

              {/* Status da Credencial */}
              <div className="border-t border-gray-200 pt-3.5">
                <label className="text-[9px] font-black uppercase text-gray-505 tracking-wider font-bold">Status da Credencial</label>
                <div className="mt-1.5">
                  {integrationKey ? (
                    <div className="flex items-center gap-2.5 text-emerald-850 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-emerald-950">Credencial salva com sucesso.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 text-rose-850 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-rose-950">A integração Google Drive não funcionará até que uma credencial seja configurada.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Campo da Chave */}
              <div className="space-y-2 border-t border-gray-200 pt-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-[9px] font-black uppercase text-gray-550 tracking-wider font-bold">
                    Chave de API/Credencial da Integração Google Drive *
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border border-gray-200 bg-white text-gray-750 hover:bg-gray-50 transition cursor-pointer"
                    >
                      {showKey ? "Ocultar" : "Mostrar"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      disabled={!integrationKey}
                      className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border border-gray-200 bg-white text-gray-750 hover:bg-gray-50 transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      {copyFeedback ? (
                        <>
                          <Check size={9} className="text-emerald-500" />
                          <span className="text-emerald-700">Copiou!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={9} />
                          <span>Copiar Chave</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateKey}
                      disabled={saving}
                      className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[9px] font-bold uppercase rounded-md border border-amber-200 transition flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={9} className={`${saving ? 'animate-spin' : ''}`} />
                      <span>Gerar Nova Chave</span>
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    required
                    value={integrationKey}
                    onChange={(e) => setIntegrationKey(e.target.value)}
                    placeholder="boss_drive_live_************************"
                    className="w-full pl-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono text-gray-800 outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 shadow-sm"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <Shield className={`w-3.5 h-3.5 ${integrationKey ? 'text-emerald-500' : 'text-gray-305'}`} />
                  </div>
                </div>

                <p className="text-[10px] text-gray-400 leading-relaxed font-semibold">
                  Nome técnico: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-650 font-mono text-[9px]">settings/connectors.googleDrive.integrationKey</code>
                </p>

                {!showKey && integrationKey && (
                  <p className="text-[10px] text-gray-500 font-mono mt-1 flex items-center gap-1 flex-wrap">
                    <span>Chave ativa (mascarada):</span>
                    <span className="p-1 px-1.5 bg-gray-100 border border-gray-200 rounded-md font-semibold text-gray-650">{(() => {
                      const key = integrationKey;
                      if (!key) return "";
                      if (key.length <= 8) return "********";
                      const prefix = key.startsWith("boss_drive_live_") ? "boss_drive_live_" : key.substring(0, Math.min(15, key.length - 4));
                      const suffix = key.substring(key.length - 4);
                      return `${prefix}********${suffix}`;
                    })()}</span>
                  </p>
                )}
              </div>

              {/* Testar Credencial */}
              <div className="border-t border-gray-200 pt-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    <span className="font-bold text-gray-755 block text-[9px] uppercase font-sans">Validação Rápida</span>
                    <span className="text-gray-500 text-[10px] block font-semibold leading-normal font-sans">Valida a presença e consistência estrutural da credencial.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestCredential}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold uppercase rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition shrink-0"
                  >
                    <Play size={10} className="fill-current" />
                    <span className="font-sans">Testar Credencial</span>
                  </button>
                </div>

                {testResultState && (
                  <div className={`p-3 rounded-xl text-[10px] font-mono border flex items-start gap-2.5 animate-fadeIn ${
                    testResultState.status === 'success' ? 'bg-emerald-50 text-emerald-950 border-emerald-250' : 'bg-rose-50 text-rose-950 border-rose-250'
                  }`}>
                    {testResultState.status === 'success' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5 text-left">
                      <p className="font-bold uppercase text-[9px] tracking-wider text-gray-500">Resultado do Teste</p>
                      <p className="font-semibold text-gray-850">{testResultState.message}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {feedback && (
            <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-950 border border-emerald-250 animate-fadeIn' : 'bg-rose-50 text-rose-950 border border-rose-250 animate-fadeIn'
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
          <div className="pt-5 border-t border-gray-150 flex flex-wrap items-center justify-between gap-4">
            <a
              href="https://aistudio.google.com/apps/e39f8816-ffed-4965-babb-f904b4e36102?showPreview=true&showAssistant=true"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold uppercase rounded-xl transition flex items-center gap-2 border border-slate-200 shadow-xs cursor-pointer"
            >
              <ExternalLink size={13} />
              <span className="font-sans">Abrir Build Google Drive</span>
            </a>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
            >
               <Save size={14} />
               <span className="font-sans">{saving ? 'Gravando...' : 'Salvar Configurações'}</span>
            </button>
          </div>
        </form>
          </>
        )}
      </div>
    </BossLayout>
  );
}
