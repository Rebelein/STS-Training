import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { DownloadCloud, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const UpdateNotification = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const checkForUpdate = async () => {
      try {
        const response = await fetch('/version.json?t=' + new Date().getTime(), {
          cache: 'no-store'
        });
        
        if (response.ok) {
          const data = await response.json();
          // Compare build timestamp
          if (data.version && data.version !== __APP_VERSION__) {
            setUpdateAvailable(true);
          }
        }
      } catch (error) {
        // Ignore fetch errors (e.g. offline)
      }
    };

    // Initial check
    setTimeout(checkForUpdate, 5000);

    // Check every 5 minutes
    interval = setInterval(checkForUpdate, 5 * 60 * 1000);

    // Also check when window regains focus
    const handleFocus = () => checkForUpdate();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm"
        >
          <div className="bg-primary text-primary-foreground p-4 rounded-xl shadow-2xl flex flex-col gap-3 items-start border border-white/20">
            <div className="flex items-start justify-between w-full">
              <div className="flex items-center gap-2 font-bold">
                <DownloadCloud className="w-5 h-5" />
                Neue Version verfügbar!
              </div>
              <button 
                onClick={() => setUpdateAvailable(false)}
                className="hover:bg-black/10 p-1 rounded-full text-primary-foreground/70 hover:text-primary-foreground transition-colors -mt-1 -mr-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-sm text-primary-foreground/90">
              Eine neue Version der Anwendung wurde installiert. Klicke hier um die App zu aktualisieren.
            </p>
            
            <Button 
              variant="secondary" 
              className="w-full font-semibold shadow-lg"
              onClick={() => window.location.reload()}
            >
              Jetzt aktualisieren
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
