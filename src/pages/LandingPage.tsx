import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { 
  Music, Calendar, Users, Star, 
  ArrowRight, ShieldCheck, AlertCircle 
} from "lucide-react";
import { motion } from "motion/react";
import { Navbar } from "../components/layout/Navbar";
import { hasSupabaseConfig } from "../lib/supabase";

export const LandingPage = () => {
  const isConfigured = hasSupabaseConfig();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Setup Warning if no supabase credentials */}
        {!isConfigured && (
          <div className="bg-red-500/10 border-b border-red-500/20 text-red-500 p-4 text-center text-sm font-medium flex items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Supabase ist noch nicht eingerichtet. Bitte trage VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in die Secrets / .env ein und führe das database_schema.sql Skript in Supabase aus.
          </div>
        )}

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32">
          {/* Background Glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-50 pointer-events-none" />
          
          <div className="container mx-auto px-4 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary mb-8 text-sm font-medium border border-primary/20 backdrop-blur-sm"
            >
              <Star className="w-4 h-4" />
              <span>STS Wachendorf e.V. Vereinsportal</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-7xl font-serif italic max-w-4xl mx-auto tracking-tight mb-6 leading-tight"
            >
              Organisiert auf und hinter der <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">Bühne</span>.
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 px-4"
            >
              Trainings planen, Anwesenheiten tracken, Rollen verteilen. Das offizielle Portal des STS Wachendorf e.V.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full px-4 sm:px-0"
            >
              <Link to="/register" className="w-full sm:w-auto">
                <Button size="lg" className="h-14 px-8 text-base w-full">
                  Kostenlos starten
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <Button size="lg" variant="glass" className="h-14 px-8 text-base w-full">
                  Zum Anmelden
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-24 bg-card/30 border-y border-white/5 relative z-10 glass">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                 {
                   icon: Users,
                   title: "Intelligente Gruppen",
                   desc: "Unterteile deinen Verein in Tänzer, Sänger, Band. Jede Gruppe hat ihre eigenen Trainings und Trainer."
                 },
                 {
                   icon: Calendar,
                   title: "Übersichtlicher Kalender",
                   desc: "Alle Trainings auf einen Blick. Mitglieder können zu- oder absagen. Immer wissen, wer kommt."
                 },
                 {
                   icon: ShieldCheck,
                   title: "Rechtesystem",
                   desc: "Admins, Trainer und Mitglieder. Trainer haben eigene Dashboards für ihre Gruppen."
                 }
              ].map((f, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-background/40 backdrop-blur-md border border-white/10 p-8 rounded-3xl"
                >
                  <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center mb-6 text-primary">
                    <f.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold font-display mb-3">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
