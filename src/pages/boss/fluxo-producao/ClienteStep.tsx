import React, { useState, useEffect } from 'react';
import { collection, getDocs, setDoc, query, where, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  User, 
  Building2, 
  Search, 
  AlertTriangle, 
  ShieldCheck, 
  Lock, 
  ExternalLink,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { PFForm } from '../../../modules/boss/components/forms/PFForm';
import { PJForm } from '../../../modules/boss/components/forms/PJForm';
import { SocioForm } from '../../../modules/boss/components/forms/SocioForm';
import { AccessForm } from '../../../modules/boss/components/forms/AccessForm';
import { BankingForm } from '../../../modules/boss/components/forms/BankingForm';

interface ClienteStepProps {
  onNext: (clientId: string, slug: string) => void;
  onSetLoading: (loading: boolean) => void;
  onAlert: (msg: string) => void;
  initialClientId?: string | null;
}

export default function ClienteStep({ onNext, onSetLoading, onAlert, initialClientId }: ClienteStepProps) {
  const [clientType, setClientType] = useState<'PF' | 'PJ'>('PF');
  const [slug, setSlug] = useState('');
  const [isSlugLocked, setIsSlugLocked] = useState(false);

  // Form states
  const [pfData, setPfData] = useState<any>({});
  const [pjData, setPjData] = useState<any>({});
  const [socioData, setSocioData] = useState<any>({});
  const [accessData, setAccessData] = useState<any>({
    acesso_statusAcesso: 'ativo',
    acesso_emailLogin: '',
    acesso_senha: '',
    acesso_confirmarSenha: ''
  });
  const [bankingData, setBankingData] = useState<any>({ bancario_possuiDadosBancarios: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Duplication management state
  const [duplicateClients, setDuplicateClients] = useState<any[]>([]);
  const [cpfCnpjBlocked, setCpfCnpjBlocked] = useState(false);
  const [blockErrorMessage, setBlockErrorMessage] = useState('');

  // Fetch client if we've already selected one
  useEffect(() => {
    if (initialClientId) {
      async function loadClient() {
        onSetLoading(true);
        try {
          const clientDoc = await getDocs(query(collection(db, 'clients'), where('clientId', '==', initialClientId)));
          if (!clientDoc.empty) {
            const data = clientDoc.docs[0].data();
            setClientType(data.type || 'PF');
            setSlug(data.slug || '');
            setIsSlugLocked(true);
            if (data.type === 'PF') {
              setPfData(data.pfDadosPessoais || data.pfData || {});
            } else {
              setPjData(data.pjDadosEmpresa || data.pjData || {});
              setSocioData(data.socioAdministradorDadosPessoais || data.socioData || {});
            }
            if (data.acessoSistema) {
              setAccessData({
                acesso_statusAcesso: data.acessoSistema.acesso_statusAcesso || 'ativo',
                acesso_emailLogin: data.acessoSistema.acesso_emailLogin || '',
                acesso_senha: data.acessoSistema.acesso_senha || '',
                acesso_confirmarSenha: data.acessoSistema.acesso_senha || ''
              });
            }
            if (data.dadosBancariosOpcional) {
              setBankingData(data.dadosBancariosOpcional);
            }
          }
        } catch (err) {
          console.error(err);
        } finally {
          onSetLoading(false);
        }
      }
      loadClient();
    }
  }, [initialClientId]);

  // Dynamic slug generator
  const generateHashedSlug = (name: string) => {
    if (isSlugLocked) return;
    const cleanName = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .split('-')
      .slice(0, 3)
      .join('-');
    const shortHash = Math.random().toString(36).substring(2, 8);
    const suffix = clientType === 'PF' ? 'pf' : 'pj';
    setSlug(`${cleanName}-${suffix}-${shortHash}`);
  };

  // Duplicate Check logic
  const checkDuplicity = async () => {
    const termCpf = clientType === 'PF' ? (pfData.pf_cpf || '') : '';
    const termCnpj = clientType === 'PJ' ? (pjData.pj_cnpj || '') : '';
    const termName = clientType === 'PF' ? (pfData.pf_nomeCompleto || '') : (pjData.pj_razaoSocial || '');
    const termEmail = clientType === 'PF' ? (pfData.pf_email || '') : (pjData.pj_emailEmpresa || '');
    const termPhone = clientType === 'PF' ? (pfData.pf_telefone || '') : (pjData.pj_telefoneEmpresa || '');
    const termWhatsapp = clientType === 'PF' ? (pfData.pf_whatsapp || '') : (pjData.pj_whatsappEmpresa || '');

    if (!termCpf && !termCnpj && !termName && !termEmail && !termPhone && !termWhatsapp) {
      onAlert('Preencha ao menos um campo para validar duplicidades.');
      return;
    }

    onSetLoading(true);
    setCpfCnpjBlocked(false);
    setBlockErrorMessage('');
    setDuplicateClients([]);

    try {
      const q = collection(db, 'clients');
      const snap = await getDocs(q);
      const found: any[] = [];
      let strictlyBlocked = false;

      snap.forEach(docSnap => {
        const d = docSnap.data();
        let hit = false;
        let pId = docSnap.id;

        // Checking fields
        if (clientType === 'PF' && termCpf) {
          const checkCpf = d.pfDadosPessoais?.pf_cpf || d.pfData?.pf_cpf || '';
          if (checkCpf && checkCpf.replace(/\D/g, '') === termCpf.replace(/\D/g, '')) {
            hit = true;
            strictlyBlocked = true;
          }
        }
        if (clientType === 'PJ' && termCnpj) {
          const checkCnpj = d.pjDadosEmpresa?.pj_cnpj || d.pjData?.pj_cnpj || '';
          if (checkCnpj && checkCnpj.replace(/\D/g, '') === termCnpj.replace(/\D/g, '')) {
            hit = true;
            strictlyBlocked = true;
          }
        }

        // Checking email, phone and names for alert duplicates (non-blocking unless CPF/CNPJ)
        if (!hit) {
          const checkEmail = d.pfContato?.pf_email || d.pfData?.pf_email || d.pjContatoEmpresa?.pj_emailEmpresa || d.pjData?.pj_emailEmpresa || '';
          const checkPhone = d.pfContato?.pf_telefone || d.pfData?.pf_telefone || d.pjContatoEmpresa?.pj_telefoneEmpresa || d.pjData?.pj_telefoneEmpresa || '';
          const checkName = d.pfDadosPessoais?.pf_nomeCompleto || d.pfData?.pf_nomeCompleto || d.pjDadosEmpresa?.pj_razaoSocial || d.pjData?.pj_razaoSocial || '';

          if (checkEmail && checkEmail === termEmail) hit = true;
          if (checkPhone && checkPhone.replace(/\D/g, '') === termPhone.replace(/\D/g, '')) hit = true;
          if (checkName && checkName.toLowerCase().trim() === termName.toLowerCase().trim()) hit = true;
        }

        if (hit) {
          found.push({
            id: pId,
            name: d.type === 'PF' 
              ? d.pfDadosPessoais?.pf_nomeCompleto || d.pfData?.pf_nomeCompleto || 'Sem nome'
              : d.pjDadosEmpresa?.pj_razaoSocial || d.pjData?.pj_razaoSocial || 'Sem nome',
            slug: d.slug,
            type: d.type,
            cpfCnpj: d.type === 'PF' 
              ? (d.pfDadosPessoais?.pf_cpf || d.pfData?.pf_cpf || '') 
              : (d.pjDadosEmpresa?.pj_cnpj || d.pjData?.pj_cnpj || '')
          });
        }
      });

      setDuplicateClients(found);

      if (strictlyBlocked) {
        setCpfCnpjBlocked(true);
        setBlockErrorMessage(`O ${clientType === 'PF' ? 'CPF' : 'CNPJ'} digitado já está em uso por outro cliente. Não é permitido criar clientes duplicados.`);
      } else if (found.length > 0) {
        onAlert('Alerta: Detectamos registros com similaridades cadastrais. Revise as opções sugeridas.');
      } else {
        onAlert('Sucesso: Nenhuma duplicidade detectada!');
      }
    } catch (err) {
      console.error(err);
      onAlert('Não foi possível verificar duplicidades.');
    } finally {
      onSetLoading(false);
    }
  };

  const activeName = clientType === 'PF' ? (pfData.pf_nomeCompleto || '') : (pjData.pj_razaoSocial || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cpfCnpjBlocked) {
      onAlert('Impossível prosseguir. O CPF/CNPJ correspondente já se encontra cadastrado.');
      return;
    }

    if (!activeName) {
      onAlert('O Nome Completo / Razão Social é obrigatório.');
      return;
    }

    if (!slug) {
      onAlert('O identificador slug do portal do cliente é obrigatório.');
      return;
    }

    if (!accessData.acesso_emailLogin || !accessData.acesso_senha) {
      onAlert('Por favor, defina o e-mail e a senha de autenticação.');
      return;
    }

    if (accessData.acesso_senha !== accessData.acesso_confirmarSenha) {
      onAlert('As senhas de acesso não combinam.');
      return;
    }

    setIsSubmitting(true);
    try {
      // If client exists, check if slug or CPF altered
      const clientPayload: any = {
        type: clientType,
        slug: slug,
        active: accessData.acesso_statusAcesso === 'ativo',
        updatedAt: serverTimestamp(),
        acessoSistema: {
          acesso_emailLogin: accessData.acesso_emailLogin,
          acesso_statusAcesso: accessData.acesso_statusAcesso,
          acesso_senha: accessData.acesso_senha
        },
        dadosBancariosOpcional: bankingData.bancario_possuiDadosBancarios ? bankingData : { bancario_possuiDadosBancarios: false }
      };

      if (clientType === 'PF') {
        clientPayload.pfDadosPessoais = {
          pf_nomeCompleto: pfData.pf_nomeCompleto || '',
          pf_nacionalidade: pfData.pf_nacionalidade || '',
          pf_estadoCivil: pfData.pf_estadoCivil || '',
          pf_profissao: pfData.pf_profissao || '',
          pf_cpf: pfData.pf_cpf || '',
          pf_rg: pfData.pf_rg || '',
          pf_dataNascimento: pfData.pf_dataNascimento || ''
        };
        clientPayload.pfContato = {
          pf_email: pfData.pf_email || '',
          pf_telefone: pfData.pf_telefone || '',
          pf_possuiWhatsapp: pfData.pf_possuiWhatsapp || false,
          pf_whatsapp: pfData.pf_whatsapp || ''
        };
        clientPayload.pfEndereco = {
          pf_cep: pfData.pf_cep || '',
          pf_endereco: pfData.pf_endereco || '',
          pf_numero: pfData.pf_numero || '',
          pf_complemento: pfData.pf_complemento || '',
          pf_bairro: pfData.pf_bairro || '',
          pf_cidade: pfData.pf_cidade || '',
          pf_estado: pfData.pf_estado || ''
        };
      } else {
        clientPayload.pjDadosEmpresa = {
          pj_cnpj: pjData.pj_cnpj || '',
          pj_razaoSocial: pjData.pj_razaoSocial || '',
          pj_nomeFantasia: pjData.pj_nomeFantasia || '',
          pj_inscricaoEstadual: pjData.pj_inscricaoEstadual || ''
        };
        clientPayload.pjContatoEmpresa = {
          pj_emailEmpresa: pjData.pj_emailEmpresa || '',
          pj_telefoneEmpresa: pjData.pj_telefoneEmpresa || '',
          pj_possuiWhatsappEmpresa: pjData.pj_possuiWhatsappEmpresa || false,
          pj_whatsappEmpresa: pjData.pj_whatsappEmpresa || ''
        };
        clientPayload.pjEnderecoEmpresa = {
          pj_cepEmpresa: pjData.pj_cepEmpresa || '',
          pj_enderecoEmpresa: pjData.pj_enderecoEmpresa || '',
          pj_numeroEmpresa: pjData.pj_numeroEmpresa || '',
          pj_complementoEmpresa: pjData.pj_complementoEmpresa || '',
          pj_bairroEmpresa: pjData.pj_bairroEmpresa || '',
          pj_cidadeEmpresa: pjData.pj_cidadeEmpresa || '',
          pj_estadoEmpresa: pjData.pj_estadoEmpresa || ''
        };
        clientPayload.socioAdministradorDadosPessoais = {
          socio_nomeCompleto: socioData.socio_nomeCompleto || '',
          socio_nacionalidade: socioData.socio_nacionalidade || '',
          socio_estadoCivil: socioData.socio_estadoCivil || '',
          socio_profissao: socioData.socio_profissao || '',
          socio_cpf: socioData.socio_cpf || '',
          socio_rg: socioData.socio_rg || '',
          socio_dataNascimento: socioData.socio_dataNascimento || '',
          socio_cargo: socioData.socio_cargo || ''
        };
      }

      let activeId = initialClientId;

      if (initialClientId) {
        // Edit Client
        await updateDoc(doc(db, 'clients', initialClientId), clientPayload);
        
        await setDoc(doc(db, 'clientPortals', slug), {
          clientId: initialClientId,
          slug: slug,
          active: accessData.acesso_statusAcesso === 'ativo',
          updatedAt: serverTimestamp()
        }, { merge: true });

        await setDoc(doc(db, 'users', initialClientId), {
          email: accessData.acesso_emailLogin,
          role: 'client',
          clientId: initialClientId,
          clientSlug: slug,
          name: activeName,
          status: accessData.acesso_statusAcesso,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        // Create Client
        clientPayload.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, 'clients'), clientPayload);
        activeId = docRef.id;

        await updateDoc(doc(db, 'clients', docRef.id), { clientId: docRef.id });

        // Save clientPortal
        await setDoc(doc(db, 'clientPortals', slug), {
          clientId: docRef.id,
          slug: slug,
          active: accessData.acesso_statusAcesso === 'ativo',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Save Auth user logic
        await setDoc(doc(db, 'users', docRef.id), {
          email: accessData.acesso_emailLogin,
          role: 'client',
          clientId: docRef.id,
          clientSlug: slug,
          name: activeName,
          status: accessData.acesso_statusAcesso,
          createdAt: serverTimestamp()
        });

        // invites table
        await setDoc(doc(db, 'users_invites', docRef.id), {
          email: accessData.acesso_emailLogin,
          role: 'client',
          clientId: docRef.id
        });
      }

      onNext(activeId!, slug);
    } catch (err) {
      console.error(err);
      onAlert('Não foi possível registrar o cliente. Verifique o console interno.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in">
      {!initialClientId && (
        <div className="flex gap-4 p-1.5 bg-gray-50 rounded-2xl w-full">
          <button
            type="button"
            onClick={() => setClientType('PF')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              clientType === 'PF' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <User size={16} /> Pessoa Física
          </button>
          <button
            type="button"
            onClick={() => setClientType('PJ')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              clientType === 'PJ' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Building2 size={16} /> Pessoa Jurídica
          </button>
        </div>
      )}

      {/* DUPLICITY BLOCK OR WARNING PANEL */}
      <div className="bg-gray-50 border border-gray-150 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-150 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-gray-200 text-gray-700 text-[10px] font-black uppercase tracking-wider rounded-md">CONECTOR DE SEGURANÇA</span>
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-widest leading-none">Verificação de Duplicidade</h4>
          </div>
          <button
            type="button"
            onClick={checkDuplicity}
            className="px-4 py-2 bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 rounded-xl transition-all"
          >
            Validar Cadastro
          </button>
        </div>

        {cpfCnpjBlocked && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-900 rounded-2xl space-y-3">
            <div className="flex gap-2">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-xs font-black uppercase tracking-wider">Cadastro Bloqueado</p>
                <p className="text-xs leading-relaxed mt-0.5">{blockErrorMessage}</p>
              </div>
            </div>
            {duplicateClients.length > 0 && (
              <div className="bg-white border border-red-100 rounded-xl p-3 space-y-2 mt-2">
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Ações Sugeridas:</p>
                {duplicateClients.map(dup => (
                  <div key={dup.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-55 py-2 last:border-0 text-xs font-medium text-gray-800">
                    <div>
                      <p className="font-bold">{dup.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">CNPJ/CPF: {dup.cpfCnpj} | Slug: {dup.slug}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onNext(dup.id, dup.slug)}
                        className="p-1 px-3 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] font-extrabold uppercase transition-all"
                      >
                        Vincular Este
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!cpfCnpjBlocked && duplicateClients.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-100 text-amber-900 rounded-2xl space-y-2">
            <p className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5"><AlertTriangle size={16} className="text-amber-500" /> Registro Similar Encontrado</p>
            <p className="text-xs">Há termos que coincidem em nossa base, verifique se deseja utilizar uma ficha existente:</p>
            <div className="bg-white border border-amber-100 rounded-xl p-3 space-y-2">
              {duplicateClients.map(dup => (
                <div key={dup.id} className="flex flex-col md:flex-row md:items-center justify-between gap-1 py-1 text-xs">
                  <div>
                    <p className="font-bold">{dup.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono">Slug: {dup.slug}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNext(dup.id, dup.slug)}
                    className="p-1 px-3 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg text-[10px] font-extrabold uppercase transition-all"
                  >
                    Usar Cliente
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-gray-50/40 rounded-3xl border border-gray-100 space-y-4">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck size={16} className="text-blue-600" /> Identificador único do Portal do Cliente (Slug)
        </h4>
        <div className="flex gap-2">
          <input
            value={slug}
            onChange={(e) => {
              if (!isSlugLocked) setSlug(e.target.value);
            }}
            disabled={isSlugLocked}
            placeholder="ex: joao-silva"
            className="flex-1 px-4 py-2.5 bg-white border border-gray-150 rounded-xl font-mono text-xs focus:ring-2 focus:ring-gray-100 outline-none disabled:bg-gray-100"
          />
          {!isSlugLocked && (
            <button
              type="button"
              onClick={() => {
                if (activeName) generateHashedSlug(activeName);
                else onAlert('Preencha o Nome/Razão Social primeiro para gerar o Slug.');
              }}
              className="px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl"
            >
              Gerar com Token
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-400 font-medium">O slug é bloqueado após a criação para evitar links quebrados.</p>
      </div>

      {/* Access credentials forms */}
      <AccessForm data={accessData} onChange={setAccessData} />

      {/* Sub Forms based on type */}
      {clientType === 'PF' ? (
        <PFForm data={pfData} onChange={setPfData} />
      ) : (
        <div className="space-y-6">
          <PJForm data={pjData} onChange={setPjData} />
          <SocioForm data={socioData} onChange={setSocioData} />
        </div>
      )}

      <BankingForm data={bankingData} onChange={setBankingData} clientName={activeName} />

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-8 py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {isSubmitting ? 'Salvando...' : 'Gravar e Ir p/ Passo Seguinte'}
          <ChevronRight size={18} />
        </button>
      </div>
    </form>
  );
}
