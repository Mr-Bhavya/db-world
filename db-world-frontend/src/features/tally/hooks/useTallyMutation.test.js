import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MutationObserver, QueryClient } from '@tanstack/react-query';

const state = vi.hoisted(() => ({ client: null }));
vi.mock('@shared/notify', () => ({
  notify: { loading: vi.fn(() => 'progress'), dismiss: vi.fn() },
}));
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...await importOriginal(),
  useQueryClient: () => state.client,
  useIsMutating: (filters) => state.client.isMutating(filters),
  useMutation: (options) => {
    const observer = new MutationObserver(state.client, options);
    return { mutateAsync: (variables, callbacks) => observer.mutate(variables, callbacks) };
  },
}));

import useTallyMutation from './useTallyMutation';
import { notify } from '@shared/notify';

describe('tally mutation lifecycle', () => {
  beforeEach(() => {
    state.client = new QueryClient();
    vi.clearAllMocks();
  });

  it('submits once for rapid clicks and a second screen while the request is pending', async () => {
    let finish;
    const request = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const onSuccess = vi.fn();
    const options = { mutationFn: request, onSuccess };
    const first = useTallyMutation('restore', 'group', 'Restoring expense...', options);
    const original = first.mutateAsync('expense');
    expect(first.mutateAsync('expense')).toBe(original);
    const remounted = useTallyMutation('restore', 'group', 'Restoring expense...', options);
    expect(remounted.isPending).toBe(true);
    expect(remounted.mutateAsync('expense')).toBe(original);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(notify.loading).toHaveBeenCalledTimes(1);
    expect(notify.dismiss).not.toHaveBeenCalled();
    finish({ id: 'restored' });
    await expect(original).resolves.toEqual({ id: 'restored' });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(notify.dismiss).toHaveBeenCalledWith('progress');
  });

  it('releases the guard and progress on failure, without automatically retrying', async () => {
    const error = new Error('Network unavailable');
    const request = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('saved');
    const onError = vi.fn();
    const mutation = useTallyMutation('create', 'group', 'Saving...', { mutationFn: request, onError });
    await expect(mutation.mutateAsync({ amount: 10 })).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(notify.dismiss).toHaveBeenCalledTimes(1);
    await expect(mutation.mutateAsync({ amount: 10 })).resolves.toBe('saved');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not block independent groups or actions', async () => {
    const request = vi.fn().mockResolvedValue('saved');
    const options = { mutationFn: request };
    await Promise.all([
      useTallyMutation('create', 'one', 'Saving...', options).mutateAsync(),
      useTallyMutation('create', 'two', 'Saving...', options).mutateAsync(),
      useTallyMutation('remove', 'one', 'Removing...', options).mutateAsync(),
    ]);
    expect(request).toHaveBeenCalledTimes(3);
  });
});