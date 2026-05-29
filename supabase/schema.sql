create extension if not exists pgcrypto;

create or replace function public.generate_share_slug()
returns text
language sql
as $$
  select rtrim(translate(encode(gen_random_bytes(10), 'base64'), '+/', '-_'), '=');
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.proposals (
  id text primary key default gen_random_uuid()::text,
  share_slug text not null unique default public.generate_share_slug(),
  title text not null,
  client_name text not null default '',
  client_company text not null default '',
  prepared_by text not null default '',
  prepared_by_role text not null default '',
  proposal_date date not null default current_date,
  valid_until date not null default current_date + interval '14 days',
  version text not null default 'v1.0',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'hidden', 'expired', 'approved', 'rejected')),
  language text not null default 'ru' check (language = 'ru'),
  currency text not null default 'RUB' check (currency = 'RUB'),
  short_intro text not null default '',
  client_context text not null default '',
  client_problem text not null default '',
  business_goal text not null default '',
  proposed_solution_summary text not null default '',
  why_us text not null default '',
  payment_terms text not null default '',
  legal_notes text not null default '',
  next_step_text text not null default '',
  selected_package_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  last_viewed_at timestamptz,
  views_count integer not null default 0,
  expires_at date not null default current_date + interval '14 days',
  is_password_protected boolean not null default false,
  password_hash text,
  public_notes text,
  internal_notes text,
  is_published boolean not null default false,
  access_mode text not null default 'public_link'
    check (access_mode in ('public_link', 'password')),
  allow_package_selection boolean not null default true,
  allow_client_comment boolean not null default false,
  show_prices boolean not null default true,
  show_timeline boolean not null default true,
  show_comparison_table boolean not null default true,
  no_index boolean not null default true,
  assumptions text[] not null default '{}',
  out_of_scope text[] not null default '{}',
  constraint password_hash_required
    check (
      (is_password_protected = false and access_mode = 'public_link')
      or
      (is_password_protected = true and access_mode = 'password' and password_hash is not null)
    )
);

drop trigger if exists proposals_set_updated_at on public.proposals;
create trigger proposals_set_updated_at
before update on public.proposals
for each row execute function public.set_updated_at();

create table if not exists public.deliverables (
  id text primary key default gen_random_uuid()::text,
  proposal_id text not null references public.proposals(id) on delete cascade,
  title text not null,
  description text not null default '',
  client_value text not null default '',
  sort_order integer not null default 0
);

