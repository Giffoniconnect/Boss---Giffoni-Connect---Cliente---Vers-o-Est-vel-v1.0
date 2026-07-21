import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  isProduction: boolean;
}

const CONFIG_MAP: Record<string, {
  title: string;
  headerTitle: string;
  subtitle: string;
  templateKey: string;
  badge: string;
}> = {
  'config-1-atendimento-PF': {
    title: 'Configurações de 1º Atendimento PF (GDI)',
    headerTitle: 'GDI Automatizador — Módulo 1º Atendimento PF',
    subtitle: 'Ambiente de parametrização e mapeamento do formulário de triagem e primeiro atendimento para clientes Pessoa Física.',
    templateKey: 'primeiro_atendimento',
    badge: '1º Atendimento PF'
  },
  'config-1-atendimento-PJ': {
    title: 'Configurações de 1º Atendimento PJ (GDI)',
    headerTitle: 'GDI Automatizador — Módulo 1º Atendimento PJ',
    subtitle: 'Ambiente de parametrização e mapeamento do formulário de triagem e primeiro atendimento para clientes Pessoa Jurídica.',
    templateKey: 'primeiro_atendimento_pj',
    badge: '1º Atendimento PJ'
  },
  'config-procuracao-PJ': {
    title: 'Configurações da Procuração PJ (GDI)',
    headerTitle: 'GDI Automatizador — Módulo Procuração PJ',
    subtitle: 'Ambiente de parametrização e monitoramento das procurações judiciais e extrajudiciais de Pessoa Jurídica.',
    templateKey: 'procuracao_pj',
    badge: 'Procuração PJ'
  },
  'config-declaracao-PF': {
    title: 'Configurações da Declaração PF (GDI)',
    headerTitle: 'GDI Automatizador — Módulo Declaração PF',
    subtitle: 'Ambiente de parametrização e monitoramento das declarações de hipossuficiência de clientes Pessoa Física.',
    templateKey: 'declaracao_pobreza_pf',
    badge: 'Declaração PF'
  },
  'config-declaracao-PJ': {
    title: 'Configurações da Declaração PJ (GDI)',
    headerTitle: 'GDI Automatizador — Módulo Declaração PJ',
    subtitle: 'Ambiente de parametrização e monitoramento das declarações de faturamento e isenção de clientes Pessoa Jurídica.',
    templateKey: 'declaracao_pobreza_pj',
    badge: 'Declaração PJ'
  },
  'config-contrato-de-honorarios-PF': {
    title: 'Configurações de Contrato de Honorários PF (GDI)',
    headerTitle: 'GDI Automatizador — Módulo Contrato de Honorários PF',
    subtitle: 'Ambiente de parametrização e monitoramento de contratos de prestação de serviços de clientes Pessoa Física.',
    templateKey: 'contrato_honorarios_pf',
    badge: 'Contrato Honorários PF'
  },
  'config-contrato-de-honorarios-PJ': {
    title: 'Configurações de Contrato de Honorários PJ (GDI)',
    headerTitle: 'GDI Automatizador — Módulo Contrato de Honorários PJ',
    subtitle: 'Ambiente de parametrização e monitoramento de contratos de prestação de serviços de clientes Pessoa Jurídica.',
    templateKey: 'contrato_honorarios_pj',
    badge: 'Contrato Honorários PJ'
  }
};

