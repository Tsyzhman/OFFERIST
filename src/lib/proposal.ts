import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import type {
  Category,
  ChangeItem,
  Priority,
  ProcessStep,
  ProofItem,
  Proposal,
  ProposalCurrency,
  ProposalData,
  ProposalDeliverable,
  ProposalEventType,
  ProposalPackage,
  ProposalStatus,
  ShareSettings,
  Status,
  Unit,
} from "./types";

export const STORAGE_KEY = "change-proposal-builder-v1";
export const SHARE_HASH_PREFIX = "proposal=";
export const DEFAULT_CURRENCY: ProposalCurrency = "RUB";

const alphabet =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const proposalStatusLabels: Record<ProposalStatus, string> = {
  draft: "Черновик",
  published: "Опубликовано",
  hidden: "Скрыто",
  expired: "Срок действия истёк",
  approved: "Одобрено",
  rejected: "Отклонено",
};

export const proposalStatusTone: Record<ProposalStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  published: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  hidden: "bg-slate-100 text-slate-700 ring-slate-200",
  expired: "bg-amber-50 text-amber-800 ring-amber-200",
  approved: "bg-teal-50 text-teal-800 ring-teal-200",
  rejected: "bg-rose-50 text-rose-800 ring-rose-200",
};

export const eventTypeLabels: Record<ProposalEventType, string> = {
  view: "Просмотр",
  package_selected: "Выбор пакета",
  cta_clicked: "Клик по CTA",
  password_success: "Пароль принят",
  password_failed: "Ошибка пароля",
};

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createShareSlug(length = 14) {
  const bytes = new Uint8Array(length);

  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

const cyrillicSlugMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function slugifyShareSlug(value: string) {
  const transliterated = value
    .toLowerCase()
    .split("")
    .map((char) => cyrillicSlugMap[char] ?? char)
    .join("");

  return transliterated
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.\s/\\]+/g, "-")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/_+/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 96);
}

export function createReadableShareSlug(title: string, date = getTodayDate()) {
  const dateSlug = formatSlugDate(date);
  const base = slugifyShareSlug(title) || "prisma";

  return slugifyShareSlug(`${base}-${dateSlug}`);
}

function formatSlugDate(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return getTodayDate();
  }

  return `${day}-${month}-${year.slice(-2)}`;
}

