import React from 'react';

type State = { hasError: boolean; error?: Error };

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[APP_ERROR_BOUND_DEBUG]', error, info);
    
    // Check if it's a dynamic import / chunk load error
    const isChunkError = 
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('chunk') ||
      error.stack?.includes('dynamically imported module') ||
      error.stack?.includes('chunk');
      
    if (isChunkError) {
      try {
        const reloadKey = 'boss_app_chunk_reload_count';
        const reloadCountStr = sessionStorage.getItem(reloadKey);
        const reloadCount = reloadCountStr ? parseInt(reloadCountStr, 10) : 0;
        
        if (reloadCount < 2) {
          sessionStorage.setItem(reloadKey, String(reloadCount + 1));
          console.warn('[AppErrorBoundary] Detetada falha de importação dinâmica. Recarregando página automaticamente...');
          window.location.reload();
          return;
        }
      } catch (err) {
        console.error('[AppErrorBoundary] Falha ao tentar recarregar automaticamente:', err);
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', padding: 32, fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
          <div style={{ maxWidth: '600px', width: '100%', padding: '24px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '12px' }}>Erro ao carregar o BOSS</h1>
            <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '16px' }}>Uma página interna apresentou erro e foi isolada para evitar tela branca.</p>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f3f4f6', padding: '16px', borderRadius: '8px', fontSize: '12px', color: '#1f2937', overflowX: 'auto', border: '1px solid #e5e7eb' }}>
              {this.state.error?.message || 'Erro desconhecido'}
            </pre>
            <div style={{ marginTop: '20px' }}>
              <button 
                onClick={() => window.location.reload()}
                style={{ padding: '8px 16px', background: '#111827', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}
              >
                Recarregar Página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
