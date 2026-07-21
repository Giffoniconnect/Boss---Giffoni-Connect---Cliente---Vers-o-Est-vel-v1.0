import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BossLayout } from '../../components/Layout';
import { 
  ArrowLeft, User, Building2, Briefcase, FileQuestion, CheckSquare, 
  DollarSign, Calendar, ExternalLink, AlertTriangle, CheckCircle2, ShieldCheck, Copy
} from 'lucide-react';
import { getClientInternalPath, getClientExternalPortalBase } from './fluxo-producao/utils/clientPortalLinks';

export default function PortalClientePreview() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [infoRequests, setInfoRequests] = useState<any[]>([]);
  const [evidenceRequests, setEvidenceRequests] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [portalSettings, setPortalSettings] = useState<any>(null);

  const [copySlugSuccess, setCopySlugSuccess] = useState(false);
  const [copyPathSuccess, setCopyPathSuccess] = useState(false);

  useEffect(() => {
    if (!clientId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // 1. Client
        const clientSnap = await getDoc(doc(db, 'clients', clientId));
        if (clientSnap.exists()) {
          setClient({ id: clientSnap.id, ...clientSnap.data() });
        } else {
          alert('Cliente não encontrado.');
          navigate('/boss-giffoni-clientes/clientes');
          return;
        }

        // 2. Cases
        const casesSnap = await getDocs(
          query(collection(db, 'cases'), where('clientId', '==', clientId))
        );
        const casesList = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCases(casesList);

        const caseIds = casesList.map(c => c.id);

        // 3. Information Requests
        if (caseIds.length > 0) {
          const infoSnap = await getDocs(
            query(collection(db, 'caseInformationRequests'), where('caseId', 'in', caseIds))
          );
          setInfoRequests(infoSnap.docs.map(d => ({ id: d.id, ...d.data() })));

          // 4. Evidence Requests
          const evidenceSnap = await getDocs(
            query(collection(db, 'caseEvidenceRequests'), where('caseId', 'in', caseIds))
          );
          setEvidenceRequests(evidenceSnap.docs.map(d => ({ id: d.id, ...d.data() })));

          // 5. Financials
          const financialsSnap = await getDocs(
            query(collection(db, 'caseFinancials'), where('caseId', 'in', caseIds))
          );
          setFinancials(financialsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          // Try loading client-level financials
          const financialsSnap = await getDocs(
            query(collection(db, 'caseFinancials'), where('clientId', '==', clientId))
          );
          setFinancials(financialsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }

        // 6. Portal Settings
        const portalSnap = await getDoc(doc(db, 'settings', 'portal'));
        if (portalSnap.exists()) {
          setPortalSettings(portalSnap.data());
        }

      } catch (err) {
        console.error('Error fetching preview data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clientId]);

  const copyToClipboard = async (text: string, type: 'slug' | 'path') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'slug') {
        setCopySlugSuccess(true);
        setTimeout(() => setCopySlugSuccess(false), 2000);
      } else {
        setCopyPathSuccess(true);
        setTimeout(() => setCopyPathSuccess(false), 2000);
      }
    } catch (e) {
      alert(`Conteúdo copiado: ${text}`);
    }
  };

  if (loading) {
    return (
      <BossLayout>
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3 font-mono">
          <div className="w-8 h-8 border-4 border-gray-100 border-t-purple-600 rounded-full animate-spin"></div>
          <span className="text-xs uppercase tracking-wider font-bold">Compilando Espelho Público de Dados...</span>
        </div>
      </BossLayout>
    );
  }

  const clientName = client?.type === 'PF'
    ? (client.pfDadosPessoais?.pf_nomeCompleto || client.pfData?.pf_nomeCompleto || 'Sem Nome')
    : (client.pjDadosEmpresa?.pj_razaoSocial || client.pjData?.pj_razaoSocial || 'Sem Razão Social');

  const slug = client?.slug || 'sem-slug';
  const externalBaseUrl = getClientExternalPortalBase(portalSettings);
  const internalRoute = getClientInternalPath(slug);

  // Filter public items (visible to client)
  const publicCases = cases.filter(c => c.visibleToClient === true);
  const publicInfoRequests = infoRequests.filter(r => r.visibleToClient === true);
  const publicEvidenceRequests = evidenceRequests.filter(r => r.visibleToClient === true);
  const publicFinancials = financials.filter(f => f.visibleToClient === true);

  return (
    <BossLayout>
      <div className="space-y-6 font-sans">
        
        {/* Navigation */}
        <button
          onClick={() => navigate(`/boss-giffoni-clientes/clientes/${clientId}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-650 transition-colors font-medium text-sm"
        >
          <ArrowLeft size={16} />
          <span>Voltar para Detalhes do Cliente</span>
        </button>

        {/* Warning Notice Banner */}
        <div className="p-5 bg-purple-50 border border-purple-100 rounded-[2rem] text-purple-950 flex flex-col sm:flex-row items-start gap-4">
          <AlertTriangle size={24} className="text-purple-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-extrabold text-sm tracking-tight text-purple-900">Atenção: Monitor de Espelhamento de Dados</h4>
            <p className="text-xs text-purple-850 leading-relaxed font-semibold">
              Esta tela é apenas um preview interno do BOSS sobre dados públicos. O Portal do Cliente real é acessado na aplicação externa configurada.
            </p>
          </div>
        </div>

        {/* Header profiles and paths */}
        <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-lg ${
              client?.type === 'PF' ? 'bg-blue-600 shadow-blue-100' : 'bg-purple-600 shadow-purple-100'
            }`}>
              {client?.type === 'PF' ? <User size={30} /> : <Building2 size={30} />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-none mb-1.5">{clientName}</h2>
              <div className="flex items-center gap-2.5 text-xs text-gray-400 font-semibold font-mono">
                <span>ID: {client?.clientId || client?.id}</span>
                <span>•</span>
                <span className="text-indigo-600">slug: /{slug}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => copyToClipboard(slug, 'slug')}
              className="py-2.5 px-4 bg-gray-50 border border-gray-150 rounded-xl text-xs font-bold text-gray-700 flex items-center justify-between gap-3 cursor-pointer"
            >
              <span>Slug: <strong className="font-mono text-indigo-600">{slug}</strong></span>
              <span className="text-[10px] text-indigo-500 font-black">{copySlugSuccess ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              onClick={() => copyToClipboard(internalRoute, 'path')}
              className="py-2.5 px-4 bg-gray-50 border border-gray-150 rounded-xl text-xs font-bold text-gray-700 flex items-center justify-between gap-3 cursor-pointer"
            >
              <span className="truncate">Rota: <strong className="font-mono text-gray-400">{internalRoute}</strong></span>
              <span className="text-[10px] text-indigo-500 font-black shrink-0">{copyPathSuccess ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <a
              href={externalBaseUrl}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm text-center"
            >
              <ExternalLink size={14} />
              <span>Testar Acesso Real</span>
            </a>
          </div>
        </div>

        {/* Bento Grid layout of mirror state */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Active cases mirroring */}
          <div className="bg-white border border-gray-100 rounded-[2rem] p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3 mb-1">
              <Briefcase size={18} className="text-blue-500" />
              <h3 className="font-bold text-gray-900 text-sm">Casos Ativos de Visibilidade Pública ({publicCases.length})</h3>
            </div>
            
            {publicCases.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nenhum caso configurado como "Visível no Portal" para este cliente.</p>
            ) : (
              <div className="space-y-3">
                {publicCases.map((c) => (
                  <div key={c.id} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-extrabold text-xs text-gray-800">{c.title}</h4>
                      <p className="text-[10px] text-gray-400 font-medium font-mono leading-relaxed mt-0.5">Pasta: {c.id}</p>
                    </div>
                    <span className="px-3 py-1 bg-amber-50 rounded-full text-[9px] font-black text-amber-700 border border-amber-100 uppercase tracking-wider">
                      Status Público: {c.statusPublicoCliente || 'Aguardando inicialização'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Public communications requests */}
          <div className="bg-white border border-gray-100 rounded-[2rem] p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3 mb-1">
              <FileQuestion size={18} className="text-cyan-500" />
              <h3 className="font-bold text-gray-900 text-sm">Solicitações de Informações Públicas ({publicInfoRequests.length})</h3>
            </div>

            {publicInfoRequests.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nenhuma solicitação de informação textual liberada para o portal do cliente.</p>
            ) : (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto scrollbar-thin">
                {publicInfoRequests.map((r) => (
                  <div key={r.id} className="p-3 bg-gray-55/40 border border-gray-100 rounded-xl text-xs flex justify-between items-center gap-3">
                    <span className="font-bold text-gray-700 truncate">{r.title}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase text-center ${
                      r.status === 'respondiso' || r.status === 'respondido' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {r.status || 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evidence public requested documents */}
          <div className="bg-white border border-gray-100 rounded-[2rem] p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3 mb-1">
              <CheckSquare size={18} className="text-emerald-500" />
              <h3 className="font-bold text-gray-900 text-sm">Solicitações de Provas/Documentos Públicos ({publicEvidenceRequests.length})</h3>
            </div>

            {publicEvidenceRequests.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nenhuma solicitação de prova liberada para o portal de clientes externo.</p>
            ) : (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto scrollbar-thin">
                {publicEvidenceRequests.map((r) => (
                  <div key={r.id} className="p-3 bg-gray-55/40 border border-gray-100 rounded-xl text-xs flex justify-between items-center gap-3">
                    <span className="font-bold text-gray-700 truncate">{r.title}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase text-center ${
                      r.status === 'enviado' || r.status === 'aceito' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {r.status || 'Aguardando Upload'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Public financials records */}
          <div className="bg-white border border-gray-100 rounded-[2rem] p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3 mb-1">
              <DollarSign size={18} className="text-indigo-500" />
              <h3 className="font-bold text-gray-900 text-sm">Faturamento e Cobranças Visíveis ({publicFinancials.length})</h3>
            </div>

            {publicFinancials.length === 0 ? (
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs text-gray-500 leading-relaxed font-semibold">
                Este recurso está sendo atualizado ou revisado formalmente pelo BOSS.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto scrollbar-thin">
                {publicFinancials.map((f) => (
                  <div key={f.id} className="p-3 bg-gray-55/40 border border-gray-100 rounded-xl text-xs flex justify-between items-center gap-3">
                    <div>
                      <span className="font-bold text-gray-800 block">{f.description || 'Contrato Jurídico'}</span>
                      <span className="text-[10px] text-gray-400 font-mono mt-0.5 block">Vencimento: {f.dueDate || 'À combinar'}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-blue-600 font-mono block">R$ {Number(f.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[8-px] font-black uppercase tracking-wider ${
                        f.paymentStatus === 'pago' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {f.paymentStatus || 'Aberto'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </BossLayout>
  );
}
