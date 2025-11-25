import expressions from 'angular-expressions';

// Register custom filters similar to the Angular implementation
expressions.filters['capitalize'] = (input: unknown) => {
  if (Array.isArray(input)) {
    return input.map((s: string) =>
      typeof s === 'string' ? s.charAt(0).toUpperCase() + s.slice(1) : s
    );
  }
  return typeof input === 'string'
    ? input.charAt(0).toUpperCase() + input.slice(1)
    : input;
};

expressions.filters['split'] = (input: string, char: string) =>
  typeof input === 'string' ? input.split(char) : input;

expressions.filters['toUpper'] = (input: unknown) =>
  typeof input === 'string' ? input.toUpperCase() : input;

expressions.filters['join'] = (input: Array<string>, separator: string) =>
  Array.isArray(input) ? input.join(separator) : input;

expressions.filters['default'] = (input: unknown, defVal: unknown) =>
  input === null ||
  input === undefined ||
  (typeof input === 'string' && input === '') ||
  (Array.isArray(input) && input.length === 0)
    ? defVal
    : input;

expressions.filters['date'] = (input: unknown, opts?: string) => {
  if (input && typeof input === 'string' && input !== '') {
    const date = new Date(input);
    if (!isNaN(date.getTime())) {
      // Default format: MM/DD/YYYY hh:mm:ss A
      const format = opts || 'MM/DD/YYYY hh:mm:ss A';
      return formatDate(date, format);
    }
    return input;
  }
  return input || '';
};

expressions.filters['length'] = (input: unknown) =>
  Array.isArray(input) || typeof input === 'string' ? input.length : 0;

/**
 * Simple date formatter
 */
function formatDate(date: Date, format: string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const hours = date.getHours();
  const hours12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';

  return format
    .replace('YYYY', date.getFullYear().toString())
    .replace('MM', pad(date.getMonth() + 1))
    .replace('DD', pad(date.getDate()))
    .replace('hh', pad(hours12))
    .replace('HH', pad(hours))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()))
    .replace('A', ampm);
}

export { expressions };
