import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigation } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineGrid,
  InlineStack,
  Page,
  SkeletonBodyText,
  Text,
} from "@shopify/polaris";
import { getExpiryDashboard } from "../models/lot.server";
import { getCurrentShop, parseShopSettings } from "../shop.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const shop = await getCurrentShop(request);
  const settings = parseShopSettings(shop.settings);
  const dashboard = await getExpiryDashboard(shop.id, settings.warningThresholdDays);

  return json({
    shopDomain: shop.domain,
    thresholdDays: settings.warningThresholdDays,
    dashboard,
    requestUrl: request.url,
  });
}

export default function Dashboard() {
  const { dashboard, thresholdDays, shopDomain } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const loading = navigation.state !== "idle";

  return (
    <Page
      title="Expiry dashboard"
      subtitle={`Warning threshold: ${thresholdDays} days`}
      primaryAction={{ content: "Add lot", url: "/app/lots/new" }}
      secondaryActions={[{ content: "View lots", url: "/app/lots" }]}
    >
      <BlockStack gap="400">
        <InlineGrid columns={{ xs: 1, sm: 2, md: 5 }} gap="400">
          <SummaryCard title="≤7 days" value={dashboard.summary.expiring7} loading={loading} />
          <SummaryCard title="≤30 days" value={dashboard.summary.expiring30} loading={loading} />
          <SummaryCard title="≤90 days" value={dashboard.summary.expiring90} loading={loading} />
          <SummaryCard title="Expired units" value={dashboard.summary.expired} loading={loading} tone="critical" />
          <SummaryCard
            title="Value at risk"
            value={formatMoney(dashboard.summary.valueAtRisk)}
            loading={loading}
          />
        </InlineGrid>

        <Card padding="0">
          {dashboard.actionNeededLots.length === 0 ? (
            <EmptyState
              heading="No lots need action"
              action={{ content: "Add lot", url: "/app/lots/new" }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Lots crossing the warning threshold will show here.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: "lot", plural: "lots" }}
              itemCount={dashboard.actionNeededLots.length}
              selectable={false}
              loading={loading}
              headings={[
                { title: "Product" },
                { title: "Lot" },
                { title: "Expires" },
                { title: "Units" },
                { title: "Value at risk" },
                { title: "Actions", alignment: "end" },
              ]}
            >
              {dashboard.actionNeededLots.map((lot, index) => (
                <IndexTable.Row id={lot.id} key={lot.id} position={index}>
                  <IndexTable.Cell>
                    <BlockStack gap="050">
                      <Text as="span" fontWeight="semibold">
                        {lot.productTitle}
                      </Text>
                      <Text as="span" tone="subdued">
                        {lot.variantTitle}
                        {lot.variantSku ? ` • ${lot.variantSku}` : ""}
                      </Text>
                    </BlockStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{lot.lotNumber}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="span">{lot.expiryDate}</Text>
                      <Badge tone={lot.daysUntilExpiry < 0 ? "critical" : "warning"}>
                        {formatDaysUntilExpiry(lot.daysUntilExpiry)}
                      </Badge>
                    </InlineStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{lot.remainingQuantity}</IndexTable.Cell>
                  <IndexTable.Cell>{formatMoney(lot.valueAtRisk)}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack align="end" gap="200">
                      <Button url={`/app/lots/${lot.id}`}>Edit lot</Button>
                      <Button url={getShopifyAdminProductUrl(shopDomain, lot.shopifyProductId)} target="_blank">
                        View product
                      </Button>
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          )}
        </Card>

        {dashboard.untrackedStockSold.length === 0 ? null : (
          <Card padding="0">
            <IndexTable
              resourceName={{ singular: "untracked sale", plural: "untracked sales" }}
              itemCount={dashboard.untrackedStockSold.length}
              selectable={false}
              loading={loading}
              headings={[
                { title: "Untracked stock sold" },
                { title: "Order" },
                { title: "Quantity" },
                { title: "Logged" },
              ]}
            >
              {dashboard.untrackedStockSold.map((sale, index) => (
                <IndexTable.Row id={sale.id} key={sale.id} position={index}>
                  <IndexTable.Cell>
                    <BlockStack gap="050">
                      <Text as="span" fontWeight="semibold">
                        {sale.productTitle}
                      </Text>
                      <Text as="span" tone="subdued">
                        {sale.variantTitle}
                        {sale.variantSku ? ` • ${sale.variantSku}` : ""}
                      </Text>
                    </BlockStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{sale.orderName}</IndexTable.Cell>
                  <IndexTable.Cell>{sale.quantity}</IndexTable.Cell>
                  <IndexTable.Cell>{new Date(sale.createdAt).toLocaleString()}</IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}

function SummaryCard({
  title,
  value,
  loading,
  tone,
}: {
  title: string;
  value: number | string;
  loading: boolean;
  tone?: "critical";
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h2" tone="subdued">
          {title}
        </Text>
        {loading ? (
          <SkeletonBodyText lines={1} />
        ) : (
          <Text as="p" variant="headingXl" tone={tone}>
            {value}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}

function formatMoney(value: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

function formatDaysUntilExpiry(days: number) {
  if (days < 0) {
    return "Expired";
  }
  if (days === 0) {
    return "Today";
  }
  return `${days}d`;
}

function getShopifyAdminProductUrl(shopDomain: string, shopifyProductId: string) {
  const productId = shopifyProductId.split("/").at(-1) ?? shopifyProductId;
  const storeHandle = shopDomain.replace(".myshopify.com", "");
  return `https://admin.shopify.com/store/${storeHandle}/products/${productId}`;
}
