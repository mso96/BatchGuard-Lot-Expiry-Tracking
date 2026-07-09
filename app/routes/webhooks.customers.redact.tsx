import { json, type ActionFunctionArgs } from "@remix-run/node";
import { noCustomerPiiStoredResponse } from "../models/gdpr.server";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.webhook(request);
  return json(noCustomerPiiStoredResponse());
}

export async function loader() {
  return json({ ok: false }, { status: 405 });
}
