import { json, type ActionFunctionArgs } from "@remix-run/node";
import { noCustomerPiiStoredResponse } from "../models/gdpr.server";

export async function action({ request }: ActionFunctionArgs) {
  // TODO: Replace with Shopify template `authenticate.webhook(request)` verification.
  await request.text();
  return json(noCustomerPiiStoredResponse());
}

export async function loader() {
  return json({ ok: false }, { status: 405 });
}
