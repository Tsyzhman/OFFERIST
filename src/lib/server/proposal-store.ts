import { promises as fs } from "fs";
import path from "path";
import argon2 from "argon2";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Agent, fetch as undiciFetch } from "undici";
import {
  createDemoProposal,
  createId,
  createShareSlug,
  getEffectiveStatus,
  normalizeProposal,
} from "@/lib/proposal";
import { createProposalFromAiInput } from "@/lib/proposal-ai";
import type {
  ProcessStep,
  ProofItem,
  Proposal,
  ProposalArchiveJob,
  ProposalArchiveJobStatus,
  ProposalCurrency,
  ProposalDeliverable,
  ProposalEvent,
  ProposalEventType,
  ProposalLanguage,
  ProposalListFilter,
  ProposalPackage,
  ProposalSavePayload,
  ProposalStatus,
  ShareAccessMode,
} from "@/lib/types";

type LocalDatabase = {
  proposals: Proposal[];
  events: ProposalEvent[];
  archiveJobs: ProposalArchiveJob[];
};

type ProposalRow = {
  id: string;
  share_slug: string;
  title: string;
  client_name: string;
  client_company: string;
  prepared_by: string;
  prepared_by_role: string;
  proposal_date: string;
  valid_until: string;
  version: string;
  status: ProposalStatus;
  language: ProposalLanguage;
  currency: ProposalCurrency;
  short_intro: string;
  client_context: string;
  client_problem: string;
  business_goal: string;
  proposed_solution_summary: string;
  why_us: string;
  payment_terms: string;
  legal_notes: string;
  next_step_text: string;
  selected_package_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  last_viewed_at: string | null;
  views_count: number;
  expires_at: string;
  retention_hold: boolean;
  is_password_protected: boolean;
  password_hash: string | null;
  public_notes: string | null;
  internal_notes: string | null;
  is_published: boolean;
  access_mode: ShareAccessMode;
  allow_package_selection: boolean;
  allow_client_comment: boolean;
  show_prices: boolean;
  show_timeline: boolean;
  show_comparison_table: boolean;
  no_index: boolean;
  approve_url: string | null;
  discuss_url: string | null;
  assumptions: string[] | null;
  out_of_scope: string[] | null;
};

type DeliverableRow = {
  id: string;
  proposal_id: string;
  title: string;
  description: string;
  client_value: string;
  sort_order: number;
};

type PackageRow = {
  id: string;
  proposal_id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  is_recommended: boolean;
  features: string[] | null;
  sort_order: number;
};

type ProcessStepRow = {
  id: string;
  proposal_id: string;
  title: string;
  description: string;
  duration: string;
  sort_order: number;
};

type ProofItemRow = {
  id: string;
  proposal_id: string;
  title: string;
  description: string;
  result: string;
  sort_order: number;
};

type ProposalEventRow = {
  id: string;
  proposal_id: string;
  event_type: ProposalEventType;
  package_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user_agent: string | null;
  referrer: string | null;
};

type ProposalArchiveJobRow = {
  id: string;
  proposal_original_id: string;
  status: ProposalArchiveJobStatus;
  attempts: number;
  last_error: string | null;
  telegram_chat_id: string | null;
  telegram_message_ids: number[] | null;
  text_sha256: string | null;
  text_chars: number | null;
  render_version: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  purged_at: string | null;
};

type ProposalChildren = {
  deliverables: ProposalDeliverable[];
  packages: ProposalPackage[];
  processSteps: ProcessStep[];
  proofItems: ProofItem[];
};

type EventInput = {
  proposalId: string;
  eventType: ProposalEventType;
  packageId?: string;
  metadata?: Record<string, unknown>;
  userAgent?: string;
  referrer?: string;
};

type ProposalListOptions = {
  limit?: number;
  offset?: number;
  filter?: ProposalListFilter;
};

type ProposalListResult = {
  items: Proposal[];
  total: number;
};

const localDatabasePath = path.join(process.cwd(), ".data", "proposals.json");
const DEFAULT_PROPOSAL_LIST_LIMIT = 50;
const MAX_PROPOSAL_LIST_LIMIT = 500;
const MAX_EVENTS_PER_PROPOSAL = 200;
const MAX_EVENTS_TOTAL = 5000;
const supabaseAgent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
});

