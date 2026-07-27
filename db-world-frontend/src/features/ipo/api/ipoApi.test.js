import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@shared/components/ui/utils/AxiosInstants', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import {
  getIpos, getIpo, getGmpHistory, getSubscriptionHistory, getFinancials,
  getMyApplication, saveApplication, deleteApplication, getMyApplications,
} from './ipoApi';

const BASE = '/api/ipo';

describe('ipoApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getIpos sends status, type and sort together when all are meaningful', async () => {
    const payload = { ipos: [{ id: 1, companyName: 'Acme Ltd' }], lastUpdated: '2026-07-24T10:15:30Z' };
    axiosInstance.get.mockResolvedValueOnce({ data: { data: payload } });

    const result = await getIpos({ status: 'open', type: 'sme', sort: 'gmp' });

    expect(axiosInstance.get).toHaveBeenCalledWith(BASE, { params: { status: 'open', type: 'sme', sort: 'gmp' } });
    expect(result).toEqual(payload);
  });

  it('getIpos omits status and type when All (empty status, type "all"), sending only sort', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: { data: { ipos: [], lastUpdated: null } } });

    await getIpos({ status: '', type: 'all', sort: 'date' });

    expect(axiosInstance.get).toHaveBeenCalledWith(BASE, { params: { sort: 'date' } });
  });

  it('getIpos sends a type filter without a status filter', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: { data: { ipos: [], lastUpdated: null } } });

    await getIpos({ type: 'mainboard', sort: 'subscription' });

    expect(axiosInstance.get).toHaveBeenCalledWith(BASE, { params: { sort: 'subscription', type: 'mainboard' } });
  });

  it('getIpos defaults sort to "date" and omits status/type when called with no args', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: { data: { ipos: [], lastUpdated: null } } });

    await getIpos();

    expect(axiosInstance.get).toHaveBeenCalledWith(BASE, { params: { sort: 'date' } });
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

  it('getFinancials calls GET /api/ipo/{id}/financials and unwraps the envelope', async () => {
    const rows = [{ fiscalYear: 'FY23', revenue: 2640.0, pat: 245.0 }];
    axiosInstance.get.mockResolvedValueOnce({ data: { data: rows } });

    const result = await getFinancials(42);

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/42/financials`);
    expect(result).toEqual(rows);
  });

  it('getMyApplication calls GET /api/ipo/{id}/application and unwraps the envelope', async () => {
    const application = {
      ipoId: '42', applicantName: 'Jane Doe', applicationNo: 'APP123',
      dpClientId: 'DP456', panLast4: '234F', allotmentResult: 'allotted',
    };
    axiosInstance.get.mockResolvedValueOnce({ data: { data: application } });

    const result = await getMyApplication(42);

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/42/application`);
    expect(result).toEqual(application);
  });

  it('getMyApplication resolves to null (not the envelope) when none is saved', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: { data: null } });

    const result = await getMyApplication(42);

    expect(result).toBeNull();
  });

  it('saveApplication calls POST /api/ipo/{id}/application with the body and unwraps the envelope', async () => {
    const body = { applicantName: 'Jane Doe', applicationNo: 'APP123', dpClientId: 'DP456', pan: 'ABCDE1234F', allotmentResult: 'unknown' };
    const dto = { ipoId: '42', applicantName: 'Jane Doe', applicationNo: 'APP123', dpClientId: 'DP456', panLast4: '234F', allotmentResult: 'unknown' };
    axiosInstance.post.mockResolvedValueOnce({ data: { data: dto } });

    const result = await saveApplication(42, body);

    expect(axiosInstance.post).toHaveBeenCalledWith(`${BASE}/42/application`, body);
    expect(result).toEqual(dto);
  });

  it('deleteApplication calls DELETE /api/ipo/{id}/application', async () => {
    axiosInstance.delete.mockResolvedValueOnce({ data: { success: true, message: 'Removed' } });

    const result = await deleteApplication(42);

    expect(axiosInstance.delete).toHaveBeenCalledWith(`${BASE}/42/application`);
    expect(result).toEqual({ success: true, message: 'Removed' });
  });

  it('getMyApplications calls GET /api/ipo/my/applications and unwraps the envelope', async () => {
    const rows = [{ application: { ipoId: '42', panLast4: '234F' }, ipo: { id: '42', companyName: 'Acme Ltd' } }];
    axiosInstance.get.mockResolvedValueOnce({ data: { data: rows } });

    const result = await getMyApplications();

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/my/applications`);
    expect(result).toEqual(rows);
  });

  it('getMyApplications defaults to an empty array when data is missing', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: {} });

    const result = await getMyApplications();

    expect(result).toEqual([]);
  });
});
