import { test, expect } from '@playwright/test';
import type { E2EFixtures } from '../global-setup';
import { createRoom, joinRoom } from '../helpers/api-setup';
import { openRoomChat, sendMessage, waitForMessage } from '../helpers/ui-helpers';
import fixtures from '../../.e2e-fixtures.json' assert { type: 'json' };

const fx = fixtures as E2EFixtures;
const API = 'http://localhost:3000/api/v1';

async function openDmView(page: import('@playwright/test').Page, partnerUsername: string) {
  const contactsBtn = page.locator('button.app-topbar__tab', { hasText: 'Contacts' });
  if (await contactsBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await contactsBtn.click();
  }
  const row = page.locator('.contacts-sidebar__row', { hasText: partnerUsername });
  await row.waitFor({ timeout: 8_000 });
  await row.click();
  await page.waitForSelector('.msg-timeline', { timeout: 8_000 });
}

async function downloadWithCookie(url: string, cookieHeader: string) {
  const response = await fetch(url, {
    headers: { Cookie: cookieHeader },
  });
  return response;
}

async function apiFetch(path: string, opts: {
  cookieHeader: string;
  method?: string;
  body?: unknown;
}): Promise<Response> {
  return fetch(`${API}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      Cookie: opts.cookieHeader,
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

async function pasteAttachment(page: import('@playwright/test').Page, file: {
  name: string;
  mimeType: string;
  buffer: Buffer;
}) {
  await page.locator('[aria-label="Message input"]').evaluate(
    (element, payload) => {
      const transfer = new DataTransfer();
      const bytes = Uint8Array.from(payload.bytes);
      const pastedFile = new File([bytes], payload.name, { type: payload.mimeType });
      transfer.items.add(pastedFile);
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: transfer });
      element.dispatchEvent(event);
    },
    {
      name: file.name,
      mimeType: file.mimeType,
      bytes: Array.from(file.buffer.values()),
    },
  );
}

test.describe('Gap verification', () => {
  test('reply chip appears immediately after send without reload', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const ctxBob = await browser.newContext({ storageState: '.bob-session.json' });
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await pageAlice.goto('/');
      await pageBob.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await pageBob.waitForSelector('.app-layout', { timeout: 8_000 });

      await openRoomChat(pageAlice, fx.room);
      await openRoomChat(pageBob, fx.room);

      const originalMsg = `reply-source-${Date.now()}`;
      await sendMessage(pageBob, originalMsg);
      await waitForMessage(pageAlice, originalMsg, { timeout: 8_000 });

      const sourceBubble = pageAlice.locator('.msg-bubble', { hasText: originalMsg }).first();
      await sourceBubble.hover();
      await sourceBubble.locator('button', { hasText: 'Reply' }).click();

      await expect(pageAlice.locator('.reply-preview')).toContainText(fx.bob.username);
      await expect(pageAlice.locator('.reply-preview')).toContainText(originalMsg);

      const replyMsg = `reply-target-${Date.now()}`;
      await sendMessage(pageAlice, replyMsg);

      const ownReplyBubble = pageAlice.locator('.msg-bubble--own', { hasText: replyMsg }).last();
      await expect(ownReplyBubble.locator('.msg-bubble__reply-chip')).toContainText(fx.bob.username);
      await expect(ownReplyBubble.locator('.msg-bubble__reply-chip')).toContainText(originalMsg);
      await expect(pageAlice.locator('.reply-preview')).toHaveCount(0);
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });

  test('room attachments are visible cross-session and downloadable', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const ctxBob = await browser.newContext({ storageState: '.bob-session.json' });
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await pageAlice.goto('/');
      await pageBob.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await pageBob.waitForSelector('.app-layout', { timeout: 8_000 });

      await openRoomChat(pageAlice, fx.room);
      await openRoomChat(pageBob, fx.room);

      const filename = `room-attachment-${Date.now()}.txt`;
      const text = `room-attachment-msg-${Date.now()}`;
      await pageAlice.locator('input[type="file"]').setInputFiles({
        name: filename,
        mimeType: 'text/plain',
        buffer: Buffer.from('room attachment payload'),
      });

      await expect(pageAlice.locator('.msg-composer__attachment-chip')).toContainText(filename);
      await sendMessage(pageAlice, text);

      await expect(
        pageAlice.locator('.msg-bubble--own', { hasText: text }).locator('.msg-attachment-link'),
      ).toContainText(filename);

      const bobLink = pageBob.locator('.msg-attachment-link', { hasText: filename }).last();
      await expect(bobLink).toBeVisible({ timeout: 8_000 });
      const href = await bobLink.getAttribute('href');
      expect(href).toBeTruthy();

      const response = await downloadWithCookie(href!, fx.bob.cookieHeader);
      expect(response.ok).toBe(true);
      expect(response.headers.get('content-disposition')).toContain(filename);
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });

  test('dm attachments are visible cross-session and downloadable', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const ctxBob = await browser.newContext({ storageState: '.bob-session.json' });
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await pageAlice.goto('/');
      await pageBob.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await pageBob.waitForSelector('.app-layout', { timeout: 8_000 });

      await openDmView(pageAlice, fx.bob.username);
      await openDmView(pageBob, fx.alice.username);

      const filename = `dm-attachment-${Date.now()}.txt`;
      const text = `dm-attachment-msg-${Date.now()}`;
      await pageAlice.locator('input[type="file"]').setInputFiles({
        name: filename,
        mimeType: 'text/plain',
        buffer: Buffer.from('dm attachment payload'),
      });

      await expect(pageAlice.locator('.msg-composer__attachment-chip')).toContainText(filename);
      await sendMessage(pageAlice, text);

      await expect(
        pageAlice.locator('.msg-bubble--own', { hasText: text }).locator('.msg-attachment-link'),
      ).toContainText(filename);

      const bobLink = pageBob.locator('.msg-attachment-link', { hasText: filename }).last();
      await expect(bobLink).toBeVisible({ timeout: 8_000 });
      const href = await bobLink.getAttribute('href');
      expect(href).toBeTruthy();

      const response = await downloadWithCookie(href!, fx.bob.cookieHeader);
      expect(response.ok).toBe(true);
      expect(response.headers.get('content-disposition')).toContain(filename);
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });

  test('clipboard paste uploads an attachment into the composer', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const pageAlice = await ctxAlice.newPage();

    try {
      await pageAlice.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await openRoomChat(pageAlice, fx.room);

      const filename = `paste-attachment-${Date.now()}.txt`;
      const text = `paste-msg-${Date.now()}`;
      await pasteAttachment(pageAlice, {
        name: filename,
        mimeType: 'text/plain',
        buffer: Buffer.from('pasted attachment payload'),
      });

      await expect(pageAlice.locator('.msg-composer__attachment-chip')).toContainText(filename);
      await sendMessage(pageAlice, text);
      await expect(
        pageAlice.locator('.msg-bubble--own', { hasText: text }).locator('.msg-attachment-link'),
      ).toContainText(filename);
    } finally {
      await ctxAlice.close();
    }
  });

  test('attachment size limits reject oversized image and file uploads', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const pageAlice = await ctxAlice.newPage();

    try {
      await pageAlice.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await openRoomChat(pageAlice, fx.room);

      await pageAlice.locator('input[type="file"]').setInputFiles({
        name: `too-large-image-${Date.now()}.png`,
        mimeType: 'image/png',
        buffer: Buffer.alloc(3 * 1024 * 1024 + 1, 1),
      });
      await expect(pageAlice.locator('.msg-composer__error')).toContainText('3 MB or smaller');
      await expect(pageAlice.locator('.msg-composer__attachment-chip')).toHaveCount(0);

      await pageAlice.locator('input[type="file"]').setInputFiles({
        name: `too-large-file-${Date.now()}.bin`,
        mimeType: 'application/octet-stream',
        buffer: Buffer.alloc(20 * 1024 * 1024 + 1, 2),
      });
      await expect(pageAlice.locator('.msg-composer__error')).toContainText(/File too large|Payload Too Large/i);
      await expect(pageAlice.locator('.msg-composer__attachment-chip')).toHaveCount(0);
    } finally {
      await ctxAlice.close();
    }
  });

  test('attachment download is denied after room access is removed', async ({ browser }) => {
    const room = await createRoom(fx.alice, `acl-room-${Date.now()}`);
    await joinRoom(fx.bob, room.id);

    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const pageAlice = await ctxAlice.newPage();

    try {
      await pageAlice.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await openRoomChat(pageAlice, room);

      const filename = `acl-attachment-${Date.now()}.txt`;
      const text = `acl-msg-${Date.now()}`;
      await pageAlice.locator('input[type="file"]').setInputFiles({
        name: filename,
        mimeType: 'text/plain',
        buffer: Buffer.from('acl attachment payload'),
      });
      await expect(pageAlice.locator('.msg-composer__attachment-chip')).toContainText(filename);
      await sendMessage(pageAlice, text);

      const ownLink = pageAlice
        .locator('.msg-bubble--own', { hasText: text })
        .locator('.msg-attachment-link');
      await expect(ownLink).toContainText(filename);
      const href = await ownLink.getAttribute('href');
      expect(href).toBeTruthy();

      const removal = await apiFetch(
        `/rooms/${room.id}/manage/members/${fx.bob.id}`,
        {
          cookieHeader: fx.alice.cookieHeader,
          method: 'DELETE',
          body: { reason: 'e2e acl regression' },
        },
      );
      expect(removal.status).toBe(204);

      const denied = await downloadWithCookie(href!, fx.bob.cookieHeader);
      expect(denied.status).toBe(403);
    } finally {
      await ctxAlice.close();
    }
  });

  test('room reconnect catch-up uses after_watermark and delivers missed messages', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const ctxBob = await browser.newContext({ storageState: '.bob-session.json' });
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await pageAlice.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        (window as typeof window & { __historyFetches?: string[] }).__historyFetches = [];
        window.fetch = async (...args) => {
          const [input] = args;
          const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
          if (url.includes('/messages/rooms/') && url.includes('/history')) {
            (window as typeof window & { __historyFetches: string[] }).__historyFetches.push(url);
          }
          return nativeFetch(...args);
        };
      });

      await pageAlice.goto('/');
      await pageBob.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await pageBob.waitForSelector('.app-layout', { timeout: 8_000 });

      await openRoomChat(pageAlice, fx.room);
      await openRoomChat(pageBob, fx.room);

      const baselineMsg = `reconnect-baseline-${Date.now()}`;
      await sendMessage(pageAlice, baselineMsg);
      await waitForMessage(pageBob, baselineMsg, { timeout: 8_000 });

      await pageAlice.evaluate(() => {
        (window as typeof window & { __historyFetches?: string[] }).__historyFetches = [];
      });
      await ctxAlice.setOffline(true);

      const catchupMsg = `reconnect-catchup-${Date.now()}`;
      await sendMessage(pageBob, catchupMsg);
      await expect(pageBob.locator('.msg-bubble--own', { hasText: catchupMsg })).toBeVisible({ timeout: 8_000 });

      await ctxAlice.setOffline(false);
      await waitForMessage(pageAlice, catchupMsg, { timeout: 15_000 });
      await expect.poll(
        async () => pageAlice.evaluate(() =>
          ((window as typeof window & { __historyFetches?: string[] }).__historyFetches ?? [])
            .some((url) => url.includes('after_watermark=')),
        ),
        { timeout: 15_000 },
      ).toBe(true);
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });

  test('frozen DM remains reopenable after ban and reload', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const pageAlice = await ctxAlice.newPage();

    try {
      await pageAlice.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await openDmView(pageAlice, fx.bob.username);

      const banResponse = await apiFetch('/contacts/bans', {
        cookieHeader: fx.alice.cookieHeader,
        method: 'POST',
        body: { targetUserId: fx.bob.id },
      });
      expect(banResponse.status).toBe(204);

      await pageAlice.reload();
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await openDmView(pageAlice, fx.bob.username);

      await expect(pageAlice.locator('.rooms-view__header')).toContainText(fx.bob.username);
      await expect(pageAlice.locator('.rooms-badge', { hasText: 'read-only' })).toBeVisible();
      await expect(pageAlice.locator('.msg-composer__frozen')).toContainText('This conversation is read-only.');
      await expect(pageAlice.locator('[aria-label="Message input"]')).toBeDisabled();
      await expect(pageAlice.locator('.rooms-empty', { hasText: 'Add as friend' })).toHaveCount(0);
      await expect(pageAlice.locator('.error-msg', { hasText: /ban_exists|not_friends/i })).toHaveCount(0);
    } finally {
      await ctxAlice.close();
    }
  });
});
