import React, { useState } from 'react';
import { Smartphone, Download } from 'lucide-react';
import { InstallModal } from './InstallModal';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'floating' | 'banner' }> = ({
  variant = 'header',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isInstallable, isInstalled } = usePWAInstall();

  if (variant === 'floating') {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-5 right-5 z-40 bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-white/20 text-xs transition-transform hover:scale-105 active:scale-95 animate-bounce-subtle"
          title="Convertir o instalar APK en Android"
        >
          <Smartphone className="w-4 h-4 text-slate-950" />
          <span>{isInstalled ? 'App Instalada' : 'Descargar / APK'}</span>
        </button>
        <InstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600/30 to-sky-600/30 hover:from-emerald-600/50 hover:to-sky-600/50 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
        title="Opciones de APK y PWA para Android"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Convertir a APK</span>
        <span className="sm:hidden">APK</span>
      </button>
      <InstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
