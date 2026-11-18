# 3. План рефакторинга

Порядок выбран так, чтобы система работала после каждого этапа, а эффект по
токенам был виден рано. Новый движок включается **флагом на сеть**
(`clinic_net_profiles.settings.engine = 'tools' | 'pipeline'`), старый путь
(`ChatService.runToolLoop`) живёт до этапа 7.

Тесты с вызовами модели (`tests/cycle*.ts`, прогоны через стенд) запускаются
**только по согласованию** — каждый прогон стоит денег. Всё, что можно,
проверяется офлайн.

---

## Этап 0. Быстрая экономия в текущей архитектуре (1–2 дня)

Не меняет архитектуру, снимает часть расходов, пока идёт рефакторинг.

| Изменение | Файлы | Эффект |
|---|---|---|
| Набор инструментов по состоянию: на «Привет»/вопрос о клинике — без схем; после выбора услуги — только `get_available_slots`/`book`/… | `chat.service.ts` (`runToolLoop`, `POST_DISCOVERY_DROP` → карта «состояние → инструменты») | −2…3 тыс. токенов на часть вызовов |
| Урезать описания инструментов до 1 строки, правила — только в промпте | `local-db.service.ts`, `medflex.service.ts` (`getTools`) | −1…1,5 тыс. на вызов |
| Обрезать результаты инструментов: топ-10 вместо 30, только поля, нужные для ответа | `local-db.service.ts` (`findServices`, `findDoctorsAndSlots`) | меньше роста истории |
| Компактизация истории после каждого показа выбора, не только после записи | `chat.service.ts` (`compactSearchResults`) | −30…50 % на длинных диалогах |
| Разобрать пустой ответ на кнопку «Магнитно-резонансный томограф» | `qwen3.service.ts` (`content ?? ''`, вероятно reasoning без content) | исправление бага |

Проверка: офлайн-замер размера контекста скриптом (как `toolsize.js`), затем
один согласованный прогон 3–5 сценариев и сравнение по `token_usage`.

---

## Этап 1. Доменная модель и порты (3–4 дня)

Цель: ядро перестаёт знать про форматы МИС.

- `src/core/domain/*.ts` — доменные типы (`Slot`, `Appointment`, …).
- `src/core/ports/booking.port.ts`, `catalog-source.port.ts`, `llm.port.ts`,
  `session-store.port.ts`.
- `src/adapters/mis/local/` — выделить из `local-db.service.ts`:
  - `local-booking.adapter.ts` (слоты, запись, отмена, перенос, заявки),
  - `local-catalog.source.ts` (клиники, врачи, услуги),
  - схемы инструментов остаются в старом файле только для движка `tools`.
- `src/adapters/mis/medflex/` — то же из `medflex.service.ts`; `dtSlot`,
  `uuid` прячутся в `Slot.ref`.
- `src/adapters/mis/infoclinica/` — то же.
- `BookingService` → фабрика `BookingPort` по профилю сети.

Проверка: юнит-тесты адаптеров на моках (`medflex-mock` уже есть), без модели.

**Статус: выполнен (2026-11-18).** Что сделано и чем отличается от плана:

| Файл | Что внутри |
|---|---|
| `src/core/domain/` | `Clinic`, `Doctor`, `Service`, `VisitService`, `Slot`, `SlotQuery`, `Appointment`, `BookingRequest`, `BookingOutcome` (`booked` / `conflict` / `rejected` + причина), `PatientData`, `PatientIdentity` |
| `src/core/ports/` | `BookingPort` + `BookingCapabilities`, `resolveSlot`, `CatalogSourcePort`, `LlmPort`, `SessionStore` + `InMemorySessionStore` |
| `src/adapters/mis/local/` | `LocalBookingAdapter`, `LocalCatalogSource` |
| `src/adapters/mis/medflex/` | `MedflexBookingAdapter` (dt_start/dt_end, specialityId, цена — в `Slot.ref`), `MedflexCatalogSource` |
| `src/adapters/mis/infoclinica/` | `InfoclinicaBookingAdapter`, `InfoclinicaCatalogSource` (ref записи `schedId@filial`) |
| `src/adapters/mis/shared/` | маппинг слотов и записей, комментарий с данными гостя, заявки оператору (общие для всех МИС) |
| `src/adapters/mis/mis-registry.service.ts` | `MisRegistry.forNet(clinicNetId)` → `{ booking, catalog }` по `clinic_nets.mis` |
| `src/llm/llm-router.service.ts` | `LlmRouter implements LlmPort`; `ChatService.callLlm` теперь вызывает его |
| `src/mcp/mcp.service.ts` | тонкая обёртка над `MisRegistry`: `clinicNetId` обязателен; добавлен `get_visit_services`; запись — по `startTime`, слот находится через `resolveSlot` |

