import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { getNextStepRoute } from '../../../../lib/flowMatrix';

interface UseLeadStepNavigationProps {
  leadType: 'PF' | 'PJ';
  leadFormData: any;
  editLeadId: string | null;
  setError: (msg: string | null) => void;
  setSuccess: (msg: string | null) => void;
  setCreatedLeadId: (id: string | null) => void;
  setHasSaved: (saved: boolean) => void;
}

export function useLeadStepNavigation({
  leadType,
  leadFormData,
  editLeadId,
  setError,
  setSuccess,
  setCreatedLeadId,
  setHasSaved
}: UseLeadStepNavigationProps) {
  const navigate = useNavigate();
  const [navigatingStep2, setNavigatingStep2] = useState(false);

  const handleSaveAndNavigate = async () => {
    setError(null);
    setSuccess(null);
    setNavigatingStep2(true);

    try {
      // 1. Validation of essential mandatory fields
      if (leadType === 'PF') {
        const name = leadFormData.pessoaFisica?.nomeCompleto;
        if (!name || name.trim() === '') {
          throw new Error('O campo "Nome Completo" é obrigatório.');
        }
        if (leadFormData.origemLead === 'Indicação Direta') {
          if (!leadFormData.indicadoPorNome || leadFormData.indicadoPorNome.trim() === '') {
            throw new Error('O campo "Quem indicou o LEAD?" é obrigatório quando a origem é Indicação Direta.');
          }
        }
      } else {
        const companyName = leadFormData.pessoaJuridica?.razaoSocial;
        if (!companyName || companyName.trim() === '') {
          throw new Error('O campo "Razão Social" é obrigatório.');
        }
        if (leadFormData.origemLead === 'Indicação Direta') {
          if (!leadFormData.indicadoPorNome || leadFormData.indicadoPorNome.trim() === '') {
            throw new Error('O campo "Quem indicou o LEAD?" é obrigatório quando a origem é Indicação Direta.');
          }
        }
      }

      // 2. Prepare payload
      const newId = editLeadId || ('lead_' + Math.random().toString(36).substring(2, 11));
      const now = new Date().toISOString();

      let payload: any;

      if (leadType === 'PF') {
        const name = leadFormData.pessoaFisica.nomeCompleto || 'Lead PF sem Identificação';
        payload = {
          ...leadFormData,
          id: newId,
          tipoPessoa: 'PF',
          convertidoEmCliente: leadFormData.convertidoEmCliente || false,
          createdAt: leadFormData.createdAt || now,
          updatedAt: now,
          possuiProcesso: leadFormData.jaCliente === 'Já é Cliente',
          pessoaFisica: {
            ...leadFormData.pessoaFisica,
            nomeCompleto: name,
            cpf: leadFormData.pessoaFisica.cpf || '',
            rg: leadFormData.pessoaFisica.rg || '',
            dataNascimento: leadFormData.pessoaFisica.dataNascimento || '',
            estadoCivil: leadFormData.pessoaFisica.estadoCivil || 'Não fornecido',
            profissao: leadFormData.pessoaFisica.profissao || '',
            endereco: leadFormData.pessoaFisica.endereco || '',
            cidade: leadFormData.pessoaFisica.cidade || '',
            uf: leadFormData.pessoaFisica.uf || ''
          }
        };
      } else {
        const cargoReal = leadFormData.pessoaJuridica.cargoRepresentante === 'Outro'
          ? leadFormData.pessoaJuridica.cargoRepresentanteOutro
          : leadFormData.pessoaJuridica.cargoRepresentante;

        payload = {
          ...leadFormData,
          id: newId,
          tipoPessoa: 'PJ',
          convertidoEmCliente: leadFormData.convertidoEmCliente || false,
          createdAt: leadFormData.createdAt || now,
          updatedAt: now,
          possuiProcesso: leadFormData.jaCliente === 'Já é Cliente',
          pessoaJuridica: {
            ...leadFormData.pessoaJuridica,
            inscricaoEstadual: leadFormData.pessoaJuridica.inscricaoEstadual || '',
            cpfRepresentante: leadFormData.pessoaJuridica.cpfRepresentante || '',
            rgRepresentante: leadFormData.pessoaJuridica.rgRepresentante || '',
            endereco: leadFormData.pessoaJuridica.endereco || '',
            cidade: leadFormData.pessoaJuridica.cidade || '',
            uf: leadFormData.pessoaJuridica.uf || '',
            cargoRepresentante: cargoReal
          }
        };
      }

      // 3. Save to Firestore
      const docRef = doc(db, 'marketingLeads', newId);
      await setDoc(docRef, payload);

      // 4. Save to local storage backup
      try {
        const local = localStorage.getItem('local_marketing_leads');
        const list = local ? JSON.parse(local) : [];
        const filtered = list.filter((item: any) => item.id !== newId);
        localStorage.setItem('local_marketing_leads', JSON.stringify([payload, ...filtered]));
      } catch (e) {
        console.warn('Could not sync lead to local backup', e);
      }

      setCreatedLeadId(newId);
      setHasSaved(true);
      setSuccess(`Lead ${leadType === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'} salvo com sucesso!`);

      // 5. Query Canonical Flow Matrix & Navigate to Step 2
      const nextStepRoute = getNextStepRoute(leadType, 1, newId);
      navigate(nextStepRoute);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao salvar o LEAD e avançar para a Etapa 02.');
    } finally {
      setNavigatingStep2(false);
    }
  };

  return {
    navigatingStep2,
    handleSaveAndNavigate
  };
}
