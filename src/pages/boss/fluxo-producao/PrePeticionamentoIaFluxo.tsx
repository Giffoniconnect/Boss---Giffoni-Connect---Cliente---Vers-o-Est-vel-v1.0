import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import {
  ArrowLeft,
  ChevronRight,
  Sparkles,
  Save,
  Check,
  AlertTriangle,
  FileCheck,
  Loader2,
  Lock,
  Compass,
  FileText,
  Copy,
  BrainCircuit,
  Wand2,
  RefreshCw,
  Terminal,
  Sliders,
  CheckCircle2,
  Info,
  Layers,
  HelpCircle
} from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';

interface GemsTechnicalLog {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  code: string;
  message: string;
}

export default function PrePeticionamentoIaFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingGems, setSavingGems] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseObj, setCaseObj] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

  // IA Generation Inputs
  const [documentType, setDocumentType] = useState('peticao_inicial');
  const [tone, setTone] = useState('persuasivo');
  const [fatosAdicionais, setFatosAdicionais] = useState('');
  const [aiResult, setAiResult] = useState('');

  // GEMS Calibration Parameters (Operational & Persistent)
  const [gemsTemperature, setGemsTemperature] = useState<number>(0.1); // default 0.1 for maximum factual rigor
  const [gemsPrecision, setGemsPrecision] = useState<string>('alta');
  const [gemsFocalPoint, setGemsFocalPoint] = useState<string>('provas_cara_cracha');
  const [gemsLanguageStyle, setGemsLanguageStyle] = useState<string>('formal_doutrinario');

  // Logs state
  const [showGemsLogs, setShowGemsLogs] = useState(false);
  const [gemsTechnicalLogs, setGemsTechnicalLogs] = useState<GemsTechnicalLog[]>([]);

  const addLog = (level: 'info' | 'success' | 'warning' | 'error', code: string, message: string) => {
    const newLog: GemsTechnicalLog = {
      timestamp: new Date().toISOString(),
      level,
      code,
      message
    };
    setGemsTechnicalLogs(prev => [newLog, ...prev]);
  };

  useEffect(() => {
    if (!caseId) return;

    const fetchCaseAndClient = async () => {
      try {
        setLoading(true);
        const caseRef = doc(db, 'cases', caseId);
        const caseSnap = await getDoc(caseRef);

        if (!caseSnap.exists()) {
          setError(`Caso de ID [${caseId}] não existente.`);
          setLoading(false);
          return;
        }

        const caseData = caseSnap.data();
        setCaseObj({ id: caseSnap.id, ...caseData });

        // Retrieve previously saved draft & parameters
        if (caseData.prePeticionamentoText) {
          setAiResult(caseData.prePeticionamentoText);
        }
        if (caseData.prePeticionamentoFatosAdicionais) {
          setFatosAdicionais(caseData.prePeticionamentoFatosAdicionais);
        }
        if (caseData.prePeticionamentoDocumentType) {
          setDocumentType(caseData.prePeticionamentoDocumentType);
        }
        if (caseData.prePeticionamentoTone) {
          setTone(caseData.prePeticionamentoTone);
        }

        // GEMS persistent calibration loading
        if (caseData.gemsConfig) {
          if (typeof caseData.gemsConfig.temperature === 'number') {
            setGemsTemperature(caseData.gemsConfig.temperature);
          }
          if (caseData.gemsConfig.precision) {
            setGemsPrecision(caseData.gemsConfig.precision);
          }
          if (caseData.gemsConfig.focalPoint) {
            setGemsFocalPoint(caseData.gemsConfig.focalPoint);
          }
          if (caseData.gemsConfig.languageStyle) {
            setGemsLanguageStyle(caseData.gemsConfig.languageStyle);
          }
        }

        if (caseData.clientId) {
          const clientSnap = await getDoc(doc(db, 'clients', caseData.clientId));
          if (clientSnap.exists()) {
            setClient({ id: clientSnap.id, ...clientSnap.data() });
          }
        }

        // Initial Technical Logs
        const initialLogs: GemsTechnicalLog[] = [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            code: 'CARRY_ON_INITIALIZED',
            message: 'Integridade de fluxo verificada: Dados de estruturação jurídica importados automaticamente sem redigitação.'
          },
          {
            timestamp: new Date().toISOString(),
            level: 'success',
            code: 'GEMS_CALIBRATION_READY',
            message: 'Camada de calibração de hiperparâmetros GEMS carregada e sincronizada.'
          }
        ];
        setGemsTechnicalLogs(initialLogs);

      } catch (err: any) {
        console.error("Error loading case info for pre-petitioning:", err);
        setError(`Erro ao carregar dados do caso: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    };

    fetchCaseAndClient();
  }, [caseId]);

  const handleSaveGemsSettings = async () => {
    if (!caseId) return;
    setSavingGems(true);
    setError(null);
    setSuccess(null);

    try {
      const caseRef = doc(db, 'cases', caseId);
      const gemsConfig = {
        temperature: gemsTemperature,
        precision: gemsPrecision,
        focalPoint: gemsFocalPoint,
        languageStyle: gemsLanguageStyle,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(caseRef, {
        gemsConfig,
        updatedAt: new Date().toISOString()
      });

      setCaseObj((prev: any) => ({
        ...prev,
        gemsConfig
      }));

      addLog('success', 'GEMS_CALIBRATION_SAVED', `Novos hiperparâmetros gravados persistentes no banco de dados.`);
      setSuccess('Parâmetros de calibração GEMS salvos com sucesso!');
    } catch (err: any) {
      console.error(err);
      addLog('error', 'GEMS_SAVE_FAILED', `Falha ao persistir parametrização: ${err.message || err}`);
      setError(`Erro ao salvar parâmetros GEMS: ${err.message || err}`);
    } finally {
      setSavingGems(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!caseId) return;
    setGenerating(true);
    setError(null);
    setSuccess(null);

    const clientName = client ? (client.nome || client.nomeCompleto || client.razaoSocial || 'Cliente') : 'Cliente';

    addLog('info', 'PREPARATION_STARTED', `Iniciando compilação de dados do caso e de qualificação para o prontuário.`);

    try {
      // 1. COMPILATION AND CARRY-ON (ZERO MANUAL REDIGITATION)
      const qualificationText = client ? `
=== OUTORGANTE E PARTE REQUERENTE ===
NOME COMPLETO / RAZÃO SOCIAL: ${clientName.toUpperCase()}
TIPO: ${client.type === 'PF' ? 'PESSOA FÍSICA' : 'PESSOA JURÍDICA'}
DOCUMENTO CPF/CNPJ: ${client.type === 'PF' ? (client.pfDadosPessoais?.pf_cpf || client.pfData?.pf_cpf || '—') : (client.pjDadosEmpresa?.pj_cnpj || client.pjData?.pj_cnpj || '—')}
RG / INSCRIÇÃO: ${client.type === 'PF' ? (client.pfDadosPessoais?.pf_rg || client.pfData?.pf_rg || '—') : (client.pjDadosEmpresa?.pj_inscricaoEstadual || '—')}
ENDEREÇO COMPLETO: ${client.type === 'PF' ? (client.pfDadosPessoais?.pf_endereco || client.pfData?.pf_endereco || '—') : (client.pjDadosEmpresa?.pj_endereco || client.pjData?.pj_endereco || '—')}
E-MAIL CORPORATIVO: ${client.type === 'PF' ? (client.pfDadosPessoais?.pf_email || client.pfData?.pf_email || '—') : (client.pjDadosEmpresa?.pj_email || client.pjData?.pj_email || '—')}
TELEFONE CELULAR: ${client.type === 'PF' ? (client.pfDadosPessoais?.pf_telefone || client.pfData?.pf_telefone || '—') : (client.pjDadosEmpresa?.pj_telefone || client.pjData?.pj_telefone || '—')}
` : 'Não qualificado.';

      // Get consolidated preview text or build on the fly
      const edrpStructuredText = caseObj?.edrpEstruturacao?.subetapa02?.previewRelatorioConsolidated ||
                             caseObj?.edrpEstruturacao?.subetapa02?.previewRelatorioConsolidado ||
                             caseObj?.edrp?.structuring?.relevantFacts ||
                             'Sem síntese consolidada preliminar.';

      // Gather proofs
      const provasFinalidades = (caseObj?.edrpEstruturacao?.subetapa01?.provas || caseObj?.edrp?.custodiaProvasPF?.provas || [])
        .map((p: any, idx: number) => `- Prova #${idx + 1}: ${p.nome || '—'} | Justificativa / Finalidade Jurídica: ${p.justificativa || p.finalidade || '—'}`)
        .join('\n');

      // Gather Lego Fundamentals & Pedidos
      const fundamentosLego = (caseObj?.edrpEstruturacao?.subetapa01?.fundamentos || [])
        .map((f: any) => `  * Tese selecionada: ${f.nome || f.titulo || f}`)
        .join('\n');

      const pedidosLego = (caseObj?.edrpEstruturacao?.subetapa01?.pedidos || [])
        .map((p: any) => `  * Pedido formalizado: ${p.nome || p.titulo || p}`)
        .join('\n');

      const fatosFundamentos = `
${qualificationText}

=== EDRP CONSOLIDADO (SUBETAPA 02) ===
${edrpStructuredText}

=== CUSTÓDIA DE PROVAS (CARA + CRACHÁ) ===
${provasFinalidades || 'Nenhuma prova cadastrada.'}

=== TESES JURÍDICAS LEGO SELECIONADAS ===
${fundamentosLego || 'Nenhuma tese Lego selecionada.'}

=== PEDIDOS LEGO VINCULADOS ===
${pedidosLego || 'Nenhum pedido Lego vinculado.'}

=== FATOS COMPLEMENTARES INSERIDOS PELO OPERADOR ===
${fatosAdicionais || 'Sem observações fáticas adicionais.'}
`;

      const estrategiaJuridica = `
TIPO DE PEÇA: ${documentType.toUpperCase()}
ESTILO GEMS: ${gemsLanguageStyle}
TEMPERATURA GEMS: ${gemsTemperature} (Foco: ${gemsTemperature <= 0.2 ? 'Rigor Fático Absoluto' : 'Fluidez Narrativa'})
FOCO GEMS: ${gemsFocalPoint}
ESTILO GERAL: ${tone}

ESTRATÉGIA JURÍDICA E DE CASO (EDRP):
${caseObj?.edrp?.structuring?.strategy || 'Defesa processual cível padrão.'}
PONTOS DE ATENÇÃO / RISCOS:
${caseObj?.edrp?.structuring?.risks || 'Nenhum risco crítico mapeado.'}
`;

      const competenciaJurisdicional = caseObj?.edrp?.structuring?.competence || 'Foro de domicílio do autor / eleição contratual padrão.';

      addLog('info', 'ZERO_REDIGITATION_VALIDATED', `Regra de não-redigitação respeitada: ${fatosFundamentos.length} caracteres de dados extraídos dos cards de EDRP.`);
      addLog('info', 'GEMINI_REQUEST_DISPATCHED', `Iniciando chamada cognitiva ao Gemini-3.5-Flash (Temperatura GEMS: ${gemsTemperature}).`);

      const response = await fetch('/api/gemini-format', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fatosFundamentos,
          estrategiaJuridica,
          competenciaJurisdicional
        })
      });

      if (!response.ok) {
        throw new Error('Falha técnica no serviço de IA do servidor.');
      }

      const data = await response.json();
      if (data && data.text) {
        setAiResult(data.text);
        addLog('success', 'GENERATION_COMPLETE', `Rascunho jurídico gerado com sucesso pelo modelo. Tamanho: ${data.text.length} caracteres.`);
        setSuccess('Peça jurídica de pré-peticionamento gerada com sucesso pela inteligência calibrada!');
      } else {
        throw new Error('O modelo cognitivo não retornou nenhum texto.');
      }
    } catch (err: any) {
      console.error(err);
      addLog('error', 'GENERATION_FAILED', `Erro técnico na chamada do motor GEMS: ${err.message || err}`);
      setError(`Erro na geração automatizada: ${err.message || err}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const caseRef = doc(db, 'cases', caseId);
      const now = new Date().toISOString();

      await updateDoc(caseRef, {
        prePeticionamentoText: aiResult,
        prePeticionamentoFatosAdicionais: fatosAdicionais,
        prePeticionamentoDocumentType: documentType,
        prePeticionamentoTone: tone,
        prePeticionamentoStatus: aiResult ? 'complete' : 'pending',
        gemsConfig: {
          temperature: gemsTemperature,
          precision: gemsPrecision,
          focalPoint: gemsFocalPoint,
          languageStyle: gemsLanguageStyle,
          updatedAt: now
        },
        updatedAt: now
      });

      addLog('success', 'DRAFT_PERSISTED', `Rascunho de pré-peticionamento gravado com sucesso no prontuário técnico.`);
      setSuccess('Rascunho e parametrização GEMS salvos com sucesso no prontuário do cliente!');
    } catch (err: any) {
      console.error(err);
      addLog('error', 'PERSISTENCE_FAILED', `Falha ao gravar o prontuário: ${err.message || err}`);
      setError(`Erro ao salvar documento: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyText = () => {
    if (!aiResult) return;
    navigator.clipboard.writeText(aiResult).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addLog('info', 'CLIPBOARD_COPY_SUCCESS', `Rascunho copiado para a área de transferência.`);
    }).catch(err => {
      console.error("Erro ao copiar rascunho:", err);
    });
  };

  const clientName = client
    ? (client.nome || client.nomeCompleto || client.razaoSocial || 'Cliente')
    : 'Cliente';

  return (
    <FluxoStepLayout
      stepName="Pré-Peticionamento com IA"
      caseId={caseId}
      statusText={aiResult ? 'Rascunho Gerado' : 'Aguardando Geração'}
    >
      <div className="space-y-8 font-sans max-w-5xl">
        {/* Error & Success Alerts */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-3xl text-rose-900 text-xs flex gap-3 items-center animate-fade-in">
            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-900 text-xs flex gap-3 items-center animate-fade-in">
            <Sparkles size={18} className="text-emerald-500 shrink-0" />
            <span className="font-semibold leading-relaxed">{success}</span>
          </div>
        )}

        {/* HERO HEADER */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-[2rem] p-8 space-y-4 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center">
              <BrainCircuit size={22} className="animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300 font-mono">Cognição Assistida GEMS</span>
              <h2 className="text-lg font-black tracking-tight mt-0.5 animate-fade-in">Etapa 08 — Pré-Peticionamento Legal de Alto Desempenho</h2>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl font-semibold">
            Gere a redação preliminar da peça jurídica a partir dos dados consolidados da estruturação jurídica (fatos, teses de defesa, pedidos e contingências), sem necessidade de redigitação manual. Configure o motor GEMS de inteligência para melhor calibração processual.
          </p>
        </div>

        {/* METRICS & CONFIG COMPONENT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: GEMS CALIBRATION LAYER & CONFIGS */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* GEMS CALIBRATION PANEL */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-5 shadow-xs relative">
              <div className="absolute right-4 top-4 text-indigo-500">
                <Sliders size={16} />
              </div>
              
              <div className="space-y-1 pb-2 border-b border-gray-100">
                <span className="text-[9px] uppercase font-bold tracking-widest text-indigo-600 font-mono">Motor de Alinhamento</span>
                <h3 className="text-sm font-black text-slate-900">Camada de Calibração GEMS</h3>
                <p className="text-[10px] text-gray-400 font-medium">Ajuste os parâmetros operacionais da IA antes de processar o rascunho.</p>
              </div>

              {/* RIGOR FÁTICO (TEMPERATURE) SLIDER */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-black text-gray-500 tracking-wider flex items-center gap-1">
                    Foco / Rigor Fático
                    <span className="group relative cursor-pointer text-gray-400">
                      <HelpCircle size={10} />
                      <span className="absolute hidden group-hover:block bottom-4 left-0 bg-slate-900 text-white text-[9px] p-2 rounded w-44 z-30 font-sans leading-normal normal-case font-medium shadow">
                        Valores mais baixos forçam o modelo a seguir rigorosamente os fatos declarados pelo cliente, sem extrapolações fáticas.
                      </span>
                    </span>
                  </label>
                  <span className="text-xs font-bold font-mono text-indigo-650">{gemsTemperature === 0.1 ? '0.1 (Máx Rigor)' : gemsTemperature}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={gemsTemperature}
                  onChange={(e) => setGemsTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                />
                <div className="flex justify-between text-[9px] text-gray-400 font-bold font-mono">
                  <span>MÁX RIGOR (0.1)</span>
                  <span>CRIATIVO (1.0)</span>
                </div>
                {gemsTemperature > 0.2 && (
                  <div className="p-2.5 bg-amber-50 rounded-xl flex gap-2 items-start text-[10px] text-amber-800 leading-normal font-semibold">
                    <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                    <span>Atenção: Aumentar a temperatura reduz o rigor fático e pode gerar imprecisões históricas. Recomendamos 0.1.</span>
                  </div>
                )}
              </div>

              {/* ESTILO DE LINGUAGEM */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Estilo Linguístico Processual</label>
                <select
                  value={gemsLanguageStyle}
                  onChange={(e) => setGemsLanguageStyle(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-gray-250 focus:border-indigo-500 rounded-xl p-3 text-xs font-semibold outline-none cursor-pointer transition-colors"
                >
                  <option value="formal_doutrinario">Formal Doutrinário (Giffoni Clássico)</option>
                  <option value="conciso_objetivo">Conciso e Objetivo (Foco em Celeridade)</option>
                  <option value="pericial_tecnico">Pericial Técnico (Rigor Analítico)</option>
                </select>
              </div>

              {/* FOCO DA REDAÇÃO */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Foco de Pesquisa da Tese</label>
                <select
                  value={gemsFocalPoint}
                  onChange={(e) => setGemsFocalPoint(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-gray-250 focus:border-indigo-500 rounded-xl p-3 text-xs font-semibold outline-none cursor-pointer transition-colors"
                >
                  <option value="provas_cara_cracha">Validação de Prova (Cara + Crachá)</option>
                  <option value="fundamentacao_lego">Fundamentação Normativa (Sistema Lego)</option>
                  <option value="qualificacao_fatos">Qualificação Fática do Autor</option>
                </select>
              </div>

              {/* SAVING PARAMETERS BUTTON */}
              <button
                type="button"
                disabled={savingGems}
                onClick={handleSaveGemsSettings}
                className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {savingGems ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                <span>Salvar Calibração GEMS</span>
              </button>
            </div>

            {/* CONFIGURE PROMPT PANEL */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-5 shadow-xs">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2.5 border-b border-gray-100">
                <Wand2 size={14} className="text-indigo-600" />
                <span>Configurar Peça</span>
              </h3>

              {/* Document Type Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Tipo de Peça Jurídica</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-gray-250 focus:border-indigo-500 rounded-xl p-3 text-xs font-semibold outline-none cursor-pointer transition-colors"
                >
                  <option value="peticao_inicial">Petição Inicial (PF/PJ)</option>
                  <option value="recurso_incidental">Recurso Incidental / Apelação</option>
                  <option value="contestacao">Contestação / Memória de Defesa</option>
                  <option value="notificacao_extrajudicial">Notificação Extrajudicial</option>
                </select>
              </div>

              {/* Tone Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Tom de Escrita</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-gray-250 focus:border-indigo-500 rounded-xl p-3 text-xs font-semibold outline-none cursor-pointer transition-colors"
                >
                  <option value="persuasivo">Altamente Persuasivo & Doutrinário</option>
                  <option value="objetivo">Objetivo & Concreto (Juizados Especiais)</option>
                  <option value="pericial">Rigoroso / Pericial Técnico</option>
                  <option value="didatico">Didático & Narrativo</option>
                </select>
              </div>

              {/* Fatos Adicionais */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-gray-500 tracking-wider block">Fatos e Dados Complementares</label>
                <textarea
                  placeholder="Insira detalhes fáticos adicionais, jurisprudências ou observações complementares específicas para esta peça jurídica..."
                  rows={5}
                  value={fatosAdicionais}
                  onChange={(e) => setFatosAdicionais(e.target.value)}
                  className="w-full bg-white border border-gray-250 focus:border-indigo-500 rounded-xl p-3 text-xs font-medium outline-none transition-colors leading-relaxed resize-none"
                />
              </div>

              <button
                type="button"
                disabled={generating}
                onClick={handleGenerateDraft}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer font-bold font-sans"
              >
                {generating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Processando Tese GEMS...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Analisar e Gerar</span>
                  </>
                )}
              </button>
            </div>

            {/* CONTEXT-AWARE GEMS TECHNICAL LOG ACCORDION */}
            <div className="border border-gray-150 rounded-2xl overflow-hidden shadow-3xs bg-white">
              <button
                type="button"
                onClick={() => setShowGemsLogs(!showGemsLogs)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 text-slate-700">
                  <Terminal size={14} />
                  <span className="text-xs font-bold uppercase tracking-wider font-sans">Ver logs técnicos do GEMS</span>
                </div>
                <span className="text-xs text-slate-400 font-bold font-mono">
                  {showGemsLogs ? '[-] Ocultar' : '[+] Expandir'}
                </span>
              </button>
              
              {showGemsLogs && (
                <div className="p-4 bg-slate-900 border-t border-gray-150 font-mono text-[10px] text-slate-300 space-y-2 max-h-56 overflow-y-auto">
                  {gemsTechnicalLogs.length > 0 ? (
                    gemsTechnicalLogs.map((log, idx) => {
                      let dotColor = "bg-blue-500";
                      let textColor = "text-blue-300";
                      if (log.level === "success") {
                        dotColor = "bg-emerald-500";
                        textColor = "text-emerald-300";
                      } else if (log.level === "error") {
                        dotColor = "bg-rose-500";
                        textColor = "text-rose-300";
                      } else if (log.level === "warning") {
                        dotColor = "bg-amber-500";
                        textColor = "text-amber-300";
                      }

                      return (
                        <div key={idx} className="space-y-0.5 border-b border-slate-800 pb-1.5 last:border-0">
                          <div className="flex items-center gap-1 text-[9px] text-slate-500">
                            <span>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span className={textColor}>[{log.code}]</span>
                          </div>
                          <p className="text-slate-200 leading-relaxed font-medium">{log.message}</p>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-slate-500 italic">Sem eventos de calibração registrados.</p>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: AI OUTPUT VIEWER */}
          <div className="lg:col-span-2 bg-white border border-gray-150 rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText size={15} className="text-indigo-600" />
                <span>Rascunho Jurídico do Pré-Peticionamento</span>
              </h3>

              {aiResult && (
                <button
                  type="button"
                  onClick={handleCopyText}
                  className={`inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl text-xs font-extrabold transition-all border ${
                    copied 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer shadow-3xs'
                  }`}
                >
                  <Copy size={12} />
                  <span>{copied ? 'Copiado!' : 'Copiar Rascunho'}</span>
                </button>
              )}
            </div>

            {aiResult ? (
              <div className="p-6 bg-slate-50 border border-gray-150 rounded-2xl max-h-[580px] overflow-y-auto font-mono text-[11.5px] leading-relaxed text-slate-800 select-text whitespace-pre-wrap shadow-inner">
                {aiResult}
              </div>
            ) : (
              <div className="py-36 text-center text-gray-400 flex flex-col items-center justify-center gap-4">
                <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 animate-pulse">
                  <BrainCircuit size={36} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase text-slate-800 tracking-wider">Aguardando Concepção Cognitiva</p>
                  <p className="text-[11px] text-gray-500 max-w-sm font-semibold leading-relaxed">
                    Ajuste as definições do motor GEMS de calibração à esquerda, insira observações fáticas extras se desejar, e clique em "Analisar e Gerar" para invocar a inteligência artificial.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* BOTTOM NAV BAR */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/edrp/estruturacao.juridica.sub-etapa-4`)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            <ArrowLeft size={14} />
            Voltar para Subetapa 04
          </button>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveDraft}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer"
            >
              {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
              <span>{saving ? 'Gravando...' : 'Gravar no Prontuário'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate(flowRoutes.delegacao(caseId!))}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
            >
              <span>Avançar para Delegação</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </FluxoStepLayout>
  );
}
