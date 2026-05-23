import type { DataSnapshot } from '../types';

export type MutationOp = 'INSERT' | 'UPDATE' | 'DELETE';

export interface ParsedMutation {
  op: MutationOp;
  tableOrCollection: string;
  setClause?: Record<string, unknown>;
  insertValues?: Record<string, unknown>;
  filter?: Record<string, unknown>;
  isMongo: boolean;
}

export interface ParsedQuery {
  isMutation: boolean;
  rawQuery: string;
  mutation?: ParsedMutation;
}

const SQL_UPDATE_REGEX = /^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i;
const SQL_INSERT_REGEX = /^INSERT\s+INTO\s+(\w+)(?:\s*\(([^)]+)\))?\s+VALUES\s*(.+)$/i;
const SQL_DELETE_REGEX = /^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i;
const MONGO_MUTATION_REGEX = /^db\.(\w+)\.(updateOne|updateMany|insertOne|insertMany|deleteOne|deleteMany)\(([\s\S]*)\)$/s;

function parseSetClause(setStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const pairs = setStr.split(',');
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key && valueParts.length > 0) {
      const col = key.trim();
      const valStr = valueParts.join('=').trim();
      result[col] = parseValue(valStr);
    }
  }
  return result;
}

function parseWhereClause(whereStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const conditions = whereStr.split(/\s+AND\s+/i);
  for (const cond of conditions) {
    const match = cond.match(/(\w+)\s*=\s*(.+)/);
    if (match) {
      result[match[1].trim()] = parseValue(match[2].trim());
    }
  }
  return result;
}

function parseInsertColumns(colsStr: string): string[] {
  return colsStr.split(',').map((c) => c.trim());
}

function parseInsertValues(valsStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const parts = splitByComma(valsStr);
  parts.forEach((val, i) => {
    result[`col${i + 1}`] = parseValue(val);
  });
  return result;
}

