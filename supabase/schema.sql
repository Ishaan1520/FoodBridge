-- FoodBridge: secure database foundation
-- Run once in Supabase Dashboard > SQL Editor > New query.
-- Uses authenticated access and Row Level Security. No service-role key is needed in the browser.

begin;

create extension if not exists pgcrypto;

-- 1) User profiles. Public sign-up can create donor, NGO, or volunteer profiles.
-- Admin must be assigned manually by the project owner, never through public sign-up.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'donor'
    check (role in ('donor','ngo','volunteer','admin')),
  organisation text,
  phone text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Food donations.
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles(id) on delete restrict,
  food_name text not null,
  category text not null,
  quantity text not null,
  servings integer not null default 0 check (servings >= 0),
  description text,
  pickup_address text not null,
  latitude double precision,
  longitude double precision,
  available_until timestamptz,
  expiry_date date,
  image_url text,
  status text not null default 'available'
    check (status in ('available','reserved','picked_up','in_transit','completed','cancelled','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donations_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint donations_longitude_range check (longitude is null or longitude between -180 and 180)
);

-- 3) NGO requests for donations.
create table if not exists public.donation_requests (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  ngo_id uuid not null references public.profiles(id) on delete restrict,
  message text,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (donation_id, ngo_id)
);

-- 4) Volunteer pickup and delivery assignments.
create table if not exists public.pickup_assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.donation_requests(id) on delete cascade,
  donation_id uuid not null references public.donations(id) on delete cascade,
  ngo_id uuid not null references public.profiles(id) on delete restrict,
  donor_id uuid not null references public.profiles(id) on delete restrict,
  volunteer_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'assigned'
    check (status in ('assigned','picked_up','in_transit','delivered','cancelled')),
  current_latitude double precision,
  current_longitude double precision,
  location_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_latitude_range check (current_latitude is null or current_latitude between -90 and 90),
  constraint assignments_longitude_range check (current_longitude is null or current_longitude between -180 and 180)
);

-- 5) In-app notifications.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 6) Delivery reviews.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.pickup_assignments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (assignment_id, author_id)
);

