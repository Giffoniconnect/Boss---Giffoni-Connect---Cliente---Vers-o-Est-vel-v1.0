import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'motion/react';
import { Lock, LogIn, ShieldCheck, LogOut } from 'lucide-react';

export default function BossLogin() {
  const { loginWithGoogle, loading, user, isAdmin, logout, errorMsg } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    await loginWithGoogle('boss_admin');
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-blue-50 via-white to-white">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl shadow-gray-200 border border-gray-100"
      >
        {user && isAdmin ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-blue-50">
                <ShieldCheck size={32} />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Login BOSS</h1>
              <p className="font-semibold text-blue-600">Sessão administrativa já ativa.</p>
              <p className="text-sm text-gray-600 mt-2">Logado como: {user.email}</p>
            </div>

            <div className="space-y-3 pt-4">
              <button
                onClick={() => navigate('/boss-giffoni-clientes/dashboard')}
                className="w-full h-14 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-800 active:scale-95 transition-all"
              >
                Entrar no BOSS
                <LogIn size={20} />
              </button>

              <button
                onClick={handleLogout}
                className="w-full h-14 bg-white border border-gray-200 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-red-50 hover:border-red-100 active:scale-95 transition-all"
              >
                Sair / trocar conta
                <LogOut size={20} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 shadow-lg shadow-blue-200">
                <Lock size={32} />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Login BOSS</h1>
              <p className="text-gray-500">Acesso administrativo exclusivo Giffoni Connect</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="p-4 bg-blue-50 text-blue-800 rounded-2xl text-sm border border-blue-100">
                <strong>Ambiente de Demonstração:</strong> Use o botão abaixo para simular o acesso administrativo. Em produção, este portal utiliza Firebase Auth.
              </div>
              {errorMsg && (
                <div className="p-4 bg-red-50 text-red-800 rounded-2xl text-sm border border-red-100 font-semibold leading-relaxed whitespace-pre-line text-left">
                  {errorMsg}
                </div>
              )}
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full h-14 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-wait"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Entrar com Google (Admin)
                  <LogIn size={20} />
                </>
              )}
            </button>
          </>
        )}

        <div className="mt-8 pt-8 border-t border-gray-100 text-center">
          <button 
            onClick={() => navigate('/')}
            className="text-sm font-semibold text-gray-650 hover:text-gray-900 transition-colors"
          >
            Voltar para Início
          </button>
        </div>
      </motion.div>
    </div>
  );
}
