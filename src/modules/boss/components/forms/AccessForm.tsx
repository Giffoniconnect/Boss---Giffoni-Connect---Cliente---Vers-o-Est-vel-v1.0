import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface AccessFormProps {
  data: any;
  onChange: (data: any) => void;
}

export const AccessForm: React.FC<AccessFormProps> = ({ data, onChange }) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
  };

  const clientType = data.type || (data.pf_email !== undefined ? 'PF' : 'PJ');
  const cadastralEmail = clientType === 'PF' ? (data.pf_email || '') : (data.pj_emailEmpresa || '');

  React.useEffect(() => {
    if (data.acesso_usarEmailCadastro) {
      if (data.acesso_emailLogin !== cadastralEmail) {
        onChange({ ...data, acesso_emailLogin: cadastralEmail });
      }
    }
  }, [data.acesso_usarEmailCadastro, cadastralEmail]);

  const passwordsMatch = data.acesso_senha && data.acesso_senha === data.acesso_confirmarSenha;

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <h3 className="text-[18px] font-bold text-gray-900 uppercase tracking-wider">
          BLOCO ACESSO SISTEMA {clientType === 'PF' ? 'PF' : 'PJ'}
        </h3>
        
        <label className="flex items-center gap-2 text-xs font-bold text-blue-600 cursor-pointer select-none">
          <input 
            type="checkbox"
            name="acesso_usarEmailCadastro"
            checked={data.acesso_usarEmailCadastro || false}
            onChange={(e) => onChange({ ...data, acesso_usarEmailCadastro: e.target.checked })}
            className="rounded border-gray-300 text-blue-650 focus:ring-blue-500 w-4 h-4 cursor-pointer"
          />
          Usar o mesmo e-mail do cadastro para login?
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input 
          label="E-mail de Login" 
          name="acesso_emailLogin" 
          type="email"
          value={data.acesso_emailLogin || ''} 
          onChange={handleChange} 
          required 
          disabled={data.acesso_usarEmailCadastro}
          placeholder="ex: cliente@email.com"
        />
        
        <Select 
          label="Status de Acesso" 
          name="acesso_statusAcesso" 
          value={data.acesso_statusAcesso || 'pendente'} 
          onChange={handleChange} 
          options={['ativo', 'suspenso', 'pendente']} 
        />

        <div>
          <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">Senha de Acesso</label>
          <div className="relative">
            <input
              name="acesso_senha"
              type={showPassword ? 'text' : 'password'}
              value={data.acesso_senha || ''}
              onChange={handleChange}
              required
              className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-gray-100 focus:bg-white outline-none transition-all placeholder:text-gray-300 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="mt-1 text-[10px] text-gray-400">Mínimo 6 caracteres.</p>
        </div>

        <div>
          <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">Confirmar Senha</label>
          <div className="relative">
            <input
              name="acesso_confirmarSenha"
              type={showConfirmPassword ? 'text' : 'password'}
              value={data.acesso_confirmarSenha || ''}
              onChange={handleChange}
              required
              className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-gray-100 focus:bg-white outline-none transition-all placeholder:text-gray-300 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {data.acesso_confirmarSenha && (
            <p className={`mt-1 text-[10px] font-bold ${passwordsMatch ? 'text-emerald-600' : 'text-red-500'}`}>
              {passwordsMatch ? 'Senhas coincidem' : 'Senhas não coincidem'}
            </p>
          )}
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
      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-gray-100 focus:bg-white outline-none transition-all placeholder:text-gray-300"
    />
  </div>
);

const Select = ({ label, options, ...props }: any) => (
  <div>
    <label className="block text-[15px] font-bold text-gray-500 mb-1 ml-1">{label}</label>
    <select
      {...props}
      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-gray-100 focus:bg-white outline-none transition-all"
    >
      {options.map((opt: string) => (
        <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
      ))}
    </select>
  </div>
);
