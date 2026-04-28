import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Navbar } from "../components/layout/Navbar";
import { motion } from "motion/react";
import { AlertCircle, ArrowLeft } from "lucide-react";

export const AuthPage = ({ mode }: { mode: "login" | "register" }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            }
          }
        });
        
        if (error) throw error;
        
        // Wait briefly for triggers to run and profile to be created
        if (data.user) {
          // Update profile with names (fallback if trigger doesn't map metadata)
          await supabase.from('profiles').update({
            first_name: firstName,
            last_name: lastName
          }).eq('id', data.user.id);
        }
        
        navigate("/app");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/app");
      }
    } catch (err: any) {
      setError(err.message || "Es ist ein Fehler aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      <Navbar />
      
      {/* Background decoration */}
      <div className="absolute top-1/4 -right-1/4 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />

      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zur Startseite
          </Link>

          <Card className="border-white/10 shadow-2xl backdrop-blur-2xl bg-card/60">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-display font-bold">
                {mode === "login" ? "Willkommen zurück" : "Account erstellen"}
              </CardTitle>
              <CardDescription>
                {mode === "login" 
                  ? "Melde dich an, um zu deinem Dashboard zu gelangen." 
                  : "Erstelle einen neuen Account um deinem Verein beizutreten."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAuth} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-500 text-sm">
                     <AlertCircle className="w-5 h-5 shrink-0" />
                     <span>{error}</span>
                  </div>
                )}
                
                {mode === "register" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Vorname</label>
                      <Input
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Max"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nachname</label>
                      <Input
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Mustermann"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">E-Mail</label>
                  <Input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mail@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex justify-between">
                    <span>Passwort</span>
                    {mode === "login" && (
                      <a href="#" className="text-xs text-primary hover:underline">Passwort vergessen?</a>
                    )}
                  </label>
                  <Input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <Button className="w-full mt-2" type="submit" disabled={loading}>
                  {loading 
                    ? "Bitte warten..." 
                    : mode === "login" ? "Anmelden" : "Registrieren"}
                </Button>
                
                <div className="text-center text-sm text-muted-foreground mt-4">
                  {mode === "login" ? (
                    <>Noch keinen Account? <Link to="/register" className="text-primary hover:underline">Jetzt registrieren</Link></>
                  ) : (
                    <>Bereits registriert? <Link to="/login" className="text-primary hover:underline">Hier anmelden</Link></>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};
