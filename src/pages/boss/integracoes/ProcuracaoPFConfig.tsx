import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { isInvalidGdiIntegrationKey, normalizeGdiBaseUrl } from '../../../lib/integrations/googleDocsStatus';
import { BossLayout } from '../../../components/Layout';
import { 
  FileText, 
  ArrowLeft, 
  Save, 
  Play, 
  Terminal, 
  AlertCircle, 
  Check, 
  X,
  Info,
  Activity,
  Eye,
  EyeOff,
  Copy,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  RefreshCw,
  FolderOpen
} from 'lucide-react';

interface GdiConfig {
  endpointUrl: string;
  webhookUrl: string;
  templateId: string;
  templateKey: string;
  destinationFolderId: string;
  destinationFolderUrl: string;
  gdiKey: string; // Chave de Auditoria GDI (X-BOSS-Google-Docs-Integration-Key)
  integrationKey: string; // Portal BOSS Integration Key for match checks
  serviceAccountEmail: string;
  projectId: string;
  callbackSecret: string;
  lastReceivedPayload: string;
  lastSentPayload: string;
  lastError: string;
  lastResponse: string;
  lastSuccess: string;
  
  // App settings
  isProduction: boolean; // false = Preview, true = Deploy Blindado
}

export default function ProcuracaoPFConfig() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Core state containing all TAREFA 1 & 4 fields
  const [state, setState] = useState<GdiConfig>({
    endpointUrl: 'https://ais-dev-rhz6adgbzyburidkotjy46-599536317399.us-east1.run.app',
    webhookUrl: 'https://ais-dev-rhz6adgbzyburidkotjy46-599536317399.us-east1.run.app/api/webhook/gdi-job',
    templateId: '1ux-XoO_D_N6iK7Z9xNExPlW78p3bDoY4M5K_xxxxxxx',
    templateKey: 'procuracao-pf',
    destinationFolderId: '1Yt-a7B9cd_ef1h2j3k4l5m6n7op_xxxx',
    destinationFolderUrl: 'https://drive.google.com/drive/folders/1Yt-a7B9cd_xxxx',
    gdiKey: 'gdi_integration_key_2026_portal_boss_docs_9XvR42LmQp77',
    integrationKey: 'gdi_integration_key_2026_portal_boss_docs_9XvR42LmQp77',
    serviceAccountEmail: 'gdi-service@boss-agency.iam.gserviceaccount.com',
    projectId: 'boss-agency-gdocs',
    callbackSecret: 'whsec_boss_callback_private_token_xyz',
    lastReceivedPayload: '{"event": "procuracao_pf_created", "clientId": "f60jptoSi8Z9xat45yIb", "documentType": "procuracao_pf", "timestamp": "2026-06-05T12:00:00.000Z"}',
    lastSentPayload: '{"clientId": "f60jptoSi8Z9xat45yIb", "placeholders": {"clientName": "Fulano de Tal", "cpf": "123.456.789-00"}}',
    lastError: 'GDI Connection Timeout: none',
    lastResponse: '{"status": "ready", "service": "gdi", "v": "1.0.0"}',
    lastSuccess: 'Documento procuracao_pf gerado com sucesso no Google Drive.',
    isProduction: false // Default to Preview
  });

  // Track editable fields locally
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  
  // Visibility states for masking toggle
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [successFields, setSuccessFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const docRef = doc(db, 'settings', 'connectors');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const raw = docSnap.data();
          const googleDocs = raw.googleDocs || {};
          
          setState(prev => {
            const calculatedWebhook = googleDocs.endpointUrl 
              ? `${googleDocs.endpointUrl.trim().replace(/\/$/, '')}/api/webhook/gdi-job` 
              : prev.webhookUrl;

            return {
              ...prev,
              endpointUrl: googleDocs.endpointUrl || prev.endpointUrl,
              webhookUrl: googleDocs.webhookUrl || calculatedWebhook,
              templateId: googleDocs.templateId || prev.templateId,
              templateKey: googleDocs.templateKey || prev.templateKey,
              destinationFolderId: googleDocs.destinationFolderId || prev.destinationFolderId,
              destinationFolderUrl: googleDocs.destinationFolderUrl || prev.destinationFolderUrl,
              gdiKey: googleDocs.gdiKey || googleDocs.integrationKey || prev.gdiKey,
              integrationKey: googleDocs.integrationKey || prev.integrationKey,
              serviceAccountEmail: googleDocs.serviceAccountEmail || prev.serviceAccountEmail,
              projectId: googleDocs.projectId || prev.projectId,
              callbackSecret: googleDocs.callbackSecret || prev.callbackSecret,
              lastReceivedPayload: googleDocs.lastReceivedPayload ? JSON.stringify(googleDocs.lastReceivedPayload, null, 2) : (googleDocs.lastReceivedPayload || prev.lastReceivedPayload),
              lastSentPayload: googleDocs.lastSentPayload ? JSON.stringify(googleDocs.lastSentPayload, null, 2) : (googleDocs.lastSentPayload || prev.lastSentPayload),
              lastError: googleDocs.lastError || prev.lastError,
              lastResponse: googleDocs.lastResponse || prev.lastResponse,
              lastSuccess: googleDocs.lastSuccess || prev.lastSuccess,
              isProduction: googleDocs.isProduction !== undefined ? googleDocs.isProduction : prev.isProduction
            };
          });
        }
      } catch (err: any) {
        console.error('Erro ao carregar dados do conector do GDI:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleFieldSave = async (fieldKey: keyof GdiConfig, customValue?: string) => {
    setSaving(fieldKey);
    setFeedback(null);
    try {
      let valueToSave = customValue !== undefined ? customValue : tempValue;
      
      if (fieldKey === 'integrationKey' || fieldKey === 'gdiKey') {
        const cleanedVal = valueToSave.trim();
        if (isInvalidGdiIntegrationKey(cleanedVal)) {
          setFeedback({
            type: 'error',
            message: 'Valor inválido no campo da chave. Você colou uma rota, URL ou placeholder no lugar da Chave de Auditoria GDI.'
          });
          setSaving(null);
          return;
        }
        valueToSave = cleanedVal;
      }

      const docRef = doc(db, 'settings', 'connectors');
      const docSnap = await getDoc(docRef);
      const currentData = docSnap.exists() ? docSnap.data() : {};
      
      if (fieldKey === 'endpointUrl') {
        valueToSave = normalizeGdiBaseUrl(valueToSave);
      }

      const updatedGoogleDocs = {
        ...currentData.googleDocs,
        [fieldKey]: valueToSave
      };

      // Ensure that if we modify the base endpointUrl, we update webhookUrl too
      if (fieldKey === 'endpointUrl') {
        updatedGoogleDocs.webhookUrl = `${valueToSave}/api/webhook/gdi-job`;
      }

      // Sync correlation keys
      if (fieldKey === 'gdiKey') {
        // Also update the integrationKey if needed or compare them
      }

      await setDoc(docRef, {
        ...currentData,
        googleDocs: updatedGoogleDocs
      });

      setState(prev => {
        const nextState = { ...prev, [fieldKey]: valueToSave };
        if (fieldKey === 'endpointUrl') {
          const cleanUrl = valueToSave.trim().replace(/\/$/, "");
          nextState.webhookUrl = `${cleanUrl}/api/webhook/gdi-job`;
        }
        return nextState;
      });

      setSuccessFields(prev => ({ ...prev, [fieldKey]: true }));
      setTimeout(() => {
        setSuccessFields(prev => ({ ...prev, [fieldKey]: false }));
      }, 2000);

      setEditingField(null);
      setFeedback({
        type: 'success',
        message: `Campo "${fieldKey}" salvo com sucesso no banco de dados!`
      });
    } catch (err: any) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: `Erro ao salvar o campo: ${err.message || err}`
      });
    } finally {
      setSaving(null);
    }
  };

  const handleFieldDelete = async (fieldKey: keyof GdiConfig) => {
    const confirmDelete = window.confirm(`Deseja realmente limpar/excluir o valor de "${fieldKey}"?`);
    if (!confirmDelete) return;

    setSaving(fieldKey);
    try {
      const docRef = doc(db, 'settings', 'connectors');
      const docSnap = await getDoc(docRef);
      const currentData = docSnap.exists() ? docSnap.data() : {};
      
      const updatedGoogleDocs = {
        ...currentData.googleDocs,
        [fieldKey]: ''
      };

      await setDoc(docRef, {
        ...currentData,
        googleDocs: updatedGoogleDocs
      });

      setState(prev => ({ ...prev, [fieldKey]: '' }));

      setFeedback({
        type: 'success',
        message: `Valor do campo "${fieldKey}" excluído com sucesso!`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erro ao excluir campo: ${err.message || err}`
      });
    } finally {
      setSaving(null);
    }
  };

  const handleToggleEnvironment = async (toProd: boolean) => {
    try {
      const docRef = doc(db, 'settings', 'connectors');
      const docSnap = await getDoc(docRef);
      const currentData = docSnap.exists() ? docSnap.data() : {};
      
      const updatedGoogleDocs = {
        ...currentData.googleDocs,
        isProduction: toProd
      };

      await setDoc(docRef, {
        ...currentData,
        googleDocs: updatedGoogleDocs
      });

      setState(prev => ({ ...prev, isProduction: toProd }));
      setFeedback({
        type: 'success',
        message: `Ambiente alterado com sucesso para ${toProd ? 'Modo Deploy Blindado 🚀' : 'Modo Preview Aberto ☁️'}`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erro ao alterar modo: ${err.message || err}`
      });
    }
  };

  const handleCopyToClipboard = (fieldKey: keyof GdiConfig, val: string) => {
    // If in production/deploy, require confirmation to copy sensitive values
    let isSensitive = ['gdiKey', 'integrationKey', 'callbackSecret', 'templateId'].includes(fieldKey);
    if (state.isProduction && isSensitive) {
      const confirmCopy = window.confirm("Você está no Modo Deploy Blindado. Deseja revelar e copiar esta credencial sensível?");
      if (!confirmCopy) return;
    }

    navigator.clipboard.writeText(val);
    setFeedback({
      type: 'success',
      message: `Copiado: "${fieldKey}" foi copiado com sucesso para a área de transferência!`
    });
  };

  const handleToggleVisibility = (fieldKey: string) => {
    // If in production/deploy, require confirmation to reveal sensitive values
    let isSensitive = ['gdiKey', 'integrationKey', 'callbackSecret', 'templateId'].includes(fieldKey);
    if (state.isProduction && isSensitive && !visibleFields[fieldKey]) {
      const confirmReveal = window.confirm("Você está no Modo Deploy Blindado. Deseja realmente visualizar esta credencial sensível em tela pública?");
      if (!confirmReveal) return;
    }

    setVisibleFields(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  // Helper to mask values in production/deploy mode
  const getDisplayValue = (fieldKey: keyof GdiConfig, value: string) => {
    if (!value) return '(vazio)';
    
    // Check if we should mask
    const isSensitive = ['gdiKey', 'integrationKey', 'callbackSecret', 'templateId', 'serviceAccountEmail'].includes(fieldKey);
    
    // In Preview Mode, everything is displayed fully unless explicitly toggled off by user
    if (!state.isProduction) {
      if (visibleFields[fieldKey] === false) {
        return '••••••••••••••••';
      }
      return value;
    }

    // In Deploy Blindado Mode, treat sensitive values as masked by default unless revealed with confirmation
    if (isSensitive) {
      if (!visibleFields[fieldKey]) {
        return '•••••••••••••••• (Mascarado)';
      }
      return value;
    }

    return value;
  };

  // Check comparison chaves between GDI Key and Portal Boss Key
  const renderComparisonCard = () => {
    const isMatched = (state.gdiKey && state.integrationKey && state.gdiKey.trim() === state.integrationKey.trim());
    return (
      <div className={`p-6 border rounded-3xl text-left shadow-sm space-y-4 transition-all duration-300 ${
        isMatched 
          ? 'bg-emerald-50/70 border-emerald-200' 
          : 'bg-rose-50/70 border-rose-200'
      }`}>
        <div className="flex items-center justify-between border-b border-gray-150/40 pb-3">
          <div className="flex items-center gap-2">
            <Activity className={isMatched ? 'text-emerald-600 animate-pulse' : 'text-rose-500'} size={18} />
            <span className="text-xs font-black uppercase tracking-wider text-gray-800">
              Comparador de Chaves entre Portais (Tarefa 6)
            </span>
          </div>
          <span className={`px-2.5 py-1 text-[9px] font-black uppercase font-mono tracking-wider rounded-lg ${
            isMatched ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
          }`}>
            {isMatched ? 'Chaves Sincronizadas' : 'Chaves Divergentes'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
          <div className="bg-white p-3 rounded-2xl border border-gray-200 space-y-1.5 shadow-xs">
            <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider font-mono">Portal BOSS enviará:</span>
            <div className="space-y-1 text-gray-700">
              <div><strong className="text-gray-500 font-mono text-[10px]">Endpoint:</strong> POST {state.endpointUrl || '(vazio)'}/api/webhook/gdi-job</div>
              <div><strong className="text-gray-500 font-mono text-[10px]">Header:</strong> X-BOSS-Google-Docs-Integration-Key</div>
              <div className="break-all"><strong className="text-gray-500 font-mono text-[10px]">Chave Enviada:</strong> <code className="font-mono bg-gray-50 p-1 rounded font-bold text-gray-900 border border-gray-100">{getDisplayValue('integrationKey', state.integrationKey)}</code></div>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-gray-200 space-y-1.5 shadow-xs">
            <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider font-mono">GDI Espera:</span>
            <div className="space-y-1 text-gray-700">
              <div><strong className="text-gray-500 font-mono text-[10px]">Endpoint:</strong> POST /api/webhook/gdi-job</div>
              <div><strong className="text-gray-500 font-mono text-[10px]">Header:</strong> X-BOSS-Google-Docs-Integration-Key</div>
              <div className="break-all"><strong className="text-gray-500 font-mono text-[10px]">Chave Esperada (GDI):</strong> <code className="font-mono bg-gray-50 p-1 rounded font-bold text-gray-900 border border-gray-100">{getDisplayValue('gdiKey', state.gdiKey)}</code></div>
            </div>
          </div>
        </div>

        {isMatched ? (
          <div className="p-3 bg-emerald-100/40 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
            <Check size={16} className="text-emerald-600 shrink-0" />
            <p className="font-bold">
              Chaves sincronizadas. O Portal BOSS está apto a enviar payload real ao GDI.
            </p>
          </div>
        ) : (
          <div className="p-3 bg-rose-100/40 text-rose-900 rounded-xl text-xs flex items-center gap-2">
            <X size={16} className="text-rose-600 shrink-0" />
            <p className="font-bold">
              Chaves divergentes. O GDI não reconhecerá o payload real. É necessário copiar a chave do GDI e salvar no Portal BOSS.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderFieldRow = (label: string, fieldKey: keyof GdiConfig, isTextArea: boolean = false) => {
    const val = state[fieldKey];
    const isEditingThis = editingField === fieldKey;
    const isSensitive = ['gdiKey', 'integrationKey', 'callbackSecret', 'templateId'].includes(fieldKey);
    const calculatedValue = getDisplayValue(fieldKey, String(val));
    const isSuccess = successFields[fieldKey];

    return (
      <div key={fieldKey} className="border-b border-gray-100 last:border-b-0 py-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div className="space-y-1 md:max-w-xs xl:max-w-sm flex-1">
          <label className="text-xs font-black uppercase text-gray-800 tracking-tight block font-sans">{label}</label>
          <span className="text-[9px] font-bold text-gray-400 font-mono break-all leading-none bg-gray-50 px-1.5 py-0.5 rounded border border-gray-150">
            {fieldKey}
          </span>
        </div>

        <div className="flex-1 space-y-2">
          {isEditingThis ? (
            <div className="flex gap-2">
              {isTextArea ? (
                <textarea
                  className="w-full p-2.5 bg-gray-50 border border-gray-350 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-150 text-gray-800 font-semibold"
                  rows={4}
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-350 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-150 text-gray-800 font-semibold"
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                />
              )}
            </div>
          ) : (
            <div className={`p-3 rounded-xl border font-mono select-all text-xs break-all leading-relaxed whitespace-pre-wrap ${
              isSensitive 
                ? 'bg-slate-900 border-slate-950 text-emerald-400 font-bold' 
                : 'bg-gray-50 border-gray-150 text-gray-700 font-semibold'
            }`}>
              {calculatedValue}
            </div>
          )}

          {/* Action buttons (Editar, Excluir, Visualizar, Copiar, Salvar, Voltar) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {isEditingThis ? (
              <>
                <button
                  type="button"
                  onClick={() => handleFieldSave(fieldKey)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Save size={11} />
                  <span>Salvar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingField(null)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  <span>Voltar</span>
                </button>
              </>
            ) : (
              <>
                {/* 1. BUTTON: EDITAR */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingField(fieldKey);
                    setTempValue(String(val));
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer hover:border-gray-300"
                >
                  <Pencil size={11} className="text-gray-400" />
                  <span>Editar</span>
                </button>

                {/* 2. BUTTON: SALVAR (directly saves current state value into Firebase again for security validation) */}
                <button
                  type="button"
                  onClick={() => handleFieldSave(fieldKey, String(val))}
                  className={`px-2.5 py-1 bg-white hover:bg-gray-50 border text-gray-700 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                    isSuccess ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Save size={11} className={isSuccess ? 'text-emerald-600' : 'text-gray-400'} />
                  <span>{isSuccess ? 'Salvo ✓' : 'Salvar'}</span>
                </button>

                {/* 3. BUTTON: EXCLUIR */}
                <button
                  type="button"
                  onClick={() => handleFieldDelete(fieldKey)}
                  className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-150 text-gray-700 hover:text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={11} className="text-gray-400 hover:text-rose-500" />
                  <span>Excluir</span>
                </button>

                {/* 4. BUTTON: VISUALIZAR (Toggles masking) */}
                <button
                  type="button"
                  onClick={() => handleToggleVisibility(String(fieldKey))}
                  className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer hover:border-gray-300"
                >
                  {visibleFields[fieldKey] === false || (state.isProduction && !visibleFields[fieldKey]) ? (
                    <>
                      <Eye size={11} className="text-gray-400" />
                      <span>Visualizar</span>
                    </>
                  ) : (
                    <>
                      <EyeOff size={11} className="text-indigo-600" />
                      <span>Ocultar</span>
                    </>
                  )}
                </button>

                {/* 5. BUTTON: COPIAR */}
                <button
                  type="button"
                  onClick={() => handleCopyToClipboard(fieldKey, String(val))}
                  className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer hover:border-gray-300"
                >
                  <Copy size={11} className="text-gray-400" />
                  <span>Copiar</span>
                </button>

                {/* 6. BUTTON: VOLTAR / VOLTAR AO MENU */}
                <button
                  type="button"
                  onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs')}
                  className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer hover:border-gray-300"
                >
                  <ArrowLeft size={11} className="text-gray-400" />
                  <span>Voltar</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <BossLayout>
      <div className="space-y-6">
        
        {/* TOP BAR / BREADCRUMB */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-150 pb-5 text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse shrink-0"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-650 font-mono">
                GDI Automatizador — Módulo Procuração PF
              </span>
            </div>
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">
              Configurações da Procuração PF (GDI)
            </h2>
            <p className="text-xs text-indigo-900 leading-normal font-medium">
              Ambiente de automação das procurações judiciais e extrajudiciais de Pessoa Física.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Header selector for environments to meet TAREFA 2 & TAREFA 3 */}
            <div className="bg-gray-100 p-1 rounded-xl border border-gray-200 flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleToggleEnvironment(false)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                  !state.isProduction 
                    ? 'bg-white text-indigo-700 shadow-xs' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Unlock size={11} />
                <span>Simular Preview</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleEnvironment(true)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                  state.isProduction 
                    ? 'bg-slate-900 text-emerald-400 shadow-xs' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Lock size={11} />
                <span>Simular Deploy Blindado</span>
              </button>
            </div>

            <button
              onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-xs font-black uppercase text-gray-700 rounded-xl transition"
            >
              <ArrowLeft size={13} />
              <span>Voltar</span>
            </button>
          </div>
        </div>

        {/* INTEGRATION ENVIRONMENT STATE CARD */}
        {state.isProduction ? (
          <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-950 rounded-3xl text-left shadow-md flex items-start gap-4 text-white animate-fadeIn">
            <div className="w-10 h-10 bg-emerald-950/80 text-emerald-400 border border-emerald-900/40 rounded-2xl flex items-center justify-center font-bold shrink-0 shadow-inner">
              <Lock size={20} className="stroke-[2.5px]" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 font-mono">
                MODO DEPLOY BLINDADO ACTIVED (🚀 PRODUÇÃO)
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                Credenciais sensíveis protegidas contra vazamentos públicos. Chaves, tokens e segredos estão mascarados por padrão em produção e requerem confirmação de segurança explícita para visualização ou cópia em tela pública.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-5 bg-gradient-to-r from-indigo-50 to-indigo-100/50 border border-indigo-200 rounded-3xl text-left shadow-xs flex items-start gap-4 text-indigo-950 animate-fadeIn animate-duration-300">
            <div className="w-10 h-10 bg-white border border-indigo-200 text-indigo-700 rounded-2xl flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Unlock size={20} className="stroke-[2.5px]" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-805 font-mono">
                MODO PREVIEW ABERTO
              </h4>
              <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                Diagnóstico liberado. Chaves e endpoints técnicos estão totalmente visíveis sem mascaramento de segurança para fins de testes rápidos, depuração física de payloads, fácil cópia de chaves operacionais e desenvolvimento em homologação.
              </p>
            </div>
          </div>
        )}

        {/* FEEDBACK STATUS ALERTS */}
        {feedback && (
          <div className={`p-4 rounded-2xl text-xs font-semibold flex items-start justify-between ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-950 border border-emerald-200' : 'bg-rose-50 text-rose-950 border border-rose-200'
          }`}>
            <div className="flex items-start gap-2.5">
              <AlertCircle size={16} className={`shrink-0 mt-0.5 ${feedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`} />
              <span className="text-left">{feedback.message}</span>
            </div>
            <button type="button" onClick={() => setFeedback(null)} className="shrink-0">
              <X size={14} className="opacity-60 hover:opacity-100 cursor-pointer" />
            </button>
          </div>
        )}

        {/* TAREFA 6 — ROADMATCH COMPARADOR */}
        {renderComparisonCard()}

        {/* CHAVE GDI CARD (TAREFA 4) */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-5 text-left shadow-sm">
          <div className="border-b border-gray-100 pb-3 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-650 font-mono">
                Tarefa 4 — Chave de Auditoria GDI (X-BOSS-Google-Docs-Integration-Key)
              </h3>
              <p className="text-xs text-gray-500 font-medium font-semibold leading-relaxed">
                Esta é a chave secreta que deve ser colada no Portal BOSS em: <span className="font-mono bg-gray-50 p-0.5 rounded text-gray-600 border border-gray-100 font-bold select-all">/boss-giffoni-clientes/configuracoes/integracoes-google-docs</span> no campo <strong>Chave secreta do header X-BOSS-Google-Docs-Integration-Key</strong>.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-gray-200 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <span className="text-[10px] font-black uppercase text-gray-500 font-mono tracking-wider block">Chave de Auditoria GDI</span>
                <div className="py-2.5 px-3 bg-slate-900 border border-slate-950 text-emerald-400 font-mono font-bold rounded-xl text-xs select-all text-left">
                  {getDisplayValue('gdiKey', state.gdiKey)}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                {/* Visualizar chave */}
                <button
                  type="button"
                  onClick={() => handleToggleVisibility('gdiKey')}
                  className="px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                >
                  {visibleFields.gdiKey ? <EyeOff size={11} className="text-indigo-600" /> : <Eye size={11} className="text-gray-400" />}
                  <span>{visibleFields.gdiKey ? 'Ocultar' : 'Visualizar Chave'}</span>
                </button>

                {/* Copiar chave */}
                <button
                  type="button"
                  onClick={() => handleCopyToClipboard('gdiKey', state.gdiKey)}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Copy size={11} />
                  <span>Copiar Chave</span>
                </button>

                {/* Editar chave */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingField('gdiKey');
                    setTempValue(state.gdiKey);
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Pencil size={11} className="text-gray-400" />
                  <span>Editar Chave</span>
                </button>

                {/* Salvar chave */}
                <button
                  type="button"
                  onClick={() => handleFieldSave('gdiKey', state.gdiKey)}
                  className="px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Save size={11} className="text-emerald-500" />
                  <span>Salvar Chave</span>
                </button>

                {/* Excluir chave */}
                <button
                  type="button"
                  onClick={() => handleFieldDelete('gdiKey')}
                  className="px-2.5 py-1.5 bg-white hover:bg-red-50 border border-gray-200 text-gray-700 hover:text-red-650 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={11} className="text-gray-400" />
                  <span>Excluir Chave</span>
                </button>

                {/* Voltar */}
                <button
                  type="button"
                  onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs')}
                  className="px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={11} />
                  <span>Voltar</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* LIST OF ALL OPERATIONAL AND TECHNICAL FIELDS (TAREFA 1) */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-6 text-left shadow-sm">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-black uppercase text-gray-950 font-sans tracking-tight">
                Lista de Parâmetros Técnicos Operacionais da Integração
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                Edite, gerencie, remova ou copie parâmetros de baixo nível físico vinculados ao conector GDI.
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-100 font-sans">
            {renderFieldRow('GDI API URL Base', 'endpointUrl')}
            {renderFieldRow('Webhook Callback URL', 'webhookUrl')}
            {renderFieldRow('Google Docs Template ID (Procuração PF)', 'templateId')}
            {renderFieldRow('Template Key', 'templateKey')}
            {renderFieldRow('Destination Drive Folder ID', 'destinationFolderId')}
            {renderFieldRow('Destination Folder URL', 'destinationFolderUrl')}
            {renderFieldRow('Service Account Client Email', 'serviceAccountEmail')}
            {renderFieldRow('Google Cloud Project ID', 'projectId')}
            {renderFieldRow('Callback Security Token/Secret', 'callbackSecret')}
            {renderFieldRow('Último Payload Recebido', 'lastReceivedPayload', true)}
            {renderFieldRow('Último Payload Enviado', 'lastSentPayload', true)}
            {renderFieldRow('Último Erro Operacional', 'lastError', true)}
            {renderFieldRow('Última Resposta Bruta do Servidor', 'lastResponse', true)}
            {renderFieldRow('Último Sucesso Operacional', 'lastSuccess', true)}
          </div>
        </div>

        {/* OPERATIONAL SPECIFIC PLACEHOLDERS (BLOCO 6) */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-6 text-left shadow-sm">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-black uppercase text-gray-950 font-sans tracking-tight">
                Dicionário Estruturado de Placeholders Disponíveis (Bloco 6)
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                Lista de placeholders dinâmicos que serão substituídos no modelo Google Docs do fluxo de Procuração Pessoa Física.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100 font-sans text-xs">
              <thead className="bg-gray-50/75">
                <tr>
                  <th className="px-4 py-3 text-left font-black text-gray-700 uppercase tracking-wider text-[10px]">Placeholder</th>
                  <th className="px-4 py-3 text-left font-black text-gray-700 uppercase tracking-wider text-[10px]">Origem / Descrição Técnica</th>
                  <th className="px-4 py-3 text-right font-black text-gray-700 uppercase tracking-wider text-[10px] w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 font-mono">
                {[
                  { key: "{{OUTORGANTE_NOME}}", desc: "Etapa 1 / Pessoa Física / Dados Pessoais / Nome Completo" },
                  { key: "{{OUTORGANTE_NACIONALIDADE}}", desc: "Etapa 1 / Pessoa Física / Dados Pessoais / Nacionalidade" },
                  { key: "{{OUTORGANTE_ESTADO_CIVIL}}", desc: "Etapa 1 / Pessoa Física / Dados Pessoais / Estado Civil" },
                  { key: "{{OUTORGANTE_PROFISSAO}}", desc: "Etapa 1 / Pessoa Física / Dados Pessoais / Profissão" },
                  { key: "{{OUTORGANTE_RG}}", desc: "Etapa 1 / Pessoa Física / Dados Pessoais / RG" },
                  { key: "{{OUTORGANTE_CPF}}", desc: "Etapa 1 / Pessoa Física / Dados Pessoais / CPF" },
                  { key: "{{OUTORGANTE_ENDERECO}}", desc: "Etapa 1 / Pessoa Física / Endereço / Endereço" },
                  { key: "{{OUTORGANTE_NUMERO}}", desc: "Etapa 1 / Pessoa Física / Endereço / Número" },
                  { key: "{{OUTORGANTE_COMPLEMENTO}}", desc: "Etapa 1 / Pessoa Física / Endereço / Complemento" },
                  { key: "{{OUTORGANTE_BAIRRO}}", desc: "Etapa 1 / Pessoa Física / Endereço / Bairro" },
                  { key: "{{OUTORGANTE_CIDADE}}", desc: "Etapa 1 / Pessoa Física / Endereço / Cidade" },
                  { key: "{{OUTORGANTE_ESTADO}}", desc: "Etapa 1 / Pessoa Física / Endereço / Estado" },
                  { key: "{{OUTORGANTE_CEP}}", desc: "Etapa 1 / Pessoa Física / Endereço / CEP" },
                  { key: "{{OUTORGANTE_TELEFONE}}", desc: "Etapa 1 / Pessoa Física / Contato / Telefone" },
                  { key: "{{OUTORGANTE_WHATSAPP}}", desc: "Etapa 1 / Pessoa Física / Contato / WhatsApp" },
                  { key: "{{OUTORGANTE_EMAIL}}", desc: "Etapa 1 / Pessoa Física / Contato / E-mail" },
                  { key: "{{DATA_ASSINATURA}}", desc: "Data gerada automaticamente no momento da emissão da procuração" }
                ].map((item, id) => (
                  <tr key={id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3 font-semibold text-indigo-700 font-mono select-all shrink-0">
                      {item.key}
                    </td>
                    <td className="px-4 py-3 text-slate-550 font-sans text-xs">
                      {item.desc}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.key);
                        }}
                        className="p-1 px-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-[10px] font-sans font-bold uppercase transition flex items-center gap-1 ml-auto cursor-pointer"
                        title="Copiar Placeholder"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </BossLayout>
  );
}
