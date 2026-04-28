import React, { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useAuth } from "../components/auth-provider";
import { supabase } from "../lib/supabase";
import { Navbar } from "../components/layout/Navbar";
import { Button } from "../components/ui/button";
import { Calendar as CalendarIcon, Users, Settings, Plus, Home, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CalendarPage } from "./dashboard/CalendarPage";
import { GroupPage } from "./dashboard/GroupPage";
import { AdminPage } from "./dashboard/AdminPage";
import { cn } from "../lib/utils";

export const Dashboard = () => {
  const { user, profile, isGlobalAdmin } = useAuth();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      fetchMemberships();

      // Listen to realtime changes on memberships
      const channel = supabase
        .channel('memberships_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `user_id=eq.${user.id}` }, () => {
          fetchMemberships();
        });

      if (isGlobalAdmin) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
          fetchMemberships();
        });
      }

      channel.subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, isGlobalAdmin]);

  const fetchMemberships = async () => {
    try {
      if (isGlobalAdmin) {
        const { data: allGroups, error } = await supabase
          .from('groups')
          .select('*');
          
        if (!error && allGroups) {
          const forgedMemberships = allGroups.map(g => ({
            id: `admin-virtual-${g.id}`,
            group_id: g.id,
            user_id: user?.id,
            role: 'trainer',
            status: 'active',
            groups: g
          }));
          setMemberships(forgedMemberships);
        }
      } else {
        const { data, error } = await supabase
          .from('group_members')
          .select('*, groups(*)')
          .eq('user_id', user?.id);
        
        if (!error && data) {
          setMemberships(data);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const activeMemberships = memberships.filter(m => m.status === 'active');
  const waitingMemberships = memberships.filter(m => m.status === 'waiting');

  const navItems = [
    { name: "Übersicht", path: "/app", icon: Home },
    { name: "Kalender", path: "/app/calendar", icon: CalendarIcon },
    ...(isGlobalAdmin ? [{ name: "Verwaltung", path: "/app/admin", icon: Settings }] : [])
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Animated Ambient Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

      <div className="relative z-10 w-full">
        <Navbar />
      </div>
      
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "w-64 border-r border-white/10 bg-black/90 md:bg-black/40 backdrop-blur-xl flex flex-col z-50",
          "fixed inset-y-0 left-0 transition-transform duration-300 md:relative md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="p-4 flex justify-between items-center md:hidden border-b border-white/10">
            <span className="font-display font-semibold">Menü</span>
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="space-y-1 mb-8">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/app' && location.pathname.startsWith(item.path));
                return (
                  <Link key={item.name} to={item.path}>
                    <Button 
                      variant={isActive ? "default" : "ghost"} 
                      className={`w-full justify-start ${isActive ? '' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Button>
                  </Link>
                );
              })}
            </div>

            <div className="mb-4">
              <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Meine Gruppen
              </h3>
              <div className="space-y-1">
                {activeMemberships.map((m) => (
                  <Link key={m.group_id} to={`/app/group/${m.group_id}`}>
                    <Button 
                      variant={location.pathname === `/app/group/${m.group_id}` ? "default" : "ghost"} 
                      size="sm" 
                      className="w-full justify-start"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      <span className="truncate">{m.groups.name}</span>
                      {m.role === 'trainer' && <span className="ml-auto text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">Trainer</span>}
                    </Button>
                  </Link>
                ))}
                {activeMemberships.length === 0 && !loading && (
                   <div className="px-4 text-sm text-muted-foreground italic">Keine aktiven Gruppen</div>
                )}
              </div>
            </div>

            {waitingMemberships.length > 0 && (
              <div>
                <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Wartend auf Bestätigung
                </h3>
                <div className="space-y-1">
                  {waitingMemberships.map((m) => (
                    <div key={m.group_id} className="px-4 py-2 text-sm text-yellow-500/80 flex items-center">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2 animate-pulse" />
                      <span className="truncate">{m.groups?.name || 'Wird geladen...'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="md:hidden flex items-center mb-6">
            <Button variant="outline" size="sm" onClick={() => setIsSidebarOpen(true)} className="flex items-center gap-2 border-white/10 bg-white/5">
              <Menu className="w-4 h-4" /> Navigation
            </Button>
          </div>
          <Routes>
              <Route path="/" element={
                 <DashboardHome 
                   activeMemberships={activeMemberships} 
                   waitingMemberships={waitingMemberships} 
                   profile={profile} 
                   user={user}
                   refreshMemberships={fetchMemberships}
                 />
              } />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/group/:id" element={<GroupPage userRole={activeMemberships} />} />
              {isGlobalAdmin && <Route path="/admin" element={<AdminPage />} />}
            </Routes>
        </main>
      </div>
    </div>
  );
};

const DashboardHome = ({ activeMemberships, waitingMemberships, profile, user, refreshMemberships }: any) => {
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const { isGlobalAdmin } = useAuth();

  useEffect(() => {
    fetchAvailableGroups();
  }, [activeMemberships, waitingMemberships]);
  
  const fetchAvailableGroups = async () => {
    const skipIds = [...activeMemberships, ...waitingMemberships].map(m => m.group_id);
    const query = supabase.from('groups').select('*');
    if (skipIds.length > 0) {
      query.not('id', 'in', `(${skipIds.join(',')})`);
    }
    const { data } = await query;
    if (data) setAvailableGroups(data);
  }

  const handleJoinGroup = async (groupId: string) => {
    if(!user) return;
    await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: user.id,
      role: isGlobalAdmin ? 'trainer' : 'member',
      status: isGlobalAdmin ? 'active' : 'waiting'
    });
    refreshMemberships();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <h1 className="text-4xl font-serif italic mb-2">Hallo, {profile?.first_name || 'Mitglied'}!</h1>
      <p className="text-muted-foreground text-lg mb-10">Willkommen im STS Wachendorf e.V. Vereinsportal.</p>

      {activeMemberships.length === 0 && waitingMemberships.length === 0 && (
        <div className="bg-card border border-white/10 rounded-xl p-8 text-center max-w-md mx-auto mt-12 shadow-xl mb-12">
          <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">Du bist noch in keiner Gruppe</h2>
          <p className="text-muted-foreground mb-6">Bitte frage bei einer Gruppe an, um Trainings zu sehen und teilzunehmen.</p>
        </div>
      )}
      
      {availableGroups.length > 0 && (
        <div className="mb-12">
           <h2 className="text-xl font-bold mb-4">Gruppen beitreten</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {availableGroups.map(g => (
               <div key={g.id} className="border border-white/10 bg-card/40 backdrop-blur-sm p-4 rounded-xl flex items-center justify-between">
                 <div>
                   <h3 className="font-semibold">{g.name}</h3>
                   <p className="text-xs text-muted-foreground">{g.description}</p>
                 </div>
                 <Button size="sm" onClick={() => handleJoinGroup(g.id)}>{isGlobalAdmin ? 'Beitreten' : 'Anfragen'}</Button>
               </div>
             ))}
           </div>
        </div>
      )}

      {activeMemberships.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-white/10 bg-card/40 backdrop-blur-sm">
             <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <CalendarIcon className="w-6 h-6" />
             </div>
             <h3 className="text-lg font-bold">Nächstes Training</h3>
             <p className="text-sm text-muted-foreground mt-1">Überprüfe deinen Kalender für anstehende Termine.</p>
             <Link to="/app/calendar">
                <Button variant="outline" className="mt-4 w-full">Zum Kalender</Button>
             </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
};
