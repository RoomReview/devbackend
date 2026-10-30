UPDATE users
SET trial_started_at = NULL,
    trial_ends_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE role IN ('AGENCY', 'AGENT')
  AND early_access_discount_eligible = true;
