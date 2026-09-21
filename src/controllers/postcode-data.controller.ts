import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as postcodeDataService from '@/services/postcode-data.service';

export const getPostcodeDataByCode = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const code = String(req.params.code);
  const data = await postcodeDataService.getPostcodeDataByCode(code);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: `Postcode data fetched successfully for ${code}`,
  };
  res.status(200).json(response);
};
