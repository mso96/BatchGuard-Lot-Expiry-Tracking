import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  FormLayout,
  InlineStack,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { useState } from "react";
import {
  getCurrentShop,
  parseShopSettings,
  updateShopSettings,
} from "../shop.server";

const timezoneOptions = [
  { label: "UTC", value: "UTC" },
  { label: "New York", value: "America/New_York" },
  { label: "London", value: "Europe/London" },
  { label: "Los Angeles", value: "America/Los_Angeles" },
  { label: "Istanbul", value: "Europe/Istanbul" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const shop = await getCurrentShop(request);
  const settings = parseShopSettings(shop.settings);
  const url = new URL(request.url);

  return json({
    settings,
    saved: url.searchParams.get("saved") === "1",
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const shop = await getCurrentShop(request);
  const formData = await request.formData();
  const thresholdDays = Number.parseInt(String(formData.get("warningThresholdDays") ?? ""), 10);
  const notificationEmail = String(formData.get("notificationEmail") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "UTC").trim();
  const alertsEnabled = formData.get("alertsEnabled") === "on";

  await updateShopSettings(shop.id, {
    warningThresholdDays: Number.isFinite(thresholdDays) ? thresholdDays : 30,
    notificationEmail,
    timezone,
    alertsEnabled,
  });

  return redirect("/app/settings?saved=1");
}

export default function SettingsPage() {
  const { settings, saved } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const [warningThresholdDays, setWarningThresholdDays] = useState(
    String(settings.warningThresholdDays),
  );
  const [notificationEmail, setNotificationEmail] = useState(settings.notificationEmail);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [alertsEnabled, setAlertsEnabled] = useState(settings.alertsEnabled);

  return (
    <Page title="Settings">
      <BlockStack gap="400">
        {saved ? (
          <Banner tone="success">
            <Text as="p">Settings saved.</Text>
          </Banner>
        ) : null}

        <Card>
          <Form method="post">
            <BlockStack gap="400">
              <FormLayout>
                <Checkbox
                  label="Enable expiry alert emails"
                  name="alertsEnabled"
                  checked={alertsEnabled}
                  onChange={setAlertsEnabled}
                />
                <TextField
                  label="Warning threshold"
                  name="warningThresholdDays"
                  value={warningThresholdDays}
                  onChange={setWarningThresholdDays}
                  type="number"
                  min={1}
                  step={1}
                  suffix="days"
                  autoComplete="off"
                />
                <TextField
                  label="Notification email"
                  name="notificationEmail"
                  value={notificationEmail}
                  onChange={setNotificationEmail}
                  type="email"
                  autoComplete="email"
                />
                <Select
                  label="Shop timezone"
                  name="timezone"
                  options={timezoneOptions}
                  value={timezone}
                  onChange={setTimezone}
                />
              </FormLayout>
              <InlineStack align="end">
                <Button submit variant="primary" loading={submitting}>
                  Save settings
                </Button>
              </InlineStack>
            </BlockStack>
          </Form>
        </Card>
      </BlockStack>
    </Page>
  );
}
