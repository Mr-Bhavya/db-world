import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const unwrap = (response) => response.data?.data ?? response.data;

/**
 * User notifications.
 *
 * These moved out of `cinemaApi` when the bell was promoted from the cinema navbar to the global
 * header: notifications are not a cinema concern (IPO alerts and fulfilled requests land here too),
 * and a shared component may not depend on a feature module. `cinemaApi` re-exports them so every
 * existing cinema import keeps working.
 */

/** GET /api/notifications?limit=N → UserNotificationDto[] */
export const fetchNotifications = (limit = 30) =>
  axiosInstance.get('/api/notifications', { params: { limit } }).then(unwrap);

/** GET /api/notifications/unread-count → number */
export const fetchUnreadCount = () =>
  axiosInstance
    .get('/api/notifications/unread-count')
    .then((response) => response.data?.data?.count ?? 0);

/** PUT /api/notifications/mark-read */
export const markNotificationsRead = () =>
  axiosInstance.put('/api/notifications/mark-read').then(unwrap);