export default function DocTypeConfig() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Determine active configuration based on current pathname
  const pathSegment = location.pathname.split('/').pop() || '';
  const currentConfig = CONFIG_MAP[pathSegment] || CONFIG_MAP['config-1-atendimento-PF'];
  const templateKey = currentConfig.templateKey;

  // Core state containing fields
  const [state, setState] = useState<GdiConfig>({
    endpointUrl: 'https://ais-dev-rhz6adgbzyburidkotjy46-599536317399.us-east1.run.app',
    webhookUrl: 'https://ais-dev-rhz6adgbzyburidkotjy46-599536317399.us-east1.run.app/api/webhook/gdi-job',
    templateId: '',
    templateKey: templateKey,
    destinationFolderId: '1Yt-a7B9cd_ef1h2j3k4l5m6n7op_xxxx',
    destinationFolderUrl: 'https://drive.google.com/drive/folders/1Yt-a7B9cd_xxxx',
    gdiKey: 'gdi_integration_key_2026_portal_boss_docs_9XvR42LmQp77',
    integrationKey: 'gdi_integration_key_2026_portal_boss_docs_9XvR42LmQp77',
    serviceAccountEmail: 'gdi-service@boss-agency.iam.gserviceaccount.com',
    projectId: 'boss-agency-gdocs',
    callbackSecret: 'whsec_boss_callback_private_token_xyz',
    lastReceivedPayload: `{"event": "${templateKey}_created", "clientId": "f60jptoSi8Z9xat45yIb", "documentType": "${templateKey}", "timestamp": "2026-06-05T12:00:00.000Z"}`,
    lastSentPayload: `{"clientId": "f60jptoSi8Z9xat45yIb", "placeholders": {"clientName": "Fulano de Tal", "cpf": "123.456.789-00"}}`,
    lastError: 'GDI Connection Timeout: none',
    lastResponse: '{"status": "ready", "service": "gdi", "v": "1.0.0"}',
    lastSuccess: `Documento ${templateKey} gerado com sucesso no Google Drive.`,
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
          
          if (templateKey === 'primeiro_atendimento' && (!googleDocs.templates || googleDocs.templates['primeiro_atendimento'] !== '1ODrPbz7qtyeiTYnjzSdv9YQ3NqdafYoub6-KpkmTQTo')) {
            if (!googleDocs.templates) googleDocs.templates = {};
            googleDocs.templates['primeiro_atendimento'] = '1ODrPbz7qtyeiTYnjzSdv9YQ3NqdafYoub6-KpkmTQTo';
            await setDoc(docRef, {
              ...raw,
              googleDocs
            });
          }
          
          setState(prev => {
            const calculatedWebhook = googleDocs.endpointUrl 
              ? `${googleDocs.endpointUrl.trim().replace(/\/$/, '')}/api/webhook/gdi-job` 
              : prev.webhookUrl;

            // Retrieve namespaced sub-values
            const savedTemplateId = googleDocs.templates?.[templateKey] || '';
            const savedFolderId = googleDocs.destinationFolderIds?.[templateKey] || googleDocs.destinationFolderId || prev.destinationFolderId;
            const savedFolderUrl = googleDocs.destinationFolderUrls?.[templateKey] || googleDocs.destinationFolderUrl || prev.destinationFolderUrl;

            return {
              ...prev,
              endpointUrl: googleDocs.endpointUrl || prev.endpointUrl,
              webhookUrl: googleDocs.webhookUrl || calculatedWebhook,
              templateId: savedTemplateId,
              templateKey: templateKey,
              destinationFolderId: savedFolderId,
              destinationFolderUrl: savedFolderUrl,
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
  }, [templateKey]);

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
        ...currentData.googleDocs
      };

      // Namespace routing for subfields of document types
      if (fieldKey === 'endpointUrl') {
        updatedGoogleDocs.endpointUrl = valueToSave;
        updatedGoogleDocs.webhookUrl = `${valueToSave}/api/webhook/gdi-job`;
      } else if (fieldKey === 'templateId') {
        if (!updatedGoogleDocs.templates) updatedGoogleDocs.templates = {};
        updatedGoogleDocs.templates[templateKey] = valueToSave;
      } else if (fieldKey === 'destinationFolderId') {
        if (!updatedGoogleDocs.destinationFolderIds) updatedGoogleDocs.destinationFolderIds = {};
        updatedGoogleDocs.destinationFolderIds[templateKey] = valueToSave;
      } else if (fieldKey === 'destinationFolderUrl') {
        if (!updatedGoogleDocs.destinationFolderUrls) updatedGoogleDocs.destinationFolderUrls = {};
        updatedGoogleDocs.destinationFolderUrls[templateKey] = valueToSave;
      } else {
        updatedGoogleDocs[fieldKey] = valueToSave;
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
        ...currentData.googleDocs
      };

      if (fieldKey === 'templateId') {
        if (updatedGoogleDocs.templates) {
          updatedGoogleDocs.templates[templateKey] = '';
        }
      } else if (fieldKey === 'destinationFolderId') {
        if (updatedGoogleDocs.destinationFolderIds) {
          updatedGoogleDocs.destinationFolderIds[templateKey] = '';
        }
      } else if (fieldKey === 'destinationFolderUrl') {
        if (updatedGoogleDocs.destinationFolderUrls) {
          updatedGoogleDocs.destinationFolderUrls[templateKey] = '';
        }
      } else {
        updatedGoogleDocs[fieldKey] = '';
      }

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

  const getDisplayValue = (fieldKey: keyof GdiConfig, value: string) => {
    if (!value) return '(vazio)';
    
    const isSensitive = ['gdiKey', 'integrationKey', 'callbackSecret', 'templateId', 'serviceAccountEmail'].includes(fieldKey);
    
    if (!state.isProduction) {
      if (visibleFields[fieldKey] === false) {
        return '••••••••••••••••';
      }
      return value;
    }

    if (isSensitive) {
      if (!visibleFields[fieldKey]) {
        return '•••••••••••••••• (Mascarado)';
      }
      return value;
    }

    return value;
  };

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

          {/* Action buttons */}
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

                <button
                  type="button"
                  onClick={() => handleFieldDelete(fieldKey)}
                  className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-150 text-gray-700 hover:text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={11} className="text-gray-400 hover:text-rose-500" />
                  <span>Excluir</span>
                </button>

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

                <button
                  type="button"
                  onClick={() => handleCopyToClipboard(fieldKey, String(val))}
                  className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer hover:border-gray-300"
                >
                  <Copy size={11} className="text-gray-400" />
                  <span>Copiar</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <BossLayout>
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
          <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">
            Orquestrando dependências do conector {currentConfig.badge}...
          </p>
        </div>
      </BossLayout>
    );
  }

  return (
    <BossLayout>
      <div className="space-y-6">
        
        {/* TOP BAR / BREADCRUMB */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-150 pb-5 text-left font-sans">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse shrink-0"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-650 font-mono">
                {currentConfig.headerTitle}
              </span>
            </div>
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">
              {currentConfig.title}
            </h2>
            <p className="text-xs text-indigo-900 leading-normal font-medium max-w-3xl">
              {currentConfig.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
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

        {/* CHAVE GDI CARD */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-5 text-left shadow-sm">
          <div className="border-b border-gray-100 pb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Terminal className="text-indigo-600" size={18} />
              <span className="text-xs font-black uppercase text-gray-800 tracking-wider">
                Auditoria de Chaves de Integridade & Token Callback Sec
              </span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 font-mono px-2 py-0.5 border border-indigo-150 bg-indigo-50 rounded-md">
              Camada de Segurança
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {renderFieldRow('Chave no Header (X-BOSS-Google-Docs-Integration-Key)', 'integrationKey')}
            {renderFieldRow('Chave de Auditoria GDI', 'gdiKey')}
            {renderFieldRow('Token Secreto Callback (callbackSecret)', 'callbackSecret')}
          </div>
        </div>

        {/* DEMAIS DETALHES DE PARAMETRIZAÇÃO */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-5 text-left shadow-sm">
          <div className="border-b border-gray-100 pb-3 flex items-start justify-between gap-3 font-sans">
            <div className="flex items-center gap-2">
              <FolderOpen className="text-indigo-600" size={18} />
              <span className="text-xs font-black uppercase text-gray-800 tracking-wider">
                Parâmetros Globais, Templates {currentConfig.badge} & Direcionamentos Google Drive
              </span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 font-mono">
              Workspace & Credenciais
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {renderFieldRow('Endpoint Global GDI (Base URL)', 'endpointUrl')}
            {renderFieldRow(`Template ID do Google Docs para ${currentConfig.badge}`, 'templateId')}
            {renderFieldRow('ID da Pasta de Destino (Google Drive)', 'destinationFolderId')}
            {renderFieldRow('URL da Pasta de Destino (Google Drive)', 'destinationFolderUrl')}
            {renderFieldRow('E-mail da Service Account (GDI)', 'serviceAccountEmail')}
            {renderFieldRow('ID do Projeto Google Cloud Core', 'projectId')}
          </div>
          
          <div className="pt-4 border-t border-gray-100 font-sans">
            <p className="text-[10px] font-bold text-gray-400">
              Esta é a chave secreta que deve ser colada no Portal BOSS em: <span className="font-mono bg-gray-50 p-0.5 rounded text-gray-600 border border-gray-100 font-bold select-all">/boss-giffoni-clientes/configuracoes/integracoes-google-docs</span> no campo <strong>Chave secreta do header X-BOSS-Google-Docs-Integration-Key</strong>.
            </p>
          </div>
        </div>

        {/* PAYLOAD RECENTES & MONITORAMENTO DE VOLTAGEM */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left font-sans">
          
          {/* ÚLTIMO PAYLOAD RECEBIDO */}
          <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="text-indigo-600 rotate-90" size={16} />
                <span className="text-xs font-black uppercase text-gray-800 tracking-wider">
                  Último Payload Fornecido ao GDI
                </span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0"></span>
            </div>

            <div className="bg-slate-900 border border-slate-950 rounded-2xl p-4 font-mono text-[10px] text-emerald-400 overflow-auto max-h-56 leading-relaxed shadow-inner">
              <pre>{state.lastReceivedPayload}</pre>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleFieldSave('lastReceivedPayload', state.lastReceivedPayload)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Simular Recebimento
              </button>
              <button
                type="button"
                onClick={() => handleCopyToClipboard('lastReceivedPayload', state.lastReceivedPayload)}
                className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Copiar Payload
              </button>
            </div>
          </div>

          {/* SUCESSO DE TRANSMISSÃO */}
          <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="text-emerald-500" size={16} />
                <span className="text-xs font-black uppercase text-gray-800 tracking-wider">
                  Sucesso de Envio & Diagnóstico GDI
                </span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
            </div>

            <div className="space-y-3 font-semibold text-xs leading-relaxed">
              <div className="bg-emerald-50 text-emerald-950 border border-emerald-150 p-3.5 rounded-2xl">
                <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider font-mono block mb-1">Resultado de Suor:</span>
                <p>{state.lastSuccess}</p>
              </div>

              <div className="bg-rose-50 text-rose-950 border border-rose-150 p-3.5 rounded-2xl">
                <span className="text-[9px] font-black uppercase text-rose-700 tracking-wider font-mono block mb-1">Atividades Recorrentes / Erros:</span>
                <p className="font-mono text-[10px]">{state.lastError}</p>
              </div>

              <div className="bg-gray-50 border border-gray-150 p-3.5 rounded-2xl">
                <span className="text-[9px] font-black uppercase text-gray-50 tracking-wider font-mono block mb-1">Status do Oráculo GDI:</span>
                <p className="font-mono text-[10px]">{state.lastResponse}</p>
              </div>
            </div>
          </div>
        </div>

        {/* OPERATIONAL SPECIFIC PLACEHOLDERS (BLOCO 6) */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-6 text-left shadow-sm">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-black uppercase text-gray-950 font-sans tracking-tight">
                Dicionário Estruturado de Placeholders Disponíveis para {currentConfig.badge} (Bloco 6)
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                Lista de placeholders dinâmicos que serão substituídos no modelo Google Docs do fluxo de {currentConfig.badge}.
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
                {((templateKey && {
                  primeiro_atendimento: [
                    { key: "{{CLIENTE_NOME}}", desc: "Nome completo do cliente de primeiro atendimento" },
                    { key: "{{CLIENTE_NACIONALIDADE}}", desc: "Nacionalidade informada" },
                    { key: "{{CLIENTE_ESTADO_CIVIL}}", desc: "Estado civil informado" },
                    { key: "{{CLIENTE_PROFISSAO}}", desc: "Profissão informada" },
                    { key: "{{CLIENTE_RG}}", desc: "Número do RG" },
                    { key: "{{CLIENTE_CPF}}", desc: "CPF do cliente" },
                    { key: "{{CLIENTE_ENDERECO}}", desc: "Endereço completo cadastrado" },
                    { key: "{{CLIENTE_CIDADE}}", desc: "Cidade cadastrada" },
                    { key: "{{CLIENTE_ESTADO}}", desc: "Estado/UF de residência" },
                    { key: "{{CLIENTE_EMAIL}}", desc: "E-mail para contatos" },
                    { key: "{{CLIENTE_TELEFONE}}", desc: "Telefone de contato" },
                    { key: "{{TRIAGEM_MOTIVO}}", desc: "Motivo e circunstâncias fáticas que motivaram o atendimento" }
                  ],
                  primeiro_atendimento_pj: [
                    { key: "{{EMPRESA_RAZAO_SOCIAL}}", desc: "Razão social oficial da empresa" },
                    { key: "{{EMPRESA_NOME_FANTASIA}}", desc: "Nome fantasia cadastrado" },
                    { key: "{{EMPRESA_CNPJ}}", desc: "CNPJ principal ativo" },
                    { key: "{{EMPRESA_ENDERECO}}", desc: "Endereço comercial da sede" },
                    { key: "{{SOCIOS_NOMES}}", desc: "Nomes e CPFs dos sócios listados na triagem" },
                    { key: "{{CONTATO_COMERCIAL}}", desc: "Dados do contato comercial responsável" },
                    { key: "{{TRIAGEM_MOTIVO}}", desc: "Objetivo societário e escopo de assessoria" }
                  ],
                  procuracao_pj: [
                    { key: "{{EMPRESA_RAZAO}}", desc: "Razão social da empresa outorgante" },
                    { key: "{{EMPRESA_CNPJ}}", desc: "CNPJ da pessoa jurídica" },
                    { key: "{{EMPRESA_ENDERECO}}", desc: "Endereço comercial completo" },
                    { key: "{{REPRESENTANTE_NOME}}", desc: "Nome completo do sócio/procurador outorgante" },
                    { key: "{{REPRESENTANTE_CPF}}", desc: "CPF do sócio representante" },
                    { key: "{{REPRESENTANTE_RG}}", desc: "RG do sócio representante" },
                    { key: "{{REPRESENTANTE_PROFISSAO}}", desc: "Profissão do sócio representante" },
                    { key: "{{REPRESENTANTE_ENDERECO}}", desc: "Endereço residencial do sócio representante" },
                    { key: "{{DATA_ASSINATURA}}", desc: "Data corrente gerada no instante de emissão" }
                  ],
                  declaracao_pobreza_pf: [
                    { key: "{{DECLARANTE_NOME}}", desc: "Nome completo do declarante outorgante" },
                    { key: "{{DECLARANTE_CPF}}", desc: "CPF do declarante outorgante" },
                    { key: "{{DECLARANTE_RG}}", desc: "RG do declarante outorgante" },
                    { key: "{{DECLARANTE_ENDERECO}}", desc: "Endereço de residência mestre" },
                    { key: "{{DECLARANTE_ESTADO_CIVIL}}", desc: "Estado Civil do declarante" },
                    { key: "{{RENDA_MENSAL}}", desc: "Declaração fática de renda líquida para fins de gratuidade judicial" },
                    { key: "{{DATA_ASSINATURA}}", desc: "Data corrente gerada no instante de emissão" }
                  ],
                  declaracao_pobreza_pj: [
                    { key: "{{EMPRESA_RAZAO}}", desc: "Razão social oficial declarante" },
                    { key: "{{EMPRESA_CNPJ}}", desc: "CNPJ mestre da pessoa jurídica" },
                    { key: "{{EMPRESA_ENDERECO}}", desc: "Endereço mestre da empresa" },
                    { key: "{{DECLARANTE_REPRESENTANTE}}", desc: "Nome do administrador responsável" },
                    { key: "{{DECLARANTE_REPRESENTANTE_CPF}}", desc: "CPF do administrador responsável" },
                    { key: "{{FATURAMENTO_ANUAL}}", desc: "Faturamento informado para comprovação de insuficiência de recursos" },
                    { key: "{{DATA_ASSINATURA}}", desc: "Data corrente gerada no instante de emissão" }
                  ],
                  contrato_honorarios_pf: [
                    { key: "{{CONTRATANTE_NOME}}", desc: "Nome completo do contratante" },
                    { key: "{{CONTRATANTE_CPF}}", desc: "CPF do contratante" },
                    { key: "{{CONTRATANTE_RG}}", desc: "RG do contratante" },
                    { key: "{{CONTRATANTE_ENDERECO}}", desc: "Endereço residencial completo" },
                    { key: "{{CONTRATO_VALOR}}", desc: "Valor integral dos honorários advocatícios" },
                    { key: "{{CONTRATO_PARCELAS}}", desc: "Condições e número de parcelamento acordado" },
                    { key: "{{CONTRATO_PRESTACAO_SERVICO}}", desc: "Resumo do escopo e objeto da prestação de serviços" },
                    { key: "{{DATA_ASSINATURA}}", desc: "Data corrente gerada no instante de assinatura do contrato" }
                  ],
                  contrato_honorarios_pj: [
                    { key: "{{CONTRATANTE_RAZAO}}", desc: "Razão social da empresa contratante" },
                    { key: "{{CONTRATANTE_CNPJ}}", desc: "CNPJ da empresa contratante" },
                    { key: "{{CONTRATANTE_ENDERECO}}", desc: "Endereço comercial mestre" },
                    { key: "{{CONTRATE_REPRESENTANTE}}", desc: "Sócio administrador que firma o contrato" },
                    { key: "{{CONTRATO_VALOR}}", desc: "Valor total da verba honorária acordada" },
                    { key: "{{CONTRATO_PARCELAS}}", desc: "Condições tributárias e de parcelamento corporativo" },
                    { key: "{{CONTRATO_PRESTACAO_SERVICO}}", desc: "Descrição jurídica do escopo do processo contratado" },
                    { key: "{{DATA_ASSINATURA}}", desc: "Data corrente gerada no instante de assinatura do contrato" }
                  ]
                }[templateKey as string]) || [
                  { key: "{{DATA_ASSINATURA}}", desc: "Data corrente gerada no instante de emissão do documento" }
                ]).map((item: any, id: number) => (
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

        {/* BOTTOM ACTION BAR */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-150 font-sans">
          <button
            type="button"
            onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs')}
            className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Voltar ao Menu Regulatório</span>
          </button>
        </div>

      </div>
    </BossLayout>
  );
}
