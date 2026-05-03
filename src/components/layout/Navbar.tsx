import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth-provider";
import { useTheme } from "../theme-provider";
import { Button } from "../ui/button";
import { Music, Menu, Moon, Sun, User as UserIcon, Calendar, LogOut, Settings } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { STSLogo } from "../ui/Logo";

export const Navbar = () => {
  const { session, profile, isGlobalAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-menu-container')) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/50 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to={session ? "/app" : "/"} className="flex items-center gap-3 group">
          <div className="h-10 w-10 flex items-center justify-center p-1 bg-white/5 rounded-xl border border-white/10 group-hover:bg-white/10 transition-colors overflow-hidden">
             <STSLogo className="w-full h-full text-primary drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
          </div>
          <span className="font-display font-semibold text-lg tracking-tight hidden sm:block">STS Wachendorf e.V.</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 sm:p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          {session ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link to="/app">
                <Button variant="ghost" size="sm" className="hidden sm:flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
                <Button variant="ghost" size="icon" className="sm:hidden w-8 h-8 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </Button>
              </Link>
              <div className="user-menu-container relative">
                <div 
                  className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium border border-primary/20 cursor-pointer hover:bg-primary/30 transition-colors"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  {(profile?.first_name?.[0] || session.user.email?.[0] || "?").toUpperCase()}
                </div>
                
                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-black/10 dark:border-white/10 shadow-xl rounded-xl p-2 z-50 dark:bg-black/90 dark:backdrop-blur-xl">
                     <div className="px-2 py-2 text-xs text-muted-foreground border-b border-black/5 dark:border-white/10 mb-2 overflow-hidden truncate">
                       {profile?.first_name || 'Benutzer'} {profile?.last_name || ''}
                       <br/>
                       <span className="text-[10px]">{session.user.email}</span>
                     </div>
                     <Link to="/app" onClick={() => setIsDropdownOpen(false)} className="w-full text-left px-2 py-2 text-sm rounded-md hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 transition-colors">
                        <Settings className="w-4 h-4" />
                        Einstellungen
                     </Link>
                     <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="w-full text-left px-2 py-2 text-sm rounded-md hover:bg-red-500/10 hover:text-red-500 flex items-center gap-2 transition-colors mt-1">
                        <LogOut className="w-4 h-4" />
                        Abmelden
                     </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              <Link to="/login" className="hidden sm:inline-block">
                <Button variant="ghost" size="sm">Anmelden</Button>
              </Link>
              <Link to="/login" className="sm:hidden">
                <Button variant="ghost" size="sm" className="px-2 text-xs h-8">Login</Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="px-3 sm:px-4 text-xs h-8 sm:text-sm sm:h-9">Registrieren</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
