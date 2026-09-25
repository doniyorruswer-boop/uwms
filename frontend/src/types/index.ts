export const RoleType = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  HEAD_WAREHOUSE: 'HEAD_WAREHOUSE',
  MOL: 'MOL',
  EMPLOYEE: 'EMPLOYEE',
  AUDITOR: 'AUDITOR',
  CHIEF_ACCOUNTANT: 'CHIEF_ACCOUNTANT',
  COMMENDANT: 'COMMENDANT',
  RECTOR: 'RECTOR',
  VICE_RECTOR_FINANCE: 'VICE_RECTOR_FINANCE',
} as const;

export type RoleType = typeof RoleType[keyof typeof RoleType];

export type ItemType = 'FIXED_ASSET' | 'CONSUMABLE';

export type AssetStatus = 'NEW' | 'IN_USE' | 'IN_REPAIR' | 'WRITTEN_OFF';

export type FundingSource = 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT';

export type RequestStatus =
  | 'SUBMITTED'
  | 'PENDING'
  | 'APPROVED_BY_PRORECTOR'
  | 'APPROVED_BY_RECTOR'
  | 'FINANCED_BY_ACCOUNTANT'
  | 'RECEIVED_AT_WAREHOUSE'
  | 'HANDED_TO_COMMENDANT'
  | 'FULFILLED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'APPROVED_BY_HEAD'
  | 'APPROVED_BY_WAREHOUSE';

export type MovementType = 'INCOMING' | 'OUTGOING' | 'TRANSFER' | 'WRITE_OFF' | 'RETURN';