- Адаптеры **делегируют** в существующие `LocalDbService` / `MedflexService` /
  `InfclinicaService`, а не переносят их код: старый движок с инструментами
  работает без изменений. Физический перенос SQL и удаление `getTools` /
  `executeTool` — на этапе 7.
- В `MedflexService` создание клиента вынесено в `clientFor()`;
  `getCachedLpus`, `getCachedSpecialities`, `findConflictingAppointment` стали
  публичными.
- Все адаптеры ограничены сетью: слоты, запись, отмена, перенос — только в
  клиниках сети и только своих записей пациента.
- Найдена ошибка старого пути: `LocalDbService.bookAppointment` с `doctorId` и
  `serviceId` создаёт запись **на услугу** (`service_appointments`) и теряет
  врача. Промпт велит передавать `serviceId` типа приёма — значит, записи к
  врачу с выбранным «первичный/повторный» попадут не в ту таблицу (по коду;
  в текущей базе таких записей нет). Адаптер это обходит (тип приёма — в
  комментарии); старый путь не исправлен.
- Гостевая запись в локальной БД раньше теряла ФИО и телефон (в таблицах
  записей нет полей пациента). Адаптер кладёт их в комментарий.
- Добавлен `@types/jest` (jest был настроен, но тестов не было).

Проверки:
- юнит-тесты: `npx jest adapters core` — 20 тестов;
- реальная БД через MCP (сеть 2): клиники, врачи, слоты, МРТ по неделе, отказ
  чужой сети, запись гостя → повтор отклонён → тестовая запись удалена;
- мок MedFlex: каталог, слоты врача и услуги, запись, список записей,
  отмена.

---

## Этап 2. Профиль сети и слои промптов (2–3 дня)

- Миграция `016_clinic_net_profiles.sql`:
  - `clinic_net_profiles (clinic_net_id PK, settings jsonb, updated_at)`;
  - `clinic_prompt_layers (id, clinic_net_id NULL = ядро, task, version, content, active, created_at)`;
  - перенос `mis`, ключей, токенов ботов из `clinic_nets` в профиль
    (старые колонки читаются как fallback, удаляются на этапе 7);
  - удалить неиспользуемую `clinic_net_configs`.
- `src/core/prompts/prompt-builder.service.ts` — сборка «ядро + слой сети +
  переменные», кеш, хеш версии.
- `clinics/profiles/xxi-vek.yaml`, `clinics/profiles/21-vek-spb.yaml`,
  `clinics/prompts/<net>/*.md` + скрипт сида `npm run clinics:seed`.
- `token_usage`: колонки `task`, `prompt_hash`.
- Текущий `system-prompt.txt` разрезать: общие правила → `core/answer.md`,
  специфика (MedFlex-поля, «первичный/повторный») → слой сети / код движка.
  Для движка `tools` старый промпт продолжает собираться как раньше.
- Синонимы `SERVICE_ABBREVIATIONS` → `synonyms` в профиле.

Проверка: снапшот-тесты собранных промптов для каждой сети.

**Статус: выполнен (2026-11-18).** По решению — слои промптов и профили только в
репозитории (без таблиц `clinic_net_profiles` / `clinic_prompt_layers`):

