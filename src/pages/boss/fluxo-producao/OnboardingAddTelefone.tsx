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
  UserCheck
} from 'lucide-react';

export default function OnboardingAddTelefone() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { googleAccessToken, loginWithGoogle } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            setClient(clientSnap.data());
          }
        }

        // Initialize sub-step form data
        const onbTel = cData.onboarding?.telefone || {};
        setFormData({
          telefoneClienteAdicionadoCelular: onbTel.telefoneClienteAdicionadoCelular || '',
          observacoes: onbTel.observacoes || ''
        });

        const gcState = cData.onboarding?.googleContacts || {};
        if (gcState.status === 'completed' || gcState.resourceName) {
          setSyncResult({
            success: true,
            action: gcState.action || 'created',
            resourceName: gcState.resourceName,
            syncedAt: gcState.syncedAt,
            error: gcState.error
          });
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

  // Real, idempotent Google Contact synchronization
  const handleGoogleSync = async () => {
    if (!phoneInformed) {
      setError('Operação impossível: O cliente não possui um número de telefone válido.');
      return;
    }

    const resolvedToken = googleAccessToken || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';
    if (!resolvedToken) {
      setError('Por favor, faça login com sua conta Google primeiro ou renove suas permissões OAuth.');
      return;
    }

    setSyncing(true);
    setError(null);
    setSuccess(null);

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

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.errorMessage || 'Falha ao sincronizar contato.');
      }

      const nowStr = new Date().toISOString();
      const updatedSync = {
        success: true,
        action: data.action,
        resourceName: data.resourceName,
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
          syncedAt: nowStr,
          humanCertified: formData.telefoneClienteAdicionadoCelular === 'sim'
        }
      };

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
      console.error(err);
      setError(`Erro na sincronização de contatos: ${err.message || err}`);
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
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-900 text-xs flex gap-3 items-center">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

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
        {phoneInformed && (
          <div className="bg-white border border-gray-150 rounded-[2rem] p-6 space-y-4">
            <h3 className="text-xs font-black uppercase text-gray-800 tracking-wider flex items-center gap-1.5">
              <UserCheck size={16} className="text-indigo-600" />
              Integração com Google Contatos (People API)
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              Sincronize automaticamente o cadastro do cliente com os contatos do Google Workspace do escritório. Esta operação evita duplicidades realizando validação idempotente por telefone.
            </p>

            <div className="flex flex-wrap gap-4 items-center pt-2">
              <button
                type="button"
                disabled={syncing}
                onClick={handleGoogleSync}
                className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-3xs"
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

              {!googleAccessToken && (
                <button
                  type="button"
                  onClick={() => loginWithGoogle('boss_admin')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Conectar Conta Google
                </button>
              )}
            </div>

            {syncResult && (
              <div className="bg-slate-50 border border-gray-150 rounded-xl p-4 space-y-2 mt-4 text-[11px] font-mono">
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
          </div>
        )}

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
