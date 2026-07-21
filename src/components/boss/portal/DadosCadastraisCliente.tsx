import React, { useState } from 'react';
import { 
  User, 
  Briefcase, 
  Building2, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  CreditCard,
  Instagram,
  Facebook
} from 'lucide-react';

interface DadosCadastraisProps {
  selectedClient: any;
  fichaActiveTab: 'contratante' | 'endereco' | 'socios' | 'bancarios' | 'acesso';
  setFichaActiveTab: (tab: any) => void;
  showFichaPassword: boolean;
  setShowFichaPassword: (show: boolean) => void;
  getClientName: (c: any) => string;
  navigate: any;
}

const Tiktok = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    className={className}
  >
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

export const DadosCadastraisCliente: React.FC<DadosCadastraisProps> = ({
  selectedClient,
  fichaActiveTab,
  setFichaActiveTab,
  showFichaPassword,
  setShowFichaPassword,
  getClientName,
  navigate
}) => {
  const isPf = selectedClient.type === 'PF';
  const pf = selectedClient.pfData || selectedClient.pfDadosPessoais || {};
  const pj = selectedClient.pjData || selectedClient.pjDadosEmpresa || {};
  const socio = selectedClient.socioData || selectedClient.socioDadosPessoais || {};
  const acesso = selectedClient.acessoSistema || {};
  const bancario = selectedClient.bancarioData || selectedClient.bancarioDadosBancarios || {};

  const contactEmail = 
    selectedClient.pfContato?.pf_email || 
    selectedClient.pfContato?.email || 
    pf.pf_email || 
    pf.email || 
    selectedClient.portalMirror?.pfContato?.email || 
    '—';

  const contactPhone = 
    selectedClient.pfContato?.pf_telefone || 
    selectedClient.pfContato?.telefone || 
    selectedClient.pfContato?.pf_telefoneCelular || 
    pf.pf_telefone || 
    pf.pf_telefoneCelular || 
    pf.telefone || 
    selectedClient.portalMirror?.pfContato?.telefone || 
    '—';

  const hasWhatsapp = 
    selectedClient.pfContato?.pf_possuiWhatsapp === true || 
    selectedClient.pfContato?.pf_possuiWhatsapp === 'true' ||
    selectedClient.pfData?.pf_possuiWhatsapp === true ||
    pf.pf_possuiWhatsapp === true ||
    (!!selectedClient.pfContato?.whatsapp && selectedClient.pfContato?.whatsapp !== 'Não possuo' && selectedClient.pfContato?.whatsapp !== '') ||
    (!!selectedClient.portalMirror?.pfContato?.whatsapp && selectedClient.portalMirror?.pfContato?.whatsapp !== 'Não possuo' && selectedClient.portalMirror?.pfContato?.whatsapp !== '');

  const [hideInstagram, setHideInstagram] = useState(false);
  const [hideFacebook, setHideFacebook] = useState(false);
  const [hideTiktok, setHideTiktok] = useState(false);

  const getSocialUrl = (type: 'instagram' | 'facebook' | 'tiktok', value: string) => {
    if (!value || value === '—' || value === 'Não possuo' || value === 'Nao possuo') return null;
    let clean = value.trim();
    if (clean.startsWith('@')) {
      clean = clean.substring(1);
    }
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    if (type === 'instagram') {
      return `https://instagram.com/${clean}`;
    }
    if (type === 'facebook') {
      return `https://facebook.com/${clean}`;
    }
    if (type === 'tiktok') {
      return `https://tiktok.com/@${clean}`;
    }
    return null;
  };

  const renderSocialLink = (type: 'instagram' | 'facebook' | 'tiktok', value: string) => {
    const url = getSocialUrl(type, value);
    if (!url) return null;

    const IconComponent = type === 'instagram' ? Instagram : type === 'facebook' ? Facebook : Tiktok;

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-650 hover:text-indigo-850 p-1 rounded hover:bg-gray-150 transition cursor-pointer flex items-center justify-center shrink-0"
        title={`Entrar em contato via ${type}`}
      >
        <IconComponent size={14} className="shrink-0" />
      </a>
    );
  };

  return (
    <div className="bg-white border border-gray-150 rounded-3xl p-6 md:p-8 shadow-xs relative overflow-hidden text-left space-y-6">
      {/* TOP BRANDING & META */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-650 rounded-2xl flex items-center justify-center shadow-3xs shrink-0">
            {isPf ? <User size={22} className="stroke-[2px]" /> : <Building2 size={22} className="stroke-[2px]" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-black text-gray-400 uppercase tracking-widest block">FICHA DE IDENTIFICAÇÃO CADASTRAL</span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg font-mono border ${
                isPf 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {selectedClient.type}
              </span>
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight mt-0.5">{getClientName(selectedClient)}</h2>
          </div>
        </div>

        {/* BOTÃO DE ATALHO DE EDIÇÃO DA FICHA */}
        <button
          type="button"
          onClick={() => navigate(`/boss-giffoni-clientes/fluxo-producao/f60jptoSi8Z9xat45yIb/editar-cadastro-cliente`)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-950 rounded-xl text-[10.5px] font-black uppercase tracking-wider font-mono transition duration-200 cursor-pointer text-center"
        >
          Editar Ficha Completa
        </button>
      </div>

      {/* MINI TABS FOR FICHA CATEGORIES */}
      <div className="flex flex-wrap gap-1.5 bg-gray-50 p-1 border border-gray-150 rounded-2xl">
        <button
          type="button"
          onClick={() => setFichaActiveTab('contratante')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition font-mono shrink-0 cursor-pointer ${
            fichaActiveTab === 'contratante'
              ? 'bg-white text-indigo-600 border border-gray-150 shadow-3xs'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {isPf ? <User size={13} /> : <Building2 size={13} />}
          <span>Contratante</span>
        </button>

        <button
          type="button"
          onClick={() => setFichaActiveTab('endereco')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition font-mono shrink-0 cursor-pointer ${
            fichaActiveTab === 'endereco'
              ? 'bg-white text-indigo-600 border border-gray-150 shadow-3xs'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Briefcase size={13} />
          <span>Sede / Endereço</span>
        </button>

        {!isPf && (
          <button
            type="button"
            onClick={() => setFichaActiveTab('socios')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition font-mono shrink-0 cursor-pointer ${
              fichaActiveTab === 'socios'
                ? 'bg-white text-indigo-600 border border-gray-150 shadow-3xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ShieldCheck size={13} />
            <span>Sócios</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setFichaActiveTab('bancarios')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition font-mono shrink-0 cursor-pointer ${
            fichaActiveTab === 'bancarios'
              ? 'bg-white text-indigo-600 border border-gray-150 shadow-3xs'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <CreditCard size={13} />
          <span>Bancários</span>
        </button>

        <button
          type="button"
          onClick={() => setFichaActiveTab('acesso')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition font-mono shrink-0 cursor-pointer ${
            fichaActiveTab === 'acesso'
              ? 'bg-white text-indigo-600 border border-gray-150 shadow-3xs'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Lock size={13} />
          <span>Acesso Portal</span>
        </button>
      </div>

      {/* DETAILS VIEW COMPILER */}
      <div className="bg-gray-50/40 border border-gray-150 p-5 md:p-6 rounded-2xl">
        {/* 1. TAB CONTRATANTE */}
        {fichaActiveTab === 'contratante' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <User size={14} className="text-indigo-600 shrink-0" />
              Dados Gerais de Identificação Civil e Contato do Cliente
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {isPf ? (
                <>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Nome Completo</span>
                    <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{pf.pf_nomeCompleto || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Nacionalidade</span>
                    <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{pf.pf_nacionalidade || 'Brasileiro'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Estado Civil</span>
                    <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{pf.pf_estadoCivil || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Profissão</span>
                    <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{pf.pf_profissao || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">CPF</span>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{pf.pf_cpf || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">RG número</span>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{pf.pf_rg || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Órgão Emissor / UF</span>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block uppercase">{pf.pf_orgaoEmissor || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Nome Completo do Pai</span>
                    <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{pf.pf_nomePai || selectedClient.portalMirror?.pfDadosPessoais?.nomePai || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Nome Completo da Mãe</span>
                    <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{pf.pf_nomeMae || selectedClient.portalMirror?.pfDadosPessoais?.nomeMae || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">E-mail Principal</span>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{contactEmail}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Celular / WhatsApp</span>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{contactPhone}</span>
                    <div className="mt-1.5 flex items-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 border rounded-lg text-[10px] font-black uppercase font-mono tracking-wider ${
                        hasWhatsapp 
                          ? 'bg-emerald-50 border-emerald-250 text-emerald-800' 
                          : 'bg-rose-50 border-rose-250 text-rose-800'
                      }`}>
                        {hasWhatsapp ? '✔️ possui WhatsApp' : '❌ não possui WhatsApp'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Instagram</span>
                      <div className="flex items-center gap-1.5 leading-none">
                        {!hideInstagram && renderSocialLink('instagram', pf.pf_instagram)}
                        <button
                          type="button"
                          onClick={() => setHideInstagram(!hideInstagram)}
                          className="hover:text-indigo-600 text-gray-400 transition cursor-pointer p-0.5 rounded hover:bg-gray-150"
                          title={hideInstagram ? "Mostrar atalho" : "Esconder atalho"}
                        >
                          {hideInstagram ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">
                      {hideInstagram ? '••••••••' : (pf.pf_instagram || '—')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Facebook</span>
                      <div className="flex items-center gap-1.5 leading-none">
                        {!hideFacebook && renderSocialLink('facebook', pf.pf_facebook)}
                        <button
                          type="button"
                          onClick={() => setHideFacebook(!hideFacebook)}
                          className="hover:text-indigo-600 text-gray-400 transition cursor-pointer p-0.5 rounded hover:bg-gray-150"
                          title={hideFacebook ? "Mostrar atalho" : "Esconder atalho"}
                        >
                          {hideFacebook ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">
                      {hideFacebook ? '••••••••' : (pf.pf_facebook || '—')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">TikTok</span>
                      <div className="flex items-center gap-1.5 leading-none">
                        {!hideTiktok && renderSocialLink('tiktok', pf.pf_tiktok)}
                        <button
                          type="button"
                          onClick={() => setHideTiktok(!hideTiktok)}
                          className="hover:text-indigo-600 text-gray-400 transition cursor-pointer p-0.5 rounded hover:bg-gray-150"
                          title={hideTiktok ? "Mostrar atalho" : "Esconder atalho"}
                        >
                          {hideTiktok ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">
                      {hideTiktok ? '••••••••' : (pf.pf_tiktok || '—')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Razão Social</span>
                    <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{pj.pj_razaoSocial || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Nome Fantasia</span>
                    <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{pj.pj_nomeFantasia || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">CNPJ da Empresa</span>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{pj.pj_cnpj || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Inscrição Estadual</span>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{pj.pj_inscricaoEstadual || 'Isento / Não Consta'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Atividade Principal</span>
                    <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{pj.pj_ramoAtividade || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">E-mail Comercial</span>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{pj.pj_emailEmpresa || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Telefone Fixo / WhatsApp</span>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{pj.pj_telefoneEmpresa || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Site Oficial</span>
                    <span className="text-xs font-mono font-bold text-gray-950 mt-1 block">{pj.pj_siteEmpresa || '—'}</span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Instagram</span>
                      <div className="flex items-center gap-1.5 leading-none">
                        {!hideInstagram && renderSocialLink('instagram', pj.pj_instagramEmpresa)}
                        <button
                          type="button"
                          onClick={() => setHideInstagram(!hideInstagram)}
                          className="hover:text-indigo-600 text-gray-400 transition cursor-pointer p-0.5 rounded hover:bg-gray-150"
                          title={hideInstagram ? "Mostrar atalho" : "Esconder atalho"}
                        >
                          {hideInstagram ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">
                      {hideInstagram ? '••••••••' : (pj.pj_instagramEmpresa || '—')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Facebook</span>
                      <div className="flex items-center gap-1.5 leading-none">
                        {!hideFacebook && renderSocialLink('facebook', pj.pj_facebookEmpresa)}
                        <button
                          type="button"
                          onClick={() => setHideFacebook(!hideFacebook)}
                          className="hover:text-indigo-600 text-gray-400 transition cursor-pointer p-0.5 rounded hover:bg-gray-150"
                          title={hideFacebook ? "Mostrar atalho" : "Esconder atalho"}
                        >
                          {hideFacebook ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">
                      {hideFacebook ? '••••••••' : (pj.pj_facebookEmpresa || '—')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">TikTok</span>
                      <div className="flex items-center gap-1.5 leading-none">
                        {!hideTiktok && renderSocialLink('tiktok', pj.pj_tiktokEmpresa)}
                        <button
                          type="button"
                          onClick={() => setHideTiktok(!hideTiktok)}
                          className="hover:text-indigo-600 text-gray-400 transition cursor-pointer p-0.5 rounded hover:bg-gray-150"
                          title={hideTiktok ? "Mostrar atalho" : "Esconder atalho"}
                        >
                          {hideTiktok ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">
                      {hideTiktok ? '••••••••' : (pj.pj_tiktokEmpresa || '—')}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 2. TAB ENDEREÇO */}
        {fichaActiveTab === 'endereco' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <Briefcase size={14} className="text-indigo-600 shrink-0" />
              Sede / Endereço Fiscal Registrado No Contrato
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">CEP</span>
                <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{isPf ? pf.pf_cep || '—' : pj.pj_cepEmpresa || '—'}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Logradouro / Endereço</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{isPf ? pf.pf_endereco || '—' : pj.pj_enderecoEmpresa || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Número</span>
                <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{isPf ? pf.pf_numero || '—' : pj.pj_numeroEmpresa || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Complemento</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{isPf ? pf.pf_complemento || '—' : pj.pj_complementoEmpresa || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Bairro</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{isPf ? pf.pf_bairro || '—' : pj.pj_bairroEmpresa || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Cidade</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{isPf ? pf.pf_cidade || '—' : pj.pj_cidadeEmpresa || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Estado (UF)</span>
                <span className="text-xs font-mono font-bold text-gray-900 mt-1 block uppercase">{isPf ? pf.pf_estado || '—' : pj.pj_estadoEmpresa || '—'}</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. QUADRO DE SÓCIOS (PJ ONLY) */}
        {!isPf && fichaActiveTab === 'socios' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <ShieldCheck size={14} className="text-teal-600 shrink-0" />
              Quadro de Sócios / Representante Legal da Empresa
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Nome Completo</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{socio.socio_nomeCompleto || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">CPF</span>
                <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{socio.socio_cpf || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Cargo</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{socio.socio_cargo || 'Representante'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Nacionalidade</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{socio.socio_nacionalidade || 'Brasileira'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Estado Civil</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{socio.socio_estadoCivil || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Profissão</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{socio.socio_profissao || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">E-mail Pessoal</span>
                <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{socio.socio_email || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Celular de Contato</span>
                <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{socio.socio_telefoneCelular || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Nome Completo do Pai</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{socio.socio_nomePai || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Nome Completo da Mãe</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{socio.socio_nomeMae || '—'}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Endereço Residencial Completo</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">
                  {socio.socio_endereco || '—'}, N {socio.socio_numero || '—'}, {socio.socio_bairro || '—'} - {socio.socio_cidade || '—'}/{socio.socio_estado || '—'} (CEP: {socio.socio_cep || '—'})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4. DADOS BANCÁRIOS */}
        {fichaActiveTab === 'bancarios' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <CreditCard size={14} className="text-amber-600 shrink-0" />
              Conta para Reembolsos, Repasses ou Depósito de Valores Fáticos
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Banco</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{bancario.bancario_banco || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Tipo de Conta</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block uppercase">{bancario.bancario_tipoConta || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Agência bancária</span>
                <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{bancario.bancario_agencia || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Número da Conta & DV</span>
                <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{bancario.bancario_conta || '—'}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Chave PIX Cadastrada</span>
                <span className="text-xs font-mono font-bold text-indigo-650 bg-indigo-50/50 p-1.5 px-3 rounded-lg border border-indigo-100 inline-block mt-1">
                  {bancario.bancario_chavePix || '—'} (Tipo: {bancario.bancario_tipoChavePix || 'Não informado'})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 5. ACESSO SISTEMA / CREDENCIAIS */}
        {fichaActiveTab === 'acesso' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <Lock size={14} className="text-blue-600 shrink-0" />
              Credenciais de Segurança e Acesso Integrado ao Portal do Cliente
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Usuário de Acesso (E-mail)</span>
                <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">{acesso.emailAcesso || selectedClient.slug + '@giffoni.adv.br'}</span>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono block">Senha do Portal</span>
                  <button
                    type="button"
                    onClick={() => setShowFichaPassword(!showFichaPassword)}
                    className="text-[10px] text-indigo-600 font-bold hover:underline uppercase tracking-wide font-mono flex items-center gap-1 shrink-0"
                  >
                    {showFichaPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                    {showFichaPassword ? 'Ocultar' : 'Revelar'}
                  </button>
                </div>
                <input
                  type={showFichaPassword ? 'text' : 'password'}
                  readOnly
                  value={acesso.senhaAcesso || 'giffoni123'}
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs font-mono font-semibold focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
