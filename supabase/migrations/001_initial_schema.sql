-- Turnos App Database Schema
-- Run this in Supabase SQL Editor

-- Enable necessary extensions
CREATE
EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUM Types
CREATE TYPE sport_type AS ENUM ('futbol', 'padel', 'tenis', 'basquet', 'voley');
CREATE TYPE skill_level AS ENUM ('principiante', 'intermedio', 'avanzado');
CREATE TYPE match_status AS ENUM ('open', 'full', 'completed', 'cancelled');
CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE notification_type AS ENUM ('new_match', 'join_request', 'request_accepted', 'request_rejected', 'match_reminder', 'match_cancelled');
-- Agregar nuevos tipos de formato y estados
CREATE TYPE tournament_format AS ENUM ('eliminatoria', 'liga', 'grupos');
CREATE TYPE tournament_status AS ENUM ('draft', 'open', 'ongoing', 'completed', 'cancelled');
-- Expandir notificaciones (opcional, si quieres tipos específicos)
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'tournament_invitation';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'match_scheduled';

-- Profiles Table (extends auth.users)
CREATE TABLE profiles
(
    id                    UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email                 TEXT NOT NULL,
    full_name             TEXT NOT NULL,
    avatar_url            TEXT,
    phone                 TEXT,
    bio                   TEXT,
    favorite_sports       sport_type[] DEFAULT '{}',
    skill_level           skill_level   DEFAULT 'intermedio',
    zone                  TEXT, -- e.g., "Palermo, CABA"
    zone_coordinates      POINT,
    total_matches         INTEGER       DEFAULT 0,
    total_wins            INTEGER       DEFAULT 0,
    rating                DECIMAL(3, 2) DEFAULT 5.00,
    rating_count          INTEGER       DEFAULT 0,
    push_token            TEXT,
    notifications_enabled BOOLEAN       DEFAULT true,
    created_at            TIMESTAMPTZ   DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   DEFAULT NOW()
);

-- Matches Table (Turnos)
CREATE TABLE matches
(
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id        UUID       NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    sport             sport_type NOT NULL,
    title             TEXT       NOT NULL,
    description       TEXT,
    date              DATE       NOT NULL,
    start_time        TIME       NOT NULL,
    end_time          TIME,
    venue_name        TEXT       NOT NULL,
    venue_address     TEXT,
    venue_coordinates POINT,
    total_players     INTEGER    NOT NULL CHECK (total_players > 0),
    players_needed    INTEGER    NOT NULL CHECK (players_needed >= 0),
    current_players   INTEGER          DEFAULT 1,
    skill_level       skill_level      DEFAULT 'intermedio',
    is_mixed          BOOLEAN          DEFAULT true,
    status            match_status     DEFAULT 'open',
    amenities         TEXT[] DEFAULT '{}', -- e.g., ['duchas', 'parking', 'vestuarios']
    created_at        TIMESTAMPTZ      DEFAULT NOW(),
    updated_at        TIMESTAMPTZ      DEFAULT NOW()
);
-- Tournaments Table
CREATE TABLE tournaments
(
    id            UUID PRIMARY KEY           DEFAULT gen_random_uuid(),
    creator_id    UUID              NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    sport         sport_type        NOT NULL,
    title         TEXT              NOT NULL,
    description   TEXT,
    format        tournament_format NOT NULL DEFAULT 'eliminatoria',
    status        tournament_status          DEFAULT 'draft',

    -- Logística
    venue_name    TEXT,
    venue_address TEXT,
    team_limit    INTEGER           NOT NULL DEFAULT 16 CHECK (team_limit >= 2),

    -- Configuración
    is_private    BOOLEAN                    DEFAULT false,
    entry_fee     DECIMAL(10, 2)             DEFAULT 0.00,
    prize_pool    TEXT,

    start_date    DATE,
    end_date      DATE,

    created_at    TIMESTAMPTZ                DEFAULT NOW(),
    updated_at    TIMESTAMPTZ                DEFAULT NOW()
);

-- Teams Table (Para torneos)
CREATE TABLE teams
(
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    logo_url      TEXT,
    captain_id    UUID NOT NULL REFERENCES profiles (id),
    created_at    TIMESTAMPTZ      DEFAULT NOW()
);

