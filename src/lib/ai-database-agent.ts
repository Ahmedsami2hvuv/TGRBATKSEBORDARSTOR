import { createHash, randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const excludedModels = new Set([
  "AIConfig",
  "GeminiApiKey",
  "TelegramBot",
  "TelegramBotSession",
  "TelegramAdmin",
  "WebPushSubscription",
  "UISystemSetting",
  "SystemBackground",
  "UserBackgroundSelection",
  "SchemaPlaceholder",
]);
const secretNamePattern =
  /password|token|secret|api.?key|access.?key|private.?key|encryption.?key|credential|authorization|otp|pin|hash|^key$/i;
const blockedWriteModels = new Set([
  "GlobalSettings",
  "UISystemSetting",
  "AIConfig",
  "GeminiApiKey",
  "TelegramBot",
  "TelegramBotSession",
  "TelegramAdmin",
  "WebPushSubscription",
  "SystemBackground",
  "UserBackgroundSelection",
]);
const blockedWriteFields = new Set(["id", "createdAt", "updatedAt"]);
const allowedFilterOperators = new Set([
  "equals",
  "contains",
  "startsWith",
  "endsWith",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "notIn",
]);

type DatabasePlan = {
  kind: "query" | "change" | "answer";
  model?: string;
  mode?: "rows" | "count" | "aggregate";
  filters?: Record<string, unknown>;
  select?: string[];
  include?: string[];
  aggregate?: {
    sum?: string[];
    average?: string[];
    min?: string[];
    max?: string[];
  };
  orderBy?: { field: string; direction: "asc" | "desc" };
  take?: number;
  operation?: "create" | "update" | "delete";
  data?: Record<string, unknown>;
  message?: string;
};

export type DatabaseAction = {
  nonce: string;
  operation: "create" | "update" | "delete";
  model: string;
  filters: Record<string, unknown>;
  data: Record<string, unknown>;
  affectedIds: Array<string | number>;
  snapshotHash: string;
};

type FieldMetadata = {
  name: string;
  type: string;
  kind: string;
  isList: boolean;
  isRequired: boolean;
  isId: boolean;
  hasDefaultValue: boolean;
};

type ModelMetadata = {
  name: string;
  fields: FieldMetadata[];
};

type DynamicDelegate = {
  findMany(args: object): Promise<unknown[]>;
  count(args: object): Promise<number>;
  aggregate(args: object): Promise<unknown>;
  create(args: object): Promise<unknown>;
  updateMany(args: object): Promise<{ count: number }>;
  deleteMany(args: object): Promise<{ count: number }>;
};

const modelMetadata = Prisma.dmmf.datamodel.models
  .filter((model) => !excludedModels.has(model.name) && !secretNamePattern.test(model.name))
  .map((model) => ({
    name: model.name,
    fields: model.fields
      .filter(
        (field) =>
          !secretNamePattern.test(field.name) &&
          (field.kind === "scalar" || field.kind === "enum") &&
          !field.isList &&
          field.type !== "BigInt",
      )
      .map((field) => ({
        name: field.name,
        type: field.type,
        kind: field.kind,
        isList: field.isList,
        isRequired: field.isRequired,
        isId: field.isId,
        hasDefaultValue: field.hasDefaultValue,
      })),
  }));

const modelMap = new Map(modelMetadata.map((model) => [model.name, model]));
const relationMap = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [
    model.name,
    model.fields
      .filter(
        (field) =>
          field.kind === "object" &&
          modelMap.has(field.type),
      )
      .map((field) => ({ name: field.name, model: field.type, isList: field.isList })),
  ]),
);
const enumValues = new Map(
  Prisma.dmmf.datamodel.enums.map((item) => [item.name, new Set(item.values.map((value) => value.name))]),
);

export function getAiDatabaseSchema(): string {
  const enums = new Map(
    Prisma.dmmf.datamodel.enums.map((item) => [item.name, item.values.map((value) => value.name)]),
  );

  return JSON.stringify(
    modelMetadata.map((model) => ({
      table: model.name,
      fields: model.fields.map((field) => ({
        name: field.name,
        type: field.type,
        ...(field.kind === "enum" ? { values: enums.get(field.type) } : {}),
      })),
      relations: relationMap.get(model.name),
    })),
  );
}

