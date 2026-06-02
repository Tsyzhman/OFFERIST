import {
  addDaysDate,
  createDemoProposal,
  createId,
  getTodayDate,
  normalizeProposal,
} from "./proposal";
import type {
  Proposal,
  ProposalAiInput,
  ProposalAiPackage,
  ProposalCurrency,
  ProposalLanguage,
  ProposalPackage,
} from "./types";

const aiInputKeys = new Set([
  "title",
  "clientName",
  "clientCompany",
  "preparedBy",
  "preparedByRole",
  "proposalDate",
  "validUntil",
  "version",
  "language",
  "currency",
  "shortIntro",
  "clientContext",
  "clientProblem",
  "businessGoal",
  "proposedSolutionSummary",
  "whyUs",
  "paymentTerms",
  "legalNotes",
  "nextStepText",
  "publicNotes",
  "selectedPackageCode",
  "assumptions",
  "outOfScope",
  "deliverables",
  "packages",
  "processSteps",
  "proofItems",
]);

const systemManagedKeys = new Set([
  "id",
  "shareSlug",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "lastViewedAt",
  "viewsCount",
  "expiresAt",
  "retentionHold",
  "selectedPackageId",
  "status",
  "shareSettings",
  "isPasswordProtected",
  "passwordHash",
  "internalNotes",
]);

const languageValues: ProposalLanguage[] = ["ru", "en"];
const currencyValues: ProposalCurrency[] = ["RUB", "USD", "EUR"];

export class ProposalAiValidationError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super(issues.join("; "));
    this.name = "ProposalAiValidationError";
    this.issues = issues;
  }
}

export const proposalAiInputJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Prisma proposal AI content input",
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: ["string", "null"] },
    clientName: { type: ["string", "null"] },
    clientCompany: { type: ["string", "null"] },
    preparedBy: { type: ["string", "null"] },
    preparedByRole: { type: ["string", "null"] },
    proposalDate: { type: ["string", "null"], format: "date" },
    validUntil: { type: ["string", "null"], format: "date" },
    version: { type: ["string", "null"] },
    language: { enum: ["ru", "en", null] },
    currency: { enum: ["RUB", "USD", "EUR", null] },
    shortIntro: { type: ["string", "null"] },
    clientContext: { type: ["string", "null"] },
    clientProblem: { type: ["string", "null"] },
    businessGoal: { type: ["string", "null"] },
    proposedSolutionSummary: { type: ["string", "null"] },
    whyUs: { type: ["string", "null"] },
    paymentTerms: { type: ["string", "null"] },
    legalNotes: { type: ["string", "null"] },
    nextStepText: { type: ["string", "null"] },
    publicNotes: { type: ["string", "null"] },
    selectedPackageCode: {
      type: ["string", "null"],
      pattern: "^[a-zA-Z0-9_-]+$",
    },
    assumptions: {
      type: ["array", "null"],
      items: { type: "string" },
    },
    outOfScope: {
      type: ["array", "null"],
      items: { type: "string" },
    },
    deliverables: {
      type: ["array", "null"],
      items: { $ref: "#/$defs/deliverable" },
    },
    packages: {
      type: ["array", "null"],
      items: { $ref: "#/$defs/package" },
    },
    processSteps: {
      type: ["array", "null"],
      items: { $ref: "#/$defs/processStep" },
    },
    proofItems: {
      type: ["array", "null"],
      items: { $ref: "#/$defs/proofItem" },
    },
  },
  $defs: {
    deliverable: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
        clientValue: { type: ["string", "null"] },
        sortOrder: { type: ["integer", "null"], minimum: 0 },
      },
    },
    package: {
      type: "object",
      additionalProperties: false,
      properties: {
        code: { type: ["string", "null"], pattern: "^[a-zA-Z0-9_-]+$" },
        name: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
        price: { type: ["number", "null"], minimum: 0 },
        durationLabel: { type: ["string", "null"] },
        isRecommended: { type: ["boolean", "null"] },
        features: {
          type: ["array", "null"],
          items: { type: "string" },
        },
        sortOrder: { type: ["integer", "null"], minimum: 0 },
      },
    },
    processStep: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
        durationLabel: { type: ["string", "null"] },
        sortOrder: { type: ["integer", "null"], minimum: 0 },
      },
    },
    proofItem: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
        result: { type: ["string", "null"] },
        sortOrder: { type: ["integer", "null"], minimum: 0 },
      },
    },
  },
} as const;

