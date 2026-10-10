const parseDateTime = (str) => {
  if (!str || str === '-') return -1;
  const parts = str.split(' ');
  const d = parts[0];
  const t = parts[1] || '00:00:00';
  if (!d) return -1;
  const dparts = d.split(/[-/]/);
  
  if (dparts[0] && dparts[0].length === 4) {
    const y = parseInt(dparts[0]);
    const m = parseInt(dparts[1]) - 1;
    const day = parseInt(dparts[2]);
    const [h, min, s] = t.split(':').map(x => parseInt(x) || 0);
    return new Date(y, m, day, h, min, s).getTime();
  }
  
  if (dparts[2] && dparts[2].length === 4) {
    const y = parseInt(dparts[2]);
    const m = parseInt(dparts[1]) - 1;
    const day = parseInt(dparts[0]);
    const [h, min, s] = t.split(':').map(x => parseInt(x) || 0);
    return new Date(y, m, day, h, min, s).getTime();
  }
  
  if (dparts[2] && dparts[2].length === 2) {
    const year = 2000 + parseInt(dparts[2]);
    const m = parseInt(dparts[1]) - 1;
    const day = parseInt(dparts[0]);
    const [h, min, s] = t.split(':').map(x => parseInt(x) || 0);
    return new Date(year, m, day, h, min, s).getTime();
  }
  
  const fallback = new Date(str.replace(' ', 'T')).getTime();
  return isNaN(fallback) ? -1 : fallback;
};

console.log('3/23/2026:', parseDateTime('3/23/2026'));
console.log('3/23/2026 formatted:', new Date(parseDateTime('3/23/2026')).toLocaleDateString());
console.log('03-23-26:', parseDateTime('03-23-26'));
console.log('03-23-26 formatted:', new Date(parseDateTime('03-23-26')).toLocaleDateString());