export interface User {
  id: string;
  fullName: string;
  username: string;
  email?: string;
  role: RoleType;
  permissions?: string[];
  phone?: string;
  position?: string;
  departmentId?: string;
  departmentName?: string;
  mustChangePassword?: boolean;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  mustChangePassword?: boolean;
  user: User;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
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
  departmentName?: string;
  facultyName?: string;
  supplierName?: string;
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

export interface LowStockItem {
  id: string;
  stockId: string;
  warehouseId: string;
  warehouseName: string;
  itemId: string;
  itemName: string;
  model?: string | null;
  categoryName: string;
  unit: string;
  quantity: number;
  minStockLimit: number;
  deficit: number;
  recommendedOrderQty: number;
  fundingSource?: 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT' | string;
  status: 'LOW';
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
  requesterRole?: string;
  requesterPosition?: string;   // Foydalanuvchi lavozimi (masalan: "Kafedra mudiri", "Prorektor", "Laborant")
  departmentId?: string;
  departmentName?: string;
  approvalNote?: string;
  approvedById?: string;
  approvedByName?: string;
  fundingSource?: 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT' | string;
  subAccountCode?: string;
  allocatedAmount?: number;
  targetRoomId?: string;
  targetRoomName?: string;
  targetRoomNumber?: string;
  commendantId?: string;
  commendantName?: string;
  submittedAt?: string;
  prorektorApprovedAt?: string;
  prorektorApprovedById?: string;
  prorektorApprovedByName?: string;
  rectorApprovedAt?: string;
  rectorApprovedById?: string;
  rectorApprovedByName?: string;
  accountantFinancedAt?: string;
  accountantFinancedById?: string;
  accountantFinancedByName?: string;
  warehouseReceivedAt?: string;
  warehouseReceivedById?: string;
  warehouseReceivedByName?: string;
  commendantHandedAt?: string;
  commendantHandedById?: string;
  commendantHandedByName?: string;
  fulfilledAt?: string;
  createdAt: string;
  items: RequestItem[];
}

export interface StockMovement {
  id: string;
  movementNumber: string;
  movementType: MovementType;
  referenceDoc?: string | null;
  note?: string;
  executedByName: string;
  sourceLocation?: string;
  targetLocation?: string;
  createdAt: string;
  itemSummary: string;
  fundingSource?: 'BYUDJET' | 'KONTRAKT_RIVOJLANTIRISH' | 'GRANT' | string;
  hasWormStamp?: boolean;
  stamp?: {
    id: string;
    docNumber: string;
    docType: string;
    isValid: boolean;
    signerName: string;
    signerRole?: string;
  } | null;
  items?: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
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
  status: 'VERIFIED' | 'REVOKED' | 'IN_PROGRESS';
  certificateTitle: string;
  docNumber: string;
  docType: string;
  title: string;
  signerName: string;
  signerRole: string;
  verificationHash: string;
  issuedAt: string;
  revokedAt?: string | null;
  revokedReason?: string | null;
  verificationMethod?: string;
  securityNotice?: string;
  metadata?: any;
  signingProgress?: {
    totalRequired: number;
    completedCount: number;
    percent: number;
    isFullySigned: boolean;
    signers: Array<{
      role: string;
      name: string;
      isSigned: boolean;
      signedAt?: string | null;
      method: string;
    }>;
  };
}

// 60s Dinamik QR-Pairing va Mobil Biometrik Imzo
export type SigningSessionStatusType = 'PENDING' | 'SCANNED' | 'SIGNED' | 'EXPIRED' | 'CANCELLED';

export interface InitSigningSessionPayload {
  docNumber: string;
  docType: string;
  title: string;
  departmentName?: string;
  roomName?: string;
  itemSummary: string;
  metadata?: any;
  targetSignerName?: string;
  targetSignerRole?: string;
  targetUserId?: string;
}

export interface SigningSessionInitResult {
  sessionId: string;
  sessionToken: string;
  qrUrl: string;
  docNumber: string;
  docType: string;
  title: string;
  itemSummary: string;
  expiresAt: string;
  remainingSeconds: number;
  expectedSignerName?: string | null;
  expectedSignerRole?: string | null;
}

export interface SigningSessionStatusResult {
  sessionId: string;
  status: SigningSessionStatusType;
  remainingSeconds: number;
  docNumber: string;
  title: string;
  signerName?: string | null;
  signerRole?: string | null;
  signedAt?: string | null;
  biometricType?: string | null;
  stamp?: any;
}

export interface MobileSigningDetailsResult {
  sessionId: string;
  sessionToken: string;
  docNumber: string;
  docType: string;
  title: string;
  departmentName?: string | null;
  roomName?: string | null;
  itemSummary: string;
  metadata?: any;
  status: SigningSessionStatusType;
  expiresAt: string;
  remainingSeconds: number;
  message?: string;
  stamp?: any;
  expectedSignerName?: string | null;
  expectedSignerRole?: string | null;
}


// HEMIS & UzASBO Integratsiyalari
export type HemisStatusType =
  | 'CONNECTED'
  | 'DEMO'
  | 'DEMO_STUB'
  | 'CONFIGURED_BUT_STUB'
  | 'NOT_CONFIGURED'
  | 'CONNECTION_FAILED'
  | 'AUTHENTICATION_FAILED'
  | 'ERROR';

export interface HemisStatusResult {
  status: HemisStatusType;
  isConfigured: boolean;
  mode: 'LIVE' | 'DEMO' | 'DEMO_STUB' | 'NOT_CONFIGURED';
  hemisVersion: string;
  apiUrl?: string | null;
  lastSyncAt: string | null;
  lastSyncType?: string | null;
  lastError?: string | null;
  stats: {
    syncedDepartments: number;
    syncedRooms: number;
    syncedUsers: number;
  };
  isWaitingForCredentials?: boolean;
  instructions?: string;
  pingMs?: number;
  errorMessage?: string;
  message?: string;
}

export interface HemisTestConnectionResult {
  success: boolean;
  status: string;
  statusCode: number;
  pingMs: number;
  targetUrl: string;
  errorMessage?: string;
  message: string;
}

// Moddiy Javobgarlikni Topshirish (Responsibility Handover & MOL Offboarding)
export type HandoverType =
  | 'FULL_TRANSFER'
  | 'PARTIAL_TRANSFER'
  | 'ROOM_TRANSFER'
  | 'RETURN_TO_WAREHOUSE'
  | 'FINAL_CLEARANCE';

export type HandoverStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RECEIVER_REVIEW'
  | 'COMMANDANT_REVIEW'
  | 'ACCOUNTANT_REVIEW'
  | 'PENDING_APPROVAL'
  | 'PENDING_AUDIT'
  | 'PENDING_SIGNATURES'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type HandoverItemActionType =
  | 'TRANSFER_TO_MOL'
  | 'RETURN_TO_WAREHOUSE'
  | 'SEND_TO_REPAIR'
  | 'WRITE_OFF'
  | 'SHORTAGE';

export interface HandoverItemActionInput {
  itemInstanceId: string;
  actionType: HandoverItemActionType;
  targetUserId?: string;
  targetWarehouseId?: string;
  conditionNote?: string;
  investigationNote?: string;
}

export interface CreateResponsibilityHandoverPayload {
  type: HandoverType;
  departingUserId: string;
  targetUserId?: string;
  targetWarehouseId?: string;
  buildingId?: string;
  commandantUserId?: string;
  accountantUserId?: string;
  roomId?: string;
  note?: string;
  items: HandoverItemActionInput[];
}

export interface SignHandoverPayload {
  pin?: string;
  note?: string;
}

export interface RejectHandoverPayload {
  reason: string;
}

export interface HandoverItemAction {
  id: string;
  handoverId: string;
  itemInstanceId: string;
  actionType: HandoverItemActionType;
  targetUserId?: string | null;
  targetWarehouseId?: string | null;
  conditionNote?: string | null;
  investigationNote?: string | null;
  itemInstance?: {
    id: string;
    inventoryNumber: string;
    serialNumber?: string | null;
    status: AssetStatus;
    cost?: number | string | null;
    item: {
      id: string;
      name: string;
      model?: string | null;
      category?: { id: string; name: string } | null;
    };
    room?: {
      id: string;
      number: string;
      name: string;
    } | null;
  };
}

export interface ResponsibilityHandover {
  id: string;
  handoverNumber: string;
  type: HandoverType;
  status: HandoverStatus;
  departingUserId: string;
  targetUserId?: string | null;
  targetWarehouseId?: string | null;
  buildingId?: string | null;
  commandantUserId?: string | null;
  accountantUserId?: string | null;
  approvedByUserId?: string | null;
  roomId?: string | null;
  note?: string | null;
  docArchiveId?: string | null;
  createdAt: string;
  updatedAt: string;
  departingUser?: Partial<User> & { phone?: string; position?: string };
  targetUser?: Partial<User> & { phone?: string; position?: string } | null;
  commandantUser?: Partial<User> & { phone?: string; position?: string } | null;
  accountantUser?: Partial<User> & { phone?: string; position?: string } | null;
  approvedByUser?: Partial<User> | null;
  building?: { id: string; name: string; code?: string } | null;
  room?: { id: string; number: string; name: string; floor?: number } | null;
  targetWarehouse?: { id: string; name: string; code?: string } | null;
  items?: HandoverItemAction[];
  _count?: { items: number };
  docArchive?: {
    id: string;
    docNumber: string;
    docType: string;
    title: string;
    contentHtml?: string;
    pdfUrl?: string | null;
    pdfPath?: string | null;
    qrPayloadUrl?: string;
    documentHash?: string;
    checksum?: string;
    signatories?: any[];
  } | null;
}

export interface PaginatedHandoversResponse {
  items: ResponsibilityHandover[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UserClearanceStatus {
  userId: string;
  fullName: string;
  canDeactivate: boolean;
  activeAssets: number;
  pendingHandovers: number;
  openShortages: number;
  responsibleRooms: number;
  statusSummary: string;
}

export interface ClearanceCertificate {
  certificateNumber: string;
  issueDate: string;
  userId: string;
  fullName: string;
  role: string;
  position?: string | null;
  departmentName?: string | null;
  isCleared: boolean;
  activeAssets: number;
  responsibleRooms: number;
  pendingHandovers: number;
  openShortages: number;
  completedHandovers: Array<{
    id: string;
    handoverNumber: string;
    type: string;
    createdAt: string;
    updatedAt: string;
    targetUser?: { fullName: string } | null;
    targetWarehouse?: { name: string } | null;
    _count?: { items: number };
  }>;
  verificationHash: string;
  qrPayloadUrl: string;
  contentHtml: string;
}

export interface PermissionItem {
  code: string;
  name: string;
  description: string;
  isPage?: boolean;
}

export interface PermissionModule {
  id: string;
  name: string;
  description: string;
  pageCode: string;
  permissions: PermissionItem[];
}

export interface UserPermissionsData {
  user: {
    id: string;
    fullName: string;
    username: string;
    role: RoleType;
    position?: string | null;
    departmentName?: string | null;
  };
  permissions: string[];
  effectivePermissions: string[];
  defaultRolePermissions: string[];
  isCustom: boolean;
  catalog: PermissionModule[];
}

export interface PermissionsCatalogResponse {
  modules: PermissionModule[];
  defaultPresets: Record<RoleType, string[]>;
}
