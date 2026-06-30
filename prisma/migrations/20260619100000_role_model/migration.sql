-- Role tablosunu oluştur
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- Varsayılan sistem rollerini ekle
INSERT INTO "Role" ("id", "name", "label", "permissions", "isSystem", "updatedAt") VALUES
(
  'role_super_admin', 'super_admin', 'Süper Admin',
  ARRAY['patient:read','patient:create','patient:update','patient:delete','timeline:read','timeline:create','diagnosis:read','diagnosis:create','diagnosis:update','prescription:read','prescription:create','prescription:update','document:read','document:upload','user:read','user:create','user:update','user:delete','settings:manage'],
  true, NOW()
),
(
  'role_admin', 'admin', 'Yönetici',
  ARRAY['patient:read','patient:create','patient:update','patient:delete','timeline:read','timeline:create','diagnosis:read','diagnosis:create','diagnosis:update','prescription:read','prescription:create','prescription:update','document:read','document:upload','user:read','user:create','user:update','settings:manage'],
  true, NOW()
),
(
  'role_doctor', 'doctor', 'Hekim',
  ARRAY['patient:read','patient:create','patient:update','timeline:read','timeline:create','diagnosis:read','diagnosis:create','diagnosis:update','prescription:read','prescription:create','prescription:update','document:read','document:upload'],
  true, NOW()
),
(
  'role_nurse', 'nurse', 'Hemşire',
  ARRAY['patient:read','patient:update','timeline:read','timeline:create','diagnosis:read','prescription:read','document:read','document:upload'],
  true, NOW()
),
(
  'role_receptionist', 'receptionist', 'Resepsiyonist',
  ARRAY['patient:read','patient:create','timeline:read','document:read'],
  true, NOW()
);

-- User tablosuna roleId ekle (önce nullable)
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;

-- Mevcut kullanıcıları migrate et
UPDATE "User" SET "roleId" = 'role_super_admin' WHERE "role" = 'super_admin';
UPDATE "User" SET "roleId" = 'role_admin' WHERE "role" = 'admin';
UPDATE "User" SET "roleId" = 'role_doctor' WHERE "role" = 'doctor';
UPDATE "User" SET "roleId" = 'role_nurse' WHERE "role" = 'nurse';
UPDATE "User" SET "roleId" = 'role_receptionist' WHERE "role" = 'receptionist';

-- roleId'yi NOT NULL yap
ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;

-- Foreign key ekle
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Index ekle
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- Eski role sütununu kaldır
ALTER TABLE "User" DROP COLUMN "role";

-- UserRole enum'unu kaldır
DROP TYPE "UserRole";
