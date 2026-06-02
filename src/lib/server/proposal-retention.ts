import { createId } from "@/lib/proposal";
import type { Proposal, ProposalArchiveJob } from "@/lib/types";
import {
  deleteProposal,
  getProposalArchiveJob,
  listRetentionCandidateProposals,
  saveProposalArchiveJob,
} from "@/lib/server/proposal-store";
import { sendProposalArchiveToTelegram } from "@/lib/server/telegram-archive";

const DEFAULT_RETENTION_MONTHS = 6;
const DEFAULT_RETENTION_LIMIT = 25;

type RetentionRunOptions = {
  dryRun?: boolean;
  limit?: number;
  now?: Date;
  origin?: string;
};

export type ProposalRetentionRunResult = {
  ok: boolean;
  dryRun: boolean;
  cutoffIso: string;
  scanned: number;
  archived: number;
  purged: number;
  skipped: number;
  failed: Array<{
    proposalId: string;
    title: string;
    error: string;
  }>;
};

export async function runProposalRetention(
  options: RetentionRunOptions = {},
): Promise<ProposalRetentionRunResult> {
  const now = options.now ?? new Date();
  const cutoffIso = getRetentionCutoffIso(now);
  const limit = normalizeLimit(options.limit);
  const candidates = await listRetentionCandidateProposals(cutoffIso, limit);
  const result: ProposalRetentionRunResult = {
    ok: true,
    dryRun: Boolean(options.dryRun),
    cutoffIso,
    scanned: candidates.length,
    archived: 0,
    purged: 0,
    skipped: 0,
    failed: [],
  };

  for (const proposal of candidates) {
    if (options.dryRun) {
      result.skipped += 1;
      continue;
    }

    await archiveAndPurgeProposal(proposal, options, result);
  }

  result.ok = result.failed.length === 0;
  return result;
}

export function getRetentionCutoffIso(now: Date) {
  return subtractUtcMonths(now, DEFAULT_RETENTION_MONTHS).toISOString();
}

async function archiveAndPurgeProposal(
  proposal: Proposal,
  options: RetentionRunOptions,
  result: ProposalRetentionRunResult,
) {
  const existingJob = await getProposalArchiveJob(proposal.id);
  let job = existingJob ?? createArchiveJob(proposal.id);

  if (job.status !== "sent" || job.telegramMessageIds.length === 0) {
    const startedJob = await saveProposalArchiveJob({
      ...job,
      status: "pending",
      attempts: job.attempts + 1,
      lastError: undefined,
    });

    try {
      const telegramResult = await sendProposalArchiveToTelegram(proposal, {
        origin: options.origin,
      });
      job = await saveProposalArchiveJob({
        ...startedJob,
        status: "sent",
        lastError: undefined,
        telegramChatId: telegramResult.chatId,
        telegramMessageIds: telegramResult.messageIds,
        textSha256: telegramResult.textSha256,
        textChars: telegramResult.textChars,
        renderVersion: telegramResult.renderVersion,
        archivedAt: new Date().toISOString(),
      });
      result.archived += 1;
    } catch (error) {
      const message = getErrorMessage(error);
      await saveProposalArchiveJob({
        ...startedJob,
        status: "failed",
        lastError: message,
      });
      result.failed.push({
        proposalId: proposal.id,
        title: proposal.title,
        error: message,
      });
      return;
    }
  }

  try {
    await deleteProposal(proposal.id);
    await saveProposalArchiveJob({
      ...job,
      status: "purged",
      lastError: undefined,
      purgedAt: new Date().toISOString(),
    });
    result.purged += 1;
  } catch (error) {
    const message = `Purge failed: ${getErrorMessage(error)}`;
    await saveProposalArchiveJob({
      ...job,
      status: "sent",
      lastError: message,
    });
    result.failed.push({
      proposalId: proposal.id,
      title: proposal.title,
      error: message,
    });
  }
}

function createArchiveJob(proposalOriginalId: string): ProposalArchiveJob {
  const now = new Date().toISOString();

  return {
    id: createId(),
    proposalOriginalId,
    status: "pending",
    attempts: 0,
    telegramMessageIds: [],
    renderVersion: "telegram-v1",
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeLimit(value?: number) {
  const limit = Math.trunc(Number(value) || DEFAULT_RETENTION_LIMIT);
  return Math.min(Math.max(limit, 1), 100);
}

function subtractUtcMonths(date: Date, months: number) {
  const target = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() - months,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  const lastDayOfTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(date.getUTCDate(), lastDayOfTargetMonth));
  return target;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected retention error";
}
