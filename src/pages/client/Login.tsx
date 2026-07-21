// LEGADO/PREPARAÇÃO — Portal do Cliente real será externo. Não usado no roteamento ativo do BOSS.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'motion/react';
import { ChevronRight, LogIn, ShieldCheck } from 'lucide-react';

export default function ClientLogin() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { loginWithGoogle, loading, user, isClient, profile, errorMsg } = useAuth();
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function verifySlug() {
      if (!slug) return;
      try {
        const portalSnap = await getDoc(doc(db, 'clientPortals', slug));
        if (portalSnap.exists()) {
          const portalData = portalSnap.data();
          
          if (!portalData.active) {
            setError(true);
            return;
          }

          const clientId = portalData.clientId;
          try {
            const clientSnap = await getDoc(doc(db, 'clients', clientId));
            if (clientSnap.exists()) {
              setClientInfo({ id: clientSnap.id, ...clientSnap.data() });
              return;
            }
          } catch (e) {
            console.warn("Firestore unrestricted read disabled. Falling back to stylized slug name.");
            const formattedName = slug
              .split('-')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');
            setClientInfo({
              id: clientId,
              type: 'PF',
              pfDadosPessoais: { pf_nomeCompleto: formattedName }
            });
            return;
          }
        }
        setError(true);
      } catch (err) {
        setError(true);
      }
    }
    verifySlug();
  }, [slug]);

  useEffect(() => {
    if (user && isClient && profile?.clientId === clientInfo?.id) {
       navigate(`/portal-cliente-giffoni/${slug}/casos`);
    }
  }, [user, isClient, profile, clientInfo, slug, navigate]);

  const handleLogin = async () => {
    if (!clientInfo) return;
    await loginWithGoogle();
  };

  const getClientName = () => {
    if (!clientInfo) return '';
    if (clientInfo.type === 'PF') {
      return clientInfo.pfDadosPessoais?.pf_nomeCompleto || clientInfo.pfData?.pf_nomeCompleto || '';
    }
    return clientInfo.pjDadosEmpresa?.pj_nomeFantasia || clientInfo.pjData?.pj_nomeFantasia || 
           clientInfo.pjDadosEmpresa?.pj_razaoSocial || clientInfo.pjData?.pj_razaoSocial || '';
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl mx-auto flex items-center justify-center mb-8">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-4 tracking-tight">PORTAL INEXISTENTE</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">O portal solicitado (/{slug}) não foi encontrado em nossa base modular ou está temporariamente inativo.</p>
          <button 
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  if (!clientInfo) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-50/50 rounded-full translate-x-1/2 -translate-y-1/2 -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gray-50 rounded-full -translate-x-1/2 translate-y-1/2 -z-10" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="mb-12">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center text-white text-3xl mb-10 shadow-2xl shadow-gray-200">
             <ChevronRight size={32} />
          </div>
          <div className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] mb-4">Acesso Personalizado</div>
          <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-6">
            Olá, <br />
            <span className="text-gray-300 transform inline-block hover:text-blue-600 transition-colors cursor-default">{getClientName()}</span>
          </h1>
          <p className="text-gray-500 text-lg leading-relaxed">Sincronize sua conta Google para acessar o portal 100% modular da Giffoni Connect.</p>
        </div>

        <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 mb-8 shadow-sm">
           <p className="text-xs text-gray-400 mb-6 font-black uppercase tracking-widest text-center">Autenticação Segura</p>
           {errorMsg && (
             <div className="p-4 mb-4 bg-red-50 text-red-800 rounded-2xl text-xs border border-red-100 font-bold leading-relaxed whitespace-pre-line text-left">
               {errorMsg}
             </div>
           )}
           <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full h-16 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black active:scale-95 transition-all shadow-xl shadow-gray-200"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                Entrar com Google
                <LogIn size={20} />
              </>
            )}
          </button>
        </div>

        <p className="text-sm text-center text-gray-400 font-medium">
          Ao entrar, você concorda com nossos <br />
          <span className="text-blue-600 cursor-pointer hover:underline">Termos de Uso e LGPD</span>
        </p>
      </motion.div>
    </div>
  );
}
