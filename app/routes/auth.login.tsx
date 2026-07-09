import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { login } from "../shopify.server";

function shopFromAdminStorePath(pathname: string) {
  const match = pathname.match(/\/store\/([^/]+)/);
  const storeHandle = match?.[1];
  return storeHandle ? `${storeHandle}.myshopify.com` : null;
}

function shopFromHostParam(host: string | null) {
  if (!host) {
    return null;
  }

  try {
    return shopFromAdminStorePath(Buffer.from(host, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function requestWithInferredShop(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    return request;
  }

  const shopFromHost = shopFromHostParam(url.searchParams.get("host"));
  if (shopFromHost) {
    url.searchParams.set("shop", shopFromHost);
    return new Request(url, request);
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const shopFromReferer = shopFromAdminStorePath(new URL(referer).pathname);
      if (shopFromReferer) {
        url.searchParams.set("shop", shopFromReferer);
        return new Request(url, request);
      }
    } catch {
      return request;
    }
  }

  return request;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const errors = await login(requestWithInferredShop(request));
  return json(errors, { status: 400 });
}

export async function action({ request }: ActionFunctionArgs) {
  const errors = await login(request);
  return json(errors, { status: 400 });
}
