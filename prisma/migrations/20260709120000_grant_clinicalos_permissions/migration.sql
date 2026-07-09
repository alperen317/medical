-- ClinicalOS izinlerini mevcut rollere ata

-- workflow:manage -> sadece super_admin
UPDATE "Role"
SET "permissions" = array_append("permissions", 'workflow:manage'),
    "updatedAt"   = NOW()
WHERE "name" = 'super_admin'
  AND NOT ('workflow:manage' = ANY("permissions"));

-- intake:execute -> tüm klinik roller (hasta kabul akışını çalıştırabilir)
UPDATE "Role"
SET "permissions" = array_append("permissions", 'intake:execute'),
    "updatedAt"   = NOW()
WHERE "name" IN ('super_admin', 'admin', 'doctor', 'nurse', 'receptionist')
  AND NOT ('intake:execute' = ANY("permissions"));
