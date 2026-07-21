// LEGADO — função absorvida pelo Fluxo de Produção e Central de Controle. Não usar como rota ativa.
import React, { useState, useEffect } from 'react';
import { BossLayout } from '../../../components/Layout';
import { collection, addDoc, serverTimestamp, setDoc, doc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, User, Building2, Shield, CreditCard } from 'lucide-react';
import { PFForm } from '../components/forms/PFForm';
import { PJForm } from '../components/forms/PJForm';
import { SocioForm } from '../components/forms/SocioForm';
import { AccessForm } from '../components/forms/AccessForm';
import { BankingForm } from '../components/forms/BankingForm';
import { motion, AnimatePresence } from 'motion/react';

export default function NewClient() {
  const navigate = useNavigate();
  const [type, setType] = useState<'PF' | 'PJ'>('PF');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slug, setSlug] = useState('');
  
  const [pfData, setPfData] = useState<any>({});
  const [pjData, setPjData] = useState<any>({});
  const [socioData, setSocioData] = useState<any>({});
  const [accessData, setAccessData] = useState<any>({
    acesso_statusAcesso: 'pendente'
  });
  const [bankingData, setBankingData] = useState<any>({
    bancario_possuiDadosBancarios: false
  });

  const getClientDisplayName = () => {
    if (type === 'PF') return pfData?.pf_nomeCompleto || '';
    return pjData?.pj_razaoSocial || '';
  };

  const generateSlug = (name: string) => {
    const newSlug = name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setSlug(newSlug);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (!slug) return alert("Slug é obrigatório");
    
    if (!accessData.acesso_emailLogin || !accessData.acesso_senha) {
      return alert("Dados de acesso (E-mail e Senha) são obrigatórios.");
    }
    
    if (accessData.acesso_senha !== accessData.acesso_confirmarSenha) {
      return alert("As senhas não coincidem.");
    }

    setIsSubmitting(true);
    let currentPath = '';
    try {
      // Check if slug is unique
      const slugCheck = await getDocs(query(collection(db, 'clientPortals'), where('slug', '==', slug)));
      if (!slugCheck.empty) {
        setIsSubmitting(false);
        return alert("Este identificador de portal (slug) já está em uso. Por favor, escolha outro.");
      }

      const clientPayload: any = {
        type,
        slug,
        active: accessData.acesso_statusAcesso === 'ativo',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        acessoSistema: {
          acesso_emailLogin: accessData.acesso_emailLogin,
          acesso_statusAcesso: accessData.acesso_statusAcesso,
          acesso_senha: accessData.acesso_senha
        },
        dadosBancariosOpcional: bankingData.bancario_possuiDadosBancarios ? bankingData : { bancario_possuiDadosBancarios: false }
      };

      if (type === 'PF') {
        clientPayload.pfDadosPessoais = {
          pf_nomeCompleto: pfData.pf_nomeCompleto,
          pf_nacionalidade: pfData.pf_nacionalidade,
          pf_estadoCivil: pfData.pf_estadoCivil,
          pf_profissao: pfData.pf_profissao,
          pf_cpf: pfData.pf_cpf,
          pf_rg: pfData.pf_rg,
          pf_dataNascimento: pfData.pf_dataNascimento
        };
        clientPayload.pfContato = {
          pf_email: pfData.pf_email,
          pf_telefone: pfData.pf_telefone,
          pf_possuiWhatsapp: pfData.pf_possuiWhatsapp,
          pf_whatsapp: pfData.pf_whatsapp
        };
        clientPayload.pfEndereco = {
          pf_cep: pfData.pf_cep,
          pf_endereco: pfData.pf_endereco,
          pf_numero: pfData.pf_numero,
          pf_complemento: pfData.pf_complemento,
          pf_bairro: pfData.pf_bairro,
          pf_cidade: pfData.pf_cidade,
          pf_estado: pfData.pf_estado
        };
        clientPayload.pfRedesSociais = {
          pf_instagram: pfData.pf_instagram,
          pf_facebook: pfData.pf_facebook,
          pf_tiktok: pfData.pf_tiktok
        };
      } else {
        clientPayload.pjDadosEmpresa = {
          pj_cnpj: pjData.pj_cnpj,
          pj_razaoSocial: pjData.pj_razaoSocial,
          pj_nomeFantasia: pjData.pj_nomeFantasia,
          pj_inscricaoEstadual: pjData.pj_inscricaoEstadual
        };
        clientPayload.pjContatoEmpresa = {
          pj_emailEmpresa: pjData.pj_emailEmpresa,
          pj_telefoneEmpresa: pjData.pj_telefoneEmpresa,
          pj_possuiWhatsappEmpresa: pjData.pj_possuiWhatsappEmpresa,
          pj_whatsappEmpresa: pjData.pj_whatsappEmpresa
        };
        clientPayload.pjEnderecoEmpresa = {
          pj_cepEmpresa: pjData.pj_cepEmpresa,
          pj_enderecoEmpresa: pjData.pj_enderecoEmpresa,
          pj_numeroEmpresa: pjData.pj_numeroEmpresa,
          pj_complementoEmpresa: pjData.pj_complementoEmpresa,
          pj_bairroEmpresa: pjData.pj_bairroEmpresa,
          pj_cidadeEmpresa: pjData.pj_cidadeEmpresa,
          pj_estadoEmpresa: pjData.pj_estadoEmpresa
        };
        clientPayload.pjRedesSociaisEmpresa = {
          pj_instagramEmpresa: pjData.pj_instagramEmpresa,
          pj_facebookEmpresa: pjData.pj_facebookEmpresa,
          pj_tiktokEmpresa: pjData.pj_tiktokEmpresa
        };
        clientPayload.socioAdministradorDadosPessoais = {
          socio_nomeCompleto: socioData.socio_nomeCompleto,
          socio_nacionalidade: socioData.socio_nacionalidade,
          socio_estadoCivil: socioData.socio_estadoCivil,
          socio_profissao: socioData.socio_profissao,
          socio_cpf: socioData.socio_cpf,
          socio_rg: socioData.socio_rg,
          socio_dataNascimento: socioData.socio_dataNascimento,
          socio_cargo: socioData.socio_cargo
        };
        clientPayload.socioAdministradorContato = {
          socio_email: socioData.socio_email,
          socio_telefone: socioData.socio_telefone,
          socio_possuiWhatsapp: socioData.socio_possuiWhatsapp,
          socio_whatsapp: socioData.socio_whatsapp
        };
        clientPayload.socioAdministradorEndereco = {
          socio_cep: socioData.socio_cep,
          socio_endereco: socioData.socio_endereco,
          socio_numero: socioData.socio_numero,
          socio_complemento: socioData.socio_complemento,
          socio_bairro: socioData.socio_bairro,
          socio_cidade: socioData.socio_cidade,
          socio_estado: socioData.socio_estado
        };
        clientPayload.socioAdministradorRedesSociais = {
          socio_instagram: socioData.socio_instagram,
          socio_facebook: socioData.socio_facebook,
          socio_tiktok: socioData.socio_tiktok
        };
      }

      currentPath = 'clients';
      const clientRef = await addDoc(collection(db, currentPath), clientPayload);
      
      // Update the doc with its own ID as clientId for redundancy
      await updateDoc(doc(db, 'clients', clientRef.id), { clientId: clientRef.id });

      // Create slug mapping
      currentPath = `clientPortals/${slug}`;
      await setDoc(doc(db, 'clientPortals', slug), {
        clientId: clientRef.id,
        slug: slug,
        active: accessData.acesso_statusAcesso === 'ativo',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Prepare user record for the portal login
      currentPath = `users/${clientRef.id}`;
      await setDoc(doc(db, 'users', clientRef.id), {
        email: accessData.acesso_emailLogin,
        role: 'client',
        clientId: clientRef.id,
        clientSlug: slug,
        name: getClientDisplayName(),
        status: accessData.acesso_statusAcesso,
        createdAt: serverTimestamp()
      });

      // Also create an invite/mapping record if needed by existing logic
      currentPath = `users_invites/${clientRef.id}`;
      await setDoc(doc(db, 'users_invites', clientRef.id), {
        email: accessData.acesso_emailLogin,
        role: 'client',
        clientId: clientRef.id
      });

      navigate('/boss-giffoni-clientes/clientes');
    } catch (err) {
      console.error(err);
      if (err && (err as any).code === 'permission-denied') {
        handleFirestoreError(err, OperationType.WRITE, currentPath);
      }
      alert("Falha ao salvar cliente. Verifique permissões ou se o slug é único.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BossLayout>
      <div className="mb-8">
        <button 
          onClick={() => navigate('/boss-giffoni-clientes/clientes')}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-600 mb-4 transition-colors"
        >
          <ArrowLeft size={18} />
          Voltar para Lista
        </button>
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Novo Cadastro Modular</h2>
        <p className="text-gray-500">O BOSS é a fonte única da verdade. Preencha todos os blocos obrigatórios.</p>
      </div>

      <div className="flex gap-4 mb-8">
        <button
          type="button"
          onClick={() => setType('PF')}
          className={`flex-1 p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${
            type === 'PF' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
          }`}
        >
          <User size={32} />
          <span className="font-bold">Pessoa Física</span>
        </button>
        <button
          type="button"
          onClick={() => setType('PJ')}
          className={`flex-1 p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${
            type === 'PJ' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
          }`}
        >
          <Building2 size={32} />
          <span className="font-bold">Pessoa Jurídica</span>
        </button>
      </div>

      <form onSubmit={handleCreateClient} className="space-y-10 pb-20">
        
        {/* BLOCO CONFIGURAÇÃO E ACESSO */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="text-gray-900" size={24} />
              <h3 className="text-lg font-bold text-gray-900">Configuração do Portal & Acesso</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Identificador do Portal (Slug Único)</label>
                <div className="flex gap-2">
                  <input
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="ex: joao-silva"
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-mono text-sm focus:ring-2 focus:ring-gray-100 outline-none"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      const name = getClientDisplayName();
                      if (name) generateSlug(name);
                    }}
                    className="px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                  >
                    Gerar
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-gray-400 font-medium italic">Link final: /portal-cliente-giffoni/{slug || '...'}</p>
              </div>
            </div>

            <AccessForm data={accessData} onChange={setAccessData} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {type === 'PF' ? (
            <motion.div
              key="pf"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <PFForm data={pfData} onChange={setPfData} />
            </motion.div>
          ) : (
            <motion.div
              key="pj"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              <PJForm data={pjData} onChange={setPjData} />
              <SocioForm data={socioData} onChange={setSocioData} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* BLOCO FINANCEIRO/BANCÁRIO */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-4">
             <CreditCard className="text-gray-400" size={20} />
             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Módulo Financeiro</h3>
          </div>
          <BankingForm 
            data={bankingData} 
            onChange={setBankingData} 
            clientName={getClientDisplayName()} 
          />
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 z-40 flex justify-center">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full max-w-4xl h-16 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl ${
              type === 'PF' ? 'bg-blue-600 shadow-blue-200' : 'bg-purple-600 shadow-purple-200'
            } text-white hover:opacity-90 active:scale-95 disabled:opacity-50`}
          >
            {isSubmitting ? 'Gerando Universo do Cliente...' : 'Finalizar Cadastro Master & Liberar Portal'}
            <Check size={20} />
          </button>
        </div>
      </form>
    </BossLayout>
  );
}
