-- 017: Default budgets to "approved" status
-- Removes unnecessary draft → submitted → approved friction

-- Change the default status for new budget periods
ALTER TABLE bgt_periods ALTER COLUMN status SET DEFAULT 'approved';

-- Promote any existing draft or submitted budgets to approved
UPDATE bgt_periods SET status = 'approved' WHERE status IN ('draft', 'submitted');