function splitByComma(str: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function parseValue(valStr: string): unknown {
  valStr = valStr.trim();
  if (valStr === 'NULL' || valStr === 'null') return null;
  if (valStr === 'true' || valStr === 'TRUE') return true;
  if (valStr === 'false' || valStr === 'FALSE') return false;
  if (/^-?\d+$/.test(valStr)) return parseInt(valStr, 10);
  if (/^-?\d+\.\d+$/.test(valStr)) return parseFloat(valStr);
  if ((valStr.startsWith("'") && valStr.endsWith("'")) || (valStr.startsWith('"') && valStr.endsWith('"'))) {
    return valStr.slice(1, -1);
  }
  if (valStr.startsWith('[') || valStr.startsWith('{')) {
    try {
      return JSON.parse(valStr);
    } catch {
      return valStr;
    }
  }
  return valStr;
}

function parseMongoArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < argsStr.length; i++) {
    const c = argsStr[i];
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function parseJsonSafe(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

export function parseMutationQuery(query: string): ParsedMutation | null {
  const trimmed = query.trim();
  
  const updateMatch = trimmed.match(SQL_UPDATE_REGEX);
  if (updateMatch) {
    const setClause = parseSetClause(updateMatch[2]);
    const whereClause = updateMatch[3] ? parseWhereClause(updateMatch[3]) : undefined;
    return {
      op: 'UPDATE',
      tableOrCollection: updateMatch[1],
      setClause,
      filter: whereClause,
      isMongo: false,
    };
  }
  
  const insertMatch = trimmed.match(SQL_INSERT_REGEX);
  if (insertMatch) {
    const columns = insertMatch[2] ? parseInsertColumns(insertMatch[2]) : null;
    const rawValues = parseInsertValues(insertMatch[3]);
    const insertValues: Record<string, unknown> = {};
    if (columns) {
      const values = splitByComma(insertMatch[3]);
      columns.forEach((col, i) => {
        insertValues[col] = parseValue(values[i] || 'NULL');
      });
    } else {
      Object.assign(insertValues, rawValues);
    }
    return {
      op: 'INSERT',
      tableOrCollection: insertMatch[1],
      insertValues,
      isMongo: false,
    };
  }
  
  const deleteMatch = trimmed.match(SQL_DELETE_REGEX);
  if (deleteMatch) {
    const whereClause = deleteMatch[2] ? parseWhereClause(deleteMatch[2]) : undefined;
    return {
      op: 'DELETE',
      tableOrCollection: deleteMatch[1],
      filter: whereClause,
      isMongo: false,
    };
  }
  
  const mongoMutationMatch = trimmed.match(MONGO_MUTATION_REGEX);
  if (mongoMutationMatch) {
    const collection = mongoMutationMatch[1];
    const method = mongoMutationMatch[2];
    const argsStr = mongoMutationMatch[3];
    const args = parseMongoArgs(argsStr);
    const filter = parseJsonSafe(args[0] || '{}');
    const update = args[1] ? parseJsonSafe(args[1]) : undefined;
    
    if (method === 'insertOne' || method === 'insertMany') {
      return {
        op: 'INSERT',
        tableOrCollection: collection,
        insertValues: Array.isArray(filter) ? filter[0] : filter,
        isMongo: true,
      };
    }
    if (method === 'updateOne' || method === 'updateMany') {
      return {
        op: 'UPDATE',
        tableOrCollection: collection,
        setClause: update?.$set || update || {},
        filter: filter,
        isMongo: true,
      };
    }
    if (method === 'deleteOne' || method === 'deleteMany') {
      return {
        op: 'DELETE',
        tableOrCollection: collection,
        filter: filter,
        isMongo: true,
      };
    }
  }
  
  return null;
}

export function isMutationQuery(query: string): boolean {
  const trimmed = query.trim();
  if (/^(SELECT|DB\.(\w+)\.(find|findOne))/i.test(trimmed)) return false;
  return /^(UPDATE|INSERT|DELETE|DB\.)/i.test(trimmed);
}

export function buildBeforeImageQuery(parsed: ParsedMutation): string {
  if (parsed.isMongo) {
    return `db.${parsed.tableOrCollection}.findOne(${JSON.stringify(parsed.filter || {})})`;
  }
  if (parsed.op === 'INSERT') return '';
  let sql = `SELECT * FROM ${parsed.tableOrCollection}`;
  if (parsed.filter && Object.keys(parsed.filter).length > 0) {
    const whereParts = Object.entries(parsed.filter).map(([k, v]) => {
      if (v === null) return `${k} IS NULL`;
      if (typeof v === 'string') return `${k} = '${v}'`;
      return `${k} = ${v}`;
    });
    sql += ` WHERE ${whereParts.join(' AND ')}`;
  }
  return sql;
}

export function buildAfterImage(beforeImage: DataSnapshot, parsed: ParsedMutation): DataSnapshot {
  if (parsed.op === 'INSERT') {
    return parsed.insertValues || null;
  }
  if (parsed.op === 'DELETE') {
    return null;
  }
  if (parsed.op === 'UPDATE' && beforeImage && parsed.setClause) {
    return { ...beforeImage, ...parsed.setClause };
  }
  return beforeImage;
}

export function buildMutationSql(parsed: ParsedMutation): string {
  if (parsed.isMongo) {
    switch (parsed.op) {
      case 'INSERT':
        return `db.${parsed.tableOrCollection}.insertOne(${JSON.stringify(parsed.insertValues || {})})`;
      case 'UPDATE':
        return `db.${parsed.tableOrCollection}.updateOne(${JSON.stringify(parsed.filter || {})}, ${JSON.stringify({ $set: parsed.setClause || {} })})`;
      case 'DELETE':
        return `db.${parsed.tableOrCollection}.deleteOne(${JSON.stringify(parsed.filter || {})})`;
    }
  }
  switch (parsed.op) {
    case 'INSERT': {
      const cols = parsed.insertValues ? Object.keys(parsed.insertValues) : [];
      const vals = parsed.insertValues ? Object.values(parsed.insertValues).map((v) => {
        if (v === null) return 'NULL';
        if (typeof v === 'string') return `'${v}'`;
        return String(v);
      }) : [];
      return `INSERT INTO ${parsed.tableOrCollection} (${cols.join(', ')}) VALUES (${vals.join(', ')})`;
    }
    case 'UPDATE': {
      const setParts = parsed.setClause ? Object.entries(parsed.setClause).map(([k, v]) => {
        if (v === null) return `${k} = NULL`;
        if (typeof v === 'string') return `${k} = '${v}'`;
        return `${k} = ${v}`;
      }) : [];
      let sql = `UPDATE ${parsed.tableOrCollection} SET ${setParts.join(', ')}`;
      if (parsed.filter && Object.keys(parsed.filter).length > 0) {
        const whereParts = Object.entries(parsed.filter).map(([k, v]) => {
          if (v === null) return `${k} IS NULL`;
          if (typeof v === 'string') return `${k} = '${v}'`;
          return `${k} = ${v}`;
        });
        sql += ` WHERE ${whereParts.join(' AND ')}`;
      }
      return sql;
    }
    case 'DELETE': {
      let sql = `DELETE FROM ${parsed.tableOrCollection}`;
      if (parsed.filter && Object.keys(parsed.filter).length > 0) {
        const whereParts = Object.entries(parsed.filter).map(([k, v]) => {
          if (v === null) return `${k} IS NULL`;
          if (typeof v === 'string') return `${k} = '${v}'`;
          return `${k} = ${v}`;
        });
        sql += ` WHERE ${whereParts.join(' AND ')}`;
      }
      return sql;
    }
  }
  return '';
}