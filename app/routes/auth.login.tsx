import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useEffect, useState } from "react";
import { Page, Spinner, Text } from "@shopify/polaris";
import { login } from "../shopify.server";

type SessionTokenPayload = {
  dest?: string;
};

type ShopifyBridgeWithIdToken = Window["shopify"] & {
  idToken?: () => Promise<string>;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const shop = new URL(request.url).searchParams.get("shop");

  if (!shop) {
    // Shopify can open an embedded app at its configured URL without legacy
    // query parameters. Let App Bridge obtain an ID token in the iframe.
    return json({ bootstrap: true });
  }

  const errors = await login(request);
  return json({ bootstrap: false, errors }, { status: 400 });
}

export async function action({ request }: ActionFunctionArgs) {
  const errors = await login(request);
  return json(errors, { status: 400 });
}

export default function EmbeddedLoginBootstrap() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const start = async () => {
      const getIdToken = (window.shopify as ShopifyBridgeWithIdToken | undefined)?.idToken;
      if (!getIdToken) {
        attempts += 1;
        if (attempts < 40 && !cancelled) {
          window.setTimeout(start, 150);
        } else if (!cancelled) {
          setError("Shopify session could not be initialized. Reload this app from Shopify Admin.");
        }
        return;
      }

      try {
        const idToken = await getIdToken();
        const payload = decodeSessionToken(idToken);
        const shop = getShopDomain(payload.dest);

        if (!shop) {
          throw new Error("The Shopify session token did not include a valid shop.");
        }

        const params = new URLSearchParams({
          embedded: "1",
          host: window.btoa(`admin.shopify.com/store/${shop.replace(".myshopify.com", "")}`),
          id_token: idToken,
          shop,
        });

        window.location.replace(`/app?${params.toString()}`);
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to initialize Shopify session.");
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Page title="BatchGuard">
      {error ? (
        <Text as="p" tone="critical">
          {error}
        </Text>
      ) : (
        <Spinner accessibilityLabel="Opening BatchGuard" size="large" />
      )}
    </Page>
  );
}

function decodeSessionToken(token: string): SessionTokenPayload {
  const payload = token.split(".")[1];
  if (!payload) {
    throw new Error("Invalid Shopify session token.");
  }

  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(window.atob(base64)) as SessionTokenPayload;
}

function getShopDomain(destination: string | undefined) {
  if (!destination) {
    return null;
  }

  try {
    const shop = new URL(destination).hostname;
    return shop.endsWith(".myshopify.com") ? shop : null;
  } catch {
    return null;
  }
}
