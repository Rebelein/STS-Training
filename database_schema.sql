-- Führe dieses Skript im SQL Editor deines Supabase Projekts aus.

-- 1. Tabellen erstellen

-- Benutzer Profil (erweitert auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  first_name text,
  last_name text,
  is_global_admin boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Gruppen
create table if not exists public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  settings jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Gruppenmitglieder (inkl. Rollen in der Gruppe und Wartebereich)
-- status: 'waiting', 'active'
-- role: 'member', 'trainer'
create table if not exists public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  role text not null default 'member' check (role in ('member', 'trainer')),
  status text not null default 'waiting' check (status in ('waiting', 'active')),
  note_name text,
  note_name_requested boolean default false,
  note_name_request_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (group_id, user_id)
);

-- Trainings/Events
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups on delete cascade not null,
  title text not null,
  description text,
  topic text, -- Kann von Trainern ausgefüllt werden
  date date not null,
  start_time time not null,
  end_time time not null,
  is_event boolean default false, -- true = Event, false = normales Training
  is_cancelled boolean default false, -- true = Abgesagt
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RSVPs (Zusagen/Absagen/Vielleicht)
-- status: 'yes', 'no', 'maybe'
create table if not exists public.rsvps (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  status text not null check (status in ('yes', 'no', 'maybe')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (event_id, user_id)
);

-- 2. Trigger für neue Auth Users
-- Erstellt automatisch ein Profil, wenn sich jemand neu registriert
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger binden (Falls schon existent, vorher droppen, in Supabase oft so gelöst)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Row Level Security (RLS) aktivieren
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;

-- Hinweis: Für dieses Beispiel und eine einfache KI-Integration, 
-- erlauben wir temporär Lese- und Schreibzugriff für authentifizierte Nutzer,
-- um die Einrichtung zu vereinfachen. In einer echten Produktion sollten 
-- diese Policies strenger nach Gruppenrolle (Trainer/Member) gefiltert werden.
-- Ein Global Admin sollte alles sehen/ändern dürfen.

create policy "Profile auslesbar für alle eingeloggten" on public.profiles for select using (auth.role() = 'authenticated');
create policy "Nutzer können eigenes Profil updaten" on public.profiles for update using (auth.uid() = id);

create policy "Gruppen auslesbar für alle" on public.groups for select using (auth.role() = 'authenticated');
create policy "Gruppen erstellbar für Admins" on public.groups for all using (
  exists (select 1 from public.profiles where id = auth.uid() and is_global_admin = true)
);

create policy "Gruppenmitglieder auslesbar für alle" on public.group_members for select using (auth.role() = 'authenticated');
create policy "Jeder darf anfragen (insert)" on public.group_members for insert with check (auth.uid() = user_id);
create policy "Trainer/Admins dürfen Mitglieder ändern (update/delete)" on public.group_members for update using (
  exists (select 1 from public.profiles where id = auth.uid() and is_global_admin = true)
  or
  exists (select 1 from public.group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role = 'trainer' and gm.status = 'active')
);

create policy "Events auslesbar für alle" on public.events for select using (auth.role() = 'authenticated');
create policy "Trainer/Admins dürfen Events ändern" on public.events for all using (
  exists (select 1 from public.profiles where id = auth.uid() and is_global_admin = true)
  or
  exists (select 1 from public.group_members gm where gm.group_id = events.group_id and gm.user_id = auth.uid() and gm.role = 'trainer' and gm.status = 'active')
);

create policy "RSVPs auslesbar für alle" on public.rsvps for select using (auth.role() = 'authenticated');
create policy "Nur eigene RSVPs anlegen/ändern" on public.rsvps for all using (auth.uid() = user_id);

-- Optional: Realtime aktivieren für diese Tabellen, damit wir Änderungen live im Client pushen können
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.group_members;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.rsvps;

-- 4. Admin RPC functions
create or replace function public.admin_delete_user(target_user_id uuid)
returns void as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_global_admin = true) then
    raise exception 'Unauthorized';
  end if;
  
  delete from auth.users where id = target_user_id;
end;
$$ language plpgsql security definer;
