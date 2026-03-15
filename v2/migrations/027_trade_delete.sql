-- 027_trade_delete.sql — Permission for hard-deleting trades with no allocations

INSERT INTO permissions (id, module, action, description)
VALUES ('trade.delete', 'trade', 'delete', 'Permanently delete trades with no allocations')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, 'trade.delete' FROM roles r WHERE r.name IN ('admin', 'trader')
ON CONFLICT DO NOTHING;
