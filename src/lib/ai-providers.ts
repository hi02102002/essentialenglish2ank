export type AIProviderId = 'ltn' | 'openai' | 'custom'

export type AIModelOption = {
  id: string
  name: string
  description?: string
  recommended?: boolean
}

export type AIProviderDef = {
  id: AIProviderId
  name: string
  badge: string
  description: string
  defaultBaseURL: string
  defaultModel: string
  models: AIModelOption[]
  apiKeyPlaceholder: string
  apiKeyEnvName: string
  docsUrl: string
}

export const AI_PROVIDERS: Record<AIProviderId, AIProviderDef> = {
  ltn: {
    id: 'ltn',
    name: 'LTN AI Proxy',
    badge: 'LTN AI',
    description: 'High-speed API proxy cho resellers & teams (https://ltnproxy.com/docs)',
    defaultBaseURL: 'https://api.ltnproxy.com/v1',
    defaultModel: 'gpt-5.6-luna',
    apiKeyPlaceholder: 'sk-... (LTN API Key)',
    apiKeyEnvName: 'LTN_API_KEY hoặc OPENAI_API_KEY',
    docsUrl: 'https://ltnproxy.com/docs',
    models: [
      {
        id: 'gpt-5.6-luna',
        name: 'GPT-5.6 Luna',
        description: 'Tốc độ phản hồi cực nhanh, hỗ trợ reasoning & JSON outputs',
        recommended: true,
      },
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        description: 'Rất nhanh và kinh tế, thích hợp xử lý hàng loạt thẻ từ vựng',
      },
      {
        id: 'claude-opus-5-5',
        name: 'Claude Opus 5.5',
        description: 'Văn phong tự nhiên, sắc sảo cho ghi chú ngữ pháp và collocations',
      },
      {
        id: 'deepseek-v4.1-flash',
        name: 'DeepSeek V4.1 Flash',
        description: 'Mô hình suy luận tốc độ cao',
      },
      {
        id: 'qwen3.8-max',
        name: 'Qwen 3.8 Max',
        description: 'Mô hình đa nhiệm chất lượng cao',
      },
      {
        id: 'kimi-k3',
        name: 'Kimi K3',
        description: 'Mô hình lý luận ngữ cảnh dài',
      },
      {
        id: 'glm-5.3-prime',
        name: 'GLM 5.3 Prime',
        description: 'Mô hình ngôn ngữ tự nhiên tối ưu',
      },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (Official)',
    badge: 'OpenAI',
    description: 'API chính thức từ platform.openai.com',
    defaultBaseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    apiKeyPlaceholder: 'sk-proj-... (OpenAI Key)',
    apiKeyEnvName: 'OPENAI_API_KEY',
    docsUrl: 'https://platform.openai.com/docs',
    models: [
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Nhanh, thông minh, chi phí tối ưu nhất của OpenAI',
        recommended: true,
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Mô hình flagship mạnh mẽ, toàn diện',
      },
      {
        id: 'o3-mini',
        name: 'o3-mini',
        description: 'Mô hình suy luận reasoning thế hệ mới',
      },
    ],
  },
  custom: {
    id: 'custom',
    name: 'Custom OpenAI-Compatible',
    badge: 'Custom',
    description: 'Proxy riêng, Ollama, vLLM, OpenCode hoặc endpoint tương thích OpenAI',
    defaultBaseURL: 'http://localhost:11434/v1',
    defaultModel: 'gpt-4o-mini',
    apiKeyPlaceholder: 'Tùy chọn (nếu proxy yêu cầu)',
    apiKeyEnvName: 'CUSTOM_AI_KEY hoặc OPENAI_API_KEY',
    docsUrl: 'https://github.com/openai/openai-openapi',
    models: [
      {
        id: 'gpt-4o-mini',
        name: 'gpt-4o-mini',
        recommended: true,
      },
      {
        id: 'gpt-5.6-luna',
        name: 'gpt-5.6-luna',
      },
      {
        id: 'llama3',
        name: 'llama3',
      },
    ],
  },
}

export type ClientAiRuntimeConfig = {
  provider?: AIProviderId
  model?: string
  baseURL?: string
  apiKey?: string
}
