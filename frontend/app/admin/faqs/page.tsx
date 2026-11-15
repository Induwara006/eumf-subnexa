"use client";
import { useState } from "react";
import { ensureAdminSession, adminProofHeaders } from "@/lib/admin-proof";

type Faq = { id: string; question: string; answer: string; sort_order: number; published: boolean };
const EMPTY = { question: "", answer: "", sort_order: 0, published: true };

export default function FaqAdmin() {
  const [key, setKey] = useState("");
  const [items, setItems] = useState<Faq[]>([]);
  const [draft, setDraft] = useState(EMPTY);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(path: string, init: RequestInit = {}) {
    await ensureAdminSession(key);
    const response = await fetch(`/api/library/${path}`, {
      ...init,
      cache: "no-store",
      headers: { ...adminProofHeaders(key), ...(init.body ? { "Content-Type": "application/json" } : {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request failed.");
    return data;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const load = () =>
    run(async () => {
      const data = await call("admin/faqs");
      setItems(data.items || []);
    });

  const add = () =>
    run(async () => {
      await call("admin/faqs", { method: "POST", body: JSON.stringify(draft) });
      setDraft(EMPTY);
      const data = await call("admin/faqs");
      setItems(data.items || []);
      setMessage("FAQ added.");
    });

  const save = (item: Faq) =>
    run(async () => {
      await call(`admin/faqs/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          question: item.question,
          answer: item.answer,
          sort_order: Number(item.sort_order),
          published: item.published,
        }),
      });
      setMessage("FAQ saved.");
    });

  const remove = (item: Faq) =>
    run(async () => {
      if (!window.confirm("Delete this FAQ?")) return;
      await call(`admin/faqs/${item.id}`, { method: "DELETE" });
      setItems((arr) => arr.filter((x) => x.id !== item.id));
      setMessage("FAQ deleted.");
    });

  const update = (index: number, patch: Partial<Faq>) =>
    setItems((arr) => arr.map((x, j) => (j === index ? { ...x, ...patch } : x)));

  const inputClass =
    "block w-full rounded-lg border border-input bg-surface-primary p-3 outline-none focus:border-ring";

  return (
    <main className="mx-auto max-w-4xl space-y-5 bg-background p-6 text-ink">
      <h1 className="text-2xl">SubNexa · Support FAQ</h1>
      <p className="text-sm text-body">
        Restricted to library administrators. Published questions appear on the public Support page.
      </p>
      <div className="flex gap-2">
        <input
          aria-label="Library admin password"
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-input bg-surface-primary p-3 outline-none focus:border-ring"
          placeholder="Library admin password"
        />
        <button
          disabled={busy || !key}
          onClick={load}
          className="rounded-lg bg-[#161618] px-4 text-white transition-colors hover:bg-black"
        >
          Load FAQs
        </button>
      </div>
      {message && (
        <p role="status" className="text-body">
          {message}
        </p>
      )}

      <section className="space-y-3 rounded-2xl border border-border bg-cream p-5">
        <h2 className="font-medium">Add a question</h2>
        <input
          aria-label="New question"
          className={inputClass}
          maxLength={200}
          placeholder="Question"
          value={draft.question}
          onChange={(e) => setDraft({ ...draft, question: e.target.value })}
        />
        <textarea
          aria-label="New answer"
          className={inputClass}
          maxLength={2000}
          rows={4}
          placeholder="Answer"
          value={draft.answer}
          onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            Order
            <input
              type="number"
              min={0}
              max={9999}
              className="w-24 rounded-lg border border-input bg-surface-primary p-2"
              value={draft.sort_order}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
            />
            Published
          </label>
          <button
            disabled={busy || !key || draft.question.trim().length < 3 || !draft.answer.trim()}
            onClick={add}
            className="rounded-lg bg-[#161618] px-4 py-2 text-white transition-colors hover:bg-black"
          >
            Add
          </button>
        </div>
      </section>

      {items.map((item, i) => (
        <article key={item.id} className="space-y-3 rounded-2xl border border-border bg-cream p-5">
          <input
            aria-label="Question"
            className={inputClass}
            maxLength={200}
            value={item.question}
            onChange={(e) => update(i, { question: e.target.value })}
          />
          <textarea
            aria-label="Answer"
            className={inputClass}
            maxLength={2000}
            rows={4}
            value={item.answer}
            onChange={(e) => update(i, { answer: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              Order
              <input
                type="number"
                min={0}
                max={9999}
                className="w-24 rounded-lg border border-input bg-surface-primary p-2"
                value={item.sort_order}
                onChange={(e) => update(i, { sort_order: Number(e.target.value) })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.published}
                onChange={(e) => update(i, { published: e.target.checked })}
              />
              Published
            </label>
            <button
              disabled={busy}
              onClick={() => save(item)}
              className="rounded-lg bg-[#161618] px-4 py-2 text-white transition-colors hover:bg-black"
            >
              Save
            </button>
            <button
              disabled={busy}
              onClick={() => remove(item)}
              className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-black/10"
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </main>
  );
}