| Файл | Что внутри |
|---|---|
| `src/clinics/core/profile.yaml` | профиль по умолчанию: движок, флаги сценариев, поля пациента, подсказки «симптом → специальность», шаблоны, справка |
| `src/clinics/nets/<slug>/profile.yaml` | профиль сети (`clinicNetId` внутри), сливается с профилем по умолчанию; есть `xxi-vek` (2) и `21-vek-spb` (1) |
| `src/clinics/core/prompts/<task>.md` | ядро промптов; `legacy.md` — бывший `src/prompts/system-prompt.txt` (без изменений) |
| `src/clinics/core/prompts/mis/<mis>/<task>.md`, `src/clinics/nets/<slug>/prompts/<task>.md` | необязательные слои МИС и сети |
| `src/core/profile/` | схема профиля (zod), `ClinicProfileService` — загрузка и проверка при старте |
| `src/core/prompts/prompt-builder.service.ts` | `PromptBuilder.build(task, {clinicNetId, mis}, vars)` → текст + хеш версии; неизвестная `{{переменная}}` — ошибка |
| `migrations/016_token_usage_task.sql` | `token_usage.task`, `token_usage.prompt_hash` |

- `ChatService` собирает legacy-промпт через `PromptBuilder`; для обеих сетей
  итоговый текст побайтно совпадает с прежним. `CHAT_SYSTEM_PROMPT` по-прежнему
  заменяет ядро.
- Файлы `src/clinics/**/*.{md,yaml}` попадают в `dist` через assets `nest-cli.json`;
  строка `COPY src/prompts` из Dockerfile убрана.
- Добавлена зависимость `js-yaml`.
- Таблица `clinic_net_configs` не удалена (не используется, но удаление
  данных — отдельное решение). Разделение `legacy.md` на ядро и слой MedFlex
  не делалось: legacy-движок уходит на этапе 7, новые промпты пишутся сразу
  слоями.

---

## Этап 3. Гибридный поиск по каталогу (4–5 дней)

- Миграция `017_catalog_index.sql`: `pg_trgm`, таблица `catalog_index`,
  индексы GIN (tsv), GIN trgm (title), HNSW (embedding).
- `src/adapters/embeddings/` — порт `EmbeddingPort` + реализация
  (решение по модели — см. «Открытые вопросы»).
- `src/core/catalog/catalog-indexer.service.ts` — построение индекса из
  `CatalogSourcePort` + синонимы профиля; команда `npm run catalog:reindex
  -- --net=2`; для внешних МИС — по расписанию.
- `src/core/catalog/catalog-search.service.ts` — FTS + trigram + vector,
  RRF, решение «лидер / список / пусто».
- Золотой набор: `tests/catalog/golden-xxi-vek.json` — 100–150 запросов
  пациентов → ожидаемая услуга/специальность (собрать из реальных диалогов
  и прайса: «узи щитовидки», «фгдс», «мрт головы», «к нестеровой», «болит
  спина»). Метрики: recall@5, top-1 accuracy. Запуск без LLM.
- Подключение к движку `tools` как замена `find_services` / `find_doctors`
  внутри — сразу улучшает текущий чат, пока нет нового движка.

**Статус: выполнен, кроме векторной части (2026-11-18).**

| Файл | Что внутри |
|---|---|
| `migrations/017_catalog_index.sql` | `catalog_index`: tsvector (название — вес A), trgm-индекс названия, `vector(1024)` + HNSW, `content_hash`, `meta` |
| `src/core/catalog/text.ts` | нормализация, синонимы для индекса и запроса (прямые и обратные: «компьютерный томограф» → «кт») |
| `src/core/catalog/catalog-indexer.service.ts` | документы услуг, врачей и специальностей; upsert, удаление исчезнувших, эмбеддинги только для изменившихся |
| `src/core/catalog/catalog-search.service.ts` | FTS + триграммы + векторы, RRF, покрытие слов запроса; `decide()` → single / choice / none |
| `src/core/catalog/catalog.module.ts` | переиндексация сетей с локальной БД при старте |
| `src/adapters/embeddings/cloudru-embeddings.service.ts` | эмбеддинги cloud.ru (`BAAI/bge-m3`), выключены по умолчанию (`EMBEDDINGS_ENABLED`) |
| `src/cli/catalog-reindex.ts`, `src/cli/catalog-eval.ts` | переиндексация сети; оценка по золотому набору |
| `src/clinics/nets/xxi-vek/golden-search.yaml` | 47 запросов: как в прайсе, сокращения, разговорно, опечатки, падежи, симптомы, фамилии |

