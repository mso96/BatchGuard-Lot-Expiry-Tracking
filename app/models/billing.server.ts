import { Prisma, type AppSubscription, type PrismaClient } from "@prisma/client";
import { prisma } from "../db.server";

export const batchGuardPlan = {
  name: "BatchGuard Monthly",
  amount: "49.00",
  currencyCode: "USD",
  trialDays: 14,
};

const activeSubscriptionStatuses = ["ACTIVE", "ACCEPTED"] as const;

export type BillingStatus = {
  hasActiveSubscription: boolean;
  testMode: boolean;
  subscription?: AppSubscription;
};

export function isBillingTestMode() {
  return process.env.BATCHGUARD_BILLING_TEST_MODE === "true";
}

export async function getBillingStatus(
  shopId: string,
  database: PrismaClient = prisma,
): Promise<BillingStatus> {
  if (isBillingTestMode()) {
    return {
      hasActiveSubscription: true,
      testMode: true,
    };
  }

  const subscription = await database.appSubscription.findFirst({
    where: {
      shopId,
      status: { in: [...activeSubscriptionStatuses] },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    hasActiveSubscription: subscription !== null,
    testMode: false,
    subscription: subscription ?? undefined,
  };
}

export async function createLocalTestSubscription(shopId: string, database: PrismaClient = prisma) {
  return database.appSubscription.upsert({
    where: { shopifySubscriptionId: `local-test-${shopId}` },
    update: {
      status: "ACTIVE",
      test: true,
      planName: batchGuardPlan.name,
      priceAmount: new Prisma.Decimal(batchGuardPlan.amount),
      priceCurrencyCode: batchGuardPlan.currencyCode,
      trialDays: batchGuardPlan.trialDays,
    },
    create: {
      shopId,
      shopifySubscriptionId: `local-test-${shopId}`,
      status: "ACTIVE",
      test: true,
      planName: batchGuardPlan.name,
      priceAmount: new Prisma.Decimal(batchGuardPlan.amount),
      priceCurrencyCode: batchGuardPlan.currencyCode,
      trialDays: batchGuardPlan.trialDays,
    },
  });
}

export function buildAppSubscriptionCreateMutation({
  appUrl,
  test,
}: {
  appUrl: string;
  test: boolean;
}) {
  return {
    query: `#graphql
      mutation BatchGuardCreateSubscription($name: String!, $returnUrl: URL!, $test: Boolean!, $trialDays: Int!, $lineItems: [AppSubscriptionLineItemInput!]!) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          test: $test
          trialDays: $trialDays
          lineItems: $lineItems
        ) {
          confirmationUrl
          appSubscription {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
    variables: {
      name: batchGuardPlan.name,
      returnUrl: `${appUrl.replace(/\/$/, "")}/app/billing/return`,
      test,
      trialDays: batchGuardPlan.trialDays,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: Number(batchGuardPlan.amount),
                currencyCode: batchGuardPlan.currencyCode,
              },
            },
          },
        },
      ],
    },
  };
}
