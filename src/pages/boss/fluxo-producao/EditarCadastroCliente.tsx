import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';

// Core dynamic sub-forms
import { PFForm } from '../../../modules/boss/components/forms/PFForm';
import { PJForm } from '../../../modules/boss/components/forms/PJForm';
import { SocioForm } from '../../../modules/boss/components/forms/SocioForm';
import { AccessForm } from '../../../modules/boss/components/forms/AccessForm';
import { BankingForm } from '../../../modules/boss/components/forms/BankingForm';
import GoogleDriveJobsLogsPanel from '../../../components/GoogleDriveJobsLogsPanel';

import { 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck,
  User,
  Building2,
  FolderOpen,
  ExternalLink,
  Activity,
  Copy,
  Clock,
  AlertCircle
} from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';
import { normalizeCpfCnpj, isValidCpf, isValidCnpj } from './utils/documentUtils';
import { generateSafeClientSlug } from './utils/slugUtils';
import { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard';

const GoogleDriveIcon = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <svg
    viewBox="0 0 87.3 78"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path fill="#00a354" d="M18.9 50l-14 24.2 0 3.8h4.2l53.9-1.2-11.4-26.8z" />
    <path fill="#3b7cf6" d="M14 0l-14 24.2L11.1 50h41.7l14.4-25.8z" />
    <path fill="#fbb000" d="M72.6 50L53.7 78H83l4.3-11.2L72.6 50z" />
  </svg>
);

