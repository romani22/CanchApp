-- ================================================
-- MIGRATION: Allow creators to update team_slot
-- ================================================

-- Sin esta política, el UPDATE en match_participants era bloqueado por RLS
-- (solo existían políticas para SELECT, INSERT y DELETE)

CREATE POLICY "Match creators can update participants"
    ON match_participants FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT creator_id FROM matches WHERE id = match_id
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT creator_id FROM matches WHERE id = match_id
        )
    );