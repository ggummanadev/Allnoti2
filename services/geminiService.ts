
import { GoogleGenAI, Type } from "@google/genai";
import { WorkflowStep } from "../types";

export async function suggestWorkflowSteps(workflowName: string): Promise<{ steps: Omit<WorkflowStep, 'id'>[], icon: string }> {
  try {
    // Initialize GoogleGenAI inside the function to ensure the latest API key is used
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `업무 종류 "${workflowName}"에 필요한 하위 작업 리스트와 이 업무에 가장 잘 어울리는 FontAwesome 6 Free 실질 아이콘 클래스명(예: fa-briefcase, fa-laptop-code, fa-calendar-check)을 생성해줘. 각 작업은 작업명(title)과 작업 완료 기한으로부터 몇 시간 전(hoursBefore, 0~720 사이 정수)에 수행해야 하는지를 포함해야 해. 한국어로 응답해줘. 이 전체 단계를 하나의 '프로세스'로 간주해.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            icon: { type: Type.STRING, description: "FontAwesome 클래스명 (예: fa-clipboard-list)" },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "하위 작업 명칭" },
                  hoursBefore: { type: Type.INTEGER, description: "마감 시간 기준 몇 시간 전 (0~720)" }
                },
                required: ["title", "hoursBefore"]
              }
            }
          },
          required: ["icon", "steps"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini suggestion failed:", error);
    return { steps: [], icon: "fa-tasks" };
  }
}

export async function suggestIconOnly(workflowName: string, currentIcon: string): Promise<string> {
  try {
    // Initialize GoogleGenAI inside the function to ensure the latest API key is used
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `업무 종류 "${workflowName}"에 어울리는 FontAwesome 6 Free 아이콘 클래스명 하나를 추천해줘. 현재 아이콘은 "${currentIcon}"이야. 이것과 다른 새로운 아이콘을 추천해줘. JSON 형식으로 "icon" 필드에 담아서 응답해줘. 예: {"icon": "fa-star"}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            icon: { type: Type.STRING }
          },
          required: ["icon"]
        }
      }
    });
    const result = JSON.parse(response.text);
    return result.icon;
  } catch (error) {
    console.error("Icon suggestion failed:", error);
    return currentIcon || "fa-tasks";
  }
}
