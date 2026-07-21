import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FluxoStepLayout from './components/FluxoStepLayout';
import { ArrowLeft, ArrowRight, Save, Clock, CheckCircle2, AlertCircle, RefreshCw, FileText, ShieldCheck } from 'lucide-react';
import { flowRoutes } from './utils/flowRoutes';

function computePrazoAuditedItems(
  caseObj: any,
  client: any,
  evidenceRequests: any[],
  infoRequests: any[],
  justifications: Record<string, string>,
  exigeInfo: boolean,
  exigeProva: boolean
) {
  const list: any[] = [];
  if (!caseObj) return list;

  const wiz = caseObj.solicitacoesProvasWizardState || {};
  const isPf = client?.type === 'PF';
  const isPj = client?.type === 'PJ';

  if (exigeProva) {
    // 1. Procuração (Setor 05)
    const isProcSigned = (wiz.procuracaoFiles || caseObj.procuracaoFiles || []).length > 0 || wiz.q1_3 === 'sim';
    const hasProcUrl = !!caseObj.procuracaoGoogleDocsUrl;
    list.push({
      id: 'core_procuracao',
      name: 'Procuração Oficial',
      sector: '05 — Coleta de Provas',
      status: isProcSigned ? 'Juntado' : (hasProcUrl ? 'Recebido' : 'Pendente'),
      obs: 'Instrumento de procuração para representação de defesa.',
      responsible: 'Cliente',
      requestedAt: caseObj.createdAt || '',
      receivedAt: isProcSigned ? (caseObj.updatedAt || '') : '',
      isPendente: !isProcSigned
    });

    // 2. Declaração de Pobreza / Custas (Setor 05)
    const exigeCustas = wiz.q3_1 === 'sim';
    if (exigeCustas) {
      const hasGuiaDoc = (wiz.contratoFiles || []).length > 0 || caseObj.guiaCustasUrl || caseObj.guiaPaga === true;
      list.push({
        id: 'core_custas',
        name: 'Guia de Custas e Taxas Processuais',
        sector: '05 — Coleta de Provas',
        status: hasGuiaDoc ? 'Juntado' : 'Pendente',
        obs: 'Guia de recolhimento tributário e custas judiciais.',
        responsible: 'Cliente',
        requestedAt: caseObj.createdAt || '',
        receivedAt: hasGuiaDoc ? (caseObj.updatedAt || '') : '',
        isPendente: !hasGuiaDoc
      });
    } else {
      const isPobrezaSigned = (wiz.declaracaoFiles || caseObj.declaracaoFiles || []).length > 0 || wiz.q2_4 === 'sim';
      list.push({
        id: 'core_pobreza',
        name: 'Declaração de Pobreza (Gratuidade)',
        sector: '05 — Coleta de Provas',
        status: isPobrezaSigned ? 'Juntado' : 'Pendente',
        obs: 'Termo de declaração de pobreza para isenção de taxas.',
        responsible: 'Cliente',
        requestedAt: caseObj.createdAt || '',
        receivedAt: isPobrezaSigned ? (caseObj.updatedAt || '') : '',
        isPendente: !isPobrezaSigned
      });
    }

    // 3. RG (Setor 05 - PF only)
    if (isPf) {
      const hasRgFile = (wiz.rgFiles || []).length > 0 || wiz.q4_rg === 'sim';
      list.push({
        id: 'core_rg',
        name: 'Documento RG / Identidade Oficial',
        sector: '05 — Coleta de Provas',
        status: hasRgFile ? 'Juntado' : 'Pendente',
        obs: 'Documento civil de identificação do cliente.',
        responsible: 'Cliente',
        requestedAt: caseObj.createdAt || '',
        receivedAt: hasRgFile ? (caseObj.updatedAt || '') : '',
        isPendente: !hasRgFile
      });

      // 4. CPF (Setor 05 - PF only)
      const hasCpfFile = (wiz.cpfFiles || []).length > 0 || wiz.q4_cpf === 'sim';
      list.push({
        id: 'core_cpf',
        name: 'Comprovante de CPF',
        sector: '05 — Coleta de Provas',
        status: hasCpfFile ? 'Juntado' : 'Pendente',
        obs: 'Cadastro de Pessoa Física federal.',
        responsible: 'Cliente',
        requestedAt: caseObj.createdAt || '',
        receivedAt: hasCpfFile ? (caseObj.updatedAt || '') : '',
        isPendente: !hasCpfFile
      });
    }

    // 5. Contrato Social (Setor 05 - PJ only)
    if (isPj) {
      const hasContratoSoc = (wiz.contratoSocialFiles || []).length > 0 || wiz.q4_contrato_social === 'sim';
      list.push({
        id: 'core_contrato_social',
        name: 'Contrato Social Constitutivo',
        sector: '05 — Coleta de Provas',
        status: hasContratoSoc ? 'Juntado' : 'Pendente',
        obs: 'Estatuto constitutivo para comprovar poderes de representação societária.',
        responsible: 'Cliente',
        requestedAt: caseObj.createdAt || '',
        receivedAt: hasContratoSoc ? (caseObj.updatedAt || '') : '',
        isPendente: !hasContratoSoc
      });
    }

    // 6. Custom Evidence Requests (Setor 05 or Setor 12)
    evidenceRequests.forEach((req) => {
      const sectorLabel = req.evidenceType === 'adicional' || req.periciaType || req.isAdditional === true
        ? '12 — Solicitar + Provas'
        : '05 — Coleta de Provas';

      const isJuntado = req.status === 'aprovado' || req.status === 'arquivado';
      const isRecebido = req.status === 'enviado' || req.status === 'em_analise';
      const isDispensado = req.status === 'dispensado' || req.status === 'nao_se_aplica';

      list.push({
        id: req.id,
        name: req.title || 'Item de Prova',
        sector: sectorLabel,
        status: isJuntado ? 'Juntado' : (isRecebido ? 'Recebido' : (isDispensado ? 'Dispensado' : 'Pendente')),
        obs: req.description || 'Prova geral para fundamentação de mérito.',
        responsible: 'Cliente',
        requestedAt: req.createdAt || '',
        receivedAt: isJuntado || isRecebido ? (req.updatedAt || '') : '',
        isPendente: !isJuntado && !isDispensado
      });
    });
  }

  if (exigeInfo) {
    // 7. Custom Information Requests (Setor 06)
    infoRequests.forEach((req) => {
      const isJuntado = req.status === 'conferido' || req.status === 'concluido' || req.status === 'aprovado' || !!req.clientAnswer || !!req.answer;
      const isRecebido = req.status === 'respondido' || req.status === 'em_analise';
      const isDispensado = req.status === 'arquivado' || req.status === 'dispensado';

      list.push({
        id: req.id,
        name: req.title || 'Solicitação de Informação',
        sector: '06 — Solicitar + Informações',
        status: isJuntado ? 'Juntado' : (isRecebido ? 'Recebido' : (isDispensado ? 'Dispensado' : 'Pendente')),
        obs: req.description || req.clientAnswer || 'Questão complementar de elucidação fática.',
        responsible: 'Cliente',
        requestedAt: req.createdAt || '',
        receivedAt: isJuntado || isRecebido ? (req.updatedAt || '') : '',
        isPendente: !isJuntado && !isDispensado
      });
    });
  }

  return list.map(item => {
    const just = justifications[item.id];
    if (just && just.trim() && item.isPendente) {
      return {
        ...item,
        status: 'Dispensado',
        isPendente: false,
        justification: just
      };
    }
    return {
      ...item,
      justification: just || ''
    };
  });
}

