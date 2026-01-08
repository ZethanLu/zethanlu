
export interface Stock {
  id: number;
  name: string;
  code: string;
  shares: number;
  cost: number;
  currentPrice: number;
  period: '短線' | '中期' | '長期';
  takeProfit: number | null;
  stopLoss: number | null;
}

export interface Transaction {
  id: number;
  amount: number;
  type: 'deposit' | 'withdraw';
  date: string;
}

export interface Snapshot {
  id: number;
  date: string;
  marketValue: number;
  totalProfit: number;
  wind: WindMood;
  stockCount: number;
}

export interface WindMood {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export interface PortfolioTotals {
  totalBudget: number;
  investedCapital: number;
  marketValue: number;
  availableCash: number;
  totalProfit: number;
}
