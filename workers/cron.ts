import { setCloudflareBindings, type CloudflareBindings } from "../app/db.server";
import { runAlertDigestJob } from "../app/jobs/alerts.server";
import { runNightlyMaintenanceJob } from "../app/jobs/maintenance.server";

export default {
  async scheduled(controller, env, ctx) {
    setCloudflareBindings(env);

    if (controller.cron === "0 8 * * *") {
      ctx.waitUntil(runAlertDigestJob());
      return;
    }

    ctx.waitUntil(runNightlyMaintenanceJob());
  },
} satisfies ExportedHandler<CloudflareBindings>;