export function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatMoney(value: number, currency: string = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currency || DEFAULT_CURRENCY,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value?: string) {
  if (!value) {
    return "Не указано";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Не указано";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value?: string) {
  if (!value) {
    return "Нет данных";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Нет данных";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function toList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function fromList(value: string[]) {
  return value.join("\n");
}

export function isDateExpired(value?: string) {
  if (!value) {
    return false;
  }

  return new Date(`${value}T23:59:59`).getTime() < Date.now();
}

export function getEffectiveStatus(proposal: Proposal): ProposalStatus {
  if (
    (proposal.status === "published" || proposal.shareSettings.isPublished) &&
    (isDateExpired(proposal.validUntil) || isDateExpired(proposal.expiresAt))
  ) {
    return "expired";
  }

  return proposal.status;
}

export function getPublicUrl(origin: string, shareSlug: string) {
  return `${origin.replace(/\/$/, "")}/p/${shareSlug}`;
}

export function getRecommendedPackage(proposal: Proposal) {
  return (
    proposal.packages.find((item) => item.id === proposal.selectedPackageId) ??
    proposal.packages.find((item) => item.isRecommended) ??
    proposal.packages[0]
  );
}

export function sanitizePublicProposal(proposal: Proposal): Proposal {
  return {
    ...proposal,
    passwordHash: undefined,
    internalNotes: undefined,
  };
}

export function createBlankProposal(): Proposal {
  const now = new Date().toISOString();
  const title = "Новое коммерческое предложение";
  const proposalDate = getTodayDate();
  const validUntil = addDaysDate(14);
  const shareSlug = createShareSlug();

  return normalizeProposal({
    id: createId(),
    shareSlug,
    title,
    clientName: "",
    clientCompany: "",
    preparedBy: "Nikita Tsyzhman",
    preparedByRole: "Консультант по цифровым продуктам",
    proposalDate,
    validUntil,
    version: "v1.0",
    status: "draft",
    language: "ru",
    currency: DEFAULT_CURRENCY,
    shortIntro:
      "Кратко опишите суть предложения, ожидаемый результат и логику выбора решения.",
    clientContext: "",
    clientProblem: "",
    businessGoal: "",
    proposedSolutionSummary: "",
    whyUs: "",
    paymentTerms: "50% предоплата, 50% после приёмки результата.",
    legalNotes:
      "Финальные условия фиксируются в договоре и приложении с согласованным объёмом работ.",
    nextStepText:
      "Согласовать подходящий объём, зафиксировать состав работ и перейти к запуску.",
    createdAt: now,
    updatedAt: now,
    viewsCount: 0,
    expiresAt: validUntil,
    isPasswordProtected: false,
    publicNotes: "",
    internalNotes: "",
    shareSettings: createDefaultShareSettings(shareSlug, validUntil),
    assumptions: [
      "Клиент предоставляет доступы, материалы и обратную связь в согласованные сроки.",
      "Состав работ не меняется без отдельной оценки.",
    ],
    outOfScope: [
      "Работы, не перечисленные в составе предложения.",
      "Закупка платных сервисов, лицензий и внешних подрядчиков.",
    ],
    deliverables: [
      createDeliverable(
        "Аналитика и структура",
        "Фиксация требований, карты страниц и приоритетов.",
        "Команда получает понятный план работ.",
        0,
      ),
      createDeliverable(
        "Дизайн и сборка",
        "Создание ключевых экранов и адаптивной версии.",
        "Решение можно быстро показать клиентам.",
        1,
      ),
    ],
    packages: [
      createPackage(
        "Basic",
        "Минимальный запуск с базовым набором работ.",
        180000,
        "2-3 недели",
        false,
        ["Базовая структура", "Адаптивный дизайн", "Форма заявки"],
        0,
      ),
      createPackage(
        "Standard",
        "Оптимальный объём для уверенного запуска.",
        320000,
        "4-5 недель",
        true,
        ["Проработка структуры", "Ключевые страницы", "Базовая аналитика"],
        1,
      ),
      createPackage(
        "Premium",
        "Расширенный сценарий с усиленной упаковкой и поддержкой.",
        520000,
        "6-8 недель",
        false,
        ["Расширенный UX", "Интеграции", "Поддержка после запуска"],
        2,
      ),
    ],
    processSteps: [
      createProcessStep("Погружение", "Уточняем вводные, цели и ограничения.", "1-2 дня", 0),
      createProcessStep("Проектирование", "Готовим структуру и план реализации.", "3-5 дней", 1),
      createProcessStep("Реализация", "Собираем решение, тестируем и передаём.", "2-4 недели", 2),
    ],
    proofItems: [
      createProofItem(
        "Фокус на результате",
        "Работа строится вокруг бизнес-цели и критериев приёмки.",
        "Меньше итераций и быстрее согласование.",
        0,
      ),
    ],
  });
}

export function createDemoProposal(): Proposal {
  const proposal = createBlankProposal();
  const basic = createPackage(
    "Basic",
    "Быстрый запуск промо-сайта с понятной структурой и базовой упаковкой.",
    240000,
    "3 недели",
    false,
    ["До 5 страниц", "Базовая структура", "Адаптивный дизайн", "Форма заявки"],
    0,
  );
  const standard = createPackage(
    "Standard",
    "Рекомендованный пакет: полноценный сайт, сильная презентация услуги и базовая аналитика.",
    420000,
    "5 недель",
    true,
    [
      "До 8 страниц",
      "Коммерческие сообщения",
      "Дизайн ключевых страниц",
      "Формы заявок и аналитика",
      "Инструкция по обновлению",
    ],
    1,
  );
  const premium = createPackage(
    "Premium",
    "Расширенный запуск с UX-исследованием, контентной упаковкой и поддержкой после релиза.",
    690000,
    "7-8 недель",
    false,
    [
      "До 12 страниц",
      "UX-сессия",
      "Расширенный дизайн",
      "2 страницы кейсов",
      "CRM-интеграция",
      "2 недели поддержки",
    ],
    2,
  );
  const now = new Date().toISOString();
  const validUntil = addDaysDate(30);

  return normalizeProposal({
    ...proposal,
    title: "Коммерческое предложение на разработку сайта",
    clientName: "ACME Studio",
    clientCompany: "ACME Studio",
    preparedBy: "Nikita Tsyzhman",
    preparedByRole: "Product & Web Consultant",
    validUntil,
    status: "published",
    shortIntro:
      "Предлагаем разработать современный сайт, который объясняет ценность ACME Studio, собирает качественные заявки и помогает команде продаж быстрее проводить клиента к следующему шагу.",
    clientContext:
      "ACME Studio развивает B2B-направление и хочет заменить разрозненные презентации единым сайтом, где потенциальный клиент быстро понимает экспертизу, формат работы и ожидаемый результат.",
    clientProblem:
      "Сейчас входящие клиенты получают неполную картину: кейсы, услуги, процесс и условия находятся в разных материалах. Из-за этого первые переговоры тратятся на базовые объяснения.",
    businessGoal:
      "Собрать сайт, который повышает доверие, сокращает цикл первичного обсуждения и создаёт понятный маршрут от интереса к заявке.",
    proposedSolutionSummary:
      "Мы создадим структуру сайта, подготовим ключевые тексты, разработаем адаптивный дизайн, соберём страницы на выбранной платформе и настроим базовую аналитику заявок.",
    whyUs:
      "Мы соединяем продуктовую структуру, аккуратный B2B-дизайн и практичную реализацию. В результате сайт выглядит как сильный sales-инструмент.",
    paymentTerms:
      "50% предоплата после подписания договора, 30% после утверждения дизайна, 20% после приёмки и передачи проекта.",
    legalNotes:
      "Стоимость включает работы, перечисленные в выбранном пакете. Лицензии, платные сервисы и дополнительные интеграции оплачиваются отдельно.",
    nextStepText:
      "Выберите подходящий пакет или запросите обсуждение КП. После подтверждения мы зафиксируем объём, подготовим договор и стартовый план работ.",
    selectedPackageId: standard.id,
    publishedAt: now,
    expiresAt: validUntil,
    shareSettings: {
      ...proposal.shareSettings,
      isPublished: true,
      expiresAt: validUntil,
      allowPackageSelection: true,
      allowClientComment: true,
      showPrices: true,
      showTimeline: true,
      showComparisonTable: true,
      noIndex: true,
    },
    publicNotes:
      "Оценка подготовлена для обсуждения и может быть уточнена после финального брифа.",
    internalNotes:
      "Демо КП. После подключения Supabase можно заменить на реальные данные клиента.",
    assumptions: [
      "ACME Studio предоставляет бренд-материалы, доступы и референсы до старта работ.",
      "Состав страниц согласуется на этапе структуры и не расширяется без переоценки.",
      "Одна волна правок включена после презентации дизайна ключевых страниц.",
      "Контент и юридические формулировки проходят согласование на стороне клиента.",
    ],
    outOfScope: [
      "Разработка сложного личного кабинета или закрытой клиентской зоны.",
      "SEO-продвижение после запуска и регулярное ведение контента.",
      "Покупка домена, хостинга, платных плагинов и внешних сервисов.",
      "Интеграции, не перечисленные в выбранном пакете.",
    ],
    deliverables: [
      createDeliverable(
        "Структура и сценарии",
        "Карта сайта, логика блоков и сценарии движения клиента к заявке.",
        "Команда продаж получает страницу, которая отвечает на ключевые вопросы клиента.",
        0,
      ),
      createDeliverable(
        "UX/UI дизайн",
        "Адаптивные макеты главной, услуг, кейсов и контактных сценариев.",
        "Сайт выглядит современно, спокойно и убедительно для B2B-аудитории.",
        1,
      ),
      createDeliverable(
        "Разработка сайта",
        "Сборка страниц, адаптив, формы заявок и базовая техническая оптимизация.",
        "После запуска сайт можно использовать как основную клиентскую ссылку в продажах.",
        2,
      ),
      createDeliverable(
        "Аналитика и передача",
        "Настройка целей, проверка форм, инструкция для команды и финальный QA.",
        "Команда видит заявки и может самостоятельно обновлять базовый контент.",
        3,
      ),
    ],
    packages: [basic, standard, premium],
    processSteps: [
      createProcessStep("Бриф и фокусировка", "Собираем вводные, цели, ограничения, аудитории и критерии успеха.", "2 дня", 0),
      createProcessStep("Структура и прототип", "Формируем карту страниц, логику блоков и первичные тексты.", "1 неделя", 1),
      createProcessStep("Дизайн", "Готовим визуальную систему и макеты ключевых экранов.", "1-2 недели", 2),
      createProcessStep("Разработка и контент", "Собираем сайт, переносим контент, подключаем формы и аналитику.", "2 недели", 3),
      createProcessStep("QA и запуск", "Проверяем адаптив, формы, скорость и передаём проект команде.", "3-4 дня", 4),
    ],
    proofItems: [
      createProofItem(
        "B2B-логика подачи",
        "Структура строится вокруг принятия решения: задача, подход, доказательства, условия и следующий шаг.",
        "Сайт помогает продавать, а не просто рассказывать о компании.",
        0,
      ),
      createProofItem(
        "Прозрачный процесс",
        "Каждый этап имеет понятный результат и точку согласования.",
        "Меньше неопределённости и неожиданных доработок.",
        1,
      ),
      createProofItem(
        "Готовность к продажам",
        "В финале команда получает ссылку, которую можно отправлять клиентам сразу после запуска.",
        "КП, сайт и разговор продаж работают в одной логике.",
        2,
      ),
    ],
  });
}

export function normalizeProposal(value: Proposal): Proposal {
  const shareSlug = value.shareSlug || createShareSlug();
  const validUntil = value.validUntil || value.expiresAt || addDaysDate(14);
  const expiresAt = value.expiresAt || validUntil;
  const now = new Date().toISOString();
  const shareSettings: ShareSettings = {
    ...createDefaultShareSettings(shareSlug, expiresAt),
    ...value.shareSettings,
    shareSlug,
    expiresAt,
    isPublished: value.shareSettings?.isPublished ?? value.status === "published",
    accessMode: value.isPasswordProtected ? "password" : value.shareSettings?.accessMode ?? "public_link",
  };

  return {
    ...value,
    id: value.id || createId(),
    shareSlug,
    title: value.title || "Коммерческое предложение",
    clientName: value.clientName || "",
    clientCompany: value.clientCompany || "",
    preparedBy: value.preparedBy || "Nikita Tsyzhman",
    preparedByRole: value.preparedByRole || "",
    proposalDate: value.proposalDate || getTodayDate(),
    validUntil,
    version: value.version || "v1.0",
    status: value.status || "draft",
    language: "ru",
    currency: DEFAULT_CURRENCY,
    shortIntro: value.shortIntro || "",
    clientContext: value.clientContext || "",
    clientProblem: value.clientProblem || "",
    businessGoal: value.businessGoal || "",
    proposedSolutionSummary: value.proposedSolutionSummary || "",
    whyUs: value.whyUs || "",
    paymentTerms: value.paymentTerms || "",
    legalNotes: value.legalNotes || "",
    nextStepText: value.nextStepText || "",
    createdAt: value.createdAt || now,
    updatedAt: value.updatedAt || now,
    viewsCount: Math.max(0, Number(value.viewsCount) || 0),
    expiresAt,
    isPasswordProtected: value.isPasswordProtected || shareSettings.accessMode === "password",
    shareSettings,
    assumptions: Array.isArray(value.assumptions) ? value.assumptions : [],
    outOfScope: Array.isArray(value.outOfScope) ? value.outOfScope : [],
    deliverables: sortByOrder(value.deliverables ?? []),
    packages: sortByOrder(value.packages ?? []),
    processSteps: sortByOrder(value.processSteps ?? []),
    proofItems: sortByOrder(value.proofItems ?? []),
  };
}

function createDefaultShareSettings(shareSlug: string, expiresAt: string): ShareSettings {
  return {
    isPublished: false,
    shareSlug,
    accessMode: "public_link",
    expiresAt,
    allowPackageSelection: true,
    allowClientComment: false,
    showPrices: true,
    showTimeline: true,
    showComparisonTable: true,
    noIndex: true,
  };
}

function createDeliverable(
  title: string,
  description: string,
  clientValue: string,
  sortOrder: number,
): ProposalDeliverable {
  return { id: createId(), title, description, clientValue, sortOrder };
}

function createPackage(
  name: string,
  description: string,
  price: number,
  duration: string,
  isRecommended: boolean,
  features: string[],
  sortOrder: number,
): ProposalPackage {
  return {
    id: createId(),
    name,
    description,
    price,
    duration,
    isRecommended,
    features,
    sortOrder,
  };
}

function createProcessStep(
  title: string,
  description: string,
  duration: string,
  sortOrder: number,
): ProcessStep {
  return { id: createId(), title, description, duration, sortOrder };
}

function createProofItem(
  title: string,
  description: string,
  result: string,
  sortOrder: number,
): ProofItem {
  return { id: createId(), title, description, result, sortOrder };
}

function sortByOrder<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

export const categories: Category[] = [
  "Design",
  "Development",
  "Content",
  "Integration",
  "QA",
  "Management",
  "Urgent",
  "Other",
];
export const priorities: Priority[] = ["low", "medium", "high"];
export const statuses: Status[] = ["proposed", "approved", "rejected", "postponed"];
export const units: Unit[] = ["fixed", "hour", "day", "item"];

export const categoryLabels: Record<Category, string> = {
  Design: "Дизайн",
  Development: "Разработка",
  Content: "Контент",
  Integration: "Интеграции",
  QA: "QA",
  Management: "Управление",
  Urgent: "Срочно",
  Other: "Другое",
};
export const priorityLabels: Record<Priority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};
export const statusLabels: Record<Status, string> = {
  proposed: "Предложено",
  approved: "Согласовано",
  rejected: "Отклонено",
  postponed: "Отложено",
};
export const unitLabels: Record<Unit, string> = {
  fixed: "Фикс",
  hour: "Час",
  day: "День",
  item: "Позиция",
};

export function calculateItemTotal(item: ChangeItem) {
  return Math.max(0, item.price) * Math.max(1, item.quantity);
}
export function calculateRequiredSubtotal(items: ChangeItem[]) {
  return items
    .filter((item) => item.required)
    .reduce((sum, item) => sum + calculateItemTotal(item), 0);
}
export function calculateOptionalSubtotal(items: ChangeItem[]) {
  return items
    .filter((item) => item.optional && item.selected)
    .reduce((sum, item) => sum + calculateItemTotal(item), 0);
}
export function calculateGrandTotal(items: ChangeItem[]) {
  return calculateRequiredSubtotal(items) + calculateOptionalSubtotal(items);
}
export function calculateTotalDays(items: ChangeItem[]) {
  return items
    .filter((item) => item.required || (item.optional && item.selected))
    .reduce((sum, item) => sum + Math.max(0, item.estimatedDays), 0);
}
export function createEmptyChangeItem(): ChangeItem {
  return {
    id: createId(),
    title: "",
    category: "Other",
    description: "",
    clientValue: "",
    deliverables: [],
    outOfScope: [],
    price: 0,
    quantity: 1,
    unit: "fixed",
    estimatedDays: 0,
    priority: "medium",
    required: true,
    optional: false,
    selected: true,
    status: "proposed",
    dependencyNote: "",
    internalNote: "",
  };
}
export function createDemoProposalData(): ProposalData {
  const demo = createDemoProposal();
  return {
    project: {
      projectTitle: demo.title,
      clientName: demo.clientName,
      preparedBy: demo.preparedBy,
      proposalDate: demo.proposalDate,
      version: demo.version,
      currency: demo.currency,
      introSummary: demo.shortIntro,
      paymentTerms: demo.paymentTerms,
      assumptions: fromList(demo.assumptions),
      outOfScope: fromList(demo.outOfScope),
      notes: demo.internalNotes ?? "",
    },
    items: demo.deliverables.map((item, index) => ({
      ...createEmptyChangeItem(),
      id: item.id,
      title: item.title,
      category: index % 2 === 0 ? "Development" : "Design",
      description: item.description,
      clientValue: item.clientValue,
      deliverables: [item.description],
      price: demo.packages[index]?.price ?? 0,
      estimatedDays: index + 2,
      required: true,
      selected: true,
    })),
  };
}
export function encodeProposalForShare(data: ProposalData) {
  return compressToEncodedURIComponent(JSON.stringify(data));
}
export function decodeProposalFromShare(value: string) {
  const raw = value.startsWith(SHARE_HASH_PREFIX)
    ? value.slice(SHARE_HASH_PREFIX.length)
    : value;
  const decompressed = decompressFromEncodedURIComponent(raw);
  return decompressed ? normalizeProposalData(JSON.parse(decompressed)) : null;
}
export function normalizeProposalData(value: unknown): ProposalData | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as ProposalData;
  if (!candidate.project || !Array.isArray(candidate.items)) {
    return null;
  }
  return {
    project: {
      ...createDemoProposalData().project,
      ...candidate.project,
      currency: candidate.project.currency || DEFAULT_CURRENCY,
    },
    items: candidate.items.map((item) => ({
      ...createEmptyChangeItem(),
      ...item,
      id: item.id || createId(),
      price: Math.max(0, Number(item.price) || 0),
      quantity: Math.max(1, Number(item.quantity) || 1),
      estimatedDays: Math.max(0, Number(item.estimatedDays) || 0),
      required: Boolean(item.required),
      optional: Boolean(item.optional),
      selected: Boolean(item.selected),
      deliverables: Array.isArray(item.deliverables) ? item.deliverables : [],
      outOfScope: Array.isArray(item.outOfScope) ? item.outOfScope : [],
    })),
  };
}
