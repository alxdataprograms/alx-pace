import { PartyPopper, Trophy } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

/** Shown when the current date is past the program's final week. */
export default function GraduationState({
  completedCount,
  totalLessons,
  gradedDone,
  totalGraded,
  totalWeeks,
}) {
  const { t } = useLang()
  const percent = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0
  const finished = completedCount >= totalLessons && totalLessons > 0

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-lime bg-navy-900 p-6 text-center text-paper shadow-glow">
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, #C4E878 0, transparent 40%), radial-gradient(circle at 80% 30%, #0452F0 0, transparent 45%)',
        }}
        aria-hidden="true"
      />
      <div className="relative">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-lime text-navy-900">
          <Trophy size={32} strokeWidth={2.25} aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold">
          {finished ? t.completedTitle : t.finishLineTitle}{' '}
          <PartyPopper className="inline h-6 w-6" aria-hidden="true" />
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/80">
          {finished ? t.completedBody(totalWeeks) : t.finishLineBody(totalWeeks)}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-3xl font-bold tabular-nums text-lime">{percent}%</p>
            <p className="text-xs text-white/70">{t.curriculumComplete}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-3xl font-bold tabular-nums text-lime">
              {gradedDone}
              <span className="text-lg text-white/60">/{totalGraded}</span>
            </p>
            <p className="text-xs text-white/70">{t.gradedMilestonesStat}</p>
          </div>
        </div>

        <p className="mt-4 text-sm font-bold text-lime">
          {t.lessonsComplete(completedCount, totalLessons)}
        </p>
      </div>
    </section>
  )
}
