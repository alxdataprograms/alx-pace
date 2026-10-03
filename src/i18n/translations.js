/**
 * UI translations — English (default), French, Arabic.
 *
 * Every entry is a plain string or a function of counts/names returning the
 * full sentence (deterministic, dependency-free pluralization — Arabic's
 * dual/paucal rules live in small helpers here, not in components).
 *
 * Deliberately NOT translated: lesson, module and assessment titles from the
 * curriculum CSV — those are the official ALX course names learners must
 * match on the learning platform.
 */

// Arabic count helper: 1 → singular word, 2 → dual word, 3-10 → "N plural",
// 11+ → "N singular-accusative". Words supplied per use-site.
const arCount = (n, { one, two, few, many }) => {
  if (n === 1) return one
  if (n === 2) return two
  if (n >= 3 && n <= 10) return `${n} ${few}`
  return `${n} ${many}`
}

/*
  The program as it is named inside a LinkedIn post, per language. Data
  Analytics reads exactly as it did before Creative Tech existed. French keeps
  the English programme names, as it always has for Data Analytics; Arabic
  attaches the "for" prefix (لـ) the DA sentence was written with.
*/
const POST_PROGRAM = {
  en: { da: 'ALX Data Analytics', cc: 'ALX Content Creation', gd: 'ALX Graphic Design' },
  fr: { da: 'ALX Data Analytics', cc: 'ALX Content Creation', gd: 'ALX Graphic Design' },
  ar: { da: 'ALX لتحليل البيانات', cc: 'ALX لصناعة المحتوى', gd: 'ALX للتصميم الجرافيكي' },
}
const postProgram = (lang, m) => POST_PROGRAM[lang][m.program] ?? POST_PROGRAM[lang].da

/*
  What a curriculum row is called. A Data Analytics row is a lesson; a Creative
  Tech row may be a lesson, an activity or a quiz, so counting those as
  "lessons" undercounts what the learner actually did. Every count string takes
  the unit as its last argument and defaults to 'lesson', so DA reads exactly
  as it always has.
*/
const pick = (unit, lesson, item) => (unit === 'item' ? item : lesson)

