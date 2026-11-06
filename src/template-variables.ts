export const TEMPLATE_VARIABLE_LIMITS = {
  fields: 20,
  labelChars: 60,
  valueChars: 500,
  outputBytes: 64 * 1024,
} as const;

export interface TemplateVariableField {
  key: string;
  label: string;
}

interface TemplateToken extends TemplateVariableField {
  start: number;
  end: number;
}

function variableKey(label: string): string {
  return label.normalize("NFC").toLocaleLowerCase("vi");
}

function tokensIn(body: string): TemplateToken[] {
  const tokens: TemplateToken[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf("{{", cursor);
    if (start < 0) break;
    const close = body.indexOf("}}", start + 2);
    if (close < 0) break;
    const nested = body.indexOf("{{", start + 2);
    if (nested >= 0 && nested < close) {
      cursor = nested;
      continue;
    }
    const rawLabel = body.slice(start + 2, close);
    const label = rawLabel.trim();
    const invalid =
      !label ||
      /[{}\r\n\u2028\u2029\u0000-\u001f\u007f-\u009f]/u.test(label) ||
      Array.from(label).length > TEMPLATE_VARIABLE_LIMITS.labelChars;
    if (!invalid) {
      tokens.push({
        start,
        end: close + 2,
        key: variableKey(label),
        label,
      });
    }
    cursor = close + 2;
  }
  return tokens;
}

export function scanTemplateVariables(body: string): {
  fields: TemplateVariableField[];
  error?: string;
} {
  const fields: TemplateVariableField[] = [];
  const seen = new Set<string>();
  for (const token of tokensIn(body)) {
    if (seen.has(token.key)) continue;
    seen.add(token.key);
    if (fields.length === TEMPLATE_VARIABLE_LIMITS.fields)
      return {
        fields,
        error: `Mỗi mẫu dùng tối đa ${TEMPLATE_VARIABLE_LIMITS.fields} trường khác nhau.`,
      };
    fields.push({ key: token.key, label: token.label });
  }
  return { fields };
}

export function expandTemplateVariables(
  body: string,
  values: Readonly<Record<string, string>>,
): { ok: true; text: string } | { ok: false; message: string } {
  const scan = scanTemplateVariables(body);
  if (scan.error) return { ok: false, message: scan.error };

  const keys = Object.keys(values);
  if (
    keys.length !== scan.fields.length ||
    scan.fields.some((field) => !Object.hasOwn(values, field.key))
  )
    return {
      ok: false,
      message: "Các trường của mẫu đã thay đổi. Mở lại mẫu rồi thử sao chép.",
    };

  for (const field of scan.fields) {
    const value = values[field.key];
    if (
      typeof value !== "string" ||
      value.length > TEMPLATE_VARIABLE_LIMITS.valueChars * 2 ||
      Array.from(value).length > TEMPLATE_VARIABLE_LIMITS.valueChars
    )
      return {
        ok: false,
        message: `Giá trị “${field.label}” tối đa ${TEMPLATE_VARIABLE_LIMITS.valueChars} ký tự.`,
      };
  }

  const tokens = tokensIn(body);
  const encoder = new TextEncoder();
  const valueBytes = new Map(
    scan.fields.map((field) => [
      field.key,
      encoder.encode(values[field.key]).byteLength,
    ]),
  );
  let projectedBytes = encoder.encode(body).byteLength;
  for (const token of tokens)
    projectedBytes +=
      valueBytes.get(token.key)! -
      encoder.encode(body.slice(token.start, token.end)).byteLength;
  if (projectedBytes > TEMPLATE_VARIABLE_LIMITS.outputBytes)
    return {
      ok: false,
      message:
        `Nội dung sau khi điền vượt ${TEMPLATE_VARIABLE_LIMITS.outputBytes / 1024} KiB.`,
    };

  const parts: string[] = [];
  let cursor = 0;
  for (const token of tokens) {
    parts.push(body.slice(cursor, token.start), values[token.key]);
    cursor = token.end;
  }
  parts.push(body.slice(cursor));
  const text = parts.join("");
  return { ok: true, text };
}
