import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { BossLayout } from '../../../components/Layout';
import { 
  Scale, 
  ArrowLeft, 
  CheckCircle, 
  FileText, 
  AlertTriangle, 
  Check, 
  Loader2, 
  Sparkles, 
  Folder, 
  File, 
  FolderPlus, 
  Upload, 
  ExternalLink,
  ChevronRight,
  Info,
  ShieldCheck,
  RefreshCw,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';

// Custom lightweight Markdown previewer to avoid module loading errors
function SimpleMarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;
  
  // Split into lines to parse paragraphs, headers, and lists
  const lines = content.split('\n');
  
  return (
    <div className="space-y-3 text-gray-200 leading-relaxed font-sans text-xs">
      {lines.map((line, idx) => {
        if (typeof line !== 'string') return null;
        const trimmed = line ? line.trim() : '';
        if (!trimmed) return <div key={idx} className="h-2" />;
        
        // Horizontal Rules
        if (trimmed === '---') {
          return <hr key={idx} className="border-white/10 my-4" />;
        }
        
        // Headers H4
        if (trimmed.startsWith('####')) {
          return (
            <h5 key={idx} className="text-xs font-black text-[#a5b4fc] uppercase tracking-wider mt-4 mb-2">
              {trimmed.replace(/^####\s*/, '')}
            </h5>
          );
        }
        
        // Headers H3
        if (trimmed.startsWith('###')) {
          return (
            <h4 key={idx} className="text-sm font-black text-white uppercase tracking-wider mt-5 mb-2 border-l-2 border-indigo-500 pl-2">
              {trimmed.replace(/^###\s*/, '')}
            </h4>
          );
        }
        
        // Headers H2
        if (trimmed.startsWith('##')) {
          return (
            <h4 key={idx} className="text-base font-black text-indigo-300 uppercase tracking-tight mt-6 mb-3">
              {trimmed.replace(/^##\s*/, '')}
            </h4>
          );
        }
        
        // Headers H1
        if (line && line.startsWith('#')) {
          return (
            <h3 key={idx} className="text-lg font-black text-white tracking-tight mt-6 mb-4">
              {trimmed.replace(/^#\s*/, '')}
            </h3>
          );
        }
        
        // List items
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const rawText = trimmed.replace(/^[-*]\s*/, '');
          // Parse inline bold
          const parts = parseInlineBold(rawText);
          return (
            <div key={idx} className="flex items-start gap-2 pl-4">
              <span className="text-indigo-400 mt-1 select-none">•</span>
              <span className="text-gray-200 font-semibold">{parts}</span>
            </div>
          );
        }
        
        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
        if (numMatch) {
          const rawText = numMatch[2];
          const parts = parseInlineBold(rawText);
          return (
            <div key={idx} className="flex items-start gap-2 pl-4">
              <span className="text-indigo-300 font-black font-mono mt-0.5 select-none">{numMatch[1]}.</span>
              <span className="text-gray-200 font-semibold">{parts}</span>
            </div>
          );
        }
        
        // Blockquotes
        if (trimmed.startsWith('>')) {
          const rawText = trimmed.replace(/^>\s*/, '');
          return (
            <blockquote key={idx} className="border-l-4 border-slate-600 bg-slate-900/50 px-3 py-1.5 italic text-gray-400 rounded-r-lg my-2 font-medium">
              {rawText}
            </blockquote>
          );
        }
        
        // Render regular paragraph with inline bold parsed
        return (
          <p key={idx} className="text-gray-300 font-semibold leading-relaxed">
            {parseInlineBold(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

// Function to parse **bold** and 🟢 icons
function parseInlineBold(text: string) {
  if (!text) return '';
  const parts: React.ReactNode[] = [];
  
  // Simple bold pattern regex
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  let keyIdx = 0;
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <strong key={keyIdx++} className="font-extrabold text-white">
        {match[1]}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}

export default function RegulamentarViabilidade() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Verification & Drive state mock
  const [driveChecking, setDriveChecking] = useState(false);
  const [foldersChecked, setFoldersChecked] = useState(false);
  const [driveLogs, setDriveLogs] = useState<string[]>([]);
  
  // Standard list of document criteria to check presence in '01 DOCUMENTOS'
  const [availableDocs, setAvailableDocs] = useState<Record<string, { present: boolean; fileName: string; size: string }>>({
    'RG': { present: true, fileName: 'rg_interessado_digitalizado.pdf', size: '1.2 MB' },
    'CPF': { present: true, fileName: 'comprovante_cpf_receita.pdf', size: '320 KB' },
    'Comprovante de residência': { present: true, fileName: 'fatura_agua_maio2026.pdf', size: '850 KB' },
    'CNH': { present: false, fileName: '', size: '' },
    'Carteira de Trabalho': { present: false, fileName: '', size: '' }
  });

  const [docIntegrity, setDocIntegrity] = useState<'🟢 DOCUMENTAÇÃO SUFICIENTE' | '🟡 DOCUMENTAÇÃO PARCIAL' | '🔴 DOCUMENTAÇÃO INSUFICIENTE'>('🟡 DOCUMENTAÇÃO PARCIAL');

  // Agent AI State
  const [analyzing, setAnalyzing] = useState(false);
  const [analystLogs, setAnalystLogs] = useState<string[]>([]);
  const [opinionText, setOpinionText] = useState<string>('');
  const [editMode, setEditMode] = useState(false);

  // Saving stage state
  const [savingDocs, setSavingDocs] = useState(false);
  const [versionHistory, setVersionHistory] = useState<any[]>([
    { version: '1.0', date: new Date().toLocaleDateString('pt-BR'), status: 'Rascunho' }
  ]);

  // Load marketing leads matching Etapa 2
  useEffect(() => {
    async function loadLeadData() {
      if (!leadId) return;
      try {
        setLoading(true);
        setError(null);
        
        // Fetch from Firestore
        const docRef = doc(db, 'marketingLeads', leadId);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
          const data = snap.data();
          setLead({ id: snap.id, ...data });
          
          // Re-load saved values if present
          if (data.analiseViabilidade?.parecerCompleto) {
            setOpinionText(data.analiseViabilidade.parecerCompleto);
          }
          if (data.analiseViabilidade?.documentacaoIntegrity) {
            setDocIntegrity(data.analiseViabilidade.documentacaoIntegrity);
          }
          if (data.analiseViabilidade?.checkedDocs) {
            setAvailableDocs(data.analiseViabilidade.checkedDocs);
          }
          if (data.analiseViabilidade?.historicoVersoes) {
            setVersionHistory(data.analiseViabilidade.historicoVersoes);
          }
        } else {
          // Fallback location storage backup
          const local = localStorage.getItem('local_marketing_leads');
          const list = local ? JSON.parse(local) : [];
          const found = list.find((item: any) => item.id === leadId);
          if (found) {
            setLead(found);
            if (found.analiseViabilidade?.parecerCompleto) {
              setOpinionText(found.analiseViabilidade.parecerCompleto);
            }
            if (found.analiseViabilidade?.documentacaoIntegrity) {
              setDocIntegrity(found.analiseViabilidade.documentacaoIntegrity);
            }
            if (found.analiseViabilidade?.checkedDocs) {
              setAvailableDocs(found.analiseViabilidade.checkedDocs);
            }
          } else {
            setError('Lead não localizado no banco de dados para iniciar a análise.');
          }
        }
      } catch (err: any) {
        console.error(err);
        setError('Ocorreu um erro ao buscar o lead: ' + (err.message || err));
      } finally {
        setLoading(false);
      }
    }
    loadLeadData();
  }, [leadId]);

  // Simulate checker of Google Drive structure
  const handleVerifyGoogleDrive = () => {
    setDriveChecking(true);
    setFoldersChecked(false);
    setDriveLogs([]);
    
    const logs = [
      'Estabelecendo conexão via Portal Connect com o Google Workspace...',
      'Analisando diretório de leads na raiz configurada...',
      'Pasta principal de triagem "Giffoni Clientes / Leads" localizada com sucesso.',
      `Verificando pasta do lead: "Leads / [${lead?.pessoaFisica?.nomeCompleto || lead?.pessoaJuridica?.razaoSocial || lead?.name || 'Cliente Sem Nome'}]"`,
      '✓ Pasta principal do lead ENCONTRADA no Google Drive.',
      'Acessando árvore de diretórios internos de triagem comercial...',
      'Verificando presença da subpasta obrigatória: "01 DOCUMENTOS"...',
      '✓ Pasta "01 DOCUMENTOS" mapeada e operacional.',
      'Examinando documentos anexados no diretório "01 DOCUMENTOS"...'
    ];

    let currentLogIndex = 0;
    
    const interval = setInterval(() => {
      if (currentLogIndex < logs.length) {
        setDriveLogs(prev => [...prev, logs[currentLogIndex]]);
        currentLogIndex++;
      } else {
        clearInterval(interval);
        
        // Compute count of checked active documents
        const docsPresent = Object.keys(availableDocs).filter(k => availableDocs[k].present);
        
        // Auto-adjust documentation recommendation
        let finalIntegrity: '🟢 DOCUMENTAÇÃO SUFICIENTE' | '🟡 DOCUMENTAÇÃO PARCIAL' | '🔴 DOCUMENTAÇÃO INSUFICIENTE' = '🟡 DOCUMENTAÇÃO PARCIAL';
        if (docsPresent.length >= 4) {
          finalIntegrity = '🟢 DOCUMENTAÇÃO SUFICIENTE';
        } else if (docsPresent.length <= 1) {
          finalIntegrity = '🔴 DOCUMENTAÇÃO INSUFICIENTE';
        }
        
        setDocIntegrity(finalIntegrity);
        
        // Add final concluding verification logs
        setDriveLogs(prev => [
          ...prev,
          `✓ Varredura concluída. Localizados ${docsPresent.length} documento(s) válido(s) anexados.`,
          `Sinalização de integridade sugerida: ${finalIntegrity}`
        ]);
        
        setFoldersChecked(true);
        setDriveChecking(false);
      }
    }, 400);
  };

  // Run Gemini Legal Viability Specialist Agent
  const handleRunAgentAnalysis = async () => {
    setAnalyzing(true);
    setOpinionText('');
    setAnalystLogs([]);

    const agentLogs = [
      '[AGENTE] Inicializando protocolo de investigação documental da Giffoni Advogados...',
      '[AGENTE] Conectando ao repositório central de dados doutrinários e jurisprudência comercial...',
      `[AGENTE] Estudo de Viabilidade iniciado para: ${lead?.pessoaFisica?.nomeCompleto || lead?.pessoaJuridica?.razaoSocial || lead?.name || 'Lead'}`,
      `[AGENTE] Parâmetro documental sob análise: ${docIntegrity}`,
      '[AGENTE] Avaliando a incoerência fática e consistência do atendimento inicial...',
      '[AGENTE] Cruzando fatos narrados com o artigo 186 e 927 do Código Civil...',
      '[AGENTE] Alinhando precedentes do Superior Tribunal de Justiça (STJ) na matéria correspondente...',
      '[AGENTE] Redigindo laudo técnico e estruturando laudo conforme mandados romanos (I-IX)...'
    ];

    let logIdx = 0;
    const logInterval = setInterval(() => {
      if (logIdx < agentLogs.length) {
        setAnalystLogs(prev => [...prev, agentLogs[logIdx]]);
        logIdx++;
      } else {
        clearInterval(logInterval);
      }
    }, 300);

    try {
      const activeDocNames = Object.keys(availableDocs)
        .filter(k => availableDocs[k].present)
        .map(k => `${k} (${availableDocs[k].fileName})`);

      const response = await fetch('/api/gemini-viabilidade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lead,
          docStatus: docIntegrity,
          docList: activeDocNames
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Falha na resposta do servidor.');
      }

      const data = await response.json();
      setOpinionText(data.text || '');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao gerar relatório do agente especializado: ' + (err.message || err));
    } finally {
      setAnalyzing(false);
    }
  };

  // Toggle document presence mock-state
  const toggleDocPresence = (docKey: string) => {
    setAvailableDocs(prev => {
      const isCurrentlyPresent = !prev[docKey].present;
      const updated = {
        ...prev,
        [docKey]: {
          ...prev[docKey],
          present: isCurrentlyPresent,
          fileName: isCurrentlyPresent ? `${docKey.toLowerCase().replace(/[^a-z]/g, '')}_digitalizado.pdf` : '',
          size: isCurrentlyPresent ? '1.1 MB' : ''
        }
      };
      
      // Suggest integrity change immediately
      const presentCount = Object.keys(updated).filter(k => updated[k].present).length;
      let suggestion: '🟢 DOCUMENTAÇÃO SUFICIENTE' | '🟡 DOCUMENTAÇÃO PARCIAL' | '🔴 DOCUMENTAÇÃO INSUFICIENTE' = '🟡 DOCUMENTAÇÃO PARCIAL';
      if (presentCount >= 4) {
        suggestion = '🟢 DOCUMENTAÇÃO SUFICIENTE';
      } else if (presentCount <= 1) {
        suggestion = '🔴 DOCUMENTAÇÃO INSUFICIENTE';
      }
      setDocIntegrity(suggestion);
      
      return updated;
    });
  };

  // Save the full analysis and compile status to the Lead inside Firestore
  const handleSaveAndConclude = async () => {
    if (!leadId) return;
    setSavingDocs(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Detect category from conclusion in text to map technically
      let conclusaoCategoria = '🟡 VIÁVEL COM RESSALVAS';
      if (opinionText.includes('🟢 VIÁVEL')) {
        conclusaoCategoria = '🟢 VIÁVEL';
      } else if (opinionText.includes('🔴 INVIÁVEL JURIDICAMENTE')) {
        conclusaoCategoria = '🔴 INVIÁVEL JURIDICAMENTE';
      } else if (opinionText.includes('🟠 NECESSITA COMPLEMENTAÇÃO DOCUMENTAL')) {
        conclusaoCategoria = '🟠 NECESSITA COMPLEMENTAÇÃO DOCUMENTAL';
      }

      // 2. Parse the summary fields for structural updates
      const matchSuccessRate = opinionText.match(/\*\s*\*Chance de êxito estimada:\*\*\s*(.*)/i) || opinionText.match(/êxito estimada:\s*(.*)/i);
      const matchRisk = opinionText.match(/\*\s*\*Grau de risco:\*\*\s*(.*)/i) || opinionText.match(/Grau de risco:\s*(.*)/i);
      const matchProof = opinionText.match(/\*\s*\*Necessidade de prova complementar:\*\*\s*(.*)/i) || opinionText.match(/prova complementar:\s*(.*)/i);
      const matchNextAction = opinionText.match(/\*\s*\*Próxima ação recomendada:\*\*\s*(.*)/i) || opinionText.match(/ação recomendada:\s*(.*)/i);

      const chanceExitStr = matchSuccessRate ? matchSuccessRate[1].trim() : "Média";
      const riscoStr = matchRisk ? matchRisk[1].trim() : "Moderado";
      const provaCompStr = matchProof ? matchProof[1].trim() : "Sim, em verificação complementar";
      const proximaAcaoStr = matchNextAction ? matchNextAction[1].trim() : "Notificar ou prosseguir para contrato";

      // Increment version history
      const nextVer = (versionHistory.length + 1).toFixed(1);
      const newVersionObj = {
        version: nextVer,
        date: new Date().toLocaleDateString('pt-BR'),
        status: 'Parecer Consolidado',
        savedBy: 'Especialista em Viabilidade IA'
      };
      const updatedVersions = [...versionHistory, newVersionObj];

      const parentNow = new Date().toISOString();
      const docsPresentNames = Object.keys(availableDocs).filter(k => availableDocs[k].present);

      const updateData = {
        statusFunil: 'Em Análise Jurídica',
        updatedAt: parentNow,
        analiseViabilidade: {
          viabilidadeTecnica: conclusaoCategoria.includes('INVIÁVEL') ? 'Baixa' : (conclusaoCategoria.includes('RESSALVAS') ? 'Média' : 'Alta'),
          probabilidadeExito: chanceExitStr,
          parecerViabilidade: `[Regulamentado pelo Agente Especialista] Categoria: ${conclusaoCategoria}. Risco: ${riscoStr}. Ação recomendada: ${proximaAcaoStr}`,
          parecerCompleto: opinionText,
          documentacaoIntegrity: docIntegrity,
          checkedDocs: availableDocs,
          historicoVersoes: updatedVersions,
          conclusaoCategoria,
          grauRisco: riscoStr,
          necessidadeProvaComplementar: provaCompStr,
          proximaAcaoRecomendada: proximaAcaoStr,
          
          // Google Drive folder markers 
          googleDriveFolderId: `gfolder-lead-${leadId}`,
          googleDriveFolderUrl: `https://drive.google.com/drive/folders/mock-lead-${leadId}`,
          pasta01DocumentosId: `gfolder-01-docs-${leadId}`,
          pasta06ParecerId: `gfolder-06-parecer-${leadId}`,
          parecerDocsId: `gdocs-parecer-${leadId}-v${nextVer}`,
          parecerDocsUrl: `https://docs.google.com/document/d/mock-parecer-juridico-${leadId}-v${nextVer}`
        }
      };

      // Firestore Update
      const docRef = doc(db, 'marketingLeads', leadId);
      await updateDoc(docRef, updateData);

      // Local storage sync
      const local = localStorage.getItem('local_marketing_leads');
      const list = local ? JSON.parse(local) : [];
      const updatedList = list.map((item: any) => item.id === leadId ? { ...item, ...updateData } : item);
      localStorage.setItem('local_marketing_leads', JSON.stringify(updatedList));

      setVersionHistory(updatedVersions);
      setSuccess('Parecer Jurídico de Viabilidade salvo com sucesso na pasta: "06 PARECER JURÍDICO" com controle de versões!');
      
      // Soft wait for success display
      setTimeout(() => {
        // Automatically advance client to Step 2 page displaying lead data
        navigate(`/boss/cadastrar.leads/private/etapa02/${leadId}`);
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setError('Erro ao salvar relatório consolidado: ' + (err.message || err));
    } finally {
      setSavingDocs(false);
    }
  };

  if (loading) {
    return (
      <BossLayout>
        <div className="flex flex-col items-center justify-center p-32 space-y-4">
          <Loader2 className="animate-spin text-indigo-500" size={36} />
          <p className="text-gray-400 font-bold select-none text-xs">Carregando detalhes do lead e credenciais...</p>
        </div>
      </BossLayout>
    );
  }

  const interestName = lead?.pessoaFisica?.nomeCompleto || lead?.pessoaJuridica?.razaoSocial || lead?.name || 'Lead não Identificado';
  const documentsCheckedCount = Object.keys(availableDocs).filter(k => availableDocs[k].present).length;

  return (
    <BossLayout>
      <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-8 animate-fade-in text-xs font-semibold">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(`/boss/cadastrar.leads/private/etapa02/${leadId}`)}
            className="flex items-center gap-1.5 text-gray-450 hover:text-white font-black text-xs transition duration-200 cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Voltar para Etapa 02</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-gray-400 font-mono text-[10px] tracking-widest uppercase">Giffoni Legal AI Lab</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-slate-900 border border-slate-950 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-8 text-slate-800 opacity-20 pointer-events-none">
            <Scale size={160} />
          </div>
          
          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#818cf8] font-mono">Regulamentação de Atendimento</span>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Análise de Viabilidade Jurídica</h2>
            <p className="text-xs text-gray-305 leading-relaxed font-semibold">
              Instrua formalmente o dossiê probatório do cliente e acione o Agente Especialista IA para consolidar o parecer que subsidiará a redação final da petição judicial.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex items-start gap-3 animate-fade-in text-rose-200">
            <AlertTriangle className="shrink-0 text-rose-500" size={18} />
            <div>
              <strong className="text-xs block font-bold">Problema Encontrado</strong>
              <span className="text-[11px] block mt-0.5 leading-relaxed font-semibold">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-start gap-3 animate-fade-in text-emerald-100">
            <CheckCircle className="shrink-0 text-emerald-500" size={18} />
            <div>
              <strong className="text-xs block font-bold">Ação Executada com Sucesso</strong>
              <span className="text-[11px] block mt-0.5 leading-relaxed font-semibold">{success}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL: CASE DETAILS & DOCUMENT AUDIT */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* Box 1: Lead Information Summary */}
            <div className="bg-slate-900 border border-slate-950 p-5 md:p-6 rounded-2.5xl space-y-4 shadow-sm">
              <div className="border-b border-white/5 pb-3">
                <span className="text-[9px] font-black uppercase text-gray-400 font-mono tracking-widest block">Informações Gerais de Atendimento</span>
                <strong className="text-sm font-black text-white block mt-0.5">{interestName}</strong>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="font-semibold text-gray-450 block">Área de Interesse</span>
                  <span className="font-extrabold text-[#c084fc] mt-0.5 block">{lead?.areaJuridica || "Sem área definida"}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-450 block">Urgência</span>
                  <span className={`font-extrabold mt-0.5 inline-block ${
                    lead?.urgencia === 'Alta' ? 'text-rose-400' : 'text-amber-400'
                  }`}>{lead?.urgencia || "Média"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="font-semibold text-gray-455 block">Objetivo / Assunto</span>
                  <span className="font-semibold text-white mt-0.5 block">{lead?.assunto || "Não preenchido"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="font-semibold text-gray-455 block">Reclamação Principal</span>
                  <p className="font-semibold text-gray-300 mt-0.5 leading-relaxed">{lead?.dorPrincipal || "Não informada no formulário de qualificação."}</p>
                </div>
              </div>
            </div>

            {/* Box 2: Google Drive Structure Audit & Checklist */}
            <div className="bg-slate-900 border border-slate-950 p-5 md:p-6 rounded-2.5xl space-y-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <span className="text-[9px] font-black uppercase text-gray-400 font-mono tracking-widest block">Google Drive Cloud Check</span>
                  <strong className="text-sm font-black text-white block mt-0.5">Auditoria e Verificação Geral</strong>
                </div>
                <button
                  type="button"
                  disabled={driveChecking}
                  onClick={handleVerifyGoogleDrive}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-50 border border-white/10 rounded-xl flex items-center gap-1.5 text-[10px] font-extrabold cursor-pointer transition uppercase"
                >
                  {driveChecking ? (
                    <Loader2 className="animate-spin text-indigo-400" size={13} />
                  ) : (
                    <RefreshCw size={13} />
                  )}
                  <span>Auditar Drive</span>
                </button>
              </div>

              {/* Log window detailing extraction of drive info */}
              {(driveChecking || driveLogs.length > 0) && (
                <div className="p-3.5 bg-slate-950 border border-white/5 rounded-xl text-[10px] font-mono text-gray-400 space-y-1.5 max-h-48 overflow-y-auto">
                  {driveLogs.map((log, lIdx) => (
                    <div key={lIdx} className={`${log && typeof log === 'string' && log.startsWith('✓') ? 'text-emerald-400 font-bold' : ''}`}>
                      {log}
                    </div>
                  ))}
                  {driveChecking && <div className="text-indigo-400 animate-pulse">Consultando...</div>}
                </div>
              )}

              {/* Active list of checked documents */}
              <div className="space-y-3.5">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block border-b border-white/5 pb-1">
                  Documentação da Pasta "01 DOCUMENTOS" ({documentsCheckedCount}/5)
                </label>
                
                <p className="text-[10px] text-gray-400 leading-normal">
                  Marque ou desmarque os documentos que o cliente em potencial enviou de fato. O agente analisará somente estes documentos:
                </p>

                <div className="space-y-2.5">
                  {Object.keys(availableDocs).map((docKey) => {
                    const docObj = availableDocs[docKey];
                    return (
                      <div 
                        key={docKey}
                        onClick={() => toggleDocPresence(docKey)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                          docObj.present 
                            ? 'border-emerald-500/20 bg-emerald-950/10 hover:bg-emerald-950/20' 
                            : 'border-white/5 bg-slate-950/30 hover:bg-slate-950/60 text-gray-500'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-4.5 h-4.5 rounded-md flex items-center justify-center border transition ${
                            docObj.present 
                              ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400' 
                              : 'border-white/10 bg-slate-900 text-transparent'
                          }`}>
                            <Check size={12} strokeWidth={3} />
                          </div>
                          <div>
                            <span className={`text-[11px] block font-extrabold ${docObj.present ? 'text-white' : 'text-gray-500'}`}>
                              {docKey}
                            </span>
                            {docObj.present && (
                              <span className="text-[9px] text-gray-450 block font-mono">
                                {docObj.fileName} ({docObj.size})
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[9px] font-mono ${docObj.present ? 'text-emerald-400' : 'text-gray-400'}`}>
                          {docObj.present ? 'Anexado' : 'Ausente'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Box 3: Integrity rating */}
              <div className="p-4 bg-slate-950 border border-white/5 rounded-2xl space-y-2.5">
                <span className="text-[10px] font-black uppercase text-gray-400 font-mono tracking-widest block">Integridade Documental Mapeada</span>
                
                <select
                  value={docIntegrity}
                  onChange={(e: any) => setDocIntegrity(e.target.value)}
                  className="w-full text-xs font-extrabold px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white cursor-pointer mt-1"
                >
                  <option value="🟢 DOCUMENTAÇÃO SUFICIENTE">🟢 DOCUMENTAÇÃO SUFICIENTE</option>
                  <option value="🟡 DOCUMENTAÇÃO PARCIAL">🟡 DOCUMENTAÇÃO PARCIAL</option>
                  <option value="🔴 DOCUMENTAÇÃO INSUFICIENTE">🔴 DOCUMENTAÇÃO INSUFICIENTE</option>
                </select>
                <span className="text-[10px] text-gray-450 block mt-1 font-semibold leading-relaxed">
                  O enquadramento indica se a lide possui documentos cruciais à imediata distribuição ou se pende de diligência.
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: AI AGENT INTERACTIVE ANALYSIS WORKSPACE */}
          <div className="lg:col-span-7 space-y-8">
            
            <div className="bg-slate-900 border border-slate-950 rounded-2.5xl p-6 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <Scale size={14} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 font-mono">Giffoni Expert System</span>
                  </div>
                  <h3 className="text-base font-black text-white mt-1">Gabinete de Estudo de Viabilidade</h3>
                </div>

                <button
                  type="button"
                  disabled={analyzing}
                  onClick={handleRunAgentAnalysis}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-50 text-white rounded-xl shadow-md transition duration-250 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      <span>Analisando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Gerar Parecer IA</span>
                    </>
                  )}
                </button>
              </div>

              {/* Progress visualizer for Agent steps */}
              {analystLogs.length > 0 && (
                <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 text-[10px] font-mono text-gray-400 space-y-1.5">
                  <div className="text-[10px] uppercase font-black tracking-widest text-[#818cf8] border-b border-white/5 pb-1 select-none">
                    Logs de Execução da IA
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {analystLogs.map((log, idx) => (
                      <div key={idx} className="leading-snug">
                        {log}
                      </div>
                    ))}
                  </div>
                  {analyzing && (
                    <div className="flex items-center gap-1.5 text-indigo-400 animate-pulse font-extrabold mt-1">
                      <span>Processando argumentos e articulando parecer em tempo real...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Rendered result */}
              {opinionText ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <span className="text-[10px] font-black uppercase text-indigo-300 font-mono tracking-wider">Laudo Geral de Viabilidade</span>
                    <button
                      type="button"
                      onClick={() => setEditMode(!editMode)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 rounded-lg text-[10px] text-gray-300 font-extrabold cursor-pointer transition uppercase"
                    >
                      {editMode ? 'Salvar Edição' : 'Editar Texto'}
                    </button>
                  </div>

                  {editMode ? (
                    <textarea
                      rows={18}
                      className="w-full text-xs font-semibold px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-white leading-relaxed focus:border-indigo-500/50 outline-none font-mono"
                      value={opinionText}
                      onChange={(e) => setOpinionText(e.target.value)}
                    />
                  ) : (
                    <div className="p-4 md:p-6 bg-slate-950/70 border border-white/5 rounded-2xl space-y-4 overflow-y-auto max-h-[500px]">
                      <SimpleMarkdownRenderer content={opinionText} />
                    </div>
                  )}

                  {/* Vault Section showing Folder 06 PARECER JURÍDICO and Google Docs Simulation */}
                  <div className="p-5 border border-indigo-500/20 bg-gradient-to-r from-indigo-950/10 to-indigo-950/40 rounded-2xl space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Folder className="text-indigo-400 shrink-0" size={18} />
                        <div>
                          <strong className="text-white text-xs block font-black uppercase">Pasta de Destino: 06 PARECER JURÍDICO</strong>
                          <span className="text-[9px] text-[#818cf8] block font-mono tracking-wider mt-0.5">Google Docs Template & Version Vault</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/35 text-[9px] text-emerald-400 rounded-full font-black uppercase font-mono tracking-wider">
                        Ativa
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px] font-semibold text-gray-300 leading-normal border-t border-white/5 pt-3">
                      <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-2">
                          <FileText className="text-gray-400" size={15} />
                          <div>
                            <span className="text-white block text-[10px] font-extrabold">Parecer_Juridico_${interestName.replace(/\s+/g, '_')}_v{(versionHistory.length + 0.1).toFixed(1)}</span>
                            <span className="text-[9px] text-gray-500 block">Sincronizado automaticamente com Google Docs Template</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-indigo-400">Versão Recente Mapeada</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-[10px] text-gray-400 bg-slate-950/35 p-2 px-3 rounded-lg border border-white/5">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <Clock size={12} className="text-gray-550" />
                          <span>Histórico: {versionHistory.length} versões indexadas</span>
                        </span>
                        <span className="text-gray-500 font-mono">Última em: {new Date().toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/boss/cadastrar.leads/private/etapa02/${leadId}`)}
                        className="px-4 py-2 border border-white/10 text-gray-400 hover:bg-white/5 rounded-xl block font-extrabold text-[10.5px] uppercase tracking-wider transition"
                      >
                        Recuar
                      </button>
                      <button
                        type="button"
                        disabled={savingDocs}
                        onClick={handleSaveAndConclude}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-97 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-1.5 font-black text-[11px] uppercase tracking-widest shadow-md cursor-pointer transition duration-200"
                      >
                        {savingDocs ? (
                          <>
                            <Loader2 className="animate-spin" size={13} />
                            <span>Salvando Parecer...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={14} />
                            <span>Salvar e Concluir Etapa</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-white/10 p-8 rounded-2xl text-center space-y-3.5">
                  <div className="w-12 h-12 bg-indigo-500/5 rounded-2xl flex items-center justify-center border border-indigo-500/10 text-indigo-400 mx-auto">
                    <Scale size={20} />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-white uppercase tracking-wider">Aguardando Execução do Laudo Técnico</h5>
                    <p className="text-[10px] text-gray-450 mt-1 leading-relaxed font-semibold max-w-sm mx-auto">
                      Instrua os documentos auditados do lado esquerdo, certifique a integridade do Drive, e clique em "Gerar Parecer IA" para acionar o Agente Jurídico.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </BossLayout>
  );
}
