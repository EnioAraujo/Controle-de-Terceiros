-- Remove políticas permissivas antigas
drop policy if exists authed_insert_diarias_config on public.diarias_config;
drop policy if exists authed_update_diarias_config on public.diarias_config;
drop policy if exists authed_delete_diarias_config on public.diarias_config;

drop policy if exists authed_insert_fechamento_itens on public.fechamento_itens;
drop policy if exists authed_update_fechamento_itens on public.fechamento_itens;
drop policy if exists authed_delete_fechamento_itens on public.fechamento_itens;

drop policy if exists authed_insert_fechamentos on public.fechamentos;
drop policy if exists authed_update_fechamentos on public.fechamentos;
drop policy if exists authed_delete_fechamentos on public.fechamentos;

drop policy if exists authed_insert_terceiros on public.terceiros;
drop policy if exists authed_update_terceiros on public.terceiros;
drop policy if exists authed_delete_terceiros on public.terceiros;

drop policy if exists authed_insert_turnos_config on public.turnos_config;
drop policy if exists authed_update_turnos_config on public.turnos_config;
drop policy if exists authed_delete_turnos_config on public.turnos_config;

-- Políticas restritivas: apenas admin pode alterar

-- diarias_config
create policy admin_insert_diarias_config
  on public.diarias_config
  for insert
  to authenticated
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

create policy admin_update_diarias_config
  on public.diarias_config
  for update
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

create policy admin_delete_diarias_config
  on public.diarias_config
  for delete
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

-- fechamento_itens
create policy admin_insert_fechamento_itens
  on public.fechamento_itens
  for insert
  to authenticated
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

create policy admin_update_fechamento_itens
  on public.fechamento_itens
  for update
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

create policy admin_delete_fechamento_itens
  on public.fechamento_itens
  for delete
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

-- fechamentos
create policy admin_insert_fechamentos
  on public.fechamentos
  for insert
  to authenticated
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

create policy admin_update_fechamentos
  on public.fechamentos
  for update
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

create policy admin_delete_fechamentos
  on public.fechamentos
  for delete
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

-- terceiros
create policy admin_insert_terceiros
  on public.terceiros
  for insert
  to authenticated
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

create policy admin_update_terceiros
  on public.terceiros
  for update
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

create policy admin_delete_terceiros
  on public.terceiros
  for delete
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

-- turnos_config
create policy admin_insert_turnos_config
  on public.turnos_config
  for insert
  to authenticated
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

create policy admin_update_turnos_config
  on public.turnos_config
  for update
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

create policy admin_delete_turnos_config
  on public.turnos_config
  for delete
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));
