export const RoleType = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HEAD_WAREHOUSE: 'HEAD_WAREHOUSE',
  MOL: 'MOL',
  EMPLOYEE: 'EMPLOYEE',
  AUDITOR: 'AUDITOR',
} as const;

export type RoleType = typeof RoleType[keyof typeof RoleType];

export type ItemType = 'FIXED_ASSET' | 'CONSUMABLE';

export type AssetStatus = 'NEW' | 'IN_USE' | 'IN_REPAIR' | 'WRITTEN_OFF';

export type RequestStatus = 'PENDING' | 'APPROVED_BY_HEAD' | 'APPROVED_BY_WAREHOUSE' | 'REJECTED' | 'FULFILLED' | 'CANCELLED';

export type MovementType = 'INCOMING' | 'OUTGOING' | 'TRANSFER' | 'WRITE_OFF' | 'RETURN';

export interface User {
  id: string;
  fullName: string;
  username: string;
  email?: string;
  role: RoleType;
  phone?: string;
  departmentId?: string;
  departmentName?: string;
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  type: 'FACULTY' | 'CHAIR' | 'DIVISION' | 'LAB';
  parentId?: string;
  children?: Department[];
}

export interface Room {
  id: string;
  number: string;
  name: string;
  floor: number;
  building: string;
  departmentId?: string;
  departmentName?: string;
  responsibleUserId?: string;
  responsibleUserName?: string;
  itemCount?: number;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Item {
  id: string;
  name: string;
  model?: string;
  sku?: string;
  itemType: ItemType;
  unit: string;
  minStockLimit: number;
  categoryId: string;
  categoryName?: string;
}

export interface ItemInstance {
  id: string;
  inventoryNumber: string;
  serialNumber?: string;
  qrCode: string;
  status: AssetStatus;
  purchaseDate?: string;
  purchasePrice?: number;
  fundingSource?: 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT' | string;
  depreciationRate?: number;
  accumulatedDepreciation?: number;
  currentBookValue?: number;
  ageYears?: number;
  itemId: string;
  itemName: string;
  itemModel?: string;
  categoryName?: string;
  roomId?: string;
  roomName?: string;
  roomNumber?: string;
  responsibleUserId?: string;
  responsibleUserName?: string;
  reprintCount?: number;
  lastReprintReason?: string;
  lastReprintedAt?: string;
  history?: { date: string; action: string; user: string; room?: string }[];
}

export interface StockItem {
  id: string;
  warehouseId: string;
  warehouseName: string;
  itemId: string;
  itemName: string;
  categoryName: string;
  unit: string;
  quantity: number;
  fundingSource?: 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT' | string;
  minStockLimit: number;
  status: 'NORMAL' | 'LOW';
}

export interface RequestItem {
  id: string;
  itemId: string;
  itemName: string;
  requestedQty: number;
  approvedQty?: number;
  unit: string;
}

export interface RequestRecord {
  id: string;
  requestNumber: string;
  purpose: string;
  status: RequestStatus;
  isOverQuota?: boolean;
  specialApprovalNeeded?: boolean;
  requesterId: string;
  requesterName: string;
  departmentName?: string;
  approvalNote?: string;
  createdAt: string;
  items: RequestItem[];
}

export interface StockMovement {
  id: string;
  movementNumber: string;
  movementType: MovementType;
  referenceDoc?: string;
  note?: string;
  executedByName: string;
  sourceLocation?: string;
  targetLocation?: string;
  createdAt: string;
  itemSummary: string;
}

// Bildirishnomalar
export type NotificationType =
  | 'INFO'
  | 'WARNING'
  | 'SUCCESS'
  | 'ERROR'
  | 'REQUEST'
  | 'TRANSFER'
  | 'AUDIT'
  | 'REPAIR'
  | 'WRITE_OFF'
  | 'QUOTA';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

// Kafedralar Kvotasi
export interface DepartmentQuota {
  id: string;
  departmentId: string;
  department: {
    id: string;
    name: string;
    code?: string;
  };
  itemId: string;
  item: {
    id: string;
    name: string;
    sku?: string;
    unit: string;
    itemType: string;
  };
  monthlyLimit: number;
  period: string; // YYYY-MM
  usedQuantity: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Tizim Auditi
export interface SystemAuditLogItem {
  id: string;
  userId?: string;
  user?: {
    id: string;
    fullName: string;
    username: string;
    role: RoleType;
    position?: string;
    department?: {
      id: string;
      name: string;
    };
  };
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// Kriptografik Muhr & Public Verifikatsiya
export interface PublicVerifyResult {
  isValid: boolean;
  status: 'VERIFIED' | 'REVOKED';
  certificateTitle: string;
  docNumber: string;
  docType: string;
  title: string;
  signerName: string;
  signerRole: string;
  verificationHash: string;
  issuedAt: string;
  metadata?: any;
}

// HEMIS & UzASBO Integratsiyalari
export interface HemisStatusResult {
  status: string;
  hemisVersion: string;
  lastSyncAt: string | null;
  stats: {
    syncedDepartments: number;
    syncedRooms: number;
    syncedUsers: number;
  };
}