export function createProposalAiExample() {
  return createProposalAiInputFromProposal(createDemoProposal());
}

export function createProposalAiInputFromProposal(
  proposal: Proposal,
): ProposalAiInput {
  const packageCodes = createPackageCodeMap(proposal.packages);
  const selectedPackage =
    proposal.packages.find((item) => item.id === proposal.selectedPackageId) ??
    proposal.packages.find((item) => item.isRecommended) ??
    proposal.packages[0];

  return {
    title: proposal.title,
    clientName: proposal.clientName,
    clientCompany: proposal.clientCompany,
    preparedBy: proposal.preparedBy,
    preparedByRole: proposal.preparedByRole,
    proposalDate: proposal.proposalDate,
    validUntil: proposal.validUntil,
    version: proposal.version,
    language: proposal.language,
    currency: proposal.currency,
    shortIntro: proposal.shortIntro,
    clientContext: proposal.clientContext,
    clientProblem: proposal.clientProblem,
    businessGoal: proposal.businessGoal,
    proposedSolutionSummary: proposal.proposedSolutionSummary,
    whyUs: proposal.whyUs,
    paymentTerms: proposal.paymentTerms,
    legalNotes: proposal.legalNotes,
    nextStepText: proposal.nextStepText,
    publicNotes: proposal.publicNotes ?? "",
    selectedPackageCode: selectedPackage
      ? packageCodes.get(selectedPackage.id)
      : undefined,
    assumptions: proposal.assumptions,
    outOfScope: proposal.outOfScope,
    deliverables: proposal.deliverables.map((item, index) => ({
      title: item.title,
      description: item.description,
      clientValue: item.clientValue,
      sortOrder: index,
    })),
    packages: proposal.packages.map((item, index) => ({
      code: packageCodes.get(item.id) ?? `package-${index + 1}`,
      name: item.name,
      description: item.description,
      price: item.price,
      durationLabel: item.duration,
      isRecommended: item.isRecommended,
      features: item.features,
      sortOrder: index,
    })),
    processSteps: proposal.processSteps.map((item, index) => ({
      title: item.title,
      description: item.description,
      durationLabel: item.duration,
      sortOrder: index,
    })),
    proofItems: proposal.proofItems.map((item, index) => ({
      title: item.title,
      description: item.description,
      result: item.result,
      sortOrder: index,
    })),
  };
}

export function isProposalAiInputPayload(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  if ("content" in value) {
    return isRecord(value.content);
  }

  return !Array.from(systemManagedKeys).some((key) => key in value);
}

export function parseProposalAiInputPayload(value: unknown): ProposalAiInput {
  const result = validateProposalAiInputPayload(value);

  if (!result.ok) {
    throw new ProposalAiValidationError(result.issues);
  }

  return result.input;
}

export function validateProposalAiInputPayload(value: unknown):
  | { ok: true; input: ProposalAiInput }
  | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const input = unwrapAiInputPayload(value, issues);

  if (!input) {
    return { ok: false, issues };
  }

  validateObjectKeys(input, aiInputKeys, "content", issues);

  for (const key of systemManagedKeys) {
    if (key in input) {
      issues.push(`${key} is generated by the backend and must not be in AI input`);
    }
  }

  for (const key of [
    "title",
    "clientName",
    "clientCompany",
    "preparedBy",
    "preparedByRole",
    "proposalDate",
    "validUntil",
    "version",
    "shortIntro",
    "clientContext",
    "clientProblem",
    "businessGoal",
    "proposedSolutionSummary",
    "whyUs",
    "paymentTerms",
    "legalNotes",
    "nextStepText",
    "publicNotes",
    "selectedPackageCode",
  ]) {
    validateOptionalString(input, key, issues);
  }

  validateDate(input, "proposalDate", issues);
  validateDate(input, "validUntil", issues);
  validateEnum(input, "language", languageValues, issues);
  validateEnum(input, "currency", currencyValues, issues);
  validateStringArray(input, "assumptions", issues);
  validateStringArray(input, "outOfScope", issues);
  validateDeliverables(input, issues);
  validatePackages(input, issues);
  validateProcessSteps(input, issues);
  validateProofItems(input, issues);
  validateSelectedPackageCode(input, issues);

  return issues.length
    ? { ok: false, issues }
    : { ok: true, input: input as ProposalAiInput };
}

