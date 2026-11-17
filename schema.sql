-- Ortak Harita — Supabase kurulumu
-- Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını yapıştır → Run.

create table if not exists public.pins (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  category    text not null check (category in ('favori', 'gizli', 'yemek', 'manzara', 'ani')),
  message     text not null check (char_length(btrim(message)) between 1 and 280),
  nickname    text check (nickname is null or char_length(nickname) <= 40)
);

-- İsteğe bağlı: pinleri sunucu tarafında da Berlin kutusuyla sınırla.
-- alter table public.pins add constraint pins_in_berlin
--   check (lat between 52.33 and 52.68 and lng between 13.08 and 13.77);

create index if not exists pins_created_at_idx on public.pins (created_at);

-- Satır düzeyi güvenlik: herkes okuyabilir ve ekleyebilir, kimse düzenleyemez/silemez.
-- (Silme işini sen Supabase panelinden yaparsın — panel bu kurallara takılmaz.)
alter table public.pins enable row level security;

drop policy if exists "herkes okuyabilir" on public.pins;
create policy "herkes okuyabilir" on public.pins
  for select to anon, authenticated using (true);

drop policy if exists "herkes ekleyebilir" on public.pins;
create policy "herkes ekleyebilir" on public.pins
  for insert to anon, authenticated with check (true);

-- Ziyaretçiler id ve created_at'i kendileri belirleyemesin: yalnızca bu sütunlara yazabilsinler.
revoke all on public.pins from anon, authenticated;
grant select on public.pins to anon, authenticated;
grant insert (lat, lng, category, message, nickname) on public.pins to anon, authenticated;

-- Canlı güncellemeler (yeni pinler sayfayı yenilemeden görünsün).
do $$
begin
  alter publication supabase_realtime add table public.pins;
exception when duplicate_object then null;
end $$;