let cachedSupabase: SupabaseClient | null | undefined;
let supabaseSeedChecked = false;

export async function listProposals(
  options: ProposalListOptions = {},
): Promise<ProposalListResult> {
  const limit = normalizeListLimit(options.limit);
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const filter = options.filter ?? "all";
  const supabase = getSupabase();

  if (supabase) {
    await ensureSupabaseDemoData(supabase);
    return listSupabaseProposalSummaries(supabase, { limit, offset, filter });
  }

  const database = await readLocalDatabase();
  const proposals = database.proposals
    .map(normalizeProposal)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const filtered = filterProposals(proposals, filter);
  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

export async function getProposalById(id: string) {
  const supabase = getSupabase();

  if (supabase) {
    await ensureSupabaseDemoData(supabase);
    return getSupabaseProposalById(supabase, id);
  }

  const database = await readLocalDatabase();
  return database.proposals.find((proposal) => proposal.id === id) ?? null;
}

export async function getProposalByShareSlug(shareSlug: string) {
  const supabase = getSupabase();

  if (supabase) {
    await ensureSupabaseDemoData(supabase);
    return getSupabaseProposalByShareSlug(supabase, shareSlug);
  }

  const database = await readLocalDatabase();
  return (
    database.proposals.find((proposal) => proposal.shareSlug === shareSlug) ??
    null
  );
}

export async function createProposal(payload?: Partial<ProposalSavePayload>) {
  const draft = createNewProposalDraft(
    await createUniqueShareSlug(payload?.proposal?.shareSlug),
  );
  const proposal = payload?.content
    ? createProposalFromAiInput(payload.content, draft)
    : normalizeProposal(payload?.proposal ?? draft);

  proposal.id = payload?.proposal?.id || proposal.id || createId();
  proposal.shareSlug = await createUniqueShareSlug(
    payload?.proposal?.shareSlug || proposal.shareSlug,
    proposal.id,
  );
  proposal.shareSettings.shareSlug = proposal.shareSlug;

  return saveProposal({ proposal, password: payload?.password }, true);
}

function createNewProposalDraft(shareSlug: string): Proposal {
  const demo = createDemoProposal();

  return normalizeProposal({
    ...demo,
    id: createId(),
    shareSlug,
    title: "Новое коммерческое предложение",
    clientName: "",
    clientCompany: "",
    status: "draft",
    publishedAt: undefined,
    viewsCount: 0,
    lastViewedAt: undefined,
    shareSettings: {
      ...demo.shareSettings,
      isPublished: false,
      shareSlug,
    },
  });
}

export async function saveProposal(
  payload: ProposalSavePayload,
  isNew = false,
  proposalId = payload.proposal?.id,
) {
  if (!payload.proposal && !payload.content) {
    throw new Error("Proposal or content is required");
  }

  const existing = isNew || !proposalId ? null : await getProposalById(proposalId);
  let baseProposal =
    existing ??
    payload.proposal ??
    createNewProposalDraft(createShareSlug());

  if (proposalId && baseProposal.id !== proposalId) {
    baseProposal = { ...baseProposal, id: proposalId };
  }

  const sourceProposal = payload.content
    ? createProposalFromAiInput(payload.content, baseProposal)
    : payload.proposal;

  if (!sourceProposal) {
    throw new Error("Proposal or content is required");
  }

  const now = new Date().toISOString();
  const proposal = normalizeProposal({
    ...sourceProposal,
    id: sourceProposal.id || proposalId || createId(),
    shareSlug: sourceProposal.shareSlug || existing?.shareSlug || createShareSlug(),
    createdAt: sourceProposal.createdAt || existing?.createdAt || now,
    updatedAt: now,
    viewsCount: existing?.viewsCount ?? sourceProposal.viewsCount ?? 0,
    lastViewedAt: existing?.lastViewedAt ?? sourceProposal.lastViewedAt,
    passwordHash: existing?.passwordHash ?? sourceProposal.passwordHash,
  });

  proposal.shareSlug = await createUniqueShareSlug(proposal.shareSlug, proposal.id);
  proposal.shareSettings.shareSlug = proposal.shareSlug;
  proposal.shareSettings.expiresAt = proposal.expiresAt;
  proposal.shareSettings.isPublished = proposal.status === "published";
  proposal.shareSettings.accessMode = proposal.isPasswordProtected
    ? "password"
    : "public_link";

  if (payload.password?.trim()) {
    proposal.passwordHash = await argon2.hash(payload.password.trim(), {
      type: argon2.argon2id,
    });
    proposal.isPasswordProtected = true;
    proposal.shareSettings.accessMode = "password";
  }

  if (!proposal.isPasswordProtected) {
    proposal.passwordHash = undefined;
    proposal.shareSettings.accessMode = "public_link";
  }

  if (proposal.status === "published" && !proposal.publishedAt) {
    proposal.publishedAt = now;
  }

  const supabase = getSupabase();

  if (supabase) {
    await persistSupabaseProposal(supabase, proposal);
    return proposal;
  }

  const database = await readLocalDatabase();
  const index = database.proposals.findIndex((item) => item.id === proposal.id);

  if (index >= 0) {
    database.proposals[index] = proposal;
  } else {
    database.proposals.unshift(proposal);
  }

  await writeLocalDatabase(database);
  return proposal;
}

export async function deleteProposal(id: string) {
  const supabase = getSupabase();

  if (supabase) {
    await supabase.from("proposal_events").delete().eq("proposal_id", id);
    await deleteSupabaseChildren(supabase, id);
    const { error } = await supabase.from("proposals").delete().eq("id", id);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const database = await readLocalDatabase();
  database.proposals = database.proposals.filter((proposal) => proposal.id !== id);
  database.events = database.events.filter((event) => event.proposalId !== id);
  await writeLocalDatabase(database);
}

export async function listRetentionCandidateProposals(
  cutoffIso: string,
  limit = 25,
) {
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .lte("created_at", cutoffIso)
      .eq("retention_hold", false)
      .order("created_at", { ascending: true })
      .limit(Math.max(1, limit));

    if (error) {
      throw new Error(error.message);
    }

    return hydrateSupabaseProposals(supabase, (data ?? []) as ProposalRow[]);
  }

  const database = await readLocalDatabase();
  return database.proposals
    .map(normalizeProposal)
    .filter(
      (proposal) =>
        !proposal.retentionHold && proposal.createdAt <= cutoffIso,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, Math.max(1, limit));
}

export async function getProposalArchiveJob(proposalOriginalId: string) {
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from("proposal_archive_jobs")
      .select("*")
      .eq("proposal_original_id", proposalOriginalId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? fromProposalArchiveJobRow(data as ProposalArchiveJobRow) : null;
  }

  const database = await readLocalDatabase();
  return (
    database.archiveJobs.find(
      (job) => job.proposalOriginalId === proposalOriginalId,
    ) ?? null
  );
}

export async function saveProposalArchiveJob(job: ProposalArchiveJob) {
  const now = new Date().toISOString();
  const nextJob: ProposalArchiveJob = {
    ...job,
    id: job.id || createId(),
    renderVersion: job.renderVersion || "telegram-v1",
    telegramMessageIds: job.telegramMessageIds ?? [],
    createdAt: job.createdAt || now,
    updatedAt: now,
  };
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from("proposal_archive_jobs")
      .upsert(toProposalArchiveJobRow(nextJob), {
        onConflict: "proposal_original_id",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return fromProposalArchiveJobRow(data as ProposalArchiveJobRow);
  }

  const database = await readLocalDatabase();
  const index = database.archiveJobs.findIndex(
    (item) => item.proposalOriginalId === nextJob.proposalOriginalId,
  );

  if (index >= 0) {
    database.archiveJobs[index] = nextJob;
  } else {
    database.archiveJobs.unshift(nextJob);
  }

  await writeLocalDatabase(database);
  return nextJob;
}

export async function duplicateProposal(id: string) {
  const proposal = await getProposalById(id);

  if (!proposal) {
    return null;
  }

  const now = new Date().toISOString();
  const packageIdMap = new Map<string, string>();
  const packages = proposal.packages.map((item) => {
    const nextId = createId();
    packageIdMap.set(item.id, nextId);

    return {
      ...item,
      id: nextId,
      proposalId: undefined,
    };
  });
  const copy = normalizeProposal({
    ...proposal,
    id: createId(),
    shareSlug: await createUniqueShareSlug(),
    title: `${proposal.title} (копия)`,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    publishedAt: undefined,
    lastViewedAt: undefined,
    viewsCount: 0,
    selectedPackageId: proposal.selectedPackageId
      ? packageIdMap.get(proposal.selectedPackageId)
      : undefined,
    passwordHash: undefined,
    isPasswordProtected: false,
    shareSettings: {
      ...proposal.shareSettings,
      isPublished: false,
      accessMode: "public_link",
      shareSlug: "",
    },
    deliverables: proposal.deliverables.map((item) => ({
      ...item,
      id: createId(),
      proposalId: undefined,
    })),
    packages,
    processSteps: proposal.processSteps.map((item) => ({
      ...item,
      id: createId(),
      proposalId: undefined,
    })),
    proofItems: proposal.proofItems.map((item) => ({
      ...item,
      id: createId(),
      proposalId: undefined,
    })),
  });

  copy.shareSettings.shareSlug = copy.shareSlug;
  await saveProposal({ proposal: copy }, true);
  return copy;
}

export async function publishProposal(id: string) {
  const proposal = await getProposalById(id);

  if (!proposal) {
    return null;
  }

  const now = new Date().toISOString();
  return saveProposal({
    proposal: {
      ...proposal,
      status: "published",
      publishedAt: proposal.publishedAt || now,
      shareSettings: {
        ...proposal.shareSettings,
        isPublished: true,
      },
    },
  });
}

export async function unpublishProposal(id: string) {
  const proposal = await getProposalById(id);

  if (!proposal) {
    return null;
  }

  return saveProposal({
    proposal: {
      ...proposal,
      status: "hidden",
      shareSettings: {
        ...proposal.shareSettings,
        isPublished: false,
      },
    },
  });
}

export async function regenerateProposalShareSlug(id: string) {
  const proposal = await getProposalById(id);

  if (!proposal) {
    return null;
  }

  const shareSlug = await createUniqueShareSlug(undefined, proposal.id);

  return saveProposal({
    proposal: {
      ...proposal,
      shareSlug,
      shareSettings: {
        ...proposal.shareSettings,
        shareSlug,
      },
    },
  });
}

export async function recordEventByShareSlug(
  shareSlug: string,
  eventType: ProposalEventType,
  options: Omit<EventInput, "proposalId" | "eventType"> = {},
) {
  const proposal = await getProposalByShareSlug(shareSlug);

  if (!proposal) {
    return null;
  }

  return recordProposalEvent({
    proposalId: proposal.id,
    eventType,
    ...options,
  });
}

export async function recordProposalEvent(input: EventInput) {
  const event: ProposalEvent = {
    id: createId(),
    proposalId: input.proposalId,
    eventType: input.eventType,
    packageId: input.packageId,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
    userAgent: input.userAgent,
    referrer: input.referrer,
  };

  const supabase = getSupabase();

  if (supabase) {
    const { error } = await supabase.from("proposal_events").insert(toEventRow(event));
    if (error) {
      throw new Error(error.message);
    }

    if (input.eventType === "view") {
      const { error: viewError } = await supabase.rpc(
        "increment_proposal_view",
        {
          p_id: input.proposalId,
          p_viewed_at: event.createdAt,
        },
      );
      if (viewError) {
        throw new Error(viewError.message);
      }
    }

    if (input.eventType === "package_selected" && input.packageId) {
      await supabase
        .from("proposals")
        .update({ selected_package_id: input.packageId })
        .eq("id", input.proposalId);
    }

    return event;
  }

  const database = await readLocalDatabase();
  database.events.unshift(event);
  database.events = trimEvents(database.events);
  const proposal = database.proposals.find((item) => item.id === input.proposalId);

  if (proposal && input.eventType === "view") {
    proposal.viewsCount += 1;
    proposal.lastViewedAt = event.createdAt;
    proposal.updatedAt = proposal.updatedAt;
  }

  if (proposal && input.eventType === "package_selected" && input.packageId) {
    proposal.selectedPackageId = input.packageId;
  }

  await writeLocalDatabase(database);
  return event;
}

export async function verifyProposalPassword(
  shareSlug: string,
  password: string,
  userAgent?: string,
  referrer?: string,
) {
  const proposal = await getProposalByShareSlug(shareSlug);

  if (!proposal || !proposal.passwordHash) {
    return null;
  }

  const ok = await argon2.verify(proposal.passwordHash, password);

  await recordProposalEvent({
    proposalId: proposal.id,
    eventType: ok ? "password_success" : "password_failed",
    userAgent,
    referrer,
  });

  return ok ? proposal : null;
}

export async function createUniqueShareSlug(preferred?: string, ignoreId?: string) {
  const cleaned = cleanShareSlug(preferred);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const shareSlug = attempt === 0 && cleaned ? cleaned : createShareSlug();
    const existing = await getProposalByShareSlug(shareSlug);

    if (!existing || existing.id === ignoreId) {
      return shareSlug;
    }
  }

  return createShareSlug(18);
}

function cleanShareSlug(value?: string) {
  return (value ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
}

function normalizeListLimit(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_PROPOSAL_LIST_LIMIT;
  }

  return Math.min(
    MAX_PROPOSAL_LIST_LIMIT,
    Math.max(1, Math.floor(value)),
  );
}

function filterProposals(
  proposals: Proposal[],
  filter: ProposalListFilter,
) {
  if (filter === "all") {
    return proposals;
  }

  return proposals.filter((proposal) => getEffectiveStatus(proposal) === filter);
}

function trimEvents(events: ProposalEvent[]): ProposalEvent[] {
  const perProposal = new Map<string, number>();
  const kept: ProposalEvent[] = [];

  for (const event of events) {
    const count = perProposal.get(event.proposalId) ?? 0;
    if (count >= MAX_EVENTS_PER_PROPOSAL) {
      continue;
    }

    perProposal.set(event.proposalId, count + 1);
    kept.push(event);

    if (kept.length >= MAX_EVENTS_TOTAL) {
      break;
    }
  }

  return kept;
}

async function listSupabaseProposalSummaries(
  supabase: SupabaseClient,
  options: Required<ProposalListOptions>,
): Promise<ProposalListResult> {
  let query = supabase
    .from("proposals")
    .select("*", { count: "exact" });

  if (options.filter !== "all") {
    query = query.eq("status", options.filter);
  }

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .range(options.offset, options.offset + options.limit - 1);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ProposalRow[];
  return {
    items: await hydrateSupabaseProposalSummaries(supabase, rows),
    total: count ?? rows.length,
  };
}

async function hydrateSupabaseProposalSummaries(
  supabase: SupabaseClient,
  rows: ProposalRow[],
) {
  const ids = rows.map((row) => row.id);

  if (ids.length === 0) {
    return [];
  }

  const packages = await fetchRows<PackageRow>(supabase, "packages", ids);

  return rows.map((row) =>
    fromProposalRow(row, {
      deliverables: [],
      packages: packages
        .filter((item) => item.proposal_id === row.id)
        .map(fromPackageRow),
      processSteps: [],
      proofItems: [],
    }),
  );
}

async function getSupabaseProposalById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const [proposal] = await hydrateSupabaseProposals(supabase, [
    data as ProposalRow,
  ]);
  return proposal ?? null;
}

