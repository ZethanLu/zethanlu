
import { GoogleGenAI } from "@google/genai";
import { Stock, PortfolioTotals, WindMood } from "../types";

/**
 * 取得 AI 投資顧問建議
 * 遵循安全性規範：直接從 process.env.API_KEY 取得金鑰，且在調用時才初始化實體
 */
export const getPortfolioAdvice = async (
  stocks: Stock[],
  totals: PortfolioTotals,
  currentWind: WindMood
): Promise<string> => {
  try {
    // 確保 API Key 存在
    if (!process.env.API_KEY) {
      throw new Error("系統環境未偵測到有效的 API Key");
    }

    // 每次調用時初始化，確保獲取最新的環境變數
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-flash-preview';
    
    const portfolioSummary = stocks.map(s => 
      `- ${s.name}(${s.code}): 週期 ${s.period}, 成本 ${s.cost}, 現價 ${s.currentPrice}`
    ).join('\n');

    const prompt = `
      你是一位專精於台灣股市的投資戰略顧問，語氣冷靜、專業且具備批判性思維。
      
      【當前市場環境 (風度)】：${currentWind.name}
      
      【我的投資組合數據】：
      - 總入金（總本金）：${totals.totalBudget} TWD
      - 當前總市值：${totals.marketValue} TWD
      - 未實現損益：${totals.totalProfit >= 0 ? '+' : ''}${totals.totalProfit} TWD
      - 可用現金流：${totals.availableCash} TWD
      
      【具體持股明細】：
      ${portfolioSummary}
      
      【任務要求】：
      1. 分析當前市場「風度」對上述持股的潛在影響。
      2. 評估現金與部位的佔比是否健康（目前現金佔比：${((totals.availableCash / totals.totalBudget) * 100).toFixed(1)}%）。
      3. 給予短、中、長期的具體戰術建議（例如：減碼、續抱、或尋找新的價值窪地）。
      
      請以繁體中文回答，條列式呈現，內容需簡練且具備高度專業質感。
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.6, // 降低隨機性，提升建議的穩定度
        maxOutputTokens: 800
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 回傳內容為空");

    return text;

  } catch (error: any) {
    console.error("Gemini AI Consultant Error:", error);

    // 處理特定 API 錯誤
    if (error.message?.includes("Requested entity was not found")) {
      return "【系統提示】：API 金鑰權限異常或專案未設定，請確認您的 API Key 是否具備 Gemini 3 系列的使用權限。";
    }
    
    if (error.message?.includes("API key not valid")) {
      return "【系統提示】：API Key 無效或已過期，請重新檢查環境變數設定。";
    }

    return `AI 顧問目前無法提供即時分析（錯誤原因：${error.message || "未知網路異常"}）。`;
  }
};
