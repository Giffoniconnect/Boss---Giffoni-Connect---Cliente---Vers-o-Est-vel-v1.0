import React from 'react';
import { formatCPF } from '../../../../lib/masks';

interface BankingFormProps {
  data: any;
  onChange: (data: any) => void;
  clientName: string;
}

const PIX_TYPES = ['CPF', 'CNPJ', 'E-mail', 'Telefone', 'Aleatória'];
const ACCOUNT_TYPES = ['Corrente', 'Poupança', 'Pagamento'];

const BANKS_SUGGESTIONS = [
  'Banco do Brasil',
  'Caixa Econômica Federal',
  'Itaú',
  'Bradesco',
  'Santander',
  'Nubank',
  'Inter',
  'Sicoob',
  'Sicredi',
  'C6 Bank',
  'Banco Pan',
  'Mercado Pago',
  'PagBank',
  'BTG Pactual',
  'Banco Original'
];

export const BankingForm: React.FC<BankingFormProps> = ({ data, onChange, clientName }) => {
  const isPF = (typeof window !== 'undefined' && window.location.search.includes('pessoa-fisica')) || data.pf_nomeCompleto !== undefined;

  const [selectedOption, setSelectedOption] = React.useState<'pix' | 'tradicional' | null>(() => {
    if (data.bancario_opcaoSelecionada) return data.bancario_opcaoSelecionada;
    if (data.bancario_tipoChavePix || data.bancario_chavePix || data.bancario_bancoPix || data.bancario_titularPix) {
      return 'pix';
    }
    if (data.bancario_banco || data.bancario_agencia || data.bancario_conta) {
      return 'tradicional';
    }
    return null;
  });

  const handleSelectOption = (opt: 'pix' | 'tradicional') => {
    setSelectedOption(opt);
    onChange({ ...data, bancario_opcaoSelecionada: opt });
  };

  const handleResetOption = () => {
    setSelectedOption(null);
    onChange({ ...data, bancario_opcaoSelecionada: null });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    let newValue = val;

    if (name === 'bancario_chavePix' && data.bancario_tipoChavePix === 'CPF') {
      newValue = formatCPF(String(val));
    }

    if (name === 'bancario_titularPix') {
      const parentName = clientName || data.pf_nomeCompleto || '';
      onChange({
        ...data,
        bancario_titularPix: value,
        bancario_titularPixEhCliente: value === parentName && parentName !== ''
      });
      return;
    }

    if (name === 'bancario_titularPixEhCliente') {
      const parentName = clientName || data.pf_nomeCompleto || '';
      onChange({
        ...data,
        bancario_titularPixEhCliente: val,
        bancario_titularPix: val ? parentName : data.bancario_titularPix
      });
      return;
    }

    if (name === 'bancario_titularEhCliente' && val) {
      onChange({ 
        ...data, 
        [name]: val,
        bancario_titularConta: clientName || data.pf_nomeCompleto || data.pj_razaoSocial || ''
      });
    } else {
      onChange({ ...data, [name]: newValue });
    }
  };

  // Sync PIX holder name when "bancario_titularPixEhCliente" is checked
  React.useEffect(() => {
    if (isPF && data.bancario_titularPixEhCliente) {
      const parentName = clientName || data.pf_nomeCompleto || '';
      if (data.bancario_titularPix !== parentName) {
        onChange({ ...data, bancario_titularPix: parentName });
      }
    }
  }, [isPF, data.bancario_titularPixEhCliente, clientName, data.pf_nomeCompleto]);

  // Sync holder name when "titularEhCliente" is checked
  React.useEffect(() => {
    if (data.bancario_titularEhCliente) {
      const parentName = clientName || data.pf_nomeCompleto || data.pj_razaoSocial || '';
      if (data.bancario_titularConta !== parentName) {
        onChange({ ...data, bancario_titularConta: parentName });
      }
    }
  }, [data.bancario_titularEhCliente, clientName, data.pf_nomeCompleto, data.pj_razaoSocial]);

  // Sync CPF with PIX key when checked
  React.useEffect(() => {
    if (data.bancario_tipoChavePix === 'CPF' && data.bancario_usarCpfComoPix) {
      const clientCpf = data.pf_cpf || '';
      if (data.bancario_chavePix !== clientCpf) {
        onChange({ ...data, bancario_chavePix: clientCpf });
      }
    }
  }, [data.bancario_tipoChavePix, data.bancario_usarCpfComoPix, data.pf_cpf]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[18px] font-bold text-gray-900 uppercase tracking-wider">BLOCO dados Bancários Opcional</h3>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input 
            type="checkbox"
            name="bancario_possuiDadosBancarios"
            checked={data.bancario_possuiDadosBancarios || false}
            onChange={handleChange}
            className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
          <span className="text-sm font-bold text-gray-800">Possui dados bancários?</span>
        </label>
      </div>

      {data.bancario_possuiDadosBancarios && (
        <div className="space-y-6 mt-4">
          {!selectedOption ? (
            <div className="space-y-4 animate-in fade-in duration-300">
              <p className="text-[15px] font-bold text-gray-700">Como deseja cadastrar os Dados Bancários?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* CARD 1 — CHAVE PIX */}
                <button
                  type="button"
                  onClick={() => handleSelectOption('pix')}
                  className="flex flex-col items-center justify-center p-6 bg-emerald-50/20 hover:bg-emerald-50 border border-dashed border-emerald-300 rounded-2xl transition-all cursor-pointer text-center group"
                >
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-105 transition-transform text-emerald-600">
                    <span className="font-black text-sm tracking-wider">PIX</span>
                  </div>
                  <span className="text-[15px] font-extrabold text-gray-800">Chave Pix</span>
                  <span className="text-[11px] text-gray-500 mt-1 font-semibold">Usar chave PIX (CPF, Celular, E-mail, etc)</span>
                </button>

                {/* CARD 2 — DADOS BANCARIOS TRADICIONAIS */}
                <button
                  type="button"
                  onClick={() => handleSelectOption('tradicional')}
                  className="flex flex-col items-center justify-center p-6 bg-emerald-50/20 hover:bg-emerald-50 border border-dashed border-emerald-300 rounded-2xl transition-all cursor-pointer text-center group"
                >
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-105 transition-transform text-emerald-600">
                    <span className="font-black text-sm tracking-widest">A/C</span>
                  </div>
                  <span className="text-[15px] font-extrabold text-gray-800">Dados bancários tradicionais</span>
                  <span className="text-[11px] text-gray-500 mt-1 font-semibold">Indicar Banco, Agência e Conta</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-500">
                  Cadastrando por: <strong className="text-emerald-700 capitalize">{selectedOption === 'pix' ? 'Chave Pix' : 'Dados tradicionais'}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleResetOption}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer"
                >
                  Alterar tipo de dados bancários
                </button>
              </div>

              {selectedOption === 'pix' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100/50">
                    <div>
                      <Select 
                        label="Tipo Chave PIX" 
                        name="bancario_tipoChavePix" 
                        value={data.bancario_tipoChavePix || ''} 
                        onChange={(e: any) => {
                          const val = e.target.value;
                          // Reset checkbox if not CPF
                          onChange({
                            ...data,
                            bancario_tipoChavePix: val,
                            bancario_usarCpfComoPix: val === 'CPF' ? data.bancario_usarCpfComoPix : false
                          });
                        }} 
                        options={PIX_TYPES} 
                      />
                      
                      {data.bancario_tipoChavePix === 'CPF' && (
                        <label className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-600 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            name="bancario_usarCpfComoPix"
                            checked={data.bancario_usarCpfComoPix || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              onChange({
                                ...data,
                                bancario_usarCpfComoPix: checked,
                                bancario_chavePix: checked ? (data.pf_cpf || '') : data.bancario_chavePix
                              });
                            }}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span>Usar CPF do cliente como chave PIX?</span>
                        </label>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <Input 
                        label="Chave PIX" 
                        name="bancario_chavePix" 
                        value={data.bancario_chavePix || ''} 
                        onChange={handleChange} 
                        disabled={data.bancario_tipoChavePix === 'CPF' && data.bancario_usarCpfComoPix}
                        placeholder="Insira a chave PIX"
                      />
                    </div>
                    
                    <div>
                      <AutocompleteBankInput 
                        label="Qual Banco pertence esta chave pix?" 
                        name="bancario_bancoPix" 
                        value={data.bancario_bancoPix || ''} 
                        onChange={handleChange} 
                        placeholder="Ex: Nubank, Inter..."
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <Input 
                        id="bancario_titularPix"
                        label="Quem é o titular da conta Pix?" 
                        name="bancario_titularPix" 
                        value={data.bancario_titularPix || ''} 
                        onChange={handleChange} 
                        placeholder="Nome completo do titular"
                      />
                      {isPF && (
                        <label className="flex items-center gap-2 mt-2 text-xs font-bold text-emerald-600 cursor-pointer select-none">
                          <input 
                            id="bancario_titularPixEhCliente"
                            type="checkbox"
                            name="bancario_titularPixEhCliente"
                            checked={data.bancario_titularPixEhCliente || false}
                            onChange={handleChange}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span>Usar nome do cliente como titular da conta?</span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedOption === 'tradicional' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
                  <AutocompleteBankInput 
                    label="Banco" 
                    name="bancario_banco" 
                    value={data.bancario_banco || ''} 
                    onChange={handleChange} 
                    placeholder="Ex: Nubank, Itaú..."
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Agência" name="bancario_agencia" value={data.bancario_agencia || ''} onChange={handleChange} />
                    <Input label="Conta" name="bancario_conta" value={data.bancario_conta || ''} onChange={handleChange} />
                  </div>

                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center min-h-[24px] px-1 mb-1">
                      <label className="block text-[15px] font-bold text-gray-500">Tipo de Conta</label>
                    </div>
                    <select
                      name="bancario_tipoConta" 
                      value={data.bancario_tipoConta || ''} 
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:bg-white outline-none transition-all text-sm h-[46px]"
                    >
                      <option value="">Selecione...</option>
                      {ACCOUNT_TYPES.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center justify-between min-h-[24px] px-1 mb-1">
                      <label className="block text-[15px] font-bold text-gray-500">Titular da Conta</label>
                      <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-600 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          name="bancario_titularEhCliente"
                          checked={data.bancario_titularEhCliente || false} 
                          onChange={handleChange}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                        />
                        Mesmo que o cliente?
                      </label>
                    </div>
                    <input
                      name="bancario_titularConta"
                      value={data.bancario_titularConta || ''}
                      onChange={handleChange}
                      disabled={data.bancario_titularEhCliente}
                      placeholder="Nome do titular"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:bg-white outline-none transition-all placeholder:text-gray-300 disabled:opacity-60 text-sm h-[46px]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Input = ({ label, ...props }: any) => (
  <div>
    <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">{label}</label>
    <input
      {...props}
      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:bg-white outline-none transition-all placeholder:text-gray-300 text-sm"
    />
  </div>
);

const AutocompleteBankInput = ({ label, value, onChange, name, placeholder }: any) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = BANKS_SUGGESTIONS.filter(bank =>
    bank.toLowerCase().includes((value || '').toLowerCase())
  );

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">{label}</label>
      <input
        type="text"
        name={name}
        value={value || ''}
        placeholder={placeholder}
        onChange={onChange}
        onFocus={() => setIsOpen(true)}
        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:bg-white outline-none transition-all placeholder:text-gray-300 text-sm"
        autoComplete="off"
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
          {filtered.map(bank => (
            <button
              key={bank}
              type="button"
              onClick={() => {
                onChange({ target: { name, id: name, value: bank } as any });
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-sm text-gray-700 font-semibold transition-colors cursor-pointer"
            >
              {bank}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Select = ({ label, options, ...props }: any) => (
  <div>
    <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">{label}</label>
    <select
      {...props}
      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:bg-white outline-none transition-all text-sm"
    >
      <option value="">Selecione...</option>
      {options.map((opt: string) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </div>
);
