import { getOwnAudit, getOwnRecentVideos, snapshotOwnChannel } from "@/lib/ownanalytics";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Returns the signed-in channel's audit: info + analytics + cached recent videos. */
export async function GET() {
  const audit = await getOwnAudit();
  if (audit.connected && audit.channel) {
    snapshotOwnChannel(audit.channel);
    const channelId = audit.channel.channelId;
    return Response.json({
      ...audit,
      recentVideos: getOwnRecentVideos(channelId),
    });
  }
  return Response.json(audit);
}

/** Same as GET, exposed as POST for client "refresh" actions. */
export async function POST() {
  const audit = await getOwnAudit();
  if (audit.connected && audit.channel) {
    snapshotOwnChannel(audit.channel);
    return Response.json({
      ...audit,
      recentVideos: getOwnRecentVideos(audit.channel.channelId),
    });
  }
  return Response.json(audit);
}
