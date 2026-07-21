import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BossLayout } from '../../../components/Layout';
import { db } from '../../../lib/firebase';
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc, 
  query, 
  where, 
  addDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Search, 
  User, 
  Briefcase, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Edit2, 
  DollarSign, 
  HelpCircle, 
  ArrowLeft, 
  Eye, 
  Info, 
  Layers,
  ChevronRight,
  UserCheck,
  Calendar,
  Layers3,
  CreditCard,
  FileBadge,
  Save
} from 'lucide-react';

export default function PortalClienteFluxo() {
  const navigate = useNavigate();

  // Search & Navigation States
  const [clients, setClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingClients, setLoadingClients] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Active Selections
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [clientCases, setClientCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [loadingCaseDetails, setLoadingCaseDetails] = useState(false);

  // Linked Entities
  const [activeSubTab, setActiveSubTab] = useState<'entrevista' | 'tipo_servico' | 'provas' | 'informacoes' | 'financeiro'>('entrevista');
  const [evidenceRequests, setEvidenceRequests] = useState<any[]>([]);
  const [informationRequests, setInformationRequests] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);

  // Local Edit States
  const [editingNarrative, setEditingNarrative] = useState('');
  const [savingNarrative, setSavingNarrative] = useState(false);
  const [serviceTypeKey, setServiceTypeKey] = useState('');
  const [serviceTypeName, setServiceTypeName] = useState('');
  const [savingService, setSavingService] = useState(false);

  // Form states for adding Provas
  const [newProofTitle, setNewProofTitle] = useState('');
  const [newProofDesc, setNewProofDesc] = useState('');
  const [newProofVisible, setNewProofVisible] = useState(true);
  const [newProofUpload, setNewProofUpload] = useState(true);
  const [addingProof, setAddingProof] = useState(false);

  // Form states for adding Informacoes
  const [newQuestionText, setNewQuestionText] = useState('');
  const [addingQuestion, setAddingQuestion] = useState(false);

  // Form states for adding Financial
  const [newChargeType, setNewChargeType] = useState('honorarios_iniciais');
  const [newAmount, setNewAmount] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('boleto');
  const [newInstallments, setNewInstallments] = useState(1);
  const [newDueDate, setNewDueDate] = useState('');
  const [newFinancialStatus, setNewFinancialStatus] = useState('pendente');
  const [newPublicMessage, setNewPublicMessage] = useState('');
  const [addingFinancial, setAddingFinancial] = useState(false);

  // Fetch all clients on load
  const fetchClientsAndIndex = async () => {
    setLoadingClients(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, 'clients'));
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setClients(list);
      setFilteredClients(list);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar lista de clientes: ' + (err.message || err));
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    fetchClientsAndIndex();
  }, []);

  // Filter clients based on query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredClients(clients);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = clients.filter((c) => {
      const name = c.type === 'PF' 
        ? (c.pfDadosPessoais?.pf_nomeCompleto || c.pfData?.pf_nomeCompleto || '').toLowerCase()
        : (c.pjDadosEmpresa?.pj_razaoSocial || c.pjData?.pj_razaoSocial || '').toLowerCase();
      const document = c.type === 'PF'
        ? (c.pfDadosPessoais?.pf_cpf || c.pfData?.pf_cpf || '').toLowerCase()
        : (c.pjDadosEmpresa?.pj_cnpj || c.pjData?.pj_cnpj || '').toLowerCase();
      return name.includes(q) || document.includes(q) || (c.slug || '').toLowerCase().includes(q);
    });
    setFilteredClients(filtered);
  }, [searchQuery, clients]);

  // Load selected client's cases & clear details
  const handleSelectClient = async (client: any) => {
    setSelectedClient(client);
    setSelectedCase(null);
    setClientCases([]);
    setEvidenceRequests([]);
    setInformationRequests([]);
    setFinancials([]);
    setEditingNarrative('');
    setServiceTypeKey('');
    setServiceTypeName('');
    setLoadingCaseDetails(true);

    try {
      const q = query(collection(db, 'cases'), where('clientId', '==', client.id));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setClientCases(list);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar casos do cliente: ' + (err.message || err));
    } finally {
      setLoadingCaseDetails(false);
    }
  };

  // Load selected case's atrelados
  const handleSelectCase = async (caseObj: any) => {
    setSelectedCase(caseObj);
    setLoadingCaseDetails(true);
    setActiveSubTab('entrevista');
    
    // Set local editor states
    setEditingNarrative(caseObj.entrevistaPadrao || caseObj.description || '');
    setServiceTypeKey(caseObj.registrationTypeKey || '');
    setServiceTypeName(caseObj.registrationType || '');

    try {
      // 1. Fetch caseEvidenceRequests
      const proofQuery = query(collection(db, 'caseEvidenceRequests'), where('caseId', '==', caseObj.id));
      const proofSnap = await getDocs(proofQuery);
      const proofList: any[] = [];
      proofSnap.forEach((d) => {
        proofList.push({ id: d.id, ...d.data() });
      });
      setEvidenceRequests(proofList);

      // 2. Fetch caseInformationRequests
      const infoQuery = query(collection(db, 'caseInformationRequests'), where('caseId', '==', caseObj.id));
      const infoSnap = await getDocs(infoQuery);
      const infoList: any[] = [];
      infoSnap.forEach((d) => {
        infoList.push({ id: d.id, ...d.data() });
      });
      setInformationRequests(infoList);

      // 3. Fetch caseFinancials
      const finQuery = query(collection(db, 'caseFinancials'), where('caseId', '==', caseObj.id));
      const finSnap = await getDocs(finQuery);
      const finList: any[] = [];
      finSnap.forEach((d) => {
        finList.push({ id: d.id, ...d.data() });
      });
      setFinancials(finList);

    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar vinculações do caso: ' + (err.message || err));
    } finally {
      setLoadingCaseDetails(false);
    }
  };

  // Saved updates helpers
  const showToastSuccess = (text: string) => {
    setSuccess(text);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Action: Save Entrevista Narrative
  const handleSaveNarrative = async () => {
    if (!selectedCase) return;
    setSavingNarrative(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'cases', selectedCase.id), {
        entrevistaPadrao: editingNarrative.trim(),
        description: editingNarrative.trim(), // mirrored field compatibility
        updatedAt: new Date().toISOString()
      });
      // Update local case ref
      setSelectedCase((prev: any) => ({ 
        ...prev, 
        entrevistaPadrao: editingNarrative.trim(),
        description: editingNarrative.trim()
      }));
      showToastSuccess('Narrativa da Entrevista foi atualizada com sucesso!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao atualizar narrativa: ' + (err.message || err));
    } finally {
      setSavingNarrative(false);
    }
  };

  // Action: Save Tipo de Serviço
  const handleSaveServiceType = async () => {
    if (!selectedCase) return;
    setSavingService(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'cases', selectedCase.id), {
        registrationTypeKey: serviceTypeKey,
        registrationType: serviceTypeName,
        updatedAt: new Date().toISOString()
      });
      setSelectedCase((prev: any) => ({
        ...prev,
        registrationTypeKey: serviceTypeKey,
        registrationType: serviceTypeName
      }));
      showToastSuccess('Tipo de Serviço atualizado com êxito!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao atualizar tipo de serviço: ' + (err.message || err));
    } finally {
      setSavingService(false);
    }
  };

  // Action: Create dynamic Case Evidence Request (Prova)
  const handleCreateProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !newProofTitle.trim()) return;
    setAddingProof(true);
    setError(null);

    const payload = {
      caseId: selectedCase.id,
      clientId: selectedClient.id,
      clientSlug: selectedClient.slug || '',
      title: newProofTitle.trim(),
      description: newProofDesc.trim(),
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], // default 7 days
      status: 'pendente',
      visibleToClient: newProofVisible,
      allowUpload: newProofUpload,
      expectedFileTypes: ['.pdf', '.png', '.jpg', '.jpeg'],
      maxFiles: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, 'caseEvidenceRequests'), payload);
      setEvidenceRequests((prev) => [{ id: docRef.id, ...payload }, ...prev]);
      
      // Clear inputs
      setNewProofTitle('');
      setNewProofDesc('');
      showToastSuccess('Nova solicitação de prova cadastrada com sucesso!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao criar solicitação de prova: ' + (err.message || err));
    } finally {
      setAddingProof(false);
    }
  };

  // Action: Toggle Proof request selection status
  const handleToggleProofStatus = async (proof: any) => {
    const nextStatus = proof.status === 'aprovado' ? 'pendente' : 'aprovado';
    setError(null);
    try {
      await updateDoc(doc(db, 'caseEvidenceRequests', proof.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
      setEvidenceRequests((prev) =>
        prev.map((p) => (p.id === proof.id ? { ...p, status: nextStatus } : p))
      );
      showToastSuccess('Status da prova atualizado!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao alterar status da prova: ' + (err.message || err));
    }
  };

  // Action: Delete custom Proof Request
  const handleDeleteProof = async (proofId: string) => {
    if (!window.confirm('Tem certeza que deseja remover esta solicitação de prova?')) return;
    setError(null);
    try {
      await deleteDoc(doc(db, 'caseEvidenceRequests', proofId));
      setEvidenceRequests((prev) => prev.filter((p) => p.id !== proofId));
      showToastSuccess('Documento removido da coleta!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao apagar solicitação de prova: ' + (err.message || err));
    }
  };

  // Action: Create complementary question
  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !newQuestionText.trim()) return;
    setAddingQuestion(true);
    setError(null);

    const payload = {
      caseId: selectedCase.id,
      clientId: selectedClient.id,
      question: newQuestionText.trim(),
      answer: '',
      status: 'pendente', // pendente, respondido, revisado
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, 'caseInformationRequests'), payload);
      setInformationRequests((prev) => [{ id: docRef.id, ...payload }, ...prev]);
      setNewQuestionText('');
      showToastSuccess('Pergunta de informação complementar adicionada!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao adicionar pergunta complementar: ' + (err.message || err));
    } finally {
      setAddingQuestion(false);
    }
  };

  // Action: Save info complement answer and status
  const handleUpdateQuestionAnswer = async (id: string, ans: string, status: string) => {
    setError(null);
    try {
      await updateDoc(doc(db, 'caseInformationRequests', id), {
        answer: ans.trim(),
        status: status,
        updatedAt: new Date().toISOString()
      });
      setInformationRequests((prev) =>
        prev.map((q) => (q.id === id ? { ...q, answer: ans, status: status } : q))
      );
      showToastSuccess('Informação salva no histórico!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao salvar resposta: ' + (err.message || err));
    }
  };

  // Action: Create Case Financial record
  const handleCreateFinancial = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(newAmount);
    if (!selectedCase || isNaN(parsedAmount) || parsedAmount < 0) {
      setError('Insira um valor numérico válido.');
      return;
    }
    setAddingFinancial(true);
    setError(null);

    const payload = {
      caseId: selectedCase.id,
      clientId: selectedClient.id,
      clientSlug: selectedClient.slug || '',
      chargeType: newChargeType,
      totalAmount: parsedAmount,
      paymentMethod: newPaymentMethod,
      installments: Number(newInstallments) || 1,
      firstDueDate: newDueDate || new Date().toISOString().split('T')[0],
      financialStatus: newFinancialStatus,
      visibleToClient: true,
      publicFinancialMessage: newPublicMessage.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, 'caseFinancials'), payload);
      setFinancials((prev) => [{ id: docRef.id, ...payload }, ...prev]);
      
      // Reset inputs
      setNewAmount('');
      setNewPublicMessage('');
      showToastSuccess('Relatório financeiro do caso atualizado!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao cadastrar faturamento: ' + (err.message || err));
    } finally {
      setAddingFinancial(false);
    }
  };

  // Action: Remove Finance
  const handleDeleteFinancial = async (finId: string) => {
    if (!window.confirm('Excluir este lançamento financeiro permanentemente?')) return;
    setError(null);
    try {
      await deleteDoc(doc(db, 'caseFinancials', finId));
      setFinancials((prev) => prev.filter((f) => f.id !== finId));
      showToastSuccess('Faturamento excluído!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao excluir financeiro: ' + (err.message || err));
    }
  };

  // Helper values formatting
  const getClientName = (c: any) => {
    if (!c) return '';
    return c.type === 'PF'
      ? (c.pfDadosPessoais?.pf_nomeCompleto || c.pfData?.pf_nomeCompleto || 'Sem Nome')
      : (c.pjDadosEmpresa?.pj_razaoSocial || c.pjData?.pj_razaoSocial || 'Sem Razão Social');
  };

  const getClientDoc = (c: any) => {
    if (!c) return '';
    return c.type === 'PF'
      ? (c.pfDadosPessoais?.pf_cpf || c.pfData?.pf_cpf || 'CPF não informado')
      : (c.pjDadosEmpresa?.pj_cnpj || c.pjData?.pj_cnpj || 'CNPJ não informado');
  };

  return (
    <BossLayout>
      <div className="max-w-4xl mx-auto px-4 md:px-0 space-y-8 animate-fade-in pb-12">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-150 pb-6 gap-4">
          <div className="space-y-1 text-left">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/boss-giffoni-clientes/fluxo-producao')}
                className="p-1 px-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider border border-gray-150 shadow-xs cursor-pointer"
              >
                <ArrowLeft size={14} /> Voltar
              </button>
              <h1 className="text-3xl font-black text-gray-950 tracking-tight">Editar o Portal do Cliente</h1>
            </div>
            <p className="text-xs text-gray-400 font-semibold mt-1">Selecione um cliente do escritório listado abaixo para gerenciar seu portal.</p>
          </div>
          <button
            onClick={fetchClientsAndIndex}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 hover:text-gray-950 rounded-2xl text-xs font-extrabold transition uppercase tracking-wider font-mono self-start cursor-pointer"
          >
            <RefreshCw size={14} className={loadingClients ? 'animate-spin' : ''} />
            Atualizar Lista
          </button>
        </div>

        {/* FEEDBACK LABELS */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100/80 rounded-2xl text-rose-800 text-xs font-semibold flex items-center gap-2 text-left">
            <AlertCircle size={16} className="text-rose-500 shrink-0" />
            {error}
          </div>
        )}

        {/* SEARCH AND MAIN DOCKET */}
        <div className="bg-white border border-gray-150 rounded-[2rem] p-6 md:p-8 shadow-xs space-y-6 flex flex-col text-left">
          <div className="space-y-1">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Busca de Clientes</h3>
            <p className="text-xs text-gray-400 font-medium select-none">Clique no cliente para abrir a página de edição do portal.</p>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Digite o nome, CPF/CNPJ ou slug do cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-250 rounded-2xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-100 focus:outline-none transition font-sans placeholder-gray-400 pl-10"
            />
            <Search size={16} className="text-gray-400 absolute left-3.5 top-3.5" />
          </div>

          {loadingClients ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 font-mono text-xs text-gray-400">
              <RefreshCw size={24} className="animate-spin text-blue-600" />
              <span>Carregando base de clientes...</span>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center p-6 text-center text-xs text-gray-400 border border-dashed rounded-2xl">
              <User size={30} className="text-gray-300 mb-2" />
              <p className="font-extrabold uppercase text-[10px] tracking-wider text-gray-500">Nenhum cliente cadastrado</p>
              <p className="text-[11px] mt-1 text-gray-400 max-w-xs leading-normal">Não localizamos nenhum cadastro correspondente a sua pesquisa.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
              {filteredClients.map((c) => {
                const name = getClientName(c);
                const isPF = c.type === 'PF';
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      const slugStr = c.slug;
                      if (!slugStr) {
                        alert("Não foi possível abrir o Editor do Portal porque o cliente não possui slug cadastrado.");
                        return;
                      }
                      navigate(`/boss-giffoni-clientes/fluxo-producao/editar-portal-cliente/${slugStr}/Editar-Painel-Geral-do-Cliente`);
                    }}
                    className="w-full text-left p-4 rounded-2xl border border-gray-150 hover:border-blue-500 hover:bg-blue-50/5 text-gray-900 transition-all flex items-start justify-between min-h-[80px] cursor-pointer"
                  >
                    <div className="min-w-0 pr-1 select-none">
                      <span className="text-[9px] font-black uppercase font-mono tracking-wider text-gray-400 block">
                        {isPF ? 'Pessoa Física' : 'Pessoa Jurídica'} ({c.slug || 's/slug'})
                      </span>
                      <h4 className="font-extrabold text-xs tracking-tight truncate mt-1 text-gray-950">
                        {name}
                      </h4>
                      <p className="text-[10px] font-mono mt-1 text-gray-550">
                        {getClientDoc(c)}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 self-center" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </BossLayout>
  );
}
