import React, { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useAuth } from "../components/auth-provider";
import { supabase } from "../lib/supabase";
import { Navbar } from "../components/layout/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Calendar as CalendarIcon, Users, Settings, Plus, Home, Menu, X, Clock, MapPin, CheckCircle2, Circle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CalendarPage } from "./dashboard/CalendarPage";
import { GroupPage } from "./dashboard/GroupPage";
import { AdminPage } from "./dashboard/AdminPage";
import { cn } from "../lib/utils";
import { format, eachDayOfInterval } from "date-fns";
import { de } from "date-fns/locale";

export const Dashboard = () => {
  const { user, profile, isGlobalAdmin } = useAuth();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
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

  useEffect(() => {
    if (!loading) {
       const fetchAvailable = async () => {
         const skipIds = memberships.map(m => m.group_id);
         const { data } = await supabase.from('groups').select('*');
         if (data) {
           setAvailableGroups(data.filter(g => !skipIds.includes(g.id)));
         }
       }
       fetchAvailable();
    }
  }, [memberships, loading]);

  const handleJoinGroup = async (groupId: string) => {
    if(!user) return;
    await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: user.id,
      role: isGlobalAdmin ? 'trainer' : 'member',
      status: isGlobalAdmin ? 'active' : 'waiting'
    });
    fetchMemberships();
  };

  const activeMemberships = memberships.filter(m => m.status === 'active');
  const waitingMemberships = memberships.filter(m => m.status === 'waiting');
  
  const pendingNoteNameRequests = memberships.filter(m => m.note_name_requested);
  const [currentNoteNameInput, setCurrentNoteNameInput] = useState("");

  const handleSaveNoteName = async (membershipId: string) => {
    if (!currentNoteNameInput.trim()) return;
    await supabase.from('group_members').update({
      note_name: currentNoteNameInput.trim(),
      note_name_requested: false,
      note_name_request_message: null
    }).eq('id', membershipId);
    setCurrentNoteNameInput("");
    fetchMemberships();
  };

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

      <div className="relative z-50 w-full">
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
          "w-64 border-r border-black/10 dark:border-white/10 bg-white/90 dark:bg-black/40 backdrop-blur-xl flex flex-col z-50",
          "fixed inset-y-0 left-0 transition-transform duration-300 md:relative md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="p-4 flex justify-between items-center md:hidden border-b border-black/10 dark:border-white/10">
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
              <div className="mb-4">
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

            {availableGroups.length > 0 && (
              <div>
                <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Gruppen beitreten
                </h3>
                <div className="space-y-1">
                  {availableGroups.map(g => (
                    <div key={g.id} className="px-4 py-2 flex items-center justify-between group">
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium truncate text-foreground/90">{g.name}</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-6 text-[10px] px-2 opacity-100 transition-opacity shrink-0"
                        onClick={() => handleJoinGroup(g.id)}
                      >
                        {isGlobalAdmin ? 'Beitreten' : 'Anfrage'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="flex items-center justify-between xl:justify-end mb-6">
            <div className="md:hidden">
              <Button variant="outline" size="sm" onClick={() => setIsSidebarOpen(true)} className="flex items-center gap-2 border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                <Menu className="w-4 h-4" /> Navigation
              </Button>
            </div>
            <div id="header-actions" className="flex shrink-0"></div>
          </div>
          <Routes>
              <Route path="/" element={
                 <DashboardHome 
                   activeMemberships={activeMemberships} 
                   waitingMemberships={waitingMemberships} 
                   availableGroups={availableGroups}
                   handleJoinGroup={handleJoinGroup}
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

      {pendingNoteNameRequests.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 border border-black/10 dark:border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2 text-primary">Aktion erforderlich</h3>
            <p className="text-sm font-semibold mb-2">
              Ein Trainer hat einen Notiznamen (z.B. den Namen deines Kindes) in einer Gruppe angefordert.
            </p>
            {pendingNoteNameRequests[0].note_name_request_message && (
              <p className="text-sm text-muted-foreground pb-4 border-b border-black/10 dark:border-white/10 mb-4 italic">
                "{pendingNoteNameRequests[0].note_name_request_message}"
              </p>
            )}
            <div className="space-y-4 pt-1">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Notizname / Kindesname</label>
                <Input
                  className="mt-1"
                  value={currentNoteNameInput}
                  onChange={(e) => setCurrentNoteNameInput(e.target.value)}
                  placeholder="Notizname eingeben..."
                />
              </div>
              <Button className="w-full" onClick={() => handleSaveNoteName(pendingNoteNameRequests[0].id)}>
                Speichern
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DashboardHome = ({ activeMemberships, waitingMemberships, availableGroups, handleJoinGroup, profile, user, refreshMemberships }: any) => {
  const { isGlobalAdmin } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [myRsvps, setMyRsvps] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (activeMemberships.length > 0) {
      fetchDashboardData();
    }
  }, [activeMemberships, waitingMemberships]);
  
  const fetchDashboardData = async () => {
    setLoadingEvents(true);
    try {
      const groupIds = activeMemberships.map((m: any) => m.group_id);
      
      const today = new Date();
      today.setHours(0,0,0,0);
      const startStr = format(today, 'yyyy-MM-dd');
      
      // Let's get events for next 30 days
      const end = new Date(today);
      end.setDate(end.getDate() + 30);
      const endStr = format(end, 'yyyy-MM-dd');

      // 1. Fetch real events
      const { data: realEvents } = await supabase
        .from('events')
        .select('*')
        .in('group_id', groupIds)
        .gte('date', startStr)
        .lte('date', endStr);

      const eventsList = realEvents || [];

      // 2. Generate virtual events
      const allDays = eachDayOfInterval({ start: today, end: end });
      
      const combinedEvents: any[] = [...eventsList];

      for (const membership of activeMemberships) {
        const group = membership.groups;
        if (!group) continue;
        const templates = group.settings?.templates || [];
        if (templates.length === 0) continue;

        for (const day of allDays) {
          const dateStr = format(day, 'yyyy-MM-dd');
          const jsDay = day.getDay();
          
          const dailyTemplates = templates
            .filter((t: any) => Number(t.dayOfWeek) === jsDay)
            .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
            
          const realRegularEvents = combinedEvents
            .filter(e => e.group_id === group.id && e.date === dateStr && !e.is_event)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));

          dailyTemplates.forEach((t: any, idx: number) => {
            if (!realRegularEvents[idx]) {
              combinedEvents.push({
                id: `virtual-${dateStr}-${t.start_time}-${idx}-${group.id}`,
                group_id: group.id,
                title: t.title,
                date: dateStr,
                start_time: t.start_time.length === 5 ? t.start_time + ":00" : t.start_time,
                end_time: t.end_time.length === 5 ? t.end_time + ":00" : t.end_time,
                is_event: false,
                is_cancelled: false,
                is_virtual: true,
                is_active: true
              });
            }
          });
        }
      }

      // Filter out inactive events
      // For dashboard, we want to only show active ones for standard members
      const filteredEvents = combinedEvents.filter(e => e.is_active !== false);

      // Sort
      filteredEvents.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.start_time || '').localeCompare(b.start_time || '');
      });

      setUpcomingEvents(filteredEvents);

      // 3. Fetch RSVPs
      if (user) {
        // We only fetch RSVPs for real events. Virtual events haven't been created yet so no RSVPs.
        const realEventIds = filteredEvents.filter(e => !e.is_virtual).map(e => e.id);
        if (realEventIds.length > 0) {
          const { data: rsvps } = await supabase
            .from('rsvps')
            .select('*')
            .in('event_id', realEventIds)
            .eq('user_id', user.id);
          
          if (rsvps) setMyRsvps(rsvps);
        } else {
           setMyRsvps([]);
        }
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEvents(false);
    }
  };

  const renderEventCard = (event: any, isConfirmed: boolean) => {
    const rsvp = myRsvps.find(r => r.event_id === event.id);

    return (
      <Link key={event.id} to={`/app/group/${event.group_id}?eventId=${event.id}&date=${event.date}`}>
        <div className={cn(
          "p-4 rounded-xl border border-black/5 dark:border-white/5 bg-black/5 hover:bg-black/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.04] transition-colors relative overflow-hidden group",
          event.is_cancelled && "opacity-60 grayscale"
        )}>
           {event.is_event ? (
               <div className="absolute top-0 right-0 w-2 h-full bg-purple-500/50" />
           ) : (
               <div className="absolute top-0 right-0 w-1 h-full bg-primary/30" />
           )}
           <div className="flex justify-between items-start mb-2">
             <div className="flex items-center gap-2">
               <div className="bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-black/10 dark:border-white/10 text-center min-w-[3rem]">
                 <div className="text-[10px] uppercase font-bold text-muted-foreground leading-none mb-1">
                   {format(new Date(event.date), 'MMM', { locale: de })}
                 </div>
                 <div className="text-lg font-bold leading-none">
                   {format(new Date(event.date), 'dd')}
                 </div>
               </div>
               <div>
                 <h4 className={cn("font-semibold text-sm sm:text-base", event.is_cancelled && "line-through")}>
                   {event.title}
                 </h4>
                 <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                   <Clock className="w-3 h-3" />
                   {event.start_time.slice(0, 5)} - {event.end_time.slice(0, 5)} Uhr
                 </div>
               </div>
             </div>
             {isConfirmed ? (
                <div className="bg-green-500/20 text-green-500 p-1.5 rounded-full border border-green-500/30">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
             ) : rsvp?.status === 'maybe' ? (
                <span className="text-[10px] bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded border border-yellow-500/20 whitespace-nowrap">Vielleicht</span>
             ) : rsvp?.status === 'no' ? (
                <span className="text-[10px] bg-red-500/20 text-red-600 dark:text-red-400 px-2 py-1 rounded border border-red-500/20 whitespace-nowrap">Absage</span>
             ) : (
                <div className="text-muted-foreground/30 p-1.5">
                  <Circle className="w-4 h-4" />
                </div>
             )}
           </div>
           
           {event.topic && !event.is_cancelled && (
             <div className="mt-3 text-xs bg-primary/10 text-primary/80 px-2 py-1.5 rounded border border-primary/10 inline-block line-clamp-1">
               <strong>Thema:</strong> {event.topic}
             </div>
           )}
           
           {event.is_cancelled && (
             <div className="mt-3 text-xs font-semibold text-red-500/80">Termin fällt aus</div>
           )}
        </div>
      </Link>
    );
  };

  const confirmedEvents = upcomingEvents.filter(e => myRsvps.some(r => r.event_id === e.id && r.status === 'yes'));
  
  // Group all events (excluding those they already RSVP'd yes to).
  const openEventsByGroup: Record<string, { group: any, events: any[] }> = {};
  
  upcomingEvents.forEach(e => {
    const isYes = myRsvps.some(r => r.event_id === e.id && r.status === 'yes');
    if (!isYes) {
      if (!openEventsByGroup[e.group_id]) {
        openEventsByGroup[e.group_id] = {
           group: activeMemberships.find((m: any) => m.group_id === e.group_id)?.groups,
           events: []
        };
      }
      openEventsByGroup[e.group_id].events.push(e);
    }
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <h1 className="text-4xl font-serif italic mb-2">Hallo, {profile?.first_name || 'Mitglied'}!</h1>
      <p className="text-muted-foreground text-lg mb-10">Willkommen im STS Wachendorf e.V. Vereinsportal.</p>

      {activeMemberships.length === 0 && (
        <div className="bg-card border border-black/10 dark:border-white/10 rounded-xl p-8 text-center max-w-md mx-auto mt-12 shadow-xl mb-12">
          <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">
            {waitingMemberships.length > 0 
              ? "Deine Anfragen werden bearbeitet" 
              : "Du bist noch in keiner Gruppe"
            }
          </h2>
          <p className="text-muted-foreground mb-6">
            {waitingMemberships.length > 0 
              ? `Du hast bereits ${waitingMemberships.length > 1 ? 'Anfragen' : 'eine Anfrage'} gesendet. Sobald ein Trainer dich freischaltet, siehst du hier alle Termine.`
              : "Bitte stelle eine Anfrage bei einer verfügbaren Gruppe, um Trainings zu sehen und teilzunehmen."
            }
          </p>
          
          {availableGroups && availableGroups.length > 0 && (
             <div className="mt-6 text-left border-t border-black/10 dark:border-white/10 pt-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 text-center">
                  Weitere Gruppen
                </h3>
                <div className="space-y-2">
                  {availableGroups.map((g: any) => (
                    <div key={g.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{g.name}</p>
                        {g.description && <p className="text-xs text-muted-foreground truncate">{g.description}</p>}
                      </div>
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => handleJoinGroup(g.id)}
                        className="shrink-0"
                      >
                        {isGlobalAdmin ? 'Beitreten' : 'Anfragen'}
                      </Button>
                    </div>
                  ))}
                </div>
             </div>
          )}
        </div>
      )}
      
      {activeMemberships.length > 0 && !loadingEvents && (
        <div className="space-y-12">
           {/* Section 1: Confirmed Events */}
           {confirmedEvents.length > 0 && (
             <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                   <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">
                     <CheckCircle2 className="w-5 h-5" />
                   </div>
                   Meine Zusagen
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {confirmedEvents.map(e => renderEventCard(e, true))}
                </div>
             </div>
           )}

           {/* Section 2: Open/Pending Events by Group */}
           <div>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                 <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                   <CalendarIcon className="w-5 h-5" />
                 </div>
                 Offene Termine (Nach Gruppe)
              </h2>
              
              {Object.keys(openEventsByGroup).length === 0 ? (
                 <p className="text-muted-foreground italic">Aktuell gibt es keine weiteren 
offenen Termine.</p>
              ) : (
                 <div className="space-y-8">
                   {Object.values(openEventsByGroup).map(({ group, events }) => (
                     <div key={group?.id} className="bg-card/40 border border-black/10 dark:border-white/10 p-5 rounded-2xl">
                       <div className="flex items-center gap-3 mb-4 border-b border-black/10 dark:border-white/10 pb-3">
                         <div className="w-10 h-10 rounded-lg bg-black/5 dark:bg-black/20 flex items-center justify-center border border-black/5 dark:border-white/5">
                           <Users className="w-5 h-5 text-muted-foreground" />
                         </div>
                         <div>
                           <h3 className="font-bold text-lg">{group?.name}</h3>
                           <p className="text-xs text-muted-foreground">Klicke auf einen Termin, um zu-, abzusagen oder Details zu sehen.</p>
                         </div>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {events.slice(0, 6).map(e => renderEventCard(e, false))}
                       </div>
                       {events.length > 6 && (
                         <div className="mt-4 text-center">
                           <Link to={`/app/group/${group?.id}`}>
                             <Button variant="ghost" size="sm" className="text-xs">
                               + {events.length - 6} weitere Termine in der Gruppe anzeigen
                             </Button>
                           </Link>
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
              )}
           </div>
        </div>
      )}
      
      {activeMemberships.length > 0 && loadingEvents && (
        <div className="py-20 flex flex-col items-center justify-center opacity-50">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium">Lade Termine...</p>
        </div>
      )}
    </motion.div>
  );
};
