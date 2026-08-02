export const NOTIFICATION_OUTBOX_PREFLIGHT_ACTION = Object.freeze({
  SKIP_BOOTSTRAP: 'SKIP_BOOTSTRAP',
  VERIFY_SCOPE: 'VERIFY_SCOPE',
});

export function classifyNotificationOutboxPreflightState({
  projectExists,
  notificationDeliveryExists,
  migrationTableExists,
  baseMigrationApplied,
}) {
  if (baseMigrationApplied && !migrationTableExists) {
    throw new Error('Notification outbox migration history is inconsistent.');
  }

  if (!notificationDeliveryExists) {
    if (baseMigrationApplied) {
      throw new Error('Notification outbox base migration is applied but its table is missing.');
    }
    return Object.freeze({
      action: NOTIFICATION_OUTBOX_PREFLIGHT_ACTION.SKIP_BOOTSTRAP,
      reason: 'BASE_MIGRATION_NOT_APPLIED',
    });
  }

  if (!migrationTableExists || !baseMigrationApplied) {
    throw new Error('NotificationDelivery exists without its applied base migration.');
  }
  if (!projectExists) {
    throw new Error('NotificationDelivery exists but Project is missing.');
  }
  return Object.freeze({
    action: NOTIFICATION_OUTBOX_PREFLIGHT_ACTION.VERIFY_SCOPE,
    reason: null,
  });
}
