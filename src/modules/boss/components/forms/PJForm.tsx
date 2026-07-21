import React from 'react';
import { formatCNPJ, formatCEP, formatPhone, fetchCEP, fetchCNPJ } from '../../../../lib/masks';

interface PJFormProps {
  data: any;
  onChange: (data: any) => void;
}

export const PJForm: React.FC<PJFormProps> = ({ data, onChange }) => {
  const lastFetchedCep = React.useRef('');

  React.useEffect(() => {
    const cep = data.pj_cepEmpresa || '';
    if (cep.length === 9 && lastFetchedCep.current !== cep) {
      const delayDebounceFn = setTimeout(async () => {
        lastFetchedCep.current = cep;
        const address = await fetchCEP(cep);
        if (address) {
          onChange({
            ...data,
            pj_enderecoEmpresa: address.street || address.logradouro || data.pj_enderecoEmpresa,
            pj_bairroEmpresa: address.neighborhood || address.bairro || data.pj_bairroEmpresa,
            pj_cidadeEmpresa: address.city || address.localidade || data.pj_cidadeEmpresa,
            pj_estadoEmpresa: address.state || address.uf || data.pj_estadoEmpresa
          });
        }
      }, 350);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [data.pj_cepEmpresa, onChange, data]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === 'pj_razaoSocial' || name === 'pj_nomeFantasia') {
      newValue = value.toUpperCase();
    } else if (name === 'pj_cnpj') {
      newValue = formatCNPJ(value);
    } else if (name === 'pj_cepEmpresa') {
      newValue = formatCEP(value);
    } else if (name === 'pj_telefoneEmpresa' || name === 'pj_whatsappEmpresa') {
      newValue = formatPhone(value);
    }

    if (name === 'pj_telefoneEmpresa' && data.pj_possuiWhatsappEmpresa) {
      onChange({ ...data, pj_telefoneEmpresa: newValue, pj_whatsappEmpresa: newValue });
    } else {
      onChange({ ...data, [name]: newValue });
    }
  };

  const handleCEPBlur = async () => {
    if (data.pj_cepEmpresa?.length === 9) {
      const address = await fetchCEP(data.pj_cepEmpresa);
      if (address) {
        onChange({
          ...data,
          pj_enderecoEmpresa: address.street || address.logradouro || data.pj_enderecoEmpresa,
          pj_bairroEmpresa: address.neighborhood || address.bairro || data.pj_bairroEmpresa,
          pj_cidadeEmpresa: address.city || address.localidade || data.pj_cidadeEmpresa,
          pj_estadoEmpresa: address.state || address.uf || data.pj_estadoEmpresa
        });
      }
    }
  };

  const handleCNPJBlur = async () => {
    if (data.pj_cnpj?.length === 18) {
      const company = await fetchCNPJ(data.pj_cnpj);
      if (company) {
        onChange({
          ...data,
          pj_razaoSocial: company.razao_social || data.pj_razaoSocial,
          pj_nomeFantasia: company.nome_fantasia || company.razao_social || data.pj_nomeFantasia,
          pj_emailEmpresa: company.email || data.pj_emailEmpresa,
          pj_telefoneEmpresa: company.ddd_telefone_1 ? formatPhone(company.ddd_telefone_1) : data.pj_telefoneEmpresa,
          pj_cepEmpresa: company.cep ? formatCEP(company.cep) : data.pj_cepEmpresa,
          pj_enderecoEmpresa: company.logradouro || data.pj_enderecoEmpresa,
          pj_numeroEmpresa: company.numero || data.pj_numeroEmpresa,
          pj_bairroEmpresa: company.bairro || data.pj_bairroEmpresa,
          pj_cidadeEmpresa: company.municipio || data.pj_cidadeEmpresa,
          pj_estadoEmpresa: company.uf || data.pj_estadoEmpresa
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-[18px] font-bold text-purple-600 uppercase tracking-wider mb-6">BLOCO pjDadosEmpresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="CNPJ (Smart)" name="pj_cnpj" value={data.pj_cnpj || ''} onChange={handleChange} onBlur={handleCNPJBlur} placeholder="00.000.000/0000-00" required />
          <Input label="Razão Social" name="pj_razaoSocial" value={data.pj_razaoSocial || ''} onChange={handleChange} className="uppercase" required />
          <Input label="Nome Fantasia" name="pj_nomeFantasia" value={data.pj_nomeFantasia || ''} onChange={handleChange} className="uppercase" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-[18px] font-bold text-purple-600 uppercase tracking-wider mb-6">BLOCO pjContatoEmpresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="E-mail da Empresa" name="pj_emailEmpresa" type="email" value={data.pj_emailEmpresa || ''} onChange={handleChange} />
          
          <div className="flex flex-col gap-1 w-full">
            <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">Telefone da Empresa</label>
            <div className="flex items-center gap-2.5 w-full">
              <div className="relative flex-1 min-w-0">
                <input
                  name="pj_telefoneEmpresa"
                  value={data.pj_telefoneEmpresa || ''}
                  onChange={handleChange}
                  placeholder="(00) 9 0000-0000"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-purple-105 focus:bg-white outline-none transition-all placeholder:text-gray-300"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-purple-600 cursor-pointer select-none shrink-0 border border-purple-105 bg-purple-50/50 hover:bg-purple-50 px-3.5 py-3 rounded-xl transition-all h-[46px] sm:h-[52px]">
                <input 
                  type="checkbox" 
                  checked={data.pj_possuiWhatsappEmpresa || false} 
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    onChange({
                      ...data,
                      pj_possuiWhatsappEmpresa: isChecked,
                      pj_whatsappEmpresa: isChecked ? (data.pj_telefoneEmpresa || '') : ''
                    });
                  }}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                Possui WhatsApp Empresa
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-[18px] font-bold text-purple-600 uppercase tracking-wider mb-6">BLOCO pjEnderecoEmpresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="CEP (Smart)" name="pj_cepEmpresa" value={data.pj_cepEmpresa || ''} onChange={handleChange} onBlur={handleCEPBlur} placeholder="00000-000" />
          <div className="md:col-span-2">
            <Input label="Endereço" name="pj_enderecoEmpresa" value={data.pj_enderecoEmpresa || ''} onChange={handleChange} />
          </div>
          <Input label="Número" name="pj_numeroEmpresa" value={data.pj_numeroEmpresa || ''} onChange={handleChange} />
          <Input label="Complemento" name="pj_complementoEmpresa" value={data.pj_complementoEmpresa || ''} onChange={handleChange} />
          <Input label="Bairro" name="pj_bairroEmpresa" value={data.pj_bairroEmpresa || ''} onChange={handleChange} />
          <Input label="Cidade" name="pj_cidadeEmpresa" value={data.pj_cidadeEmpresa || ''} onChange={handleChange} />
          <Input label="Estado" name="pj_estadoEmpresa" value={data.pj_estadoEmpresa || ''} onChange={handleChange} />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-[18px] font-bold text-purple-600 uppercase tracking-wider mb-6">BLOCO pjRedesSociaisEmpresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Instagram" name="pj_instagramEmpresa" value={data.pj_instagramEmpresa || ''} onChange={handleChange} />
          <Input label="Facebook" name="pj_facebookEmpresa" value={data.pj_facebookEmpresa || ''} onChange={handleChange} />
          <Input label="TikTok" name="pj_tiktokEmpresa" value={data.pj_tiktokEmpresa || ''} onChange={handleChange} />
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, ...props }: any) => (
  <div>
    <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">{label}</label>
    <input
      {...props}
      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-purple-100 focus:bg-white outline-none transition-all placeholder:text-gray-300"
    />
  </div>
);
