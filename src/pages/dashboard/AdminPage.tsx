import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ShieldCheck, Users, Plus, Trash2, Edit, X, Save, Ban, CheckCircle, ArrowRightLeft, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../../components/auth-provider";
import { cn } from "../../lib/utils";

export const AdminPage = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [loading, setLoading] = useState(true);

  // Edit Group State
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDesc, setEditGroupDesc] = useState("");

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
      if (selectedGroup?.id === id) setSelectedGroup(null);
    }
  }

  const handleEditGroupClick = async (group: any) => {
    setEditGroupName(group.name);
    setEditGroupDesc(group.description || "");
    setSelectedGroup(group);
    
    const { data } = await supabase
      .from('group_members')
      .select('*, profiles(first_name, last_name, email)')
      .eq('group_id', group.id);
      
    if (data) setGroupMembers(data);
  };

  const handleUpdateGroupDetails = async () => {
    if (!selectedGroup) return;
    await supabase.from('groups').update({ name: editGroupName, description: editGroupDesc }).eq('id', selectedGroup.id);
    fetchGroups();
    setSelectedGroup({ ...selectedGroup, name: editGroupName, description: editGroupDesc });
  };

  const handleChangeMemberRole = async (memberId: string, role: string) => {
    await supabase.from('group_members').update({ role }).eq('id', memberId);
    setGroupMembers(groupMembers.map(m => m.id === memberId ? { ...m, role } : m));
  };

  const handleChangeMemberStatus = async (memberId: string, status: string) => {
    await supabase.from('group_members').update({ status }).eq('id', memberId);
    setGroupMembers(groupMembers.map(m => m.id === memberId ? { ...m, status } : m));
  };

  const handleToggleVisibility = async (memberId: string, currentHidden: boolean) => {
    await supabase.from('group_members').update({ is_hidden: !currentHidden }).eq('id', memberId);
    setGroupMembers(groupMembers.map(m => m.id === memberId ? { ...m, is_hidden: !currentHidden } : m));
  };

  const handleMoveMember = async (memberId: string, targetGroupId: string) => {
    if (!targetGroupId) return;
    const member = groupMembers.find(m => m.id === memberId);
    if (!member) return;

    const { data: existing } = await supabase
      .from('group_members')
      .select('*')
      .eq('user_id', member.user_id)
      .eq('group_id', targetGroupId)
      .maybeSingle();

    if (existing) {
      alert("Mitglied ist bereits in der Ziel-Gruppe.");
      return;
    }

    await supabase.from('group_members').update({ group_id: targetGroupId }).eq('id', memberId);
    setGroupMembers(groupMembers.filter(m => m.id !== memberId));
  };

  const handleRemoveMember = async (memberId: string) => {
    if (window.confirm("Mitglied wirklich aus der Gruppe entfernen?")) {
      await supabase.from('group_members').delete().eq('id', memberId);
      setGroupMembers(groupMembers.filter(m => m.id !== memberId));
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8 relative">
      <div className="mb-10">
        <h1 className="text-4xl font-serif italic flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-primary" />
          Verwaltung
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">Globale Verwaltung des Vereins.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border border-black/5 dark:border-white/10 bg-card/60 backdrop-blur-xl h-fit">
          <CardHeader>
            <CardTitle>Neue Gruppe erstellen</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name der Gruppe</label>
                <Input value={newGroupName} className="border-black/5 dark:border-white/10" onChange={e => setNewGroupName(e.target.value)} placeholder="z.B. Tänzer" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Beschreibung (optional)</label>
                <Input value={newGroupDesc} className="border-black/5 dark:border-white/10" onChange={e => setNewGroupDesc(e.target.value)} placeholder="Beschreibung..." />
              </div>
              <Button type="submit" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Gruppe erstellen
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border border-black/5 dark:border-white/10 bg-card/60 backdrop-blur-xl h-fit">
          <CardHeader>
            <CardTitle>Aktuelle Gruppen</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[400px] overflow-y-auto">
              {groups.map(g => (
                <div key={g.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold">{g.name}</h4>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{g.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => handleEditGroupClick(g)} className="border border-black/10 dark:border-white/10">
                      <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteGroup(g.id)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {groups.length === 0 && !loading && (
                <div className="p-4 text-center text-muted-foreground">Keine Gruppen vorhanden.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-black/5 dark:border-white/10 shrink-0">
              <CardTitle>Gruppe verwalten: {selectedGroup.name}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setSelectedGroup(null)} className="h-8 w-8 hover:bg-black/5 dark:hover:bg-white/10 rounded-full">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              
              {/* Group Details form */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-2">
                  <Edit className="w-4 h-4 text-primary" /> Basis-Infos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Name</label>
                    <Input value={editGroupName} className="border-black/10 dark:border-white/10" onChange={e => setEditGroupName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Beschreibung</label>
                    <Input value={editGroupDesc} className="border-black/10 dark:border-white/10" onChange={e => setEditGroupDesc(e.target.value)} />
                  </div>
                </div>
                <Button onClick={handleUpdateGroupDetails} size="sm" className="w-full sm:w-auto">
                  <Save className="w-4 h-4 mr-2" /> Speichern
                </Button>
              </div>

              {/* Members Management */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-2">
                  <Users className="w-4 h-4 text-primary" /> Mitglieder Verwaltung
                </h3>
                <div className="space-y-3">
                  {groupMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Mitglieder in dieser Gruppe.</p>
                  ) : (
                    groupMembers.map(member => (
                      <div key={member.id} className="p-3 lg:p-4 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground">{member.profiles?.first_name} {member.profiles?.last_name}</p>
                          <p className="text-xs text-muted-foreground mb-1">{member.profiles?.email}</p>
                          
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                             <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", member.role === 'trainer' ? 'bg-primary/20 text-primary border-primary/20' : 'bg-black/10 dark:bg-white/10 text-muted-foreground border-black/10 dark:border-white/10')}>
                               {member.role === 'trainer' ? 'Trainer' : 'Mitglied'}
                             </span>
                             <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", 
                               member.status === 'active' ? 'bg-green-500/20 text-green-600 dark:text-green-500 border-green-500/20' : 
                               member.status === 'blocked' ? 'bg-red-500/20 text-red-600 dark:text-red-500 border-red-500/20' :
                               'bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 border-yellow-500/20'
                             )}>
                               {member.status === 'active' ? 'Aktiv' : member.status === 'blocked' ? 'Gesperrt' : 'Wartend'}
                             </span>
                             {member.is_hidden && (
                               <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/20">
                                 Unsichtbar
                               </span>
                             )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                          {/* Visibility Toggle */}
                          <Button variant="ghost" size="icon" onClick={() => handleToggleVisibility(member.id, member.is_hidden)} className={cn("h-8 w-8 shrink-0 self-end sm:self-auto", member.is_hidden ? "text-purple-500 hover:text-purple-600 hover:bg-purple-500/10" : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10")} title={member.is_hidden ? "Sichtbar machen" : "Unsichtbar machen"}>
                            {member.is_hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          
                          {/* Role Selector */}
                          <select 
                            value={member.role}
                            onChange={(e) => handleChangeMemberRole(member.id, e.target.value)}
                            className="h-8 text-xs bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded px-2 w-full sm:w-auto text-foreground"
                          >
                            <option value="member">Rolle: Mitglied</option>
                            <option value="trainer">Rolle: Trainer</option>
                          </select>

                          {/* Status Selector */}
                          <select 
                            value={member.status}
                            onChange={(e) => handleChangeMemberStatus(member.id, e.target.value)}
                            className="h-8 text-xs bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded px-2 w-full sm:w-auto text-foreground"
                          >
                            <option value="active">Status: Aktiv</option>
                            <option value="waiting">Status: Wartend</option>
                            <option value="blocked">Status: Gesperrt</option>
                          </select>

                          {/* Move Group */}
                          <div className="flex w-full sm:w-auto items-center gap-1">
                             <select 
                               onChange={(e) => handleMoveMember(member.id, e.target.value)}
                               defaultValue=""
                               className="h-8 text-xs bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded px-2 flex-1 sm:max-w-[120px] text-foreground"
                             >
                               <option value="" disabled>Verschieben...</option>
                               {groups.filter(g => g.id !== selectedGroup.id).map(g => (
                                 <option key={g.id} value={g.id}>{g.name}</option>
                               ))}
                             </select>
                          </div>

                          <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(member.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0 self-end sm:self-auto group" title="Mitglied entfernen">
                            <Trash2 className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
};

