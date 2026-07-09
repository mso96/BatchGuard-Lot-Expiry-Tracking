import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
  useLoaderData,
} from "@remix-run/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-remix/react";
import { Page, Text } from "@shopify/polaris";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  return json({
    apiKey:
      process.env.SHOPIFY_API_KEY ??
      process.env.SHOPIFY_CLIENT_ID ??
      "df413c77e6ed80c6b0115f1d00a9e73e",
    host: url.searchParams.get("host"),
  });
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ShopifyAppProvider apiKey={apiKey} isEmbeddedApp>
          {children}
        </ShopifyAppProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Something went wrong";

  return (
    <Page title="BatchGuard">
      <Text as="p" tone="critical">
        {message}
      </Text>
    </Page>
  );
}
