import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { BossLayout } from '../../../components/Layout';
import { 
  MessageSquare, 
  ArrowLeft, 
  Save, 
  Play, 
  Terminal, 
  AlertCircle, 
  Check, 
  X,
  Info
} from 'lucide-react';

interface WhatsappConfig {
  status: 'não_configurado' | 'preparado' | 'em_teste' | 'ativo' | 'erro';
  provider: 'meta_api' | 'evolution_api' | 'z-api' | 'wa_speed';
  notes: string;
  waSpeedUrl?: string;
  waSpeedToken?: string;
  waSpeedInstanceId?: string;
}

export default function WhatsappIntegration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Connection fields
  const [config, setConfig] = useState<WhatsappConfig>({
    status: 'não_configurado',
    provider: 'meta_api',
    notes: '',
    waSpeedUrl: '',
    waSpeedToken: '',
    waSpeedInstanceId: ''
  });

  // Simulated logs
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const docSnap = await getDoc(doc(db, 'settings', 'connectors'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.whatsapp) {
            setConfig({
              status: data.whatsapp.status || 'não_configurado',
              provider: data.whatsapp.provider || 'meta_api',
              notes: data.whatsapp.notes || '',
              waSpeedUrl: data.whatsapp.waSpeedUrl || '',
              waSpeedToken: data.whatsapp.waSpeedToken || '',
              waSpeedInstanceId: data.whatsapp.waSpeedInstanceId || ''
            });
          }
        }
      } catch (err) {
        console.error('Erro ao ler Whatsapp de settings/connectors:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      await setDoc(doc(db, 'settings', 'connectors'), {
        whatsapp: {
          status: config.status,
          provider: config.provider,
          notes: config.notes.trim(),
          waSpeedUrl: (config.waSpeedUrl || '').trim(),
          waSpeedToken: (config.waSpeedToken || '').trim(),
          waSpeedInstanceId: (config.waSpeedInstanceId || '').trim()
        },
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setFeedback({ type: 'success', message: 'Configurações de integração com WhatsApp salvas na nuvem com sucesso!' });
      
      const timestamp = new Date().toLocaleTimeString();
      setLogs(prev => [
        ...prev,
        `[${timestamp}] Configurações atualizadas e gravadas com sucesso no Firestore.`
      ]);
    } catch (err: any) {
      console.error('Erro ao salvar WhatsApp:', err);
      setFeedback({ type: 'error', message: `Erro ao salvar configurações: ${err.message || err}` });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = () => {
    setTesting(true);
    const timestamp = new Date().toLocaleTimeString();
    
    const newLogs = [
      `[${timestamp}] Inicializando aperto de mão lógico com WhatsApp API (${config.provider})...`,
      `[${timestamp}] Validando instâncias e tokens no backend fático...`,
      `[${timestamp}] Testando conexão com servidor de disparo...`,
      `[${timestamp}] Enviando trigger de verificação física de status...`,
      `[${timestamp}] Aviso: Teste real será ativado em build futuro com backend seguro.`,
      `[${timestamp}] Canal retornado com status isolado: Simulador de Sucesso.`
    ];

    setTimeout(() => {
      setLogs(prev => [...prev, ...newLogs]);
      setTesting(false);
      setShowLogs(true);
    }, 1000);
  };

  const handleDisable = async () => {
    const timestamp = new Date().toLocaleTimeString();
    const updated = { ...config, status: 'não_configurado' as const };
    setConfig(updated);
    
    try {
      await setDoc(doc(db, 'settings', 'connectors'), {
        whatsapp: updated,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setLogs(prev => [
        ...prev,
        `[${timestamp}] Provedor desativado voluntariamente pelo operador.`
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <BossLayout>
        <div className="flex-1 p-6 md:p-10 flex items-center justify-center bg-gray-50 text-gray-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-100 border-t-emerald-650 rounded-full animate-spin"></div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Sincronizando WhatsApp...</span>
          </div>
        </div>
      </BossLayout>
    );
  }

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
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight uppercase">WhatsApp Gateway</h2>
                <p className="text-xs text-gray-500 font-medium">Notificações e Alertas Automáticos para Clientes</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-[9px] font-black uppercase border tracking-wider rounded-lg ${
              config.status === 'ativo' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              config.status === 'preparado' ? 'bg-blue-50 text-blue-800 border-blue-200' :
              config.status === 'em_teste' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              config.status === 'erro' ? 'bg-rose-50 text-rose-800 border-rose-200' :
              'bg-gray-100 text-gray-500 border-gray-205'
            }`}>
              {config.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-slate-900 border border-slate-950 p-6 rounded-[2rem] flex gap-3.5 text-slate-100 shadow-xl">
          <Info size={24} className="text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-wider text-emerald-400 font-mono">Conector WhatsApp Ativo • BOSS v5</p>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              Canal fático de comunicação imediata com o cliente. Dispara alertas de pendência de documentos, lembretes de faturamento e agendamentos de audiências diretamente no celular.
            </p>
          </div>
        </div>

        {/* Warn card */}
        <div className="bg-amber-50 border border-amber-150 p-4 rounded-2xl flex gap-2.5 text-amber-950">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed font-semibold">
            <strong className="uppercase">Segurança Técnica:</strong> Esta chave secreta não deve ser armazenada diretamente no frontend legado. Em ambiente de produção, certifique-se de mover para variáveis de ambiente seguras no backend (Cloud Run / Functions).
          </p>
        </div>

        {/* MAIN CONFIGURATION FORM */}
        <form onSubmit={handleSave} className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Provedor API Selecionado *</label>
              <select
                value={config.provider}
                onChange={(e) => setConfig({ ...config, provider: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
              >
                <option value="meta_api">Meta Cloud API (Oficial)</option>
                <option value="evolution_api">Evolution API (Multi-dispositivos)</option>
                <option value="z-api">Z-API Gateway</option>
                <option value="wa_speed">WA Speed API Gateway</option>
              </select>
            </div>

            {config.provider === 'wa_speed' && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">URL do WA Speed *</label>
                  <input
                    type="text"
                    value={config.waSpeedUrl || ''}
                    onChange={(e) => setConfig({ ...config, waSpeedUrl: e.target.value })}
                    placeholder="Ex: https://api.waspeed.com.br"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Token do WA Speed *</label>
                  <input
                    type="password"
                    value={config.waSpeedToken || ''}
                    onChange={(e) => setConfig({ ...config, waSpeedToken: e.target.value })}
                    placeholder="Insira seu Token do WA Speed"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">ID da Instância (Opcional)</label>
                  <input
                    type="text"
                    value={config.waSpeedInstanceId || ''}
                    onChange={(e) => setConfig({ ...config, waSpeedInstanceId: e.target.value })}
                    placeholder="ID da instância"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Status Conexão *</label>
              <select
                value={config.status}
                onChange={(e) => setConfig({ ...config, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
              >
                <option value="não_configurado">Não Configurado</option>
                <option value="preparado">Preparado</option>
                <option value="em_teste">Em Testes</option>
                <option value="ativo">Ativo</option>
                <option value="erro">Erro</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Notas Internas de Integração</label>
              <textarea
                value={config.notes}
                onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                rows={3}
                placeholder="Observações complementares fáticas sobre este barramento..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {feedback && (
            <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-100' : 'bg-rose-50 text-rose-900 border border-rose-100'
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
          <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={testing}
                onClick={handleTestConnection}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:opacity-50 text-xs font-bold uppercase rounded-xl transition flex items-center gap-2 cursor-pointer"
              >
                <Play size={12} />
                <span>{testing ? 'Testando...' : 'Testar Conexão'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLogs(!showLogs)}
                className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold uppercase rounded-xl transition flex items-center gap-2"
              >
                <Terminal size={12} />
                <span>Logs</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {config.status !== 'não_configurado' && (
                <button
                  type="button"
                  onClick={handleDisable}
                  className="px-4 py-2 hover:bg-red-50 text-red-500 rounded-xl text-xs font-bold uppercase transition"
                >
                  Desativar
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Save size={14} />
                <span>{saving ? 'Gravando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* LOG PANEL */}
        {showLogs && (
          <div className="bg-slate-900 border border-slate-950 p-5 rounded-3xl text-slate-100 font-mono text-xs space-y-3 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex items-center gap-2">
                <Terminal size={14} className="text-indigo-400" />
                <span>Terminal Simulator Logs — WhatsApp Gateway</span>
              </span>
              <button
                type="button"
                onClick={() => setShowLogs(false)}
                className="text-slate-400 hover:text-white font-sans text-xs font-semibold"
              >
                Ocultar
              </button>
            </div>

            <div className="max-h-[180px] overflow-y-auto space-y-1.5 bg-slate-950 p-4 rounded-2xl shadow-inner scrollbar-thin">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">Nenhum log gravado neste ciclo de visualização. Clique em "Testar Conexão" para obter dados fáticos.</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="leading-relaxed hover:bg-slate-900/60 p-0.5 rounded transition">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </BossLayout>
  );
}
