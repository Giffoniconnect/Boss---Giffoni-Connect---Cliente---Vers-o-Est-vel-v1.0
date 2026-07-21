import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BossLayout } from '../../components/Layout';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  Heart,
  ArrowLeft,
  Users,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle,
  UserPlus,
  X,
  Target,
  Award,
  ChevronRight,
  TrendingUp,
  Inbox
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Struct definitions
interface Goal {
  id: string;
  title: string;
  deadline: string;
  priority: 'Alta' | 'Média' | 'Baixa';
  status: 'Pendente' | 'Entregue';
}

interface Collaborator {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  status: 'Ativo' | 'Inativo';
  goals: Goal[];
}

const DEFAULT_COLLABORATORS: Collaborator[] = [
  {
    id: 'collab_1',
    name: 'Dra. Mariana Giffoni',
    role: 'Sócia Fundadora / Jurídica',
    department: 'Jurídico Interno',
    email: 'mariana.giffoni@giffoniadv.com.br',
    phone: '(11) 98822-1100',
    status: 'Ativo',
    goals: [
      { id: 'g1_1', title: 'Revisar petições de recursos extraordinários', deadline: '2026-06-30', priority: 'Alta', status: 'Pendente' },
      { id: 'g1_2', title: 'Treinamento do setor de digitalização de propostas', deadline: '2026-06-15', priority: 'Média', status: 'Entregue' }
    ]
  },
  {
    id: 'collab_2',
    name: 'Dr. Roberto Andrade',
    role: 'Advogado Associado / Cível',
    department: 'Jurídico Interno',
    email: 'roberto.andrade@giffoniadv.com.br',
    phone: '(11) 98234-5678',
    status: 'Ativo',
    goals: [
      { id: 'g2_1', title: 'Audiências conciliatórias semanais', deadline: '2026-06-12', priority: 'Alta', status: 'Entregue' },
      { id: 'g2_2', title: 'Elaboração de parecer de viabilidade tributária', deadline: '2026-06-25', priority: 'Alta', status: 'Pendente' }
    ]
  },
  {
    id: 'collab_3',
    name: 'Bruna Lima',
    role: 'Gerente Comercial',
    department: 'Comercial',
    email: 'bruna.lima@giffoniadv.com.br',
    phone: '(11) 97711-2244',
    status: 'Ativo',
    goals: [
      { id: 'g3_1', title: 'Alcançar meta de 20 novos leads qualificados', deadline: '2026-06-28', priority: 'Alta', status: 'Pendente' },
      { id: 'g3_2', title: 'Análise de conversão do funil de marketing', deadline: '2026-06-14', priority: 'Média', status: 'Entregue' }
    ]
  },
  {
    id: 'collab_4',
    name: 'Felipe Santos',
    role: 'Estagiário de Direito',
    department: 'Operacional',
    email: 'felipe.santos@giffoniadv.com.br',
    phone: '(11) 96155-7799',
    status: 'Ativo',
    goals: [
      { id: 'g4_1', title: 'Digitalização dos novos processos coletivos físicos', deadline: '2026-06-22', priority: 'Alta', status: 'Pendente' },
      { id: 'g4_2', title: 'Protocolar minutas de acordos no tribunal', deadline: '2026-06-10', priority: 'Baixa', status: 'Entregue' }
    ]
  }
];

