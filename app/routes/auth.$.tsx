import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { login } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const errors = await login(request);
  return json(errors);
}

export async function action({ request }: ActionFunctionArgs) {
  const errors = await login(request);
  return json(errors);
}
