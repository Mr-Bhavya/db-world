import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@shared/components/ui/utils/AxiosInstants', () => ({
  default: {
    get: vi.fn(),
  },
}));

import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { getIpos, getIpo, getGmpHistory, getSubscriptionHistory } from './ipoApi';

const BASE = '/api/ipo';

describe('ipoApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getIpos calls GET /api/ipo with a status param when provided and unwraps the envelope', async () => {
    const payload = { ipos: [{ id: 1, companyName: 'Acme Ltd' }], lastUpdated: '2026-07-24T10:15:30Z' };
    axiosInstance.get.mockResolvedValueOnce({ data: { data: payload } });

    const result = await getIpos('open');

    expect(axiosInstance.get).toHaveBeenCalledWith(BASE, { params: { status: 'open' } });
    expect(result).toEqual(payload);
  });

  it('getIpos omits the status param when not provided', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: { data: { ipos: [], lastUpdated: null } } });

    await getIpos();

    expect(axiosInstance.get).toHaveBeenCalledWith(BASE, { params: undefined });
  });

  it('getIpo calls GET /api/ipo/{id} and unwraps the envelope', async () => {
    const detail = { id: 42, companyName: 'Beta Corp' };
    axiosInstance.get.mockResolvedValueOnce({ data: { data: detail } });

    const result = await getIpo(42);

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/42`);
    expect(result).toEqual(detail);
  });

  it('getGmpHistory calls GET /api/ipo/{id}/gmp-history and unwraps the envelope', async () => {
    const points = [{ t: '2026-07-20T00:00:00Z', gmp: 50, gmpPct: 5.2 }];
    axiosInstance.get.mockResolvedValueOnce({ data: { data: points } });

    const result = await getGmpHistory(42);

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/42/gmp-history`);
    expect(result).toEqual(points);
  });

  it('getSubscriptionHistory calls GET /api/ipo/{id}/subscription-history and unwraps the envelope', async () => {
    const points = [{ t: '2026-07-20T00:00:00Z', qib: 1.1, nii: 2.2, retail: 3.3, total: 2.5 }];
    axiosInstance.get.mockResolvedValueOnce({ data: { data: points } });

    const result = await getSubscriptionHistory(42);

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/42/subscription-history`);
    expect(result).toEqual(points);
  });
});
