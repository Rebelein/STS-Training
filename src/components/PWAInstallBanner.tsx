import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from './ui/button';

export const PWAInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed the banner in a previous session
    const isDismissed = localStorage.getItem('pwa_banner_dismissed') === 'true';

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      if (!isDismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If app is already installed, window.matchMedia('(display-mode: standalone)').matches is true
    window.addEventListener('appinstalled', () => {
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We no longer need the prompt. Clear it up.
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-md text-primary-foreground border-b border-white/10 px-4 py-3 sm:px-6 flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-lg text-white">
          <Download className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold text-sm">App installieren</p>
          <p className="text-xs opacity-90 hidden sm:block">Füge das STS Vereinsportal zum Startbildschirm hinzu.</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleInstallClick}
          className="h-8 text-xs bg-white text-primary hover:bg-white/90"
        >
          Installieren
        </Button>
        <button 
          onClick={handleDismiss} 
          className="text-white/70 hover:text-white transition-colors"
          aria-label="Schließen"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
