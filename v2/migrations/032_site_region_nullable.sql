-- Make sites.region nullable — org_units hierarchy now provides geographic context
ALTER TABLE sites ALTER COLUMN region DROP NOT NULL;
