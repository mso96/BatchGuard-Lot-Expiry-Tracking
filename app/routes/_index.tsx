import { redirect } from "@remix-run/node";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  return redirect(`/app${url.search}`);
}
