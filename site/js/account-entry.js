// One role-aware destination for the site's single account entrance.
export function accountHome(session) {
  if (!session?.authenticated) return {page:'login',label:'Log ind'};
  return session.user?.isAdmin ? {page:'teb',label:'TEB-administration'} : {page:'min-forening',label:'Min forening'};
}
export function accountContinueLabel(session, target = null) {
  if (target) return /(?:^|\/)kalender\.html(?:[?#]|$)/.test(target) ? 'Fortsæt til arrangementet' : 'Fortsæt';
  return session?.user?.isAdmin ? 'Fortsæt til TEB' : 'Fortsæt til Min forening';
}
