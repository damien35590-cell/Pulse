"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, SkipForward, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { fmtClock } from "@/lib/format";
import { ConfirmSheet } from "@/components/ui/bottom-sheet";
import { NumberStepper } from "@/components/ui/number-stepper";
import { CodeBadge } from "@/components/workout/catalog-bits";
import { BodyMap } from "@/components/body/body-map";
import { WarmupBlock } from "@/components/workout/warmup-block";
import { catalogExercise } from "@/lib/workout/catalog";
import { musclesOfCode } from "@/lib/workout/body";
import { startWarmup, warmupPayload, type WarmupItem, type WarmupLive } from "@/lib/workout/warmup";
import { TEST_INSTRUCTION, TEST_MAX_REPS, TEST_ORDER, TEST_REST_S, type TestCode, type TestResult } from "@/lib/workout/lafay-test";
import { useHeartRate } from "@/stores/heart-rate";
import { useWakeLock } from "@/lib/use-wake-lock";

const STORE = "pulse-lafay-test-v1";
const MAX_AGE_MS = 3 * 3600 * 1000;
type Phase = "warmup" | "step" | "rest";
type State = { v: 1; startedAt: number; phase: Phase; idx: number; results: Partial<TestResult>; restEndsAt: number | null; warmup: WarmupLive | null };

const family = (code: string) => code.replace(/\d+$/, "");
const famName = (code: TestCode) => catalogExercise(code)?.name ?? code;

function readStored(): State | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) ?? "null") as State | null;
    if (s?.v === 1 && Date.now() - s.startedAt < MAX_AGE_MS) return s;
  } catch { /* stockage indisponible */ }
  return null;
}
/** Fin du repos (écoulé ou passé) : exercice suivant. */
const nextStep = (s: State): State => ({ ...s, phase: "step", idx: Math.min(s.idx + 1, TEST_ORDER.length - 1), restEndsAt: null });
const clearStored = () => { try { localStorage.removeItem(STORE); } catch { /* */ } };

type Props = {
  /** Échauffement proposé (Vous › Réglages) ; vide = pas de bloc. */
  warmupDefaults: WarmupItem[];
  /** Dernier test : valeur de départ des steppers et rappel « Test précédent ». */
  prev: TestResult | null;
  /** Enregistre le test terminé ; renvoie son id (page résultat) ou lève une erreur lisible. */
  onSave: (body: { result: TestResult; takenAt: string; durationS: number; hrSeries: unknown; warmup: unknown }) => Promise<string>;
  /** Démo /ui-kit : pas d'écran allumé, pas de ceinture, pas d'enregistrement. */
  demo?: boolean;
};

/**
 * Test de niveau Lafay guidé, en plein écran comme une séance : échauffement (facultatif), puis A, B, C, A1 au maximum de répétitions,
 * 3 min de repos entre chaque (passable, vibration à la fin, sans son). La FC est enregistrée si une ceinture est connectée, sans être affichée.
 * Cibles de 56 px, action principale en bas en h-16. Rien n'est enregistré avant la fin ; un rafraîchissement reprend le test.
 */
