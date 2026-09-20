import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextData {
  clientIp?: string;
  userAgent?: string;
  userId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContextData>();

export const RequestContext = {
  run: <T>(data: RequestContextData, fn: () => T): T => {
    return asyncLocalStorage.run(data, fn);
  },

  get: (): RequestContextData | undefined => {
    return asyncLocalStorage.getStore();
  },

  getClientIp: (): string | undefined => {
    return asyncLocalStorage.getStore()?.clientIp;
  },

  getUserAgent: (): string | undefined => {
    return asyncLocalStorage.getStore()?.userAgent;
  },
};
