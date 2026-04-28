import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ShieldCheck, Users, Plus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../../components/auth-provider";

export const AdminPage = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    const { data } = await supabase.from('groups').select('*').order('name');
    if (data) setGroups(data);
    setLoading(false);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName || !user) return;

    const { data } = await supabase.from('groups').insert({ name: newGroupName, description: newGroupDesc }).select().single();
    
    if (data) {
      await supabase.from('group_members').insert({
        group_id: data.id,
        user_id: user.id,
        role: 'trainer',
        status: 'active'
      });
    }

    setNewGroupName("");
    setNewGroupDesc("");
    fetchGroups();
  };
  
  const handleDeleteGroup = async (id: string) => {
    if(window.confirm("Gruppe wirklich löschen?")) {
      await supabase.from('groups').delete().eq('id', id);
      fetchGroups();
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
      <div className="mb-10">
        <h1 className="text-4xl font-serif italic flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-primary" />
          Verwaltung
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">Globale Verwaltung des Vereins.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-white/10 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Neue Gruppe erstellen</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name der Gruppe</label>
                <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="z.B. Tänzer" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Beschreibung (optional)</label>
                <Input value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} placeholder="Beschreibung..." />
              </div>
              <Button type="submit" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Gruppe erstellen
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Aktuelle Gruppen</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
              {groups.map(g => (
                <div key={g.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div>
                    <h4 className="font-semibold">{g.name}</h4>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{g.description}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteGroup(g.id)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {groups.length === 0 && !loading && (
                <div className="p-4 text-center text-muted-foreground">Keine Gruppen vorhanden.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};