export function LafayTestFlow({ warmupDefaults, prev, onSave, demo = false }: Props) {
  const router = useRouter();
  const [s, setS] = useState<State | null>(null);
  const [reps, setReps] = useState(0);
  const [quit, setQuit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useWakeLock(!demo);

  useEffect(() => {
    const stored = demo ? null : readStored();
    const startedAt = Date.now(), w = startWarmup(warmupDefaults);
    setS(stored ?? { v: 1, startedAt, phase: w ? "warmup" : "step", idx: 0, results: {}, restEndsAt: null, warmup: w });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ceinture cardio : la série part avec le test, comme pour une séance (même tampon par heure de début).
  useEffect(() => {
    if (demo || !s) return;
    const hr = useHeartRate.getState();
    hr.begin(String(s.startedAt), s.startedAt);
    return () => hr.detach();
  }, [demo, s?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!s || demo) return;
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* stockage indisponible */ }
  }, [s, demo]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const code = s ? TEST_ORDER[s.idx] : "A";
  // Stepper : la valeur du test précédent pour cet exercice, sinon 0.
  useEffect(() => { if (s?.phase === "step") setReps(s.results[code] ?? prev?.[code] ?? 0); }, [s?.phase, s?.idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fin du repos : vibration, exercice suivant.
  const left = s?.restEndsAt ? Math.max(0, Math.ceil((s.restEndsAt - now) / 1000)) : 0;
  const ended = useRef<number | null>(null);
  useEffect(() => {
    if (s?.phase !== "rest" || left > 0 || ended.current === s.restEndsAt) return;
    ended.current = s.restEndsAt;
    tap(200);
    setS(nextStep(s));
  }, [s, left]);

  if (!s) return <div className="fixed inset-0 z-50 bg-bg" />;
  const elapsed = Math.max(0, Math.round((now - s.startedAt) / 1000));

  async function validate() {
    if (!s || saving) return;
    tap(18);
    const results = { ...s.results, [code]: reps };
    if (s.idx < TEST_ORDER.length - 1) {
      setS({ ...s, results, phase: "rest", restEndsAt: Date.now() + TEST_REST_S * 1000 });
      return;
    }
    setS({ ...s, results });
    if (demo) return;
    setSaving(true);
    setErr("");
    try {
      const id = await onSave({
        result: results as TestResult, takenAt: new Date(s.startedAt).toISOString(), durationS: Math.round((Date.now() - s.startedAt) / 1000),
        hrSeries: useHeartRate.getState().samples, warmup: warmupPayload(s.warmup, s.startedAt, Date.now()) ?? null,
      });
      useHeartRate.getState().discard();
      clearStored();
      router.replace(`/plan/test/${id}`);
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "Impossible d’enregistrer : réessaie.");
      setSaving(false);
    }
  }

  function abandon() {
    if (!demo) { useHeartRate.getState().discard(); clearStored(); }
    router.replace("/plan");
  }

  const quitSheet = (
    <ConfirmSheet
      open={quit}
      onClose={() => setQuit(false)}
      onConfirm={abandon}
      title="Abandonner le test ?"
      message="Rien ne sera enregistré, et ton programme ne bougera pas."
      confirmLabel="Abandonner"
      cancelLabel="Continuer le test"
      destructive
    />
  );

  if (s.phase === "warmup" && s.warmup) {
    return (
      <div className="fixed inset-0 z-50 bg-bg">
        <WarmupBlock
          title="Test de niveau"
          startedAt={s.startedAt}
          warmup={s.warmup}
          onChange={(w) => setS({ ...s, warmup: w })}
          onDone={(w) => setS({ ...s, warmup: w, phase: "step" })}
          onMenu={() => setQuit(true)}
          startLabel="Commencer le test"
        />
        {quitSheet}
      </div>
    );
  }

  const ex = catalogExercise(code), m = musclesOfCode(family(code), code === family(code) ? null : code);
  const next = TEST_ORDER[s.idx + 1];

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full max-w-md flex-col">
        <header className="pt-safe-top">
          <div className="flex h-14 items-center gap-1 px-1">
            <button type="button" onClick={() => { tap(8); setQuit(true); }} aria-label="Abandonner le test" className={cn(ui.iconBtn, "size-14")}>
              <X className="size-6" aria-hidden />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[15px] font-semibold leading-tight">Test de niveau</p>
              <p className="font-num text-sm tabular-nums text-ink-mute">{fmtClock(elapsed)} · {s.idx + 1}/{TEST_ORDER.length}</p>
            </div>
            <span className="size-14" aria-hidden />
          </div>
          <ol className="flex gap-1.5 px-4 py-3" aria-label="Exercices du test">
            {TEST_ORDER.map((c, i) => {
              const done = s.results[c] != null && (i < s.idx || s.phase === "rest" && i === s.idx), on = i === s.idx && s.phase === "step";
              return (
                <li key={c} aria-current={on ? "step" : undefined}
                  className={cn("grid h-8 min-w-12 flex-1 place-items-center rounded-full font-num text-sm font-semibold tabular-nums", on ? "bg-ink text-bg" : done ? "bg-good/15 text-good" : "bg-surface-2 text-ink-soft")}>
                  {done ? <span className="flex items-center gap-1"><Check className="size-3.5" strokeWidth={3} aria-hidden />{s.results[c]}</span> : c}
                </li>
              );
            })}
          </ol>
        </header>

        {s.phase === "rest" ? (
          <RestCountdown left={left} next={next} onSkip={() => { tap(12); ended.current = s.restEndsAt; setS(nextStep(s)); }} />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className={ui.label}>Exercice {s.idx + 1}/{TEST_ORDER.length}</p>
                  <h1 className="mt-1 flex items-center gap-2 text-[26px] font-bold leading-tight tracking-tight"><CodeBadge code={code} />{ex?.name ?? code}</h1>
                  {ex?.subtitle && <p className="mt-0.5 text-ink-soft">{ex.subtitle}</p>}
                </div>
                {m && <BodyMap size="thumb" primary={m.primary} secondary={m.secondary} className="size-14 bg-surface" />}
              </div>
              <p className="mt-4 rounded-tile bg-brand/10 px-4 py-3 font-semibold text-ink">{TEST_INSTRUCTION}</p>
              {ex?.description && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{ex.description}</p>}
              <div className="mt-5">
                <NumberStepper label="Répétitions" value={reps} min={0} max={TEST_MAX_REPS} unit="reps" onChange={setReps} />
              </div>
              {prev && <p className="mt-2 text-center text-sm text-ink-mute">Test précédent : <span className="font-num tabular-nums text-ink-soft">{prev[code]}</span></p>}
              {err && <p role="alert" className="mt-3 text-sm font-medium text-bad">{err}</p>}
            </div>
            <footer className="border-t border-line/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <button type="button" disabled={saving} onClick={validate} className={cn(ui.btnPrimary, "h-16 w-full text-lg")}>
                <Check className="size-6" strokeWidth={3} aria-hidden />
                {saving ? "Enregistrement…" : `Valider · ${reps} rep${reps > 1 ? "s" : ""}`}
              </button>
            </footer>
          </>
        )}
      </div>
      {quitSheet}
    </div>
  );
}

/** Repos de 3 min entre deux exercices du test : anneau, chiffres de 88 px, « Passer » en bas. */
export function RestCountdown({ left, next, onSkip }: { left: number; next?: TestCode; onSkip: () => void }) {
  const R = 46, C = 2 * Math.PI * R, frac = Math.min(1, left / TEST_REST_S);
  return (
    <>
      <div role="timer" aria-live="off" aria-label={`Repos : ${fmtClock(left)}`} className="flex flex-1 flex-col items-center justify-center px-6">
        <p className={ui.label}>Repos</p>
        <div className="relative mt-5 size-64">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r={R} className="fill-none stroke-surface-2" strokeWidth="4" />
            <circle cx="50" cy="50" r={R} className="fill-none stroke-brand transition-[stroke-dashoffset] duration-300 ease-linear" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
          </svg>
          <span className="absolute inset-0 grid place-items-center font-num text-[88px] font-semibold leading-none tabular-nums">{fmtClock(left)}</span>
        </div>
        {next && (
          <p className="mt-6 flex items-center gap-2 text-sm text-ink-soft">
            Ensuite · <CodeBadge code={next} /> <span className="font-semibold text-ink">{famName(next)}</span>
          </p>
        )}
      </div>
      <footer className="border-t border-line/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <button type="button" onClick={onSkip} className={cn(ui.btnPrimary, "h-16 w-full text-lg")}>
          <SkipForward className="size-6" fill="currentColor" aria-hidden />Passer le repos
        </button>
      </footer>
    </>
  );
}
