import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

const PRESETS = [
  "https://images.unsplash.com/photo-1497436072909-f5e4be1713a0",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba",
  "https://images.unsplash.com/photo-1470813740244-df37b8c1edcb",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429",
  "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07",
  "https://images.unsplash.com/photo-1502082553048-f009c37129b9",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
  uploadFile: (file: File) => Promise<string>;
}

export function CoverPicker({ open, onClose, onPick, uploadFile }: Props) {
  const [tab, setTab] = useState<"gallery" | "unsplash" | "upload" | "link">("gallery");
  const [query, setQuery] = useState("landscape");
  const [results, setResults] = useState<Array<{ id: string; url: string; thumb: string; credit: string }>>([]);
  const [link, setLink] = useState("");

  useEffect(() => {
    if (tab !== "unsplash") return;
    let cancelled = false;
    api.get<{ results: typeof results }>(`/unsplash/search?q=${encodeURIComponent(query)}`).then((r) => {
      if (!cancelled) setResults(r.results);
    });
    return () => { cancelled = true; };
  }, [tab, query]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a cover</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 border-b border-border pb-2 text-sm">
          {(["gallery", "unsplash", "upload", "link"] as const).map((t) => (
            <button
              key={t}
              className={`rounded px-2 py-1 ${tab === t ? "bg-accent" : "hover:bg-accent"}`}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {tab === "gallery" && (
          <div className="grid max-h-[400px] grid-cols-3 gap-2 overflow-y-auto">
            {PRESETS.map((url) => (
              <button
                key={url}
                onClick={() => onPick(`${url}?w=1200&h=400&fit=crop`)}
                className="aspect-[3/1] overflow-hidden rounded hover:opacity-80"
              >
                <img src={`${url}?w=400&h=140&fit=crop`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {tab === "unsplash" && (
          <div>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Unsplash…" />
            {results.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                No results. Set <code>UNSPLASH_ACCESS_KEY</code> in your .env to enable.
              </p>
            )}
            <div className="mt-2 grid max-h-[360px] grid-cols-3 gap-2 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onPick(r.url)}
                  className="aspect-[3/1] overflow-hidden rounded hover:opacity-80"
                  title={r.credit}
                >
                  <img src={r.thumb} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
        {tab === "upload" && (
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = await uploadFile(f);
                onPick(url);
              }}
              className="text-sm"
            />
          </div>
        )}
        {tab === "link" && (
          <div className="space-y-2">
            <Input placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} />
            <button
              className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              onClick={() => link && onPick(link)}
            >
              Use image
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
