/**
 * Gmail OAuth 2.0 client utilities for Lawra9
 * Handles token exchange, refresh, and Gmail API calls
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

// Scope: read-only access to Gmail
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

/**
 * Build the Google OAuth authorization URL
 */
export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',   // Needed to get refresh_token
    prompt: 'consent',         // Force consent to always get refresh_token
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for access + refresh tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json();
}

/**
 * Refresh an expired access token using the stored refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }
  return res.json();
}

/**
 * Search Gmail messages matching a query string
 * Returns list of { id, threadId }
 */
export async function searchGmailMessages(
  accessToken: string,
  query: string,
  maxResults = 20
): Promise<Array<{ id: string; threadId: string }>> {
  const params = new URLSearchParams({
    q: query,
    maxResults: maxResults.toString(),
  });

  const res = await fetch(`${GMAIL_API_BASE}/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail search failed: ${err}`);
  }

  const data = await res.json();
  return data.messages || [];
}

/**
 * Fetch a single Gmail message by ID (full format for body/attachments)
 */
export async function getGmailMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const res = await fetch(
    `${GMAIL_API_BASE}/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail getMessage failed: ${err}`);
  }

  return res.json();
}

/**
 * Fetch a Gmail attachment by messageId + attachmentId
 * Returns base64url-encoded data
 */
export async function getGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<string> {
  const res = await fetch(
    `${GMAIL_API_BASE}/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail getAttachment failed: ${err}`);
  }

  const data = await res.json();
  return data.data; // base64url string
}

/**
 * Decode base64url string to plain text
 */
export function decodeBase64(base64url: string): string {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Extract plain text or HTML body from a Gmail message payload
 */
export function extractEmailBody(payload: GmailPayload): { text: string; html: string } {
  let text = '';
  let html = '';

  function walkParts(parts: GmailPart[]) {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text += decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html += decodeBase64(part.body.data);
      } else if (part.parts) {
        walkParts(part.parts);
      }
    }
  }

  if (payload.body?.data) {
    if (payload.mimeType === 'text/plain') text = decodeBase64(payload.body.data);
    if (payload.mimeType === 'text/html') html = decodeBase64(payload.body.data);
  } else if (payload.parts) {
    walkParts(payload.parts);
  }

  return { text, html };
}

/**
 * Extract PDF attachment info from a Gmail payload
 */
export function findPdfAttachments(payload: GmailPayload): Array<{
  filename: string;
  attachmentId: string;
}> {
  const results: Array<{ filename: string; attachmentId: string }> = [];

  function walkParts(parts: GmailPart[]) {
    for (const part of parts) {
      if (
        part.mimeType === 'application/pdf' &&
        part.body?.attachmentId &&
        part.filename
      ) {
        results.push({
          filename: part.filename,
          attachmentId: part.body.attachmentId,
        });
      }
      if (part.parts) walkParts(part.parts);
    }
  }

  if (payload.parts) walkParts(payload.parts);
  return results;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: GmailPayload;
  internalDate: string; // Unix ms timestamp as string
}

export interface GmailPayload {
  mimeType: string;
  headers: Array<{ name: string; value: string }>;
  body: { data?: string; attachmentId?: string; size: number };
  parts?: GmailPart[];
}

export interface GmailPart {
  mimeType: string;
  filename?: string;
  body: { data?: string; attachmentId?: string; size: number };
  parts?: GmailPart[];
}
