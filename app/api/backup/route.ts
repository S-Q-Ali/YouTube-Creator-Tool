import { exportAll, importAll, validateBackupSize } from "@/lib/backup";

export const dynamic = "force-dynamic";

function downloadName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `niche-scope-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}.json`;
}

export async function GET() {
  const backup = exportAll();
  const body = JSON.stringify(backup, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${downloadName()}"`,
    },
  });
}

export async function POST(request: Request) {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return Response.json({ error: "Could not read request body" }, { status: 400 });
  }

  try {
    validateBackupSize(raw);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Backup file too large" },
      { status: 413 }
    );
  }

  let backup: unknown;
  try {
    backup = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON — not a backup file" }, { status: 400 });
  }

  try {
    const result = importAll(backup);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 400 }
    );
  }
}