export function createProposalFromAiInput(
  value: unknown,
  baseProposal: Proposal,
): Proposal {
  const input = parseProposalAiInputPayload(value);
  const packageEntries = normalizePackageEntries(input.packages);
  const selectedPackageId = getSelectedPackageId(
    input.selectedPackageCode,
    packageEntries,
  );

  const proposal = normalizeProposal({
    ...baseProposal,
    title: textValue(input.title, baseProposal.title),
    clientName: textValue(input.clientName),
    clientCompany: textValue(input.clientCompany),
    preparedBy: textValue(input.preparedBy, baseProposal.preparedBy),
    preparedByRole: textValue(
      input.preparedByRole,
      baseProposal.preparedByRole,
    ),
    proposalDate: dateValue(input.proposalDate, baseProposal.proposalDate),
    validUntil: dateValue(
      input.validUntil,
      baseProposal.validUntil || addDaysDate(14),
    ),
    version: textValue(input.version, baseProposal.version || "v1.0"),
    language: input.language ?? baseProposal.language,
    currency: input.currency ?? baseProposal.currency,
    shortIntro: textValue(input.shortIntro),
    clientContext: textValue(input.clientContext),
    clientProblem: textValue(input.clientProblem),
    businessGoal: textValue(input.businessGoal),
    proposedSolutionSummary: textValue(input.proposedSolutionSummary),
    whyUs: textValue(input.whyUs),
    paymentTerms: textValue(input.paymentTerms),
    legalNotes: textValue(input.legalNotes),
    nextStepText: textValue(input.nextStepText),
    publicNotes: textValue(input.publicNotes),
    selectedPackageId,
    expiresAt: baseProposal.expiresAt || baseProposal.validUntil,
    assumptions: stringArray(input.assumptions),
    outOfScope: stringArray(input.outOfScope),
    deliverables: normalizeOrders(
      optionalArray(input.deliverables).map((item, index) => ({
        id: createId(),
        title: textValue(item.title, `Результат ${index + 1}`),
        description: textValue(item.description),
        clientValue: textValue(item.clientValue),
        sortOrder: sortOrderValue(item.sortOrder, index),
      })),
    ),
    packages: normalizeOrders(
      packageEntries.map((entry) => entry.package),
    ),
    processSteps: normalizeOrders(
      optionalArray(input.processSteps).map((item, index) => ({
        id: createId(),
        title: textValue(item.title, `Этап ${index + 1}`),
        description: textValue(item.description),
        duration: textValue(item.durationLabel),
        sortOrder: sortOrderValue(item.sortOrder, index),
      })),
    ),
    proofItems: normalizeOrders(
      optionalArray(input.proofItems).map((item, index) => ({
        id: createId(),
        title: textValue(item.title, `Аргумент ${index + 1}`),
        description: textValue(item.description),
        result: textValue(item.result),
        sortOrder: sortOrderValue(item.sortOrder, index),
      })),
    ),
  });

  proposal.shareSettings.shareSlug = proposal.shareSlug;
  proposal.shareSettings.expiresAt = proposal.expiresAt;
  return proposal;
}

export function importProposalJson(value: unknown, current: Proposal): Proposal {
  if (isProposalAiInputPayload(value)) {
    return createProposalFromAiInput(value, current);
  }

  if (!isRecord(value)) {
    throw new Error("JSON root must be an object");
  }

  const parsed = value as Partial<Proposal>;
  const packages = Array.isArray(parsed.packages)
    ? parsed.packages
    : current.packages;

  return normalizeProposal({
    ...current,
    ...parsed,
    id: current.id,
    shareSlug: current.shareSlug,
    status: current.status,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt,
    publishedAt: current.publishedAt,
    lastViewedAt: current.lastViewedAt,
    viewsCount: current.viewsCount,
    expiresAt: current.expiresAt,
    retentionHold: current.retentionHold,
    isPasswordProtected: current.isPasswordProtected,
    passwordHash: current.passwordHash,
    internalNotes: current.internalNotes,
    selectedPackageId:
      getExistingPackageId(parsed.selectedPackageId, packages) ??
      getExistingPackageId(current.selectedPackageId, packages),
    shareSettings: current.shareSettings,
  } as Proposal);
}

function unwrapAiInputPayload(
  value: unknown,
  issues: string[],
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    issues.push("AI input must be a JSON object");
    return null;
  }

  if (!("content" in value)) {
    return value;
  }

  validateObjectKeys(value, new Set(["content", "system"]), "root", issues);

  if (!isRecord(value.content)) {
    issues.push("content must be a JSON object");
    return null;
  }

  return value.content;
}

function validateObjectKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
  path: string,
  issues: string[],
) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      issues.push(`${path}.${key} is not allowed`);
    }
  }
}

function validateOptionalString(
  value: Record<string, unknown>,
  key: string,
  issues: string[],
) {
  if (!hasValue(value[key])) {
    return;
  }

  if (typeof value[key] !== "string") {
    issues.push(`${key} must be a string or null`);
  }
}

function validateDate(
  value: Record<string, unknown>,
  key: string,
  issues: string[],
) {
  if (!hasValue(value[key]) || typeof value[key] !== "string") {
    return;
  }

  if (!isDateString(value[key])) {
    issues.push(`${key} must use YYYY-MM-DD format`);
  }
}

function validateEnum<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: T[],
  issues: string[],
) {
  if (!hasValue(value[key])) {
    return;
  }

  if (!allowed.includes(value[key] as T)) {
    issues.push(`${key} must be one of: ${allowed.join(", ")}`);
  }
}

function validateStringArray(
  value: Record<string, unknown>,
  key: string,
  issues: string[],
) {
  if (!hasValue(value[key])) {
    return;
  }

  if (!Array.isArray(value[key])) {
    issues.push(`${key} must be an array of strings or null`);
    return;
  }

  value[key].forEach((item, index) => {
    if (typeof item !== "string") {
      issues.push(`${key}[${index}] must be a string`);
    }
  });
}

function validateDeliverables(
  value: Record<string, unknown>,
  issues: string[],
) {
  validateItemArray(
    value,
    "deliverables",
    new Set(["title", "description", "clientValue", "sortOrder"]),
    issues,
  );
}

function validatePackages(value: Record<string, unknown>, issues: string[]) {
  const items = validateItemArray(
    value,
    "packages",
    new Set([
      "code",
      "name",
      "description",
      "price",
      "durationLabel",
      "isRecommended",
      "features",
      "sortOrder",
    ]),
    issues,
  );

  const explicitCodes = new Set<string>();
  let recommendedCount = 0;

  items.forEach((item, index) => {
    validateOptionalString(item, "code", issues);
    validateOptionalString(item, "name", issues);
    validateOptionalString(item, "description", issues);
    validateOptionalString(item, "durationLabel", issues);
    validateStringArray(item, "features", issues);
    validateSortOrder(item, "sortOrder", `packages[${index}]`, issues);

    if (hasValue(item.price) && typeof item.price !== "number") {
      issues.push(`packages[${index}].price must be a number or null`);
    }

    if (typeof item.price === "number" && item.price < 0) {
      issues.push(`packages[${index}].price must be greater than or equal to 0`);
    }

    if (hasValue(item.isRecommended) && typeof item.isRecommended !== "boolean") {
      issues.push(`packages[${index}].isRecommended must be a boolean or null`);
    }

    if (item.isRecommended === true) {
      recommendedCount += 1;
    }

    if (typeof item.code === "string") {
      const normalized = normalizePackageCode(item.code);

      if (!normalized) {
        issues.push(`packages[${index}].code must contain letters, digits, _ or -`);
      } else if (explicitCodes.has(normalized)) {
        issues.push(`packages[${index}].code duplicates another package code`);
      } else {
        explicitCodes.add(normalized);
      }
    }
  });

  if (recommendedCount > 1) {
    issues.push("Only one package can have isRecommended: true");
  }
}

function validateProcessSteps(
  value: Record<string, unknown>,
  issues: string[],
) {
  const items = validateItemArray(
    value,
    "processSteps",
    new Set(["title", "description", "durationLabel", "sortOrder"]),
    issues,
  );

  items.forEach((item, index) => {
    validateOptionalString(item, "title", issues);
    validateOptionalString(item, "description", issues);
    validateOptionalString(item, "durationLabel", issues);
    validateSortOrder(item, "sortOrder", `processSteps[${index}]`, issues);
  });
}

function validateProofItems(value: Record<string, unknown>, issues: string[]) {
  const items = validateItemArray(
    value,
    "proofItems",
    new Set(["title", "description", "result", "sortOrder"]),
    issues,
  );

  items.forEach((item, index) => {
    validateOptionalString(item, "title", issues);
    validateOptionalString(item, "description", issues);
    validateOptionalString(item, "result", issues);
    validateSortOrder(item, "sortOrder", `proofItems[${index}]`, issues);
  });
}

