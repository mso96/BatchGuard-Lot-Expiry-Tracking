import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../db.server";

export type CsvImportRowStatus = "valid" | "error";

export type CsvImportPreviewRow = {
  rowNumber: number;
  variantReference: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  productTitle?: string;
  variantTitle?: string;
  variantSku?: string;
  status: CsvImportRowStatus;
  errors: string[];
};

export type CsvImportPreview = {
  rows: CsvImportPreviewRow[];
  validCount: number;
  errorCount: number;
};

export type CsvImportCommitResult = {
  createdCount: number;
  skippedCount: number;
};

type ParsedCsvRow = {
  rowNumber: number;
  variantReference: string;
  lotNumber: string;
  expiryDate: string;
  quantityText: string;
};

type VariantLookup = {
  shopifyProductId: string;
  shopifyVariantId: string;
  productTitle?: string | null;
  variantTitle?: string | null;
  variantSku?: string | null;
  variantPrice?: Prisma.Decimal | null;
};

type VariantResolver = (variantReference: string) => Promise<VariantLookup | undefined>;
type DuplicateLotChecker = (
  shopifyVariantId: string,
  lotNumber: string,
) => Promise<boolean> | boolean;

const requiredColumns = ["variant sku or id", "lot number", "expiry date", "quantity"] as const;

export async function previewLotCsvImport(
  shopId: string,
  csvText: string,
  database: PrismaClient = prisma,
): Promise<CsvImportPreview> {
  const resolver = createVariantResolver(shopId, database);
  const duplicateChecker: DuplicateLotChecker = async (shopifyVariantId, lotNumber) => {
    const existingLot = await database.lot.findUnique({
      where: {
        shopId_shopifyVariantId_lotNumber: {
          shopId,
          shopifyVariantId,
          lotNumber,
        },
      },
    });
    return existingLot !== null;
  };
  return previewLotCsvImportWithResolver(csvText, resolver, duplicateChecker);
}

export async function previewLotCsvImportWithResolver(
  csvText: string,
  resolveVariant: VariantResolver,
  isDuplicateLot: DuplicateLotChecker = () => false,
): Promise<CsvImportPreview> {
  const parsedRows = parseLotCsvRows(csvText);
  const rows: CsvImportPreviewRow[] = [];
  const seenLots = new Set<string>();

  for (const row of parsedRows.rows) {
    const errors = [...row.errors];
    const quantity = parseQuantity(row.quantityText, errors);
    validateDate(row.expiryDate, errors);
    let variant: VariantLookup | undefined;

    if (row.variantReference) {
      variant = await resolveVariant(row.variantReference);
      if (!variant) {
        errors.push("Variant SKU or ID was not found");
      }
    }

    if (variant && row.lotNumber) {
      const lotKey = `${variant.shopifyVariantId}:${row.lotNumber}`;
      if (seenLots.has(lotKey)) {
        errors.push("Duplicate lot in CSV");
      } else {
        seenLots.add(lotKey);
      }

      if (await isDuplicateLot(variant.shopifyVariantId, row.lotNumber)) {
        errors.push("Lot already exists for this variant");
      }
    }

    rows.push({
      rowNumber: row.rowNumber,
      variantReference: row.variantReference,
      lotNumber: row.lotNumber,
      expiryDate: row.expiryDate,
      quantity,
      productTitle: variant?.productTitle ?? undefined,
      variantTitle: variant?.variantTitle ?? undefined,
      variantSku: variant?.variantSku ?? undefined,
      status: errors.length === 0 ? "valid" : "error",
      errors,
    });
  }

  if (parsedRows.headerErrors.length > 0) {
    return {
      rows: [
        {
          rowNumber: 1,
          variantReference: "",
          lotNumber: "",
          expiryDate: "",
          quantity: 0,
          status: "error",
          errors: parsedRows.headerErrors,
        },
      ],
      validCount: 0,
      errorCount: 1,
    };
  }

  return {
    rows,
    validCount: rows.filter((row) => row.status === "valid").length,
    errorCount: rows.filter((row) => row.status === "error").length,
  };
}

