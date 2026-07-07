/**
 * Public-records / FOIA jurisdiction reference data.
 *
 * Federal FOIA + all 50 states, each with the governing statute, its citation,
 * and the statutory response window used to auto-calculate a request's
 * response-due date.
 *
 * IMPORTANT: Statutory deadlines change and many states impose only a
 * "reasonable time" rather than a hard count. Entries flagged
 * `noFixedDeadline` use a conservative default for tracking purposes only —
 * always verify the current statute for the specific agency. This data is for
 * docketing assistance, not legal advice.
 */

export type ResponseDayType = "business" | "calendar";

export interface Jurisdiction {
  /** Stable code: "US" for federal, "US-XX" for states. */
  code: string;
  name: string;
  /** Name of the governing public-records statute. */
  statuteName: string;
  /** Bluebook-style citation for inclusion in the request. */
  citation: string;
  /** Number of days the agency has to respond. */
  responseDays: number;
  responseDayType: ResponseDayType;
  /** True when the statute sets no hard deadline (responseDays is an estimate). */
  noFixedDeadline?: boolean;
  /** Short note on appeals / determination requirements. */
  appealNote: string;
}

export const JURISDICTIONS: Jurisdiction[] = [
  {
    code: "US",
    name: "Federal (FOIA)",
    statuteName: "Freedom of Information Act",
    citation: "5 U.S.C. § 552",
    responseDays: 20,
    responseDayType: "business",
    appealNote: "Agency must determine within 20 business days; administrative appeal available, then suit in U.S. District Court.",
  },
  { code: "US-AL", name: "Alabama", statuteName: "Open Records Act", citation: "Ala. Code § 36-12-40", responseDays: 10, responseDayType: "business", noFixedDeadline: true, appealNote: "No fixed statutory deadline; records must be produced within a reasonable time." },
  { code: "US-AK", name: "Alaska", statuteName: "Public Records Act", citation: "Alaska Stat. § 40.25.110", responseDays: 10, responseDayType: "business", appealNote: "Response generally due within 10 business days; extensions permitted for good cause." },
  { code: "US-AZ", name: "Arizona", statuteName: "Public Records Law", citation: "Ariz. Rev. Stat. § 39-121", responseDays: 10, responseDayType: "business", noFixedDeadline: true, appealNote: "Records must be produced 'promptly'; no hard deadline. Denial reviewable by special action." },
  { code: "US-AR", name: "Arkansas", statuteName: "Freedom of Information Act", citation: "Ark. Code Ann. § 25-19-105", responseDays: 3, responseDayType: "business", appealNote: "Existing records that are readily available must be produced; otherwise within 3 business days." },
  { code: "US-CA", name: "California", statuteName: "California Public Records Act", citation: "Cal. Gov. Code § 7922.535", responseDays: 10, responseDayType: "calendar", appealNote: "Agency must determine within 10 calendar days (14-day extension possible)." },
  { code: "US-CO", name: "Colorado", statuteName: "Colorado Open Records Act", citation: "Colo. Rev. Stat. § 24-72-203", responseDays: 3, responseDayType: "business", appealNote: "Records produced within 3 business days; extendable to 7 for extenuating circumstances." },
  { code: "US-CT", name: "Connecticut", statuteName: "Freedom of Information Act", citation: "Conn. Gen. Stat. § 1-210", responseDays: 4, responseDayType: "business", appealNote: "'Promptly'; appeals to the Freedom of Information Commission." },
  { code: "US-DE", name: "Delaware", statuteName: "Freedom of Information Act", citation: "29 Del. C. § 10003", responseDays: 15, responseDayType: "business", appealNote: "Response within 15 business days; petition to Attorney General or Superior Court on denial." },
  { code: "US-FL", name: "Florida", statuteName: "Public Records Act", citation: "Fla. Stat. § 119.07", responseDays: 10, responseDayType: "business", noFixedDeadline: true, appealNote: "Produce within a 'reasonable time'; no fixed deadline. Enforceable by mandamus." },
  { code: "US-GA", name: "Georgia", statuteName: "Open Records Act", citation: "O.C.G.A. § 50-18-71", responseDays: 3, responseDayType: "business", appealNote: "Within 3 business days produce records or state a timeline/cost." },
  { code: "US-HI", name: "Hawaii", statuteName: "Uniform Information Practices Act", citation: "Haw. Rev. Stat. § 92F-11", responseDays: 10, responseDayType: "business", appealNote: "Acknowledge within 10 business days; OIP handles appeals." },
  { code: "US-ID", name: "Idaho", statuteName: "Public Records Act", citation: "Idaho Code § 74-103", responseDays: 3, responseDayType: "business", appealNote: "Grant or deny within 3 business days (up to 10 for large requests)." },
  { code: "US-IL", name: "Illinois", statuteName: "Freedom of Information Act", citation: "5 ILCS 140/3", responseDays: 5, responseDayType: "business", appealNote: "Respond within 5 business days (5-day extension); review by Public Access Counselor." },
  { code: "US-IN", name: "Indiana", statuteName: "Access to Public Records Act", citation: "Ind. Code § 5-14-3", responseDays: 7, responseDayType: "calendar", appealNote: "Mailed requests: respond within 7 calendar days (24 hours if in person)." },
  { code: "US-IA", name: "Iowa", statuteName: "Open Records Law", citation: "Iowa Code § 22.2", responseDays: 10, responseDayType: "business", noFixedDeadline: true, appealNote: "Production within a reasonable time (commonly 10–20 business days)." },
  { code: "US-KS", name: "Kansas", statuteName: "Open Records Act", citation: "Kan. Stat. Ann. § 45-218", responseDays: 3, responseDayType: "business", appealNote: "Respond within 3 business days or provide a detailed explanation of delay." },
  { code: "US-KY", name: "Kentucky", statuteName: "Open Records Act", citation: "Ky. Rev. Stat. § 61.880", responseDays: 5, responseDayType: "business", appealNote: "Respond within 5 business days; appeals to the Attorney General." },
  { code: "US-LA", name: "Louisiana", statuteName: "Public Records Act", citation: "La. Rev. Stat. § 44:32", responseDays: 3, responseDayType: "business", appealNote: "Produce promptly; within 3 business days provide a written estimate if not immediate." },
  { code: "US-ME", name: "Maine", statuteName: "Freedom of Access Act", citation: "1 M.R.S. § 408-A", responseDays: 5, responseDayType: "business", appealNote: "Acknowledge within 5 business days; produce within a reasonable time." },
  { code: "US-MD", name: "Maryland", statuteName: "Public Information Act", citation: "Md. Code, Gen. Prov. § 4-203", responseDays: 30, responseDayType: "calendar", appealNote: "Produce within 30 calendar days (10-day extension possible)." },
  { code: "US-MA", name: "Massachusetts", statuteName: "Public Records Law", citation: "Mass. Gen. Laws ch. 66, § 10", responseDays: 10, responseDayType: "business", appealNote: "Respond within 10 business days; appeal to the Supervisor of Records." },
  { code: "US-MI", name: "Michigan", statuteName: "Freedom of Information Act", citation: "Mich. Comp. Laws § 15.235", responseDays: 5, responseDayType: "business", appealNote: "Respond within 5 business days (10-day extension allowed)." },
  { code: "US-MN", name: "Minnesota", statuteName: "Government Data Practices Act", citation: "Minn. Stat. § 13.03", responseDays: 10, responseDayType: "business", noFixedDeadline: true, appealNote: "Respond within a reasonable time; no fixed statutory count." },
  { code: "US-MS", name: "Mississippi", statuteName: "Public Records Act", citation: "Miss. Code Ann. § 25-61-5", responseDays: 7, responseDayType: "business", appealNote: "Respond within 7 business days unless a different period is set by policy." },
  { code: "US-MO", name: "Missouri", statuteName: "Sunshine Law", citation: "Mo. Rev. Stat. § 610.023", responseDays: 3, responseDayType: "business", appealNote: "Respond within 3 business days; explain any delay with an expected date." },
  { code: "US-MT", name: "Montana", statuteName: "Public Records Act", citation: "Mont. Code Ann. § 2-6-1006", responseDays: 10, responseDayType: "business", noFixedDeadline: true, appealNote: "Provide within a reasonable time; no fixed deadline." },
  { code: "US-NE", name: "Nebraska", statuteName: "Public Records Statutes", citation: "Neb. Rev. Stat. § 84-712", responseDays: 4, responseDayType: "business", appealNote: "Respond within 4 business days (extension with written explanation)." },
  { code: "US-NV", name: "Nevada", statuteName: "Public Records Act", citation: "Nev. Rev. Stat. § 239.0107", responseDays: 5, responseDayType: "business", appealNote: "Respond within 5 business days." },
  { code: "US-NH", name: "New Hampshire", statuteName: "Right-to-Know Law", citation: "N.H. Rev. Stat. Ann. § 91-A:4", responseDays: 5, responseDayType: "business", appealNote: "Within 5 business days produce records or state when they will be available." },
  { code: "US-NJ", name: "New Jersey", statuteName: "Open Public Records Act", citation: "N.J. Stat. Ann. § 47:1A-5", responseDays: 7, responseDayType: "business", appealNote: "Respond within 7 business days; appeal to the Government Records Council or court." },
  { code: "US-NM", name: "New Mexico", statuteName: "Inspection of Public Records Act", citation: "N.M. Stat. Ann. § 14-2-8", responseDays: 15, responseDayType: "calendar", appealNote: "Permit inspection within 15 calendar days (3 days to acknowledge)." },
  { code: "US-NY", name: "New York", statuteName: "Freedom of Information Law", citation: "N.Y. Pub. Off. Law § 89", responseDays: 5, responseDayType: "business", appealNote: "Acknowledge within 5 business days; appeals to the agency FOIL appeals officer." },
  { code: "US-NC", name: "North Carolina", statuteName: "Public Records Law", citation: "N.C. Gen. Stat. § 132-6", responseDays: 10, responseDayType: "business", noFixedDeadline: true, appealNote: "Produce 'as promptly as possible'; no fixed deadline." },
  { code: "US-ND", name: "North Dakota", statuteName: "Open Records Statute", citation: "N.D. Cent. Code § 44-04-18", responseDays: 10, responseDayType: "business", noFixedDeadline: true, appealNote: "Provide within a reasonable time; no fixed deadline." },
  { code: "US-OH", name: "Ohio", statuteName: "Public Records Act", citation: "Ohio Rev. Code § 149.43", responseDays: 10, responseDayType: "business", noFixedDeadline: true, appealNote: "Produce within a reasonable period of time; enforceable by mandamus." },
  { code: "US-OK", name: "Oklahoma", statuteName: "Open Records Act", citation: "Okla. Stat. tit. 51, § 24A.5", responseDays: 10, responseDayType: "business", noFixedDeadline: true, appealNote: "Respond promptly and without delay; no fixed deadline." },
  { code: "US-OR", name: "Oregon", statuteName: "Public Records Law", citation: "Or. Rev. Stat. § 192.329", responseDays: 5, responseDayType: "business", appealNote: "Acknowledge within 5 business days; complete response within 10 business days where practicable." },
  { code: "US-PA", name: "Pennsylvania", statuteName: "Right-to-Know Law", citation: "65 Pa. Stat. § 67.901", responseDays: 5, responseDayType: "business", appealNote: "Respond within 5 business days (30-day extension); appeal to Office of Open Records." },
  { code: "US-RI", name: "Rhode Island", statuteName: "Access to Public Records Act", citation: "R.I. Gen. Laws § 38-2-3", responseDays: 10, responseDayType: "business", appealNote: "Respond within 10 business days (20-day extension for good cause)." },
  { code: "US-SC", name: "South Carolina", statuteName: "Freedom of Information Act", citation: "S.C. Code Ann. § 30-4-30", responseDays: 10, responseDayType: "business", appealNote: "Determine within 10 business days for recent records (20 for older)." },
  { code: "US-SD", name: "South Dakota", statuteName: "Public Records Law", citation: "S.D. Codified Laws § 1-27-1.5", responseDays: 10, responseDayType: "business", noFixedDeadline: true, appealNote: "Respond promptly; no fixed statutory count." },
  { code: "US-TN", name: "Tennessee", statuteName: "Public Records Act", citation: "Tenn. Code Ann. § 10-7-503", responseDays: 7, responseDayType: "business", appealNote: "Within 7 business days produce records, deny, or give an expected production date." },
  { code: "US-TX", name: "Texas", statuteName: "Public Information Act", citation: "Tex. Gov't Code § 552.221", responseDays: 10, responseDayType: "business", appealNote: "Produce 'promptly'; must seek an AG ruling within 10 business days to withhold." },
  { code: "US-UT", name: "Utah", statuteName: "Government Records Access and Management Act", citation: "Utah Code § 63G-2-204", responseDays: 10, responseDayType: "business", appealNote: "Respond within 10 business days (expedited and extended timelines apply)." },
  { code: "US-VT", name: "Vermont", statuteName: "Public Records Act", citation: "1 V.S.A. § 318", responseDays: 3, responseDayType: "business", appealNote: "Respond within 3 business days; extensions in limited circumstances." },
  { code: "US-VA", name: "Virginia", statuteName: "Freedom of Information Act", citation: "Va. Code Ann. § 2.2-3704", responseDays: 5, responseDayType: "business", appealNote: "Respond within 5 business days (7-day extension allowed)." },
  { code: "US-WA", name: "Washington", statuteName: "Public Records Act", citation: "Wash. Rev. Code § 42.56.520", responseDays: 5, responseDayType: "business", appealNote: "Respond within 5 business days to acknowledge and provide an estimate." },
  { code: "US-WV", name: "West Virginia", statuteName: "Freedom of Information Act", citation: "W. Va. Code § 29B-1-3", responseDays: 5, responseDayType: "business", appealNote: "Respond within 5 business days." },
  { code: "US-WI", name: "Wisconsin", statuteName: "Public Records Law", citation: "Wis. Stat. § 19.35", responseDays: 10, responseDayType: "business", noFixedDeadline: true, appealNote: "Respond 'as soon as practicable and without delay'; no fixed deadline." },
  { code: "US-WY", name: "Wyoming", statuteName: "Public Records Act", citation: "Wyo. Stat. Ann. § 16-4-202", responseDays: 10, responseDayType: "business", noFixedDeadline: true, appealNote: "Produce within a reasonable time; contested cases go to district court." },
];

const JURISDICTION_BY_CODE: Record<string, Jurisdiction> = Object.fromEntries(
  JURISDICTIONS.map((j) => [j.code, j])
);

export function getJurisdiction(code: string | null | undefined): Jurisdiction | undefined {
  if (!code) return undefined;
  return JURISDICTION_BY_CODE[code];
}

/** Add N business days (skipping Sat/Sun) to a date. */
function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

/**
 * Compute the statutory response-due date for a request.
 * @param sentDate ISO date string (YYYY-MM-DD) the request was sent.
 * @param jurisdictionCode e.g. "US" or "US-CA".
 * @returns ISO date string (YYYY-MM-DD), or null if inputs are invalid.
 */
export function computeResponseDueDate(
  sentDate: string | null | undefined,
  jurisdictionCode: string | null | undefined
): string | null {
  if (!sentDate) return null;
  const jur = getJurisdiction(jurisdictionCode);
  if (!jur) return null;

  const start = new Date(`${sentDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;

  const due =
    jur.responseDayType === "business"
      ? addBusinessDays(start, jur.responseDays)
      : new Date(start.getTime() + jur.responseDays * 24 * 60 * 60 * 1000);

  return due.toISOString().slice(0, 10);
}
