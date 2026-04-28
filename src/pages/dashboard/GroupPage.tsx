import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../components/auth-provider";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { Users, UserCheck, Clock, CalendarIcon, FileText, Plus, X, ChevronLeft, ChevronRight, List as ListIcon, Settings } from "lucide-react";
import { cn } from "../../lib/utils";

export const GroupPage = ({ userRole }: { userRole: any[] }) => {
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
  const [newEvent, setNewEvent] = useState<{ id?: string, title: string, description: string, topic: string, date: string, start_time: string, end_time: string, is_event: boolean }>({ title: '', description: '', topic: '', date: '', start_time: '', end_time: '', is_event: false });

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Expanded event for RSVP
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Settings Modal
  const [showSettings, setShowSettings] = useState(false);
  const [templates, setTemplates] = useState<{ dayOfWeek: number, start_time: string, end_time: string, title: string }[]>([]);

  const currentRole = userRole.find(r => r.group_id === id)?.role || 'member';
  const isTrainer = currentRole === 'trainer' || isGlobalAdmin;

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
        // Only generate for present and future if in list mode, but in calendar mode we can show past templates too
        if (viewMode === 'list' && day < today) continue;
        
        // JS day: 0=Sunday, 1=Monday (match our type)
        const jsDay = day.getDay();
        const dailyTemplates = templates.filter(t => t.dayOfWeek === jsDay);
        
        for (const t of dailyTemplates) {
          const dateStr = format(day, 'yyyy-MM-dd');
          // Check if DB already has this event
          const exists = combined.some(e => e.date === dateStr && e.start_time.startsWith(t.start_time));
          if (!exists) {
            combined.push({
              id: `virtual-${dateStr}-${t.start_time}`,
              group_id: id,
              title: t.title,
              date: dateStr,
              start_time: t.start_time + ":00", // Ensure HH:MM:SS
              end_time: t.end_time + ":00",
              is_event: false,
              is_cancelled: false,
              is_virtual: true
            });
          }
        }
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
    
    return combined;
  };

  // Helper function to resolve virtual event
  const resolveVirtualEvent = async (eventObj: any) => {
    if (!eventObj.is_virtual) return eventObj;
    
    // Is virtual, we need to insert it
    const { data } = await supabase.from('events').insert({
      group_id: id,
      title: eventObj.title,
      date: eventObj.date,
      start_time: eventObj.start_time,
      end_time: eventObj.end_time,
      is_event: false,
      is_cancelled: false
    }).select().single();
    
    return data;
  }

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

  const handleSaveSettings = async () => {
    if (!id) return;
    try {
      await supabase.from('groups').update({
        settings: { templates }
      }).eq('id', id);
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
        {isTrainer && (
          <Button variant="secondary" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="w-4 h-4 mr-2" />
            Einstellungen
          </Button>
        )}
      </div>

      {showSettings && (
        <Card className="border-white/10 bg-black/20 shadow-xl mb-6">
          <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
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
                <div key={idx} className="flex flex-wrap items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/5 relative">
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
              <Card className="border-white/10 bg-card/60 backdrop-blur-xl overflow-hidden shadow-xl">
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
                          {dayEvents.map(event => (
                            <div 
                              key={event.id}
                              className={cn(
                                "text-[10px] sm:text-xs p-1 rounded font-medium truncate cursor-pointer transition-transform hover:scale-[1.02]",
                                event.is_cancelled ? "bg-red-500/10 text-red-500 border border-red-500/20 line-through opacity-70" :
                                event.is_event 
                                  ? "bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20" 
                                  : "bg-primary/20 text-primary-foreground border border-primary/20"
                              )}
                              title={event.title}
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewMode('list');
                                setExpandedEventId(event.id);
                                setTimeout(() => {
                                  const el = document.getElementById(`event-${event.id}`);
                                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 100);
                              }}
                            >
                              {event.start_time.slice(0,5)} {event.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ) : (
            <div className="space-y-4">
              {combinedEvents.length === 0 && !showEventForm && (
                <Card className="bg-card/30 border-white/5"><CardContent className="p-6 text-center text-muted-foreground">Keine Termine in diesem Zeitraum gefunden.</CardContent></Card>
              )}
              {combinedEvents.map((event) => {
                const myRsvp = rsvps.find(r => r.event_id === event.id)?.status;
                const isExpanded = expandedEventId === event.id;
                
                return (
                  <Card 
                    key={event.id} 
                    id={`event-${event.id}`}
                    className={cn(
                      "border-white/10 bg-card/60 backdrop-blur-xl transition-all shadow-sm cursor-pointer hover:bg-card/80", 
                      event.is_cancelled && "opacity-60",
                      isExpanded && "border-primary/30 shadow-md"
                    )}
                    onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                  >
                    <CardContent className="p-5 flex flex-col gap-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-xs font-semibold bg-black/10 dark:bg-white/10 px-2.5 py-1 rounded-md border border-white/5">
                              {format(new Date(event.date), 'EEEE, d. MMM yyyy', { locale: de })}
                            </span>
                            <span className="text-xs font-semibold bg-black/10 dark:bg-white/10 px-2.5 py-1 rounded-md flex items-center gap-1 border border-white/5">
                              <Clock className="w-3.5 h-3.5" /> {event.start_time.slice(0,5)} - {event.end_time.slice(0,5)}
                            </span>
                            {event.is_event && !event.is_cancelled && (
                              <span className="text-xs font-semibold bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-md border border-purple-500/20">
                                Event/Auftritt
                              </span>
                            )}
                            {event.is_cancelled && (
                              <span className="text-xs font-semibold bg-red-500/20 text-red-500 px-2.5 py-1 rounded-md border border-red-500/30">
                                Abgesagt
                              </span>
                            )}
                          </div>
                          <h3 className={cn("text-lg font-display font-bold mb-1.5", event.is_cancelled && "line-through text-muted-foreground")}>{event.title}</h3>
                          {!event.is_cancelled && event.topic && (
                            <div className="text-xs text-primary/90 mt-2 flex items-start gap-1.5 p-2 bg-primary/10 rounded-md border border-primary/20">
                              <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span><strong>Thema:</strong> {event.topic}</span>
                            </div>
                          )}
                          {!event.is_cancelled && event.description && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{event.description}</p>}
                        </div>
                        
                        {/* Compact RSVP display when not expanded */}
                        {!isExpanded && !event.is_cancelled && myRsvp && (
                           <div className="shrink-0 text-[10px] sm:text-xs font-medium px-2 py-1 rounded border border-white/10 bg-white/5">
                             {myRsvp === 'yes' && <span className="text-green-500 dark:text-green-400">Zusage</span>}
                             {myRsvp === 'maybe' && <span className="text-yellow-500 dark:text-yellow-400">Vielleicht</span>}
                             {myRsvp === 'no' && <span className="text-red-500 dark:text-red-400">Absage</span>}
                           </div>
                        )}
                        {event.is_cancelled && (
                           <div className="text-center md:text-left text-xs font-semibold text-red-500/80">Termin fällt aus.</div>
                        )}
                      </div>
                      
                      {/* Expanded Section */}
                      {isExpanded && !event.is_cancelled && (
                        <div 
                          className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="flex flex-col gap-2 w-full sm:w-auto">
                            <p className="text-xs font-medium text-muted-foreground">Deine Teilnahme:</p>
                            <div className="flex flex-row flex-wrap gap-2">
                               <Button 
                                 variant={myRsvp === 'yes' ? 'default' : 'outline'} 
                                 size="sm" 
                                 onClick={() => handleRSVP(event, 'yes')}
                                 className={cn("h-8 text-xs flex-1 sm:flex-none", myRsvp === 'yes' ? 'bg-green-500 hover:bg-green-600 text-white border-green-500 shadow-md shadow-green-500/20' : 'border-white/20 hover:bg-green-500/20 hover:border-green-500 hover:text-green-500 dark:hover:text-green-400')}
                               >
                                 Zusage
                               </Button>
                               <Button 
                                 variant={myRsvp === 'maybe' ? 'default' : 'outline'} 
                                 size="sm"
                                 onClick={() => handleRSVP(event, 'maybe')}
                                 className={cn("h-8 text-xs flex-1 sm:flex-none", myRsvp === 'maybe' ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500 shadow-md shadow-yellow-500/20' : 'border-white/20 hover:bg-yellow-500/20 hover:border-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-400')}
                               >
                                 Vielleicht
                               </Button>
                               <Button 
                                 variant={myRsvp === 'no' ? 'default' : 'outline'} 
                                 size="sm"
                                 onClick={() => handleRSVP(event, 'no')}
                                 className={cn("h-8 text-xs flex-1 sm:flex-none", myRsvp === 'no' ? 'bg-red-500 hover:bg-red-600 text-white border-red-500 shadow-md shadow-red-500/20' : 'border-white/20 hover:bg-red-500/20 hover:border-red-500 hover:text-red-500 dark:hover:text-red-400')}
                               >
                                 Absage
                               </Button>
                            </div>
                          </div>
                          
                          {isTrainer && (
                            <div className="flex flex-col sm:flex-row gap-2 sm:items-end w-full sm:w-auto mt-2 sm:mt-0">
                              <p className="text-xs font-medium text-muted-foreground hidden sm:block">&nbsp;</p>
                              <Button variant="secondary" size="sm" onClick={(e) => handleEditClick(event, e)} className="h-8 text-xs w-full sm:w-auto">
                                Bearbeiten
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleCancelEvent(event)} className="h-8 text-xs text-red-500 hover:bg-red-500/10 w-full sm:w-auto">
                                Training Absagen
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Trainer RSVP Overview for Virtual and Real Events */}
                      {isExpanded && isTrainer && !event.is_cancelled && (
                        <div className="pt-4 mt-2 border-t border-white/5" onClick={e => e.stopPropagation()}>
                          <p className="text-xs font-semibold mb-3">Teilnahme Übersicht:</p>
                          {(() => {
                            const thisEventRsvps = allRsvps.filter(r => r.event_id === event.id);
                            
                            // Map members with their RSVP status
                            const memberOverviews = members.filter(m => m.status === 'active').map(m => {
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
                              return <span className="text-[10px] bg-white/5 text-muted-foreground px-1.5 py-0.5 rounded border border-white/10">Keine Info</span>;
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
                                      <div key={m.id} className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-2 rounded border border-white/5 text-sm">
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Trainer Dashboard / Member Info */}
        {isTrainer && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Mitglieder ({members.filter(m => m.status === 'active').length})
            </h2>
            
            <Card className="border-white/10 bg-card/60 backdrop-blur-xl shadow-xl">
              <CardContent className="p-0">
                <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                  {members.sort((a,b) => a.status === 'waiting' ? -1 : 1).map(member => (
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
    </motion.div>
  );
};

