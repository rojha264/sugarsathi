import type { BaseRecord, DataProvider } from '@refinedev/core';

import { api, API_URL, qs } from './api';

/**
 * Refine data provider for the Sugar Saathi API. Lists: GET /admin/:resource?page&pageSize&sort&order&...filters
 * returning { data, total }. Saves use PUT /admin/:resource/:id (meta.method can switch to PATCH / POST).
 */
export const dataProvider: DataProvider = {
  getApiUrl: () => API_URL,

  async getList({ resource, pagination, sorters, filters, meta }) {
    const params: Record<string, unknown> = { page: pagination?.current ?? 1, pageSize: pagination?.pageSize ?? 20, ...(meta?.query ?? {}) };
    if (sorters?.[0]) Object.assign(params, { sort: sorters[0].field, order: sorters[0].order });
    for (const f of filters ?? []) if ('field' in f && f.value !== undefined && f.value !== null && f.value !== '') params[f.field] = Array.isArray(f.value) ? f.value.join(',') : f.value;
    const res = await api<{ data: BaseRecord[]; total: number } | BaseRecord[]>(`/admin/${resource}${qs(params)}`);
    return Array.isArray(res) ? { data: res as never, total: res.length } : { data: res.data as never, total: res.total };
  },

  async getOne({ resource, id }) {
    return { data: await api(`/admin/${resource}/${id}`) as never };
  },

  async create({ resource, variables, meta }) {
    const id = (variables as { id?: string }).id;
    const put = meta?.method === 'put' && id;
    return { data: await api(put ? `/admin/${resource}/${id}` : `/admin/${resource}`, { method: put ? 'PUT' : 'POST', json: variables }) as never };
  },

  async update({ resource, id, variables, meta }) {
    return { data: await api(`/admin/${resource}/${id}`, { method: (meta?.method as string) ?? 'PUT', json: variables }) as never };
  },

  async deleteOne({ resource, id }) {
    return { data: await api(`/admin/${resource}/${id}`, { method: 'DELETE' }) as never };
  },

  async custom({ url, method, payload, query }) {
    return { data: await api(`${url}${qs((query as Record<string, unknown>) ?? {})}`, { method: method.toUpperCase(), json: payload }) as never };
  },
};
