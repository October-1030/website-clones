import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  BlackboardClient,
  getBlackboardConfig,
  requestBlackboardAccessToken,
} from "./blackboard";
import {
  BrightspaceClient,
  getBrightspaceOauthConfig,
  refreshBrightspaceAccessToken,
} from "./brightspace";
import { CanvasClient } from "./canvas";
import { decryptLmsToken, encryptLmsToken } from "./crypto";
import type {
  LmsConnectionRecord,
  LmsConnectionSummary,
  LmsCourseInput,
  LmsMaterialInput,
  LmsSyncResult,
} from "./types";
import { LmsError } from "./types";

interface AuthenticatedCloud {
  client: SupabaseClient;
  user: User;
}

interface LmsReadClient {
  verifyConnection(): Promise<{ externalUserId: string; displayName: string; email: string | null }>;
  listCourses(): Promise<LmsCourseInput[]>;
  loadCourseSnapshot(course: LmsCourseInput): Promise<{
    course: LmsCourseInput;
    materials: LmsMaterialInput[];
    warnings: string[];
  }>;
}

function summary(record: LmsConnectionRecord): LmsConnectionSummary {
  return {
    id: record.id,
    provider: record.provider,
    instanceUrl: record.instance_url,
    accountLabel: record.account_label,
    status: record.status,
    scopes: record.scopes || [],
    tokenExpiresAt: record.token_expires_at,
    lastSyncedAt: record.last_synced_at,
    lastError: record.last_error,
  };
}

function databaseFailure(message: string): LmsError {
  return new LmsError(message, "lms_database_failed", 503);
}

function chunk<T>(values: T[], size = 100): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

export async function connectCanvasAccount(
  context: AuthenticatedCloud,
  input: { instanceUrl: string; accessToken: string; accountLabel: string },
  options: { fetchImpl?: typeof fetch; environment?: NodeJS.ProcessEnv } = {},
): Promise<{ connection: LmsConnectionSummary; profile: { displayName: string; email: string | null } }> {
  const canvas = new CanvasClient(input.instanceUrl, input.accessToken, { fetchImpl: options.fetchImpl });
  const profile = await canvas.verifyConnection();
  const accessTokenCiphertext = encryptLmsToken(input.accessToken, options.environment);
  const { data, error } = await context.client
    .from("lms_connections")
    .upsert({
      user_id: context.user.id,
      provider: "canvas",
      instance_url: input.instanceUrl,
      account_label: input.accountLabel,
      access_token_ciphertext: accessTokenCiphertext,
      refresh_token_ciphertext: null,
      token_expires_at: null,
      scopes: [],
      status: "connected",
      last_error: null,
    }, { onConflict: "user_id,provider,instance_url" })
    .select("*")
    .single();
  if (error || !data) throw databaseFailure("Unable to save the Canvas connection.");
  return {
    connection: summary(data as LmsConnectionRecord),
    profile: { displayName: profile.displayName, email: profile.email },
  };
}

export async function connectBlackboardAccount(
  context: AuthenticatedCloud,
  options: { fetchImpl?: typeof fetch; environment?: NodeJS.ProcessEnv } = {},
): Promise<{ connection: LmsConnectionSummary; profile: { displayName: string; email: string | null } }> {
  const environment = options.environment || process.env;
  const config = getBlackboardConfig(environment);
  if (!config) throw new LmsError("Blackboard integration is not configured.", "blackboard_not_configured", 503);
  const token = await requestBlackboardAccessToken(config, options.fetchImpl);
  const blackboard = new BlackboardClient(config.instanceUrl, token.accessToken, { fetchImpl: options.fetchImpl });
  const profile = await blackboard.verifyConnection();
  const { data, error } = await context.client
    .from("lms_connections")
    .upsert({
      user_id: context.user.id,
      provider: "blackboard",
      instance_url: config.instanceUrl,
      account_label: profile.displayName || "Blackboard",
      access_token_ciphertext: encryptLmsToken(token.accessToken, environment),
      refresh_token_ciphertext: null,
      token_expires_at: token.expiresAt,
      scopes: [],
      status: "connected",
      last_error: null,
    }, { onConflict: "user_id,provider,instance_url" })
    .select("*")
    .single();
  if (error || !data) throw databaseFailure("Unable to save the Blackboard connection.");
  return {
    connection: summary(data as LmsConnectionRecord),
    profile: { displayName: profile.displayName, email: profile.email },
  };
}

