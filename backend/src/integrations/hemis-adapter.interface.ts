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
/**
 * Real HTTP GET so'rovlari bajaruvchi jonli adapter
 * - Exponential backoff retry (tarmoq uzilishlari, 429, 502, 503, 504)
 * - Jitter (tasodifiy kechikish) orqali server yuklamasini kamaytirish
 * - Paginatsiya (multi-page) avtomatik yig‘ish
 */
export class HttpHemisAdapter implements HemisAdapter {
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Bitta HTTP so'rovni exponential backoff retry bilan bajarish
   */
  private async fetchWithRetry<T = any>(
    url: string,
    apiKey?: string,
    timeoutMs = 8000,
    maxRetries = 3,
  ): Promise<T[]> {
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
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

        // 1. Muvaffaqiyatli javob
        if (response.ok) {
          const json = await response.json();
          return this.extractItems<T>(json);
        }

        // 2. Qayta urinib bo'lmaydigan mijoz xatolari (400, 401, 403, 404)
        if (
          response.status === 400 ||
          response.status === 401 ||
          response.status === 403 ||
          response.status === 404
        ) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 3. Qayta urinilishi mumkin bo'lgan holatlar (429 Rate limit, 502, 503, 504)
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;

        if (attempt < maxRetries) {
          const backoffDelay =
            retryAfterSec && !isNaN(retryAfterSec)
              ? retryAfterSec * 1000
              : Math.pow(2, attempt) * 500 + Math.floor(Math.random() * 250);

          await this.sleep(backoffDelay);
          continue;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (err: any) {
        clearTimeout(timeoutId);

        const isAbort = err.name === 'AbortError';
        const isClientHttp = err.message && err.message.startsWith('HTTP 4');

        if (isClientHttp) {
          throw err;
        }

        lastError = isAbort
          ? new Error(`HEMIS serveriga so‘rov vaqti tugadi (Timeout ${timeoutMs}ms)`)
          : err;

        if (attempt < maxRetries) {
          const backoffDelay = Math.pow(2, attempt) * 500 + Math.floor(Math.random() * 250);
          await this.sleep(backoffDelay);
          continue;
        }
      }
    }

    throw lastError || new Error('HEMIS serveriga ulanishda noma’lum xatolik');
  }

  /**
   * HEMIS API turli xil konvert (envelope) formatlaridan massivni ajratib olish
   */
  private extractItems<T>(json: any): T[] {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (json.data && Array.isArray(json.data.items)) return json.data.items;
    if (json.data && Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.items)) return json.items;
    if (json.result && Array.isArray(json.result)) return json.result;
    return [];
  }

  /**
   * Agar HEMIS da paginatsiya mavjud bo'lsa, barcha sahifalarni avtomatik tortib olish
   */
  private async safeGetPaginated<T = any>(
    baseUrl: string,
    apiKey?: string,
    timeoutMs = 8000,
    maxPages = 20,
  ): Promise<T[]> {
    const separator = baseUrl.includes('?') ? '&' : '?';
    // 1-sahifani limit=200 bilan so'rash
    const firstPageUrl = `${baseUrl}${separator}page=1&limit=200`;
    let firstPageItems: T[] = [];

    try {
      firstPageItems = await this.fetchWithRetry<T>(firstPageUrl, apiKey, timeoutMs);
    } catch {
      // Fallback: parametrlarsiz to'g'ridan-to'g'ri urinish
      return await this.fetchWithRetry<T>(baseUrl, apiKey, timeoutMs);
    }

    // Agar 200 tadan kam bo'lsa yoki bitta sahifaning o'zi bo'lsa, qaytarish
    if (firstPageItems.length < 200) {
      return firstPageItems;
    }

    // Keyingi sahifalarni qat'iy xavfsizlik chegarasi (maxPages) bilan yuklash
    const allItems = [...firstPageItems];
    for (let page = 2; page <= maxPages; page++) {
      try {
        const nextUrl = `${baseUrl}${separator}page=${page}&limit=200`;
        const nextItems = await this.fetchWithRetry<T>(nextUrl, apiKey, timeoutMs, 1);
        if (!nextItems || nextItems.length === 0) break;
        allItems.push(...nextItems);
        if (nextItems.length < 200) break;
      } catch {
        // Agar keyingi sahifada xatolik bo'lsa, yig'ilganini qaytarish
        break;
      }
    }

    return allItems;
  }

  async fetchDepartments(
    apiUrl: string,
    apiKey?: string,
    timeoutMs = 8000,
  ): Promise<HemisDepartmentRaw[]> {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    try {
      return await this.safeGetPaginated<HemisDepartmentRaw>(
        `${cleanUrl}/rest/v1/data/department-list`,
        apiKey,
        timeoutMs,
      );
    } catch {
      try {
        return await this.safeGetPaginated<HemisDepartmentRaw>(
          `${cleanUrl}/rest/v1/departments`,
          apiKey,
          timeoutMs,
        );
      } catch {
        return await this.safeGetPaginated<HemisDepartmentRaw>(
          `${cleanUrl}/departments`,
          apiKey,
          timeoutMs,
        );
      }
    }
  }

  async fetchRooms(
    apiUrl: string,
    apiKey?: string,
    timeoutMs = 8000,
  ): Promise<HemisRoomRaw[]> {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    try {
      return await this.safeGetPaginated<HemisRoomRaw>(
        `${cleanUrl}/rest/v1/data/auditorium-list`,
        apiKey,
        timeoutMs,
      );
    } catch {
      try {
        return await this.safeGetPaginated<HemisRoomRaw>(
          `${cleanUrl}/rest/v1/auditoriums`,
          apiKey,
          timeoutMs,
        );
      } catch {
        return await this.safeGetPaginated<HemisRoomRaw>(
          `${cleanUrl}/rooms`,
          apiKey,
          timeoutMs,
        );
      }
    }
  }

  async fetchUsers(
    apiUrl: string,
    apiKey?: string,
    timeoutMs = 8000,
  ): Promise<HemisUserRaw[]> {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    try {
      return await this.safeGetPaginated<HemisUserRaw>(
        `${cleanUrl}/rest/v1/data/employee-list`,
        apiKey,
        timeoutMs,
      );
    } catch {
      try {
        return await this.safeGetPaginated<HemisUserRaw>(
          `${cleanUrl}/rest/v1/employees`,
          apiKey,
          timeoutMs,
        );
      } catch {
        return await this.safeGetPaginated<HemisUserRaw>(
          `${cleanUrl}/employees`,
          apiKey,
          timeoutMs,
        );
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
