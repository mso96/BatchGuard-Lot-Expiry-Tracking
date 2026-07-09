import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Page,
  Text,
} from "@shopify/polaris";
import {
  batchGuardPlan,
  buildAppSubscriptionCreateMutation,
  createLocalTestSubscription,
  getBillingStatus,
  isBillingTestMode,
} from "../models/billing.server";
import { getCurrentShopId } from "../shop.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const shopId = await getCurrentShopId();
  const billingStatus = await getBillingStatus(shopId);
  const appUrl = process.env.SHOPIFY_APP_URL ?? new URL(request.url).origin;

  return json({
    billingStatus,
    plan: batchGuardPlan,
    mutationPreview: buildAppSubscriptionCreateMutation({
      appUrl,
      test: isBillingTestMode(),
    }),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const shopId = await getCurrentShopId();
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "activate-local-test") {
    await createLocalTestSubscription(shopId);
    return redirect("/app");
  }

  return redirect("/app/billing");
}

export default function BillingPage() {
  const { billingStatus, plan, mutationPreview } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <Page title="Billing">
      <BlockStack gap="400">
        {billingStatus.testMode ? (
          <Banner tone="info">
            <Text as="p">Billing test mode is enabled for this development store.</Text>
          </Banner>
        ) : null}

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  {plan.name}
                </Text>
                <Text as="p" tone="subdued">
                  ${plan.amount}/{plan.currencyCode} monthly, {plan.trialDays}-day free trial
                </Text>
              </BlockStack>
              <Badge tone={billingStatus.hasActiveSubscription ? "success" : "warning"}>
                {billingStatus.hasActiveSubscription ? "Active" : "Subscription required"}
              </Badge>
            </InlineStack>

            <Text as="p">
              Production installs should redirect merchants to Shopify Billing through
              `appSubscriptionCreate`. The GraphQL mutation payload is prepared server-side for
              the Shopify template integration.
            </Text>

            <Form method="post">
              <input type="hidden" name="intent" value="activate-local-test" />
              <Button submit variant="primary" loading={submitting}>
                Activate local test subscription
              </Button>
            </Form>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Shopify Billing mutation
            </Text>
            <pre>{JSON.stringify(mutationPreview.variables, null, 2)}</pre>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

