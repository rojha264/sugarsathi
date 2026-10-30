// The Sugar Saathi mark, drawn on a 1024 grid. `mono` = one-colour silhouette (Android themed icon).
exports.mark = (mono = false) => {
  const ink = mono ? '#000' : '#14794F';
  const drop = 'M512 150 C 512 150 286 418 286 600 A 226 226 0 0 0 738 600 C 738 418 512 150 512 150 Z';
  const face = mono
    ? '' // cut out below with a mask
    : `<circle cx="438" cy="575" r="30" fill="${ink}"/><circle cx="586" cy="575" r="30" fill="${ink}"/>
       <path d="M404 652 Q 462 728 520 722 Q 590 714 642 610" fill="none" stroke="${ink}" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>`;
  const heart = 'M0 -18 C -14 -44 -58 -40 -58 -6 C -58 22 -26 44 0 66 C 26 44 58 22 58 -6 C 58 -40 14 -44 0 -18 Z';
  if (mono) {
    return `<defs><mask id="m"><rect width="1024" height="1024" fill="#fff"/>
      <circle cx="438" cy="575" r="30" fill="#000"/><circle cx="586" cy="575" r="30" fill="#000"/>
      <path d="M404 652 Q 462 728 520 722 Q 590 714 642 610" fill="none" stroke="#000" stroke-width="40" stroke-linecap="round"/></mask></defs>
      <g mask="url(#m)"><path d="${drop}" fill="#fff"/><g transform="translate(712 330) scale(1.35)"><path d="${heart}" fill="#fff"/></g></g>`;
  }
  return `<defs>
      <linearGradient id="dropShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EAF6EF"/></linearGradient>
      <filter id="soft" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#06331F" flood-opacity="0.28"/></filter>
      <filter id="soft2" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#06331F" flood-opacity="0.25"/></filter>
    </defs>
    <path d="${drop}" fill="url(#dropShade)" filter="url(#soft)"/>
    ${face}
    <g filter="url(#soft2)"><g transform="translate(712 330) scale(1.35)"><path d="${heart}" fill="#FFB020" stroke="#fff" stroke-width="12" stroke-linejoin="round"/></g></g>`;
};
exports.background = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22A06B"/><stop offset="1" stop-color="#0F6B45"/></linearGradient>
  <radialGradient id="glow" cx="0.3" cy="0.22" r="0.8"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.22"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient></defs>
  <rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#glow)"/>`;