- Общие синонимы (узи, мрт, кт, экг, фгдс, лор, окулист, кожник, зубной …)
  перенесены в `core/profile.yaml`, особенности сети — в её профиль.
- Текущий чат: `find_services` в сетях с локальной БД идёт через индекс
  (`BookingService.findServicesIndexed`); отбираются результаты с лучшим
  покрытием, если совпало ≥ ⅔ слов запроса.
- Золотой набор без векторов: top-5 — 91 %, top-1 — 87 %. Промахи — смысловые
  («детский врач») и симптомы (их закрывают подсказки профиля в движке).
- Эмбеддинги (2026-11-18): `BAAI/bge-m3`, 1742 документа обеих сетей —
  56 пачек, 51 тыс. токенов. Включаются `EMBEDDINGS_ENABLED=true` (.env,
  проброшено в `docker-compose.server.yml`); при старте пересчитываются только
  изменившиеся документы.
- Золотой набор с векторами: top-5 — **98 %** (было 91 %), top-1 — 87 %;
  симптомы в top-5 — 3/3 (было 0/3). 47 запросов — 300 токенов эмбеддингов.
  Осталось: «детский врач» (top-5 мимо) и порядок внутри top-5 для «экг».

---

## Этап 4. NLU (3–4 дня)

- `src/core/nlu/nlu.schema.ts` — JSON-схема (zod) интентов и сущностей.
- `src/core/nlu/rule-parser.ts` — без модели: payload кнопок, да/нет,
  номер варианта, относительные даты (есть `date-utils.ts`), телефон, ДР.
- `src/core/nlu/nlu.service.ts` — вызов модели через `LlmPort` с
  `response_format` (проверить поддержку structured output у cloud.ru и
  GigaChat; иначе JSON в тексте + валидация + 1 повтор).
- `clinics/prompts/core/nlu.md` + слои сетей.
- Набор `tests/nlu/cases.json` (~150 реплик → ожидаемый JSON). Прогон с
  моделью — по согласованию; оценка стоимости прогона заранее (~150 × 1 тыс.
  токенов).

**Статус: выполнен (2026-11-18).**

| Файл | Что внутри |
|---|---|
| `src/core/nlu/frame.ts` | фрейм (цель, предмет, тип вопроса, ограничения, да/нет, выбор, правки, очередь целей): zod + JSON Schema без union-типов |
| `src/core/nlu/rule-parser.ts` | без модели: приветствие, «мои записи», да/нет, номер/время/фамилия варианта, тип приёма, день и время, ФИО + телефон + дата рождения |
| `src/core/nlu/nlu.service.ts` | правила → один вызов модели по схеме → один повтор → `goal=other` |
| `src/clinics/core/prompts/nlu.md` | промпт разбора (~400 токенов); состояние диалога — в сообщении пользователя |
| `src/llm/*` | `completeJson`: Qwen — `response_format` + `enable_thinking: false`; GigaChat — принудительный `function_call`; OpenAI — `response_format`; прочие — JSON в тексте |
| `src/clinics/core/nlu-cases.yaml`, `src/cli/nlu-eval.ts` | 30 реплик для оценки (вызывает модель) |

Прогон на Qwen3.5-397B (2026-11-18): **30/30**, ≈ 950 входных и ≈ 35 выходных
токенов на вызов, ~1,8 с на вызов.
- На cloud.ru `response_format: json_schema` обрывает ответ после первых
  полей (`{"goal","subject"}` без `entities` — 4/30). Для Qwen используется
  `json_object`; формат полей описан в промпте, проверка — zod.
- Набор составлен вместе с промптом, два примера промпта совпадают с
  репликами набора — на новых формулировках точность будет ниже; набор
  нужно пополнять реальными репликами.
