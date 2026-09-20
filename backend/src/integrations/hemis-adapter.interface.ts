export interface HemisDepartmentRaw {
  id?: number | string;
  code?: string;
  name?: string;
  name_uz?: string;
  title?: string;
  structureType?: { code?: string; name?: string };
  type?: string;
  [key: string]: any;
}

export interface HemisRoomRaw {
  id?: number | string;
  code?: string;
  number?: string;
  name?: string;
  floor?: number | string;
  building?: { name?: string } | string;
  department?: { code?: string; name?: string };
  deptCode?: string;
  [key: string]: any;
}

export interface HemisUserRaw {
  id?: number | string;
  login?: string;
  username?: string;
  employee_id_number?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
  short_name?: string;
  email?: string;
  phone?: string;
  position?: string;
  staff_position?: { name?: string };
  department?: { code?: string; name?: string };
  deptCode?: string;
  [key: string]: any;
}

export interface MappedDepartment {
  code: string;
  name: string;
  type: string;
}

export interface MappedRoom {
  number: string;
  name: string;
  floor: number;
  building: string;
  deptCode?: string;
}

export interface MappedUser {
  username: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  position?: string;
  deptCode?: string;
}

/**
 * Tashqi HEMIS kafedra ma'lumotini ichki Department modeliga xaritalash
 */
export function mapHemisDepartment(raw: HemisDepartmentRaw): MappedDepartment | null {
  const code = (raw.code || (raw.id !== undefined && raw.id !== null ? String(raw.id) : '')).trim();
  const name = (raw.name || raw.name_uz || raw.title || '').trim();
  if (!code || !name) return null;

  const type =
    raw.structureType?.code === '11' || raw.type === 'FACULTY' ? 'FACULTY' : 'DEPARTMENT';

  return { code, name, type };
}

/**
 * Tashqi HEMIS auditoriya/xona ma'lumotini ichki Room modeliga xaritalash
 */
export function mapHemisRoom(raw: HemisRoomRaw): MappedRoom | null {
  const number = String(raw.code || raw.number || raw.name || '').trim();
  if (!number) return null;

  const name = (raw.name || `Auditoriya ${number}`).trim();
  const floor = Number(raw.floor) || 1;
  const building =
    typeof raw.building === 'object' && raw.building !== null
      ? (raw.building.name || 'Bosh bino').trim()
      : typeof raw.building === 'string'
        ? raw.building.trim()
        : 'Bosh bino';
  const deptCode = raw.department?.code || raw.deptCode;

  return { number, name, floor, building, deptCode };
}

/**
 * Tashqi HEMIS xodim/o'qituvchi ma'lumotini ichki User modeliga xaritalash
 */
export function mapHemisUser(raw: HemisUserRaw): MappedUser | null {
  const username = (
    raw.login ||
    raw.username ||
    raw.employee_id_number ||
    (raw.email ? raw.email.split('@')[0] : raw.id ? `hemis_user_${raw.id}` : '')
  ).trim();

  const fullName = (
    raw.full_name ||
    raw.fullName ||
    raw.name ||
    raw.short_name ||
    'HEMIS Xodim'
  ).trim();

  if (!username) return null;

  const email = raw.email?.trim() || null;
  const phone = raw.phone?.trim() || null;
  const position = (raw.staff_position?.name || raw.position || 'O‘qituvchi / Xodim').trim();
  const deptCode = raw.department?.code || raw.deptCode;

  return { username, fullName, email, phone, position, deptCode };
}

/**
 * HEMIS REST API adapter interfeysi (Strict Read-Only)
 */
export interface HemisAdapter {
  fetchDepartments(apiUrl: string, apiKey?: string, timeoutMs?: number): Promise<HemisDepartmentRaw[]>;
  fetchRooms(apiUrl: string, apiKey?: string, timeoutMs?: number): Promise<HemisRoomRaw[]>;
  fetchUsers(apiUrl: string, apiKey?: string, timeoutMs?: number): Promise<HemisUserRaw[]>;
}

/**
 * Real HTTP GET so'rovlari bajaruvchi jonli adapter
 */
export class HttpHemisAdapter implements HemisAdapter {
  private async safeGet<T = any>(url: string, apiKey?: string, timeoutMs = 8000): Promise<T[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['api-key'] = apiKey;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      if (Array.isArray(json)) return json;
      if (json && Array.isArray(json.data)) return json.data;
      if (json && Array.isArray(json.items)) return json.items;
      return [];
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`HEMIS serveriga so‘rov vaqti tugadi (Timeout ${timeoutMs}ms)`);
      }
      throw err;
    }
  }

  async fetchDepartments(apiUrl: string, apiKey?: string, timeoutMs = 8000): Promise<HemisDepartmentRaw[]> {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    try {
      return await this.safeGet<HemisDepartmentRaw>(`${cleanUrl}/rest/v1/data/department-list`, apiKey, timeoutMs);
    } catch {
      return await this.safeGet<HemisDepartmentRaw>(`${cleanUrl}/departments`, apiKey, timeoutMs);
    }
  }

  async fetchRooms(apiUrl: string, apiKey?: string, timeoutMs = 8000): Promise<HemisRoomRaw[]> {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    try {
      return await this.safeGet<HemisRoomRaw>(`${cleanUrl}/rest/v1/data/auditorium-list`, apiKey, timeoutMs);
    } catch {
      try {
        return await this.safeGet<HemisRoomRaw>(`${cleanUrl}/auditoriums`, apiKey, timeoutMs);
      } catch {
        return await this.safeGet<HemisRoomRaw>(`${cleanUrl}/rooms`, apiKey, timeoutMs);
      }
    }
  }

  async fetchUsers(apiUrl: string, apiKey?: string, timeoutMs = 8000): Promise<HemisUserRaw[]> {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    try {
      return await this.safeGet<HemisUserRaw>(`${cleanUrl}/rest/v1/data/employee-list`, apiKey, timeoutMs);
    } catch {
      try {
        return await this.safeGet<HemisUserRaw>(`${cleanUrl}/employees`, apiKey, timeoutMs);
      } catch {
        return await this.safeGet<HemisUserRaw>(`${cleanUrl}/users`, apiKey, timeoutMs);
      }
    }
  }
}

/**
 * Mock adapter - testlash va qat'iy tekshiruvlar uchun
 */
export class MockHemisAdapter implements HemisAdapter {
  constructor(
    private readonly mockDepartments: HemisDepartmentRaw[] = [],
    private readonly mockRooms: HemisRoomRaw[] = [],
    private readonly mockUsers: HemisUserRaw[] = [],
  ) {}

  async fetchDepartments(): Promise<HemisDepartmentRaw[]> {
    return this.mockDepartments;
  }

  async fetchRooms(): Promise<HemisRoomRaw[]> {
    return this.mockRooms;
  }

  async fetchUsers(): Promise<HemisUserRaw[]> {
    return this.mockUsers;
  }
}
