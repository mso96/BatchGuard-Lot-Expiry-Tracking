import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { login } from "../shopify.server";

function requestWithInferredShop(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    return request;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
    const refererUrl = new URL(referer);
    const match = refererUrl.pathname.match(/\/store\/([^/]+)/);
    const storeHandle = match?.[1];
      if (storeHandle) {
        url.searchParams.set("shop", `${storeHandle}.myshopify.com`);
        return new Request(url, request);
      }
    } catch {
      // Fall back below.
    }
  }

  const fallbackShop = process.env.SHOPIFY_FALLBACK_SHOP;
  if (fallbackShop) {
    url.searchParams.set("shop", fallbackShop);
    return new Request(url, request);
  }

  return request;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const nextRequest = requestWithInferredShop(request);
  const errors = await login(nextRequest);
  if (Object.keys(errors).length === 0) {
    return new Response("Open BatchGuard from Shopify Admin Apps.", {
      headers: { "content-type": "text/plain" },
    });
  }

  return json(errors);
}

export async function action({ request }: ActionFunctionArgs) {
  const errors = await login(requestWithInferredShop(request));
  return json(errors);
}