function getModel(modelName: string): ModelMetadata {
  const model = modelMap.get(modelName);
  if (!model) throw new Error("ما أگدر أقرأ هذا الجدول أو هذا الاسم مو موجود بالمخطط.");
  return model;
}

function getDelegate(
  modelName: string,
  client: PrismaClient | Prisma.TransactionClient = prisma,
): DynamicDelegate {
  const delegateName = modelName[0].toLowerCase() + modelName.slice(1);
  const delegate = (client as unknown as Record<string, unknown>)[delegateName];
  if (!delegate || typeof delegate !== "object") {
    throw new Error("تعذر الوصول إلى الجدول المطلوب.");
  }
  return delegate as DynamicDelegate;
}

function getSafeField(model: ModelMetadata, fieldName: string): FieldMetadata {
  const field = model.fields.find((item) => item.name === fieldName);
  if (!field || secretNamePattern.test(fieldName)) {
    throw new Error(`الحقل "${fieldName}" غير متاح للمساعد.`);
  }
  return field;
}

function normalizeValue(field: FieldMetadata, value: unknown): unknown {
  if (value === null) {
    if (field.isRequired) throw new Error(`الحقل "${field.name}" لا يقبل قيمة فارغة.`);
    return null;
  }

  const validEnumValues = enumValues.get(field.type);
  if (field.kind === "enum") {
    if (typeof value !== "string" || !validEnumValues?.has(value)) {
      throw new Error(`قيمة الحقل "${field.name}" غير موجودة ضمن الخيارات المسموحة.`);
    }
    return value;
  }

  switch (field.type) {
    case "String":
    case "Enum":
      if (typeof value !== "string" || value.length > 2000) {
        throw new Error(`قيمة الحقل "${field.name}" غير صالحة.`);
      }
      return value;
    case "Int": {
      const number = typeof value === "number" ? value : Number(value);
      if (!Number.isSafeInteger(number)) throw new Error(`قيمة الحقل "${field.name}" يجب أن تكون عدداً صحيحاً.`);
      return number;
    }
    case "Float":
    case "Decimal": {
      const number = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(number)) throw new Error(`قيمة الحقل "${field.name}" يجب أن تكون رقماً.`);
      return number;
    }
    case "Boolean":
      if (typeof value !== "boolean") throw new Error(`قيمة الحقل "${field.name}" يجب أن تكون نعم أو لا.`);
      return value;
    case "DateTime": {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) throw new Error(`تاريخ الحقل "${field.name}" غير صالح.`);
      return date;
    }
    case "Json":
      if (JSON.stringify(value).length > 5000) throw new Error(`قيمة الحقل "${field.name}" كبيرة جداً.`);
      return value;
    default:
      throw new Error(`نوع الحقل "${field.name}" غير مدعوم.`);
  }
}

