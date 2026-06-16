export type AnniversaryType =
  | "birthday"
  | "wedding"
  | "dating"
  | "memorial"
  | "etc";

export interface Anniversary {
  id: string;
  userId: string;
  name: string;
  date: string;
  type: AnniversaryType;
  notifyDaysBefore: number[];
  createdAt: string;
}
