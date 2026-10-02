import { listActivity } from "@/app/db";
import { Card, Empty, when } from "@/app/ui";

export default async function AccountPage() {
  const activity = await listActivity(20);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1>Account</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Edityy runs as a single local user for now. Sign-in is not built yet.
        </p>
      </header>

      <Card title="Your activity">
        {activity.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {activity.map((entry) => (
              <li key={entry.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                <span>{entry.summary}</span>
                <span className="shrink-0 text-xs text-neutral-400">{when(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}