function validateFilters(
  model: ModelMetadata,
  input: unknown,
  required: boolean,
  depth = 0,
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    if (required) throw new Error("حدد قيمة أو شرطاً واضحاً للبحث قبل تنفيذ هذا التغيير.");
    return {};
  }

  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > 5) throw new Error("استخدم خمسة شروط بحث أو أقل.");
  if (required && entries.length === 0) throw new Error("لا يمكن تغيير سجلات من دون شروط بحث محددة.");

  return Object.fromEntries(
    entries.map(([fieldName, rawValue]) => {
      const relation = relationMap.get(model.name)?.find((item) => item.name === fieldName);
      if (relation) {
        if (depth >= 1 || !rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
          throw new Error(`شرط العلاقة "${fieldName}" غير صالح.`);
        }
        const relationCondition = Object.entries(rawValue as Record<string, unknown>);
        const operator = relation.isList ? "some" : "is";
        if (
          relationCondition.length !== 1 ||
          relationCondition[0][0] !== operator
        ) {
          throw new Error(`استخدم شرط "${operator}" للعلاقة "${fieldName}".`);
        }
        const relatedWhere = validateFilters(
          getModel(relation.model),
          relationCondition[0][1],
          true,
          depth + 1,
        );
        return [fieldName, { [operator]: relatedWhere }];
      }

      const field = getSafeField(model, fieldName);
      if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
        const operators = Object.entries(rawValue as Record<string, unknown>);
        if (operators.length === 0 || operators.some(([operator]) => !allowedFilterOperators.has(operator))) {
          throw new Error(`شرط البحث للحقل "${fieldName}" غير مدعوم.`);
        }

        const conditions = Object.fromEntries(
          operators.map(([operator, value]) => {
            if ((operator === "contains" || operator === "startsWith" || operator === "endsWith") && field.type !== "String") {
              throw new Error(`البحث النصي غير متاح للحقل "${fieldName}".`);
            }
            if ((operator === "in" || operator === "notIn") && (!Array.isArray(value) || value.length > 50)) {
              throw new Error(`قائمة قيم البحث للحقل "${fieldName}" غير صالحة.`);
            }
            const values = Array.isArray(value) ? value : [value];
            const normalized = values.map((item) => normalizeValue(field, item));
            return [operator, Array.isArray(value) ? normalized : normalized[0]];
          }),
        );

        if (field.type === "String" && ("contains" in conditions || "startsWith" in conditions || "endsWith" in conditions)) {
          return [fieldName, { ...conditions, mode: "insensitive" }];
        }
        return [fieldName, conditions];
      }

      return [fieldName, normalizeValue(field, rawValue)];
    }),
  );
}

function validateSelectedFields(model: ModelMetadata, requested: unknown): string[] {
  if (requested === undefined) return model.fields.slice(0, 20).map((field) => field.name);
  if (!Array.isArray(requested) || requested.length === 0 || requested.length > 20) {
    throw new Error("حدد من 1 إلى 20 حقلاً للعرض.");
  }
  return [...new Set(requested.map((name) => getSafeField(model, String(name)).name))];
}

function normalizeData(model: ModelMetadata, input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("بيانات التغيير غير صالحة.");
  }
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0 || entries.length > 20) throw new Error("حدد من 1 إلى 20 حقلاً للتغيير.");
  return Object.fromEntries(
    entries.map(([fieldName, value]) => {
      const field = getSafeField(model, fieldName);
      if (blockedWriteFields.has(fieldName) || field.isId || field.hasDefaultValue && fieldName === "id") {
        throw new Error(`لا يمكن تغيير الحقل "${fieldName}" مباشرة.`);
      }
      return [fieldName, normalizeValue(field, value)];
    }),
  );
}

function serialize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  );
}

function snapshotHash(rows: unknown[], idField: string): string {
  const stableRows = [...rows].sort((left, right) =>
    String((left as Record<string, unknown>)[idField]).localeCompare(
      String((right as Record<string, unknown>)[idField]),
    ),
  );
  return createHash("sha256").update(JSON.stringify(serialize(stableRows))).digest("hex");
}

