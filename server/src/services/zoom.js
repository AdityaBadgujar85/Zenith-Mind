// src/services/zoom.js
import fetch from "node-fetch";

/**
 * Server-to-Server OAuth token
 * https://developers.zoom.us/docs/internal-apps/s2s-oauth/
 */
async function getZoomAccessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      "Zoom S2S OAuth credentials missing (ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET)."
    );
  }

  const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
    accountId
  )}`;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Zoom token non-JSON (${res.status}) ${text.slice(0, 200)}…`);
  }

  if (!res.ok || !data.access_token) {
    throw new Error(
      `Zoom token fetch failed (${res.status}): ${data?.reason || data?.message || text}`
    );
  }

  return data.access_token;
}

/**
 * Create a Zoom meeting.
 * If therapistZoomUserId is an email that’s not a managed Zoom user,
 * we fallback to `users/me/meetings` (hosted by the account owner).
 *
 * @param {Object} params
 * @param {string} params.therapistZoomUserId  Host email/userId or "me"
 * @param {string} params.topic
 * @param {string} params.start_time ISO string (UTC)
 * @param {number} params.duration minutes
 * @param {string} [params.timezone="UTC"]
 * @param {boolean} [params.allowAccountHostFallback=true]
 */
export async function createZoomMeeting({
  therapistZoomUserId,
  topic,
  start_time,
  duration,
  timezone = "UTC",
  allowAccountHostFallback = true,
}) {
  const accessToken = await getZoomAccessToken();

  const body = {
    topic,
    type: 2, // scheduled
    start_time,
    duration,
    timezone,
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      mute_upon_entry: true,
      waiting_room: true,
      approval_type: 2,
    },
  };

  async function createFor(userId) {
    const url = `https://api.zoom.us/v2/users/${encodeURIComponent(userId)}/meetings`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Zoom non-JSON response (${res.status}) ${text.slice(0, 200)}…`);
    }

    if (!res.ok) {
      const msg = data?.message || `Zoom create meeting failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  // Direct host (email / id / "me")
  try {
    const host = therapistZoomUserId || process.env.ZOOM_HOST || "me";
    return await createFor(host);
  } catch (err) {
    const msg = String(err?.message || "");
    const isUserMissing =
      msg.toLowerCase().includes("user does not exist") ||
      msg.toLowerCase().includes("not found");

    if (allowAccountHostFallback && isUserMissing) {
      // Fallback to account owner
      return await createFor("me");
    }
    throw err;
  }
}

export default { createZoomMeeting };
