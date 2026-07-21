import React from 'react';
import { formatCPF, formatCEP, formatPhone, fetchCEP, formatDate } from '../../../../lib/masks';

const ESTADOS_CIVIS = [
  '',
  'Solteiro(a)',
  'Casado(a)',
  'Divorciado(a)',
  'Viúvo(a)',
  'União Estável',
  'Separado(a) Judicialmente'
];

const PROFISSOES_SUGESTOES = [
  'Advogado(a)',
  'Médico(a)',
  'Engenheiro(a)',
  'Professor(a)',
  'Contador(a)',
  'Empresário(a)',
  'Vendedor(a)',
  'Administrador(a)',
  'Analista de Sistemas',
  'Autônomo(a)',
  'Aposentado(a)',
  'Estudante',
  'Dona de casa',
  'Arquiteto(a)',
  'Psicólogo(a)',
  'Motorista',
  'Cozinheiro(a)',
  'Militar',
  'Funcionário Público'
];

const NACIONALIDADES_SUGESTOES = [
  'Brasileira',
  'Portuguesa',
  'Americana',
  'Italiana',
  'Espanhola',
  'Alemã',
  'Francesa',
  'Argentina',
  'Chilena',
  'Uruguaia',
  'Paraguaia',
  'Mexicana',
  'Japonesa',
  'Chinesa'
];

interface PFFormProps {
  data: any;
  onChange: (data: any) => void;
  isVerticalFlow?: boolean;
}