export default function RhDashboard() {
  const navigate = useNavigate();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selectedCollab, setSelectedCollab] = useState<Collaborator | null>(null);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states (Vertical strictly aligned)
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [isEditingCollab, setIsEditingCollab] = useState(false);
  const [collabForm, setCollabForm] = useState({
    id: '',
    name: '',
    role: '',
    department: 'Jurídico Interno',
    email: '',
    phone: '',
    status: 'Ativo' as 'Ativo' | 'Inativo'
  });

  // Goal Form states (Vertical strictly aligned)
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({
    id: '',
    title: '',
    deadline: '',
    priority: 'Alta' as 'Alta' | 'Média' | 'Baixa',
    status: 'Pendente' as 'Pendente' | 'Entregue'
  });

  // Load and seed collaborators
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const colRef = collection(db, 'rhCollaborators');
        let snap;
        try {
          snap = await getDocs(colRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, 'rhCollaborators');
          throw err;
        }
        
        let loadedList: Collaborator[] = [];
        if (snap.empty) {
          // SEED fallbacks
          for (const collab of DEFAULT_COLLABORATORS) {
            try {
              await setDoc(doc(db, 'rhCollaborators', collab.id), collab);
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, `rhCollaborators/${collab.id}`);
              throw err;
            }
            loadedList.push(collab);
          }
        } else {
          snap.forEach((docSnap) => {
            loadedList.push(docSnap.data() as Collaborator);
          });
        }
        
        // Sorting alphabetically
        loadedList.sort((a, b) => a.name.localeCompare(b.name));
        setCollaborators(loadedList);
        
        if (loadedList.length > 0) {
          setSelectedCollab(loadedList[0]);
        }
      } catch (err) {
        console.error('Error in RhDashboard data load:', err);
        setError('Ocorreu um erro ao carregar os dados dos colaboradores.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Sync back to db helpers
  const saveCollabToFirebase = async (updatedCollab: Collaborator) => {
    try {
      await setDoc(doc(db, 'rhCollaborators', updatedCollab.id), updatedCollab);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `rhCollaborators/${updatedCollab.id}`);
      throw err;
    }
  };

  // Search filter
  const filteredCollabs = collaborators.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const totalActive = collaborators.filter(c => c.status === 'Ativo').length;
  
  // Flatten goals from active collaborators
  const allActiveGoals = collaborators
    .filter(c => c.status === 'Ativo')
    .flatMap(c => c.goals || []);

  const totalPendingGoals = allActiveGoals.filter(g => g.status === 'Pendente').length;
  const totalDeliveredGoals = allActiveGoals.filter(g => g.status === 'Entregue').length;

  // Manage Collaborator Operations
  const handleOpenNewCollab = () => {
    setCollabForm({
      id: 'collab_' + Date.now(),
      name: '',
      role: '',
      department: 'Jurídico Interno',
      email: '',
      phone: '',
      status: 'Ativo'
    });
    setIsEditingCollab(false);
    setIsCollabModalOpen(true);
  };

  const handleOpenEditCollab = (collab: Collaborator) => {
    setCollabForm({
      id: collab.id,
      name: collab.name,
      role: collab.role,
      department: collab.department,
      email: collab.email,
      phone: collab.phone,
      status: collab.status
    });
    setIsEditingCollab(true);
    setIsCollabModalOpen(true);
  };

  const handleSaveCollab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabForm.name.trim() || !collabForm.role.trim()) {
      setError('Por favor, preencha o Nome e o Cargo do colaborador.');
      return;
    }

    try {
      let updatedList = [...collaborators];
      if (isEditingCollab) {
        // Edit
        const targetIndex = updatedList.findIndex(c => c.id === collabForm.id);
        if (targetIndex !== -1) {
          const originalGoals = updatedList[targetIndex].goals || [];
          const updatedCollab: Collaborator = {
            ...updatedList[targetIndex],
            name: collabForm.name,
            role: collabForm.role,
            department: collabForm.department,
            email: collabForm.email,
            phone: collabForm.phone,
            status: collabForm.status,
            goals: originalGoals
          };
          updatedList[targetIndex] = updatedCollab;
          await saveCollabToFirebase(updatedCollab);
          if (selectedCollab?.id === updatedCollab.id) {
            setSelectedCollab(updatedCollab);
          }
          setSuccess('Colaborador atualizado com sucesso!');
        }
      } else {
        // Create
        const newCollab: Collaborator = {
          id: collabForm.id,
          name: collabForm.name,
          role: collabForm.role,
          department: collabForm.department,
          email: collabForm.email,
          phone: collabForm.phone,
          status: collabForm.status,
          goals: []
        };
        updatedList.push(newCollab);
        await saveCollabToFirebase(newCollab);
        setSelectedCollab(newCollab);
        setSuccess('Novo colaborador cadastrado com sucesso!');
      }

      updatedList.sort((a, b) => a.name.localeCompare(b.name));
      setCollaborators(updatedList);
      setIsCollabModalOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError('Falha ao salvar colaborador.');
    }
  };

  const handleDeleteCollab = async (collabId: string) => {
    if (!window.confirm('Tem certeza absoluta de que deseja excluir este colaborador? Esta ação removerá todas as metas cadastradas.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'rhCollaborators', collabId));
      const updatedList = collaborators.filter(c => c.id !== collabId);
      setCollaborators(updatedList);
      if (selectedCollab?.id === collabId) {
        setSelectedCollab(updatedList[0] || null);
      }
      setSuccess('Colaborador removido com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `rhCollaborators/${collabId}`);
      setError('Erro ao remover colaborador do banco.');
    }
  };

  // Manage Goal Operations
  const handleOpenNewGoal = () => {
    setGoalForm({
      id: 'goal_' + Date.now(),
      title: '',
      deadline: '',
      priority: 'Alta',
      status: 'Pendente'
    });
    setIsEditingGoal(false);
    setIsGoalModalOpen(true);
  };

  const handleOpenEditGoal = (goal: Goal) => {
    setGoalForm({
      id: goal.id,
      title: goal.title,
      deadline: goal.deadline,
      priority: goal.priority,
      status: goal.status
    });
    setIsEditingGoal(true);
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollab) return;
    if (!goalForm.title.trim()) {
      setError('Escreva o título ou descrição da meta.');
      return;
    }

    try {
      const currentGoals = selectedCollab.goals ? [...selectedCollab.goals] : [];
      if (isEditingGoal) {
        const idx = currentGoals.findIndex(g => g.id === goalForm.id);
        if (idx !== -1) {
          currentGoals[idx] = {
            id: goalForm.id,
            title: goalForm.title,
            deadline: goalForm.deadline,
            priority: goalForm.priority,
            status: goalForm.status
          };
        }
      } else {
        currentGoals.push({
          id: goalForm.id,
          title: goalForm.title,
          deadline: goalForm.deadline,
          priority: goalForm.priority,
          status: goalForm.status
        });
      }

      const updatedCollab: Collaborator = {
        ...selectedCollab,
        goals: currentGoals
      };

      await saveCollabToFirebase(updatedCollab);
      
      const collabIdx = collaborators.findIndex(c => c.id === selectedCollab.id);
      if (collabIdx !== -1) {
        const newList = [...collaborators];
        newList[collabIdx] = updatedCollab;
        setCollaborators(newList);
      }
      setSelectedCollab(updatedCollab);
      
      setIsGoalModalOpen(false);
      setSuccess('Meta processada com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar meta do colaborador.');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!selectedCollab) return;
    if (!window.confirm('Excluir esta meta?')) return;

    try {
      const filteredGoals = (selectedCollab.goals || []).filter(g => g.id !== goalId);
      const updatedCollab: Collaborator = {
        ...selectedCollab,
        goals: filteredGoals
      };

      await saveCollabToFirebase(updatedCollab);

      const collabIdx = collaborators.findIndex(c => c.id === selectedCollab.id);
      if (collabIdx !== -1) {
        const newList = [...collaborators];
        newList[collabIdx] = updatedCollab;
        setCollaborators(newList);
      }
      setSelectedCollab(updatedCollab);
      setSuccess('Meta excluída com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar alteração no banco.');
    }
  };

  const toggleGoalStatus = async (collab: Collaborator, goal: Goal) => {
    try {
      const updatedGoals = collab.goals.map(g => {
        if (g.id === goal.id) {
          return {
            ...g,
            status: g.status === 'Pendente' ? 'Entregue' as const : 'Pendente' as const
          };
        }
        return g;
      });

      const updatedCollab: Collaborator = {
        ...collab,
        goals: updatedGoals
      };

      await saveCollabToFirebase(updatedCollab);

      const idx = collaborators.findIndex(c => c.id === collab.id);
      if (idx !== -1) {
        const newList = [...collaborators];
        newList[idx] = updatedCollab;
        setCollaborators(newList);
      }
      if (selectedCollab?.id === collab.id) {
        setSelectedCollab(updatedCollab);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <BossLayout>
      <div className="max-w-7xl mx-auto font-sans text-left pb-16 space-y-8 animate-fade-in">
        
        {/* HEADER AREA */}
        <div className="border-b border-gray-150 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Heart size={22} className="fill-rose-100" />
              </span>
              <span>Coordenação do Portal do Colaborador (RH)</span>
            </h1>
            <p className="text-gray-500 text-sm">
              Visão fática, atribuição de metas e refinamento estratégico dos colaboradores e parceiros da Giffoni Advogados Associados.
            </p>
          </div>
          
          <div className="shrink-0">
            <button
              onClick={() => navigate('/boss-giffoni-clientes/setores')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-rose-250 hover:bg-rose-50 text-rose-700 font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-4xs"
            >
              <ArrowLeft size={14} />
              <span>Voltar para Setores</span>
            </button>
          </div>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="bg-rose-50 border border-rose-150 text-rose-850 p-4 rounded-2xl flex items-center gap-3">
            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-150 text-emerald-850 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <p className="text-xs font-semibold">{success}</p>
          </div>
        )}

        {/* METRICS DIVISION */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-150 rounded-[1.5rem] p-5 shadow-3xs flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Colaboradores Ativos</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-rose-700">{totalActive}</span>
              <span className="text-xs text-gray-400 font-black font-mono">/ {collaborators.length}</span>
            </div>
            <div className="text-[10px] text-gray-500 font-bold mt-3 border-t border-gray-50 pt-2 flex items-center gap-1">
              <Users size={12} className="text-rose-500" />
              <span>Profissionais vinculados</span>
            </div>
          </div>

          <div className="bg-white border border-gray-150 rounded-[1.5rem] p-5 shadow-3xs flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Metas Pendentes</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-amber-600 font-mono">{totalPendingGoals}</span>
              <span className="text-xs text-gray-400 font-semibold font-sans">em andamento</span>
            </div>
            <div className="text-[10px] text-gray-550 font-bold mt-3 border-t border-gray-50 pt-2 flex items-center gap-1">
              <Clock size={12} className="text-amber-500 animate-pulse" />
              <span>Necessitando validação</span>
            </div>
          </div>

          <div className="bg-white border border-gray-150 rounded-[1.5rem] p-5 shadow-3xs flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Metas Entregues</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-emerald-600 font-mono">{totalDeliveredGoals}</span>
              <span className="text-xs text-gray-400 font-semibold font-sans font-mono">concluídas</span>
            </div>
            <div className="text-[10px] text-gray-500 font-bold mt-3 border-t border-gray-50 pt-2 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span>Eficiência organizacional</span>
            </div>
          </div>

          <div className="bg-rose-50 border border-rose-100 rounded-[1.5rem] p-5 shadow-3xs flex flex-col justify-between">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-widest block mb-2">Volume Geral Metas</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-rose-900 font-mono">{allActiveGoals.length}</span>
              <span className="text-xs text-rose-600 font-bold font-sans">definidas</span>
            </div>
            <div className="text-[10px] text-rose-700 font-bold mt-3 border-t border-rose-150 pt-2 flex items-center gap-1">
              <TrendingUp size={12} className="text-rose-600" />
              <span>{allActiveGoals.length > 0 ? Math.round((totalDeliveredGoals / allActiveGoals.length) * 100) : 0}% taxa de conclusão</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20 text-gray-400">
            <div className="w-10 h-10 border-4 border-slate-100 border-t-rose-600 rounded-full animate-spin"></div>
            <span className="text-xs font-black uppercase tracking-widest">Sincronizando setor de RH...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* COLLABORATOR LIST SIDEBAR (5 rows) */}
            <div className="lg:col-span-5 bg-white border border-gray-150 rounded-[2rem] p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar colaborador..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white transition"
                  />
                </div>
                
                <button
                  onClick={handleOpenNewCollab}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-4xs"
                >
                  <UserPlus size={13} />
                  <span>Novo</span>
                </button>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredCollabs.map((collab) => {
                  const isSelected = selectedCollab?.id === collab.id;
                  const collabActiveGoals = collab.goals || [];
                  const collabDelivered = collabActiveGoals.filter(g => g.status === 'Entregue').length;
                  const progress = collabActiveGoals.length > 0 
                    ? Math.round((collabDelivered / collabActiveGoals.length) * 100) 
                    : 0;

                  return (
                    <div
                      key={collab.id}
                      onClick={() => setSelectedCollab(collab)}
                      className={`p-4 rounded-2xl border transition cursor-pointer text-left flex items-center justify-between ${
                        isSelected 
                          ? 'border-rose-450 bg-rose-50/50 shadow-xs' 
                          : 'border-gray-100 hover:bg-gray-50/50 hover:border-gray-250 bg-white'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-gray-900 truncate">
                            {collab.name}
                          </h4>
                          <span className={`text-[8px] font-black font-mono leading-none px-1.5 py-0.5 rounded ${
                            collab.status === 'Ativo' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {collab.status.toUpperCase()}
                          </span>
                        </div>

                        <p className="text-xs text-gray-500 font-semibold truncate">
                          {collab.role}
                        </p>

                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                          <span className="bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded font-medium">
                            {collab.department}
                          </span>
                          <span className="font-mono">
                            {collabDelivered}/{collabActiveGoals.length} Metas
                          </span>
                        </div>

                        {collabActiveGoals.length > 0 && (
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-2">
                            <div 
                              className="bg-rose-500 h-full rounded-full transition-all duration-300" 
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>

                      <ChevronRight size={16} className={isSelected ? 'text-rose-600' : 'text-gray-300'} />
                    </div>
                  );
                })}

                {filteredCollabs.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Inbox size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-xs font-semibold">Nenhum colaborador encontrado.</p>
                  </div>
                )}
              </div>
            </div>

            {/* COLLABORATOR DETAILS & GOAL PANEL (7 rows) */}
            <div className="lg:col-span-7 bg-white border border-gray-150 rounded-[2rem] p-6 shadow-sm min-h-[500px]">
              {selectedCollab ? (
                <div className="space-y-7">
                  
                  {/* General Identification card */}
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-widest font-black text-rose-600 block">Identificação de Cadastro</span>
                        <span className={`text-[8px] font-black border text-center uppercase tracking-wider px-1 inline-block ${selectedCollab.status === 'Ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-300'}`}>{selectedCollab.status}</span>
                      </div>
                      <h3 className="text-xl font-extrabold text-gray-950 uppercase tracking-tight">{selectedCollab.name}</h3>
                      <p className="text-xs text-gray-600 font-bold">{selectedCollab.role} • <span className="text-rose-700">{selectedCollab.department}</span></p>
                      
                      <div className="pt-2 text-[11px] text-gray-500 font-semibold space-y-0.5">
                        <p>E-mail: <span className="font-mono text-gray-700">{selectedCollab.email || 'Não informado'}</span></p>
                        <p>Telefone: <span className="font-mono text-gray-700">{selectedCollab.phone || 'Não informado'}</span></p>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenEditCollab(selectedCollab)}
                        className="p-2 bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-300 text-gray-700 hover:text-rose-700 rounded-xl transition cursor-pointer"
                        title="Editar Informações Cadastrais"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteCollab(selectedCollab.id)}
                        className="p-2 bg-white hover:bg-rose-100 border border-gray-200 hover:border-rose-450 text-gray-400 hover:text-rose-800 rounded-xl transition cursor-pointer"
                        title="Remover do Escritório"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Metas Division */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Target size={16} className="text-rose-600" />
                        <h4 className="font-extrabold text-sm text-gray-900">Metas &amp; Resultados Esperados</h4>
                      </div>
                      
                      <button
                        onClick={handleOpenNewGoal}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-150 text-rose-700 rounded-xl text-[11px] font-black tracking-wider uppercase transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>Nova Meta</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(selectedCollab.goals || []).map((goal) => {
                        const isEntregue = goal.status === 'Entregue';

                        return (
                          <div 
                            key={goal.id} 
                            className={`p-4 rounded-xl border flex items-start justify-between gap-4 transition ${
                              isEntregue 
                                ? 'bg-emerald-50/20 border-emerald-100' 
                                : 'bg-white border-gray-100 hover:border-gray-200'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Action toggle checkbox */}
                              <button
                                onClick={() => toggleGoalStatus(selectedCollab, goal)}
                                className={`mt-0.5 rounded-md border flex items-center justify-center shrink-0 w-5 h-5 transition cursor-pointer ${
                                  isEntregue 
                                    ? 'bg-emerald-600 border-emerald-600 text-white' 
                                    : 'bg-white border-gray-300 hover:border-rose-500'
                                }`}
                              >
                                {isEntregue && <CheckCircle2 size={12} />}
                              </button>

                              <div className="space-y-1">
                                <p className={`text-xs font-semibold leading-relaxed ${
                                  isEntregue ? 'line-through text-gray-400' : 'text-gray-800'
                                }`}>
                                  {goal.title}
                                </p>
                                
                                <div className="flex gap-2.5 items-center text-[10px] text-gray-400 font-bold flex-wrap">
                                  {goal.deadline && (
                                    <span className="flex items-center gap-0.5 font-mono">
                                      Prazo: {goal.deadline}
                                    </span>
                                  )}
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black capitalize ${
                                    goal.priority === 'Alta' ? 'bg-rose-50 text-rose-700' :
                                    goal.priority === 'Média' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    Prioridade: {goal.priority}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => handleOpenEditGoal(goal)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded"
                                title="Editar"
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteGoal(goal.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-700 hover:bg-rose-50 rounded"
                                title="Excluir"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {(selectedCollab.goals || []).length === 0 && (
                        <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-xl text-gray-450 italic text-xs font-medium">
                          Nenhuma meta pendente ou entregue registrada para este colaborador.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-300 italic text-sm">
                  Selecione um profissional na lista para gerenciar metas e detalhes.
                </div>
              )}
            </div>

          </div>
        )}

        {/* COMPREHENSIVE MODALS (STRICT VERTICAL ALIGNMENT MANDATORY) */}

        {/* COLLABORATOR PANEL MODAL */}
        <AnimatePresence>
          {isCollabModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-[2rem] border border-gray-150 p-6 w-full max-w-md shadow-2xl space-y-6 text-left"
              >
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-extrabold text-gray-900 text-base">
                    {isEditingCollab ? 'Editar Dados do Colaborador' : 'Adicionar Colaborador'}
                  </h3>
                  <button 
                    onClick={() => setIsCollabModalOpen(false)}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSaveCollab} className="space-y-4 font-sans text-xs font-semibold">
                  
                  {/* Strict Vertical Stack Form Layout */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Nome Completo</label>
                    <input
                      type="text"
                      value={collabForm.name}
                      onChange={(e) => setCollabForm({ ...collabForm, name: e.target.value })}
                      placeholder="Ex: Dra. Juliana Montenegro"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white transition"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Cargo / Função</label>
                    <input
                      type="text"
                      value={collabForm.role}
                      onChange={(e) => setCollabForm({ ...collabForm, role: e.target.value })}
                      placeholder="Ex: Advogada Trabalhista Pleno"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white transition"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Setor Principal</label>
                    <select
                      value={collabForm.department}
                      onChange={(e) => setCollabForm({ ...collabForm, department: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white transition"
                    >
                      <option value="Jurídico Interno">Jurídico Interno</option>
                      <option value="Comercial">Comercial</option>
                      <option value="Financeiro">Financeiro</option>
                      <option value="Operacional">Operacional</option>
                      <option value="Estratégico">Estratégico</option>
                      <option value="Marketing">Marketing</option>
                      <option value="CRM">CRM</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">E-mail Institucional</label>
                    <input
                      type="email"
                      value={collabForm.email}
                      onChange={(e) => setCollabForm({ ...collabForm, email: e.target.value })}
                      placeholder="juliana.montenegro@giffoniadv.com.br"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={collabForm.phone}
                      onChange={(e) => setCollabForm({ ...collabForm, phone: e.target.value })}
                      placeholder="(11) 99999-1234"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Status Contratual</label>
                    <select
                      value={collabForm.status}
                      onChange={(e) => setCollabForm({ ...collabForm, status: e.target.value as 'Ativo' | 'Inativo' })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white transition"
                    >
                      <option value="Ativo">Ativo (Em Produção)</option>
                      <option value="Inativo">Inativo (Desvinculado)</option>
                    </select>
                  </div>

                  <div className="pt-4 border-t border-gray-50 flex items-center justify-end gap-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => setIsCollabModalOpen(false)}
                      className="px-4 py-2 text-gray-400 hover:text-gray-900 text-xs uppercase"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                    >
                      Salvar Cadastro
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* METAS/GOAL PANEL MODAL */}
        <AnimatePresence>
          {isGoalModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-[2rem] border border-gray-150 p-6 w-full max-w-md shadow-2xl space-y-6 text-left"
              >
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-extrabold text-gray-900 text-base">
                    {isEditingGoal ? 'Editar Meta' : 'Vincular Nova Meta'}
                  </h3>
                  <button 
                    onClick={() => setIsGoalModalOpen(false)}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSaveGoal} className="space-y-4 font-sans text-xs font-semibold">
                  
                  {/* Strict Vertical Stack Form Layout */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Descrição da Meta ou Escopo</label>
                    <textarea
                      rows={3}
                      value={goalForm.title}
                      onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                      placeholder="Ex: Entregar auditoria fática das procurações do Portal de Clientes..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white transition resize-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Data Limite de Entrega</label>
                    <input
                      type="date"
                      value={goalForm.deadline}
                      onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Prioridade</label>
                    <select
                      value={goalForm.priority}
                      onChange={(e) => setGoalForm({ ...goalForm, priority: e.target.value as 'Alta' | 'Média' | 'Baixa' })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white transition"
                    >
                      <option value="Alta">Alta</option>
                      <option value="Média">Média</option>
                      <option value="Baixa">Baixa</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Status Fático da Entrega</label>
                    <select
                      value={goalForm.status}
                      onChange={(e) => setGoalForm({ ...goalForm, status: e.target.value as 'Pendente' | 'Entregue' })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white transition"
                    >
                      <option value="Pendente">Pendente / Em Processamento</option>
                      <option value="Entregue">Entregue / Concluído</option>
                    </select>
                  </div>

                  <div className="pt-4 border-t border-gray-50 flex items-center justify-end gap-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => setIsGoalModalOpen(false)}
                      className="px-4 py-2 text-gray-400 hover:text-gray-900 text-xs uppercase"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                    >
                      Salvar Meta
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </BossLayout>
  );
}
