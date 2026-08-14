export const formatDateUTC = (dateString?: string | Date) => {
  if (!dateString) return '';
  try {
    const str = typeof dateString === 'string' ? dateString : dateString.toISOString();
    // If it's an ISO string like "2026-05-18T00:00:00.000Z", extract exactly the date part
    const datePart = str.split('T')[0];
    if (datePart.includes('-') && datePart.length === 10) {
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year}`;
    }
    const d = new Date(dateString);
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch (e) {
    return String(dateString);
  }
};

export const formatFullDateUTC = (dateString?: string | Date) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch(e) {
    return String(dateString);
  }
}

