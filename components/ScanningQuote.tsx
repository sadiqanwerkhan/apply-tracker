"use client";

import { useEffect, useState } from "react";

// Curated, unattributed encouragement for the job-hunting grind.
// Unattributed on purpose: avoids misattribution, and reads as personal.
const QUOTES = [
  "Every rejection is one step closer to the yes that matters.",
  "The right opportunity is out there, looking for you too.",
  "You only have to be right once.",
  "Persistence turns 'not yet' into 'welcome aboard.'",
  "Each application is a seed. Some just take longer to grow.",
  "A 'no' is rarely about your worth, and almost always about their fit.",
  "Talent gets noticed, but tenacity gets hired.",
  "The hardest part of any search is the part right before it works.",
  "One good conversation can change everything.",
  "You are more qualified than the doubting voice claims.",
  "Momentum is built one small action at a time.",
  "Today's effort is tomorrow's offer.",
  "The job that's right for you won't ask you to be someone else.",
  "Rejection is redirection toward a better match.",
  "Every expert was once a candidate waiting to hear back.",
  "Your skills are real. Your progress is real. Keep moving.",
  "The waiting is hard, but giving up is harder. Don't.",
  "Doors open for the people who keep knocking.",
  "Each 'no' clears the path to the one that says yes.",
  "Confidence is built in the trying, not the outcome.",
  "You've already done the brave part: you started.",
  "Small consistent effort beats occasional bursts. You've got this.",
  "Somewhere, a team is about to be glad they found you.",
  "Progress isn't always visible, but it's always happening.",
  "The search ends the moment before you'd have quit. So don't.",
  "Your future colleagues are out there. Keep reaching them.",
  "Hard work in silence becomes success out loud.",
  "Show up for your future self today.",
  "The best candidates apply anyway, doubts and all.",
  "Keep going. The market rewards those who outlast the noise.",
];

export default function ScanningQuote() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false); // fade out
      setTimeout(() => {
        setIndex((i) => (i + 1) % QUOTES.length);
        setVisible(true); // fade in next
      }, 350);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4 mb-2">
      <div className="flex items-center gap-2 mb-4 text-indigo-500">
        <span className="inline-block h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
        <span className="text-xs font-semibold uppercase tracking-wide">Scanning your inbox…</span>
      </div>
      <p
        className={`text-lg md:text-xl font-medium text-gray-700 max-w-xl leading-relaxed transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {QUOTES[index]}
      </p>
    </div>
  );
}
