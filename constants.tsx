
import { WindMood } from './types';

export const WIND_MOODS: WindMood[] = [
  { id: 1, name: '強風 (風箏飛高高)', icon: 'Tornado', color: 'text-red-400' },
  { id: 2, name: '亂流 (注意風箏高度)', icon: 'Wind', color: 'text-yellow-400' },
  { id: 3, name: '陣風 (注意風險機會)', icon: 'CloudLightning', color: 'text-blue-400' },
  { id: 4, name: '無風 (找價值好股)', icon: 'Snowflake', color: 'text-emerald-400' }
];

export const APP_STORAGE_KEYS = {
  STOCKS: 'portfolio_v3_stocks',
  TRANSACTIONS: 'portfolio_v3_trans',
  HISTORY: 'portfolio_v3_history',
  WIND: 'portfolio_v3_wind'
};