-- Team Members
CREATE TABLE team_members
(
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id   UUID NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ      DEFAULT NOW(),
    UNIQUE (team_id, user_id)
);

-- Tournament Matches (Vincula partidos individuales a un torneo)
-- Modificamos la tabla matches para que pueda pertenecer a un torneo opcionalmente
ALTER TABLE matches
    ADD COLUMN tournament_id UUID REFERENCES tournaments (id) ON DELETE CASCADE;
ALTER TABLE matches
    ADD COLUMN round INTEGER; -- Para saber si es Octavos, Cuartos, etc.
ALTER TABLE matches
    ADD COLUMN home_team_id UUID REFERENCES teams (id);
ALTER TABLE matches
    ADD COLUMN away_team_id UUID REFERENCES teams (id);

-- Match Participants (Confirmed Players)
CREATE TABLE match_participants
(
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id   UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    joined_at  TIMESTAMPTZ      DEFAULT NOW(),
    is_creator BOOLEAN          DEFAULT false,
    UNIQUE (match_id, user_id)
);

-- Join Requests
CREATE TABLE join_requests
(
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id   UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    status     request_status   DEFAULT 'pending',
    message    TEXT,
    created_at TIMESTAMPTZ      DEFAULT NOW(),
    updated_at TIMESTAMPTZ      DEFAULT NOW(),
    UNIQUE (match_id, user_id)
);

-- Notifications Table
CREATE TABLE notifications
(
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID              NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    type       notification_type NOT NULL,
    title      TEXT              NOT NULL,
    body       TEXT              NOT NULL,
    data       JSONB            DEFAULT '{}',
    is_read    BOOLEAN          DEFAULT false,
    created_at TIMESTAMPTZ      DEFAULT NOW()
);

-- User Match History (for ratings)
CREATE TABLE match_ratings
(
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id      UUID    NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
    rater_id      UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    rated_user_id UUID    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    rating        INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment       TEXT,
    created_at    TIMESTAMPTZ      DEFAULT NOW(),
    UNIQUE (match_id, rater_id, rated_user_id)
);

-- Indexes for better query performance
CREATE INDEX idx_matches_sport ON matches (sport);
CREATE INDEX idx_matches_date ON matches (date);
CREATE INDEX idx_matches_status ON matches (status);
CREATE INDEX idx_matches_creator ON matches (creator_id);
CREATE INDEX idx_join_requests_match ON join_requests (match_id);
CREATE INDEX idx_join_requests_user ON join_requests (user_id);
CREATE INDEX idx_join_requests_status ON join_requests (status);
CREATE INDEX idx_notifications_user ON notifications (user_id);
CREATE INDEX idx_notifications_read ON notifications (is_read);
CREATE INDEX idx_match_participants_match ON match_participants (match_id);
CREATE INDEX idx_match_participants_user ON match_participants (user_id);

-- Indexes
CREATE INDEX idx_tournaments_creator ON tournaments(creator_id);
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_teams_tournament ON teams(tournament_id);
CREATE INDEX idx_matches_tournament ON matches(tournament_id);

-- Enable RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Policies para Torneos
CREATE POLICY "Tournaments are viewable by everyone"
    ON tournaments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create tournaments"
    ON tournaments FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their tournaments"
    ON tournaments FOR UPDATE USING (auth.uid() = creator_id);

-- Policies para Equipos
CREATE POLICY "Teams are viewable by everyone"
    ON teams FOR SELECT USING (true);

CREATE POLICY "Tournament participants can create teams"
    ON teams FOR INSERT WITH CHECK (auth.uid() = captain_id);
-- Functions

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, 'no-email'),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, 'usuario'), '@', 1),
      'Usuario'
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT
    ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Function to update match player count
CREATE
OR REPLACE FUNCTION update_match_player_count()
RETURNS TRIGGER AS $$
BEGIN
    IF
TG_OP = 'INSERT' THEN
UPDATE matches
SET current_players = current_players + 1,
    players_needed  = GREATEST(players_needed - 1, 0),
    status          = CASE
                          WHEN current_players + 1 >= total_players THEN 'full'::match_status
                          ELSE status
        END,
    updated_at      = NOW()
