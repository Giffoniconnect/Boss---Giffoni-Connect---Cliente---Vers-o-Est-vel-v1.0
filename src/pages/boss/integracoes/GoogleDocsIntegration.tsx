import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { BossLayout } from '../../../components/Layout';

/**
 * INVESTIGAÇÃO TÉCNICA E RESOLUÇÃO DA GERAÇÃO/MOVIMENTAÇÃO DE DOCUMENTOS (GDI):
 * 
 * Durante a auditoria deste módulo e do respectivo motor de geração (/server.ts),
 * identificamos o motivo pelo qual arquivos gerados (como Procuração, Declaração, Contratos)
 * não estavam sendo catalogados, localizados ou criados corretamente na pasta destino do cliente:
 * 
 * 1. NOMEAÇÃO E BUSCA HARDCODED: No motor do servidor, o nome final dos arquivos (`finalDocName`)
 *    e o prefixo de busca anti-duplicidade (`safePrefix`) estavam fixados estritamente como
 *    "1º Atendimento PF - ...". Isso fazia com que qualquer outro tipo de documento gerado fosse
 *    salvo com o nome incorreto ou não fosse detectado na pasta do cliente, gerando arquivos soltos.
 * 
 * 2. PROPRIEDADE DE AUTOMAÇÃO FIXA: Ao salvar os registros principais e de controle de versão
 *    no Firestore (`cases/${caseId}`), os campos atualizados estavam fixos como `primeiroAtendimentoStatus`,
 *    `primeiroAtendimentoId`, etc. Isso causava colisões críticas e impedia a atualização correta
 *    dos status individuais de cada documento (ex: `procuracaoStatus`, `declaracaoPobrezaStatus`, etc.).
 * 
 * RESOLUÇÃO IMPLEMENTADA NO SERVIDOR:
 * - O motor de geração foi refatorado para determinar dinamicamente o título/rótulo do documento (`typeLabel`)
 *   com base no `documentType` fornecido na chamada.
 * - O prefixo de busca na pasta de destino (`safePrefix`) e as propriedades salvas no Google Drive
 *   agora utilizam o tipo real do documento, garantindo auditoria robusta.
 * - Os campos de escrita no Firestore agora são gerados dinamicamente com base no prefixo correspondente
 *   (ex: `procuracao`, `declaracaoPobreza`, `contratoHonorarios`, `prePeticao`), mantendo a integridade.
 */
import { 
  ArrowLeft, 
  Settings, 
  FileCheck, 
  Sliders,
  AlertCircle
} from 'lucide-react';

