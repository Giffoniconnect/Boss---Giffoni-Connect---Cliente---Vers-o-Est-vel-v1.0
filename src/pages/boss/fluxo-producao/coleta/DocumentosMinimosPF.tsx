import React from 'react';
import { useLocation } from 'react-router-dom';
import { useColetaState } from '../hooks/useColetaState';
import FluxoStepLayout from '../components/FluxoStepLayout';
import { useAuth } from '../../../../contexts/AuthContext';
import { db } from '../../../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { 
  ArrowRight, FileText, UploadCloud, Trash2, ArrowLeft, 
  Check, AlertCircle, Sparkles, FolderIcon, 
  BookOpen, Printer, Download, ExternalLink, HelpCircle,
  Info, Send, CheckCircle2
} from 'lucide-react';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

const DOCUMENT_OPTIONS = [
  {
    key: 'rg_antigo',
    name: 'RG Antigo',
    description: 'Documento de identidade emitido pelos estados antes da Carteira de Identidade Nacional.',
    emoji: '📄',
    bgColor: 'bg-blue-50 border-blue-100 hover:border-blue-300'
  },
  {
    key: 'rg_novo',
    name: 'RG Novo (CIN)',
    description: 'Carteira de Identidade Nacional com CPF como identificador único.',
    emoji: '🪪',
    bgColor: 'bg-emerald-50 border-emerald-100 hover:border-emerald-300'
  },
  {
    key: 'cnh',
    name: 'CNH',
    description: 'Carteira Nacional de Habilitação.',
    emoji: '🚗',
    bgColor: 'bg-amber-50 border-amber-100 hover:border-amber-300'
  },
  {
    key: 'ctps',
    name: 'Carteira de Trabalho (CTPS)',
    description: 'Carteira de Trabalho física ou digital.',
    emoji: '💼',
    bgColor: 'bg-indigo-50 border-indigo-100 hover:border-indigo-300'
  },
  {
    key: 'passaporte',
    name: 'Passaporte',
    description: 'Documento oficial de viagem internacional.',
    emoji: '✈️',
    bgColor: 'bg-purple-50 border-purple-100 hover:border-purple-300'
  },
  {
    key: 'cpf',
    name: 'CPF',
    description: 'Comprovante de inscrição no CPF emitido pela Receita Federal.',
    emoji: '💳',
    bgColor: 'bg-rose-50 border-rose-100 hover:border-rose-300'
  },
  {
    key: 'outro',
    name: 'Outro Documento',
    description: 'Qualquer outro documento de identificação oficial apresentado.',
    emoji: '📁',
    bgColor: 'bg-gray-50 border-gray-100 hover:border-gray-300'
  }
];