export default function PrazosFluxo() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [caseObj, setCaseObj] = useState<any>(null);

  const [evidenceRequests, setEvidenceRequests] = useState<any[]>([]);
  const [infoRequests, setInfoRequests] = useState<any[]>([]);
  const [client, setClient] = useState<any>(null);

  const [prazoExigeInfoAdicional, setPrazoExigeInfoAdicional] = useState(false);
  const [prazoExigeProvaAdicional, setPrazoExigeProvaAdicional] = useState(false);
  const [prazoAuditoriaJustifications, setPrazoAuditoriaJustifications] = useState<Record<string, string>>({});
  const [prazoAuditoriaLogs, setPrazoAuditoriaLogs] = useState<string[]>([]);
  const [showLogsConsole, setShowLogsConsole] = useState(false);

  const [prazoMarked, setPrazoMarked] = useState(false);
  const [prazoQual, setPrazoQual] = useState('');
  const [prazoFatal, setPrazoFatal] = useState('');
  const [prazoResponsavel, setPrazoResponsavel] = useState('');
  const [prazoSeguranca, setPrazoSeguranca] = useState('');
  const [prazoDependeClienteInfo, setPrazoDependeClienteInfo] = useState(false);
  const [prazoQualInfo, setPrazoQualInfo] = useState('');
  const [prazoDependeClienteProva, setPrazoDependeClienteProva] = useState(false);
  const [prazoQualProva, setPrazoQualProva] = useState('');

  const auditedItems = React.useMemo(() => {
    return computePrazoAuditedItems(
      caseObj,
      client,
      evidenceRequests,
      infoRequests,
      prazoAuditoriaJustifications,
      prazoExigeInfoAdicional,
      prazoExigeProvaAdicional
    );
  }, [caseObj, client, evidenceRequests, infoRequests, prazoAuditoriaJustifications, prazoExigeInfoAdicional, prazoExigeProvaAdicional]);

  const logToPrazoAuditoria = async (message: string, currentJustifications = prazoAuditoriaJustifications) => {
    const timestamp = new Date().toLocaleString('pt-BR');
    const logEntry = `[${timestamp}] ${message}`;
    const nextLogs = [logEntry, ...prazoAuditoriaLogs];
    setPrazoAuditoriaLogs(nextLogs);

    try {
      await updateDoc(doc(db, 'cases', caseId!), {
        'protocol.prazoAuditoriaLogs': nextLogs,
        'protocol.prazoAuditoriaJustifications': currentJustifications
      });
    } catch (err) {
      console.error("Erro ao gravar log da auditoria de prazo:", err);
    }
  };

  const handleUpdatePrazoJustification = (itemId: string, val: string) => {
    const updated = {
      ...prazoAuditoriaJustifications,
      [itemId]: val
    };
    setPrazoAuditoriaJustifications(updated);

    const item = auditedItems.find(i => i.id === itemId);
    const itemName = item ? item.name : itemId;
    const msg = val.trim() 
      ? `Justificativa registrada para o item "${itemName}": "${val.trim()}"`
      : `Justificativa removida para o item "${itemName}"`;
    logToPrazoAuditoria(msg, updated);
  };

  useEffect(() => {
    if (!caseId) return;

    async function fetchData() {
      try {
        setLoading(true);
        const caseRef = doc(db, 'cases', caseId!);
        const caseSnap = await getDoc(caseRef);

        if (caseSnap.exists()) {
          const cData = caseSnap.data();
          setCaseObj(cData);
          
          let cliData: any = null;
          if (cData.clientId) {
            const clientSnap = await getDoc(doc(db, 'clients', cData.clientId));
            if (clientSnap.exists()) {
              cliData = clientSnap.data();
              setClient(cliData);
            }
          }

          const rawProtocol = cData.protocol || {};
          setPrazoMarked(rawProtocol.prazoMarked ?? false);
          setPrazoQual(rawProtocol.prazoQual || '');
          setPrazoFatal(rawProtocol.prazoFatal || '');
          setPrazoResponsavel(rawProtocol.prazoResponsavel || '');
          setPrazoSeguranca(rawProtocol.prazoSeguranca || '');
          setPrazoDependeClienteInfo(rawProtocol.prazoDependeClienteInfo ?? false);
          setPrazoQualInfo(rawProtocol.prazoQualInfo || '');
          setPrazoDependeClienteProva(rawProtocol.prazoDependeClienteProva ?? false);
          setPrazoQualProva(rawProtocol.prazoQualProva || '');

          setPrazoExigeInfoAdicional(rawProtocol.prazoExigeInfoAdicional ?? false);
          setPrazoExigeProvaAdicional(rawProtocol.prazoExigeProvaAdicional ?? false);

          // 1. Fetch caseEvidenceRequests
          const qEv = query(collection(db, 'caseEvidenceRequests'), where('caseId', '==', caseId!));
          const evSnap = await getDocs(qEv);
          const evList: any[] = [];
          evSnap.forEach((docSnap) => {
            evList.push({ id: docSnap.id, ...docSnap.data() });
          });
          setEvidenceRequests(evList);

          // 2. Fetch caseInformationRequests
          const qInfo = query(collection(db, 'caseInformationRequests'), where('caseId', '==', caseId!));
          const infoSnap = await getDocs(qInfo);
          const infoList: any[] = [];
          infoSnap.forEach((docSnap) => {
            infoList.push({ id: docSnap.id, ...docSnap.data() });
          });
          setInfoRequests(infoList);

          // 3. Load justifications and logs
          const loadedJustifications = rawProtocol.prazoAuditoriaJustifications || {};
          setPrazoAuditoriaJustifications(loadedJustifications);

          const initialLogs = rawProtocol.prazoAuditoriaLogs || [];
          if (initialLogs.length === 0) {
            const tempAudited = computePrazoAuditedItems(
              cData,
              cliData,
              evList,
              infoList,
              loadedJustifications,
              rawProtocol.prazoExigeInfoAdicional ?? false,
              rawProtocol.prazoExigeProvaAdicional ?? false
            );
            const countAll = tempAudited.length;
            const countPending = tempAudited.filter((i: any) => i.isPendente).length;
            const countResolved = countAll - countPending;
            const timestamp = new Date().toLocaleString('pt-BR');
            const initialLog = `[${timestamp}] Auditoria inicializada na rota /prazos. Total de itens monitorados: ${countAll}. Resolvidos: ${countResolved}. Pendentes: ${countPending}.`;
            setPrazoAuditoriaLogs([initialLog]);
          } else {
            setPrazoAuditoriaLogs(initialLogs);
          }
        }
      } catch (err: any) {
        setError(`Erro ao carregar dados: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [caseId]);

  const handleSave = async (action: 'none' | 'advance' | 'exit' = 'none') => {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const currentAudited = computePrazoAuditedItems(
      caseObj,
      client,
      evidenceRequests,
      infoRequests,
      prazoAuditoriaJustifications,
      prazoExigeInfoAdicional,
      prazoExigeProvaAdicional
    );
    const pendingItems = currentAudited.filter((i) => i.isPendente);

    if ((action === 'advance' || prazoMarked) && pendingItems.length > 0) {
      const timestamp = new Date().toLocaleString('pt-BR');
      const logMsg = `[${timestamp}] BLOQUEIO DE SALVAMENTO: Tentativa de cumprir prazo ou avançar com ${pendingItems.length} pendências de auditoria ativas.`;
      const nextLogs = [logMsg, ...prazoAuditoriaLogs];
      setPrazoAuditoriaLogs(nextLogs);

      try {
        await updateDoc(doc(db, 'cases', caseId!), {
          'protocol.prazoAuditoriaLogs': nextLogs
        });
      } catch (err) {
        console.error("Erro ao salvar log de bloqueio de prazo:", err);
      }

      setError(`🚨 Ação bloqueada pela Auditoria: Existem ${pendingItems.length} pendências ativas nos setores exigidos para o cumprimento deste prazo. Saneie as pendências ou justifique formalmente.`);
      setSaving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }

    try {
      const caseRef = doc(db, 'cases', caseId!);
      const timestamp = new Date().toLocaleString('pt-BR');
      const logMsg = `[${timestamp}] SUCESSO: Prazos e exigências salvos. Todas as pendências exigidas foram saneadas ou formalmente justificadas.`;
      const nextLogs = [logMsg, ...prazoAuditoriaLogs];
      setPrazoAuditoriaLogs(nextLogs);

      const protocolUpdates = {
        prazoMarked,
        prazoQual,
        prazoFatal,
        prazoResponsavel,
        prazoSeguranca,
        prazoDependeClienteInfo,
        prazoQualInfo,
        prazoDependeClienteProva,
        prazoQualProva,
        prazoExigeInfoAdicional,
        prazoExigeProvaAdicional,
        prazoAuditoriaJustifications,
        prazoAuditoriaLogs: nextLogs
      };

      await updateDoc(caseRef, {
        'protocol.prazoMarked': protocolUpdates.prazoMarked,
        'protocol.prazoQual': protocolUpdates.prazoQual,
        'protocol.prazoFatal': protocolUpdates.prazoFatal,
        'protocol.prazoResponsavel': protocolUpdates.prazoResponsavel,
        'protocol.prazoSeguranca': protocolUpdates.prazoSeguranca,
        'protocol.prazoDependeClienteInfo': protocolUpdates.prazoDependeClienteInfo,
        'protocol.prazoQualInfo': protocolUpdates.prazoQualInfo,
        'protocol.prazoDependeClienteProva': protocolUpdates.prazoDependeClienteProva,
        'protocol.prazoQualProva': protocolUpdates.prazoQualProva,
        'protocol.prazoExigeInfoAdicional': protocolUpdates.prazoExigeInfoAdicional,
        'protocol.prazoExigeProvaAdicional': protocolUpdates.prazoExigeProvaAdicional,
        'protocol.prazoAuditoriaJustifications': protocolUpdates.prazoAuditoriaJustifications,
        'protocol.prazoAuditoriaLogs': protocolUpdates.prazoAuditoriaLogs,
      });

      setSuccess('Prazos e Auditoria salvos de forma exemplar no Connect!');

      if (action === 'exit') {
        navigate('/boss-giffoni-clientes/fluxo-producao');
      } else if (action === 'advance') {
        navigate(flowRoutes.agendarAudiencias(caseId!));
      }
    } catch (err: any) {
      setError(`Erro ao salvar prazos: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <FluxoStepLayout stepName="Prazos" caseId={caseId}>
        <div className="p-16 text-center text-gray-400">Carregando...</div>
      </FluxoStepLayout>
    );
  }

  return (
    <FluxoStepLayout
      stepName="Prazos"
      caseId={caseId}
      statusText={caseObj?.statusInterno || 'Em andamento'}
    >
      <div className="space-y-8 font-sans">
        {error && (
          <div className="p-5 bg-red-50 border border-red-150 rounded-2xl text-red-955 text-xs flex gap-3 items-center">
            <AlertCircle size={18} className="text-red-650 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-5 bg-emerald-50 border border-emerald-150 rounded-2xl text-emerald-950 text-xs flex gap-3 items-center">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        <div className="border border-gray-150 rounded-3xl p-6 bg-white shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <Clock size={16} /> Prazos Processuais
              </h3>
              <p className="text-xs text-gray-400 mt-1">Tem prazo em andamento para este caso?</p>
            </div>
            <div className="flex gap-1.5 border border-gray-200 p-1.5 rounded-2xl bg-gray-50/50">
              <button
                type="button"
                onClick={() => setPrazoMarked(true)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  prazoMarked ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setPrazoMarked(false)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  !prazoMarked ? 'bg-gray-250 text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Não
              </button>
            </div>
          </div>

          {prazoMarked && (
            <div className="space-y-5 animate-in slide-in-from-top-3 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Qual prazo está aberto?</label>
                  <input
                    type="text"
                    value={prazoQual}
                    onChange={(e) => setPrazoQual(e.target.value)}
                    placeholder="Ex: Réplica, manifestação sobre o laudo"
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-red-500">PRAZO FATAL *</label>
                  <input
                    type="date"
                    value={prazoFatal}
                    onChange={(e) => setPrazoFatal(e.target.value)}
                    className="w-full bg-white border border-red-200 text-red-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-3.5 py-2.5 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Responsável</label>
                  <input
                    type="text"
                    value={prazoResponsavel}
                    onChange={(e) => setPrazoResponsavel(e.target.value)}
                    placeholder="Nome"
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-600">PRAZO SEGURANÇA *</label>
                  <input
                    type="date"
                    value={prazoSeguranca}
                    onChange={(e) => setPrazoSeguranca(e.target.value)}
                    className="w-full bg-white border border-indigo-200 text-indigo-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold"
                  />
                </div>
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 border border-indigo-100 rounded-2xl bg-indigo-50/20 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-indigo-950 uppercase">Depende de INFO do cliente?</span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setPrazoDependeClienteInfo(true)} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${prazoDependeClienteInfo ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}>Sim</button>
                        <button type="button" onClick={() => setPrazoDependeClienteInfo(false)} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${!prazoDependeClienteInfo ? 'bg-gray-600 text-white' : 'bg-white text-gray-500'}`}>Não</button>
                      </div>
                    </div>
                    {prazoDependeClienteInfo && (
                      <input type="text" value={prazoQualInfo} onChange={(e) => setPrazoQualInfo(e.target.value)} placeholder="Descreva a info" className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px]" />
                    )}
                  </div>
                  <div className="p-3.5 border border-purple-100 rounded-2xl bg-purple-50/20 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-purple-950 uppercase">Depende de PROVAS do cliente?</span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setPrazoDependeClienteProva(true)} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${prazoDependeClienteProva ? 'bg-purple-600 text-white' : 'bg-white text-gray-500'}`}>Sim</button>
                        <button type="button" onClick={() => setPrazoDependeClienteProva(false)} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${!prazoDependeClienteProva ? 'bg-gray-600 text-white' : 'bg-white text-gray-500'}`}>Não</button>
                      </div>
                    </div>
                    {prazoDependeClienteProva && (
                      <input type="text" value={prazoQualProva} onChange={(e) => setPrazoQualProva(e.target.value)} placeholder="Descreva a prova" className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px]" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SEÇÃO DE AUDITORIA DE SEGURANÇA PARA PRAZOS */}
        <div className="border border-gray-150 rounded-3xl p-6 bg-white shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="p-2 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                Auditoria de Juntada de Provas e Informações (Prazos)
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Conferência de segurança fática antes de marcar ou concluir prazos processuais.
              </p>
            </div>
          </div>

          {/* PERGUNTAS DE AUDITORIA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* PERGUNTA 1: INFORMAÇÕES */}
            <div className="p-4 border border-gray-150 rounded-2xl bg-gray-50/50 space-y-3">
              <div className="flex justify-between items-start gap-4">
                <span className="text-xs font-black text-gray-800 uppercase leading-snug">
                  1. O caso exige informações adicionais do cliente para o cumprimento deste prazo?
                </span>
                <div className="flex gap-1.5 shrink-0 bg-white border border-gray-200 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setPrazoExigeInfoAdicional(true);
                      logToPrazoAuditoria("Exigência de Informações Adicionais ativada para este prazo.");
                    }}
                    className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all ${
                      prazoExigeInfoAdicional ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-950'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrazoExigeInfoAdicional(false);
                      logToPrazoAuditoria("Exigência de Informações Adicionais desativada para este prazo.");
                    }}
                    className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all ${
                      !prazoExigeInfoAdicional ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:text-gray-950'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>

              {prazoExigeInfoAdicional ? (
                <div className="space-y-2">
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-950 font-medium">
                    ⚠️ <strong>Alerta de Risco:</strong> Informações pendentes podem impossibilitar a defesa ideal do cliente. Certifique-se de preenchê-las ou justificá-las.
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 font-bold italic bg-white border border-gray-150 p-3 rounded-xl text-center">
                  ✓ Neste prazo não existem informações pendentes de juntada.
                </p>
              )}
            </div>

            {/* PERGUNTA 2: PROVAS */}
            <div className="p-4 border border-gray-150 rounded-2xl bg-gray-50/50 space-y-3">
              <div className="flex justify-between items-start gap-4">
                <span className="text-xs font-black text-gray-800 uppercase leading-snug">
                  2. O caso exige a juntada de provas adicionais para o cumprimento deste prazo?
                </span>
                <div className="flex gap-1.5 shrink-0 bg-white border border-gray-200 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setPrazoExigeProvaAdicional(true);
                      logToPrazoAuditoria("Exigência de Provas Adicionais ativada para este prazo.");
                    }}
                    className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all ${
                      prazoExigeProvaAdicional ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-950'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrazoExigeProvaAdicional(false);
                      logToPrazoAuditoria("Exigência de Provas Adicionais desativada para este prazo.");
                    }}
                    className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all ${
                      !prazoExigeProvaAdicional ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:text-gray-950'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>

              {prazoExigeProvaAdicional ? (
                <div className="space-y-2">
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-950 font-medium">
                    ⚠️ <strong>Alerta de Risco:</strong> Provas pendentes podem causar preclusão consumativa ou improcedência da petição. Garanta o saneamento antes de protocolar.
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 font-bold italic bg-white border border-gray-150 p-3 rounded-xl text-center">
                  ✓ Neste prazo não existem provas pendentes de juntada.
                </p>
              )}
            </div>

          </div>

          {/* CHECKLIST DE ITENS SE ATIVOS */}
          {(prazoExigeInfoAdicional || prazoExigeProvaAdicional) && (
            <div className="space-y-4 animate-in slide-in-from-top-3 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Checkout de Documentos Auditorados</span>
                <span className="text-[10px] bg-red-50 text-red-700 border border-red-100 px-2.5 py-0.5 rounded-full font-bold">
                  {auditedItems.filter((i: any) => i.isPendente).length} pendência(s)
                </span>
              </div>

              <div className="overflow-hidden border border-gray-150 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider font-black text-[10px] border-b border-gray-150">
                      <th className="p-3.5 pl-4 w-1/3">Item Monitorado</th>
                      <th className="p-3.5">Setor</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Responsável / Datas</th>
                      <th className="p-3.5 pr-4 w-1/3">Justificativa de Dispensa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditedItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-gray-400 font-medium italic">
                          Nenhum item pendente para auditar nos setores selecionados.
                        </td>
                      </tr>
                    ) : (
                      auditedItems.map((item) => {
                        const statusColors: Record<string, string> = {
                          'Juntado': 'bg-emerald-600 text-white',
                          'Recebido': 'bg-blue-600 text-white',
                          'Dispensado': 'bg-slate-500 text-white',
                          'Pendente': 'bg-red-500 text-white',
                          'Não se aplica': 'bg-gray-400 text-white'
                        };

                        return (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 pl-4 space-y-1">
                              <span className="font-extrabold text-gray-900 block">{item.name}</span>
                              <span className="text-[10.5px] text-gray-400 block font-medium leading-relaxed">
                                {item.obs}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-[10px] font-black uppercase text-indigo-750 font-mono tracking-wide bg-indigo-50/60 px-2 py-0.5 rounded">
                                {item.sector}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex px-2 py-0.5 rounded-lg text-[9.5px] font-black uppercase tracking-wider ${statusColors[item.status] || 'bg-gray-500'}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="p-4 space-y-1 font-medium text-gray-500 text-[11px]">
                              <div>Resp: <strong className="text-gray-800">{item.responsible}</strong></div>
                              {item.requestedAt && (
                                <div>Solicitado: <span className="font-mono">{new Date(item.requestedAt).toLocaleDateString('pt-BR')}</span></div>
                              )}
                              {item.receivedAt && (
                                <div>Recebido: <span className="font-mono">{new Date(item.receivedAt).toLocaleDateString('pt-BR')}</span></div>
                              )}
                            </td>
                            <td className="p-4 pr-4">
                              {item.isPendente || item.status === 'Dispensado' ? (
                                <textarea
                                  value={item.justification || ''}
                                  onChange={(e) => handleUpdatePrazoJustification(item.id, e.target.value)}
                                  placeholder="Justifique formalmente o cumprimento sem este item..."
                                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-2 text-[11px] font-medium placeholder-gray-300 min-h-[60px] resize-none"
                                />
                              ) : (
                                <span className="text-[10.5px] text-emerald-600 font-bold block bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-center">
                                  ✓ Item sanado nos autos
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* LOG TÉCNICO DE PRAZOS */}
          <div className="border border-gray-150 rounded-2xl overflow-hidden bg-slate-50">
            <button
              type="button"
              onClick={() => setShowLogsConsole(!showLogsConsole)}
              className="w-full flex items-center justify-between p-4 bg-gray-100/70 hover:bg-gray-100 transition-all font-bold text-xs text-gray-700 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <FileText size={14} className="text-gray-500" />
                Log Técnico da Auditoria de Prazo ({prazoAuditoriaLogs.length} registros)
              </span>
              <span className="text-[10px] uppercase font-black text-gray-400">
                {showLogsConsole ? 'Ocultar Terminal ▲' : 'Expandir Terminal ▼'}
              </span>
            </button>

            {showLogsConsole && (
              <div className="p-4 bg-slate-900 border-t border-gray-200 font-mono text-[10px] text-slate-300 space-y-1.5 max-h-[180px] overflow-y-auto leading-relaxed scrollbar-thin">
                {prazoAuditoriaLogs.map((log, index) => (
                  <div key={index} className="flex gap-2.5">
                    <span className="text-indigo-400 shrink-0 font-bold">›</span>
                    <span className="whitespace-pre-wrap">{log}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 pt-6 border-t border-gray-150">
          <button
            type="button"
            onClick={() => navigate(flowRoutes.controladoria(caseId!))}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
          >
            <ArrowLeft size={14} />
            Voltar para Controladoria
          </button>
          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('none')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-700 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              <Save size={13} />
              {saving ? 'Gravando...' : 'Salvar Prazos'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('exit')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-950 text-gray-900 hover:bg-gray-50 px-5 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer bg-white"
            >
              Salvar e Sair
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('advance')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white px-7 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
            >
              <span>Salvar e Avançar</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </FluxoStepLayout>
  );
}