export async function commitLotCsvImport(
  shopId: string,
  csvText: string,
  database: PrismaClient = prisma,
): Promise<CsvImportCommitResult> {
  const resolver = createVariantResolver(shopId, database);
  const preview = await previewLotCsvImport(shopId, csvText, database);
  const validRows = preview.rows.filter((row) => row.status === "valid");

  if (preview.errorCount > 0) {
    return {
      createdCount: 0,
      skippedCount: preview.rows.length,
    };
  }

  let createdCount = 0;

  await database.$transaction(async (tx) => {
    for (const row of validRows) {
      const variant = await resolver(row.variantReference);
      if (!variant) {
        continue;
      }

      const existingLot = await tx.lot.findUnique({
        where: {
          shopId_shopifyVariantId_lotNumber: {
            shopId,
            shopifyVariantId: variant.shopifyVariantId,
            lotNumber: row.lotNumber,
          },
        },
      });

      if (existingLot) {
        continue;
      }

      const createdLot = await tx.lot.create({
        data: {
          shopId,
          shopifyProductId: variant.shopifyProductId,
          shopifyVariantId: variant.shopifyVariantId,
          productTitle: variant.productTitle,
          variantTitle: variant.variantTitle,
          variantSku: variant.variantSku,
          variantPrice: variant.variantPrice,
          lotNumber: row.lotNumber,
          expiryDate: parseDate(row.expiryDate),
          initialQuantity: row.quantity,
          remainingQuantity: row.quantity,
          receivedAt: new Date(),
          status: "ACTIVE",
        },
      });

      await tx.lotEvent.create({
        data: {
          lotId: createdLot.id,
          type: "CREATED",
          quantityDelta: row.quantity,
        },
      });

      createdCount += 1;
    }
  });

  return {
    createdCount,
    skippedCount: validRows.length - createdCount,
  };
}

function createVariantResolver(shopId: string, database: PrismaClient): VariantResolver {
  return async (variantReference: string) => {
    const normalizedVariantId = normalizeVariantReference(variantReference);
    const variantLot = await database.lot.findFirst({
      where: {
        shopId,
        OR: [
          { shopifyVariantId: normalizedVariantId },
          { variantSku: { equals: variantReference } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!variantLot) {
      return undefined;
    }

    return {
      shopifyProductId: variantLot.shopifyProductId,
      shopifyVariantId: variantLot.shopifyVariantId,
      productTitle: variantLot.productTitle,
      variantTitle: variantLot.variantTitle,
      variantSku: variantLot.variantSku,
      variantPrice: variantLot.variantPrice,
    };
  };
}

function parseLotCsvRows(csvText: string) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return {
      headerErrors: ["CSV file is empty"],
      rows: [] as Array<ParsedCsvRow & { errors: string[] }>,
    };
  }

  const headers = rows[0]?.map(normalizeHeader) ?? [];
  const columnIndexes = new Map(headers.map((header, index) => [header, index]));
  const missingColumns = requiredColumns.filter((column) => !columnIndexes.has(column));

  if (missingColumns.length > 0) {
    return {
      headerErrors: [`Missing required columns: ${missingColumns.join(", ")}`],
      rows: [] as Array<ParsedCsvRow & { errors: string[] }>,
    };
  }

  return {
    headerErrors: [],
    rows: rows.slice(1).map((row, index) => {
      const parsedRow = {
        rowNumber: index + 2,
        variantReference: getColumn(row, columnIndexes, "variant sku or id"),
        lotNumber: getColumn(row, columnIndexes, "lot number"),
        expiryDate: getColumn(row, columnIndexes, "expiry date"),
        quantityText: getColumn(row, columnIndexes, "quantity"),
      };
      const errors = validateRequiredFields(parsedRow);
      return { ...parsedRow, errors };
    }),
  };
}

function parseCsv(csvText: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase();
}

function getColumn(row: string[], columnIndexes: Map<string, number>, column: string) {
  const index = columnIndexes.get(column);
  return typeof index === "number" ? row[index]?.trim() ?? "" : "";
}

function validateRequiredFields(row: ParsedCsvRow) {
  const errors: string[] = [];
  if (!row.variantReference) {
    errors.push("Variant SKU or ID is required");
  }
  if (!row.lotNumber) {
    errors.push("Lot number is required");
  }
  if (!row.expiryDate) {
    errors.push("Expiry date is required");
  }
  if (!row.quantityText) {
    errors.push("Quantity is required");
  }
  return errors;
}

function parseQuantity(quantityText: string, errors: string[]) {
  const quantity = Number.parseInt(quantityText, 10);
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity.toString() !== quantityText) {
    errors.push("Quantity must be a positive whole number");
    return 0;
  }
  return quantity;
}

function validateDate(value: string, errors: string[]) {
  const date = parseDate(value);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    errors.push("Expiry date must use YYYY-MM-DD");
  }
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function normalizeVariantReference(value: string) {
  if (value.startsWith("gid://shopify/ProductVariant/")) {
    return value;
  }
  if (/^\d+$/.test(value)) {
    return `gid://shopify/ProductVariant/${value}`;
  }
  return value;
}
