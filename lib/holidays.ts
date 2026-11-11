export type HolidayScope = "national" | "qld";

export interface Holiday {
  date: string;
  name: string;
  scope: HolidayScope;
  detail?: string;
  partDay: boolean;
}

function holiday(
  date: string,
  name: string,
  scope: HolidayScope,
  detail?: string,
  partDay = false,
): Holiday {
  return { date, name, scope, detail, partDay };
}

/**
 * Observed Queensland public holidays for 2025, 2026, 2027, and January–June 2028.
 * January–June 2028 covers the rest of the 2027–28 income year. Those dates use the
 * same Holidays Act rules as the published tables: Easter from the Gregorian computus,
 * Labour Day on the first Monday in May, and an extra New Year holiday when 1 January
 * is a weekend.
 * Dates follow the Queensland Government tables. Ekka is Brisbane-area only.
 * Christmas Eve is a part-day holiday from 6pm. Anzac Day moves to Monday
 * only when 25 April is a Sunday. Australia Day moves to Monday when 26 January
 * falls on a weekend. Extra Christmas, Boxing Day, and New Year holidays follow
 * the Holidays Act 1983 when those days fall on a weekend.
 */
export const HOLIDAYS: readonly Holiday[] = [
  holiday("2025-01-01", "New Year's Day", "national"),
  holiday("2025-01-27", "Australia Day", "national", "Observed Monday because 26 January is a Sunday."),
  holiday("2025-04-18", "Good Friday", "national"),
  holiday("2025-04-19", "The day after Good Friday", "qld"),
  holiday("2025-04-20", "Easter Sunday", "qld"),
  holiday("2025-04-21", "Easter Monday", "national"),
  holiday("2025-04-25", "Anzac Day", "national"),
  holiday("2025-05-05", "Labour Day", "qld"),
  holiday("2025-08-13", "Royal Queensland Show (Ekka)", "qld", "Brisbane area only. Not a statewide public holiday."),
  holiday("2025-10-06", "King's Birthday", "qld"),
  holiday("2025-12-24", "Christmas Eve", "qld", "Part-day public holiday from 6pm to midnight.", true),
  holiday("2025-12-25", "Christmas Day", "national"),
  holiday("2025-12-26", "Boxing Day", "national"),

  holiday("2026-01-01", "New Year's Day", "national"),
  holiday("2026-01-26", "Australia Day", "national"),
  holiday("2026-04-03", "Good Friday", "national"),
  holiday("2026-04-04", "The day after Good Friday", "qld"),
  holiday("2026-04-05", "Easter Sunday", "qld"),
  holiday("2026-04-06", "Easter Monday", "national"),
  holiday("2026-04-25", "Anzac Day", "national", "Falls on Saturday and is observed that day in Queensland."),
  holiday("2026-05-04", "Labour Day", "qld"),
  holiday("2026-08-12", "Royal Queensland Show (Ekka)", "qld", "Brisbane area only. Not a statewide public holiday."),
  holiday("2026-10-05", "King's Birthday", "qld"),
  holiday("2026-12-24", "Christmas Eve", "qld", "Part-day public holiday from 6pm to midnight.", true),
  holiday("2026-12-25", "Christmas Day", "national"),
  holiday("2026-12-26", "Boxing Day", "national"),
  holiday("2026-12-28", "Boxing Day holiday", "qld", "Additional public holiday because Boxing Day is a Saturday."),

  holiday("2027-01-01", "New Year's Day", "national"),
  holiday("2027-01-26", "Australia Day", "national"),
  holiday("2027-03-26", "Good Friday", "national"),
  holiday("2027-03-27", "The day after Good Friday", "qld"),
  holiday("2027-03-28", "Easter Sunday", "qld"),
  holiday("2027-03-29", "Easter Monday", "national"),
  holiday("2027-04-26", "Anzac Day", "national", "Observed Monday because 25 April is a Sunday."),
  holiday("2027-05-03", "Labour Day", "qld"),
  holiday("2027-08-11", "Royal Queensland Show (Ekka)", "qld", "Brisbane area only. Not a statewide public holiday."),
  holiday("2027-10-04", "King's Birthday", "qld"),
  holiday("2027-12-24", "Christmas Eve", "qld", "Part-day public holiday from 6pm to midnight.", true),
  holiday("2027-12-25", "Christmas Day", "national"),
  holiday("2027-12-26", "Boxing Day", "national"),
  holiday("2027-12-27", "Christmas Day holiday", "qld", "Additional public holiday because Christmas Day is a Saturday."),
  holiday("2027-12-28", "Boxing Day holiday", "qld", "Additional public holiday because Boxing Day is a Sunday."),

  holiday("2028-01-01", "New Year's Day", "national"),
  holiday("2028-01-03", "New Year's Day holiday", "qld", "Additional public holiday because New Year's Day is a Saturday."),
  holiday("2028-01-26", "Australia Day", "national"),
  holiday("2028-04-14", "Good Friday", "national"),
  holiday("2028-04-15", "The day after Good Friday", "qld"),
  holiday("2028-04-16", "Easter Sunday", "qld"),
  holiday("2028-04-17", "Easter Monday", "national"),
  holiday("2028-04-25", "Anzac Day", "national"),
  holiday("2028-05-01", "Labour Day", "qld"),
];

const HOLIDAY_BY_DATE = new Map(HOLIDAYS.map((item) => [item.date, item]));

export function holidayOn(iso: string): Holiday | undefined {
  return HOLIDAY_BY_DATE.get(iso);
}
