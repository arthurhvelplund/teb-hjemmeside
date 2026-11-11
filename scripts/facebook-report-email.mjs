// Static tables and inline styles keep the report readable without scripts or images.
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmt = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('da-DK', {maximumFractionDigits: 0}).format(value);
const date = value => new Intl.DateTimeFormat('da-DK', {timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short', year: 'numeric'}).format(new Date(value));
const change = value => value === null ? 'Ingen sammenligning' : (value > 0 ? '+' : '') + new Intl.NumberFormat('da-DK', {maximumFractionDigits: 1}).format(value) + ' %';
const signed = value => (value > 0 ? '+' : '') + fmt(value);
const table = (content, attributes = '') => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${attributes}>${content}</table>`;

export function renderFacebookEmail(model) {
  const range = model.ranges.find(item => item.id === '28');
  const week = model.ranges.find(item => item.id === '7');
  const ranked = key => [...model.posts].sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1) || b.createdAt - a.createdAt);
  const leaders = ranked('views').slice(0, 5), mostReactions = ranked('reactions').find(post => post.reactions !== null);
  const period = `${range.length} målte døgn · døgnslut ${date(range.firstEndTime)} til ${date(range.lastEndTime)}`;
  const headline = range.changes.views === null ? 'Sidens aktivitet i perioden'
    : range.changes.views >= 0 && range.length > 7 && week.changes.views < 0 ? 'Flere visninger i perioden. Lavere tempo den seneste uge.'
    : range.changes.views >= 0 ? 'Flere visninger end i den foregående periode.' : 'Færre visninger end i den foregående periode.';
  const subject = `TEB · Facebookoverblik · ${date(model.fetchedAt)}`;
  const cards = [
    ['Visninger', range.totals.views, `${change(range.changes.views)} · før ${fmt(range.previous.views)}`, range.changes.views],
    ['Interaktioner', range.totals.interactions, `${change(range.changes.interactions)} · før ${fmt(range.previous.interactions)}`, range.changes.interactions],
    ['Følgere nu', range.followersNow, `${signed(range.netFollows)} netto i perioden`, null],
    ['Viewers / døgn', range.averageDailyViewers, 'Unikke, dagligt gennemsnit', null],
    ['Reaktioner', range.totals.reactions, `${change(range.changes.reactions)} · før ${fmt(range.previous.reactions)}`, range.changes.reactions],
    ['Udgivne opslag', range.publicationCount, `${model.posts.length} i hele udtrækket`, null]
  ];
  const card = ([label, value, caption, delta]) => `<td width="33.33%" valign="top" style="padding:13px 12px;border:1px solid #dce3d9;background-color:#ffffff;">
    <div style="font-size:11px;color:#66736b;line-height:16px;">${escape(label)}</div>
    <div class="metric" style="font-size:30px;font-weight:bold;color:#17392e;line-height:38px;">${fmt(value)}</div>
    <div style="font-size:10px;line-height:15px;color:${delta !== null && delta < 0 ? '#955a1d' : '#53695a'};">${escape(caption)}</div></td>`;
  const metrics = table('<tr>' + cards.slice(0, 3).map(card).join('') + '</tr><tr>' + cards.slice(3).map(card).join('') + '</tr>', 'style="border-collapse:collapse;table-layout:fixed;"');
  const notes = [
    [`Seneste ${week.length} målte døgn`, `${fmt(week.totals.views)} visninger · ${change(week.changes.views)}`, `${fmt(week.totals.follows)} følgninger · ${fmt(week.totals.unfollows)} afmeldinger`],
    ['Tilgang af følgere', `${fmt(range.totals.follows)} nye mod ${fmt(range.previous.follows)} i forrige periode`, `${fmt(range.totals.unfollows)} afmeldinger i perioden`],
    ['Flest reaktioner · livstid', mostReactions ? `${fmt(mostReactions.reactions)} · ${mostReactions.headline}` : 'Ingen reaktionstal', 'Alle opslagsdatoer']
  ];
  const insights = table('<tr>' + notes.map(([title, value, caption]) => `<td width="33.33%" valign="top" style="background-color:#eaf0e6;padding:10px 11px;border-right:1px solid #d4dfce;"><div style="font-size:10px;line-height:15px;color:#66735f;">${escape(title)}</div><div style="font-size:12px;line-height:17px;font-weight:bold;margin-top:3px;">${escape(value)}</div><div style="font-size:10px;line-height:15px;color:#66736b;margin-top:3px;">${escape(caption)}</div></td>`).join('') + '</tr>', 'style="table-layout:fixed;"');
  const numericCell = value => `<td align="right" valign="top" style="padding:9px 6px;border-top:1px solid #e5eae1;font-size:12px;line-height:17px;">${fmt(value)}</td>`;
  const rows = leaders.map((post, index) => {
    const title = post.url ? `<a href="${escape(post.url)}" style="color:#226649;text-decoration:none;">${escape(post.headline)}</a>` : escape(post.headline);
    return `<tr><td width="22" valign="top" style="padding:9px 4px;border-top:1px solid #e5eae1;font-size:10px;color:#66736b;">${index + 1}</td><td valign="top" style="padding:9px 6px;border-top:1px solid #e5eae1;font-size:12px;line-height:17px;">${title}<div style="font-size:10px;color:#66736b;">${escape(date(post.createdTime))}</div></td>${numericCell(post.views)}${numericCell(post.reactions)}${numericCell(post.shares)}</tr>`;
  }).join('');
  const ranking = `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;table-layout:fixed;color:#17392e;"><thead><tr><th width="22"></th><th align="left" style="font-size:10px;font-weight:normal;padding:6px;color:#66736b;">Opslag</th><th width="72" align="right" style="font-size:10px;font-weight:normal;padding:6px;color:#66736b;">Visninger</th><th width="52" align="right" style="font-size:10px;font-weight:normal;padding:6px;color:#66736b;">Reakt.</th><th width="43" align="right" style="font-size:10px;font-weight:normal;padding:6px;color:#66736b;">Del.</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="padding:12px;">Ingen opslag i udtrækket.</td></tr>'}</tbody></table>`;
  const blocks = [];
  for (let i = 0; i < range.daily.length; i += 7) {
    const days = range.daily.slice(i, i + 7);
    blocks.push({label: `${date(days[0].endTime)} til ${date(days.at(-1).endTime)}`,
      views: days.every(day => day.views !== null) ? days.reduce((total, day) => total + day.views, 0) : null});
  }
  const maximum = Math.max(1, ...blocks.map(block => block.views ?? 0));
  const bars = table(blocks.map(block => {
    const width = block.views === null ? 0 : Math.round(block.views / maximum * 100);
    const bar = width > 0 ? table(`<tr><td width="${width}%" bgcolor="#639771" height="10" style="height:10px;line-height:10px;font-size:1px;">&nbsp;</td>${width < 100 ? `<td width="${100 - width}%" bgcolor="#edf1e9" style="font-size:1px;line-height:10px;">&nbsp;</td>` : ''}</tr>`) : '';
    return `<tr><td style="font-size:10px;color:#66736b;padding:5px 0 2px;" colspan="2">${escape(block.label)}</td></tr><tr><td valign="middle" style="padding-right:12px;">${bar}</td><td width="58" align="right" style="font-size:11px;line-height:14px;">${fmt(block.views)}</td></tr>`;
  }).join(''));
  const missing = Object.values(range.coverage.missing).some(count => count > 0);
  const warning = [missing ? 'Nogle daglige tal mangler. Berørte totaler vises som —.' : '', range.comparisonIncludesInitialZeros ? 'Den foregående periode omfatter dage før første registrerede aktivitet.' : ''].filter(Boolean).join(' ');
  const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title><style>@media screen and (max-width:520px){.email-pad{padding-left:12px!important;padding-right:12px!important}.metric{font-size:25px!important}}</style></head>
<body style="margin:0;padding:0;background-color:#f4f6f2;color:#17392e;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f4f6f2;">${escape(headline)} ${fmt(range.totals.views)} visninger · ${fmt(range.followersNow)} følgere.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f4f6f2"><tr><td align="center" style="padding:18px 8px;">
<!--[if mso]><table role="presentation" width="760" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:760px;background-color:#ffffff;"><tr><td class="email-pad" bgcolor="#17392e" style="padding:17px 20px;color:#ffffff;"><div style="font-size:19px;line-height:25px;font-weight:bold;">TEB · Facebookoverblik</div><div style="font-size:11px;line-height:17px;color:#c5d8ca;">${escape(model.page.name)} · ${escape(date(model.fetchedAt))}</div></td></tr>
<tr><td class="email-pad" style="padding:14px 20px 10px;"><div style="font-size:11px;color:#66736b;line-height:17px;">${escape(period)}</div><h1 style="font-size:18px;line-height:24px;font-weight:bold;margin:7px 0 3px;">${escape(headline)}</h1><div style="font-size:10px;line-height:15px;color:#66736b;">Ændringer mod foregående periode med samme længde.</div>${warning ? `<p style="font-size:11px;line-height:16px;color:#955a1d;">${escape(warning)}</p>` : ''}</td></tr>
<tr><td class="email-pad" style="padding:0 20px 12px;">${metrics}</td></tr><tr><td class="email-pad" style="padding:0 20px 13px;">${insights}</td></tr>
<tr><td class="email-pad" style="padding:0 20px 12px;"><h2 style="font-size:13px;line-height:18px;margin:0 0 3px;">Top 5 opslag <span style="font-size:10px;font-weight:normal;color:#66736b;">· Livstid, alle opslagsdatoer</span></h2>${ranking}</td></tr>
<tr><td class="email-pad" style="padding:0 20px 15px;"><h2 style="font-size:13px;line-height:18px;margin:0 0 4px;">Visninger i blokke af op til 7 målte døgn</h2>${bars}</td></tr>
<tr><td class="email-pad" bgcolor="#f0f3ed" style="padding:12px 20px;font-size:10px;line-height:16px;color:#66736b;">Visninger kan tælle samme person flere gange. Viewers er gennemsnittet af daglige unikke personer. Opslagsinteraktioner er Metas brede aktivitetsmål. Opslagstal er lifetime-tal; ældre opslag har haft længere tid. Datoerne viser Metas døgnslut. — betyder manglende data.<br>Udtrækket viser ikke trafik, tilmeldinger eller nye medlemmer på hjemmesiden. Meta via Composio · ${model.posts.length} opslag i udtrækket · Privat rapport.</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  const text = [`TEB · Facebookoverblik`, model.page.name, period, headline, '',
    ...cards.map(([label, value, caption]) => `${label}: ${fmt(value)}. ${caption}`), '',
    ...notes.map(([title, value, caption]) => `${title}: ${value}. ${caption}`), '', 'Top 5 opslag, lifetime-tal:',
    ...leaders.map((post, index) => `${index + 1}. ${post.headline}: ${fmt(post.views)} visninger, ${fmt(post.reactions)} reaktioner, ${fmt(post.shares)} delinger. ${post.url || ''}`), '',
    'Visninger i blokke af op til 7 målte døgn:', ...blocks.map(block => `${block.label}: ${fmt(block.views)}`), '', warning,
    'Visninger er ikke unikke personer. Viewers er dagligt gennemsnit. Opslagsinteraktioner er Metas brede aktivitetsmål. Ældre opslag har haft længere tid til at samle aktivitet. Datoer er Metas døgnslut. — betyder manglende data.',
    'Udtrækket viser ikke hjemmesidetrafik, tilmeldinger eller nye medlemmer. Meta via Composio. Privat rapport.'
  ].filter(line => line !== undefined).join('\n');
  return {subject, html, text};
}
