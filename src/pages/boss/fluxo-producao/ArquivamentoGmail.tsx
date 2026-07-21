import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mail,
  Search,
  User,
  Hash,
  Terminal,
  Info,
  ExternalLink
} from 'lucide-react';

export default function ArquivamentoGmail() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    emailsClienteArquivadosOuDeletados: '', // 'sim' | 'nao'
    emailConferido: false,
    nomeCompletoCliente: '',
    processoCNJ: '',
    responsavel: '',
    observacoes: ''
  });

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

        // Fetch client
        let clientData: any = null;
        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            clientData = clientSnap.data();
            setClient(clientData);
          }
        }

        // Initialize sub-step form data
        const archGmail = cData.arquivamento?.gmail || {};
        
        // Resolve default name and CNJ
        const defaultName = clientData
          ? (clientData.type === 'PJ' || clientData.tipoPessoa === 'PJ' || clientData.isCompany === true
              ? (clientData.pjDadosEmpresa?.pj_razaoSocial || clientData.pjData?.pj_razaoSocial || '')
              : (clientData.pfDadosPessoais?.pf_nomeCompleto || clientData.pfData?.pf_nomeCompleto || ''))
          : '';
        const defaultCNJ = cData.cnjNumero || cData.cnj || cData.processoCNJ || cData.numeroProcesso || '';

        setFormData({
          emailsClienteArquivadosOuDeletados: archGmail.emailsClienteArquivadosOuDeletados || '',
          emailConferido: archGmail.emailConferido || false,
          nomeCompletoCliente: archGmail.nomeCompletoCliente || defaultName,
          processoCNJ: archGmail.processoCNJ || defaultCNJ,
          responsavel: archGmail.responsavel || localStorage.getItem('boss_user_email') || 'atendimento.giffoni@gmail.com',
          observacoes: archGmail.observacoes || ''
        });

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados de arquivamento Gmail: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'emailsClienteArquivadosOuDeletados') {
        updated.emailConferido = value === 'sim';
      }
      return updated;
    });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSave = async (advanceAfter = false) => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const now = new Date().toISOString();
      const emailConferido = formData.emailsClienteArquivadosOuDeletados === 'sim';

      const existingArquivamento = caseObj?.arquivamento || {};
      const updatedArquivamento = {
        ...existingArquivamento,
        gmail: {
          ...formData,
          emailConferido
        },
        auditoria: {
          ...(existingArquivamento.auditoria || {}),
          gmailVerificado: emailConferido,
          emailConferido: true
        }
      };

      const logEntry = {
        timestamp: now,
        subetapa: 'Subetapa 03 — Arquivamento Gmail',
        action: 'Salvar Conferência Gmail',
        details: `E-mails do cliente arquivados/deletados: ${formData.emailsClienteArquivadosOuDeletados === 'sim' ? 'Sim ✅' : 'Não ❌'}. Conferido: ${emailConferido ? 'Sim ✅' : 'Não ❌'}`
      };

      const updatedLogs = [
        ...(caseObj?.arquivamentoSubetapaLogs || []),
        logEntry
      ];

      await updateDoc(doc(db, 'cases', caseId!), {
        arquivamento: updatedArquivamento,
        arquivamentoSubetapaLogs: updatedLogs,
        updatedAt: now
      });

      // Update local state
      setCaseObj((prev: any) => ({
        ...prev,
        arquivamento: updatedArquivamento,
        arquivamentoSubetapaLogs: updatedLogs
      }));

      setSuccess('Dados de arquivamento Gmail salvos com sucesso!');

      if (advanceAfter) {
        setTimeout(() => {
          navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento.CRM.Cliente`);
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar dados de arquivamento Gmail: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Arquivamento" caseId={caseId}>
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-bold font-mono text-gray-500 tracking-wide uppercase">
            Carregando Arquivamento Gmail...
          </span>
        </div>
      </FluxoStepLayout>
    );
  }

  const resolvedClientName = client
    ? (client.type === 'PJ' || client.tipoPessoa === 'PJ' || client.isCompany === true
        ? (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Razão Social Ausente')
        : (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Cadastro Sem Nome'))
    : 'Buscando Cliente...';

  // Build Gmail Search URLs
  const searchNameUrl = formData.nomeCompletoCliente
    ? `https://mail.google.com/mail/u/0/#search/in%3Ainbox+%22${encodeURIComponent(formData.nomeCompletoCliente)}%22`
    : '';

  const searchCNJUnit = formData.processoCNJ
    ? `https://mail.google.com/mail/u/0/#search/in%3Ainbox+%22${encodeURIComponent(formData.processoCNJ)}%22`
    : '';

  return (
    <FluxoStepLayout
      stepName="Arquivamento"
      caseId={caseId}
      statusText={caseObj?.statusInterno || 'Em arquivamento'}
    >
      <div className="space-y-8 font-sans">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 pb-5">
          <div className="space-y-1">
            <span className="text-[10px] font-black tracking-wider text-indigo-500 uppercase">Subetapa 03 de 06</span>
            <h2 id="page-title" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Mail className="text-indigo-600" size={24} />
              Arquivamento Gmail
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Localize, audite e organize mensagens recebidas e enviadas para este cliente na Caixa de Entrada corporativa.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento`)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all cursor-pointer self-start"
          >
            <ArrowLeft size={14} />
            Voltar para o Hub
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-950 text-xs flex gap-3 items-center">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-950 text-xs flex gap-3 items-center">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        {/* CLIENT QUICK INFO */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">CLIENTE ATRELADO</span>
            <span className="text-sm font-bold text-slate-900">{resolvedClientName}</span>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">STATUS GMAIL</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded border ${
                formData.emailsClienteArquivadosOuDeletados === 'sim'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                  : 'text-red-650 bg-red-50 border-red-100'
              }`}>
                {formData.emailsClienteArquivadosOuDeletados === 'sim' ? 'E-mails Organizados ✅' : 'Não verificado ❌'}
              </span>
            </div>
          </div>
        </div>

        {/* EXCLUSÃO/ARQUIVAMENTO RAPIDO */}
        <div className="bg-slate-50 border border-slate-150 rounded-3xl p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Search size={16} className="text-indigo-600" />
              Botões de Exclusão/Arquivamento rápido do cliente
            </h3>
            <p className="text-[11px] text-gray-500 font-medium">
              Utilize os links dinâmicos abaixo para realizar pesquisas rápidas de conferência diretamente em sua conta do Gmail institucional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BUTTON 1 - CLIENT NAME */}
            <div className="bg-white border border-gray-150 p-4 rounded-2xl flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1">
                  <User size={12} />
                  Busca por Nome Completo
                </span>
                <p className="text-xs font-bold text-slate-800">
                  {formData.nomeCompletoCliente || <span className="text-red-500 italic">Nome não cadastrado</span>}
                </p>
              </div>

              {formData.nomeCompletoCliente ? (
                <a
                  href={searchNameUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-100 hover:border-indigo-600 rounded-xl text-xs font-bold transition-all text-center"
                >
                  <span>Pesquisar e-mails na Caixa — Nome do Cliente</span>
                  <ExternalLink size={13} />
                </a>
              ) : (
                <div className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 p-2 rounded-xl text-center">
                  Nome completo do cliente não encontrado.
                </div>
              )}
            </div>

            {/* BUTTON 2 - PROCESS CNJ */}
            <div className="bg-white border border-gray-150 p-4 rounded-2xl flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1">
                  <Hash size={12} />
                  Busca por Processo CNJ
                </span>
                <p className="text-xs font-bold text-slate-800">
                  {formData.processoCNJ || <span className="text-red-500 italic">CNJ não cadastrado</span>}
                </p>
              </div>

              {formData.processoCNJ ? (
                <a
                  href={searchCNJUnit}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-100 hover:border-indigo-600 rounded-xl text-xs font-bold transition-all text-center"
                >
                  <span>Pesquisar e-mails na Caixa — Processo CNJ</span>
                  <ExternalLink size={13} />
                </a>
              ) : (
                <div className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 p-2 rounded-xl text-center">
                  Número do processo CNJ não encontrado.
                </div>
              )}
            </div>
          </div>

          <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-[11px] text-indigo-950 font-medium leading-relaxed">
            <strong>⚠️ Atenção:</strong> Nesta fase, os botões servem para pesquisar e localizar e-mails. O sistema <strong>não exclui ou arquiva</strong> e-mails automaticamente sem a sua confirmação expressa na interface do Gmail.
          </div>
        </div>

        {/* CORE FORM */}
        <div className="bg-white rounded-3xl border border-gray-150 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                  Foram arquivados/deletados os e-mails do cliente? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    formData.emailsClienteArquivadosOuDeletados === 'sim'
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <span className="text-xs font-bold text-gray-700">Sim ✅</span>
                    <input
                      type="radio"
                      name="emailsClienteArquivadosOuDeletados"
                      value="sim"
                      checked={formData.emailsClienteArquivadosOuDeletados === 'sim'}
                      onChange={handleChange}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                    />
                  </label>

                  <label className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    formData.emailsClienteArquivadosOuDeletados === 'nao'
                      ? 'border-red-500 bg-red-50/50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <span className="text-xs font-bold text-gray-700">Não ❌</span>
                    <input
                      type="radio"
                      name="emailsClienteArquivadosOuDeletados"
                      value="nao"
                      checked={formData.emailsClienteArquivadosOuDeletados === 'nao'}
                      onChange={handleChange}
                      className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                    />
                  </label>
                </div>
              </div>

              {/* CHECKLIST */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Checklist Interno
                </span>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="emailConferido"
                    checked={formData.emailConferido}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div className="text-xs font-semibold text-gray-800">
                    E-mail conferido? {formData.emailConferido ? 'Sim ✅' : 'Não ❌'}
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                    Nome Completo Usado
                  </label>
                  <input
                    type="text"
                    name="nomeCompletoCliente"
                    value={formData.nomeCompletoCliente}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-semibold h-[46px]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                    Processo CNJ Usado
                  </label>
                  <input
                    type="text"
                    name="processoCNJ"
                    value={formData.processoCNJ}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-semibold h-[46px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                  Responsável pela Conferência
                </label>
                <input
                  type="text"
                  name="responsavel"
                  value={formData.responsavel}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-semibold h-[46px]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                  Observações de Arquivamento
                </label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Observações sobre a limpeza ou encaminhamento de e-mails do cliente..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-indigo-150"
                />
              </div>
            </div>

          </div>
        </div>

        {/* LOG TECNICO COMPONENTE */}
        <div className="border border-gray-150 rounded-3xl p-6 bg-slate-900 text-teal-400 shadow-inner space-y-2">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Terminal size={16} />
            <span className="text-xs font-black uppercase text-slate-300 font-mono tracking-wider">
              Automação & Logs de Audit
            </span>
          </div>
          <p className="text-[11px] font-mono leading-relaxed text-slate-400">
            [GMAIL_AUDITING] Fila de webhooks pronta. Pesquisas manuais prontas. Status: <span className="text-teal-400">ONLINE</span>
          </p>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento`)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            Voltar para o Hub
          </button>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={saving || !formData.emailsClienteArquivadosOuDeletados}
              onClick={() => handleSave(false)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Gravando...' : 'Salvar Rascunho'}
            </button>

            <button
              type="button"
              disabled={saving || !formData.emailsClienteArquivadosOuDeletados}
              onClick={() => handleSave(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm disabled:opacity-50"
            >
              <span>Salvar e Avançar</span>
              <Loader2 className={saving ? 'animate-spin' : 'hidden'} size={14} />
            </button>
          </div>
        </div>

      </div>
    </FluxoStepLayout>
  );
}
