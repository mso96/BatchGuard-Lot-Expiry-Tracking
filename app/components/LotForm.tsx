import { Form, useNavigation } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  InlineStack,
  Text,
  TextField,
} from "@shopify/polaris";
import { useState } from "react";

type LotFormValues = {
  shopifyProductId?: string;
  shopifyVariantId?: string;
  productTitle?: string;
  variantTitle?: string;
  variantSku?: string;
  variantPrice?: string;
  lotNumber?: string;
  expiryDate?: string;
  quantity?: string;
  remainingQuantity?: string;
  receivedAt?: string;
  note?: string;
};

type LotFormProps = {
  mode: "create" | "edit";
  values?: LotFormValues;
  errors?: Record<string, string>;
};

type ShopifyResourcePickerResult = Array<{
  id: string;
  title?: string;
  variants?: Array<{
    id: string;
    title?: string;
    sku?: string;
    price?: string;
  }>;
}>;

declare global {
  interface Window {
    shopify?: {
      resourcePicker?: (options: {
        type: "product" | "variant";
        multiple: boolean;
        action?: "select";
      }) => Promise<ShopifyResourcePickerResult | undefined>;
    };
  }
}

export function LotForm({ mode, values, errors = {} }: LotFormProps) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const [productId, setProductId] = useState(values?.shopifyProductId ?? "");
  const [variantId, setVariantId] = useState(values?.shopifyVariantId ?? "");
  const [productTitle, setProductTitle] = useState(values?.productTitle ?? "");
  const [variantTitle, setVariantTitle] = useState(values?.variantTitle ?? "");
  const [variantSku, setVariantSku] = useState(values?.variantSku ?? "");
  const [variantPrice, setVariantPrice] = useState(values?.variantPrice ?? "");
  const [lotNumber, setLotNumber] = useState(values?.lotNumber ?? "");
  const [expiryDate, setExpiryDate] = useState(values?.expiryDate ?? "");
  const [quantity, setQuantity] = useState(values?.quantity ?? "");
  const [remainingQuantity, setRemainingQuantity] = useState(values?.remainingQuantity ?? "");
  const [receivedAt, setReceivedAt] = useState(values?.receivedAt ?? "");
  const [note, setNote] = useState(values?.note ?? "");
  const [pickerMessage, setPickerMessage] = useState<string | undefined>();

  async function pickProductVariant() {
    if (!window.shopify?.resourcePicker) {
      setPickerMessage("Resource picker is available inside the embedded Shopify app. Use the fields below for local review.");
      return;
    }

    const selection = await window.shopify.resourcePicker({
      type: "product",
      multiple: false,
      action: "select",
    });
    const product = selection?.[0];
    const variant = product?.variants?.[0];

    if (!product || !variant) {
      return;
    }

    setProductId(product.id);
    setVariantId(variant.id);
    setProductTitle(product.title ?? "");
    setVariantTitle(variant.title ?? "");
    setVariantSku(variant.sku ?? "");
    setVariantPrice(variant.price ?? "");
    setPickerMessage(undefined);
  }

  return (
    <Form method="post">
      <BlockStack gap="400">
        {pickerMessage ? (
          <Banner tone="info">
            <Text as="p">{pickerMessage}</Text>
          </Banner>
        ) : null}

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Product variant
              </Text>
              {mode === "create" ? (
                <Button onClick={pickProductVariant}>Pick product</Button>
              ) : null}
            </InlineStack>

            <FormLayout>
              <TextField
                label="Shopify product ID"
                name="shopifyProductId"
                value={productId}
                onChange={setProductId}
                error={errors.shopifyProductId}
                autoComplete="off"
                disabled={mode === "edit"}
              />
              <TextField
                label="Shopify variant ID"
                name="shopifyVariantId"
                value={variantId}
                onChange={setVariantId}
                error={errors.shopifyVariantId}
                autoComplete="off"
                disabled={mode === "edit"}
              />
              <TextField
                label="Product name"
                name="productTitle"
                value={productTitle}
                onChange={setProductTitle}
                autoComplete="off"
                disabled={mode === "edit"}
              />
              <TextField
                label="Variant"
                name="variantTitle"
                value={variantTitle}
                onChange={setVariantTitle}
                autoComplete="off"
                disabled={mode === "edit"}
              />
              <TextField
                label="SKU"
                name="variantSku"
                value={variantSku}
                onChange={setVariantSku}
                autoComplete="off"
                disabled={mode === "edit"}
              />
              <TextField
                label="Variant price"
                name="variantPrice"
                value={variantPrice}
                onChange={setVariantPrice}
                type="number"
                min={0}
                step={0.01}
                autoComplete="off"
                disabled={mode === "edit"}
              />
            </FormLayout>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Lot details
            </Text>
            <FormLayout>
              <TextField
                label="Lot number"
                name="lotNumber"
                value={lotNumber}
                onChange={setLotNumber}
                error={errors.lotNumber}
                autoComplete="off"
              />
              <TextField
                label="Expiry date"
                name="expiryDate"
                value={expiryDate}
                onChange={setExpiryDate}
                error={errors.expiryDate}
                type="date"
                autoComplete="off"
              />
              {mode === "create" ? (
                <TextField
                  label="Quantity received"
                  name="quantity"
                  value={quantity}
                  onChange={setQuantity}
                  error={errors.quantity}
                  type="number"
                  min={0}
                  step={1}
                  autoComplete="off"
                />
              ) : (
                <TextField
                  label="Remaining quantity"
                  name="remainingQuantity"
                  value={remainingQuantity}
                  onChange={setRemainingQuantity}
                  error={errors.remainingQuantity}
                  type="number"
                  min={0}
                  step={1}
                  autoComplete="off"
                />
              )}
              {mode === "create" ? (
                <TextField
                  label="Received date"
                  name="receivedAt"
                  value={receivedAt}
                  onChange={setReceivedAt}
                  type="date"
                  autoComplete="off"
                />
              ) : null}
              <TextField
                label="Note"
                name="note"
                value={note}
                onChange={setNote}
                multiline={4}
                autoComplete="off"
              />
            </FormLayout>
          </BlockStack>
        </Card>

        <InlineStack align="end" gap="300">
          <Button url="/app/lots">Cancel</Button>
          <Button variant="primary" submit loading={submitting}>
            {mode === "create" ? "Add lot" : "Save lot"}
          </Button>
        </InlineStack>
      </BlockStack>
    </Form>
  );
}
