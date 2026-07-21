import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BossLayout } from '../../../components/Layout';
import { 
  UserPlus, 
  Building2, 
  ArrowLeft, 
  ChevronRight
} from 'lucide-react';

export default function CadastrarLeadsPrivate() {
  const navigate = useNavigate();

  return (
    <BossLayout>
      <div className="max-w-4xl mx-auto px-4 md:px-0 space-y-8 animate-fade-in pb-16">
        
        {/* HEADER */}
        <div className="border-b border-gray-150 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-indigo-650 font-mono">Etapa 01 — Identificação do Cliente em Potencial</span>
            <h1 className="text-xl font-black text-gray-900 tracking-tight leading-snug">
              Funil de Vendas de Serviços Jurídicos da Giffoni Advogados Associados - Identificação do Cliente em Potencial - Novo Cadastro de Lead
            </h1>
          </div>
          
          <button
            type="button"
            onClick={() => navigate('/boss/leads/private/dashboard')}
            className="text-xs font-bold text-gray-650 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-4xs transition hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <ArrowLeft size={14} />
            <span>Ver Dashboard de Leads</span>
          </button>
        </div>

        {/* THE TWO EXCLUSIVE CADASTRO CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card PF */}
          <div 
            onClick={() => navigate('/boss/cadastrar.leads/private/lead-pf')}
            className="cursor-pointer bg-white border-2 border-blue-100 hover:border-blue-250 rounded-[2rem] p-6 shadow-3xs hover:shadow-2xs transition-all duration-350 flex flex-col justify-between gap-6 group"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition border bg-blue-50 border-blue-100 text-blue-600 group-hover:bg-blue-100">
                <UserPlus size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                  <span>Cadastrar LEAD Pessoa Física Particular</span>
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed mt-1 font-semibold">
                  Registro rápido estruturado de interessados pessoa natural (caderneta comercial ou campanhas de captação PF).
                </p>
              </div>
            </div>
            <button 
              type="button"
              className="py-2.5 px-4 w-full rounded-xl transition font-black text-xs uppercase tracking-wider text-center flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-4xs cursor-pointer"
            >
              <span>Preencher Ficha LEAD PF</span>
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Card PJ */}
          <div 
            onClick={() => navigate('/boss/cadastrar.leads/private/lead-pj')}
            className="cursor-pointer bg-white border-2 border-purple-100 hover:border-purple-250 rounded-[2rem] p-6 shadow-3xs hover:shadow-2xs transition-all duration-350 flex flex-col justify-between gap-6 group"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition border bg-purple-50 border-purple-100 text-purple-600 group-hover:bg-purple-100">
                <Building2 size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                  <span>Cadastrar LEAD Pessoa Jurídica Particular</span>
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed mt-1 font-semibold">
                  Registro para empresas, consultorias, indústrias, comissões jurídicas prévias corporativas (PJ).
                </p>
              </div>
            </div>
            <button 
              type="button"
              className="py-2.5 px-4 w-full rounded-xl transition font-black text-xs uppercase tracking-wider text-center flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-4xs cursor-pointer"
            >
              <span>Preencher Ficha LEAD PJ</span>
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

      </div>
    </BossLayout>
  );
}
