export interface PostcodeRecord {
  postcodeId: string;
  code: string;
  outcode: string;
  incode: string;
  latitude: number | null;
  longitude: number | null;
  metrics: Record<string, unknown>;
  boroughId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}
