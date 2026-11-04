CREATE OR REPLACE FUNCTION prevent_duplicate_user_email_case_insensitive()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(LOWER(NEW.email), 0));

  IF EXISTS (
    SELECT 1
    FROM users
    WHERE LOWER(email) = LOWER(NEW.email)
      AND user_id IS DISTINCT FROM NEW.user_id
  ) THEN
    RAISE EXCEPTION 'User email address already exists'
      USING ERRCODE = '23505', CONSTRAINT = 'users_email_lower_unique_idx';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER users_email_case_insensitive_unique_insert
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_user_email_case_insensitive();

CREATE TRIGGER users_email_case_insensitive_unique_update
BEFORE UPDATE OF email ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_user_email_case_insensitive();
