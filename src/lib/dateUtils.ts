import { AttendanceRecord } from "../types";

/**
 * Parses YYYY-MM-DD string into a local Date at midnight to avoid timezone shifting.
 */
export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Formats a Date object into YYYY-MM-DD local date string.
 */
export const formatLocalDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Returns true if the given date string falls on a Sunday.
 */
export const isSunday = (dateStr: string): boolean => {
  if (!dateStr) return false;
  return parseLocalDate(dateStr).getDay() === 0;
};

/**
 * Returns true if the given date string falls on a Wednesday.
 */
export const isWednesday = (dateStr: string): boolean => {
  if (!dateStr) return false;
  return parseLocalDate(dateStr).getDay() === 3;
};

/**
 * Returns true if the attendance record represents a Cell meeting
 * (either explicitly flagged as CELL or recorded on a Wednesday / non-Sunday).
 */
export const isCellAttendance = (record: AttendanceRecord): boolean => {
  if (!record || !record.date) return false;
  if (record.attendanceType === "CELL") return true;
  if (record.attendanceType === "SUNDAY") return false;
  return !isSunday(record.date);
};

/**
 * Returns true if the attendance record represents Sunday mainstream service attendance.
 */
export const isSundayAttendance = (record: AttendanceRecord): boolean => {
  if (!record || !record.date) return false;
  if (record.attendanceType === "CELL") return false;
  if (record.attendanceType === "SUNDAY") return true;
  return isSunday(record.date);
};

/**
 * Given a Sunday date string (or any reference date), returns the YYYY-MM-DD
 * of the Wednesday immediately preceding it (e.g. Sunday minus 4 days).
 */
export const getPrecedingWednesday = (refDateStr: string): string => {
  const date = parseLocalDate(refDateStr);
  const day = date.getDay(); // 0 is Sunday, 3 is Wednesday
  const diff = day === 3 ? 0 : (day === 0 ? 4 : (day > 3 ? day - 3 : day + 4));
  date.setDate(date.getDate() - diff);
  return formatLocalDate(date);
};

/**
 * Given a Wednesday date string (or any reference date), returns the YYYY-MM-DD
 * of the following Sunday (e.g. Wednesday plus 4 days).
 */
export const getNextSunday = (refDateStr: string): string => {
  const date = parseLocalDate(refDateStr);
  const day = date.getDay();
  const diff = day === 0 ? 0 : (7 - day);
  date.setDate(date.getDate() + diff);
  return formatLocalDate(date);
};

/**
 * Returns the current active Sunday (defaults to today if today is Sunday,
 * otherwise the most recent Sunday).
 */
export const getActiveSunday = (refDate: Date = new Date()): string => {
  const d = new Date(refDate);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return formatLocalDate(d);
};

/**
 * Returns the Wednesday corresponding to the active week/cycle
 * (Wednesday of the current week).
 */
export const getActiveWednesday = (refDate: Date = new Date()): string => {
  const d = new Date(refDate);
  const day = d.getDay();
  const diff = day === 0 ? -4 : (3 - day);
  d.setDate(d.getDate() + diff);
  return formatLocalDate(d);
};
