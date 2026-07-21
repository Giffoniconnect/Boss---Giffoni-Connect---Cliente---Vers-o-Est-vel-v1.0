import React, { useState, useEffect } from "react";
import { ChevronRight, Trash2, Clock, Sparkles, Check, FileText, AlertCircle, RefreshCw } from "lucide-react";

interface LogListProps {
  integrationJobs: any[];
  caseId: string;
}

export default function LogList({ integrationJobs, caseId }: LogListProps) {
  const cacheKey = `boss_financeiro_logs_cache_${caseId}`;
  
  // State for cached jobs
  const [cachedJobs, setCachedJobs] = useState<any[]>([]);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [activeJobTab, setActiveJobTab] = useState<Record<string, "logs" | "payload">>({});

  // Load from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        setCachedJobs(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Erro ao carregar cache local de logs:", e);
    }
  }, [cacheKey]);

  // Sync prop jobs with local storage cache (merging to prevent duplicates)
  useEffect(() => {
    if (integrationJobs && integrationJobs.length > 0) {
      setCachedJobs((prev) => {
        const mergedMap = new Map();
        
        // Add existing from cache first
        prev.forEach((job) => {
          if (job && job.id) {
            mergedMap.set(job.id, job);
          }
        });
        
        // Overwrite or add with new incoming ones from props
        integrationJobs.forEach((job) => {
          if (job && job.id) {
            mergedMap.set(job.id, job);
          }
        });
        
        const mergedList = Array.from(mergedMap.values());
        
        // Sort newest first
        mergedList.sort(
          (a: any, b: any) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        
        // Save to local storage
        try {
          localStorage.setItem(cacheKey, JSON.stringify(mergedList));
        } catch (e) {
          console.error("Erro ao salvar cache local de logs:", e);
        }
        
        return mergedList;
      });
    }
  }, [integrationJobs, cacheKey]);

  // Clear local cache of ancient logs
  const handleClearCache = () => {
    try {
      localStorage.removeItem(cacheKey);
      setCachedJobs([]);
      setExpandedJobId(null);
    } catch (e) {
      console.error("Erro ao limpar cache local de logs:", e);
    }
  };

  if (cachedJobs.length === 0) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl text-center text-slate-500 text-xs">
        Nenhum histórico de integração armazenado localmente para este caso.
      </div>
    );
  }

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block font-mono">
          Histórico de Integrações e Logs ({cachedJobs.length} tentativas em cache)
        </span>
        <button
          type="button"
          onClick={handleClearCache}
          className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-rose-600 hover:text-rose-800 transition-all cursor-pointer bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-150"
          title="Limpa o cache local de logs antigos para melhor performance da interface"
        >
          <Trash2 size={10} />
          <span>Limpar Cache Local</span>
        </button>
      </div>

      <div className="space-y-3">
        {cachedJobs.map((job, index) => {
          const isExpanded = expandedJobId === job.id;
          const tab = activeJobTab[job.id] || "logs";

          let badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
          let statusLabel = "Pendente";
          if (job.status === "success") {
            badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-200";
            statusLabel = "Sucesso";
          } else if (job.status === "failed") {
            badgeColor = "bg-rose-50 text-rose-850 border-rose-200";
            statusLabel = "Falha";
          }

          const dateStr = job.createdAt
            ? new Date(job.createdAt).toLocaleString("pt-BR")
            : "N/A";

          const logs = job.logs || [];
          const placeholdersList = job.placeholders || {};

          return (
            <div
              key={job.id}
              className="border border-gray-150 rounded-2xl bg-white overflow-hidden shadow-3xs transition-all hover:border-gray-300"
            >
              {/* Header clicável */}
              <div
                onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer bg-slate-50/50 hover:bg-slate-50 select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeColor}`}>
                    {statusLabel}
                  </span>
                  <span className="text-xs font-bold text-slate-800 font-mono truncate">
                    Tentativa #{cachedJobs.length - index} ({job.clientType || "PF"})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {dateStr}
                  </span>
                  <ChevronRight
                    size={14}
                    className={`text-slate-400 transition-transform ${
                      isExpanded ? "rotate-90 text-slate-600" : ""
                    }`}
                  />
                </div>
              </div>

              {/* Corpo expandido */}
              {isExpanded && (
                <div className="border-t border-gray-150 p-4 space-y-4 animate-in fade-in duration-200">
                  {/* Abas: Logs / Payload */}
                  <div className="flex gap-1.5 border-b border-gray-150 pb-2">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveJobTab((prev) => ({
                          ...prev,
                          [job.id]: "logs",
                        }))
                      }
                      className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                        tab === "logs"
                          ? "bg-blue-50 text-blue-850 font-extrabold"
                          : "text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      Logs da Integração ({logs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveJobTab((prev) => ({
                          ...prev,
                          [job.id]: "payload",
                        }))
                      }
                      className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                        tab === "payload"
                          ? "bg-blue-50 text-blue-850 font-extrabold"
                          : "text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      Payload Migrado ({Object.keys(placeholdersList).length} chaves)
                    </button>
                  </div>

                  {/* Conteúdo Aba: Logs */}
                  {tab === "logs" && (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed">
                      {logs.length === 0 ? (
                        <p className="text-slate-400 italic">Nenhum evento registrado nesta tentativa.</p>
                      ) : (
                        <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-3 before:w-0.5 before:bg-slate-800">
                          {logs.map((log: any, idx: number) => {
                            let dotColor = "bg-blue-500";
                            let textColor = "text-blue-300";
                            let levelLabel = "INFO";
                            if (log.level === "success" || log.action?.includes("SUCCESS")) {
                              dotColor = "bg-emerald-500";
                              textColor = "text-emerald-300";
                              levelLabel = "SUCESSO";
                            } else if (log.level === "warning" || log.action?.includes("WARN")) {
                              dotColor = "bg-amber-500";
                              textColor = "text-amber-300";
                              levelLabel = "ALERTA";
                            } else if (log.level === "error" || log.action?.includes("FAILED") || log.action?.includes("ERROR")) {
                              dotColor = "bg-rose-500";
                              textColor = "text-rose-300";
                              levelLabel = "ERRO";
                            }

                            const logTime = log.timestamp
                              ? new Date(log.timestamp).toLocaleTimeString("pt-BR")
                              : "";

                            return (
                              <div key={idx} className="flex gap-3.5 items-start relative pl-1">
                                <span className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1 ring-4 ring-slate-900 z-10 shrink-0`} />
                                <div className="space-y-0.5 min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 font-sans font-bold">
                                    {logTime && <span>[{logTime}]</span>}
                                    <span className={textColor}>[{levelLabel}]</span>
                                    <span className="text-slate-400 font-mono text-[9px] bg-slate-800 px-1 py-0.5 rounded uppercase tracking-wider">
                                      {log.code || log.action || "EVENT"}
                                    </span>
                                  </div>
                                  <p className="text-slate-200 text-xs font-sans leading-normal font-medium">
                                    {log.message}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Conteúdo Aba: Payload */}
                  {tab === "payload" && (
                    <div className="p-3.5 bg-slate-50 border border-gray-150 rounded-xl max-h-60 overflow-y-auto space-y-1.5 font-mono text-[10px]">
                      {Object.keys(placeholdersList).length === 0 ? (
                        <p className="text-gray-400 italic">Nenhum placeholder migrado neste payload.</p>
                      ) : (
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="pb-1.5 text-gray-500 font-bold uppercase tracking-wider w-1/3">Chave</th>
                              <th className="pb-1.5 text-gray-500 font-bold uppercase tracking-wider">Valor Migrado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(placeholdersList).map(([key, val]: any) => (
                              <tr key={key} className="border-b border-slate-100 hover:bg-slate-100/50">
                                <td className="py-1 text-indigo-700 font-bold select-all break-all pr-3">{key}</td>
                                <td className="py-1 text-slate-700 break-words select-all">{String(val || "")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
