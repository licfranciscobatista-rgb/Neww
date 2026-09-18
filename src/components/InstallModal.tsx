import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  X,
  ShieldCheck,
  WifiOff,
  Layers,
  Sparkles,
  FileCode,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isAndroid, install } = usePWAInstall();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'direct' | 'apkbuilder' | 'guide'>('direct');

  if (!isOpen) return null;

  const currentAppUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentAppUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleTriggerInstall = async () => {
    const success = await install();
    if (success) {
      onClose();
    }
  };

  const pwaBuilderUrl = `https://www.pwabuilder.com/?url=${encodeURIComponent(currentAppUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-sky-500 flex items-center justify-center text-slate-950 shadow-md">
              <Smartphone className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Convertir e Instalar como APK Android
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700">
                  Nativo & Offline
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Jugada Offline 3.2 preparado para WebAPK nativo de Android y paquete APK descargable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtabs */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-800/80 bg-slate-900 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('direct')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeSubTab === 'direct'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. WebAPK Inmediato (Android)
          </button>
          <button
            onClick={() => setActiveSubTab('apkbuilder')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeSubTab === 'apkbuilder'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Descargar Archivo .APK (PWABuilder)
          </button>
          <button
            onClick={() => setActiveSubTab('guide')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeSubTab === 'guide'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Guía Paso a Paso
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {activeSubTab === 'direct' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-600/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    WebAPK: El método oficial y automático de Android
                  </span>
                  {isInstalled && (
                    <span className="text-[10px] font-bold text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-600">
                      Ya Instalado
                    </span>
                  )}
                </div>

                <p className="text-slate-300 leading-relaxed">
                  En dispositivos Android, cuando instalas esta aplicación desde Chrome o Edge, el propio sistema operativo Android empaqueta y compila un <strong>WebAPK real</strong>. Aparece en tu cajón de aplicaciones con icono propio, inicia a pantalla completa sin la barra del navegador y funciona al <strong>100% sin conexión a Internet</strong>.
                </p>

                <div className="pt-1 flex flex-wrap gap-2.5">
                  {isInstallable ? (
                    <button
                      onClick={handleTriggerInstall}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all text-xs active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      Instalar APK en este dispositivo
                    </button>
                  ) : (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 w-full space-y-2">
                      <span className="font-semibold text-slate-200 block">
                        Si estás visitando desde tu teléfono Android:
                      </span>
                      <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1">
                        <li>Toca los <strong>tres puntos ⋮</strong> del navegador arriba a la derecha.</li>
                        <li>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla principal"</strong>.</li>
                        <li>Android creará e instalará la aplicación APK en tu teléfono.</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>

              {/* URL sharing */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="font-bold text-slate-200 block text-xs">
                  Abre la aplicación en tu móvil Android:
                </span>
                <p className="text-slate-400 text-[11px]">
                  Copia este enlace y ábrelo en Google Chrome en tu celular para instalarla directamente:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={currentAppUrl}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 truncate focus:outline-none"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUrl ? 'Copiado' : 'Copiar URL'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                  <WifiOff className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-200 block">100% Offline</strong>
                    <span className="text-slate-400">Todos los motores y sonidos corren localmente.</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-200 block">Privacidad Local</strong>
                    <span className="text-slate-400">Tus partidas y el aprendizaje de Maia quedan en tu equipo.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'apkbuilder' && (
            <div className="space-y-4">
              <p className="text-slate-300 leading-relaxed">
                Para generar un <strong>archivo APK independiente</strong> (.apk firmado para instalar o compartir por WhatsApp/Telegram/Drive):
              </p>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-white text-sm">PWABuilder (Herramienta Oficial de Empaquetado)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-amber-950 text-amber-300 rounded-full border border-amber-800">
                    Gratis y Oficial
                  </span>
                </div>
                <p className="text-slate-400 text-xs">
                  PWABuilder toma el Manifiesto PWA ya configurado en esta app y genera directamente el instalador <strong>.apk</strong> de Android.
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pl-1 text-xs">
                  <li>Haz clic en el botón de abajo para ir a PWABuilder.</li>
                  <li>Revisa el análisis de compatibilidad (ya cuenta con iconos 192, 512, maskable y Service Worker).</li>
                  <li>Pulsa en <strong>"Package for Stores"</strong> y selecciona <strong>"Android"</strong>.</li>
                  <li>Descarga tu paquete <strong>APK</strong> listo para instalar.</li>
                </ol>
                <div className="pt-2">
                  <a
                    href={pwaBuilderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl font-bold text-xs shadow-lg transition-all"
                  >
                    <span>Generar APK en PWABuilder</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-bold text-white text-xs block">
                  Método de Comando: Google Bubblewrap CLI
                </span>
                <p className="text-slate-400 text-[11px]">
                  Si eres desarrollador y tienes Node.js y Android SDK en tu computadora, puedes generar el APK ejecutando:
                </p>
                <pre className="bg-slate-900 p-2.5 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto border border-slate-800">
{`npm install -g @bubblewrap/cli
bubblewrap init --manifest="${currentAppUrl}/manifest.json"
bubblewrap build`}
                </pre>
              </div>
            </div>
          )}

          {activeSubTab === 'guide' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-sky-400" />
                  ¿Cómo instalar el archivo .APK en tu teléfono Android?
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pl-1 text-[11px]">
                  <li>Descarga el archivo <code>.apk</code> en tu teléfono (o envíatelo por WhatsApp / Telegram / Drive).</li>
                  <li>Abre el archivo descargado en tu gestor de archivos o navegador.</li>
                  <li>Si el sistema pregunta, pulsa en <strong>"Ajustes"</strong> y activa <strong>"Permitir desde esta fuente"</strong> (Instalación de apps desconocidas).</li>
                  <li>Pulsa en <strong>"Instalar"</strong> y listo: tendrás la aplicación de Ajedrez instalada de forma nativa.</li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Diferencia entre WebAPK y APK Tradicional
                </h4>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  En Android moderno, el <strong>WebAPK</strong> (Opción 1) es generado por el propio motor de Android en segundos sin necesidad de descargar archivos externos ni autorizar orígenes desconocidos, mientras que el <strong>APK de PWABuilder</strong> (Opción 2) es ideal si necesitas distribuir el archivo físicamente o publicarlo en la tienda.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Compatible con Android 7.0 o superior
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors border border-slate-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
