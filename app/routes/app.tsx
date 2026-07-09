import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Outlet, useLocation, useNavigation } from "@remix-run/react";
import {
  Frame,
  Loading,
  Navigation,
  TopBar,
} from "@shopify/polaris";
import { getBillingStatus } from "../models/billing.server";
import { getCurrentShopId } from "../shop.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith("/app/billing")) {
    return null;
  }

  const shopId = await getCurrentShopId();
  const billingStatus = await getBillingStatus(shopId);

  if (!billingStatus.hasActiveSubscription) {
    throw redirect("/app/billing");
  }

  return null;
}

export default function AppLayout() {
  const location = useLocation();
  const navigation = useNavigation();
  const loading = navigation.state !== "idle";

  return (
    <Frame
      topBar={<TopBar showNavigationToggle userMenu={undefined} />}
      navigation={
        <Navigation location={location.pathname}>
          <Navigation.Section
            items={[
              {
                label: "Dashboard",
                url: "/app",
                selected: location.pathname === "/app",
              },
              {
                label: "Lots",
                url: "/app/lots",
                selected: location.pathname.startsWith("/app/lots"),
              },
              {
                label: "Settings",
                url: "/app/settings",
                selected: location.pathname.startsWith("/app/settings"),
              },
              {
                label: "Billing",
                url: "/app/billing",
                selected: location.pathname.startsWith("/app/billing"),
              },
            ]}
          />
        </Navigation>
      }
    >
      {loading ? <Loading /> : null}
      <Outlet />
    </Frame>
  );
}
