import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../../lib/firebase';
import { collection, setDoc, doc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { 
  Cloud, 
  Search, 
  ArrowLeft, 
  FolderOpen, 
  UserCheck, 
  BadgeCheck, 
  FileText, 
  Link2, 
  RefreshCw, 
  Lock, 
  Check, 
  Building2, 
  User, 
  Phone, 
  Mail, 
  Clock, 
  AlertCircle,
  Database,
  ExternalLink,
  ChevronRight,
  Terminal,
  ShieldAlert,
  Users
} from 'lucide-react';
import { BossLayout } from '../../../components/Layout';
import { motion, AnimatePresence } from 'motion/react';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

interface TechLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  status: 'sucesso' | 'info' | 'erro' | 'alerta';
  user: string;
}

export default function Recadastramento() {
  const navigate = useNavigate();
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [driveResults, setDriveResults] = useState<DriveFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  
  // Matching clients state
  const [matchingClients, setMatchingClients] = useState<any[]>([]);
  const [isMatchingClientLoading, setIsMatchingClientLoading] = useState(false);
  const [hasCheckedVincular, setHasCheckedVincular] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  // Conversion form state
  const [clientType, setClientType] = useState<'PF' | 'PJ'>('PF');
  const [clientName, setClientName] = useState('');
  const [documento, setDocumento] = useState('');
  const [emailLogin, setEmailLogin] = useState('');
  const [senhaAcesso, setSenhaAcesso] = useState('');
  const [telefone, setTelefone] = useState('');
  
  const [isConverting, setIsConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [conversionSuccess, setConversionSuccess] = useState<string | null>(null);
  const [convertedClientId, setConvertedClientId] = useState<string | null>(null);

  // Technical Log State
  const [techLogs, setTechLogs] = useState<TechLog[]>([]);

  // Add a log entry helper
  const addLog = (action: string, details: string, status: 'sucesso' | 'info' | 'erro' | 'alerta') => {
    const newLog: TechLog = {
      id: `log_recad_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      status,
      user: auth.currentUser?.email || 'direito.rgr@gmail.com'
    };
    setTechLogs(prev => [newLog, ...prev]);
    try {
      const existing = localStorage.getItem('tech_logs_recadastramento');
      const parsed = existing ? JSON.parse(existing) : [];
      localStorage.setItem('tech_logs_recadastramento', JSON.stringify([newLog, ...parsed].slice(0, 100)));
    } catch (e) {
      console.error('Error saving log to localStorage:', e);
    }
  };

  // Initial load
  useEffect(() => {
    // Try to load token from session if available
    const savedToken = sessionStorage.getItem('google_drive_recad_token');
    const savedUser = sessionStorage.getItem('google_drive_recad_user');
    if (savedToken) {
      setGoogleToken(savedToken);
      if (savedUser) setGoogleUser(JSON.parse(savedUser));
    }

    try {
      const existing = localStorage.getItem('tech_logs_recadastramento');
      if (existing) {
        setTechLogs(JSON.parse(existing));
      }
    } catch (e) {
      console.error(e);
    }

    // Log the entry/opening of the module
    addLog(
      'Abertura do módulo',
      'Módulo "4. Recadastramento" iniciado com sucesso (Acesso via botão "Cadastrar Legado" registrado).',
      'info'
    );
  }, []);

  // Auto pre-fill login password with safe defaults
  useEffect(() => {
    if (clientName) {
      const emailFriendly = clientName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '') + '@giffoni.com.br';
      setEmailLogin(emailFriendly);
      setSenhaAcesso('123456'); // Standard starting PIN
    }
  }, [clientName]);

  // Connect to Google Drive to query real files
  const handleConnectGoogleDrive = async () => {
    setIsConnecting(true);
    setConversionError(null);
    addLog('Conexão Google Drive', 'Solicitando login e escopo de leitura do Google Drive...', 'info');
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.readonly');
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleToken(credential.accessToken);
        setGoogleUser(result.user);
        sessionStorage.setItem('google_drive_recad_token', credential.accessToken);
        sessionStorage.setItem('google_drive_recad_user', JSON.stringify(result.user));

        addLog(
          'Conexão Google Drive',
          `Conectado com sucesso como: ${result.user.email}. Autorização validada.`,
          'sucesso'
        );

        // Load initial files from real Google Drive
        triggerRealDriveSearch(credential.accessToken, searchQuery);
      } else {
        throw new Error('Falha ao reter token de acesso do Google.');
      }
    } catch (err: any) {
      console.error('Google Drive Connection Error:', err);
      let friendlyMessage = err.message || err;
      if (
        err.code === 'auth/popup-closed-by-user' ||
        String(err).includes('popup-closed-by-user') ||
        (err.message && String(err.message).includes('popup-closed-by-user'))
      ) {
        friendlyMessage = "A janela de conexão do Google foi fechada antes de concluir. Por favor, tente novamente.";
      }
      setConversionError(`Erro de conexão com o Drive: ${friendlyMessage}`);
      addLog('Erro de integração', `Falha ao conectar com o Google Drive: ${friendlyMessage}`, 'erro');
    } finally {
      setIsConnecting(false);
    }
  };

  const triggerRealDriveSearch = async (token: string, queryText: string) => {
    setIsLoading(true);
    addLog(
      'Consulta ao Google Drive',
      `Pesquisando termo "${queryText || 'Tudo'}" no Google Drive real do escritório.`,
      'info'
    );
    try {
      let q = "mimeType = 'application/vnd.google-apps.folder' or mimeType = 'application/pdf'";
      if (queryText.trim()) {
        const escaped = queryText.replace(/'/g, "\\'");
        q = `(${q}) and name contains '${escaped}'`;
      }
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,modifiedTime,size,webViewLink)&pageSize=20`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha na resposta do serviço de busca do Google Drive.');
      const data = await res.json();
      if (data.files) {
        setDriveResults(data.files);
        addLog(
          'Consulta ao Google Drive',
          `Consulta concluída. Encontrados ${data.files.length} resultados reais no Google Drive do escritório.`,
          'sucesso'
        );
      } else {
        setDriveResults([]);
        addLog(
          'Consulta ao Google Drive',
          'Consulta concluída. Nenhum resultado localizado.',
          'alerta'
        );
      }
    } catch (err: any) {
      console.error(err);
      addLog(
        'Erro de integração',
        `Falha técnica ao consultar o Google Drive real: ${err.message || err}`,
        'erro'
      );
      setConversionError('Erro ao buscar arquivos reais no Google Drive. Verifique as credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger search on query change, only if we have token
  useEffect(() => {
    if (googleToken) {
      const delayDebounce = setTimeout(() => {
        triggerRealDriveSearch(googleToken, searchQuery);
      }, 600);
      return () => clearTimeout(delayDebounce);
    } else if (searchQuery.trim()) {
      // Typing search queries when not connected logs blocked simulation attempt
      const delayDebounce = setTimeout(() => {
        addLog(
          'Uso de dados simulados bloqueado',
          `Busca por "${searchQuery}" bloqueada. Conexão com o Google Drive real é obrigatória.`,
          'erro'
        );
      }, 800);
      return () => clearTimeout(delayDebounce);
    }
  }, [searchQuery, googleToken]);

  const handleSelectResult = async (file: DriveFile) => {
    setSelectedFile(file);
    await checkClientExists(file);
  };

  const handleOpenFolderInDrive = (file: DriveFile, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card selection automatically
    
    if (!googleToken) {
      const motivo = "Não foi possível abrir a pasta: integração com Google Drive indisponível ou sem permissão.";
      alert(motivo);
      addLog(
        'Abertura de Pasta',
        `Não foi possível abrir a pasta no Google Drive. Motivo: ${motivo}`,
        'erro'
      );
      return;
    }

    if (driveResults.length > 1 && (!selectedFile || selectedFile.id !== file.id)) {
      const motivo = "Selecione uma pasta encontrada antes de abrir no Google Drive.";
      alert(motivo);
      addLog(
        'Abertura de Pasta',
        `Não foi possível abrir a pasta no Google Drive. Motivo: ${motivo}`,
        'erro'
      );
      return;
    }

    if (!file.webViewLink) {
      const motivo = "Nenhuma pasta do Google Drive foi localizada para abrir.";
      alert(motivo);
      addLog(
        'Abertura de Pasta',
        `Não foi possível abrir a pasta no Google Drive. Motivo: ${motivo}`,
        'erro'
      );
      return;
    }

    // Success opening!
    addLog(
      'Abertura de Pasta',
      'Pasta localizada. Abertura no Google Drive realizada pelo botão “Abrir pasta no Google Drive”.',
      'sucesso'
    );
    window.open(file.webViewLink, '_blank', 'noopener,noreferrer');
  };

  const checkClientExists = async (file: DriveFile) => {
    setIsMatchingClientLoading(true);
    setMatchingClients([]);
    setHasCheckedVincular(true);
    setShowManualForm(false);
    
    // Extrapolate clean client name candidate from folder name
    const cleanCandidateName = file.name
      .replace('Pasta Geral - ', '')
      .replace('Pasta Corporativa - ', '')
      .replace('Pasta Operacional - ', '')
      .replace('Pasta Executiva - ', '')
      .replace(/\(Contrato.*\)/g, '')
      .replace(/\(Legado.*\)/g, '')
      .replace(/\(Extrajudicial.*\)/g, '')
      .trim();

    addLog(
      'Item selecionado',
      `Usuário selecionou o arquivo/pasta do Drive: "${file.name}" (ID: ${file.id}). Iniciando auditoria de vínculo no sistema.`,
      'info'
    );

    try {
      let foundList: any[] = [];

      // 1. Check exact match on legacyFileId
      const qByFileId = query(collection(db, 'clientes'), where('legacyFileId', '==', file.id));
      const snapByFileId = await getDocs(qByFileId);
      snapByFileId.forEach((d) => {
        foundList.push({ id: d.id, ...d.data() });
      });

      // 2. Check exact match on Name (if none found yet)
      if (foundList.length === 0) {
        const qByName = query(collection(db, 'clientes'), where('name', '==', cleanCandidateName));
        const snapByName = await getDocs(qByName);
        snapByName.forEach((d) => {
          foundList.push({ id: d.id, ...d.data() });
        });
      }

      // 3. Smart partial name matching from fetched clients to find potential duplicate records safely
      if (foundList.length === 0) {
        const allSnap = await getDocs(collection(db, 'clientes'));
        const queryLower = cleanCandidateName.toLowerCase();
        allSnap.forEach((d) => {
          const clientData = d.data();
          const dbName = (clientData.name || clientData.nome || '').toLowerCase();
          if (dbName.includes(queryLower) || queryLower.includes(dbName)) {
            if (!foundList.some(item => item.id === d.id)) {
              foundList.push({ id: d.id, ...clientData });
            }
          }
        });
      }

      setMatchingClients(foundList);

      if (foundList.length > 0) {
        addLog(
          'Vínculo identificado',
          `Vínculo localizado no sistema: ${foundList.length} cliente(s) real(is) correspondente(s) encontrado(s) para "${cleanCandidateName}".`,
          'sucesso'
        );
      } else {
        addLog(
          'Nenhum vínculo',
          `Nenhum cliente cadastrado correspondente a "${cleanCandidateName}" foi encontrado no banco de dados.`,
          'alerta'
        );
        // Automatically set up values for new recadastramento legacy creation
        setClientName(cleanCandidateName);
        setClientType(file.name.includes('Corporativa') || file.name.includes('Alfa') || file.name.includes('ME') ? 'PJ' : 'PF');
        setDocumento('');
        setTelefone('');
        setConversionError(null);
        setConversionSuccess(null);
        setShowManualForm(true);
      }
    } catch (err: any) {
      console.error('Error finding matching client:', err);
      addLog('Erro de correspondência', `Falha ao ler dados de clientes do Firestore: ${err.message}`, 'erro');
    } finally {
      setIsMatchingClientLoading(false);
    }
  };

  const handleRedirectToClient = (client: any) => {
    addLog(
      'Redirecionamento para cliente',
      `Redirecionando de forma segura para a página real do cliente: "${client.name || client.nome}" (ID: ${client.id}, Slug: ${client.slug || 'N/A'}).`,
      'sucesso'
    );
    if (client.slug) {
      navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${client.slug}/Editar-Painel-Geral-do-Cliente`);
    } else {
      alert("Não foi possível abrir o Editor do Portal porque o cliente não possui slug cadastrado.");
    }
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (clientType === 'PF') {
      let val = raw.substring(0, 11);
      if (val.length > 9) val = val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      else if (val.length > 6) val = val.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
      else if (val.length > 3) val = val.replace(/(\d{3})(\d{3})/, '$1.$2');
      setDocumento(val);
    } else {
      let val = raw.substring(0, 14);
      if (val.length > 12) val = val.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      else if (val.length > 8) val = val.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '$1.$2.$3/$4');
      else if (val.length > 5) val = val.replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3');
      setDocumento(val);
    }
  };

  const executeConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    setConversionError(null);
    setConversionSuccess(null);

    const docValue = documento.replace(/\D/g, '');
    if (!clientName.trim()) {
      setConversionError('Nome do cliente é obrigatório.');
      return;
    }
    if (clientType === 'PF' && docValue.length !== 11) {
      setConversionError('Preencha um CPF válido de 11 dígitos.');
      return;
    }
    if (clientType === 'PJ' && docValue.length !== 14) {
      setConversionError('Preencha um CNPJ válido de 14 dígitos.');
      return;
    }
    if (!emailLogin.includes('@')) {
      setConversionError('Insira um e-mail de login válido.');
      return;
    }
    if (senhaAcesso.length < 6) {
      setConversionError('A senha do Portal do Cliente deve conter no mínimo 6 caracteres/dígitos.');
      return;
    }

    setIsConverting(true);
    addLog('Iniciar Recadastramento', `Iniciando gravação de dados reais do recadastramento legado de "${clientName}" no Firestore.`, 'info');

    try {
      let cleanSlug = clientName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      if (!cleanSlug) cleanSlug = 'cliente';

      const slugCheck = await getDoc(doc(db, 'clientPortals', cleanSlug));
      if (slugCheck.exists()) {
        cleanSlug = `${cleanSlug}-${docValue.substring(0, 4)}`;
      }

      const targetClientId = doc(collection(db, 'clients')).id;
      const rightNow = new Date().toISOString();

      const pfBlock = clientType === 'PF' ? {
        pf_nomeCompleto: clientName,
        pf_cpf: documento,
        pf_email: emailLogin,
        pf_telefone: telefone,
        pf_whatsapp: telefone,
        pf_estadoCivil: 'Não Informado',
        pf_nacionalidade: 'Brasileira'
      } : {};

      const pjBlock = clientType === 'PJ' ? {
        pj_razaoSocial: clientName,
        pj_cnpj: documento,
        pj_emailEmpresa: emailLogin,
        pj_telefoneEmpresa: telefone,
        pj_whatsappEmpresa: telefone
      } : {};

      const payload: any = {
        clientId: targetClientId,
        type: clientType,
        active: true,
        visibleToClient: true,
        portalStatus: 'criado',
        cadastroIncompleto: false,
        missingFields: [],
        slug: cleanSlug,
        senhaVisivelPreview: senhaAcesso,
        avisoSegurancaSenha: true,
        createdAt: rightNow,
        updatedAt: rightNow,
        pfData: pfBlock,
        pfDadosPessoais: pfBlock,
        pjData: pjBlock,
        pjDadosEmpresa: pjBlock,
        acessoSistema: {
          acesso_emailLogin: emailLogin,
          acesso_statusAcesso: 'Liberado',
          acesso_senha: senhaAcesso
        },
        legacyLink: {
          fileId: selectedFile?.id || '',
          fileName: selectedFile?.name || '',
          mimeType: selectedFile?.mimeType || '',
          webViewLink: selectedFile?.webViewLink || ''
        },
        portalMirror: {
          name: clientName,
          type: clientType,
          pfDadosPessoais: {
            nomeCompleto: clientType === 'PF' ? clientName : '',
            cpf: clientType === 'PF' ? documento : ''
          },
          pfContato: {
            email: emailLogin,
            telefone: telefone
          }
        }
      };

      // 1. Write to clients collection
      await setDoc(doc(db, 'clients', targetClientId), payload);

      // 2. Write to clientes collection (flat structure)
      await setDoc(doc(db, 'clientes', targetClientId), {
        id: targetClientId,
        clientId: targetClientId,
        slug: cleanSlug,
        nome: clientName,
        name: clientName,
        tipoPessoa: clientType,
        type: clientType,
        cpfCnpj: documento,
        email: emailLogin,
        telefone: telefone,
        status: 'active',
        portalAtivo: true,
        legacyMigrated: true,
        legacyFileId: selectedFile?.id || '',
        createdAt: rightNow,
        updatedAt: rightNow
      });

      // 3. Write to clientPortals
      await setDoc(doc(db, 'clientPortals', cleanSlug), {
        clientId: targetClientId,
        slug: cleanSlug,
        senhaVisivelPreview: senhaAcesso,
        updatedAt: rightNow
      });

      setConvertedClientId(targetClientId);
      setConversionSuccess(`Cliente "${clientName}" recadastrado e convertido de forma exemplar no sistema Giffoni Connect Portal BOSS!`);
      
      addLog(
        'Recadastramento concluído',
        `Recadastramento legado executado com absoluto sucesso para o cliente "${clientName}" (ID: ${targetClientId}, Slug: ${cleanSlug}).`,
        'sucesso'
      );

      setSelectedFile(null);
      setSearchQuery('');
      setHasCheckedVincular(false);
      setShowManualForm(false);
    } catch (err: any) {
      console.error(err);
      setConversionError(`Erro técnico ao salvar conversão: ${err.message || err}`);
      addLog(
        'Erro ao salvar recadastramento',
        `Falha na gravação dos registros do cliente: ${err.message || err}`,
        'erro'
      );
    } finally {
      setIsConverting(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
    setHasCheckedVincular(false);
    setMatchingClients([]);
    setShowManualForm(false);
    addLog('Seleção cancelada', 'Usuário desfez a seleção atual de arquivo/pasta.', 'info');
  };

  return (
    <BossLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <button
              onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
              className="flex items-center gap-1.5 text-xs font-black text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest"
            >
              <ArrowLeft size={14} /> Voltar ao Painel
            </button>
            <div className="flex items-center gap-2.5 mt-2">
              <Cloud className="text-blue-500" size={26} />
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">4. Recadastramento de Clientes Legados</h2>
            </div>
            <p className="text-xs text-gray-500">
              Rotina administrativa exclusiva para transição e parametrização do acervo legado do Google Drive real para o Portal BOSS.
            </p>
          </div>

          <div>
            {googleToken ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-800 text-xs font-bold leading-none shadow-3xs animate-fade-in">
                <BadgeCheck size={16} className="text-emerald-600" />
                <span>Google Drive Conectado ({googleUser?.email || 'Nuvem'})</span>
              </div>
            ) : (
              <button
                onClick={handleConnectGoogleDrive}
                disabled={isConnecting}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-black rounded-2xl flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow transition-all"
              >
                {isConnecting ? (
                  <RefreshCw className="animate-spin" size={14} />
                ) : (
                  <Cloud size={14} />
                )}
                Conectar Google Drive Real
              </button>
            )}
          </div>
        </div>

        {/* GOOGLE DRIVE WARNING BANNERS */}
        {!googleToken && (
          <div className="p-4 bg-blue-50 border border-blue-150 rounded-2.5xl text-left flex gap-3 items-start shadow-3xs">
            <ShieldAlert size={20} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase text-blue-950 tracking-wider">Conexão com Google Drive Requerida</h4>
              <p className="text-xs text-blue-800 leading-relaxed font-semibold">
                Para consultar os arquivos de forma 100% fidedigna e sem simulações, clique em <strong>"Conectar Google Drive Real"</strong> para autorizar a leitura do repositório de documentos do escritório. Buscas fakes ou simuladas estão desativadas.
              </p>
            </div>
          </div>
        )}

        {/* CONTAINER WORKFLOW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* SEARCH SIDE */}
          <div className={`${selectedFile ? 'lg:col-span-6' : 'lg:col-span-12'} transition-all space-y-4`}>
            
            <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  <Database size={16} className="text-gray-400" /> Buscador Real do Acervo do Escritório
                </h3>
                <span className="text-[10px] font-mono text-gray-450 bg-gray-50 border border-gray-100 px-2.5 py-0.5 rounded-full font-bold">
                  Integração Google API
                </span>
              </div>

              {/* SEARCH INPUT */}
              <div className="relative">
                <input
                  type="text"
                  disabled={!googleToken}
                  placeholder={googleToken ? "Pesquise por nome, cpf, empresa ou pasta no Drive real..." : "⚠️ Conecte o Google Drive real acima para habilitar a busca..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3 border border-gray-150 rounded-2xl text-sm font-bold outline-none transition-all placeholder:text-gray-450 ${
                    googleToken 
                      ? 'bg-gray-50/50 focus:border-blue-600 focus:bg-white text-gray-900 shadow-inner' 
                      : 'bg-gray-50 cursor-not-allowed text-gray-400'
                  }`}
                />
                <Search size={18} className="absolute left-4 top-3.5 text-gray-400" />
              </div>

              {googleToken && (
                <div className="flex items-center gap-4 text-[11px] font-mono text-gray-400 px-1 font-semibold">
                  <span className="flex items-center gap-1"><Check size={12} className="text-emerald-500" /> Google Drive Indexer Ativo</span>
                  <span>•</span>
                  <span>{driveResults.length} pastas/documentos encontrados em tempo real</span>
                </div>
              )}
            </div>

            {/* RESULTS LIST */}
            {googleToken && (
              <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-black text-gray-450 uppercase tracking-wider">Resultados Reais Localizados no Drive</h4>
                
                {isLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="animate-spin text-blue-500" size={24} />
                    <span className="text-xs font-mono text-gray-400 font-bold">Buscando pastas de clientes no Google Drive real...</span>
                  </div>
                ) : driveResults.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                    <AlertCircle size={24} className="text-gray-300" />
                    <p className="text-xs font-bold text-gray-500">Nenhum registro correspondente foi encontrado.</p>
                    <p className="text-[10px] text-gray-450 max-w-sm px-4 font-semibold">A busca retornou zero resultados para o termo digitado no seu Google Drive.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {driveResults.map(file => {
                      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                      const isSelected = selectedFile?.id === file.id;

                      return (
                        <div
                          key={file.id}
                          className={`p-3.5 border rounded-2xl transition-all flex items-center justify-between gap-4 text-left ${
                            isSelected 
                              ? 'border-blue-600 bg-blue-50/20 shadow-sm'
                              : 'border-gray-100 hover:border-blue-500 cursor-pointer bg-white shadow-3xs'
                          }`}
                          onClick={() => handleSelectResult(file)}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`p-2.5 rounded-xl shrink-0 ${
                              isFolder ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'
                            }`}>
                              <FolderOpen size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-gray-900 truncate pr-2">{file.name}</p>
                              <p className="text-[10px] font-mono text-gray-400 mt-1 flex flex-wrap gap-1.5 items-center font-bold">
                                <span className="uppercase">{isFolder ? 'PASTA DRIVE' : 'DOCUMENTO PDF'}</span>
                                <span>•</span>
                                <span>Modificado: {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '—'}</span>
                                {file.size && (
                                  <>
                                    <span>•</span>
                                    <span>{file.size}</span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleOpenFolderInDrive(file, e)}
                              className={`px-3 py-1.5 text-[11px] font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border ${
                                (driveResults.length > 1 && !isSelected)
                                  ? 'border-gray-200 bg-gray-50/50 text-gray-400 cursor-not-allowed opacity-60'
                                  : 'border-gray-200 hover:border-blue-200 bg-white hover:bg-blue-50/40 text-gray-600 hover:text-blue-600 shadow-3xs'
                              }`}
                            >
                              <ExternalLink size={12} />
                              <span>Abrir pasta no Google Drive</span>
                            </button>

                            <button
                              type="button"
                              className={`px-3.5 py-1.5 text-[11px] font-extrabold rounded-xl flex items-center gap-1 transition-all cursor-pointer ${
                                isSelected 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-gray-50 hover:bg-blue-50 border border-gray-150 text-blue-700'
                              }`}
                            >
                              {isSelected ? (
                                <>Verificar <Check size={12} /></>
                              ) : (
                                <>Verificar <ChevronRight size={12} /></>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT AUDITING PANEL */}
          <AnimatePresence>
            {selectedFile && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="lg:col-span-6 bg-white border border-gray-150 rounded-3xl p-6 shadow-sm space-y-5 flex flex-col self-start sticky top-4 text-left"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="font-black text-gray-950 text-sm flex items-center gap-1.5">
                      <BadgeCheck size={18} className="text-blue-500 shrink-0" /> Auditoria de Vínculo de Acervo
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5 font-semibold">Análise de duplicidade para a pasta: <span className="font-mono text-gray-600 font-bold">{selectedFile.name.substring(0, 32)}...</span></p>
                  </div>
                  <button
                    onClick={handleClearSelection}
                    className="p-1 px-2 hover:bg-gray-100 rounded-lg text-xs font-black text-gray-400 hover:text-gray-900 transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    Fechar
                  </button>
                </div>

                {/* MATCHING LOADING */}
                {isMatchingClientLoading && (
                  <div className="py-8 text-center space-y-2">
                    <RefreshCw className="animate-spin text-blue-600 mx-auto" size={24} />
                    <p className="text-xs font-bold text-gray-500 font-mono">Consultando banco de dados de clientes reais...</p>
                  </div>
                )}

                {/* MULTIPLE / SINGLE VINCULO FOUND SECTION */}
                {!isMatchingClientLoading && hasCheckedVincular && matchingClients.length > 0 && (
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
                    <div className="flex items-start gap-2 text-emerald-950">
                      <BadgeCheck className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wide">
                          {matchingClients.length > 1 
                            ? 'Foram encontrados múltiplos resultados. Selecione o cliente correto para continuar.' 
                            : 'Vínculo Real Identificado no Sistema!'}
                        </h4>
                        <p className="text-[11px] text-emerald-800 font-semibold leading-normal mt-0.5">
                          {matchingClients.length > 1 
                            ? 'Múltiplos clientes compatíveis encontrados no Firestore. Escolha o registro original para direcionar o prontuário.'
                            : 'Este arquivo do Google Drive já possui um cliente correspondente real cadastrado.'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 mt-2">
                      {matchingClients.map((client) => (
                        <div key={client.id} className="p-3 bg-white border border-emerald-150 rounded-xl flex items-center justify-between gap-3 shadow-3xs text-xs">
                          <div>
                            <p className="font-extrabold text-gray-900">{client.name || client.nome || 'Sem nome'}</p>
                            <p className="text-[10px] font-mono text-gray-500 mt-0.5 font-bold">
                              CPF/CNPJ: {client.cpfCnpj || client.pfDadosPessoais?.pf_cpf || client.pjDadosEmpresa?.pj_cnpj || 'Não cadastrado'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRedirectToClient(client)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[11px] font-black tracking-wide flex items-center gap-1 transition-all cursor-pointer shadow-3xs uppercase"
                          >
                            Acessar Portal <ExternalLink size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-emerald-150 flex justify-between items-center text-[11px]">
                      <span className="text-emerald-800 font-semibold">Deseja criar uma nova ficha cadastral mesmo assim?</span>
                      <button
                        type="button"
                        onClick={() => setShowManualForm(true)}
                        className="text-blue-600 hover:underline font-extrabold cursor-pointer"
                      >
                        Iniciar Novo Cadastro Legado
                      </button>
                    </div>
                  </div>
                )}

                {/* NO VINCULO FOUND AT ALL SECTION */}
                {!isMatchingClientLoading && hasCheckedVincular && matchingClients.length === 0 && !showManualForm && (
                  <div className="p-4.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex gap-2.5 items-start">
                      <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                      <div>
                        <h4 className="text-xs font-black uppercase text-amber-950 tracking-wider">Sem Vínculo no Sistema</h4>
                        <p className="text-[11px] text-amber-800 leading-normal font-semibold mt-0.5">
                          Resultado localizado no Google Drive, mas ainda não há página de cliente vinculada no sistema.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowManualForm(true)}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-750 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-3xs"
                    >
                      Cadastrar Legado (Iniciar Recadastramento Novo)
                    </button>
                  </div>
                )}

                {/* PARAMETRIZATION CONVERSION FORM */}
                {showManualForm && (
                  <div className="space-y-4 animate-slide-down">
                    <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                      <p className="text-[10.5px] text-blue-900 font-semibold">
                        🛠️ Parametrizando novo cadastro a partir da pasta real. Todos os dados fictícios ou mocks foram desativados.
                      </p>
                    </div>

                    {conversionError && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-800 text-xs flex gap-2 items-start font-semibold">
                        <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                        <span>{conversionError}</span>
                      </div>
                    )}

                    <form onSubmit={executeConversion} className="space-y-4">
                      
                      {/* CLIENT TYPE PICKER */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block">Tipo do Cliente Conversor</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setClientType('PF');
                              setDocumento('');
                            }}
                            className={`py-2 px-3 border rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              clientType === 'PF' 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-3xs'
                                : 'bg-white hover:bg-gray-50 border-gray-150 text-gray-650'
                            }`}
                          >
                            <User size={14} /> Pessoa Física (PF)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setClientType('PJ');
                              setDocumento('');
                            }}
                            className={`py-2 px-3 border rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              clientType === 'PJ' 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-3xs'
                                : 'bg-white hover:bg-gray-50 border-gray-150 text-gray-650'
                            }`}
                          >
                            <Building2 size={14} /> Pessoa Jurídica (PJ)
                          </button>
                        </div>
                      </div>

                      {/* CLIENT NAME */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block">
                          {clientType === 'PF' ? 'Nome Completo do Cliente' : 'Razão Social da Empresa'}
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full px-3.5 py-2.5 border border-gray-150 bg-white rounded-xl text-xs font-bold text-gray-900 outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                        />
                      </div>

                      {/* DOCUMENTO (CPF/CNPJ) */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest block">
                          {clientType === 'PF' ? 'CPF do Titular' : 'CNPJ da Empresa'}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder={clientType === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                          className="w-full px-3.5 py-2.5 border border-gray-150 bg-white rounded-xl text-xs font-mono font-bold text-gray-950 outline-none focus:ring-1 focus:ring-blue-600"
                          value={documento}
                          onChange={handleDocumentChange}
                        />
                      </div>

                      {/* CONTACTS */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 block">
                            <Phone size={10} /> Telefone / WhatsApp
                          </label>
                          <input
                            type="text"
                            placeholder="(00) 00000-0000"
                            className="w-full px-3.5 py-2.5 border border-gray-150 bg-white rounded-xl text-xs font-bold text-gray-900 outline-none focus:ring-1 focus:ring-blue-600"
                            value={telefone}
                            onChange={(e) => setTelefone(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 block">
                            <Mail size={10} /> E-mail de Login
                          </label>
                          <input
                            type="email"
                            placeholder="nome@dominio.com"
                            className="w-full px-3.5 py-2.5 border border-gray-150 bg-gray-50 text-gray-500 rounded-xl text-xs outline-none cursor-not-allowed font-semibold"
                            value={emailLogin}
                            disabled
                          />
                        </div>
                      </div>

                      {/* PORTAL ACCESS PIN */}
                      <div className="p-3.5 bg-gray-50 border border-gray-150 rounded-2xl space-y-2">
                        <h5 className="text-[10px] font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                          <Lock size={12} /> Credenciais de Segurança do Portal BOSS
                        </h5>
                        <p className="text-[10px] text-gray-500 leading-relaxed font-semibold">Credenciais temporárias e automatizadas geradas com base na integridade regulatória:</p>
                        <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                          <div className="p-2.5 bg-white border border-gray-100 rounded-xl space-y-0.5 shadow-3xs">
                            <span className="text-[8px] font-mono font-black text-gray-400 uppercase">Login</span>
                            <p className="text-[10.5px] font-mono break-all font-bold text-gray-900">{emailLogin || 'Aguardando'}</p>
                          </div>
                          <div className="p-2.5 bg-white border border-gray-100 rounded-xl space-y-0.5 shadow-3xs">
                            <span className="text-[8px] font-mono font-black text-gray-400 uppercase">Senha Temporária</span>
                            <input
                              type="text"
                              value={senhaAcesso}
                              onChange={(e) => setSenhaAcesso(e.target.value.replace(/\D/g, '').substring(0,6))}
                              className="w-full text-[11px] font-mono font-bold text-blue-600 bg-transparent outline-none h-4"
                            />
                          </div>
                        </div>
                      </div>

                      {/* ACTION BUTTON */}
                      <button
                        type="submit"
                        disabled={isConverting}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer hover:shadow transition-all flex items-center justify-center gap-2"
                      >
                        {isConverting ? (
                          <>
                            <RefreshCw className="animate-spin" size={14} /> Gravando e Parametrizando...
                          </>
                        ) : (
                          <>
                            Criar Cadastro e Portal BOSS <UserCheck size={14} />
                          </>
                        )}
                      </button>

                    </form>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* RECENTLY CONVERTED CELEBRATION BANNERS */}
        {conversionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-emerald-50 border-2 border-emerald-300 rounded-[2rem] text-left text-emerald-900 flex flex-col md:flex-row gap-4 items-start shadow-md animate-fade-in"
          >
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl shrink-0">
              <BadgeCheck size={28} />
            </div>
            <div className="space-y-2">
              <h4 className="font-extrabold text-base text-emerald-950 flex items-center gap-2">Ficha de Legado Convertida com Integridade!</h4>
              <p className="text-xs text-emerald-800 leading-relaxed font-sans font-semibold">{conversionSuccess}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/cadastro?path=novo-caso${convertedClientId ? `&clientId=${convertedClientId}` : ''}`)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-xl transition-all cursor-pointer animate-in zoom-in-95 duration-150 uppercase"
                >
                  Ir para Criar Caso (Já Sou Cliente)
                </button>
                <button
                  onClick={() => setConversionSuccess(null)}
                  className="px-3.5 py-1.5 bg-white hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-bold rounded-xl transition-all cursor-pointer"
                >
                  Confirmar e Dispensar
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* TECHNICAL LOG BOARD */}
        <div className="bg-slate-900 text-white rounded-[2rem] p-6 shadow-lg border border-slate-800 text-left space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Terminal size={18} className="text-indigo-400" />
              <h3 className="text-xs font-black uppercase tracking-wider font-mono text-indigo-300">
                Log Técnico do Recadastramento Legado
              </h3>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('tech_logs_recadastramento');
                setTechLogs([]);
                addLog('Limpeza de Logs', 'Painel de logs técnicos limpo pelo usuário.', 'info');
              }}
              className="text-[10px] font-mono text-slate-400 hover:text-white transition cursor-pointer"
            >
              [ Limpar Terminal ]
            </button>
          </div>

          <div className="space-y-2 font-mono text-xs max-h-[300px] overflow-y-auto pr-1">
            {techLogs.length === 0 ? (
              <p className="text-slate-500 italic py-4">Nenhum evento registrado no terminal operacional.</p>
            ) : (
              techLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-950 rounded-xl border border-slate-850 flex flex-col md:flex-row md:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide leading-none ${
                        log.status === 'sucesso' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        log.status === 'erro' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        log.status === 'alerta' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {log.action}
                      </span>
                    </div>
                    <p className="text-slate-300 font-sans text-xs leading-relaxed font-semibold">
                      {log.details}
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono shrink-0 text-right">
                    Responsável: <span className="text-indigo-300">{log.user}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </BossLayout>
  );
}
