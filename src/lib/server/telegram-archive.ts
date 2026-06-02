import { createHash } from "node:crypto";
import {
  formatMoney,
  getPublicUrl,
  getRecommendedPackage,
} from "@/lib/proposal";
import type { Proposal } from "@/lib/types";

export const TELEGRAM_ARCHIVE_RENDER_VERSION = "telegram-v1";

const TELEGRAM_CHUNK_CHARS = 3500;
const TELEGRAM_SEND_TIMEOUT_MS = 15000;

type TelegramArchiveOptions = {
  origin?: string;
};

type TelegramApiResponse = {
  ok: boolean;
  description?: string;
  result?: {
    message_id?: number;
  };
};

export type TelegramArchivePayload = {
  text: string;
  textSha256: string;
  textChars: number;
  chunks: string[];
};

export type TelegramArchiveSendResult = {
  chatId: string;
  messageIds: number[];
  textSha256: string;
  textChars: number;
  renderVersion: string;
};

export function createTelegramArchivePayload(
  proposal: Proposal,
  options: TelegramArchiveOptions = {},
): TelegramArchivePayload {
  const text = renderProposalTelegramArchive(proposal, options);

  return {
    text,
    textSha256: createHash("sha256").update(text).digest("hex"),
    textChars: text.length,
    chunks: chunkTelegramText(text),
  };
}

export async function sendProposalArchiveToTelegram(
  proposal: Proposal,
  options: TelegramArchiveOptions = {},
): Promise<TelegramArchiveSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ARCHIVE_CHAT_ID?.trim();

  if (!token || !chatId) {
    throw new Error("Telegram archive env is not configured");
  }

  const payload = createTelegramArchivePayload(proposal, options);
  const messageIds: number[] = [];

  for (const [index, chunk] of payload.chunks.entries()) {
    const text =
      payload.chunks.length > 1
        ? [
            `KP archive part ${index + 1}/${payload.chunks.length}`,
            `Proposal ID: ${proposal.id}`,
            "",
            chunk,
          ].join("\n")
        : chunk;

    messageIds.push(await sendTelegramMessage(token, chatId, text));
  }

  return {
    chatId,
    messageIds,
    textSha256: payload.textSha256,
    textChars: payload.textChars,
    renderVersion: TELEGRAM_ARCHIVE_RENDER_VERSION,
  };
}

export function renderProposalTelegramArchive(
  proposal: Proposal,
  options: TelegramArchiveOptions = {},
) {
  const recommendedPackage = getRecommendedPackage(proposal);
  const publicUrl = options.origin
    ? getPublicUrl(options.origin, proposal.shareSlug)
    : "";
  const sections = [
    "KP archive",
    field("Proposal ID", proposal.id),
    field("Share slug", proposal.shareSlug),
    field("Public URL", publicUrl),
    field("Title", proposal.title),
    field("Client", proposal.clientName),
    field("Company", proposal.clientCompany),
    field("Prepared by", formatPerson(proposal.preparedBy, proposal.preparedByRole)),
    field("Status", proposal.status),
    field("Proposal date", proposal.proposalDate),
    field("Created at", proposal.createdAt),
    field("Updated at", proposal.updatedAt),
    field("Published at", proposal.publishedAt),
    field("Valid until", proposal.validUntil),
    field("Expires at", proposal.expiresAt),
    field("Views", String(proposal.viewsCount)),
    field("Last viewed at", proposal.lastViewedAt),
    field("Selected package", recommendedPackage?.name),
    section("Short intro", proposal.shortIntro),
    section("Client context", proposal.clientContext),
    section("Client problem", proposal.clientProblem),
    section("Business goal", proposal.businessGoal),
    section("Solution", proposal.proposedSolutionSummary),
    section("Why us", proposal.whyUs),
    section("Deliverables", renderDeliverables(proposal)),
    section("Process", renderProcessSteps(proposal)),
    section("Packages", renderPackages(proposal)),
    section("Assumptions", renderList(proposal.assumptions)),
    section("Out of scope", renderList(proposal.outOfScope)),
    section("Payment terms", proposal.paymentTerms),
    section("Legal notes", proposal.legalNotes),
    section("Public notes", proposal.publicNotes),
    section("Internal notes", proposal.internalNotes),
    section("Next step", proposal.nextStepText),
  ];

  return sections.filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function chunkTelegramText(
  text: string,
  maxChars = TELEGRAM_CHUNK_CHARS,
) {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of text.split(/\n{2,}/)) {
    const block = paragraph.trim();

    if (!block) {
      continue;
    }

    const candidate = current ? `${current}\n\n${block}` : block;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (block.length <= maxChars) {
      current = block;
      continue;
    }

    chunks.push(...splitLongBlock(block, maxChars));
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TELEGRAM_SEND_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
        signal: controller.signal,
      },
    );
    const data = (await response.json().catch(() => null)) as
      | TelegramApiResponse
      | null;

    if (!response.ok || !data?.ok || !data.result?.message_id) {
      throw new Error(data?.description || "Telegram sendMessage failed");
    }

    return data.result.message_id;
  } finally {
    clearTimeout(timeout);
  }
}

function splitLongBlock(block: string, maxChars: number) {
  const chunks: string[] = [];
  let current = "";

  for (const line of block.split("\n")) {
    if (line.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }

      for (let index = 0; index < line.length; index += maxChars) {
        chunks.push(line.slice(index, index + maxChars));
      }
      continue;
    }

    const candidate = current ? `${current}\n${line}` : line;

    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      chunks.push(current);
      current = line;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function renderDeliverables(proposal: Proposal) {
  return proposal.deliverables
    .map((item, index) =>
      [
        `${index + 1}. ${item.title}`,
        item.description,
        item.clientValue ? `Client value: ${item.clientValue}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function renderProcessSteps(proposal: Proposal) {
  return proposal.processSteps
    .map((item, index) =>
      [
        `${index + 1}. ${item.title}`,
        item.duration ? `Duration: ${item.duration}` : "",
        item.description,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function renderPackages(proposal: Proposal) {
  return proposal.packages
    .map((item, index) =>
      [
        `${index + 1}. ${item.name}${item.isRecommended ? " (recommended)" : ""}`,
        item.description,
        `Price: ${formatMoney(item.price, proposal.currency)}`,
        item.duration ? `Duration: ${item.duration}` : "",
        item.features.length ? renderList(item.features) : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function renderList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function field(label: string, value?: string) {
  const normalized = value?.trim();
  return normalized ? `${label}: ${normalized}` : "";
}

function section(title: string, value?: string) {
  const normalized = value?.trim();
  return normalized ? `\n${title}\n${normalized}` : "";
}

function formatPerson(name?: string, role?: string) {
  return [name, role].filter(Boolean).join(", ");
}
