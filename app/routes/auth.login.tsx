import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { login } from "../shopify.server";

function hasShopParam(request: Request) {
  const url = new URL(request.url);
  return Boolean(url.searchParams.get("shop"));
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!hasShopParam(request)) {
    return json({ shop: "MISSING_SHOP" }, { status: 400 });
  }

  const errors = await login(request);
  return json(errors, { status: 400 });
}

export async function action({ request }: ActionFunctionArgs) {
  const errors = await login(request);
  return json(errors, { status: 400 });
}
