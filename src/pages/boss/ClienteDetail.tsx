// LEGADO — função absorvida pelo Fluxo de Produção e Central de Controle. Não usar como rota ativa.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BossLayout } from '../../components/Layout';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { ArrowLeft, User, Building2, ExternalLink, ShieldAlert, Check, Plus, Briefcase, FileText, Wallet, MessageSquare, ChevronRight, Clock, Calendar, Copy } from 'lucide-react';
import { PFForm } from '../../modules/boss/components/forms/PFForm';
import { PJForm } from '../../modules/boss/components/forms/PJForm';
import { SocioForm } from '../../modules/boss/components/forms/SocioForm';
import { AccessForm } from '../../modules/boss/components/forms/AccessForm';
import { BankingForm } from '../../modules/boss/components/forms/BankingForm';
import { motion } from 'motion/react';

export default function ClienteDetail({ tab: initialTab }: { tab?: string }) {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab || 'cadastro');
  const [client, setClient] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [casesLoading, setCasesLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [copySlugSuccess, setCopySlugSuccess] = useState(false);
  const [copyPathSuccess, setCopyPathSuccess] = useState(false);
  const [copyInstructionSuccess, setCopyInstructionSuccess] = useState(false);
  const [portalSettings, setPortalSettings] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'portal')).then(snap => {
      if (snap.exists()) {
        setPortalSettings(snap.data());
      }
    });
  }, []);

  const handleCopy = async (text: string, type: 'slug' | 'path' | 'instruction') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'slug') {
        setCopySlugSuccess(true);
        setTimeout(() => setCopySlugSuccess(false), 2000);
      } else if (type === 'path') {
        setCopyPathSuccess(true);
        setTimeout(() => setCopyPathSuccess(false), 2000);
      } else {
        setCopyInstructionSuccess(true);
        setTimeout(() => setCopyInstructionSuccess(false), 2000);
      }
    } catch (e) {
      alert(`Conteúdo copiado de forma segura: ${text}`);
    }
  };

  useEffect(() => {
    if (clientId) fetchClient();
  }, [clientId]);

  useEffect(() => {
    if (clientId && activeTab === 'casos') {
      fetchCases();
    }
  }, [clientId, activeTab]);

  async function fetchClient() {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'clients', clientId!));
      if (snap.exists()) {
        const data = snap.data();
        
        // Flatten nested blocks for UI state
        const pfData = data.type === 'PF' ? {
          ...data.pfDadosPessoais,
          ...data.pfContato,
          ...data.pfEndereco,
          ...data.pfRedesSociais
        } : {};

        const pjData = data.type === 'PJ' ? {
          ...data.pjDadosEmpresa,
          ...data.pjContatoEmpresa,
          ...data.pjEnderecoEmpresa,
          ...data.pjRedesSociaisEmpresa
        } : {};

        const socioData = data.type === 'PJ' ? {
          ...data.socioAdministradorDadosPessoais,
          ...data.socioAdministradorContato,
          ...data.socioAdministradorEndereco,
          ...data.socioAdministradorRedesSociais
        } : {};

        setClient({ 
          id: snap.id, 
          ...data,
          pfData,
          pjData,
          socioData,
          accessData: data.acessoSistema || {
            acesso_emailLogin: data.email || '',
            acesso_statusAcesso: data.active ? 'ativo' : 'suspenso'
          },
          bankingData: data.dadosBancariosOpcional || {
            bancario_possuiDadosBancarios: false
          }
        });
      }
      else navigate('/boss-giffoni-clientes/clientes');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function fetchCases() {
    setCasesLoading(true);
    const q = query(
      collection(db, 'cases'), 
      where('clientId', '==', clientId),
      orderBy('updatedAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setCasesLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'cases');
      setCasesLoading(false);
    });

    return unsubscribe;
  }

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      const accessData = client.accessData;
      const pfData = client.pfData || {};
      const pjData = client.pjData || {};
      const socioData = client.socioData || {};
      const bankingData = client.bankingData || { bancario_possuiDadosBancarios: false };
      
      const payload: any = {
        active: accessData?.acesso_statusAcesso === 'ativo',
        updatedAt: new Date(),
        acessoSistema: {
          acesso_emailLogin: accessData.acesso_emailLogin,
          acesso_statusAcesso: accessData.acesso_statusAcesso,
          acesso_senha: accessData.acesso_senha || client.acessoSistema?.acesso_senha
        },
        dadosBancariosOpcional: bankingData
      };

      if (client.type === 'PF') {
        payload.pfDadosPessoais = {
          pf_nomeCompleto: pfData.pf_nomeCompleto,
          pf_nacionalidade: pfData.pf_nacionalidade,
          pf_estadoCivil: pfData.pf_estadoCivil,
          pf_profissao: pfData.pf_profissao,
          pf_cpf: pfData.pf_cpf,
          pf_rg: pfData.pf_rg,
          pf_dataNascimento: pfData.pf_dataNascimento
        };
        payload.pfContato = {
          pf_email: pfData.pf_email,
          pf_telefone: pfData.pf_telefone,
          pf_possuiWhatsapp: pfData.pf_possuiWhatsapp,
          pf_whatsapp: pfData.pf_whatsapp
        };
        payload.pfEndereco = {
          pf_cep: pfData.pf_cep,
          pf_endereco: pfData.pf_endereco,
          pf_numero: pfData.pf_numero,
          pf_complemento: pfData.pf_complemento,
          pf_bairro: pfData.pf_bairro,
          pf_cidade: pfData.pf_cidade,
          pf_estado: pfData.pf_estado
        };
        payload.pfRedesSociais = {
          pf_instagram: pfData.pf_instagram,
          pf_facebook: pfData.pf_facebook,
          pf_tiktok: pfData.pf_tiktok
        };
      } else {
        payload.pjDadosEmpresa = {
          pj_cnpj: pjData.pj_cnpj,
          pj_razaoSocial: pjData.pj_razaoSocial,
          pj_nomeFantasia: pjData.pj_nomeFantasia,
          pj_inscricaoEstadual: pjData.pj_inscricaoEstadual
        };
        payload.pjContatoEmpresa = {
          pj_emailEmpresa: pjData.pj_emailEmpresa,
          pj_telefoneEmpresa: pjData.pj_telefoneEmpresa,
          pj_possuiWhatsappEmpresa: pjData.pj_possuiWhatsappEmpresa,
          pj_whatsappEmpresa: pjData.pj_whatsappEmpresa
        };
        payload.pjEnderecoEmpresa = {
          pj_cepEmpresa: pjData.pj_cepEmpresa,
          pj_enderecoEmpresa: pjData.pj_enderecoEmpresa,
          pj_numeroEmpresa: pjData.pj_numeroEmpresa,
          pj_complementoEmpresa: pjData.pj_complementoEmpresa,
          pj_bairroEmpresa: pjData.pj_bairroEmpresa,
          pj_cidadeEmpresa: pjData.pj_cidadeEmpresa,
          pj_estadoEmpresa: pjData.pj_estadoEmpresa
        };
        payload.pjRedesSociaisEmpresa = {
          pj_instagramEmpresa: pjData.pj_instagramEmpresa,
          pj_facebookEmpresa: pjData.pj_facebookEmpresa,
          pj_tiktokEmpresa: pjData.pj_tiktokEmpresa
        };
        payload.socioAdministradorDadosPessoais = {
          socio_nomeCompleto: socioData.socio_nomeCompleto,
          socio_nacionalidade: socioData.socio_nacionalidade,
          socio_estadoCivil: socioData.socio_estadoCivil,
          socio_profissao: socioData.socio_profissao,
          socio_cpf: socioData.socio_cpf,
          socio_rg: socioData.socio_rg,
          socio_dataNascimento: socioData.socio_dataNascimento,
          socio_cargo: socioData.socio_cargo
        };
        payload.socioAdministradorContato = {
          socio_email: socioData.socio_email,
          socio_telefone: socioData.socio_telefone,
          socio_possuiWhatsapp: socioData.socio_possuiWhatsapp,
          socio_whatsapp: socioData.socio_whatsapp
        };
        payload.socioAdministradorEndereco = {
          socio_cep: socioData.socio_cep,
          socio_endereco: socioData.socio_endereco,
          socio_numero: socioData.socio_numero,
          socio_complemento: socioData.socio_complemento,
          socio_bairro: socioData.socio_bairro,
          socio_cidade: socioData.socio_cidade,
          socio_estado: socioData.socio_estado
        };
        payload.socioAdministradorRedesSociais = {
          socio_instagram: socioData.socio_instagram,
          socio_facebook: socioData.socio_facebook,
          socio_tiktok: socioData.socio_tiktok
        };
      }

      await updateDoc(doc(db, 'clients', clientId!), payload);

      // Mirror state to mapping collection for portal resolving
      await updateDoc(doc(db, 'clientPortals', client.slug), {
        active: payload.active,
        updatedAt: new Date()
      });

      // Update name in user record and status
      await updateDoc(doc(db, 'users', clientId!), {
        email: accessData.acesso_emailLogin,
        name: getClientDisplayName(),
        status: accessData.acesso_statusAcesso
      });

      alert("Cadastro Master atualizado com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar cadastro.");
    } finally {
      setIsSaving(false);
    }
  };

  const getClientDisplayName = () => {
    if (client?.type === 'PF') return client.pfData?.pf_nomeCompleto || client.pfDadosPessoais?.pf_nomeCompleto;
    return client?.pjData?.pj_razaoSocial || client?.pjDadosEmpresa?.pj_razaoSocial;
  };

  const tabs = [
    { id: 'cadastro', label: 'Dados do Cliente', icon: FileText },
    { id: 'casos', label: 'Casos/Processos', icon: Briefcase },
    { id: 'financeiro', label: 'Financeiro', icon: Wallet },
    { id: 'comunicacao', label: 'Comunicação', icon: MessageSquare },
  ];

  if (loading) return (
    <BossLayout>
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 font-bold italic">
        Sincronizando contexto do cliente...
      </div>
    </BossLayout>
  );

  return (
    <BossLayout>
      <div className="mb-8">
        <button 
          onClick={() => navigate('/boss-giffoni-clientes/clientes')}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-600 mb-6 transition-colors font-medium"
        >
          <ArrowLeft size={18} />
          Voltar para Lista Global
        </button>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-2xl ${
              client.type === 'PF' ? 'bg-blue-600 shadow-blue-100' : 'bg-purple-600 shadow-purple-100'
            }`}>
              {client.type === 'PF' ? <User size={40} /> : <Building2 size={40} />}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">{getClientDisplayName()}</h2>
                {client.type === 'PJ' && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded font-black uppercase">Empresa</span>}
              </div>
              <div className="flex items-center gap-3">
                 <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  client.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                }`}>
                  {client.active ? 'Portal Ativo' : 'Acesso Suspenso'}
                </span>
                <code className="text-xs bg-gray-50 px-3 py-1 rounded-xl text-blue-600 font-mono font-bold tracking-tight">
                  slug: {client.slug}
                </code>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2.5 items-center justify-end">
            <button
              onClick={() => {
                const link = portalSettings?.link || 'https://aistudio.google.com/apps/93c62126-a17f-4c18-8bc7-d327df1ca6b5?showPreview=true&showAssistant=true';
                window.open(link, '_blank');
              }}
              className="flex items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-sm text-xs"
            >
              <ExternalLink size={14} />
              <span>Abrir App Externo do Cliente</span>
            </button>

            <button
              onClick={() => handleCopy(client.slug, 'slug')}
              className="flex items-center gap-2 text-gray-700 bg-white border border-gray-200 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-all active:scale-95 text-xs shadow-2xs"
            >
              <Copy size={12} />
              <span>{copySlugSuccess ? 'Slug Copiado!' : 'Copiar Slug'}</span>
            </button>

            <button
              onClick={() => handleCopy(`/portal-cliente-giffoni/${client.slug}/login`, 'path')}
              className="flex items-center gap-2 text-gray-700 bg-white border border-gray-200 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-all active:scale-95 text-xs shadow-2xs"
            >
              <Copy size={12} />
              <span>{copyPathSuccess ? 'Rota Copiada!' : 'Copiar Rota Interna'}</span>
            </button>

            <button
              onClick={() => {
                const base = portalSettings?.link || 'https://aistudio.google.com/apps/93c62126-a17f-4c18-8bc7-d327df1ca6b5?showPreview=true&showAssistant=true';
                const inst = `Portal externo: ${base}\nRota interna: /portal-cliente-giffoni/${client.slug}/login\nCliente: ${getClientDisplayName()}\nSlug: ${client.slug}`;
                handleCopy(inst, 'instruction');
              }}
              className="flex items-center gap-2 text-gray-700 bg-white border border-gray-200 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-all active:scale-95 text-xs shadow-2xs"
            >
              <Copy size={12} />
              <span>{copyInstructionSuccess ? 'Instrução Copiada!' : 'Copiar Instrução de Acesso'}</span>
            </button>

            <button
              onClick={() => navigate(`/boss-giffoni-clientes/portal-cliente-preview/${client.id}`)}
              className="flex items-center gap-2 text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-4 py-2.5 rounded-xl font-semibold transition-all active:scale-95 text-xs"
            >
              <ShieldAlert size={14} />
              <span>Ver Espelho</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-100 mb-10 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                navigate(`/boss-giffoni-clientes/clientes/${clientId}${tab.id === 'cadastro' ? '' : `/${tab.id}`}`, { replace: true });
              }}
              className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all font-bold whitespace-nowrap ${
                isActive 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
              }`}
            >
              <Icon size={18} />
              {tab.label}
              {tab.id === 'casos' && cases.length > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {cases.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="pb-20">
        {activeTab === 'cadastro' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-10">
              
              {/* BLOCO ACESSO */}
              <AccessForm 
                data={client.accessData || {}} 
                onChange={(data) => setClient({ ...client, accessData: data })} 
              />

              {client.type === 'PF' ? (
                <PFForm 
                  data={client.pfData || {}} 
                  onChange={(data) => setClient({ ...client, pfData: data })} 
                />
              ) : (
                <>
                  <PJForm 
                    data={client.pjData || {}} 
                    onChange={(data) => setClient({ ...client, pjData: data })} 
                  />
                  <SocioForm 
                    data={client.socioData || {}} 
                    onChange={(data) => setClient({ ...client, socioData: data })} 
                  />
                </>
              )}

              {/* BLOCO BANCÁRIO */}
              <BankingForm 
                data={client.bankingData || {}} 
                onChange={(data) => setClient({ ...client, bankingData: data })} 
                clientName={getClientDisplayName()}
              />

              <div className="flex justify-end sticky bottom-8 z-10">
                <button
                  onClick={handleUpdate}
                  disabled={isSaving}
                  className="px-12 h-16 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-3 shadow-2xl hover:bg-black active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Dados do Cliente'}
                  {!isSaving && <Check size={20} />}
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-50 pb-4">Ações de Segurança</h4>
                <div className="space-y-4">
                    <button 
                      onClick={() => setClient({ ...client, active: !client.active })}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all font-bold text-sm ${
                        client.active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      <span>{client.active ? 'Suspender Portal' : 'Reativar Portal'}</span>
                      <ShieldAlert size={18} />
                    </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'casos' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-2xl font-black text-gray-900">Gestão de Casos</h3>
                <p className="text-sm text-gray-500">Exclusivamente vinculados a este cliente.</p>
              </div>
              <button 
                onClick={() => navigate(`/boss-giffoni-clientes/clientes/${clientId}/casos/novo`)}
                className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-100"
              >
                <Plus size={20} />
                Novo Caso
              </button>
            </div>

            {casesLoading ? (
              <div className="py-20 text-center text-gray-400 font-bold italic">Buscando casos vinculados...</div>
            ) : cases.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-[2rem] py-24 text-center">
                <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Briefcase size={40} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum caso isolado</h3>
                <p className="text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed">
                  Este cliente ainda não possui processos vinculados na estrutura da Giffoni Connect.
                </p>
                <button 
                  onClick={() => navigate(`/boss-giffoni-clientes/clientes/${clientId}/casos/novo`)}
                  className="inline-flex items-center gap-2 text-blue-600 font-bold hover:underline"
                >
                  <Plus size={18} />
                  Criar primeiro caso agora
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cases.map((c) => (
                  <motion.div
                    key={c.id}
                    layoutId={c.id}
                    onClick={() => navigate(`/boss-giffoni-clientes/clientes/${clientId}/casos/${c.id}`)}
                    className="group bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-12 -mt-12 transition-all group-hover:scale-150 group-hover:bg-blue-100/50" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          c.status === 'ativo' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {c.status}
                        </span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{c.actionType}</span>
                      </div>
                      
                      <h4 className="text-xl font-black text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">{c.title}</h4>
                      <p className="text-xs font-mono text-gray-400 mb-6">{c.processNumber || 'PROCESSO NÃO INFORMADO'}</p>
                      
                      <div className="flex items-center justify-between text-xs pt-4 border-t border-gray-50">
                        <div className="flex items-center gap-3 text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <Clock size={14} className="text-gray-400" />
                            <span>{c.updatedAt?.toDate?.()?.toLocaleDateString() || new Date(c.updatedAt)?.toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'financeiro' && (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-[2rem] py-24 text-center">
            <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Wallet size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Financeiro do Cliente</h3>
            <p className="text-gray-500 max-w-sm mx-auto leading-relaxed">
              Módulo de isolamento financeiro (Honorários, Custas e Repasses) em desenvolvimento.
            </p>
          </div>
        )}

        {activeTab === 'comunicacao' && (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-[2rem] py-24 text-center">
            <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <MessageSquare size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Comunicação e Avisos</h3>
            <p className="text-gray-500 max-w-sm mx-auto leading-relaxed">
              Mensagem isolada e envio de notificações automáticas para este cliente.
            </p>
          </div>
        )}
      </div>
    </BossLayout>
  );
}
