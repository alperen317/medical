export const ALL_PERMISSIONS = [
  "patient:read",
  "patient:create",
  "patient:update",
  "patient:delete",
  "timeline:read",
  "timeline:create",
  "timeline:delete",
  "diagnosis:read",
  "diagnosis:create",
  "diagnosis:update",
  "prescription:read",
  "prescription:create",
  "prescription:update",
  "document:read",
  "document:upload",
  "user:read",
  "user:create",
  "user:update",
  "user:delete",
  "settings:manage",
] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]

export const PERMISSION_CATEGORIES: { label: string; permissions: Permission[] }[] = [
  {
    label: "Hastalar",
    permissions: ["patient:read", "patient:create", "patient:update", "patient:delete"],
  },
  {
    label: "Zaman Çizelgesi",
    permissions: ["timeline:read", "timeline:create", "timeline:delete"],
  },
  {
    label: "Tanılar",
    permissions: ["diagnosis:read", "diagnosis:create", "diagnosis:update"],
  },
  {
    label: "Reçeteler",
    permissions: ["prescription:read", "prescription:create", "prescription:update"],
  },
  {
    label: "Belgeler",
    permissions: ["document:read", "document:upload"],
  },
  {
    label: "Kullanıcılar",
    permissions: ["user:read", "user:create", "user:update", "user:delete"],
  },
  {
    label: "Sistem",
    permissions: ["settings:manage"],
  },
]

export const PERMISSION_LABELS: Record<Permission, string> = {
  "patient:read": "Hasta Görüntüleme",
  "patient:create": "Hasta Ekleme",
  "patient:update": "Hasta Düzenleme",
  "patient:delete": "Hasta Silme",
  "timeline:read": "Zaman Çizelgesi Görüntüleme",
  "timeline:create": "Zaman Çizelgesi Ekleme",
  "timeline:delete": "Zaman Çizelgesi Silme",
  "diagnosis:read": "Tanı Görüntüleme",
  "diagnosis:create": "Tanı Ekleme",
  "diagnosis:update": "Tanı Düzenleme",
  "prescription:read": "Reçete Görüntüleme",
  "prescription:create": "Reçete Yazma",
  "prescription:update": "Reçete Düzenleme",
  "document:read": "Belge Görüntüleme",
  "document:upload": "Belge Yükleme",
  "user:read": "Kullanıcı Listesi",
  "user:create": "Kullanıcı Ekleme",
  "user:update": "Kullanıcı Düzenleme",
  "user:delete": "Kullanıcı Silme",
  "settings:manage": "Sistem Ayarları",
}

export function can(permissions: string[], permission: Permission): boolean {
  return permissions.includes(permission)
}