export async function saveCanvasOauthConnection(
  context: AuthenticatedCloud,
  value: {
    instanceUrl: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
    scopes: string[];
    accountLabel: string;
  },
  environment: NodeJS.ProcessEnv = process.env,
): Promise<LmsConnectionSummary> {
  const { data, error } = await context.client
    .from("lms_connections")
    .upsert({
      user_id: context.user.id,
      provider: "canvas",
      instance_url: value.instanceUrl,
      account_label: value.accountLabel,
      access_token_ciphertext: encryptLmsToken(value.accessToken, environment),
      refresh_token_ciphertext: value.refreshToken ? encryptLmsToken(value.refreshToken, environment) : null,
      token_expires_at: value.expiresAt,
      scopes: value.scopes,
      status: "connected",
      last_error: null,
    }, { onConflict: "user_id,provider,instance_url" })
    .select("*")
    .single();
  if (error || !data) throw databaseFailure("Unable to save the Canvas OAuth connection.");
  return summary(data as LmsConnectionRecord);
}

export async function saveBrightspaceOauthConnection(
  context: AuthenticatedCloud,
  value: {
    instanceUrl: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string;
    scopes: string[];
    accountLabel: string;
  },
  environment: NodeJS.ProcessEnv = process.env,
): Promise<LmsConnectionSummary> {
  const { data, error } = await context.client
    .from("lms_connections")
    .upsert({
      user_id: context.user.id,
      provider: "brightspace",
      instance_url: value.instanceUrl,
      account_label: value.accountLabel,
      access_token_ciphertext: encryptLmsToken(value.accessToken, environment),
      refresh_token_ciphertext: value.refreshToken ? encryptLmsToken(value.refreshToken, environment) : null,
      token_expires_at: value.expiresAt,
      scopes: value.scopes,
      status: "connected",
      last_error: null,
    }, { onConflict: "user_id,provider,instance_url" })
    .select("*")
    .single();
  if (error || !data) throw databaseFailure("Unable to save the Brightspace OAuth connection.");
  return summary(data as LmsConnectionRecord);
}
export async function listLmsConnections(context: AuthenticatedCloud): Promise<{
  connections: LmsConnectionSummary[];
  courses: Array<{
    id: number;
    connectionId: string;
    externalId: string;
    name: string;
    courseCode: string;
    updatedAt: string;
  }>;
}> {
  const [{ data: connections, error: connectionsError }, { data: courses, error: coursesError }] = await Promise.all([
    context.client
      .from("lms_connections")
      .select("id,user_id,provider,instance_url,account_label,status,scopes,token_expires_at,last_synced_at,last_error,created_at,updated_at,access_token_ciphertext,refresh_token_ciphertext")
      .order("updated_at", { ascending: false }),
    context.client
      .from("lms_courses")
      .select("id,connection_id,external_id,name,course_code,updated_at")
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);
  if (connectionsError || coursesError) throw databaseFailure("Unable to load LMS connections.");
  return {
    connections: (connections || []).map((value) => summary(value as LmsConnectionRecord)),
    courses: (courses || []).map((course) => ({
      id: Number(course.id),
      connectionId: String(course.connection_id),
      externalId: String(course.external_id),
      name: String(course.name),
      courseCode: String(course.course_code || ""),
      updatedAt: String(course.updated_at),
    })),
  };
}

async function loadConnection(context: AuthenticatedCloud, connectionId: string): Promise<LmsConnectionRecord> {
  const { data, error } = await context.client
    .from("lms_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", context.user.id)
    .single();
  if (error || !data) throw new LmsError("LMS connection was not found.", "lms_connection_not_found", 404);
  return data as LmsConnectionRecord;
}

function materialRow(
  context: AuthenticatedCloud,
  connectionId: string,
  courseId: number,
  value: LmsMaterialInput,
): Record<string, unknown> {
  return {
    user_id: context.user.id,
    connection_id: connectionId,
    course_id: courseId,
    external_id: value.externalId,
    kind: value.kind,
    title: value.title,
    module_name: value.moduleName,
    source_url: value.sourceUrl,
    mime_type: value.mimeType,
    due_at: value.dueAt,
    position: value.position,
    text_content: value.textContent,
    content_hash: value.contentHash,
    metadata: value.metadata,
  };
}

async function createProviderClient(
  context: AuthenticatedCloud,
  connection: LmsConnectionRecord,
  options: { fetchImpl?: typeof fetch; environment?: NodeJS.ProcessEnv },
): Promise<LmsReadClient> {
  const environment = options.environment || process.env;
  if (connection.provider === "canvas") {
    const token = decryptLmsToken(connection.access_token_ciphertext, environment);
    return new CanvasClient(connection.instance_url, token, { fetchImpl: options.fetchImpl });
  }
  if (connection.provider === "blackboard") {
    const config = getBlackboardConfig(environment);
    if (!config || config.instanceUrl !== connection.instance_url) {
      throw new LmsError("Blackboard integration configuration no longer matches this connection.", "blackboard_not_configured", 503);
    }
    const token = await requestBlackboardAccessToken(config, options.fetchImpl);
    const { error } = await context.client
      .from("lms_connections")
      .update({
        access_token_ciphertext: encryptLmsToken(token.accessToken, environment),
        token_expires_at: token.expiresAt,
        status: "connected",
        last_error: null,
      })
      .eq("id", connection.id);
    if (error) throw databaseFailure("Unable to refresh the Blackboard token.");
    return new BlackboardClient(connection.instance_url, token.accessToken, { fetchImpl: options.fetchImpl });
  }
  if (connection.provider === "brightspace") {
    const config = getBrightspaceOauthConfig(environment);
    if (!config || config.instanceUrl !== connection.instance_url) {
      throw new LmsError("Brightspace OAuth configuration no longer matches this connection.", "brightspace_not_configured", 503);
    }
    let accessToken = decryptLmsToken(connection.access_token_ciphertext, environment);
    const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).valueOf() : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() + 5 * 60_000) {
      if (!connection.refresh_token_ciphertext) {
        throw new LmsError("Brightspace needs to be authorized again.", "brightspace_token_rejected", 401);
      }
      const currentRefreshToken = decryptLmsToken(connection.refresh_token_ciphertext, environment);
      const token = await refreshBrightspaceAccessToken(config, currentRefreshToken, options.fetchImpl);
      accessToken = token.accessToken;
      const { error } = await context.client
        .from("lms_connections")
        .update({
          access_token_ciphertext: encryptLmsToken(token.accessToken, environment),
          refresh_token_ciphertext: encryptLmsToken(token.refreshToken || currentRefreshToken, environment),
          token_expires_at: token.expiresAt,
          status: "connected",
          last_error: null,
        })
        .eq("id", connection.id);
      if (error) throw databaseFailure("Unable to rotate the Brightspace OAuth tokens.");
    }
    return new BrightspaceClient(connection.instance_url, accessToken, config, { fetchImpl: options.fetchImpl });
  }  throw new LmsError("This LMS provider is not implemented.", "lms_provider_not_supported", 400);
}

