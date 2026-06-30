-- timeline:delete iznini super_admin ve admin rollerine ekle
UPDATE "Role"
SET "permissions" = array_append("permissions", 'timeline:delete'),
    "updatedAt"   = NOW()
WHERE "name" IN ('super_admin', 'admin')
  AND NOT ('timeline:delete' = ANY("permissions"));