- GigaChat не проверялся (TLS-сертификат в образе — отложено, работаем с Qwen).

---

## Этап 5. Dialog Engine и шаблоны ответов (5–7 дней)

- `src/core/dialog/dialog-engine.ts`, `dialog-state.ts`.
- `src/core/dialog/flows/`: `book-doctor`, `book-service`, `cancel`,
  `reschedule`, `my-appointments`, `price`, `symptoms`, `clinic-info`,
  `operator-request`.
- Перенос в сценарии логики из `chat.service.ts`: pendingConfirmation,
  pendingConflict, гостевой режим, компактизация (больше не нужна),
  проверки дат.
- `src/core/render/templates.ru.ts` + переопределения из профиля;
  `quickReplies` в ответе API (`chat.types.ts`).
- `src/core/dialog/answer.service.ts` — свободный ответ модели (`answer`,
  `symptoms`).
- `ChatService.sendMessage` → роутер по `settings.engine`.
- Офлайн-тесты сценариев: NLU замокан, адаптер — local на тестовой БД или
  мок. Перенос сценариев из `tests/cycle*.ts` в этот формат.

**Статус: выполнен (2026-11-18), включается флагом.**

| Файл | Что внутри |
|---|---|
| `src/core/dialog/dialog-engine.service.ts` | движок: фрейм → требования цели (кто → направление → время → тип приёма → данные → подтверждение); вопросы (расписание, цена, адрес, часы, без записи, есть ли услуга); мои записи, отмена, перенос; конфликт; очередь целей |
| `src/core/dialog/target-resolver.ts` | врач / услуга / специальность (все написания одной группой, детский/взрослый) / симптом через подсказки профиля |
| `src/core/dialog/dates.ts`, `dialog-state.ts`, `render.ts` | даты, состояние, шаблоны ответов с кнопками (тексты переопределяются в профиле) |
| `src/core/dialog/answer.service.ts` | свободные ответы: `answer`, `symptoms`, запасной агент `agent` (поиск + клиники, ≤ 2 вызова, без записи) |
| `src/core/dialog/guards.ts` | инъекции, экстренные случаи (перенесены из ChatService) |
| `src/core/dialog/pipeline-chat.service.ts` | сессии (`InMemorySessionStore`), API как у старого чата + `quickReplies` и `payload` |
| `src/clinics/core/prompts/{answer,symptoms,agent}.md` | промпты свободных ответов |

- `ChatService.sendMessage`: если в профиле сети `engine: pipeline` — ход
  обрабатывает новый движок; иначе — прежний. Сейчас у обеих сетей `tools`.
- Расход пишется в `token_usage` с `task` = nlu / symptoms / answer / agent.
- Офлайн-сценарии (`dialog-engine.spec.ts`, 12): три примера из
  04-dialog-model, занятое время, направление (есть / нет), конфликт, отмена +
  запись в одной реплике, гость без записей, экстренное, агент, кнопка стенда.
- На реальной базе (сеть 2) запись на УЗИ кнопками и текстом прошла целиком
  с **0 вызовов модели**.

---

## Этап 6. Каналы и кнопки (2–3 дня)

- `frontend/src/components/ChatWidget.tsx` — рендер `quickReplies`,
  отправка payload.
- `messengers/telegram`, `messengers/max` — inline-клавиатуры.
- `21vek/stand/assets/stand/stand.js` — кнопки «Записаться» шлют payload
  (`{intent:'book_service', serviceId}` / `{intent:'book_doctor', doctorId}`)
  вместо текста → ни поиска, ни модели на первом шаге. Список `NOT_DOCTORS`
  больше не нужен, если у карточек есть id.

**Статус: выполнен, кроме MAX (2026-11-18).**
- Ответ API: `quickReplies: [{label, payload}]`; запрос: `payload`
  (`choice:N`, `yes`, `no`, `book:service:<название>`, `book:doctor:<фамилия>`).
- `frontend/src/components/ChatWidget.tsx` — кнопки под сообщениями.
- `21vek/stand/pages/chat.html` — кнопки сервера, если пришли; иначе прежние
  подсказки по тексту (для старого движка). `stand.js` передаёт payload
  карточек (`autoPayload` / postMessage). На стенде у карточек нет id, поэтому
  payload — по названию; `NOT_DOCTORS` остаётся.
