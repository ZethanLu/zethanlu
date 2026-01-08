
/**
 * 證交所 (TWSE) 與 櫃買中心 (TPEx) 資料同步服務
 * 實作高可用性重試機制與超時控制
 */

const TWSE_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
const TPEX_URL = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes';

export interface SyncStatus {
  prices: Record<string, number>;
  names: Record<string, string>;
  errors: string[];
  timestamp: string;
}

/**
 * 格式化為台灣地區習慣的日期格式
 */
export const formatDateTW = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}年${m}月${d}日 ${hh}:${mm}:${ss} (UTC+8)`;
};

/**
 * 具備超時與重試機制的 Fetch 封裝
 * 預設超時延長至 30 秒以應對慢速代理
 */
const fetchWithRetry = async (url: string, retries = 3, timeout = 30000): Promise<any> => {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
            'Accept': 'application/json',
        }
      });
      clearTimeout(id);

      if (!response.ok) {
        if (response.status === 408 || response.status === 429 || response.status >= 500) {
            throw new Error(`伺服器忙碌 (HTTP ${response.status})`);
        }
        throw new Error(`連線失敗 (HTTP ${response.status})`);
      }

      const contentType = response.headers.get('content-type');
      const text = await response.text();

      // 檢查是否抓到 HTML 錯誤頁面（常見於代理伺服器超時回傳）
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        throw new Error('代理伺服器回傳非預期 HTML 內容 (可能是超時頁面)');
      }

      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('回傳資料格式並非有效的 JSON');
      }
    } catch (err: any) {
      clearTimeout(id);
      
      // 處理超時異常
      if (err.name === 'AbortError') {
        lastError = new Error(`請求超時 (超過 ${timeout/1000} 秒)`);
      } else {
        lastError = err as Error;
      }
      
      if (i < retries - 1) {
        // 指數退避重試邏輯
        const delay = Math.pow(2, i) * 1500;
        console.warn(`[重試 ${i + 1}/${retries}] 請求失敗: ${lastError.message}，將在 ${delay/1000} 秒後重試...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('多次重試後仍無法取得資料');
};

export const fetchAllStockPrices = async (): Promise<SyncStatus> => {
  const errors: string[] = [];
  const priceMap: Record<string, number> = {};
  const nameMap: Record<string, string> = {};

  /**
   * 抓取證交所數據 (TWSE)
   */
  const fetchTwse = async () => {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(TWSE_URL)}`;
    return await fetchWithRetry(proxyUrl);
  };

  /**
   * 抓取櫃買中心數據 (TPEx)
   */
  const fetchTpex = async () => {
    // 優先使用 corsproxy.io
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(TPEX_URL)}`;
    try {
      return await fetchWithRetry(proxyUrl);
    } catch (e: any) {
      console.warn(`TPEx 主要代理失敗 (${e.message})，嘗試切換備援代理...`);
      // 備援：AllOrigins
      const backupUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(TPEX_URL)}&_=${Date.now()}`;
      const res = await fetchWithRetry(backupUrl);
      const contents = typeof res.contents === 'string' ? JSON.parse(res.contents) : res.contents;
      if (!contents) throw new Error("備援代理回傳內容為空");
      return contents;
    }
  };

  try {
    const [twseRes, tpexRes] = await Promise.allSettled([
      fetchTwse(),
      fetchTpex()
    ]);

    // 處理 TWSE (證交所)
    if (twseRes.status === 'fulfilled' && Array.isArray(twseRes.value)) {
      twseRes.value.forEach((item: any) => {
        const code = String(item.Code || "").trim();
        const name = String(item.Name || "").trim();
        const priceStr = item.ClosingPrice;
        
        if (code && name) nameMap[code] = name;
        if (priceStr && priceStr !== '-' && priceStr !== '') {
          const price = parseFloat(String(priceStr).replace(/,/g, ''));
          if (!isNaN(price)) priceMap[code] = price;
        }
      });
    } else {
      const msg = twseRes.status === 'rejected' ? twseRes.reason.message : '連線異常';
      errors.push(`證交所: ${msg}`);
    }

    // 處理 TPEx (櫃買中心)
    if (tpexRes.status === 'fulfilled' && Array.isArray(tpexRes.value)) {
      tpexRes.value.forEach((item: any) => {
        const code = String(item.SecuritiesCompanyCode || "").trim();
        const name = String(item.CompanyName || "").trim();
        const priceStr = item.Close;
        
        if (code && name) {
          nameMap[code] = name;
          if (priceStr && priceStr !== '-' && priceStr !== '') {
            const price = parseFloat(String(priceStr).replace(/,/g, ''));
            if (!isNaN(price)) {
              priceMap[code] = price;
            }
          }
        }
      });
    } else {
      const msg = tpexRes.status === 'rejected' ? tpexRes.reason.message : '連線異常';
      errors.push(`櫃買中心: ${msg}`);
      console.error("TPEx Sync Failure Detail:", tpexRes.status === 'rejected' ? tpexRes.reason : "Unknown");
    }

  } catch (e) {
    errors.push("系統核心異常，請檢查網路狀態");
    console.error("Critical Sync Error:", e);
  }

  return {
    prices: priceMap,
    names: nameMap,
    errors,
    timestamp: formatDateTW()
  };
};
