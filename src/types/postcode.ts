export interface PostcodeRecord {
  postcodeId: string;
  code: string;
  outcode: string;
  incode: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  metrics: Record<string, unknown>;
  boroughId: string | null;
  borough?: { name: string } | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}
