import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  Scale, 
  Milestone, 
  HelpCircle, 
  ChevronRight, 
  Trash2, 
  Plus, 
  FileText, 
  Check, 
  AlertCircle, 
  ExternalLink,
  Sparkles,
  Clipboard,
  Layers,
  Copy,
  FileCheck2,
  Loader2,
  X,
  FileSpreadsheet
} from 'lucide-react';

interface AdicionalParte {
  id: string;
  papel: string; // 'Requerido/Réu' | 'Co-autor' | 'Terceiro' | 'Outro'
  tipo: 'PF' | 'PJ';
  nome: string;
  docValue: string;
  qualificacao: string;
}

interface EstruturacaoStepProps {
  caseId: string;
  onNext: () => void;
  onSetLoading: (loading: boolean) => void;
  onAlert: (msg: string) => void;
}

const LEGO_PRESET_BLOCKS = [
  {
    id: 'justica_gratuita',
    category: 'Gerais / Custas',
    title: 'Justiça Gratuita (Pessoa Física)',
    text: 'Requer a concessão dos benefícios da gratuidade jurídica integral, com fulcro nos artigos 98 e seguintes do novel Código de Processo Civil, c/c o art. 5º, inciso LXXIV, de nossa Carta Magna, haja vista que a parte Autora não dispõe de margem de liquidez para solver as custas procedimentais sem detrimento irrecuperável do sustento familiar mínimo.',
  },
  {
    id: 'inversao_onus',
    category: 'Relação Consumo',
    title: 'Inversão do Ônus da Prova (Art. 6º, VIII CDC)',
    text: 'Ante a notória assimetria técnica, fática e informacional imperante entre as partes no mercado de consumo, requer-se o deferimento da facilitação de defesa dos direitos do consumidor, operando-se a inversão do ônus da prova de acordo com as balizas protetivas descritas no artigo 6º, inciso VIII, do CDC.',
  },
  {
    id: 'falha_servico',
    category: 'Relação Consumo',
    title: 'Falha na Prestação de Serviço (Art. 14 CDC)',
    text: 'Reconhece o microssistema consumerista a responsabilidade civil objetiva do prestador de fornecimento, bastando a constatação do nexo causal e do dano decorrente do defeito do serviço ou vício de adequação, nos termos do art. 14 da Lei nº 8.078/90, arredando-se qualquer necessidade de comprovação de elemento subjetivo de culpa.',
  },
  {
    id: 'dano_moral_in_re_ipsa',
    category: 'Responsabilidade Civil',
    title: 'Dano Moral Presumido (In re ipsa)',
    text: 'O prejuízo imaterial sob comento perfaz autêntico dano extrapatrimonial in re ipsa, dispensando demonstração empírica de sofrimento anímico profundo, na exata medida em que a ofensa decorre inelutavelmente da gravidade objetiva do próprio ato ilícito e do descaso recalcitrante perpetrado pela demandada.',
  },
  {
    id: 'repeticao_indebito',
    category: 'Responsabilidade Civil',
    title: 'Repetição de Indébito em Dobro (CDC)',
    text: 'Incide na espécie o dever de penalização mediante a devolução em dobro dos importes monetários indevidamente faturados e desembolsados, na forma do art. 42, parágrafo único, do CDC, porquanto inexistente justificação razoável ou erro escusável apto a convalidar a cobrança ilegal em desfavor da consumidora.',
  },
  {
    id: 'tutela_urgencia',
    category: 'Pretensão Liminar',
    title: 'Tutela Fustigada de Urgência (Art. 300 CPC)',
    text: 'Presentes o fumus boni iuris — consubstanciado na robusta documentação carreada — e o periculum in mora — traduzido no risco iminente de prejuízo de difícil ou impossível reparação —, pugna-se pela concessão da tutela provisória de urgência de natureza antecipada, inaudita altera parte, fundado no art. 300 do CPC.',
  }
];

