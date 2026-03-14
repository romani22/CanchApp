create or replace function accept_join_request(request_id uuid)
returns void language plpgsql as $$
begin
  update join_requests set status = 'accepted' where id = request_id;
  insert into match_participants (match_id, user_id)
  select match_id, user_id from join_requests where id = request_id;
end; $$;