async function getSupabaseProposalByShareSlug(
  supabase: SupabaseClient,
  shareSlug: string,
) {
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("share_slug", shareSlug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("proposals")
      .select("*")
      .ilike("share_slug", shareSlug)
      .maybeSingle();

    if (fallbackError) {
      throw new Error(fallbackError.message);
    }

    if (!fallbackData) {
      return null;
    }

    const [proposal] = await hydrateSupabaseProposals(supabase, [
      fallbackData as ProposalRow,
    ]);
    return proposal ?? null;
  }

  const [proposal] = await hydrateSupabaseProposals(supabase, [
    data as ProposalRow,
  ]);
  return proposal ?? null;
}

async function hydrateSupabaseProposals(
  supabase: SupabaseClient,
  rows: ProposalRow[],
) {
  const ids = rows.map((row) => row.id);

  if (ids.length === 0) {
    return [];
  }

  const [deliverables, packages, processSteps, proofItems] = await Promise.all([
    fetchRows<DeliverableRow>(supabase, "deliverables", ids),
    fetchRows<PackageRow>(supabase, "packages", ids),
    fetchRows<ProcessStepRow>(supabase, "process_steps", ids),
    fetchRows<ProofItemRow>(supabase, "proof_items", ids),
  ]);

  return rows.map((row) =>
    fromProposalRow(row, {
      deliverables: deliverables
        .filter((item) => item.proposal_id === row.id)
        .map(fromDeliverableRow),
      packages: packages
        .filter((item) => item.proposal_id === row.id)
        .map(fromPackageRow),
      processSteps: processSteps
        .filter((item) => item.proposal_id === row.id)
        .map(fromProcessStepRow),
      proofItems: proofItems
        .filter((item) => item.proposal_id === row.id)
        .map(fromProofItemRow),
    }),
  );
}

