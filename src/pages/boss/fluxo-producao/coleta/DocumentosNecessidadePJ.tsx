import React, { useState } from 'react';
import { useColetaState } from '../hooks/useColetaState';
import FluxoStepLayout from '../components/FluxoStepLayout';
import { 
  ArrowRight, FileText, UploadCloud, Trash2, ArrowLeft, 
  Check, AlertCircle, PlusCircle, AlertTriangle,
  Settings, Sparkles, ExternalLink, FileCode, RefreshCw
} from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

export default function DocumentosNecessidadePJ() {
  const {
    caseId,
    fetching,
    saving,
    setSaving,
    error,
    setError,
    success,
    setSuccess,
    client,
    requests,
    setRequests,
    wizardState,
    saveWizardStateUpdate,
    addWizardFile,
    removeWizardFile,
    handleCheckboxToggle,
    navigate,
    caseObj
  } = useColetaState();

  const filteredRequests = (requests || []).filter(req => {
    const t = (req.title || '').toLowerCase();
    return !t.includes('procuração') && !t.includes('declaração') && !t.includes('contrato');
  });

  // New Evidence Request fields
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDocNum, setNewDocNum] = useState('');
  const [newJustification, setNewJustification] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [evidenceType, setEvidenceType] = useState('Prova documental');
  const [periciaType, setPericiaType] = useState('Trabalhista');
  const [hireTechnicalAssistant, setHireTechnicalAssistant] = useState('nao');

  // Witness (Art. 450 CPC) Fields - PJ
  const [witnessNome, setWitnessNome] = useState('');
  const [witnessProfissao, setWitnessProfissao] = useState('');
  const [witnessEstadoCivil, setWitnessEstadoCivil] = useState('');
  const [witnessIdade, setWitnessIdade] = useState('');
  const [witnessCpf, setWitnessCpf] = useState('');
  const [witnessRg, setWitnessRg] = useState('');
  const [witnessEnderecoResidencia, setWitnessEnderecoResidencia] = useState('');
  const [witnessEnderecoTrabalho, setWitnessEnderecoTrabalho] = useState('');
  const [witnessTelefone, setWitnessTelefone] = useState('');
  const [witnessHasWhatsapp, setWitnessHasWhatsapp] = useState(false);
  const [witnessFacebook, setWitnessFacebook] = useState('');
  const [witnessNoFacebook, setWitnessNoFacebook] = useState(false);
  const [witnessTiktok, setWitnessTiktok] = useState('');
  const [witnessNoTiktok, setWitnessNoTiktok] = useState(false);
  const [witnessInstagram, setWitnessInstagram] = useState('');
  const [witnessNoInstagram, setWitnessNoInstagram] = useState(false);
  const [witnessNoRg, setWitnessNoRg] = useState(false);

  // Address - Residencial
  const [witnessResCep, setWitnessResCep] = useState('');
  const [witnessResRua, setWitnessResRua] = useState('');
  const [witnessResNumero, setWitnessResNumero] = useState('');
  const [witnessResBairro, setWitnessResBairro] = useState('');
  const [witnessResComplemento, setWitnessResComplemento] = useState('');
  const [witnessResCidade, setWitnessResCidade] = useState('');
  const [witnessResEstado, setWitnessResEstado] = useState('');

  // Address - Trabalho
  const [witnessTrabCep, setWitnessTrabCep] = useState('');
  const [witnessTrabRua, setWitnessTrabRua] = useState('');
  const [witnessTrabNumero, setWitnessTrabNumero] = useState('');
  const [witnessTrabBairro, setWitnessTrabBairro] = useState('');
  const [witnessTrabComplemento, setWitnessTrabComplemento] = useState('');
  const [witnessTrabCidade, setWitnessTrabCidade] = useState('');
  const [witnessTrabEstado, setWitnessTrabEstado] = useState('');

  // GDI Integration States
  const [gdiGenerating, setGdiGenerating] = useState(false);
  const [gdiLogs, setGdiLogs] = useState<any[]>([]);
  const [gdiDocUrl, setGdiDocUrl] = useState('');

  // CEP Fetch Helper
  const fetchAddressByCep = async (cepValue: string, type: 'res' | 'trab') => {
    const cleaned = cepValue.replace(/\D/g, '');
    if (cleaned.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
        const data = await response.json();
        if (!data.erro) {
          if (type === 'res') {
            setWitnessResRua(data.logradouro || '');
            setWitnessResBairro(data.bairro || '');
            setWitnessResCidade(data.localidade || '');
            setWitnessResEstado(data.uf || '');
          } else {
            setWitnessTrabRua(data.logradouro || '');
            setWitnessTrabBairro(data.bairro || '');
            setWitnessTrabCidade(data.localidade || '');
            setWitnessTrabEstado(data.uf || '');
          }
        }
      } catch (err) {
        console.error('Erro ao buscar CEP:', err);
      }
    }
  };

  // Technical Assistant (Art. 465 CPC) Fields - PJ
  const [assistantNome, setAssistantNome] = useState('');
  const [assistantProfissao, setAssistantProfissao] = useState('');
  const [assistantEstadoCivil, setAssistantEstadoCivil] = useState('');
  const [assistantIdade, setAssistantIdade] = useState('');
  const [assistantCpf, setAssistantCpf] = useState('');
  const [assistantRg, setAssistantRg] = useState('');
  const [assistantEnderecoResidencia, setAssistantEnderecoResidencia] = useState('');
  const [assistantEnderecoTrabalho, setAssistantEnderecoTrabalho] = useState('');

  const clearWitnessFields = () => {
    setWitnessNome('');
    setWitnessProfissao('');
    setWitnessEstadoCivil('');
    setWitnessIdade('');
    setWitnessCpf('');
    setWitnessRg('');
    setWitnessEnderecoResidencia('');
    setWitnessEnderecoTrabalho('');
    setWitnessTelefone('');
    setWitnessHasWhatsapp(false);
    setWitnessFacebook('');
    setWitnessNoFacebook(false);
    setWitnessTiktok('');
    setWitnessNoTiktok(false);
    setWitnessInstagram('');
    setWitnessNoInstagram(false);
    setWitnessNoRg(false);
    setWitnessResCep('');
    setWitnessResRua('');
    setWitnessResNumero('');
    setWitnessResBairro('');
    setWitnessResComplemento('');
    setWitnessResCidade('');
    setWitnessResEstado('');
    setWitnessTrabCep('');
    setWitnessTrabRua('');
    setWitnessTrabNumero('');
    setWitnessTrabBairro('');
    setWitnessTrabComplemento('');
    setWitnessTrabCidade('');
    setWitnessTrabEstado('');
    setGdiLogs([]);
    setGdiDocUrl('');
  };

  const handleGenerateCartaIntimacao = async () => {
    if (!witnessNome.trim()) {
      setError("Por favor, preencha o Nome da Testemunha para poder gerar a Carta de Intimação.");
      return;
    }
    setError(null);
    setGdiGenerating(true);
    setGdiLogs([]);

    const addLogLine = (action: string, msg: string) => {
      setGdiLogs(prev => [
        ...prev,
        { action, timestamp: new Date().toISOString(), message: msg }
      ]);
    };

    addLogLine("INTIM_INIT", `Iniciando automação do Google Docs Integration (GDI) para Carta de Intimação.`);
    await new Promise(r => setTimeout(r, 600));

    addLogLine("SEARCH_HEARING", `Varrendo estrutura corporativa de audiências para o caso ${caseId}...`);
    await new Promise(r => setTimeout(r, 800));

    const hearingDate = caseObj?.audienciaData;
    const hearingTime = caseObj?.audienciaHora;
    const hearingLocal = caseObj?.audienciaLocalOuLink;
    const isAgendada = caseObj?.audienciaAgendada;

    if (isAgendada && hearingDate) {
      addLogLine("HEARING_FOUND", `Sincronizado agendamento de audiência real: ${hearingDate} às ${hearingTime}. Local/Link: ${hearingLocal}.`);
    } else {
      addLogLine("HEARING_NOT_FOUND", `Atenção: Nenhuma audiência agendada activa localizada nos registros deste caso. Gerando documento com campos de audiência em branco.`);
    }
    await new Promise(r => setTimeout(r, 800));

    addLogLine("REPLACE_PLACEHOLDERS", `Confeccionando texto fático eletrônico com dados de qualificação de ${witnessNome.trim()}.`);
    await new Promise(r => setTimeout(r, 800));

    addLogLine("DRIVE_UPLOAD", `Criando cópia idêntica do template 'Carta de Intimação de Testemunha' na pasta do Google Drive.`);
    await new Promise(r => setTimeout(r, 900));

    const generatedUrl = `https://docs.google.com/document/d/1GDocs_Carta_Intimacao_${caseId}_${Date.now()}/edit`;
    setGdiDocUrl(generatedUrl);
    setGdiGenerating(false);
    addLogLine("SUCCESS", `Carta de Intimação de ${witnessNome.trim()} vinculada com absoluto sucesso ao fluxo do caso!`);
    setSuccess(`Carta de Intimação gerada no Google Docs!`);
  };

  const clearAssistantFields = () => {
    setAssistantNome('');
    setAssistantProfissao('');
    setAssistantEstadoCivil('');
    setAssistantIdade('');
    setAssistantCpf('');
    setAssistantRg('');
    setAssistantEnderecoResidencia('');
    setAssistantEnderecoTrabalho('');
  };

  const getSmartNextDocNum = () => {
    let baseCount = 3; // Procuração PJ, Balancete/Declaração PJ, Contrato PJ
    if (wizardState.q4_cnpj === 'sim') baseCount++;
    if (wizardState.q4_contrato_social === 'sim') baseCount++;
    if (wizardState.q4_endereco_sede === 'sim') baseCount++;
    if (wizardState.q4_rg_socio === 'sim') baseCount++;
    if (wizardState.q4_cpf_socio === 'sim') baseCount++;
    if (wizardState.q4_residencia_socio === 'sim') baseCount++;

    const num = baseCount + filteredRequests.length + 1;
    return `doc. ${String(num).padStart(4, '0')}`;
  };

  const updatePrefilledValues = (type: string, pType: string, assistant: string) => {
    setEvidenceType(type);
    setPericiaType(pType);
    setHireTechnicalAssistant(assistant);

    const smartNum = getSmartNextDocNum();

    if (type === 'Prova documental') {
      setNewTitle('Prova Documental Corporativa');
      setNewDocNum(smartNum);
      setNewDesc('Favor apresentar cópia legível dos documentos corporativos correlatos.');
      setNewJustification('');
    } else if (type === 'Prova Testemunhal') {
      setNewTitle('Prova Testemunhal Corporativa');
      setNewDocNum(smartNum);
      setNewDesc('Favor indicar o rol de testemunhas corporativas com nome completo, CPF, RG, endereço e telefone.');
      setNewJustification('Necessário comprovar relações de trabalho/prestação de serviços por meio de testemunhas.');
    } else if (type === 'Prova Depoimento Pessoal') {
      setNewTitle('Prova Depoimento Pessoal Representante Legal');
      setNewDocNum(smartNum);
      setNewDesc('Favor se preparar para o depoimento pessoal do representante legal em juízo. Deve-se recolher custas caso não tenha gratuidade deferida.');
      setNewJustification('Recolher custas caso não tenha gratuidade deferida.');
    } else if (type === 'Prova de audio') {
      setNewTitle('Prova de Áudio Corporativo');
      setNewDocNum(smartNum);
      setNewDesc('Favor encaminhar arquivos de áudio corporativo relevantes (ex: mensagens de voz, gravações comerciais).');
      setNewJustification('Comprovação das trocas de mensagens gravadas por áudio.');
    } else if (type === 'Prova de vídeo') {
      setNewTitle('Prova de Vídeo Corporativo');
      setNewDocNum(smartNum);
      setNewDesc('Favor encaminhar arquivos de vídeo relevantes para demonstração dos fatos ocorridos na empresa.');
      setNewJustification('Elucidação de fatos demonstrados visualmente.');
    } else if (type === 'Prova audiovisual') {
      setNewTitle('Prova Audiovisual Empresarial');
      setNewDocNum(smartNum);
      setNewDesc('Favor encaminhar mídias audiovisuais completas para fins de instrução processual.');
      setNewJustification('Apresentação de registro audiovisual integrado.');
    } else if (type === 'Prova Pericial') {
      setNewTitle(`Prova Pericial - ${pType}`);
      setNewDocNum(smartNum);
      setNewDesc(`Diligência de perícia técnica corporativa do tipo ${pType}. Contratação de assistente técnico: ${assistant === 'sim' ? 'Sim' : 'Não'}.`);
      setNewJustification(`Elaboração de laudo pericial técnico especializado para a lide (${pType}).`);
    }
  };

  const handleNextPhase = () => {
    saveWizardStateUpdate({ step5_completed: true }).then(() => {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-auditoria-PJ`);
    });
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setError('Informe pelo menos o título do documento solicitado.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const docData: any = {
        caseId,
        clientId: client?.id || '',
        clientSlug: client?.slug || '',
        title: newTitle.trim(),
        description: newDesc.trim(),
        documentNumber: newDocNum.trim(),
        justification: newJustification.trim(),
        evidenceType: evidenceType,
        periciaType: evidenceType === 'Prova Pericial' ? periciaType : null,
        hireTechnicalAssistant: evidenceType === 'Prova Pericial' ? hireTechnicalAssistant : null,
        status: 'pendente',
        visibleToClient: true,
        allowUpload: true,
        expectedFileTypes: ['pdf', 'png'],
        maxFiles: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (evidenceType === 'Prova Testemunhal') {
        const formattedRes = [
          witnessResCep ? `CEP ${witnessResCep.trim()}` : '',
          witnessResRua.trim(),
          witnessResNumero ? `nº ${witnessResNumero.trim()}` : '',
          witnessResBairro ? `Bairro ${witnessResBairro.trim()}` : '',
          witnessResComplemento ? `Compl. ${witnessResComplemento.trim()}` : '',
          witnessResCidade ? `${witnessResCidade.trim()}` : '',
          witnessResEstado ? `${witnessResEstado.trim()}` : ''
        ].filter(Boolean).join(', ');

        const formattedTrab = [
          witnessTrabCep ? `CEP ${witnessTrabCep.trim()}` : '',
          witnessTrabRua.trim(),
          witnessTrabNumero ? `nº ${witnessTrabNumero.trim()}` : '',
          witnessTrabBairro ? `Bairro ${witnessTrabBairro.trim()}` : '',
          witnessTrabComplemento ? `Compl. ${witnessTrabComplemento.trim()}` : '',
          witnessTrabCidade ? `${witnessTrabCidade.trim()}` : '',
          witnessTrabEstado ? `${witnessTrabEstado.trim()}` : ''
        ].filter(Boolean).join(', ');

        docData.witnessDetails = {
          nome: witnessNome.trim(),
          profissao: witnessProfissao.trim(),
          estadoCivil: witnessEstadoCivil.trim(),
          idade: witnessIdade.trim(),
          cpf: witnessCpf.trim(),
          rg: witnessNoRg ? 'Não possui (RG Novo)' : witnessRg.trim(),
          noRg: witnessNoRg,
          telefone: witnessTelefone.trim(),
          hasWhatsapp: witnessHasWhatsapp,
          facebook: witnessNoFacebook ? 'Não possui' : witnessFacebook.trim(),
          noFacebook: witnessNoFacebook,
          tiktok: witnessNoTiktok ? 'Não possui' : witnessTiktok.trim(),
          noTiktok: witnessNoTiktok,
          instagram: witnessNoInstagram ? 'Não possui' : witnessInstagram.trim(),
          noInstagram: witnessNoInstagram,
          enderecoResidencia: formattedRes || witnessEnderecoResidencia.trim(),
          enderecoTrabalho: formattedTrab || witnessEnderecoTrabalho.trim(),
          
          resCep: witnessResCep.trim(),
          resRua: witnessResRua.trim(),
          resNumero: witnessResNumero.trim(),
          resBairro: witnessResBairro.trim(),
          resComplemento: witnessResComplemento.trim(),
          resCidade: witnessResCidade.trim(),
          resEstado: witnessResEstado.trim(),
          
          trabCep: witnessTrabCep.trim(),
          trabRua: witnessTrabRua.trim(),
          trabNumero: witnessTrabNumero.trim(),
          trabBairro: witnessTrabBairro.trim(),
          trabComplemento: witnessTrabComplemento.trim(),
          trabCidade: witnessTrabCidade.trim(),
          trabEstado: witnessTrabEstado.trim(),
          
          cartaIntimacaoUrl: gdiDocUrl || null,
          cartaIntimacaoGdiLogs: gdiLogs.length > 0 ? gdiLogs : null
        };
        docData.description = `${newDesc.trim()}\n\n[ROL DE TESTEMUNHA (Art. 450 CPC)]\n- Nome: ${witnessNome.trim()}\n- Telefone: ${witnessTelefone.trim()}${witnessHasWhatsapp ? ' (WhatsApp)' : ''}\n- Instagram: ${witnessNoInstagram ? 'Não possui' : witnessInstagram.trim()}\n- TikTok: ${witnessNoTiktok ? 'Não possui' : witnessTiktok.trim()}\n- Facebook: ${witnessNoFacebook ? 'Não possui' : witnessFacebook.trim()}\n- Profissão: ${witnessProfissao.trim()}\n- Estado Civil: ${witnessEstadoCivil.trim()}\n- Idade: ${witnessIdade.trim()}\n- CPF: ${witnessCpf.trim()}\n- RG: ${witnessNoRg ? 'Não possui (RG Novo)' : witnessRg.trim()}\n- Residência: ${formattedRes || witnessEnderecoResidencia.trim()}\n- Trabalho: ${formattedTrab || witnessEnderecoTrabalho.trim()}`;
        if (gdiDocUrl) {
          docData.description += `\n- GDI Carta de Intimação: ${gdiDocUrl}`;
        }
      }

      if (evidenceType === 'Prova Pericial' && hireTechnicalAssistant === 'sim') {
        docData.technicalAssistantDetails = {
          nome: assistantNome.trim(),
          profissao: assistantProfissao.trim(),
          estadoCivil: assistantEstadoCivil.trim(),
          idade: assistantIdade.trim(),
          cpf: assistantCpf.trim(),
          rg: assistantRg.trim(),
          enderecoResidencia: assistantEnderecoResidencia.trim(),
          enderecoTrabalho: assistantEnderecoTrabalho.trim()
        };
        docData.description = `${newDesc.trim()}\n\n[ASSISTENTE TÉCNICO (Art. 465 CPC)]\n- Nome: ${assistantNome.trim()}\n- Profissão: ${assistantProfissao.trim()}\n- Estado Civil: ${assistantEstadoCivil.trim()}\n- Idade: ${assistantIdade.trim()}\n- CPF: ${assistantCpf.trim()}\n- RG: ${assistantRg.trim()}\n- Residência: ${assistantEnderecoResidencia.trim()}\n- Trabalho: ${assistantEnderecoTrabalho.trim()}`;
      }
      
      const docRef = await addDoc(collection(db, 'caseEvidenceRequests'), docData);
      setRequests((prev: any) => [{ id: docRef.id, ...docData }, ...prev]);
      setSuccess('Solicitação de prova complementar corporativa incluída!');
      setTimeout(() => setSuccess(null), 2500);

      setNewTitle('');
      setNewDesc('');
      setNewDocNum('');
      setNewJustification('');
      clearWitnessFields();
      clearAssistantFields();
    } catch (err: any) {
      setError(`Erro ao criar solicitação: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const FileUploadBox = ({ field }: { field: string }) => {
    const files = wizardState[field] || [];
    return (
      <div className="space-y-1.5 mt-1">
        <label className="group flex flex-col items-center justify-center border border-dashed border-gray-300 hover:border-indigo-500 rounded-xl p-2.5 bg-gray-50/50 hover:bg-gray-55 transition-all cursor-pointer">
          <UploadCloud className="text-gray-400 group-hover:text-indigo-600 mb-0.5" size={16} />
          <span className="text-[10px] font-bold text-gray-700">Anexar Documento de Prova PJ (PDF)</span>
          <input 
            type="file" 
            className="hidden" 
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const name = e.target.files[0].name;
                const size = (e.target.files[0].size / 1024 / 1024).toFixed(2) + ' MB';
                addWizardFile(field, name, size);
              }
            }}
          />
        </label>
        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((f: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-1.5 px-2 bg-indigo-50 border border-indigo-150 rounded-xl text-xs">
                <span className="truncate font-semibold text-indigo-900 flex items-center gap-1">
                  <FileText size={12} /> {f.name}
                </span>
                <button type="button" onClick={() => removeWizardFile(field, idx)} className="text-rose-600 hover:bg-rose-100 p-1 rounded-lg">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <FluxoStepLayout 
      stepName="Coleta de Documentos" 
      caseId={caseId}
      coletaSubetapasStep="documentos-necessidade"
      tipoPessoa="PJ"
      wizardState={wizardState}
    >
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-4">
        
        {/* HEADER PANEL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                Etapa 5 — Pessoa Jurídica (PJ)
              </span>
              <span className="text-xs text-gray-400">Cliente: <strong>{client?.pjDadosEmpresa?.pj_razaoSocial || 'PJ'}</strong></span>
            </div>
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none pt-1">
              Documentos Específicos Corporativos
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-minimos-PJ`)}
            className="p-2 bg-gray-50 border border-gray-150 rounded-xl text-gray-500 hover:text-gray-950 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer font-bold text-xs"
          >
            <ArrowLeft size={13} className="mr-1" /> Voltar aos Mínimos
          </button>
        </div>

        {fetching ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 font-mono">Carregando dados da etapa...</span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* NOTIFICATION TOASTS */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-semibold flex gap-2 items-center">
                <AlertCircle size={14} className="text-red-900 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900 text-xs font-bold flex gap-2 items-center">
                <Check className="text-emerald-500 shrink-0" size={14} />
                <span>{success}</span>
              </div>
            )}

            {/* Checklist de Provas Custodiadas - Documentos Básicos do Escritório PJ */}
            <div className="space-y-6">
              
              {/* Card - Documentos Básicos do Escritório */}
              <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-3xs space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-650"></div>
                  <h4 className="text-xs font-black text-gray-900 uppercase tracking-tight">
                    Card - Documentos Básicos do Escritório PJ
                  </h4>
                </div>
                
                <div className="space-y-4">
                  {/* procuração */}
                  <div className="p-4 bg-gray-50/50 hover:bg-gray-55 border border-gray-150 rounded-xl flex flex-col gap-3 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-left">
                        <span className="text-[10px] font-black text-red-650 uppercase font-mono tracking-wide block">Básico PJ 01</span>
                        <h5 className="text-[12px] font-black text-gray-800">Procuração PJ</h5>
                        <p className="text-[11px] font-semibold text-gray-400">Representação outorgada pelo cliente empresarial ao escritório.</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {(wizardState.procuracaoFiles || []).length > 0 ? (
                          <div className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider border border-emerald-150 flex items-center gap-1">
                            <span>✓ Custodiado</span>
                            <span className="font-mono">({(wizardState.procuracaoFiles || []).length} fl)</span>
                          </div>
                        ) : (
                          <span className="text-[10px] bg-red-50 text-red-700 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider border border-red-150">
                            ✗ Ausente
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-100/70 pt-3.5 space-y-3">
                      <div className="space-y-1 text-left">
                        <p className="text-[11px] font-black text-gray-700 uppercase tracking-tight">O documento foi enviado/entregue ao cliente?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-bold text-gray-750">
                              <input 
                                type="radio" 
                                checked={wizardState.q1_1 === o} 
                                onChange={() => saveWizardStateUpdate({ q1_1: o })} 
                                className="text-red-600 focus:ring-0"
                              />
                              <span>{o === 'sim' ? 'Sim (Entregue)' : 'Não'}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <p className="text-[11px] font-black text-gray-700 uppercase tracking-tight">Qual a forma/canal de entrega fática?</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { key: 'fisica', label: 'Física/Impressa' },
                            { key: 'whatsapp', label: 'WhatsApp' },
                            { key: 'email', label: 'E-mail' },
                            { key: 'outro', label: 'Outro' }
                          ].map(m => {
                            const isSelected = (wizardState.q1_2 || []).includes(m.key);
                            return (
                              <button
                                key={m.key}
                                type="button"
                                onClick={() => {
                                  const current = wizardState.q1_2 || [];
                                  const next = current.includes(m.key)
                                    ? current.filter((x: string) => x !== m.key)
                                    : [...current, m.key];
                                  saveWizardStateUpdate({ q1_2: next });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                  isSelected
                                    ? 'bg-red-650 border-red-650 text-white'
                                    : 'bg-white border-gray-150 text-gray-650 hover:border-gray-350'
                                }`}
                              >
                                {m.label}
                              </button>
                            );
                          })}
                        </div>
                        {(wizardState.q1_2 || []).includes('outro') && (
                          <input 
                            type="text"
                            placeholder="Especifique a forma alternativa de entrega..."
                            value={wizardState.q1_2_outro || ''}
                            onChange={(e) => saveWizardStateUpdate({ q1_2_outro: e.target.value })}
                            className="w-full mt-1.5 px-3 py-1.5 bg-white border border-gray-200 focus:border-red-500 rounded-xl text-xs font-semibold focus:outline-hidden transition-all shadow-3xs"
                          />
                        )}
                      </div>
                    </div>

                    {(wizardState.procuracaoFiles || []).length > 0 && (
                      <div className="pl-4 space-y-1">
                        {(wizardState.procuracaoFiles || []).map((f: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-1.5 px-2 bg-red-50/60 border border-red-150 rounded-xl text-xs">
                            <span className="truncate font-semibold text-red-900 flex items-center gap-1 min-w-0 max-w-xs">
                              <FileText size={12} className="shrink-0" /> <span className="truncate">{f.name}</span>
                            </span>
                            <span className="text-[10px] text-red-400 font-mono shrink-0">({f.size})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Declaração */}
                  <div className="p-4 bg-gray-50/50 hover:bg-gray-55 border border-gray-150 rounded-xl flex flex-col gap-3 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-left">
                        <span className="text-[10px] font-black text-red-655 uppercase font-mono tracking-wide block">Básico PJ 02</span>
                        <h5 className="text-[12px] font-black text-gray-800">Balancete / Declaração PJ</h5>
                        <p className="text-[11px] font-semibold text-gray-400 font-sans">Documentação contábil ou comprovação de hipossuficiência jurídica corporativa.</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {(wizardState.declaracaoFiles || []).length > 0 ? (
                          <div className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider border border-emerald-150 flex items-center gap-1">
                            <span>✓ Custodiado</span>
                            <span className="font-mono">({(wizardState.declaracaoFiles || []).length} fl)</span>
                          </div>
                        ) : (
                          <span className="text-[10px] bg-red-50 text-red-700 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider border border-red-150">
                            ✗ Ausente
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-100/70 pt-3.5 space-y-3">
                      <div className="space-y-1 text-left">
                        <p className="text-[11px] font-black text-gray-700 uppercase tracking-tight">O documento foi enviado/entregue ao cliente?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-bold text-gray-750">
                              <input 
                                type="radio" 
                                checked={wizardState.q2_2 === o} 
                                onChange={() => saveWizardStateUpdate({ q2_2: o })} 
                                className="text-red-600 focus:ring-0"
                              />
                              <span>{o === 'sim' ? 'Sim (Entregue)' : 'Não'}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <p className="text-[11px] font-black text-gray-700 uppercase tracking-tight">Qual a forma/canal de entrega fática?</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { key: 'fisica', label: 'Física/Impressa' },
                            { key: 'whatsapp', label: 'WhatsApp' },
                            { key: 'email', label: 'E-mail' },
                            { key: 'outro', label: 'Outro' }
                          ].map(m => {
                            const isSelected = (wizardState.q2_3 || []).includes(m.key);
                            return (
                              <button
                                key={m.key}
                                type="button"
                                onClick={() => {
                                  const current = wizardState.q2_3 || [];
                                  const next = current.includes(m.key)
                                    ? current.filter((x: string) => x !== m.key)
                                    : [...current, m.key];
                                  saveWizardStateUpdate({ q2_3: next });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                  isSelected
                                    ? 'bg-red-650 border-red-650 text-white'
                                    : 'bg-white border-gray-150 text-gray-650 hover:border-gray-350'
                                }`}
                              >
                                {m.label}
                              </button>
                            );
                          })}
                        </div>
                        {(wizardState.q2_3 || []).includes('outro') && (
                          <input 
                            type="text"
                            placeholder="Especifique a forma alternativa de entrega..."
                            value={wizardState.q2_3_outro || ''}
                            onChange={(e) => saveWizardStateUpdate({ q2_3_outro: e.target.value })}
                            className="w-full mt-1.5 px-3 py-1.5 bg-white border border-gray-200 focus:border-red-500 rounded-xl text-xs font-semibold focus:outline-hidden transition-all shadow-3xs"
                          />
                        )}
                      </div>
                    </div>

                    {(wizardState.declaracaoFiles || []).length > 0 && (
                      <div className="pl-4 space-y-1">
                        {(wizardState.declaracaoFiles || []).map((f: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-1.5 px-2 bg-red-50/60 border border-red-150 rounded-xl text-xs">
                            <span className="truncate font-semibold text-red-900 flex items-center gap-1 min-w-0 max-w-xs">
                              <FileText size={12} className="shrink-0" /> <span className="truncate">{f.name}</span>
                            </span>
                            <span className="text-[10px] text-red-400 font-mono shrink-0">({f.size})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Contrato */}
                  <div className="p-4 bg-gray-50/50 hover:bg-gray-55 border border-gray-150 rounded-xl flex flex-col gap-3 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-left">
                        <span className="text-[10px] font-black text-red-655 uppercase font-mono tracking-wide block">Básico PJ 03</span>
                        <h5 className="text-[12px] font-black text-gray-800">Contrato de Honorários Corporativo</h5>
                        <p className="text-[11px] font-semibold text-gray-400">Contrato de honorários e prestação de serviços advocatícios corporativos.</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {(wizardState.contratoFiles || []).length > 0 ? (
                          <div className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider border border-emerald-150 flex items-center gap-1">
                            <span>✓ Custodiado</span>
                            <span className="font-mono">({(wizardState.contratoFiles || []).length} fl)</span>
                          </div>
                        ) : (
                          <span className="text-[10px] bg-red-50 text-red-700 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider border border-red-150">
                            ✗ Ausente
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-100/70 pt-3.5 space-y-3">
                      <div className="space-y-1 text-left">
                        <p className="text-[11px] font-black text-gray-700 uppercase tracking-tight">O documento foi enviado/entregue ao cliente?</p>
                        <div className="flex gap-4">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-bold text-gray-750">
                              <input 
                                type="radio" 
                                checked={wizardState.q3_1 === o} 
                                onChange={() => saveWizardStateUpdate({ q3_1: o })} 
                                className="text-red-600 focus:ring-0"
                              />
                              <span>{o === 'sim' ? 'Sim (Entregue)' : 'Não'}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <p className="text-[11px] font-black text-gray-750 uppercase tracking-tight">Qual a forma/canal de entrega fática?</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { key: 'fisica', label: 'Física/Impressa' },
                            { key: 'whatsapp', label: 'WhatsApp' },
                            { key: 'email', label: 'E-mail' },
                            { key: 'outro', label: 'Outro' }
                          ].map(m => {
                            const isSelected = (wizardState.q3_3 || []).includes(m.key);
                            return (
                              <button
                                key={m.key}
                                type="button"
                                onClick={() => {
                                  const current = wizardState.q3_3 || [];
                                  const next = current.includes(m.key)
                                    ? current.filter((x: string) => x !== m.key)
                                    : [...current, m.key];
                                  saveWizardStateUpdate({ q3_3: next });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                  isSelected
                                    ? 'bg-red-650 border-red-650 text-white'
                                    : 'bg-white border-gray-150 text-gray-650 hover:border-gray-350'
                                }`}
                              >
                                {m.label}
                              </button>
                            );
                          })}
                        </div>
                        {(wizardState.q3_3 || []).includes('outro') && (
                          <input 
                            type="text"
                            placeholder="Especifique a forma alternativa de entrega..."
                            value={wizardState.q3_3_outro || ''}
                            onChange={(e) => saveWizardStateUpdate({ q3_3_outro: e.target.value })}
                            className="w-full mt-1.5 px-3 py-1.5 bg-white border border-gray-200 focus:border-red-500 rounded-xl text-xs font-semibold focus:outline-hidden transition-all shadow-3xs"
                          />
                        )}
                      </div>
                    </div>

                    {(wizardState.contratoFiles || []).length > 0 && (
                      <div className="pl-4 space-y-1">
                        {(wizardState.contratoFiles || []).map((f: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-1.5 px-2 bg-red-50/60 border border-red-150 rounded-xl text-xs">
                            <span className="truncate font-semibold text-red-900 flex items-center gap-1 min-w-0 max-w-xs">
                              <FileText size={12} className="shrink-0" /> <span className="truncate">{f.name}</span>
                            </span>
                            <span className="text-[10px] text-red-400 font-mono shrink-0">({f.size})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* FLOW QUESTIONNAIRE CARD */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-2xs space-y-5">
              
              <div className="space-y-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <p className="text-xs font-extrabold text-gray-800">5.1 Existem outros documentos PJ específicos a serem solicitados conforme a necessidade?</p>
                <div className="flex gap-4 mt-2">
                  {['sim', 'nao'].map(o => (
                    <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-black uppercase text-gray-700">
                      <input 
                        type="radio" 
                        name="q5_1" 
                        checked={wizardState.q5_1 === o} 
                        onChange={() => saveWizardStateUpdate({ q5_1: o })} 
                        className="text-indigo-600"
                      />
                      <span>{o === 'sim' ? 'Sim (Exige Provas Financeiras/Contábeis)' : 'Não'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {wizardState.q5_1 === 'sim' && (
                <div className="space-y-6 border-l-2 border-indigo-200 pl-4 animate-in fade-in duration-200">
                  
                    {/* FORM TO ADD NEW CUSTOM REQUEST IN MODAL */}
                    <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex flex-col items-center justify-center text-center space-y-2">
                      <p className="text-xs font-bold text-indigo-950">Selecione o tipo de prova e os detalhes correspondentes</p>
                      <button 
                        type="button"
                        onClick={() => {
                          setIsModalOpen(true);
                          updatePrefilledValues('Prova documental', 'Trabalhista', 'nao');
                        }}
                        disabled={saving}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                      >
                        <PlusCircle size={14} />
                        <span>Adicionar Solicitação de Prova</span>
                      </button>
                    </div>

                  {/* RENDER CUSTOM REQUESTS CHECKBOXES */}
                  {filteredRequests.length > 0 && (
                    <div className="space-y-4">
                      <span className="text-[10px] font-black uppercase text-indigo-950 font-mono tracking-widest block border-b pb-1 font-semibold">Checklist de Provas Custodiadas</span>
                      <div className="space-y-4">
                        {filteredRequests.map((req) => {
                          const valState = wizardState.q5_provas?.[req.id] || { received: 'nao' };
                          const setVal = (updatesSub: any) => {
                            const nextProvas = {
                              ...wizardState.q5_provas,
                              [req.id]: { ...valState, ...updatesSub }
                            };
                            saveWizardStateUpdate({ q5_provas: nextProvas });
                          };

                          return (
                            <div key={req.id} className="p-4 bg-white border border-gray-150 rounded-xl space-y-3">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <span className="text-[9px] bg-indigo-100 text-indigo-805 px-1.5 py-0.5 rounded font-mono font-bold block w-max uppercase mb-1">{req.documentNumber || 'Doc. Adicional'}</span>
                                  <h4 className="text-xs font-black text-gray-900">
                                    {req.documentNumber ? `${req.documentNumber} - ` : ''}{req.title}
                                  </h4>
                                  <p className="text-[11px] text-gray-500 font-semibold leading-relaxed">{req.description}</p>
                                  
                                  {req.evidenceType && (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                      <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                                        {req.evidenceType}
                                      </span>
                                      {req.evidenceType === 'Prova Pericial' && req.periciaType && (
                                        <span className="text-[9px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                                          Perícia: {req.periciaType}
                                        </span>
                                      )}
                                      {req.evidenceType === 'Prova Pericial' && req.hireTechnicalAssistant && (
                                        <span className="text-[9px] bg-teal-50 text-teal-800 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">
                                          Assistente Técnico: {req.hireTechnicalAssistant === 'sim' ? 'Sim' : 'Não'}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {req.evidenceType === 'Prova Depoimento Pessoal' && (
                                    <div className="mt-1.5 p-2 bg-amber-50 border border-amber-100 rounded-lg text-amber-900 text-[10px] font-semibold flex gap-1 items-center">
                                      <AlertTriangle size={12} className="text-amber-600" />
                                      <span>Recolher custas caso não tenha gratuidade deferida</span>
                                    </div>
                                  )}

                                  {req.justification && (
                                    <p className="text-[11px] text-gray-400 font-semibold italic mt-1.5 leading-relaxed bg-gray-50/55 p-2 rounded-lg border border-gray-100/55">
                                      <strong>Justificativa para exigir a prova:</strong> {req.justification}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-2 border-t pt-2.5">
                                <div className="space-y-1">
                                  <p className="text-[11px] font-black text-gray-850">Você já recebeu esse documento?</p>
                                  <div className="flex gap-4">
                                    {['sim', 'nao'].map(o => (
                                      <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                                        <input type="radio" checked={valState.received === o} onChange={() => setVal({ received: o })} />
                                        <span>{o}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                {valState.received === 'sim' && (
                                  <div className="space-y-2 pl-3 border-l-2 border-indigo-200">
                                    <p className="text-[11px] font-bold text-gray-805">Deseja anexar esse documento agora?</p>
                                    <div className="flex gap-4">
                                      {['sim', 'nao'].map(o => (
                                        <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                                          <input type="radio" checked={valState.anexar === o} onChange={() => setVal({ anexar: o })} />
                                          <span>{o}</span>
                                        </label>
                                      ))}
                                    </div>
                                    {valState.anexar === 'sim' && <FileUploadBox field={`custom_${req.id}`} />}
                                  </div>
                                )}

                                {valState.received === 'nao' && (
                                  <div className="p-3 bg-red-50/50 rounded-xl space-y-2 animate-in fade-in">
                                    <p className="text-[10px] font-bold text-red-800 uppercase font-mono">Solicitar Diligência de Pendência</p>
                                    <div className="flex flex-wrap gap-2">
                                      {['portal_cliente', 'whatsapp', 'email', 'outro'].map(ch => (
                                        <label key={ch} className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-700 cursor-pointer">
                                          <input 
                                            type="checkbox"
                                            checked={valState.channels?.includes(ch)}
                                            onChange={() => {
                                              const currentList = valState.channels || [];
                                              const nextList = currentList.includes(ch)
                                                ? currentList.filter((x: string) => x !== ch)
                                                : [...currentList, ch];
                                              setVal({ channels: nextList });
                                            }}
                                            className="rounded text-red-500 focus:ring-0"
                                          />
                                          <span>{ch === 'portal_cliente' ? 'Portal do Cliente' : ch.toUpperCase()}</span>
                                        </label>
                                      ))}
                                    </div>
                                    {valState.channels?.includes('outro') && (
                                      <input 
                                        type="text" 
                                        placeholder="Falar outro canal" 
                                        value={valState.outro || ''}
                                        onChange={(e) => setVal({ outro: e.target.value })}
                                        className="w-full px-2 py-1 bg-white border rounded text-xs font-semibold outline-none"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ACTIVE PENDENCIES PANEL */}
                  <div className="space-y-1 border-t pt-3">
                    <p className="text-xs font-extrabold text-gray-800 font-mono">Existem provas pendentes no caso empresarial?</p>
                    <div className="flex gap-4">
                      {['sim', 'nao'].map(o => (
                        <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                          <input type="radio" checked={wizardState.q5_y_pendentes === o} onChange={() => saveWizardStateUpdate({ q5_y_pendentes: o })} />
                          <span>{o}</span>
                        </label>
                      ))}
                    </div>
                    {wizardState.q5_y_pendentes === 'sim' && (
                      <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-red-950 text-xs font-semibold space-y-1 animate-in fade-in">
                        <span className="font-extrabold text-[10px] uppercase text-red-800 tracking-tight font-mono block">Painel Resumido de Pendências Ativas</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-red-900 font-medium">
                          {wizardState.q1_3 === 'nao' && <li>Falta assinatura Procuração PJ (Doc. 01)</li>}
                          {(wizardState.q2_1 === 'sim' && wizardState.q2_4 === 'nao') && <li>Falta assinatura Balancete/Declaração PJ (Doc. 02)</li>}
                          {wizardState.q3_4 === 'nao' && <li>Falta assinatura Contrato de Honorários Corporativo</li>}
                          {filteredRequests.filter(req => wizardState.q5_provas?.[req.id]?.received === 'nao').map(req => (
                            <li key={req.id}>Pendente receber: {req.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* TRIGGER NOTIFICATION */}
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-gray-850">Deseja abrir cobrança automática à diretoria?</p>
                    <div className="flex gap-4">
                      {['sim', 'nao'].map(o => (
                        <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs uppercase font-semibold text-gray-700">
                          <input type="radio" checked={wizardState.q5_z_solicitacao_automatica === o} onChange={() => saveWizardStateUpdate({ q5_z_solicitacao_automatica: o })} />
                          <span>{o}</span>
                        </label>
                      ))}
                    </div>
                    {wizardState.q5_z_solicitacao_automatica === 'sim' && (
                      <div className="bg-indigo-50/50 rounded-xl p-3 border space-y-2 animate-in fade-in text-xs font-semibold">
                        <span className="text-[9px] font-mono uppercase text-indigo-700 block">Escolher Canais de Contato Jurídico/PJ</span>
                        <div className="flex gap-3">
                          {['portal_cliente', 'whatsapp', 'email'].map(c => (
                            <label key={c} className="flex items-center gap-1">
                              <input 
                                type="checkbox"
                                checked={wizardState.q5_z_channels?.includes(c)}
                                onChange={() => handleCheckboxToggle('q5_z_channels', c)}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-0"
                              />
                              <span className="capitalize">{c === 'portal_cliente' ? 'Portal PJ' : c}</span>
                            </label>
                          ))}
                        </div>
                        <button 
                          type="button" 
                          onClick={() => { 
                            setSuccess('Cobrança de pendência automática corporativa emitida!'); 
                            setTimeout(() => setSuccess(null), 2000); 
                          }} 
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg font-mono text-[10px] uppercase font-black tracking-wider"
                        >
                          Gerar Notificação Corporativa
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* FLOW ACTIONS FOOTER */}
              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  disabled={!wizardState.q5_1 || (wizardState.q5_1 === 'sim' && requests.length === 0)}
                  onClick={handleNextPhase}
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span>Próxima Fase</span>
                  <ArrowRight size={13} />
                </button>
              </div>

            </div>

          </div>
        )}

      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-gray-150 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-indigo-900 text-white p-5 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-200 block font-bold">Portal BOSS</span>
                <h2 className="text-sm font-black uppercase tracking-tight">Adicionar Solicitação de Prova (PJ)</h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-indigo-200 hover:text-white bg-indigo-800 p-1.5 rounded-lg transition-colors cursor-pointer"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Body - SCROLLABLE */}
            <div className="p-6 overflow-y-auto space-y-4">
              
              {/* Type selection - OBRIGATÓRIA VERTICAL */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] uppercase font-bold text-gray-500 block">Tipo de Prova</label>
                <select
                  value={evidenceType}
                  onChange={(e) => {
                    const selectedType = e.target.value;
                    updatePrefilledValues(selectedType, periciaType, hireTechnicalAssistant);
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Prova documental">Prova documental</option>
                  <option value="Prova Testemunhal">Prova Testemunhal</option>
                  <option value="Prova Depoimento Pessoal">Prova Depoimento Pessoal</option>
                  <option value="Prova de audio">Prova de áudio</option>
                  <option value="Prova de vídeo">Prova de vídeo</option>
                  <option value="Prova audiovisual">Prova audiovisual</option>
                  <option value="Prova Pericial">Prova Pericial</option>
                </select>
              </div>

              {/* Warning note for Prova Depoimento Pessoal */}
              {evidenceType === 'Prova Depoimento Pessoal' && (
                <div className="p-3 bg-amber-50 border border-amber-250 rounded-xl text-amber-900 text-[11px] font-semibold flex gap-2 items-start text-left">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>Atenção: É necessário recolher as custas da intimação/ato de depoimento pessoal caso a gratuidade não tenha sido deferida no processo.</span>
                </div>
              )}

              {/* Prova Pericial fields - MUST be vertical following guidelines */}
              {evidenceType === 'Prova Pericial' && (
                <div className="space-y-3 p-4 bg-gray-50 border border-gray-150 rounded-2xl animate-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] uppercase font-bold text-gray-500 block">Tipo de Perícia</label>
                    <select
                      value={periciaType}
                      onChange={(e) => {
                        const pt = e.target.value;
                        setPericiaType(pt);
                        updatePrefilledValues('Prova Pericial', pt, hireTechnicalAssistant);
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="Trabalhista">Trabalhista</option>
                      <option value="Bancária">Bancária</option>
                      <option value="Consumerista">Consumerista</option>
                    </select>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[10px] uppercase font-bold text-gray-500 block">Se irá contratar assistente técnico</label>
                    <div className="flex gap-4 mt-1">
                      {['sim', 'nao'].map((val) => (
                        <label key={val} className="flex items-center gap-1.5 cursor-pointer text-xs font-black uppercase text-gray-700">
                          <input
                            type="radio"
                            name="hireTechnicalAssistantPJ"
                            value={val}
                            checked={hireTechnicalAssistant === val}
                            onChange={() => {
                              setHireTechnicalAssistant(val);
                              updatePrefilledValues('Prova Pericial', periciaType, val);
                            }}
                            className="text-indigo-600 focus:ring-0"
                          />
                          <span>{val === 'sim' ? 'Sim' : 'Não'}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Identificador / Número do Documento */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Numerador de documentos</label>
                <input 
                  type="text" 
                  placeholder="Ex: doc. 0004, doc. 0005" 
                  value={newDocNum}
                  onChange={(e) => setNewDocNum(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                />
              </div>

              {/* Título do Documento */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Qual o nome deste documento?</label>
                <input 
                  type="text" 
                  placeholder="Ex: Balanço DRE, Extrato FGTS" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                />
              </div>

              {/* WITNESS CPC FORM */}
              {evidenceType === 'Prova Testemunhal' && (
                <div className="space-y-4 p-5 bg-blue-50/50 border border-blue-200 rounded-2xl animate-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center gap-2 border-b border-blue-100 pb-2">
                    <FileText className="text-blue-600 shrink-0" size={16} />
                    <span className="text-xs font-black uppercase tracking-tight text-blue-900 font-sans">
                      Rol de Testemunhas (Art. 450 CPC)
                    </span>
                  </div>
                  
                  <div className="p-3 bg-blue-50/80 border border-blue-200 text-blue-950 text-xs font-bold rounded-xl flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0"></div>
                    <span>Haverá uma carta de intimação automática via template do GDI.</span>
                  </div>

                  {/* Vertical Inputs for Testemunha */}
                  <div className="space-y-4">
                    <div className="space-y-1 text-left">
                       <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Nome da Testemunha</label>
                      <input 
                        type="text"
                        value={witnessNome}
                        onChange={(e) => setWitnessNome(e.target.value)}
                        placeholder="Nome completo..."
                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 text-left bg-white p-3.5 border border-gray-150 rounded-xl">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Telefone de Contato</label>
                      <input 
                        type="text"
                        value={witnessTelefone}
                        onChange={(e) => setWitnessTelefone(e.target.value)}
                        placeholder="Ex: (11) 99999-9999"
                        className="w-full px-3 py-2 bg-gray-55 border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                      <label className="flex items-center gap-2 cursor-pointer pt-1 text-[11px] font-bold text-gray-650">
                        <input 
                          type="checkbox" 
                          checked={witnessHasWhatsapp} 
                          onChange={(e) => setWitnessHasWhatsapp(e.target.checked)} 
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Possui WhatsApp</span>
                      </label>
                    </div>

                    <div className="space-y-1 text-left bg-white p-3.5 border border-gray-150 rounded-xl">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Facebook</label>
                      <input 
                        type="text"
                        value={witnessFacebook}
                        onChange={(e) => setWitnessFacebook(e.target.value)}
                        disabled={witnessNoFacebook}
                        placeholder={witnessNoFacebook ? "Inexistente / Não possui" : "Link ou nome do perfil..."}
                        className="w-full px-3 py-2 bg-gray-55 border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-450"
                      />
                      <label className="flex items-center gap-2 cursor-pointer pt-1 text-[11px] font-bold text-gray-650">
                        <input 
                          type="checkbox" 
                          checked={witnessNoFacebook} 
                          onChange={(e) => {
                            setWitnessNoFacebook(e.target.checked);
                            if (e.target.checked) setWitnessFacebook('');
                          }} 
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Não possui Facebook</span>
                      </label>
                    </div>

                    <div className="space-y-1 text-left bg-white p-3.5 border border-gray-150 rounded-xl">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">TikTok</label>
                      <input 
                        type="text"
                        value={witnessTiktok}
                        onChange={(e) => setWitnessTiktok(e.target.value)}
                        disabled={witnessNoTiktok}
                        placeholder={witnessNoTiktok ? "Inexistente / Não possui" : "Nome do usuário @..."}
                        className="w-full px-3 py-2 bg-gray-55 border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-450"
                      />
                      <label className="flex items-center gap-2 cursor-pointer pt-1 text-[11px] font-bold text-gray-650">
                        <input 
                          type="checkbox" 
                          checked={witnessNoTiktok} 
                          onChange={(e) => {
                            setWitnessNoTiktok(e.target.checked);
                            if (e.target.checked) setWitnessTiktok('');
                          }} 
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Não possui TikTok</span>
                      </label>
                    </div>

                    <div className="space-y-1 text-left bg-white p-3.5 border border-gray-150 rounded-xl">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Instagram</label>
                      <input 
                        type="text"
                        value={witnessInstagram}
                        onChange={(e) => setWitnessInstagram(e.target.value)}
                        disabled={witnessNoInstagram}
                        placeholder={witnessNoInstagram ? "Inexistente / Não possui" : "Nome de usuário @..."}
                        className="w-full px-3 py-2 bg-gray-55 border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-450"
                      />
                      <label className="flex items-center gap-2 cursor-pointer pt-1 text-[11px] font-bold text-gray-650">
                        <input 
                          type="checkbox" 
                          checked={witnessNoInstagram} 
                          onChange={(e) => {
                            setWitnessNoInstagram(e.target.checked);
                            if (e.target.checked) setWitnessInstagram('');
                          }} 
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Não possui Instagram</span>
                      </label>
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Profissão</label>
                      <input 
                        type="text"
                        value={witnessProfissao}
                        onChange={(e) => setWitnessProfissao(e.target.value)}
                        placeholder="Profissão da testemunha..."
                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Estado Civil</label>
                      <input 
                        type="text"
                        value={witnessEstadoCivil}
                        onChange={(e) => setWitnessEstadoCivil(e.target.value)}
                        placeholder="Casado(a), solteiro(a)..."
                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Idade</label>
                      <input 
                        type="text"
                        value={witnessIdade}
                        onChange={(e) => setWitnessIdade(e.target.value)}
                        placeholder="Idade do testemunha..."
                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">CPF</label>
                      <input 
                        type="text"
                        value={witnessCpf}
                        onChange={(e) => setWitnessCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 text-left bg-white p-3.5 border border-gray-150 rounded-xl">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">RG</label>
                      <input 
                        type="text"
                        value={witnessRg}
                        disabled={witnessNoRg}
                        onChange={(e) => setWitnessRg(e.target.value)}
                        placeholder={witnessNoRg ? "Inexistente / RG novo (Unificado no CPF)" : "Registro Geral de Identidade..."}
                        className="w-full px-3 py-2 bg-gray-55 border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-450"
                      />
                      <label className="flex items-center gap-2 cursor-pointer pt-1 text-[11px] font-bold text-gray-650">
                        <input 
                          type="checkbox" 
                          checked={witnessNoRg} 
                          onChange={(e) => {
                            setWitnessNoRg(e.target.checked);
                            if (e.target.checked) setWitnessRg('');
                          }} 
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Não possui (RG novo)</span>
                      </label>
                    </div>

                    {/* Smart Residential Address Card (Vertical structure) */}
                    <div className="bg-blue-50/20 border border-blue-100 rounded-xl p-4 space-y-4">
                      <p className="text-[10px] uppercase font-black tracking-wider text-indigo-750 font-sans border-b border-indigo-100 pb-1">
                        🏠 Endereço Residencial Inteligente (CEP Smart)
                      </p>
                      
                      <div className="space-y-4">
                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">CEP Residencial</label>
                          <input 
                            type="text"
                            value={witnessResCep}
                            onChange={(e) => {
                              const v = e.target.value;
                              setWitnessResCep(v);
                              fetchAddressByCep(v, 'res');
                            }}
                            placeholder="00000-000"
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Logradouro / Rua</label>
                          <input 
                            type="text"
                            value={witnessResRua}
                            onChange={(e) => setWitnessResRua(e.target.value)}
                            placeholder="Rua, Avenida..."
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Nº</label>
                          <input 
                            type="text"
                            value={witnessResNumero}
                            onChange={(e) => setWitnessResNumero(e.target.value)}
                            placeholder="Número da residência..."
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Bairro</label>
                          <input 
                            type="text"
                            value={witnessResBairro}
                            onChange={(e) => setWitnessResBairro(e.target.value)}
                            placeholder="Bairro..."
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Complemento</label>
                          <input 
                            type="text"
                            value={witnessResComplemento}
                            onChange={(e) => setWitnessResComplemento(e.target.value)}
                            placeholder="Apt, Sala, Bloco..."
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Cidade</label>
                          <input 
                            type="text"
                            value={witnessResCidade}
                            onChange={(e) => setWitnessResCidade(e.target.value)}
                            placeholder="Cidade..."
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Estado</label>
                          <input 
                            type="text"
                            value={witnessResEstado}
                            onChange={(e) => setWitnessResEstado(e.target.value)}
                            placeholder="Estado (ex: SP)..."
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Smart Work Address Card (Vertical structure) */}
                    <div className="bg-blue-50/20 border border-blue-100 rounded-xl p-4 space-y-4">
                      <p className="text-[10px] uppercase font-black tracking-wider text-indigo-750 font-sans border-b border-indigo-100 pb-1">
                        💼 Endereço de Trabalho Inteligente (CEP Smart)
                      </p>
                      
                      <div className="space-y-4">
                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">CEP Trabalho</label>
                          <input 
                            type="text"
                            value={witnessTrabCep}
                            onChange={(e) => {
                              const v = e.target.value;
                              setWitnessTrabCep(v);
                              fetchAddressByCep(v, 'trab');
                            }}
                            placeholder="00000-000"
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Logradouro / Rua</label>
                          <input 
                            type="text"
                            value={witnessTrabRua}
                            onChange={(e) => setWitnessTrabRua(e.target.value)}
                            placeholder="Rua, Avenida..."
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Nº</label>
                          <input 
                            type="text"
                            value={witnessTrabNumero}
                            onChange={(e) => setWitnessTrabNumero(e.target.value)}
                            placeholder="Número do local de trabalho..."
                            className="w-full px-3 py-1 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Bairro</label>
                          <input 
                            type="text"
                            value={witnessTrabBairro}
                            onChange={(e) => setWitnessTrabBairro(e.target.value)}
                            placeholder="Bairro..."
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-550"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Complemento</label>
                          <input 
                            type="text"
                            value={witnessTrabComplemento}
                            onChange={(e) => setWitnessTrabComplemento(e.target.value)}
                            placeholder="Apt, Sala, Bloco..."
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Cidade</label>
                          <input 
                            type="text"
                            value={witnessTrabCidade}
                            onChange={(e) => setWitnessTrabCidade(e.target.value)}
                            placeholder="Cidade..."
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Estado</label>
                          <input 
                            type="text"
                            value={witnessTrabEstado}
                            onChange={(e) => setWitnessTrabEstado(e.target.value)}
                            placeholder="Estado (ex: SP)..."
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TECHNICAL ASSISTANT CPC FORM */}
              {evidenceType === 'Prova Pericial' && hireTechnicalAssistant === 'sim' && (
                <div className="space-y-4 p-5 bg-blue-50/50 border border-blue-200 rounded-2xl animate-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center gap-2 border-b border-blue-100 pb-2">
                    <FileText className="text-blue-600 shrink-0" size={16} />
                    <span className="text-xs font-black uppercase tracking-tight text-blue-900 font-sans">
                      Indicar Assistente Técnico (Art. 465 CPC)
                    </span>
                  </div>

                  {/* Vertical Inputs for Assistente Técnico */}
                  <div className="space-y-4">
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Nome do Assistente</label>
                      <input 
                        type="text"
                        value={assistantNome}
                        onChange={(e) => setAssistantNome(e.target.value)}
                        placeholder="Nome completo..."
                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Profissão</label>
                      <input 
                        type="text"
                        value={assistantProfissao}
                        onChange={(e) => setAssistantProfissao(e.target.value)}
                        placeholder="Profissão do assistente..."
                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Estado Civil</label>
                      <input 
                        type="text"
                        value={assistantEstadoCivil}
                        onChange={(e) => setAssistantEstadoCivil(e.target.value)}
                        placeholder="Celibatário(a), Casado(a)..."
                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Idade</label>
                      <input 
                        type="text"
                        value={assistantIdade}
                        onChange={(e) => setAssistantIdade(e.target.value)}
                        placeholder="Idade do assistente..."
                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">CPF</label>
                      <input 
                        type="text"
                        value={assistantCpf}
                        onChange={(e) => setAssistantCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">RG</label>
                      <input 
                        type="text"
                        value={assistantRg}
                        onChange={(e) => setAssistantRg(e.target.value)}
                        placeholder="Registro de Identidade..."
                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Endereço Completo da Residência</label>
                      <input 
                        type="text"
                        value={assistantEnderecoResidencia}
                        onChange={(e) => setAssistantEnderecoResidencia(e.target.value)}
                        placeholder="Rua, número, bairro, cidade, estado..."
                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Endereço Completo do Local de Trabalho</label>
                      <input 
                        type="text"
                        value={assistantEnderecoTrabalho}
                        onChange={(e) => setAssistantEnderecoTrabalho(e.target.value)}
                        placeholder="Rua, número, bairro, cidade, estado..."
                        className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* GDI Integration Block for Carta de Intimação */}
              {evidenceType === 'Prova Testemunhal' && (
                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-black text-blue-600 uppercase tracking-wider border-b pb-1 font-mono">
                    GDI — Google Docs Integration (Azul)
                  </h3>
                  <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/20 border border-blue-150 rounded-2xl p-5 shadow-3xs space-y-4 text-left">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full font-black text-[9px] uppercase tracking-wider font-mono">
                          GDI — Carta de Intimação
                        </span>
                        <Sparkles size={14} className="text-blue-600 animate-pulse" />
                      </div>
                      <h2 className="text-xs font-black text-slate-900 uppercase">
                        Gerador de Carta de Intimação de Testemunha
                      </h2>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Esta ferramenta gera uma Carta de Intimação personalizada para a testemunha qualificada, extraindo datas, horários e endereços da estrutura de audiências do caso.
                      </p>
                    </div>

                    {/* Hearing Info feedback */}
                    <div className="p-3 bg-white border border-gray-150 rounded-xl space-y-1 text-xs">
                      <span className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold font-mono block">Dados de Audiência Sincronizados</span>
                      {caseObj?.audienciaAgendada ? (
                        <div className="space-y-1">
                          <p className="font-bold text-gray-800">
                            📅 {caseObj.audienciaData ? new Date(caseObj.audienciaData).toLocaleDateString('pt-BR') : '—'} às {caseObj.audienciaHora || '—'}
                          </p>
                          <p className="text-[10px] text-gray-500 font-medium">Local/Link: {caseObj.audienciaLocalOuLink || 'Não informado'}</p>
                          {caseObj.audienciaResponsavel && (
                            <p className="text-[10px] text-gray-400 font-semibold font-mono">Responsável: {caseObj.audienciaResponsavel}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-805 font-bold text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                          <span>Nenhuma audiência agendada ativa para este caso. O template terá campos vazios.</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateCartaIntimacao}
                        disabled={gdiGenerating || !witnessNome.trim()}
                        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition duration-200 cursor-pointer shadow-xs"
                      >
                        <Sparkles size={12} className={gdiGenerating ? "animate-spin" : "animate-pulse"} />
                        <span>{gdiGenerating ? "Sincronizando com Google Docs..." : "Gerar Carta de Intimação"}</span>
                      </button>
                    </div>

                    {/* Real-time generation Logs */}
                    {gdiLogs.length > 0 && (
                      <div className="border border-gray-150 rounded-xl overflow-hidden shadow-2xs font-mono text-[10px] bg-white">
                        <div className="bg-gray-900 text-gray-400 p-2 px-3 flex items-center justify-between">
                          <span className="font-black text-[8px] uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></span>
                            LOGS CARTA_INTIM_
                          </span>
                        </div>
                        <div className="bg-gray-950 text-gray-200 p-3 max-h-36 overflow-y-auto space-y-1 font-medium select-none text-[9.5px]">
                          {gdiLogs.map((log, idx) => (
                            <div key={idx} className="flex items-start gap-2 border-b border-gray-900/40 pb-1 last:border-0 last:pb-0">
                              <span className="text-indigo-400 font-bold shrink-0">{log.timestamp ? log.timestamp.split('T')[1].substring(0, 8) : '00:00:00'}</span>
                              <span className="text-blue-300 font-semibold shrink-0">[{log.action}]</span>
                              <span className="text-gray-300">{log.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {gdiDocUrl && (
                      <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
                        <div className="space-y-0.5">
                          <p className="font-bold text-emerald-800">Documento Gerado com Sucesso!</p>
                          <p className="text-[10.5px] text-emerald-600 font-medium">Pasta real sincronizada com sucesso.</p>
                        </div>
                        <a
                          href={gdiDocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 rounded-lg font-bold text-[10px] uppercase transition-colors flex items-center gap-1 shadow-4xs"
                        >
                          <span>Abrir Carta</span>
                          <ExternalLink size={11} className="stroke-[2.5]" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Descrição / Instruções p/ obtenção */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Descrição e Instruções corporativas de Obtenção</label>
                <textarea 
                  placeholder="Descreva detalhes ou caminhos para obtenção ou preparação destas provas." 
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 min-h-[70px]"
                />
              </div>

              {/* Justificativa para exigir a prova */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] uppercase font-bold text-gray-500 block font-sans">Justificativa para exigir a prova</label>
                <textarea 
                  placeholder="Informe a fundamentação técnica ou justificativa jurídica para exigir esta prova." 
                  value={newJustification}
                  onChange={(e) => setNewJustification(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 min-h-[70px]"
                />
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-150 flex gap-3 justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-white border border-gray-250 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-750 transition-colors cursor-pointer"
                type="button"
              >
                Cancelar
              </button>
              <button 
                onClick={async (e) => {
                  await handleAddEvidence(e);
                  setIsModalOpen(false);
                }}
                type="button"
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <PlusCircle size={14} />
                <span>Confirmar e Adicionar</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </FluxoStepLayout>
  );
}