export async function syncLmsConnection(
  context: AuthenticatedCloud,
  connectionId: string,
  options: { fetchImpl?: typeof fetch; environment?: NodeJS.ProcessEnv } = {},
): Promise<LmsSyncResult> {
  const connection = await loadConnection(context, connectionId);
  const { data: run, error: runError } = await context.client
    .from("lms_sync_runs")
    .insert({
      user_id: context.user.id,
      connection_id: connectionId,
      status: "running",
    })
    .select("id")
    .single();
  if (runError || !run) throw databaseFailure("Unable to create the LMS sync run.");

  let coursesSynced = 0;
  let materialsSynced = 0;
  const warnings: string[] = [];
  try {
    const providerClient = await createProviderClient(context, connection, options);
    await providerClient.verifyConnection();
    const courses = await providerClient.listCourses();
    for (const course of courses) {
      const { data: savedCourse, error: courseError } = await context.client
        .from("lms_courses")
        .upsert({
          user_id: context.user.id,
          connection_id: connectionId,
          external_id: course.externalId,
          name: course.name,
          course_code: course.courseCode,
          enrollment_state: course.enrollmentState,
          workflow_state: course.workflowState,
          start_at: course.startAt,
          end_at: course.endAt,
        }, { onConflict: "connection_id,external_id" })
        .select("id")
        .single();
      if (courseError || !savedCourse) throw databaseFailure("Unable to save an LMS course.");

      const snapshot = await providerClient.loadCourseSnapshot(course);
      warnings.push(...snapshot.warnings.map((warning) => `${course.externalId}:${warning}`));
      const rows = snapshot.materials.map((material) => materialRow(
        context,
        connectionId,
        Number(savedCourse.id),
        material,
      ));
      for (const values of chunk(rows)) {
        if (!values.length) continue;
        const { error } = await context.client
          .from("lms_materials")
          .upsert(values, { onConflict: "course_id,kind,external_id" });
        if (error) throw databaseFailure("Unable to save LMS materials.");
      }

      const { data: existing, error: existingError } = await context.client
        .from("lms_materials")
        .select("id,kind,external_id")
        .eq("course_id", Number(savedCourse.id));
      if (existingError) throw databaseFailure("Unable to reconcile LMS materials.");
      const currentKeys = new Set(snapshot.materials.map((material) => `${material.kind}:${material.externalId}`));
      const staleIds = (existing || [])
        .filter((row) => !currentKeys.has(`${row.kind}:${row.external_id}`))
        .map((row) => Number(row.id));
      for (const ids of chunk(staleIds)) {
        const { error } = await context.client.from("lms_materials").delete().in("id", ids);
        if (error) throw databaseFailure("Unable to remove stale LMS materials.");
      }
      coursesSynced += 1;
      materialsSynced += snapshot.materials.length;
    }

    const completedAt = new Date().toISOString();
    const [{ error: completeError }, { error: connectionError }] = await Promise.all([
      context.client
        .from("lms_sync_runs")
        .update({
          status: "completed",
          courses_synced: coursesSynced,
          materials_synced: materialsSynced,
          completed_at: completedAt,
        })
        .eq("id", run.id),
      context.client
        .from("lms_connections")
        .update({
          status: "connected",
          last_synced_at: completedAt,
          last_error: null,
        })
        .eq("id", connectionId),
    ]);
    if (completeError || connectionError) throw databaseFailure("LMS sync completed but status could not be saved.");
    return { runId: String(run.id), coursesSynced, materialsSynced, warnings };
  } catch (error) {
    const failure = error instanceof LmsError
      ? error
      : new LmsError("LMS sync failed.", "lms_sync_failed", 502);
    await Promise.all([
      context.client
        .from("lms_sync_runs")
        .update({
          status: "failed",
          courses_synced: coursesSynced,
          materials_synced: materialsSynced,
          error_code: failure.code,
          error_message: failure.message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id),
      context.client
        .from("lms_connections")
        .update({
          status: failure.code === "canvas_token_rejected" || failure.code === "blackboard_token_rejected" || failure.code === "brightspace_token_rejected"
            ? "expired"
            : "error",
          last_error: failure.message,
        })
        .eq("id", connectionId),
    ]);
    throw failure;
  }
}

export async function disconnectLmsConnection(
  context: AuthenticatedCloud,
  connectionId: string,
): Promise<void> {
  const { error } = await context.client
    .from("lms_connections")
    .delete()
    .eq("id", connectionId)
    .eq("user_id", context.user.id);
  if (error) throw databaseFailure("Unable to disconnect the LMS account.");
}