const frPlural = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`

// Arabic-Indic digits (١٤) for the week counts that used to be hard-coded.
const arNum = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])

export const translations = {
  en: {
    dir: 'ltr',
    locale: 'en',
    langName: 'English',

    tagline: (program) => (program ? `${program} · Self-Pace` : 'Self-Pace Tracker'),
    trackChip: (weeks) => `${weeks}-Week Track`,

    programs: { da: 'Data Analytics', cc: 'Content Creation', gd: 'Graphic Design' },
    creativeTech: 'Creative Tech',
    pickerTitle: 'Which program are you in?',
    pickerBody:
      "Pick your ALX self-paced program and we'll pace its curriculum for you — week by week, no login needed.",
    pickerTrackTitle: 'Which Creative Tech track?',
    pickerTrackBody: 'Creative Tech has two self-paced tracks. Pick yours to load its weekly plan.',
    programMeta: (weeks, modules) => `${weeks} weeks · ${modules} modules`,
    creativeTechMeta: 'Content Creation or Graphic Design',
    pickerSwitchNote: 'Your progress in each program is saved separately on this device.',
    back: 'Back',
    chooseProgram: 'Choose your program',
    change: 'change',
    changeProgram: 'Change your program',
    selected: 'Selected',

    welcomeBack: () => `Welcome back, `,
    welcomeBackAfterName: `!`,
    weekSlogan: (week, slogan) => `Week ${week} — ${slogan}!`,
    started: (date) => `Started ${date}`,
    setStartDate: 'Set your start date',
    todayHint: (date) => `(today: ${date})`,
    yourName: 'Your name',
    editName: 'Edit your name',
    saveName: 'Save name',
    editStartDate: 'Edit your course start date',
    saveStartDate: 'Save start date',
    cancel: 'Cancel',
    doHardThings: 'Do Hard Things',

    promptTitle: 'Set your course start date',
    promptBody: (program, weeks) =>
      `Tell us when you started (or plan to start) and we'll pace the full ${weeks}-week ${program} track for you — week by week, no login needed.`,
    startPacing: 'Start pacing',
    startedToday: 'I started today',
    courseStartDate: 'Course start date',

    getReady: 'Get Ready',
    beginsIn: 'Course begins in',
    beginsInDays: (n) => `${n} ${n === 1 ? 'day' : 'days'}`,
    countdownBody: (slogan, program, weeks) =>
      `Your ${weeks}-week ${program} journey is queued up. ${slogan} — the countdown is part of the grind.`,
    firstUp: (weekLabel) => `First up · ${weekLabel}`,

    completedTitle: 'Course Completed!',
    finishLineTitle: 'You Reached the Finish Line!',
    completedBody: (weeks, unit) =>
      `Every ${pick(unit, 'lesson', 'item')} checked off across all ${weeks} weeks. That is what doing hard things looks like.`,
    finishLineBody: (weeks) =>
      `The ${weeks}-week timeline is complete. Wrap up any remaining items below to finish 100%.`,
    curriculumComplete: 'Curriculum complete',
    gradedMilestonesStat: 'Graded milestones',
    lessonsComplete: (done, total, unit) =>
      `${done} of ${total} ${pick(unit, 'lessons', 'items')} complete`,

    progressTitle: 'Curriculum Progress',
    itemsComplete: (done, total) => `${done} of ${total} items complete`,
    progressAria: (p) => `${p}% of the curriculum complete`,
    overallProgress: 'Overall progress',

    statusBehind: (n, unit) =>
      `Catch-up nudge: ${n} ${n === 1 ? pick(unit, 'lesson', 'item') : pick(unit, 'lessons', 'items')} from earlier weeks still open.`,
    statusOnTrack: 'Right on pace — keep the streak alive.',
    statusAhead: (n, unit) =>
      `You're ${n} ${n === 1 ? pick(unit, 'lesson', 'item') : pick(unit, 'lessons', 'items')} ahead of schedule. Excellent.`,
    weekOf: (week, total) => `Week ${week} of ${total}`,
    doneThisWeek: (done, total) => `${done}/${total} done this week`,
    gradedStillDue: (n) => `${n} graded ${n === 1 ? 'item' : 'items'} still due`,
    pacingStatusAria: 'Your pacing status',

    focusEyebrow: "This Week's Focus",
    focusAria: (weekLabel) => `This week's focus: ${weekLabel}`,

    milestonesTitle: 'Graded Milestones',
    milestonesDue: (n, weekLabel) => `${n} due in ${weekLabel} — these count toward your grade.`,
    milestonesNone:
      'No graded milestones this week — a great window to get ahead or reinforce the fundamentals.',
    milestonesAria: 'Graded milestones due this week',
    completed: 'Completed',

    badgeExam: 'Graded Exam',
    badgeProject: 'Integrated Project',
    badgeTest: 'Graded Test',
    badgeGraded: 'Graded',
    badgeQuiz: 'Quiz',
    badgeMastery: 'Mastery Project',
    activityChip: 'Activity',

    bufferChip: 'Buffer',
    halfWeekChip: '½ week',
    bufferRoadmapNote: 'Catch-up week — no new content',
    bufferStatus: 'Catch-up week',
    catchUpEyebrow: 'Catch-up Week',
    catchUpBody: (n) =>
      `No new content this week — use it to clear the ${n} ${n === 1 ? 'item' : 'items'} still open from earlier weeks.`,
    catchUpAllClear: "You're all caught up! Rest, review, or get a head start on next week.",
    catchUpMore: (n) => `+${n} more open — see the roadmap below`,
    showDone: (n) => `Show ${n} done`,
    hideDone: 'Hide done',

    roadmapTitle: (weeks) => `Full ${weeks}-Week Roadmap`,
    weekRange: (a, b) => (a === b ? `Week ${a}` : `Weeks ${a}–${b}`),
    current: 'Current',
    doneCount: (done, total) => `${done}/${total} done`,
    gradedCount: (n) => `${n} graded`,
    markWeekComplete: 'Mark week complete',
    clearWeek: 'Clear this week',
    fullCurriculumAria: 'Full curriculum',

    markComplete: (title) => `Mark "${title}" complete`,
    markIncomplete: (title) => `Mark "${title}" incomplete`,

    lightMode: 'Light mode',
    darkMode: 'Dark mode',
    switchTheme: (target) => `Switch to ${target} mode`,
    resetConfirm: "Reset your program, name, start date and all checked lessons? This can't be undone.",
    resetYes: 'Yes, reset',
    resetButton: 'Reset Profile Data',
    footerNote: (program) =>
      `ALX${program ? ` ${program}` : ''} · Self-Pace Tracker · Your data stays on this device.`,

    enableReminders: 'Enable weekly reminders',
    enabling: 'Enabling…',
    remindersOn: 'Weekly reminders on',
    notificationsAllowed: 'Notifications allowed',
    remindersBlocked: 'Notifications are blocked — allow them in your browser settings.',
    // Shown once, only to someone whose reminders were on at the app's previous
    // address. Notification permission is granted per origin and cannot be
    // carried across, so the honest thing is to say so rather than let a weekly
    // nudge stop arriving with no explanation.
    remindersLapsed: 'Your weekly reminders did not survive the move to the new address. Turn them back on below.',

    // ── Milestone celebration ──────────────────────────────────────────
    // The post body is written in the learner's own language. The campaign
    // hashtag is not translated — it is one tag ALX counts across every
    // market, and a localised variant would simply not be found.
    milestoneModuleTitle: (m) => `${m.title} — done`,
    milestoneProgrammeTitle: 'You finished the programme',
    milestoneModuleSub: (m) => `Module ${m.index} of ${m.total}, ${m.weeks} weeks of it.`,
    milestoneProgrammeSub: (m) => `All ${m.total} modules, ${m.lessons} lessons, ${m.weeks} weeks.`,
    milestoneShareIntro: 'Worth saying out loud. Post it as it is, or edit it once you get there.',
    milestoneShare: 'Share on LinkedIn',
    milestoneDismiss: 'Not now',
    milestoneCopied: 'Copied — if LinkedIn opens empty, paste it in.',
    milestoneOpened: 'LinkedIn is open in a new tab.',
    milestoneShareCommunity: 'Post in the community',
    milestoneCommunityOpened: 'Copied — paste it into the community post.',
    milestonePointsNote: 'Posting in the community earns Legacy Points toward rewards you can redeem when you graduate.',
    roadmapShare: 'Share',
    roadmapShareAria: (title) => `Share that you finished ${title}`,
    roadmapModuleDone: 'Complete',
    roadmapProgrammeDone: 'Whole programme complete',
    // Written in the first person, plainly. The pull is towards "Thrilled to
    // share that I have embarked on…", and that is what makes a campaign post
    // read as homework instead of as somebody saying something.
    postModuleDone: (m) =>
      `I have just finished ${m.title} — module ${m.index} of ${m.total} in the ${postProgram('en', m)} programme.`,
    postProgrammeDone: (m) =>
      `I have finished the ${postProgram('en', m)} programme: ${m.weeks} weeks, ${m.lessons} lessons, all ${m.total} modules.`,
    dismiss: 'Dismiss',

    reminderTitle: (week, total) => `ALX Pace — Week ${week} of ${total}`,
    reminderBehind: (behind, graded, unit) =>
      `${behind} ${behind === 1 ? pick(unit, 'lesson', 'item') : pick(unit, 'lessons', 'items')} to catch up · ${graded} graded due this week.`,
    reminderGraded: (n) =>
      `${n} graded ${n === 1 ? 'item' : 'items'} due this week — keep your pace.`,
    reminderOnTrack: (left, unit) =>
      `You're on track — ${left} ${left === 1 ? pick(unit, 'lesson', 'item') : pick(unit, 'lessons', 'items')} left this week.`,
    reminderBuffer: (n) =>
      n > 0
        ? `Catch-up week — ${n} ${n === 1 ? 'item' : 'items'} to clear.`
        : "Catch-up week — you're all caught up.",

    edit: 'edit',
    targetFinish: (date) => `Finish by ${date}`,
    promptFinishPreview: (date) => `With this start date, you'll be done by ${date}.`,
    yourPace: 'Your pace',
    paceValue: (n, unit) => `${n} ${pick(unit, 'lessons', 'items')}/week`,
    projectedFinishLabel: 'Projected finish',
    targetLabel: 'Target',
    finishDelta: (days) => {
      if (days === 0) return 'right on plan'
      const abs = Math.abs(days)
      const span = abs >= 14 ? `${Math.round(abs / 7)} weeks` : `${abs} ${abs === 1 ? 'day' : 'days'}`
      return days > 0 ? `≈ ${span} ahead of plan` : `≈ ${span} behind plan`
    },
    noPaceYet: (unit) => `Tick off your first ${pick(unit, 'lesson', 'item')} to unlock your finish forecast.`,
    noPaceYetMore: (n, unit) =>
      `Tick off ${n} more ${n === 1 ? pick(unit, 'lesson', 'item') : pick(unit, 'lessons', 'items')} to unlock your finish forecast.`,

    slogans: [
      'Do Hard Things',
      'Grit in Progress',
      'Show Up. Level Up.',
      'Consistency Compounds',
      'Learn. Build. Repeat.',
      'Progress Over Perfection',
      'Small Steps, Big Data',
      'Earned, Not Given',
    ],
    // Creative Tech's cycle: the same eight, with the one data pun swapped.
    // Same length and order, so a week's slogan only differs where DA's would
    // not make sense.
    slogansCreative: [
      'Do Hard Things',
      'Grit in Progress',
      'Show Up. Level Up.',
      'Consistency Compounds',
      'Learn. Build. Repeat.',
      'Progress Over Perfection',
      'Small Steps, Big Ideas',
      'Earned, Not Given',
    ],
    quotes: [
      'Discipline is choosing the rep you don’t feel like doing.',
      'Small consistent steps beat rare heroic sprints.',
      'Show up today. Momentum handles tomorrow.',
      'Hard things shrink when you start them.',
      'You don’t need motivation to open one lesson.',
      'Future you is built one checkbox at a time.',
      'Progress loves a schedule.',
      'Done today beats perfect someday.',
      'Every expert was once on Week 1.',
      'Consistency is a superpower anyone can have.',
      'Grit means returning after an off day.',
      'One lesson closer is still closer.',
      'The streak you keep is the skill you keep.',
      'Your pace, your path — just keep moving.',
    ],
  },

  fr: {
    dir: 'ltr',
    locale: 'fr',
    langName: 'Français',

    tagline: (program) => (program ? `${program} · À ton rythme` : 'Suivi à ton rythme'),
    trackChip: (weeks) => `Parcours ${weeks} semaines`,

    programs: { da: 'Data Analytics', cc: 'Création de contenu', gd: 'Design graphique' },
    creativeTech: 'Creative Tech',
    pickerTitle: 'Quel est ton programme ?',
    pickerBody:
      'Choisis ton programme ALX à ton rythme et nous rythmerons son parcours pour toi — semaine par semaine, sans compte.',
    pickerTrackTitle: 'Quel parcours Creative Tech ?',
    pickerTrackBody:
      'Creative Tech propose deux parcours à ton rythme. Choisis le tien pour charger son plan hebdomadaire.',
    programMeta: (weeks, modules) => `${weeks} semaines · ${modules} modules`,
    creativeTechMeta: 'Création de contenu ou Design graphique',
    pickerSwitchNote:
      'Ta progression dans chaque programme est enregistrée séparément sur cet appareil.',
    back: 'Retour',
    chooseProgram: 'Choisis ton programme',
    change: 'changer',
    changeProgram: 'Changer de programme',
    selected: 'Sélectionné',

    welcomeBack: () => `Bon retour, `,
    welcomeBackAfterName: ` !`,
    weekSlogan: (week, slogan) => `Semaine ${week} — ${slogan} !`,
    started: (date) => `Commencé le ${date}`,
    setStartDate: 'Définis ta date de début',
    todayHint: (date) => `(aujourd'hui : ${date})`,
    yourName: 'Ton nom',
    editName: 'Modifier ton nom',
    saveName: 'Enregistrer le nom',
    editStartDate: 'Modifier ta date de début',
    saveStartDate: 'Enregistrer la date',
    cancel: 'Annuler',
    doHardThings: 'Fais des choses difficiles',

    promptTitle: 'Définis ta date de début',
    promptBody: (program, weeks) =>
      `Dis-nous quand tu as commencé (ou comptes commencer) et nous rythmerons pour toi les ${weeks} semaines du parcours ${program} — semaine par semaine, sans compte.`,
    startPacing: 'Lancer le suivi',
    startedToday: "J'ai commencé aujourd'hui",
    courseStartDate: 'Date de début du cours',

    getReady: 'Prépare-toi',
    beginsIn: 'Le cours commence dans',
    beginsInDays: (n) => frPlural(n, 'jour', 'jours'),
    countdownBody: (slogan, program, weeks) =>
      `Ton parcours ${program} de ${weeks} semaines est prêt. ${slogan} — le compte à rebours fait partie de l'effort.`,
    firstUp: (weekLabel) => `Pour commencer · ${weekLabel}`,

    completedTitle: 'Cours terminé !',
    finishLineTitle: "Tu as atteint la ligne d'arrivée !",
    completedBody: (weeks, unit) =>
      `${pick(unit, 'Toutes les leçons', 'Tous les éléments')} des ${weeks} semaines sont ${pick(unit, 'cochées', 'cochés')}. Voilà ce que ça donne de faire des choses difficiles.`,
    finishLineBody: (weeks) =>
      `Les ${weeks} semaines sont écoulées. Termine les éléments restants ci-dessous pour atteindre 100 %.`,
    curriculumComplete: 'Parcours terminé',
    gradedMilestonesStat: 'Évaluations notées',
    lessonsComplete: (done, total, unit) =>
      `${done} ${pick(unit, 'leçons terminées', 'éléments terminés')} sur ${total}`,

    progressTitle: 'Progression du parcours',
    itemsComplete: (done, total) => `${done} éléments terminés sur ${total}`,
    progressAria: (p) => `${p} % du parcours terminé`,
    overallProgress: 'Progression globale',

    statusBehind: (n, unit) =>
      `À rattraper : ${pick(unit, frPlural(n, 'leçon des semaines précédentes', 'leçons des semaines précédentes'), frPlural(n, 'élément des semaines précédentes', 'éléments des semaines précédentes'))}.`,
    statusOnTrack: 'Parfaitement dans le rythme — continue sur ta lancée.',
    statusAhead: (n, unit) =>
      `Tu as ${pick(unit, frPlural(n, "leçon d'avance", "leçons d'avance"), frPlural(n, "élément d'avance", "éléments d'avance"))}. Excellent.`,
    weekOf: (week, total) => `Semaine ${week} sur ${total}`,
    doneThisWeek: (done, total) => `${done}/${total} cette semaine`,
    gradedStillDue: (n) => `${frPlural(n, 'évaluation à rendre', 'évaluations à rendre')}`,
    pacingStatusAria: 'Ton état de progression',

    focusEyebrow: 'Objectif de la semaine',
    focusAria: (weekLabel) => `Objectif de la semaine : ${weekLabel}`,

    milestonesTitle: 'Évaluations notées',
    milestonesDue: (n, weekLabel) => `${n} à rendre en ${weekLabel} — elles comptent pour ta note.`,
    milestonesNone:
      "Aucune évaluation notée cette semaine — parfait pour prendre de l'avance ou consolider les bases.",
    milestonesAria: 'Évaluations notées de la semaine',
    completed: 'Terminé',

    badgeExam: 'Examen noté',
    badgeProject: 'Projet intégré',
    badgeTest: 'Test noté',
    badgeGraded: 'Noté',
    badgeQuiz: 'Quiz',
    badgeMastery: 'Projet de maîtrise',
    activityChip: 'Activité',

    bufferChip: 'Rattrapage',
    halfWeekChip: '½ semaine',
    bufferRoadmapNote: 'Semaine de rattrapage — pas de nouveau contenu',
    bufferStatus: 'Semaine de rattrapage',
    catchUpEyebrow: 'Semaine de rattrapage',
    catchUpBody: (n) =>
      `Pas de nouveau contenu cette semaine — profites-en pour terminer ${frPlural(n, 'élément encore ouvert', 'éléments encore ouverts')} des semaines précédentes.`,
    catchUpAllClear:
      "Tu es à jour ! Repose-toi, révise ou prends de l'avance sur la semaine prochaine.",
    catchUpMore: (n) => `+${n} encore ouvert(s) — voir la feuille de route ci-dessous`,
    showDone: (n) => `Afficher ${frPlural(n, 'élément terminé', 'éléments terminés')}`,
    hideDone: 'Masquer les éléments terminés',

    roadmapTitle: (weeks) => `Feuille de route — ${weeks} semaines`,
    weekRange: (a, b) => (a === b ? `Semaine ${a}` : `Semaines ${a}–${b}`),
    current: 'En cours',
    doneCount: (done, total) => `${done}/${total} faits`,
    gradedCount: (n) => `${n} noté${n > 1 ? 's' : ''}`,
    markWeekComplete: 'Marquer la semaine terminée',
    clearWeek: 'Réinitialiser la semaine',
    fullCurriculumAria: 'Parcours complet',

    markComplete: (title) => `Marquer « ${title} » comme terminé`,
    markIncomplete: (title) => `Marquer « ${title} » comme non terminé`,

    lightMode: 'Mode clair',
    darkMode: 'Mode sombre',
    switchTheme: (target) => `Passer en ${target}`,
    resetConfirm:
      'Réinitialiser le programme, le nom, la date de début et toutes les leçons cochées ? Action irréversible.',
    resetYes: 'Oui, réinitialiser',
    resetButton: 'Réinitialiser mes données',
    footerNote: (program) =>
      `ALX${program ? ` ${program}` : ''} · Suivi à ton rythme · Tes données restent sur cet appareil.`,

    enableReminders: 'Activer les rappels hebdomadaires',
    enabling: 'Activation…',
    remindersOn: 'Rappels hebdomadaires activés',
    notificationsAllowed: 'Notifications autorisées',
    remindersBlocked:
      'Les notifications sont bloquées — autorise-les dans les réglages du navigateur.',
    remindersLapsed:
      'Tes rappels hebdomadaires n’ont pas survécu au changement d’adresse. Réactive-les ci-dessous.',

    milestoneModuleTitle: (m) => `${m.title} — terminé`,
    milestoneProgrammeTitle: 'Tu as terminé le parcours',
    milestoneModuleSub: (m) => `Module ${m.index} sur ${m.total}, ${m.weeks} semaines.`,
    milestoneProgrammeSub: (m) => `Les ${m.total} modules, ${m.lessons} leçons, ${m.weeks} semaines.`,
    milestoneShareIntro: 'À dire à voix haute. Publie-le tel quel, ou modifie-le une fois sur place.',
    milestoneShare: 'Partager sur LinkedIn',
    milestoneDismiss: 'Plus tard',
    milestoneCopied: 'Copié — si LinkedIn s’ouvre vide, colle-le.',
    milestoneOpened: 'LinkedIn est ouvert dans un nouvel onglet.',
    milestoneShareCommunity: 'Publier dans la communauté',
    milestoneCommunityOpened: 'Copié — colle-le dans la publication.',
    milestonePointsNote: 'Publier dans la communauté rapporte des Legacy Points, échangeables contre des récompenses à la remise des diplômes.',
    roadmapShare: 'Partager',
    roadmapShareAria: (title) => `Partager que tu as terminé ${title}`,
    roadmapModuleDone: 'Terminé',
    roadmapProgrammeDone: 'Programme entièrement terminé',
    postModuleDone: (m) =>
      `Je viens de terminer ${m.title} — module ${m.index} sur ${m.total} du parcours ${postProgram('fr', m)}.`,
    postProgrammeDone: (m) =>
      `J’ai terminé le parcours ${postProgram('fr', m)} : ${m.weeks} semaines, ${m.lessons} leçons, les ${m.total} modules.`,
    dismiss: 'Fermer',

    reminderTitle: (week, total) => `ALX Pace — Semaine ${week} sur ${total}`,
    reminderBehind: (behind, graded, unit) =>
      `${pick(unit, frPlural(behind, 'leçon à rattraper', 'leçons à rattraper'), frPlural(behind, 'élément à rattraper', 'éléments à rattraper'))} · ${graded} évaluation(s) cette semaine.`,
    reminderGraded: (n) =>
      `${frPlural(n, 'évaluation notée à rendre', 'évaluations notées à rendre')} cette semaine — garde le rythme.`,
    reminderOnTrack: (left, unit) =>
      `Tu es dans le rythme — ${pick(unit, frPlural(left, 'leçon restante', 'leçons restantes'), frPlural(left, 'élément restant', 'éléments restants'))} cette semaine.`,
    reminderBuffer: (n) =>
      n > 0
        ? `Semaine de rattrapage — ${frPlural(n, 'élément à terminer', 'éléments à terminer')}.`
        : 'Semaine de rattrapage — tu es à jour.',

    edit: 'modifier',
    targetFinish: (date) => `Fin prévue : ${date}`,
    promptFinishPreview: (date) => `Avec cette date de début, tu auras terminé le ${date}.`,
    yourPace: 'Ton rythme',
    paceValue: (n, unit) => `${n} ${pick(unit, 'leçons', 'éléments')}/semaine`,
    projectedFinishLabel: 'Fin estimée',
    targetLabel: 'Objectif',
    finishDelta: (days) => {
      if (days === 0) return 'pile dans les temps'
      const abs = Math.abs(days)
      const span =
        abs >= 14 ? `${Math.round(abs / 7)} semaines` : `${abs} ${abs === 1 ? 'jour' : 'jours'}`
      return days > 0 ? `≈ ${span} d'avance` : `≈ ${span} de retard`
    },
    noPaceYet: (unit) =>
      `Coche ${pick(unit, 'ta première leçon', 'ton premier élément')} pour débloquer ta date de fin estimée.`,
    noPaceYetMore: (n, unit) =>
      `Coche encore ${pick(unit, frPlural(n, 'leçon', 'leçons'), frPlural(n, 'élément', 'éléments'))} pour débloquer ta date de fin estimée.`,

    slogans: [
      'Fais des choses difficiles',
      'Le cran en action',
      'Présent aujourd’hui, meilleur demain',
      'La régularité paie',
      'Apprendre. Créer. Recommencer.',
      'Le progrès avant la perfection',
      'Petits pas, grandes données',
      'Ça se mérite',
    ],
    slogansCreative: [
      'Fais des choses difficiles',
      'Le cran en action',
      'Présent aujourd’hui, meilleur demain',
      'La régularité paie',
      'Apprendre. Créer. Recommencer.',
      'Le progrès avant la perfection',
      'Petits pas, grandes idées',
      'Ça se mérite',
    ],
    quotes: [
      'La discipline, c’est faire la répétition dont on n’a pas envie.',
      'De petits pas réguliers valent mieux que de rares sprints héroïques.',
      'Sois présent aujourd’hui. L’élan s’occupe de demain.',
      'Les choses difficiles rétrécissent dès qu’on les commence.',
      'Pas besoin de motivation pour ouvrir une leçon.',
      'Ton futur toi se construit case par case.',
      'Le progrès aime les rendez-vous réguliers.',
      'Fait aujourd’hui vaut mieux que parfait un jour.',
      'Chaque expert a connu sa Semaine 1.',
      'La régularité est un superpouvoir à la portée de tous.',
      'Le cran, c’est revenir après un jour sans.',
      'Une leçon de plus, c’est toujours ça de pris.',
      'La série que tu tiens, c’est la compétence que tu gardes.',
      'Ton rythme, ta route — continue d’avancer.',
    ],
  },

  ar: {
    dir: 'rtl',
    locale: 'ar',
    langName: 'العربية',

    tagline: (program) => (program ? `${program} · وتيرة ذاتية` : 'متابعة بالوتيرة الذاتية'),
    trackChip: (weeks) => `مسار ${arNum(weeks)} أسبوعًا`,

    programs: { da: 'تحليل البيانات', cc: 'صناعة المحتوى', gd: 'التصميم الجرافيكي' },
    creativeTech: 'التقنية الإبداعية',
    pickerTitle: 'في أي برنامج أنت؟',
    pickerBody:
      'اختر برنامجك من ALX بالوتيرة الذاتية وسننظّم لك منهجه — أسبوعًا بأسبوع، دون تسجيل دخول.',
    pickerTrackTitle: 'أي مسار في التقنية الإبداعية؟',
    pickerTrackBody: 'تضمّ التقنية الإبداعية مسارين بالوتيرة الذاتية. اختر مسارك لتحميل خطته الأسبوعية.',
    programMeta: (weeks, modules) =>
      `${arNum(weeks)} أسبوعًا · ${arNum(modules)} ${modules >= 3 && modules <= 10 ? 'وحدات' : 'وحدة'}`,
    creativeTechMeta: 'صناعة المحتوى أو التصميم الجرافيكي',
    pickerSwitchNote: 'يُحفَظ تقدّمك في كل برنامج بشكل منفصل على هذا الجهاز.',
    back: 'رجوع',
    chooseProgram: 'اختر برنامجك',
    change: 'تغيير',
    changeProgram: 'تغيير البرنامج',
    selected: 'مُختار',

    welcomeBack: () => `أهلاً بعودتك، `,
    welcomeBackAfterName: `!`,
    weekSlogan: (week, slogan) => `الأسبوع ${week} — ${slogan}!`,
    started: (date) => `بدأت في ${date}`,
    setStartDate: 'حدّد تاريخ بدايتك',
    todayHint: (date) => `(اليوم: ${date})`,
    yourName: 'اسمك',
    editName: 'تعديل الاسم',
    saveName: 'حفظ الاسم',
    editStartDate: 'تعديل تاريخ البداية',
    saveStartDate: 'حفظ التاريخ',
    cancel: 'إلغاء',
    doHardThings: 'افعل الأشياء الصعبة',

    promptTitle: 'حدّد تاريخ بداية الدورة',
    promptBody: (program, weeks) =>
      `أخبرنا متى بدأت (أو متى تنوي البدء) وسننظّم لك مسار ${program} الكامل على ${arNum(weeks)} أسبوعًا — أسبوعًا بأسبوع، دون تسجيل دخول.`,
    startPacing: 'ابدأ المتابعة',
    startedToday: 'بدأت اليوم',
    courseStartDate: 'تاريخ بداية الدورة',

    getReady: 'استعدّ',
    beginsIn: 'تبدأ الدورة بعد',
    beginsInDays: (n) => arCount(n, { one: 'يوم واحد', two: 'يومين', few: 'أيام', many: 'يومًا' }),
    countdownBody: (slogan, program, weeks) =>
      `رحلتك في ${program} على مدى ${arNum(weeks)} أسبوعًا جاهزة. ${slogan} — العدّ التنازلي جزء من الاجتهاد.`,
    firstUp: (weekLabel) => `نبدأ بـ · ${weekLabel}`,

    completedTitle: 'أكملت الدورة!',
    finishLineTitle: 'وصلت إلى خط النهاية!',
    completedBody: (weeks, unit) =>
      `أنجزت كل ${pick(unit, 'الدروس', 'العناصر')} على مدى ${arNum(weeks)} أسبوعًا. هكذا يبدو فعل الأشياء الصعبة.`,
    finishLineBody: (weeks) =>
      `اكتملت مدة المسار البالغة ${arNum(weeks)} أسبوعًا. أنهِ العناصر المتبقية أدناه لتصل إلى ١٠٠٪.`,
    curriculumComplete: 'اكتمال المنهج',
    gradedMilestonesStat: 'التقييمات المحتسبة',
    lessonsComplete: (done, total, unit) => `اكتمل ${done} من ${total} ${pick(unit, 'درسًا', 'عنصرًا')}`,

    progressTitle: 'التقدّم في المنهج',
    itemsComplete: (done, total) => `اكتمل ${done} من ${total} عنصرًا`,
    progressAria: (p) => `اكتمل ${p}٪ من المنهج`,
    overallProgress: 'التقدّم العام',

    statusBehind: (n, unit) =>
      `للحاق بالركب: ${arCount(n, pick(unit, { one: 'درس واحد', two: 'درسان', few: 'دروس', many: 'درسًا' }, { one: 'عنصر واحد', two: 'عنصران', few: 'عناصر', many: 'عنصرًا' }))} من الأسابيع السابقة ما زالت مفتوحة.`,
    statusOnTrack: 'أنت على الوتيرة الصحيحة — واصل التقدّم.',
    statusAhead: (n, unit) =>
      `أنت متقدّم بـ${arCount(n, pick(unit, { one: 'درس واحد', two: 'درسين', few: 'دروس', many: 'درسًا' }, { one: 'عنصر واحد', two: 'عنصرين', few: 'عناصر', many: 'عنصرًا' }))} عن الجدول. ممتاز.`,
    weekOf: (week, total) => `الأسبوع ${week} من ${total}`,
    doneThisWeek: (done, total) => `أُنجز ${done}/${total} هذا الأسبوع`,
    gradedStillDue: (n) =>
      `${arCount(n, { one: 'تقييم واحد مستحق', two: 'تقييمان مستحقان', few: 'تقييمات مستحقة', many: 'تقييمًا مستحقًا' })}`,
    pacingStatusAria: 'حالة تقدّمك',

    focusEyebrow: 'تركيز هذا الأسبوع',
    focusAria: (weekLabel) => `تركيز هذا الأسبوع: ${weekLabel}`,

    milestonesTitle: 'التقييمات المحتسبة',
    milestonesDue: (n, weekLabel) => `${n} مستحقة في ${weekLabel} — وهي تُحتسب في درجتك.`,
    milestonesNone: 'لا تقييمات محتسبة هذا الأسبوع — فرصة رائعة للتقدّم أو ترسيخ الأساسيات.',
    milestonesAria: 'التقييمات المستحقة هذا الأسبوع',
    completed: 'مكتمل',

    badgeExam: 'امتحان محتسب',
    badgeProject: 'مشروع متكامل',
    badgeTest: 'اختبار محتسب',
    badgeGraded: 'محتسب',
    badgeQuiz: 'اختبار قصير',
    badgeMastery: 'مشروع الإتقان',
    activityChip: 'نشاط',

    bufferChip: 'استدراك',
    halfWeekChip: 'نصف أسبوع',
    bufferRoadmapNote: 'أسبوع استدراك — لا محتوى جديد',
    bufferStatus: 'أسبوع استدراك',
    catchUpEyebrow: 'أسبوع الاستدراك',
    catchUpBody: (n) =>
      `لا محتوى جديد هذا الأسبوع — استغلّه لإنهاء ما تبقّى مفتوحًا من الأسابيع السابقة (${n}).`,
    catchUpAllClear: 'لا شيء متأخّر! استرح أو راجع أو ابدأ مبكرًا في الأسبوع القادم.',
    catchUpMore: (n) => `+${n} أخرى مفتوحة — راجع الخارطة أدناه`,
    showDone: (n) =>
      `عرض ${arCount(n, { one: 'عنصر واحد مكتمل', two: 'عنصرين مكتملين', few: 'عناصر مكتملة', many: 'عنصرًا مكتملًا' })}`,
    hideDone: 'إخفاء العناصر المكتملة',

    roadmapTitle: (weeks) => `خارطة الطريق الكاملة — ${arNum(weeks)} أسبوعًا`,
    weekRange: (a, b) => (a === b ? `الأسبوع ${a}` : `الأسابيع ${a}–${b}`),
    current: 'الحالي',
    doneCount: (done, total) => `أُنجز ${done}/${total}`,
    gradedCount: (n) => `${n} محتسب`,
    markWeekComplete: 'إكمال هذا الأسبوع',
    clearWeek: 'مسح هذا الأسبوع',
    fullCurriculumAria: 'المنهج الكامل',

    markComplete: (title) => `وضع علامة إكمال على «${title}»`,
    markIncomplete: (title) => `إزالة علامة الإكمال عن «${title}»`,

    lightMode: 'الوضع الفاتح',
    darkMode: 'الوضع الداكن',
    switchTheme: (target) => `التبديل إلى ${target}`,
    resetConfirm: 'إعادة تعيين البرنامج والاسم وتاريخ البداية وكل الدروس المكتملة؟ لا يمكن التراجع.',
    resetYes: 'نعم، أعد التعيين',
    resetButton: 'إعادة تعيين بياناتي',
    footerNote: (program) =>
      `ALX${program ? ` · ${program}` : ''} · متابعة بوتيرتك · بياناتك تبقى على هذا الجهاز.`,

    enableReminders: 'تفعيل التذكيرات الأسبوعية',
    enabling: 'جارٍ التفعيل…',
    remindersOn: 'التذكيرات الأسبوعية مفعّلة',
    notificationsAllowed: 'الإشعارات مسموح بها',
    remindersBlocked: 'الإشعارات محظورة — اسمح بها من إعدادات المتصفح.',
    remindersLapsed: 'لم تنتقل تذكيراتك الأسبوعية مع تغيير العنوان. أعد تفعيلها من الأسفل.',

    milestoneModuleTitle: (m) => `${m.title} — اكتمل`,
    milestoneProgrammeTitle: 'لقد أكملت البرنامج',
    milestoneModuleSub: (m) => `الوحدة ${m.index} من ${m.total}، ${m.weeks} أسابيع.`,
    milestoneProgrammeSub: (m) => `كل الوحدات ${m.total}، و${m.lessons} درساً، و${m.weeks} أسبوعاً.`,
    milestoneShareIntro: 'يستحق أن يُقال. انشره كما هو، أو عدّله بعد الوصول.',
    milestoneShare: 'المشاركة على لينكدإن',
    milestoneDismiss: 'لاحقاً',
    milestoneCopied: 'تم النسخ — إذا فُتح لينكدإن فارغاً، الصقه.',
    milestoneOpened: 'فُتح لينكدإن في تبويب جديد.',
    milestoneShareCommunity: 'انشر في المجتمع',
    milestoneCommunityOpened: 'تم النسخ — الصقه في منشور المجتمع.',
    milestonePointsNote: 'النشر في المجتمع يمنحك نقاط Legacy تستبدلها بمكافآت عند التخرج.',
    roadmapShare: 'مشاركة',
    roadmapShareAria: (title) => `شارك أنك أنهيت ${title}`,
    roadmapModuleDone: 'مكتملة',
    roadmapProgrammeDone: 'اكتمل البرنامج بالكامل',
    postModuleDone: (m) =>
      `أنهيت للتو ${m.title} — الوحدة ${m.index} من ${m.total} في برنامج ${postProgram('ar', m)}.`,
    postProgrammeDone: (m) =>
      `أنهيت برنامج ${postProgram('ar', m)}: ${m.weeks} أسبوعاً، و${m.lessons} درساً، وكل الوحدات ${m.total}.`,
    dismiss: 'إغلاق',

    reminderTitle: (week, total) => `ALX Pace — الأسبوع ${week} من ${total}`,
    reminderBehind: (behind, graded, unit) =>
      `${arCount(behind, pick(unit, { one: 'درس واحد للّحاق', two: 'درسان للّحاق', few: 'دروس للّحاق', many: 'درسًا للّحاق' }, { one: 'عنصر واحد للّحاق', two: 'عنصران للّحاق', few: 'عناصر للّحاق', many: 'عنصرًا للّحاق' }))} · ${graded} تقييم مستحق هذا الأسبوع.`,
    reminderGraded: (n) =>
      `${arCount(n, { one: 'تقييم محتسب مستحق', two: 'تقييمان محتسبان مستحقان', few: 'تقييمات محتسبة مستحقة', many: 'تقييمًا محتسبًا مستحقًا' })} هذا الأسبوع — حافظ على وتيرتك.`,
    reminderOnTrack: (left, unit) =>
      `أنت على المسار الصحيح — ${arCount(left, pick(unit, { one: 'درس واحد متبقٍ', two: 'درسان متبقيان', few: 'دروس متبقية', many: 'درسًا متبقيًا' }, { one: 'عنصر واحد متبقٍ', two: 'عنصران متبقيان', few: 'عناصر متبقية', many: 'عنصرًا متبقيًا' }))} هذا الأسبوع.`,
    reminderBuffer: (n) =>
      n > 0
        ? `أسبوع استدراك — ${arCount(n, { one: 'عنصر واحد', two: 'عنصران', few: 'عناصر', many: 'عنصرًا' })} للإنهاء.`
        : 'أسبوع استدراك — لا شيء متأخّر.',

    edit: 'تعديل',
    targetFinish: (date) => `الانتهاء بحلول ${date}`,
    promptFinishPreview: (date) => `بهذا التاريخ، ستنتهي بحلول ${date}.`,
    yourPace: 'وتيرتك',
    paceValue: (n, unit) => `${n} ${pick(unit, 'درس', 'عنصر')}/أسبوع`,
    projectedFinishLabel: 'الانتهاء المتوقّع',
    targetLabel: 'الهدف',
    finishDelta: (days) => {
      if (days === 0) return 'تمامًا حسب الخطة'
      const abs = Math.abs(days)
      const span =
        abs >= 14
          ? `${Math.round(abs / 7)} أسابيع`
          : arCount(abs, { one: 'يوم واحد', two: 'يومين', few: 'أيام', many: 'يومًا' })
      return days > 0 ? `≈ متقدّم بـ ${span}` : `≈ متأخّر بـ ${span}`
    },
    noPaceYet: (unit) => `أكمل أول ${pick(unit, 'درس', 'عنصر')} لك لعرض تاريخ انتهائك المتوقّع.`,
    noPaceYetMore: (n, unit) =>
      `بقي ${arCount(n, pick(unit, { one: 'درس واحد', two: 'درسان', few: 'دروس', many: 'درسًا' }, { one: 'عنصر واحد', two: 'عنصران', few: 'عناصر', many: 'عنصرًا' }))} لعرض تاريخ انتهائك المتوقّع.`,

    slogans: [
      'افعل الأشياء الصعبة',
      'العزيمة في العمل',
      'كن حاضرًا وارتقِ',
      'الاستمرارية تصنع الفرق',
      'تعلّم. ابنِ. كرّر.',
      'التقدّم قبل الكمال',
      'خطوات صغيرة، بيانات كبيرة',
      'يُكتسب ولا يُوهب',
    ],
    slogansCreative: [
      'افعل الأشياء الصعبة',
      'العزيمة في العمل',
      'كن حاضرًا وارتقِ',
      'الاستمرارية تصنع الفرق',
      'تعلّم. ابنِ. كرّر.',
      'التقدّم قبل الكمال',
      'خطوات صغيرة، أفكار كبيرة',
      'يُكتسب ولا يُوهب',
    ],
    quotes: [
      'الانضباط هو أداء التمرين الذي لا تشتهي أداءه.',
      'خطوات صغيرة منتظمة خير من اندفاعات بطولية نادرة.',
      'كن حاضرًا اليوم، والزخم يتكفّل بالغد.',
      'الأشياء الصعبة تصغر بمجرد أن تبدأها.',
      'لا تحتاج إلى حماس كي تفتح درسًا واحدًا.',
      'نسختك المستقبلية تُبنى خانةً بخانة.',
      'التقدّم يحب المواعيد المنتظمة.',
      'منجزٌ اليوم خير من مثاليّ يومًا ما.',
      'كل خبير مرّ يومًا بالأسبوع الأول.',
      'الاستمرارية قوة خارقة في متناول الجميع.',
      'العزيمة أن تعود بعد يوم فاتر.',
      'درسٌ أقرب يبقى أقرب.',
      'السلسلة التي تحافظ عليها هي المهارة التي تحتفظ بها.',
      'وتيرتك، طريقك — فقط واصل التقدّم.',
    ],
  },
}

/** Best-guess initial language from the browser, falling back to English. */
export function detectLanguage() {
  try {
    const nav = (navigator.language || '').toLowerCase()
    if (nav.startsWith('fr')) return 'fr'
    if (nav.startsWith('ar')) return 'ar'
  } catch {
    /* SSR / unusual environments */
  }
  return 'en'
}