async function fetchRows<T>(
  supabase: SupabaseClient,
  tableName: string,
  proposalIds: string[],
) {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .in("proposal_id", proposalIds)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as T[];
}

async function persistSupabaseProposal(
  supabase: SupabaseClient,
  proposal: Proposal,
) {
  const row = toProposalRow(proposal);
  const { error } = await supabase.from("proposals").upsert(row, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(error.message);
  }

  await deleteSupabaseChildren(supabase, proposal.id);

  const inserts = [
    proposal.deliverables.length
      ? supabase.from("deliverables").insert(proposal.deliverables.map((item) => toDeliverableRow(item, proposal.id)))
      : null,
    proposal.packages.length
      ? supabase.from("packages").insert(proposal.packages.map((item) => toPackageRow(item, proposal.id)))
      : null,
    proposal.processSteps.length
      ? supabase.from("process_steps").insert(proposal.processSteps.map((item) => toProcessStepRow(item, proposal.id)))
      : null,
    proposal.proofItems.length
      ? supabase.from("proof_items").insert(proposal.proofItems.map((item) => toProofItemRow(item, proposal.id)))
      : null,
  ].filter(Boolean);

  const results = await Promise.all(inserts);
  const failed = results.find((result) => result?.error);

  if (failed?.error) {
    throw new Error(failed.error.message);
  }
}

