import { showBlockSuggestionModal } from '../components/block-modal';
import {
  showContentQualityWhyPanel,
  type QualityWhyContext,
} from '../components/content-quality-why';
import { showDrawer } from '../components/drawer';
import type { ContentQualityProfile } from '../lib/types';
import { normalizeReputationResult } from '../lib/scoring/normalize-result';
import { parseGraphQLBody } from '../lib/x-api/normalizers';
import { sendMessage } from '../lib/messaging';
import { safeSend } from './content/lifecycle';
import type { BlockSuggestion, ReputationResult } from '../lib/types';
import { GRAPHQL_EVENT, cs } from './content/state';
import { bootstrap, scheduleScan } from './content/scan-scheduler';
import { initAttentionTracker } from './content/attention-tracker';
import { initUserActionTracking } from './content/user-actions';
import { refreshBadgesForHandle, refreshProfile, scanAndBadge } from './content/profile-ui';

export default defineContentScript({
  matches: ['*://x.com/*', '*://twitter.com/*'],
  runAt: 'document_idle',
  async main() {
    safeSend(sendMessage({ type: 'RESET_BROWSE_SESSION' }));
    initUserActionTracking();
    initAttentionTracker();

    const hookUrl = browser.runtime.getURL('graphql-hook.js');
    const script = document.createElement('script');
    script.src = hookUrl;
    script.async = false;
    (document.head ?? document.documentElement).appendChild(script);

    window.addEventListener(GRAPHQL_EVENT, ((e: CustomEvent) => {
      const { url, body } = e.detail ?? {};
      if (!url || !body) return;
      const parsed = parseGraphQLBody(url, body, {
        defaultHandle: cs.primaryAccount?.handle ?? '',
      });
      if (parsed.kind === 'analytics' && parsed.analytics) {
        safeSend(sendMessage({ type: 'ANALYTICS_PAYLOAD', snapshot: parsed.analytics }));
        return;
      }
      if (parsed.kind === 'timeline' && parsed.timelineHandles?.length) {
        safeSend(
          sendMessage({
            type: 'GRAPHQL_TIMELINE_AUTHORS',
            handles: parsed.timelineHandles,
          }),
        );
      }
      if (parsed.handle && parsed.profile) {
        safeSend(
          sendMessage({
            type: 'GRAPHQL_PROFILE',
            handle: parsed.handle,
            profile: parsed.profile,
          }),
        );
        void scanAndBadge(parsed.handle, parsed.profile);
      }
    }) as EventListener);

    browser.runtime.onMessage.addListener((msg) => {
      if (msg?.type === 'XREP_BOOTSTRAP') {
        void bootstrap();
        return;
      }
      if (msg?.type === 'SHOW_BLOCK_SUGGESTION') {
        showBlockSuggestionModal(msg.result as ReputationResult, msg.suggestion as BlockSuggestion);
      }
      if (msg?.type === 'SLOP_UPDATED' || msg?.type === 'TOXICITY_UPDATED') {
        const handle = (msg.handle as string)?.toLowerCase();
        const raw = msg.result as Partial<ReputationResult> | undefined;
        if (!handle || !raw?.handle) return;
        void refreshBadgesForHandle(handle, normalizeReputationResult({ ...raw, handle }));
      }
    });

    document.addEventListener('xrh-open-drawer', ((e: CustomEvent) => {
      const detail = e.detail as Partial<ReputationResult> & { handle?: string };
      if (!detail?.handle) return;
      const result = normalizeReputationResult(detail as ReputationResult & { handle: string });
      showDrawer(result, () => void refreshProfile(result.handle));
    }) as EventListener);

    document.addEventListener('xrh-show-quality-why', ((e: CustomEvent) => {
      const detail = e.detail as {
        profile?: ContentQualityProfile;
        ctx?: QualityWhyContext;
      };
      if (!detail?.profile) return;
      showContentQualityWhyPanel(detail.profile, detail.ctx);
    }) as EventListener);

    document.addEventListener('xrh-request-block', ((e: CustomEvent) => {
      showBlockSuggestionModal(e.detail.result as ReputationResult);
    }) as EventListener);

    void bootstrap();
    const observer = new MutationObserver(() => scheduleScan());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', () => void bootstrap());
  },
});