export async function executeDatabaseQuery(plan: DatabasePlan): Promise<unknown> {
  if (!plan.model) throw new Error("ما حددت الجدول المطلوب.");
  const model = getModel(plan.model);
  const where = validateFilters(model, plan.filters, false);
  const delegate = getDelegate(plan.model);

  if (plan.mode === "count") {
    return { count: await delegate.count({ where }) };
  }

  if (plan.mode === "aggregate") {
    const aggregateInput = plan.aggregate ?? {};
    const operations = [
      ["_sum", aggregateInput.sum],
      ["_avg", aggregateInput.average],
      ["_min", aggregateInput.min],
      ["_max", aggregateInput.max],
    ] as const;
    const aggregate: Record<string, unknown> = { _count: true };
    let hasAggregate = false;

    for (const [operation, requestedFields] of operations) {
      if (requestedFields === undefined) continue;
      if (!Array.isArray(requestedFields) || requestedFields.length === 0 || requestedFields.length > 10) {
        throw new Error("حدد من 1 إلى 10 حقول صحيحة لكل عملية إحصائية.");
      }
      const fieldSelection = Object.fromEntries(
        requestedFields.map((name) => {
          const field = getSafeField(model, name);
          if (!["Int", "Float", "Decimal"].includes(field.type)) {
            throw new Error(`الحقل "${name}" لا يدعم العمليات الإحصائية.`);
          }
          return [field.name, true];
        }),
      );
      aggregate[operation] = fieldSelection;
      hasAggregate = true;
    }
    if (!hasAggregate) throw new Error("حدد نوع الإحصائية والحقل المطلوب.");
    return delegate.aggregate({ where, ...aggregate });
  }

  const selectedFields = validateSelectedFields(model, plan.select);
  const select: Record<string, unknown> = Object.fromEntries(selectedFields.map((field) => [field, true]));
  if (plan.include !== undefined && (!Array.isArray(plan.include) || plan.include.length > 5)) {
    throw new Error("يمكن عرض خمس علاقات مرتبطة كحد أقصى.");
  }
  for (const relationName of plan.include ?? []) {
    const relation = relationMap.get(model.name)?.find((item) => item.name === relationName);
    if (!relation) throw new Error(`العلاقة "${relationName}" غير متاحة للعرض.`);
    const relatedModel = getModel(relation.model);
    const relatedSelection = Object.fromEntries(relatedModel.fields.slice(0, 10).map((field) => [field.name, true]));
    select[relation.name] = {
      select: relatedSelection,
      ...(relation.isList ? { take: 5 } : {}),
    };
  }
  const orderBy = plan.orderBy
    ? { [getSafeField(model, plan.orderBy.field).name]: plan.orderBy.direction === "desc" ? "desc" : "asc" }
    : undefined;
  const take = Number.isInteger(plan.take) ? Math.max(1, Math.min(Number(plan.take), 25)) : 10;
  const rows = await delegate.findMany({
    where,
    select,
    ...(orderBy ? { orderBy } : {}),
    take,
  });
  const count = await delegate.count({ where });
  return { count, returnedCount: rows.length, hasMore: count > rows.length, rows: serialize(rows) };
}

export async function prepareDatabaseChange(plan: DatabasePlan): Promise<{
  action: DatabaseAction;
  preview: {
    model: string;
    operation: string;
    affectedCount: number;
    filters: Record<string, unknown>;
    data: unknown;
    sample: unknown[];
  };
}> {
  if (!plan.model || !plan.operation) throw new Error("ما اكتملت معلومات التغيير المطلوب.");
  if (blockedWriteModels.has(plan.model)) throw new Error("هذا الجدول محمي ولا يسمح للمساعد بتغييره.");

  const model = getModel(plan.model);
  const delegate = getDelegate(plan.model);
  const nonce = randomUUID();
  const operation = plan.operation;
  if (!["create", "update", "delete"].includes(operation)) {
    throw new Error("نوع التغيير المطلوب غير مدعوم.");
  }

  if (operation === "create") {
    const completeModel = Prisma.dmmf.datamodel.models.find((item) => item.name === plan.model);
    const unsupportedRequiredField = completeModel?.fields.find(
      (field) =>
        field.kind === "scalar" &&
        field.type === "BigInt" &&
        field.isRequired &&
        !field.hasDefaultValue,
    );
    if (unsupportedRequiredField) {
      throw new Error("إنشاء السجل بهذا الجدول غير مدعوم بسبب حقل رقمي خاص.");
    }

    const data = normalizeData(model, plan.data);
    const missingRequired = model.fields.find(
      (field) =>
        field.isRequired &&
        !field.hasDefaultValue &&
        !field.isId &&
        !Object.prototype.hasOwnProperty.call(data, field.name),
    );
    if (missingRequired) {
      throw new Error(`أحتاج قيمة الحقل "${missingRequired.name}" قبل إنشاء السجل.`);
    }

    const idField = model.fields.find((field) => field.isId);
    if (!idField || idField.type !== "String" || blockedWriteFields.has(idField.name)) {
      throw new Error("إنشاء السجل غير متاح لهذا الجدول بشكل آمن.");
    }

    const action: DatabaseAction = {
      nonce,
      operation,
      model: plan.model,
      filters: {},
      data: { ...data, [idField.name]: nonce },
      affectedIds: [],
      snapshotHash: snapshotHash([], "id"),
    };
    return {
      action,
      preview: { model: plan.model, operation, affectedCount: 1, filters: {}, data, sample: [] },
    };
  }

  const filters = validateFilters(model, plan.filters, true);
  const idField = model.fields.find((field) => field.isId);
  if (!idField) throw new Error("لا يمكن تعديل هذا الجدول بأمان لعدم وجود معرّف منفرد.");

  const allFields = Prisma.dmmf.datamodel.models
    .find((item) => item.name === plan.model)
    ?.fields.filter((field) => field.kind === "scalar" && !field.isList)
    .map((field) => field.name) ?? [idField.name];
  const rows = await delegate.findMany({
    where: filters,
    select: Object.fromEntries(allFields.map((field) => [field, true])),
    take: 101,
  });
  if (rows.length === 0) throw new Error("ما لقيت سجلات مطابقة لهذا التغيير.");
  if (rows.length > 100) throw new Error("لقيت أكثر من 100 سجل. ضيّق البحث قبل التغيير.");

  const affectedIds = rows.map((row) => (row as Record<string, string | number>)[idField.name]);
  if (affectedIds.some((id) => id === null || id === undefined)) {
    throw new Error("تعذر تحديد السجلات المطابقة بأمان.");
  }

  const data = operation === "update" ? normalizeData(model, plan.data) : {};
  const action: DatabaseAction = {
    nonce,
    operation,
    model: plan.model,
    filters,
    data,
    affectedIds,
    snapshotHash: snapshotHash(rows, idField.name),
  };
  return {
    action,
    preview: {
      model: plan.model,
      operation,
      affectedCount: rows.length,
      filters,
      data,
      sample: serialize(
        rows.slice(0, 5).map((row) =>
          Object.fromEntries(
            model.fields
              .filter((field) => Object.prototype.hasOwnProperty.call(row, field.name))
              .map((field) => [field.name, (row as Record<string, unknown>)[field.name]]),
          ),
        ),
      ) as unknown[],
    },
  };
}

