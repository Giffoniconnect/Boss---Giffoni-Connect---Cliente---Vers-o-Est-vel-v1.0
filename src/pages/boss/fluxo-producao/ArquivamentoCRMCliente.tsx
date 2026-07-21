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
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  User,
  Info,
  Terminal,
  FileText,
  Smartphone
} from 'lucide-react';

export default function ArquivamentoCRMCliente() {
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
    clienteInformadoArquivamento: '', // 'sim' | 'nao'
    crmDespedidaFeito: false,
    canalUtilizado: 'WhatsApp', // 'WhatsApp' | 'E-mail' | 'Ligação' | 'Presencial'
    dataAviso: '',
    responsavel: '',
    mensagemEnviada: '',
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
        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            setClient(clientSnap.data());
          }
        }

        // Initialize sub-step form data
        const archCRM = cData.arquivamento?.crmCliente || {};
        
        // Define standard greeting message template
        const defaultName = cData.clientName || '';
        const defaultMsg = `Prezado(a) ${defaultName || 'Cliente'},\n\nGostaríamos de informar que seu processo foi finalizado com sucesso e todas as pendências foram resolvidas. Por esse motivo, estamos realizando o arquivamento interno da sua pasta.\n\nAgradecemos imensamente a confiança depositada na Giffoni Advogados Associados e permanecemos à sua inteira disposição para futuras demandas.\n\nAtenciosamente,\nEquipe Giffoni Connect`;

        setFormData({
          clienteInformadoArquivamento: archCRM.clienteInformadoArquivamento || '',
          crmDespedidaFeito: archCRM.crmDespedidaFeito || false,
          canalUtilizado: archCRM.canalUtilizado || 'WhatsApp',
          dataAviso: archCRM.dataAviso || new Date().toISOString().split('T')[0],
          responsavel: archCRM.responsavel || localStorage.getItem('boss_user_email') || 'atendimento.giffoni@gmail.com',
          mensagemEnviada: archCRM.mensagemEnviada || defaultMsg,
          observacoes: archCRM.observacoes || ''
        });

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados de CRM - arquivamento: ${err.message || err}`);
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
      if (name === 'clienteInformadoArquivamento') {
        updated.crmDespedidaFeito = value === 'sim';
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
      const crmDespedidaFeito = formData.clienteInformadoArquivamento === 'sim';

      const existingArquivamento = caseObj?.arquivamento || {};
      const updatedArquivamento = {
        ...existingArquivamento,
        crmCliente: {
          ...formData,
          crmDespedidaFeito
        },
        auditoria: {
          ...(existingArquivamento.auditoria || {}),
          crmClienteFeito: crmDespedidaFeito,
          crmDespedida: true
        }
      };

      const logEntry = {
        timestamp: now,
        subetapa: 'Subetapa 04 — CRM - Arquivamento Cliente',
        action: 'Salvar CRM Contato de Encerramento',
        details: `Cliente informado: ${formData.clienteInformadoArquivamento === 'sim' ? 'Sim ✅' : 'Não ❌'}. Despedida feita: ${crmDespedidaFeito ? 'Sim ✅' : 'Não ❌'}`
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

      setSuccess('Dados de contato e CRM de despedida salvos!');

      if (advanceAfter) {
        setTimeout(() => {
          navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento.Google.Sheets`);
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar dados de CRM - arquivamento: ${err.message || err}`);
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
            Carregando CRM - Arquivamento Cliente...
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
            <span className="text-[10px] font-black tracking-wider text-indigo-500 uppercase">Subetapa 04 de 06</span>
            <h2 id="page-title" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Smartphone className="text-indigo-600" size={24} />
              CRM — Arquivamento Cliente
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Informe formalmente o cliente sobre a conclusão e o arquivamento interno do seu caso na Giffoni.
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
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">STATUS DE NOTIFICAÇÃO</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded border ${
                formData.clienteInformadoArquivamento === 'sim'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                  : 'text-red-650 bg-red-50 border-red-100'
              }`}>
                {formData.clienteInformadoArquivamento === 'sim' ? 'Notificado ✅' : 'Pendente de aviso ❌'}
              </span>
            </div>
          </div>
        </div>

        {/* CRM AUT-PREPARATION BANNER */}
        <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-indigo-950 text-xs flex gap-3 items-start">
          <Info size={18} className="text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">Preparação de Automação de CRM</span>
            <p className="text-indigo-900 font-medium">
              Nesta fase, as mensagens não são enviadas automaticamente ao cliente. Você deve dispará-la manualmente pelo canal indicado ou copiar o texto estruturado. O sistema está preparado estruturalmente para futuras automações.
            </p>
          </div>
        </div>

        {/* CORE FORM PANEL */}
        <div className="bg-white rounded-3xl border border-gray-150 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                  Cliente foi informado do arquivamento do caso? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    formData.clienteInformadoArquivamento === 'sim'
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <span className="text-xs font-bold text-gray-700">Sim ✅</span>
                    <input
                      type="radio"
                      name="clienteInformadoArquivamento"
                      value="sim"
                      checked={formData.clienteInformadoArquivamento === 'sim'}
                      onChange={handleChange}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                    />
                  </label>

                  <label className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    formData.clienteInformadoArquivamento === 'nao'
                      ? 'border-red-500 bg-red-50/50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <span className="text-xs font-bold text-gray-700">Não ❌</span>
                    <input
                      type="radio"
                      name="clienteInformadoArquivamento"
                      value="nao"
                      checked={formData.clienteInformadoArquivamento === 'nao'}
                      onChange={handleChange}
                      className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                    />
                  </label>
                </div>
              </div>

              {/* CHECKLIST */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Checklist Interno & Finalidade
                </span>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="crmDespedidaFeito"
                    checked={formData.crmDespedidaFeito}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div className="text-xs font-semibold text-gray-800">
                    CRM de despedida feito? {formData.crmDespedidaFeito ? 'Sim ✅' : 'Não ❌'}
                  </div>
                </label>
                <p className="text-[10.5px] text-gray-400 font-medium leading-relaxed pl-1">
                  Esta verificação registra se o cliente foi avisado sobre o fim do processo/caso e sobre o arquivamento interno do seu caso na Giffoni.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                    Canal Utilizado
                  </label>
                  <select
                    name="canalUtilizado"
                    value={formData.canalUtilizado}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-semibold focus:ring-2 focus:ring-indigo-150 h-[46px] cursor-pointer"
                  >
                    <option value="WhatsApp">WhatsApp 📱</option>
                    <option value="E-mail">E-mail ✉️</option>
                    <option value="Ligação">Ligação 📞</option>
                    <option value="Presencial">Presencial 🤝</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                    <Calendar size={14} className="text-gray-400" />
                    Data do Aviso
                  </label>
                  <input
                    type="date"
                    name="dataAviso"
                    value={formData.dataAviso}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-semibold focus:ring-2 focus:ring-indigo-150 h-[46px]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                  <User size={14} className="text-gray-400" />
                  Responsável pelo Contato
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
                  Mensagem Enviada ao Cliente
                </label>
                <textarea
                  name="mensagemEnviada"
                  value={formData.mensagemEnviada}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Copie ou edite o texto da mensagem de despedida/conclusão de caso..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-indigo-150"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                  Observações de Contato
                </label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Observações complementares importantes..."
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
            [CRM_INTEGRATION] Hub de comunicações ativo. Barramento: <span className="text-teal-400">STANDBY_MANUAL_DELIVERY</span>
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
              disabled={saving || !formData.clienteInformadoArquivamento}
              onClick={() => handleSave(false)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Gravando...' : 'Salvar Rascunho'}
            </button>

            <button
              type="button"
              disabled={saving || !formData.clienteInformadoArquivamento}
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
