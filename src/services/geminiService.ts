import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const getGameTips = async (language: 'zh' | 'en') => {
  const prompt = language === 'zh' 
    ? "给玩塔防游戏《Elena新星防御》的玩家提供三条简短的战术建议。导弹指令风格。"
    : "Provide three short tactical tips for players of 'Elena Nova Defense', a Missile Command style game.";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Failed to fetch tips", error);
    return null;
  }
};
