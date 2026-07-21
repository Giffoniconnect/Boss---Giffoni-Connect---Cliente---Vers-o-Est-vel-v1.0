import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LogIn } from 'lucide-react';

export default function LoginSafe() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-blue-50 via-white to-white">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl shadow-gray-200 border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 shadow-lg shadow-blue-200">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Login BOSS</h1>
          <p className="text-gray-500">Acesso administrativo exclusivo Giffoni Connect</p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="p-4 bg-yellow-50 text-yellow-800 rounded-2xl text-sm border border-yellow-100">
            <strong>Modo de Segurança Ativo:</strong> O sistema de autenticação Firebase está sendo verificado. O login administrativo direto está temporariamente restrito para manutenção do pipeline.
          </div>
        </div>

        <button
          disabled={true}
          className="w-full h-14 bg-gray-400 text-white rounded-2xl font-bold flex items-center justify-center gap-3 cursor-not-allowed opacity-60"
        >
          Entrar com Google (Indisponível)
          <LogIn size={20} />
        </button>

        <div className="mt-8 pt-8 border-t border-gray-100 text-center">
          <button 
            onClick={() => navigate('/')}
            className="text-sm font-semibold text-gray-550 hover:text-gray-900 transition-colors"
          >
            Voltar para Início
          </button>
        </div>
      </div>
    </div>
  );
}
