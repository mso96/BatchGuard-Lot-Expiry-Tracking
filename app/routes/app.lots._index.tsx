import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Button,
  ButtonGroup,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { useCallback } from "react";
import { discardLot, isLotStatus, listLots } from "../models/lot.server";
import { getCurrentShopId } from "../shop.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const shopId = await getCurrentShopId();
  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status") ?? "ALL";
  const status = rawStatus === "ALL" || isLotStatus(rawStatus) ? rawStatus : "ALL";
  const sort = url.searchParams.get("sort") === "expiry_desc" ? "expiry_desc" : "expiry_asc";
  const query = url.searchParams.get("q") ?? "";
  const lots = await listLots({ shopId, status, query, sort });

  return json({
    filters: { status, sort, query },
    lots: lots.map((lot) => ({
      id: lot.id,
      productTitle: lot.productTitle ?? "Untitled product",
      variantTitle: lot.variantTitle ?? "Default variant",
      variantSku: lot.variantSku ?? "",
      lotNumber: lot.lotNumber,
      expiryDate: lot.expiryDate.toISOString().slice(0, 10),
      initialQuantity: lot.initialQuantity,
      remainingQuantity: lot.remainingQuantity,
      status: lot.status,
      variantPrice: lot.variantPrice?.toString() ?? "",
    })),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const shopId = await getCurrentShopId();
  const formData = await request.formData();
  const intent = formData.get("intent");
  const lotId = formData.get("lotId");

  if (intent === "discard" && typeof lotId === "string") {
    await discardLot(shopId, lotId);
  }

  return redirect("/app/lots");
}

export default function LotsIndex() {
  const { lots, filters } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const loading = navigation.state !== "idle";

  const updateFilter = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams();
      params.set("q", name === "q" ? value : filters.query);
      params.set("status", name === "status" ? value : filters.status);
      params.set("sort", name === "sort" ? value : filters.sort);
      submit(params, { method: "get", action: "/app/lots" });
    },
    [filters, submit],
  );

  return (
    <Page
      title="Lots"
      primaryAction={{
        content: "Add lot",
        url: "/app/lots/new",
      }}
      secondaryActions={[{ content: "Import CSV", url: "/app/lots/import" }]}
    >
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="300" blockAlign="end" wrap>
              <TextField
                label="Search"
                value={filters.query}
                onChange={(value) => updateFilter("q", value)}
                placeholder="Product, SKU, or lot number"
                autoComplete="off"
              />
              <Select
                label="Status"
                options={[
                  { label: "All", value: "ALL" },
                  { label: "Active", value: "ACTIVE" },
                  { label: "Depleted", value: "DEPLETED" },
                  { label: "Expired", value: "EXPIRED" },
                  { label: "Discarded", value: "DISCARDED" },
                ]}
                value={filters.status}
                onChange={(value) => updateFilter("status", value)}
              />
              <Select
                label="Sort"
                options={[
                  { label: "Soonest expiry", value: "expiry_asc" },
                  { label: "Latest expiry", value: "expiry_desc" },
                ]}
                value={filters.sort}
                onChange={(value) => updateFilter("sort", value)}
              />
            </InlineStack>
          </BlockStack>
        </Card>

        <Card padding="0">
          {lots.length === 0 ? (
            <EmptyState
              heading="No lots found"
              action={{ content: "Add lot", url: "/app/lots/new" }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Create your first tracked lot, or change the filters to see more stock.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: "lot", plural: "lots" }}
              itemCount={lots.length}
              selectable={false}
              loading={loading}
              headings={[
                { title: "Product" },
                { title: "Lot" },
                { title: "Expiry" },
                { title: "Remaining" },
                { title: "Status" },
                { title: "Actions", alignment: "end" },
              ]}
            >
              {lots.map((lot, index) => (
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
                  <IndexTable.Cell>{lot.expiryDate}</IndexTable.Cell>
                  <IndexTable.Cell>
                    {lot.remainingQuantity} / {lot.initialQuantity}
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={getBadgeTone(lot.status)}>{lot.status}</Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack align="end">
                      <ButtonGroup>
                        <Button url={`/app/lots/${lot.id}`}>Edit</Button>
                        <Form method="post">
                          <input type="hidden" name="intent" value="discard" />
                          <input type="hidden" name="lotId" value={lot.id} />
                          <Button
                            submit
                            tone="critical"
                            disabled={lot.status === "DISCARDED"}
                          >
                            Discard
                          </Button>
                        </Form>
                      </ButtonGroup>
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          )}
        </Card>

        <Text as="p" tone="subdued">
          Product links to Shopify Admin arrive with the dashboard milestone, once authenticated Admin URLs are available.
        </Text>
      </BlockStack>
    </Page>
  );
}

function getBadgeTone(status: string) {
  if (status === "ACTIVE") {
    return "success";
  }
  if (status === "EXPIRED" || status === "DISCARDED") {
    return "critical";
  }
  return "warning";
}
