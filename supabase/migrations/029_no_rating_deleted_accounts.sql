-- =====================================================
-- Migración 029: no se califica a una cuenta borrada
-- =====================================================
--
-- Una lápida sigue siendo participante de sus partidos pasados, así que la policy
-- la aceptaba como calificable: entraba un comentario de texto libre sobre alguien
-- borrado, y on_new_rating le repoblaba el rating que delete_my_account() había
-- reseteado (medido: 5.00/0 → 1.00/1).
--
-- Se reescribe entera y no se agrega una nueva: dos policies permisivas se combinan
-- con OR, así que agregar la condición aparte no restringiría nada.

DROP POLICY IF EXISTS "Participants can rate each other" ON match_ratings;
CREATE POLICY "Participants can rate each other"
    ON match_ratings FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = rater_id
            AND rater_id <> rated_user_id
            AND EXISTS (SELECT 1 FROM match_participants
                        WHERE match_id = match_ratings.match_id
                          AND user_id = auth.uid())
            AND EXISTS (SELECT 1 FROM match_participants
                        WHERE match_id = match_ratings.match_id
                          AND user_id = match_ratings.rated_user_id)
            AND EXISTS (SELECT 1 FROM profiles
                        WHERE id = match_ratings.rated_user_id
                          AND deleted_at IS NULL)
        );

-- Nombre en inglés como los otros 30 índices del esquema. La 028 lo creó en
-- español.
ALTER INDEX IF EXISTS idx_profiles_activos RENAME TO idx_profiles_active;