-- Helpful indexes for common dashboard queries.
create index if not exists donations_status_created_idx on public.donations(status, created_at desc);
create index if not exists donations_donor_idx on public.donations(donor_id, created_at desc);
create index if not exists donation_requests_ngo_idx on public.donation_requests(ngo_id, created_at desc);
create index if not exists donation_requests_donation_idx on public.donation_requests(donation_id);
create index if not exists pickup_assignments_volunteer_idx on public.pickup_assignments(volunteer_id, created_at desc);
create index if not exists pickup_assignments_ngo_idx on public.pickup_assignments(ngo_id, created_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- updated_at maintenance.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists donations_set_updated_at on public.donations;
create trigger donations_set_updated_at before update on public.donations
for each row execute function public.set_updated_at();

drop trigger if exists donation_requests_set_updated_at on public.donation_requests;
create trigger donation_requests_set_updated_at before update on public.donation_requests
for each row execute function public.set_updated_at();

drop trigger if exists pickup_assignments_set_updated_at on public.pickup_assignments;
create trigger pickup_assignments_set_updated_at before update on public.pickup_assignments
for each row execute function public.set_updated_at();

-- Create a profile automatically when Supabase Auth creates a user.
-- Public metadata may choose only donor/ngo/volunteer. It cannot grant admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  requested_name text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'donor');
  if requested_role not in ('donor','ngo','volunteer') then
    requested_role := 'donor';
  end if;

  requested_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, 'FoodBridge user'), '@', 1)
  );

  insert into public.profiles (id, full_name, role, organisation)
  values (
    new.id,
    requested_name,
    requested_role,
    nullif(trim(new.raw_user_meta_data ->> 'organisation'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_foodbridge on auth.users;
create trigger on_auth_user_created_foodbridge
after insert on auth.users
for each row execute function public.handle_new_user();

-- Prevent users from promoting themselves to admin, changing their role,
-- or marking their own NGO as verified.
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.role is distinct from old.role then
      raise exception 'Profile role changes require administrator approval';
    end if;
    if new.is_verified is distinct from old.is_verified then
      raise exception 'Verification status can only be changed by an administrator';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_fields on public.profiles;
create trigger profiles_protect_privileged_fields
before update on public.profiles
for each row execute function public.protect_profile_privileged_fields();

-- Security-definer helpers avoid recursive RLS policy lookups.

create or replace function public.current_user_role_for_profile(target_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = target_user
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_donation_participant(target_donation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.donations d
    where d.id = target_donation
      and (
        d.donor_id = auth.uid()
        or exists (
          select 1 from public.donation_requests r
          where r.donation_id = d.id and r.ngo_id = auth.uid()
        )
        or exists (
          select 1 from public.pickup_assignments a
          where a.donation_id = d.id
            and auth.uid() in (a.ngo_id, a.donor_id, a.volunteer_id)
        )
      )
  )
$$;

-- Keep donation lifecycle in sync with volunteer delivery progress.
create or replace function public.sync_donation_from_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'picked_up' then
    update public.donations set status = 'picked_up' where id = new.donation_id;
  elsif new.status = 'in_transit' then
    update public.donations set status = 'in_transit' where id = new.donation_id;
  elsif new.status = 'delivered' then
    update public.donations set status = 'completed' where id = new.donation_id;
  end if;
  return new;
end;
$$;
drop trigger if exists assignment_sync_donation_status on public.pickup_assignments;
create trigger assignment_sync_donation_status
after insert or update of status on public.pickup_assignments
for each row execute function public.sync_donation_from_assignment();

-- Enable RLS on every application table.
alter table public.profiles enable row level security;
alter table public.donations enable row level security;
alter table public.donation_requests enable row level security;
alter table public.pickup_assignments enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;

-- Remove old starter policies if this script is being run over the starter schema.
drop policy if exists "Profiles readable by authenticated users" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Authenticated users view donations" on public.donations;
drop policy if exists "Donors create own donations" on public.donations;
drop policy if exists "Donors update own donations" on public.donations;
drop policy if exists "Donors delete own donations" on public.donations;
drop policy if exists "Relevant users read requests" on public.donation_requests;
drop policy if exists "NGOs create requests" on public.donation_requests;
drop policy if exists "Relevant users update requests" on public.donation_requests;
drop policy if exists "Involved users read assignments" on public.pickup_assignments;
drop policy if exists "NGOs create assignments" on public.pickup_assignments;
drop policy if exists "Involved users update assignments" on public.pickup_assignments;
drop policy if exists "Users read own notifications" on public.notifications;
drop policy if exists "Users update own notifications" on public.notifications;
drop policy if exists "Users read reviews" on public.reviews;
drop policy if exists "Users create own reviews" on public.reviews;

-- Profiles: users can read/update only their own private profile.
create policy profiles_select_own on public.profiles
for select to authenticated using (id = auth.uid());

create policy profiles_update_own on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- A limited directory view exposes no phone numbers or private profile fields.
create or replace view public.community_profiles
with (security_barrier = true)
as
select id, full_name, role, organisation, is_verified, created_at
from public.profiles;

grant select on public.community_profiles to authenticated;

-- Donations: authenticated community members can discover available food.
-- Exact pickup coordinates/address are only shown to logged-in users in this first version;
-- later app queries will reveal assignment details only to participants.
create policy donations_discover_available on public.donations
for select to authenticated
using (status = 'available' or donor_id = auth.uid() or public.is_donation_participant(id));

create policy donations_admin_read_all on public.donations
for select to authenticated using (public.current_user_role() = 'admin');

create policy donations_insert_donor on public.donations
for insert to authenticated
with check (donor_id = auth.uid() and public.current_user_role() = 'donor');

create policy donations_update_donor on public.donations
for update to authenticated
using (donor_id = auth.uid() and public.current_user_role() = 'donor')
with check (donor_id = auth.uid() and public.current_user_role() = 'donor');

create policy donations_delete_donor on public.donations
for delete to authenticated
using (donor_id = auth.uid() and public.current_user_role() = 'donor');

-- Requests: an NGO sees its own requests; the donor sees requests for their donations.
create policy requests_select_participants on public.donation_requests
for select to authenticated
using (
  ngo_id = auth.uid()
  or exists (select 1 from public.donations d where d.id = donation_id and d.donor_id = auth.uid())
  or public.current_user_role() = 'admin'
);

create policy requests_insert_ngo on public.donation_requests
for insert to authenticated
with check (
  ngo_id = auth.uid()
  and public.current_user_role() = 'ngo'
  and exists (
    select 1 from public.donations d
    where d.id = donation_id and d.status = 'available'
  )
);

create policy requests_update_participants on public.donation_requests
for update to authenticated
using (
  ngo_id = auth.uid()
  or exists (select 1 from public.donations d where d.id = donation_id and d.donor_id = auth.uid())
  or public.current_user_role() = 'admin'
)
with check (
  ngo_id = auth.uid()
  or exists (select 1 from public.donations d where d.id = donation_id and d.donor_id = auth.uid())
  or public.current_user_role() = 'admin'
);

-- Assignments: only the NGO coordinating an accepted request can create one.
create policy assignments_select_involved on public.pickup_assignments
for select to authenticated
using (
  auth.uid() in (ngo_id, donor_id, volunteer_id)
  or public.current_user_role() = 'admin'
);

create policy assignments_insert_ngo on public.pickup_assignments
for insert to authenticated
with check (
  ngo_id = auth.uid()
  and public.current_user_role() = 'ngo'
  and exists (
    select 1 from public.donation_requests r
    where r.id = request_id
      and r.donation_id = donation_id
      and r.ngo_id = auth.uid()
      and r.status = 'accepted'
  )
  and exists (
    select 1 from public.donations d
    where d.id = donation_id and d.donor_id = donor_id
  )
  and public.current_user_role_for_profile(volunteer_id) = 'volunteer'
);

create policy assignments_update_involved on public.pickup_assignments
for update to authenticated
using (
  auth.uid() in (ngo_id, donor_id, volunteer_id)
  or public.current_user_role() = 'admin'
)
with check (
  auth.uid() in (ngo_id, donor_id, volunteer_id)
  or public.current_user_role() = 'admin'
);

-- Notifications: recipients can read and mark their own notifications as read.
create policy notifications_select_own on public.notifications
for select to authenticated using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
for update to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Reviews: visible to signed-in users; only the author can create their own review
-- for an assignment in which they participated.
create policy reviews_select_authenticated on public.reviews
for select to authenticated using (true);

create policy reviews_insert_participant on public.reviews
for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.pickup_assignments a
    where a.id = assignment_id
      and auth.uid() in (a.donor_id, a.ngo_id, a.volunteer_id)
      and a.status = 'delivered'
  )
);

-- Because automatic table exposure is OFF, explicitly grant the minimum table privileges.
grant usage on schema public to authenticated;
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.current_user_role_for_profile(uuid) from public, anon;
revoke all on function public.is_donation_participant(uuid) from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_role_for_profile(uuid) to authenticated;
grant execute on function public.is_donation_participant(uuid) to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.community_profiles to authenticated;
grant select, insert, update, delete on public.donations to authenticated;
grant select, insert, update on public.donation_requests to authenticated;
grant select, insert, update on public.pickup_assignments to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert on public.reviews to authenticated;

-- Storage bucket for food photos. Food listing photos are public; uploads are restricted
-- to a folder named with the authenticated donor's user ID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'foodbridge-donations',
  'foodbridge-donations',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists foodbridge_food_images_public_read on storage.objects;
create policy foodbridge_food_images_public_read on storage.objects
for select to public
using (bucket_id = 'foodbridge-donations');

drop policy if exists foodbridge_donor_upload_food_images on storage.objects;
create policy foodbridge_donor_upload_food_images on storage.objects
for insert to authenticated
with check (
  bucket_id = 'foodbridge-donations'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.current_user_role() = 'donor'
);

drop policy if exists foodbridge_donor_update_food_images on storage.objects;
create policy foodbridge_donor_update_food_images on storage.objects
for update to authenticated
using (
  bucket_id = 'foodbridge-donations'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'foodbridge-donations'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists foodbridge_donor_delete_food_images on storage.objects;
create policy foodbridge_donor_delete_food_images on storage.objects
for delete to authenticated
using (
  bucket_id = 'foodbridge-donations'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Enable Supabase Realtime for the tables used by live dashboards.
do $$
declare
  t text;
begin
  foreach t in array array['donations','donation_requests','pickup_assignments','notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;