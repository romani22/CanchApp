create index if not exists idx_profiles_zone_coordinates
on profiles
using gist (zone_coordinates)
where zone_coordinates is not null;

create or replace function profiles_near_location(
  lng double precision,
  lat double precision,
  radius_meters double precision default 10000
)
returns setof profiles
language sql stable
as $$
  select *
  from profiles
  where zone_coordinates is not null
    and point(lng, lat) <-> zone_coordinates < radius_meters / 111320.0
  order by point(lng, lat) <-> zone_coordinates;
$$;