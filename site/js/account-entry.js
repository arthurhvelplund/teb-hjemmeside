// Everyone starts in their association area; administration has its own entrance.
export function accountHome(session) {
  if (!session?.authenticated) return {page:'login',label:'Log ind'};
  return {page:'min-forening',label:'Min forening'};
}
export function accountContinueLabel(session, target = null) {
  if (target && /forening\.html#teb(?:[?]|$)/.test(target)) return 'Fortsæt til TEB-administration';
  if (target) return /(?:^|\/)kalender\.html(?:[?#]|$)/.test(target) ? 'Fortsæt til arrangementet' : 'Fortsæt';
  return 'Fortsæt til Min forening';
}
