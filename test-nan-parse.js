const parseDateTime = (str) => {
  if (!str || str === '-') return -1;
  const parts = str.split(' ');
  const d = parts[0];
  const t = parts[1] || '00:00:00';
  if (!d) return -1;
  const dparts = d.split(/[-/]/);
  
  let result = -1;
  
  if (dparts[0] && dparts[0].length === 4) {
    const y = parseInt(dparts[0]);
    const m = parseInt(dparts[1]) - 1;
    const day = parseInt(dparts[2]);
    const [h, min, s] = t.split(':').map(x => parseInt(x) || 0);
    result = new Date(y, m, day, h, min, s).getTime();
  } else if (dparts[2] && dparts[2].length === 4) {
    const y = parseInt(dparts[2]);
    const m = parseInt(dparts[1]) - 1;
    const day = parseInt(dparts[0]);
    const [h, min, s] = t.split(':').map(x => parseInt(x) || 0);
    result = new Date(y, m, day, h, min, s).getTime();
  } else if (dparts[2] && dparts[2].length === 2) {
    const year = 2000 + parseInt(dparts[2]);
    const m = parseInt(dparts[1]) - 1;
    const day = parseInt(dparts[0]);
    const [h, min, s] = t.split(':').map(x => parseInt(x) || 0);
    result = new Date(year, m, day, h, min, s).getTime();
  } else {
    result = new Date(str.replace(' ', 'T')).getTime();
  }
  
  return isNaN(result) ? -1 : result;
};

console.log(parseDateTime("2026-NaN-12 00:00:00"));
