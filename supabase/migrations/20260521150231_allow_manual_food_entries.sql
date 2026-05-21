-- Allow nutrition entries without a photo so photo scans, manual meals,
-- search results, and future barcode scans can share one private food log.

alter table public.food_photos
  drop constraint if exists food_photos_storage_path_key;

alter table public.food_photos
  alter column storage_path drop not null;

create unique index if not exists food_photos_storage_path_unique_idx
  on public.food_photos(storage_path)
  where storage_path is not null;
