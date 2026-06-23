alter table public.daily_tasks
  add column if not exists order_index integer not null default 0;

with ranked_tasks as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at desc, id desc
    ) - 1 as new_order_index
  from public.daily_tasks
)
update public.daily_tasks
set order_index = ranked_tasks.new_order_index
from ranked_tasks
where public.daily_tasks.id = ranked_tasks.id;

create table if not exists public.document_projects (
  id serial primary key,
  user_id varchar not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists public.document_folders (
  id serial primary key,
  project_id integer not null references public.document_projects(id) on delete cascade,
  parent_folder_id integer references public.document_folders(id) on delete cascade,
  name text not null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists public.document_items (
  id serial primary key,
  project_id integer not null references public.document_projects(id) on delete cascade,
  folder_id integer references public.document_folders(id) on delete cascade,
  item_type text not null check (item_type in ('note', 'file')),
  title text not null,
  content text,
  file_path text,
  file_name text,
  mime_type text,
  file_size integer,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  constraint document_items_payload_check check (
    (item_type = 'note' and file_path is null)
    or
    (item_type = 'file' and file_path is not null and file_name is not null)
  )
);

create index if not exists document_projects_user_id_idx
  on public.document_projects(user_id);

create index if not exists document_folders_project_id_idx
  on public.document_folders(project_id);

create index if not exists document_folders_parent_folder_id_idx
  on public.document_folders(parent_folder_id);

create index if not exists document_items_project_folder_idx
  on public.document_items(project_id, folder_id);