- Telegram — инлайн-клавиатура, нажатие → `payload`.
- MAX — без кнопок: формат клавиатуры их API не проверен. Варианты в тексте
  пронумерованы, «2» / «да» / «10:30» разбираются правилами без модели.

---

## Этап 7. Переключение и уборка (2–3 дня)

- Сеть 2 («XXI Век») → `engine: pipeline`, сравнение по `token_usage` и
  качеству на согласованном наборе сценариев.
- Затем остальные сети.
- Удаление: `runToolLoop` и схемы инструментов (`getTools`) из адаптеров,
  `system-prompt*.txt`, колонки конфигурации в `clinic_nets`, `qwen.service.ts`
  если не используется.
- MCP (`src/mcp`): либо удалить, либо оставить тонкий фасад над
  `BookingPort` + `CatalogSearch` для внешних агентов (решение — за вами).

---

**Проверка нового движка сценариями (2026-11-18).** `tests/pipeline/` — 40 сценариев
(темы cycle3–5 на данных сети 2), прогон через HTTP с `engine: pipeline`
(разрешается только при `CHAT_ALLOW_ENGINE_OVERRIDE=true`), тестовые записи
удаляются. Судья — Claude по расшифровкам:
`tests/results/pipeline/2026-11-18T12-33-27/JUDGE.md`. Итог: 40/40 по БД, открытых
замечаний по набору нет; 49 вызовов модели, 46 тыс. входных токенов на все 40
сценариев. По ходу исправлено 21 дефект движка и поиска (список — в JUDGE.md).

**Статус этапа 7: сравнение со старым движком отложено (дорого).**
Как включить новый движок для сети: в `src/clinics/nets/<slug>/profile.yaml`
написать `engine: pipeline`, пересобрать бэкенд. Откат — `engine: tools`.

## Сводка

| Этап | Срок (оценка) | Модель нужна для проверки? |
|---|---|---|
| 0. Быстрая экономия | 1–2 дня | один короткий прогон |
| 1. Домен и порты | 3–4 дня | нет |
| 2. Профиль и слои промптов | 2–3 дня | нет |
| 3. Гибридный поиск | 4–5 дней | нет (только эмбеддинги) |
| 4. NLU | 3–4 дня | да, набор реплик |
| 5. Dialog Engine | 5–7 дней | нет (офлайн), финал — да |
| 6. Каналы и кнопки | 2–3 дня | нет |
| 7. Переключение | 2–3 дня | да, сравнительный прогон |

Этапы 1–3 можно частично вести параллельно. Этап 3 даёт пользу и старому
движку.

## Решения (2026-11-18)

- **Эмбеддинги** — через API cloud.ru (модель с хорошим русским выбрать из
  каталога cloud.ru; размерность вектора фиксируется в миграции 017).
- **Модель для NLU и ответов** — текущая Qwen3.5-397B и GigaChat Pro
  (`GIGACHAT_CREDENTIALS`); подбор после рефакторинга, тестами.
- **MCP** — остаётся тонким фасадом над `BookingPort` + `CatalogSearch`
  (этап 7).
- **Разнообразие сценариев** — фрейм «цель + ограничения», резолвер
  требований, обработчики вопросов и урезанный агент как запасной путь
  ([04-dialog-model.md](04-dialog-model.md)). На этапе 5 добавляются:
  `src/core/dialog/resolver.ts`, `src/core/dialog/questions/*` (schedule, price,
  address, hours, walk_in, has_service), `src/core/dialog/agent-fallback.ts`
  (только читающие инструменты, лимит 2–3 вызова), лог пути каждого хода.

## Открытые вопросы

1. **Structured output**: поддерживают ли cloud.ru (Qwen3.5) и GigaChat Pro
   JSON-схему ответа — проверить одним запросом к каждому (по согласованию).
2. **Где редактировать слои промптов** — только через репозиторий + сид или
   нужна админка?