create table if not exists public.packages (
  id text primary key default gen_random_uuid()::text,
  proposal_id text not null references public.proposals(id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(14, 2) not null default 0,
  duration text not null default '',
  is_recommended boolean not null default false,
  features text[] not null default '{}',
  sort_order integer not null default 0
);

create table if not exists public.process_steps (
  id text primary key default gen_random_uuid()::text,
  proposal_id text not null references public.proposals(id) on delete cascade,
  title text not null,
  description text not null default '',
  duration text not null default '',
  sort_order integer not null default 0
);

create table if not exists public.proof_items (
  id text primary key default gen_random_uuid()::text,
  proposal_id text not null references public.proposals(id) on delete cascade,
  title text not null,
  description text not null default '',
  result text not null default '',
  sort_order integer not null default 0
);

create table if not exists public.proposal_events (
  id text primary key default gen_random_uuid()::text,
  proposal_id text not null references public.proposals(id) on delete cascade,
  event_type text not null
    check (event_type in ('view', 'package_selected', 'cta_clicked', 'password_success', 'password_failed')),
  package_id text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  user_agent text,
  referrer text
);

create index if not exists proposals_share_slug_idx on public.proposals(share_slug);
create index if not exists proposals_status_idx on public.proposals(status);
create index if not exists proposal_events_proposal_id_created_at_idx
  on public.proposal_events(proposal_id, created_at desc);

do $$
declare
  proposal_id text := gen_random_uuid()::text;
  generated_slug text := public.generate_share_slug();
begin
  if not exists (
    select 1
    from public.proposals
    where title = 'Коммерческое предложение на разработку сайта'
  ) then
    insert into public.proposals (
      id,
      share_slug,
      title,
      client_name,
      client_company,
      prepared_by,
      prepared_by_role,
      proposal_date,
      valid_until,
      version,
      status,
      language,
      currency,
      short_intro,
      client_context,
      client_problem,
      business_goal,
      proposed_solution_summary,
      why_us,
      payment_terms,
      legal_notes,
      next_step_text,
      selected_package_id,
      published_at,
      expires_at,
      is_published,
      allow_package_selection,
      allow_client_comment,
      show_prices,
      show_timeline,
      show_comparison_table,
      no_index,
      assumptions,
      out_of_scope,
      public_notes,
      internal_notes
    ) values (
      proposal_id,
      generated_slug,
      'Коммерческое предложение на разработку сайта',
      'ACME Studio',
      'ACME Studio',
      'Nikita Tsyzhman',
      'Product & Web Consultant',
      current_date,
      current_date + interval '30 days',
      'v1.0',
      'published',
      'ru',
      'RUB',
      'Предлагаем разработать современный сайт, который объясняет ценность ACME Studio, собирает качественные заявки и помогает команде продаж быстрее проводить клиента к следующему шагу.',
      'ACME Studio развивает B2B-направление и хочет заменить разрозненные презентации единым сайтом, где потенциальный клиент быстро понимает экспертизу, формат работы и ожидаемый результат.',
      'Сейчас входящие клиенты получают неполную картину: кейсы, услуги, процесс и условия находятся в разных материалах.',
      'Собрать сайт, который повышает доверие, сокращает цикл первичного обсуждения и создаёт понятный маршрут от интереса к заявке.',
      'Мы создадим структуру сайта, подготовим ключевые тексты, разработаем адаптивный дизайн, соберём страницы на выбранной платформе и настроим базовую аналитику заявок.',
      'Мы соединяем продуктовую структуру, аккуратный B2B-дизайн и практичную реализацию.',
      '50% предоплата после подписания договора, 30% после утверждения дизайна, 20% после приёмки и передачи проекта.',
      'Стоимость включает работы, перечисленные в выбранном пакете. Лицензии, платные сервисы и дополнительные интеграции оплачиваются отдельно.',
      'Выберите подходящий пакет или запросите обсуждение КП. После подтверждения мы зафиксируем объём, подготовим договор и стартовый план работ.',
      'pkg-standard',
      now(),
      current_date + interval '30 days',
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      array[
        'ACME Studio предоставляет бренд-материалы, доступы и референсы до старта работ.',
        'Состав страниц согласуется на этапе структуры и не расширяется без переоценки.',
        'Одна волна правок включена после презентации дизайна ключевых страниц.'
      ],
      array[
        'Разработка сложного личного кабинета или закрытой клиентской зоны.',
        'SEO-продвижение после запуска и регулярное ведение контента.',
        'Покупка домена, хостинга, платных плагинов и внешних сервисов.'
      ],
      'Оценка подготовлена для обсуждения и может быть уточнена после финального брифа.',
      'Демо КП для проверки публичной ссылки.'
    );

    insert into public.packages (id, proposal_id, name, description, price, duration, is_recommended, features, sort_order)
    values
      ('pkg-basic', proposal_id, 'Basic', 'Быстрый запуск промо-сайта с понятной структурой и базовой упаковкой.', 240000, '3 недели', false, array['До 5 страниц', 'Базовая структура', 'Адаптивный дизайн', 'Форма заявки'], 0),
      ('pkg-standard', proposal_id, 'Standard', 'Рекомендованный пакет: полноценный сайт, сильная презентация услуги и базовая аналитика.', 420000, '5 недель', true, array['До 8 страниц', 'Коммерческие сообщения', 'Дизайн ключевых страниц', 'Формы заявок и аналитика', 'Инструкция по обновлению'], 1),
      ('pkg-premium', proposal_id, 'Premium', 'Расширенный запуск с UX-исследованием, контентной упаковкой и поддержкой после релиза.', 690000, '7-8 недель', false, array['До 12 страниц', 'UX-сессия', 'Расширенный дизайн', '2 страницы кейсов', 'CRM-интеграция', '2 недели поддержки'], 2);

    insert into public.deliverables (proposal_id, title, description, client_value, sort_order)
    values
      (proposal_id, 'Структура и сценарии', 'Карта сайта, логика блоков и сценарии движения клиента к заявке.', 'Команда продаж получает страницу, которая последовательно отвечает на ключевые вопросы клиента.', 0),
      (proposal_id, 'UX/UI дизайн', 'Адаптивные макеты главной, услуг, кейсов и контактных сценариев.', 'Сайт выглядит современно, спокойно и убедительно для B2B-аудитории.', 1),
      (proposal_id, 'Разработка сайта', 'Сборка страниц, адаптив, формы заявок и базовая техническая оптимизация.', 'После запуска сайт можно использовать как основную клиентскую ссылку в продажах.', 2),
      (proposal_id, 'Аналитика и передача', 'Настройка целей, проверка форм, инструкция для команды и финальный QA.', 'Команда видит заявки и может самостоятельно обновлять базовый контент.', 3);

    insert into public.process_steps (proposal_id, title, description, duration, sort_order)
    values
      (proposal_id, 'Бриф и фокусировка', 'Собираем вводные, цели, ограничения, аудитории и критерии успеха.', '2 дня', 0),
      (proposal_id, 'Структура и прототип', 'Формируем карту страниц, логику блоков и первичные тексты.', '1 неделя', 1),
      (proposal_id, 'Дизайн', 'Готовим визуальную систему и макеты ключевых экранов.', '1-2 недели', 2),
      (proposal_id, 'Разработка и контент', 'Собираем сайт, переносим контент, подключаем формы и аналитику.', '2 недели', 3),
      (proposal_id, 'QA и запуск', 'Проверяем адаптив, формы, скорость и передаём проект команде.', '3-4 дня', 4);

    insert into public.proof_items (proposal_id, title, description, result, sort_order)
    values
      (proposal_id, 'B2B-логика подачи', 'Структура строится вокруг принятия решения: задача, подход, доказательства, условия и следующий шаг.', 'Сайт помогает продавать, а не просто рассказывать о компании.', 0),
      (proposal_id, 'Прозрачный процесс', 'Каждый этап имеет понятный результат и точку согласования.', 'Меньше неопределённости и неожиданных доработок.', 1),
      (proposal_id, 'Готовность к продажам', 'В финале команда получает ссылку, которую можно отправлять клиентам сразу после запуска.', 'КП, сайт и разговор продаж работают в одной логике.', 2);
  end if;
end $$;