export default function EstruturacaoStep({ caseId, onNext, onSetLoading, onAlert }: EstruturacaoStepProps) {
  const [strategy, setStrategy] = useState({
    fatosFundamentos: '',
    estrategiaJuridica: '',
    competenciaJurisdicional: ''
  });

  // Docs Generation & Status
  const [docsStatus, setDocsStatus] = useState({
    status: 'não_gerado', // 'não_gerado', 'gerando', 'criada', 'falha'
    url: '',
    logFalha: ''
  });

  // Client Qualification
  const [clientData, setClientData] = useState<any>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  // Formatted comparative view state
  const [activeTab, setActiveTab] = useState<'pure' | 'gemini'>('pure');
  const [geminiText, setGeminiText] = useState('');
  const [isFormatting, setIsFormatting] = useState(false);

  // Litigants dynamic parts
  const [partes, setPartes] = useState<AdicionalParte[]>([]);
  const [showAddParteForm, setShowAddParteForm] = useState(false);
  const [novaParte, setNovaParte] = useState<Partial<AdicionalParte>>({
    papel: 'Requerido/Réu',
    tipo: 'PF',
    nome: '',
    docValue: '',
    qualificacao: ''
  });

  // Lego Blocks Selected
  const [selectedLegoIds, setSelectedLegoIds] = useState<string[]>([]);
  const [legoOutline, setLegoOutline] = useState('');

  // General Action State
  const [isSaving, setIsSaving] = useState(false);
  const [showFeedback, setShowFeedback] = useState<string | null>(null);

  useEffect(() => {
    async function loadStrategy() {
      onSetLoading(true);
      try {
        const caseDoc = await getDoc(doc(db, 'cases', caseId));
        if (caseDoc.exists()) {
          const data = caseDoc.data();
          setStrategy({
            fatosFundamentos: data.fatosFundamentos || '',
            estrategiaJuridica: data.estrategiaJuridica || '',
            competenciaJurisdicional: data.competenciaJurisdicional || ''
          });

          // Google Docs Integration values
          setDocsStatus({
            status: data.relatorioEstruturacaoStatus || 'não_gerado',
            url: data.relatorioEstruturacaoGoogleDocsUrl || '',
            logFalha: data.relatorioEstruturacaoLogFalha || ''
          });

          // Gemini analytical preview and parts
          setGeminiText(data.geminiFormattedText || '');
          setPartes(data.partesAdicionais || []);

          if (data.clientId) {
            setLoadingClient(true);
            const clientDoc = await getDoc(doc(db, 'clients', data.clientId));
            if (clientDoc.exists()) {
              setClientData(clientDoc.data());
            } else {
              // try other fallback
              const fallbackDoc = await getDoc(doc(db, 'clientes', data.clientId));
              if (fallbackDoc.exists()) {
                setClientData(fallbackDoc.data());
              }
            }
            setLoadingClient(false);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        onSetLoading(false);
      }
    }
    loadStrategy();
  }, [caseId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStrategy(prev => ({ ...prev, [name]: value }));
  };

  const getQualificationText = () => {
    if (!clientData) {
      if (loadingClient) return "Consultando dados cadastrais do cliente de forma automática...";
      return "Qualificação indisponível (cadastre o cliente na Etapa 02).";
    }

    const isPf = clientData.type === 'PF' || clientData.tipoPessoa === 'PF' || !clientData.type;
    
    if (isPf) {
      const nome = clientData.pf_nomeCompleto || clientData.nome || clientData.name || '[NOME COMPLETO]';
      const nacionalidade = clientData.pf_nacionalidade || 'brasileira';
      const estadoCivil = clientData.pf_estadoCivil || '[ESTADO CIVIL]';
      const profissao = clientData.pf_profissao || '[PROFISSÃO]';
      const rg = clientData.pf_rg || '[RG]';
      const cpf = clientData.pf_cpf || clientData.cpf || clientData.cpfCnpj || '[CPF]';
      
      const enderecoCompleto = [
        clientData.pf_endereco || clientData.pf_enderecoCompleto || clientData.endereco || clientData.address,
        clientData.pf_bairro,
        clientData.pf_cidade,
        clientData.pf_estado,
        clientData.pf_cep ? `CEP ${clientData.pf_cep}` : ''
      ].filter(Boolean).join(', ') || '[ENDEREÇO RESIDENCIAL COMPLETO]';

      return `${nome.toUpperCase()}, ${nacionalidade.toLowerCase()}, ${estadoCivil.toLowerCase()}, ${profissao.toLowerCase()}, portador(a) do RG nº ${rg} e inscrito(a) no CPF/MF sob o nº ${cpf}, residente e domiciliado(a) em ${enderecoCompleto}.`;
    } else {
      const razao = clientData.pj_razaoSocial || clientData.nome || clientData.name || '[RAZÃO SOCIAL DA EMPRESA]';
      const cnpj = clientData.pj_cnpj || clientData.cnpj || clientData.cpfCnpj || '[CNPJ/MF]';
      
      const enderecoEmpresa = [
        clientData.pj_enderecoEmpresa || clientData.pj_endereco || clientData.endereco || clientData.address,
        clientData.pj_bairroEmpresa,
        clientData.pj_cidadeEmpresa,
        clientData.pj_estadoEmpresa,
        clientData.pj_cepEmpresa ? `CEP ${clientData.pj_cepEmpresa}` : ''
      ].filter(Boolean).join(', ') || '[ENDEREÇO EMPRESARIAL COMPLETO]';

      const socioNome = clientData.pj_nomeSocioCompleto || clientData.socio_nomeCompleto || '[SÓCIO ADMINISTRADOR]';
      const socioNacio = clientData.socio_nacionalidade || 'brasileiro(a)';
      const socioEc = clientData.socio_estadoCivil || '[ESTADO CIVIL]';
      const socioProf = clientData.socio_profissao || '[PROFISSÃO]';
      const socioRg = clientData.socio_rg || '[RG DO REPRESENTANTE]';
      const socioCpf = clientData.socio_cpf || '[CPF DO REPRESENTANTE]';

      return `${razao.toUpperCase()}, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº ${cnpj}, com sede em ${enderecoEmpresa}, neste ato devidamente representada por seu sócio-administrador ${socioNome.toUpperCase()}, ${socioNacio.toLowerCase()}, ${socioEc.toLowerCase()}, ${socioProf.toLowerCase()}, associado ao RG nº ${socioRg} e inscrito no CPF/MF sob o nº ${socioCpf}.`;
    }
  };

  // Google docs integration executor
  const runGoogleDocsGeneration = async (simulatedStatus?: 'criada' | 'falha') => {
    setDocsStatus(prev => ({ ...prev, status: 'gerando', logFalha: '' }));
    
    // Simulating process wait time
    await new Promise(resolve => setTimeout(resolve, 1500));

    const finalStatus = simulatedStatus || 'criada';
    const mockUrl = `https://docs.google.com/document/d/mock-estruturacao-${caseId}`;
    
    const targetStatus = {
      status: finalStatus,
      url: finalStatus === 'criada' ? mockUrl : '',
      logFalha: finalStatus === 'falha' ? 'Erro de cota na transição da API do Google Workspace docs' : ''
    };

    setDocsStatus(targetStatus);

    try {
      await updateDoc(doc(db, 'cases', caseId), {
        relatorioEstruturacaoStatus: targetStatus.status,
        relatorioEstruturacaoGoogleDocsUrl: targetStatus.url,
        relatorioEstruturacaoLogFalha: targetStatus.logFalha
      });
      onAlert(finalStatus === 'criada' 
        ? 'Relatório de Estruturação sincronizado no Google Docs!' 
        : 'Interrupção detectada na automação do Relatório.'
      );
    } catch (e) {
      console.error(e);
    }
  };

  // Gemini Formatter using API
  const handleGeminiFormat = async () => {
    setIsFormatting(true);
    setActiveTab('gemini');
    try {
      const response = await fetch('/api/gemini-format', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fatosFundamentos: strategy.fatosFundamentos,
          estrategiaJuridica: strategy.estrategiaJuridica,
          competenciaJurisdicional: strategy.competenciaJurisdicional
        })
      });

      if (!response.ok) throw new Error('Falha de resposta do servidor.');
      const data = await response.json();
      setGeminiText(data.text);
      onAlert('Análise estrutural processada com sucesso pelo Gemini!');
    } catch (e: any) {
      console.error("Gemini failed, using offline parsing.");
      // Fallback
      setGeminiText(
        `### Estudo Consolidado por Inteligência Artificial (Gemini)\n\n*(Chave indisponível - Relatório formatado em conformidade)*\n\n- **Fatos Principais:** ${strategy.fatosFundamentos || "Não fornecido."}\n- **Estratégia Processual Estrita:** ${strategy.estrategiaJuridica || "Sem notas."}\n- **Foro Preventivo:** ${strategy.competenciaJurisdicional || "Sob determinação territorial."}`
      );
    } finally {
      setIsFormatting(false);
    }
  };

  // Add Partes Adicionais
  const handleAddParte = async () => {
    if (!novaParte.nome || !novaParte.docValue) {
      onAlert("Preencha ao menos o nome e o número de CPF/CNPJ para a parte adicional.");
      return;
    }

    const defaultQual = novaParte.tipo === 'PF' 
      ? `${novaParte.nome?.toUpperCase()}, de nacionalidade desconhecida, inscrito sob CPF nº ${novaParte.docValue}, qualificação complementar sob apuração.`
      : `${novaParte.nome?.toUpperCase()}, pessoa jurídica inscrita no CNPJ sob o nº ${novaParte.docValue}, qualificação complementar sob apuração.`;

    const fullParte: AdicionalParte = {
      id: `parte-${Date.now()}`,
      papel: novaParte.papel || 'Requerido/Réu',
      tipo: novaParte.tipo || 'PF',
      nome: novaParte.nome,
      docValue: novaParte.docValue,
      qualificacao: novaParte.qualificacao || defaultQual
    };

    const updatedPartes = [...partes, fullParte];
    setPartes(updatedPartes);
    
    // reset form
    setNovaParte({
      papel: 'Requerido/Réu',
      tipo: 'PF',
      nome: '',
      docValue: '',
      qualificacao: ''
    });
    setShowAddParteForm(false);
    onAlert("Nova parte litigante vinculada ao caso!");
  };

  const handleDeleteParte = (id: string) => {
    const updated = partes.filter(p => p.id !== id);
    setPartes(updated);
    onAlert("Parte litigante desvinculada.");
  };

  // Lego block assembler
  const handleLegoToggle = (block: typeof LEGO_PRESET_BLOCKS[0]) => {
    let nextIds;
    if (selectedLegoIds.includes(block.id)) {
      nextIds = selectedLegoIds.filter(x => x !== block.id);
    } else {
      nextIds = [...selectedLegoIds, block.id];
    }
    setSelectedLegoIds(nextIds);

    // Build the consolidated text
    const consolidatedText = LEGO_PRESET_BLOCKS
      .filter(b => nextIds.includes(b.id))
      .map(b => `[${b.title.toUpperCase()}]\n${b.text}`)
      .join('\n\n');
    
    setLegoOutline(consolidatedText);
  };

  const handleCopyLegoDraft = () => {
    navigator.clipboard.writeText(legoOutline);
    onAlert("Blocos copiados à área de transferência para colagem rápida!");
  };

  const handleInsertLegoToStrategy = () => {
    if (!legoOutline) return;
    setStrategy(prev => ({
      ...prev,
      estrategiaJuridica: prev.estrategiaJuridica 
        ? `${prev.estrategiaJuridica}\n\n${legoOutline}`
        : legoOutline
    }));
    onAlert("Blocos inseridos na Estratégia Processual!");
  };

  // Confirm progress
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'cases', caseId), {
        ...strategy,
        partesAdicionais: partes,
        geminiFormattedText: geminiText,
        updatedStage: 'estruturacao',
        productionStage: 'delegacao',
        updatedAt: serverTimestamp()
      });
      onAlert('Análise estrutural processada com êxito! Avançando à etapa de Delegação.');
      onNext();
    } catch (err: any) {
      console.error(err);
      onAlert('Falha na persistência dos dados: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Custom markdown renderer inside Card 05
  const renderMarkdown = (mdText: string) => {
    if (!mdText) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Sparkles className="text-gray-300 animate-bounce mb-2" size={28} />
          <span className="text-xs text-gray-500 font-semibold italic text-center">
            Clique no botão abaixo para submeter a estruturação humana ao crivo analítico da Inteligência Artificial do Gemini.
          </span>
        </div>
      );
    }
    
    return mdText.split('\n').map((line, idx) => {
      let trimmed = line.trim();
      
      if (trimmed.startsWith('### ')) {
        return <h3 key={idx} className="text-xs font-black text-slate-800 mt-4 mb-2 uppercase tracking-widest">{trimmed.substring(4)}</h3>;
      }
      if (trimmed.startsWith('#### ')) {
        return <h4 key={idx} className="text-xs font-bold text-blue-900 mt-3 mb-1 uppercase tracking-wider">{trimmed.substring(5)}</h4>;
      }
      if (trimmed.startsWith('## ')) {
        return <h2 key={idx} className="text-sm font-black text-blue-950 mt-5 mb-2 border-b pb-1 flex items-center gap-2"><Scale size={13} /> {trimmed.substring(3)}</h2>;
      }
      if (trimmed.startsWith('> ')) {
        return (
          <div key={idx} className="pl-3 border-l-4 border-slate-300 text-gray-500 italic my-2 bg-gray-50 p-2 rounded-r-lg text-[11px] font-medium leading-relaxed">
            {trimmed.substring(2)}
          </div>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-gray-650 my-1 py-0.5 leading-relaxed font-sans">
            {trimmed.substring(2)}
          </li>
        );
      }
      if (trimmed === '') {
        return <div key={idx} className="h-2" />;
      }
      return (
        <p key={idx} className="text-xs text-gray-650 leading-relaxed my-1 font-medium font-sans">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md border border-slate-850 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Scale size={24} className="text-blue-400 animate-pulse" />
            <h2 className="text-lg font-black uppercase tracking-wider">Etapa 08: EDRP — Estruturação do Caso</h2>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Modelagem jurídica processual, análise automática de qualificação das partes litigantes e polimento por IA.
          </p>
        </div>
        <div className="text-[10px] bg-blue-500/10 border border-blue-400/25 text-blue-300 px-3 py-1.5 rounded-full font-mono font-bold">
          Caso ID: #{caseId.substring(0, 8)}...
        </div>
      </div>

      {/* CARD 01: AUTOMAÇÃO GOOGLE DOCS (INTEGRAÇÃO RELATÓRIO DE ESTRUTURAÇÃO) */}
      <div className="bg-white rounded-3xl p-6 border border-gray-150 shadow-sm space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-mono">
              Card 01
            </span>
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mt-1">
              <FileText size={16} className="text-indigo-600" /> Automação de Relatório de Estruturação (Google Docs)
            </h3>
            <p className="text-[11px] text-gray-500 font-medium">
              Sincronização imediata das teses formadas com os servidores do Google Workspace GDocs em nuvem.
            </p>
          </div>

          {/* BADGE DE STATUS */}
          <div>
            {docsStatus.status === 'não_gerado' && (
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full uppercase">
                Aguardando Geração
              </span>
            )}
            {docsStatus.status === 'gerando' && (
              <span className="text-[10px] font-bold bg-indigo-500 text-white px-2.5 py-1 rounded-full uppercase flex items-center gap-1.5 animate-pulse">
                <Loader2 size={10} className="animate-spin" /> Conectando API...
              </span>
            )}
            {docsStatus.status === 'criada' && (
              <span className="text-[10px] font-bold bg-emerald-500 text-white px-2.5 py-1 rounded-full uppercase flex items-center gap-1">
                <Check size={11} /> Minuta Ativa (Google Docs)
              </span>
            )}
            {docsStatus.status === 'falha' && (
              <span className="text-[10px] font-bold bg-rose-500 text-white px-2.5 py-1 rounded-full uppercase">
                Interrupção Sincronismo
              </span>
            )}
          </div>
        </div>

        {/* LOG DE FALHA SE CONFIGURADO */}
        {docsStatus.status === 'falha' && docsStatus.logFalha && (
          <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-[11px] text-rose-700 font-semibold space-y-1">
            <div className="flex items-center gap-1.5 font-bold uppercase"><AlertCircle size={13} /> Log de Erro na Comunicação GCP:</div>
            <p className="font-mono text-[10px] bg-white/60 p-2 rounded-lg border border-rose-200/50">{docsStatus.logFalha}</p>
          </div>
        )}

        {/* BOTOES DE INTEGRACAO E SIMULACAO */}
        <div className="bg-gray-50 p-4 rounded-2xl flex flex-col sm:flex-row gap-2 justify-between items-center">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => runGoogleDocsGeneration()}
              disabled={docsStatus.status === 'gerando'}
              className="bg-slate-900 border border-slate-800 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet size={13} className="text-yellow-400" />
              <span>Gerar Relatório de Estruturação</span>
            </button>
            {docsStatus.status === 'criada' && docsStatus.url && (
              <a
                href={docsStatus.url}
                target="_blank"
                rel="no-referrer"
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-750 font-bold text-xs px-4 py-2 rounded-xl border border-indigo-150 inline-flex items-center gap-1 transition-all"
              >
                <span>Acessar GDocs</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => runGoogleDocsGeneration('criada')}
              disabled={docsStatus.status === 'gerando'}
              className="text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg border border-emerald-250 bg-emerald-50 text-emerald-8sm hover:bg-emerald-100 transition-all cursor-pointer"
            >
              Simular Sucesso
            </button>
            <button
              type="button"
              onClick={() => runGoogleDocsGeneration('falha')}
              disabled={docsStatus.status === 'gerando'}
              className="text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg border border-rose-250 bg-rose-50 text-rose-8sm hover:bg-rose-100 transition-all cursor-pointer"
            >
              Simular Falha
            </button>
          </div>
        </div>
      </div>

      {/* CARD 02: PURE HUMAN STRUCTURE INPUT */}
      <div className="bg-white rounded-3xl p-6 border border-gray-150 shadow-sm space-y-4">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase bg-violet-50 border border-violet-100 text-violet-750 px-2.5 py-1 rounded-full font-mono">
            Card 02
          </span>
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mt-1">
            <Layers size={16} className="text-violet-600" /> Fundamentos Fáticos & Premissas de Direito
          </h3>
          <p className="text-[11px] text-gray-500 font-medium">
            Redija as narrativas básicas dos fatos informados e trace as principais leis ordinárias que embasam o direito violado.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fatos Narrados e Legislação do Caso</label>
          <textarea
            name="fatosFundamentos"
            rows={5}
            value={strategy.fatosFundamentos}
            onChange={handleChange}
            placeholder="Exemplo de descrição fática das faturas indevidas, defeitos reclamados ou inadimplemento contratual constatado..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl outline-none text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all leading-relaxed"
          />
          <div className="flex justify-end text-[9px] font-mono font-bold text-gray-400">
            {strategy.fatosFundamentos.length} caracteres digitados
          </div>
        </div>
      </div>

      {/* CARD 03_D QUALIFICAÇÃO DA AUTORA AUTOMATIZADA E NOVAS PARTES */}
      <div className="bg-white rounded-3xl p-6 border border-gray-150 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase bg-sky-50 border border-sky-100 text-sky-750 px-2.5 py-1 rounded-full font-mono">
              Card 03
            </span>
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mt-1">
              <Clipboard size={16} className="text-sky-600" /> Estudo de Qualificação & Partes Adicionais
            </h3>
            <p className="text-[11px] text-gray-500 font-medium font-sans">
              Visualização automática da autora conforme placeholders dinâmicos (PF ou PJ) e cadastro de outros réus/recorrentes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddParteForm(!showAddParteForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs"
          >
            <Plus size={14} />
            <span>Adicionar Parte</span>
          </button>
        </div>

        {/* MOCK/PULLED AUTORA QUALIFICATION VIEW */}
        <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-blue-900 uppercase tracking-wide flex items-center gap-1.5 bg-blue-50/75 border border-blue-105 px-2.5 py-1 rounded-lg">
              <FileCheck2 size={13} className="text-blue-600" /> Autora Principal (Qualificação Automática)
            </span>
            <span className="text-[9px] font-mono font-black uppercase text-gray-400 tracking-wider">
              Tipo: {clientData?.type || clientData?.tipoPessoa || "PF"}
            </span>
          </div>

          <p className="text-[11.5px] text-gray-700 font-medium leading-relaxed bg-white border border-gray-150 p-3.5 rounded-xl selection:bg-blue-100 select-text">
            {getQualificationText()}
          </p>
        </div>

        {/* ADD PARTES FORM SLIDE DOWN */}
        {showAddParteForm && (
          <div className="p-5 bg-blue-50/40 border border-blue-100 rounded-2xl space-y-4 animate-in slide-in-from-top duration-300">
            <div className="flex justify-between items-center border-b border-blue-100/50 pb-2">
              <span className="text-xs font-black text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                ✦ Formulário de Vinculação de Litigante Adicional
              </span>
              <button 
                type="button" 
                onClick={() => setShowAddParteForm(false)}
                className="text-gray-400 hover:text-gray-650"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Papel Processual</label>
                <select
                  value={novaParte.papel}
                  onChange={(e) => setNovaParte(prev => ({ ...prev, papel: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold"
                >
                  <option value="Requerido/Réu">Requerido/Réu</option>
                  <option value="Co-autor">Co-autor</option>
                  <option value="Terceiro Interessado">Terceiro Interessado</option>
                  <option value="Cônjuge">Cônjuge Anuente</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo Pessoa</label>
                <select
                  value={novaParte.tipo}
                  onChange={(e) => setNovaParte(prev => ({ ...prev, tipo: e.target.value as 'PF' | 'PJ' }))}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold"
                >
                  <option value="PF">Pessoa Física (PF)</option>
                  <option value="PJ">Pessoa Jurídica (PJ)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">CPF ou CNPJ</label>
                <input
                  type="text"
                  value={novaParte.docValue}
                  onChange={(e) => setNovaParte(prev => ({ ...prev, docValue: e.target.value }))}
                  placeholder={novaParte.tipo === 'PF' ? '123.456.789-00' : '12.345.678/0001-90'}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none text-xs font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 col-span-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nome Completo / Razão Social</label>
                <input
                  type="text"
                  value={novaParte.nome}
                  onChange={(e) => setNovaParte(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome por extenso ou denominação societária..."
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none text-xs font-medium"
                />
              </div>

              <div className="space-y-1 col-span-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Qualificação Livre (Opcional)</label>
                <input
                  type="text"
                  value={novaParte.qualificacao}
                  onChange={(e) => setNovaParte(prev => ({ ...prev, qualificacao: e.target.value }))}
                  placeholder="Se deixada vazia, geraremos o padrão automático..."
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddParteForm(false)}
                className="bg-transparent text-gray-500 text-xs font-bold px-4 py-2 hover:bg-gray-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddParte}
                className="bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2 rounded-xl"
              >
                Vincular Litigante
              </button>
            </div>
          </div>
        )}

        {/* LIST OF CURRENT ADDITIONAL PARTES */}
        {partes.length > 0 ? (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wide block">Outras Partes Cadastradas ({partes.length})</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {partes.map((p) => (
                <div key={p.id} className="bg-white border border-gray-150 p-3.5 rounded-2xl relative shadow-3xs hover:border-blue-200 transition-all space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                      Litigante: {p.papel}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteParte(p.id)}
                      className="text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Deletar parte litigante"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="text-xs font-bold text-gray-900">{p.nome}</div>
                  <div className="text-[9px] font-mono text-gray-400">Documento: {p.docValue}</div>
                  <div className="text-[10px] text-gray-550 leading-relaxed italic bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                    {p.qualificacao}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-gray-400 italic font-medium">Nenhum litigante passivo/ativo adicional adicionado ainda.</div>
        )}
      </div>

      {/* CARD 04: JURISDIÇÃO E COMPETENCIA */}
      <div className="bg-white rounded-3xl p-6 border border-gray-150 shadow-sm space-y-4">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase bg-amber-50 border border-amber-100 text-amber-750 px-2.5 py-1 rounded-full font-mono">
            Card 04
          </span>
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mt-1">
            <Milestone size={16} className="text-amber-600" /> Jurisdição e Critérios de Fixação de Competência
          </h3>
          <p className="text-[11px] text-gray-500 font-medium font-sans">
            Especifique as justificativas territoriais constitutivas de foro competente, prevenção e juízos adequados à inicial.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estudo de Competência Jurisdicional</label>
          <textarea
            name="competenciaJurisdicional"
            rows={3}
            value={strategy.competenciaJurisdicional}
            onChange={handleChange}
            placeholder="Exemplo: Domicílio do consumidor (Artigo 101, I, CDC) c/c Foro preventivo em razão de ações preparatórias..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl outline-none text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-100 focus:border-amber-450 transition-all leading-relaxed"
          />
          <div className="flex justify-end text-[9px] font-mono font-bold text-gray-400">
            {strategy.competenciaJurisdicional.length} caracteres digitados
          </div>
        </div>
      </div>

      {/* CARD 05: APRESENTAÇÃO COMPARATIVA DA IDEIA EM DUAS FORMAS (RAW VS GEMINI FORMATTED) */}
      <div className="bg-white rounded-3xl p-6 border border-gray-150 shadow-sm space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase bg-emerald-50 border border-emerald-100 text-emerald-750 px-2.5 py-1 rounded-full font-mono">
                Card 05
              </span>
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mt-1">
                <Sparkles size={16} className="text-emerald-600" /> Auditória e Modelagem Técnica por IA (Humano vs. Gemini)
              </h3>
              <p className="text-[11px] text-gray-500 font-medium font-sans">
                Confira em duas visões: o texto rascunhado por humanos versus a lapidação analítica com fundamentação técnica gerada pelo Gemini.
              </p>
            </div>
          </div>
        </div>

        {/* TABS SELECTOR CONTAINER */}
        <div className="flex border-b border-gray-150">
          <button
            type="button"
            onClick={() => setActiveTab('pure')}
            className={`px-4 py-2.5 font-bold text-xs transition-all relative cursor-pointer ${
              activeTab === 'pure' 
                ? 'text-gray-900 border-b-2 border-slate-900 font-black' 
                : 'text-gray-400 hover:text-gray-650'
            }`}
          >
            📋 Primeiro: Estruturação Humana Pura
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gemini')}
            className={`px-4 py-2.5 font-bold text-xs transition-all relative cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'gemini' 
                ? 'text-emerald-700 border-b-2 border-emerald-500 font-black' 
                : 'text-gray-400 hover:text-gray-650'
            }`}
          >
            ✦ Segundo: Formatado pelo Gemini AI
          </button>
        </div>

        {/* CONTAINER DISPLAY FOR CHOSEN TAB */}
        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 min-h-[160px] select-text">
          {activeTab === 'pure' ? (
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rascunho Bruto Fatos & Direito (Operador Humano):</div>
                <div className="text-[11.5px] text-gray-700 font-medium leading-relaxed font-sans whitespace-pre-wrap bg-white p-3.5 rounded-xl border border-gray-150/50">
                  {strategy.fatosFundamentos || "Fatos em branco."}
                </div>
              </div>
              <div className="space-y-1.5 pt-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rascunho de Jurisdição Territorial:</div>
                <div className="text-[11.5px] text-gray-700 font-medium leading-relaxed font-sans whitespace-pre-wrap bg-white p-3.5 rounded-xl border border-gray-150/50">
                  {strategy.competenciaJurisdicional || "Competência jurisdicional em branco."}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 prose max-w-none bg-white p-5 rounded-2xl border border-gray-150/70 shadow-3xs">
              {isFormatting ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <Loader2 className="text-emerald-550 animate-spin" size={26} />
                  <div className="text-center space-y-1 text-xs">
                    <span className="font-bold text-gray-800 uppercase animate-pulse block">Mapeando fundamentos jurídicos...</span>
                    <span className="text-gray-400 font-mono text-[9px] block">Acessando API Gemini LLM Giffoni Engine</span>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] font-medium leading-relaxed text-gray-800">
                  {renderMarkdown(geminiText)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI GEN TRIGGER ACTION */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleGeminiFormat}
            disabled={isFormatting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs disabled:opacity-50"
          >
            <Sparkles size={13} className="text-yellow-300 animate-pulse" />
            <span>{geminiText ? '✦ Refinar Formatação com Gemini' : '✦ Formatar Estruturação com Gemini AI'}</span>
          </button>
        </div>
      </div>

      {/* CARD 06: SMART BLOCKS OF LEGO (CONSTRUTOR DE FUNDAMENTOS E PEDIDOS) */}
      <div className="bg-white rounded-3xl p-6 border border-gray-150 shadow-sm space-y-5">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase bg-rose-50 border border-rose-100 text-rose-750 px-2.5 py-1 rounded-full font-mono">
            Card 06
          </span>
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mt-1">
            <Layers size={16} className="text-rose-600" /> Construtor de Tese Inteligente — Blocos de Lego
          </h3>
          <p className="text-[11px] text-gray-500 font-medium font-sans">
            Alavanque a construção de teses processuais empilhando peças e blocos padronizados de alta performance técnica.
          </p>
        </div>

        {/* GALLERY OF BLOCKS TO EMPILHAR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {LEGO_PRESET_BLOCKS.map((block) => {
            const isSelected = selectedLegoIds.includes(block.id);
            return (
              <button
                type="button"
                key={block.id}
                onClick={() => handleLegoToggle(block)}
                className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 relative focus:outline-none ${
                  isSelected 
                    ? 'bg-rose-550/5 border-rose-400 ring-1 ring-rose-355 shadow-3xs' 
                    : 'bg-white border-gray-150 hover:border-gray-300 hover:bg-gray-50/50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[8.5px] font-black uppercase bg-gray-100 text-slate-550 px-1.5 py-0.5 rounded">
                      {block.category}
                    </span>
                    {isSelected && (
                      <span className="text-[8px] font-black uppercase bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded animate-scale">
                        Conectado 🕹️
                      </span>
                    )}
                  </div>
                  <h4 className="text-[11px] font-black text-slate-800 leading-tight block uppercase">{block.title}</h4>
                  <p className="text-[10px] text-gray-550 leading-relaxed font-sans line-clamp-3 italic">
                    {block.text}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* PLAYGROUND OUTLINE COMPILED TEXTAREA */}
        {selectedLegoIds.length > 0 && (
          <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-3.5 border border-slate-800 animate-scale">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-850 pb-2">
              <span className="text-[10.5px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                🕹️ Pilha Ativa de Blocos de Lego ({selectedLegoIds.length} conectado)
              </span>
              <div className="flex items-center gap-1.5 font-sans">
                <button
                  type="button"
                  onClick={handleCopyLegoDraft}
                  className="bg-slate-800 hover:bg-slate-750 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1 border border-slate-700 cursor-pointer"
                >
                  <Copy size={11} />
                  <span>Copiar Peças</span>
                </button>
                <button
                  type="button"
                  onClick={handleInsertLegoToStrategy}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Check size={11} />
                  <span>Mesclar com Estratégia</span>
                </button>
              </div>
            </div>

            <textarea
              readOnly
              rows={4}
              value={legoOutline}
              className="w-full bg-slate-950/70 text-slate-300 font-mono text-[10px] p-3 rounded-xl border border-slate-800/80 outline-none select-text resize-none leading-relaxed"
            />
            <div className="text-[9px] text-slate-500 font-semibold italic text-right font-sans">
              *Selecione os blocos para adicioná-los automaticamente. Use mesclagem para embutir na sua estratégia ao final.
            </div>
          </div>
        )}
      </div>

      {/* CARD JURIDICA ESTRATÉGIA INPUT COAXING WITH LEGO */}
      <div className="bg-white rounded-3xl p-6 border border-gray-150 shadow-sm space-y-4">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estratégia Processual Estrita (Teses de Defesa e Pedidos Secundários)</label>
        <textarea
          name="estrategiaJuridica"
          rows={6}
          value={strategy.estrategiaJuridica}
          onChange={handleChange}
          placeholder="Especifique os pedidos formulados, teses subsidiárias, inversão de ônus processuais da causa e emendas necessárias..."
          className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl outline-none text-xs font-medium focus:bg-white focus:ring-2 focus:ring-rose-100 focus:border-rose-450 transition-all leading-relaxed"
        />
        <div className="flex justify-end text-[9px] font-mono font-bold text-gray-400">
          {strategy.estrategiaJuridica.length} caracteres digitados
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="bg-gray-100 p-4.5 rounded-2xl flex justify-end gap-2.5 items-center">
        <span className="text-[10px] font-semibold text-slate-450 uppercase font-sans">
          Certifique-se de preencher e formatar antes de deferir
        </span>
        <button
          type="submit"
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-6 py-3 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Sincronizando...</span>
            </>
          ) : (
            <>
              <span>Salvar Avanço e Prosseguir</span>
              <ChevronRight size={14} />
            </>
          )}
        </button>
      </div>

    </form>
  );
}
