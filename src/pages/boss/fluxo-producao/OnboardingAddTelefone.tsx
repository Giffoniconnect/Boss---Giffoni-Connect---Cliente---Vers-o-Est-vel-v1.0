import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import FluxoStepLayout from './components/FluxoStepLayout';
import { extractClientPhone } from './onboardingHelper';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  Info,
  CheckSquare,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  UserCheck,
  ChevronDown,
  ChevronUp,
  LogIn,
  KeyRound
} from 'lucide-react';

interface DetailedSyncError {
  title: string;
  friendlyDiagnosis: string;
  remedy: string;
  statusCode?: number;
  errorCategory?: string;
  technicalDetails?: any;
  rawMessage?: string;
}

export default function OnboardingAddTelefone() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { googleAccessToken, loginWithGoogle } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<DetailedSyncError | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    telefoneClienteAdicionadoCelular: '', // 'sim' | 'nao'
    observacoes: ''
  });

  // Google Sync Status State
  const [syncResult, setSyncResult] = useState<{
    success?: boolean;
    action?: 'created' | 'updated';
    resourceName?: string;
    syncedAt?: string;
    error?: string;
  } | null>(null);

  // Specific Google Contact Link States
  const [lookingUpContact, setLookingUpContact] = useState(false);
  const [contactLookupError, setContactLookupError] = useState<string | null>(null);
  const [linkedResourceName, setLinkedResourceName] = useState<string | null>(null);
  const [linkedPersonId, setLinkedPersonId] = useState<string | null>(null);
  const [showGoogleTechnicalLogs, setShowGoogleTechnicalLogs] = useState(false);
  const [googleLogs, setGoogleLogs] = useState<Array<{
    timestamp: string;
    action: string;
    result: string;
    hasResourceName: boolean;
    personId?: string | null;
    error?: string | null;
  }>>([]);

  const maskPhoneNumber = (phone?: string): string => {
    if (!phone) return 'Não informado';
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 4) return '****';
    const start = digits.slice(0, 2);
    const end = digits.slice(-2);
    return `+${start} (**) *****-**${end}`;
  };

  const addGoogleLog = (entry: {
    action: string;
    result: string;
    hasResourceName: boolean;
    personId?: string | null;
    error?: string | null;
  }) => {
    const time = new Date().toLocaleTimeString('pt-BR');
    setGoogleLogs(prev => [
      {
        timestamp: time,
        ...entry
      },
      ...prev.slice(0, 29)
    ]);
  };

  const getButtonStateDescription = () => {
    if (linkedPersonId) return 'ESTADO 1: Contato Vinculado';
    if (lookingUpContact) return 'ESTADO 2: Buscando Vínculo';
    if (!phoneInformed) return 'ESTADO 4: Telefone Ausente na Etapa 1';
    if (contactLookupError) return 'ESTADO 5: Erro Local People API';
    return 'ESTADO 3: Contato Não Encontrado';
  };

  const getEffectiveGoogleToken = () => {
    return (
      googleAccessToken ||
      sessionStorage.getItem('google_access_token') ||
      localStorage.getItem('google_access_token') ||
      localStorage.getItem('oauth_google_access_token') ||
      localStorage.getItem('portal_boss_google_accessToken') ||
      ''
    );
  };

  const handleReconnectGoogle = async () => {
    try {
      setSyncing(true);
      setError(null);
      setDetailedError(null);
      await loginWithGoogle('boss_admin');
      setSuccess('Conta Google conectada com sucesso! Você já pode sincronizar o contato.');
      
      // Auto-lookup after reconnecting if phone exists and not yet linked
      const tok = getEffectiveGoogleToken();
      if (tok && phoneInformed && !linkedPersonId && caseId) {
        lookupExistingGoogleContact(phoneInformed, tok, caseId, caseObj?.clientId);
      }
    } catch (authErr: any) {
      console.error('Falha ao reconectar Google:', authErr);
      const msg = authErr.message || String(authErr);
      setError(`Falha ao autorizar conta Google: ${msg}`);
      setDetailedError({
        title: 'Falha na Autorização do Google',
        friendlyDiagnosis: 'Não foi possível concluir o login ou autorização com a conta Google.',
        remedy: 'Verifique se a janela de pop-up do Google não foi bloqueada pelo navegador e tente novamente.',
        statusCode: 401,
        errorCategory: 'AUTH_FAILED',
        rawMessage: msg
      });
    } finally {
      setSyncing(false);
    }
  };

  const lookupExistingGoogleContact = async (
    clientPhone: string,
    token: string,
    cId: string,
    currentClientId?: string
  ) => {
    if (!clientPhone || !token) return;
    try {
      setLookingUpContact(true);
      setContactLookupError(null);

      const res = await fetch('/api/onboarding/find-google-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: clientPhone,
          googleAccessToken: token
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const errMsg = data.message || `Falha na consulta ao Google Contatos (HTTP ${res.status})`;
        setContactLookupError(errMsg);
        addGoogleLog({
          action: 'Localização Automática',
          result: 'Falha ao consultar People API',
          hasResourceName: false,
          error: errMsg
        });
        return;
      }

      if (data.found && data.resourceName) {
        const pid = data.personId || data.resourceName.replace(/^people\//, '').trim();
        setLinkedResourceName(data.resourceName);
        setLinkedPersonId(pid);
        setContactLookupError(null);

        addGoogleLog({
          action: 'Localização Automática',
          result: `Contato correspondente identificado no Google Contacts (${data.contactName || 'Nome não especificado'}, person_id: ${pid})`,
          hasResourceName: true,
          personId: pid
        });

        // Persist to Firestore: case and client
        const nowStr = new Date().toISOString();
        const existingOnb = caseObj?.onboarding || {};
        const updatedOnb = {
          ...existingOnb,
          googleContacts: {
            ...(existingOnb.googleContacts || {}),
            status: 'completed',
            resourceName: data.resourceName,
            personId: pid,
            syncedAt: nowStr
          }
        };

        await updateDoc(doc(db, 'cases', cId), {
          onboarding: updatedOnb,
          updatedAt: nowStr
        });

        setCaseObj((prev: any) => ({ ...prev, onboarding: updatedOnb }));

        if (currentClientId) {
          try {
            await updateDoc(doc(db, 'clients', currentClientId), {
              googleContactsResourceName: data.resourceName,
              googleContactsPersonId: pid,
              updatedAt: nowStr
            });
          } catch (cErr) {
            console.warn('[lookupExistingGoogleContact] client update non-blocking warning:', cErr);
          }
        }
      } else if (data.ambiguous) {
        setContactLookupError(data.message);
        addGoogleLog({
          action: 'Localização Automática',
          result: data.message,
          hasResourceName: false,
          error: data.message
        });
      } else {
        setContactLookupError(null);
        addGoogleLog({
          action: 'Localização Automática',
          result: 'Contato ainda não localizado no Google Contacts.',
          hasResourceName: false
        });
      }
    } catch (err: any) {
      console.error('[lookupExistingGoogleContact] Error:', err);
      const msg = err.message || String(err);
      setContactLookupError(msg);
      addGoogleLog({
        action: 'Localização Automática',
        result: 'Erro durante execução da busca',
        hasResourceName: false,
        error: msg
      });
    } finally {
      setLookingUpContact(false);
    }
  };

  useEffect(() => {
    // Reset all contact and case specific state on caseId change
    setLinkedResourceName(null);
    setLinkedPersonId(null);
    setContactLookupError(null);
    setLookingUpContact(false);
    setGoogleLogs([]);
    setSyncResult(null);
    setError(null);
    setDetailedError(null);
    setSuccess(null);
  }, [caseId]);

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

        let currentResourceName: string | null = null;
        let currentPersonId: string | null = null;

        const gcState = cData.onboarding?.googleContacts || {};
        if (gcState.resourceName) {
          currentResourceName = gcState.resourceName;
          currentPersonId = gcState.personId || gcState.resourceName.replace(/^people\//, '').trim();
        } else if (cData.googleContactsResourceName) {
          currentResourceName = cData.googleContactsResourceName;
          currentPersonId = currentResourceName.replace(/^people\//, '').trim();
        }

        let loadedClientData: any = null;
        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            loadedClientData = clientSnap.data();
            setClient(loadedClientData);

            if (!currentResourceName && (loadedClientData.googleContactsResourceName || loadedClientData.googleContacts?.resourceName)) {
              currentResourceName = loadedClientData.googleContactsResourceName || loadedClientData.googleContacts?.resourceName;
              currentPersonId = currentResourceName ? currentResourceName.replace(/^people\//, '').trim() : null;
            }
          }
        }

        // Initialize sub-step form data
        const onbTel = cData.onboarding?.telefone || {};
        setFormData({
          telefoneClienteAdicionadoCelular: onbTel.telefoneClienteAdicionadoCelular || '',
          observacoes: onbTel.observacoes || ''
        });

        if (gcState.status === 'completed' || gcState.resourceName) {
          setSyncResult({
            success: true,
            action: gcState.action || 'created',
            resourceName: gcState.resourceName,
            syncedAt: gcState.syncedAt,
            error: gcState.error
          });
        }

        if (currentResourceName && currentPersonId) {
          setLinkedResourceName(currentResourceName);
          setLinkedPersonId(currentPersonId);
          addGoogleLog({
            action: 'Inicialização de Vínculo',
            result: `Vínculo ativo recuperado de dados persistidos (person_id: ${currentPersonId})`,
            hasResourceName: true,
            personId: currentPersonId
          });
        } else {
          // If no resourceName is persisted yet, attempt auto-lookup using Step 1 phone
          const extractedPhone = extractClientPhone(loadedClientData);
          const effectiveTok = getEffectiveGoogleToken();
          if (extractedPhone && effectiveTok) {
            lookupExistingGoogleContact(extractedPhone, effectiveTok, caseId!, cData.clientId);
          } else if (!extractedPhone) {
            addGoogleLog({
              action: 'Auditoria de Dados',
              result: 'Telefone não cadastrado na Etapa 1.',
              hasResourceName: false
            });
          } else {
            addGoogleLog({
              action: 'Auditoria de Acesso Google',
              result: 'Conta Google não conectada (vínculo automático em espera)',
              hasResourceName: false
            });
          }
        }

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados do telefone de onboarding: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getClientEmail = () => {
    if (!client) return '';
    if (client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true) {
      return client.pjDadosEmpresa?.pj_emailEmpresa || client.pjData?.pj_emailEmpresa || client.email || '';
    }
    return client.pfDadosPessoais?.pf_email || client.pfData?.pf_email || client.email || '';
  };

  const phoneInformed = extractClientPhone(client);
  const emailInformed = getClientEmail();

  const resolvedClientName = client
    ? (client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true
        ? (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Razão Social Ausente')
        : (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Cadastro Sem Nome'))
    : 'Buscando Cliente...';

  // Real, idempotent Google Contact synchronization with granular diagnostics
  const handleGoogleSync = async () => {
    setDetailedError(null);
    setError(null);
    setSuccess(null);

    if (!phoneInformed) {
      const msg = 'Operação impossível: O cliente não possui um número de telefone celular cadastrado.';
      setError(msg);
      setDetailedError({
        title: 'Telefone Celular Ausente',
        friendlyDiagnosis: 'Não foi identificado nenhum número de telefone (fixo ou celular) no cadastro deste cliente (nem em dados de Pessoa Física, nem em Pessoa Jurídica).',
        remedy: 'Retorne à etapa 01 - Cadastro e insira o telefone celular do cliente antes de prosseguir com a sincronização de contatos.',
        statusCode: 400,
        errorCategory: 'MISSING_PHONE'
      });
      return;
    }

    const resolvedToken = getEffectiveGoogleToken();
    if (!resolvedToken) {
      const msg = 'Conta Google não conectada: Token de autorização OAuth ausente ou expirado.';
      setError(msg);
      setDetailedError({
        title: 'Sessão Google Desconectada',
        friendlyDiagnosis: 'Para adicionar contatos diretamente à sua conta Google Workspace / Gmail do escritório, é necessário conectar sua conta Google.',
        remedy: 'Clique no botão "Reconectar Conta Google" abaixo para iniciar a sessão e autorizar as permissões de Contatos.',
        statusCode: 401,
        errorCategory: 'TOKEN_MISSING'
      });
      return;
    }

    setSyncing(true);

    try {
      const response = await fetch('/api/onboarding/sync-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: resolvedClientName,
          phone: phoneInformed,
          email: emailInformed,
          googleAccessToken: resolvedToken
        })
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = text && text.trim() ? JSON.parse(text) : {};
      } catch {
        data = { success: false, errorMessage: text || 'Resposta em formato inesperado do servidor' };
      }

      if (!response.ok || !data.success) {
        const cat = data.errorCategory || (response.status === 401 ? 'AUTH_EXPIRED' : (response.status === 403 ? 'PERMISSION_DENIED' : 'SYNC_FAILED'));
        const statusCode = data.statusCode || response.status || 500;

        let title = `Erro na Sincronização de Contatos (HTTP ${statusCode})`;
        if (cat === 'AUTH_EXPIRED' || statusCode === 401) {
          title = 'Sessão Google Expirada ou Não Autenticada (Erro 401)';
        } else if (cat === 'API_NOT_ENABLED') {
          title = 'Google People API Desativada no Console Google Cloud (Erro 403)';
        } else if (cat === 'INSUFFICIENT_SCOPES') {
          title = 'Permissão de Contatos Não Concedida (Erro 403)';
        } else if (cat === 'PERMISSION_DENIED') {
          title = 'Acesso Negado à API do Google (Erro 403)';
        } else if (cat === 'MISSING_PHONE') {
          title = 'Telefone Celular Ausente (Erro 400)';
        } else if (cat === 'MISSING_NAME') {
          title = 'Nome do Cliente Ausente (Erro 400)';
        } else if (cat === 'INVALID_ARGUMENT') {
          title = 'Parâmetro Rejeitado pela API do Google (Erro 400)';
        }

        const friendly = data.friendlyDiagnosis || data.errorMessage || `Falha na sincronização via servidor (HTTP ${statusCode}).`;
        const remedy = data.remedy || (statusCode === 401
          ? 'Clique em "Reconectar Conta Google" para renovar o acesso OAuth e tente novamente.'
          : 'Verifique suas configurações de conexão com o Google e tente novamente.');

        setDetailedError({
          title,
          friendlyDiagnosis: friendly,
          remedy,
          statusCode,
          errorCategory: cat,
          technicalDetails: data.technicalDetails || data,
          rawMessage: data.errorMessage || text
        });

        setError(`${title}: ${friendly}`);
        return;
      }

      const nowStr = new Date().toISOString();
      const pid = data.resourceName ? data.resourceName.replace(/^people\//, '').trim() : null;
      setLinkedResourceName(data.resourceName);
      setLinkedPersonId(pid);
      setContactLookupError(null);

      const updatedSync = {
        success: true,
        action: data.action,
        resourceName: data.resourceName,
        personId: pid,
        syncedAt: nowStr
      };

      setSyncResult(updatedSync);

      // Save sync status to Firestore onboarding
      const existingOnboarding = caseObj?.onboarding || {};
      const updatedOnboarding = {
        ...existingOnboarding,
        googleContacts: {
          status: 'completed',
          action: data.action,
          resourceName: data.resourceName,
          personId: pid,
          syncedAt: nowStr,
          humanCertified: formData.telefoneClienteAdicionadoCelular === 'sim'
        }
      };

      if (caseObj?.clientId && data.resourceName) {
        try {
          await updateDoc(doc(db, 'clients', caseObj.clientId), {
            googleContactsResourceName: data.resourceName,
            googleContactsPersonId: pid,
            updatedAt: nowStr
          });
        } catch (cErr) {
          console.warn('[handleGoogleSync] Atualização client doc não-bloqueante:', cErr);
        }
      }

      addGoogleLog({
        action: data.action === 'updated' ? 'Sincronização / Atualização' : 'Criação de Contato',
        result: `Operação concluída com sucesso (person_id: ${pid})`,
        hasResourceName: !!data.resourceName,
        personId: pid
      });

      const logEntry = {
        timestamp: nowStr,
        subetapa: 'Subetapa 01 — Google Contacts',
        action: 'Sincronizar Contato Google',
        details: `Contato ${data.action === 'updated' ? 'atualizado' : 'criado'} com resourceName: ${data.resourceName}`
      };

      const updatedLogs = [
        ...(caseObj?.onboardingSubetapaLogs || []),
        logEntry
      ];

      await updateDoc(doc(db, 'cases', caseId!), {
        onboarding: updatedOnboarding,
        onboardingSubetapaLogs: updatedLogs,
        updatedAt: nowStr
      });

      setCaseObj((prev: any) => ({
        ...prev,
        onboarding: updatedOnboarding,
        onboardingSubetapaLogs: updatedLogs
      }));

      setSuccess(`Contato sincronizado com sucesso total no Google Contatos (${data.action === 'updated' ? 'Contato Atualizado' : 'Novo Contato Criado'})!`);
    } catch (err: any) {
      console.error("[handleGoogleSync] Erro não tratado:", err);
      const isAuth = String(err.message || '').includes('401') || String(err.message || '').includes('UNAUTHENTICATED');
      const msg = err.message || String(err);
      
      setDetailedError({
        title: isAuth ? 'Sessão Google Expirada' : 'Falha na Conexão com o Servidor',
        friendlyDiagnosis: isAuth
          ? 'O token de autorização da sua conta Google expirou ou não possui mais validade.'
          : `Não foi possível estabelecer contato com a API de sincronização: ${msg}`,
        remedy: isAuth
          ? 'Clique no botão "Reconectar Conta Google" para renovar o acesso.'
          : 'Verifique sua conexão de rede e se o servidor local está ativo.',
        statusCode: isAuth ? 401 : 500,
        errorCategory: isAuth ? 'AUTH_EXPIRED' : 'CONNECTION_ERROR',
        technicalDetails: { message: msg, stack: err.stack }
      });
      setError(`Erro na sincronização de contatos: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async (advanceAfter = false) => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    // Block onboarding if phone is missing
    if (!phoneInformed) {
      setError('Ação bloqueada: Não é possível concluir esta subetapa sem um número de telefone celular cadastrado para o cliente.');
      setSaving(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      const existingOnboarding = caseObj?.onboarding || {};
      
      const updatedOnboarding = {
        ...existingOnboarding,
        googleContacts: {
          ...(existingOnboarding.googleContacts || {}),
          status: syncResult?.success ? 'completed' : 'pending',
          humanCertified: formData.telefoneClienteAdicionadoCelular === 'sim'
        },
        telefone: {
          ...formData,
          nomeCompletoCliente: resolvedClientName,
          telefoneInformed: phoneInformed
        }
      };

      const logEntry = {
        timestamp: now,
        subetapa: 'Subetapa 01 — Google Contacts',
        action: 'Salvar Certificação Humana',
        details: `Telefone Certificado: ${formData.telefoneClienteAdicionadoCelular === 'sim' ? 'Sim ✅' : 'Não ❌'}`
      };

      const updatedLogs = [
        ...(caseObj?.onboardingSubetapaLogs || []),
        logEntry
      ];

      await updateDoc(doc(db, 'cases', caseId!), {
        onboarding: updatedOnboarding,
        onboardingSubetapaLogs: updatedLogs,
        updatedAt: now
      });

      // Update local state
      setCaseObj((prev: any) => ({
        ...prev,
        onboarding: updatedOnboarding,
        onboardingSubetapaLogs: updatedLogs
      }));

      setSuccess('Dados de telefone e certificação salvos com sucesso!');

      if (advanceAfter) {
        setTimeout(() => {
          navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/welcome.zap`);
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar dados de telefone: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenGoogleContact = () => {
    addGoogleLog({
      action: 'Abertura de Contato Individual',
      result: `Redirecionamento para contato individual em nova aba (person_id: ${linkedPersonId})`,
      hasResourceName: true,
      personId: linkedPersonId
    });
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Onboarding" caseId={caseId}>
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-bold font-mono text-gray-500 tracking-wide uppercase">
            Carregando Telefone de Onboarding...
          </span>
        </div>
      </FluxoStepLayout>
    );
  }

  return (
    <FluxoStepLayout
      stepName="Onboarding"
      caseId={caseId}
      statusText={caseObj?.onboarding?.auditoria?.statusFinal || 'Em onboarding'}
    >
      <div className="space-y-8 font-sans">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 pb-5">
          <div className="space-y-1">
            <span className="text-[10px] font-black tracking-wider text-indigo-500 uppercase">Subetapa 01 de 08</span>
            <h2 id="page-title" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Smartphone className="text-indigo-600" size={24} />
              Adicionar Telefone do Cliente ao Celular
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Sincronize o contato faticamente com a conta Google do escritório e certifique a ação no checklist.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/onboarding`)}
            className="inline-flex items-center gap-1.5 px-4 py-2 border bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200 rounded-xl text-xs font-bold cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Voltar ao Hub</span>
          </button>
        </div>

        {/* FEEDBACK BLOCKS */}
        {detailedError ? (
          <div className="bg-red-50/90 border border-red-200 rounded-2xl p-5 space-y-3.5 text-xs text-red-950 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-sm text-red-900 leading-tight">
                    {detailedError.title}
                  </h4>
                  {detailedError.statusCode && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-800 rounded text-[10px] font-mono font-bold">
                      HTTP {detailedError.statusCode} {detailedError.errorCategory ? `• ${detailedError.errorCategory}` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 pl-7">
              <div>
                <span className="font-bold text-red-900 block">Motivo Detalhado:</span>
                <p className="text-red-800 leading-relaxed font-medium">
                  {detailedError.friendlyDiagnosis}
                </p>
              </div>

              <div>
                <span className="font-bold text-red-900 block">Ação Recomendada para Consertar:</span>
                <p className="text-red-800 leading-relaxed font-medium">
                  {detailedError.remedy}
                </p>
              </div>
            </div>

            {/* Ações imediatas de resolução */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 pl-7 border-t border-red-200/60">
              {(detailedError.errorCategory === 'AUTH_EXPIRED' || detailedError.errorCategory === 'TOKEN_MISSING' || detailedError.statusCode === 401) && (
                <button
                  type="button"
                  onClick={handleReconnectGoogle}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-sm transition-all"
                >
                  <LogIn size={14} />
                  <span>Reconectar Conta Google (Renovar Acesso)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleGoogleSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-red-100 text-red-800 border border-red-300 rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                <span>Tentar Sincronizar Novamente</span>
              </button>

              {detailedError.errorCategory === 'API_NOT_ENABLED' && (
                <a
                  href="https://console.cloud.google.com/apis/library/people.googleapis.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
                >
                  <span>Ativar People API no Google Cloud</span>
                  <ExternalLink size={12} />
                </a>
              )}

              <button
                type="button"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-red-700 hover:text-red-900 cursor-pointer"
              >
                <span>{showTechnicalDetails ? 'Ocultar Detalhes Técnicos' : 'Ver Detalhes Técnicos da API'}</span>
                {showTechnicalDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Seção retrátil de detalhes técnicos */}
            {showTechnicalDetails && (
              <div className="mt-3 p-3 bg-red-950/5 border border-red-200 rounded-xl space-y-1 font-mono text-[11px] text-red-900">
                <div><strong>Status HTTP:</strong> {detailedError.statusCode || 'N/A'}</div>
                <div><strong>Categoria de Erro:</strong> {detailedError.errorCategory || 'N/A'}</div>
                {detailedError.rawMessage && (
                  <div><strong>Mensagem Bruta:</strong> {detailedError.rawMessage}</div>
                )}
                {detailedError.technicalDetails && (
                  <div className="mt-2">
                    <span className="font-bold block mb-1">Payload Técnico Completo:</span>
                    <pre className="p-2 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-[10px] leading-relaxed max-h-48">
                      {JSON.stringify(detailedError.technicalDetails, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-900 text-xs flex gap-3 items-center">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        ) : null}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-900 text-xs flex gap-3 items-center">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{success}</span>
          </div>
        )}

        {/* CONTEXT DATA HIGHLIGHT */}
        <div className="bg-slate-50 border border-gray-150 rounded-[2rem] p-6 space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
            <Info size={14} className="text-slate-500" />
            Informações do Cadastro
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 border border-gray-100 rounded-xl">
              <span className="text-[10px] font-black uppercase text-gray-400 block">Nome do Cliente</span>
              <span className="text-xs font-bold text-gray-800 block mt-1">{resolvedClientName}</span>
            </div>

            <div className="bg-white p-4 border border-gray-100 rounded-xl">
              <span className="text-[10px] font-black uppercase text-gray-400 block">Telefone Celular Informado</span>
              <span className="text-xs font-mono font-bold text-gray-800 block mt-1">
                {phoneInformed ? phoneInformed : <span className="text-red-500">NENHUM TELEFONE CADASTRADO (BLOQUEANTE ❌)</span>}
              </span>
            </div>
          </div>

          {!phoneInformed && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-900 text-xs flex gap-2.5 items-start">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-black block uppercase tracking-wider text-[10px] text-red-800 mb-1">Atenção Operacional</span>
                <p className="font-medium leading-relaxed">
                  Não foi detectado um telefone celular no cadastro deste cliente. Adicione-o no cadastro antes de continuar.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* REAL SYNCHRONIZATION MODULE */}
        <div className="bg-white border border-gray-150 rounded-[2rem] p-6 space-y-4">
          <h3 className="text-xs font-black uppercase text-gray-800 tracking-wider flex items-center gap-1.5">
            <UserCheck size={16} className="text-indigo-600" />
            Integração com Google Contatos (People API)
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed font-medium">
            Sincronize automaticamente o cadastro do cliente com os contatos do Google Workspace do escritório. Esta operação evita duplicidades realizando validação idempotente por telefone.
          </p>

          <div className="flex flex-wrap gap-3 items-center pt-2">
            <button
              type="button"
              disabled={syncing || !phoneInformed}
              onClick={handleGoogleSync}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-3xs"
            >
              {syncing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Sincronizando Contato...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  <span>Sincronizar com Google Contatos</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleReconnectGoogle}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              <LogIn size={13} />
              <span>{googleAccessToken ? 'Reconectar / Trocar Conta Google' : 'Conectar Conta Google'}</span>
            </button>

            {/* BOTÃO 1: Ver telefone cadastrado no Google Contacts (À ESQUERDA) */}
            {linkedPersonId ? (
              <a
                href={`https://contacts.google.com/person/${linkedPersonId}`}
                target="_blank"
                rel="noopener noreferrer"
                id="btn-ver-telefone-google-contacts"
                onClick={handleOpenGoogleContact}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-900 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs"
                title={`Abrir contato específico no Google Contacts: https://contacts.google.com/person/${linkedPersonId}`}
              >
                <ExternalLink size={13} className="text-emerald-600" />
                <span>Ver telefone cadastrado no Google Contacts</span>
              </a>
            ) : lookingUpContact ? (
              <button
                type="button"
                disabled
                id="btn-ver-telefone-google-contacts"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50/40 rounded-xl text-[11px] font-black uppercase tracking-wider cursor-wait shadow-3xs opacity-85"
                title="Buscando vínculo do contato no Google Contacts..."
              >
                <Loader2 size={13} className="animate-spin text-indigo-600" />
                <span>Ver telefone cadastrado no Google Contacts</span>
              </button>
            ) : !phoneInformed ? (
              <button
                type="button"
                disabled
                id="btn-ver-telefone-google-contacts"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-amber-200 text-amber-700 bg-amber-50/70 rounded-xl text-[11px] font-black uppercase tracking-wider cursor-not-allowed shadow-3xs"
                title="Telefone não cadastrado na Etapa 1."
              >
                <AlertCircle size={13} className="text-amber-500" />
                <span>Ver telefone cadastrado no Google Contacts</span>
              </button>
            ) : contactLookupError ? (
              <button
                type="button"
                disabled
                id="btn-ver-telefone-google-contacts"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-red-200 text-red-600 bg-red-50/70 rounded-xl text-[11px] font-black uppercase tracking-wider cursor-not-allowed shadow-3xs"
                title={contactLookupError}
              >
                <AlertCircle size={13} className="text-red-500" />
                <span>Ver telefone cadastrado no Google Contacts</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                id="btn-ver-telefone-google-contacts"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-400 bg-slate-100/70 rounded-xl text-[11px] font-black uppercase tracking-wider cursor-not-allowed shadow-3xs"
                title="Contato ainda não localizado no Google Contacts."
              >
                <ExternalLink size={13} className="text-slate-400" />
                <span>Ver telefone cadastrado no Google Contacts</span>
              </button>
            )}

            {/* BOTÃO 2: Acessar Google Contacts (À DIREITA) */}
            <a
              href="https://contacts.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              id="btn-acessar-google-contacts"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs"
              title="Acessar o Google Contacts diretamente no navegador"
            >
              <ExternalLink size={13} className="text-slate-500" />
              <span>Acessar Google contacts</span>
            </a>
          </div>

          {/* ESTADO CONTEXTUAL DO CONTATO */}
          <div className="pt-1">
            {linkedPersonId ? (
              <div className="text-[11px] font-medium text-emerald-800 flex items-center gap-1.5 bg-emerald-50/70 border border-emerald-200/80 px-3 py-1.5 rounded-lg w-fit">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Contato individual vinculado com sucesso no Google Contacts (person_id: {linkedPersonId})</span>
              </div>
            ) : lookingUpContact ? (
              <div className="text-[11px] font-medium text-indigo-800 flex items-center gap-1.5 bg-indigo-50/70 border border-indigo-200/80 px-3 py-1.5 rounded-lg w-fit">
                <Loader2 size={13} className="animate-spin text-indigo-600" />
                <span>Buscando vínculo existente no Google Contacts pelo telefone da Etapa 1...</span>
              </div>
            ) : !phoneInformed ? (
              <div className="text-[11px] font-medium text-amber-800 flex items-center gap-1.5 bg-amber-50/70 border border-amber-200/80 px-3 py-1.5 rounded-lg w-fit">
                <AlertCircle size={13} className="text-amber-600" />
                <span>Telefone não cadastrado na Etapa 1.</span>
              </div>
            ) : contactLookupError ? (
              <div className="text-[11px] font-medium text-red-800 flex items-center gap-1.5 bg-red-50/70 border border-red-200/80 px-3 py-1.5 rounded-lg w-fit">
                <AlertCircle size={13} className="text-red-600" />
                <span>{contactLookupError}</span>
              </div>
            ) : (
              <div className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg w-fit">
                <Info size={13} className="text-slate-400" />
                <span>Contato ainda não localizado no Google Contacts.</span>
              </div>
            )}
          </div>

          {syncResult && (
            <div className="bg-slate-50 border border-gray-150 rounded-xl p-4 space-y-2 mt-2 text-[11px] font-mono">
              <div className="flex items-center gap-2 text-emerald-700 font-bold">
                <CheckCircle2 size={14} />
                <span>Sincronização Ativa & Idempotente!</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-gray-500 pt-1">
                <div>• Operação: <strong className="text-gray-700 uppercase">{syncResult.action === 'updated' ? 'Contato Atualizado' : 'Novo Contato Criado'}</strong></div>
                <div>• ID do Recurso: <strong className="text-gray-700">{syncResult.resourceName}</strong></div>
                <div>• Data de Sincronização: <strong className="text-gray-700">{new Date(syncResult.syncedAt!).toLocaleString('pt-BR')}</strong></div>
              </div>
            </div>
          )}

          {/* LOGS TÉCNICOS CONTEXTUAIS DO GOOGLE CONTACTS */}
          <div className="pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowGoogleTechnicalLogs(!showGoogleTechnicalLogs)}
              className="text-[10px] font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>{showGoogleTechnicalLogs ? 'Ocultar' : 'Ver'} logs técnicos do Google Contacts</span>
              {showGoogleTechnicalLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showGoogleTechnicalLogs && (
              <div className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-xl space-y-2 text-[10px] font-mono border border-slate-800 shadow-inner">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-1 text-slate-400">
                  <span>Client ID: {caseObj?.clientId || 'N/A'}</span>
                  <span>Telefone Mascarado: {maskPhoneNumber(phoneInformed)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                  <div>• ResourceName: <strong className="text-slate-100">{linkedResourceName || 'Ausente'}</strong></div>
                  <div>• Person ID: <strong className="text-slate-100">{linkedPersonId || 'Nenhum'}</strong></div>
                  <div>• Estado Atual: <strong className="text-slate-100">{getButtonStateDescription()}</strong></div>
                  <div>• Token Google: <strong className="text-slate-100">{getEffectiveGoogleToken() ? 'Disponível (Protegido)' : 'Desconectado'}</strong></div>
                </div>
                {googleLogs.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800">
                    <span className="text-slate-400 font-bold block mb-1">Histórico de Eventos:</span>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {googleLogs.map((log, i) => (
                        <div key={i} className="text-slate-300">
                          <span className="text-slate-500">[{log.timestamp}]</span> <strong>{log.action}</strong>: {log.result}
                          {log.error && <span className="text-red-400"> (Erro: {log.error})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* COMPLIANCE FORM SHEET */}
        {phoneInformed && (
          <div className="bg-white border border-gray-150 rounded-[2rem] p-6 space-y-6">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                <CheckSquare size={16} className="text-indigo-600" />
                Checklist de Execução
              </h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-700 tracking-wide block">
                  1. O contato foi devidamente homologado na agenda Google? *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.telefoneClienteAdicionadoCelular === 'sim' ? 'bg-indigo-50/40 border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="telefoneClienteAdicionadoCelular"
                      value="sim"
                      checked={formData.telefoneClienteAdicionadoCelular === 'sim'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Sim, adicionado ✅</span>
                      <span className="text-[10px] text-gray-400 font-medium">Nome e celular salvos e auditados</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.telefoneClienteAdicionadoCelular === 'nao' ? 'bg-red-50/40 border-red-300 ring-1 ring-red-300' : 'border-gray-150 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="telefoneClienteAdicionadoCelular"
                      value="nao"
                      checked={formData.telefoneClienteAdicionadoCelular === 'nao'}
                      onChange={handleChange}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Não adicionado ❌</span>
                      <span className="text-[10px] text-gray-400 font-medium">Pendente de auditoria ou ação</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-gray-500 tracking-wider">
                  Observações ou Notas de Acompanhamento
                </label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Se houver alguma restrição no contato do cliente, registre aqui..."
                  className="w-full border border-gray-150 rounded-xl p-4 text-xs font-semibold focus:outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>
            </div>

            {/* ACTION FOOTER BAR */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-100 pt-5">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(false)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-black text-[11px] uppercase tracking-wider rounded-2xl cursor-pointer transition-all disabled:opacity-50 w-full sm:w-auto h-[48px]"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                <span>Salvar Progresso</span>
              </button>

              <button
                type="button"
                disabled={saving || formData.telefoneClienteAdicionadoCelular !== 'sim'}
                onClick={() => handleSave(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-wider rounded-2xl cursor-pointer transition-all disabled:opacity-50 shadow-3xs hover:shadow-2xs w-full sm:w-auto h-[48px]"
              >
                <span>Salvar e Avançar</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

      </div>
    </FluxoStepLayout>
  );
}
