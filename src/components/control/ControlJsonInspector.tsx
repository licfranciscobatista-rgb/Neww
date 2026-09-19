import React, { useState, useEffect } from 'react';
import { FileCode, RefreshCw, Copy, Check, ChevronDown, ChevronUp, Cpu, Info } from 'lucide-react';
import { controlConfigLoader, ControlJsonFileKey } from '../../engine/director/controlConfigLoader';

interface JsonFileInfo {
  key: ControlJsonFileKey;
  label: string;
  category: string;
  description: string;
}

const CONTROL_JSON_FILES: JsonFileInfo[] = [
  {
    key: 'director.json',
    label: 'director.json',
    category: 'Mando',
    description: 'Políticas ejecutivas, modos de reloj y gobernanza del Director General.',
  },
  {
    key: 'subdirector.json',
    label: 'subdirector.json',
    category: 'Técnico',
    description: 'Guardarraíles de tiempo, arbitraje de candidatos y monitor 60 FPS.',
  },
  {
    key: 'engines.json',
    label: 'engines.json',
    category: 'Motores',
    description: 'Especificación de los 7 motores y programas auxiliares.',
  },
  {
    key: 'modules.json',
    label: 'modules.json',
    category: 'Módulos',
    description: 'Aislamiento de memoria, clasificador ECO y watchdog.',
  },
  {
    key: 'audit-policy.json',
    label: 'audit-policy.json',
    category: 'Auditoría',
    description: 'Umbrales centipeones (Brillante a Blunder) y cuotas de Stockfish.',
  },
  {
    key: 'database-eco.json',
    label: 'database-eco.json',
    category: 'ECO',
    description: '25 líneas teóricas maestras integradas en el paquete nativo.',
  },
  {
    key: 'endgame-tables.json',
    label: 'endgame-tables.json',
    category: 'Finales',
    description: 'Heurísticas teóricas de finales (Lucena, Philidor, Cuadrado, etc.).',
  },
];

export const ControlJsonInspector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<ControlJsonFileKey>('director.json');
  const [jsonContent, setJsonContent] = useState<string>('Cargando configuración...');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filterText, setFilterText] = useState('');

  const activeInfo = CONTROL_JSON_FILES.find((f) => f.key === activeKey) || CONTROL_JSON_FILES[0];

  const loadCurrentJson = async (key: ControlJsonFileKey) => {
    setIsLoading(true);
    try {
      const data = await controlConfigLoader.loadJson(key);
      setJsonContent(JSON.stringify(data, null, 2));
    } catch (e) {
      setJsonContent(JSON.stringify({ error: 'No se pudo cargar el archivo', details: String(e) }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCurrentJson(activeKey);
    }
  }, [activeKey, isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredContent = filterText
    ? jsonContent
        .split('\n')
        .filter((line) => line.toLowerCase().includes(filterText.toLowerCase()))
        .join('\n')
    : jsonContent;

  const contentSizeBytes = new Blob([jsonContent]).size;
  const contentSizeKb = (contentSizeBytes / 1024).toFixed(2);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all shadow-md">
      {/* Cabecera Plegable - Limpia y sin sobrecarga */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-850/80 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-emerald-950 border border-emerald-600/40 rounded-lg text-emerald-400">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-xs">
                Archivos .JSON de Configuración Offline
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {CONTROL_JSON_FILES.length} archivos
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Configuraciones canónicas parseadas de forma nativa en C++ a máxima velocidad
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            {isOpen ? 'Ocultar visor' : 'Ver manifiestos'}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Contenido Plegado */}
      {isOpen && (
        <div className="p-4 border-t border-slate-800 space-y-3 text-xs bg-slate-950/40">
          {/* Nota Técnica: Por qué JSON y no GraphQL / YAML / TOML */}
          <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/40 text-[10px] text-blue-200/90 flex items-start gap-2 leading-relaxed">
            <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white font-semibold">Arquitectura 100% Offline & Eficiente:</strong>{' '}
              El navegador y WebView móvil leen <strong>JSON de forma nativa en C++</strong> (en menos de 0.05 ms). 
              Ni <em>YAML</em> ni <em>TOML</em> aportan ventajas técnicas ya que requerirían librerías JS pesadas para interpretarse. 
              Tampoco se necesita <em>GraphQL</em> porque la aplicación funciona en local sin depender de consultas por red.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {/* Lista compacta de botones */}
            <div className="flex flex-wrap gap-1">
              {CONTROL_JSON_FILES.map((f) => {
                const isSelected = f.key === activeKey;
                return (
                  <button
                    key={f.key}
                    onClick={() => setActiveKey(f.key)}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {contentSizeKb} KB
              </span>
              <button
                onClick={() => loadCurrentJson(activeKey)}
                disabled={isLoading}
                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[10px] transition-colors"
                title="Recargar archivo"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleCopy}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[10px] flex items-center gap-1 transition-colors"
                title="Copiar JSON"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {/* Filtro y Ruta */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800 text-[11px]">
            <div className="truncate">
              <span className="font-bold text-white font-mono mr-2">/public/control/{activeInfo.key}</span>
              <span className="text-slate-400 text-[10px] truncate">{activeInfo.description}</span>
            </div>
            <input
              type="text"
              placeholder="Filtrar..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full sm:w-36 p-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Visor de Código JSON */}
          <div className="relative">
            <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-sky-300 font-mono text-[10px] leading-relaxed max-h-56 overflow-y-auto overflow-x-auto whitespace-pre">
              {filteredContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