export async function applyDatabaseChange(action: DatabaseAction): Promise<number> {
  if (blockedWriteModels.has(action.model)) throw new Error("هذا الجدول محمي ولا يسمح بتغييره.");
  const model = getModel(action.model);
  return prisma.$transaction(
    async (transaction) => {
      const delegate = getDelegate(action.model, transaction);

      if (action.operation === "create") {
        const idField = model.fields.find((field) => field.isId);
        const id = idField ? action.data[idField.name] : undefined;
        if (idField && id !== undefined) {
          const existing = await delegate.findMany({
            where: { [idField.name]: id },
            select: { [idField.name]: true },
            take: 1,
          });
          if (existing.length > 0) return 1;
        }
        await delegate.create({ data: action.data });
        return 1;
      }

      const idField = model.fields.find((field) => field.isId);
      if (!idField || action.affectedIds.length === 0 || action.affectedIds.length > 100) {
        throw new Error("انتهت صلاحية معاينة التغيير. أعد إرسال طلبك.");
      }
      const currentRows = await delegate.findMany({
        where: { [idField.name]: { in: action.affectedIds } },
        take: 101,
      });
      if (
        currentRows.length !== action.affectedIds.length ||
        snapshotHash(currentRows, idField.name) !== action.snapshotHash
      ) {
        throw new Error("تغيرت البيانات بعد عرض المعاينة. أعد إرسال الطلب حتى أعرض لك أحدث وضع.");
      }

      const where = { [idField.name]: { in: action.affectedIds } };
      if (action.operation === "update") {
        const result = await delegate.updateMany({ where, data: action.data });
        return result.count;
      }
      const result = await delegate.deleteMany({ where });
      return result.count;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export function parseDatabasePlan(raw: string): DatabasePlan {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("ما قدرت أفهم نية المساعد. جرب صياغة الأمر بشكل أوضح.");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as DatabasePlan;
  if (!parsed || !["query", "change", "answer"].includes(parsed.kind)) {
    throw new Error("رد المساعد ما كان بالصيغة المطلوبة.");
  }
  return parsed;
}
