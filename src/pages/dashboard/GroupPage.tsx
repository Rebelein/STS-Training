import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../components/auth-provider";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { Users, UserCheck, Clock, CalendarIcon, FileText, Plus, X, ChevronLeft, ChevronRight, List as ListIcon, Settings, RotateCcw, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

import { createPortal } from "react-dom";

export const GroupPage = ({ userRole }: { userRole: any[] }) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialEventId = searchParams.get('eventId');
  const initialDateStr = searchParams.get('date');
  const initialDate = initialDateStr ? new Date(initialDateStr) : new Date();

  const { id } = useParams<{ id: string }>();
  const { user, isGlobalAdmin } = useAuth();
  const [group, setGroup] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [rsvps, setRsvps] = useState<any[]>([]);
  const [allRsvps, setAllRsvps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New event state
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<any>(null);
  const [memberTab, setMemberTab] = useState<'trainer' | 'member'>('member');
  const [newEvent, setNewEvent] = useState<{ id?: string, title: string, description: string, topic: string, date: string, start_time: string, end_time: string, is_event: boolean }>({ title: '', description: '', topic: '', date: '', start_time: '', end_time: '', is_event: false });

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(initialDate);
  
  // Settings
  const [settingsMonth, setSettingsMonth] = useState(new Date());

  // Expanded event for RSVP
  const [expandedEventId, setExpandedEventId] = useState<string | null>(initialEventId);

  // Settings Modal
  const [showSettings, setShowSettings] = useState(false);
  const [templates, setTemplates] = useState<{ dayOfWeek: number, start_time: string, end_time: string, title: string }[]>([]);

  const currentRole = userRole.find(r => r.group_id === id)?.role || 'member';
  const isTrainer = currentRole === 'trainer' || isGlobalAdmin;

  const [headerActionsContainer, setHeaderActionsContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderActionsContainer(document.getElementById('header-actions'));
  }, []);

  useEffect(() => {
    if (id) {
      fetchGroupData();
    }
  }, [id, currentMonth]);

  const fetchGroupData = async () => {
    setLoading(true);
    
    // Fetch group details
    const { data: gData } = await supabase.from('groups').select('*').eq('id', id).single();
    if (gData) {
      setGroup(gData);
      try {
        const parsedSettings = typeof gData.settings === 'string' ? JSON.parse(gData.settings) : gData.settings;
        if (parsedSettings && parsedSettings.templates) {
          setTemplates(parsedSettings.templates);
        } else {
           setTemplates([]);
        }
      } catch(e) {
        setTemplates([]);
      }
    }

    // Fetch events (for calendar we need month range, for list we need upcoming)
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const today = new Date().toISOString().split('T')[0];

    const { data: eData } = await supabase
      .from('events')
      .select('*')
      .eq('group_id', id)
      .gte('date', viewMode === 'calendar' ? start : today)
      .lte('date', viewMode === 'calendar' ? end : '2099-12-31')
      .order('date', { ascending: true })
      .limit(viewMode === 'list' ? 100 : 500); // Increased limit slightly to ensure we grab all
      
    if (eData) setEvents(eData);

    // Fetch members if trainer
    if (isTrainer) {
      const { data: mData } = await supabase
        .from('group_members')
        .select('*, profiles(first_name, last_name, email)')
        .eq('group_id', id);
      if (mData) setMembers(mData);
    }
    
    // Fetch RSVPs
    if (eData) {
      const eventIds = eData.map(e => e.id);
      if (eventIds.length > 0) {
        if (isTrainer) {
          const { data: rData } = await supabase
            .from('rsvps')
            .select('*')
            .in('event_id', eventIds);
          if (rData) {
            setAllRsvps(rData);
            if (user) {
              setRsvps(rData.filter(r => r.user_id === user.id));
            }
          }
        } else if (user) {
          const { data: rData } = await supabase
            .from('rsvps')
            .select('*')
            .in('event_id', eventIds)
            .eq('user_id', user.id);
          if (rData) setRsvps(rData);
        }
      } else {
        setRsvps([]);
        setAllRsvps([]);
      }
    }

    setLoading(false);
  };

  const getCombinedEvents = () => {
    let combined = [...events];
    
    // Generate virtual events based on templates
    if (templates.length > 0) {
      const allDays = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
      const today = new Date();
      today.setHours(0,0,0,0);
      
      for (const day of allDays) {
        // Only generate for present and future if in list mode
        if (viewMode === 'list' && day < today) continue;
        
        const dateStr = format(day, 'yyyy-MM-dd');
        const jsDay = day.getDay();
        
        // Find templates for this specific day of week
        const dailyTemplates = templates
          .filter(t => Number(t.dayOfWeek) === jsDay)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        
        // Find existing real training sessions for this day
        const realRegularEvents = combined
          .filter(e => e.date === dateStr && !e.is_event)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        
        // For each template, check if a real event already exists in that "slot"
        dailyTemplates.forEach((t, idx) => {
          // If there is no real event for this template slot yet, add a virtual one
          if (!realRegularEvents[idx]) {
            combined.push({
              id: `virtual-${dateStr}-${t.start_time}-${idx}`,
              group_id: id,
              title: t.title,
              date: dateStr,
              start_time: t.start_time.length === 5 ? t.start_time + ":00" : t.start_time,
              end_time: t.end_time.length === 5 ? t.end_time + ":00" : t.end_time,
              is_event: false,
              is_cancelled: false,
              is_virtual: true
            });
          }
        });
      }
    }
    
    // Sort combined by date and start_time
    combined.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
    
    // Filter if list mode: only show events for the currently selected month that are also >= today
    if (viewMode === 'list') {
      const startOfM = startOfMonth(currentMonth);
      const endOfM = endOfMonth(currentMonth);
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      combined = combined.filter(e => {
         const d = new Date(e.date);
         return d >= startOfM && d <= endOfM && e.date >= todayStr;
      });
    }
    
    combined = combined.filter(e => e.is_active !== false);
    return combined;
  };
  
  const getSettingsEvents = () => {
    let combined = [...events];
    if (templates.length > 0) {
      const allDays = eachDayOfInterval({ start: startOfMonth(settingsMonth), end: endOfMonth(settingsMonth) });
      for (const day of allDays) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const jsDay = day.getDay();
        const dailyTemplates = templates.filter(t => Number(t.dayOfWeek) === jsDay).sort((a, b) => a.start_time.localeCompare(b.start_time));
        const realRegularEvents = combined.filter(e => e.date === dateStr && !e.is_event).sort((a, b) => a.start_time.localeCompare(b.start_time));
        dailyTemplates.forEach((t, idx) => {
          if (!realRegularEvents[idx]) {
            combined.push({
              id: `virtual-${dateStr}-${t.start_time}-${idx}`,
              group_id: id,
              title: t.title,
              date: dateStr,
              start_time: t.start_time.length === 5 ? t.start_time + ":00" : t.start_time,
              end_time: t.end_time.length === 5 ? t.end_time + ":00" : t.end_time,
              is_event: false,
              is_cancelled: false,
              is_virtual: true
            });
          }
        });
      }
    }
    
    combined.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
    
    const startOfM = startOfMonth(settingsMonth);
    const endOfM = endOfMonth(settingsMonth);
    return combined.filter(e => {
       const d = new Date(e.date);
       return d >= startOfM && d <= endOfM;
    });
  };

  // Helper function to resolve virtual event
  const resolveVirtualEvent = async (eventObj: any) => {
    if (!eventObj.is_virtual) return eventObj;
    
    let res = await supabase.from('events').insert({
      group_id: id,
      title: eventObj.title,
      date: eventObj.date,
      start_time: eventObj.start_time,
      end_time: eventObj.end_time,
      is_event: false,
      is_cancelled: false,
      is_active: eventObj.is_active !== undefined ? eventObj.is_active : true
    }).select().single();
    
    if (res.error && res.error.message.includes('is_active')) {
       res = await supabase.from('events').insert({
         group_id: id,
         title: eventObj.title,
         date: eventObj.date,
         start_time: eventObj.start_time,
         end_time: eventObj.end_time,
         is_event: false,
         is_cancelled: false
       }).select().single();
    }
    
    if (res.error) {
      console.error(res.error);
      return null;
    }
    
    return res.data;
  }
  
  const handleToggleEventActive = async (eventObj: any) => {
    try {
      const realEvent = await resolveVirtualEvent(eventObj);
      if (!realEvent) return;
      
      const newActiveState = realEvent.is_active === false ? true : false;
      const { error } = await supabase.from('events').update({ is_active: newActiveState }).eq('id', realEvent.id);
      
      if (error) throw error;
      fetchGroupData();
    } catch(e: any) {
      console.error(e);
      alert("Fehler beim Speichern. Evtl. fehlt die 'is_active' Spalte in der Datenbank.\n\nBitte folgendes SQL Skript im Supabase Dashboard ausführen:\n\nALTER TABLE events ADD COLUMN is_active BOOLEAN DEFAULT true;");
    }
  };

  const handleRSVP = async (eventObj: any, status: 'yes' | 'no' | 'maybe') => {
    if (!user) return;
    
    try {
      const realEvent = await resolveVirtualEvent(eventObj);
      if (!realEvent) return;

      const existing = rsvps.find(r => r.event_id === realEvent.id);
      
      if (existing) {
        await supabase.from('rsvps').update({ status }).eq('id', existing.id);
      } else {
        await supabase.from('rsvps').insert({ event_id: realEvent.id, user_id: user.id, status });
      }
      
      fetchGroupData(); // Refresh state
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteEvent = async (eventObj: any) => {
    if (!isTrainer) return;
    try {
      const realEvent = await resolveVirtualEvent(eventObj);
      if (!realEvent) return;
      
      const { error } = await supabase.from('events').update({ is_active: false }).eq('id', realEvent.id);
      if (error) throw error;
      fetchGroupData();
    } catch(e: any) {
      console.error(e);
      alert("Fehler beim Löschen des Termins.");
    } finally {
      setEventToDelete(null);
    }
  };

  const handleCancelEvent = async (eventObj: any) => {
    if (!isTrainer) return;
    try {
      const realEvent = await resolveVirtualEvent(eventObj);
      if (!realEvent) return;
      
      await supabase.from('events').update({ is_cancelled: true }).eq('id', realEvent.id);
      fetchGroupData();
    } catch(e) {
      console.error(e);
      alert("Fehler beim Absagen. Evtl. fehlt die 'is_cancelled' Spalte in der Datenbank.");
    }
  };

  const handleReactivateEvent = async (eventObj: any) => {
    if (!isTrainer) return;
    try {
      const realEvent = await resolveVirtualEvent(eventObj);
      if (!realEvent) return;
      
      await supabase.from('events').update({ is_cancelled: false }).eq('id', realEvent.id);
      fetchGroupData();
    } catch(e) {
      console.error(e);
      alert("Fehler beim Reaktivieren.");
    }
  };

  const handleSaveSettings = async () => {
    if (!id) return;
    try {
      // 1. Update the group settings in Supabase
      await supabase.from('groups').update({
        settings: { templates }
      }).eq('id', id);

      // 2. Synchronize future regular events already in the database
      const today = new Date().toISOString().split('T')[0];
      const { data: futureEvents } = await supabase
        .from('events')
        .select('*')
        .eq('group_id', id)
        .eq('is_event', false)
        .gte('date', today);

      if (futureEvents && futureEvents.length > 0) {
        // Group by date to match by index per day
        const eventsByDate: Record<string, any[]> = {};
        futureEvents.forEach(e => {
          if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
          eventsByDate[e.date].push(e);
        });

        // For each day, align with templates and update
        for (const dateStr of Object.keys(eventsByDate)) {
          const jsDay = new Date(dateStr).getDay();
          const dayTemplates = templates
            .filter(t => Number(t.dayOfWeek) === jsDay)
            .sort((a,b) => a.start_time.localeCompare(b.start_time));
          
          const dayEvents = eventsByDate[dateStr].sort((a,b) => a.start_time.localeCompare(b.start_time));
          
          for (let i = 0; i < Math.min(dayTemplates.length, dayEvents.length); i++) {
            const t = dayTemplates[i];
            const e = dayEvents[i];
            
            // If template properties differ from event, update event
            const tStartTime = t.start_time.length === 5 ? t.start_time + ":00" : t.start_time;
            const tEndTime = t.end_time.length === 5 ? t.end_time + ":00" : t.end_time;
            
            if (e.title !== t.title || e.start_time !== tStartTime || e.end_time !== tEndTime) {
               await supabase.from('events').update({
                 title: t.title,
                 start_time: tStartTime,
                 end_time: tEndTime
               }).eq('id', e.id);
            }
          }
        }
      }

      setShowSettings(false);
      fetchGroupData();
    } catch(e) {
      console.error(e);
      alert("Fehler beim Speichern. Evtl. fehlt die 'settings' Spalte in der Datenbank.");
    }
  };

  const handleMemberStatus = async (memberId: string, status: string) => {
    await supabase.from('group_members').update({ status }).eq('id', memberId);
    fetchGroupData();
  };
  
  const handleMemberRole = async (memberId: string, role: string) => {
    await supabase.from('group_members').update({ role }).eq('id', memberId);
    fetchGroupData();
  }

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    
    if (newEvent.id) {
       await supabase.from('events').update({
         title: newEvent.title,
         description: newEvent.description,
         topic: newEvent.topic,
         date: newEvent.date,
         start_time: newEvent.start_time,
         end_time: newEvent.end_time,
         is_event: newEvent.is_event
       }).eq('id', newEvent.id);
    } else {
       const { id: _, ...insertData } = newEvent;
       await supabase.from('events').insert({
         group_id: id,
         ...insertData
       });
    }
    
    setShowEventForm(false);
    setNewEvent({ title: '', description: '', topic: '', date: '', start_time: '', end_time: '', is_event: false });
    fetchGroupData();
  };

  const handleEditClick = async (eventObj: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const realEvent = await resolveVirtualEvent(eventObj);
    if (!realEvent) return;
    
    setNewEvent({
       id: realEvent.id,
       title: realEvent.title || '',
       description: realEvent.description || '',
       topic: realEvent.topic || '',
       date: realEvent.date || '',
       start_time: realEvent.start_time || '',
       end_time: realEvent.end_time || '',
       is_event: realEvent.is_event || false
    });
    setShowEventForm(true);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });

  const combinedEvents = getCombinedEvents();

  if (loading && !group) return <div>Lade Gruppe...</div>;
  if (!group) return <div>Gruppe nicht gefunden.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto pb-12">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-serif italic mb-3">{group.name}</h1>
          <p className="text-muted-foreground text-lg">{group.description}</p>
          <div className="flex gap-2 mt-4">
            {isTrainer && (
              <span className="inline-block bg-primary/20 text-primary px-2 py-1 rounded text-sm font-medium">
                Trainer Ansicht
              </span>
            )}
            {currentRole === 'member' && (
              <span className="inline-block bg-white/10 px-2 py-1 rounded text-sm font-medium">
                Mitglied
              </span>
            )}
          </div>
        </div>
        {isTrainer && headerActionsContainer && createPortal(
          <Button variant="secondary" onClick={() => setShowSettings(!showSettings)} className="w-full sm:w-auto mt-4 md:mt-0 flex shrink-0">
            <Settings className="w-4 h-4 mr-2" />
            Einstellungen
          </Button>,
          headerActionsContainer
        )}
      </div>

      {showSettings && (
        <Card className="border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 shadow-xl mb-6">
          <CardHeader className="pb-3 border-b border-black/5 dark:border-white/5 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Gruppen-Einstellungen & Trainings-Vorlagen</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="text-sm text-muted-foreground mb-2">
              Lege hier fest, an welchen Tagen reguläres Training stattfindet. Das System generiert diese Termine automatisch für den Kalender.
            </div>
            
            <div className="space-y-3">
              {templates.map((tpl, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 p-3 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5 relative">
                  <select 
                    value={tpl.dayOfWeek}
                    onChange={(e) => {
                      const nt = [...templates];
                      nt[idx].dayOfWeek = parseInt(e.target.value);
                      setTemplates(nt);
                    }}
                    className="h-8 bg-black/20 border border-white/10 rounded px-2 text-sm"
                  >
                    <option value={1}>Montag</option>
                    <option value={2}>Dienstag</option>
                    <option value={3}>Mittwoch</option>
                    <option value={4}>Donnerstag</option>
                    <option value={5}>Freitag</option>
                    <option value={6}>Samstag</option>
                    <option value={0}>Sonntag</option>
                  </select>
                  
                  <Input 
                    type="time" 
                    value={tpl.start_time} 
                    onChange={(e) => {
                      const nt = [...templates];
                      nt[idx].start_time = e.target.value;
                      setTemplates(nt);
                    }} 
                    className="w-24 h-8 text-sm"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input 
                    type="time" 
                    value={tpl.end_time} 
                    onChange={(e) => {
                      const nt = [...templates];
                      nt[idx].end_time = e.target.value;
                      setTemplates(nt);
                    }} 
                    className="w-24 h-8 text-sm" 
                  />
                  
                  <Input 
                    value={tpl.title}
                    placeholder="Titel (z.B. Reguläres Training)"
                    onChange={(e) => {
                      const nt = [...templates];
                      nt[idx].title = e.target.value;
                      setTemplates(nt);
                    }} 
                    className="h-8 text-sm flex-1 min-w-[150px]" 
                  />
                  
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-red-500 hover:bg-red-500/20" onClick={() => {
                    const nt = [...templates];
                    nt.splice(idx, 1);
                    setTemplates(nt);
                  }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              <Button variant="outline" size="sm" onClick={() => setTemplates([...templates, { dayOfWeek: 1, start_time: '19:00', end_time: '21:00', title: 'Reguläres Training' }])} className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" /> Trainingstag hinzufügen
              </Button>
            </div>
            
            <div className="pt-6 mt-6 border-t border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Monatsübersicht & Training-Aktivierung</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aktiviere oder deaktiviere einzelne Trainings für den Monat. Inaktive Trainings werden regulären Mitgliedern nicht angezeigt.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 bg-black/20 dark:bg-white/10 rounded-md p-1 border border-white/5 mx-auto sm:mx-0 min-w-max">
                  <Button variant="ghost" size="icon" className="w-7 h-7 rounded" onClick={() => setSettingsMonth(new Date(settingsMonth.getFullYear(), settingsMonth.getMonth() - 1, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs font-semibold px-2 min-w-[100px] text-center">
                    {format(settingsMonth, 'MMMM yyyy', { locale: de })}
                  </span>
                  <Button variant="ghost" size="icon" className="w-7 h-7 rounded" onClick={() => setSettingsMonth(new Date(settingsMonth.getFullYear(), settingsMonth.getMonth() + 1, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {getSettingsEvents().map((se) => (
                  <div key={se.id} className={cn("p-3 rounded-lg border flex items-start justify-between gap-3 text-sm transition-colors", se.is_active === false ? "bg-red-500/10 border-red-500/20 opacity-80" : "bg-black/5 dark:bg-white/5 border-white/5")}>
                    <div>
                      <div className="font-semibold flex items-center gap-1.5 flex-wrap">
                        {format(new Date(se.date), 'dd.MM.', { locale: de })} - {se.start_time.slice(0,5)}
                        {se.is_event ? (
                           <span className="text-[10px] bg-purple-500/20 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded ml-1">Event</span>
                        ) : null}
                      </div>
                      <div className="text-xs mt-1 text-muted-foreground truncate max-w-[200px]">{se.title}</div>
                    </div>
                    <Button 
                      size="sm" 
                      variant={se.is_active === false ? "outline" : "default"}
                      onClick={() => handleToggleEventActive(se)}
                      className={cn("h-7 text-xs", se.is_active === false ? "border-red-500/30 text-red-500 hover:bg-red-500/10" : "bg-green-500 hover:bg-green-600 text-white")}
                    >
                      {se.is_active === false ? "Inaktiv" : "Aktiv"}
                    </Button>
                  </div>
                ))}
                {getSettingsEvents().length === 0 && (
                  <div className="col-span-2 text-center text-xs text-muted-foreground py-6">Keine Termine für diesen Monat gefunden.</div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-white/5">
              <Button onClick={handleSaveSettings}>Einstellungen speichern</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Events */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-2xl font-serif flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <span className="italic">Trainings & Events</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 shadow-sm">
              <div className="flex bg-black/20 dark:bg-white/5 rounded-lg border border-white/10 p-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setViewMode('list')} 
                  className={cn("h-7 px-3 text-xs w-20 flex gap-2 items-center rounded-md font-medium transition-all", viewMode === 'list' && "bg-white/10 dark:bg-white/20 shadow-sm")}
                >
                  <ListIcon className="w-3.5 h-3.5" /> Liste
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setViewMode('calendar')} 
                  className={cn("h-7 px-3 text-xs w-24 flex gap-2 items-center rounded-md font-medium transition-all", viewMode === 'calendar' && "bg-white/10 dark:bg-white/20 shadow-sm")}
                >
                  <CalendarIcon className="w-3.5 h-3.5" /> Kalender
                </Button>
              </div>
              {isTrainer && !showEventForm && (
                <Button size="sm" className="h-9 px-3 flex-1 sm:flex-none" onClick={() => {
                  setNewEvent({ title: '', description: '', topic: '', date: '', start_time: '', end_time: '', is_event: false });
                  setShowEventForm(true);
                }}>
                  <Plus className="w-4 h-4 mr-1.5" /> Neuer Termin
                </Button>
              )}
            </div>
          </div>
          
          {showEventForm && (
            <Card className="border-primary/50 bg-primary/5 shadow-lg shadow-primary/5">
              <CardHeader className="pb-3 border-b border-primary/10 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{newEvent.id ? "Termin bearbeiten" : "Neuer Termin"}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => {
                  setShowEventForm(false);
                  setNewEvent({ title: '', description: '', topic: '', date: '', start_time: '', end_time: '', is_event: false });
                }} className="w-8 h-8 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleSaveEvent} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Titel (z.B. Reguläres Training)</label>
                      <Input required value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="Titel..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Datum</label>
                      <Input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Startzeit</label>
                      <Input required type="time" value={newEvent.start_time} onChange={e => setNewEvent({...newEvent, start_time: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Endzeit</label>
                      <Input required type="time" value={newEvent.end_time} onChange={e => setNewEvent({...newEvent, end_time: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Thema (optional, z.B. Choreografie Akt 1)</label>
                    <Input value={newEvent.topic} onChange={e => setNewEvent({...newEvent, topic: e.target.value})} placeholder="Thema für dieses Training..." />
                  </div>
                  <div className="space-y-2 flex items-center pt-2">
                    <label className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                      <input 
                         type="checkbox" 
                         checked={newEvent.is_event} 
                         onChange={e => setNewEvent({...newEvent, is_event: e.target.checked})} 
                         className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" 
                      />
                      Ist ein Event/Auftritt (statt regulärem Training)
                    </label>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button type="submit" className="w-full sm:w-auto">Eintragen</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 py-2 px-4 rounded-xl border border-white/5 mb-4">
            <button onClick={prevMonth} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
            <span className="font-serif italic text-lg capitalize font-medium">
              {format(currentMonth, 'MMMM yyyy', { locale: de })}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button>
          </div>

          {viewMode === 'calendar' ? (
            <div className="space-y-4">
              <div className="-mx-4 sm:mx-0 overflow-x-auto pb-4 custom-scrollbar">
                <Card className="border-white/10 bg-card/60 backdrop-blur-xl overflow-hidden shadow-xl min-w-[700px] sm:min-w-0 border-x-0 rounded-none sm:rounded-xl sm:border-x">
                  <div className="grid grid-cols-7 border-b border-white/5 bg-black/5 dark:bg-white/5">
                    {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                      <div key={day} className="py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 auto-rows-[minmax(90px,auto)]">
                    {Array.from({ length: (startOfMonth(currentMonth).getDay() + 6) % 7 }).map((_, i) => (
                      <div key={`empty-${i}`} className="border-r border-b border-white/5 bg-black/5 dark:bg-white/5 p-1 sm:p-2" />
                    ))}
                    
                    {daysInMonth.map((day, i) => {
                    const dayEvents = combinedEvents.filter(e => e.date === format(day, 'yyyy-MM-dd'));
                    const isTodayDate = isToday(day);
                    
                    return (
                      <div 
                        key={day.toISOString()} 
                        className={cn(
                          "border-r border-b border-white/5 p-1 sm:p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5 group relative",
                          !isSameMonth(day, currentMonth) && "text-muted-foreground/50 bg-black/5 dark:bg-white/5"
                        )}
                        onClick={() => {
                          if (isTrainer) {
                            setNewEvent(prev => ({ title: '', description: '', topic: '', date: format(day, 'yyyy-MM-dd'), start_time: '', end_time: '', is_event: false }));
                            setShowEventForm(true);
                            // Scroll to top where the form is smoothly
                            window.scrollTo({ top: 300, behavior: 'smooth' });
                          }
                        }}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className={cn(
                            "w-6 h-6 flex items-center justify-center rounded-full text-xs",
                            isTodayDate ? "bg-primary text-primary-foreground font-bold shadow-sm shadow-primary/20" : "font-medium"
                          )}>
                            {format(day, 'd')}
                          </div>
                          {isTrainer && <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />}
                        </div>
                        
                        <div className="space-y-1">
                          {dayEvents.map(event => {
                            const thisEventRsvps = allRsvps.filter(r => r.event_id === event.id);
                            const memberOverviews = members.filter(m => m.status === 'active' && !m.is_hidden).map(m => ({
                              ...m,
                              rsvp: thisEventRsvps.find(r => r.user_id === m.user_id)?.status || 'unknown'
                            }));
                            const subscribedTrainers = memberOverviews.filter(m => (m.role === 'trainer' || m.role === 'admin') && m.rsvp === 'yes');

                            return (
                              <div 
                                key={event.id}
                                className={cn(
                                  "text-[10px] sm:text-xs p-1 rounded font-medium cursor-pointer transition-transform hover:scale-[1.02] flex flex-col",
                                  event.is_cancelled ? "bg-red-500/10 text-red-500 border border-red-500/20 line-through opacity-70" :
                                  event.is_active === false ? "bg-gray-500/20 text-gray-500 dark:text-gray-400 border border-gray-500/30 opacity-70" :
                                  event.is_event 
                                    ? "bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20" 
                                    : "bg-primary/20 text-primary-foreground border border-primary/20"
                                )}
                                title={event.title}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedEventId(event.id);
                                }}
                              >
                                <span className="truncate">{event.start_time.slice(0,5)} {event.title}</span>
                                {subscribedTrainers.length > 0 && (
                                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                                    {subscribedTrainers.map(t => (
                                      <span key={t.id} className="text-[8px] sm:text-[9px] bg-background/30 dark:bg-black/30 border border-white/10 px-1 rounded-sm text-foreground/90 truncate max-w-[80px]">
                                        {t.profiles?.first_name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {combinedEvents.length === 0 && !showEventForm && (
                <Card className="bg-card/30 border-white/5"><CardContent className="p-6 text-center text-muted-foreground">Keine Termine in diesem Zeitraum gefunden.</CardContent></Card>
              )}
              {combinedEvents.map((event) => {
                const myRsvp = rsvps.find(r => r.event_id === event.id)?.status;
                const isExpanded = expandedEventId === event.id;
                
                const thisEventRsvps = allRsvps.filter(r => r.event_id === event.id);
                const memberOverviews = members.filter(m => m.status === 'active' && !m.is_hidden).map(m => ({
                  ...m,
                  rsvp: thisEventRsvps.find(r => r.user_id === m.user_id)?.status || 'unknown'
                }));
                const subscribedTrainers = memberOverviews.filter(m => (m.role === 'trainer' || m.role === 'admin') && m.rsvp === 'yes');
                const counts = {
                  yes: memberOverviews.filter(m => m.role === 'member' && m.rsvp === 'yes').length,
                  maybe: memberOverviews.filter(m => m.role === 'member' && m.rsvp === 'maybe').length,
                  no: memberOverviews.filter(m => m.role === 'member' && m.rsvp === 'no').length,
                };
                
                return (
                  <Card 
                    key={event.id} 
                    id={`event-${event.id}`}
                    className={cn(
                      "group relative overflow-hidden transition-all duration-300 hover:shadow-md mb-4", 
                      event.is_cancelled || event.is_active === false 
                        ? "opacity-60 bg-muted/30 border-white/5" 
                        : "bg-gradient-to-br from-card to-card/50 border-black/5 dark:border-white/10 hover:border-primary/20",
                      event.is_active === false && "border-dashed border-white/20"
                    )}
                  >
                    {/* Subtle highlight line on top for active events */}
                    {!event.is_cancelled && event.is_active !== false && (
                       <div className={cn(
                           "absolute top-0 left-0 right-0 h-[2px] opacity-70 group-hover:opacity-100 transition-opacity", 
                           event.is_event ? "bg-gradient-to-r from-purple-500 to-indigo-500" : "bg-gradient-to-r from-primary/60 to-primary/20"
                        )} 
                       />
                    )}

                    <div 
                      className="relative z-10 flex flex-col sm:flex-row p-4 sm:p-5 gap-4 sm:gap-6 cursor-pointer"
                      onClick={() => setExpandedEventId(event.id)}
                    >
                      {/* Left: Date block */}
                      <div className="flex shrink-0 flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-1.5 sm:w-24">
                          <div className="flex flex-col items-center justify-center bg-black/5 dark:bg-white/5 rounded-xl px-4 py-2 sm:px-0 sm:py-3 sm:w-full border border-black/5 dark:border-white/5 shadow-inner">
                             <span className="text-2xl font-bold leading-none text-foreground">{format(new Date(event.date), 'dd')}</span>
                             <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mt-1">{format(new Date(event.date), 'MMM', { locale: de })}</span>
                          </div>
                          
                          <div className="flex flex-col sm:w-full items-start gap-1">
                             <div className="hidden sm:flex text-[11px] font-medium text-muted-foreground w-full justify-center">
                               {format(new Date(event.date), 'EEEE', { locale: de })}
                             </div>
                             <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80 sm:block sm:text-center sm:w-full sm:bg-black/5 dark:sm:bg-white/5 sm:rounded-md sm:py-1">
                                <span className="sm:hidden"><Clock className="w-3.5 h-3.5 inline-block mr-1 opacity-70" /></span>
                                {event.start_time.slice(0,5)}
                                <span className="hidden sm:inline mx-0.5">-</span>
                                <span className="sm:hidden mx-0.5">-</span>
                                {event.end_time.slice(0,5)}
                             </div>
                          </div>
                      </div>

                      {/* Middle: Main content */}
                      <div className="flex-1 flex flex-col justify-center min-w-0 pr-6 sm:pr-0">
                          <div className="flex items-center gap-2 mb-1.5">
                             <h3 className={cn("text-lg font-display font-semibold tracking-tight truncate", event.is_cancelled && "line-through text-muted-foreground")}>{event.title}</h3>
                             
                             {/* Status tags inline next to title */}
                             {event.is_event && !event.is_cancelled && (
                                <span className="shrink-0 text-[9px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/20">
                                  Event
                                </span>
                             )}
                             {event.is_cancelled && (
                                <span className="shrink-0 text-[9px] font-bold tracking-wider uppercase bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">
                                  Abgesagt
                                </span>
                             )}
                             {event.is_active === false && !event.is_cancelled && (
                                <span className="shrink-0 text-[9px] font-bold tracking-wider uppercase bg-gray-500/10 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full border border-gray-500/20">
                                  Versteckt
                                </span>
                             )}
                          </div>
                          
                          {!event.is_cancelled && event.topic && (
                             <p className="text-sm text-foreground/80 leading-relaxed mb-3 flex items-start gap-2 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0 mt-1.5" />
                                <span className="line-clamp-2">{event.topic}</span>
                             </p>
                          )}

                          {/* Rsvp stats */}
                          {!event.is_cancelled && (
                             <div className="flex items-center gap-4 mt-auto pt-2">
                               {subscribedTrainers.length > 0 && (
                                 <div className="flex items-center gap-2 text-xs text-muted-foreground pb-0.5" title="Trainingsleitung">
                                   <div className="flex flex-wrap gap-1.5">
                                      {subscribedTrainers.map((t) => (
                                         <div key={t.id} className="flex items-center gap-1 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-medium text-primary shadow-sm">
                                            <UserCheck className="w-3 h-3" />
                                            <span className="truncate max-w-[80px] sm:max-w-none">{t.profiles?.first_name}</span>
                                         </div>
                                      ))}
                                   </div>
                                 </div>
                               )}

                               {subscribedTrainers.length > 0 && <span className="w-[1px] h-3 bg-black/10 dark:bg-white/10" />}

                               <div className="flex items-center space-x-1.5 text-xs text-muted-foreground" title="Zusagen / Vielleicht / Absagen">
                                  <Users className="w-3.5 h-3.5 opacity-60" />
                                  <div className="flex space-x-1.5 font-medium">
                                      <span className={counts.yes > 0 ? "text-green-600 dark:text-green-400 font-semibold" : "opacity-40"}>{counts.yes}</span>
                                      <span className="opacity-30">/</span>
                                      <span className={counts.maybe > 0 ? "text-yellow-600 dark:text-yellow-400 font-semibold" : "opacity-40"}>{counts.maybe}</span>
                                      <span className="opacity-30">/</span>
                                      <span className={counts.no > 0 ? "text-red-600 dark:text-red-400 font-semibold" : "opacity-40"}>{counts.no}</span>
                                  </div>
                               </div>

                                {myRsvp && (
                                    <div className="ml-auto shrink-0 inline-flex items-center bg-black/5 dark:bg-white/5 rounded-full pl-1.5 pr-2.5 py-0.5 border border-black/5 dark:border-white/5">
                                        {myRsvp === 'yes' && <><div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" /><span className="text-[10px] font-semibold text-foreground/80">Zusage</span></>}
                                        {myRsvp === 'maybe' && <><div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1.5" /><span className="text-[10px] font-semibold text-foreground/80">Vielleicht</span></>}
                                        {myRsvp === 'no' && <><div className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" /><span className="text-[10px] font-semibold text-foreground/80">Absage</span></>}
                                    </div>
                                )}
                             </div>
                          )}
                      </div>

                      {/* Right: Chevron for indicating interaction */}
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 sm:static sm:translate-y-0 flex items-center justify-center shrink-0 sm:ml-2 text-muted-foreground opacity-40 group-hover:opacity-100 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300">
                          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Trainer Dashboard / Member Info */}
        {isTrainer && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Gruppen Mitglieder
              </h2>
              <div className="flex bg-black/10 dark:bg-white/5 p-1 rounded-lg">
                <button 
                  className={cn("flex-1 text-sm py-1.5 font-medium rounded-md transition-all", memberTab === 'trainer' ? "bg-white dark:bg-zinc-900 shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => setMemberTab('trainer')}
                >
                  Trainer ({members.filter(m => m.status === 'active' && m.role === 'trainer' && !m.is_hidden).length})
                </button>
                <button 
                  className={cn("flex-1 text-sm py-1.5 font-medium rounded-md transition-all", memberTab === 'member' ? "bg-white dark:bg-zinc-900 shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => setMemberTab('member')}
                >
                  Mitglieder ({members.filter(m => m.status === 'active' && m.role === 'member' && !m.is_hidden).length})
                </button>
              </div>
            </div>
            
            <Card className="border-white/10 bg-card/60 backdrop-blur-xl shadow-xl">
              <CardContent className="p-0">
                <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                  {members
                    .filter(m => !m.is_hidden && (m.role === memberTab || (memberTab === 'member' && m.status === 'waiting')))
                    .sort((a,b) => a.status === 'waiting' ? -1 : 1)
                    .map(member => (
                    <div key={member.id} className={`p-4 flex items-center justify-between transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${member.status === 'waiting' ? 'bg-yellow-500/5' : ''}`}>
                      <div>
                        <p className="font-semibold text-sm">{member.profiles?.first_name || 'Unbekannt'} {member.profiles?.last_name || ''}</p>
                        <div className="flex gap-2 text-xs mt-1">
                          <span className={member.status === 'active' ? 'text-green-500' : 'text-yellow-500 font-bold'}>
                            {member.status === 'active' ? 'Aktiv' : 'Wartend'}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          {/* Role toggling logic can be more complex, but a simple label will do for now. We can click to toggle if admin */}
                          <button 
                             className={`capitalize hover:underline ${member.role === 'trainer' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
                             onClick={() => handleMemberRole(member.id, member.role === 'trainer' ? 'member' : 'trainer')}
                             title="Klicken zum ändern der Rolle"
                          >
                             {member.role}
                          </button>
                        </div>
                      </div>
                      
                      {member.status === 'waiting' && (
                         <div className="flex gap-2">
                           <Button size="icon" variant="outline" className="w-8 h-8 rounded-full text-green-500 border-green-500/30 hover:bg-green-500/20" onClick={() => handleMemberStatus(member.id, 'active')} title="Akzeptieren">
                             <UserCheck className="w-4 h-4" />
                           </Button>
                           <Button size="icon" variant="outline" className="w-8 h-8 rounded-full text-red-500 border-red-500/30 hover:bg-red-500/20" onClick={() => handleMemberStatus(member.id, 'rejected')} title="Ablehnen">
                             <X className="w-4 h-4" />
                           </Button>
                         </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {eventToDelete && (
        <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-black/10 dark:border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2 text-red-500">Training endgültig löschen?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Bist du dir 100% sicher, dass an diesem Tag kein Training stattfinden wird? Diese Aktion entfernt den Termin komplett aus der Übersicht.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEventToDelete(null)}>Abbrechen</Button>
              <Button variant="ghost" className="flex-1 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => handleDeleteEvent(eventToDelete)}>Ja, löschen</Button>
            </div>
          </div>
        </div>
      )}

      {/* Global Event Modal */}
      {expandedEventId && (() => {
        const event = combinedEvents.find(e => e.id === expandedEventId);
        if (!event) return null;
        
        const myRsvp = rsvps.find(r => r.event_id === event.id)?.status;
        
        const thisEventRsvps = allRsvps.filter(r => r.event_id === event.id);
        const memberOverviews = members.filter(m => m.status === 'active' && !m.is_hidden).map(m => ({
          ...m,
          rsvp: thisEventRsvps.find(r => r.user_id === m.user_id)?.status || 'unknown'
        }));
        const subscribedTrainers = memberOverviews.filter(m => (m.role === 'trainer' || m.role === 'admin') && m.rsvp === 'yes');

        return (
          <>
            <div 
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setExpandedEventId(null)}
            />
            <div 
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] bg-white dark:bg-zinc-950 w-[92vw] max-w-lg flex flex-col rounded-2xl border border-black/10 dark:border-white/10 p-5 sm:p-6 max-h-[85vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200"
            >
              <div className="flex items-start justify-between mb-5 pb-5 border-b border-black/5 dark:border-white/5">
                <div className="pr-4">
                    <h3 className="font-display font-bold text-xl mb-1.5 leading-tight">{event.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground mt-2">
                      <span className="text-primary/90 bg-primary/10 px-2 py-0.5 rounded text-xs">{format(new Date(event.date), 'EEEE, dd.MM.', { locale: de })}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> {event.start_time.slice(0,5)} - {event.end_time.slice(0,5)}</span>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setExpandedEventId(null)} className="rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 shrink-0">
                    <X className="w-5 h-5"/>
                </Button>
              </div>

              {(event.topic || event.description) && (
                <div className="mb-5 space-y-3">
                  {event.topic && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Thema</p>
                      <p className="text-sm text-foreground">{event.topic}</p>
                    </div>
                  )}
                  {event.description && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Beschreibung</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Subscribed Trainers Section */}
              {subscribedTrainers.length > 0 && (
                <div className="mb-5 bg-primary/5 border border-primary/10 p-3 rounded-lg">
                  <p className="text-xs font-semibold text-primary/80 mb-2">Angemeldete Trainer:</p>
                  <div className="flex flex-wrap gap-2">
                    {subscribedTrainers.map(t => (
                      <div key={t.id} className="flex items-center gap-1.5 bg-black/5 dark:bg-black/40 px-2 py-1 rounded-md text-xs border border-black/5 dark:border-white/5">
                        <UserCheck className="w-3.5 h-3.5 text-primary" />
                        <span className="text-foreground">{t.profiles?.first_name} {t.profiles?.last_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!event.is_cancelled && (
              <div 
                className="pt-4 border-t border-black/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <p className="text-xs font-medium text-muted-foreground">Deine Teilnahme:</p>
                  <div className="flex flex-row flex-wrap gap-2">
                      <Button 
                        variant={myRsvp === 'yes' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => handleRSVP(event, 'yes')}
                        className={cn("h-8 text-xs flex-1 sm:flex-none", myRsvp === 'yes' ? 'bg-green-500 hover:bg-green-600 text-white border-green-500 shadow-md shadow-green-500/20' : 'border-black/20 dark:border-white/20 hover:bg-green-500/20 hover:border-green-500 hover:text-green-600 dark:hover:text-green-400')}
                      >
                        Zusage
                      </Button>
                      <Button 
                        variant={myRsvp === 'maybe' ? 'default' : 'outline'} 
                        size="sm"
                        onClick={() => handleRSVP(event, 'maybe')}
                        className={cn("h-8 text-xs flex-1 sm:flex-none", myRsvp === 'maybe' ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500 shadow-md shadow-yellow-500/20' : 'border-black/20 dark:border-white/20 hover:bg-yellow-500/20 hover:border-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-400')}
                      >
                        Vielleicht
                      </Button>
                      <Button 
                        variant={myRsvp === 'no' ? 'default' : 'outline'} 
                        size="sm"
                        onClick={() => handleRSVP(event, 'no')}
                        className={cn("h-8 text-xs flex-1 sm:flex-none", myRsvp === 'no' ? 'bg-red-500 hover:bg-red-600 text-white border-red-500 shadow-md shadow-red-500/20' : 'border-black/20 dark:border-white/20 hover:bg-red-500/10 hover:border-red-500 hover:text-red-500 dark:hover:text-red-400')}
                      >
                        Absage
                      </Button>
                  </div>
                </div>
                
                {isTrainer && (
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t border-black/10 dark:border-white/10 sm:border-0 relative">
                    <p className="text-xs font-medium text-muted-foreground w-full sm:hidden mb-1">Aktionen:</p>
                    <p className="text-xs font-medium text-muted-foreground hidden sm:block">&nbsp;</p>
                    <Button variant="outline" size="sm" onClick={(e) => { setExpandedEventId(null); handleEditClick(event, e); }} className="h-8 text-xs w-full sm:w-auto border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10 text-foreground">
                      Bearbeiten
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleCancelEvent(event)} className="h-8 text-xs w-full sm:w-auto border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50">
                      Training Absagen
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setExpandedEventId(null); setEventToDelete(event); }} className="h-8 text-xs w-full sm:w-auto border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50">
                      Löschen
                    </Button>
                  </div>
                )}
              </div>
            )}

            {event.is_cancelled && isTrainer && (
              <div className="pt-4 mt-2 border-t border-black/5 dark:border-white/5">
                  <Button variant="outline" size="sm" onClick={() => handleReactivateEvent(event)} className="h-8 text-xs text-green-500 hover:bg-green-500/10 border-green-500/20 w-full sm:w-auto flex items-center gap-2">
                    <RotateCcw className="w-3.5 h-3.5" /> Termin reaktivieren
                  </Button>
              </div>
            )}

            {/* Trainer RSVP Overview for Virtual and Real Events */}
            {isTrainer && !event.is_cancelled && (
              <div className="pt-4 mt-4 border-t border-black/5 dark:border-white/5">
                <p className="text-xs font-semibold mb-3">Teilnahme Übersicht:</p>
                {(() => {
                  const thisEventRsvps = allRsvps.filter(r => r.event_id === event.id);
                  
                  // Map members with their RSVP status
                  const memberOverviews = members.filter(m => m.status === 'active' && !m.is_hidden).map(m => {
                    const rsvp = thisEventRsvps.find(r => r.user_id === m.user_id)?.status;
                    return {
                      ...m,
                      rsvp: rsvp || 'unknown'
                    };
                  });

                  const trainers = memberOverviews.filter(m => m.role === 'trainer' || m.role === 'admin');
                  const regulars = memberOverviews.filter(m => m.role === 'member');

                  const RsvpBadge = ({ status }: { status: string }) => {
                    if (status === 'yes') return <span className="text-[10px] bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-500/20">Zusage</span>;
                    if (status === 'maybe') return <span className="text-[10px] bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">Vielleicht</span>;
                    if (status === 'no') return <span className="text-[10px] bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">Absage</span>;
                    return <span className="text-[10px] bg-black/5 dark:bg-white/5 text-muted-foreground px-1.5 py-0.5 rounded border border-black/10 dark:border-white/10">Keine Info</span>;
                  };

                  const renderList = (title: string, list: any[]) => {
                    if (list.length === 0) return null;
                    return (
                      <div className="mb-4 last:mb-0">
                        <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
                          {title}
                          <span className="bg-black/20 dark:bg-white/10 px-1.5 py-0.5 rounded-full">
                            {list.filter(m => m.rsvp === 'yes').length} / {list.length}
                          </span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {list.map(m => (
                            <div key={m.id} className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-2 rounded border border-black/5 dark:border-white/5 text-sm">
                              <span className="truncate pr-2">{m.profiles?.first_name || 'Unbekannt'} {m.profiles?.last_name || ''}</span>
                              <RsvpBadge status={m.rsvp} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {renderList("Trainer", trainers)}
                      {renderList("Mitglieder", regulars)}
                    </div>
                  );
                })()}
              </div>
            )}
            </div>
          </>
        );
      })()}
    </motion.div>
  );
};