WHERE id = NEW.match_id;
ELSIF
TG_OP = 'DELETE' THEN
UPDATE matches
SET current_players = GREATEST(current_players - 1, 1),
    players_needed  = players_needed + 1,
    status          = 'open'::match_status,
            updated_at = NOW()
WHERE id = OLD.match_id;
END IF;
RETURN NULL;
END;
$$
LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for participant changes
DROP TRIGGER IF EXISTS on_participant_change ON match_participants;
CREATE TRIGGER on_participant_change
    AFTER INSERT OR
DELETE
ON match_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_match_player_count();

-- Function to update user rating
CREATE
OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
UPDATE profiles
SET rating       = (SELECT ROUND(AVG(rating)::numeric, 2)
                    FROM match_ratings
                    WHERE rated_user_id = NEW.rated_user_id),
    rating_count = (SELECT COUNT(*)
                    FROM match_ratings
                    WHERE rated_user_id = NEW.rated_user_id),
    updated_at   = NOW()
WHERE id = NEW.rated_user_id;
RETURN NEW;
END;
$$
LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new ratings
DROP TRIGGER IF EXISTS on_new_rating ON match_ratings;
CREATE TRIGGER on_new_rating
    AFTER INSERT
    ON match_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_rating();

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_ratings ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE
POLICY "Profiles are viewable by everyone"
    ON profiles FOR
SELECT
    USING (true);

CREATE
POLICY "Users can update own profile"
    ON profiles FOR
UPDATE
    USING (auth.uid() = id);

-- Matches Policies
CREATE
POLICY "Matches are viewable by everyone"
    ON matches FOR
SELECT
    USING (true);

CREATE
POLICY "Authenticated users can create matches"
    ON matches FOR INSERT
    WITH CHECK (auth.uid() = creator_id);

CREATE
POLICY "Match creators can update their matches"
    ON matches FOR
UPDATE
    USING (auth.uid() = creator_id);

CREATE
POLICY "Match creators can delete their matches"
    ON matches FOR DELETE
USING (auth.uid() = creator_id);

-- Match Participants Policies
CREATE
POLICY "Participants are viewable by everyone"
    ON match_participants FOR
SELECT
    USING (true);

CREATE
POLICY "Match creators can add participants"
    ON match_participants FOR INSERT
    WITH CHECK (
        auth.uid() IN (
            SELECT creator_id FROM matches WHERE id = match_id
        )
        OR auth.uid() = user_id
    );

CREATE
POLICY "Match creators can remove participants"
    ON match_participants FOR DELETE
USING (
        auth.uid() IN (
            SELECT creator_id FROM matches WHERE id = match_id
        )
        OR auth.uid() = user_id
    );

-- Join Requests Policies
CREATE
POLICY "Users can view their own requests"
    ON join_requests FOR
SELECT
    USING (
    auth.uid() = user_id
    OR auth.uid() IN (
    SELECT creator_id FROM matches WHERE id = match_id
    )
    );

CREATE
POLICY "Authenticated users can create requests"
    ON join_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE
POLICY "Match creators can update request status"
    ON join_requests FOR
UPDATE
    USING (
    auth.uid() IN (
    SELECT creator_id FROM matches WHERE id = match_id
    )
    );

CREATE
POLICY "Users can delete their own requests"
    ON join_requests FOR DELETE
USING (auth.uid() = user_id);

-- Notifications Policies
CREATE
POLICY "Users can view their own notifications"
    ON notifications FOR
SELECT
    USING (auth.uid() = user_id);

CREATE
POLICY "System can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

CREATE
POLICY "Users can update their own notifications"
    ON notifications FOR
UPDATE
    USING (auth.uid() = user_id);

-- Match Ratings Policies
CREATE
POLICY "Ratings are viewable by everyone"
    ON match_ratings FOR
SELECT
    USING (true);

CREATE
POLICY "Participants can rate each other"
    ON match_ratings FOR INSERT
    WITH CHECK (
        auth.uid() = rater_id
        AND auth.uid() IN (
            SELECT user_id FROM match_participants WHERE match_id = match_ratings.match_id
        )
    );

-- Realtime subscriptions
DROP
PUBLICATION IF EXISTS supabase_realtime;
CREATE
PUBLICATION supabase_realtime FOR TABLE matches, join_requests, notifications, match_participants;
