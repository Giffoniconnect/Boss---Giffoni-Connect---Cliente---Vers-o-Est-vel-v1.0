import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, ChevronRight, Menu, X, Briefcase, Settings, Building2, ClipboardList, ListChecks, Sliders, Compass } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export function BossLayout({ children }: { children: React.ReactNode }) {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/boss-giffoni-clientes/login');
  };

  const navItems = [
    { name: 'Dashboard Principal', path: '/boss-giffoni-clientes/dashboard', icon: LayoutDashboard },
    { name: 'Fluxo de Produção', path: '/boss-giffoni-clientes/fluxo-producao', icon: ListChecks },
    { name: 'Central de Controle', path: '/boss-giffoni-clientes/central-controle', icon: Sliders },
    { name: 'Setores do Escritório', path: '/boss-giffoni-clientes/setores', icon: Building2 },
    { name: 'Central de Atalhos', path: '/boss-giffoni-clientes/giffoni-connect-atalhos', icon: Compass },
    { name: 'Configurações', path: '/boss-giffoni-clientes/configuracoes', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col sticky top-0 h-screen">
        <div className="p-6">
          <h1 
            onClick={() => navigate('/boss-giffoni-clientes/dashboard')}
            className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">B</div>
            BOSS Connect
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon size={20} />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-500 mb-1">Logado como</p>
            <p className="text-sm font-semibold truncate">{profile?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile Nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
         <h1 
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/boss-giffoni-clientes/dashboard');
            }}
            className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
         >
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center text-white text-xs">B</div>
            BOSS
         </h1>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="md:hidden fixed inset-0 z-40 bg-white pt-16"
          >
             <nav className="px-4 py-4 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-medium ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                    }`
                  }
                >
                  <item.icon size={24} />
                  {item.name}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-lg font-medium text-red-600"
              >
                <LogOut size={24} />
                Sair
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 p-6 md:p-10 pt-20 md:pt-10">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

export function ClientLayout({ children, slug, clientName }: { children: React.ReactNode, slug: string, clientName?: string }) {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    navigate(`/portal-cliente-giffoni/${slug}/login`);
  };

  const navItems = [
    { name: 'Meus Casos', path: `/portal-cliente-giffoni/${slug}/casos`, icon: Briefcase },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-72 bg-white border-r border-gray-200 flex-col sticky top-0 h-screen">
        <div className="p-8">
          <h1 
            onClick={() => navigate(`/portal-cliente-giffoni/${slug}/casos`)}
            className="text-xl font-black text-gray-900 tracking-tighter flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white">
              <ChevronRight size={24} />
            </div>
            Portal Giffoni
          </h1>
          {clientName && <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-4 ml-1">{clientName}</p>}
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-4 px-6 py-4 rounded-3xl text-sm font-black uppercase tracking-widest transition-all ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' 
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon size={20} />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-gray-100">
          <div className="bg-gray-50 rounded-[2rem] p-6 mb-6">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Conta Ativa</p>
            <p className="text-sm font-bold text-gray-900 truncate">{profile?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-6 py-4 text-sm font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-3xl transition-all"
          >
            <LogOut size={20} />
            Desconectar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
          <h1 
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate(`/portal-cliente-giffoni/${slug}/casos`);
            }}
            className="font-black text-gray-900 tracking-tighter cursor-pointer hover:opacity-80 transition-opacity"
          >
            Giffoni Portal
          </h1>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </header>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden fixed inset-0 z-40 bg-white pt-20 px-6"
            >
              <nav className="space-y-4">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-4 px-6 py-4 rounded-3xl text-sm font-black uppercase tracking-widest ${
                        isActive ? 'bg-blue-600 text-white' : 'text-gray-500'
                      }`
                    }
                  >
                    <item.icon size={24} />
                    {item.name}
                  </NavLink>
                ))}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-6 py-4 text-sm font-black uppercase tracking-widest text-red-500"
                >
                  <LogOut size={24} />
                  Desconectar
                </button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 p-6 md:p-12 lg:p-16">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
