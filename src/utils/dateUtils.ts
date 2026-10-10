/**
 * Custom date/time parser to handle diverse formats like:
 * YYYY-MM-DD HH:mm:ss, DD-MM-YYYY HH:mm:ss, DD/MM/YY HH:mm, etc.
 */
export const parseDateTime = (str: string): number => {
  if (!str || str === '-') return -1;
  const parts = str.split(' ');
  const d = parts[0];
  const t = parts[1] || '00:00:00';
  if (!d) return -1;
  const dparts = d.split(/[-/]/);
  
  let result = -1;

  // Case YYYY-MM-DD
  if (dparts[0] && dparts[0].length === 4) {
    const y = parseInt(dparts[0]);
    const m = parseInt(dparts[1]) - 1;
    const day = parseInt(dparts[2]);
    const [h, min, s] = t.split(':').map(x => parseInt(x) || 0);
    result = new Date(y, m, day, h, min, s).getTime();
  }
  
  // Case DD-MM-YYYY or DD/MM/YYYY
  else if (dparts[2] && dparts[2].length === 4) {
    const y = parseInt(dparts[2]);
    const m = parseInt(dparts[1]) - 1;
    const day = parseInt(dparts[0]);
    const [h, min, s] = t.split(':').map(x => parseInt(x) || 0);
    result = new Date(y, m, day, h, min, s).getTime();
  }
  
  // Case DD-MM-YY (e.g. 26-03-26)
  else if (dparts[2] && dparts[2].length === 2) {
    const year = 2000 + parseInt(dparts[2]);
    const m = parseInt(dparts[1]) - 1;
    const day = parseInt(dparts[0]);
    const [h, min, s] = t.split(':').map(x => parseInt(x) || 0);
    result = new Date(year, m, day, h, min, s).getTime();
  }
  
  // Fallback
  else {
    result = new Date(str.replace(' ', 'T')).getTime();
  }
  
  return isNaN(result) ? -1 : result;
};

export const getWeekInfo = (dateInput: string | Date) => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return `WW${weekNo.toString().padStart(2, '0')}-${d.getUTCFullYear().toString().slice(-2)}`;
};