async function deleteSupabaseChildren(supabase: SupabaseClient, proposalId: string) {
  const tables = ["deliverables", "packages", "process_steps", "proof_items"];
  const results = await Promise.all(
    tables.map((table) => supabase.from(table).delete().eq("proposal_id", proposalId)),
  );
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    throw new Error(failed.error.message);
  }
}

async function ensureSupabaseDemoData(supabase: SupabaseClient) {
  if (supabaseSeedChecked) {
    return;
  }

  const { count, error } = await supabase
    .from("proposals")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(error.message);
  }

  if (!count) {
    await persistSupabaseProposal(supabase, createDemoProposal());
  }

  supabaseSeedChecked = true;
}

async function readLocalDatabase(): Promise<LocalDatabase> {
  try {
    const raw = await fs.readFile(localDatabasePath, "utf8");
    const parsed = JSON.parse(raw) as LocalDatabase;

    if (Array.isArray(parsed.proposals)) {
      return {
        proposals: parsed.proposals.map(normalizeProposal),
        events: Array.isArray(parsed.events) ? parsed.events : [],
        archiveJobs: Array.isArray(parsed.archiveJobs)
          ? parsed.archiveJobs.map(normalizeProposalArchiveJob)
          : [],
      };
    }
  } catch {
    // The local fallback is intentionally quiet so npm run dev works without Supabase env.
  }

  const database: LocalDatabase = {
    proposals: [createDemoProposal()],
    events: [],
    archiveJobs: [],
  };
  await writeLocalDatabase(database);
  return database;
}

