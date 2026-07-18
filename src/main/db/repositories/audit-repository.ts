import type Database from "better-sqlite3-multiple-ciphers";

export interface AuditEventInput {
  entityType: string;
  entityId: string;
  action: "create" | "update" | "reverse" | "close" | "reopen";
  reason?: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditRepository {
  append(input: AuditEventInput): void;
}

function serializeSnapshot(value: unknown): string | null {
  if (value === undefined) return null;

  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("Audit snapshots must be JSON-serializable");
  }
  return serialized;
}

export function createAuditRepository(
  database: Database.Database,
  actorUserId: string | null = null,
): AuditRepository {
  const insert = database.prepare<{
    entityType: string;
    entityId: string;
    action: AuditEventInput["action"];
    reason: string | null;
    beforeJson: string | null;
    afterJson: string | null;
    actorUserId: string | null;
  }>(`
    INSERT INTO audit_events (
      entity_type,
      entity_id,
      action,
      reason,
      before_json,
      after_json,
      actor_user_id
    ) VALUES (
      @entityType,
      @entityId,
      @action,
      @reason,
      @beforeJson,
      @afterJson,
      @actorUserId
    )
  `);

  return Object.freeze({
    append(input: AuditEventInput): void {
      const entityType = input.entityType.trim();
      const entityId = input.entityId.trim();
      if (!entityType || !entityId) {
        throw new TypeError("Audit entity type and id are required");
      }

      insert.run({
        entityType,
        entityId,
        action: input.action,
        reason: input.reason?.trim() || null,
        beforeJson: serializeSnapshot(input.before),
        afterJson: serializeSnapshot(input.after),
        actorUserId,
      });
    },
  });
}