function validateItemArray(
  value: Record<string, unknown>,
  key: string,
  allowedKeys: Set<string>,
  issues: string[],
) {
  if (!hasValue(value[key])) {
    return [];
  }

  if (!Array.isArray(value[key])) {
    issues.push(`${key} must be an array or null`);
    return [];
  }

  const records: Record<string, unknown>[] = [];

  value[key].forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push(`${key}[${index}] must be an object`);
      return;
    }

    validateObjectKeys(item, allowedKeys, `${key}[${index}]`, issues);
    validateSortOrder(item, "sortOrder", `${key}[${index}]`, issues);
    records.push(item);
  });

  return records;
}

function validateSortOrder(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
) {
  if (!hasValue(value[key])) {
    return;
  }

  if (!Number.isInteger(value[key]) || Number(value[key]) < 0) {
    issues.push(`${path}.${key} must be a non-negative integer or null`);
  }
}

function validateSelectedPackageCode(
  value: Record<string, unknown>,
  issues: string[],
) {
  if (typeof value.selectedPackageCode !== "string") {
    return;
  }

  const selectedCode = normalizePackageCode(value.selectedPackageCode);
  const packageInputs = Array.isArray(value.packages)
    ? value.packages.filter(isRecord)
    : [];

  if (!selectedCode) {
    issues.push("selectedPackageCode must contain letters, digits, _ or -");
    return;
  }

  if (!packageInputs.length) {
    return;
  }

  const packageCodes = createPackageCodesFromAiInputs(
    packageInputs as ProposalAiPackage[],
  );

  if (!packageCodes.includes(selectedCode)) {
    issues.push("selectedPackageCode must match one of packages[].code");
  }
}

function normalizePackageEntries(packages: ProposalAiInput["packages"]) {
  const codes = createPackageCodesFromAiInputs(optionalArray(packages));

  return optionalArray(packages).map((item, index) => ({
    code: codes[index] ?? `package-${index + 1}`,
    package: {
      id: createId(),
      name: textValue(item.name, `Package ${index + 1}`),
      description: textValue(item.description),
      price: numberValue(item.price),
      duration: textValue(item.durationLabel),
      isRecommended: Boolean(item.isRecommended),
      features: stringArray(item.features),
      sortOrder: sortOrderValue(item.sortOrder, index),
    } satisfies ProposalPackage,
  }));
}

function createPackageCodeMap(packages: ProposalPackage[]) {
  const codes = createPackageCodesFromAiInputs(
    packages.map((item) => ({ code: packageNameToCode(item.name), name: item.name })),
  );
  const map = new Map<string, string>();

  packages.forEach((item, index) => {
    map.set(item.id, codes[index] ?? `package-${index + 1}`);
  });

  return map;
}

function createPackageCodesFromAiInputs(packages: ProposalAiPackage[]) {
  const used = new Set<string>();

  return packages.map((item, index) => {
    const base =
      normalizePackageCode(item.code) ||
      packageNameToCode(textValue(item.name)) ||
      `package-${index + 1}`;
    let code = base;
    let suffix = 2;

    while (used.has(code)) {
      code = `${base}-${suffix}`;
      suffix += 1;
    }

    used.add(code);
    return code;
  });
}

function getSelectedPackageId(
  selectedPackageCode: ProposalAiInput["selectedPackageCode"],
  packages: Array<{ code: string; package: ProposalPackage }>,
) {
  if (!packages.length) {
    return undefined;
  }

  const selectedCode = normalizePackageCode(selectedPackageCode);
  return (
    packages.find((item) => item.code === selectedCode)?.package.id ??
    packages.find((item) => item.package.isRecommended)?.package.id ??
    packages[0]?.package.id
  );
}

function getExistingPackageId(
  id: string | undefined,
  packages: ProposalPackage[],
) {
  return packages.find((item) => item.id === id)?.id;
}

function normalizeOrders<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({ ...item, sortOrder: index }));
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function dateValue(value: unknown, fallback = getTodayDate()) {
  return typeof value === "string" && isDateString(value) ? value : fallback;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function sortOrderValue(value: unknown, fallback: number) {
  return Number.isInteger(value) && Number(value) >= 0
    ? Number(value)
    : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function optionalArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizePackageCode(value: unknown) {
  return textValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/_+/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 64);
}

function packageNameToCode(value: string) {
  return normalizePackageCode(value);
}

function isDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime());
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
