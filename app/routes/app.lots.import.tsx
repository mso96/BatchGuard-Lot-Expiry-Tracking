import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  IndexTable,
  InlineStack,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { useState } from "react";
import { useEffect } from "react";
import {
  commitLotCsvImport,
  previewLotCsvImport,
  type CsvImportPreview,
} from "../models/csv-import.server";
import { getCurrentShopId } from "../shop.server";

type ActionData =
  | {
      mode: "preview";
      csvText: string;
      preview: CsvImportPreview;
      message?: string;
    }
  | {
      mode: "error";
      csvText: string;
      message: string;
    };

const sampleCsv = `variant sku or id,lot number,expiry date,quantity
ELD-SYR-12,ELD-AUG-26,2026-08-31,24
gid://shopify/ProductVariant/2000000004,ALM-OCT-26,2026-10-15,36`;

export async function action({ request }: ActionFunctionArgs) {
  const shopId = await getCurrentShopId();
  const formData = await request.formData();
  const intent = formData.get("intent");
  const csvText = await readCsvText(formData);

  if (!csvText.trim()) {
    return json<ActionData>(
      {
        mode: "error",
        csvText,
        message: "Paste CSV content or choose a CSV file.",
      },
      { status: 400 },
    );
  }

  if (intent === "commit") {
    const preview = await previewLotCsvImport(shopId, csvText);
    if (preview.errorCount > 0) {
      return json<ActionData>(
        {
          mode: "preview",
          csvText,
          preview,
          message: "Fix failed rows before importing.",
        },
        { status: 400 },
      );
    }

    await commitLotCsvImport(shopId, csvText);
    return redirect("/app/lots");
  }

  const preview = await previewLotCsvImport(shopId, csvText);
  return json<ActionData>({ mode: "preview", csvText, preview });
}

export default function ImportLots() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const [csvText, setCsvText] = useState(actionData?.csvText ?? sampleCsv);
  const preview = actionData?.mode === "preview" ? actionData.preview : undefined;
  const previewCsvText = actionData?.mode === "preview" ? actionData.csvText : csvText;

  useEffect(() => {
    if (actionData?.csvText) {
      setCsvText(actionData.csvText);
    }
  }, [actionData?.csvText]);

  return (
    <Page title="Import lots" backAction={{ content: "Lots", url: "/app/lots" }}>
      <BlockStack gap="400">
        {actionData?.message ? (
          <Banner tone={actionData.mode === "error" ? "critical" : "warning"}>
            <Text as="p">{actionData.message}</Text>
          </Banner>
        ) : null}

        <Card>
          <Form method="post" encType="multipart/form-data">
            <BlockStack gap="400">
              <Text as="p" tone="subdued">
                Required columns: variant SKU or ID, lot number, expiry date, quantity.
              </Text>
              <input type="file" name="csvFile" accept=".csv,text/csv" />
              <TextField
                label="CSV content"
                name="csvText"
                value={csvText}
                onChange={setCsvText}
                multiline={8}
                autoComplete="off"
              />
              <InlineStack align="end" gap="300">
                <Button url="/app/lots">Cancel</Button>
                <input type="hidden" name="intent" value="preview" />
                <Button submit loading={submitting}>
                  Dry-run preview
                </Button>
              </InlineStack>
            </BlockStack>
          </Form>
        </Card>

        {preview ? (
          <Card padding="0">
            <BlockStack gap="0">
              <InlineStack align="space-between" blockAlign="center">
                <Box padding="400">
                  <Text as="h2" variant="headingMd">
                    Preview
                  </Text>
                  <Text as="p" tone="subdued">
                    {preview.validCount} ready, {preview.errorCount} need fixes
                  </Text>
                </Box>
                <Box padding="400">
                  <Form method="post">
                    <input type="hidden" name="intent" value="commit" />
                    <input type="hidden" name="csvText" value={previewCsvText} />
                    <Button
                      submit
                      variant="primary"
                      disabled={preview.errorCount > 0 || preview.validCount === 0}
                      loading={submitting}
                    >
                      Import valid rows
                    </Button>
                  </Form>
                </Box>
              </InlineStack>

              <IndexTable
                resourceName={{ singular: "CSV row", plural: "CSV rows" }}
                itemCount={preview.rows.length}
                selectable={false}
                headings={[
                  { title: "Row" },
                  { title: "Variant" },
                  { title: "Lot" },
                  { title: "Expiry" },
                  { title: "Qty" },
                  { title: "Status" },
                ]}
              >
                {preview.rows.map((row, index) => (
                  <IndexTable.Row
                    id={`row-${row.rowNumber}`}
                    key={row.rowNumber}
                    position={index}
                  >
                    <IndexTable.Cell>{row.rowNumber}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text as="span">{row.variantReference || "-"}</Text>
                        {row.productTitle ? (
                          <Text as="span" tone="subdued">
                            {row.productTitle}
                            {row.variantSku ? ` • ${row.variantSku}` : ""}
                          </Text>
                        ) : null}
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{row.lotNumber || "-"}</IndexTable.Cell>
                    <IndexTable.Cell>{row.expiryDate || "-"}</IndexTable.Cell>
                    <IndexTable.Cell>{row.quantity || "-"}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <BlockStack gap="100">
                        <Badge tone={row.status === "valid" ? "success" : "critical"}>
                          {row.status === "valid" ? "Ready" : "Failed"}
                        </Badge>
                        {row.errors.length > 0 ? (
                          <Text as="span" tone="critical">
                            {row.errors.join("; ")}
                          </Text>
                        ) : null}
                      </BlockStack>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </BlockStack>
          </Card>
        ) : null}
      </BlockStack>
    </Page>
  );
}

async function readCsvText(formData: FormData) {
  const csvFile = formData.get("csvFile");
  if (isFileLike(csvFile) && csvFile.size > 0) {
    return csvFile.text();
  }

  const csvText = formData.get("csvText");
  return typeof csvText === "string" ? csvText : "";
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "size" in value &&
    "text" in value &&
    typeof value.text === "function"
  );
}