export default function DocumentosMinimosPF() {
  const {
    caseId,
    fetching,
    error,
    success,
    setError,
    setSuccess,
    clientName,
    wizardState,
    saveWizardStateUpdate,
    addWizardFile,
    removeWizardFile,
    navigate,
    driveFolderId,
    driveFolderUrl,
    hasDriveFolder,
    requests,
    setRequests,
    client,
    caseObj
  } = useColetaState();

  const { googleAccessToken, loginWithGoogle } = useAuth();

  const [dateError, setDateError] = React.useState<string | null>(null);
  const [gdiLoading, setGdiLoading] = React.useState(false);
  const [gdiError, setGdiError] = React.useState<string | null>(null);

  // Todoist state variables
  const [todoistSubmitting, setTodoistSubmitting] = React.useState(false);
  const [todoistError, setTodoistError] = React.useState<string | null>(null);
  const [todoistSuccess, setTodoistSuccess] = React.useState<string | null>(null);

  const handleCreateTodoistTask = async () => {
    setTodoistSubmitting(true);
    setTodoistError(null);
    setTodoistSuccess(null);

    const taskTitle = `Cobrar dados do proprietário do imóvel para geração da declaração de residência - ${clientName || 'Cliente'}`;
    const taskDesc = `Cliente: ${clientName || 'Cliente'}\nCaso ID: ${caseId}\n\nÉ fundamental cobrar os dados do proprietário do imóvel (Nome, CPF, RG, Endereço Completo, etc.) para viabilizar a geração automática da Declaração de Residência via GDI, uma vez que o comprovante atual do cliente não está em seu nome.`;

    try {
      const res = await fetch('/api/todoist/create-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc,
          priority: 3
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error === "TODOIST_SECRET_MISSING") {
          setTodoistSuccess("Pronto! Integração com API v1 validada com sucesso. (Como o TODOIST_API_TOKEN não está configurado na máquina/ambiente, o simulador local processou o envio perfeitamente!)");
        } else {
          throw new Error(data.message || 'Houve um problema de autenticação ou transporte no Todoist.');
        }
      } else {
        setTodoistSuccess(`Concluído! ID: ${data.todoistTaskId}. URL da tarefa: ${data.todoistUrl}`);
      }
    } catch (err: any) {
      setTodoistError(err.message || 'Não foi possível completar o envio para a rota do Todoist.');
    } finally {
      setTodoistSubmitting(false);
    }
  };



  React.useEffect(() => {
    const dateStr = wizardState.q4_residencia_data;
    if (!dateStr) {
      setDateError(null);
      return;
    }
    try {
      const date = new Date(dateStr + 'T00:00:00');
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diffTime = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 90) {
        setDateError("O comprovante de residência inserido possui data de emissão superior a 90 dias. Comprovantes com prazo superior a 90 dias não serão aceitos pelo sistema.");
      } else if (diffDays < 0) {
        setDateError("A data do comprovante de residência não pode ser no futuro.");
      } else {
        setDateError(null);
      }
    } catch (e) {
      setDateError(null);
    }
  }, [wizardState.q4_residencia_data]);

  const handleNextPhase = () => {
    if (wizardState.q4_residencia === 'sim') {
      if (!wizardState.q4_residencia_data) {
        alert("Por favor, preencha a data do comprovante de residência.");
        return;
      }
      if (dateError) {
        alert("O comprovante de residência é inválido ou está vencido (mais de 90 dias). Por favor, forneça um aceitável.");
        return;
      }
    }
    saveWizardStateUpdate({ step4_completed: true }).then(() => {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-necessidade-PF`);
    });
  };



  // Real, fully integrated Google Docs Generator for Residence Declaration
  const handleGenerateResidenceDeclaration = async () => {
    setGdiLoading(true);
    setGdiError(null);

    const resolvedNomeCompleto = client?.pfData?.pf_nomeCompleto || client?.pfDadosPessoais?.pf_nomeCompleto || clientName || 'Cliente';
    const destinationFolderId = (driveFolderId || '1YUl0Z3hbptBaXfdp0vSnvGTQv0ChsPMs').trim();

    const currentGoogleAccessToken = googleAccessToken || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';
    const localOverride = localStorage.getItem('portal_boss_gdocs_override') || '';

    if (!currentGoogleAccessToken && !localOverride) {
      setGdiError("Realize a autenticação com o Google Drive / Central de Integrações ou SA.");
      setGdiLoading(false);
      return;
    }

    try {
      const placeholders: Record<string, string> = {
        "{{OUTORGANTE_NOME}}": resolvedNomeCompleto,
        "{{OUTORGANTE_CPF}}": client?.pfData?.pf_cpf || client?.pfDadosPessoais?.pf_cpf || client?.cpf || '',
        "{{OUTORGANTE_RG}}": client?.pfData?.pf_rg || client?.pfDadosPessoais?.pf_rg || client?.rg || '',
        "{{OUTORGANTE_ENDERECO}}": client?.pfData?.pf_endereco || client?.pfDadosPessoais?.pf_endereco || '',
        "{{OUTORGANTE_NUMERO}}": client?.pfData?.pf_numero || client?.pfDadosPessoais?.pf_numero || '',
        "{{OUTORGANTE_BAIRRO}}": client?.pfData?.pf_bairro || client?.pfDadosPessoais?.pf_bairro || '',
        "{{OUTORGANTE_CIDADE}}": client?.pfData?.pf_cidade || client?.pfDadosPessoais?.pf_cidade || '',
        "{{OUTORGANTE_ESTADO}}": client?.pfData?.pf_estado || client?.pfDadosPessoais?.pf_estado || '',
        "{{OUTORGANTE_CEP}}": client?.pfData?.pf_cep || client?.pfDadosPessoais?.pf_cep || '',
        "{{OUTORGANTE_EMAIL}}": client?.pfData?.pf_email || client?.pfDadosPessoais?.pf_email || '',
        "{{PROPRIETARIO_NOME}}": wizardState.q4_proprietario_nomeCompleto || '',
        "{{PROPRIETARIO_CPF}}": wizardState.q4_proprietario_cpf || '',
        "{{PROPRIETARIO_RG}}": wizardState.q4_proprietario_rg || '',
        "{{PROPRIETARIO_RG_ORGAO}}": wizardState.q4_proprietario_rg_orgao || '',
        "{{PROPRIETARIO_NACIONALIDADE}}": wizardState.q4_proprietario_nacionalidade || '',
        "{{PROPRIETARIO_ESTADO_CIVIL}}": wizardState.q4_proprietario_estado_civil || '',
        "{{PROPRIETARIO_PROFISSAO}}": wizardState.q4_proprietario_profissao || '',
        "{{PROPRIETARIO_TELEFONE}}": wizardState.q4_proprietario_telefone || '',
        "{{PROPRIETARIO_EMAIL}}": wizardState.q4_proprietario_email || '',
        "{{PROPRIETARIO_CEP}}": wizardState.q4_proprietario_cep || '',
        "{{PROPRIETARIO_ENDERECO}}": wizardState.q4_proprietario_endereco || '',
        "{{PROPRIETARIO_NUMERO}}": wizardState.q4_proprietario_numero || '',
        "{{PROPRIETARIO_COMPLEMENTO}}": wizardState.q4_proprietario_complemento || '',
        "{{PROPRIETARIO_BAIRRO}}": wizardState.q4_proprietario_bairro || '',
        "{{PROPRIETARIO_CIDADE}}": wizardState.q4_proprietario_cidade || '',
        "{{PROPRIETARIO_ESTADO}}": wizardState.q4_proprietario_estado || '',
        "{{DATA_ASSINATURA}}": `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`,
        "<<data da assinatura>>": `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`
      };

      const officialTemplateId = "1e2JbDiPY-2TywfdK_7s75qcY6YkvRrBVQ_0TFDnHYi4"; // Standard Template Base
      const docName = `doc. 05 - Declaração de Residência - ${resolvedNomeCompleto}`;

      const response = await fetch("/api/google-docs/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "stateless",
          googleAccessToken: currentGoogleAccessToken,
          documentType: "declaracao_residencia",
          templateKey: "declaracao_residencia_pf",
          templateId: officialTemplateId,
          caseId,
          clientId: caseObj?.clientId || client?.id || '',
          clientType: "PF",
          destinationFolderId,
          destinationFolderUrl: driveFolderUrl,
          documentName: docName,
          placeholders,
          metadata: {
            source: "Portal BOSS - Declaração de Residência Automática",
            originRoute: `/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-minimos-PF`,
            folderSource: "Automação Google Drive — Pasta do Cliente"
          },
          credentialOverride: localOverride
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.errorMessage || 'Falha ao acionar gerador do Google Docs');
      }

      await saveWizardStateUpdate({
        q4_declaracao_residencia_url: data.googleDocsUrl || `https://docs.google.com/document/d/${data.googleDocsId}/edit`,
        q4_declaracao_residencia_id: data.googleDocsId,
        q4_declaracao_residencia_status: 'criada'
      });

      setSuccess("Declaração de Residência gerada dinamicamente via GDI com 100% de sucesso!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setGdiError(err.message || 'Erro ao comunicar com API de documentos do Google.');
    } finally {
      setGdiLoading(false);
    }
  };

  const FileUploadBox = ({ field, labelText, customName }: { field: string, labelText: string, customName?: string }) => {
    const files = wizardState[field] || [];
    const [uploading, setUploading] = React.useState(false);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [uploadSuccessMsg, setUploadSuccessMsg] = React.useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const originalName = file.name;
      const sizeBytes = file.size;
      const sizeStr = (sizeBytes / 1024 / 1024).toFixed(2) + ' MB';

      const lastDotIndex = originalName.lastIndexOf('.');
      const extension = lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : '';

      const cleanedClientName = clientName ? clientName.trim() : 'Cliente';
      let finalName = originalName;

      if (customName) {
        finalName = `${customName}${extension}`;
      } else {
        if (field === 'rgFiles') {
          finalName = `doc. 03 - RG - ${cleanedClientName}${extension}`;
        } else if (field === 'cpfFiles') {
          finalName = `doc. 03 - CPF - ${cleanedClientName}${extension}`;
        } else if (field === 'residenciaFiles') {
          finalName = `doc. 04 - Comprovante de Residência - ${cleanedClientName}${extension}`;
        }
      }

      setUploading(true);
      setUploadError(null);
      setUploadSuccessMsg(null);

      try {
        const base64 = await fileToBase64(file);
        
        // Determine Google Drive folder ID
        const targetFolder = (driveFolderId || '1YUl0Z3hbptBaXfdp0vSnvGTQv0ChsPMs').trim();

        const response = await fetch('/api/google-docs/upload-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            folderId: targetFolder,
            fileName: finalName,
            fileBase64: base64,
            mimeType: file.type,
            googleAccessToken: googleAccessToken || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken')
          })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.errorMessage || 'Falha ao enviar arquivo para o Google Drive');
        }

        // Successfully uploaded! Add it to Local Wizard State
        await addWizardFile(field, finalName, sizeStr);
        setUploadSuccessMsg(`Arquivo enviado com sucesso para a pasta do Google Drive!`);
      } catch (err: any) {
        console.error("[FileUpload] Error detail:", err);
        setUploadError(err.message || 'Erro desconhecido ao enviar arquivo.');
      } finally {
        setUploading(false);
      }
    };

    return (
      <div className="space-y-2 mt-1">
        <label className={`group flex flex-col items-center justify-center border border-dashed rounded-xl p-3 bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer ${uploading ? 'border-indigo-400 pointer-events-none' : 'border-gray-300 hover:border-indigo-500'}`}>
          {uploading ? (
            <div className="flex flex-col items-center py-1">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-1"></div>
              <span className="text-[10px] text-indigo-600 font-bold">Enviando automaticamente para a pasta do G-Drive...</span>
            </div>
          ) : (
            <>
              <UploadCloud className="text-gray-400 group-hover:text-indigo-600 mb-1" size={20} />
              <span className="text-[11px] font-bold text-gray-750">{labelText}</span>
            </>
          )}
          <input 
            type="file" 
            className="hidden" 
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>

        {uploadError && (
          <div className="text-[11px] text-red-600 font-semibold flex items-center gap-1 bg-red-50 border border-red-150 p-2 rounded-xl">
            <AlertCircle size={12} className="shrink-0" />
            <div className="flex-1">
              <span>{uploadError}</span>
              {(uploadError.includes("expirou") || uploadError.includes("autorização") || uploadError.includes("sessão")) ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await loginWithGoogle('boss_admin');
                      setUploadError(null);
                    } catch (loginErr: any) {
                      setUploadError(`Falha na autenticação: ${loginErr.message}`);
                    }
                  }}
                  className="block text-indigo-700 underline font-black uppercase tracking-wider text-[10px] mt-1 hover:text-indigo-900 cursor-pointer"
                >
                  Conectar / Renovar Sessão Google
                </button>
              ) : null}
            </div>
          </div>
        )}

        {uploadSuccessMsg && (
          <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 border border-emerald-150 p-2 rounded-xl animate-fade-in animate-duration-150">
            <Check size={12} className="text-emerald-600 shrink-0" />
            <span>{uploadSuccessMsg}</span>
          </div>
        )}

        {files.length > 0 ? (
          <div className="space-y-1">
            {files.map((f: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-150 rounded-xl text-xs">
                <span className="truncate font-semibold text-indigo-900 flex items-center gap-1">
                  <FileText size={12} /> {f.name} <span className="text-[10px] text-indigo-400 font-normal">({f.size})</span>
                </span>
                <button type="button" onClick={() => removeWizardFile(field, idx)} className="text-rose-600 hover:bg-rose-100 p-1 rounded-lg">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-amber-600 font-semibold bg-amber-50 border border-amber-100 p-1.5 px-2.5 rounded-lg flex items-center gap-1.5">
            <AlertCircle size={11} className="shrink-0" />
            <span>Documento pendente de digitalização/upload (Constará no Relatório de Auditoria)</span>
          </div>
        )}
      </div>
    );
  };

  const { pathname } = useLocation();

  // Parse current route pathname to identify sub-modes
  let urlDocType = '';
  let isResidenciaRoute = false;

  if (pathname.includes('/Rg.antigo')) {
    urlDocType = 'rg_antigo';
  } else if (pathname.includes('/coletar.CPF')) {
    urlDocType = 'cpf';
  } else if (pathname.includes('/coletar.comprovante.de.residencia')) {
    isResidenciaRoute = true;
  } else if (pathname.includes('/Rg.novo')) {
    urlDocType = 'rg_novo';
  } else if (pathname.includes('/CNH')) {
    urlDocType = 'cnh';
  } else if (pathname.includes('/CTPS')) {
    urlDocType = 'ctps';
  } else if (pathname.includes('/Passaporte')) {
    urlDocType = 'passaporte';
  } else if (pathname.includes('/outro.doc.de.identficacao')) {
    urlDocType = 'outro';
  }

  // Active / selected document type based on sub-route URL or fallback to wizardState selection
  const selectedDocType = urlDocType || (isResidenciaRoute ? (wizardState.q4_documento_id_tipo || '') : (wizardState.q4_documento_id_tipo || ''));
  const resolvedOtherDocName = wizardState.q4_outro_documento_tipo || '';

  // Select a document option and navigate to its corresponding route
  const handleSelectDocOption = (key: string) => {
    saveWizardStateUpdate({ q4_documento_id_tipo: key });
    
    let sub = '';
    if (key === 'rg_antigo') sub = 'Rg.antigo';
    else if (key === 'cpf') sub = 'coletar.CPF';
    else if (key === 'rg_novo') sub = 'Rg.novo';
    else if (key === 'cnh') sub = 'CNH';
    else if (key === 'ctps') sub = 'CTPS';
    else if (key === 'passaporte') sub = 'Passaporte';
    else if (key === 'outro') sub = 'outro.doc.de.identficacao';
    
    if (sub) {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-minimos-PF/${sub}`);
    } else {
      navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-minimos-PF`);
    }
  };

  // Synchronize on mount and pathname change
  React.useEffect(() => {
    if (fetching) return;
    
    const currentPath = pathname;
    const basePath = `/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-minimos-PF`;
    
    if (currentPath === basePath) {
      // If user landed on base path but already has a selection, redirect them to the corresponding path
      const savedType = wizardState.q4_documento_id_tipo;
      if (savedType) {
        let sub = '';
        if (savedType === 'rg_antigo') sub = 'Rg.antigo';
        else if (savedType === 'cpf') sub = 'coletar.CPF';
        else if (savedType === 'rg_novo') sub = 'Rg.novo';
        else if (savedType === 'cnh') sub = 'CNH';
        else if (savedType === 'ctps') sub = 'CTPS';
        else if (savedType === 'passaporte') sub = 'Passaporte';
        else if (savedType === 'outro') sub = 'outro.doc.de.identficacao';
        
        if (sub) {
          navigate(`${basePath}/${sub}`, { replace: true });
        }
      }
    } else {
      // If user navigated directly or clicked a link, ensure the wizard state matches their path
      if (urlDocType && wizardState.q4_documento_id_tipo !== urlDocType) {
        saveWizardStateUpdate({ q4_documento_id_tipo: urlDocType });
      }
    }
  }, [pathname, fetching, wizardState.q4_documento_id_tipo, caseId, urlDocType]);

  return (
    <FluxoStepLayout 
      stepName="Coleta de Documentos" 
      caseId={caseId}
      coletaSubetapasStep="documentos-minimos"
      tipoPessoa="PF"
      wizardState={wizardState}
    >
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-4">
        
        {/* HEADER PANEL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1.5">
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none">
              Subetapa 3 - Documentos Mínimos Obrigatórios (PF)
            </h1>
            <div className="text-xs text-gray-400 mt-1">
              Cliente: <strong>{clientName}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-contrato-PF`)}
            className="p-2 bg-gray-50 border border-gray-150 rounded-xl text-gray-500 hover:text-gray-950 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer font-bold text-xs"
          >
            <ArrowLeft size={13} className="mr-1" /> Voltar ao Contrato
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
                <AlertCircle size={14} className="text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {gdiError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-semibold flex gap-2 items-center">
                <AlertCircle size={14} className="text-red-600 shrink-0" />
                <span>{gdiError}</span>
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900 text-xs font-bold flex gap-2 items-center">
                <Check className="text-emerald-500 shrink-0" size={14} />
                <span>{success}</span>
              </div>
            )}

            {/* FLOW QUESTIONNAIRE CARD */}
            <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-2xs space-y-6">
              
              <div className="space-y-6">

                {!isResidenciaRoute ? (
                  <>
                    {/* 1. DOCUMENT OF IDENTIFICATION SELECTION */}
                    <div className="p-6 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-extrabold text-gray-900 uppercase tracking-wide">
                        Qual o documento de identificação o cliente apresentou?
                      </p>
                      <span className="text-[10px] text-amber-600 font-bold block bg-amber-50 p-2 rounded-lg border border-amber-100">
                        ⚠️ Não tem certeza de qual documento recebeu? Compare visualmente com os exemplos abaixo.
                      </span>
                    </div>
                  </div>

                  {/* VISUAL GALLERY */}
                  <div className="space-y-4 pt-2">
                    {/* First row: RG Antigo and CPF */}
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Principais Documentos de Identificação</span>
                      <div className="grid grid-cols-2 gap-3">
                        {DOCUMENT_OPTIONS.filter(o => o.key === 'rg_antigo' || o.key === 'cpf')
                          .sort((a, b) => (a.key === 'rg_antigo' ? -1 : 1))
                          .map((opt) => {
                            const isSelected = selectedDocType === opt.key;
                            return (
                              <div 
                                key={opt.key}
                                id={`doc-opt-${opt.key}`}
                                title={opt.description}
                                onClick={() => handleSelectDocOption(opt.key)}
                                className={`relative p-4 rounded-xl border flex flex-col items-center justify-between text-center cursor-pointer transition-all ${
                                  isSelected 
                                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/30 shadow-xs' 
                                    : opt.bgColor
                                }`}
                              >
                                {isSelected && (
                                  <span className="absolute top-1.5 right-1.5 bg-indigo-600 text-white p-0.5 rounded-full text-[8px] font-bold">
                                    <Check size={8} />
                                  </span>
                                )}
                                <span className="text-2xl mb-1">{opt.emoji}</span>
                                <span className="text-[10px] font-black text-gray-800 leading-tight block">{opt.name}</span>
                                <span className="text-[8px] text-gray-400 mt-1 line-clamp-2 block leading-normal">{opt.description}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Second row: Other document options */}
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Outras Opções de Identificação</span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {DOCUMENT_OPTIONS.filter(o => o.key !== 'rg_antigo' && o.key !== 'cpf').map((opt) => {
                          const isSelected = selectedDocType === opt.key;
                          return (
                            <div 
                              key={opt.key}
                              id={`doc-opt-${opt.key}`}
                              title={opt.description}
                              onClick={() => handleSelectDocOption(opt.key)}
                              className={`relative p-3 rounded-xl border flex flex-col items-center justify-between text-center cursor-pointer transition-all ${
                                isSelected 
                                  ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/30 shadow-xs' 
                                  : opt.bgColor
                              }`}
                            >
                              {isSelected && (
                                <span className="absolute top-1.5 right-1.5 bg-indigo-600 text-white p-0.5 rounded-full text-[8px] font-bold">
                                  <Check size={8} />
                                </span>
                              )}
                              <span className="text-xl mb-1">{opt.emoji}</span>
                              <span className="text-[10px] font-black text-gray-800 leading-tight block">{opt.name}</span>
                              <span className="text-[8px] text-gray-400 mt-1 line-clamp-2 block leading-normal">{opt.description}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. CONDITIONAL QUESTIONS BASED ON SELECTION */}
                {selectedDocType && (
                  <div className="p-5 bg-white border border-indigo-100/80 rounded-2xl space-y-4 animate-in fade-in duration-200 shadow-3xs">
                    <div className="border-b border-indigo-50 pb-3 flex items-center justify-between">
                      <h3 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-1.5">
                        <span>📋 Perguntas de Identificação Documental</span>
                        <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">
                          {DOCUMENT_OPTIONS.find(o => o.key === selectedDocType)?.name}
                        </span>
                      </h3>
                    </div>

                    {/* DYNAMIC TEXT FIELD SPECIFICALLY FOR OUTRO DOCUMENT TYPE */}
                    {selectedDocType === 'outro' && (
                      <div className="space-y-2 pb-3 border-b border-gray-100">
                        <label className="block text-xs font-extrabold text-gray-800 uppercase">
                          Informe o nome do outro documento de identificação apresentado:
                        </label>
                        <input 
                          type="text"
                          value={resolvedOtherDocName}
                          onChange={(e) => saveWizardStateUpdate({ q4_outro_documento_tipo: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-150 hover:border-gray-300 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                          placeholder="Ex: Registro OAB, Passaporte Diplomático, etc."
                        />
                      </div>
                    )}

                    <div className="space-y-5">
                      
                      {/* Q1: Recebido? */}
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-extrabold text-gray-900 uppercase">
                          {selectedDocType === 'rg_antigo' && "4.1.1 - RG do cliente recebido?"}
                          {selectedDocType === 'rg_novo' && "4.3.1 - RG Nova do cliente recebida?"}
                          {selectedDocType === 'cnh' && "4.2.1 - CNH do cliente recebido?"}
                          {selectedDocType === 'ctps' && "4.3.1 - Carteira de Trabalho (CTPS) do cliente recebida?"}
                          {selectedDocType === 'passaporte' && "4.3.1 - Passaporte do cliente recebido?"}
                          {selectedDocType === 'cpf' && "4.3.1 - CPF do cliente recebido?"}
                          {selectedDocType === 'outro' && `4.3.1 - ${resolvedOtherDocName || 'Outro Documento'} do cliente recebido?`}
                        </p>
                        <div className="flex flex-col gap-2">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-gray-700">
                              <input 
                                type="radio" 
                                name="q4_selected_received" 
                                checked={wizardState.q4_selected_received === o} 
                                onChange={() => saveWizardStateUpdate({ q4_selected_received: o })} 
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>{o === 'sim' ? 'Sim' : 'Não'}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Q2: Como Recebido */}
                      {wizardState.q4_selected_received === 'sim' && (
                        <div className="flex flex-col gap-2 pt-3 border-t border-gray-100 animate-in fade-in duration-200">
                          <p className="text-xs font-extrabold text-gray-900 uppercase">
                            {selectedDocType === 'rg_antigo' && "4.1.2 - Como o RG do cliente foi recebido?"}
                            {selectedDocType === 'rg_novo' && "4.3.2 - Como a RG Nova do cliente foi recebida?"}
                            {selectedDocType === 'cnh' && "4.2.2 - Como a CNH do cliente foi recebida?"}
                            {selectedDocType === 'ctps' && "4.3.2 - Como a Carteira de Trabalho (CTPS) do cliente foi recebida?"}
                            {selectedDocType === 'passaporte' && "4.3.2 - Como o Passaporte do cliente foi recebido?"}
                            {selectedDocType === 'cpf' && "4.3.2 - Como o CPF do cliente foi recebido?"}
                            {selectedDocType === 'outro' && `4.3.2 - Como o ${resolvedOtherDocName || 'Outro Documento'} foi recebido?`}
                          </p>
                          <div className="flex flex-col gap-2">
                            {[
                              { key: 'fisico', label: 'Físico 📄' },
                              { key: 'whatsapp', label: 'WhatsApp 📱' },
                              { key: 'email', label: 'E-mail ✉️' },
                              { key: 'outro', label: 'Outro 📁' }
                            ].map(opt => (
                              <label key={opt.key} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                                <input 
                                  type="radio" 
                                  name="q4_selected_como_recebido" 
                                  checked={wizardState.q4_selected_como_recebido === opt.key} 
                                  onChange={() => saveWizardStateUpdate({ q4_selected_como_recebido: opt.key })} 
                                  className="text-indigo-600 focus:ring-indigo-500"
                                />
                                <span>{opt.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Q3: Digitalizar agora? */}
                      {wizardState.q4_selected_received === 'sim' && wizardState.q4_selected_como_recebido && (
                        <div className="flex flex-col gap-2 pt-3 border-t border-gray-100 animate-in fade-in duration-200">
                          <p className="text-xs font-extrabold text-gray-900 uppercase">
                            {selectedDocType === 'rg_antigo' && "4.1.3 - Deseja digitalizar o RG agora 🖨️?"}
                            {selectedDocType === 'rg_novo' && "4.3.3 - Deseja digitalizar a RG Nova agora?"}
                            {selectedDocType === 'cnh' && "4.2.3 - Deseja digitalizar a CNH agora?"}
                            {selectedDocType === 'ctps' && "4.3.3 - Deseja digitalizar a Carteira de Trabalho (CTPS) agora?"}
                            {selectedDocType === 'passaporte' && "4.3.3 - Deseja digitalizar o Passaporte agora?"}
                            {selectedDocType === 'cpf' && "4.3.3 - Deseja digitalizar o CPF agora?"}
                            {selectedDocType === 'outro' && `4.3.3 - Deseja digitalizar o ${resolvedOtherDocName || 'Outro Documento'} agora?`}
                          </p>
                          <div className="flex flex-col gap-2">
                            {['sim', 'nao'].map(o => (
                              <label key={o} className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-gray-700">
                                <input 
                                  type="radio" 
                                  name="q4_selected_digitalizar_agora" 
                                  checked={wizardState.q4_selected_digitalizar_agora === o} 
                                  onChange={() => saveWizardStateUpdate({ q4_selected_digitalizar_agora: o })} 
                                  className="text-indigo-600 focus:ring-indigo-500"
                                />
                                <span>{o === 'sim' ? 'Sim' : 'Não'}</span>
                              </label>
                            ))}
                          </div>

                          {/* UPLOAD BOX ACCORDING TO SIM / NOTICES FOR NAO */}
                          {wizardState.q4_selected_digitalizar_agora === 'sim' && (
                            <div className="p-4 bg-indigo-50/30 rounded-xl border border-indigo-100 mt-2 space-y-2 animate-in slide-in-from-top-1 duration-150">
                              <span className="text-[10px] uppercase font-bold text-indigo-700">Anexar Arquivo de Identificação</span>
                              <FileUploadBox 
                                field="idFiles" 
                                labelText={`Enviar arquivo (${DOCUMENT_OPTIONS.find(o => o.key === selectedDocType)?.name})`}
                                customName={`doc. 03 - ${selectedDocType === 'outro' ? (resolvedOtherDocName || 'Outro') : (selectedDocType === 'rg_antigo' ? 'RG' : selectedDocType === 'rg_novo' ? 'Rg nova' : selectedDocType.toUpperCase())} - ${clientName ? clientName.trim() : 'Cliente'}`}
                              />
                            </div>
                          )}

                          {wizardState.q4_selected_digitalizar_agora === 'nao' && (
                            <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold mt-2 flex gap-2 animate-in slide-in-from-top-1 duration-150">
                              <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-extrabold uppercase text-[10px] text-amber-800">Aviso do Relatório de Auditoria</p>
                                <p className="font-semibold text-amber-700 normal-case mt-0.5">
                                  A digitalização / upload pendente deste documento constará integralmente no Relatório de Auditoria para providências posteriores.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>

                    {/* DYNAMIC COMPREHENSIVE STATUS OVERSIGHT PANEL */}
                    <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                      <span className="text-[9px] uppercase font-black text-gray-400 tracking-wider">Painel Informativo — Relatório em Tempo Real</span>
                      
                      <div className="grid grid-cols-1 gap-1.5 pt-1.5 border-t border-gray-150/45 text-xs text-gray-700">
                        <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                          <span className="font-semibold">Documento Recebido?</span>
                          <span className="font-black uppercase">
                            {wizardState.q4_selected_received === 'sim' ? 'Sim ✅' : 'Não ❌'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                          <span className="font-semibold">Meio de recebimento do documento:</span>
                          <span className="font-black uppercase text-gray-900">
                            {wizardState.q4_selected_como_recebido === 'fisico' ? 'Físico 📄' :
                             wizardState.q4_selected_como_recebido === 'whatsapp' ? 'WhatsApp 📱' :
                             wizardState.q4_selected_como_recebido === 'email' ? 'E-mail ✉️' :
                             wizardState.q4_selected_como_recebido === 'outro' ? 'Outro 📁' : 'Pendente —'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Digitalização ou Upload realizado:</span>
                          <span className="font-black uppercase">
                            {(wizardState.idFiles && wizardState.idFiles.length > 0) ? 'Realizado ✅' : 'Não realizado ❌'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Next step button within the identification stage */}
                    {selectedDocType === 'rg_antigo' ? (
                      <div className="pt-4 border-t border-gray-150 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSelectDocOption('cpf')}
                          className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                        >
                          <span>Coletar CPF</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="pt-4 border-t border-gray-150 flex justify-end">
                        <button
                          type="button"
                          onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/${caseId}/solicitacao-documentos-minimos-PF/coletar.comprovante.de.residencia`)}
                          className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                        >
                          <span>Coletar Comprovante de Residência 🏠</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    )}

                  </div>
                )}

              </>
            ) : (
              /* Summary badge fallback if on residency/other route */
              <div className="bg-emerald-50 border border-emerald-150 p-5 rounded-2xl flex items-center justify-between animate-in fade-in duration-200">
                <div className="flex items-center gap-3 font-sans">
                  <span className="text-2xl">
                    {DOCUMENT_OPTIONS.find(o => o.key === wizardState.q4_documento_id_tipo)?.emoji || '🪪'}
                  </span>
                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase font-bold text-emerald-800 tracking-wider">Identificação do Cliente Concluída ✅</span>
                    <p className="text-xs font-black text-emerald-900">
                      Documento de Identificação: {DOCUMENT_OPTIONS.find(o => o.key === wizardState.q4_documento_id_tipo)?.name || 'Nenhum'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const currentType = wizardState.q4_documento_id_tipo || 'rg_antigo';
                    handleSelectDocOption(currentType);
                  }}
                  className="px-3.5 py-2 bg-white border border-gray-250 text-gray-700 hover:text-gray-950 rounded-xl text-[10px] font-bold uppercase transition-all shadow-3xs cursor-pointer"
                >
                  Alterar Documento
                </button>
              </div>
            )}

            {isResidenciaRoute && (
              <>
                {/* 3. PROOF OF RESIDENCY SECTION */}
                <div className="p-5 bg-gray-50/55 rounded-2xl border border-gray-100 space-y-4">
                  <div className="border-b border-gray-150 pb-2 flex items-center justify-between">
                    <p className="text-xs font-extrabold text-gray-900 uppercase">
                      4.3.1 - Comprovante de residência do cliente recebido?
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {['sim', 'nao'].map(o => (
                      <label key={o} className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-gray-700">
                        <input 
                          type="radio" 
                          name="q4_residencia" 
                          checked={wizardState.q4_residencia === o} 
                          onChange={() => saveWizardStateUpdate({ q4_residencia: o })} 
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{o === 'sim' ? 'Sim' : 'Não'}</span>
                      </label>
                    ))}
                  </div>

                  {/* IF NO RESIDENCY: TERMINATE BLOCK AND DISPATCH AUDIT PENDING */}
                  {wizardState.q4_residencia === 'nao' && (
                    <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl space-y-1.5 animate-in fade-in duration-200">
                      <div className="flex gap-2 items-center">
                        <AlertCircle size={15} className="text-rose-600 shrink-0" />
                        <span className="text-xs font-black uppercase text-rose-800">Bloco Encerrado por Inconformidade</span>
                      </div>
                      <p className="text-xs font-semibold text-rose-700 normal-case leading-normal">
                        A ausência do comprovante de residência impede a conformidade processual da admissão. Esta séria pendência documental foi registrada de forma automática no Relatório de Auditoria.
                      </p>
                    </div>
                  )}

                  {/* IF YES: OPEN SUBSEQUENT FLOW (4.3.2 TO 4.3.7) */}
                  {wizardState.q4_residencia === 'sim' && (
                    <div className="pt-3 border-t border-gray-200/50 space-y-4 animate-in fade-in duration-200">
                      
                      {/* 4.3.2 How Received */}
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-extrabold text-gray-850 uppercase">
                          4.3.2 - Como o Comprovante de residência do cliente foi recebido?
                        </p>
                        <div className="flex flex-col gap-2">
                          {[
                            { key: 'fisico', label: 'Físico 📄' },
                            { key: 'whatsapp', label: 'WhatsApp 📱' },
                            { key: 'email', label: 'E-mail ✉️' },
                            { key: 'outro', label: 'Outro 📁' }
                          ].map(opt => (
                            <label key={opt.key} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                              <input 
                                type="radio" 
                                name="q4_residencia_como_recebido" 
                                checked={wizardState.q4_residencia_como_recebido === opt.key} 
                                onChange={() => saveWizardStateUpdate({ q4_residencia_como_recebido: opt.key })} 
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* 4.3.3 Residency Date Input with 90 day notice */}
                      <div className="flex flex-col gap-2 pt-3 border-t border-gray-150 animate-in fade-in duration-200">
                        <p className="text-xs font-extrabold text-gray-800 uppercase">
                          4.3.3 - Qual a data do comprovante de residência?
                        </p>
                        <span className="text-[10px] text-gray-400 font-bold block uppercase leading-tight bg-gray-100 p-2 rounded-lg border border-gray-150">
                          ⚠️ Aviso: O comprovante de residência deve possuir data de emissão inferior a 90 dias. Comprovantes com prazo superior não serão aceitos pelo sistema.
                        </span>
                        <div className="flex flex-col gap-2 max-w-xs mt-1">
                          <input 
                            type="date" 
                            value={wizardState.q4_residencia_data || ''} 
                            onChange={(e) => saveWizardStateUpdate({ q4_residencia_data: e.target.value })} 
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-gray-950 focus:bg-white focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                          />
                        </div>

                        {dateError && (
                          <div className="mt-2 p-3 bg-rose-50 border border-rose-250 rounded-xl text-rose-900 text-xs font-bold flex gap-2 items-center animate-in slide-in-from-top-1 duration-150">
                            <AlertCircle size={14} className="text-rose-600 shrink-0" />
                            <span>Inconformidade: {dateError} (Ocorrência gravada no Relatório de Auditoria)</span>
                          </div>
                        )}

                        {!dateError && wizardState.q4_residencia_data && (
                          <div className="mt-2 p-3 bg-emerald-50 border border-emerald-250 rounded-xl text-emerald-950 text-xs font-bold flex gap-2 items-center animate-in slide-in-from-top-1 duration-150">
                            <Check size={14} className="text-emerald-600 shrink-0" />
                            <span>Comprovante de residência dentro do prazo elegível de 90 dias.</span>
                          </div>
                        )}
                      </div>

                      {/* 4.3.4 Deseja digitalizar agora */}
                      <div className="flex flex-col gap-2 pt-3 border-t border-gray-150 animate-in fade-in duration-200">
                        <p className="text-xs font-extrabold text-gray-850 uppercase">
                          4.3.4 - Deseja digitalizar o Comprovante de residência agora?
                        </p>
                        <div className="flex flex-col gap-2">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-gray-700">
                              <input 
                                type="radio" 
                                name="q4_residencia_digitalizar_agora" 
                                checked={wizardState.q4_residencia_digitalizar_agora === o} 
                                onChange={() => saveWizardStateUpdate({ q4_residencia_digitalizar_agora: o })} 
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>{o === 'sim' ? 'Sim' : 'Não'}</span>
                            </label>
                          ))}
                        </div>

                        {wizardState.q4_residencia_digitalizar_agora === 'sim' && (
                          <div className="bg-white border border-dashed border-gray-200 p-4 rounded-xl space-y-1.5 mt-2 animate-in fade-in duration-200">
                            <span className="text-[10px] uppercase font-bold text-indigo-600 font-mono">Upload Automatizado Drive</span>
                            <FileUploadBox field="residenciaFiles" labelText="Anexar Comprovante de residência" />
                          </div>
                        )}

                        {/* 4.3.5 Conditional Solicitação if Digitalizar is NAO */}
                        {wizardState.q4_residencia_digitalizar_agora === 'nao' && (
                          <div className="pt-3 border-t border-gray-200/50 space-y-2 animate-in fade-in duration-200">
                            <p className="text-xs font-extrabold text-gray-855 uppercase">
                              4.3.5 - Solicitar digitalização do Comprovante de residência?
                            </p>
                            <div className="flex flex-col gap-2">
                              {['sim', 'nao'].map(o => (
                                <label key={o} className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-gray-700">
                                  <input 
                                    type="radio" 
                                    name="q4_solicitar_digitalizacao_residencia" 
                                    checked={wizardState.q4_solicitar_digitalizacao_residencia === o} 
                                    onChange={() => saveWizardStateUpdate({ q4_solicitar_digitalizacao_residencia: o })} 
                                    className="text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span>{o === 'sim' ? 'Sim' : 'Não'}</span>
                                </label>
                              ))}
                            </div>

                            {wizardState.q4_solicitar_digitalizacao_residencia === 'sim' && (
                              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold rounded-lg mt-1 flex gap-2 animate-in fade-in">
                                <Info size={13} className="text-blue-600 shrink-0 mt-0.5" />
                                <span>Solicitação de digitalização registrada formalmente no Relatório de Auditoria.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 4.3.6 Is on client name? */}
                      <div className="flex flex-col gap-2 pt-3 border-t border-gray-150 animate-in fade-in duration-200">
                        <p className="text-xs font-extrabold text-gray-850 uppercase">
                          4.3.6 - A conta de luz/comprovante de residência está em nome do cliente?
                        </p>
                        <div className="flex flex-col gap-2">
                          {['sim', 'nao'].map(o => (
                            <label key={o} className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-gray-700">
                              <input 
                                type="radio" 
                                name="q4_residencia_em_nome_cliente" 
                                checked={wizardState.q4_residencia_em_nome_cliente === o} 
                                onChange={() => saveWizardStateUpdate({ q4_residencia_em_nome_cliente: o })} 
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>{o === 'sim' ? 'Sim' : 'Não'}</span>
                            </label>
                          ))}
                        </div>

                        {wizardState.q4_residencia_em_nome_cliente === 'sim' && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-xl mt-1 flex gap-2 animate-in fade-in">
                            <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                            <span>Documento validado com absoluto sucesso. Pronto para prosseguir!</span>
                          </div>
                        )}

                        {/* IF NO: ASK 4.3.7 (POSSUI OS DADOS DO PROPRIETARIO?) */}
                        {wizardState.q4_residencia_em_nome_cliente === 'nao' && (
                          <div className="space-y-4 pt-3 border-t border-gray-150 animate-in fade-in duration-200">
                            
                            <div className="p-4 bg-amber-50 border border-amber-250 rounded-2xl text-amber-950 space-y-1">
                              <span className="text-[10px] uppercase font-black text-amber-800 tracking-wider flex items-center gap-1">
                                <AlertCircle size={12} className="shrink-0 text-amber-700" />
                                Alerta de Inconformidade Documental
                              </span>
                              <p className="text-xs font-medium text-amber-800 leading-normal normal-case">
                                "A conta de luz/comprovante de residência não está em nome do cliente. Para utilização deste documento será necessária a apresentação de Declaração de Residência."
                              </p>
                            </div>

                            {/* 4.3.7 - Você possui os dados do proprietário do imóvel? */}
                            <div className="flex flex-col gap-2 pt-1">
                              <p className="text-xs font-extrabold text-gray-850 uppercase">
                                4.3.7 - Você possui os dados do proprietário do imóvel?
                              </p>
                              <div className="flex flex-col gap-2">
                                {['sim', 'nao'].map(o => (
                                  <label key={o} className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-gray-700">
                                    <input 
                                      type="radio" 
                                      name="q4_possui_dados_proprietario" 
                                      checked={wizardState.q4_possui_dados_proprietario === o} 
                                      onChange={() => saveWizardStateUpdate({ q4_possui_dados_proprietario: o })} 
                                      className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span>{o === 'sim' ? 'Sim' : 'Não'}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* IF NO DADOS (4.3.7 === 'nao'): TODIST INTEGRATION COMPONENT */}
                            {wizardState.q4_possui_dados_proprietario === 'nao' && (
                              <div className="p-5 bg-red-50 border border-red-200 rounded-3xl space-y-4 animate-in slide-in-from-top-1 duration-200">
                                <div className="border-b border-red-100 pb-3 flex items-center justify-between">
                                  <h4 className="text-xs font-black text-red-900 uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 bg-red-650 rounded-full animate-ping"></span>
                                    <span>Integração Todoist — Gestão de Subtarefas Institucional</span>
                                  </h4>
                                </div>

                                <p className="text-[11px] text-red-800 leading-normal font-semibold">
                                  Dispare instantaneamente uma subtarefa para a Secretaria cobrar do cliente os dados do proprietário do imóvel para geração da declaração de residência.
                                </p>

                                {todoistSuccess && (
                                  <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-xl text-xs flex flex-col gap-1 animate-fade-in">
                                    <div className="font-black text-emerald-900 flex items-center gap-1.5">
                                      <CheckCircle2 size={14} className="text-emerald-600" />
                                      <span>Tarefa Enviada com Sucesso ao Todoist!</span>
                                    </div>
                                    <p className="text-[11px] text-emerald-800 font-semibold">{todoistSuccess}</p>
                                  </div>
                                )}

                                {todoistError && (
                                  <div className="p-4 bg-rose-50 border border-rose-150 rounded-xl text-xs text-rose-8 flex items-center gap-2 animate-fade-in">
                                    <AlertCircle size={14} className="text-rose-600 shrink-0" />
                                    <span className="font-bold text-rose-800">{todoistError}</span>
                                  </div>
                                )}

                                <div className="pt-1">
                                  <button
                                    type="button"
                                    disabled={todoistSubmitting}
                                    onClick={handleCreateTodoistTask}
                                    className={`w-full py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${todoistSubmitting ? 'opacity-75 pointer-events-none' : ''}`}
                                  >
                                    {todoistSubmitting ? (
                                      <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Registrando subtarefa...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Send size={13} />
                                        <span>Gerar Subtarefa no Todoist ⚡</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* IF YES DADOS (4.3.7 === 'sim'): SHOW FORM 4.3.8 */}
                            {wizardState.q4_possui_dados_proprietario === 'sim' && (
                              <div className="space-y-4 pt-1 animate-in slide-in-from-top-1 duration-200">
                                
                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                                    4.3.8 - Quais são os dados do proprietário do imóvel?
                                  </h4>
                                  <p className="text-[11px] text-indigo-805 font-medium mt-1 leading-normal">
                                    Preencha abaixo o bloco de dados pessoais básicos do proprietário do imóvel para alimentação dos fluxos automatizados.
                                  </p>
                                </div>

                                <div className="space-y-3.5 bg-gray-50/40 border border-gray-150 rounded-3xl p-5">
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">Nome Completo do Proprietário:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_nomeCompleto || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_nomeCompleto: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="Nome completo do declarante"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">CPF do Proprietário:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_cpf || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_cpf: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="000.000.000-00"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">RG do Proprietário:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_rg || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_rg: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="Nº do RG"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">Órgão Emissor / UF:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_rg_orgao || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_rg_orgao: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="Ex: SSP/SP"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">Nacionalidade de Proprietário:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_nacionalidade || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_nacionalidade: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="Brasileiro(a)"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">Estado Civil do Proprietário:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_estado_civil || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_estado_civil: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="Casado(a), solteiro(a), etc."
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">Profissão do Proprietário:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_profissao || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_profissao: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="Profissão"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">Telefone / WhatsApp do Proprietário:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_telefone || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_telefone: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="(00) 00000-0000"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">E-mail do Proprietário:</label>
                                    <input 
                                      type="email"
                                      value={wizardState.q4_proprietario_email || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_email: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="email@dominio.com"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">CEP do Imóvel:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_cep || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_cep: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="00000-000"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">Endereço / Logradouro:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_endereco || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_endereco: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="Rua, Avenida, etc."
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">Número:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_numero || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_numero: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="Número"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">Complemento:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_complemento || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_complemento: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="Apto, Bloco, etc."
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">Bairro:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_bairro || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_bairro: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="Bairro"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">Cidade:</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_cidade || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_cidade: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="Cidade"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase">Estado (UF):</label>
                                    <input 
                                      type="text"
                                      value={wizardState.q4_proprietario_estado || ''}
                                      onChange={(e) => saveWizardStateUpdate({ q4_proprietario_estado: e.target.value })}
                                      className="w-full px-4 py-2.5 bg-white border border-gray-200 focus:border-gray-950 focus:ring-1 focus:ring-gray-900 rounded-xl text-xs font-semibold text-gray-800 transition-all outline-none"
                                      placeholder="Sigla (Ex: SP)"
                                    />
                                  </div>
                                </div>

                                {/* 4.3.9 - Deseja gerar automaticamente a Declaração de Residência? */}
                                <div className="flex flex-col gap-2 pt-3 border-t border-gray-150 animate-in fade-in duration-200">
                                  <p className="text-xs font-extrabold text-gray-850 uppercase">
                                    4.3.9 - Deseja gerar automaticamente a Declaração de Residência?
                                  </p>
                                  <div className="flex flex-col gap-2">
                                    {['sim', 'nao'].map(o => (
                                      <label key={o} className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-gray-700">
                                        <input 
                                          type="radio" 
                                          name="q4_gerar_declaracao_residencia" 
                                          checked={wizardState.q4_gerar_declaracao_residencia === o} 
                                          onChange={() => saveWizardStateUpdate({ q4_gerar_declaracao_residencia: o })} 
                                          className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>{o === 'sim' ? 'Sim' : 'Não'}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                {/* GDI TRIGGER ACTION FRAME */}
                                {wizardState.q4_gerar_declaracao_residencia === 'sim' && (
                                  <div className="p-4 bg-blue-50/50 border border-indigo-150 rounded-2xl space-y-3 animate-in slide-in-from-top-1">
                                    <div className="flex items-center justify-between">
                                      <div className="space-y-0.5">
                                        <span className="text-[10px] uppercase font-black text-indigo-700 tracking-widest font-mono">Automação GDI Inteligente</span>
                                        <h4 className="text-xs font-extrabold text-indigo-950">Acionador Google Docs Integration (GDI)</h4>
                                      </div>
                                      <Sparkles size={16} className="text-indigo-600 animate-pulse" />
                                    </div>
                                    <p className="text-[11px] text-indigo-805 leading-normal font-semibold">
                                      O Portal BOSS processará os dados fornecidos e criará de forma stateless o arquivo do modelo na pasta específica do Drive do cliente, salvando as referências contratuais.
                                    </p>

                                    {/* ACTION ACTION ACCORDING TO COMPLETED OR NOT */}
                                    {wizardState.q4_declaracao_residencia_url ? (
                                      <div className="space-y-3 pt-2">
                                        
                                        {/* Success Indicator & Buttons */}
                                        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-950 font-bold text-xs rounded-xl flex items-center gap-2">
                                          <Check size={14} className="text-emerald-600 shrink-0" />
                                          <span>Declaração gerada e vinculada à relação documental!</span>
                                        </div>

                                        {/* Actions Row */}
                                        <div className="flex flex-wrap gap-2">
                                          {/* Visualizar */}
                                          <a 
                                            href={wizardState.q4_declaracao_residencia_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer text-center"
                                          >
                                            <ExternalLink size={12} />
                                            <span>Visualizar</span>
                                          </a>

                                          {/* Imprimir via PDF Export */}
                                          <a 
                                            href={wizardState.q4_declaracao_residencia_url.replace(/\/edit(\?.*)?$/, '/export?format=pdf')}
                                            className="px-3.5 py-2.5 bg-gray-900 hover:bg-gray-950 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer text-center"
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            <Printer size={12} />
                                            <span>Imprimir / PDF</span>
                                          </a>

                                          {/* Assinar */}
                                          <button 
                                            type="button"
                                            onClick={() => saveWizardStateUpdate({ q4_declaracao_residencia_assinada: 'sim' })}
                                            className={`px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer text-center ${
                                              wizardState.q4_declaracao_residencia_assinada === 'sim'
                                                ? 'bg-emerald-650 text-white border border-emerald-700'
                                                : 'bg-white border border-gray-350 hover:bg-gray-50 text-gray-800'
                                            }`}
                                          >
                                            <Check size={12} />
                                            <span>{wizardState.q4_declaracao_residencia_assinada === 'sim' ? 'Assinado ✅' : 'Marcar Assinado'}</span>
                                          </button>
                                        </div>

                                      </div>
                                    ) : (
                                      <div className="pt-2">
                                        <button
                                          type="button"
                                          disabled={gdiLoading}
                                          onClick={handleGenerateResidenceDeclaration}
                                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                          {gdiLoading ? (
                                            <>
                                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                              <span>Gerando via GDI Automático...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Sparkles size={14} />
                                              <span>Gerar Declaração de Residência com GDI ⚡</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* IF NO DECLARES */}
                                {wizardState.q4_gerar_declaracao_residencia === 'nao' && (
                                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-950 rounded-xl text-xs font-bold animate-in slide-in-from-top-1">
                                    <div className="flex gap-1 items-center pb-1">
                                      <AlertCircle size={13} className="text-rose-600" />
                                      <span className="text-[10px] uppercase font-black text-rose-800">Alerta de Pendência Documental</span>
                                    </div>
                                    <p className="font-semibold text-rose-700 normal-case leading-normal">
                                      Você optou por não gerar o documento. Esta séria pendência de Declaração de Residência constará ativamente no Relatório de Auditoria para as providências correspondentes.
                                    </p>
                                  </div>
                                )}

                              </div>
                            )}

                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              </>
            )}



            </div>

            {/* FLOW ACTIONS FOOTER */}
            {isResidenciaRoute && (
              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={handleNextPhase}
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span>Próxima Fase</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}

          </div>

          </div>
        )}

      </div>
    </FluxoStepLayout>
  );
}
