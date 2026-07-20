create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'professor'))
);

create table if not exists public.students (
  id text primary key,
  aluno text not null default '',
  modalidade text not null default 'Muay Thai',
  horario text not null default '19:00',
  turma text not null default 'Muay Thai 19:00',
  cobrado text not null default 'Nao',
  pago text not null default 'Nao',
  valor numeric not null default 0,
  forma text not null default 'Pix/Outros',
  categoria text not null default 'Mensal',
  observacao text not null default '',
  created_by text not null default 'admin',
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.students enable row level security;

create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid()
$$;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "students_admin_select" on public.students;
create policy "students_admin_select"
on public.students
for select
to authenticated
using (public.current_role() = 'admin');

drop policy if exists "students_admin_change" on public.students;
create policy "students_admin_change"
on public.students
for all
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "students_professor_select" on public.students;

drop policy if exists "students_professor_insert" on public.students;
create policy "students_professor_insert"
on public.students
for insert
to authenticated
with check (
  public.current_role() = 'professor'
  and created_by = 'professor'
  and cobrado = 'Nao'
  and pago = 'Nao'
  and valor = 0
);

create or replace function public.get_professor_students()
returns table (
  id text,
  aluno text,
  pago text,
  categoria text,
  turma text,
  valor numeric
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.aluno,
    s.pago,
    s.categoria,
    s.turma,
    s.valor
  from public.students s
  where public.current_role() in ('admin', 'professor')
  order by s.aluno;
$$;

grant execute on function public.get_professor_students() to authenticated;
