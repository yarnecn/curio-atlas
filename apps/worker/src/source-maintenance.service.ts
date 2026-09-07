import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { Phase1Repository, type DueSourceFeed, type SourceFetchResult } from '@knowledge-map/database';
import { draftEvidence } from './ai-adapter';

const crawlerScript = process.env.CRAWLER_SCRIPT_PATH
  ?? [resolve(process.cwd(), 'tools/crawler/fetch_source.py'), resolve(process.cwd(), '../../tools/crawler/fetch_source.py')]
    .find((path) => existsSync(path))
  ?? resolve(process.cwd(), 'tools/crawler/fetch_source.py');

export interface SourceMaintenanceRunSummary {
  scannedSources: number;
  newEvidencePackages: number;
  processedEvidencePackages: number;
}

@Injectable()
export class SourceMaintenanceService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SourceMaintenanceService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(@Inject(Phase1Repository) private readonly repository: Phase1Repository) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.SOURCE_ONCE_MODE === 'true') return;
    if (process.env.SOURCE_AUTOMATION_ENABLED !== 'true') {
      this.logger.log('来源自动维护已关闭；手动立即抓取仍可通过任务队列执行。');
      return;
    }
    await this.runOnce();
    const intervalMs = Number.parseInt(process.env.SOURCE_SCAN_INTERVAL_MS ?? '300000', 10);
    this.timer = setInterval(() => void this.runOnce(), Math.max(intervalMs, 60_000));
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<SourceMaintenanceRunSummary> {
    const summary: SourceMaintenanceRunSummary = { scannedSources: 0, newEvidencePackages: 0, processedEvidencePackages: 0 };
    if (this.running) return summary;
    this.running = true;
    try {
      const scanBatchSize = Math.min(100, Math.max(1, Number.parseInt(process.env.SOURCE_SCAN_BATCH_SIZE ?? '10', 10)));
      const feeds = await this.repository.claimDueSourceFeeds(scanBatchSize);
      summary.scannedSources = feeds.length;
      for (const feed of feeds) {
        const result = await this.fetchSource(feed).catch((error: unknown): SourceFetchResult => ({
          status: 'failed', error: error instanceof Error ? error.message : String(error),
        }));
        const evidenceId = await this.repository.recordSourceFetch(feed.id, result);
        if (evidenceId) {
          summary.newEvidencePackages += 1;
          this.logger.log(`Created evidence package ${evidenceId} from ${feed.name}.`);
        }
      }
      const draftBatchSize = Math.min(50, Math.max(1, Number.parseInt(process.env.SOURCE_DRAFT_BATCH_SIZE ?? '5', 10)));
      for (let index = 0; index < draftBatchSize; index += 1) {
        if (!await this.draftNextEvidence()) break;
        summary.processedEvidencePackages += 1;
      }
    } catch (error) {
      this.logger.warn(`Source scan will retry later: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
    return summary;
  }

  private async draftNextEvidence(): Promise<boolean> {
    const config = await this.repository.getAiRuntimeConfig();
    if (config.provider === 'rules') return false;
    const evidence = await this.repository.claimReadyEvidence();
    if (!evidence) return false;
    try {
      const draft = await draftEvidence(config, evidence);
      const created = await this.repository.createInternalCandidate(evidence.createdBy, {
        topicId: evidence.topicId,
        proposedTitle: draft.proposedTitle,
        proposedSlug: draft.proposedSlug,
        statement: draft.statement,
        whyUseful: draft.whyUseful,
        applicability: draft.applicability,
        sourceUrl: evidence.sourceUrl,
        originType: 'source_discovery',
        triggerReason: `白名单来源“${evidence.feedName}”发生变化，系统已保存证据摘要。`,
        aiDisclosure: true,
      });
      await this.repository.startAiScreening(created.aiJobId);
      await this.repository.completeAiScreening(created.aiJobId, created.submission.id, {
        refinedStatement: draft.statement,
        riskFlags: [],
        provider: draft.provider,
        model: draft.model,
        inputTokens: draft.inputTokens,
        outputTokens: draft.outputTokens,
      });
      await this.repository.completeEvidenceDraft(evidence.id, created.submission.id);
      this.logger.log(`Created review candidate ${created.submission.id} from evidence ${evidence.id}.`);
      return true;
    } catch (error) {
      await this.repository.failEvidenceDraft(evidence.id, error instanceof Error ? error.message : String(error));
      return true;
    }
  }

  private fetchSource(feed: DueSourceFeed): Promise<SourceFetchResult> {
    const payload = JSON.stringify({
      url: feed.url,
      name: feed.name,
      crawlMode: feed.crawlMode,
      maxPages: feed.maxPagesPerScan,
      etag: feed.etag,
      lastModified: feed.lastModified,
      keywords: [feed.topicName, ...feed.topicDescription.split(/[、，。；\s]+/)],
      maxBytes: Number.parseInt(process.env.SOURCE_MAX_BYTES ?? '2000000', 10),
      timeoutSeconds: Number.parseInt(process.env.SOURCE_FETCH_TIMEOUT_SECONDS ?? '20', 10),
    });
    return new Promise((resolve, reject) => {
      const child = spawn(process.env.PYTHON_BIN ?? 'python', [crawlerScript], {
        stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => child.kill(), 65_000);
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { stdout = (stdout + chunk).slice(-1_000_000); });
      child.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-4_000); });
      child.on('error', reject);
      child.on('close', () => {
        clearTimeout(timer);
        try {
          const parsed = JSON.parse(stdout.trim()) as SourceFetchResult;
          if (parsed.status === 'failed') reject(new Error(parsed.error ?? (stderr || 'Python 抓取失败。')));
          else resolve(parsed);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(stderr || '无法解析 Python 抓取结果。'));
        }
      });
      child.stdin.end(payload);
    });
  }
}
