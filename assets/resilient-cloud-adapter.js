(() => {
  'use strict';

  const cloud = window.FreeHTLCloudProgressAdapter;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const PENDING_PREFIX = 'free-htl-cloud-pending-v1:';
  const CACHE_PREFIX = 'free-htl-cloud-cache-v1:';
  const SESSION_TYPES = ['mock-exam', 'targeted-practice'];

  function emit(status, detail = {}) {
    window.dispatchEvent(new CustomEvent('htl:cloud-sync-state', {
      detail: { status, ...detail }
    }));
  }

  function classify(error) {
    if (error?.name === 'CloudProgressConflictError') return 'conflict';
    const message = String(error?.message || '').toLowerCase();
    if (!navigator.onLine || /network|fetch|offline|failed to connect/.test(message)) return 'offline';
    return 'error';
  }

  class CloudProgressConflictError extends Error {
    constructor(conflict) {
      super(`A newer ${conflict.sessionType} session is already saved on another device.`);
      this.name = 'CloudProgressConflictError';
      this.conflict = conflict;
    }
  }

  class ResilientCloudAdapter {
    constructor(baseAdapter, storage = localStorage) {
      if (!baseAdapter?.load || !baseAdapter?.save || !baseAdapter?.clear) {
        throw new TypeError('A cloud progress adapter is required.');
      }
      this.base = baseAdapter;
      this.storage = storage;
      this.userId = baseAdapter.userId;
      this.name = 'supabase-cloud';
      this.pendingKey = `${PENDING_PREFIX}${this.userId}`;
      this.cacheKey = `${CACHE_PREFIX}${this.userId}`;
    }

    readEnvelope(key) {
      try {
        const value = JSON.parse(this.storage.getItem(key) || 'null');
        return value?.record ? value : null;
      } catch {
        return null;
      }
    }

    writeEnvelope(key, record, extra = {}) {
      this.storage.setItem(key, JSON.stringify({
        record: clone(record),
        savedAt: new Date().toISOString(),
        ...extra
      }));
    }

    clearEnvelope(key) {
      this.storage.removeItem(key);
    }

    pendingEnvelope() {
      return this.readEnvelope(this.pendingKey);
    }

    pendingRecord() {
      return this.pendingEnvelope()?.record || null;
    }

    cachedRecord() {
      return this.readEnvelope(this.cacheKey)?.record || null;
    }

    conflictInfo() {
      const envelope = this.pendingEnvelope();
      return envelope?.reason === 'conflict' ? envelope.conflict || null : null;
    }

    hasPending() {
      return Boolean(this.pendingRecord());
    }

    async assertNoSessionConflicts(record) {
      for (const sessionType of SESSION_TYPES) {
        const local = record.activeSessions?.[sessionType];
        const localRevision = Number(local?.revision || 0);
        if (!local || !localRevision) continue;
        const result = await this.base.client.from('active_sessions')
          .select('session_id,revision,server_updated_at')
          .eq('user_id', this.userId)
          .eq('session_type', sessionType)
          .limit(1);
        if (result?.error) throw new Error(result.error.message || `Could not verify ${sessionType} revision.`);
        const server = result?.data?.[0];
        const serverRevision = Number(server?.revision || 0);
        if (server && serverRevision > localRevision) {
          throw new CloudProgressConflictError({
            sessionType,
            localRevision,
            serverRevision,
            localSessionId: local.attemptId || null,
            serverSessionId: server.session_id || null,
            serverUpdatedAt: server.server_updated_at || null
          });
        }
      }
    }

    advanceSessionRevisions(record) {
      SESSION_TYPES.forEach((sessionType) => {
        const session = record.activeSessions?.[sessionType];
        if (!session) return;
        session.revision = Number(session.revision || 0) + 1;
      });
      return record;
    }

    async load() {
      const pending = this.pendingRecord();
      const cached = this.cachedRecord();
      try {
        const remote = await this.base.load();
        let current = remote;
        if (pending) {
          current = cloud.mergeRecords(remote, pending, this.userId);
          await this.assertNoSessionConflicts(current);
          await this.base.save(current);
          this.advanceSessionRevisions(current);
          this.clearEnvelope(this.pendingKey);
        }
        this.writeEnvelope(this.cacheKey, current);
        emit('saved', { userId: this.userId, pending: false });
        return clone(current);
      } catch (error) {
        const fallback = pending || cached;
        if (!fallback) throw error;
        const status = classify(error);
        if (status === 'conflict' && pending) {
          this.writeEnvelope(this.pendingKey, pending, {
            reason: 'conflict',
            error: error.message,
            conflict: error.conflict
          });
        }
        emit(status, {
          userId: this.userId,
          pending: Boolean(pending),
          conflict: error.conflict || null,
          message: error.message || 'Cloud progress could not be loaded.'
        });
        return clone(fallback);
      }
    }

    async save(record) {
      this.writeEnvelope(this.pendingKey, record, { reason: 'save' });
      emit('saving', { userId: this.userId, pending: true });
      try {
        await this.assertNoSessionConflicts(record);
        await this.base.save(record);
        this.advanceSessionRevisions(record);
        this.clearEnvelope(this.pendingKey);
        this.writeEnvelope(this.cacheKey, record);
        emit('saved', { userId: this.userId, pending: false });
        return clone(record);
      } catch (error) {
        const status = classify(error);
        this.writeEnvelope(this.pendingKey, record, {
          reason: status,
          error: error.message || 'Cloud progress could not be saved.',
          conflict: error.conflict || null
        });
        emit(status, {
          userId: this.userId,
          pending: true,
          conflict: error.conflict || null,
          message: error.message || 'Cloud progress could not be saved.'
        });
        return clone(record);
      }
    }

    async clear() {
      emit('saving', { userId: this.userId, pending: false });
      await this.base.clear();
      this.clearEnvelope(this.pendingKey);
      this.clearEnvelope(this.cacheKey);
      emit('saved', { userId: this.userId, pending: false });
    }

    async flushPending() {
      const pending = this.pendingRecord();
      if (!pending) return this.load();
      return this.save(pending);
    }

    async resolveConflict(strategy) {
      if (!['remote', 'local'].includes(strategy)) throw new TypeError('Conflict strategy must be remote or local.');
      const pending = this.pendingRecord();
      if (!pending) return this.load();
      emit('saving', { userId: this.userId, pending: true });
      const remote = await this.base.load();
      const merged = cloud.mergeRecords(remote, pending, this.userId);
      if (strategy === 'remote') {
        merged.activeSessions = clone(remote.activeSessions || {});
      } else if (strategy === 'local') {
        SESSION_TYPES.forEach((sessionType) => {
          if (pending.activeSessions?.[sessionType]) {
            merged.activeSessions[sessionType] = clone(pending.activeSessions[sessionType]);
          }
        });
      }
      await this.base.save(merged);
      const resolved = await this.base.load();
      this.clearEnvelope(this.pendingKey);
      this.writeEnvelope(this.cacheKey, resolved);
      emit('saved', { userId: this.userId, pending: false, resolution: strategy });
      return clone(resolved);
    }

    async hasCompletedMigration(recordId) {
      return this.base.hasCompletedMigration(recordId);
    }

    async importRecord(record) {
      emit('saving', { userId: this.userId, pending: true });
      try {
        const imported = await this.base.importRecord(record);
        this.clearEnvelope(this.pendingKey);
        this.writeEnvelope(this.cacheKey, imported);
        emit('saved', { userId: this.userId, pending: false });
        return clone(imported);
      } catch (error) {
        const status = classify(error);
        emit(status, {
          userId: this.userId,
          pending: false,
          conflict: error.conflict || null,
          message: error.message || 'Browser progress could not be imported.'
        });
        throw error;
      }
    }
  }

  window.FreeHTLResilientCloudAdapter = Object.freeze({
    ResilientCloudAdapter,
    CloudProgressConflictError,
    pendingPrefix: PENDING_PREFIX,
    cachePrefix: CACHE_PREFIX
  });
})();
