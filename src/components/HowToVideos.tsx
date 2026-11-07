"use client";

import { useState } from "react";
import { cx } from "./ui";

const VIDEOS = [
  { id: "patients", label: "Patients", blurb: "Find the clinic, book a slot, get a Patient ID and watch the queue. Next time, book with just the ID.", portrait: true },
  { id: "reception", label: "Reception", blurb: "Mark arrivals, send patients in, record payments, book walk-ins and set doctors' timings.", portrait: false },
  { id: "doctors", label: "Doctors", blurb: "Write and print prescriptions with Indian medicine autocomplete, look up history, see reports.", portrait: false },
] as const;

export function HowToVideos() {
  const [tab, setTab] = useState<(typeof VIDEOS)[number]["id"]>("patients");
  const v = VIDEOS.find((x) => x.id === tab)!;
  return (
    <div>
      <div role="tablist" className="mx-auto mb-5 grid max-w-md grid-cols-3 gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-line">
        {VIDEOS.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={cx("h-10 rounded-lg text-sm font-medium", tab === x.id ? "bg-brand-600 text-white" : "text-muted hover:text-ink")}
          >
            {x.label}
          </button>
        ))}
      </div>
      <p className="mx-auto mb-5 max-w-xl text-center text-sm text-muted">{v.blurb}</p>
      <div className={cx("mx-auto overflow-hidden rounded-2xl bg-black shadow-lg ring-1 ring-line", v.portrait ? "max-w-[300px]" : "max-w-4xl")}>
        <video
          key={v.id}
          className="block h-auto w-full"
          src={`/videos/${v.id}.mp4`}
          poster={`/videos/${v.id}.jpg`}
          controls
          playsInline
          preload="metadata"
        />
      </div>
    </div>
  );
}
