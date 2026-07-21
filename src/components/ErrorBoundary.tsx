import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, ChevronRight, ChevronDown } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private toggleDetails = () => {
    this.setState((prevState) => ({ showDetails: !prevState.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.name === 'ChunkLoadError' || 
                           this.state.error?.message?.includes('Failed to fetch dynamically imported module');

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 font-sans p-6" id="error-boundary-wrapper">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-gray-100 p-8 flex flex-col items-center text-center space-y-6" id="error-card">
            
            {/* Visual Indicator */}
            <div className="p-4 bg-amber-50 rounded-full text-amber-500 animate-pulse" id="error-icon-container">
              <AlertCircle size={40} />
            </div>

            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight" id="error-title">
                {isChunkError ? 'Atualização Necessária' : 'Ops! Algo não deu certo'}
              </h1>
              <p className="text-sm text-gray-600 leading-relaxed" id="error-description">
                {isChunkError 
                  ? 'Identificamos que uma nova versão do sistema está disponível ou houve uma leve oscilação na rede. Reinicie para sincronizar.'
                  : 'Ocorreu um erro inesperado ao carregar esta parte do sistema. Por favor, tente recarregar a página.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col sm:flex-row gap-3 pt-2" id="error-actions">
              <button
                id="btn-reload"
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-medium transition duration-200 shadow-sm cursor-pointer"
              >
                <RefreshCw size={16} />
                Recarregar Página
              </button>
              <button
                id="btn-go-home"
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition duration-200 cursor-pointer"
              >
                <Home size={16} />
                Voltar ao Início
              </button>
            </div>

            {/* Section for Technical Details */}
            {this.state.error && (
              <div className="w-full border-t border-gray-100 pt-4" id="error-details-section">
                <button
                  id="btn-toggle-details"
                  onClick={this.toggleDetails}
                  className="flex items-center justify-between w-full text-xs text-gray-500 hover:text-gray-700 font-medium py-1 transition cursor-pointer"
                >
                  <span>Detalhes técnicos para suporte</span>
                  {this.state.showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                
                {this.state.showDetails && (
                  <div className="mt-3 text-left bg-gray-50 rounded-lg p-4 border border-gray-100 max-h-48 overflow-y-auto text-xs font-mono text-gray-500 break-all select-all space-y-1" id="error-details-content">
                    <p className="font-semibold text-gray-700">{this.state.error.name}: {this.state.error.message}</p>
                    {this.state.error.stack && (
                      <p className="text-[10px] text-gray-400 mt-2 whitespace-pre-wrap">
                        {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
