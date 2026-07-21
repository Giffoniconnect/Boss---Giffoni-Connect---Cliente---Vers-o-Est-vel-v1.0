import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { DollarSign, AlertCircle, Sparkles, Shield, ChevronRight, HelpCircle } from 'lucide-react';

interface FinanceiroStepProps {
  caseId: string;
  clientId: string;
  onNext: () => void;
  onSetLoading: (loading: boolean) => void;
  onAlert: (msg: string) => void;
}

export default function FinanceiroStep({ caseId, clientId, onNext, onSetLoading, onAlert }: FinanceiroStepProps) {
  const [financialData, setFinancialData] = useState<any>({
    totalAmount: 0,
    installments: 1,
    installmentsPaid: 0,
    status: 'aguardando_assinatura', // pendente, ativo, quitado, atrasado, aguardando_assinatura
    paymentProvider: 'none', // none, stripe, asaas
    paymentLink: '',
    externalPaymentId: '',
    stripeCustomerId: '',
    asaasCustomerId: '',
    webhookStatus: 'nao_sincronizado', // nao_sincronizado, sincronizando, ativo, erro
    contracts: []
  });
  const [financialId, setFinancialId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadFinancial() {
      onSetLoading(true);
      try {
        const q = query(collection(db, 'caseFinancials'), where('caseId', '==', caseId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docRef = snap.docs[0];
          setFinancialId(docRef.id);
          setFinancialData(docRef.data());
        }
      } catch (err) {
        console.error(err);
      } finally {
        onSetLoading(false);
      }
    }
    loadFinancial();
  }, [caseId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let typedValue: any = value;
    if (name === 'totalAmount' || name === 'installments' || name === 'installmentsPaid') {
      typedValue = Number(value) || 0;
    }
    setFinancialData((prev: any) => ({ ...prev, [name]: typedValue }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...financialData,
        caseId,
        clientId,
        updatedAt: serverTimestamp()
      };

      if (financialId) {
        await updateDoc(doc(db, 'caseFinancials', financialId), payload);
      } else {
        payload.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, 'caseFinancials'), payload);
        setFinancialId(docRef.id);
      }
      onAlert('Configurações financeiras integradas e salvas com sucesso!');
      onNext();
    } catch (err) {
      console.error(err);
      onAlert('Não foi possível registrar as definições financeiras.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-fade-in">
      {/* WARNING NOTIFICATION IN GATEWAY DESINTEGRATION */}
      <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex gap-3 text-amber-900">
        <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
        <div className="space-y-1">
          <p className="text-xs font-black uppercase tracking-wider font-sans">Aviso de Integração Financeira</p>
          <p className="text-xs font-semibold leading-relaxed">
            As cobranças, faturamento automático e sincronização de webhooks do Stripe/Asaas exigem ativação segura de servidor backend antes de operarem em produção real. Atualmente, os dados listados abaixo servem exclusivamente para o controle manual dos advogados e espelho funcional do cliente.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
        <h4 className="md:col-span-2 text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2 border-b border-gray-50 pb-3">
          <DollarSign size={18} className="text-blue-600" /> Parâmetros de Cobrança e Contrato Honorário
        </h4>

        <div className="space-y-2">
          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Valor do Contrato (R$)</label>
          <input
            type="number"
            name="totalAmount"
            value={financialData.totalAmount}
            onChange={handleChange}
            placeholder="0.00"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Nº Total de Parcelas (Carregamento)</label>
          <input
            type="number"
            name="installments"
            value={financialData.installments}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Parcelas Quitadas</label>
          <input
            type="number"
            name="installmentsPaid"
            value={financialData.installmentsPaid}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Status Financeiro Geral</label>
          <select
            name="status"
            value={financialData.status}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
          >
            <option value="aguardando_assinatura">Aguardando Assinatura de Contrato</option>
            <option value="pendente">Pendente de Cobrança</option>
            <option value="ativo">Ativo / Adimplente</option>
            <option value="quitado">Quitado por Completo</option>
            <option value="atrasado">Em Atraso / Notificação de Débito</option>
          </select>
        </div>
      </div>

      {/* STRIPE AND ASAAS CONNECTIVITY DATA */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="text-blue-600 focus:scale-105" size={16} /> Configurações de Conector de Pagamento
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Provedor Financeiro Integrado</label>
            <select
              name="paymentProvider"
              value={financialData.paymentProvider}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
            >
              <option value="none">Manual / Depósito / PIX</option>
              <option value="stripe">Stripe Payments Inc.</option>
              <option value="asaas">Asaas Gestão Financeira S.A.</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Link do Checkout de Cobrança (Público)</label>
            <input
              type="text"
              name="paymentLink"
              value={financialData.paymentLink}
              onChange={handleChange}
              placeholder="https://billing.example.com/checkouts/..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">ID Externo do Pagamento / Checkout ID</label>
            <input
              type="text"
              name="externalPaymentId"
              value={financialData.externalPaymentId}
              onChange={handleChange}
              placeholder="ch_xxxx_xxx_xxxx"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Status Webhook Listener</label>
            <select
              name="webhookStatus"
              value={financialData.webhookStatus}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl outline-none font-medium text-sm focus:ring-2 focus:ring-blue-100"
            >
              <option value="nao_sincronizado">Não Sincronizado</option>
              <option value="sincronizando">Sincronizando em Background</option>
              <option value="ativo">Webhook Ativo</option>
              <option value="erro">Erro Operacional</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-8 py-3 rounded-xl flex items-center gap-2 transition-all"
        >
          {isSaving ? 'Salvando...' : 'Confirmar e Prosseguir'}
          <ChevronRight size={18} />
        </button>
      </div>
    </form>
  );
}
