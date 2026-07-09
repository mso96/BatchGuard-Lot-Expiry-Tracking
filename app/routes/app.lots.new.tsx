import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { readOptionalString, readPositiveInteger, readRequiredString } from "../form.server";
import { LotForm } from "../components/LotForm";
import { createLot } from "../models/lot.server";
import { getCurrentShopId } from "../shop.server";

export async function action({ request }: ActionFunctionArgs) {
  const shopId = await getCurrentShopId();
  const formData = await request.formData();
  const errors: Record<string, string> = {};
  const shopifyProductId = readRequiredString(formData, "shopifyProductId", errors);
  const shopifyVariantId = readRequiredString(formData, "shopifyVariantId", errors);
  const lotNumber = readRequiredString(formData, "lotNumber", errors);
  const expiryDate = readRequiredString(formData, "expiryDate", errors);
  const quantity = readPositiveInteger(formData, "quantity", errors);

  if (quantity === 0) {
    errors.quantity = "Quantity must be greater than zero";
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  await createLot({
    shopId,
    shopifyProductId,
    shopifyVariantId,
    productTitle: readOptionalString(formData, "productTitle"),
    variantTitle: readOptionalString(formData, "variantTitle"),
    variantSku: readOptionalString(formData, "variantSku"),
    variantPrice: readOptionalString(formData, "variantPrice"),
    lotNumber,
    expiryDate,
    quantity,
    receivedAt: readOptionalString(formData, "receivedAt"),
    note: readOptionalString(formData, "note"),
  });

  return redirect("/app/lots");
}

export default function NewLot() {
  const actionData = useActionData<typeof action>();

  return (
    <Page title="Add lot" backAction={{ content: "Lots", url: "/app/lots" }}>
      <LotForm mode="create" errors={actionData?.errors} />
    </Page>
  );
}
