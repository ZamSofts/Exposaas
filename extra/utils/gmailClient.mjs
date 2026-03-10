/**
 * Gmail API Client Utility
 *
 * Provides functions for Gmail OAuth2 and email fetching.
 * All functions accept a refreshToken and return data; no side effects on DB.
 */
import { google } from "googleapis";

/** Create a fresh OAuth2 client from env vars */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
}

/** Get an authenticated Gmail API client for a specific account */
export function getGmailClient(refreshToken) {
  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2 });
}

/** Generate the Google OAuth consent URL (readonly Gmail access) */
export function getAuthUrl() {
  const oauth2 = createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  });
}

/** Exchange an auth code (from OAuth callback) for tokens */
export async function exchangeCode(code) {
  const oauth2 = createOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

/** Get the email address of the authenticated user */
export async function getEmailAddress(refreshToken) {
  const gmail = getGmailClient(refreshToken);
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data.emailAddress;
}

/**
 * Fetch new messages since lastHistoryId (incremental polling).
 *
 * If lastHistoryId is null (first poll), returns the last 20 messages with PDF attachments.
 * If historyId is expired (404), falls back to full re-sync.
 *
 * @returns {{ messages: Array<{id: string}>, newHistoryId: string }}
 */
export async function fetchNewMessages(refreshToken, lastHistoryId) {
  const gmail = getGmailClient(refreshToken);

  if (!lastHistoryId) {
    // First poll: only record the current historyId — don't fetch past emails.
    // This avoids flooding Gemini API with dozens of classification/extraction
    // calls on initial connect. Only new emails arriving after this point will
    // be processed.
    const profile = await gmail.users.getProfile({ userId: "me" });
    console.log("[gmail] First poll — recording historyId, skipping past emails");
    return { messages: [], newHistoryId: profile.data.historyId };
  }

  // Incremental: use history.list to find newly added messages
  try {
    const history = await gmail.users.history.list({
      userId: "me",
      startHistoryId: lastHistoryId,
      historyTypes: ["messageAdded"],
    });

    const newHistoryId = history.data.historyId;
    const records = history.data.history || [];

    // Extract unique message IDs from added messages
    const messageIds = new Set();
    for (const record of records) {
      for (const added of record.messagesAdded || []) {
        messageIds.add(added.message.id);
      }
    }

    return {
      messages: Array.from(messageIds).map((id) => ({ id })),
      newHistoryId,
    };
  } catch (err) {
    if (err.code === 404) {
      // historyId expired — re-sync by fetching recent messages
      console.warn("[gmail] historyId expired, fetching recent messages");
      return fetchRecentMessages(gmail);
    }
    throw err;
  }
}

/**
 * Fetch recent messages when historyId has expired.
 * Unlike first-poll (which skips everything), this fetches the last 50
 * messages so we don't miss emails that arrived while the historyId was stale.
 */
async function fetchRecentMessages(gmail) {
  const profile = await gmail.users.getProfile({ userId: "me" });
  const newHistoryId = profile.data.historyId;

  // Fetch last 50 messages (covers ~1 week of typical volume)
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: 50,
  });

  const messages = (list.data.messages || []).map((m) => ({ id: m.id }));
  console.log(
    `[gmail] Re-sync: found ${messages.length} recent messages to check`
  );

  return { messages, newHistoryId };
}

/** Download a message attachment as a Buffer */
export async function downloadAttachment(refreshToken, messageId, attachmentId) {
  const gmail = getGmailClient(refreshToken);
  const attachment = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });
  // Gmail API returns base64url-encoded data
  return Buffer.from(attachment.data.data, "base64url");
}

/**
 * Walk the MIME parts tree to find PDF attachments.
 * Returns array of { filename, attachmentId, size }.
 */
export function getPdfAttachments(parts) {
  const pdfs = [];
  function walk(partList) {
    if (!partList) return;
    for (const part of partList) {
      if (
        part.filename &&
        part.filename.toLowerCase().endsWith(".pdf") &&
        part.body?.attachmentId
      ) {
        pdfs.push({
          filename: part.filename,
          attachmentId: part.body.attachmentId,
          size: part.body.size,
        });
      }
      if (part.parts) walk(part.parts);
    }
  }
  walk(Array.isArray(parts) ? parts : [parts]);
  return pdfs;
}