export default function EditarCadastroCliente() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [connectorBuildUrl, setConnectorBuildUrl] = useState<string>('');
  const [copiedMotivo, setCopiedMotivo] = useState<boolean>(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [showMetadata, setShowMetadata] = useState<boolean>(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('pt-BR');
    } catch {
      return isoStr;
    }
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedMotivo(true);
    setTimeout(() => setCopiedMotivo(false), 2000);
  };

  const [clientId, setClientId] = useState<string | null>(null);
  const [clientType, setClientType] = useState<'PF' | 'PJ' | null>(null);
  const [prevClientData, setPrevClientData] = useState<any>(null);

  // Single Unified Form State matching CadastroFluxo
  const [formData, setFormData] = useState<any>({
    // pfData
    pf_nomeCompleto: '',
    pf_cpf: '',
    pf_rg: '',
    pf_orgaoEmissor: '',
    pf_dataEmissao: '',
    pf_nascimento: '',
    pf_nacionalidade: 'Brasileira',
    pf_estadoCivil: '',
    pf_profissao: '',
    pf_telefone: '',
    pf_whatsapp: '',
    pf_email: '',
    pf_cep: '',
    pf_endereco: '',
    pf_numero: '',
    pf_complemento: '',
    pf_bairro: '',
    pf_cidade: '',
    pf_estado: '',

    // pjData
    pj_razaoSocial: '',
    pj_nomeFantasia: '',
    pj_cnpj: '',
    pj_inscricaoEstadual: '',
    pj_inscricaoMunicipal: '',
    pj_emailEmpresa: '',
    pj_telefoneEmpresa: '',
    pj_whatsappEmpresa: '',
    pj_cepEmpresa: '',
    pj_enderecoEmpresa: '',
    pj_numeroEmpresa: '',
    pj_complementoEmpresa: '',
    pj_bairroEmpresa: '',
    pj_cidadeEmpresa: '',
    pj_estadoEmpresa: '',

    // socioData
    socio_nomeCompleto: '',
    socio_cpf: '',
    socio_rg: '',
    socio_orgaoEmissor: '',
    socio_dataEmissao: '',
    socio_nascimento: '',
    socio_nacionalidade: 'Brasileira',
    socio_estadoCivil: '',
    socio_profissao: '',
    socio_telefone: '',
    socio_whatsapp: '',
    socio_email: '',
    socio_cep: '',
    socio_endereco: '',
    socio_numero: '',
    socio_complemento: '',
    socio_bairro: '',
    socio_cidade: '',
    socio_estado: '',

    // acessoData
    acesso_emailLogin: '',
    acesso_statusAcesso: 'pendente',
    acesso_senha: '',
    acesso_confirmarSenha: '',

    // bancarioData
    bancario_possuiDadosBancarios: false,
    bancario_tipoChavePix: '',
    bancario_chavePix: '',
    bancario_bancoPix: '',
    bancario_titularPix: '',
    bancario_titularEhCliente: false,
    bancario_titularConta: '',
    bancario_banco: '',
    bancario_agencia: '',
    bancario_numeroConta: '',
    bancario_operacao: '',

    // Google Drive optional fields
    googleDriveClientFolderStatus: 'aguardando',
    googleDriveClientFolderUrl: '',
    googleDriveClientFolderId: '',
    googleDriveClientFolderLogFalha: '',
    googleDriveClientFolderUpdatedAt: '',
  });

  const [initialFormData, setInitialFormData] = useState<any>(null);

  const hasUnsavedChanges = initialFormData 
    ? Object.keys(formData).some(key => {
        const val1 = formData[key];
        const val2 = initialFormData[key];
        if (typeof val1 === 'boolean' || typeof val2 === 'boolean') {
          return !!val1 !== !!val2;
        }
        return String(val1 ?? '').trim() !== String(val2 ?? '').trim();
      })
    : false;

  const handleGuardSave = async (): Promise<boolean> => {
    try {
      await handleUpdateClient(false);
      return true;
    } catch (err) {
      console.error("Guard save failed in edit screen:", err);
      return false;
    }
  };

  const { UnsavedChangesModal, SaveStatusIndicator } = useUnsavedChangesGuard({
    hasUnsavedChanges,
    onSave: handleGuardSave,
    isSaving: saving,
    saveError: error
  });

  useEffect(() => {
    if (!caseId) {
      setError('Identificador de caso não fornecido.');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch case to resolve clientId
        const caseRef = doc(db, 'cases', caseId);
        const caseSnap = await getDoc(caseRef);
        if (!caseSnap.exists()) {
          setError(`Caso #${caseId} não encontrado no sistema.`);
          setLoading(false);
          return;
        }

        const caseData = caseSnap.data();
        const cid = caseData.clientId;
        if (!cid) {
          setError(`Este caso não possui nenhum ID de cliente vinculado.`);
          setLoading(false);
          return;
        }

        setClientId(cid);

        // Try fetching Google Drive build URL from settings/connectors on initialization
        try {
          const connDoc = await getDoc(doc(db, 'settings', 'connectors'));
          if (connDoc.exists()) {
            const data = connDoc.data();
            if (data.googleDrive && data.googleDrive.buildUrl) {
              setConnectorBuildUrl(data.googleDrive.buildUrl.trim());
            }
          }
        } catch (settingsErr) {
          console.error("Erro ao carregar settings/connectors no EditarCadastroCliente:", settingsErr);
        }

        // 2. Fetch client data from clients/{clientId}
        const clientRef = doc(db, 'clients', cid);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) {
          setError(`Documento do cliente associado (${cid}) não foi localizado em clients/`);
          setLoading(false);
          return;
        }

        const clientData = clientSnap.data();
        setPrevClientData(clientData);

        const type = clientData.type;
        if (type !== 'PF' && type !== 'PJ') {
          // Inconsistent/absent type - will show custom alert
          setClientType(null);
          setLoading(false);
          return;
        }

        setClientType(type as 'PF' | 'PJ');

        // 3. Map values to our unified formData fields
        const pfFields = clientData.pfData || clientData.pfDadosPessoais || {};
        const pjFields = clientData.pjData || clientData.pjDadosEmpresa || {};
        const socioFields = clientData.socioData || clientData.socioDadosPessoais || {};
        const accessFields = clientData.acessoSistema || {};
        const bankingFields = clientData.bancarioData || clientData.bancarioDadosBancarios || {};

        const loadedState = {
          ...pfFields,
          ...pjFields,
          ...socioFields,
          acesso_emailLogin: accessFields.acesso_emailLogin || clientData.email || '',
          acesso_statusAcesso: accessFields.acesso_statusAcesso || 'pendente',
          acesso_senha: accessFields.acesso_senha || clientData.senhaVisivelPreview || '',
          acesso_confirmarSenha: accessFields.acesso_senha || clientData.senhaVisivelPreview || '',
          ...bankingFields,
          googleDriveClientFolderStatus: clientData.googleDriveClientFolderStatus || 'aguardando',
          googleDriveClientFolderUrl: clientData.googleDriveClientFolderUrl || '',
          googleDriveClientFolderId: clientData.googleDriveClientFolderId || '',
          googleDriveClientFolderLogFalha: clientData.googleDriveClientFolderLogFalha || '',
          googleDriveClientFolderUpdatedAt: clientData.googleDriveClientFolderUpdatedAt || ''
        };
        setFormData(loadedState);
        setInitialFormData(loadedState);

      } catch (err: any) {
        console.error('Error loading client and case:', err);
        setError(`Erro ao carregar dados do caso ou cliente: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [caseId]);

  const getMissingFields = () => {
    const missing: string[] = [];
    if (clientType === 'PF') {
      if (!formData.pf_nomeCompleto?.trim()) missing.push('Nome Completo');
      if (!formData.pf_cpf?.trim()) missing.push('CPF');
      if (!formData.pf_email?.trim()) missing.push('E-mail');
      if (!formData.pf_telefone?.trim()) missing.push('Telefone');
      if (!formData.pf_cep?.trim()) missing.push('CEP');
      if (!formData.pf_endereco?.trim()) missing.push('Endereço');
    } else if (clientType === 'PJ') {
      if (!formData.pj_razaoSocial?.trim()) missing.push('Razão Social');
      if (!formData.pj_cnpj?.trim()) missing.push('CNPJ');
      if (!formData.pj_emailEmpresa?.trim()) missing.push('E-mail Empresa');
      if (!formData.pj_telefoneEmpresa?.trim()) missing.push('Telefone Empresa');
      if (!formData.pj_cepEmpresa?.trim()) missing.push('CEP Empresa');
      if (!formData.pj_enderecoEmpresa?.trim()) missing.push('Endereço Empresa');
      
      if (!formData.socio_nomeCompleto?.trim()) missing.push('Nome do Sócio');
      if (!formData.socio_cpf?.trim()) missing.push('CPF do Sócio');
    }

    if (!formData.acesso_emailLogin?.trim()) missing.push('E-mail Login');
    if (!formData.acesso_senha?.trim()) missing.push('Senha de Acesso');
    if (!formData.acesso_confirmarSenha?.trim()) missing.push('Confirmar Senha');

    return missing;
  };

  const checkPortalSetupReady = () => {
    if (!clientType) return false;
    const isPf = clientType === 'PF';
    const docValue = isPf ? normalizeCpfCnpj(formData.pf_cpf) : normalizeCpfCnpj(formData.pj_cnpj);
    
    let isDocValid = false;
    if (isPf && docValue.length === 11 && isValidCpf(docValue)) isDocValid = true;
    if (!isPf && docValue.length === 14 && isValidCnpj(docValue)) isDocValid = true;

    const hasEmail = formData.acesso_emailLogin && formData.acesso_emailLogin.trim() !== '';
    const hasSenha = formData.acesso_senha && formData.acesso_senha.trim().length >= 6;
    const isMatch = formData.acesso_senha === formData.acesso_confirmarSenha;

    return isDocValid && hasEmail && hasSenha && isMatch;
  };

  const getCategorizedBlocks = () => {
    const pfBlock: any = {};
    const pjBlock: any = {};
    const socioBlock: any = {};
    const acessoBlock: any = {};
    const bancarioBlock: any = {};

    Object.keys(formData).forEach(key => {
      if (key.startsWith('pf_')) pfBlock[key] = formData[key];
      else if (key.startsWith('pj_')) pjBlock[key] = formData[key];
      else if (key.startsWith('socio_')) socioBlock[key] = formData[key];
      else if (key.startsWith('acesso_')) acessoBlock[key] = formData[key];
      else if (key.startsWith('bancario_')) {
        bancarioBlock[key] = formData[key];
      }
    });

    return { pfBlock, pjBlock, socioBlock, acessoBlock, bancarioBlock };
  };

  const handleUpdateClient = async (advanceAfter = false) => {
    if (!clientId || !clientType) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const isPf = clientType === 'PF';
      const mainName = isPf ? formData.pf_nomeCompleto?.trim() : formData.pj_razaoSocial?.trim();
      const docValue = isPf ? normalizeCpfCnpj(formData.pf_cpf) : normalizeCpfCnpj(formData.pj_cnpj);

      if (!mainName) {
        setError(isPf ? 'Preencha o Nome Completo.' : 'Preencha a Razão Social.');
        setSaving(false);
        return;
      }

      const missing = getMissingFields();
      const isPortalReady = checkPortalSetupReady();
      const rightNow = new Date().toISOString();
      let slug = prevClientData?.slug || generateSafeClientSlug(mainName, clientType, docValue);

      const { pfBlock, pjBlock, socioBlock, acessoBlock, bancarioBlock } = getCategorizedBlocks();

      // 1. Build clients document update payload
      const payload: any = {
        ...prevClientData,
        clientId: clientId,
        type: clientType,
        slug: slug,
        updatedAt: rightNow,
        pfData: pfBlock,
        pfDadosPessoais: pfBlock,
        pjData: pjBlock,
        pjDadosEmpresa: pjBlock,
        socioData: socioBlock,
        socioDadosPessoais: socioBlock,
        bancarioData: bancarioBlock,
        bancarioDadosBancarios: bancarioBlock,
        acessoSistema: {
          acesso_emailLogin: formData.acesso_emailLogin || '',
          acesso_statusAcesso: formData.acesso_statusAcesso || 'pendente',
          acesso_senha: formData.acesso_senha || ''
        },
        googleDriveClientFolderStatus: formData.googleDriveClientFolderStatus || 'aguardando',
        googleDriveClientFolderUrl: formData.googleDriveClientFolderUrl || '',
        googleDriveClientFolderId: formData.googleDriveClientFolderId || '',
        googleDriveClientFolderLogFalha: formData.googleDriveClientFolderLogFalha || '',
        googleDriveClientFolderUpdatedAt: formData.googleDriveClientFolderUpdatedAt || '',
        missingFields: missing,
        cadastroIncompleto: missing.length > 0
      };

      if (isPortalReady) {
        payload.portalStatus = 'criado';
        payload.senhaVisivelPreview = formData.acesso_senha;
        payload.avisoSegurancaSenha = true;
        payload.active = true;
        
        // Add portal mirror fields
        payload.portalMirror = {
          name: mainName,
          type: clientType,
          pfDadosPessoais: {
            nomeCompleto: pfBlock.pf_nomeCompleto || '',
            cpf: pfBlock.pf_cpf || '',
            rg: pfBlock.pf_rg || '',
            dataNascimento: pfBlock.pf_dataNascimento || pfBlock.pf_nascimento || '',
            nacionalidade: pfBlock.pf_nacionalidade || '',
            profissao: pfBlock.pf_profissao || '',
            estadoCivil: pfBlock.pf_estadoCivil || '',
            nomePai: pfBlock.pf_nomePai || '',
            nomeMae: pfBlock.pf_nomeMae || ''
          },
          pfContato: {
            email: pfBlock.pf_email || '',
            telefone: pfBlock.pf_telefone || '',
            whatsapp: pfBlock.pf_whatsapp || ''
          },
          pfEndereco: {
            cep: pfBlock.pf_cep || '',
            logradouro: pfBlock.pf_endereco || '',
            numero: pfBlock.pf_numero || '',
            bairro: pfBlock.pf_bairro || '',
            cidade: pfBlock.pf_cidade || '',
            uf: pfBlock.pf_estado || ''
          },
          dadosBancariosOpcional: {
            bancario_possuiDadosBancarios: !!bancarioBlock.bancario_possuiDadosBancarios,
            tipoPix: bancarioBlock.bancario_tipoChavePix || '',
            chavePix: bancarioBlock.bancario_chavePix || '',
            banco: bancarioBlock.bancario_banco || '',
            agencia: bancarioBlock.bancario_agencia || '',
            conta: bancarioBlock.bancario_conta || '',
            tipoConta: bancarioBlock.bancario_tipoConta || '',
            titular: bancarioBlock.bancario_titularConta || ''
          }
        };
      }

      // Save clients collection
      await setDoc(doc(db, 'clients', clientId), payload);

      // Save mirrored clientes collection
      const emailVal = isPf ? (pfBlock.pf_email || formData.acesso_emailLogin) : (pjBlock.pj_emailEmpresa || formData.acesso_emailLogin);
      const phoneVal = isPf ? (pfBlock.pf_telefone || pfBlock.pf_whatsapp || '') : (pjBlock.pj_telefoneEmpresa || pjBlock.pj_whatsappEmpresa || '');
      const pathVal = isPf ? (pfBlock.pf_endereco || '') : (pjBlock.pj_enderecoEmpresa || '');

      await setDoc(doc(db, 'clientes', clientId), {
        id: clientId,
        clientId: clientId,
        slug: slug,
        nome: mainName,
        name: mainName,
        tipoPessoa: clientType,
        type: clientType,
        cpf: isPf ? (pfBlock.pf_cpf || '') : '',
        cnpj: !isPf ? (pjBlock.pj_cnpj || '') : '',
        cpfCnpj: isPf ? (pfBlock.pf_cpf || '') : (pjBlock.pj_cnpj || ''),
        email: emailVal || '',
        telefone: phoneVal || '',
        phone: phoneVal || '',
        endereco: pathVal || '',
        address: pathVal || '',
        status: 'active',
        portalAtivo: isPortalReady,
        atualizadoEm: rightNow,
        updatedAt: rightNow,
        googleDriveClientFolderStatus: formData.googleDriveClientFolderStatus || 'aguardando',
        googleDriveClientFolderUrl: formData.googleDriveClientFolderUrl || '',
        googleDriveClientFolderId: formData.googleDriveClientFolderId || ''
      });

      if (isPortalReady) {
        // Save Client Portal Map
        await setDoc(doc(db, 'clientPortals', slug), {
          clientId: clientId,
          slug: slug,
          active: true,
          updatedAt: rightNow
        });

        // Save Credentials
        await setDoc(doc(db, 'credenciaisCliente', clientId), {
          id: clientId,
          clienteId: clientId,
          slug: slug,
          login: formData.acesso_emailLogin.toLowerCase().trim(),
          senha: formData.acesso_senha,
          password: formData.acesso_senha,
          ativo: true,
          atualizadoEm: rightNow,
          ultimoAcesso: null,
          tentativasFalhas: 0,
          bloqueadoEm: null,
          observacoes: 'Credencial editada pelo Portal bOSS no fluxo produtivo'
        });

        // Save user collection doc
        await setDoc(doc(db, 'users', clientId), {
          email: formData.acesso_emailLogin,
          role: "client",
          clientId: clientId,
          clientSlug: slug,
          name: mainName,
          status: formData.acesso_statusAcesso,
          senhaVisivelPreview: formData.acesso_senha,
          updatedAt: rightNow
        });
      }

      setSuccess('Cadastro do cliente atualizado com sucesso no Firestore!');
      setInitialFormData({ ...formData });

      setTimeout(() => {
        if (advanceAfter) {
          navigate(flowRoutes.dadosCaso(caseId!));
        }
      }, 800);

    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar atualização cadastral: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDriveFolder = async () => {
    if (!clientId) {
      setError('Não foi possível identificar o ID do cliente.');
      return;
    }

    if (formData.googleDriveClientFolderId) {
      setError('A pasta do cliente no Google Drive já existe e está sincronizada.');
      return;
    }

    setIsCreatingFolder(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Definição do nome do cliente baseado no tipo
      const clientFolderName = clientType === 'PF'
        ? (formData.pf_nomeCompleto || '')
        : (formData.pj_nomeFantasia || formData.pj_razaoSocial || '');

      // 2. Criação do documento de Job no Firestore para o barramento
      const jobCollRef = collection(db, 'googleDriveJobs');
      const jobDocRef = doc(jobCollRef); // Auto-generate ID
      const jobId = jobDocRef.id;

      setCurrentJobId(jobId);

      const jobPayload = {
        id: jobId,
        createdAt: new Date().toISOString(),
        status: 'pending',
        clientType: clientType || 'PF',
        portalClientId: clientId,
        caseId: caseId || '',
        clientFolderName: clientFolderName,
        originBlock: "fluxo-producao",
        originField: "clientFolder"
      };

      // Set initial status is 'aguardando' in Firestore for client
      const pendingState = {
        googleDriveClientFolderStatus: 'aguardando',
        googleDriveClientFolderUrl: '',
        googleDriveClientFolderId: '',
        googleDriveClientFolderLogFalha: '',
        googleDriveClientFolderUpdatedAt: new Date().toISOString()
      };

      setFormData((prev: any) => ({
        ...prev,
        ...pendingState
      }));

      const clientRef = doc(db, 'clients', clientId);
      const clienteLegacyRef = doc(db, 'clientes', clientId);
      
      try {
        await setDoc(clientRef, pendingState, { merge: true });
        await setDoc(clienteLegacyRef, pendingState, { merge: true });
        console.log("[Firestore] Permissão Firestore validada para alteração do status do cliente.");
      } catch (clientErr: any) {
        if (clientErr.message?.includes('permission') || clientErr.code === 'permission-denied') {
          console.error("[Firestore] Falha de permissão Firestore ao atualizar status do cliente.");
        }
        handleFirestoreError(clientErr, OperationType.WRITE, `clients/${clientId}`);
      }

      // Envia o documento para a coleção googleDriveJobs do Firestore como barramento
      try {
        await setDoc(jobDocRef, jobPayload);
        console.log("[Firestore] Permissão Firestore validada. Job criado no Firestore: " + jobId, jobPayload);
      } catch (jobErr: any) {
        if (jobErr.message?.includes('permission') || jobErr.code === 'permission-denied') {
          console.error("[Firestore] Falha de permissão Firestore ao criar job.");
        }
        handleFirestoreError(jobErr, OperationType.WRITE, `googleDriveJobs/${jobId}`);
      }

      // Cancelar qualquer escuta ativa anterior por segurança
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      // 3. Monitoramento em tempo real do processamento do Job
      const unsubscribe = onSnapshot(jobDocRef, async (snapshot) => {
        if (!snapshot.exists()) return;

        const jobData = snapshot.data();

        // Log que o job foi recebido pelo Worker quando sair do status 'pending'
        if (jobData.status !== 'pending') {
          console.log(`[Google Drive Bus] Job recebido pelo Worker Google Drive. Status atual: ${jobData.status}`);
        }

        if (jobData.status === 'success') {
          console.log("[Google Drive Bus] Job atualizado com sucesso.");
          // Processado com Sucesso!
          const extractedUrl = jobData.googleDriveClientFolderUrl || jobData.folderUrl || jobData.url || '';
          const extractedId = jobData.googleDriveClientFolderId || jobData.folderId || jobData.id || '';

          const successState = {
            googleDriveClientFolderStatus: 'criada' as const,
            googleDriveClientFolderUrl: extractedUrl,
            googleDriveClientFolderId: extractedId,
            googleDriveClientFolderLogFalha: '',
            googleDriveClientFolderUpdatedAt: jobData.updatedAt || new Date().toISOString(),
            googleDriveStatus: 'success'
          };

          setFormData((prev: any) => ({
            ...prev,
            ...successState
          }));

          await setDoc(clientRef, successState, { merge: true });
          await setDoc(clienteLegacyRef, successState, { merge: true });

          setSuccess('Pasta do cliente criada e sincronizada com sucesso no Google Drive!');
          setIsCreatingFolder(false);
          setCurrentJobId(null);
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
        } else if (jobData.status === 'failed') {
          console.log("[Google Drive Bus] Job atualizado com sucesso (com status de falha).");
          // Falhou!
          const errorMsg = jobData.error || jobData.message || jobData.logFalha || jobData.errorMessage || 'Automação retornou falha na criação da pasta.';
          const failState = {
            googleDriveClientFolderStatus: 'falha' as const,
            googleDriveClientFolderLogFalha: errorMsg,
            googleDriveClientFolderUpdatedAt: jobData.updatedAt || new Date().toISOString(),
            googleDriveStatus: 'failed'
          };

          setFormData((prev: any) => ({
            ...prev,
            ...failState
          }));

          await setDoc(clientRef, failState, { merge: true });
          await setDoc(clienteLegacyRef, failState, { merge: true });

          setError(`Falha ao criar pasta: ${errorMsg}`);
          setIsCreatingFolder(false);
          setCurrentJobId(null);
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
        }
      }, (onSnapError) => {
        console.error("Erro no onSnapshot do job:", onSnapError);
        if (onSnapError.message?.includes('permission') || onSnapError.code === 'permission-denied') {
          console.error("[Firestore] Falha de permissão Firestore ao ouvir atualizações do Job.");
        }
        handleFirestoreError(onSnapError, OperationType.GET, `googleDriveJobs/${jobId}`);
      });

      unsubscribeRef.current = unsubscribe;

    } catch (err: any) {
      if (err.message?.includes('permission') || err.code === 'permission-denied') {
        console.error("[Firestore] Falha de permissão Firestore.");
      }
      console.error("Error creating Google Drive job:", err);
      const failState = {
        googleDriveClientFolderStatus: 'falha' as const,
        googleDriveClientFolderLogFalha: err.message || String(err),
        googleDriveClientFolderUpdatedAt: new Date().toISOString()
      };
      setFormData((prev: any) => ({
        ...prev,
        ...failState
      }));
      try {
        const clientRef = doc(db, 'clients', clientId);
        const clienteLegacyRef = doc(db, 'clientes', clientId);
        await setDoc(clientRef, failState, { merge: true });
        await setDoc(clienteLegacyRef, failState, { merge: true });
      } catch (innerErr) {
        console.error("Could not write failState to database:", innerErr);
      }
      setError(`Falha ao criar pasta: ${err.message || err}`);
      setIsCreatingFolder(false);
      setCurrentJobId(null);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Carregando..." statusText="Carregando Cadastro">
        <div className="min-h-[300px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 border-4 border-gray-100 border-t-gray-950 rounded-full animate-spin text-gray-900" />
            <span className="text-xs uppercase font-bold tracking-widest text-gray-400">Obtendo dados cadastrais...</span>
          </div>
        </div>
      </FluxoStepLayout>
    );
  }

  return (
    <FluxoStepLayout 
      stepName={clientType === 'PF' ? 'Cadastro PF' : clientType === 'PJ' ? 'Cadastro PJ' : 'Erro de Registro'} 
      statusText="Edição do Cadastro Vinculado ao Caso"
      caseId={caseId}
    >
      <div className="space-y-8 relative">
        {/* HEADER WITH SAVE STATUS INDICATOR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(flowRoutes.dadosCaso(caseId!))}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors shrink-0 text-gray-500"
              title="Voltar aos Dados do Caso"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <span className="text-xs font-black uppercase text-gray-400 tracking-wider block font-mono">Formulário de Cadastro</span>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Editar Ficha de Identificação Cadastral</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <SaveStatusIndicator />
            {(prevClientData?.slug || clientId) && (
              <button
                type="button"
                onClick={() => {
                  const slugStr = prevClientData?.slug;
                  if (!slugStr) {
                    alert("Não foi possível abrir o Editor do Portal porque o cliente não possui slug cadastrado.");
                    return;
                  }
                  navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slugStr}/Editar-Painel-Geral-do-Cliente`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 border bg-orange-100/80 hover:bg-orange-200/80 text-orange-800 border-orange-200 hover:border-orange-355 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-300 shadow-3xs cursor-pointer"
                title="Editar dados ou portal do cliente"
              >
                <ExternalLink size={12} />
                <span>Editar Portal do Cliente</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-55 border border-red-200 text-red-900 rounded-2xl flex items-start gap-3 text-xs font-semibold leading-relaxed animate-in fade-in duration-200">
            <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={16} />
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-250 text-emerald-900 rounded-2xl flex items-start gap-3 text-xs font-semibold leading-relaxed animate-in fade-in duration-200">
            <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
            <div>{success}</div>
          </div>
        )}

        {!clientType && !error && (
          <div className="p-6 bg-amber-50 border border-amber-250 rounded-2xl space-y-4">
            <div className="flex gap-3 items-start">
              <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black uppercase text-amber-900 tracking-wider font-sans">
                  Tipo cadastral ausente ou inconsistente
                </h4>
                <p className="text-xs font-semibold mt-1 text-amber-850 leading-relaxed">
                  O cliente vinculado a este caso não possui um tipo de pessoa (PF/PJ) definido e válido no banco de dados. 
                  Por favor, corrija o cadastro deste cliente utilizando a edição correspondente no painel de clientes antes de prosseguir com o fluxo.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(flowRoutes.dadosCaso(caseId!))}
              className="inline-flex items-center gap-1.5 bg-white border border-amber-250 text-amber-900 hover:bg-amber-100/50 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Voltar para Entrevista (5W2H)</span>
            </button>
          </div>
        )}

        {clientType && (
          <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-5">
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900">
                {clientType === 'PF' ? <User size={20} /> : <Building2 size={20} />}
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-gray-900 tracking-tight">
                  {clientType === 'PF' ? 'Formulário de Cadastro PF' : 'Formulário de Cadastro PJ'}
                </h4>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-normal">
                  {clientType === 'PF' 
                    ? 'Edição das informações civis do contratante mestre do caso.' 
                    : 'Edição das informações societárias e empresariais do contratante.'}
                </p>
              </div>
            </div>

            <div className="boss-form-breathable space-y-8 animate-in fade-in duration-300">
              <style>{`
                .boss-form-breathable input, 
                .boss-form-breathable select {
                  height: 3.25rem !important;
                  padding-left: 1.25rem !important;
                  padding-right: 1.25rem !important;
                  background-color: rgb(249 250 251 / 0.5) !important;
                  border: 1px solid rgb(229 231 235) !important;
                  font-size: 0.875rem !important;
                  border-radius: 0.875rem !important;
                }
                .boss-form-breathable input:focus, 
                .boss-form-breathable select:focus {
                  border-color: rgb(17 24 39) !important;
                  background-color: #ffffff !important;
                }
                .boss-form-breathable .bg-white.p-6.rounded-2xl.border {
                  background-color: transparent !important;
                  border: none !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                  border-radius: 0 !important;
                  margin-bottom: 2.25rem !important;
                }
                .boss-form-breathable h3,
                .boss-form-breathable h4 {
                  color: rgb(17 24 39) !important;
                  font-size: 0.8125rem !important;
                  font-weight: 800 !important;
                  letter-spacing: 0.05em !important;
                  border-bottom: 1.5px solid rgb(243 244 246);
                  padding-bottom: 0.625rem;
                  margin-bottom: 1.5rem !important;
                  text-transform: uppercase;
                }
                .boss-form-breathable .border-t {
                  border-top: none !important;
                  padding-top: 0.5rem !important;
                }
              `}</style>
              
              {/* INTEGRITY ALERTS (VALIDAÇÃO DE INTEGRIDADE) */}
              {clientType === 'PF' && !!(
                (prevClientData?.pjData && Object.keys(prevClientData.pjData).some(k => !!prevClientData.pjData[k])) ||
                (prevClientData?.pjDadosEmpresa && Object.keys(prevClientData.pjDadosEmpresa).some(k => !!prevClientData.pjDadosEmpresa[k]))
              ) && (
                <div className="p-4 bg-amber-50 border border-amber-250 rounded-2xl flex items-start gap-3 text-xs font-semibold text-amber-900 leading-relaxed">
                  <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                  <div>Inconsistência detectada: cliente PF possui dados PJ residuais.</div>
                </div>
              )}

              {clientType === 'PJ' && !!(
                (prevClientData?.pfData && Object.keys(prevClientData.pfData).some(k => !!prevClientData.pfData[k])) ||
                (prevClientData?.pfDadosPessoais && Object.keys(prevClientData.pfDadosPessoais).some(k => !!prevClientData.pfDadosPessoais[k]))
              ) && (
                <div className="p-4 bg-amber-50 border border-amber-250 rounded-2xl flex items-start gap-3 text-xs font-semibold text-amber-900 leading-relaxed">
                  <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                  <div>Inconsistência detectada: cliente PJ possui dados PF residuais.</div>
                </div>
              )}

              {clientType === 'PF' ? (
                <PFForm data={formData} onChange={(d) => setFormData(d)} isVerticalFlow={true} />
              ) : (
                <div className="space-y-8">
                  <PJForm data={formData} onChange={(d) => setFormData(d)} />
                  
                  <div className="border-t border-gray-100 pt-6">
                    <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-4 font-mono">
                      Quadro de Sócios / Representante do CNPJ
                    </h3>
                    <SocioForm data={formData} onChange={(d) => setFormData(d)} />
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-6">
                <AccessForm data={formData} onChange={(d) => setFormData(d)} />
              </div>

              <div className="border-t border-gray-100 pt-6">
                <BankingForm 
                  data={formData} 
                  onChange={(d) => setFormData(d)} 
                  clientName={clientType === 'PF' ? (formData.pf_nomeCompleto || '') : (formData.pj_razaoSocial || '')}
                />
              </div>

              {/* GOOGLE DRIVE AUTOMATION PANEL */}
              <div className="border-t border-gray-100 pt-6">
                <div className="border border-gray-150 rounded-3xl p-6 bg-gray-50/40 space-y-4 shadow-xs">
                  <div className="flex items-center gap-2.5 border-b border-gray-150 pb-3">
                    <FolderOpen className="text-indigo-600" size={18} />
                    <div>
                      <h3 className="text-xs font-black uppercase text-gray-955 tracking-wider font-mono m-0 border-b-0 p-0 mb-0" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                        Automação Google Drive — Pasta do Cliente
                      </h3>
                      <p className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">
                        Gerenciamento da estrutura operacional de arquivos no Google Drive corporativo.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-1">
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block font-mono">
                        Status da Automação
                      </span>

                      <div className="space-y-3">
                        {formData.googleDriveClientFolderStatus === 'criada' && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-xs flex items-center gap-2 font-semibold">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Pasta criada com sucesso ✅</span>
                          </div>
                        )}

                        {formData.googleDriveClientFolderStatus === 'falha' && (
                          <div className="p-4 bg-rose-50 border border-rose-250 rounded-2xl text-rose-950 text-xs flex flex-col gap-3 font-semibold shadow-xs animate-in fade-in duration-200">
                            <div className="flex items-center gap-2 text-rose-700 font-bold">
                              <AlertCircle size={15} />
                              <span className="text-[13px] font-black uppercase tracking-tight">Falha na criação da Pasta, consulte “ver fluxo de logs” para mais informações ❌</span>
                            </div>
                            
                            {formData.googleDriveClientFolderLogFalha && (
                              <div className="bg-white/85 border border-rose-150 p-3 rounded-xl space-y-2">
                                <div className="text-[10px] font-black uppercase text-rose-900 tracking-wider font-mono">
                                  Motivo:
                                </div>
                                <div className="font-mono text-[11px] text-rose-955 leading-relaxed break-all select-all whitespace-pre-wrap max-h-36 overflow-y-auto">
                                  {formData.googleDriveClientFolderLogFalha}
                                </div>
                              </div>
                            )}

                            {formData.googleDriveClientFolderUpdatedAt && (
                              <div className="flex items-center gap-1.5 text-[10px] text-rose-700 font-bold font-mono">
                                <Clock size={11} />
                                <span>Data: {formatDate(formData.googleDriveClientFolderUpdatedAt)}</span>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-100">
                              <button
                                type="button"
                                onClick={() => copyToClipboard(formData.googleDriveClientFolderLogFalha || "o sistema não recebeu detalhes do erro.")}
                                className="px-3 py-2 bg-white hover:bg-rose-100 border border-rose-200 text-rose-900 font-black uppercase tracking-wider rounded-lg text-[9px] transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
                              >
                                <Copy size={11} />
                                <span>{copiedMotivo ? 'Copiado!' : 'Copiar motivo da falha'}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {formData.googleDriveClientFolderStatus === 'aguardando' && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-955 text-xs flex items-center gap-2 font-semibold">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>Aguardando processamento do Google Drive.</span>
                          </div>
                        )}

                        {isCreatingFolder && currentJobId && (
                          <div className="p-4 bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl space-y-2.5 font-mono text-[11px] leading-relaxed shadow-xs animate-in slide-in-from-top-1 duration-200 select-text">
                            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-2 text-slate-400">
                              <Loader2 size={12} className="animate-spin text-indigo-400" />
                              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Logs do Barramento Firestore</span>
                            </div>
                            <div className="space-y-1.5">
                              <p className="flex items-start gap-2">
                                <span className="text-emerald-500 font-bold">✔</span>
                                <span className="text-slate-300">Solicitação enviada ao barramento Firestore.</span>
                              </p>
                              <p className="flex items-start gap-2">
                                <span className="text-emerald-500 font-bold">✔</span>
                                <span className="text-slate-300 border-0 m-0 p-0">
                                  Job ID criado: <code className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded font-bold select-all text-[11px]">{currentJobId}</code>
                                </span>
                              </p>
                              <div className="flex items-start gap-2 font-semibold text-amber-400 animate-pulse">
                                <span>⌛</span>
                                <span>Aguardando processamento pelo Google Drive Build.</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2.5 pt-2">
                      <button
                        type="button"
                        disabled={isCreatingFolder || formData.googleDriveClientFolderStatus === 'criada'}
                        onClick={handleCreateDriveFolder}
                        className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 font-extrabold px-4 py-2.5 rounded-xl transition-all text-xs cursor-pointer shadow-xs ${
                          isCreatingFolder || formData.googleDriveClientFolderStatus === 'criada'
                            ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-750 text-white'
                        }`}
                      >
                        {isCreatingFolder ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Sincronizando com Google Drive...</span>
                          </>
                        ) : formData.googleDriveClientFolderStatus === 'criada' ? (
                          <span>Pasta do Cliente</span>
                        ) : (
                          <span>Automação Google Drive — Pasta do Cliente</span>
                        )}
                      </button>

                      {formData.googleDriveClientFolderUrl && (
                        <a
                          href={formData.googleDriveClientFolderUrl}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          rel="noopener noreferrer"
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-800 font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          <GoogleDriveIcon size={14} className="text-emerald-600" />
                          <span>Abrir pasta no Google Drive</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowMetadata(!showMetadata)}
                        className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 font-extrabold px-4 py-2.5 rounded-xl transition-all text-xs cursor-pointer shadow-xs border ${
                          showMetadata 
                            ? 'bg-amber-50 border-amber-200 text-amber-800' 
                            : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span>Ver metadados da pasta</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowLogs(!showLogs)}
                        className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 font-extrabold px-4 py-2.5 rounded-xl transition-all text-xs cursor-pointer shadow-xs border ${
                          showLogs 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                            : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <Activity size={14} className={showLogs ? "text-indigo-600 animate-pulse" : "text-gray-400"} />
                        <span>Ver Fluxo de logs</span>
                      </button>
                    </div>

                    {showMetadata && (
                      <div className="p-4 bg-white border border-gray-150 rounded-2xl space-y-3 shadow-3xs animate-in slide-in-from-top-1 duration-200">
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider block font-mono">
                            URL da Pasta (googleDriveClientFolderUrl)
                          </label>
                          {formData.googleDriveClientFolderUrl ? (
                            <div className="p-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs font-mono text-gray-800 break-all select-all flex items-center justify-between gap-2">
                              <span className="truncate flex-1">{formData.googleDriveClientFolderUrl}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(formData.googleDriveClientFolderUrl)}
                                className="p-1 hover:bg-gray-150 rounded text-gray-500 hover:text-gray-900 transition shrink-0"
                                title="Copiar URL"
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-gray-50/50 border border-gray-100 border-dashed rounded-xl text-xs text-gray-400 italic">
                              Sem URL sincronizada.
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider block font-mono">
                            ID da Pasta (googleDriveClientFolderId)
                          </label>
                          {formData.googleDriveClientFolderId ? (
                            <div className="p-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs font-mono text-gray-800 break-all select-all flex items-center justify-between gap-2">
                              <span className="truncate flex-1">{formData.googleDriveClientFolderId}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(formData.googleDriveClientFolderId)}
                                className="p-1 hover:bg-gray-150 rounded text-gray-500 hover:text-gray-900 transition shrink-0"
                                title="Copiar ID"
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-gray-50/50 border border-gray-100 border-dashed rounded-xl text-xs text-gray-400 italic">
                              Sem identificador sincronizado.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* operational logs area */}
                {showLogs && (
                  <div className="mt-6 border-t border-gray-100 pt-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Activity className="text-amber-500 animate-pulse" size={15} />
                      <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-wider font-mono">
                        Fluxo de Logs Operacionais da Integração (Tempo Real)
                      </h4>
                    </div>
                    <GoogleDriveJobsLogsPanel 
                      clientId={clientId} 
                      currentJobId={currentJobId} 
                      onSelectJobId={setCurrentJobId} 
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-3 border-t border-gray-150 pt-6">
              <button
                type="button"
                onClick={() => navigate(flowRoutes.dadosCaso(caseId!))}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 px-6 py-3.5 rounded-xl font-bold transition-all text-xs cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Voltar para Entrevista (5W2H)</span>
              </button>

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleUpdateClient(false)}
                  className="inline-flex items-center justify-center gap-2 bg-white border border-gray-250 hover:bg-gray-50 text-gray-800 px-6 py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 text-xs shadow-3xs cursor-pointer w-full sm:w-auto"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Salvar Alterações</span>
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleUpdateClient(true)}
                  className="inline-flex items-center justify-center gap-2 bg-gray-950 hover:bg-black text-white px-8 py-3.5 rounded-xl font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md text-xs cursor-pointer w-full sm:w-auto"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      <span>Salvar e Avançar</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>

            {!checkPortalSetupReady() && (
              <p className="text-[10px] text-gray-400 font-medium text-right mt-1 leading-normal italic">
                * Para liberar a criação/manutenção do Portal do Cliente, preencha: CPF/CNPJ válido, Login, Senha idênticos de 6 dígitos e Status de acesso.
              </p>
            )}
          </div>
        )}
      </div>
      <UnsavedChangesModal />
    </FluxoStepLayout>
  );
}
