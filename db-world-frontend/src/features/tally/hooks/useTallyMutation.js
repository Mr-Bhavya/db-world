import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';

const flights = new WeakMap();

export default function useTallyMutation(action, groupId, message, options) {
  const client = useQueryClient();
  const mutationKey = ['tally', 'write', action, groupId ?? 'all'];
  const flightKey = JSON.stringify(mutationKey);
  const pending = useIsMutating({ mutationKey, exact: true });
  const mutation = useMutation({
    ...options,
    mutationKey,
    retry: false,
    onMutate: () => ({ toast: notify.loading(message) }),
    onSettled: (_data, _error, _variables, context) => {
      if (context?.toast != null) notify.dismiss(context.toast);
    },
  });

  const mutateAsync = (variables, callbacks) => {
    let active = flights.get(client);
    if (!active) {
      active = new Map();
      flights.set(client, active);
    }
    if (active.has(flightKey)) return active.get(flightKey);
    const promise = mutation.mutateAsync(variables, callbacks).finally(() => {
      active.delete(flightKey);
    });
    active.set(flightKey, promise);
    return promise;
  };

  return {
    ...mutation,
    isPending: pending > 0 || mutation.isPending,
    mutateAsync,
    mutate: (variables, callbacks) => { mutateAsync(variables, callbacks).catch(() => {}); },
  };
}