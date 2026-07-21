import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, MessageCircle, Mail, Settings, Check, ExternalLink, Copy, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { normalizeWhatsAppNumber, buildWhatsAppLink } from '../../../../lib/whatsapp';

interface EntregaDocumentoProps {
  tipoDocumento: 'procuracao' | 'declaracao' | 'contrato';
  tipoPessoa: 'PF' | 'PJ';
  googleDocsUrl?: string;
  whatsappCliente?: string;
  emailCliente?: string;
  nomeCliente?: string;
  selectedMethods: string[];
  onMethodsChange: (methods: string[]) => void;
  outroValue: string;
  onOutroChange: (value: string) => void;
  questionNumber?: string;
}

function extractGoogleDocId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function openGoogleDocPrint(docUrl: string) {
  const documentId = extractGoogleDocId(docUrl);

  if (!documentId) {
    window.open(docUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const printUrl = `https://docs.google.com/document/d/${documentId}/preview`;
  const printWindow = window.open(printUrl, "_blank", "noopener,noreferrer");

  if (!printWindow) {
    alert("O navegador bloqueou a janela de impressão. Autorize pop-ups para imprimir o documento.");
  }
}

export default function EntregaDocumento({
  tipoDocumento,
  tipoPessoa,
  googleDocsUrl = '',
  whatsappCliente = '',
  emailCliente = '',
  nomeCliente = 'Cliente',
  selectedMethods,
  onMethodsChange,
  outroValue,
  onOutroChange,
  questionNumber = '1.2'
}: EntregaDocumentoProps) {
  const { googleAccessToken, loginWithGoogle, user } = useAuth();
  const { caseId } = useParams<{ caseId: string }>();

  const [whatsappStatus, setWhatsappStatus] = useState<string>(() => {
    try {
      return localStorage.getItem(`wa_status_${caseId}_${tipoDocumento}`) || '';
    } catch {
      return '';
    }
  });

  const [waLogs, setWaLogs] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(`wa_logs_${caseId}_${tipoDocumento}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showWaLogs, setShowWaLogs] = useState(false);
  const [showDefaultMessage, setShowDefaultMessage] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedPdf, setCopiedPdf] = useState(false);

  const [waspeedStatus, setWaspeedStatus] = useState<string>(() => {
    try {
      return localStorage.getItem(`waspeed_status_${caseId}_${tipoDocumento}`) || 'Pronto para envio via W.A Speed';
    } catch {
      return 'Pronto para envio via W.A Speed';
    }
  });

  const [waspeedError, setWaspeedError] = useState<string | null>(null);
  const [waspeedErrorCode, setWaspeedErrorCode] = useState<string | null>(null);

  const resolvedGoogleAccessToken = googleAccessToken || localStorage.getItem('oauth_google_access_token') || localStorage.getItem('portal_boss_google_accessToken') || '';

  const [showWhatsappConfirm, setShowWhatsappConfirm] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [whatsappResult, setWhatsappResult] = useState<{
    success: boolean;
    message: string;
    pendingConfirmation?: boolean;
    errorCode?: string;
    fileId?: string | null;
    phoneNormalized?: string;
    delivery?: any;
    diagnostic?: any;
  } | null>(null);

  const [sendingGmail, setSendingGmail] = useState(false);
  const [gmailResult, setGmailResult] = useState<{ success: boolean; message: string; errorCode?: string } | null>(null);

  const [waDiagnostics, setWaDiagnostics] = useState<{
    configured: boolean;
    tokenSource: string;
    tokenMasked: string;
    provider: string;
    status: string;
    warnings?: string[];
    waSpeedUrl?: string;
    waSpeedInstanceId?: string;
  } | null>(null);

  const [preflightData, setPreflightData] = useState<{
    valid: boolean;
    readiness: string;
    pdfExportCheck: string;
    diagnostic?: any;
    phoneValidation?: any;
  } | null>(null);

  const [testFormatsResult, setTestFormatsResult] = useState<any[] | null>(null);
  const [testingFormats, setTestingFormats] = useState(false);

  const [prechecking, setPrechecking] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Fetch diagnostics on mount
  React.useEffect(() => {
    const fetchDiagnostics = async () => {
      try {
        const res = await fetch('/api/whatsapp/diagnostics');
        if (res.ok) {
          const data = await res.json();
          setWaDiagnostics(data);
        }
      } catch (err) {
        console.warn('Failed to fetch WA diagnostics:', err);
      }
    };
    fetchDiagnostics();
  }, []);

  const getWASpeedMessageText = () => {
    if (tipoDocumento === 'procuracao') {
      return `Olá, ${nomeCliente}.\n\nSegue a procuração para assinatura.\n\nPor favor, confira, assine e nos envie a procuração assinada.\n\nQualquer dúvida, estamos à disposição.`;
    } else if (tipoDocumento === 'declaracao') {
      return `Olá, ${nomeCliente}.\n\nSegue a declaração para assinatura.\n\nPor favor, confira, assine e nos envie a declaração assinada.\n\nQualquer dúvida, estamos à disposição.`;
    } else if (tipoDocumento === 'contrato') {
      return `Olá, ${nomeCliente}.\n\nSegue o contrato de honorários para assinatura.\n\nPor favor, confira, assine e nos envie o contrato assinado.\n\nQualquer dúvida, estamos à disposição.`;
    } else {
      return `Olá, ${nomeCliente}.\n\nSegue o documento para assinatura.\n\nPor favor, confira, assine e nos envie o documento assinado.\n\nQualquer dúvida, estamos à disposição.`;
    }
  };

  const getWASpeedTargetUrl = () => {
    const phoneNormalized = normalizeWhatsAppNumber(whatsappCliente);
    if (phoneNormalized) {
      return `https://web.whatsapp.com/send?phone=${phoneNormalized}`;
    }
    return 'https://web.whatsapp.com/';
  };

  const handleSendViaWASpeed = async () => {
    if (sendingWhatsapp) return;

    // Reset results & error
    setWhatsappResult(null);
    setWaspeedError(null);
    setWaspeedErrorCode(null);

    const initialStatus = waspeedStatus;

    // Helper to log blocking/failure
    const logFailure = (action: string, errorMsg: string, statusFinal: string, details: string, errorCode?: string) => {
      setWaspeedStatus(statusFinal);
      localStorage.setItem(`waspeed_status_${caseId}_${tipoDocumento}`, statusFinal);
      setWaspeedError(errorMsg);
      if (errorCode) {
        setWaspeedErrorCode(errorCode);
      }

      const currentLogs = [...waLogs];
      currentLogs.push({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        action,
        route: window.location.pathname,
        etapa: "Pergunta 1.2 — Como você entregará o documento ao cliente?",
        documento: docInfo.label,
        clientName: nomeCliente,
        phoneOriginal: whatsappCliente || "NÃO PREENCHIDO",
        phone: normalizeWhatsAppNumber(whatsappCliente) || "NÃO PREENCHIDO",
        payload: getWASpeedMessageText(),
        pdfId: extractGoogleDocId(googleDocsUrl) || "N/A",
        pdfStatus: (googleDocsUrl && !googleDocsUrl.includes('placeholder')) ? 'gerado' : 'pendente',
        motor: "W.A Speed/Wascript",
        secret: waDiagnostics?.configured ? "Wascript_API configurado" : "Wascript_API ausente/indisponível",
        statusInicial: initialStatus,
        statusFinal,
        sucessoReal: "Não",
        error: errorMsg,
        fallbackAcionado: "Não",
        usuario: user?.email || 'Usuário Responsável',
        detalhes: details
      });
      setWaLogs(currentLogs);
      localStorage.setItem(`wa_logs_${caseId}_${tipoDocumento}`, JSON.stringify(currentLogs));
    };

    // 1. Client name validation
    if (!nomeCliente || nomeCliente.trim() === '' || nomeCliente === 'Cliente') {
      logFailure(
        "BLOQUEIO_DADOS_AUSENTES",
        "Não é possível enviar via W.A Speed porque o nome do cliente não está disponível.",
        "Envio bloqueado — dados obrigatórios ausentes",
        "Nome do cliente ausente na fonte de verdade."
      );
      return;
    }

    // 2. Client phone existence validation
    if (!whatsappCliente || !whatsappCliente.trim()) {
      logFailure(
        "BLOQUEIO_DADOS_AUSENTES",
        "Não é possível enviar via W.A Speed porque o telefone do cliente não está preenchido.",
        "Envio bloqueado — dados obrigatórios ausentes",
        "Telefone do cliente não preenchido na base de dados."
      );
      return;
    }

    // 3. Client phone normalization validation
    const phoneNormalized = normalizeWhatsAppNumber(whatsappCliente);
    if (!phoneNormalized || phoneNormalized.length < 10) {
      logFailure(
        "BLOQUEIO_DADOS_AUSENTES",
        "Não é possível enviar via W.A Speed porque o telefone do cliente está inválido.",
        "Envio bloqueado — dados obrigatórios ausentes",
        "Telefone do cliente no formato incorreto ou impossível de normalizar."
      );
      return;
    }

    // 4. Document generation validation
    const docTitle = docInfo.title;
    const isMasculine = docTitle.startsWith('o ');
    const geradoStr = isMasculine ? 'gerado' : 'gerada';

    if (!googleDocsUrl || googleDocsUrl.trim() === '' || googleDocsUrl.includes('placeholder')) {
      logFailure(
        "BLOQUEIO_DADOS_AUSENTES",
        `Não é possível enviar via W.A Speed porque ${docTitle} ainda não foi ${geradoStr}.`,
        "Envio bloqueado — dados obrigatórios ausentes",
        "URL do Google Docs não gerada ou pendente."
      );
      return;
    }

    // 5. PDF accessible validation
    const docId = extractGoogleDocId(googleDocsUrl);
    if (!docId) {
      logFailure(
        "BLOQUEIO_DADOS_AUSENTES",
        `Não é possível enviar via W.A Speed porque ${docTitle} ainda não foi ${geradoStr}.`,
        "Envio bloqueado — dados obrigatórios ausentes",
        "Não foi possível extrair ID de arquivo válido da URL do Google Docs."
      );
      return;
    }

    // 6. Secret Wascript_API validation
    if (!waDiagnostics || !waDiagnostics.configured) {
      logFailure(
        "BLOQUEIO_DADOS_AUSENTES",
        "Não foi possível acionar o W.A Speed porque a configuração Wascript_API está indisponível.",
        "Falha no envio via W.A Speed",
        "Configuração do Wascript_API ausente ou indisponível no backend."
      );
      return;
    }

    // Pre-open window immediately to prevent popup blockers
    let reservedWindow: Window | null = null;
    try {
      reservedWindow = window.open('about:blank', '_blank');
      if (reservedWindow) {
        reservedWindow.document.write(`
          <html>
            <head>
              <title>Aguardando W.A Speed...</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #475569; text-align: center; }
                .spinner { border: 3px solid #cbd5e1; border-top: 3px solid #059669; border-radius: 50%; width: 28px; height: 28px; animation: spin 1s linear infinite; margin-bottom: 16px; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                h3 { margin: 0 0 8px 0; color: #0f172a; font-size: 18px; }
                p { margin: 0; font-size: 14px; color: #64748b; }
              </style>
            </head>
            <body>
              <div class="spinner"></div>
              <h3>Enviando documento pelo sistema...</h3>
              <p>Por favor, aguarde. Após o envio ser confirmado, você será redirecionado para a conversa do cliente no WhatsApp Web.</p>
            </body>
          </html>
        `);
      }
    } catch (e) {
      console.warn("Could not pre-open window:", e);
    }

    // Set sending status
    setSendingWhatsapp(true);
    setWaspeedStatus("Enviando mensagem e PDF via W.A Speed...");
    localStorage.setItem(`waspeed_status_${caseId}_${tipoDocumento}`, "Enviando mensagem e PDF via W.A Speed...");

    try {
      const response = await fetch('/api/google-docs/send-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          googleDocsUrl: googleDocsUrl,
          phone: whatsappCliente,
          docName: docInfo.label,
          clientName: nomeCliente,
          documentType: tipoDocumento,
          tipoPessoa,
          caseId,
          googleAccessToken: resolvedGoogleAccessToken
        })
      });

      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!data) {
        const errorMsg = raw
          ? `Resposta inesperada do servidor: ${raw.slice(0, 300)}`
          : 'Servidor respondeu sem conteúdo ao tentar enviar pelo W.A Speed.';
        
        if (reservedWindow) {
          try { reservedWindow.close(); } catch (errClose) {}
        }

        logFailure(
          "FALHA_CONEXAO_INTEGRACAO",
          "Falha no envio via W.A Speed. A mensagem e o PDF não foram confirmados como enviados.",
          "Falha no envio via W.A Speed",
          `Resposta do servidor não pôde ser interpretada como JSON. Detalhes: ${errorMsg}`
        );
        return;
      }

      if (response.ok && data.success) {
        // Envio confirmado com sucesso real no backend
        const targetUrl = getWASpeedTargetUrl();
        let wasOpened = false;

        // Atualizar status conforme fluxo esperado
        setWaspeedStatus("Mensagem e PDF enviados via W.A Speed");
        localStorage.setItem(`waspeed_status_${caseId}_${tipoDocumento}`, "Mensagem e PDF enviados via W.A Speed");

        if (reservedWindow && !reservedWindow.closed) {
          try {
            reservedWindow.location.href = targetUrl;
            wasOpened = true;
          } catch (errRedirect) {
            console.error("Failed to redirect reserved window:", errRedirect);
          }
        }

        const finalStatus = wasOpened
          ? "Conversa aberta no WhatsApp Web para conferência"
          : "Envio concluído. Clique em ‘Abrir conversa no WhatsApp Web’ para conferir.";

        setWaspeedStatus(finalStatus);
        localStorage.setItem(`waspeed_status_${caseId}_${tipoDocumento}`, finalStatus);
        
        const currentLogs = [...waLogs];
        currentLogs.push({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          action: "ENVIO_WASPEED_SUCESSO",
          route: window.location.pathname,
          etapa: "Pergunta 1.2 — Como você entregará o documento ao cliente?",
          documento: docInfo.label,
          clientName: nomeCliente,
          phoneOriginal: whatsappCliente,
          phone: data.phoneNormalized || phoneNormalized,
          payload: getWASpeedMessageText(),
          pdfId: docId,
          pdfStatus: 'gerado',
          motor: "W.A Speed/Wascript",
          secret: waDiagnostics?.configured ? "Wascript_API configurado" : "Wascript_API ausente/indisponível",
          statusInicial: initialStatus,
          statusFinal: finalStatus,
          sucessoReal: "Sim",
          error: "",
          fallbackAcionado: "Não",
          usuario: user?.email || 'Usuário Responsável',
          urlConversa: targetUrl,
          popupBloqueado: wasOpened ? "Não" : "Sim",
          envioIniciado: "Sim",
          mensagemConfirmada: "Sim",
          pdfConfirmado: "Sim",
          retornoReal: JSON.stringify(data),
          detalhes: `Envio confirmado com sucesso real. Retorno: ${data.message}. Conversa do WhatsApp Web aberta automaticamente: ${wasOpened ? 'Sim' : 'Não (Bloqueio ou fecharam)'}`
        });
        setWaLogs(currentLogs);
        localStorage.setItem(`wa_logs_${caseId}_${tipoDocumento}`, JSON.stringify(currentLogs));
      } else {
        if (reservedWindow) {
          try { reservedWindow.close(); } catch (errClose) {}
        }
        const errorMsg = data.errorMessage || 'Falha ao enviar por WhatsApp via W.A Speed.';
        logFailure(
          "ENVIO_WASPEED_REJEITADO",
          `Falha no envio via W.A Speed: ${errorMsg}`,
          "Falha no envio via W.A Speed",
          `API retornou erro HTTP ${response.status} (${data.errorCode || 'UNKNOWN'}). Detalhes: ${errorMsg}`,
          data.errorCode
        );
      }
    } catch (err: any) {
      if (reservedWindow) {
        try { reservedWindow.close(); } catch (errClose) {}
      }
      logFailure(
        "EXCEPCAO_ENVIO_WASPEED",
        `Falha no envio via W.A Speed: ${err.message || 'Erro de conexão'}`,
        "Falha no envio via W.A Speed",
        `Erro ao conectar à API de WhatsApp: ${err.message || 'Sem mensagem'}`,
        err.errorCode || 'EXCEPCAO_CONEXAO'
      );
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const handleOpenWhatsAppManual = () => {
    const phoneNormalized = normalizeWhatsAppNumber(whatsappCliente);
    const initialStatus = waspeedStatus;
    
    if (!phoneNormalized) {
      alert("Não é possível abrir o WhatsApp manualmente porque o telefone do cliente não está preenchido ou é inválido.");
      return;
    }

    const msg = getWASpeedMessageText();
    const waLink = buildWhatsAppLink(phoneNormalized, msg);

    setWaspeedStatus("WhatsApp aberto manualmente — envio não confirmado pelo sistema");
    localStorage.setItem(`waspeed_status_${caseId}_${tipoDocumento}`, "WhatsApp aberto manualmente — envio não confirmado pelo sistema");

    const currentLogs = [...waLogs];
    currentLogs.push({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      action: "FALLBACK_WHATSAPP_MANUAL",
      route: window.location.pathname,
      etapa: "Pergunta 1.2 — Como você entregará o documento ao cliente?",
      documento: docInfo.label,
      clientName: nomeCliente,
      phone: phoneNormalized,
      payload: msg,
      pdfId: extractGoogleDocId(googleDocsUrl) || "N/A",
      pdfStatus: (googleDocsUrl && !googleDocsUrl.includes('placeholder')) ? 'gerado' : 'pendente',
      motor: "W.A Speed/Wascript",
      secret: waDiagnostics?.configured ? "Wascript_API configurado" : "Wascript_API ausente/indisponível",
      statusInicial: initialStatus,
      statusFinal: "WhatsApp aberto manualmente — envio não confirmado pelo sistema",
      sucessoReal: "Não",
      error: "",
      fallbackAcionado: "Sim",
      usuario: user?.email || 'Usuário Responsável',
      detalhes: "Fallback manual acionado pelo operador. Conversa do WhatsApp aberta pelo link wa.me."
    });
    setWaLogs(currentLogs);
    localStorage.setItem(`wa_logs_${caseId}_${tipoDocumento}`, JSON.stringify(currentLogs));

    window.open(waLink, '_blank', 'noopener,noreferrer');
  };

  const handleCopyMsg = () => {
    navigator.clipboard.writeText(getWASpeedMessageText());
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  const handleCopyPdfUrl = () => {
    const docId = extractGoogleDocId(googleDocsUrl);
    const pdfUrl = docId ? `https://docs.google.com/document/d/${docId}/export?format=pdf` : googleDocsUrl;
    navigator.clipboard.writeText(pdfUrl);
    setCopiedPdf(true);
    setTimeout(() => setCopiedPdf(false), 2000);
  };

  const runPreflightCheck = async () => {
    if (!docUrl || docUrl.includes('placeholder')) return;
    setPrechecking(true);
    try {
      const response = await fetch('/api/whatsapp/preflight-send-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleDocsUrl: docUrl,
          phone: whatsappCliente,
          docName: docInfo.label,
          clientName: nomeCliente,
          documentType: tipoDocumento,
          tipoPessoa,
          caseId,
          googleAccessToken: resolvedGoogleAccessToken
        })
      });
      if (response.ok) {
        const data = await response.json();
        setPreflightData(data);
        // Clear previous error if it was a token expiration and preflight succeeds now
        if (whatsappResult && whatsappResult.errorCode === 'GOOGLE_DOCS_TOKEN_EXPIRED') {
          setWhatsappResult(null);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setWhatsappResult({
          success: false,
          message: errorData.errorMessage || "Falha na verificação prévia do documento.",
          errorCode: errorData.errorCode,
          fileId: errorData.diagnostic?.fileId || null
        });
        if (errorData.errorCode === 'GOOGLE_DOCS_TOKEN_EXPIRED' || errorData.errorCode === 'GOOGLE_AUTH_UNAUTHORIZED') {
          try {
            localStorage.removeItem('oauth_google_access_token');
            localStorage.removeItem('portal_boss_google_accessToken');
            sessionStorage.removeItem('google_access_token');
          } catch (e) {
            console.warn("Could not clean expired tokens:", e);
          }
        }
      }
    } catch (err) {
      console.warn('Preflight check failed:', err);
    } finally {
      setPrechecking(false);
    }
  };

  const runTestPhoneFormats = async () => {
    if (!whatsappCliente) return;
    setTestingFormats(true);
    setTestFormatsResult(null);
    try {
      const response = await fetch('/api/whatsapp/test-phone-formats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: whatsappCliente,
          message: `Giffoni Advogados — Este é um teste real para validar a comunicação e roteamento correto do WhatsApp com a sua linha telefônica.`
        })
      });
      if (response.ok) {
        const data = await response.json();
        setTestFormatsResult(data.attempts || []);
      } else {
        const err = await response.json().catch(() => ({}));
        alert("Erro ao disparar teste técnico de envio: " + (err.errorMessage || "Falha desconhecida."));
      }
    } catch (e: any) {
      alert("Falha de rede ao disparar teste: " + e.message);
    } finally {
      setTestingFormats(false);
    }
  };

  // Trigger preflight when modal opens
  React.useEffect(() => {
    if (showWhatsappConfirm) {
      runPreflightCheck();
    } else {
      setPreflightData(null);
      setTestFormatsResult(null);
    }
  }, [showWhatsappConfirm]);

  const getWhatsappMessageText = () => {
    switch (tipoDocumento) {
      case 'procuracao':
        return 'Olá! Aqui é a Giffoni Advogados Associados, segue a *procuração* para sua conferência e assinatura. Por gentileza, assine, digitalize em PDF e nos envie de volta. É sempre um imenso prazer lhe atender.';
      case 'declaracao':
        return 'Olá! Aqui é a Giffoni Advogados Associados, segue a *declaração* para sua conferência e assinatura. Por gentileza, assine, digitalize em PDF e nos envie de volta. É sempre um imenso prazer lhe atender.';
      case 'contrato':
        return 'Olá! Aqui é a Giffoni Advogados Associados, segue o *contrato de honorários* para sua conferência e assinatura. Por gentileza, assine, digitalize em PDF e nos envie de volta. É sempre um imenso prazer lhe atender.';
      default:
        return 'Olá! Aqui é a Giffoni Advogados Associados, segue o documento para sua conferência e assinatura. Por gentileza, assine, digitalize em PDF e nos envie de volta. É sempre um imenso prazer lhe atender.';
    }
  };

  const getSendButtonLabel = () => {
    switch (tipoDocumento) {
      case 'procuracao':
        return 'Preparar envio da Procuração via WhatsApp';
      case 'declaracao':
        return 'Preparar envio da Declaração via WhatsApp';
      case 'contrato':
        return 'Preparar envio do Contrato via WhatsApp';
      default:
        return 'Preparar envio via WhatsApp';
    }
  };

  const getModalTitle = () => {
    switch (tipoDocumento) {
      case 'procuracao':
        return 'Confirmar envio da Procuração via W.A Speed';
      case 'declaracao':
        return 'Confirmar envio da Declaração via W.A Speed';
      case 'contrato':
        return 'Confirmar envio do Contrato via W.A Speed';
      default:
        return 'Confirmar envio via W.A Speed';
    }
  };

  // Resolve localized text based on documento
  const getDocInfo = () => {
    switch (tipoDocumento) {
      case 'procuracao':
        return {
          label: 'Procuração Ad Judicia',
          title: 'a procuração',
          fallbackUrl: 'https://docs.google.com/document/d/1pro-placeholder'
        };
      case 'declaracao':
        return {
          label: 'Declaração de Hipossuficiência',
          title: 'a declaração',
          fallbackUrl: 'https://docs.google.com/document/d/1dec-placeholder'
        };
      case 'contrato':
        return {
          label: 'Contrato de Honorários',
          title: 'o contrato',
          fallbackUrl: 'https://docs.google.com/document/d/1con-placeholder font-medium'
        };
      default:
        return {
          label: 'Documento',
          title: 'o documento',
          fallbackUrl: ''
        };
    }
  };

  const docInfo = getDocInfo();

  // Handle method selection (single-choice)
  const toggleMethod = (method: string) => {
    const updated = selectedMethods.includes(method) ? [] : [method];
    onMethodsChange(updated);
  };

  const handleConfirmWhatsappSend = async () => {
    setSendingWhatsapp(true);
    setWhatsappResult(null);

    const cleanPhoneVal = whatsappCliente.replace(/\D/g, '');
    if (!cleanPhoneVal) {
      setWhatsappResult({ success: false, message: 'WhatsApp do cliente não encontrado.' });
      setSendingWhatsapp(false);
      return;
    }

    if (!docUrl || docUrl.includes('placeholder')) {
      setWhatsappResult({ success: false, message: 'Documento ainda não foi gerado.' });
      setSendingWhatsapp(false);
      return;
    }

    try {
      const response = await fetch('/api/google-docs/send-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          googleDocsUrl: docUrl,
          phone: whatsappCliente,
          docName: docInfo.label,
          clientName: nomeCliente,
          documentType: tipoDocumento,
          tipoPessoa,
          caseId,
          googleAccessToken: resolvedGoogleAccessToken
        })
      });
      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!data) {
        setWhatsappResult({
          success: false,
          message: raw
            ? `Resposta inesperada do servidor: ${raw.slice(0, 300)}`
            : 'Servidor respondeu sem conteúdo ao tentar enviar pelo W.A Speed.'
        });
        return;
      }

      if (response.ok && data.success) {
        setWhatsappResult({
          success: true,
          message: data.message || `Mensagem e PDF aceitos pelo W.A Speed para o número ${data.phoneNormalized || ''}.`,
          phoneNormalized: data.phoneNormalized,
          delivery: data.delivery
        });
        // Close modal on successfully sending after a short delay
        setTimeout(() => {
          setShowWhatsappConfirm(false);
        }, 5000);
      } else {
        setWhatsappResult({
          success: false,
          pendingConfirmation: data.pendingConfirmation || false,
          message: data.errorMessage || 'Falha ao enviar por WhatsApp.',
          errorCode: data.errorCode,
          diagnostic: data.diagnostic,
          phoneNormalized: data.phoneNormalized,
          fileId: data.diagnostic?.fileId || (data.diagnostic?.inspection?.parsedBody?.fileId)
        });
        if (data.errorCode === 'GOOGLE_DOCS_TOKEN_EXPIRED' || data.errorCode === 'GOOGLE_AUTH_UNAUTHORIZED') {
          try {
            localStorage.removeItem('oauth_google_access_token');
            localStorage.removeItem('portal_boss_google_accessToken');
            sessionStorage.removeItem('google_access_token');
          } catch (e) {
            console.warn("Could not clean expired tokens:", e);
          }
        }
      }
    } catch (err: any) {
      setWhatsappResult({ success: false, message: err.message || 'Erro ao conectar à API de WhatsApp.' });
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const handleSendGmail = async () => {
    setSendingGmail(true);
    setGmailResult(null);

    if (!emailCliente) {
      setGmailResult({ success: false, message: 'E-mail do cliente não encontrado.' });
      setSendingGmail(false);
      return;
    }

    if (!docUrl || docUrl.includes('placeholder')) {
      setGmailResult({ success: false, message: 'Documento ainda não foi gerado.' });
      setSendingGmail(false);
      return;
    }

    if (!resolvedGoogleAccessToken) {
      setGmailResult({
        success: false,
        message: 'Conecte sua conta Google/Gmail antes de preparar o rascunho.'
      });
      setSendingGmail(false);
      return;
    }

    try {
      const response = await fetch('/api/google-docs/create-gmail-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          googleDocsUrl: docUrl,
          email: emailCliente,
          docName: docInfo.label,
          clientName: nomeCliente,
          googleAccessToken: resolvedGoogleAccessToken,
          documentType: tipoDocumento,
          tipoPessoa
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const urls = data.gmailOpenUrls;
        const openUrl = urls?.composeInDraftsByMessageId || urls?.composeByDraftId || urls?.composeByMessageId || urls?.draftById || urls?.draftByMessageId || urls?.inboxThread;
        
        if (openUrl) {
          setGmailResult({
            success: true,
            message: 'E-mail aberto no Gmail com destinatário, assunto, corpo e anexo.'
          });
          window.open(openUrl, '_blank', 'noopener,noreferrer');
        } else {
          setGmailResult({
            success: true,
            message: 'Rascunho criado com sucesso, mas o Gmail abriu a pasta de rascunhos. Abra o rascunho recém-criado para enviar.'
          });
          const fallbackUrl = urls?.draftsFolder || 'https://mail.google.com/mail/u/0/#drafts';
          window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        setGmailResult({
          success: false,
          errorCode: data.errorCode,
          message: data.errorMessage || 'Não foi possível preparar o e-mail no Gmail. Verifique se sua conta Google está conectada com permissão Gmail.'
        });
        if (data.errorCode === 'GOOGLE_DOCS_TOKEN_EXPIRED' || data.errorCode === 'GOOGLE_AUTH_UNAUTHORIZED') {
          try {
            localStorage.removeItem('oauth_google_access_token');
            localStorage.removeItem('portal_boss_google_accessToken');
            sessionStorage.removeItem('google_access_token');
          } catch (e) {
            console.warn("Could not clean expired tokens:", e);
          }
        }
      }
    } catch (err: any) {
      setGmailResult({
        success: false,
        errorCode: err.errorCode,
        message: err.message || 'Não foi possível preparar o e-mail no Gmail. Verifique se sua conta Google está conectada com permissão Gmail.'
      });
    } finally {
      setSendingGmail(false);
    }
  };

  // Generate clean direct link for WhatsApp
  // Remove non-numeric characters for phone number
  const cleanPhone = whatsappCliente.replace(/\D/g, '');
  const whatsappUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}`;

  // Generate deep compose mail link for Gmail
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    emailCliente
  )}&su=${encodeURIComponent(
    `Envio de ${docInfo.label} — ${nomeCliente}`
  )}&body=${encodeURIComponent(
    `Prezado(a) ${nomeCliente},\n\nSegue em anexo ${docInfo.title} para sua conferência e assinatura.\n\nQualquer dúvida, estamos à disposição.\n\nAtenciosamente,\nEscritório de Advocacia`
  )}`;

  // Google Docs Url fallback if empty
  const docUrl = googleDocsUrl || docInfo.fallbackUrl;

  return (
    <div className="space-y-4">
      {/* Question Header */}
      <div className="space-y-1">
        <p className="text-xs font-extrabold text-gray-800">
          {questionNumber} Como você entregará o documento ao cliente?
        </p>
        <p className="text-[11px] text-gray-400">
          Selecione o canal exclusivo de entrega para habilitar e realizar os disparos fáticos de envio automático.
        </p>
      </div>

      {/* Selector Badges/Toggles */}
      <div className="flex flex-wrap gap-2.5">
        {[
          {key: 'fisica', label: 'Física/Impressa', color: 'border-slate-200 text-slate-800 hover:border-slate-300'},
          { key: 'whatsapp', label: 'WhatsApp', color: 'border-emerald-200 text-emerald-800 hover:border-emerald-300' },
          { key: 'email', label: 'E-mail', color: 'border-blue-200 text-blue-800 hover:border-blue-300' },
          { key: 'outro', label: 'Outro', color: 'border-purple-200 text-purple-800 hover:border-purple-300' }
        ].map((m) => {
          const isActive = selectedMethods.includes(m.key);
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => toggleMethod(m.key)}
              className={`px-4 py-2 border rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
                isActive
                  ? 'bg-gray-900 border-gray-900 text-white shadow-xs scale-[1.02]'
                  : `bg-white ${m.color}`
              }`}
            >
              {isActive && <Check size={12} className="text-white" />}
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Content Columns / Cards for chosen methods */}
      <div className="space-y-3.5 pt-1">
        {/* 1.2.1 Físico en Mãos */}
        {selectedMethods.includes('fisica') && (
          <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block font-mono">
                  {questionNumber}.1 — Entrega Física
                </span>
                <p className="text-xs font-extrabold text-slate-900">
                  Imprimir {docInfo.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openGoogleDocPrint(docUrl)}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-3xs cursor-pointer"
              >
                <Printer size={12} />
                <span>Imprimir {docInfo.label}</span>
              </button>
            </div>

            {/* Validation Log */}
            <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl flex items-center gap-2 text-[11px] font-bold text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{docInfo.label} gerado disponível para impressão.</span>
            </div>
          </div>
        )}

        {/* 1.2.2 WhatsApp */}
        {selectedMethods.includes('whatsapp') && (
          <div className="border border-emerald-150 rounded-2xl p-4 bg-emerald-50/20 space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-col space-y-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block font-mono">
                    {questionNumber}.2 — Automação W.A Speed/Wascript no navegador
                  </span>
                  <span className={`text-[9px] font-black uppercase border rounded px-1.5 py-0.2 tracking-wider ${
                    waspeedStatus === 'Mensagem e PDF enviados via W.A Speed' || waspeedStatus === 'Conversa aberta no WhatsApp Web para conferência'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : waspeedStatus === 'Enviando mensagem e PDF via W.A Speed...'
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-200 animate-pulse'
                      : waspeedStatus.includes('Falha no envio')
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : waspeedStatus.includes('Envio concluído')
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : waspeedStatus.includes('bloqueado')
                      ? 'bg-orange-100 text-orange-800 border-orange-200'
                      : 'bg-slate-100 text-slate-800 border-slate-200'
                  }`}>
                    {waspeedStatus}
                  </span>
                </div>
                <p className="text-xs font-extrabold text-emerald-950">
                  W.A Speed / Wascript ({whatsappCliente || 'Número não cadastrado'})
                </p>
                <p className="text-[10px] text-emerald-700/80 font-semibold font-sans">
                  Automação de envio de mensagens e documentos pelo navegador via W.A Speed/Wascript. Usa o secret Wascript_API configurado e não depende da API oficial do WhatsApp.
                </p>
              </div>
  
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="button"
                  id="btn-enviar-wa-speed"
                  onClick={handleSendViaWASpeed}
                  disabled={sendingWhatsapp}
                  title={tipoDocumento === 'procuracao' ? 'Envia mensagem e PDF da procuração via W.A Speed' : 'Envia mensagem e documento via W.A Speed'}
                  className="w-full sm:w-auto min-h-[44px] justify-center text-center inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-3xs cursor-pointer select-none leading-normal break-words whitespace-normal"
                >
                  {sendingWhatsapp ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <MessageCircle size={14} className="shrink-0" />
                  )}
                  <span className="hidden sm:inline">
                    {sendingWhatsapp ? 'Enviando via W.A Speed...' : (tipoDocumento === 'procuracao' ? 'Enviar mensagem e PDF via W.A Speed' : 'Enviar mensagem e documento via W.A Speed')}
                  </span>
                  <span className="inline sm:hidden">
                    {sendingWhatsapp ? 'Enviando via W.A Speed...' : 'Enviar via W.A Speed'}
                  </span>
                </button>

                {/* Popup Blocker Fallback Button */}
                {(waspeedStatus === 'Conversa aberta no WhatsApp Web para conferência' ||
                  waspeedStatus === 'Mensagem e PDF enviados via W.A Speed' ||
                  waspeedStatus === 'Envio concluído. Clique em ‘Abrir conversa no WhatsApp Web’ para conferir.') && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetUrl = getWASpeedTargetUrl();
                      window.open(targetUrl, '_blank', 'noopener,noreferrer');
                      setWaspeedStatus("Conversa aberta no WhatsApp Web para conferência");
                      localStorage.setItem(`waspeed_status_${caseId}_${tipoDocumento}`, "Conversa aberta no WhatsApp Web para conferência");
                      
                      const currentLogs = [...waLogs];
                      currentLogs.push({
                        id: Date.now().toString(),
                        timestamp: new Date().toISOString(),
                        action: "WA_SPEED_ABERTO_MANUALMENTE",
                        route: window.location.pathname,
                        etapa: "Pergunta 1.2 — Como você entregará o documento ao cliente?",
                        documento: docInfo.label,
                        clientName: nomeCliente,
                        phoneOriginal: whatsappCliente,
                        phone: normalizeWhatsAppNumber(whatsappCliente),
                        payload: getWASpeedMessageText(),
                        pdfId: extractGoogleDocId(googleDocsUrl) || "N/A",
                        pdfStatus: 'gerado',
                        motor: "W.A Speed/Wascript",
                        secret: waDiagnostics?.configured ? "Wascript_API configurado" : "Wascript_API ausente/indisponível",
                        statusInicial: waspeedStatus,
                        statusFinal: "Conversa aberta no WhatsApp Web para conferência",
                        sucessoReal: "Sim",
                        error: "",
                        fallbackAcionado: "Não",
                        usuario: user?.email || 'Usuário Responsável',
                        detalhes: "WhatsApp Web aberto para conferência."
                      });
                      setWaLogs(currentLogs);
                      localStorage.setItem(`wa_logs_${caseId}_${tipoDocumento}`, JSON.stringify(currentLogs));
                    }}
                    className="w-full sm:w-auto min-h-[44px] justify-center text-center inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-3xs cursor-pointer select-none leading-normal break-words whitespace-normal animate-bounce"
                  >
                    <ExternalLink size={14} className="shrink-0" />
                    <span>Abrir conversa no WhatsApp Web</span>
                  </button>
                )}
              </div>
            </div>

            {/* Validation Feedback & Alerts */}
            {waspeedError && (
              <div className="flex flex-col gap-2">
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-800 rounded-xl text-[11px] font-bold flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0 text-rose-600" />
                  <span>{waspeedError}</span>
                </div>
                {(waspeedErrorCode === 'GOOGLE_DOCS_TOKEN_EXPIRED' ||
                  waspeedErrorCode === 'GOOGLE_AUTH_UNAUTHORIZED' ||
                  waspeedErrorCode === 'GOOGLE_DOCS_PERMISSION_DENIED' ||
                  waspeedErrorCode === 'GOOGLE_DOCS_CREDENTIALS_MISSING') && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await loginWithGoogle('boss_admin');
                        setWaspeedError(null);
                        setWaspeedErrorCode(null);
                      } catch (e: any) {
                        alert("Erro ao reautorizar conta Google: " + e.message);
                      }
                    }}
                    className="w-max px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all shadow-3xs cursor-pointer flex items-center gap-1.5"
                  >
                    <ExternalLink size={10} />
                    <span>Conectar com Google / Renovar Token</span>
                  </button>
                )}
              </div>
            )}

            {/* Accordion for Standard Message Preview and manual fallback */}
            <div className="pt-2 border-t border-emerald-150/40">
              <button
                type="button"
                onClick={() => setShowDefaultMessage(!showDefaultMessage)}
                className="flex items-center gap-1.5 text-[11px] font-black uppercase text-emerald-700 hover:text-emerald-900 tracking-wider cursor-pointer"
              >
                <span>{showDefaultMessage ? '▼ Ocultar mensagem padrão' : '▶ Ver mensagem padrão'}</span>
              </button>

              {showDefaultMessage && (
                <div className="mt-3 space-y-3 p-3 bg-white/80 rounded-xl border border-emerald-150/30 animate-in fade-in duration-200">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block font-mono">
                    Mensagem Padrão W.A Speed:
                  </span>
                  <div className="text-[11px] font-medium text-slate-700 whitespace-pre-wrap select-all bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono">
                    {getWASpeedMessageText()}
                  </div>
                  
                  {googleDocsUrl && !googleDocsUrl.includes('placeholder') && (
                    <div className="text-[9.5px] font-bold text-emerald-700 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Anexo: PDF da {tipoDocumento === 'procuracao' ? 'procuração' : 'declaração'} gerado do Google Docs.</span>
                    </div>
                  )}

                  {/* Actions inside the Accordion */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyMsg}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                    >
                      {copiedMsg ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      <span>{copiedMsg ? 'Copiado!' : 'Copiar mensagem'}</span>
                    </button>

                    {googleDocsUrl && !googleDocsUrl.includes('placeholder') && (
                      <button
                        type="button"
                        onClick={handleCopyPdfUrl}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                      >
                        {copiedPdf ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                        <span>{copiedPdf ? 'Copiado!' : 'Copiar link do PDF'}</span>
                      </button>
                    )}

                    {/* Fallback WhatsApp Manual only inside Accordion */}
                    <button
                      type="button"
                      onClick={handleOpenWhatsAppManual}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-3xs cursor-pointer"
                    >
                      <MessageCircle size={11} />
                      <span>Abrir WhatsApp com mensagem pronta</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Technical Log Accordion */}
            <div className="pt-2 border-t border-emerald-150/40 font-sans">
              <button
                type="button"
                onClick={() => setShowWaLogs(!showWaLogs)}
                className="flex items-center gap-1.5 text-[11px] font-black uppercase text-emerald-700 hover:text-emerald-900 tracking-wider cursor-pointer"
              >
                <span>👁️ {showWaLogs ? 'Ocultar logs técnicos' : '👁️ Ver logs técnicos do envio via W.A Speed'}</span>
                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[9px]">
                  {waLogs.length}
                </span>
              </button>

              {showWaLogs && (
                <div className="mt-3 p-3 bg-slate-900 text-slate-100 rounded-xl space-y-3 text-xs max-h-85 overflow-y-auto border border-slate-800 animate-in fade-in duration-200 font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-slate-400">HISTÓRICO DE LOGS TÉCNICOS</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Deseja realmente limpar todos os logs técnicos do WhatsApp para este documento?")) {
                          setWaLogs([]);
                          localStorage.removeItem(`wa_logs_${caseId}_${tipoDocumento}`);
                        }
                      }}
                      className="text-[9px] font-bold text-rose-400 hover:text-rose-300 underline"
                    >
                      Limpar Logs
                    </button>
                  </div>

                  {waLogs.length === 0 ? (
                    <div className="text-slate-500 py-4 text-center">Nenhum evento registrado ainda neste navegador.</div>
                  ) : (
                    <div className="space-y-4">
                      {waLogs.slice().reverse().map((log) => (
                        <div key={log.id} className="space-y-2 border-b border-slate-800/60 pb-3 last:border-0 last:pb-0 text-[10.5px]">
                          <div className="flex justify-between font-bold text-emerald-400 text-[10px]">
                            <span>[{log.action}]</span>
                            <span>{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300">
                            <div>• <span className="text-slate-500">Rota de Origem:</span> {log.route}</div>
                            <div>• <span className="text-slate-500">Etapa/Subetapa:</span> {log.etapa}</div>
                            <div>• <span className="text-slate-500">Documento Enviado:</span> {log.documento}</div>
                            <div>• <span className="text-slate-500">Nome do Cliente:</span> {log.clientName}</div>
                            <div>• <span className="text-slate-500">Telefone Usado:</span> {log.phone}</div>
                            <div className="col-span-2">• <span className="text-slate-500">Identificação do PDF:</span> <span className="text-blue-400 select-all break-all">{log.pdfId || 'N/A'}</span></div>
                            <div>• <span className="text-slate-500">Status do PDF:</span> <span className="text-yellow-400 uppercase">{log.pdfStatus}</span></div>
                            <div>• <span className="text-slate-500">Motor Usado:</span> {log.motor}</div>
                            <div>• <span className="text-slate-500">Secret Utilizado:</span> <span className="text-teal-400">{log.secret}</span></div>
                            <div>• <span className="text-slate-500">Status Inicial:</span> {log.statusInicial}</div>
                            <div>• <span className="text-slate-500">Status Final:</span> <span className="text-amber-400">{log.statusFinal}</span></div>
                            <div>• <span className="text-slate-500">Sucesso Real:</span> <span className={log.sucessoReal === 'Sim' ? 'text-emerald-400' : 'text-rose-400'}>{log.sucessoReal}</span></div>
                            <div>• <span className="text-slate-500">Fallback Acionado:</span> {log.fallbackAcionado}</div>
                            <div>• <span className="text-slate-500">Usuário Responsável:</span> {log.usuario}</div>
                            {log.error && (
                              <div className="col-span-2 text-rose-400 border border-rose-950/40 bg-rose-950/20 p-2 rounded-lg font-sans">• <span className="text-slate-500 font-mono">Erro Retornado:</span> {log.error}</div>
                            )}
                            <div className="col-span-2 bg-slate-950/60 p-2 rounded-lg text-slate-400 leading-normal font-sans">• <span className="text-slate-500 font-mono font-bold">Payload da Mensagem:</span><pre className="whitespace-pre-wrap text-[10px] text-slate-300 mt-1 font-mono">{log.payload}</pre></div>
                          </div>
                          {log.detalhes && (
                            <div className="text-slate-400 pl-2 border-l border-slate-700 mt-1 italic text-[10px] font-sans">
                              Obs: {log.detalhes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 1.2.3 E-mail (Gmail) */}
        {selectedMethods.includes('email') && (
          <div className="border border-blue-150 rounded-2xl p-4 bg-blue-50/25 space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block font-mono">
                    {questionNumber}.3 — Gmail Integration
                  </span>
                  <span className="text-[9px] font-black uppercase bg-blue-105 text-blue-800 border border-blue-200 rounded px-1.5 py-0.2 tracking-wider">
                    Conector Gmail
                  </span>
                </div>
                <p className="text-xs font-extrabold text-blue-950">
                  Transmissão por E-mail ({emailCliente || 'Email não cadastrado'})
                </p>
                <p className="text-[10px] text-blue-700/85 font-semibold font-sans">
                  Preparar e-mail rascunho com o PDF de {docInfo.label} anexado automaticamente na sua conta do Gmail integrada.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendGmail}
                  disabled={sendingGmail || !emailCliente || !docUrl || !resolvedGoogleAccessToken}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-3xs cursor-pointer"
                >
                  {sendingGmail ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <Mail size={12} />
                  )}
                  <span>{sendingGmail ? 'Preparando...' : 'Preparar e-mail no Gmail'}</span>
                </button>

                {emailCliente && (
                  <a
                    href={gmailUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold rounded-xl transition-all text-center"
                    title="Aviso: Abre compose de email convencional sem o PDF anexo de forma automática."
                  >
                    <ExternalLink size={11} />
                    <span>Gmail Web (Manual - Sem Anexo)</span>
                  </a>
                )}
              </div>
            </div>

            {/* Gmail result feedback */}
            {gmailResult && (
              <div className="space-y-2">
                <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-[11px] font-bold ${
                  gmailResult.success 
                    ? 'bg-blue-500/10 border-blue-250 text-blue-800' 
                    : 'bg-rose-550/10 border-rose-200 text-rose-800'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${gmailResult.success ? 'bg-blue-550' : 'bg-rose-550'}`}></span>
                  <span>{gmailResult.message}</span>
                </div>
                {!gmailResult.success && (
                  gmailResult.errorCode === 'GOOGLE_DOCS_TOKEN_EXPIRED' ||
                  gmailResult.errorCode === 'GOOGLE_AUTH_UNAUTHORIZED' ||
                  gmailResult.errorCode === 'GOOGLE_DOCS_CREDENTIALS_MISSING'
                ) && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await loginWithGoogle('boss_admin');
                        setGmailResult(null);
                      } catch (e: any) {
                        alert("Erro ao reautorizar conta Google: " + e.message);
                      }
                    }}
                    className="mt-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all shadow-3xs cursor-pointer flex items-center gap-1.5"
                  >
                    <ExternalLink size={10} />
                    <span>Conectar com Google / Renovar Token</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 1.2.4 Outro Canal de Entrega */}
        {selectedMethods.includes('outro') && (
          <div className="border border-purple-150 rounded-2xl p-4 bg-purple-50/20 space-y-3.5 animate-in fade-in duration-200">
            <div className="space-y-2">
              <span className="text-[9px] font-black text-purple-600 uppercase tracking-widest block font-mono">
                {questionNumber}.4 — Outro Canal de Comunicação
              </span>
              <p className="text-xs font-extrabold text-purple-950">
                Registrar forma alternativa de entrega
              </p>
              <input
                type="text"
                placeholder="Ex: Entregue via portador, Telegram, etc..."
                value={outroValue}
                onChange={(e) => onOutroChange(e.target.value)}
                className="w-full max-w-md px-3.5 py-2 bg-white border border-purple-200 focus:border-purple-500 rounded-xl text-xs font-semibold focus:outline-hidden transition-all shadow-3xs"
              />
            </div>

            {outroValue.trim() && (
              <div className="bg-purple-500/10 border border-purple-200 p-2.5 rounded-xl flex items-center gap-2 text-[11px] font-bold text-purple-800">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                <span>Forma alternativa de entrega registrada.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal for WhatsApp Delivery */}
      {showWhatsappConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 font-mono">
                <MessageCircle size={16} className="text-emerald-600" />
                {getModalTitle()}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowWhatsappConfirm(false);
                  setWhatsappResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 flex-1 overflow-y-auto text-xs font-sans text-slate-700">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Cliente</span>
                  <span className="font-extrabold text-slate-800">{nomeCliente}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">WhatsApp</span>
                  <span className="font-extrabold text-slate-800">{whatsappCliente || "Não cadastrado"}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-150">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Documento</span>
                  <span className="font-extrabold text-slate-800">{docInfo.label}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Anexo</span>
                  <span className="font-bold text-slate-600 flex items-center gap-1.5 pt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    PDF convertido a partir do Google Docs
                  </span>
                </div>
              </div>

              {/* Message preview */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Prévia da Mensagem (com asteriscos para negrito)</span>
                <div className="bg-emerald-50/60 border border-emerald-100 p-3.5 rounded-xl text-[11px] font-semibold text-emerald-950 leading-relaxed font-sans whitespace-pre-line">
                  {getWhatsappMessageText()}
                </div>
              </div>

              {/* Validation errors inside the modal */}
              {(!whatsappCliente || !docUrl || docUrl.includes('placeholder')) && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl text-[11px] font-bold">
                  ⚠️ {' '}
                  {!whatsappCliente 
                    ? 'WhatsApp do cliente não encontrado.' 
                    : (!docUrl || docUrl.includes('placeholder')) 
                    ? 'Documento ainda não foi gerado.' 
                    : ''}
                </div>
              )}

              {/* Google Connection helper banner */}
              {!resolvedGoogleAccessToken && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex flex-col gap-2.5 text-[11px]">
                  <div className="flex gap-1.5 items-center">
                    <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span className="font-extrabold uppercase tracking-wider text-amber-900">Google Drive & Docs Desconectado</span>
                  </div>
                  <p className="text-amber-800 leading-normal font-medium text-[10.5px]">
                    Sua sessão do Google Docs não possui autorização fática ativa para que o W.A Speed possa ler a procuração/declaração e convertê-la em PDF antes de enviar.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await loginWithGoogle('boss_admin');
                      } catch (e: any) {
                        alert("Erro ao conectar conta Google: " + e.message);
                      }
                    }}
                    className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shadow-3xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink size={12} />
                    <span>Conectar minha Conta Google / Renovar Session Token</span>
                  </button>
                </div>
              )}

              {/* Error/Success feedback inside the modal */}
              {whatsappResult && (
                <div id="whatsapp-feedback-status-modal" className={`p-3 rounded-xl border flex flex-col gap-1.5 text-[11px] ${
                  whatsappResult.success 
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-800 font-bold' 
                    : whatsappResult.pendingConfirmation
                    ? 'bg-amber-50 border-amber-200 text-amber-800 font-bold'
                    : 'bg-rose-550/10 border-rose-200 text-rose-800 font-bold'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      whatsappResult.success 
                        ? 'bg-emerald-500 animate-pulse' 
                        : whatsappResult.pendingConfirmation
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-rose-550'
                    }`}></span>
                    <span>{whatsappResult.pendingConfirmation ? "O W.A Speed respondeu, mas não confirmou o envio. A mensagem/PDF não foram considerados enviados." : whatsappResult.message}</span>
                  </div>
                  {whatsappResult.success && whatsappResult.delivery && (
                    <div className="text-[10px] text-emerald-700/80 font-normal pl-3.5 space-y-0.5">
                      <div>Texto: <span className="font-semibold uppercase text-[9px] px-1 py-0.2 bg-emerald-500/15 rounded">{whatsappResult.delivery.text.confidence}</span> — Documento: <span className="font-semibold uppercase text-[9px] px-1 py-0.2 bg-emerald-500/15 rounded">{whatsappResult.delivery.document.confidence}</span></div>
                    </div>
                  )}
                  {whatsappResult.pendingConfirmation && whatsappResult.diagnostic && (
                    <div className="text-[10px] text-amber-700/85 font-normal pl-3 space-y-1 mt-1 border-l-2 border-amber-300">
                      <div>• Telefone normalizado: <span className="font-semibold">{whatsappResult.phoneNormalized || whatsappResult.diagnostic.phoneNormalized || "N/A"}</span></div>
                      <div>• Status HTTP: <span className="font-semibold">{whatsappResult.diagnostic.status || "502 (Ambiguidade)"}</span></div>
                      {whatsappResult.diagnostic.textConfidence && (
                        <div>• Confiança Texto: <span className="font-semibold uppercase text-[9px] px-1.5 py-0.5 bg-amber-500/15 rounded">{whatsappResult.diagnostic.textConfidence}</span></div>
                      )}
                      {whatsappResult.diagnostic.documentConfidence && (
                        <div>• Confiança Documento: <span className="font-semibold uppercase text-[9px] px-1.5 py-0.5 bg-amber-500/15 rounded">{whatsappResult.diagnostic.documentConfidence}</span></div>
                      )}
                      {whatsappResult.diagnostic.textRawBodyPreview && (
                        <div className="mt-1">
                          • Retorno Texto API: 
                          <pre className="max-h-20 overflow-y-auto font-mono text-[9px] bg-amber-500/5 p-1 rounded border border-amber-500/10 mt-0.5 break-all whitespace-pre-wrap">
                            {whatsappResult.diagnostic.textRawBodyPreview}
                          </pre>
                        </div>
                      )}
                      {whatsappResult.diagnostic.documentRawBodyPreview && (
                        <div className="mt-1">
                          • Retorno PDF API: 
                          <pre className="max-h-20 overflow-y-auto font-mono text-[9px] bg-amber-500/5 p-1 rounded border border-amber-500/10 mt-0.5 break-all whitespace-pre-wrap">
                            {whatsappResult.diagnostic.documentRawBodyPreview}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                  {!whatsappResult.success && !whatsappResult.pendingConfirmation && whatsappResult.errorCode && (
                    <div className="text-[10px] text-rose-700/85 font-normal pl-3">
                      Código: {whatsappResult.errorCode}
                    </div>
                  )}
                  {!whatsappResult.success && !whatsappResult.pendingConfirmation && whatsappResult.diagnostic && (
                    <div className="text-[10px] text-rose-700/85 font-normal pl-3 space-y-1 mt-1 border-l-2 border-rose-300">
                      <div>• Telefone normalizado: <span className="font-semibold">{whatsappResult.diagnostic.phoneNormalized || "N/A"}</span></div>
                      {whatsappResult.diagnostic.status && (
                        <div>• Status API: <span className="font-semibold">{whatsappResult.diagnostic.status}</span></div>
                      )}
                      {whatsappResult.diagnostic.inspection?.reason && (
                        <div>• Motivo: <span className="font-semibold">{whatsappResult.diagnostic.inspection.reason}</span></div>
                      )}
                    </div>
                  )}
                  {!whatsappResult.success && whatsappResult.fileId && (
                    <div className="text-[10px] text-rose-700/85 font-normal pl-3">
                      ID do documento: {whatsappResult.fileId}
                    </div>
                  )}
                  {!whatsappResult.success && (
                    whatsappResult.errorCode === 'GOOGLE_DOCS_TOKEN_EXPIRED' || 
                    whatsappResult.errorCode === 'GOOGLE_AUTH_UNAUTHORIZED' ||
                    whatsappResult.errorCode === 'GOOGLE_DOCS_CREDENTIALS_MISSING'
                  ) && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await loginWithGoogle('boss_admin');
                          setWhatsappResult(null);
                        } catch (e: any) {
                          alert("Erro ao reautorizar conta Google: " + e.message);
                        }
                      }}
                      className="mt-1 w-max px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-3xs cursor-pointer flex items-center gap-1 shrink-0 self-start"
                    >
                      <ExternalLink size={10} />
                      <span>Conectar com Google / Renovar Token</span>
                    </button>
                  )}
                </div>
              )}

              {/* Technical diagnostics accordion */}
              <div className="border border-slate-150 rounded-xl overflow-hidden mt-3">
                <button
                  type="button"
                  onClick={() => setShowTechDetails(!showTechDetails)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider transition-all"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings size={12} className="text-slate-500" />
                    Diagnósticos & Logs Técnicos (API)
                  </span>
                  <span>{showTechDetails ? 'Recolher ▲' : 'Expandir ▼'}</span>
                </button>
                {showTechDetails && (
                  <div className="p-3 bg-white border-t border-slate-150 text-[10px] space-y-2.5 max-h-60 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 p-2 rounded">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Status Conector</span>
                        <span className="font-extrabold text-slate-800">{waDiagnostics?.configured ? "CONFIGURADO" : "NÃO CONFIGURADO"}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Origem do Token</span>
                        <span className="font-extrabold text-slate-800 break-all">{waDiagnostics?.tokenSource || "N/A"}</span>
                      </div>
                    </div>

                    {preflightData && (
                      <div className="space-y-1 bg-slate-50/50 p-2 rounded border border-slate-100">
                        <span className="text-[9px] uppercase font-black text-slate-500 tracking-wider block">Verificação Prévia (Preflight)</span>
                        <div>• Telefone válido: <span className={preflightData.phoneValidation?.valid ? "font-extrabold text-emerald-600" : "font-extrabold text-rose-600"}>{preflightData.phoneValidation?.valid ? "SIM" : "NÃO"}</span></div>
                        <div>• Validação do PDF: <span className={preflightData.pdfExportCheck === "ok" ? "font-extrabold text-emerald-600" : "font-extrabold text-rose-600"}>{preflightData.pdfExportCheck === "ok" ? "PRONTO" : "FALHA / INDISPONÍVEL"}</span></div>
                        <div>• Status geral de Prontidão: <span className="font-extrabold uppercase">{preflightData.readiness}</span></div>
                      </div>
                    )}

                    {prechecking && (
                      <div className="flex items-center gap-1.5 text-slate-500 py-1 font-semibold animate-pulse">
                        <span className="w-2.5 h-2.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                        <span>Carregando dados de prontidão técnica...</span>
                      </div>
                    )}

                    {whatsappResult && (
                      <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-150">
                        <span className="text-[9px] uppercase font-black text-slate-500 tracking-wider block">Resultado do Último Envio</span>
                        <div>• Sucesso Geral: <span className="font-bold">{whatsappResult.success ? "SIM" : "NÃO"}</span></div>
                        {whatsappResult.pendingConfirmation && (
                          <div className="text-amber-700 font-bold">• Confirmação Pendente (Aguardando Retorno de ID)</div>
                        )}
                        {whatsappResult.delivery && (
                          <div className="space-y-0.5 pl-2 font-semibold">
                            <div>• Confiança Texto: <span className="uppercase">{whatsappResult.delivery.text?.confidence || "N/A"}</span></div>
                            <div>• Detalhe Texto API: <span className="font-mono text-[9px]">{whatsappResult.delivery.text?.reason || "N/A"}</span></div>
                            <div>• Confiança PDF: <span className="uppercase">{whatsappResult.delivery.document?.confidence || "N/A"}</span></div>
                            <div>• Detalhe PDF API: <span className="font-mono text-[9px]">{whatsappResult.delivery.document?.reason || "N/A"}</span></div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Interactive Real Batch Diagnostics for W.A Speed */}
                    <div className="pt-2.5 border-t border-slate-150 space-y-2">
                      <span className="text-[9px] uppercase font-black text-indigo-600 tracking-wider block font-mono">
                        Painel de Diagnóstico em Tempo Real (Wascript API)
                      </span>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        O W.A Speed exige padrões de número específicos (com ou sem o 9º dígito). Clique abaixo para disparar mensagens de controle reais para as combinações de números possíveis e confirmar a conectividade seletiva.
                      </p>
                      
                      <button
                        type="button"
                        disabled={testingFormats || !whatsappCliente}
                        onClick={runTestPhoneFormats}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shadow-3xs cursor-pointer flex items-center gap-1 shrink-0 self-start"
                      >
                        {testingFormats ? (
                          <>
                            <span className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            <span>Testando Conexão Real...</span>
                          </>
                        ) : (
                          <span>Testar Conexão Real com W.A Speed</span>
                        )}
                      </button>

                      {testFormatsResult && (
                        <div className="space-y-2 mt-2 bg-slate-50/50 p-2.5 border border-slate-150 rounded-xl max-h-52 overflow-y-auto">
                          <span className="text-[9px] font-black text-slate-600 uppercase block font-mono">Retorno Direto da API W.A Speed:</span>
                          {testFormatsResult.length === 0 ? (
                            <div className="text-slate-500 italic text-[9px]">Nenhum formato alternativo para testar.</div>
                          ) : (
                            testFormatsResult.map((attempt: any, idx: number) => {
                              const isAttemptOk = attempt.inspection?.accepted;
                              return (
                                <div key={idx} className="p-2 bg-white rounded-lg border border-slate-150 text-[9px] space-y-1 font-mono text-slate-700">
                                  <div className="flex items-center justify-between font-bold border-b border-slate-100 pb-1">
                                    <span>Nº: <span className="text-indigo-600 font-extrabold">{attempt.format}</span></span>
                                    <span className={isAttemptOk ? "text-emerald-600 uppercase" : "text-rose-600 uppercase font-extrabold"}>
                                      {isAttemptOk ? "ATIVA / ACEITA" : "FALHA / REJEITADA"}
                                    </span>
                                  </div>
                                  <div>• HTTP Status: <span className="font-extrabold">{attempt.httpStatus || attempt.error || "N/A"}</span></div>
                                  {attempt.inspection?.reason && (
                                    <div>• Status Técnico: <span className="font-semibold text-slate-500 font-sans">{attempt.inspection.reason}</span></div>
                                  )}
                                  {attempt.rawBodyPreview && (
                                    <div className="text-[8px] bg-slate-50 p-1.5 rounded font-mono text-slate-600 max-h-16 overflow-y-auto break-all whitespace-pre-wrap leading-normal border border-slate-100 mt-1">
                                      Corpo: {attempt.rawBodyPreview}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowWhatsappConfirm(false);
                  setWhatsappResult(null);
                }}
                className="px-4 py-2 hover:bg-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all border border-slate-250 cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmWhatsappSend}
                disabled={sendingWhatsapp || !whatsappCliente || !docUrl || docUrl.includes('placeholder')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-3xs cursor-pointer flex items-center gap-1.5 text-center"
              >
                {sendingWhatsapp ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Preparando...</span>
                  </>
                ) : (
                  <span>Confirmar envio pelo W.A Speed</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
