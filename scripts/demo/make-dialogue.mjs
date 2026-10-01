#!/usr/bin/env node
/**
 * Builds the "before" minute for the site's demo: the fictional show
 * "שני מיקרופונים", episode 38 ("ללמוד שפה בפקקים"), extended to about a
 * minute. The show does not exist, so no real podcast is used and the topic is
 * neutral.
 *
 * The level gap is staged the way it happens in real shows: the host (עידו) is
 * in the studio, the guest (מאיה) joins remotely. Her lines get a narrow
 * call-like EQ and sit about 10 LU below his. That is the "before".
 * render-levelling.swift then plays it through the app's own audio chain.
 *
 * Lines 0-5 reuse the takes already made for the app captures (same voices,
 * same words), so the episode on the site matches the one in the screenshots.
 *
 *   node scripts/demo/make-dialogue.mjs        -> raw/demo/before.wav
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WORK = join(ROOT, "raw", "demo");
const CACHED = join(homedir(), "levelcast-marketing/marketing/video-knob/feed/lines");
mkdirSync(WORK, { recursive: true });

// Same key and lookup as the marketing scripts; the value is never logged.
const readKey = () => {
  for (const p of [join(homedir(), "levelcast-marketing/marketing/video-knob/.env"), join(homedir(), "uni-brain/docs/video/social-pov/.env")]) {
    if (!existsSync(p)) continue;
    const line = readFileSync(p, "utf8").split("\n").find((l) => l.trim().startsWith("ELEVENLABS_API_KEY="));
    const v = line?.split("=").slice(1).join("=").trim();
    if (v) return v;
  }
};
const KEY = process.env.ELEVENLABS_API_KEY || readKey();

const HOST = "IKne3meq5aSn9XLyUdCD"; // Charlie, עידו
const GUEST = "EXAVITQu4vr4xnSDxMaL"; // Sarah, מאיה
const SETTINGS = { stability: 0.35, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true };

const DIALOGUE = [
  [HOST, "אז את אומרת שאפשר ללמוד ספרדית רק בנסיעות?"],
  [GUEST, "לא רק אפשר. ככה אני למדתי. עשרים דקות הלוך, עשרים דקות חזור."],
  [HOST, "ולא נמאס לך אחרי שבוע?"],
  [GUEST, "נמאס, ברור. אבל גיליתי שעשר דקות ביום, כל יום, עובדות יותר טוב משעה אחת בשבוע."],
  [HOST, "רגע, תגידי את זה שוב. אני רוצה שכולם ישמעו."],
  [GUEST, "עשר דקות ביום, כל יום. זה כל הסוד."],
  [HOST, "ומה עושים כשיש פקק של שעה?"],
  [GUEST, "אז שומעים פרק שלם, ואחר כך חוזרים על המשפטים בקול. ברכב אף אחד לא שומע אותך."],
  [HOST, "זה בעצם היתרון של הרכב, לא?"],
  [GUEST, "בדיוק. בבית אני מתביישת לדבר לבד. ברכב אני מדברת ספרדית כל הדרך."],
  [HOST, "ומילים חדשות? את רושמת אותן איפשהו?"],
  [GUEST, "לא תוך כדי נהיגה, חס וחלילה. אני מחכה שאני עוצרת, ורק אז כותבת מה ששמעתי."],
];

// --dramatised widens the gap for the marketing film's opening (quiet speech
// near -30, loud near -8, as Amit asked for the first cut); same lines, same
// timing. The site demo always uses the plain mix.
const DRAMA = process.argv.includes("--dramatised");
const HOST_LUFS = -16;
// loudnorm stops at the true-peak ceiling, so the dramatised host gets a plain
// boost into a limiter instead.
const HOST_DRAMA = "volume=3dB,alimiter=limit=0.89:level=false";
const GUEST_LUFS = DRAMA ? -31 : -26; // about 10 LU under the host, like a quiet remote guest
// A remote guest arrives band-limited; this keeps the staging honest to life.
const GUEST_EQ = "highpass=f=180,lowpass=f=4200";

const parts = [];
for (let i = 0; i < DIALOGUE.length; i++) {
  const [voice, text] = DIALOGUE[i];
  const mp3 = join(WORK, `l${i}.mp3`);
  if (!existsSync(mp3) && i < 6 && existsSync(join(CACHED, `l${i}.mp3`))) copyFileSync(join(CACHED, `l${i}.mp3`), mp3);
  if (!existsSync(mp3)) {
    if (!KEY) { console.error("no ElevenLabs key"); process.exit(2); }
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_v3", language_code: "he", voice_settings: SETTINGS }),
    });
    if (!res.ok) { console.error(`line ${i}: ${res.status} ${await res.text()}`); process.exit(1); }
    writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
    console.log(`line ${i} generated`);
  }
  const isGuest = voice === GUEST;
  const wav = join(WORK, `${DRAMA ? "d" : "l"}${i}.wav`);
  const af = [isGuest ? GUEST_EQ : null, `loudnorm=I=${isGuest ? GUEST_LUFS : HOST_LUFS}:TP=-2:LRA=11`, DRAMA && !isGuest ? HOST_DRAMA : null].filter(Boolean).join(",");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp3, "-af", af, "-ac", "2", "-ar", "44100", wav]);
  parts.push(wav);
}

const gap = join(WORK, "gap.wav");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "0.45", "-c:a", "pcm_s16le", gap]);
const list = join(WORK, "concat.txt");
writeFileSync(list, parts.flatMap((p) => [`file '${p}'`, `file '${gap}'`]).join("\n"));
const out = join(WORK, DRAMA ? "dramatised.wav" : "before.wav");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c:a", "pcm_f32le", out]);
const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).toString().trim();
console.log(`-> ${out} (${(+dur).toFixed(1)} s)`);
