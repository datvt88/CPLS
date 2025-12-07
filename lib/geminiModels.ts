/**
 * Valid Gemini Models (2025)
 * Updated: November 2025
 * Reference: https://ai.google.dev/gemini-api/docs/models
 */

export interface GeminiModel {
  id: string
  name: string
  description: string
  status: 'active' | 'experimental' | 'retired'
}

export const GEMINI_MODELS: GeminiModel[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Cân bằng tốc độ và hiệu suất',
    status: 'active',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Nhanh nhất, chi phí thấp',
    status: 'active',
  },
]

// Default model
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite'

// Get active models only
export function getActiveModels(): GeminiModel[] {
  return GEMINI_MODELS.filter(m => m.status === 'active' || m.status === 'experimental')
}

// Get model by ID
export function getModelById(id: string): GeminiModel | undefined {
  return GEMINI_MODELS.find(m => m.id === id)
}

// Validate model ID
export function isValidModel(id: string): boolean {
  const model = getModelById(id)
  return model !== undefined && (model.status === 'active' || model.status === 'experimental')
}
