import { getLang } from '@/i18n';
import { monthShort } from '@/lib/format';

/** Numele zilelor și lunilor pentru calendar și previzualizarea unei zile, în fiecare limbă. */
export const CAL = {
  ro: {
    weekdays: ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'],
    dayNames: ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'],
    /** Titlul lunii („Septembrie 2026”) și data („28 septembrie”) — în română, aceeași formă. */
    months: ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'],
    monthsOf: ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'],
  },
  ru: {
    weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    dayNames: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
    /** Rusa: nominativ în titlu („Сентябрь 2026”), genitiv în dată („28 сентября”). */
    months: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    monthsOf: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  },
  en: {
    weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsOf: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
};

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** „luni, 28 septembrie” / „понедельник, 28 сентября” / „Monday, 28 September”. */
export function fmtDayLong(d: Date): string {
  const c = CAL[getLang()];
  return `${c.dayNames[d.getDay()]}, ${d.getDate()} ${c.monthsOf[d.getMonth()]}`;
}

/** Lunea săptămânii care conține ziua dată. */
export const weekStart = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

/** Eticheta scurtă a zilei pe marker: „Lu 28” / „Пн 28” / „Mo 28”. */
export function dayTag(d: Date): string {
  return `${CAL[getLang()].weekdays[(d.getDay() + 6) % 7]} ${d.getDate()}`;
}

/** „28 sept. – 4 oct.” pentru o săptămână care începe luni. */
export function fmtWeek(monday: Date): string {
  const sunday = addDays(monday, 6);
  const short = (x: Date) => `${x.getDate()} ${monthShort(x)}`;
  return `${short(monday)} – ${short(sunday)}`;
}
