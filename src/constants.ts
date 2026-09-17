export const APP_VERSION = "1.0.0";
export const DEFAULT_SETTINGS = {
  churches: ["UJ", "LJ", "K", "I", "N"],
  organization: {
    zones: []
  },
  features: {},
  permissions: {},
  themeColors: {}
};
export const getSundaysInYear = (year: number) => {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const sundays = [];
  
  let d = new Date(startDate);
  while (d.getDay() !== 0) {
    d.setDate(d.getDate() + 1);
  }
  
  while (d <= endDate) {
    sundays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return sundays;
};
export const INITIAL_MEMBERS: any[] = [];
export const INITIAL_ATTENDANCE: any[] = [];
export const DEFAULT_CLOUD_CONFIG: any = {};
