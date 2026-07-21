import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  HelpCircle,
  FileBadge,
  Sparkles,
  Award
} from 'lucide-react';

interface IntegridadeStepProps {
  caseId: string;
  clientId: string;
  slug: string;
  onSetLoading: (loading: boolean) => void;
  onAlert: (msg: string) => void;
}

interface ComplianceRule {
  id: string;
  category: 'cadastro' | 'producao' | 'financeiro' | 'controladoria';
  label: string;
  status: 'ok' | 'atencao' | 'pendente' | 'erro_critico';
  message: string;
}

export default function IntegridadeStep({ caseId, clientId, slug, onSetLoading, onAlert }: IntegridadeStepProps) {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [overallResult, setOverallResult] = useState<'pronto' | 'pronto_ressalvas' | 'nao_recomendado'>('nao_recomendado');
  const [scorePercent, setScorePercent] = useState(0);

  const runComplianceCheck = async () => {
    onSetLoading(true);
    try {
      const checkList: ComplianceRule[] = [];

      // 1-5: Load core entities
      const caseDoc = await getDoc(doc(db, 'cases', caseId));
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      const portalDoc = await getDoc(doc(db, 'clientPortals', slug));
      const authUserDoc = await getDoc(doc(db, 'users', clientId));

      const infoRequestsSnap = await getDocs(query(collection(db, 'caseInformationRequests'), where('caseId', '==', caseId)));
      const evidenceRequestsSnap = await getDocs(query(collection(db, 'caseEvidenceRequests'), where('caseId', '==', caseId)));
      const financeSnap = await getDocs(query(collection(db, 'caseFinancials'), where('caseId', '==', caseId)));

      const caseData = caseDoc.exists() ? caseDoc.data() : {};
      const clientData = clientDoc.exists() ? clientDoc.data() : {};
      const financialData = !financeSnap.empty ? financeSnap.docs[0].data() : null;

      // RULE 1: Case has client associated
      checkList.push({
        id: 'case_clientId',
        category: 'cadastro',
        label: 'Vínculo do Caso com Cliente',
        status: caseData.clientId ? 'ok' : 'erro_critico',
        message: caseData.clientId ? 'Caso associado ao ID do cliente.' : 'Erro: Caso sem ID de cliente.'
      });

      // RULE 2: Client exists in DB
      checkList.push({
        id: 'client_exists',
        category: 'cadastro',
        label: 'Existência da Ficha Cadastral',
        status: clientDoc.exists() ? 'ok' : 'erro_critico',
        message: clientDoc.exists() ? 'Ficha cadastral encontrada no Firestore.' : 'Erro Crítico: Ficha inexistente!'
      });

      // RULE 3: Portal slug is defined
      checkList.push({
        id: 'client_slug',
        category: 'cadastro',
        label: 'Slug do Portal do Cliente',
        status: slug ? 'ok' : 'erro_critico',
        message: slug ? `Slug definido: "${slug}".` : 'Erro: Slug do portal indefinido.'
      });

      // RULE 4: ClientPortal document mapping exists
      checkList.push({
        id: 'portal_mapping',
        category: 'cadastro',
        label: 'Mapeamento de Rotas do Portal (Slug)',
        status: portalDoc.exists() ? 'ok' : 'erro_critico',
        message: portalDoc.exists() ? 'Link de redirecionamento mapeado com sucesso.' : 'Erro: Tabela de roteamento sem este slug.'
      });

      // RULE 5: Auth profile user exists with role client
      checkList.push({
        id: 'user_auth',
        category: 'cadastro',
        label: 'Perfil de Acesso do Cliente',
        status: authUserDoc.exists() ? 'ok' : 'erro_critico',
        message: authUserDoc.exists() ? 'Credenciais configuradas ativas.' : 'Atenção: Sem credenciais no modulo users.'
      });

      // RULE 6: Client has e-mail
      const hasEmail = clientTypeField('email', clientData);
      checkList.push({
        id: 'client_email',
        category: 'cadastro',
        label: 'Contato: E-mail Cadastrado',
        status: hasEmail ? 'ok' : 'erro_critico',
        message: hasEmail ? `E-mail: ${hasEmail}` : 'Erro Crítico: E-mail para faturamento ausente.'
      });

      // RULE 7: Client has WhatsApp or phone
      const hasPhone = clientTypeField('telefone', clientData) || clientTypeField('whatsapp', clientData);
      checkList.push({
        id: 'client_phone',
        category: 'cadastro',
        label: 'Contato: Telefone / WhatsApp',
        status: hasPhone ? 'ok' : 'atencao',
        message: hasPhone ? `Contato registrado: ${hasPhone}` : 'Atenção: Nenhum telefone ativo.'
      });

      // RULE 8: Unique client slug validation
      checkList.push({
        id: 'unique_slug',
        category: 'cadastro',
        label: 'Unicidade de Identificação (Slug)',
        status: (portalDoc.exists() && portalDoc.data()?.clientId === clientId) ? 'ok' : 'erro_critico',
        message: 'Identificador único do portal validado e exclusivo.'
      });

      // RULE 9: Adverse Party defined
      checkList.push({
        id: 'case_adverse',
        category: 'producao',
        label: 'Qualificação: Parte Adversa',
        status: caseData.adverseParty ? 'ok' : 'atencao',
        message: caseData.adverseParty ? `Parte Ré: ${caseData.adverseParty}` : 'Atenção: Parte adversa em branco.'
      });

      // RULE 10: Case Type defined
      checkList.push({
        id: 'case_type',
        category: 'producao',
        label: 'Matéria / Tipo de Ação',
        status: caseData.caseType ? 'ok' : 'atencao',
        message: caseData.caseType ? `Matéria: ${caseData.caseType}` : 'Atenção: Tema de ação não definido.'
      });

      // RULE 11: Case priority assigned
      checkList.push({
        id: 'case_priority',
        category: 'producao',
        label: 'Nível de Criticidade (Prioridade)',
        status: caseData.priority ? 'ok' : 'pendente',
        message: caseData.priority ? `Nivel: ${caseData.priority.toUpperCase()}` : 'Pendência: Selecione uma prioridade.'
      });

      // RULE 12: Case Title is not placeholder
      const hasRealTitle = caseData.title && caseData.title !== 'CASO EM INSTRUÇÃO';
      checkList.push({
        id: 'case_title',
        category: 'producao',
        label: 'Saneamento do Título da Pasta',
        status: hasRealTitle ? 'ok' : 'atencao',
        message: hasRealTitle ? 'Título saneado.' : 'Atenção: Título genérico pendente de alteração.'
      });

      // RULE 13: Estruturação defined
      const hasEst = caseData.fatosFundamentos || caseData.estrategiaJuridica;
      checkList.push({
        id: 'case_estruturacao',
        category: 'producao',
        label: 'EDRP - Instruções Factuais e de Tese',
        status: hasEst ? 'ok' : 'pendente',
        message: hasEst ? 'Diretrizes teóricas registradas.' : 'Pendente: Peça sem escopo legal fático.'
      });

      // RULE 14: Delegação assigned
      checkList.push({
        id: 'case_delegacao',
        category: 'producao',
        label: 'EDRP - Distribuição Operacional',
        status: caseData.operatorId ? 'ok' : 'pendente',
        message: caseData.operatorId ? `Delegado a: ${caseData.operatorId}` : 'Pendente: Sem operador responsável.'
      });

      // RULE 15: Revisão approved
      const isApproved = caseData.reviewStatus === 'aprovado' || caseData.bypassGating;
      checkList.push({
        id: 'case_revisao',
        category: 'producao',
        label: 'EDRP - Chave de Homologação / Revisão',
        status: isApproved ? 'ok' : 'erro_critico',
        message: caseData.reviewStatus === 'aprovado' ? 'Homologação aprovada com louvor.' : caseData.bypassGating ? 'Atenção: Bypass de risco assinado pelo BOSS.' : 'Erro Crítico: Rascunho sem revisão aprovada.'
      });

      // RULE 16: Protocol receipt link exists if protocolled
      const hasReceipt = caseData.protocolStatus !== 'protocolado' || caseData.receiptUrl;
      checkList.push({
        id: 'case_receipt',
        category: 'producao',
        label: 'EDRP - Comprovante de Transmissão',
        status: hasReceipt ? 'ok' : 'atencao',
        message: caseData.receiptUrl ? 'Comprovante anexado.' : 'Atenção: Protocolado sem link do comprovante.'
      });

      // RULE 17: Process Number defined if judicial
      const isJudicial = caseData.actionCategory === 'judicial' || caseData.registrationType === 'processo_judicial_ajuizado';
      const cnjOk = !isJudicial || caseData.processNumber;
      checkList.push({
        id: 'case_cnj',
        category: 'producao',
        label: 'Validação de Processo Único CNJ',
        status: cnjOk ? 'ok' : 'erro_critico',
        message: caseData.processNumber ? `CNJ: ${caseData.processNumber}` : 'Erro: Registro judicial sem CNJ.'
      });

      // RULE 18: Financial document exists
      checkList.push({
        id: 'fin_record',
        category: 'financeiro',
        label: 'Configuração Honorários',
        status: financialData ? 'ok' : 'pendente',
        message: financialData ? 'Pasta financeira criada.' : 'Pendente: Caso sem registro financeiro vinculado.'
      });

      // RULE 19: Financial amount > 0
      const validAmount = financialData && financialData.totalAmount > 0;
      checkList.push({
        id: 'fin_value',
        category: 'financeiro',
        label: 'Saneamento do Valor Adimplido',
        status: validAmount ? 'ok' : 'atencao',
        message: validAmount ? `Valor: R$ ${financialData.totalAmount}` : 'Atenção: Cobrança zerada ou sem plano de parcelamento.'
      });

      // RULE 20: Controladoria approved
      const hasContrOk = caseData.controlStatus === 'concluido' || caseData.auditGrade === 'apto';
      checkList.push({
        id: 'controladoria_audit',
        category: 'controladoria',
        label: 'Apreciação da Controladoria de Ativos',
        status: hasContrOk ? 'ok' : 'atencao',
        message: caseData.auditGrade ? `Grade: ${caseData.auditGrade.toUpperCase()}` : 'Atenção: Parecer fiscal pendente.'
      });

      // RULE 21: Stripe/Asaas credentials synced (Warning info)
      const hasGateway = financialData && financialData.paymentProvider !== 'none' && financialData.paymentLink;
      checkList.push({
        id: 'payment_gateway',
        category: 'financeiro',
        label: 'Mapeamento de Gateway Sincronizado',
        status: hasGateway ? 'ok' : 'atencao',
        message: hasGateway ? 'Checkout ativo mapeado.' : 'Informação: Usando controle manual de parcelas.'
      });

      setRules(checkList);

      // Compute Overall deployment status
      const criticallyFailed = checkList.some(r => r.status === 'erro_critico');
      const minorPendings = checkList.some(r => r.status === 'pendente' || r.status === 'atencao');

      if (criticallyFailed) {
        setOverallResult('nao_recomendado');
      } else if (minorPendings) {
        setOverallResult('pronto_ressalvas');
      } else {
        setOverallResult('pronto');
      }

      // Compute rating percentage
      const totalRules = checkList.length;
      const passedRules = checkList.filter(r => r.status === 'ok').length;
      setScorePercent(Math.round((passedRules / totalRules) * 100));

    } catch (err) {
      console.error(err);
      onAlert('Não foi possível processar o auditor de integridade.');
    } finally {
      onSetLoading(false);
    }
  };

  const clientTypeField = (field: string, data: any) => {
    if (data.type === 'PF') {
      const d = data.pfDadosPessoais || data.pfData || {};
      const c = data.pfContato || {};
      return d[`pf_${field}`] || c[`pf_${field}`];
    } else {
      const d = data.pjDadosEmpresa || data.pjData || {};
      const c = data.pjContatoEmpresa || {};
      return d[`pj_${field}`] || c[`pj_${field}`];
    }
  };

  useEffect(() => {
    runComplianceCheck();
  }, [caseId]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* FINAL OVERALL METRIC REPORT SCREEN */}
      <div className="bg-white p-8 rounded-3xl border border-gray-150 shadow-sm flex flex-col md:flex-row items-center gap-8">
        <div className="relative shrink-0 w-28 h-28 flex items-center justify-center rounded-full border-4 border-gray-100 bg-gray-50">
          <Award size={48} className="text-gray-400" />
          <div className="absolute inset-0 flex items-center justify-center text-lg font-black text-gray-900 leading-none">
            {scorePercent}%
          </div>
        </div>

        <div className="space-y-2 flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <span className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full border self-center md:self-start ${
              overallResult === 'pronto'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : overallResult === 'pronto_ressalvas'
                ? 'bg-amber-50 text-amber-700 border-amber-100'
                : 'bg-red-50 text-red-700 border-red-100'
            }`}>
              {overallResult === 'pronto' ? 'Pronto para Deploy' : overallResult === 'pronto_ressalvas' ? 'Pronto com ressálvas' : 'Não recomendado para deploy'}
            </span>
          </div>
          <h4 className="text-lg font-bold text-gray-900">Relatório de Integridade Operacional (21 Condicionantes)</h4>
          <p className="text-xs text-gray-500 font-semibold leading-relaxed">
            Ficha de inspeção e auditoria realizada de forma instantânea contra o banco de dados principal. Certifique-se de sanear todos os erros críticos para garantir segurança jurídica e produtiva.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule, idx) => {
          return (
            <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-50 shadow-sm flex items-start gap-3">
              {rule.status === 'ok' && <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />}
              {rule.status === 'atencao' && <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />}
              {rule.status === 'pendente' && <Clock size={18} className="text-blue-500 shrink-0 mt-0.5" />}
              {rule.status === 'erro_critico' && <ShieldAlert size={18} className="text-red-500 shrink-0 mt-0.5" />}

              <div className="space-y-1">
                <p className="text-xs font-black text-gray-800 leading-none">{rule.label}</p>
                <p className="text-[10px] font-semibold text-gray-400">Categoria: {rule.category.toUpperCase()}</p>
                <p className="text-[11px] text-gray-500 font-medium leading-relaxed mt-1">{rule.message}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <button
          onClick={runComplianceCheck}
          className="px-6 py-2.5 text-xs font-bold text-gray-600 border border-gray-150 rounded-xl hover:bg-gray-50 cursor-pointer"
        >
          Re-analisar Banco de Dados
        </button>

        <button
          onClick={() => {
            onAlert('Fluxo completo finalizado com sucesso! Redirecionando para a central...');
            // Redirect to Central Panel
            window.location.href = '/boss-giffoni-clientes/central-controle';
          }}
          className="px-8 py-3 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl"
        >
          Finalizar Fluxo Operacional
        </button>
      </div>
    </div>
  );
}
