/**
 * Parser tolerante para sintaxis tipo mongosh:
 *  - Claves sin comillas dobles: { carne: "x" }
 *  - Claves con prefijo $: { $set: ... }
 *  - Cadenas con comillas simples: { nombre: 'Ana' }
 * Si la entrada ya es JSON válido se usa tal cual.
 */
export function parseRelaxedJson(str: string): Record<string, unknown> {
  const trimmed = str.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return JSON.parse(relaxedToStrictJson(trimmed));
    } catch {
      return {};
    }
  }
}

/**
 * Convierte un objeto/arreglo estilo mongosh a JSON estricto:
 *  - Preserva cadenas con comillas dobles tal cual.
 *  - Convierte cadenas con comillas simples a comillas dobles (escapando ").
 *  - Agrega comillas a claves no quoteadas (incluyendo las que empiezan con $).
 */
export function relaxedToStrictJson(input: string): string {
  let out = '';
  let i = 0;
  while (i < input.length) {
    const c = input[i];

    if (c === '"') {
      out += '"';
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < input.length) {
          out += input[i] + input[i + 1];
          i += 2;
        } else {
          out += input[i];
          i++;
        }
      }
      out += '"';
      i++;
      continue;
    }

    if (c === "'") {
      out += '"';
      i++;
      while (i < input.length && input[i] !== "'") {
        if (input[i] === '\\' && i + 1 < input.length) {
          out += input[i] + input[i + 1];
          i += 2;
        } else if (input[i] === '"') {
          out += '\\"';
          i++;
        } else {
          out += input[i];
          i++;
        }
      }
      out += '"';
      i++;
      continue;
    }

    out += c;
    i++;
  }

  // Quote unquoted keys: precedido por { o , y seguido por :
  out = out.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":');

  return out;
}
