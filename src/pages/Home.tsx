import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, UserCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const DEFAULT_PORTAL_LINK = 'https://aistudio.google.com/apps/93c62126-a17f-4c18-8bc7-d327df1ca6b5?showPreview=true&showAssistant=true';

export default function Home() {
  const [portalLink, setPortalLink] = useState(DEFAULT_PORTAL_LINK);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'portal'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.link) {
            setPortalLink(data.link);
          }
        }
      } catch (err) {
        console.error('Error loading settings in home page:', err);
      }
    }
    fetchSettings();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-gray-50 to-gray-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center mb-12"
      >
        <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-blue-200 mb-8 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent"></div>
          G
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl mb-4">
          Giffoni Connect
        </h1>
        <p className="text-lg text-gray-600">
          Gerenciamento inteligente e transparente para nossos clientes.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        <Link to="/boss-giffoni-clientes/login" className="group">
          <motion.div 
            whileHover={{ y: -5 }}
            className="h-full bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-50 transition-all"
          >
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <ShieldCheck size={28} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Painel BOSS</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Área administrativa restrita para gestão de clientes, processos e faturamento.
            </p>
            <div className="flex items-center text-blue-600 font-semibold gap-2">
              Acessar BOSS <ArrowRight size={18} />
            </div>
          </motion.div>
        </Link>

        <a href={portalLink} target="_blank" rel="noopener noreferrer" className="group" id="portal-cliente-card-link">
          <motion.div 
            whileHover={{ y: -5 }}
            className="h-full bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-50 transition-all cursor-pointer"
          >
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <UserCircle size={28} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Portal do Cliente</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Consulte o andamento da sua causa, documentos e financeiro diretamente.
            </p>
            <div className="flex items-center text-blue-600 font-semibold gap-2">
              Acessar Portal <ArrowRight size={18} />
            </div>
          </motion.div>
        </a>
      </div>

      <footer className="mt-20 text-gray-400 text-sm">
        &copy; 2024 Giffoni Connect. Todos os direitos reservados.
      </footer>
    </div>
  );
}
