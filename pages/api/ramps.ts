import type { NextApiRequest, NextApiResponse } from 'next';
import { LOADING_RAMPS, UNLOADING_RAMPS } from '../../lib/availability';

export default function handler(_req:NextApiRequest,res:NextApiResponse){
  res.json({ loading: LOADING_RAMPS, unloading: UNLOADING_RAMPS, version: process.env.RENDER_GIT_COMMIT || null });
}
