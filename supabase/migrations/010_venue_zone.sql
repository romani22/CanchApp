-- ================================
-- MIGRATION: Add venue zone to matches
-- ================================

-- 1. Agregar columna de localidad del partido (nombre legible, ej: "Morteros")
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS venue_zone TEXT;

-- 2. Índice espacial para búsquedas por coordenadas del partido
CREATE INDEX IF NOT EXISTS idx_matches_venue_coordinates
ON matches USING gist (venue_coordinates)
WHERE venue_coordinates IS NOT NULL;

-- 3. Índice de texto para búsqueda por nombre de localidad
CREATE INDEX IF NOT EXISTS idx_matches_venue_zone
ON matches (venue_zone)
WHERE venue_zone IS NOT NULL;

-- 4. Función para obtener IDs de partidos cercanos a una ubicación
-- IMPORTANTE: Supabase almacena POINT como (x=longitud, y=latitud)
-- El operador <-> calcula distancia entre dos puntos en el mismo CRS.
-- point(lng, lat) construye point(x=lng, y=lat) — mismo orden que venue_coordinates.
-- 1 grado ≈ 111.32 km → radio en metros / 111320.0 = radio en grados
CREATE OR REPLACE FUNCTION matches_near_location(
  lng double precision,
  lat double precision,
  radius_meters double precision DEFAULT 20000
)
RETURNS TABLE(id uuid, distance_m double precision)
LANGUAGE sql STABLE
AS $$
  SELECT
    m.id,
    ROUND((point(lng, lat) <-> m.venue_coordinates) * 111320.0) AS distance_m
  FROM matches m
  WHERE m.venue_coordinates IS NOT NULL
    AND m.status = 'open'
    AND m.starts_at > NOW()
    AND point(lng, lat) <-> m.venue_coordinates < radius_meters / 111320.0
  ORDER BY point(lng, lat) <-> m.venue_coordinates;
$$;