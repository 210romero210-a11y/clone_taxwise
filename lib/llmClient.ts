export interface LLMFunctionCall {
  name: string;
  arguments: Record<string, any>;
}

export async function callLLMFunction(call: LLMFunctionCall) {
  // TODO: wire to your LLM provider (OpenAI, Anthropic, etc.)
  // This placeholder demonstrates expected shape and should return:
  // { success: boolean, result?: any, diagnostics?: Array<{fieldId:string,message:string,severity:'error'|'warning'}> }
  return {
    success: false,
    result: null,
    diagnostics: [{ fieldId: 'global', message: 'LLM client not configured', severity: 'error' as const }],
  };
}
