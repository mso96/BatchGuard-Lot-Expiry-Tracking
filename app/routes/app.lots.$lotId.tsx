import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  BlockStack,
  Button,
  Card,
  InlineStack,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { useState } from "react";
import { readOptionalString, readPositiveInteger, readRequiredString } from "../form.server";
import { adjustLotQuantity, discardLot, getLotForEdit, updateLot } from "../models/lot.server";
import { LotForm } from "../components/LotForm";
import { getCurrentShopId } from "../shop.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const shopId = await getCurrentShopId();
  const lotId = params.lotId;

  if (!lotId) {
    throw new Response("Missing lot ID", { status: 400 });
  }

  const lot = await getLotForEdit(shopId, lotId);
  if (!lot) {
    throw new Response("Lot not found", { status: 404 });
  }

  return json({
    lot: {
      id: lot.id,
      shopifyProductId: lot.shopifyProductId,
      shopifyVariantId: lot.shopifyVariantId,
      productTitle: lot.productTitle ?? "",
      variantTitle: lot.variantTitle ?? "",
      variantSku: lot.variantSku ?? "",
      variantPrice: lot.variantPrice?.toString() ?? "",
      lotNumber: lot.lotNumber,
      expiryDate: lot.expiryDate.toISOString().slice(0, 10),
      initialQuantity: lot.initialQuantity.toString(),
      remainingQuantity: lot.remainingQuantity.toString(),
      note: lot.note ?? "",
      status: lot.status,
      events: lot.events.map((event) => ({
        id: event.id,
        type: event.type,
        quantityDelta: event.quantityDelta,
        orderId: event.orderId,
        createdAt: event.createdAt.toISOString(),
      })),
    },
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const shopId = await getCurrentShopId();
  const lotId = params.lotId;

  if (!lotId) {
    throw new Response("Missing lot ID", { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "discard") {
    await discardLot(shopId, lotId);
    return redirect("/app/lots");
  }

  if (intent === "adjust") {
    const errors: Record<string, string> = {};
    const newRemainingQuantity = readPositiveInteger(formData, "newRemainingQuantity", errors);

    if (Object.keys(errors).length > 0) {
      return json({ errors }, { status: 400 });
    }

    await adjustLotQuantity({ shopId, lotId, newRemainingQuantity });
    return redirect(`/app/lots/${lotId}`);
  }

  const errors: Record<string, string> = {};
  const lotNumber = readRequiredString(formData, "lotNumber", errors);
  const expiryDate = readRequiredString(formData, "expiryDate", errors);
  const remainingQuantity = readPositiveInteger(formData, "remainingQuantity", errors);

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  await updateLot({
    shopId,
    lotId,
    lotNumber,
    expiryDate,
    remainingQuantity,
    note: readOptionalString(formData, "note"),
  });

  return redirect("/app/lots");
}

export default function EditLot() {
  const { lot } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const [newRemainingQuantity, setNewRemainingQuantity] = useState(lot.remainingQuantity);

  return (
    <Page title={`Edit ${lot.lotNumber}`} backAction={{ content: "Lots", url: "/app/lots" }}>
      <BlockStack gap="400">
        <LotForm mode="edit" values={lot} errors={actionData?.errors} />

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Quick adjustment
            </Text>
            <Form method="post">
              <input type="hidden" name="intent" value="adjust" />
              <InlineStack gap="300" blockAlign="end">
                <TextField
                  label="Set remaining quantity"
                  name="newRemainingQuantity"
                  type="number"
                  min={0}
                  step={1}
                  value={newRemainingQuantity}
                  onChange={setNewRemainingQuantity}
                  autoComplete="off"
                />
                <Button submit loading={submitting}>
                  Adjust
                </Button>
              </InlineStack>
            </Form>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Audit trail
              </Text>
              <Form method="post">
                <input type="hidden" name="intent" value="discard" />
                <Button submit tone="critical" disabled={lot.status === "DISCARDED"}>
                  Mark discarded
                </Button>
              </Form>
            </InlineStack>

            {lot.events.length === 0 ? (
              <Text as="p" tone="subdued">
                No events yet.
              </Text>
            ) : (
              <BlockStack gap="200">
                {lot.events.map((event) => (
                  <InlineStack key={event.id} align="space-between">
                    <Text as="span">
                      {event.type} {event.quantityDelta > 0 ? "+" : ""}
                      {event.quantityDelta}
                    </Text>
                    <Text as="span" tone="subdued">
                      {new Date(event.createdAt).toLocaleString()}
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
