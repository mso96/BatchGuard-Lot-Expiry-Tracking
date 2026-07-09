import cron from "node-cron";
import { runAlertDigestJob } from "./alerts.server";
import { runNightlyMaintenanceJob } from "./maintenance.server";

export function startDevScheduler() {
  // Runs at 08:00 and 02:00 server time in dev. Production should move these to a queue/cron platform.
  const alertTask = cron.schedule("0 8 * * *", () => {
    void runAlertDigestJob();
  });
  const maintenanceTask = cron.schedule("0 2 * * *", () => {
    void runNightlyMaintenanceJob();
  });

  return {
    stop() {
      alertTask.stop();
      maintenanceTask.stop();
    },
  };
}
