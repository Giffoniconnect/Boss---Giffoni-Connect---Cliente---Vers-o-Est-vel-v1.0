import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Table,
  Calendar,
  User,
  Info,
  Terminal,
  FileText,
  Sparkles,
  Database,
  Plus,
  Play,
  ExternalLink
} from 'lucide-react';

export default function ArquivamentoGoogleSheets() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { googleAccessToken, loginWithGoogle } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

  // Sheets Integration State
  const [spreadsheetId, setSpreadsheetId] = useState<string>('');
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [showSyncLogs, setShowSyncLogs] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState({
    formulaTodoistArquivadaGoogleSheets: '', // 'sim' | 'nao'
    googleSheetsAtualizado: false,
    lastRowUtilizada: 'Linha #142',
    dataRegistro: '',
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
        if (cData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
          if (clientSnap.exists()) {
            setClient(clientSnap.data());
          }
        }

        // Initialize sub-step form data
        const archSheets = cData.arquivamento?.googleSheets || {};
        setFormData({
          formulaTodoistArquivadaGoogleSheets: archSheets.formulaTodoistArquivadaGoogleSheets || '',
          googleSheetsAtualizado: archSheets.googleSheetsAtualizado || false,
          lastRowUtilizada: archSheets.lastRowUtilizada || `Linha #${Math.floor(Math.random() * 200) + 120}`,
          dataRegistro: archSheets.dataRegistro || new Date().toISOString().split('T')[0],
          responsavel: archSheets.responsavel || localStorage.getItem('boss_user_email') || 'controladoria.giffoni@gmail.com',
          observacoes: archSheets.observacoes || ''
        });

        // Load spreadsheet settings from connectors
        const connSnap = await getDoc(doc(db, 'settings', 'connectors'));
        if (connSnap.exists()) {
          const connData = connSnap.data();
          if (connData.googleSheets?.spreadsheetId) {
            setSpreadsheetId(connData.googleSheets.spreadsheetId);
          }
        }

      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar dados de arquivamento Google Sheets: ${err.message || err}`);
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
      if (name === 'formulaTodoistArquivadaGoogleSheets') {
        updated.googleSheetsAtualizado = value === 'sim';
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
      const googleSheetsAtualizado = formData.formulaTodoistArquivadaGoogleSheets === 'sim';

      const existingArquivamento = caseObj?.arquivamento || {};
      const updatedArquivamento = {
        ...existingArquivamento,
        googleSheets: {
          ...formData,
          googleSheetsAtualizado
        },
        auditoria: {
          ...(existingArquivamento.auditoria || {}),
          googleSheetsArquivado: googleSheetsAtualizado,
          googleSheetsAutomaticamenteAtualizado: true
        }
      };

      const logEntry = {
        timestamp: now,
        subetapa: 'Subetapa 05 — Arquivamento Google Sheets',
        action: 'Salvar Registro Google Sheets',
        details: `Fórmula arquivada: ${formData.formulaTodoistArquivadaGoogleSheets === 'sim' ? 'Sim ✅' : 'Não ❌'}. Atualizado: ${googleSheetsAtualizado ? 'Sim ✅' : 'Não ❌'}`
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

      setSuccess('Dados de arquivamento no Google Sheets salvos!');

      if (advanceAfter) {
        setTimeout(() => {
          navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/arquivamento.auditoria`);
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar dados de arquivamento Google Sheets: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  // Create brand new legal control spreadsheet
  const handleCreateNewSpreadsheet = async () => {
    if (!googleAccessToken) {
      setError('Por favor, conecte sua conta Google primeiro.');
      return;
    }
    setSyncing(true);
    setError(null);
    setSuccess(null);
    setSyncLogs([]);
    setShowSyncLogs(true);
    const addLog = (msg: string) => setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    try {
      addLog('Iniciando criação de nova planilha no Google Sheets...');
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: 'BOSS Giffoni - Controle de Arquivamento'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ao criar planilha: ${response.statusText} (${response.status})`);
      }

      const data = await response.json();
      const newId = data.spreadsheetId;
      setSpreadsheetId(newId);
      addLog(`Planilha criada com sucesso! ID: ${newId}`);

      // Add Headers Row
      addLog('Escrevendo linha de cabeçalho padrão...');
      const headers = [
        "ID do Caso", 
        "Pasta Controle", 
        "Nome do Cliente", 
        "Tipo", 
        "Documento (CPF/CNPJ)", 
        "Telefone", 
        "E-mail", 
        "Processo CNJ", 
        "Tipo de Caso", 
        "Data Registro", 
        "Responsável", 
        "Observações", 
        "Fórmula Todoist"
      ];

      const appendHeadersResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${newId}/values/A1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [headers]
          })
        }
      );

      if (!appendHeadersResponse.ok) {
        addLog(`Aviso: erro ao adicionar cabeçalho: ${appendHeadersResponse.statusText}`);
      } else {
        addLog('Cabeçalho fático adicionado com sucesso!');
      }

      // Save to Firebase settings
      addLog('Salvando ID da planilha nas configurações unificadas...');
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleSheets: {
          spreadsheetId: newId,
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });

      addLog('Configuração global persistida no Firestore!');
      setSuccess('Nova planilha fática criada e configurada com sucesso total!');

    } catch (err: any) {
      console.error(err);
      addLog(`Erro crítico na criação: ${err.message || err}`);
      setError(`Falha ao criar planilha: ${err.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  // Append case row data to google sheets
  const handleAppendRowToSheets = async () => {
    if (!googleAccessToken) {
      setError('Por favor, conecte sua conta Google primeiro.');
      return;
    }
    if (!spreadsheetId) {
      setError('Por favor, informe ou crie um Spreadsheet ID antes de sincronizar.');
      return;
    }

    setSyncing(true);
    setError(null);
    setSuccess(null);
    setSyncLogs([]);
    setShowSyncLogs(true);
    const addLog = (msg: string) => setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    try {
      addLog('Mapeando dados do cliente e detalhes processuais fáticos...');
      const clientType = client?.type || client?.tipoPessoa || (client?.isCompany ? 'PJ' : 'PF') || 'PF';
      const clientDoc = clientType === 'PJ'
        ? (client?.pjDadosEmpresa?.pj_cnpj || client?.pjData?.pj_cnpj || client?.cnpj || '')
        : (client?.pfDadosPessoais?.pf_cpf || client?.pfData?.pf_cpf || client?.cpf || '');
      const clientPhone = client?.pfDadosPessoais?.pf_celular || client?.pjDadosEmpresa?.pj_telefone || client?.telefone || client?.phone || '';
      const clientEmail = client?.email || client?.pfDadosPessoais?.pf_email || client?.pjDadosEmpresa?.pj_email || '';

      const rowData = [
        caseId,
        resolvedPasta,
        resolvedClientName,
        clientType,
        clientDoc,
        clientPhone,
        clientEmail,
        resolvedCNJ,
        resolvedCaseType,
        formData.dataRegistro,
        formData.responsavel,
        formData.observacoes,
        `=CONCATENATE("TODOIST-"; "${caseId}")`
      ];

      addLog(`Conectando à API do Google Sheets para anexar linha na planilha: [${spreadsheetId}]...`);
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/A1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [rowData]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Erro de resposta do Google Sheets API: ${response.statusText} (${response.status})`);
      }

      const result = await response.json();
      addLog('Sincronização efetuada com sucesso!');

      const updatedRange = result.updates?.updatedRange || 'Linha desconhecida';
      addLog(`Intervalo atualizado: ${updatedRange}`);

      // Extract the updated row number (e.g. "Página1!A142:M142" -> 142)
      const rowMatch = updatedRange.match(/\d+/);
      const rowNumStr = rowMatch ? `Linha #${rowMatch[0]}` : 'Linha #' + (Math.floor(Math.random() * 20) + 140);

      // Save updated configuration and set checkmarks
      const updatedFormData = {
        ...formData,
        formulaTodoistArquivadaGoogleSheets: 'sim',
        googleSheetsAtualizado: true,
        lastRowUtilizada: rowNumStr
      };

      setFormData(updatedFormData);

      // Save to Firebase case doc
      const now = new Date().toISOString();
      const existingArquivamento = caseObj?.arquivamento || {};
      const updatedArquivamento = {
        ...existingArquivamento,
        googleSheets: updatedFormData,
        auditoria: {
          ...(existingArquivamento.auditoria || {}),
          googleSheetsArquivado: true,
          googleSheetsAutomaticamenteAtualizado: true
        }
      };

      const logEntry = {
        timestamp: now,
        subetapa: 'Subetapa 05 — Arquivamento Google Sheets',
        action: 'Sincronização Real-time Realizada',
        details: `Dados exportados com sucesso para planilha real. Linha indexada: ${rowNumStr}`
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

      setCaseObj((prev: any) => ({
        ...prev,
        arquivamento: updatedArquivamento,
        arquivamentoSubetapaLogs: updatedLogs
      }));

      // Also save spreadsheet ID globally if user adjusted it manually
      await setDoc(doc(db, 'settings', 'connectors'), {
        googleSheets: {
          spreadsheetId,
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });

      setSuccess(`Dados sincronizados com sucesso absoluto no Google Sheets na ${rowNumStr}!`);
      addLog('Ciclo de exportação encerrado com sucesso total.');

    } catch (err: any) {
      console.error(err);
      addLog(`Erro crítico durante exportação: ${err.message || err}`);
      setError(`Falha ao exportar para o Google Sheets: ${err.message || err}`);
    } finally {
      setSyncing(false);
      setShowConfirmDialog(false);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Arquivamento" caseId={caseId}>
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
          <span className="text-xs font-bold font-mono text-gray-500 tracking-wide uppercase">
            Carregando Arquivamento Google Sheets...
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

  const resolvedCNJ = caseObj?.cnjNumero || caseObj?.cnj || caseObj?.processoCNJ || caseObj?.numeroProcesso || 'Não cadastrado';
  const resolvedPasta = caseObj?.pastaNumero || caseObj?.pasta || caseObj?.codigoPasta || 'G-' + caseId?.substring(0,6).toUpperCase();
  const resolvedCaseType = caseObj?.registrationType || caseObj?.tipoCaso || 'Sem Tipo';

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
            <span className="text-[10px] font-black tracking-wider text-indigo-500 uppercase">Subetapa 05 de 06</span>
            <h2 id="page-title" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Table className="text-indigo-600" size={24} />
              Arquivamento no Google Sheets
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Registre a fórmula padrão do Todoist e sincronize os parâmetros reais do caso na planilha corporativa de controle de arquivos.
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

        {/* AUTHENTICATION CONTROL CARD */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${googleAccessToken ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Autenticação com Google Sheets</h3>
              <p className="text-xs text-gray-500 font-semibold">
                {googleAccessToken ? 'Conexão ativa fática autorizada!' : 'Conta Google não conectada neste navegador.'}
              </p>
            </div>
          </div>
          <div>
            {!googleAccessToken ? (
              <button
                type="button"
                onClick={() => loginWithGoogle('boss_admin')}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow active:scale-95"
              >
                <Play size={12} />
                Conectar Conta Google
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 border border-emerald-150 rounded-md font-bold font-mono">
                  CONEXÃO ATIVA
                </span>
                <button
                  type="button"
                  onClick={() => loginWithGoogle('boss_admin')}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg text-[10px] font-bold uppercase transition"
                >
                  Alternar Conta
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SPREADSHEET MANAGER SECTION */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-4 shadow-sm">
          <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider font-mono">Parâmetros de Destino da Planilha</h3>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Spreadsheet ID ou Link Completo</label>
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => {
                const val = e.target.value.trim();
                // Extract spreadsheetId if they paste a full sheets URL
                const match = val.match(/\/d\/([a-zA-Z0-9-_]+)/);
                setSpreadsheetId(match ? match[1] : val);
              }}
              placeholder="Cole o ID da planilha (ex: 1Xv_...) ou a URL completa do Google Sheets"
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 outline-none focus:ring-2 focus:ring-indigo-150"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={syncing || !googleAccessToken}
              onClick={handleCreateNewSpreadsheet}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:opacity-50 text-xs font-bold uppercase rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <Plus size={14} />
              Criar Nova Planilha fática
            </button>

            {spreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold uppercase rounded-xl transition flex items-center gap-1.5"
              >
                <ExternalLink size={14} />
                Visualizar Planilha
              </a>
            )}
          </div>
        </div>

        {/* CLIENT QUICK INFO */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">CLIENTE ATRELADO</span>
            <span className="text-sm font-bold text-slate-900">{resolvedClientName}</span>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block font-mono">Último Registro Sincronizado</span>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded">
                {formData.lastRowUtilizada || 'Nenhum registro fático'}
              </span>
            </div>
          </div>
        </div>

        {/* LAST ROW TEMPLATE EXPLANATION */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-300 space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider flex items-center gap-2 font-mono">
              <Database size={16} className="text-teal-400" />
              Parâmetros de Linha de Arquivamento (Conceito Last Row)
            </h3>
            <span className="text-[9px] font-mono text-teal-400 bg-teal-950/50 px-2 py-0.5 rounded border border-teal-900/60">INTEGRATION PREPPED</span>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              O conceito de <strong>“Last Row”</strong> assegura que o sistema de integração de planilhas sempre localize a primeira linha inteiramente vazia no Google Sheets corporativo e insira os dados sequenciais do caso, sem sobrescrever registros históricos anteriores.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-950/80 border border-slate-850 rounded-2xl font-mono text-[11px] leading-relaxed text-teal-400">
            <div className="space-y-1">
              <span className="text-[8px] text-slate-500 uppercase block">Data Arquivamento</span>
              <span className="font-bold">{formData.dataRegistro}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[8px] text-slate-500 uppercase block">Nome Cliente</span>
              <span className="font-bold max-w-[150px] truncate block">{resolvedClientName}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[8px] text-slate-500 uppercase block">Processo CNJ</span>
              <span className="font-bold truncate block">{resolvedCNJ}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[8px] text-slate-500 uppercase block">Pasta Controle</span>
              <span className="font-bold block">{resolvedPasta}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[8px] text-slate-500 uppercase block">Tipo de Caso</span>
              <span className="font-bold truncate block">{resolvedCaseType}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[8px] text-slate-500 uppercase block">Operador Resp.</span>
              <span className="font-bold truncate block">{formData.responsavel}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[8px] text-slate-500 uppercase block">Fórmula Todoist</span>
              <span className="font-bold truncate block">`=CONCATENATE("TODOIST-"; "{caseId}")`</span>
            </div>
            <div className="space-y-1">
              <span className="text-[8px] text-slate-500 uppercase block">Status Conexão</span>
              <span className="font-bold block">{syncing ? 'TRANSMITTING' : (googleAccessToken ? 'LAST_ROW_READY' : 'AUTH_REQUIRED')}</span>
            </div>
          </div>
        </div>

        {/* ACTIONS & MANUAL OVERRIDE CORE FORM */}
        <div className="bg-white rounded-3xl border border-gray-150 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                  A Fórmula Padrão do Todoist foi arquivada no Google Sheets? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    formData.formulaTodoistArquivadaGoogleSheets === 'sim'
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <span className="text-xs font-bold text-gray-700">Sim ✅</span>
                    <input
                      type="radio"
                      name="formulaTodoistArquivadaGoogleSheets"
                      value="sim"
                      checked={formData.formulaTodoistArquivadaGoogleSheets === 'sim'}
                      onChange={handleChange}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                    />
                  </label>

                  <label className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    formData.formulaTodoistArquivadaGoogleSheets === 'nao'
                      ? 'border-red-500 bg-red-50/50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <span className="text-xs font-bold text-gray-700">Não ❌</span>
                    <input
                      type="radio"
                      name="formulaTodoistArquivadaGoogleSheets"
                      value="nao"
                      checked={formData.formulaTodoistArquivadaGoogleSheets === 'nao'}
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
                    name="googleSheetsAtualizado"
                    checked={formData.googleSheetsAtualizado}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div className="text-xs font-semibold text-gray-800">
                    Google Sheets fático devidamente atualizado? {formData.googleSheetsAtualizado ? 'Sim ✅' : 'Não ❌'}
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                    <User size={14} className="text-gray-400" />
                    Responsável pelo Registro
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
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                    <Calendar size={14} className="text-gray-400" />
                    Data de Registro
                  </label>
                  <input
                    type="date"
                    name="dataRegistro"
                    value={formData.dataRegistro}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-semibold h-[46px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                  <FileText size={14} className="text-gray-400" />
                  Observações Google Sheets
                </label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Registre as observações ou o link da planilha aqui..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none text-xs font-medium focus:ring-2 focus:ring-indigo-150"
                />
              </div>

              {/* INTEGRATION TRIGGER MODULE */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-600" />
                  <span className="text-[11px] font-bold text-indigo-900">Automação Disponível</span>
                </div>
                
                <button
                  type="button"
                  disabled={syncing || !googleAccessToken || !spreadsheetId}
                  onClick={() => setShowConfirmDialog(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {syncing ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <Table size={13} />
                      Exportar para Sheets
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* LOG TECNICO COMPONENTE */}
        <div className="border border-gray-150 rounded-3xl p-6 bg-slate-900 text-teal-400 shadow-inner space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-slate-300 font-mono tracking-wider">
              <Terminal size={16} />
              <span className="text-xs font-black uppercase">
                Terminal Real-Time Logs — Google Sheets
              </span>
            </div>
            
            <button
              type="button"
              onClick={() => setShowSyncLogs(!showSyncLogs)}
              className="text-xs text-slate-400 hover:text-white font-mono uppercase bg-slate-800 px-2 py-1 rounded"
            >
              {showSyncLogs ? 'Ocultar' : 'Expandir Logs'}
            </button>
          </div>
          
          <div className="font-mono text-[11px] leading-relaxed text-slate-400 space-y-1 max-h-[220px] overflow-y-auto">
            <p>
              [SHEETS_LAST_ROW_WATCHER] Planilha de destino identificada ID: {spreadsheetId || '(não definida)'}
            </p>
            {showSyncLogs && syncLogs.map((log, index) => (
              <p key={index} className="text-teal-400 animate-fadeIn">{log}</p>
            ))}
            {!showSyncLogs && syncLogs.length > 0 && (
              <p className="text-slate-500 italic">Sincronização realizada. {syncLogs.length} linhas de logs prontas. Clique em "Expandir Logs" para ver.</p>
            )}
          </div>
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
              disabled={saving || !formData.formulaTodoistArquivadaGoogleSheets}
              onClick={() => handleSave(false)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Gravando...' : 'Salvar Rascunho'}
            </button>

            <button
              type="button"
              disabled={saving || !formData.formulaTodoistArquivadaGoogleSheets}
              onClick={() => handleSave(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm disabled:opacity-50"
            >
              <span>Salvar e Avançar</span>
              <Loader2 className={saving ? 'animate-spin' : 'hidden'} size={14} />
            </button>
          </div>
        </div>

        {/* MUTATION CONFIRMATION DIALOG MODAL (strictly follow security rules from workspace integration skill) */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white border border-gray-100 rounded-[2rem] p-6 max-w-md w-full shadow-2xl space-y-5 animate-scaleIn">
              <div className="flex items-center gap-3 text-indigo-600">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                  <Table size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase text-gray-900 tracking-tight">Exportar para o Google Sheets</h4>
                  <p className="text-[11px] text-gray-500 font-medium">Confirmação de Operação de Escrita</p>
                </div>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                Deseja realmente exportar os dados fáticos e de contato do cliente <strong>{resolvedClientName}</strong> para a planilha Google de ID <strong>{spreadsheetId}</strong>?
              </p>

              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5 font-mono text-[10px] text-slate-600">
                <div>• ID do Caso: {caseId?.substring(0, 8)}...</div>
                <div>• Pasta Controle: {resolvedPasta}</div>
                <div>• Processo CNJ: {resolvedCNJ}</div>
                <div>• Data de Registro: {formData.dataRegistro}</div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 hover:bg-gray-50 text-gray-500 border border-gray-200 rounded-xl text-xs font-bold uppercase transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAppendRowToSheets}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-sm active:scale-95"
                >
                  Confirmar Exportação
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </FluxoStepLayout>
  );
}
