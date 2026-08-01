(() => {
  'use strict';

  const cloud = window.FreeHTLCloudProgressAdapter;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const PENDING_PREFIX = 'free-htl-cloud-pending-v1:';
  const CACHE_PREFIX = 'free-htl-cloud-cache-v1:';

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

    pendingRecord() {
      return this.readEnvelope(this.pendingKey)?.record || null;
    }

    cachedRecord() {
      return this.readEnvelope(this.cacheKey)?.record || null;
    }

    hasPending() {
      return Boolean(this.pendingRecord());
    }

    async load() {
      const pending = this.pendingRecord();
      const cached = this.cachedRecord();
      try {
        const remote = await this.base.load();
        let current = remote;
        if (pending) {
          current = cloud.mergeRecords(remote, pending, this.userId);
          await this.base.save(current);
          this.clearEnvelope(this.pendingKey);
        }
        this.writeEnvelope(this.cacheKey, current);
        emit('saved', { userId: this.userId, pending: false });
        return clone(current);
      } catch (error) {
        const fallback = pending || cached;
        if (!fallback) throw error;
        const status = classify(error);
        emit(status, {
          userId: this.userId,
          pending: Boolean(pending),
          message: error.message || 'Cloud progress could not be loaded.'
        });
        return clone(fallback);
      }
    }

    async save(record) {
      this.writeEnvelope(this.pendingKey, record, { reason: 'save' });
      emit('saving', { userId: this.userId, pending: true });
      try {
        const saved = await this.base.save(record);
        this.clearEnvelope(this.pendingKey);
        this.writeEnvelope(this.cacheKey, saved || record);
        emit('saved', { userId: this.userId, pending: false });
        return clone(saved || record);
      } catch (error) {
        const status = classify(error);
        this.writeEnvelope(this.pendingKey, record, {
          reason: status,
          error: error.message || 'Cloud progress could not be saved.'
        });
        emit(status, {
          userId: this.userId,
          pending: true,
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
          message: error.message || 'Browser progress could not be imported.'
        });
        throw error;
      }
    }
  }

  window.FreeHTLResilientCloudAdapter = Object.freeze({
    ResilientCloudAdapter,
    pendingPrefix: PENDING_PREFIX,
    cachePrefix: CACHE_PREFIX
  });
})();
