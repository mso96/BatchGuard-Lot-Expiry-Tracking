export type DigestEmailLot = {
  productTitle: string;
  variantTitle: string;
  variantSku: string;
  lotNumber: string;
  expiryDate: string;
  remainingQuantity: number;
};

export type DigestEmail = {
  to: string;
  shopDomain: string;
  thresholdDays: number;
  lots: DigestEmailLot[];
};

export type MailTransport = {
  sendExpiryDigest(email: DigestEmail): Promise<void>;
};

export class ConsoleMailTransport implements MailTransport {
  async sendExpiryDigest(email: DigestEmail) {
    console.info(
      JSON.stringify(
        {
          type: "batchguard.expiry_digest",
          to: email.to,
          shopDomain: email.shopDomain,
          thresholdDays: email.thresholdDays,
          lotCount: email.lots.length,
          lots: email.lots,
        },
        null,
        2,
      ),
    );
  }
}
