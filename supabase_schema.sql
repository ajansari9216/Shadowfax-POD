-- Create a table for POD images
create table pod_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  image_url text not null,
  ocr_text text,
  tracking_numbers text[] default '{}',
  created_at timestamptz default now()
);

-- Set up Row Level Security (RLS)
alter table pod_images enable row level security;

create policy "Users can view their own POD images"
  on pod_images for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own POD images"
  on pod_images for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete their own POD images"
  on pod_images for delete
  using ( auth.uid() = user_id );

create policy "Users can update their own POD images"
  on pod_images for update
  using ( auth.uid() = user_id );

-- Set up Storage for POD images
insert into storage.buckets (id, name, public) values ('pod-images', 'pod-images', true);

-- Storage RLS
create policy "Users can upload their own POD images"
  on storage.objects for insert
  with check ( bucket_id = 'pod-images' and auth.uid()::text = (storage.foldername(name))[1] );

create policy "Users can update their own POD images"
  on storage.objects for update
  using ( bucket_id = 'pod-images' and auth.uid()::text = (storage.foldername(name))[1] );

create policy "Users can delete their own POD images"
  on storage.objects for delete
  using ( bucket_id = 'pod-images' and auth.uid()::text = (storage.foldername(name))[1] );

create policy "Anyone can view POD images"
  on storage.objects for select
  using ( bucket_id = 'pod-images' );
