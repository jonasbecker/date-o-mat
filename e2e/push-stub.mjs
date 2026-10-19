// Headless Chromium has no push service, so tests that tap "Erinnerungen an" replace the
// browser side: the permission prompt answers `permission` and subscribing hands back a
// fake subscription with an endpoint the server accepts (nothing is ever sent to it). The server side is real.
export async function stubPush(context, permission = "granted") {
  await context.addInitScript((answer) => {
    let state = "default";
    Object.defineProperty(Notification, "permission", { get: () => state, configurable: true });
    Notification.requestPermission = async () => {
      state = answer;
      return state;
    };
    let current = null;
    PushManager.prototype.getSubscription = async () => current;
    PushManager.prototype.subscribe = async function () {
      const id = Math.random().toString(36).slice(2);
      const sub = {
        endpoint: `https://fcm.googleapis.com/fcm/send/stub-${id}`,
        toJSON: () => ({ endpoint: sub.endpoint, keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } }),
        unsubscribe: async () => {
          current = null;
          return true;
        },
      };
      current = sub;
      return sub;
    };
  }, permission);
}