async function writeLocalDatabase(database: LocalDatabase) {
  await fs.mkdir(path.dirname(localDatabasePath), { recursive: true });
  const tmpPath = `${localDatabasePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(database), "utf8");
  await fs.rename(tmpPath, localDatabasePath);
}

function supabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  return undiciFetch(input as Parameters<typeof undiciFetch>[0], {
    ...init,
    dispatcher: supabaseAgent,
  } as Parameters<typeof undiciFetch>[1]) as unknown as ReturnType<typeof fetch>;
}

function getSupabase() {
  if (cachedSupabase !== undefined) {
    return cachedSupabase;
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    cachedSupabase = null;
    return cachedSupabase;
  }

  cachedSupabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: supabaseFetch as unknown as typeof fetch,
    },
  });

  return cachedSupabase;
}

function fromProposalRow(row: ProposalRow, children: ProposalChildren): Proposal {
  return normalizeProposal({
    id: row.id,
    shareSlug: row.share_slug,
    title: row.title,
    clientName: row.client_name,
    clientCompany: row.client_company,
    preparedBy: row.prepared_by,
    preparedByRole: row.prepared_by_role,
    proposalDate: row.proposal_date,
    validUntil: row.valid_until,
    version: row.version,
    status: row.status,
    language: row.language,
    currency: row.currency,
    shortIntro: row.short_intro,
    clientContext: row.client_context,
    clientProblem: row.client_problem,
    businessGoal: row.business_goal,
    proposedSolutionSummary: row.proposed_solution_summary,
    whyUs: row.why_us,
    paymentTerms: row.payment_terms,
    legalNotes: row.legal_notes,
    nextStepText: row.next_step_text,
    selectedPackageId: row.selected_package_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? undefined,
    lastViewedAt: row.last_viewed_at ?? undefined,
    viewsCount: row.views_count ?? 0,
    expiresAt: row.expires_at,
    retentionHold: row.retention_hold ?? false,
    isPasswordProtected: row.is_password_protected,
    passwordHash: row.password_hash ?? undefined,
    publicNotes: row.public_notes ?? "",
    internalNotes: row.internal_notes ?? "",
    shareSettings: {
      isPublished: row.is_published,
      shareSlug: row.share_slug,
      accessMode: row.access_mode,
      expiresAt: row.expires_at,
      allowPackageSelection: row.allow_package_selection,
      allowClientComment: row.allow_client_comment,
      showPrices: row.show_prices,
      showTimeline: row.show_timeline,
      showComparisonTable: row.show_comparison_table,
      noIndex: row.no_index,
      approveUrl: row.approve_url ?? "",
      discussUrl: row.discuss_url ?? "",
    },
    assumptions: row.assumptions ?? [],
    outOfScope: row.out_of_scope ?? [],
    ...children,
  });
}

function toProposalRow(proposal: Proposal): ProposalRow {
  const effectiveStatus = getEffectiveStatus(proposal);

  return {
    id: proposal.id,
    share_slug: proposal.shareSlug,
    title: proposal.title,
    client_name: proposal.clientName,
    client_company: proposal.clientCompany,
    prepared_by: proposal.preparedBy,
    prepared_by_role: proposal.preparedByRole,
    proposal_date: proposal.proposalDate,
    valid_until: proposal.validUntil,
    version: proposal.version,
    status: effectiveStatus === "expired" ? proposal.status : effectiveStatus,
    language: proposal.language,
    currency: proposal.currency,
    short_intro: proposal.shortIntro,
    client_context: proposal.clientContext,
    client_problem: proposal.clientProblem,
    business_goal: proposal.businessGoal,
    proposed_solution_summary: proposal.proposedSolutionSummary,
    why_us: proposal.whyUs,
    payment_terms: proposal.paymentTerms,
    legal_notes: proposal.legalNotes,
    next_step_text: proposal.nextStepText,
    selected_package_id: proposal.selectedPackageId ?? null,
    created_at: proposal.createdAt,
    updated_at: proposal.updatedAt,
    published_at: proposal.publishedAt ?? null,
    last_viewed_at: proposal.lastViewedAt ?? null,
    views_count: proposal.viewsCount,
    expires_at: proposal.expiresAt,
    retention_hold: Boolean(proposal.retentionHold),
    is_password_protected: proposal.isPasswordProtected,
    password_hash: proposal.passwordHash ?? null,
    public_notes: proposal.publicNotes ?? null,
    internal_notes: proposal.internalNotes ?? null,
    is_published: proposal.status === "published",
    access_mode: proposal.shareSettings.accessMode,
    allow_package_selection: proposal.shareSettings.allowPackageSelection,
    allow_client_comment: proposal.shareSettings.allowClientComment,
    show_prices: proposal.shareSettings.showPrices,
    show_timeline: proposal.shareSettings.showTimeline,
    show_comparison_table: proposal.shareSettings.showComparisonTable,
    no_index: proposal.shareSettings.noIndex,
    approve_url: proposal.shareSettings.approveUrl,
    discuss_url: proposal.shareSettings.discussUrl,
    assumptions: proposal.assumptions,
    out_of_scope: proposal.outOfScope,
  };
}

function fromDeliverableRow(row: DeliverableRow): ProposalDeliverable {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    title: row.title,
    description: row.description,
    clientValue: row.client_value,
    sortOrder: row.sort_order,
  };
}

function toDeliverableRow(
  item: ProposalDeliverable,
  proposalId: string,
): DeliverableRow {
  return {
    id: item.id,
    proposal_id: proposalId,
    title: item.title,
    description: item.description,
    client_value: item.clientValue,
    sort_order: item.sortOrder,
  };
}

function fromPackageRow(row: PackageRow): ProposalPackage {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    name: row.name,
    description: row.description,
    price: row.price,
    duration: row.duration,
    isRecommended: row.is_recommended,
    features: row.features ?? [],
    sortOrder: row.sort_order,
  };
}

function toPackageRow(item: ProposalPackage, proposalId: string): PackageRow {
  return {
    id: item.id,
    proposal_id: proposalId,
    name: item.name,
    description: item.description,
    price: item.price,
    duration: item.duration,
    is_recommended: item.isRecommended,
    features: item.features,
    sort_order: item.sortOrder,
  };
}

function fromProcessStepRow(row: ProcessStepRow): ProcessStep {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    title: row.title,
    description: row.description,
    duration: row.duration,
    sortOrder: row.sort_order,
  };
}

function toProcessStepRow(item: ProcessStep, proposalId: string): ProcessStepRow {
  return {
    id: item.id,
    proposal_id: proposalId,
    title: item.title,
    description: item.description,
    duration: item.duration,
    sort_order: item.sortOrder,
  };
}

function fromProofItemRow(row: ProofItemRow): ProofItem {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    title: row.title,
    description: row.description,
    result: row.result,
    sortOrder: row.sort_order,
  };
}

function toProofItemRow(item: ProofItem, proposalId: string): ProofItemRow {
  return {
    id: item.id,
    proposal_id: proposalId,
    title: item.title,
    description: item.description,
    result: item.result,
    sort_order: item.sortOrder,
  };
}

function toEventRow(event: ProposalEvent): ProposalEventRow {
  return {
    id: event.id,
    proposal_id: event.proposalId,
    event_type: event.eventType,
    package_id: event.packageId ?? null,
    metadata: event.metadata ?? null,
    created_at: event.createdAt,
    user_agent: event.userAgent ?? null,
    referrer: event.referrer ?? null,
  };
}

function normalizeProposalArchiveJob(
  value: Partial<ProposalArchiveJob>,
): ProposalArchiveJob {
  const now = new Date().toISOString();

  return {
    id: value.id || createId(),
    proposalOriginalId: value.proposalOriginalId || "",
    status: value.status || "pending",
    attempts: Math.max(0, Number(value.attempts) || 0),
    lastError: value.lastError,
    telegramChatId: value.telegramChatId,
    telegramMessageIds: Array.isArray(value.telegramMessageIds)
      ? value.telegramMessageIds
      : [],
    textSha256: value.textSha256,
    textChars:
      typeof value.textChars === "number" && Number.isFinite(value.textChars)
        ? value.textChars
        : undefined,
    renderVersion: value.renderVersion || "telegram-v1",
    createdAt: value.createdAt || now,
    updatedAt: value.updatedAt || now,
    archivedAt: value.archivedAt,
    purgedAt: value.purgedAt,
  };
}

function fromProposalArchiveJobRow(
  row: ProposalArchiveJobRow,
): ProposalArchiveJob {
  return normalizeProposalArchiveJob({
    id: row.id,
    proposalOriginalId: row.proposal_original_id,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error ?? undefined,
    telegramChatId: row.telegram_chat_id ?? undefined,
    telegramMessageIds: row.telegram_message_ids ?? [],
    textSha256: row.text_sha256 ?? undefined,
    textChars: row.text_chars ?? undefined,
    renderVersion: row.render_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
    purgedAt: row.purged_at ?? undefined,
  });
}

function toProposalArchiveJobRow(
  job: ProposalArchiveJob,
): ProposalArchiveJobRow {
  return {
    id: job.id,
    proposal_original_id: job.proposalOriginalId,
    status: job.status,
    attempts: job.attempts,
    last_error: job.lastError ?? null,
    telegram_chat_id: job.telegramChatId ?? null,
    telegram_message_ids: job.telegramMessageIds,
    text_sha256: job.textSha256 ?? null,
    text_chars: job.textChars ?? null,
    render_version: job.renderVersion,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    archived_at: job.archivedAt ?? null,
    purged_at: job.purgedAt ?? null,
  };
}