export const PFForm: React.FC<PFFormProps> = ({ data, onChange, isVerticalFlow = false }) => {
  const lastFetchedCep = React.useRef('');

  React.useEffect(() => {
    const cep = data.pf_cep || '';
    if (cep.length === 9 && lastFetchedCep.current !== cep) {
      const delayDebounceFn = setTimeout(async () => {
        lastFetchedCep.current = cep;
        const address = await fetchCEP(cep);
        if (address) {
          onChange({
            ...data,
            pf_endereco: address.street || address.logradouro || data.pf_endereco,
            pf_bairro: address.neighborhood || address.bairro || data.pf_bairro,
            pf_cidade: address.city || address.localidade || data.pf_cidade,
            pf_estado: address.state || address.uf || data.pf_estado
          });
        }
      }, 350);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [data.pf_cep, onChange, data]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === 'pf_nomeCompleto' || name === 'pf_nomePai' || name === 'pf_nomeMae') {
      newValue = value.toUpperCase();
    } else if (name === 'pf_profissao' || name === 'pf_nacionalidade') {
      newValue = value.charAt(0).toUpperCase() + value.slice(1);
    } else if (name === 'pf_cpf') {
      newValue = formatCPF(value);
    } else if (name === 'pf_cep') {
      newValue = formatCEP(value);
    } else if (name === 'pf_telefone' || name === 'pf_whatsapp') {
      newValue = formatPhone(value);
    } else if (name === 'pf_dataNascimento') {
      newValue = formatDate(value);
      onChange({ ...data, pf_dataNascimento: newValue, pf_nascimento: newValue });
      return;
    }

    if (name === 'pf_telefone' && data.pf_possuiWhatsapp) {
      onChange({ ...data, pf_telefone: newValue, pf_whatsapp: newValue });
    } else {
      onChange({ ...data, [name]: newValue });
    }
  };

  const handleCEPBlur = async () => {
    if (data.pf_cep?.length === 9) {
      const address = await fetchCEP(data.pf_cep);
      if (address) {
        onChange({
          ...data,
          pf_endereco: address.street || address.logradouro || data.pf_endereco,
          pf_bairro: address.neighborhood || address.bairro || data.pf_bairro,
          pf_cidade: address.city || address.localidade || data.pf_cidade,
          pf_estado: address.state || address.uf || data.pf_estado
        });
      }
    }
  };

  const handleRGNew = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onChange({ ...data, pf_rg: 'RG novo' });
    } else if (data.pf_rg === 'RG novo') {
      onChange({ ...data, pf_rg: '' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-[18px] font-bold text-blue-600 uppercase tracking-wider mb-6">BLOCO pfDadosPessoais</h3>
        {isVerticalFlow ? (
          <div className="flex flex-col gap-4">
            <Input label="Nome completo" name="pf_nomeCompleto" value={data.pf_nomeCompleto || ''} onChange={handleChange} className="uppercase" required />
            
            <AutocompleteInput 
              label="Nacionalidade" 
              name="pf_nacionalidade" 
              value={data.pf_nacionalidade || 'Brasileira'} 
              onChange={handleChange} 
              suggestions={NACIONALIDADES_SUGESTOES}
            />
            
            <Select label="Estado Civil" name="pf_estadoCivil" value={data.pf_estadoCivil || ''} onChange={handleChange} options={ESTADOS_CIVIS} />
            
            <ProfessionAutocompleteInput 
              label="Profissão" 
              name="pf_profissao" 
              value={data.pf_profissao || ''} 
              onChange={handleChange} 
            />
            
            <Input label="CPF com mascara" name="pf_cpf" value={data.pf_cpf || ''} onChange={handleChange} placeholder="000.000.000-00" required />
            
            <div className="flex flex-col gap-1">
              <label className="block text-[15px] font-bold text-gray-500 ml-1">RG</label>
              <div className="flex items-center gap-3 w-full">
                <div className="relative flex-1 min-w-0">
                  <input
                    name="pf_rg"
                    value={data.pf_rg || ''}
                    onChange={handleChange}
                    disabled={data.pf_rg === 'RG novo'}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-105 focus:bg-white outline-none transition-all placeholder:text-gray-300 disabled:opacity-60"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-blue-600 cursor-pointer select-none shrink-0 border border-blue-105 bg-blue-50/50 hover:bg-blue-50 px-3.5 py-3 rounded-xl transition-all h-[52px]">
                  <input 
                    type="checkbox" 
                    checked={data.pf_rg === 'RG novo'} 
                    onChange={handleRGNew}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  RG novo
                </label>
              </div>
            </div>

            <Input label="Data de Nascimento" name="pf_dataNascimento" type="text" placeholder="DD/MM/AAAA" value={data.pf_dataNascimento || data.pf_nascimento || ''} onChange={handleChange} />
            
            <Input label="Nome completo do pai" name="pf_nomePai" value={data.pf_nomePai || ''} onChange={handleChange} className="uppercase" />
            
            <Input label="Nome completo da mãe" name="pf_nomeMae" value={data.pf_nomeMae || ''} onChange={handleChange} className="uppercase" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nome Completo" name="pf_nomeCompleto" value={data.pf_nomeCompleto || ''} onChange={handleChange} className="uppercase" required />
            <AutocompleteInput 
              label="Nacionalidade" 
              name="pf_nacionalidade" 
              value={data.pf_nacionalidade || 'Brasileira'} 
              onChange={handleChange} 
              suggestions={NACIONALIDADES_SUGESTOES}
            />
            <div className="md:col-span-1">
              <Select label="Estado Civil" name="pf_estadoCivil" value={data.pf_estadoCivil || ''} onChange={handleChange} options={ESTADOS_CIVIS} />
            </div>
            <ProfessionAutocompleteInput 
              label="Profissão" 
              name="pf_profissao" 
              value={data.pf_profissao || ''} 
              onChange={handleChange} 
            />
            
            <Input label="CPF (com máscara)" name="pf_cpf" value={data.pf_cpf || ''} onChange={handleChange} placeholder="000.000.000-00" required />
            
            <div className="flex flex-col gap-1">
              <label className="block text-[15px] font-bold text-gray-500 ml-1">RG</label>
              <div className="flex items-center gap-3 w-full">
                <div className="relative flex-1 min-w-0">
                  <input
                    name="pf_rg"
                    value={data.pf_rg || ''}
                    onChange={handleChange}
                    disabled={data.pf_rg === 'RG novo'}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-105 focus:bg-white outline-none transition-all placeholder:text-gray-300 disabled:opacity-60"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-blue-600 cursor-pointer select-none shrink-0 border border-blue-105 bg-blue-50/50 hover:bg-blue-50 px-3.5 py-3 rounded-xl transition-all">
                  <input 
                    type="checkbox" 
                    checked={data.pf_rg === 'RG novo'} 
                    onChange={handleRGNew}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  RG novo
                </label>
              </div>
            </div>

            <Input label="Data de Nascimento" name="pf_dataNascimento" type="text" placeholder="DD/MM/AAAA" value={data.pf_dataNascimento || data.pf_nascimento || ''} onChange={handleChange} />
            <Input label="Nome Completo do Pai" name="pf_nomePai" value={data.pf_nomePai || ''} onChange={handleChange} className="uppercase" />
            <Input label="Nome Completo da Mãe" name="pf_nomeMae" value={data.pf_nomeMae || ''} onChange={handleChange} className="uppercase" />
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-[18px] font-bold text-blue-600 uppercase tracking-wider mb-6">BLOCO pfContato</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="E-mail" name="pf_email" type="email" value={data.pf_email || ''} onChange={handleChange} required />
          
          <div className="flex flex-col gap-1 w-full">
            <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">Telefone / Celular</label>
            <div className="flex items-center gap-2.5 w-full">
              <div className="relative flex-1 min-w-0">
                <input
                  name="pf_telefone"
                  value={data.pf_telefone || ''}
                  onChange={handleChange}
                  placeholder="(00) 9 0000-0000"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-105 focus:bg-white outline-none transition-all placeholder:text-gray-300"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-blue-600 cursor-pointer select-none shrink-0 border border-blue-105 bg-blue-50/50 hover:bg-blue-50 px-3.5 py-3 rounded-xl transition-all h-[46px] sm:h-[52px]">
                <input 
                  type="checkbox" 
                  checked={data.pf_possuiWhatsapp || false} 
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    onChange({
                      ...data,
                      pf_possuiWhatsapp: isChecked,
                      pf_whatsapp: isChecked ? (data.pf_telefone || '') : ''
                    });
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                Possui WhatsApp
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-[18px] font-bold text-blue-600 uppercase tracking-wider mb-6">BLOCO pfEndereco</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="CEP (Smart)" name="pf_cep" value={data.pf_cep || ''} onChange={handleChange} onBlur={handleCEPBlur} placeholder="00000-000" />
          <div className="md:col-span-2">
            <Input label="Endereço" name="pf_endereco" value={data.pf_endereco || ''} onChange={handleChange} />
          </div>
          <Input label="Número" name="pf_numero" value={data.pf_numero || ''} onChange={handleChange} />
          <Input label="Complemento" name="pf_complemento" value={data.pf_complemento || ''} onChange={handleChange} />
          <Input label="Bairro" name="pf_bairro" value={data.pf_bairro || ''} onChange={handleChange} />
          <Input label="Cidade" name="pf_cidade" value={data.pf_cidade || ''} onChange={handleChange} />
          <Input label="Estado" name="pf_estado" value={data.pf_estado || ''} onChange={handleChange} />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-[18px] font-bold text-blue-600 uppercase tracking-wider mb-6">BLOCO pfRedesSociais</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Instagram */}
          <div className="flex flex-col gap-1 w-full">
            <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">Instagram</label>
            <div className="flex items-center gap-2.5 w-full">
              <div className="relative flex-1 min-w-0">
                <input
                  name="pf_instagram"
                  value={data.pf_instagram || ''}
                  onChange={handleChange}
                  disabled={data.pf_instagram === 'Não possuo'}
                  placeholder="@usuario"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-105 focus:bg-white outline-none transition-all placeholder:text-gray-300 disabled:opacity-60"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-blue-600 cursor-pointer select-none shrink-0 border border-blue-105 bg-blue-50/50 hover:bg-blue-50 px-3 py-3 rounded-xl transition-all h-[46px] sm:h-[52px]">
                <input 
                  type="checkbox" 
                  checked={data.pf_instagram === 'Não possuo'} 
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange({ ...data, pf_instagram: 'Não possuo' });
                    } else {
                      onChange({ ...data, pf_instagram: '' });
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                Não possuo
              </label>
            </div>
          </div>

          {/* Facebook */}
          <div className="flex flex-col gap-1 w-full">
            <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">Facebook</label>
            <div className="flex items-center gap-2.5 w-full">
              <div className="relative flex-1 min-w-0">
                <input
                  name="pf_facebook"
                  value={data.pf_facebook || ''}
                  onChange={handleChange}
                  disabled={data.pf_facebook === 'Não possuo'}
                  placeholder="link/usuario"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-105 focus:bg-white outline-none transition-all placeholder:text-gray-300 disabled:opacity-60"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-blue-600 cursor-pointer select-none shrink-0 border border-blue-105 bg-blue-50/50 hover:bg-blue-50 px-3 py-3 rounded-xl transition-all h-[46px] sm:h-[52px]">
                <input 
                  type="checkbox" 
                  checked={data.pf_facebook === 'Não possuo'} 
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange({ ...data, pf_facebook: 'Não possuo' });
                    } else {
                      onChange({ ...data, pf_facebook: '' });
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                Não possuo
              </label>
            </div>
          </div>

          {/* TikTok */}
          <div className="flex flex-col gap-1 w-full">
            <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">TikTok</label>
            <div className="flex items-center gap-2.5 w-full">
              <div className="relative flex-1 min-w-0">
                <input
                  name="pf_tiktok"
                  value={data.pf_tiktok || ''}
                  onChange={handleChange}
                  disabled={data.pf_tiktok === 'Não possuo'}
                  placeholder="@usuario"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-105 focus:bg-white outline-none transition-all placeholder:text-gray-300 disabled:opacity-60"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-blue-600 cursor-pointer select-none shrink-0 border border-blue-105 bg-blue-50/50 hover:bg-blue-50 px-3 py-3 rounded-xl transition-all h-[46px] sm:h-[52px]">
                <input 
                  type="checkbox" 
                  checked={data.pf_tiktok === 'Não possuo'} 
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange({ ...data, pf_tiktok: 'Não possuo' });
                    } else {
                      onChange({ ...data, pf_tiktok: '' });
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                Não possuo
              </label>
            </div>
          </div>

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
      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-100 focus:bg-white outline-none transition-all placeholder:text-gray-300"
    />
  </div>
);

const AutocompleteInput = ({ label, suggestions, value, onChange, name, ...props }: any) => {
  const [suggestion, setSuggestion] = React.useState('');

  React.useEffect(() => {
    if (!value) {
      setSuggestion('');
      return;
    }

    const match = suggestions.find((s: string) => 
      s.toLowerCase().startsWith(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()
    );

    if (match) {
      setSuggestion(value + match.slice(value.length));
    } else {
      setSuggestion('');
    }
  }, [value, suggestions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      onChange({ target: { name, value: suggestion } });
      setSuggestion('');
    }
  };

  return (
    <div className="relative">
      <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">{label}</label>
      <div className="relative">
        {suggestion && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none select-none px-0.5 py-px">
            {suggestion}
          </div>
        )}
        <input
          {...props}
          name={name}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-100 focus:bg-white outline-none transition-all placeholder:text-gray-300 relative z-10 bg-transparent"
        />
      </div>
    </div>
  );
};

const Select = ({ label, options, ...props }: any) => (
  <div>
    <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">{label}</label>
    <select
      {...props}
      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-100 focus:bg-white outline-none transition-all"
    >
      {options.map((opt: string) => (
         <option key={opt} value={opt}>{opt || 'Selecione...'}</option>
      ))}
    </select>
  </div>
);

const ProfessionAutocompleteInput = ({ label, value, onChange, name, ...props }: any) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [filtered, setFiltered] = React.useState<string[]>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);

  const professionsList = [
    'Advogado', 'Advogada', 'Administrador', 'Administradora', 'Empresário', 'Empresária',
    'Comerciante', 'Autônomo', 'Autônoma', 'Aposentado', 'Aposentada', 'Pensionista',
    'Professor', 'Professora', 'Médico', 'Médica', 'Enfermeiro', 'Enfermeira',
    'Engenheiro', 'Engenheira', 'Contador', 'Contadora', 'Motorista', 'Caminhoneiro',
    'Produtor Rural', 'Trabalhador Rural', 'Estudante', 'Do Lar', 'Servidor Público',
    'Servidora Pública', 'Técnico em Enfermagem', 'Auxiliar Administrativo', 'Pedreiro',
    'Eletricista', 'Mecânico', 'Vendedor', 'Vendedora', 'Bancário', 'Bancária',
    'Militar', 'Policial', 'Vigilante', 'Diarista', 'Empregada Doméstica',
    'Desempregado', 'Desempregada'
  ];

  React.useEffect(() => {
    if (!value || value.trim() === '') {
      setFiltered([]);
      setIsOpen(false);
      return;
    }

    const query = value.toLowerCase().trim();
    const matches = professionsList.filter(prof => 
      prof.toLowerCase().includes(query)
    );

    setFiltered(matches);
    setIsOpen(matches.length > 0);
    setHighlightedIndex(0);
  }, [value]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectProfession = (selected: string) => {
    onChange({ target: { name, value: selected } });
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightedIndex]) {
        selectProfession(filtered[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">{label}</label>
      <input
        {...props}
        name={name}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (value && value.trim() !== '') {
            const query = value.toLowerCase().trim();
            const matches = professionsList.filter(prof => prof.toLowerCase().includes(query));
            setFiltered(matches);
            setIsOpen(matches.length > 0);
          }
        }}
        autoComplete="off"
        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-105 focus:bg-white outline-none transition-all placeholder:text-gray-300"
      />

      {isOpen && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-gray-250 rounded-xl shadow-lg divide-y divide-gray-55">
          {filtered.map((prof, index) => (
            <li
              key={prof}
              onClick={() => selectProfession(prof)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-4 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                index === highlightedIndex ? 'bg-orange-500 text-white font-extrabold' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {prof}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
