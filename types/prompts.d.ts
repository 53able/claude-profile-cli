declare module 'prompts' {
  type PromptChoice = {
    title: string;
    value: string;
    disabled?: boolean;
  };

  type PromptSchema =
    | { type: 'select'; name: string; message: string; choices: PromptChoice[] }
    | { type: 'confirm'; name: string; message: string; initial?: boolean };

  type PromptOptions = {
    onCancel?: () => void;
  };

  type PromptResult = Record<string, string | boolean | undefined>;

  const prompts: (schema: PromptSchema, options?: PromptOptions) => Promise<PromptResult>;
  export = prompts;
}
