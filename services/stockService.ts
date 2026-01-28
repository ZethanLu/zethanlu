// src/services/stockService.ts

export interface SyncStatus {
  timestamp: string;
  prices: Record<string, number>;
  names: Record<string, string>;
  errors: string[];
}

export const formatDateTW = (): string => {
  const d = new Date();
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

// 使用 CORS Proxy 繞過瀏覽器限制，直接存取 Yahoo Finance
const CORS_PROXY = 'https://corsproxy.io/?'; 
// 備用 Proxy: 'https://api.allorigins.win/raw?url=';

const fetchStockPrice = async (code: string): Promise<{ price: number; name?: string } | null> => {
  try {
    // 判斷是上市 (.TW) 還是上櫃 (.TWO)
    // 簡單邏輯：先試 .TW，失敗或無數據再試 .TWO，但在批量抓取時我們通常需要使用者輸入正確後綴，
    // 這裡為了方便，我們預設先嘗試 .TW
    let targetCode = code.toUpperCase();
    if (!targetCode.includes('.')) {
        targetCode += '.TW'; // 預設追加 .TW
    }

    const url = `${CORS_PROXY}${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${targetCode}?interval=1d`)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    const result = data.chart.result[0];
    
    if (!result || !result.meta) return null;

    // 取得最新價格 (Regular Market Price)
    const price = result.meta.regularMarketPrice;
    // 嘗試抓取股票名稱 (Yahoo 有時不準，但可參考)
    // Yahoo API 回傳的 symbol 可能是 "2330.TW"，我們可以用它來做簡單驗證
    
    return { price };
  } catch (error) {
    console.error(`Error fetching ${code}:`, error);
    return null;
  }
};

export const fetchAllStockPrices = async (): Promise<SyncStatus> => {
  // 從 LocalStorage 讀取所有股票代碼 (為了不傳入參數，我們直接讀取儲存的資料，或者你也可以修改函式簽名傳入 stocks)
  // 這裡假設我們只是一個 Helper，實際邏輯應該是 Component 傳入代碼列表。
  // 為了配合你的 App.tsx 結構，我們做一點調整：
  
  // *注意：由於原本的 App.tsx 是呼叫 fetchAllStockPrices() 且不帶參數，
  // 我們需要從 LocalStorage 偷看有哪些股票，或者這個函式本身不該負責讀取 LocalStorage。
  // 為了最快修復，我們修改 App.tsx 傳入 stocks，或者在這裡讀取。
  // 這裡選擇：讀取 LocalStorage (因為你的 App.tsx 介面如此)*
  
  const savedStocks = localStorage.getItem('app_stocks'); // 請確認你的 APP_STORAGE_KEYS.STOCKS 對應的值
  const stocks = savedStocks ? JSON.parse(savedStocks) : [];
  
  const prices: Record<string, number> = {};
  const names: Record<string, string> = {}; // Yahoo API 較難抓中文名，這裡暫時留空或由後續補強
  const errors: string[] = [];

  // 平行請求所有股票 (Promise.all)
  await Promise.all(stocks.map(async (stock: any) => {
    // 嘗試抓取 (先試 .TW)
    let data = await fetchStockPrice(stock.code);
    
    // 如果失敗且沒後綴，嘗試 .TWO (上櫃)
    if (!data && !stock.code.includes('.')) {
         const dataTwo = await fetchStockPrice(`${stock.code}.TWO`);
         if(dataTwo) data = dataTwo;
    }

    if (data) {
      prices[stock.code] = data.price;
    } else {
      errors.push(stock.code);
    }
  }));

  return {
    timestamp: formatDateTW(),
    prices,
    names,
    errors
  };
};
