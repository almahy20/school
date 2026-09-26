/**
 * Comprehensive Performance Profiler & Diagnostic Tracer
 * 
 * Measures the complete pipeline:
 * Frontend Request Start -> API / Fetch -> Database Query -> Response Transfer -> Frontend Processing -> Frontend Render
 */

export interface TraceMetric {
  id: string;
  label: string;
  url: string;
  method: string;
  startTime: number;
  apiStartTime: number;
  dbStartTime: number;
  dbEndTime: number;
  responseParsedTime: number;
  frontendReceivedTime: number;
  frontendRenderedTime: number;
  payloadSizeBytes: number;
  recordCount: number;
  status: number;
  wasBackgrounded?: boolean;
}

class PerformanceProfiler {
  private activeTraces = new Map<string, Partial<TraceMetric>>();
  private traceCounter = 0;

  public startRequest(label: string, url: string, method = 'GET'): string {
    const id = `req_${++this.traceCounter}_${Date.now()}`;
    const now = performance.now();
    
    this.activeTraces.set(id, {
      id,
      label,
      url,
      method,
      startTime: now,
      apiStartTime: now,
    });

    console.groupCollapsed(
      `%c🚀 [REQUEST START] %c#${this.traceCounter} %c${method} ${label}`,
      'color: #3b82f6; font-weight: bold;',
      'color: #9333ea; font-weight: bold;',
      'color: #0f172a; font-weight: 600;'
    );
    console.log(`⏱️ Timestamp: ${new Date().toISOString()}`);
    console.log(`🔗 Target URL: ${url}`);
    console.groupEnd();

    return id;
  }

  public markDbStart(traceId: string) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;
    trace.dbStartTime = performance.now();
    const apiDuration = (trace.dbStartTime - (trace.apiStartTime || trace.startTime || 0)).toFixed(2);
    
    console.log(
      `%c⚡ [API START -> DB QUERY START] %cTrace #${traceId.split('_')[1]} (API Prep: ${apiDuration}ms)`,
      'color: #06b6d4; font-weight: bold;',
      'color: #64748b;'
    );
  }

  public markDbEnd(traceId: string, status: number) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;
    trace.dbEndTime = performance.now();
    trace.status = status;
    const dbDuration = (trace.dbEndTime - (trace.dbStartTime || trace.startTime || 0)).toFixed(2);

    console.log(
      `%c📥 [DATABASE QUERY END] %cTrace #${traceId.split('_')[1]} - Status: ${status} (DB Query Time: ${dbDuration}ms)`,
      'color: #10b981; font-weight: bold;',
      'color: #64748b;'
    );
  }

  public markResponseParsed(traceId: string, payloadSize: number, recordCount: number) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;
    trace.responseParsedTime = performance.now();
    trace.payloadSizeBytes = payloadSize;
    trace.recordCount = recordCount;
    trace.frontendReceivedTime = trace.responseParsedTime;

    const transferAndParseDuration = (trace.responseParsedTime - (trace.dbEndTime || trace.responseParsedTime)).toFixed(2);
    
    console.log(
      `%c📦 [RESPONSE RECEIVED & PARSED] %cTrace #${traceId.split('_')[1]} - Payload: ${(payloadSize / 1024).toFixed(2)} KB | Records: ${recordCount} (Parse Time: ${transferAndParseDuration}ms)`,
      'color: #f59e0b; font-weight: bold;',
      'color: #64748b;'
    );

    // Check if the tab is currently hidden or gets backgrounded while waiting for render
    const wasInitiallyHidden = typeof document !== 'undefined' && document.hidden;
    let becameHiddenDuringWait = false;

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        becameHiddenDuringWait = true;
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange, { passive: true });
    }

    // Track next animation frame / render cycle
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', onVisibilityChange);
        }
        const isNowHidden = typeof document !== 'undefined' && document.hidden;
        const wasBackgrounded = wasInitiallyHidden || becameHiddenDuringWait || isNowHidden;
        this.markRendered(traceId, wasBackgrounded);
      }, 0);
    });
  }

  private markRendered(traceId: string, wasBackgrounded = false) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;
    trace.frontendRenderedTime = performance.now();
    trace.wasBackgrounded = wasBackgrounded;

    const startTime = trace.startTime || 0;
    const apiStart = trace.apiStartTime || startTime;
    const dbStart = trace.dbStartTime || apiStart;
    const dbEnd = trace.dbEndTime || dbStart;
    const parsedTime = trace.responseParsedTime || dbEnd;
    const renderedTime = trace.frontendRenderedTime;

    const apiDuration = Math.max(0, dbStart - apiStart);
    const dbDuration = Math.max(0, dbEnd - dbStart);
    const transferParseDuration = Math.max(0, parsedTime - dbEnd);
    const renderDuration = Math.max(0, renderedTime - parsedTime);
    const totalNetworkDuration = Math.max(0, parsedTime - startTime);
    const totalDuration = Math.max(0, renderedTime - startTime);

    const payloadKb = ((trace.payloadSizeBytes || 0) / 1024).toFixed(2);

    console.group(
      `%c📊 [PERFORMANCE SUMMARY] %c${trace.label} %c(${wasBackgrounded ? `${totalNetworkDuration.toFixed(1)}ms network (render N/A)` : `${totalDuration.toFixed(1)}ms total`})`,
      'color: #8b5cf6; font-weight: bold; font-size: 11px;',
      'color: #0f172a; font-weight: bold;',
      (wasBackgrounded ? totalNetworkDuration : totalDuration) > 500 ? 'color: #ef4444; font-weight: bold;' : 'color: #10b981; font-weight: bold;'
    );
    console.log(`1. API / Request Init:       ${apiDuration.toFixed(2)} ms`);
    console.log(`2. Database Query (Network):  ${dbDuration.toFixed(2)} ms`);
    console.log(`3. Response Transfer & Parse: ${transferParseDuration.toFixed(2)} ms`);
    if (wasBackgrounded) {
      console.log(`4. Frontend Render / Commit:  N/A (tab was backgrounded during measurement)`);
    } else {
      console.log(`4. Frontend Render / Commit:  ${renderDuration.toFixed(2)} ms`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    if (wasBackgrounded) {
      console.log(`⏱️ Total Latency (Network):   ${totalNetworkDuration.toFixed(2)} ms (Render skipped: tab backgrounded)`);
    } else {
      console.log(`⏱️ Total Latency:            ${totalDuration.toFixed(2)} ms`);
    }
    console.log(`📦 Payload Size:             ${payloadKb} KB (${trace.payloadSizeBytes || 0} bytes)`);
    console.log(`🔢 Records Count:            ${trace.recordCount ?? 'N/A'}`);
    console.log(`🔗 Endpoint:                 ${trace.url}`);
    console.groupEnd();

    this.activeTraces.delete(traceId);
  }
}

export const profiler = new PerformanceProfiler();
