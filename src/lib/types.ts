export type ProposalStatus =
  | "draft"
  | "published"
  | "hidden"
  | "expired"
  | "approved"
  | "rejected";

export type ProposalLanguage = "ru" | "en";

export type ProposalCurrency = "RUB" | "USD" | "EUR";

export type ShareAccessMode = "public_link" | "password";

export type ProposalEventType =
  | "view"
  | "package_selected"
  | "cta_clicked"
  | "password_success"
  | "password_failed";

export type ShareSettings = {
  isPublished: boolean;
  shareSlug: string;
  accessMode: ShareAccessMode;
  expiresAt: string;
  allowPackageSelection: boolean;
  allowClientComment: boolean;
  showPrices: boolean;
  showTimeline: boolean;
  showComparisonTable: boolean;
  noIndex: boolean;
  approveUrl: string;
  discussUrl: string;
};

export type ProposalDeliverable = {
  id: string;
  proposalId?: string;
  title: string;
  description: string;
  clientValue: string;
  sortOrder: number;
};

export type ProposalPackage = {
  id: string;
  proposalId?: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  isRecommended: boolean;
  features: string[];
  sortOrder: number;
};

export type ProcessStep = {
  id: string;
  proposalId?: string;
  title: string;
  description: string;
  duration: string;
  sortOrder: number;
};

export type ProofItem = {
  id: string;
  proposalId?: string;
  title: string;
  description: string;
  result: string;
  sortOrder: number;
};

export type ProposalEvent = {
  id: string;
  proposalId: string;
  eventType: ProposalEventType;
  packageId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  userAgent?: string;
  referrer?: string;
};

export type ProposalArchiveJobStatus =
  | "pending"
  | "sent"
  | "purged"
  | "failed";

export type ProposalArchiveJob = {
  id: string;
  proposalOriginalId: string;
  status: ProposalArchiveJobStatus;
  attempts: number;
  lastError?: string;
  telegramChatId?: string;
  telegramMessageIds: number[];
  textSha256?: string;
  textChars?: number;
  renderVersion: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  purgedAt?: string;
};

export type Proposal = {
  id: string;
  shareSlug: string;
  title: string;
  clientName: string;
  clientCompany: string;
  preparedBy: string;
  preparedByRole: string;
  proposalDate: string;
  validUntil: string;
  version: string;
  status: ProposalStatus;
  language: ProposalLanguage;
  currency: ProposalCurrency;
  shortIntro: string;
  clientContext: string;
  clientProblem: string;
  businessGoal: string;
  proposedSolutionSummary: string;
  whyUs: string;
  paymentTerms: string;
  legalNotes: string;
  nextStepText: string;
  selectedPackageId?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  lastViewedAt?: string;
  viewsCount: number;
  expiresAt: string;
  retentionHold?: boolean;
  isPasswordProtected: boolean;
  passwordHash?: string;
  publicNotes?: string;
  internalNotes?: string;
  shareSettings: ShareSettings;
  assumptions: string[];
  outOfScope: string[];
  deliverables: ProposalDeliverable[];
  packages: ProposalPackage[];
  processSteps: ProcessStep[];
  proofItems: ProofItem[];
};

export type ProposalAiLanguage = ProposalLanguage;

export type ProposalAiCurrency = ProposalCurrency;

export type ProposalAiDeliverable = {
  title?: string | null;
  description?: string | null;
  clientValue?: string | null;
  sortOrder?: number | null;
};

export type ProposalAiPackage = {
  code?: string | null;
  name?: string | null;
  description?: string | null;
  price?: number | null;
  durationLabel?: string | null;
  isRecommended?: boolean | null;
  features?: string[] | null;
  sortOrder?: number | null;
};

export type ProposalAiProcessStep = {
  title?: string | null;
  description?: string | null;
  durationLabel?: string | null;
  sortOrder?: number | null;
};

export type ProposalAiProofItem = {
  title?: string | null;
  description?: string | null;
  result?: string | null;
  sortOrder?: number | null;
};

export type ProposalAiInput = {
  title?: string | null;
  clientName?: string | null;
  clientCompany?: string | null;
  preparedBy?: string | null;
  preparedByRole?: string | null;
  proposalDate?: string | null;
  validUntil?: string | null;
  version?: string | null;
  language?: ProposalAiLanguage | null;
  currency?: ProposalAiCurrency | null;
  shortIntro?: string | null;
  clientContext?: string | null;
  clientProblem?: string | null;
  businessGoal?: string | null;
  proposedSolutionSummary?: string | null;
  whyUs?: string | null;
  paymentTerms?: string | null;
  legalNotes?: string | null;
  nextStepText?: string | null;
  publicNotes?: string | null;
  selectedPackageCode?: string | null;
  assumptions?: string[] | null;
  outOfScope?: string[] | null;
  deliverables?: ProposalAiDeliverable[] | null;
  packages?: ProposalAiPackage[] | null;
  processSteps?: ProposalAiProcessStep[] | null;
  proofItems?: ProposalAiProofItem[] | null;
};

export type ProposalAiInputEnvelope = {
  content: ProposalAiInput;
  system?: Record<string, unknown>;
};

export type ProposalSavePayload = {
  proposal?: Proposal;
  content?: ProposalAiInput | ProposalAiInputEnvelope;
  password?: string;
};

export type ProposalListFilter =
  | "all"
  | "draft"
  | "published"
  | "hidden"
  | "expired"
  | "approved"
  | "rejected";

export type ToastState = {
  tone: "success" | "warning" | "error";
  message: string;
} | null;

// Legacy local editor types kept so older components in the repo still type-check.
export type Category =
  | "Design"
  | "Development"
  | "Content"
  | "Integration"
  | "QA"
  | "Management"
  | "Urgent"
  | "Other";

export type Priority = "low" | "medium" | "high";

export type Status = "proposed" | "approved" | "rejected" | "postponed";

export type Unit = "fixed" | "hour" | "day" | "item";

export type ProjectSettings = {
  projectTitle: string;
  clientName: string;
  preparedBy: string;
  proposalDate: string;
  version: string;
  currency: string;
  introSummary: string;
  paymentTerms: string;
  assumptions: string;
  outOfScope: string;
  notes: string;
};

export type ChangeItem = {
  id: string;
  title: string;
  category: Category;
  description: string;
  clientValue: string;
  deliverables: string[];
  outOfScope: string[];
  price: number;
  quantity: number;
  unit: Unit;
  estimatedDays: number;
  priority: Priority;
  required: boolean;
  optional: boolean;
  selected: boolean;
  status: Status;
  dependencyNote: string;
  internalNote: string;
};

export type ProposalData = {
  project: ProjectSettings;
  items: ChangeItem[];
};

export type ProposalMode = "builder" | "preview";
