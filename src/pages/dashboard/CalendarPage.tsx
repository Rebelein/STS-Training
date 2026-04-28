import React, { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Clock } from "lucide-react";
import { motion } from "motion/react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils";

export const CalendarPage = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    fetchEvents();
    
    const channel = supabase
      .channel('events_calendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, [currentMonth]);

  const fetchEvents = async () => {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    
    // In a real app we would only fetch events for user's groups
    const { data } = await supabase
      .from('events')
      .select('*, groups(name)')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });
      
    if (data) setEvents(data);
  };

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-5xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-serif italic mb-2">Kalender</h1>
        <div className="flex items-center gap-4 bg-white/[0.03] px-4 py-2 rounded-xl border border-white/10 shadow-sm backdrop-blur-md">
          <button onClick={prevMonth} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          <span className="font-serif italic text-xl min-w-[140px] text-center capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: de })}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      <Card className="border-white/10 bg-card/50 overflow-hidden shadow-xl">
        <div className="grid grid-cols-7 border-b border-white/10 bg-black/5 dark:bg-white/5">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
            <div key={day} className="py-3 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)]">
          {/* Add empty slots for offset based on start day */}
          {Array.from({ length: (startOfMonth(currentMonth).getDay() + 6) % 7 }).map((_, i) => (
            <div key={`empty-${i}`} className="border-r border-b border-white/5 bg-black/5 dark:bg-white/5 p-2" />
          ))}
          
          {days.map((day, i) => {
            const dayEvents = events.filter(e => e.date === format(day, 'yyyy-MM-dd'));
            const isTodayDate = isToday(day);
            
            return (
              <div 
                key={day.toISOString()} 
                className={cn(
                  "border-r border-b border-white/5 p-2 transition-colors hover:bg-white/5 group",
                  !isSameMonth(day, currentMonth) && "text-muted-foreground/50 bg-black/5 dark:bg-white/5"
                )}
              >
                <div className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-full text-sm mb-2",
                  isTodayDate ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20" : "font-medium"
                )}>
                  {format(day, 'd')}
                </div>
                
                <div className="space-y-1">
                  {dayEvents.map(event => (
                    <div 
                      key={event.id}
                      className={cn(
                        "text-xs p-1.5 rounded-md truncate cursor-pointer transition-transform hover:scale-[1.02]",
                        event.is_event 
                          ? "bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20" 
                          : "bg-primary/20 text-primary-foreground border border-primary/20"
                      )}
                    >
                      <div className="font-semibold">{event.start_time.slice(0,5)}</div>
                      <div className="truncate">{event.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
};