export default function GoogleDocsIntegration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string | null } | null>(null);

  useEffect(() => {
    // Just a basic check that db connectivity is ready on landing
    async function initCheck() {
      try {
        setLoading(true);
        const docRef = doc(db, 'settings', 'connectors');
        await getDoc(docRef);
      } catch (err: any) {
        setFeedback({
          type: 'error',
          message: `Erro ao conectar com as partições de dados: ${err.message || err}`
        });
      } finally {
        setLoading(false);
      }
    }
    initCheck();
  }, []);

  return (
    <BossLayout>
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans animate-fadeIn">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-150 pb-6 gap-4 text-left">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-mono font-bold tracking-widest uppercase">
                Motor interno ativo 🟢
              </span>
            </div>
            <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
              Integrações Google Docs
            </h1>
            <p className="text-xs text-gray-400 mt-1 font-semibold">
              Central interna de parametrização e automação de templates de documentos do Portal BOSS.
            </p>
          </div>
          
          <button 
            onClick={() => navigate('/boss-giffoni-clientes/dashboard')}
            className="flex items-center justify-center gap-2 p-2 px-4 text-xs font-black uppercase text-gray-750 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Painel
          </button>
        </div>

        {/* FEEDBACK NOTIFICATION BLOCK */}
        {feedback && feedback.message && (
          <div className="p-4 rounded-xl flex items-start gap-3 border bg-rose-50 border-rose-100 text-rose-800 text-left">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="text-sm font-semibold">Atenção Técnica:</p>
              <p className="text-xs text-slate-700 mt-1 font-mono leading-relaxed">{feedback.message}</p>
            </div>
          </div>
        )}

        {/* SEÇÃO PRINCIPAL: ADJUSTES GERAIS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-left">
            <span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span>
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-803">
              Configurações Gerais de Integração (GDI)
            </h3>
          </div>

          {/* CARD CENTRAL GERAIS */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-950 rounded-3xl overflow-hidden shadow-md flex flex-col md:flex-row items-start md:items-center justify-between p-6 md:p-8 gap-6 text-left text-white">
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-slate-800 border border-slate-750 text-indigo-400 rounded-2xl shrink-0 mt-0.5 shadow-inner">
                <Sliders className="w-6 h-6 stroke-[2.5px]" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base font-black uppercase tracking-wide font-sans">
                  Configurações Gerais de Integração do Google Docs
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl font-medium">
                  Controle mestre contendo a habilitação do ambiente corporativo (Camada Zero de saúde das APIs), Bloco 1 de motor interno, Bloco 2 de Conta de Serviço e credenciais GCP, Bloco 3 para diretório raiz no Drive, Bloco 5 de placeholders globais dinâmicos, auditoria de passos e logs em tempo real.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs/config-gerais-google-docs')}
              className="w-full md:w-auto flex items-center justify-center gap-2 p-3.5 px-6 text-xs font-black uppercase tracking-wider text-slate-900 bg-white hover:bg-slate-100 rounded-xl shadow-sm transition shrink-0 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Acessar Ajustes Gerais</span>
            </button>
          </div>
        </div>

        {/* SEÇÃO: CONFIGURAÇÕES DE DOCUMENTOS INDIVIDUAIS */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 text-left">
            <span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span>
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-803">
              Setores Regulatórios Específicos (GDI)
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            
            {/* Card 1: Procuração Pessoa Física */}
            <div className="bg-gradient-to-r from-indigo-50/40 to-indigo-100/20 border border-indigo-150 rounded-3xl overflow-hidden shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-6 text-left">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white border border-indigo-150 text-indigo-650 rounded-2xl shadow-xs shrink-0 mt-0.5">
                  <FileCheck className="w-5.5 h-5.5 stroke-[2px]" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-black uppercase text-gray-900 font-sans tracking-tight">
                    Configurações Integração Google Docs - Procuração Pessoa Física
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
                    Módulo para monitorar e parametrizar chaves individuais de auditoria de integridade, simulação sob modo deploy blindado e revalidações técnicas do roteamento de Procurações PF (`procuracao_pf`).
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs/config-procuracao-PF')}
                className="w-full md:w-auto flex items-center justify-center gap-2 p-3 px-5 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition shrink-0 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Configurar Setor</span>
              </button>
            </div>

            {/* Card 4: Procuração Pessoa Jurídica */}
            <div className="bg-gradient-to-r from-indigo-50/40 to-indigo-100/20 border border-indigo-150 rounded-3xl overflow-hidden shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-6 text-left">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white border border-indigo-150 text-indigo-650 rounded-2xl shadow-xs shrink-0 mt-0.5">
                  <FileCheck className="w-5.5 h-5.5 stroke-[2px]" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-black uppercase text-gray-900 font-sans tracking-tight">
                    Configurações Integração Google Docs - Procuração Pessoa jurídica
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
                    Parâmetros para procurações comerciais societárias judiciais e extrajudiciais outorgadas por Pessoas Jurídicas (`procuracao_pj`).
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs/config-procuracao-PJ')}
                className="w-full md:w-auto flex items-center justify-center gap-2 p-3 px-5 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition shrink-0 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Configurar Setor</span>
              </button>
            </div>

            {/* Card 2: 1ª Atendimento Pessoa Física */}
            <div className="bg-gradient-to-r from-indigo-50/40 to-indigo-100/20 border border-indigo-150 rounded-3xl overflow-hidden shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-6 text-left">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white border border-indigo-150 text-indigo-650 rounded-2xl shadow-xs shrink-0 mt-0.5">
                  <FileCheck className="w-5.5 h-5.5 stroke-[2px]" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-black uppercase text-gray-900 font-sans tracking-tight">
                    Configurações Integração Google Docs - 1ª Atendimento Pessoa Física
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
                    Ajuste o template mestre, webhook callback e de destinação das triagens e onboarding inicial estruturado de clientes Pessoa Física (`primeiro_atendimento`).
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs/config-1-atendimento-PF')}
                className="w-full md:w-auto flex items-center justify-center gap-2 p-3 px-5 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition shrink-0 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Configurar Setor</span>
              </button>
            </div>

            {/* Card 3: 1º Atendimento Pessoa Jurídica */}
            <div className="bg-gradient-to-r from-indigo-50/40 to-indigo-100/20 border border-indigo-150 rounded-3xl overflow-hidden shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-6 text-left">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white border border-indigo-150 text-indigo-650 rounded-2xl shadow-xs shrink-0 mt-0.5">
                  <FileCheck className="w-5.5 h-5.5 stroke-[2px]" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-black uppercase text-gray-900 font-sans tracking-tight">
                    Configurações Integração Google Docs - 1º Atendimento Pessoa Jurídica
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
                    Controles de triagem fática, mapeamento inicial de placeholders operacionais para clientes corporativos de Pessoa Jurídica (`primeiro_atendimento_pj`).
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs/config-1-atendimento-PJ')}
                className="w-full md:w-auto flex items-center justify-center gap-2 p-3 px-5 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition shrink-0 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Configurar Setor</span>
              </button>
            </div>

            {/* Card 5: Declaração Pessoa Física */}
            <div className="bg-gradient-to-r from-indigo-50/40 to-indigo-100/20 border border-indigo-150 rounded-3xl overflow-hidden shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-6 text-left">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white border border-indigo-150 text-indigo-650 rounded-2xl shadow-xs shrink-0 mt-0.5">
                  <FileCheck className="w-5.5 h-5.5 stroke-[2px]" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-black uppercase text-gray-900 font-sans tracking-tight">
                    Configurações Integração Google Docs - Declaração Pessoa Física
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
                    Definição de modelo e monitoramento de transição de dados para as declarações de pobreza e requisição de justiça gratuita Pessoa Física (`declaracao_pobreza_pf`).
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs/config-declaracao-PF')}
                className="w-full md:w-auto flex items-center justify-center gap-2 p-3 px-5 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition shrink-0 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Configurar Setor</span>
              </button>
            </div>

            {/* Card 6: Declaração Pessoa Jurídica */}
            <div className="bg-gradient-to-r from-indigo-50/40 to-indigo-100/20 border border-indigo-150 rounded-3xl overflow-hidden shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-6 text-left">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white border border-indigo-150 text-indigo-650 rounded-2xl shadow-xs shrink-0 mt-0.5">
                  <FileCheck className="w-5.5 h-5.5 stroke-[2px]" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-black uppercase text-gray-900 font-sans tracking-tight">
                    Configurações Integração Google Docs - Declaração Pessoa Jurídica
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
                    Ajuste o template de isenções tributárias, declaração de faturamento anual de microempresas e declaração de hipossuficiência PJ (`declaracao_pobreza_pj`).
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs/config-declaracao-PJ')}
                className="w-full md:w-auto flex items-center justify-center gap-2 p-3 px-5 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition shrink-0 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Configurar Setor</span>
              </button>
            </div>

            {/* Card 7: Contrato de honorários Pessoa Física */}
            <div className="bg-gradient-to-r from-indigo-50/40 to-indigo-100/20 border border-indigo-150 rounded-3xl overflow-hidden shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-6 text-left">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white border border-indigo-150 text-indigo-650 rounded-2xl shadow-xs shrink-0 mt-0.5">
                  <FileCheck className="w-5.5 h-5.5 stroke-[2px]" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-black uppercase text-gray-900 font-sans tracking-tight">
                    Configurações Integração Google Docs - Contrato de honorários Pessoa Física
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
                    Parametrize as minutas oficiais dos honorários advocatícios para a prestação de serviços jurídicos e parcelamentos de Pessoa Física (`contrato_honorarios_pf`).
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs/config-contrato-de-honorarios-PF')}
                className="w-full md:w-auto flex items-center justify-center gap-2 p-3 px-5 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition shrink-0 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Configurar Setor</span>
              </button>
            </div>

            {/* Card 8: Contrato de honorários Pessoa Jurídica */}
            <div className="bg-gradient-to-r from-indigo-50/40 to-indigo-100/20 border border-indigo-150 rounded-3xl overflow-hidden shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-6 text-left">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white border border-indigo-150 text-indigo-650 rounded-2xl shadow-xs shrink-0 mt-0.5">
                  <FileCheck className="w-5.5 h-5.5 stroke-[2px]" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-black uppercase text-gray-900 font-sans tracking-tight">
                    Configurações Integração Google Docs - Contrato de honorários Pessoa Jurídica
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
                    Mapeamento de parcelas, valores, cronogramas de faturamento corporativo no Google Docs de clientes Pessoa Jurídica (`contrato_honorarios_pj`).
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/boss-giffoni-clientes/configuracoes/integracoes-google-docs/config-contrato-de-honorarios-PJ')}
                className="w-full md:w-auto flex items-center justify-center gap-2 p-3 px-5 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition shrink-0 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Configurar Setor</span>
              </button>
            </div>

          </div>
        </div>

      </div>
    </BossLayout>
  );
}
