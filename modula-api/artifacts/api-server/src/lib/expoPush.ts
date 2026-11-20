import { logger } from "./logger";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
}

/**
 * Sends one or more messages through Expo's push notification service. Best-effort:
 * network/service errors are logged and swallowed so a transient outage never crashes
 * the caller's scheduled job. Returns true if the request was accepted by Expo.
 *
 * Does not require an Expo access token for basic sending (Expo's push API is public),
 * but callers must have a real device-registered Expo push token in `to` — tokens are
 * obtained client-side via `expo-notifications`' `getExpoPushTokenAsync`, which itself
 * requires the app to have an EAS project id configured (see clinic-mobile app.json).
 */
export async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<boolean> {
  if (messages.length === 0) return true;

  try {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages.map((m) => ({ ...m, sound: m.sound ?? "default" }))),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.error({ status: response.status, body: text }, "Expo push: request failed");
      return false;
    }

    const json = (await response.json()) as { data?: Array<{ status: string; message?: string }> };
    const errors = (json.data ?? []).filter((r) => r.status !== "ok");
    if (errors.length > 0) {
      logger.warn({ errors }, "Expo push: some notifications were rejected");
    }
    return true;
  } catch (err) {
    logger.error({ err }, "Expo push: unexpected error sending notifications");
    return false;
  }
}
